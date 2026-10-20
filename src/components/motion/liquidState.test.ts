import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { executerAction, niveauRemplissage, peutDeclencher, progressionSimulee, transition } from './liquidState';

describe('bouton liquide : machine à états', () => {
  it('suit repos → chargement → succès → repos', () => {
    let e = transition('repos', 'cliquer');
    assert.equal(e, 'chargement');
    e = transition(e, 'resoudre');
    assert.equal(e, 'succes');
    assert.equal(transition(e, 'reinitialiser'), 'repos');
  });
  it('passe en erreur sur rejet puis revient au repos', () => {
    const e = transition('chargement', 'rejeter');
    assert.equal(e, 'erreur');
    assert.equal(transition(e, 'reinitialiser'), 'repos');
  });
  it('ignore les événements hors séquence', () => {
    assert.equal(transition('chargement', 'cliquer'), 'chargement');
    assert.equal(transition('repos', 'resoudre'), 'repos');
    assert.equal(transition('repos', 'rejeter'), 'repos');
    assert.equal(transition('erreur', 'resoudre'), 'erreur');
    assert.equal(transition('succes', 'rejeter'), 'succes');
    assert.equal(transition('chargement', 'reinitialiser'), 'chargement');
    assert.equal(peutDeclencher('repos'), true);
    assert.equal(peutDeclencher('chargement'), false);
    assert.equal(peutDeclencher('erreur'), false);
  });
  it('relance le chargement depuis succès ou erreur (nouvel essai)', () => {
    assert.equal(transition('erreur', 'cliquer'), 'chargement');
    assert.equal(transition(transition('erreur', 'cliquer'), 'resoudre'), 'succes');
    assert.equal(transition('succes', 'cliquer'), 'chargement');
    assert.equal(transition(transition('succes', 'cliquer'), 'rejeter'), 'erreur');
    // Le retour au repos programmé n'efface pas un chargement déjà relancé.
    assert.equal(transition(transition('erreur', 'cliquer'), 'reinitialiser'), 'chargement');
  });
  it('simule une progression croissante plafonnée à 90 %', () => {
    assert.equal(progressionSimulee(0), 0);
    assert.ok(progressionSimulee(500) < progressionSimulee(1500));
    assert.ok(progressionSimulee(60_000) <= 0.9);
  });
  it('calcule le niveau de remplissage', () => {
    assert.equal(niveauRemplissage('repos', 0.5), 0);
    assert.equal(niveauRemplissage('chargement', 0.4), 0.4);
    assert.equal(niveauRemplissage('chargement', 2), 1);
    assert.equal(niveauRemplissage('succes', 0), 1);
    assert.equal(niveauRemplissage('erreur', 0.7), 0);
  });
  it("traduit l'issue de l'action", async () => {
    assert.equal(await executerAction(() => Promise.resolve(1)), 'resoudre');
    assert.equal(await executerAction(() => undefined), 'resoudre');
    assert.equal(await executerAction(() => true), 'resoudre');
    assert.equal(await executerAction(() => false), 'rejeter');
    assert.equal(await executerAction(() => Promise.reject(new Error('x'))), 'rejeter');
    assert.equal(await executerAction(() => { throw new Error('x'); }), 'rejeter');
  });
});
