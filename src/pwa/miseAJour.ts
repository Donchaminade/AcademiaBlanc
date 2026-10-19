/**
 * Mise à jour du service worker. Après chaque déploiement, le navigateur ne vérifie le service worker
 * qu'à la navigation suivante : une application installée (PWA) ou un onglet laissé ouvert plusieurs
 * jours continuerait à tourner sur l'ancien build — anciens écrans, anciens libellés, parfois
 * incompatibles avec la nouvelle API. Ce module vérifie périodiquement et au retour sur l'onglet, puis
 * laisse l'utilisateur choisir le moment de l'actualisation (bandeau) sauf au tout début du chargement,
 * où la nouvelle version s'applique sans rien demander (aucun travail en cours à perdre).
 */

/** Vérification de mise à jour toutes les heures. */
export const INTERVALLE_VERIFICATION_MS = 60 * 60 * 1000;

/** Nouvelle version détectée dans ce délai après le chargement : appliquée immédiatement, sans bandeau. */
export const DELAI_APPLICATION_SILENCIEUSE_MS = 3_000;

/** Deux vérifications déclenchées par un retour sur l'onglet sont espacées d'au moins ce délai. */
export const ESPACEMENT_RETOUR_ONGLET_MS = 5 * 60 * 1000;

export function doitAppliquerSansDemander(msDepuisChargement: number): boolean {
  return msDepuisChargement >= 0 && msDepuisChargement < DELAI_APPLICATION_SILENCIEUSE_MS;
}

export interface VerificateurMiseAJour {
  update(): Promise<unknown>;
}

interface Horloge {
  setInterval(handler: () => void, ms: number): unknown;
  clearInterval(id: unknown): void;
  maintenant(): number;
}

interface CibleEvenements {
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
  readonly visibilityState: string;
}

export interface OptionsVerification {
  horloge: Horloge;
  document: CibleEvenements;
  /** `false` hors connexion : inutile de solliciter le réseau. */
  enLigne: () => boolean;
}

/**
 * Programme les vérifications : toutes les heures, et quand l'onglet redevient visible (au plus une fois
 * toutes les cinq minutes). Un échec (hors ligne, serveur injoignable) est ignoré. Renvoie la fonction
 * d'arrêt.
 */
export function planifierVerifications(registration: VerificateurMiseAJour, options: OptionsVerification): () => void {
  const { horloge, document, enLigne } = options;
  const verifier = () => {
    if (!enLigne()) return;
    registration.update().catch(() => undefined);
  };
  const intervalle = horloge.setInterval(verifier, INTERVALLE_VERIFICATION_MS);
  let derniereVerification = horloge.maintenant();
  const surRetour = () => {
    if (document.visibilityState !== 'visible') return;
    const maintenant = horloge.maintenant();
    if (maintenant - derniereVerification < ESPACEMENT_RETOUR_ONGLET_MS) return;
    derniereVerification = maintenant;
    verifier();
  };
  document.addEventListener('visibilitychange', surRetour);
  return () => {
    horloge.clearInterval(intervalle);
    document.removeEventListener('visibilitychange', surRetour);
  };
}

/** Options branchées sur le navigateur. */
export function optionsNavigateur(): OptionsVerification {
  return {
    horloge: {
      setInterval: (handler, ms) => window.setInterval(handler, ms),
      clearInterval: (id) => window.clearInterval(id as number),
      maintenant: () => Date.now(),
    },
    document,
    enLigne: () => navigator.onLine !== false,
  };
}

type Ecouteur = () => void;

export interface EtatMiseAJour {
  /** Une nouvelle version attend d'être appliquée. */
  disponible: boolean;
  /** Applique la nouvelle version (le service worker prend la main et la page se recharge). */
  appliquer: () => Promise<void>;
}

const RIEN: EtatMiseAJour = { disponible: false, appliquer: async () => undefined };
let etat: EtatMiseAJour = RIEN;
const ecouteurs = new Set<Ecouteur>();

/** Signale au bandeau qu'une nouvelle version est prête. */
export function signalerNouvelleVersion(appliquer: () => Promise<void>): void {
  etat = { disponible: true, appliquer };
  ecouteurs.forEach((ecouteur) => ecouteur());
}

/** « Plus tard » : le bandeau se replie ; la version s'appliquera au prochain démarrage complet. */
export function ignorerNouvelleVersion(): void {
  etat = RIEN;
  ecouteurs.forEach((ecouteur) => ecouteur());
}

export function lireEtatMiseAJour(): EtatMiseAJour {
  return etat;
}

export function surEtatMiseAJour(ecouteur: Ecouteur): () => void {
  ecouteurs.add(ecouteur);
  return () => {
    ecouteurs.delete(ecouteur);
  };
}
