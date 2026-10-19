import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DUREE_ESSAI_DEFAUT_JOURS,
  OFFRE_INCONNUE,
  chiffresNumero,
  economieAnnuelle,
  formatMontant,
  lienAppel,
  lienWhatsapp,
  parseOffrePublique,
} from './offrePublique.ts';

describe('parseOffrePublique', () => {
  it('lit la réponse de GET /api/public/offre', () => {
    const offre = parseOffrePublique({
      tarifMensuel: 15000,
      tarifAnnuel: 150000,
      devise: 'FCFA',
      telWhatsapp: '+228 90 00 00 00',
      telAppel: '+228 22 00 00 00',
      beneficiaire: 'AcademiaBlanc',
      instructions: 'Flooz / T-Money',
      dureeEssaiJours: 14,
    });
    assert.deepEqual(offre, {
      tarifMensuel: 15000,
      tarifAnnuel: 150000,
      devise: 'FCFA',
      telWhatsapp: '+228 90 00 00 00',
      telAppel: '+228 22 00 00 00',
      dureeEssaiJours: 14,
    });
  });

  it('ne retient aucun prix tant que la plateforme n’a pas saisi de tarif (0, négatif, absent)', () => {
    const offre = parseOffrePublique({ tarifMensuel: 0, tarifAnnuel: -5, telWhatsapp: '  ', dureeEssaiJours: 30 });
    assert.equal(offre?.tarifMensuel, null);
    assert.equal(offre?.tarifAnnuel, null);
    assert.equal(offre?.telWhatsapp, null);
    assert.equal(offre?.telAppel, null);
    assert.equal(offre?.devise, 'FCFA');
    assert.equal(offre?.dureeEssaiJours, 30);
  });

  it('accepte des montants sous forme de chaîne et retombe sur 14 jours d’essai', () => {
    const offre = parseOffrePublique({ prixMensuel: '12 500', prixAnnuel: '120000', monnaie: 'XOF' });
    assert.equal(offre?.tarifMensuel, 12500);
    assert.equal(offre?.tarifAnnuel, 120000);
    assert.equal(offre?.devise, 'XOF');
    assert.equal(offre?.dureeEssaiJours, DUREE_ESSAI_DEFAUT_JOURS);
  });

  it('renvoie null pour une réponse qui n’est pas un objet', () => {
    assert.equal(parseOffrePublique(null), null);
    assert.equal(parseOffrePublique([]), null);
    assert.equal(parseOffrePublique('offre'), null);
  });

  it('l’offre inconnue n’annonce ni prix ni numéro', () => {
    assert.equal(OFFRE_INCONNUE.tarifMensuel, null);
    assert.equal(OFFRE_INCONNUE.tarifAnnuel, null);
    assert.equal(OFFRE_INCONNUE.telWhatsapp, null);
    assert.equal(OFFRE_INCONNUE.dureeEssaiJours, 14);
  });
});

describe('formatMontant et economieAnnuelle', () => {
  it('sépare les milliers à la française', () => {
    assert.equal(formatMontant(15000, 'FCFA'), '15\u202f000\u00a0FCFA');
    assert.equal(formatMontant(950, 'FCFA'), '950\u00a0FCFA');
    assert.equal(formatMontant(1250000, 'FCFA'), '1\u202f250\u202f000\u00a0FCFA');
  });

  it('calcule l’économie de l’annuel sur douze mensualités', () => {
    assert.equal(economieAnnuelle({ tarifMensuel: 15000, tarifAnnuel: 150000 }), 30000);
    assert.equal(economieAnnuelle({ tarifMensuel: 10000, tarifAnnuel: 120000 }), null);
    assert.equal(economieAnnuelle({ tarifMensuel: null, tarifAnnuel: 150000 }), null);
  });
});

describe('liens de contact', () => {
  it('normalise les numéros saisis librement', () => {
    assert.equal(chiffresNumero('+228 90 00 00 00'), '22890000000');
    assert.equal(chiffresNumero('00225 07 00 00 00 00'), '2250700000000');
    assert.equal(chiffresNumero('90 00 00 00'), '90000000');
  });

  it('construit le lien WhatsApp avec message facultatif', () => {
    assert.equal(lienWhatsapp('+228 90 00 00 00'), 'https://wa.me/22890000000');
    assert.equal(lienWhatsapp('+228 90 00 00 00', 'Bonjour'), 'https://wa.me/22890000000?text=Bonjour');
    assert.equal(lienWhatsapp(null), null);
    assert.equal(lienWhatsapp('12'), null);
  });

  it('construit le lien tel: en conservant l’indicatif international', () => {
    assert.equal(lienAppel('+228 22 00 00 00'), 'tel:+22822000000');
    assert.equal(lienAppel('00228 22 00 00 00'), 'tel:+22822000000');
    assert.equal(lienAppel('22 00 00 00'), 'tel:22000000');
    assert.equal(lienAppel(null), null);
  });
});
