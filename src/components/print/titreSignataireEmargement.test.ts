import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { titreSignataireEmargement } from './FeuilleEmargementSheet';

describe('titreSignataireEmargement', () => {
  it('inter-établissements : le chef du centre', () => {
    assert.equal(titreSignataireEmargement(true, { jurySignerTitle: 'La Directrice', institutionName: 'X' }, []), 'Le Chef du centre');
  });

  it('interne : le titre saisi dans le profil prime', () => {
    assert.equal(titreSignataireEmargement(false, { jurySignerTitle: 'La Directrice', institutionName: 'CS Harmonia' }, [{ niveau: 'Tle' }]), 'La Directrice');
  });

  it('interne sans surcharge : Le Directeur au collège, Le Proviseur au lycée', () => {
    assert.equal(titreSignataireEmargement(false, { institutionName: 'CS Harmonia' }, [{ niveau: '3e' }, { niveau: '4e' }]), 'Le Directeur');
    assert.equal(titreSignataireEmargement(false, { institutionName: 'CS Harmonia' }, [{ niveau: 'Tle' }]), 'Le Proviseur');
  });

  it('sans paramètres chargés, le nom du centre sert de repli', () => {
    assert.equal(titreSignataireEmargement(false, undefined, [], 'Lycée Moderne de Tokoin'), 'Le Proviseur');
  });
});
