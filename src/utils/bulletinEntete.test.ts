import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { codeSerie, composerEnteteBulletin, ligneSousTitreBulletin, ligneTitreBulletin } from './bulletinEntete';
import { libelleSerie, loadSchoolWorkspace } from '../api/workspace';
import { DEFAULT_SETTINGS, DEMO_TYPE_EXAMEN_LIBELLE } from '../data/mockData';

/**
 * Le bandeau bleu du bulletin n'est plus un texte figé (« BACCALAURÉAT DEUXIÈME PARTIE — EXAMEN BLANC »,
 * « SÉRIE D (SCIENTIFIQUE) • DÉLIBÉRATION OFFICIELLE DU JURY N° 01 ») : chaque segment vient de la base
 * (type d'examen et intitulé de la session, série ou niveau de la classe, année scolaire).
 */
describe('bandeau du bulletin : ligne 1 (type d’examen — intitulé de la session)', () => {
  it('compose le libellé long du type et l’intitulé de la session, en majuscules', () => {
    assert.equal(
      ligneTitreBulletin({ typeExamenLibelle: "Brevet d'Études du Premier Cycle", sessionNom: 'BEPC Blanc 2026' }),
      "BREVET D'ÉTUDES DU PREMIER CYCLE — BEPC BLANC 2026",
    );
    assert.equal(
      ligneTitreBulletin({ typeExamenLibelle: 'Baccalauréat Deuxième Partie', sessionNom: 'Examen blanc 2e trimestre' }),
      'BACCALAURÉAT DEUXIÈME PARTIE — EXAMEN BLANC 2E TRIMESTRE',
    );
  });

  it('affiche seulement l’intitulé de la session quand elle n’a pas de type d’examen', () => {
    assert.equal(ligneTitreBulletin({ typeExamenLibelle: null, sessionNom: 'Composition du 1er trimestre' }), 'COMPOSITION DU 1ER TRIMESTRE');
    assert.equal(ligneTitreBulletin({ typeExamenLibelle: '   ', sessionNom: 'Session 1' }), 'SESSION 1');
    assert.equal(ligneTitreBulletin({ typeExamenLibelle: 'BEPC', sessionNom: '' }), 'BEPC', 'type seul si l’intitulé manque');
    assert.equal(ligneTitreBulletin({}), '', 'rien à afficher : aucun texte fictif');
  });

  it('ne contient jamais de texte codé en dur (« Baccalauréat », « examen blanc »)', () => {
    const ligne = ligneTitreBulletin({ typeExamenLibelle: "Brevet d'Études du Premier Cycle", sessionNom: 'Session 2' });
    assert.doesNotMatch(ligne, /BACCALAUR|EXAMEN BLANC|JURY/);
  });
});

describe('bandeau du bulletin : ligne 2 (série ou niveau • année)', () => {
  it('lycée : série de la classe avec son libellé, puis l’année scolaire de la session', () => {
    assert.equal(
      ligneSousTitreBulletin({ niveau: 'Tle', serieCode: 'D', serieLibelle: 'Sciences expérimentales', anneeScolaire: '2025-2026' }),
      'SÉRIE D (SCIENCES EXPÉRIMENTALES) • 2025-2026',
    );
    assert.equal(
      ligneSousTitreBulletin({ niveau: '1ère', serieCode: 'Série A4', anneeScolaire: '2025-2026' }),
      'SÉRIE A4 • 2025-2026',
      'sans libellé de série, le code seul (pas de libellé inventé)',
    );
  });

  it('collège (3e) : jamais de série, le niveau de la classe à la place', () => {
    assert.equal(
      ligneSousTitreBulletin({ niveau: '3e', serieCode: 'D', serieLibelle: 'Sciences expérimentales', anneeScolaire: '2025-2026' }),
      'CLASSE DE 3e • 2025-2026',
    );
    assert.equal(ligneSousTitreBulletin({ niveau: 'Troisième', anneeScolaire: '2025-2026' }), 'CLASSE DE 3e • 2025-2026');
    assert.equal(ligneSousTitreBulletin({ niveau: '6e' }), 'CLASSE DE 6e', 'sans année : segment omis');
  });

  it('sans année ni classe connue : les segments manquants sont omis, sans mention de jury', () => {
    assert.equal(ligneSousTitreBulletin({ serieCode: 'C', serieLibelle: 'Mathématiques et sciences physiques' }), 'SÉRIE C (MATHÉMATIQUES ET SCIENCES PHYSIQUES)');
    assert.equal(ligneSousTitreBulletin({ classeNom: '3e B', anneeScolaire: '2025-2026' }), 'CLASSE 3E B • 2025-2026');
    assert.equal(ligneSousTitreBulletin({ anneeScolaire: '2025-2026' }), '2025-2026');
    assert.equal(ligneSousTitreBulletin({}), '');
    assert.doesNotMatch(ligneSousTitreBulletin({ niveau: 'Tle', serieCode: 'D' }), /JURY|DÉLIBÉRATION|SCIENTIFIQUE/);
  });

  it('reconnaît le code de série sous ses deux formes', () => {
    assert.equal(codeSerie('Série D'), 'D');
    assert.equal(codeSerie('serie G2'), 'G2');
    assert.equal(codeSerie('A4'), 'A4');
    assert.equal(codeSerie(''), '');
    assert.equal(codeSerie(undefined), '');
  });
});

describe('bandeau du bulletin : exemples complets', () => {
  it('élève de 3e (collège, BEPC)', () => {
    assert.deepEqual(
      composerEnteteBulletin({
        typeExamenLibelle: "Brevet d'Études du Premier Cycle",
        sessionNom: 'BEPC Blanc 2026',
        anneeScolaire: '2025-2026',
        niveau: '3e',
        classeNom: '3e',
        serieCode: '',
        serieLibelle: '',
      }),
      { ligne1: "BREVET D'ÉTUDES DU PREMIER CYCLE — BEPC BLANC 2026", ligne2: 'CLASSE DE 3e • 2025-2026' },
    );
  });

  it('élève de Terminale D (lycée, BAC II)', () => {
    assert.deepEqual(
      composerEnteteBulletin({
        typeExamenLibelle: 'Baccalauréat Deuxième Partie',
        sessionNom: 'BAC II Blanc 2026',
        anneeScolaire: '2025-2026',
        niveau: 'Tle',
        classeNom: 'Tle D',
        serieCode: 'Série D',
        serieLibelle: 'Sciences expérimentales',
      }),
      { ligne1: 'BACCALAURÉAT DEUXIÈME PARTIE — BAC II BLANC 2026', ligne2: 'SÉRIE D (SCIENCES EXPÉRIMENTALES) • 2025-2026' },
    );
  });

  it('démonstration : le type vient du même modèle que le référentiel, plus de titre figé', () => {
    assert.equal(DEFAULT_SETTINGS.examType, DEMO_TYPE_EXAMEN_LIBELLE);
    assert.doesNotMatch(DEMO_TYPE_EXAMEN_LIBELLE, /BLANC|\(/);
    const racine = dirname(fileURLToPath(import.meta.url));
    for (const fichier of ['bulletinHeader.ts', 'bulletinEntete.ts', '../components/BulletinView.tsx', '../components/AllBulletinsPrintModal.tsx']) {
      const source = readFileSync(join(racine, fichier), 'utf8');
      assert.doesNotMatch(source, /DÉLIBÉRATION OFFICIELLE|JURY N°|SÉRIE D \(SCIENTIFIQUE\)|DEUXIÈME PARTIE — EXAMEN BLANC/, `${fichier} ne doit plus porter de bandeau figé`);
    }
    for (const vue of ['BulletinView.tsx', 'AllBulletinsPrintModal.tsx']) {
      const source = readFileSync(join(racine, '..', 'components', vue), 'utf8');
      assert.match(source, /composerEnteteBulletin\(/, `${vue} compose le bandeau depuis les données`);
    }
  });
});

describe('espace de travail : données du bandeau par élève', () => {
  const fetchInitial = globalThis.fetch;

  beforeEach(() => {
    const reponses: Record<string, unknown> = {
      '/api/annees-scolaires': [
        { id: 1, libelle: '2024-2025', courante: false },
        { id: 2, libelle: '2025-2026', courante: true },
      ],
      '/api/centres': [{ id: 1, nom: 'Centre', code: 'C1' }],
      '/api/sessions': [
        { id: 3, nom: 'BEPC Blanc 2025', typeExamen: 'BEPC', typeExamenLibelle: 'BEPC', typeExamenLibelleLong: "Brevet d'Études du Premier Cycle", anneeScolaireId: 1, centreId: 1, serie: 'D' },
      ],
      '/api/matieres': [],
      '/api/professeurs': [],
      '/api/classes': [
        { id: 20, nom: '3e', niveau: '3e', serie: null },
        { id: 21, nom: 'Tle D', niveau: 'Tle', serie: 'D' },
        { id: 22, nom: 'Tle F4', niveau: 'Tle', serie: 'F4' },
      ],
      '/api/series': [{ id: 1, code: 'D', libelle: 'Sciences expérimentales', famille: 'GENERALE', actif: true, ordre: 3 }],
      '/api/affectations': [],
      '/api/coefficients': [],
      '/api/eleves': [
        { id: 100, nomComplet: 'AKAKPO Ama', matricule: 'A1', genre: 'F', classeId: 20, sessionId: 3 },
        { id: 101, nomComplet: 'MENSAH Kossi', matricule: 'A2', genre: 'M', classeId: 21, sessionId: 3 },
        { id: 102, nomComplet: 'DOSSOU Afi', matricule: 'A3', genre: 'F', classeId: 22, sessionId: 3 },
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

  it('résout le libellé de série depuis le référentiel, jamais au collège', () => {
    const series = [{ code: 'D', libelle: 'Sciences expérimentales' }];
    assert.equal(libelleSerie({ niveau: 'Tle', serie: 'D' }, series), 'Sciences expérimentales');
    assert.equal(libelleSerie({ niveau: 'Tle', serie: 'd' }, series), 'Sciences expérimentales');
    assert.equal(libelleSerie({ niveau: '3e', serie: 'D' }, series), '', 'collège : pas de série');
    assert.equal(libelleSerie({ niveau: 'Tle', serie: 'F4' }, series), '', 'série hors référentiel : aucun libellé inventé');
    assert.equal(libelleSerie(undefined, series), '');
  });

  it('mappe niveau, série, libellé, type d’examen et année de la session', async () => {
    const workspace = await loadSchoolWorkspace(3);
    assert.equal(workspace.examTypeLong, "Brevet d'Études du Premier Cycle");
    assert.equal(workspace.sessionName, 'BEPC Blanc 2025');
    assert.equal(workspace.academicYear, '2024-2025', 'année de la session, pas l’année courante');

    const ama = workspace.candidates.find((c) => c.id === '100');
    assert.equal(ama?.niveau, '3e');
    assert.equal(ama?.serie, '', 'collège : la série de la session n’est pas reprise');
    assert.equal(ama?.serieLibelle, '');
    assert.deepEqual(
      composerEnteteBulletin({ typeExamenLibelle: workspace.examTypeLong, sessionNom: workspace.sessionName, anneeScolaire: workspace.academicYear, niveau: ama?.niveau, classeNom: ama?.classeNom, serieCode: ama?.serie, serieLibelle: ama?.serieLibelle }),
      { ligne1: "BREVET D'ÉTUDES DU PREMIER CYCLE — BEPC BLANC 2025", ligne2: 'CLASSE DE 3e • 2024-2025' },
    );

    const kossi = workspace.candidates.find((c) => c.id === '101');
    assert.equal(kossi?.serie, 'Série D');
    assert.equal(kossi?.serieLibelle, 'Sciences expérimentales');
    assert.equal(
      ligneSousTitreBulletin({ niveau: kossi?.niveau, serieCode: kossi?.serie, serieLibelle: kossi?.serieLibelle, anneeScolaire: workspace.academicYear }),
      'SÉRIE D (SCIENCES EXPÉRIMENTALES) • 2024-2025',
    );

    const afi = workspace.candidates.find((c) => c.id === '102');
    assert.equal(afi?.serieLibelle, '');
    assert.equal(ligneSousTitreBulletin({ niveau: afi?.niveau, serieCode: afi?.serie, serieLibelle: afi?.serieLibelle }), 'SÉRIE F4');
  });
});
