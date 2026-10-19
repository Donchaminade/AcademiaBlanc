import { clearToken, getSession } from './client';
import type { AuthSession } from './client';
import { applyCharte, parametresSansDemonstration } from './charte';
import type { CharteEtablissement } from './charte';
import type { ProfilEtablissement } from './etablissement';
import type { SchoolWorkspace } from './workspace';
import { DEFAULT_SETTINGS } from '../data/mockData';
import { appliquerEnTeteAuxSettings } from '../utils/prereglages';
import type { AppSettings } from '../types';

/**
 * État d'une session connectée : tout ce qui s'affiche pour un vrai compte vient du serveur ou des valeurs
 * par défaut du logiciel, jamais de la démonstration ni d'une session précédente (autre compte, autre
 * établissement sur le même navigateur). Ce module ne touche pas à React : il est testé à part.
 */

/**
 * Paramètres affichés dès qu'un jeton existe et avant que l'espace de l'établissement soit chargé :
 * en-tête par défaut du logiciel, sans aucune image ni libellé de démonstration (année, session,
 * type d'examen, signataire, devise).
 */
export function parametresInitiauxConnecte(session: AuthSession | null | undefined): AppSettings {
  return {
    ...parametresSansDemonstration(DEFAULT_SETTINGS),
    institutionName: session?.nomEtablissement || '',
    institutionMotto: '',
    academicYear: '',
    sessionName: '',
    examType: '',
    jurySignerName: '',
  };
}

export interface SourcesParametres {
  session: AuthSession | null | undefined;
  workspace: Pick<SchoolWorkspace, 'academicYear' | 'sessionName' | 'examTypeLong'>;
  /** `null` : charte illisible (droit absent, ancienne API, serveur momentanément indisponible). */
  charte: CharteEtablissement | null;
  /** `null` : fiche illisible. */
  profil: ProfilEtablissement | null;
}

/**
 * Paramètres d'une session connectée, reconstruits intégralement à partir du serveur : l'état précédent
 * n'est jamais repris, même quand la charte ou la fiche n'ont pas pu être lues (l'écran montre alors les
 * valeurs par défaut du logiciel et des emplacements vides, pas les données de démonstration).
 */
export function parametresDepuisServeur({ session, workspace, charte, profil }: SourcesParametres): AppSettings {
  const base = parametresInitiauxConnecte(session);
  const next: AppSettings = {
    ...base,
    institutionName: session?.nomEtablissement || profil?.nom || '',
    // Devise propre de la fiche (pied de page) ; vide tant qu'elle n'est pas renseignée.
    institutionMotto: profil?.devise ?? '',
    // Libellés de la session chargée ; vides tant qu'aucune année / session n'existe sur le serveur.
    academicYear: workspace.academicYear || '',
    sessionName: workspace.sessionName || '',
    examType: workspace.examTypeLong || '',
    // Le signataire officiel est le responsable de la fiche ; le titulaire vient de la classe de l'élève.
    jurySignerName: profil ? profil.nomResponsable : '',
  };
  // République, devise nationale et ministère viennent de l'établissement (préréglage national appliqué, puis ajusté).
  const avecEnTete = appliquerEnTeteAuxSettings(next, profil?.enTete);
  return charte ? applyCharte(avecEnTete, charte) : avecEnTete;
}

/** Identifiant de l'espace mémorisé localement : établissement du jeton en session connectée, sinon l'école de démonstration. */
export function espaceLocal(session: AuthSession | null | undefined, demoSchoolId: string): string {
  if (session?.etablissementId != null) return `etab_${session.etablissementId}`;
  if (session?.utilisateurId != null) return `utilisateur_${session.utilisateurId}`;
  return demoSchoolId;
}

/**
 * Clé de préférence locale (verrou du procès-verbal…) propre à l'espace affiché : un établissement connecté
 * ne relit jamais la préférence d'un autre établissement ni celle de la démonstration.
 */
export function cleLocale(base: string, session: AuthSession | null | undefined, demoSchoolId: string): string {
  return `academiablanc_${base}_${espaceLocal(session, demoSchoolId)}`;
}

export const PREFIXE_CLES_LOCALES = 'academiablanc_';

/**
 * Clés locales à effacer à la déconnexion : toute préférence rattachée à l'établissement ou à l'utilisateur
 * du jeton. Les données de démonstration (`academiablanc_school_data_…`, registre) sont conservées : elles
 * n'appartiennent à aucun compte.
 */
export function clesAPurger(cles: readonly string[], session: AuthSession | null | undefined): string[] {
  if (!session) return [];
  const suffixes = [
    session.etablissementId != null ? `_etab_${session.etablissementId}` : null,
    session.utilisateurId != null ? `_utilisateur_${session.utilisateurId}` : null,
  ].filter((item): item is string => item !== null);
  return cles.filter((cle) => cle.startsWith(PREFIXE_CLES_LOCALES) && suffixes.some((suffixe) => cle.endsWith(suffixe)));
}

/** Caches du service worker à conserver : le précache de l'application (rendu hors connexion). */
const PRECACHE = /precache/i;

/**
 * Déconnexion : jeton et session effacés, préférences locales du compte supprimées, et tout cache
 * d'exécution du service worker vidé (les réponses de l'API ne sont jamais mises en cache, mais un
 * ancien service worker a pu en laisser). Le précache de l'application est conservé.
 */
export async function purgerSessionLocale(): Promise<void> {
  const session = getSession();
  clearToken();
  try {
    const cles = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index) || '');
    for (const cle of clesAPurger(cles, session)) localStorage.removeItem(cle);
  } catch {
    // stockage local indisponible
  }
  try {
    if (typeof caches !== 'undefined') {
      const noms = await caches.keys();
      await Promise.all(noms.filter((nom) => !PRECACHE.test(nom)).map((nom) => caches.delete(nom)));
    }
  } catch {
    // Cache Storage indisponible (contexte non sécurisé, navigateur ancien)
  }
}
