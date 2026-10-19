import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LEGAL_ROUTES, ROUTE_PATHS, clicNavigationInterne, isLegalRoute, routeFromPath } from './router';

describe('routeFromPath', () => {
  it('reconnaît les trois pages légales publiques', () => {
    assert.equal(routeFromPath('/cgu'), 'cgu');
    assert.equal(routeFromPath('/confidentialite'), 'confidentialite');
    assert.equal(routeFromPath('/conditions'), 'conditions');
    assert.equal(routeFromPath('/CGU/'), 'cgu');
  });

  it('garde les routes existantes et retombe sur la vitrine', () => {
    assert.equal(routeFromPath('/'), 'vitrine');
    assert.equal(routeFromPath('/connexion'), 'connexion');
    assert.equal(routeFromPath('/inscription'), 'inscription');
    assert.equal(routeFromPath('/admin'), 'admin');
    assert.equal(routeFromPath('/inconnue'), 'vitrine');
  });

  it('associe un chemin à chaque route légale', () => {
    for (const route of LEGAL_ROUTES) {
      assert.ok(isLegalRoute(route));
      assert.equal(routeFromPath(ROUTE_PATHS[route]), route);
    }
    assert.equal(isLegalRoute('vitrine'), false);
  });
});

describe('clicNavigationInterne', () => {
  const clic = { defaultPrevented: false, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };

  it('accepte un clic gauche simple', () => {
    assert.equal(clicNavigationInterne(clic), true);
  });

  it('laisse au navigateur les clics avec modificateur ou bouton du milieu', () => {
    assert.equal(clicNavigationInterne({ ...clic, ctrlKey: true }), false);
    assert.equal(clicNavigationInterne({ ...clic, metaKey: true }), false);
    assert.equal(clicNavigationInterne({ ...clic, button: 1 }), false);
    assert.equal(clicNavigationInterne({ ...clic, defaultPrevented: true }), false);
  });
});
