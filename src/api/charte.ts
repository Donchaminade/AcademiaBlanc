import { apiGet, apiSend } from './client';
import { AppSettings } from '../types';
import { DEFAULT_LOGO_URL } from '../data/mockData';

/**
 * Charte de l'établissement du jeton (GET/PUT /api/etablissement/charte) : logo, cachet et signatures
 * téléversés (conservés en base dans la ligne de l'établissement, sous forme de data URL), puis paramètres
 * d'affichage de l'écran Paramètres (sceau officiel, signataires, numérotation des tables). `null` = jamais
 * renseigné sur le serveur : le client conserve alors sa valeur par défaut pour un texte, et laisse l'emplacement
 * vide pour une image. L'en-tête officiel (république, devise, ministère) est porté par la fiche de
 * l'établissement (`PUT /api/etablissement/en-tete`), pas par la charte.
 */
export interface CharteEtablissement {
  logoUrl?: string | null;
  sceauUrl: string | null;
  signatureProviseurUrl: string | null;
  signatureTitulaireUrl: string | null;
  /** Chaîne vide = emplacement volontairement laissé vierge (tampon manuel), à ne pas confondre avec `null`. */
  sceauOfficielUrl?: string | null;
  titreSignataireJury?: string | null;
  nomSignataireJury?: string | null;
  titreTitulaire?: string | null;
  nomTitulaire?: string | null;
  premierNumeroTable?: number | null;
  numerotationAutomatique?: boolean | null;
  /** Lecture seule : dernière modification du logo, du cachet ou des signatures (ISO 8601) ; null si aucune image. */
  modifieLe?: string | null;
}

/** Images de la charte portées par la ligne de l'établissement. */
export const CHARTE_FIELDS = ['logoUrl', 'sceauUrl', 'signatureProviseurUrl', 'signatureTitulaireUrl'] as const;
export type CharteField = (typeof CHARTE_FIELDS)[number];

/** Toutes les images de la charte, sceau officiel du bulletin compris. */
export const IMAGES_CHARTE = [...CHARTE_FIELDS, 'sealUrl'] as const satisfies readonly (keyof AppSettings)[];

/**
 * Paramètres enregistrés dans la charte en session connectée. Les autres champs d'`AppSettings`
 * viennent de l'en-tête de l'établissement (république, devise, ministère, sigle…) ou de la session
 * chargée (nom de l'établissement, année, session, type d'examen).
 */
export const PARAMETRES_PERSISTES = [
  ...IMAGES_CHARTE,
  'jurySignerTitle', 'jurySignerName', 'principalTeacherTitle', 'principalTeacherName',
  'startTableNumber', 'autoAssignTables',
] as const satisfies readonly (keyof AppSettings)[];
export type ParametrePersiste = (typeof PARAMETRES_PERSISTES)[number];

/** Vrai pour l'image de démonstration du logiciel : jamais envoyée au serveur ni affichée pour un vrai compte. */
export function estImageDemo(url: string | null | undefined): boolean {
  return Boolean(url) && (url === DEFAULT_LOGO_URL || url!.startsWith('https://lh3.googleusercontent.com/'));
}

/** Paramètres débarrassés des images de démonstration (emplacements vides) : base de toute session connectée. */
export function parametresSansDemonstration(settings: AppSettings): AppSettings {
  const next = { ...settings };
  for (const champ of IMAGES_CHARTE) {
    if (estImageDemo(next[champ])) next[champ] = '';
  }
  return next;
}

export function loadCharte(): Promise<CharteEtablissement> {
  return apiGet<CharteEtablissement>('/api/etablissement/charte');
}

/** Image envoyée au serveur : vide ou de démonstration → `null` (emplacement libre). */
const image = (url: string | undefined): string | null => (url && !estImageDemo(url) ? url : null);

/** Corps envoyé au serveur : tout paramètre persisté, les images vides devenant `null` (emplacement libre). */
export function versCharte(settings: Pick<AppSettings, ParametrePersiste>): CharteEtablissement {
  return {
    logoUrl: image(settings.logoUrl),
    sceauUrl: image(settings.sceauUrl),
    signatureProviseurUrl: image(settings.signatureProviseurUrl),
    signatureTitulaireUrl: image(settings.signatureTitulaireUrl),
    // Le sceau officiel vide est un choix (zone vierge) : il part en chaîne vide, pas en null.
    sceauOfficielUrl: image(settings.sealUrl) ?? '',
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

/**
 * Applique la charte reçue de l'API aux paramètres : image absente → emplacement vide (jamais l'image de
 * démonstration pour un vrai compte), texte null → valeur locale conservée.
 */
export function applyCharte(settings: AppSettings, charte: CharteEtablissement): AppSettings {
  return {
    ...settings,
    logoUrl: charte.logoUrl || '',
    sceauUrl: charte.sceauUrl || '',
    signatureProviseurUrl: charte.signatureProviseurUrl || '',
    signatureTitulaireUrl: charte.signatureTitulaireUrl || '',
    sealUrl: charte.sceauOfficielUrl || '',
    jurySignerTitle: charte.titreSignataireJury || settings.jurySignerTitle,
    jurySignerName: charte.nomSignataireJury || settings.jurySignerName,
    principalTeacherTitle: charte.titreTitulaire || settings.principalTeacherTitle,
    principalTeacherName: charte.nomTitulaire || settings.principalTeacherName,
    startTableNumber: charte.premierNumeroTable ?? settings.startTableNumber,
    autoAssignTables: charte.numerotationAutomatique ?? settings.autoAssignTables,
  };
}
