import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ENTREES_BAS_MAX,
  TIROIR_FERME,
  entreeActive,
  entreesBas,
  fermerTiroir,
  indexFocusSuivant,
  ouvrirTiroir,
  tiroirApresChangementDeVue,
  vuesDuTiroir,
} from './mobileNav';

describe('entreesBas', () => {
  it('propose quatre vues principales puis « Plus » pour un établissement', () => {
    const entrees = entreesBas();
    assert.deepEqual(entrees.map((e) => e.id), ['dashboard', 'students', 'grading', 'bulletin', 'plus']);
    assert.equal(entrees.at(-1)?.view, undefined);
    assert.ok(entrees.length <= ENTREES_BAS_MAX);
  });

  it('ne garde que la plateforme et « Plus » pour un compte plateforme sans établissement', () => {
    assert.deepEqual(entreesBas({ platformOnly: true }).map((e) => e.id), ['plateforme', 'plus']);
  });

  it('ne dépasse jamais cinq entrées, même pour un propriétaire rattaché à un établissement', () => {
    assert.ok(entreesBas({ platformOwner: true }).length <= ENTREES_BAS_MAX);
  });

  it('donne à chaque entrée une icône et un libellé court', () => {
    for (const entree of entreesBas()) {
      assert.ok(entree.icon.length > 0);
      assert.ok(entree.label.length > 0 && entree.label.length <= 10, entree.label);
    }
  });
});

describe('entreeActive', () => {
  it('met en évidence l’entrée qui ouvre la vue courante', () => {
    assert.equal(entreeActive('dashboard'), 'dashboard');
    assert.equal(entreeActive('students'), 'students');
    assert.equal(entreeActive('grading'), 'grading');
    assert.equal(entreeActive('bulletin'), 'bulletin');
  });

  it('met « Plus » en évidence pour les vues accessibles depuis le tiroir', () => {
    for (const vue of ['records', 'settings', 'admin', 'profil', 'abonnement', 'plateforme', 'abonnements'] as const) {
      assert.equal(entreeActive(vue), 'plus', vue);
    }
  });

  it('n’active rien hors application', () => {
    assert.equal(entreeActive('auth'), null);
  });

  it('suit la liste d’entrées fournie (compte plateforme)', () => {
    const entrees = entreesBas({ platformOnly: true });
    assert.equal(entreeActive('plateforme', entrees), 'plateforme');
    assert.equal(entreeActive('dashboard', entrees), 'plus');
  });
});

describe('vuesDuTiroir', () => {
  it('liste les vues sans entrée directe', () => {
    assert.deepEqual(vuesDuTiroir(), ['records', 'settings', 'admin', 'profil', 'abonnement', 'plateforme', 'abonnements']);
  });
});

describe('état du tiroir', () => {
  it('s’ouvre en mémorisant la vue courante et se ferme explicitement', () => {
    const ouvert = ouvrirTiroir('students');
    assert.deepEqual(ouvert, { ouvert: true, vueOuverture: 'students' });
    assert.deepEqual(fermerTiroir(), TIROIR_FERME);
  });

  it('se referme quand la vue change, reste ouvert sinon', () => {
    const ouvert = ouvrirTiroir('students');
    assert.equal(tiroirApresChangementDeVue(ouvert, 'students'), ouvert);
    assert.deepEqual(tiroirApresChangementDeVue(ouvert, 'records'), TIROIR_FERME);
  });

  it('ne change rien quand il est déjà fermé', () => {
    assert.equal(tiroirApresChangementDeVue(TIROIR_FERME, 'records'), TIROIR_FERME);
  });
});

describe('indexFocusSuivant (piège de focus)', () => {
  it('boucle du dernier au premier élément avec Tab', () => {
    assert.equal(indexFocusSuivant({ key: 'Tab', shiftKey: false }, 4, 5), 0);
    assert.equal(indexFocusSuivant({ key: 'Tab', shiftKey: false }, 2, 5), null);
  });

  it('boucle du premier au dernier avec Maj+Tab', () => {
    assert.equal(indexFocusSuivant({ key: 'Tab', shiftKey: true }, 0, 5), 4);
    assert.equal(indexFocusSuivant({ key: 'Tab', shiftKey: true }, 3, 5), null);
  });

  it('ramène dans le tiroir un focus parti ailleurs', () => {
    assert.equal(indexFocusSuivant({ key: 'Tab', shiftKey: false }, -1, 5), 0);
  });

  it('ignore les autres touches et un tiroir vide', () => {
    assert.equal(indexFocusSuivant({ key: 'Enter', shiftKey: false }, 0, 5), null);
    assert.equal(indexFocusSuivant({ key: 'Tab', shiftKey: false }, 0, 0), null);
  });
});
