import { apiGet } from './client';

/** Cycle visé par un type d'examen ; miroir de `CycleExamen` côté API. */
export type CycleExamen = 'COLLEGE' | 'LYCEE' | 'TOUS';

export const CYCLES_EXAMEN: { code: CycleExamen; label: string }[] = [
  { code: 'COLLEGE', label: 'Collège' },
  { code: 'LYCEE', label: 'Lycée' },
  { code: 'TOUS', label: 'Tous' },
];

export const CYCLE_EXAMEN_LABELS: Record<CycleExamen, string> = {
  COLLEGE: 'Collège',
  LYCEE: 'Lycée',
  TOUS: 'Tous',
};

/** Type d'examen tel que lu par un établissement (`GET /api/types-examen`, types actifs). */
export interface TypeExamenChoix {
  id: number;
  code: string;
  libelleCourt: string;
  libelleLong: string;
  cycle: CycleExamen;
  ordre: number;
}

/** Fiche complète pour la plateforme (`/api/plateforme/types-examen`), avec le nombre de sessions qui l'utilisent. */
export interface TypeExamen extends TypeExamenChoix {
  actif: boolean;
  sessions: number;
}

/** Champs d'une session d'examen relatifs à son type (réponse de `/api/sessions`). */
export interface SessionTypeExamen {
  /** Libellé texte conservé sur la session (libellé court du référentiel quand elle est rattachée). */
  typeExamen: string;
  typeExamenId?: number | null;
  typeExamenCode?: string | null;
  typeExamenLibelle?: string | null;
  typeExamenLibelleLong?: string | null;
  typeExamenCycle?: CycleExamen | null;
  /** Session créée avant le référentiel et non rattachée : le texte d'origine fait foi. */
  typeExamenHorsReferentiel?: boolean;
}

export function chargerTypesExamen(cycle?: CycleExamen): Promise<TypeExamenChoix[]> {
  return apiGet<TypeExamenChoix[]>(cycle ? `/api/types-examen?cycle=${cycle}` : '/api/types-examen');
}

/** Groupes du sélecteur : Collège, Lycée puis Tous ; les groupes vides sont omis. */
export function grouperTypesExamen<T extends { cycle: CycleExamen }>(types: readonly T[]): { cycle: CycleExamen; label: string; types: T[] }[] {
  return CYCLES_EXAMEN
    .map((c) => ({ cycle: c.code, label: c.label, types: types.filter((t) => t.cycle === c.code) }))
    .filter((g) => g.types.length > 0);
}

/** Libellé court d'une session (« BEPC »), avec repli sur son texte. */
export function libelleCourtSession(session: SessionTypeExamen | null | undefined): string {
  if (!session) return '';
  return session.typeExamenLibelle || session.typeExamen || '';
}

/** Libellé long d'une session (« Brevet d'Études du Premier Cycle »), avec repli sur le libellé court. */
export function libelleLongSession(session: SessionTypeExamen | null | undefined): string {
  if (!session) return '';
  return session.typeExamenLibelleLong || libelleCourtSession(session);
}

/** Année civile de fin d'une année scolaire : « 2025-2026 » → « 2026 » ; sinon le libellé tel quel. */
export function anneeDeFin(libelleAnnee: string | undefined | null): string {
  const libelle = (libelleAnnee ?? '').trim();
  const match = libelle.match(/(\d{4})\s*$/);
  return match ? match[1] : libelle;
}

/** Nom de session proposé à partir du type et de l'année : « BEPC Blanc 2026 » (toujours modifiable). */
export function nomSessionSuggere(type: Pick<TypeExamenChoix, 'libelleCourt' | 'code'> | null | undefined, libelleAnnee?: string | null): string {
  if (!type) return '';
  const annee = anneeDeFin(libelleAnnee);
  const base = type.code === 'COMPO' ? type.libelleCourt : `${type.libelleCourt} Blanc`;
  return annee ? `${base} ${annee}` : base;
}

/**
 * Avertissement non bloquant quand le cycle du type (collège / lycée) ne correspond pas aux classes concernées.
 * `cyclesClasses` : cycles des classes rattachées à la session (ou de l'établissement à la création).
 */
export function avertissementCycle(
  type: Pick<TypeExamenChoix, 'cycle' | 'libelleCourt'> | null | undefined,
  cyclesClasses: readonly ('COLLEGE' | 'LYCEE')[],
): string | null {
  if (!type || type.cycle === 'TOUS' || cyclesClasses.length === 0) return null;
  const attendu = type.cycle;
  const horsCycle = cyclesClasses.filter((c) => c !== attendu).length;
  if (horsCycle === 0) return null;
  const libelleAttendu = attendu === 'COLLEGE' ? 'du collège' : 'du lycée';
  if (horsCycle === cyclesClasses.length) {
    return `« ${type.libelleCourt} » est un examen ${libelleAttendu}, mais aucune des classes concernées n'en relève. Vous pouvez tout de même enregistrer.`;
  }
  return `« ${type.libelleCourt} » est un examen ${libelleAttendu} : ${horsCycle} classe${horsCycle > 1 ? 's' : ''} concernée${horsCycle > 1 ? 's' : ''} n'en relève${horsCycle > 1 ? 'nt' : ''} pas. Vous pouvez tout de même enregistrer.`;
}
