/**
 * Version des documents légaux (CGU, Conditions d'utilisation, Politique de confidentialité).
 *
 * Toute modification de fond d'un des trois textes doit incrémenter cette date : elle est affichée sur
 * les pages, envoyée au serveur à l'inscription et comparée à la dernière acceptation enregistrée de
 * l'établissement pour déclencher la ré-acceptation (voir `src/components/legal/ReacceptationConditions.tsx`).
 * Le repli côté serveur (`app.conditions.version` dans backend/src/main/resources/application.yml) doit suivre.
 */
export const VERSION_CONDITIONS = '2026-10-19';

/** Date de dernière mise à jour affichée sur les pages légales (identique à la version, format ISO). */
export const DATE_MISE_A_JOUR_CONDITIONS = VERSION_CONDITIONS;

/**
 * Vrai quand l'établissement doit (ré)accepter les conditions : aucune acceptation enregistrée,
 * ou dernière version acceptée différente de la version courante (une version plus récente que la
 * courante — déploiement en cours — n'est pas considérée comme obsolète).
 */
export function versionObsolete(derniereAcceptee: string | null | undefined, courante: string = VERSION_CONDITIONS): boolean {
  const acceptee = (derniereAcceptee ?? '').trim();
  if (!acceptee) return true;
  return acceptee < courante;
}

/** « 19/10/2026 » à partir d'une date ISO (`2026-10-19`) ; la chaîne d'origine si elle n'est pas reconnue. */
export function versionLisible(version: string = VERSION_CONDITIONS): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(version.trim());
  if (!match) return version;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

const deuxChiffres = (n: number) => String(n).padStart(2, '0');

/**
 * Horodatage d'acceptation tel qu'affiché au chef d'établissement : « 19/10/2026 à 15:36 UTC ».
 * Toujours en UTC (l'instant est celui du serveur), quel que soit le fuseau du navigateur ; `null` si illisible.
 */
export function formaterDateAcceptation(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `${deuxChiffres(date.getUTCDate())}/${deuxChiffres(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`
    + ` à ${deuxChiffres(date.getUTCHours())}:${deuxChiffres(date.getUTCMinutes())} UTC`;
}

/** Phrase complète du profil : « Conditions acceptées le 19/10/2026 à 15:36 UTC, version 2026-10-19 ». */
export function phraseAcceptation(acceptation: { accepteLe: string; versionConditions: string } | null | undefined): string | null {
  if (!acceptation) return null;
  const date = formaterDateAcceptation(acceptation.accepteLe);
  if (!date) return null;
  return `Conditions acceptées le ${date}, version ${acceptation.versionConditions}`;
}
