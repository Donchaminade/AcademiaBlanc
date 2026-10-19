import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  accepterTransfert,
  compterParStatut,
  csvHistorique,
  envoyerTransfert,
  masquerCode,
  normaliserCode,
  recapitulatifEnvoi,
  refuserTransfert,
  regrouperParOrigine,
  resoudreDestinataire,
} from './transferts';
import type { TransfertVue } from './transferts';
import { estSessionTransferee, filtrerRoster, sessionsSoeurs, statsExamenCommunParEleve } from './workspace';
import { appliquerExamenCommun, computeCandidateStats } from '../data/mockData';
import { extremesMatiereAffiches, rangMatiereAffiche } from '../utils/bulletinMetrics';
import type { Candidate, Subject } from '../types';

const candidat = (id: string, originSchool: string, grades: Record<string, number> = {}, extra: Partial<Candidate> = {}): Candidate => ({
  id,
  tableNumber: Number(id),
  matricule: `M-${id}`,
  fullName: `Élève ${id}`,
  dob: '',
  birthPlace: '',
  originSchool,
  gender: 'F',
  serie: '',
  examCenter: '',
  examCenterName: '',
  parentPhone: '',
  parentEmail: '',
  grades: Object.fromEntries(Object.entries(grades).map(([k, v]) => [k, { score: v, appreciation: '' }])),
  generalObservation: '',
  ...extra,
});

describe('normaliserCode / masquerCode', () => {
  it('met en forme une saisie libre et refuse les codes incomplets ou ambigus', () => {
    assert.equal(normaliserCode(' k7f3 9qzt '), 'K7F3-9QZT');
    assert.equal(normaliserCode('K7F3-9QZT'), 'K7F3-9QZT');
    assert.equal(normaliserCode('K7F39QZ'), null);
    // 0, O, 1, I et L ne font pas partie de l'alphabet : ils sont ignorés, le code devient incomplet.
    assert.equal(normaliserCode('K7F3-9QZ0'), null);
    assert.equal(normaliserCode(''), null);
  });

  it('masque tous les caractères sauf le tiret', () => {
    assert.equal(masquerCode('K7F3-9QZT'), '••••-••••');
  });
});

describe('regrouperParOrigine', () => {
  const centre = 'CS Harmonia';
  const candidats = [
    candidat('1', 'Collège Y', { m: 12, f: 10 }),
    candidat('2', 'collège  y ', { m: 8 }),
    candidat('3', 'Collège Z', { m: 15, f: 14 }),
    candidat('4', 'CS Harmonia', { m: 9 }),
    candidat('5', '', { m: 11 }),
  ];

  it('regroupe par origine normalisée, sans le centre ni les candidats sans origine, par ordre alphabétique', () => {
    const groupes = regrouperParOrigine(candidats, centre);
    assert.deepEqual(groupes.map((g) => [g.etablissementOrigine, g.effectif, g.notesSaisies]), [
      ['Collège Y', 2, 3],
      ['Collège Z', 1, 2],
    ]);
    assert.deepEqual(groupes[0].candidats.map((c) => c.id), ['1', '2']);
  });

  it('ignore la casse et les accents du nom du centre', () => {
    assert.equal(regrouperParOrigine(candidats, 'cs harmonia').length, 2);
    assert.equal(regrouperParOrigine(candidats, '').length, 3);
  });
});

describe('recapitulatifEnvoi', () => {
  it('décrit la session, l’origine, l’effectif et le destinataire résolu', () => {
    const recap = recapitulatifEnvoi('BEPC Blanc 2026', { etablissementOrigine: 'Collège Y', effectif: 2, notesSaisies: 4 }, { nom: 'College Y', ville: 'Lome' });
    assert.equal(recap.destinataire, 'College Y (Lome)');
    assert.deepEqual(recap.lignes, [
      'Session : BEPC Blanc 2026',
      'Établissement d’origine : Collège Y',
      'Effectif : 2 élèves · 4 notes',
      'Destinataire : College Y (Lome)',
    ]);
    assert.equal(recapitulatifEnvoi('S', { etablissementOrigine: 'O', effectif: 1, notesSaisies: 1 }, { nom: 'D', ville: null }).lignes[3], 'Destinataire : D');
  });
});

const transfert = (id: number, statut: TransfertVue['statut'], extra: Partial<TransfertVue> = {}): TransfertVue => ({
  id,
  statut,
  envoyeLe: '2026-03-02T10:00:00Z',
  traiteLe: null,
  motifRefus: null,
  etablissementOrigine: 'Collège Y',
  effectif: 2,
  typeExamen: 'BEPC',
  sessionNom: 'BEPC Blanc 2026',
  anneeLibelle: '2025-2026',
  sessionSourceId: 7,
  sessionCreeeId: null,
  sourceNom: 'CS Harmonia',
  sourceVille: 'Lomé',
  destinationNom: 'College Y',
  destinationVille: 'Lome',
  envoyeParNom: 'Chef Test',
  traiteParNom: null,
  ...extra,
});

describe('csvHistorique / compterParStatut', () => {
  it('produit un CSV « ; » avec BOM, en-tête et champs échappés', () => {
    const csv = csvHistorique([
      transfert(1, 'REFUSE', { motifRefus: 'Mauvais destinataire ; "doublon"', traiteLe: '2026-03-03T08:00:00Z', traiteParNom: 'Dir Y' }),
    ]);
    assert.ok(csv.startsWith('\uFEFFDestinataire;Ville;'));
    const lignes = csv.split('\r\n');
    assert.equal(lignes.length, 2);
    assert.ok(lignes[1].startsWith('College Y;Lome;Collège Y;2;BEPC Blanc 2026;2025-2026;'));
    assert.ok(lignes[1].includes(';Refusé;'));
    assert.ok(lignes[1].endsWith(';Dir Y;"Mauvais destinataire ; ""doublon"""'));
  });

  it('compte les transferts par statut', () => {
    assert.deepEqual(compterParStatut([transfert(1, 'EN_ATTENTE'), transfert(2, 'EN_ATTENTE'), transfert(3, 'ACCEPTE')]), {
      EN_ATTENTE: 2, ACCEPTE: 1, REFUSE: 0, ANNULE: 0,
    });
  });
});

describe('sessions issues d’un transfert dans l’espace de travail', () => {
  const sessions = [
    { id: 10, anneeScolaireId: 1, typeExamenId: 2, typeExamen: 'BEPC', transfertSourceId: null },
    { id: 11, anneeScolaireId: 1, typeExamenId: 2, typeExamen: 'BEPC', transfertSourceId: 5 },
  ];

  it('une session transférée n’a pas de sœur et n’en est pour personne', () => {
    assert.equal(estSessionTransferee(sessions[1]), true);
    assert.deepEqual(sessionsSoeurs(sessions[1], sessions), [11]);
    assert.deepEqual(sessionsSoeurs(sessions[0], sessions), [10]);
  });

  it('le roster strict ne garde que les élèves de la session, pas ceux sans session', () => {
    const eleves = [{ id: 1, sessionId: 11 }, { id: 2, sessionId: null }, { id: 3, sessionId: 10 }];
    assert.deepEqual(filtrerRoster(eleves, 11, {}, [11], true).map((e) => e.id), [1]);
    assert.deepEqual(filtrerRoster(eleves, 11, {}, [11]).map((e) => e.id), [1, 2]);
  });

  it('convertit la vue « examen commun » de l’API en statistiques par élève', () => {
    const stats = statsExamenCommunParEleve({
      sessionId: 11, transfertId: 5, centre: 'CS Harmonia', centreVille: 'Lomé', sessionSource: 'BEPC Blanc 2026', anneeSource: '2025-2026',
      eleves: [{
        eleveId: 42, moyenne: 11.14, rang: 2, effectifGroupe: 3, moyenneGroupe: 11.71, moyenneMaxGroupe: 15.57, moyenneMinGroupe: 8.43,
        mention: 'PASSABLE', decision: 'ADMIS', matieres: [{ matiereId: 7, rang: 2, noteMax: 16, noteMin: 8 }],
      }],
    });
    assert.deepEqual(stats['42'], {
      rang: 2, effectif: 3, moyenneGroupe: 11.71, moyenneMax: 15.57, moyenneMin: 8.43,
      matieres: { '7': { rang: 2, noteMax: 16, noteMin: 8 } },
    });
    assert.deepEqual(statsExamenCommunParEleve(null), {});
  });
});

describe('statistiques locales surchargées par l’examen commun', () => {
  const subjects: Subject[] = [
    { id: '7', name: 'Maths', teacher: '', coef: 4 },
    { id: '8', name: 'Français', teacher: '', coef: 3 },
  ];
  const commun = { rang: 2, effectif: 3, moyenneGroupe: 11.71, moyenneMax: 15.57, moyenneMin: 8.43, matieres: { '7': { rang: 2, noteMax: 16, noteMin: 8 } } };
  const ama = candidat('42', '', { 7: 12, 8: 10 }, { examenCommun: commun });
  const seule = [ama];

  it('rang, effectif et extrêmes sont ceux du groupe du centre ; la moyenne reste calculée sur les notes', () => {
    const stats = computeCandidateStats(ama, subjects, seule);
    assert.equal(stats.average, 11.14);
    assert.equal(stats.rank, 2);
    assert.equal(stats.totalCandidates, 3);
    assert.equal(stats.classAverage, 11.71);
    assert.equal(stats.classHighestAverage, 15.57);
    assert.equal(stats.classLowestAverage, 8.43);
    assert.equal(stats.mention, 'PASSABLE');
    assert.equal(stats.decision, 'ADMIS');
    assert.equal(stats.differenceToPromo, -0.57);
  });

  it('sans statistiques communes, rien ne change', () => {
    const sans = candidat('1', '', { 7: 12 });
    const stats = computeCandidateStats(sans, subjects, [sans]);
    assert.equal(appliquerExamenCommun(stats, sans), stats);
    assert.equal(stats.rank, 1);
    assert.equal(stats.totalCandidates, 1);
  });

  it('rang et extrêmes par matière : ceux de l’examen commun s’ils existent, sinon la cohorte locale', () => {
    assert.equal(rangMatiereAffiche(ama, '7', seule), 2);
    assert.deepEqual(extremesMatiereAffiches(ama, '7', seule), { highest: 16, lowest: 8, count: 3 });
    // Français : aucune statistique commune → calcul local (Ama seule : 1re, 10 / 10).
    assert.equal(rangMatiereAffiche(ama, '8', seule), 1);
    assert.deepEqual(extremesMatiereAffiches(ama, '8', seule), { highest: 10, lowest: 10, count: 1 });
  });
});

describe('appels API des transferts', () => {
  interface Appel { url: string; method: string; body: unknown }
  const appels: Appel[] = [];
  const fetchInitial = globalThis.fetch;

  beforeEach(() => {
    appels.length = 0;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      appels.push({ url: String(input), method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined });
      return new Response('{"id":1}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = fetchInitial;
  });

  it('envoyer, accepter, refuser et résoudre passent par /api/transferts avec les bons corps', async () => {
    await envoyerTransfert(7, 'Collège Y', ' K7F3-9QZT ');
    await accepterTransfert(3);
    await refuserTransfert(3, '  ');
    await refuserTransfert(4, ' Mauvais destinataire ');
    await resoudreDestinataire('K7F3-9QZT');
    assert.deepEqual(appels.map((a) => [a.method, a.url.replace(/^https?:\/\/[^/]+/, ''), a.body]), [
      ['POST', '/api/transferts/envoyer', { sessionId: 7, etablissementOrigine: 'Collège Y', code: 'K7F3-9QZT' }],
      ['POST', '/api/transferts/3/accepter', {}],
      ['POST', '/api/transferts/3/refuser', {}],
      ['POST', '/api/transferts/4/refuser', { motif: 'Mauvais destinataire' }],
      ['GET', '/api/transferts/destinataire?code=K7F3-9QZT', undefined],
    ]);
  });
});

describe('TransfertsView et profil : les écritures passent par src/api', () => {
  const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
  const lire = (chemin: string) => readFileSync(join(racine, chemin), 'utf8');

  it('aucun appel direct à apiSend / fetch dans les composants ; les fonctions du module sont utilisées', () => {
    const vue = lire('components/TransfertsView.tsx');
    const profil = lire('components/EtablissementProfilView.tsx');
    for (const source of [vue, profil]) {
      assert.equal(/\bapiSend\(/.test(source), false, 'apiSend( appelé directement dans un composant');
      assert.equal(/\bfetch\(/.test(source), false, 'fetch( appelé directement dans un composant');
    }
    for (const fn of ['envoyerTransfert(', 'annulerTransfert(', 'accepterTransfert(', 'refuserTransfert(', 'resoudreDestinataire(', 'confirmAvecMotCle(', 'demanderTexte(']) {
      assert.ok(vue.includes(fn), `${fn} absente de TransfertsView`);
    }
    assert.ok(profil.includes('regenererCodeTransfert('), 'régénération du code absente du profil');
    assert.ok(profil.includes('confirmAction('), 'la régénération doit être confirmée');
  });

  it('App.tsx verrouille la saisie des notes d’une session issue d’un transfert', () => {
    const app = lire('App.tsx');
    assert.ok(app.includes("peutAnnoter={!sessionTransferee &&"), 'peutAnnoter ne tient pas compte de la session transférée');
    assert.ok(app.includes('juryLocked={juryLocked || sessionTransferee}'), 'juryLocked ne tient pas compte de la session transférée');
  });
});
