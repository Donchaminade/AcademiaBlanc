/**
 * Logique pure du tableau de bord analytique de la plateforme (formatage, périodes, échelle du graphique).
 * Aucune dépendance à React ni à l'API : testable sous Node.
 */

/** Espace fine insécable : séparateur de milliers de la typographie française. */
export const SEPARATEUR_MILLIERS = '\u202f';
/** Espace insécable entre le nombre et l'unité. */
const ESPACE_UNITE = '\u00a0';

const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MOIS_LONGS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/* ------------------------------------------------------------------ */
/* Nombres et montants                                                 */
/* ------------------------------------------------------------------ */

/** Entier avec séparateur de milliers : 1234567 → « 1 234 567 ». Les décimales sont arrondies. */
export function formatEntier(valeur: number | null | undefined): string {
  if (valeur == null || !Number.isFinite(valeur)) return '—';
  const arrondi = Math.round(valeur);
  const signe = arrondi < 0 ? '-' : '';
  const chiffres = String(Math.abs(arrondi));
  const groupes: string[] = [];
  for (let fin = chiffres.length; fin > 0; fin -= 3) {
    groupes.unshift(chiffres.slice(Math.max(0, fin - 3), fin));
  }
  return signe + groupes.join(SEPARATEUR_MILLIERS);
}

/** Montant en francs CFA : 1250000 → « 1 250 000 FCFA ». Null ou non fini → « — ». */
export function formatFcfa(montant: number | null | undefined): string {
  if (montant == null || !Number.isFinite(montant)) return '—';
  return `${formatEntier(montant)}${ESPACE_UNITE}FCFA`;
}

/**
 * Variation relative en pourcentage, arrondie au dixième : (courant − précédent) / précédent × 100.
 * Indéfinie (null) quand la base de comparaison est nulle : on n'affiche pas « +∞ % ».
 */
export function variationPct(courant: number, precedent: number): number | null {
  if (!Number.isFinite(courant) || !Number.isFinite(precedent) || precedent === 0) return null;
  return Math.round(((courant - precedent) / Math.abs(precedent)) * 1000) / 10;
}

/** « +12,5 % », « −8 % », « 0 % » ; « — » quand la variation est indéfinie. */
export function formatVariation(variation: number | null): string {
  if (variation == null) return '—';
  const abs = Math.abs(variation);
  const texte = Number.isInteger(abs) ? String(abs) : abs.toFixed(1).replace('.', ',');
  const signe = variation > 0 ? '+' : variation < 0 ? '−' : '';
  return `${signe}${texte}${ESPACE_UNITE}%`;
}

/** Taux en pourcentage à une décimale : 12.345 → « 12,3 % » ; null → « — ». */
export function formatTaux(taux: number | null | undefined): string {
  if (taux == null || !Number.isFinite(taux)) return '—';
  const arrondi = Math.round(taux * 10) / 10;
  const texte = Number.isInteger(arrondi) ? String(arrondi) : arrondi.toFixed(1).replace('.', ',');
  return `${texte}${ESPACE_UNITE}%`;
}

/* ------------------------------------------------------------------ */
/* Mois                                                                */
/* ------------------------------------------------------------------ */

/** Découpe « AAAA-MM » ; lève une erreur sur un format inattendu. */
function decouperMois(mois: string): { annee: number; indice: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(mois);
  if (!match) throw new Error(`Mois invalide : « ${mois} » (attendu AAAA-MM).`);
  const indice = Number(match[2]) - 1;
  if (indice < 0 || indice > 11) throw new Error(`Mois invalide : « ${mois} ».`);
  return { annee: Number(match[1]), indice };
}

/** Mois civil UTC d'un instant ISO : « 2026-10-19T12:00:00Z » → « 2026-10 ». */
export function moisDepuisInstant(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new Error(`Instant invalide : « ${iso} ».`);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Décale un mois « AAAA-MM » de `delta` mois (négatif pour reculer). */
export function decalerMois(mois: string, delta: number): string {
  const { annee, indice } = decouperMois(mois);
  const total = annee * 12 + indice + delta;
  const nouvelleAnnee = Math.floor(total / 12);
  const nouvelIndice = ((total % 12) + 12) % 12;
  return `${nouvelleAnnee}-${String(nouvelIndice + 1).padStart(2, '0')}`;
}

/**
 * Les `nombre` mois glissants se terminant par `moisCourant`, du plus ancien au plus récent :
 * moisGlissants('2026-10', 12) → ['2025-11', …, '2026-10'].
 */
export function moisGlissants(moisCourant: string, nombre = 12): string[] {
  if (nombre <= 0) return [];
  const resultat: string[] = [];
  for (let i = nombre - 1; i >= 0; i -= 1) resultat.push(decalerMois(moisCourant, -i));
  return resultat;
}

/** Libellé court d'axe : « 2026-10 » → « oct. » ; avec l'année : « oct. 26 ». */
export function libelleMoisCourt(mois: string, avecAnnee = false): string {
  const { annee, indice } = decouperMois(mois);
  return avecAnnee ? `${MOIS_COURTS[indice]} ${String(annee).slice(-2)}` : MOIS_COURTS[indice];
}

/** Initiale du mois pour les écrans étroits : « 2026-10 » → « O » (le libellé complet reste dans le tableau). */
export function initialeMois(mois: string): string {
  const { indice } = decouperMois(mois);
  return MOIS_LONGS[indice].charAt(0).toUpperCase();
}

/** Libellé complet : « 2026-10 » → « octobre 2026 ». */
export function libelleMoisLong(mois: string): string {
  const { annee, indice } = decouperMois(mois);
  return `${MOIS_LONGS[indice]} ${annee}`;
}

/** Horodatage UTC lisible : « 2026-10-19T12:05:00Z » → « 19/10/2026 à 12:05 UTC ». */
export function formatHorodatageUtc(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const jj = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mi = String(date.getUTCMinutes()).padStart(2, '0');
  return `${jj}/${mm}/${date.getUTCFullYear()} à ${hh}:${mi} UTC`;
}

/** Date UTC courte : « 2026-10-19T12:05:00Z » → « 19/10/2026 ». */
export function formatDateUtc(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const jj = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${jj}/${mm}/${date.getUTCFullYear()}`;
}

/* ------------------------------------------------------------------ */
/* Échelle du graphique                                                */
/* ------------------------------------------------------------------ */

export interface Echelle {
  /** Valeur du haut de l'axe (≥ max, multiple du pas). */
  plafond: number;
  /** Graduations de 0 au plafond, pas « rond » (1, 2, 5 × 10ⁿ). */
  graduations: number[];
}

/**
 * Échelle entière « ronde » pour un maximum donné : entre 3 et 6 graduations, pas 1, 2 ou 5 × 10ⁿ.
 * Un maximum nul ou négatif donne l'échelle minimale 0–1 (barres vides, pas de division par zéro).
 */
export function echelleGraphique(max: number): Echelle {
  if (!Number.isFinite(max) || max <= 0) return { plafond: 1, graduations: [0, 1] };
  const brut = max / 5;
  const puissance = 10 ** Math.floor(Math.log10(brut));
  const candidats = [1, 2, 5, 10].map((m) => m * puissance);
  const pas = Math.max(1, candidats.find((c) => c >= brut) ?? candidats[candidats.length - 1]);
  const plafond = Math.ceil(max / pas) * pas;
  const graduations: number[] = [];
  for (let v = 0; v <= plafond + 1e-9; v += pas) graduations.push(Math.round(v));
  return { plafond, graduations };
}

/** Hauteur relative d'une barre (0–100 %) sur l'échelle donnée. */
export function hauteurPct(valeur: number, echelle: Echelle): number {
  if (echelle.plafond <= 0 || valeur <= 0) return 0;
  return Math.min(100, (valeur / echelle.plafond) * 100);
}

/* ------------------------------------------------------------------ */
/* Séries                                                              */
/* ------------------------------------------------------------------ */

export interface PointInscription {
  mois: string;
  inscriptions: number;
  cumul: number;
}

/**
 * Complète une série reçue du serveur pour couvrir exactement les 12 mois attendus (mois manquants à 0,
 * cumul reporté du mois précédent). Garantit un graphique stable même si le serveur omettait un mois.
 */
export function completerSerie(points: PointInscription[], moisCourant: string, nombre = 12): PointInscription[] {
  const parMois = new Map(points.map((p) => [p.mois, p]));
  let cumul = 0;
  return moisGlissants(moisCourant, nombre).map((mois) => {
    const point = parMois.get(mois);
    if (point) {
      cumul = point.cumul;
      return { mois, inscriptions: point.inscriptions, cumul };
    }
    return { mois, inscriptions: 0, cumul };
  });
}
