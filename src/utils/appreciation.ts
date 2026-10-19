import type { CandidateGrade } from '../types';

/**
 * Appréciation du professeur par matière, déduite de la note sur 20 de la matière.
 * Barème unique, identique à `calc/Appreciation.java` côté serveur : chaque palier est fermé à
 * gauche et ouvert à droite ([12 ; 14[ → « Assez bien »), 20 compris dans « Excellent ».
 */
export const BAREME_APPRECIATION: ReadonlyArray<{ min: number; libelle: string }> = [
  { min: 18, libelle: 'Excellent' },
  { min: 16, libelle: 'Très bien' },
  { min: 14, libelle: 'Bien' },
  { min: 12, libelle: 'Assez bien' },
  { min: 10, libelle: 'Passable' },
  { min: 8, libelle: 'Médiocre' },
  { min: 5, libelle: 'Insuffisant' },
  { min: 0, libelle: 'Très insuffisant' },
];

export const APPRECIATION_NON_NOTE = 'Non noté';
export const APPRECIATION_ABSENT = 'Absent';

/** Longueur maximale d'une appréciation saisie par l'enseignant (colonne `note.appreciation`). */
export const APPRECIATION_LONGUEUR_MAX = 60;

/**
 * Appréciation automatique selon la note sur 20. Une note absente (ou hors barème) donne
 * « Non noté », ou « Absent » si l'absence est explicitement signalée.
 */
export function appreciationSelonNote(note: number | null | undefined, options: { absent?: boolean } = {}): string {
  if (options.absent) return APPRECIATION_ABSENT;
  if (typeof note !== 'number' || !Number.isFinite(note) || note < 0 || note > 20) return APPRECIATION_NON_NOTE;
  const palier = BAREME_APPRECIATION.find((item) => note >= item.min);
  return palier ? palier.libelle : APPRECIATION_NON_NOTE;
}

/** Texte libre de l'enseignant, débarrassé des espaces superflus ; vide = appréciation automatique. */
export function normaliserAppreciationManuelle(texte: string | null | undefined): string {
  return (texte ?? '').replace(/\s+/g, ' ').trim();
}

export function appreciationManuelleValide(texte: string | null | undefined): boolean {
  return normaliserAppreciationManuelle(texte).length <= APPRECIATION_LONGUEUR_MAX;
}

/**
 * Appréciation portée sur le bulletin : le texte libre de l'enseignant s'il existe, sinon
 * l'appréciation automatique calculée sur la note de la matière.
 */
export function appreciationAffichee(
  grade: Pick<CandidateGrade, 'score' | 'appreciation'> | null | undefined,
  options: { absent?: boolean } = {},
): string {
  const manuelle = normaliserAppreciationManuelle(grade?.appreciation);
  if (manuelle) return manuelle;
  return appreciationSelonNote(grade?.score, options);
}
