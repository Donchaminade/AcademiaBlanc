import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  anneeDeFin,
  avertissementCycle,
  grouperTypesExamen,
  libelleCourtSession,
  libelleLongSession,
  nomSessionSuggere,
  TypeExamenChoix,
} from '../api/typesExamen';

const bepc: TypeExamenChoix = { id: 2, code: 'BEPC', libelleCourt: 'BEPC', libelleLong: "Brevet d'Études du Premier Cycle", cycle: 'COLLEGE', ordre: 20 };
const bac2: TypeExamenChoix = { id: 4, code: 'BAC2', libelleCourt: 'BAC II', libelleLong: 'Baccalauréat Deuxième Partie', cycle: 'LYCEE', ordre: 40 };
const compo: TypeExamenChoix = { id: 5, code: 'COMPO', libelleCourt: 'Composition', libelleLong: 'Composition / Examen blanc interne', cycle: 'TOUS', ordre: 50 };

describe('nom de session suggéré', () => {
  it('reprend le libellé court, « Blanc » et l’année de fin', () => {
    assert.equal(nomSessionSuggere(bepc, '2025-2026'), 'BEPC Blanc 2026');
    assert.equal(nomSessionSuggere(bac2, '2026-2027'), 'BAC II Blanc 2027');
  });
  it('ne double pas « blanc » pour une composition et tolère une année absente', () => {
    assert.equal(nomSessionSuggere(compo, '2025-2026'), 'Composition 2026');
    assert.equal(nomSessionSuggere(bepc, ''), 'BEPC Blanc');
    assert.equal(nomSessionSuggere(null, '2025-2026'), '');
  });
  it('extrait l’année civile de fin', () => {
    assert.equal(anneeDeFin('2025-2026'), '2026');
    assert.equal(anneeDeFin('2026'), '2026');
    assert.equal(anneeDeFin('Année test'), 'Année test');
  });
});

describe('groupement par cycle', () => {
  it('ordonne Collège, Lycée, Tous et omet les groupes vides', () => {
    const groupes = grouperTypesExamen([compo, bac2, bepc]);
    assert.deepEqual(groupes.map((g) => g.label), ['Collège', 'Lycée', 'Tous']);
    assert.deepEqual(groupes[1].types.map((t) => t.code), ['BAC2']);
    assert.deepEqual(grouperTypesExamen([bac2]).map((g) => g.cycle), ['LYCEE']);
  });
});

describe('avertissement de cycle (non bloquant)', () => {
  it('reste muet pour un type « Tous », sans classe, ou quand tout correspond', () => {
    assert.equal(avertissementCycle(compo, ['COLLEGE', 'LYCEE']), null);
    assert.equal(avertissementCycle(bepc, []), null);
    assert.equal(avertissementCycle(bepc, ['COLLEGE', 'COLLEGE']), null);
  });
  it('signale les classes hors cycle', () => {
    assert.match(avertissementCycle(bepc, ['LYCEE']) ?? '', /aucune des classes concernées/);
    assert.match(avertissementCycle(bac2, ['LYCEE', 'COLLEGE', 'COLLEGE']) ?? '', /2 classes concernées/);
  });
});

describe('libellés de session', () => {
  it('préfère le référentiel et retombe sur le texte conservé', () => {
    const rattachee = { typeExamen: 'BEPC', typeExamenLibelle: 'BEPC', typeExamenLibelleLong: "Brevet d'Études du Premier Cycle" };
    assert.equal(libelleCourtSession(rattachee), 'BEPC');
    assert.equal(libelleLongSession(rattachee), "Brevet d'Études du Premier Cycle");
    const ancienne = { typeExamen: 'BACCALAURÉAT II', typeExamenHorsReferentiel: true };
    assert.equal(libelleCourtSession(ancienne), 'BACCALAURÉAT II');
    assert.equal(libelleLongSession(ancienne), 'BACCALAURÉAT II');
    assert.equal(libelleCourtSession(null), '');
  });
});
