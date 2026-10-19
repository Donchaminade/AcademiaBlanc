import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { loadSchoolWorkspace, titulaireDeClasse } from './workspace';
import { PARAMETRES_PERSISTES, applyCharte, versCharte } from './charte';
import { DEFAULT_SETTINGS } from '../data/mockData';
import { TITULAIRE_A_COMPLETER, aUnTitulaire, nomTitulaireAffiche } from '../utils/titulaire';

/**
 * Le titulaire qui vise le bulletin est l'enseignant affecté à la classe de l'élève (« 3e → M. X »),
 * jamais un réglage global de l'établissement ni une valeur de démonstration.
 */

const profs = [
  { id: 7, nom: 'M. KONAN Germain' },
  { id: 8, nom: '  Mme LAWSON Ayélé  ' },
];

describe('titulaire issu de la classe', () => {
  it('résout le nom du titulaire désigné sur la classe, vide sinon', () => {
    assert.equal(titulaireDeClasse({ titulaireId: 7 }, profs), 'M. KONAN Germain');
    assert.equal(titulaireDeClasse({ titulaireId: 8 }, profs), 'Mme LAWSON Ayélé');
    assert.equal(titulaireDeClasse({ titulaireId: null }, profs), '');
    assert.equal(titulaireDeClasse({}, profs), '');
    assert.equal(titulaireDeClasse(undefined, profs), '', 'élève sans classe connue');
    assert.equal(titulaireDeClasse({ titulaireId: 99 }, profs), '', 'enseignant non lisible : pas de nom inventé');
  });

  it('imprime le nom du titulaire, sinon une ligne à compléter (pas de valeur de démonstration)', () => {
    assert.equal(nomTitulaireAffiche({ titulaire: 'M. KONAN Germain' }), 'M. KONAN Germain');
    assert.equal(nomTitulaireAffiche({ titulaire: '' }), TITULAIRE_A_COMPLETER);
    assert.equal(nomTitulaireAffiche({}), TITULAIRE_A_COMPLETER);
    assert.equal(nomTitulaireAffiche(null), TITULAIRE_A_COMPLETER);
    assert.equal(aUnTitulaire({ titulaire: '   ' }), false);
    assert.equal(aUnTitulaire({ titulaire: 'Mme LAWSON' }), true);
    assert.doesNotMatch(TITULAIRE_A_COMPLETER, /Konan|Germain/i);
  });

  it("n'a plus de nom de titulaire ni de signataire dans les paramètres ni dans la charte", () => {
    const champs = PARAMETRES_PERSISTES as readonly string[];
    for (const retire of ['principalTeacherName', 'principalTeacherTitle', 'jurySignerName', 'homeroomTeacher']) {
      assert.equal(champs.includes(retire), false, `${retire} ne doit plus être un paramètre persisté`);
    }
    assert.equal('principalTeacherName' in DEFAULT_SETTINGS, false);
    assert.equal('principalTeacherTitle' in DEFAULT_SETTINGS, false);
    const corps = versCharte(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
    for (const retire of ['nomTitulaire', 'titreTitulaire', 'nomSignataireJury']) {
      assert.equal(retire in corps, false, `${retire} ne doit plus partir dans la charte`);
    }
    // Une ancienne charte qui porterait encore ces champs ne réécrit pas le signataire officiel.
    const charte = { sceauUrl: null, signatureProviseurUrl: null, signatureTitulaireUrl: null, nomSignataireJury: 'Ancien' } as Parameters<typeof applyCharte>[1];
    assert.equal(applyCharte({ ...DEFAULT_SETTINGS, jurySignerName: 'Mme le Proviseur' }, charte).jurySignerName, 'Mme le Proviseur');
  });

  it("l'écran Paramètres n'a plus de champ titulaire et annonce l'enregistrement sur le serveur", () => {
    const racine = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(racine, '..', 'components', 'SettingsView.tsx'), 'utf8');
    assert.doesNotMatch(source, /principalTeacherName/);
    assert.doesNotMatch(source, /IndexedDB/);
    assert.match(source, /Enregistré sur le serveur de l’établissement/);
    assert.match(source, /Données de démonstration \(stockage local\)/);
    for (const vue of ['BulletinView.tsx', 'AllBulletinsPrintModal.tsx']) {
      const bulletin = readFileSync(join(racine, '..', 'components', vue), 'utf8');
      assert.doesNotMatch(bulletin, /principalTeacher/, `${vue} ne doit plus lire le titulaire dans les paramètres`);
      assert.match(bulletin, /nomTitulaireAffiche\(/, `${vue} imprime le titulaire de la classe de l'élève`);
    }
  });
});

describe('espace de travail : titulaire par élève', () => {
  const fetchInitial = globalThis.fetch;

  beforeEach(() => {
    const reponses: Record<string, unknown> = {
      '/api/annees-scolaires': [{ id: 1, libelle: '2025-2026', courante: true }],
      '/api/centres': [{ id: 1, nom: 'Centre', code: 'C1' }],
      '/api/sessions': [{ id: 3, nom: 'BEPC BLANC', anneeScolaireId: 1, centreId: 1 }],
      '/api/matieres': [{ id: 10, nom: 'Mathématiques', code: 'MATH' }],
      '/api/professeurs': profs,
      '/api/classes': [
        { id: 20, nom: '3e', niveau: '3e', titulaireId: 7 },
        { id: 21, nom: '4e', niveau: '4e', titulaireId: null },
      ],
      '/api/affectations': [],
      '/api/coefficients': [],
      '/api/eleves': [
        { id: 100, nomComplet: 'AKAKPO Ama', matricule: 'A1', genre: 'F', classeId: 20, sessionId: 3 },
        { id: 101, nomComplet: 'MENSAH Kossi', matricule: 'A2', genre: 'M', classeId: 21, sessionId: 3 },
      ],
      '/api/notes?sessionId=3': [],
      '/api/deliberations?sessionId=3': [],
    };
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const chemin = url.replace(/^https?:\/\/[^/]+/, '');
      const cle = Object.keys(reponses).find((path) => chemin.endsWith(path));
      if (!cle) return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify(reponses[cle]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = fetchInitial;
  });

  it("mappe le titulaire de la classe de chaque élève, vide pour une classe sans titulaire", async () => {
    const workspace = await loadSchoolWorkspace(3);
    const ama = workspace.candidates.find((c) => c.id === '100');
    const kossi = workspace.candidates.find((c) => c.id === '101');
    assert.equal(ama?.titulaire, 'M. KONAN Germain', 'élève de 3e → titulaire affecté à la 3e');
    assert.equal(kossi?.titulaire, '', 'classe sans titulaire → aucun nom');
    assert.equal(nomTitulaireAffiche(kossi), TITULAIRE_A_COMPLETER);
  });
});
