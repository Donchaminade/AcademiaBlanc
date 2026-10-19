import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeCandidateStats, INITIAL_CANDIDATES, INITIAL_SUBJECTS } from '../data/mockData';
import { Candidate, Subject } from '../types';
import {
  camaradesDeClasse,
  extremesDeMatiere,
  extremesDesMoyennes,
  formatMinMax,
  moyenneReelle,
} from './bulletinMetrics';

const candidat = (id: string, classeId: string, grades: Record<string, number>, coefs?: Record<string, number>): Candidate => ({
  id,
  tableNumber: Number(id),
  matricule: `M-${id}`,
  fullName: `Élève ${id}`,
  dob: '',
  birthPlace: '',
  originSchool: '',
  gender: 'M',
  serie: '',
  classeId,
  examCenter: '',
  examCenterName: '',
  parentPhone: '',
  parentEmail: '',
  grades: Object.fromEntries(Object.entries(grades).map(([k, v]) => [k, { score: v, appreciation: '' }])),
  coefs,
  generalObservation: '',
});

// Programme de la 3e (classe 30) : 7 matières, Σ coef = 14 → total max 280.
// Programme de la Tle D (classe 40) : 4 matières dont maths ×5, Σ coef = 12 → total max 240.
const subjects: Subject[] = [
  { id: 'math', name: 'Mathématiques', teacher: '', coef: 4, coefParClasse: { '30': 3, '40': 5 } },
  { id: 'fr', name: 'Français', teacher: '', coef: 3, coefParClasse: { '30': 3, '40': 2 } },
  { id: 'pc', name: 'Physique-Chimie', teacher: '', coef: 2, coefParClasse: { '30': 2, '40': 3 } },
  { id: 'svt', name: 'SVT', teacher: '', coef: 2, coefParClasse: { '30': 2, '40': 2 } },
  { id: 'hg', name: 'Histoire-Géographie', teacher: '', coef: 2, coefParClasse: { '30': 2 } },
  { id: 'ang', name: 'Anglais', teacher: '', coef: 2, coefParClasse: { '30': 1 } },
  { id: 'eps', name: 'EPS', teacher: '', coef: 1, coefParClasse: { '30': 1 } },
  { id: 'philo', name: 'Philosophie', teacher: '', coef: 2 },
];

const troisiemeA = candidat('1', '30', { math: 12, fr: 10, pc: 14, svt: 8, hg: 11, ang: 15, eps: 16 });
const troisiemeB = candidat('2', '30', { math: 6, fr: 9, pc: 7, svt: 10, hg: 8, ang: 12, eps: 14 });
const troisiemeC = candidat('3', '30', {}); // inscrit, aucune note
const terminale = candidat('4', '40', { math: 15, fr: 11, pc: 13, svt: 12 });
const tous = [troisiemeA, troisiemeB, troisiemeC, terminale];

describe('moyenneReelle', () => {
  it('calcule Σ(note × coef) / Σ coef sur le programme de la classe, sans aucun point ajouté', () => {
    const m = moyenneReelle(troisiemeA, subjects);
    // 12×3 + 10×3 + 14×2 + 8×2 + 11×2 + 15×1 + 16×1 = 36+30+28+16+22+15+16 = 163 ; Σ coef = 14
    assert.equal(m.totalPoints, 163);
    assert.equal(m.totalCoef, 14);
    assert.equal(m.average, 11.64);
    assert.equal(m.evaluated, true);
  });

  it('exclut une matière sans note du numérateur et du dénominateur (règle de l’API)', () => {
    const incomplet = candidat('9', '30', { math: 12, fr: 10, pc: 14 }); // hg, svt, ang, eps non notées
    const m = moyenneReelle(incomplet, subjects);
    // 36 + 30 + 28 = 94 ; Σ coef notés = 8 → 11.75 (et non 94 / 14 = 6.71 si l’absence valait zéro)
    assert.equal(m.totalPoints, 94);
    assert.equal(m.totalCoef, 8);
    assert.equal(m.average, 11.75);
    // Le programme complet reste la référence du total maximal.
    assert.equal(m.totalCoefProgramme, 14);
    assert.equal(m.pointsMax, 280);
  });

  it('considère une note de 0 comme présente', () => {
    const zero = candidat('8', '30', { math: 0, fr: 10 });
    const m = moyenneReelle(zero, subjects);
    assert.equal(m.totalCoef, 6);
    assert.equal(m.average, 5);
  });

  it('donne le total maximal 20 × Σ coef DU PROGRAMME DE LA CLASSE, pas d’un jeu global de matières', () => {
    assert.equal(moyenneReelle(troisiemeA, subjects).pointsMax, 280);
    assert.equal(moyenneReelle(terminale, subjects).pointsMax, 240);
    // Sans programme défini pour la classe : toutes les matières, coefficients communs (4+3+2+2+2+2+1+2 = 18).
    assert.equal(moyenneReelle(candidat('7', '99', { math: 10 }), subjects).pointsMax, 360);
  });

  it('un élève sans aucune note a une moyenne 0 non évaluée', () => {
    const m = moyenneReelle(troisiemeC, subjects);
    assert.equal(m.average, 0);
    assert.equal(m.totalCoef, 0);
    assert.equal(m.evaluated, false);
    assert.equal(m.pointsMax, 280);
  });

  it('les 420 points de la démonstration viennent de 20 × Σ coef (21) des 8 matières de démonstration', () => {
    const sommeCoef = INITIAL_SUBJECTS.reduce((acc, s) => acc + s.coef, 0);
    assert.equal(sommeCoef, 21);
    assert.equal(moyenneReelle(INITIAL_CANDIDATES[0], INITIAL_SUBJECTS).pointsMax, 420);
  });
});

describe('extrêmes de la classe', () => {
  it('ne retient que les camarades de la même classe', () => {
    assert.deepEqual(camaradesDeClasse(troisiemeA, tous).map((c) => c.id), ['1', '2', '3']);
    assert.deepEqual(camaradesDeClasse(terminale, tous).map((c) => c.id), ['4']);
    // Sans classe (démonstration) : toute la session.
    assert.equal(camaradesDeClasse({ classeId: undefined }, tous).length, 4);
  });

  it('calcule moyenne de classe, plus forte et plus faible sur les élèves notés seulement', () => {
    const e = extremesDesMoyennes(camaradesDeClasse(troisiemeA, tous), subjects);
    // B : 18+27+14+20+16+12+14 = 121 / 14 = 8.64
    assert.equal(e.highest, 11.64);
    assert.equal(e.lowest, 8.64);
    assert.equal(e.average, 10.14);
    assert.equal(e.count, 2);
  });

  it('renvoie null sans élève noté', () => {
    assert.deepEqual(extremesDesMoyennes([troisiemeC], subjects), { average: null, highest: null, lowest: null, count: 0 });
  });

  it('donne le min / max d’une matière sur les notes présentes', () => {
    assert.deepEqual(extremesDeMatiere('math', [troisiemeA, troisiemeB, troisiemeC]), { highest: 12, lowest: 6, count: 2 });
    assert.equal(formatMinMax(extremesDeMatiere('math', [troisiemeA, troisiemeB, troisiemeC])), '6.00 / 12.00');
    assert.equal(formatMinMax(extremesDeMatiere('math', [troisiemeC])), '—');
  });
});

describe('computeCandidateStats', () => {
  it('reporte la moyenne réelle, le total maximal du programme et les extrêmes de la classe', () => {
    const stats = computeCandidateStats(troisiemeA, subjects, tous);
    assert.equal(stats.average, 11.64);
    assert.equal(stats.totalPoints, 163);
    assert.equal(stats.totalCoef, 14);
    assert.equal(stats.pointsMax, 280);
    assert.equal(stats.classHighestAverage, 11.64);
    assert.equal(stats.classLowestAverage, 8.64);
    assert.equal(stats.classAverage, 10.14);
    assert.equal(stats.classEvaluatedCount, 2);
    assert.equal(stats.mention, 'PASSABLE');
    assert.equal(stats.decision, "ADMIS D'OFFICE À L'EXAMEN BLANC");
  });

  it('un élève à 9,75 reste en rattrapage : aucun repêchage ne majore la moyenne', () => {
    const limite = candidat('5', '30', { math: 9.75, fr: 9.75, pc: 9.75, svt: 9.75, hg: 9.75, ang: 9.75, eps: 9.75 });
    const stats = computeCandidateStats(limite, subjects, [limite]);
    assert.equal(stats.average, 9.75);
    assert.equal(stats.mention, 'RATTRAPAGE');
    assert.equal(stats.decision, 'ADMISSIBLE AU SECOND TOUR (RATTRAPAGE)');
  });

  it('classe la terminale sur son propre programme et ses propres extrêmes', () => {
    const stats = computeCandidateStats(terminale, subjects, tous);
    // 75 + 22 + 39 + 24 = 160 / 12 = 13.33
    assert.equal(stats.average, 13.33);
    assert.equal(stats.pointsMax, 240);
    assert.equal(stats.rank, 1);
    assert.equal(stats.classHighestAverage, 13.33);
    assert.equal(stats.classLowestAverage, 13.33);
    assert.equal(stats.classEvaluatedCount, 1);
  });
});
