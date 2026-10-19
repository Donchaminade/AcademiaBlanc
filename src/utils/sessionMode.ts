import type { Candidate, CandidateComputedStats } from '../types';
import { decisionBucket } from './bulletinMetrics';
import { codeSerie } from './bulletinEntete';
import { estCollege, niveauCanonique } from './niveaux';

/**
 * Mode d'une session d'examen blanc (`session_examen.mode`, V22).
 * - `INTERNE` : les candidats sont les élèves de l'établissement ; relevés avec logo, cachet et pied de page.
 * - `INTER_ETABLISSEMENTS` : plusieurs établissements organisent l'examen ensemble ; l'établissement qui a
 *   créé la session est le centre d'examen, les candidats gardent un établissement d'origine, les relevés
 *   ne portent ni logo ni cachet d'établissement et le rang est calculé par niveau / série sur toute la session.
 */
export type ModeSession = 'INTERNE' | 'INTER_ETABLISSEMENTS';

export const MODE_SESSION_DEFAUT: ModeSession = 'INTERNE';

export function estSessionInter(mode: ModeSession | string | null | undefined): boolean {
  return mode === 'INTER_ETABLISSEMENTS';
}

/** Libellé court du mode (badges des listes, barre latérale). */
export function libelleModeSession(mode: ModeSession | string | null | undefined): string {
  return estSessionInter(mode) ? 'Inter-établissements' : 'Interne';
}

/** Intitulé de la carte de signature de gauche du relevé inter-établissements (à la place du titulaire). */
export const TITRE_PRESIDENT_JURY = 'Le Président du jury';
/** Intitulé de la carte de signature de droite du relevé inter-établissements (à la place du chef d'établissement). */
export const TITRE_CHEF_CENTRE = 'Le Chef du centre';

const propre = (valeur: string | null | undefined): string => (valeur ?? '').replace(/\s+/g, ' ').trim();

/** « CENTRE D'EXAMEN : LYCÉE MODERNE DE TOKOIN » ; chaîne vide sans nom de centre. */
export function ligneCentreExamen(centreExamen: string | null | undefined): string {
  const nom = propre(centreExamen);
  return nom ? `CENTRE D'EXAMEN : ${nom.toLocaleUpperCase('fr-FR')}` : '';
}

/**
 * Établissement d'origine imprimé sur le relevé ou la liste des candidats : celui saisi pour le candidat,
 * sinon le centre d'examen lui-même (un élève du centre n'a pas d'origine saisie).
 */
export function etablissementOrigineAffiche(
  candidate: Pick<Candidate, 'originSchool'>,
  centreExamen: string | null | undefined,
): string {
  return propre(candidate.originSchool) || propre(centreExamen);
}

/**
 * Libellé du niveau / de la série d'un candidat : « 3e » au collège, « Tle D » au lycée ; à défaut le
 * nom de sa classe, puis sa série seule.
 */
export function libelleNiveauSerie(candidate: Pick<Candidate, 'niveau' | 'serie' | 'classeNom'>): string {
  const niveau = propre(candidate.niveau);
  const serie = estCollege(niveau) ? '' : codeSerie(candidate.serie);
  if (niveau) return serie ? `${niveauCanonique(niveau)} ${serie}` : niveauCanonique(niveau);
  if (propre(candidate.classeNom)) return propre(candidate.classeNom);
  return serie;
}

/** Clé de regroupement niveau + série (insensible à la casse) ; les candidats sans niveau forment un seul groupe. */
export function cleNiveauSerie(candidate: Pick<Candidate, 'niveau' | 'serie' | 'classeNom'>): string {
  return libelleNiveauSerie(candidate).toLocaleUpperCase('fr-FR');
}

/**
 * Cohorte dans laquelle un candidat est classé. En session inter-établissements : tous les candidats de la
 * session du même niveau et de la même série, toutes classes du centre confondues (un candidat de Tle D est
 * classé avec les Tle D de tous les établissements). Sinon : tous les candidats (comportement inchangé).
 */
export function groupeDeClassement(
  candidate: Pick<Candidate, 'niveau' | 'serie' | 'classeNom'>,
  candidates: Candidate[],
  inter: boolean,
): Candidate[] {
  if (!inter) return candidates;
  const cle = cleNiveauSerie(candidate);
  return candidates.filter((autre) => cleNiveauSerie(autre) === cle);
}

const comparerFr = (a: string, b: string): number => a.localeCompare(b, 'fr', { sensitivity: 'base', numeric: true });

/**
 * Ordre de la liste des candidats : classe (niveau / série puis nom de classe) puis nom et prénoms.
 * Deux candidats de la même classe sont départagés par leur nom, jamais par leur numéro de table,
 * pour que la liste reste lisible à l'émargement.
 */
export function trierCandidatsListe(candidates: Candidate[]): Candidate[] {
  return [...candidates].sort((a, b) =>
    comparerFr(libelleNiveauSerie(a), libelleNiveauSerie(b))
    || comparerFr(propre(a.classeNom), propre(b.classeNom))
    || comparerFr(propre(a.fullName), propre(b.fullName))
    || a.tableNumber - b.tableNumber);
}

/**
 * Ordre du palmarès inter-établissements : par niveau / série, puis par moyenne décroissante
 * (le rang de chaque candidat est calculé dans son groupe), puis nom.
 */
export function trierPalmares(
  candidates: Candidate[],
  allStats: Record<string, Pick<CandidateComputedStats, 'average'>>,
  inter: boolean,
): Candidate[] {
  return [...candidates].sort((a, b) =>
    (inter ? comparerFr(libelleNiveauSerie(a), libelleNiveauSerie(b)) : 0)
    || (allStats[b.id]?.average ?? 0) - (allStats[a.id]?.average ?? 0)
    || comparerFr(propre(a.fullName), propre(b.fullName)));
}

export interface TotalEtablissement {
  etablissement: string;
  effectif: number;
  /** Candidats dont la moyenne est calculée (au moins une note). */
  evalues: number;
  admis: number;
  /** Taux d'admission en % sur les candidats évalués ; null tant que personne n'est noté. */
  taux: number | null;
}

/** Effectif, admis et taux d'admission par établissement d'origine (PV inter-établissements), triés par nom. */
export function totauxParEtablissement(
  candidates: Candidate[],
  allStats: Record<string, Pick<CandidateComputedStats, 'decision' | 'evaluated'>>,
  centreExamen: string | null | undefined,
): TotalEtablissement[] {
  const parNom = new Map<string, TotalEtablissement>();
  for (const candidate of candidates) {
    const nom = etablissementOrigineAffiche(candidate, centreExamen) || '—';
    const total = parNom.get(nom) ?? { etablissement: nom, effectif: 0, evalues: 0, admis: 0, taux: null };
    total.effectif += 1;
    const stats = allStats[candidate.id];
    if (stats?.evaluated) {
      total.evalues += 1;
      if (decisionBucket(stats.decision) === 'admis') total.admis += 1;
    }
    parNom.set(nom, total);
  }
  return [...parNom.values()]
    .map((total) => ({ ...total, taux: total.evalues > 0 ? Math.round((total.admis / total.evalues) * 1000) / 10 : null }))
    .sort((a, b) => comparerFr(a.etablissement, b.etablissement));
}

const csvCell = (value: string | number): string => {
  const raw = String(value ?? '');
  const guarded = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${guarded.replace(/"/g, '""')}"`;
};

/** Contenu CSV (séparateur `;`, BOM pour Excel) de la liste des candidats, dans l'ordre de la liste imprimée. */
export function csvListeCandidats(candidates: Candidate[], centreExamen: string | null | undefined): string {
  const lignes = ['N° table;Nom et prénoms;Genre;Date de naissance;Lieu de naissance;Classe / série;Établissement d\'origine;Matricule'];
  for (const candidate of trierCandidatsListe(candidates)) {
    lignes.push([
      csvCell(candidate.tableNumber || ''),
      csvCell(candidate.fullName),
      csvCell(candidate.gender),
      csvCell(candidate.dob || ''),
      csvCell(candidate.birthPlace || ''),
      csvCell(libelleNiveauSerie(candidate)),
      csvCell(etablissementOrigineAffiche(candidate, centreExamen)),
      csvCell(candidate.matricule),
    ].join(';'));
  }
  return `\uFEFF${lignes.join('\n')}`;
}
