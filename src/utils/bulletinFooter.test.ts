import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bulletinFooterText } from './bulletinFooter';

describe('bulletinFooterText', () => {
  it('imprime le nom en majuscules puis la devise séparés par un point médian', () => {
    assert.equal(
      bulletinFooterText('Complexe Scolaire Harmonia', 'Discipline – Excellence – Réussite'),
      'COMPLEXE SCOLAIRE HARMONIA • Discipline – Excellence – Réussite',
    );
  });

  it('se limite au nom quand la devise est vide ou absente', () => {
    assert.equal(bulletinFooterText('Complexe Scolaire Harmonia', ''), 'COMPLEXE SCOLAIRE HARMONIA');
    assert.equal(bulletinFooterText('Complexe Scolaire Harmonia', '   '), 'COMPLEXE SCOLAIRE HARMONIA');
    assert.equal(bulletinFooterText('Complexe Scolaire Harmonia', null), 'COMPLEXE SCOLAIRE HARMONIA');
    assert.equal(bulletinFooterText('Complexe Scolaire Harmonia', undefined), 'COMPLEXE SCOLAIRE HARMONIA');
  });

  it('garde les accents en majuscules et normalise les espaces', () => {
    assert.equal(
      bulletinFooterText('  Lycée   d’Élite  ', ' Travail  et rigueur '),
      'LYCÉE D’ÉLITE • Travail et rigueur',
    );
  });

  it('ne laisse pas la devise de l’établissement en majuscules', () => {
    assert.equal(bulletinFooterText('Harmonia', 'Discipline – Excellence'), 'HARMONIA • Discipline – Excellence');
  });

  it('renvoie une chaîne vide sans nom ni devise', () => {
    assert.equal(bulletinFooterText('', ''), '');
    assert.equal(bulletinFooterText(null, null), '');
  });
});
