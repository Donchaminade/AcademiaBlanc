import type { ViewMode } from '../types';

/**
 * Navigation mobile (< lg) : barre d'onglets fixe en bas de l'écran et tiroir latéral (menu burger).
 * Logique pure, sans React, pour rester testable : quelles entrées afficher, laquelle est active,
 * et l'état du tiroir.
 */

export type EntreeBasId = 'dashboard' | 'students' | 'grading' | 'bulletin' | 'plateforme' | 'plus';

export interface EntreeBas {
  id: EntreeBasId;
  /** Libellé court (une ligne sous l'icône). */
  label: string;
  /** Nom de l'icône Material Symbols. */
  icon: string;
  /** Vue ouverte par l'entrée ; absente pour « Plus » (ouvre le tiroir). */
  view?: ViewMode;
}

export interface OptionsEntreesBas {
  /** Compte plateforme sans établissement : seules la plateforme et « Plus » ont un sens. */
  platformOnly?: boolean;
  /** Compte de niveau plateforme rattaché à un établissement : la plateforme s'ajoute aux entrées. */
  platformOwner?: boolean;
}

const ENTREE_PLUS: EntreeBas = { id: 'plus', label: 'Plus', icon: 'menu' };
const ENTREE_PLATEFORME: EntreeBas = { id: 'plateforme', label: 'Plateforme', icon: 'domain', view: 'plateforme' };

const ENTREES_ETABLISSEMENT: readonly EntreeBas[] = [
  { id: 'dashboard', label: 'Tableau', icon: 'analytics', view: 'dashboard' },
  { id: 'students', label: 'Candidats', icon: 'group', view: 'students' },
  { id: 'grading', label: 'Notes', icon: 'edit_note', view: 'grading' },
  { id: 'bulletin', label: 'Bulletins', icon: 'picture_as_pdf', view: 'bulletin' },
];

/** Nombre maximal d'entrées (zones tactiles ≥ 44 px sur 360 px de large). */
export const ENTREES_BAS_MAX = 5;

/**
 * Entrées de la barre du bas, « Plus » toujours en dernier. Un compte plateforme sans établissement
 * n'a que « Plateforme » et « Plus » ; un compte plateforme rattaché à un établissement garde les quatre
 * entrées d'établissement (la plateforme reste accessible depuis le tiroir) pour ne pas dépasser cinq.
 */
export function entreesBas(options: OptionsEntreesBas = {}): EntreeBas[] {
  if (options.platformOnly) return [ENTREE_PLATEFORME, ENTREE_PLUS];
  return [...ENTREES_ETABLISSEMENT, ENTREE_PLUS];
}

/**
 * Entrée mise en évidence pour la vue courante : l'entrée qui ouvre la vue, sinon « Plus » pour les vues
 * accessibles uniquement depuis le tiroir (PV, archives, administration, profil, plateforme). Aucune hors
 * application (`auth`).
 */
export function entreeActive(view: ViewMode, entrees: readonly EntreeBas[] = entreesBas()): EntreeBasId | null {
  if (view === 'auth') return null;
  const directe = entrees.find((entree) => entree.view === view);
  if (directe) return directe.id;
  return entrees.some((entree) => entree.id === 'plus') ? 'plus' : null;
}

/** Vues qui n'ont pas d'entrée directe dans la barre : proposées dans le tiroir. */
export function vuesDuTiroir(entrees: readonly EntreeBas[] = entreesBas()): ViewMode[] {
  const directes = new Set(entrees.map((entree) => entree.view).filter(Boolean));
  const toutes: ViewMode[] = ['dashboard', 'students', 'grading', 'bulletin', 'records', 'settings', 'admin', 'profil', 'plateforme'];
  return toutes.filter((vue) => !directes.has(vue));
}

/* ------------------------------------------------------------------ */
/* Tiroir latéral                                                      */
/* ------------------------------------------------------------------ */

export interface EtatTiroir {
  ouvert: boolean;
  /** Vue affichée au moment de l'ouverture : un changement de vue referme le tiroir. */
  vueOuverture: ViewMode | null;
}

export const TIROIR_FERME: EtatTiroir = { ouvert: false, vueOuverture: null };

export function ouvrirTiroir(vue: ViewMode): EtatTiroir {
  return { ouvert: true, vueOuverture: vue };
}

export function fermerTiroir(): EtatTiroir {
  return TIROIR_FERME;
}

/**
 * Le tiroir se referme quand la vue change (navigation depuis le tiroir ou la barre du bas) ;
 * il reste tel quel sinon.
 */
export function tiroirApresChangementDeVue(etat: EtatTiroir, vue: ViewMode): EtatTiroir {
  if (!etat.ouvert) return etat;
  return etat.vueOuverture === vue ? etat : TIROIR_FERME;
}

/**
 * Touche pressée dans le tiroir ouvert : `Escape` le ferme ; `Tab` boucle sur les éléments focalisables
 * (piège de focus). Renvoie l'index du prochain élément à focaliser, ou `null` si rien à faire.
 */
export function indexFocusSuivant(
  touche: { key: string; shiftKey: boolean },
  indexCourant: number,
  nombreFocalisables: number,
): number | null {
  if (touche.key !== 'Tab' || nombreFocalisables === 0) return null;
  if (touche.shiftKey) {
    return indexCourant <= 0 ? nombreFocalisables - 1 : null;
  }
  return indexCourant >= nombreFocalisables - 1 || indexCourant < 0 ? 0 : null;
}
