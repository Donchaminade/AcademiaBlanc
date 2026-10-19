import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ArchivedSession } from '../types';
import {
  archiveSansDonnees,
  barresBilan,
  formatEntier,
  formatNote,
  formatPourcent,
  ligneBilan,
  syntheseBilan,
  trierArchivesChronologique,
} from './bilanArchives';

const archive = (partiel: Partial<ArchivedSession> & Pick<ArchivedSession, 'id' | 'academicYear'>): ArchivedSession => ({
  schoolId: '1',
  sessionName: 'Examen blanc',
  examType: 'BEPC',
  archivedAt: '01/07/2026',
  candidatesCount: 0,
  admittedCount: 0,
  admittedRate: 0,
  failedCount: 0,
  failedRate: 0,
  promoAverage: 0,
  highestAverage: 0,
  lowestAverage: 0,
  mentionsBreakdown: { tresBien: 0, bien: 0, assezBien: 0, passable: 0 },
  ...partiel,
});

const s2025 = archive({
  id: 'a', academicYear: '2025-2026', sessionName: 'BEPC blanc n°1', candidatesCount: 40, classesCount: 38,
  admittedCount: 30, admittedRate: 78.95, failedCount: 8, failedRate: 21.05, promoAverage: 11.2, highestAverage: 16.5,
  mentionsBreakdown: { tresBien: 2, bien: 5, assezBien: 10, passable: 13 },
});
const s2026 = archive({
  id: 'b', academicYear: '2026-2027', sessionName: 'Examen blanc', candidatesCount: 11, classesCount: 11,
  admittedCount: 8, admittedRate: 72.73, failedCount: 3, failedRate: 27.27, promoAverage: 10.4, highestAverage: 14.25,
  mentionsBreakdown: { tresBien: 0, bien: 1, assezBien: 3, passable: 4 },
});
const vide = archive({ id: 'c', academicYear: '2024-2025', sessionName: 'Session sans notes' });

describe('formats du bilan', () => {
  it('écrit les valeurs à la française et « — » sans valeur', () => {
    assert.equal(formatPourcent(72.73), '72,73 %');
    assert.equal(formatNote(11.2), '11,20 / 20');
    assert.equal(formatEntier(40), '40');
    assert.equal(formatPourcent(null), '—');
    assert.equal(formatNote(undefined), '—');
    assert.equal(formatEntier(null), '—');
  });
});

describe('ligneBilan', () => {
  it('reprend les statistiques de l’archive telles quelles', () => {
    const ligne = ligneBilan(s2025);
    assert.equal(ligne.effectif, 40);
    assert.equal(ligne.classes, 38);
    assert.equal(ligne.admis, 30);
    assert.equal(ligne.ajournes, 8);
    assert.equal(ligne.tauxReussite, 78.95);
    assert.equal(ligne.moyenne, 11.2);
    assert.equal(ligne.major, 16.5);
    assert.deepEqual(ligne.mentions, { tresBien: 2, bien: 5, assezBien: 10, passable: 13 });
  });

  it('une session sans données donne des valeurs absentes (« — »), jamais 0 inventé', () => {
    assert.equal(archiveSansDonnees(vide), true);
    const ligne = ligneBilan(vide);
    assert.equal(ligne.effectif, null);
    assert.equal(ligne.classes, null);
    assert.equal(ligne.tauxReussite, null);
    assert.equal(ligne.moyenne, null);
    assert.equal(ligne.major, null);
    assert.equal(ligne.mentions.tresBien, null);
  });

  it('une archive saisie à la main n’a pas de nombre de classés', () => {
    const ligne = ligneBilan({ ...s2026, classesCount: undefined });
    assert.equal(ligne.classes, null);
    assert.equal(ligne.effectif, 11);
  });
});

describe('syntheseBilan', () => {
  it('cumule les effectifs et calcule le taux global sur les classés quand ils sont connus', () => {
    const synthese = syntheseBilan([ligneBilan(s2025), ligneBilan(s2026)]);
    assert.equal(synthese.sessions, 2);
    assert.equal(synthese.effectif, 51);
    assert.equal(synthese.classes, 49);
    assert.equal(synthese.admis, 38);
    assert.equal(synthese.ajournes, 11);
    assert.equal(synthese.tauxReussite, 77.55); // 38 / 49
    assert.equal(synthese.moyenne, 10.8);
    assert.equal(synthese.major, 16.5);
    assert.deepEqual(synthese.mentions, { tresBien: 2, bien: 6, assezBien: 13, passable: 17 });
  });

  it('sans classés connus, le taux global est la moyenne des taux de session', () => {
    const synthese = syntheseBilan([ligneBilan({ ...s2025, classesCount: undefined }), ligneBilan(s2026)]);
    assert.equal(synthese.classes, null);
    assert.equal(synthese.tauxReussite, 75.84);
  });

  it('ignore les sessions sans données et rend « — » quand rien n’est connu', () => {
    const synthese = syntheseBilan([ligneBilan(vide)]);
    assert.equal(synthese.effectif, null);
    assert.equal(synthese.tauxReussite, null);
    assert.equal(synthese.moyenne, null);
    assert.equal(synthese.major, null);
    assert.equal(synthese.mentions.bien, null);
  });
});

describe('graphique et ordre', () => {
  it('trie par année scolaire croissante', () => {
    assert.deepEqual(trierArchivesChronologique([s2026, vide, s2025]).map((s) => s.id), ['c', 'a', 'b']);
  });

  it('hauteur des barres proportionnelle au taux, 0 sans valeur', () => {
    const barres = barresBilan([ligneBilan(vide), ligneBilan(s2025), ligneBilan({ ...s2026, admittedRate: 140 })]);
    assert.equal(barres[0].hauteur, 0);
    assert.equal(barres[0].valeur, null);
    assert.equal(barres[1].hauteur, 78.95);
    assert.equal(barres[1].libelle, '2025-2026');
    assert.equal(barres[2].hauteur, 100);
  });
});
