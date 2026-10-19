import { Candidate, Subject } from '../types';
import { coefDuCandidat, NOTE_MAX } from './coefficients';
import { subjectsFor } from './programme';

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Moyenne réelle d'un candidat, même règle que `GradeCalculator` côté API :
 *   - seules les matières du programme de sa classe comptent, avec le coefficient de cette classe ;
 *   - une matière sans note est exclue du numérateur ET du dénominateur (elle ne vaut pas zéro) ;
 *   - moyenne = Σ(note × coef) / Σ coef, arrondie au centième ; aucun point n'est jamais ajouté.
 */
export interface MoyenneReelle {
  /** Σ(note × coef) des matières notées, arrondie au centième. */
  totalPoints: number;
  /** Σ coef des matières notées. */
  totalCoef: number;
  /** Σ coef de tout le programme, notes saisies ou non. */
  totalCoefProgramme: number;
  /** 20 × Σ coef du programme : total maximal du bulletin de cet élève. */
  pointsMax: number;
  /** Moyenne arrondie au centième ; 0 quand aucune note n'est saisie. */
  average: number;
  /** Vrai dès qu'une note est saisie. */
  evaluated: boolean;
}

export function moyenneReelle(candidate: Candidate, subjects: Subject[]): MoyenneReelle {
  let totalPoints = 0;
  let totalCoef = 0;
  let totalCoefProgramme = 0;
  subjectsFor(candidate, subjects).forEach((subject) => {
    const coef = coefDuCandidat(candidate, subject);
    totalCoefProgramme += coef;
    const grade = candidate.grades[subject.id];
    if (!grade || typeof grade.score !== 'number' || Number.isNaN(grade.score)) return;
    totalPoints += grade.score * coef;
    totalCoef += coef;
  });
  const evaluated = totalCoef > 0;
  return {
    totalPoints: round2(totalPoints),
    totalCoef: round2(totalCoef),
    totalCoefProgramme: round2(totalCoefProgramme),
    pointsMax: round2(NOTE_MAX * totalCoefProgramme),
    average: evaluated ? round2(totalPoints / totalCoef) : 0,
    evaluated,
  };
}

/**
 * Camarades de classe d'un candidat : les candidats de la même classe (`classeId`) ; sans classe
 * connue (démonstration), tous les candidats de la session.
 */
export function camaradesDeClasse(candidate: Pick<Candidate, 'classeId'>, candidates: Candidate[]): Candidate[] {
  if (!candidate.classeId) return candidates;
  return candidates.filter((c) => c.classeId === candidate.classeId);
}

export interface ExtremesClasse {
  /** Moyenne des moyennes des élèves notés ; null si personne n'est noté. */
  average: number | null;
  highest: number | null;
  lowest: number | null;
  /** Nombre d'élèves notés. */
  count: number;
}

/** Moyenne, moyenne la plus forte et la plus faible d'un groupe d'élèves (seuls les élèves notés comptent). */
export function extremesDesMoyennes(candidates: Candidate[], subjects: Subject[]): ExtremesClasse {
  const moyennes = candidates
    .map((c) => moyenneReelle(c, subjects))
    .filter((m) => m.evaluated)
    .map((m) => m.average);
  if (moyennes.length === 0) return { average: null, highest: null, lowest: null, count: 0 };
  return {
    average: round2(moyennes.reduce((acc, m) => acc + m, 0) / moyennes.length),
    highest: Math.max(...moyennes),
    lowest: Math.min(...moyennes),
    count: moyennes.length,
  };
}

export interface ExtremesMatiere {
  highest: number | null;
  lowest: number | null;
  /** Nombre de notes présentes dans le groupe. */
  count: number;
}

/** Note la plus forte et la plus faible d'une matière dans un groupe d'élèves (notes présentes seulement). */
export function extremesDeMatiere(subjectId: string, candidates: Candidate[]): ExtremesMatiere {
  const notes = candidates
    .map((c) => c.grades[subjectId]?.score)
    .filter((score): score is number => typeof score === 'number' && !Number.isNaN(score));
  if (notes.length === 0) return { highest: null, lowest: null, count: 0 };
  return { highest: Math.max(...notes), lowest: Math.min(...notes), count: notes.length };
}

/** « 8.50 / 17.25 » pour la colonne Min / Max classe ; « — » sans note. */
export function formatMinMax(extremes: ExtremesMatiere): string {
  if (extremes.lowest == null || extremes.highest == null) return '—';
  return `${extremes.lowest.toFixed(2)} / ${extremes.highest.toFixed(2)}`;
}

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
