import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cleLocale, clesAPurger, espaceLocal, parametresDepuisServeur, parametresInitiauxConnecte } from './espaceConnecte';
import type { AuthSession } from './client';
import type { ProfilEtablissement } from './etablissement';
import { DEFAULT_LOGO_URL, DEFAULT_SETTINGS, TOGO_SETTINGS } from '../data/mockData';

const SESSION_A: AuthSession = {
  token: 'jeton-a', utilisateurId: 10, etablissementId: 7, role: 'OWNER', nomEtablissement: 'Lycée de Kara', email: 'a@kara.tg',
};
const SESSION_B: AuthSession = {
  token: 'jeton-b', utilisateurId: 22, etablissementId: 9, role: 'OWNER', nomEtablissement: 'Collège de Sokodé', email: 'b@sokode.tg',
};

const PROFIL_A: ProfilEtablissement = {
  id: 7, nom: 'Lycée de Kara', code: 'LK-01', typeEtablissement: null, ville: 'Kara', region: null, adresse: null,
  telephone: null, email: 'a@kara.tg', nomResponsable: 'M. Kodjo', devise: 'Travail – Rigueur', actif: true, creeLe: null,
  enTete: { republique: 'République Togolaise', deviseNationale: 'Travail – Liberté – Patrie', ministere: 'Ministère des Enseignements', sigleMinistere: 'MEPST', autoriteRegionale: '', piedDePage: '', prereglageNationalId: 1 },
};

const VIDE = { academicYear: '', sessionName: '', examTypeLong: '' };

describe('session connectée : l’état vient du serveur, jamais de la démonstration ni du compte précédent', () => {
  it('avant le chargement de l’espace, aucun libellé ni image de démonstration', () => {
    const initiaux = parametresInitiauxConnecte(SESSION_A);
    assert.equal(initiaux.institutionName, 'Lycée de Kara');
    assert.equal(initiaux.logoUrl, '');
    assert.equal(initiaux.sealUrl, '');
    assert.equal(initiaux.academicYear, '');
    assert.equal(initiaux.sessionName, '');
    assert.equal(initiaux.examType, '');
    assert.equal(initiaux.jurySignerName, '');
    assert.notEqual(initiaux.academicYear, TOGO_SETTINGS.academicYear);
  });

  it('un établissement sans session ni charte lisible n’affiche pas l’année, la session ni le signataire de démonstration', () => {
    const params = parametresDepuisServeur({ session: SESSION_A, workspace: VIDE, charte: null, profil: null });
    assert.equal(params.institutionName, 'Lycée de Kara');
    assert.equal(params.academicYear, '');
    assert.equal(params.sessionName, '');
    assert.equal(params.examType, '');
    assert.equal(params.jurySignerName, '');
    assert.equal(params.institutionMotto, '');
    assert.equal(params.logoUrl, '');
    assert.equal(params.sealUrl, '');
    // Les valeurs par défaut du logiciel (titre du signataire, numérotation) restent disponibles.
    assert.equal(params.jurySignerTitle, DEFAULT_SETTINGS.jurySignerTitle);
  });

  it('les libellés de la session chargée, la fiche et la charte font foi', () => {
    const params = parametresDepuisServeur({
      session: SESSION_A,
      workspace: { academicYear: '2025-2026', sessionName: 'BEPC blanc n°1', examTypeLong: 'Brevet d’Études du Premier Cycle' },
      charte: { logoUrl: 'data:image/png;base64,AAA', sceauUrl: null, signatureProviseurUrl: null, signatureTitulaireUrl: null, sceauOfficielUrl: '', titreSignataireJury: 'Le Directeur', premierNumeroTable: 1, numerotationAutomatique: false },
      profil: PROFIL_A,
    });
    assert.equal(params.academicYear, '2025-2026');
    assert.equal(params.sessionName, 'BEPC blanc n°1');
    assert.equal(params.examType, 'Brevet d’Études du Premier Cycle');
    assert.equal(params.jurySignerName, 'M. Kodjo');
    assert.equal(params.jurySignerTitle, 'Le Directeur');
    assert.equal(params.institutionMotto, 'Travail – Rigueur');
    assert.equal(params.ministrySigle, 'MEPST');
    assert.equal(params.logoUrl, 'data:image/png;base64,AAA');
    assert.equal(params.startTableNumber, 1);
    assert.equal(params.autoAssignTables, false);
  });

  it('le résultat ne dépend pas de l’état précédent : compte B après compte A, même sans charte ni fiche', () => {
    const apresA = parametresDepuisServeur({
      session: SESSION_A,
      workspace: { academicYear: '2025-2026', sessionName: 'BEPC blanc n°1', examTypeLong: 'BEPC' },
      charte: { logoUrl: 'data:image/png;base64,LOGO-A', sceauUrl: null, signatureProviseurUrl: null, signatureTitulaireUrl: null, sceauOfficielUrl: null },
      profil: PROFIL_A,
    });
    const pourB = parametresDepuisServeur({ session: SESSION_B, workspace: VIDE, charte: null, profil: null });
    assert.equal(pourB.institutionName, 'Collège de Sokodé');
    assert.notEqual(pourB.logoUrl, apresA.logoUrl);
    assert.equal(pourB.logoUrl, '');
    assert.equal(pourB.jurySignerName, '');
    assert.equal(pourB.academicYear, '');
    assert.equal(pourB.institutionMotto, '');
    // Reproductible : la fonction est pure, deux appels identiques donnent le même résultat.
    assert.deepEqual(pourB, parametresDepuisServeur({ session: SESSION_B, workspace: VIDE, charte: null, profil: null }));
    assert.notEqual(pourB.logoUrl, DEFAULT_LOGO_URL);
  });
});

describe('préférences locales cloisonnées par établissement', () => {
  it('la clé du verrou du procès-verbal change d’un établissement à l’autre et diffère de la démonstration', () => {
    const demo = cleLocale('jury_lock', null, 'school_tokoin');
    const a = cleLocale('jury_lock', SESSION_A, 'school_tokoin');
    const b = cleLocale('jury_lock', SESSION_B, 'school_tokoin');
    assert.equal(demo, 'academiablanc_jury_lock_school_tokoin');
    assert.equal(a, 'academiablanc_jury_lock_etab_7');
    assert.equal(b, 'academiablanc_jury_lock_etab_9');
    assert.notEqual(a, b);
    // Compte plateforme sans établissement : cloisonné par utilisateur.
    assert.equal(espaceLocal({ ...SESSION_A, etablissementId: null }, 'school_tokoin'), 'utilisateur_10');
  });

  it('à la déconnexion, seules les clés du compte sont purgées ; la démonstration reste intacte', () => {
    const cles = [
      'academiablanc_jury_lock_etab_7',
      'academiablanc_filtre_utilisateur_10',
      'academiablanc_jury_lock_etab_9',
      'academiablanc_jury_lock_school_tokoin',
      'academiablanc_school_data_school_tokoin',
      'academiablanc_schools_registry_v1',
      'autre_appli_etab_7',
    ];
    assert.deepEqual(clesAPurger(cles, SESSION_A).sort(), ['academiablanc_filtre_utilisateur_10', 'academiablanc_jury_lock_etab_7']);
    assert.deepEqual(clesAPurger(cles, null), []);
  });
});
