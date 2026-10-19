import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  APPRECIATION_LONGUEUR_MAX,
  appreciationAffichee,
  appreciationManuelleValide,
  appreciationSelonNote,
  normaliserAppreciationManuelle,
} from './appreciation';

describe('appreciationSelonNote : barème unique sur la note /20 de la matière', () => {
  const cas: Array<[number, string]> = [
    [0, 'Très insuffisant'],
    [4, 'Très insuffisant'],
    [4.99, 'Très insuffisant'],
    [5, 'Insuffisant'],
    [7, 'Insuffisant'],
    [7.99, 'Insuffisant'],
    [8, 'Médiocre'],
    [9, 'Médiocre'],
    [9.99, 'Médiocre'],
    [10, 'Passable'],
    [11, 'Passable'],
    [11.99, 'Passable'],
    [12, 'Assez bien'],
    [13, 'Assez bien'],
    [13.99, 'Assez bien'],
    [14, 'Bien'],
    [15, 'Bien'],
    [15.99, 'Bien'],
    [16, 'Très bien'],
    [17, 'Très bien'],
    [17.99, 'Très bien'],
    [18, 'Excellent'],
    [19, 'Excellent'],
    [20, 'Excellent'],
  ];

  for (const [note, attendu] of cas) {
    it(`${note.toFixed(2)}/20 → « ${attendu} »`, () => {
      assert.equal(appreciationSelonNote(note), attendu);
    });
  }

  it('les huit notes 4, 7, 9, 11, 13, 15, 17, 19 donnent huit appréciations différentes', () => {
    const libelles = [4, 7, 9, 11, 13, 15, 17, 19].map((note) => appreciationSelonNote(note));
    assert.equal(new Set(libelles).size, 8);
  });

  it('note absente → « Non noté », absence signalée → « Absent »', () => {
    assert.equal(appreciationSelonNote(undefined), 'Non noté');
    assert.equal(appreciationSelonNote(null), 'Non noté');
    assert.equal(appreciationSelonNote(Number.NaN), 'Non noté');
    assert.equal(appreciationSelonNote(21), 'Non noté');
    assert.equal(appreciationSelonNote(-1), 'Non noté');
    assert.equal(appreciationSelonNote(12, { absent: true }), 'Absent');
    assert.equal(appreciationSelonNote(undefined, { absent: true }), 'Absent');
  });
});

describe('appreciationAffichee : texte libre de l’enseignant sinon automatique', () => {
  it('affiche le texte libre quand il existe', () => {
    assert.equal(appreciationAffichee({ score: 7, appreciation: 'Des progrès à l’oral.' }), 'Des progrès à l’oral.');
  });

  it('retombe sur l’automatique quand le texte est vide ou fait d’espaces', () => {
    assert.equal(appreciationAffichee({ score: 7, appreciation: '' }), 'Insuffisant');
    assert.equal(appreciationAffichee({ score: 9, appreciation: '   ' }), 'Médiocre');
    assert.equal(appreciationAffichee({ score: 14, appreciation: undefined as unknown as string }), 'Bien');
  });

  it('sans note → « Non noté »', () => {
    assert.equal(appreciationAffichee(undefined), 'Non noté');
    assert.equal(appreciationAffichee(null), 'Non noté');
  });
});

describe('appréciation manuelle : normalisation et longueur', () => {
  it('compacte les espaces et ignore les bords', () => {
    assert.equal(normaliserAppreciationManuelle('  Bon   travail  '), 'Bon travail');
    assert.equal(normaliserAppreciationManuelle(null), '');
  });

  it(`accepte jusqu'à ${APPRECIATION_LONGUEUR_MAX} caractères et refuse au-delà`, () => {
    assert.equal(appreciationManuelleValide('a'.repeat(APPRECIATION_LONGUEUR_MAX)), true);
    assert.equal(appreciationManuelleValide('a'.repeat(APPRECIATION_LONGUEUR_MAX + 1)), false);
    assert.equal(appreciationManuelleValide(''), true);
  });
});
