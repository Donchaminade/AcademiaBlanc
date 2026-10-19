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

/** Délai maximal d'attente du nouveau contrôleur avant de recharger quand même. */
export const DELAI_MAX_PRISE_DE_CONTROLE_MS = 3_000;

let rechargementDemande = false;

/**
 * Recharge la page une seule fois, quel que soit le nombre de signaux (bandeau, événement « controlling »
 * de workbox-window) : deux rechargements concurrents annuleraient parfois la navigation en cours.
 */
export function rechargerUneFois(recharger: () => void = () => window.location.reload()): void {
  if (rechargementDemande) return;
  rechargementDemande = true;
  recharger();
}

/** Réservé aux tests : réarme le garde-fou de rechargement. */
export function reinitialiserRechargement(): void {
  rechargementDemande = false;
}

export interface OptionsApplication {
  /** Envoie SKIP_WAITING au service worker en attente (`registerSW()` de vite-plugin-pwa). */
  activer: () => Promise<void>;
  /**
   * Promesse résolue quand le nouveau service worker contrôle la page (`controllerchange`). Créée juste
   * avant l'activation : une promesse préparée au chargement serait déjà résolue par la première prise de
   * contrôle, et la page se rechargerait pendant que l'ancien service worker est encore aux commandes
   * (navigation qui ne se termine jamais).
   */
  priseDeControle: () => Promise<void>;
  attendre: (ms: number) => Promise<void>;
  recharger: () => void;
}

/**
 * Applique la version en attente puis recharge : dès que le nouveau service worker contrôle la page, ou
 * au plus tard après `DELAI_MAX_PRISE_DE_CONTROLE_MS`. workbox-window ne recharge de lui-même que si un
 * service worker contrôlait déjà la page au chargement ; à la toute première visite, sans ce garde-fou,
 * le bouton « Actualiser » resterait sans effet.
 */
export async function appliquerVersionEnAttente(options: OptionsApplication): Promise<void> {
  const priseDeControle = options.priseDeControle();
  await options.activer();
  await Promise.race([priseDeControle, options.attendre(DELAI_MAX_PRISE_DE_CONTROLE_MS)]);
  rechargerUneFois(options.recharger);
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
