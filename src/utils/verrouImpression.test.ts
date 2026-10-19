import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { definirVerrouImpression, impressionAutorisee, motifVerrouImpression, onVerrouImpressionChange } from './verrouImpression';
import { printDocument } from './printDocument';

/** Faux `document` / `window` minimaux : la garde doit empêcher tout appel à `window.print`. */
function avecNavigateurFactice<T>(action: (journal: string[]) => T): T {
  const journal: string[] = [];
  const g = globalThis as unknown as { document?: unknown; window?: unknown };
  const avantDocument = g.document;
  const avantWindow = g.window;
  const attributs = new Map<string, string>();
  g.document = {
    title: 'AcademiaBlanc',
    body: {
      setAttribute: (nom: string, valeur: string) => { attributs.set(nom, valeur); journal.push(`attr:${nom}=${valeur}`); },
      removeAttribute: (nom: string) => { attributs.delete(nom); },
    },
  };
  g.window = {
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    print: () => { journal.push('print'); },
  };
  try {
    return action(journal);
  } finally {
    g.document = avantDocument;
    g.window = avantWindow;
  }
}

describe('garde d’impression posée par l’état d’abonnement', () => {
  afterEach(() => definirVerrouImpression(false));

  it('autorise par défaut, puis refuse avec un motif quand l’espace est en lecture seule', () => {
    assert.equal(impressionAutorisee(), true);
    definirVerrouImpression(true, 'Abonnement expiré.');
    assert.equal(impressionAutorisee(), false);
    assert.equal(motifVerrouImpression(), 'Abonnement expiré.');
    definirVerrouImpression(false);
    assert.equal(impressionAutorisee(), true);
    assert.equal(motifVerrouImpression(), '');
  });

  it('prévient ses abonnés à chaque changement, pas quand rien ne change', () => {
    let appels = 0;
    const stop = onVerrouImpressionChange(() => { appels += 1; });
    definirVerrouImpression(true, 'x');
    definirVerrouImpression(true, 'x');
    definirVerrouImpression(false);
    stop();
    definirVerrouImpression(true, 'y');
    assert.equal(appels, 2);
  });

  it('printDocument ne déclenche pas window.print quand la garde est active', () => {
    avecNavigateurFactice((journal) => {
      definirVerrouImpression(true, 'Abonnement expiré.');
      assert.equal(printDocument('registre', 'PV test'), false);
      assert.deepEqual(journal, []);
      definirVerrouImpression(false);
      assert.equal(printDocument('registre', 'PV test'), true);
      assert.deepEqual(journal, ['attr:data-print-mode=registre', 'print']);
    });
  });
});
