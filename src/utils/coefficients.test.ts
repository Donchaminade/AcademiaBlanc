import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeCandidateStats } from '../data/mockData';
import { Candidate, Subject } from '../types';
import {
  coefDuCandidat,
  coefficientEffectif,
  formatCoefficient,
  formatPointsMax,
  lireCoefficientSaisi,
  pointsDeNote,
  pointsMax,
} from './coefficients';

const coefficients = [
  { matiereId: 1, classeId: null, valeur: 2 },
  { matiereId: 1, classeId: 30, valeur: 4 },
  { matiereId: 2, classeId: 30, valeur: 3 },
];

describe('coefficientEffectif', () => {
  it('fait primer le coefficient de la classe sur le coefficient toutes classes', () => {
    assert.deepEqual(coefficientEffectif(coefficients, 1, 30), { valeur: 4, source: 'classe' });
  });

  it('retombe sur le coefficient toutes classes pour une autre classe', () => {
    assert.deepEqual(coefficientEffectif(coefficients, 1, 31), { valeur: 2, source: 'global' });
    assert.deepEqual(coefficientEffectif(coefficients, 1, null), { valeur: 2, source: 'global' });
  });

  it('applique 1 par défaut quand rien n’est saisi', () => {
    assert.deepEqual(coefficientEffectif(coefficients, 2, 31), { valeur: 1, source: 'defaut' });
    assert.deepEqual(coefficientEffectif(coefficients, 9, 30), { valeur: 1, source: 'defaut' });
  });

  it('accepte les valeurs renvoyées en chaîne par l’API', () => {
    assert.equal(coefficientEffectif([{ matiereId: 5, valeur: '2.5' }], 5, 1).valeur, 2.5);
  });
});

describe('barème', () => {
  it('une note sur 20 au coefficient 2 vaut 40 points au maximum', () => {
    assert.equal(pointsMax(2), 40);
    assert.equal(pointsMax(0.5), 10);
    assert.equal(pointsMax(2.5), 50);
    assert.equal(formatPointsMax(2), '40 pts');
  });

  it('les points d’une note sont note × coefficient', () => {
    assert.equal(pointsDeNote(12, 2), 24);
    assert.equal(pointsDeNote(14.5, 3), 43.5);
  });

  it('formate le coefficient en « ×2 » / « ×2,5 »', () => {
    assert.equal(formatCoefficient(2), '×2');
    assert.equal(formatCoefficient(2.5), '×2,5');
  });

  it('lit la saisie du formulaire (virgule acceptée, bornes 0,5 à 20)', () => {
    assert.equal(lireCoefficientSaisi('2'), 2);
    assert.equal(lireCoefficientSaisi('2,5'), 2.5);
    assert.equal(lireCoefficientSaisi('0'), null);
    assert.equal(lireCoefficientSaisi('21'), null);
    assert.equal(lireCoefficientSaisi('abc'), null);
  });
});

describe('computeCandidateStats', () => {
  const subjects: Subject[] = [
    { id: '1', name: 'Mathématiques', teacher: '', coef: 2 },
    { id: '2', name: 'Français', teacher: '', coef: 1, coefDefault: true },
  ];
  const candidat = (id: string, grades: Record<string, number>, coefs?: Record<string, number>): Candidate => ({
    id,
    tableNumber: 1,
    matricule: id,
    fullName: id,
    dob: '',
    birthPlace: '',
    originSchool: '',
    gender: 'F',
    serie: '',
    examCenter: '',
    examCenterName: '',
    parentPhone: '',
    parentEmail: '',
    grades: Object.fromEntries(Object.entries(grades).map(([k, score]) => [k, { score, appreciation: '' }])),
    coefs,
    generalObservation: '',
  });

  it('total = Σ(note × coef), moyenne = total / Σ coef avec les coefficients communs', () => {
    const eleve = candidat('a', { 1: 12, 2: 15 });
    const stats = computeCandidateStats(eleve, subjects, [eleve]);
    assert.equal(stats.totalCoef, 3);
    assert.equal(stats.totalPoints, 12 * 2 + 15 * 1);
    assert.equal(stats.average, 13);
    assert.equal(pointsMax(stats.totalCoef), 60);
  });

  it('utilise le coefficient de la classe de l’élève quand il existe', () => {
    const eleve = candidat('b', { 1: 12, 2: 15 }, { 1: 4, 2: 3 });
    assert.equal(coefDuCandidat(eleve, subjects[0]), 4);
    const stats = computeCandidateStats(eleve, subjects, [eleve]);
    assert.equal(stats.totalCoef, 7);
    assert.equal(stats.totalPoints, 12 * 4 + 15 * 3);
    assert.equal(stats.average, Math.round((93 / 7) * 100) / 100);
    assert.equal(pointsMax(stats.totalCoef), 140);
  });
});
