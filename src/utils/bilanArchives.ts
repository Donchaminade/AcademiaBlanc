import type { ArchivedSession } from '../types';

/**
 * Bilan imprimé des sessions d'examen archivées : lignes du tableau comparatif et ligne de synthèse,
 * calculées uniquement à partir des archives déjà chargées (`src/api/archives.ts` ou jeu local).
 * Une valeur absente s'affiche « — », jamais 0 inventé.
 */

export const VALEUR_ABSENTE = '—';

/** Taux ou moyenne en texte : « 72,73 % », « 11,25 / 20 » ; « — » sans valeur. */
export function formatPourcent(valeur: number | null | undefined): string {
  return valeur == null || !Number.isFinite(valeur) ? VALEUR_ABSENTE : `${valeur.toFixed(2).replace('.', ',')} %`;
}

export function formatNote(valeur: number | null | undefined): string {
  return valeur == null || !Number.isFinite(valeur) ? VALEUR_ABSENTE : `${valeur.toFixed(2).replace('.', ',')} / 20`;
}

export function formatEntier(valeur: number | null | undefined): string {
  return valeur == null || !Number.isFinite(valeur) ? VALEUR_ABSENTE : String(valeur);
}

/** Une session archivée sans aucune donnée chiffrée (effectif nul et aucune moyenne) : bilan « — ». */
export function archiveSansDonnees(session: ArchivedSession): boolean {
  return session.candidatesCount <= 0 && session.admittedCount <= 0 && session.failedCount <= 0 && !(session.promoAverage > 0);
}

export interface LigneBilan {
  id: string;
  anneeScolaire: string;
  session: string;
  typeExamen: string;
  effectif: number | null;
  /** Élèves classés (au moins une note) ; inconnu pour une archive saisie à la main. */
  classes: number | null;
  admis: number | null;
  ajournes: number | null;
  tauxReussite: number | null;
  moyenne: number | null;
  /** Meilleure moyenne de la session (la fiche d'archive ne conserve pas le nom du major). */
  major: number | null;
  mentions: { tresBien: number | null; bien: number | null; assezBien: number | null; passable: number | null };
}

/** Ordre chronologique (année scolaire croissante, puis intitulé) pour le tableau et le graphique. */
export function trierArchivesChronologique(sessions: ArchivedSession[]): ArchivedSession[] {
  return [...sessions].sort((a, b) =>
    a.academicYear.localeCompare(b.academicYear, 'fr', { numeric: true })
    || a.sessionName.localeCompare(b.sessionName, 'fr', { numeric: true, sensitivity: 'base' }));
}

const positifOuNull = (valeur: number | null | undefined): number | null =>
  valeur == null || !Number.isFinite(valeur) ? null : valeur;

export function ligneBilan(session: ArchivedSession): LigneBilan {
  const vide = archiveSansDonnees(session);
  const nombre = (valeur: number | null | undefined): number | null => (vide ? null : positifOuNull(valeur));
  return {
    id: session.id,
    anneeScolaire: session.academicYear || VALEUR_ABSENTE,
    session: session.sessionName || VALEUR_ABSENTE,
    typeExamen: session.examType || VALEUR_ABSENTE,
    effectif: nombre(session.candidatesCount),
    classes: vide ? null : positifOuNull(session.classesCount),
    admis: nombre(session.admittedCount),
    ajournes: nombre(session.failedCount),
    tauxReussite: nombre(session.admittedRate),
    moyenne: vide || !(session.promoAverage > 0) ? null : session.promoAverage,
    major: vide || !(session.highestAverage > 0) ? null : session.highestAverage,
    mentions: {
      tresBien: nombre(session.mentionsBreakdown?.tresBien),
      bien: nombre(session.mentionsBreakdown?.bien),
      assezBien: nombre(session.mentionsBreakdown?.assezBien),
      passable: nombre(session.mentionsBreakdown?.passable),
    },
  };
}

export interface SyntheseBilan {
  sessions: number;
  effectif: number | null;
  classes: number | null;
  admis: number | null;
  ajournes: number | null;
  /** Taux global admis / classés quand les classés sont connus, sinon moyenne des taux de session. */
  tauxReussite: number | null;
  /** Moyenne des moyennes de promotion des sessions qui en ont une. */
  moyenne: number | null;
  /** Meilleure moyenne toutes sessions confondues. */
  major: number | null;
  mentions: { tresBien: number | null; bien: number | null; assezBien: number | null; passable: number | null };
}

const somme = (valeurs: Array<number | null>): number | null => {
  const connues = valeurs.filter((v): v is number => v != null);
  return connues.length === 0 ? null : connues.reduce((acc, v) => acc + v, 0);
};

const arrondi2 = (valeur: number): number => Math.round(valeur * 100) / 100;

/** Ligne de synthèse du tableau comparatif. */
export function syntheseBilan(lignes: LigneBilan[]): SyntheseBilan {
  const admis = somme(lignes.map((l) => l.admis));
  const classes = lignes.every((l) => l.classes != null) && lignes.length > 0 ? somme(lignes.map((l) => l.classes)) : null;
  const taux = lignes.map((l) => l.tauxReussite).filter((t): t is number => t != null);
  const moyennes = lignes.map((l) => l.moyenne).filter((m): m is number => m != null);
  const majors = lignes.map((l) => l.major).filter((m): m is number => m != null);

  let tauxReussite: number | null = null;
  if (classes != null && classes > 0 && admis != null) tauxReussite = arrondi2((admis / classes) * 100);
  else if (taux.length > 0) tauxReussite = arrondi2(taux.reduce((acc, t) => acc + t, 0) / taux.length);

  return {
    sessions: lignes.length,
    effectif: somme(lignes.map((l) => l.effectif)),
    classes,
    admis,
    ajournes: somme(lignes.map((l) => l.ajournes)),
    tauxReussite,
    moyenne: moyennes.length > 0 ? arrondi2(moyennes.reduce((acc, m) => acc + m, 0) / moyennes.length) : null,
    major: majors.length > 0 ? Math.max(...majors) : null,
    mentions: {
      tresBien: somme(lignes.map((l) => l.mentions.tresBien)),
      bien: somme(lignes.map((l) => l.mentions.bien)),
      assezBien: somme(lignes.map((l) => l.mentions.assezBien)),
      passable: somme(lignes.map((l) => l.mentions.passable)),
    },
  };
}

export interface BarreBilan {
  id: string;
  libelle: string;
  sousLibelle: string;
  /** Taux de réussite en % ; null = barre vide avec « — ». */
  valeur: number | null;
  /** Hauteur de la barre en % de la zone (taux plafonné à 100), 0 sans valeur. */
  hauteur: number;
}

/** Barres du graphique CSS (taux de réussite par session, ordre chronologique). */
export function barresBilan(lignes: LigneBilan[]): BarreBilan[] {
  return lignes.map((l) => ({
    id: l.id,
    libelle: l.anneeScolaire,
    sousLibelle: l.session,
    valeur: l.tauxReussite,
    hauteur: l.tauxReussite == null ? 0 : Math.max(0, Math.min(100, l.tauxReussite)),
  }));
}
