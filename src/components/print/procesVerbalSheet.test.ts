import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const racine = dirname(fileURLToPath(import.meta.url));
const lire = (...chemin: string[]) => readFileSync(join(racine, ...chemin), 'utf8');

describe('procès-verbal imprimé : gabarit commun décoré', () => {
  it('la feuille du PV repose sur le gabarit paysage et son en-tête commun, avec emplacement de logo réservé', () => {
    const feuille = lire('ProcesVerbalSheet.tsx');
    assert.match(feuille, /className="document-paysage pv-sheet"/);
    assert.match(feuille, /<EnTeteDocument[\s\S]*emplacementLogo/);
    assert.match(feuille, /document-paysage-table pv-table/);
    assert.match(feuille, /<PiedDocument/);
    // Colonne « Établissement d'origine » seulement en inter-établissements.
    assert.match(feuille, /\{sessionInter && <th>Établissement d'origine<\/th>\}/);
    // Signatures : président du jury puis chef (d'établissement ou du centre) ; mention de verrouillage conditionnelle.
    assert.match(feuille, /TITRE_PRESIDENT_JURY/);
    assert.match(feuille, /TITRE_CHEF_CENTRE/);
    assert.match(feuille, /titreChefDepuisSettings/);
    assert.match(feuille, /\{juryLocked && \(/);
  });

  it("l'écran du PV délègue la feuille imprimée au composant et n'a plus de gabarit portrait", () => {
    const ecran = lire('..', 'RecordsView.tsx');
    assert.match(ecran, /<ProcesVerbalSheet/);
    assert.match(ecran, /printDocument\('registre'/);
    assert.doesNotMatch(ecran, /registre-sheet|registre-table|registre-signature/);
  });

  it("l'en-tête commun sait réserver l'emplacement du logo sans image", () => {
    const entete = lire('EnTeteDocument.tsx');
    assert.match(entete, /emplacementLogo/);
    assert.match(entete, /document-paysage-logo-vide/);
  });

  it('les styles : feuille du PV en paysage sous le mode « registre », anciens styles portrait supprimés', () => {
    const css = lire('..', '..', 'index.css');
    assert.match(css, /body\[data-print-mode='registre'\] \.pv-sheet \{\s*display: block !important;/);
    assert.match(css, /body\[data-print-mode='registre'\] \.pv-ui,/);
    assert.doesNotMatch(css, /\.registre-/);
    for (const classe of ['.pv-rang-or', '.pv-rang-argent', '.pv-rang-bronze', '.pv-mention-tres-bien', '.pv-mention-ajourne', '.pv-decision-admis', '.pv-stats', '.pv-signature', '.document-paysage-logo-vide']) {
      assert.ok(css.includes(classe), `${classe} doit être stylé`);
    }
  });
});
