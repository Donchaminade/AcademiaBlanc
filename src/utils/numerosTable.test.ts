import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Candidate } from '../types';
import {
  aUnNumeroTable,
  attribuerNumerosManquants,
  candidatsSansNumero,
  numeroTableAffiche,
  trierPourEmargement,
} from './numerosTable';

const candidat = (id: string, nom: string, tableNumber: number, niveau = '3e', classeNom = '3e A'): Candidate => ({
  id,
  tableNumber,
  matricule: `M-${id}`,
  fullName: nom,
  dob: '',
  birthPlace: '',
  originSchool: '',
  gender: 'M',
  serie: '',
  niveau,
  classeNom,
  examCenter: '',
  examCenterName: '',
  parentPhone: '',
  parentEmail: '',
  generalObservation: '',
  grades: {},
});

describe('numéro de table manquant', () => {
  it('0 ou NaN (numero_table null sur l’API) n’est pas un numéro attribué et s’affiche vide, jamais « 0 »', () => {
    assert.equal(aUnNumeroTable({ tableNumber: 0 }), false);
    assert.equal(aUnNumeroTable({ tableNumber: Number.NaN }), false);
    assert.equal(aUnNumeroTable({ tableNumber: -3 }), false);
    assert.equal(aUnNumeroTable({ tableNumber: 12 }), true);
    assert.equal(numeroTableAffiche({ tableNumber: 0 }), '');
    assert.equal(numeroTableAffiche({ tableNumber: 0 }, '—'), '—');
    assert.equal(numeroTableAffiche({ tableNumber: 138 }), '138');
  });

  it('liste les candidats sans numéro par classe puis nom', () => {
    const liste = [
      candidat('1', 'ZOLA Marc', 0, 'Tle', 'Tle D'),
      candidat('2', 'ADOU Kofi', 5),
      candidat('3', 'BALI Ama', 0),
      candidat('4', 'ABALO Yao', 0),
    ];
    assert.deepEqual(candidatsSansNumero(liste).map((c) => c.id), ['4', '3', '1']);
  });
});

describe('attribuerNumerosManquants', () => {
  it('numérote les manquants à partir du premier numéro paramétré, en sautant les numéros déjà pris', () => {
    const liste = [
      candidat('1', 'KOUASSI Iman', 0),
      candidat('2', 'ADOUGBA Komlan', 101),
      candidat('3', 'BATOKI Essodolom', 0),
      candidat('4', 'ATTIKOUFIO Estelle', 102),
    ];
    const resultat = attribuerNumerosManquants(liste, 101);
    // L'ordre d'entrée est conservé, les numéros existants aussi.
    assert.deepEqual(resultat.map((c) => c.id), ['1', '2', '3', '4']);
    assert.equal(resultat[1].tableNumber, 101);
    assert.equal(resultat[3].tableNumber, 102);
    // BATOKI précède KOUASSI : 103 puis 104.
    assert.equal(resultat[2].tableNumber, 103);
    assert.equal(resultat[0].tableNumber, 104);
  });

  it('numérote par classe puis nom quand personne n’a de numéro (import avant la fonctionnalité)', () => {
    const liste = [
      candidat('a', 'WOBOTI Nadjat', 0, '3e', '3e B'),
      candidat('b', 'ADOUGBA Komlan', 0, '3e', '3e A'),
      candidat('c', 'TCHALLA Emmanuella', 0, '3e', '3e A'),
    ];
    const resultat = attribuerNumerosManquants(liste, 1);
    const parId = Object.fromEntries(resultat.map((c) => [c.id, c.tableNumber]));
    assert.deepEqual(parId, { b: 1, c: 2, a: 3 });
  });

  it('rend la liste inchangée quand tous les numéros sont attribués et replie sur 1 si le paramètre est invalide', () => {
    const complets = [candidat('1', 'A', 3), candidat('2', 'B', 4)];
    assert.equal(attribuerNumerosManquants(complets, 50), complets);
    const resultat = attribuerNumerosManquants([candidat('1', 'A', 0)], 0);
    assert.equal(resultat[0].tableNumber, 1);
  });

  it('ne modifie pas les objets d’origine', () => {
    const original = candidat('1', 'A', 0);
    attribuerNumerosManquants([original], 10);
    assert.equal(original.tableNumber, 0);
  });
});

describe('trierPourEmargement', () => {
  it('place les candidats numérotés par numéro croissant puis les sans-numéro par classe et nom', () => {
    const liste = [
      candidat('1', 'ZED', 0),
      candidat('2', 'BOB', 7),
      candidat('3', 'ALI', 0),
      candidat('4', 'CAM', 2),
    ];
    assert.deepEqual(trierPourEmargement(liste).map((c) => c.id), ['4', '2', '3', '1']);
  });
});
