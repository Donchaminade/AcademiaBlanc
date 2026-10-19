import { apiGet, apiSend } from './client';
import { AppSettings } from '../types';

/**
 * Charte du bulletin portée par l'établissement du jeton (GET/PUT /api/etablissement/charte) :
 * cachet et signatures téléversés, puis paramètres d'affichage de l'écran Paramètres (logo, sceau
 * officiel, signataires, numérotation des tables). `null` = jamais renseigné sur le serveur : le client
 * conserve alors sa valeur par défaut. L'en-tête officiel (république, devise, ministère) est porté par la
 * fiche de l'établissement (`PUT /api/etablissement/en-tete`), pas par la charte.
 */
export interface CharteEtablissement {
  sceauUrl: string | null;
  signatureProviseurUrl: string | null;
  signatureTitulaireUrl: string | null;
  logoUrl?: string | null;
  /** Chaîne vide = emplacement volontairement laissé vierge (tampon manuel), à ne pas confondre avec `null`. */
  sceauOfficielUrl?: string | null;
  titreSignataireJury?: string | null;
  nomSignataireJury?: string | null;
  titreTitulaire?: string | null;
  nomTitulaire?: string | null;
  premierNumeroTable?: number | null;
  numerotationAutomatique?: boolean | null;
}

export const CHARTE_FIELDS = ['sceauUrl', 'signatureProviseurUrl', 'signatureTitulaireUrl'] as const;
export type CharteField = (typeof CHARTE_FIELDS)[number];

/**
 * Paramètres enregistrés dans la charte en session connectée. Les autres champs d'`AppSettings`
 * viennent de l'en-tête de l'établissement (république, devise, ministère, sigle…) ou de la session
 * chargée (nom de l'établissement, année, session, type d'examen).
 */
export const PARAMETRES_PERSISTES = [
  ...CHARTE_FIELDS,
  'logoUrl', 'sealUrl',
  'jurySignerTitle', 'jurySignerName', 'principalTeacherTitle', 'principalTeacherName',
  'startTableNumber', 'autoAssignTables',
] as const satisfies readonly (keyof AppSettings)[];
export type ParametrePersiste = (typeof PARAMETRES_PERSISTES)[number];

export function loadCharte(): Promise<CharteEtablissement> {
  return apiGet<CharteEtablissement>('/api/etablissement/charte');
}

/** Corps envoyé au serveur : tout paramètre persisté, les images vides devenant `null` (emplacement libre). */
export function versCharte(settings: Pick<AppSettings, ParametrePersiste>): CharteEtablissement {
  return {
    sceauUrl: settings.sceauUrl || null,
    signatureProviseurUrl: settings.signatureProviseurUrl || null,
    signatureTitulaireUrl: settings.signatureTitulaireUrl || null,
    logoUrl: settings.logoUrl || null,
    // Le sceau officiel vide est un choix (zone vierge) : il part en chaîne vide, pas en null.
    sceauOfficielUrl: settings.sealUrl ?? '',
    titreSignataireJury: settings.jurySignerTitle || null,
    nomSignataireJury: settings.jurySignerName || null,
    titreTitulaire: settings.principalTeacherTitle || null,
    nomTitulaire: settings.principalTeacherName || null,
    premierNumeroTable: Number.isFinite(settings.startTableNumber) ? settings.startTableNumber : null,
    numerotationAutomatique: settings.autoAssignTables,
  };
}

export function saveCharte(settings: Pick<AppSettings, ParametrePersiste>): Promise<CharteEtablissement> {
  return apiSend<CharteEtablissement>('/api/etablissement/charte', 'PUT', versCharte(settings));
}

/** Vrai si au moins un paramètre persisté diffère entre deux jeux de paramètres. */
export function charteChanged(before: AppSettings, after: AppSettings): boolean {
  return PARAMETRES_PERSISTES.some((field) => (before[field] ?? '') !== (after[field] ?? ''));
}

/** Applique la charte reçue de l'API aux paramètres : image null → emplacement vide, texte null → valeur locale conservée. */
export function applyCharte(settings: AppSettings, charte: CharteEtablissement): AppSettings {
  return {
    ...settings,
    sceauUrl: charte.sceauUrl || '',
    signatureProviseurUrl: charte.signatureProviseurUrl || '',
    signatureTitulaireUrl: charte.signatureTitulaireUrl || '',
    logoUrl: charte.logoUrl || settings.logoUrl,
    sealUrl: charte.sceauOfficielUrl ?? settings.sealUrl,
    jurySignerTitle: charte.titreSignataireJury || settings.jurySignerTitle,
    jurySignerName: charte.nomSignataireJury || settings.jurySignerName,
    principalTeacherTitle: charte.titreTitulaire || settings.principalTeacherTitle,
    principalTeacherName: charte.nomTitulaire || settings.principalTeacherName,
    startTableNumber: charte.premierNumeroTable ?? settings.startTableNumber,
    autoAssignTables: charte.numerotationAutomatique ?? settings.autoAssignTables,
  };
}
