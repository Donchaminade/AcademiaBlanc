import type { Candidate, CandidateComputedStats, MentionType } from '../types';
import { decisionBucket } from './bulletinMetrics';

export const TITRE_PROCES_VERBAL = 'Procès-verbal de délibération — Palmarès';

/** Ordre d'affichage des mentions dans la répartition imprimée. */
export const MENTIONS_ORDONNEES: readonly MentionType[] = ['TRÈS BIEN', 'BIEN', 'ASSEZ BIEN', 'PASSABLE', 'AJOURNÉ'];

/** Libellé lisible d'une mention (« Très bien ») ; les codes du barème sont en majuscules. */
export function libelleMention(mention: MentionType): string {
  const bas = mention.toLocaleLowerCase('fr-FR');
  return bas.charAt(0).toLocaleUpperCase('fr-FR') + bas.slice(1);
}

type StatsPalmares = Pick<CandidateComputedStats, 'average' | 'evaluated' | 'decision' | 'mention'>;

export interface StatistiquesPalmares {
  /** Candidats inscrits dans la session. */
  effectif: number;
  /** Candidats dont la moyenne est calculée (au moins une note) : ce sont eux qui sont classés. */
  classes: number;
  admis: number;
  ajournes: number;
  /** Taux d'admission en % des candidats classés ; null tant que personne n'est noté. */
  taux: number | null;
  /** Moyenne des moyennes des candidats classés ; null sans candidat noté. */
  moyenneSession: number | null;
  moyenneMax: number | null;
  moyenneMin: number | null;
  /** Nombre de candidats par mention, dans l'ordre de `MENTIONS_ORDONNEES` (mentions absentes à 0). */
  mentions: Array<{ mention: MentionType; nombre: number }>;
}

const arrondi = (valeur: number, decimales: number): number => {
  const facteur = 10 ** decimales;
  return Math.round(valeur * facteur) / facteur;
};

/** Effectif, admis, taux et extrêmes des moyennes de la session, pour le bandeau et l'encadré du PV imprimé. */
export function statistiquesPalmares(
  candidates: ReadonlyArray<Pick<Candidate, 'id'>>,
  allStats: Record<string, StatsPalmares | undefined>,
): StatistiquesPalmares {
  const notes = candidates.map((c) => allStats[c.id]).filter((s): s is StatsPalmares => Boolean(s?.evaluated));
  const moyennes = notes.map((s) => s.average);
  const admis = notes.filter((s) => decisionBucket(s.decision) === 'admis').length;
  const ajournes = notes.filter((s) => decisionBucket(s.decision) === 'ajourne').length;
  const compte = new Map<MentionType, number>();
  for (const s of notes) if (s.mention) compte.set(s.mention, (compte.get(s.mention) ?? 0) + 1);

  return {
    effectif: candidates.length,
    classes: notes.length,
    admis,
    ajournes,
    taux: notes.length ? arrondi((admis / notes.length) * 100, 1) : null,
    moyenneSession: moyennes.length ? arrondi(moyennes.reduce((a, b) => a + b, 0) / moyennes.length, 2) : null,
    moyenneMax: moyennes.length ? Math.max(...moyennes) : null,
    moyenneMin: moyennes.length ? Math.min(...moyennes) : null,
    mentions: MENTIONS_ORDONNEES.map((mention) => ({ mention, nombre: compte.get(mention) ?? 0 })),
  };
}

/** Nombre en notation française (« 11,78 », « 72,7 ») ; « — » pour une valeur absente. */
export function nombreFr(valeur: number | null | undefined, decimales = 2): string {
  if (valeur == null || Number.isNaN(valeur)) return '—';
  return valeur.toLocaleString('fr-FR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

/** « 72,7 % » ou « — ». */
export function tauxFr(taux: number | null | undefined): string {
  return taux == null ? '—' : `${nombreFr(taux, 1)} %`;
}

/** Ligne de synthèse du bandeau : « Admis 8 • Ajournés 3 • Taux 72,7 % • Moyenne de la session 11,78 ». */
export function resumePalmares(stats: StatistiquesPalmares): string {
  return [
    `Admis ${stats.admis}`,
    `Ajournés ${stats.ajournes}`,
    `Taux ${tauxFr(stats.taux)}`,
    `Moyenne de la session ${nombreFr(stats.moyenneSession)}`,
  ].join(' • ');
}

/** « Très bien 1 • Bien 1 • Assez bien 3 • Passable 3 • Ajourné 3 » ; « — » sans candidat noté. */
export function repartitionMentions(stats: StatistiquesPalmares): string {
  const parts = stats.mentions.filter((m) => m.nombre > 0).map((m) => `${libelleMention(m.mention)} ${m.nombre}`);
  return parts.length ? parts.join(' • ') : '—';
}

/** Rang imprimé : « 1er », « 2e », « 12e ». */
export function libelleRangImprime(rank: number): string {
  return rank === 1 ? '1er' : `${rank}e`;
}

/** Classe CSS de la pastille de rang : podium doré / argenté / bronze, rien au-delà. */
export function classePodium(rank: number | undefined): string {
  if (rank === 1) return 'pv-rang pv-rang-or';
  if (rank === 2) return 'pv-rang pv-rang-argent';
  if (rank === 3) return 'pv-rang pv-rang-bronze';
  return 'pv-rang';
}

/** Classe CSS de la pastille de mention imprimée (bleu dégradé pour les mentions, rouge clair ajourné, gris sans note). */
export function classeMention(mention: MentionType | null | undefined): string {
  switch (mention) {
    case 'TRÈS BIEN': return 'pv-mention pv-mention-tres-bien';
    case 'BIEN': return 'pv-mention pv-mention-bien';
    case 'ASSEZ BIEN': return 'pv-mention pv-mention-assez-bien';
    case 'PASSABLE': return 'pv-mention pv-mention-passable';
    case 'AJOURNÉ': return 'pv-mention pv-mention-ajourne';
    default: return 'pv-mention pv-mention-attente';
  }
}

/** Décision imprimée (colonne étroite) : « Admis », « Ajourné », « — » sans note. */
export function decisionImprimee(decision: string | null | undefined): { texte: string; classe: string } {
  switch (decisionBucket(decision)) {
    case 'admis': return { texte: 'Admis', classe: 'pv-decision pv-decision-admis' };
    case 'ajourne': return { texte: 'Ajourné', classe: 'pv-decision pv-decision-ajourne' };
    default: return { texte: '—', classe: 'pv-decision' };
  }
}

/** « PV verrouillé le 19 octobre 2026 à 17:26 » ; sans date connue, « PV verrouillé ». */
export function mentionVerrouillage(verrouilleLe: string | Date | null | undefined): string {
  const date = verrouilleLe instanceof Date ? verrouilleLe : verrouilleLe ? new Date(verrouilleLe) : null;
  if (!date || Number.isNaN(date.getTime())) return 'PV verrouillé';
  const jour = date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const heure = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `PV verrouillé le ${jour} à ${heure}`;
}
