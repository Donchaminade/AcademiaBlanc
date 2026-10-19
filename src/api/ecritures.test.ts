import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { ApiError } from './client';
import {
  appliquerDeliberation,
  creerEleve,
  renumeroterEleves,
  sauvegarderDeliberation,
  sauvegarderEleve,
  sauvegarderNote,
  sauvegarderParametres,
  supprimerEleve,
} from './ecritures';
import { versCharte } from './charte';
import type { Candidate } from '../types';
import { DEFAULT_SETTINGS } from '../data/mockData';

/**
 * Garde-fou « tout est enregistré sur le serveur en session connectée » :
 * 1. chaque fonction d'écriture de `src/api/ecritures.ts` appelle bien l'API attendue et laisse remonter
 *    les refus du serveur (aucun repli local silencieux) ;
 * 2. dans `App.tsx`, chaque gestionnaire marqué « Écriture » possède une branche `if (usingApi)` qui
 *    passe par ces fonctions et se termine par `return`, sans jamais écrire l'état local « à la main ».
 */

interface Appel { url: string; method: string; body: unknown }
const appels: Appel[] = [];
let reponse: () => Response = () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
const fetchInitial = globalThis.fetch;

beforeEach(() => {
  appels.length = 0;
  reponse = () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    appels.push({
      url: String(input),
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    return reponse();
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = fetchInitial;
});

const json = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } });

const candidat: Candidate = {
  id: '42',
  tableNumber: 7,
  matricule: 'LYC-2026-0042',
  fullName: ' AKAKPO Ama ',
  dob: '12/04/2010',
  birthPlace: 'Lomé',
  originSchool: '',
  gender: 'F',
  serie: '',
  classeId: '3',
  sessionId: 5,
  examCenter: '',
  examCenterName: '',
  parentPhone: '',
  parentEmail: '',
  grades: {},
  generalObservation: '',
};

describe('ecritures : écritures de l’espace de travail', () => {
  it('sauvegarderEleve envoie PUT /api/eleves/{id} sans matricule et avec la session de l’élève', async () => {
    reponse = () => json({ id: 42, nomComplet: 'AKAKPO Ama' });
    const resultat = await sauvegarderEleve(candidat);
    assert.equal(resultat.nomComplet, 'AKAKPO Ama');
    assert.equal(appels.length, 1);
    assert.equal(appels[0].method, 'PUT');
    assert.ok(appels[0].url.endsWith('/api/eleves/42'));
    assert.deepEqual(appels[0].body, {
      classeId: 3, sessionId: 5, nomComplet: 'AKAKPO Ama', genre: 'F', numeroTable: 7,
      dateNaissance: '12/04/2010', lieuNaissance: 'Lomé', etablissementOrigine: null,
    });
    assert.equal('matricule' in (appels[0].body as object), false);
  });

  it('sauvegarderEleve refuse une fiche de démonstration ou sans classe avant tout appel réseau', async () => {
    await assert.rejects(() => sauvegarderEleve({ ...candidat, id: 'cand-1700000000' }), /absente de la base/);
    await assert.rejects(() => sauvegarderEleve({ ...candidat, classeId: undefined }), /Classe inconnue/);
    assert.equal(appels.length, 0);
  });

  it('le message du serveur remonte tel quel en cas de refus (403, 400)', async () => {
    reponse = () => json({ message: 'Action non autorisée : MODIFIER sur ELEVES' }, 403);
    await assert.rejects(() => sauvegarderEleve(candidat), (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 403);
      assert.equal(err.message, 'Action non autorisée : MODIFIER sur ELEVES');
      return true;
    });
    reponse = () => json({ message: 'Le genre doit être M ou F.' }, 400);
    await assert.rejects(() => sauvegarderEleve(candidat), /Le genre doit être M ou F\./);
  });

  it('creerEleve et supprimerEleve ciblent POST /api/eleves et DELETE /api/eleves/{id}', async () => {
    reponse = () => json({ id: 43, matricule: 'LYC-2026-0043' });
    await creerEleve({ ...candidat, id: 'cand-x', tableNumber: 0 }, 3, 5);
    assert.equal(appels[0].method, 'POST');
    assert.ok(appels[0].url.endsWith('/api/eleves'));
    assert.deepEqual(appels[0].body, {
      classeId: 3, sessionId: 5, nomComplet: 'AKAKPO Ama', genre: 'F', numeroTable: null,
      dateNaissance: '12/04/2010', lieuNaissance: 'Lomé', etablissementOrigine: null,
    });
    reponse = () => new Response(null, { status: 204 });
    await supprimerEleve('42');
    assert.equal(appels[1].method, 'DELETE');
    assert.ok(appels[1].url.endsWith('/api/eleves/42'));
    await assert.rejects(() => supprimerEleve('cand-demo'), /absente de la base/);
    assert.equal(appels.length, 2);
  });

  it('renumeroterEleves n’envoie que les élèves dont le numéro change et rejette à la première erreur', async () => {
    const avant = [candidat, { ...candidat, id: '43', fullName: 'MENSAH Kossi', tableNumber: 8 }];
    const apres = [{ ...avant[0], tableNumber: 101 }, { ...avant[1], tableNumber: 8 }];
    reponse = () => json({ id: 42 });
    assert.equal(await renumeroterEleves(avant, apres), 1);
    assert.equal(appels.length, 1);
    assert.equal((appels[0].body as { numeroTable: number }).numeroTable, 101);

    appels.length = 0;
    reponse = () => json({ message: 'Session expirée. Reconnectez-vous.' }, 401);
    await assert.rejects(() => renumeroterEleves(avant, [{ ...avant[0], tableNumber: 1 }, { ...avant[1], tableNumber: 2 }]), /Session expirée/);
    assert.equal(appels.length, 2);
  });

  it('sauvegarderNote envoie POST /api/notes avec élève, matière, session et valeur', async () => {
    reponse = () => json({ id: 9, eleveId: 42, matiereId: 12, sessionId: 5, valeur: 13.5, absent: false });
    const note = await sauvegarderNote({ candidateId: '42', subjectId: '12', sessionId: 5, score: 13.5 });
    assert.equal(note.valeur, 13.5);
    assert.equal(appels[0].method, 'POST');
    assert.ok(appels[0].url.endsWith('/api/notes'));
    assert.deepEqual(appels[0].body, { eleveId: 42, matiereId: 12, sessionId: 5, valeur: 13.5, absent: false });
  });

  it('sauvegarderNote refuse sans session, hors barème ou pour une fiche de démonstration, sans appel réseau', async () => {
    await assert.rejects(() => sauvegarderNote({ candidateId: '42', subjectId: '12', sessionId: null, score: 10 }), /Aucune session/);
    await assert.rejects(() => sauvegarderNote({ candidateId: '42', subjectId: '12', sessionId: 5, score: 21 }), /entre 0 et 20/);
    await assert.rejects(() => sauvegarderNote({ candidateId: 'cand-1', subjectId: 'math', sessionId: 5, score: 10 }), /absent de la base/);
    assert.equal(appels.length, 0);
    reponse = () => json({ message: 'La matière « EPS » n\'est pas au programme de la classe de cet élève.' }, 400);
    await assert.rejects(() => sauvegarderNote({ candidateId: '42', subjectId: '12', sessionId: 5, score: 10 }), /pas au programme/);
  });

  it('sauvegarderDeliberation envoie PUT /api/deliberations avec bonus, observation et signature', async () => {
    const delibere: Candidate = {
      ...candidat,
      juryBonus: 0.25,
      generalObservation: ' « Repêchage accordé. » ',
      digitalSignature: { signedAt: '2026-06-01T10:00:00.000Z', signer: 'Dr. Traoré (Le Proviseur)', shaHash: 'ABC123' },
    };
    reponse = () => json({ eleveId: 42, sessionId: 5, bonusJury: 0.25, observation: '« Repêchage accordé. »',
      signature: { signeLe: '2026-06-01T10:00:00Z', signataire: 'Dr. Traoré (Le Proviseur)', empreinte: 'ABC123' } });
    const vue = await sauvegarderDeliberation(delibere, 5);
    assert.equal(appels[0].method, 'PUT');
    assert.ok(appels[0].url.endsWith('/api/deliberations'));
    assert.deepEqual(appels[0].body, {
      eleveId: 42, sessionId: 5, bonusJury: 0.25, observation: '« Repêchage accordé. »',
      signature: { signeLe: '2026-06-01T10:00:00.000Z', signataire: 'Dr. Traoré (Le Proviseur)', empreinte: 'ABC123' },
    });
    // La réponse du serveur fait foi dans la fiche du candidat.
    const relu = appliquerDeliberation(candidat, vue);
    assert.equal(relu.juryBonus, 0.25);
    assert.equal(relu.generalObservation, '« Repêchage accordé. »');
    assert.deepEqual(relu.digitalSignature, { signedAt: '2026-06-01T10:00:00Z', signer: 'Dr. Traoré (Le Proviseur)', shaHash: 'ABC123' });
    assert.equal(appliquerDeliberation(candidat, { eleveId: 42, sessionId: 5, bonusJury: 0, observation: null, signature: null }).juryBonus, undefined);

    await assert.rejects(() => sauvegarderDeliberation(delibere, null), /Aucune session/);
    await assert.rejects(() => sauvegarderDeliberation({ ...delibere, id: 'cand-7' }, 5), /absente de la base/);
  });

  it('sauvegarderParametres envoie tous les paramètres persistés à PUT /api/etablissement/charte', async () => {
    const corps = versCharte({ ...DEFAULT_SETTINGS, sealUrl: '', motto: '', startTableNumber: 201, autoAssignTables: false, sceauUrl: 'data:image/png;base64,AAAA' });
    reponse = () => json(corps);
    await sauvegarderParametres({ ...DEFAULT_SETTINGS, sealUrl: '', motto: '', startTableNumber: 201, autoAssignTables: false, sceauUrl: 'data:image/png;base64,AAAA' });
    assert.equal(appels[0].method, 'PUT');
    assert.ok(appels[0].url.endsWith('/api/etablissement/charte'));
    const envoye = appels[0].body as Record<string, unknown>;
    assert.equal(envoye.sceauUrl, 'data:image/png;base64,AAAA');
    assert.equal(envoye.signatureProviseurUrl, null);
    assert.equal(envoye.logoUrl, DEFAULT_SETTINGS.logoUrl);
    // Sceau officiel volontairement vide : chaîne vide (zone vierge), pas null (valeur par défaut).
    assert.equal(envoye.sceauOfficielUrl, '');
    assert.equal(envoye.deviseNationale, null);
    assert.equal(envoye.pays, DEFAULT_SETTINGS.countryName);
    assert.equal(envoye.ministere, DEFAULT_SETTINGS.ministryName);
    assert.equal(envoye.nomSignataireJury, DEFAULT_SETTINGS.jurySignerName);
    assert.equal(envoye.nomTitulaire, DEFAULT_SETTINGS.principalTeacherName);
    assert.equal(envoye.premierNumeroTable, 201);
    assert.equal(envoye.numerotationAutomatique, false);
    // Aucun libellé issu de la session ou du profil n'est envoyé.
    for (const interdit of ['institutionName', 'academicYear', 'sessionName', 'examType']) {
      assert.equal(interdit in envoye, false, `${interdit} ne doit pas partir au serveur`);
    }
  });
});

/* ------------------------------------------------------------------------------------------ */
/* Analyse statique d'App.tsx : chaque gestionnaire « Écriture » passe par src/api en session API */
/* ------------------------------------------------------------------------------------------ */

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceApp = readFileSync(join(racine, 'App.tsx'), 'utf8');
const sourceEcritures = readFileSync(join(racine, 'api', 'ecritures.ts'), 'utf8');

/** Fonctions d'écriture exportées par src/api/ecritures.ts (hors utilitaires purs). */
const fonctionsEcriture = [...sourceEcritures.matchAll(/^export (?:async )?function (\w+)\(/gm)]
  .map((m) => m[1])
  .filter((nom) => /^(sauvegarder|creer|supprimer|renumeroter)/.test(nom));

/** Gestionnaires d'App.tsx qui modifient des données (état candidats, notes, délibérations, paramètres). */
const GESTIONNAIRES_ECRITURE = [
  'handleUpdateSettings',
  'handleUpdateGrade',
  'handleApplyJuryBonus',
  'handleSign',
  'handleAddNewCandidate',
  'handleBatchAddCandidates',
  'handleUpdateCandidate',
  'handleDeleteCandidate',
  'handleRenumberAlphabetically',
];

/** Écritures locales interdites dans une branche API : elles ne passent pas par le serveur. */
const ECRITURES_LOCALES = ['handleUpdateCandidates(', 'saveSchoolData(', 'autoAssignTableNumbers(', 'setCandidates(', 'setSettings(newSettings'];

/** Renvoie le texte entre l'accolade ouvrante située à `debut` et son accolade fermante. */
function bloc(source: string, debut: number): string {
  let profondeur = 0;
  for (let i = debut; i < source.length; i++) {
    if (source[i] === '{') profondeur++;
    else if (source[i] === '}') {
      profondeur--;
      if (profondeur === 0) return source.slice(debut, i + 1);
    }
  }
  throw new Error('accolade fermante introuvable');
}

/** Position de l'accolade ouvrante correspondant à l'accolade fermante située à `fin`. */
function ouvertureDe(source: string, fin: number): number {
  let profondeur = 0;
  for (let i = fin; i >= 0; i--) {
    if (source[i] === '}') profondeur++;
    else if (source[i] === '{') {
      profondeur--;
      if (profondeur === 0) return i;
    }
  }
  throw new Error('accolade ouvrante introuvable');
}

/** Vrai si la dernière instruction est `return …;`, ou un `try { … } catch { … }` dont les deux blocs se terminent ainsi. */
function seTermineParReturn(texte: string): boolean {
  const corps = texte.trim();
  if (/return[^;{}]*;$/.test(corps)) return true;
  if (!corps.endsWith('}')) return false;
  const ouverture = ouvertureDe(corps, corps.length - 1);
  const dernierBloc = corps.slice(ouverture + 1, -1);
  const entete = corps.slice(0, ouverture).trimEnd();
  if (/catch(?: \([^)]*\))?$/.test(entete)) {
    // Bloc catch : le bloc try qui le précède doit lui aussi se terminer par return.
    const finTry = entete.replace(/catch(?: \([^)]*\))?$/, '').trimEnd();
    if (!finTry.endsWith('}')) return false;
    const ouvertureTry = ouvertureDe(finTry, finTry.length - 1);
    if (!/try$/.test(finTry.slice(0, ouvertureTry).trimEnd())) return false;
    return seTermineParReturn(finTry.slice(ouvertureTry + 1, -1)) && seTermineParReturn(dernierBloc);
  }
  return false;
}

function corpsGestionnaire(nom: string): string {
  const declaration = sourceApp.indexOf(`const ${nom} = `);
  assert.notEqual(declaration, -1, `${nom} introuvable dans App.tsx`);
  const ouverture = sourceApp.indexOf('{', sourceApp.indexOf('=>', declaration));
  return bloc(sourceApp, ouverture);
}

function brancheApi(corps: string, nom: string): string {
  const garde = corps.search(/if \((usingApi|getToken\(\))\) \{/);
  assert.notEqual(garde, -1, `${nom} : aucune branche « if (usingApi) »`);
  return bloc(corps, corps.indexOf('{', garde));
}

describe('App.tsx : les gestionnaires d’écriture passent par src/api en session connectée', () => {
  it('src/api/ecritures.ts expose les fonctions d’écriture attendues', () => {
    for (const attendu of ['sauvegarderEleve', 'creerEleve', 'supprimerEleve', 'renumeroterEleves', 'sauvegarderNote', 'sauvegarderDeliberation', 'sauvegarderParametres']) {
      assert.ok(fonctionsEcriture.includes(attendu), `${attendu} manquante`);
    }
  });

  for (const nom of GESTIONNAIRES_ECRITURE) {
    it(`${nom} : branche API sans écriture locale, terminée par return`, () => {
      const corps = corpsGestionnaire(nom);
      const branche = brancheApi(corps, nom);
      const appelleApi = fonctionsEcriture.some((fn) => branche.includes(`${fn}(`));
      const refuse = branche.includes('showError(');
      assert.ok(appelleApi || refuse, `${nom} : la branche API n'appelle ni src/api/ecritures ni showError`);
      for (const interdit of ECRITURES_LOCALES) {
        assert.equal(branche.includes(interdit), false, `${nom} : « ${interdit} » dans la branche API`);
      }
      // Dernière instruction de la branche : un return (ou un try/catch dont chaque bloc se termine par return),
      // pour qu'aucun code local ne s'exécute ensuite.
      assert.ok(seTermineParReturn(branche.slice(1, -1)), `${nom} : la branche API ne se termine pas par return`);
    });
  }

  it('saveSchoolData n’est appelé que dans un gestionnaire d’écriture (après sa branche API) ou sous « !usingApi »', () => {
    const lignes = sourceApp.split('\n');
    lignes.forEach((ligne, index) => {
      if (!ligne.includes('saveSchoolData(')) return;
      if (ligne.includes('if (!usingApi)')) return;
      const avant = lignes.slice(0, index).join('\n');
      const declarations = [...avant.matchAll(/const (handle\w+) = /g)].map((m) => m[1]);
      const gestionnaire = declarations[declarations.length - 1];
      assert.ok(GESTIONNAIRES_ECRITURE.includes(gestionnaire),
        `App.tsx:${index + 1} : saveSchoolData hors d'un gestionnaire d'écriture contrôlé (${gestionnaire ?? 'aucun'})`);
    });
  });

  it('aucun appel direct à apiSend / apiDelete dans App.tsx : les écritures passent par src/api/ecritures', () => {
    assert.equal(/\bapiSend\(/.test(sourceApp), false, 'apiSend( appelé directement dans App.tsx');
    assert.equal(/\bapiDelete\(/.test(sourceApp), false, 'apiDelete( appelé directement dans App.tsx');
  });
});
