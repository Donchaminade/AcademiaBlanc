import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { estSessionArchivee, filtrerRoster, sessionParDefaut, sessionsSoeurs } from './workspace';

// Même année scolaire (1) : deux BEPC blancs (10, 11), un BAC II blanc (12) ; année suivante (2) : un BEPC blanc (20).
const SESSIONS = [
  { id: 10, nom: 'BEPC Blanc n°1 – novembre', statut: 'ARCHIVEE', anneeScolaireId: 1, typeExamenId: 2, typeExamen: 'BEPC' },
  { id: 11, nom: 'BEPC Blanc n°2 – février', statut: 'OUVERTE', anneeScolaireId: 1, typeExamenId: 2, typeExamen: 'BEPC' },
  { id: 12, nom: 'BAC II Blanc', statut: 'OUVERTE', anneeScolaireId: 1, typeExamenId: 4, typeExamen: 'BAC II' },
  { id: 20, nom: 'BEPC Blanc 2027', statut: 'OUVERTE', anneeScolaireId: 2, typeExamenId: 2, typeExamen: 'BEPC' },
];

describe('sessionsSoeurs', () => {
  it('réunit les sessions du même examen dans la même année scolaire, la session comprise', () => {
    assert.deepEqual(sessionsSoeurs(SESSIONS[1], SESSIONS), [10, 11]);
    assert.deepEqual(sessionsSoeurs(SESSIONS[0], SESSIONS), [10, 11]);
  });

  it('écarte un autre type d’examen et une autre année scolaire', () => {
    assert.deepEqual(sessionsSoeurs(SESSIONS[2], SESSIONS), [12]);
    assert.deepEqual(sessionsSoeurs(SESSIONS[3], SESSIONS), [20]);
  });

  it('compare par libellé quand une session n’est pas rattachée au référentiel', () => {
    const ancienne = { id: 30, anneeScolaireId: 1, typeExamenId: null, typeExamen: 'bepc' };
    assert.deepEqual(sessionsSoeurs(ancienne, [...SESSIONS, ancienne]), [10, 11, 30]);
    assert.deepEqual(sessionsSoeurs(null, SESSIONS), []);
  });
});

describe('filtrerRoster avec sessions sœurs', () => {
  const eleves = [
    { id: 1, sessionId: 10 },
    { id: 2, sessionId: 11 },
    { id: 3, sessionId: 12 },
    { id: 4, sessionId: null },
  ];

  it('le second BEPC blanc reprend les élèves du premier, pas ceux du BAC', () => {
    assert.deepEqual(filtrerRoster(eleves, 11, {}, sessionsSoeurs(SESSIONS[1], SESSIONS)).map((e) => e.id), [1, 2, 4]);
    assert.deepEqual(filtrerRoster(eleves, 12, {}, sessionsSoeurs(SESSIONS[2], SESSIONS)).map((e) => e.id), [3, 4]);
  });
});

describe('estSessionArchivee', () => {
  it('reconnaît archivée, clôturée, fermée et terminée, accents et casse ignorés', () => {
    for (const statut of ['ARCHIVEE', 'Archivée', 'clôturée', 'CLOTUREE', 'Fermée', 'terminée']) {
      assert.equal(estSessionArchivee(statut), true, statut);
    }
    for (const statut of ['OUVERTE', 'ouverte', '', null, undefined]) {
      assert.equal(estSessionArchivee(statut), false, String(statut));
    }
  });
});

describe('sessionParDefaut', () => {
  const annees = [{ id: 1, courante: true }, { id: 2, courante: false }];

  it('garde la session demandée quand elle existe', () => {
    assert.equal(sessionParDefaut(SESSIONS, 10, annees)?.id, 10);
  });

  it('préfère une session ouverte de l’année courante à la session archivée qui la précède dans la liste', () => {
    assert.equal(sessionParDefaut(SESSIONS, undefined, annees)?.id, 11);
    assert.equal(sessionParDefaut(SESSIONS, 999, annees)?.id, 11);
  });

  it('se rabat sur une session ouverte d’une autre année, puis sur la première de la liste', () => {
    assert.equal(sessionParDefaut(SESSIONS, undefined, [{ id: 3, courante: true }])?.id, 11);
    assert.equal(sessionParDefaut(SESSIONS.slice(0, 1), undefined, annees)?.id, 10);
    assert.equal(sessionParDefaut([], undefined, annees), null);
  });
});
