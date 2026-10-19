import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  badgeAbonnement,
  csvPaiements,
  formatDateFr,
  formatFcfa,
  lienTel,
  lienWhatsApp,
  messageVerrou,
  messageWhatsApp,
  tarifAffiche,
  tarifDuForfait,
} from './abonnement';
import type { EtatAbonnement, EvenementAbonnement } from './abonnement';

const CONTACTS = {
  telWhatsapp: '+228 90 00 00 00', telAppel: '+228 70 00 00 00', beneficiaire: 'AcademiaBlanc', instructions: '',
  tarifMensuel: 15000, tarifAnnuel: 150000, devise: 'FCFA',
};

const etat = (partiel: Partial<EtatAbonnement>): EtatAbonnement => ({
  etablissementId: 7, statut: 'ACTIF', statutLibelle: 'Actif', forfait: 'MENSUEL', forfaitChoisi: 'MENSUEL',
  debut: '2026-10-19T10:00:00Z', fin: '2026-11-19T10:00:00Z', echeance: '2026-11-22T10:00:00Z', essaiJusquAu: null,
  joursRestants: 34, enGrace: false, lectureSeule: false, acces: true, essai: false, plateforme: false, message: null,
  contacts: CONTACTS, maintenant: '2026-10-19T10:00:00Z', ...partiel,
});

describe('badge d’abonnement : couleur selon les jours restants renvoyés par le serveur', () => {
  it('essai : vert avec « Essai — J-12 », rouge les 3 derniers jours', () => {
    const vert = badgeAbonnement(etat({ statut: 'ESSAI', essai: true, forfait: null, joursRestants: 12 }));
    assert.equal(vert?.libelle, 'Essai — J-12');
    assert.equal(vert?.ton, 'vert');
    assert.equal(badgeAbonnement(etat({ statut: 'ESSAI', essai: true, joursRestants: 4 }))?.ton, 'vert');
    const rouge = badgeAbonnement(etat({ statut: 'ESSAI', essai: true, joursRestants: 3 }));
    assert.equal(rouge?.ton, 'rouge');
    assert.equal(rouge?.libelle, 'Essai — J-3');
    assert.equal(badgeAbonnement(etat({ statut: 'ESSAI', essai: true, joursRestants: 0 }))?.libelle, 'Essai — J-0');
  });

  it('actif : discret, « Abonnement jusqu’au 22/11/2026 », orange à J-7, rouge à J-3', () => {
    const neutre = badgeAbonnement(etat({ joursRestants: 34 }));
    assert.equal(neutre?.libelle, "Abonnement jusqu'au 22/11/2026");
    assert.equal(neutre?.ton, 'neutre');
    assert.equal(badgeAbonnement(etat({ joursRestants: 8 }))?.ton, 'neutre');
    assert.equal(badgeAbonnement(etat({ joursRestants: 7 }))?.ton, 'orange');
    assert.equal(badgeAbonnement(etat({ joursRestants: 4 }))?.ton, 'orange');
    assert.equal(badgeAbonnement(etat({ joursRestants: 3 }))?.ton, 'rouge');
    assert.equal(badgeAbonnement(etat({ joursRestants: 0 }))?.ton, 'rouge');
  });

  it('période de grâce signalée, expiré / suspendu en rouge, attente en orange, rien pour la plateforme', () => {
    assert.match(badgeAbonnement(etat({ joursRestants: 2, enGrace: true }))?.libelle ?? '', /période de grâce/);
    assert.equal(badgeAbonnement(etat({ statut: 'EXPIRE', lectureSeule: true, joursRestants: -1 }))?.ton, 'rouge');
    assert.equal(badgeAbonnement(etat({ statut: 'SUSPENDU', lectureSeule: true }))?.ton, 'rouge');
    assert.equal(badgeAbonnement(etat({ statut: 'EN_ATTENTE_PAIEMENT', lectureSeule: true, acces: false }))?.ton, 'orange');
    assert.equal(badgeAbonnement(etat({ plateforme: true })), null);
    assert.equal(badgeAbonnement(null), null);
  });

  it('bandeau rouge uniquement en lecture seule', () => {
    assert.equal(messageVerrou(etat({})), null);
    assert.equal(messageVerrou(etat({ statut: 'EXPIRE', lectureSeule: true })), 'Abonnement expiré — réglez pour réactiver.');
    assert.match(messageVerrou(etat({ statut: 'SUSPENDU', lectureSeule: true })) ?? '', /suspendu/);
    assert.equal(messageVerrou(etat({ plateforme: true, lectureSeule: true })), null);
  });
});

describe('montants et dates', () => {
  it('formate en FCFA avec séparateur de milliers et « Tarif à confirmer » pour 0', () => {
    assert.equal(formatFcfa(15000), '15\u202f000\u00a0FCFA');
    assert.equal(formatFcfa(150000), '150\u202f000\u00a0FCFA');
    assert.equal(tarifAffiche(0), 'Tarif à confirmer');
    assert.equal(tarifAffiche(null), 'Tarif à confirmer');
    assert.equal(tarifAffiche(15000), '15\u202f000\u00a0FCFA');
    assert.equal(tarifDuForfait('ANNUEL', CONTACTS), 150000);
    assert.equal(tarifDuForfait('MENSUEL', CONTACTS), 15000);
    assert.equal(tarifDuForfait(null, CONTACTS), 0);
  });

  it('les dates sont lues en UTC comme le serveur', () => {
    assert.equal(formatDateFr('2026-11-22T23:30:00Z'), '22/11/2026');
    assert.equal(formatDateFr(null), '');
    assert.equal(formatDateFr('n’importe quoi'), '');
  });
});

describe('contacts WhatsApp et appel', () => {
  it('construit un message pré-rempli avec le nom, le forfait et le montant', () => {
    const message = messageWhatsApp({ nomEtablissement: 'Lycée de Kara', forfait: 'ANNUEL', montant: 150000 });
    assert.match(message, /Lycée de Kara/);
    assert.match(message, /abonnement annuel/);
    assert.match(message, /150\u202f000\u00a0FCFA/);
    assert.match(messageWhatsApp({ nomEtablissement: 'X', forfait: null, montant: 0 }), /montant à confirmer/);
  });

  it('lien wa.me avec le numéro réduit à ses chiffres et le texte encodé', () => {
    const lien = lienWhatsApp('+228 90 00 00 00', 'Bonjour & merci');
    assert.equal(lien, 'https://wa.me/22890000000?text=Bonjour%20%26%20merci');
    assert.equal(lienWhatsApp('', 'x'), null);
    assert.equal(lienWhatsApp('12', 'x'), null);
  });

  it('lien tel: conserve l’indicatif international', () => {
    assert.equal(lienTel('+228 70 00 00 00'), 'tel:+22870000000');
    assert.equal(lienTel('90 00 00 00'), 'tel:90000000');
    assert.equal(lienTel(''), null);
  });
});

describe('export CSV des paiements', () => {
  it('une ligne par événement, séparateur « ; », BOM et guillemets échappés', () => {
    const evenements: EvenementAbonnement[] = [{
      id: 1, etablissementId: 7, etablissementNom: 'Lycée "Central"; Lomé', type: 'ACTIVATION', typeLibelle: 'Activation',
      forfait: 'MENSUEL', montant: 15000, reference: 'TM-1', operateurMobile: 'T-Money', periodeDebut: '2026-10-19T10:00:00Z',
      periodeFin: '2026-11-19T10:00:00Z', acteur: 'proprio@logiciel.tg', note: null, statut: null, creeLe: '2026-10-19T10:05:00Z',
    }, {
      id: 2, etablissementId: 7, etablissementNom: 'Lycée', type: 'DECLARATION_PAIEMENT', typeLibelle: 'Déclaration de paiement',
      montant: 9000, operateurMobile: 'Wave', statut: 'A_VERIFIER', creeLe: '2026-10-20T08:00:00Z',
    }];
    const csv = csvPaiements(evenements);
    const lignes = csv.split('\n');
    assert.ok(lignes[0].startsWith('\uFEFFDate;Établissement;Type;Forfait;Montant (FCFA)'));
    assert.equal(lignes.length, 3);
    assert.match(lignes[1], /^19\/10\/2026 10:05 UTC;"Lycée ""Central""; Lomé";Activation;Mensuel;15000;TM-1;T-Money;19\/10\/2026;19\/11\/2026;;proprio@logiciel.tg;$/);
    assert.match(lignes[2], /Déclaration de paiement;;9000;;Wave;;;À vérifier;;/);
  });
});
