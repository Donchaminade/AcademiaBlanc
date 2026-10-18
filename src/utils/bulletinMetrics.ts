import { Candidate } from '../types';

/**
 * Appréciation du professeur déduite de la moyenne générale.
 * moyenne > 16 → Très bien ; 12 ≤ moyenne ≤ 16 → Bien ; moyenne < 12 → Assez bien.
 */
export function appreciationFromAverage(moyenne: number): string {
  if (!Number.isFinite(moyenne)) return 'Assez bien';
  if (moyenne > 16) return 'Très bien';
  if (moyenne >= 12) return 'Bien';
  return 'Assez bien';
}

/** Rang affiché seul : « 1er », « 2ème », « 3ème »… jamais « X sur Y ». */
export function formatSubjectRank(rank: number): string {
  if (!Number.isFinite(rank) || rank < 1) return '—';
  const n = Math.trunc(rank);
  if (n === 1) return '1er';
  return `${n}ème`;
}

/**
 * Rang par matière, classement compétition (1, 2, 2, 4) sur les notes présentes.
 * Une note absente n'entre pas dans le classement.
 */
export function computeSubjectRank(
  candidateId: string,
  subjectId: string,
  candidates: Candidate[],
): number | null {
  const scored = candidates
    .map((candidate) => {
      const grade = candidate.grades[subjectId];
      if (!grade || typeof grade.score !== 'number' || Number.isNaN(grade.score)) {
        return null;
      }
      return { id: candidate.id, score: grade.score };
    })
    .filter((row): row is { id: string; score: number } => row !== null);

  scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const mine = scored.find((row) => row.id === candidateId);
  if (!mine) return null;
  const first = scored.findIndex((row) => Math.abs(row.score - mine.score) < 0.001);
  return first + 1;
}

export type DecisionBucket = 'admis' | 'rattrapage' | 'ajourne' | 'other';

/** Distingue admis, second tour et ajournés (ADMISSIBLE ne compte pas comme admis). */
export function decisionBucket(decision: string | undefined): DecisionBucket {
  const value = decision || '';
  if (value.includes('AJOURNÉ')) return 'ajourne';
  if (value.includes('RATTRAPAGE') || value.includes('SECOND TOUR')) return 'rattrapage';
  if (value.includes("ADMIS D'OFFICE") || value.includes('ADMIS APRÈS')) return 'admis';
  return 'other';
}
