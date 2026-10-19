/**
 * Règles de pondération partagées par l’administration et le bulletin.
 * Miroir de `GradeCalculator` / `BulletinService.coefDe` côté API :
 *   - total d’une matière = note × coefficient ;
 *   - points maximum = 20 × coefficient (une note sur 20 au coefficient 2 vaut 40 points) ;
 *   - le coefficient saisi pour la classe de l’élève prime sur le coefficient « toutes classes » ;
 *   - sans coefficient saisi, la matière compte 1.
 */

/** Toutes les notes sont saisies sur 20. */
export const NOTE_MAX = 20;

/** Coefficient appliqué à une matière dont aucune pondération n’est enregistrée. */
export const COEF_PAR_DEFAUT = 1;

export interface CoefficientSaisi {
  matiereId: number;
  /** `null` ou absent : coefficient valable pour toutes les classes. */
  classeId?: number | null;
  valeur: number | string;
}

export type SourceCoefficient = 'classe' | 'global' | 'defaut';

export interface CoefficientEffectif {
  valeur: number;
  /** D’où vient la valeur : saisie pour la classe, saisie pour toutes les classes, ou 1 par défaut. */
  source: SourceCoefficient;
}

/**
 * Coefficient d’une matière pour une classe donnée : la saisie propre à la classe l’emporte,
 * sinon la saisie « toutes classes », sinon 1.
 */
export function coefficientEffectif(
  coefficients: readonly CoefficientSaisi[],
  matiereId: number,
  classeId?: number | null,
): CoefficientEffectif {
  if (classeId != null) {
    const propre = coefficients.find((c) => c.matiereId === matiereId && c.classeId === classeId);
    if (propre) return { valeur: Number(propre.valeur), source: 'classe' };
  }
  const global = coefficients.find((c) => c.matiereId === matiereId && c.classeId == null);
  if (global) return { valeur: Number(global.valeur), source: 'global' };
  return { valeur: COEF_PAR_DEFAUT, source: 'defaut' };
}

/**
 * Coefficient à appliquer à un candidat pour une matière : celui de sa classe quand l’espace de travail
 * l’a résolu (`candidate.coefs`), sinon le coefficient commun de la matière.
 */
export function coefDuCandidat(
  candidate: { coefs?: Record<string, number> },
  subject: { id: string; coef: number },
): number {
  return candidate.coefs?.[subject.id] ?? subject.coef;
}

/** Nombre de points qu’une note sur 20 peut rapporter au maximum avec ce coefficient. */
export function pointsMax(coefficient: number): number {
  return Math.round(NOTE_MAX * coefficient * 100) / 100;
}

/** Points rapportés par une note : note × coefficient, arrondis au centième comme l’API. */
export function pointsDeNote(note: number, coefficient: number): number {
  return Math.round(note * coefficient * 100) / 100;
}

/** Nombre en français, sans décimale inutile : « 2 », « 2,5 ». */
export const formatValeur = (n: number): string =>
  Number.isInteger(n) ? String(n) : n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

/** « ×2 », « ×2,5 ». */
export function formatCoefficient(coefficient: number): string {
  return `×${formatValeur(coefficient)}`;
}

/** « 40 pts ». */
export function formatPointsMax(coefficient: number): string {
  return `${formatValeur(pointsMax(coefficient))} pts`;
}

/** Valeur saisie dans le formulaire : nombre entre 0,5 et 20 (virgule acceptée), sinon `null`. */
export function lireCoefficientSaisi(brut: string): number | null {
  const n = Number(String(brut).replace(',', '.').trim());
  if (!Number.isFinite(n) || n < 0.5 || n > 20) return null;
  return n;
}
