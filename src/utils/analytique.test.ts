import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  completerSerie,
  decalerMois,
  echelleGraphique,
  formatDateUtc,
  formatEntier,
  formatFcfa,
  formatHorodatageUtc,
  formatTaux,
  formatVariation,
  hauteurPct,
  initialeMois,
  libelleMoisCourt,
  libelleMoisLong,
  moisDepuisInstant,
  moisGlissants,
  resumerRevenus,
  totaliserRevenus,
  variationPct,
} from './analytique';

const FINE = '\u202f';
const NBSP = '\u00a0';

describe('analytique : formatage des montants en FCFA', () => {
  it('sépare les milliers par une espace fine et ajoute l’unité', () => {
    assert.equal(formatEntier(0), '0');
    assert.equal(formatEntier(999), '999');
    assert.equal(formatEntier(1000), `1${FINE}000`);
    assert.equal(formatEntier(1234567), `1${FINE}234${FINE}567`);
    assert.equal(formatEntier(-45000), `-45${FINE}000`);
    assert.equal(formatEntier(2500.6), `2${FINE}501`);
    assert.equal(formatFcfa(1250000), `1${FINE}250${FINE}000${NBSP}FCFA`);
    assert.equal(formatFcfa(0), `0${NBSP}FCFA`);
  });

  it('n’invente aucune valeur : null, undefined ou NaN donnent « — »', () => {
    assert.equal(formatFcfa(null), '—');
    assert.equal(formatFcfa(undefined), '—');
    assert.equal(formatFcfa(Number.NaN), '—');
    assert.equal(formatEntier(null), '—');
  });
});

describe('analytique : variation en pourcentage', () => {
  it('calcule la variation relative arrondie au dixième', () => {
    assert.equal(variationPct(150000, 100000), 50);
    assert.equal(variationPct(90000, 100000), -10);
    assert.equal(variationPct(100000, 100000), 0);
    assert.equal(variationPct(1, 3), -66.7);
    assert.equal(variationPct(0, 50000), -100);
  });

  it('est indéfinie quand la base est nulle (pas de « +∞ % »)', () => {
    assert.equal(variationPct(25000, 0), null);
    assert.equal(variationPct(0, 0), null);
  });

  it('se formate avec le signe typographique et une virgule décimale', () => {
    assert.equal(formatVariation(50), `+50${NBSP}%`);
    assert.equal(formatVariation(-10), `−10${NBSP}%`);
    assert.equal(formatVariation(-66.7), `−66,7${NBSP}%`);
    assert.equal(formatVariation(0), `0${NBSP}%`);
    assert.equal(formatVariation(null), '—');
    assert.equal(formatTaux(12.345), `12,3${NBSP}%`);
    assert.equal(formatTaux(0), `0${NBSP}%`);
    assert.equal(formatTaux(null), '—');
  });
});

describe('analytique : génération des libellés de mois', () => {
  it('produit les 12 mois glissants se terminant par le mois courant', () => {
    assert.deepEqual(moisGlissants('2026-10', 12), [
      '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04',
      '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10',
    ]);
    assert.deepEqual(moisGlissants('2026-01', 3), ['2025-11', '2025-12', '2026-01']);
    assert.deepEqual(moisGlissants('2026-01', 0), []);
  });

  it('décale les mois en franchissant les années', () => {
    assert.equal(decalerMois('2026-01', -1), '2025-12');
    assert.equal(decalerMois('2026-12', 1), '2027-01');
    assert.equal(decalerMois('2026-03', -27), '2023-12');
    assert.throws(() => decalerMois('2026-13', 0));
    assert.throws(() => decalerMois('oct 2026', 0));
  });

  it('dérive le mois civil UTC d’un instant et libelle en français', () => {
    assert.equal(moisDepuisInstant('2026-10-19T12:00:00Z'), '2026-10');
    assert.equal(moisDepuisInstant('2026-10-31T23:59:59Z'), '2026-10');
    assert.equal(moisDepuisInstant('2026-11-01T00:00:00Z'), '2026-11');
    assert.equal(libelleMoisCourt('2026-10'), 'oct.');
    assert.equal(libelleMoisCourt('2026-01', true), 'janv. 26');
    assert.equal(libelleMoisCourt('2025-08'), 'août');
    assert.equal(libelleMoisLong('2026-02'), 'février 2026');
    assert.equal(initialeMois('2026-02'), 'F');
    assert.equal(initialeMois('2025-08'), 'A');
    assert.equal(formatHorodatageUtc('2026-10-19T12:05:00Z'), '19/10/2026 à 12:05 UTC');
    assert.equal(formatHorodatageUtc('n’importe quoi'), '—');
    assert.equal(formatDateUtc('2026-09-03T23:30:00Z'), '03/09/2026');
  });
});

describe('analytique : échelle du graphique', () => {
  it('choisit un pas rond (1, 2, 5 × 10ⁿ) et un plafond multiple du pas', () => {
    assert.deepEqual(echelleGraphique(3), { plafond: 3, graduations: [0, 1, 2, 3] });
    assert.deepEqual(echelleGraphique(7), { plafond: 8, graduations: [0, 2, 4, 6, 8] });
    assert.deepEqual(echelleGraphique(12), { plafond: 15, graduations: [0, 5, 10, 15] });
    assert.deepEqual(echelleGraphique(48), { plafond: 50, graduations: [0, 10, 20, 30, 40, 50] });
    assert.deepEqual(echelleGraphique(100), { plafond: 100, graduations: [0, 20, 40, 60, 80, 100] });
    assert.deepEqual(echelleGraphique(1), { plafond: 1, graduations: [0, 1] });
  });

  it('retombe sur 0–1 sans division par zéro pour une série vide', () => {
    assert.deepEqual(echelleGraphique(0), { plafond: 1, graduations: [0, 1] });
    assert.deepEqual(echelleGraphique(-4), { plafond: 1, graduations: [0, 1] });
    assert.equal(hauteurPct(0, echelleGraphique(0)), 0);
  });

  it('convertit une valeur en hauteur relative bornée à 100 %', () => {
    const echelle = echelleGraphique(48);
    assert.equal(hauteurPct(25, echelle), 50);
    assert.equal(hauteurPct(50, echelle), 100);
    assert.equal(hauteurPct(75, echelle), 100);
    assert.equal(hauteurPct(0, echelle), 0);
  });
});

describe('analytique : revenus par période et comparaison', () => {
  const serie = [
    { mois: '2026-05', declares: 0, nbDeclarations: 0, confirmes: 0, nbConfirmations: 0 },
    { mois: '2026-06', declares: 0, nbDeclarations: 0, confirmes: 0, nbConfirmations: 0 },
    { mois: '2026-07', declares: 0, nbDeclarations: 0, confirmes: 0, nbConfirmations: 0 },
    { mois: '2026-08', declares: 15000, nbDeclarations: 1, confirmes: 180000, nbConfirmations: 3 },
    { mois: '2026-09', declares: 165000, nbDeclarations: 2, confirmes: 315000, nbConfirmations: 3 },
    { mois: '2026-10', declares: 180000, nbDeclarations: 3, confirmes: 30000, nbConfirmations: 2 },
  ];

  it('mois courant comparé au mois précédent', () => {
    const r = resumerRevenus(serie, 'mois-courant', '2026-10');
    assert.deepEqual(r.mois, ['2026-10']);
    assert.deepEqual(r.moisReference, ['2026-09']);
    assert.equal(r.libelle, 'octobre 2026');
    assert.equal(r.libelleReference, 'septembre 2026');
    assert.deepEqual(r.total, { declares: 180000, nbDeclarations: 3, confirmes: 30000, nbConfirmations: 2 });
    assert.deepEqual(r.reference, { declares: 165000, nbDeclarations: 2, confirmes: 315000, nbConfirmations: 3 });
    assert.equal(r.variationDeclares, 9.1);
    assert.equal(r.variationConfirmes, -90.5);
  });

  it('mois précédent comparé à celui d’avant', () => {
    const r = resumerRevenus(serie, 'mois-precedent', '2026-10');
    assert.deepEqual(r.mois, ['2026-09']);
    assert.deepEqual(r.moisReference, ['2026-08']);
    assert.equal(r.total.declares, 165000);
    assert.equal(r.reference.declares, 15000);
    assert.equal(r.variationDeclares, 1000);
    assert.equal(r.variationConfirmes, 75);
  });

  it('3 derniers mois comparés aux 3 précédents, variation indéfinie sans base', () => {
    const r = resumerRevenus(serie, '3-mois', '2026-10');
    assert.deepEqual(r.mois, ['2026-08', '2026-09', '2026-10']);
    assert.deepEqual(r.moisReference, ['2026-05', '2026-06', '2026-07']);
    assert.equal(r.libelle, 'août 2026 → octobre 2026');
    assert.deepEqual(r.total, { declares: 360000, nbDeclarations: 6, confirmes: 525000, nbConfirmations: 8 });
    assert.deepEqual(r.reference, { declares: 0, nbDeclarations: 0, confirmes: 0, nbConfirmations: 0 });
    assert.equal(r.variationDeclares, null);
    assert.equal(r.variationConfirmes, null);
  });

  it('un mois absent de la série vaut 0', () => {
    assert.deepEqual(totaliserRevenus(serie, ['2025-01', '2026-10']), { declares: 180000, nbDeclarations: 3, confirmes: 30000, nbConfirmations: 2 });
    assert.deepEqual(totaliserRevenus([], ['2026-10']), { declares: 0, nbDeclarations: 0, confirmes: 0, nbConfirmations: 0 });
  });
});

describe('analytique : série complétée sur 12 mois', () => {
  it('comble les mois absents à 0 en reportant le cumul', () => {
    const serie = completerSerie([
      { mois: '2026-08', inscriptions: 3, cumul: 12 },
      { mois: '2026-10', inscriptions: 2, cumul: 14 },
    ], '2026-10', 4);
    assert.deepEqual(serie, [
      { mois: '2026-07', inscriptions: 0, cumul: 0 },
      { mois: '2026-08', inscriptions: 3, cumul: 12 },
      { mois: '2026-09', inscriptions: 0, cumul: 12 },
      { mois: '2026-10', inscriptions: 2, cumul: 14 },
    ]);
    assert.equal(completerSerie([], '2026-10').length, 12);
  });
});
