import { Candidate, Subject } from '../types';

/**
 * Vrai si la classe a un programme défini (au moins une matière affectée).
 * Sans programme, une classe utilise toutes les matières avec leur coefficient global.
 */
export function classeAvecProgramme(classeId: string | undefined, subjects: Subject[]): boolean {
  if (!classeId) return false;
  return subjects.some((s) => s.coefParClasse?.[classeId] !== undefined);
}

/**
 * Matières qui comptent pour un candidat : celles du programme de sa classe (avec le coefficient
 * de ce programme) quand il est défini ; sinon toutes les matières de l’établissement.
 */
export function subjectsFor(candidate: Pick<Candidate, 'classeId'> | undefined, subjects: Subject[]): Subject[] {
  const classeId = candidate?.classeId;
  if (!classeId || !classeAvecProgramme(classeId, subjects)) return subjects;
  return subjects
    .filter((s) => s.coefParClasse?.[classeId] !== undefined)
    .map((s) => ({ ...s, coef: s.coefParClasse![classeId], coefDefault: false }));
}

/** Vrai si la matière est hors du programme de la classe du candidat (une classe sans programme accepte tout). */
export function horsProgramme(candidate: Pick<Candidate, 'classeId'> | undefined, subjectId: string, subjects: Subject[]): boolean {
  const classeId = candidate?.classeId;
  if (!classeId || !classeAvecProgramme(classeId, subjects)) return false;
  return !subjects.some((s) => s.id === subjectId && s.coefParClasse?.[classeId] !== undefined);
}
