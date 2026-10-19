import { estCollege, niveauCanonique } from './niveaux';

/**
 * Données réelles qui alimentent le bandeau bleu du bulletin. Chaque champ vient de la base :
 * - `typeExamenLibelle` : `type_examen.libelle_long` (sinon `libelle_court` / `code`) du type rattaché à la session ;
 * - `sessionNom` : `session_examen.nom`, l'intitulé saisi à la création de la session ;
 * - `anneeScolaire` : `annee_scolaire.libelle` de l'année de la session ;
 * - `niveau`, `classeNom` : `classe.niveau` / `classe.nom` de la classe de l'élève ;
 * - `serieCode`, `serieLibelle` : `classe.serie` et `serie.libelle` (lycée uniquement).
 * Tout champ absent ou vide est simplement omis : aucun texte fictif n'est jamais substitué.
 */
export interface SourcesEnteteBulletin {
  typeExamenLibelle?: string | null;
  sessionNom?: string | null;
  anneeScolaire?: string | null;
  niveau?: string | null;
  classeNom?: string | null;
  serieCode?: string | null;
  serieLibelle?: string | null;
}

export interface EnteteBulletin {
  /** « BREVET D'ÉTUDES DU PREMIER CYCLE — BEPC BLANC 2026 » ; vide si ni type ni intitulé. */
  ligne1: string;
  /** « SÉRIE D (SCIENCES EXPÉRIMENTALES) • 2025-2026 » ou « CLASSE DE 3e • 2025-2026 » ; vide sans information. */
  ligne2: string;
}

const SEPARATEUR_TITRE = ' — ';
const SEPARATEUR_SEGMENTS = ' • ';

const propre = (valeur: string | null | undefined): string => (valeur ?? '').replace(/\s+/g, ' ').trim();
const majuscules = (valeur: string): string => valeur.toLocaleUpperCase('fr-FR');

/** Code de série lisible : « Série D » (valeur affichée) ou « D » (code brut) donnent « D ». */
export function codeSerie(serie: string | null | undefined): string {
  const texte = propre(serie);
  if (!texte) return '';
  const match = texte.match(/s[ée]rie\s+(.+)$/i);
  return (match ? match[1] : texte).trim();
}

/**
 * Ligne 1 : libellé du type d'examen de la session puis son intitulé, séparés par un tiret cadratin.
 * Sans type d'examen, l'intitulé seul ; sans intitulé, le type seul.
 */
export function ligneTitreBulletin(sources: Pick<SourcesEnteteBulletin, 'typeExamenLibelle' | 'sessionNom'>): string {
  const type = propre(sources.typeExamenLibelle);
  const session = propre(sources.sessionNom);
  return [type, session].filter(Boolean).map(majuscules).join(SEPARATEUR_TITRE);
}

/**
 * Ligne 2 : la série de la classe au lycée (« SÉRIE D (SCIENCES EXPÉRIMENTALES) »), le niveau au collège
 * (« CLASSE DE 3e », jamais de série même si la session en porte une), puis l'année scolaire de la session.
 * Le code du niveau garde sa casse (« 3e », « Tle ») pour rester lisible.
 */
export function ligneSousTitreBulletin(sources: Omit<SourcesEnteteBulletin, 'typeExamenLibelle' | 'sessionNom'>): string {
  const niveau = propre(sources.niveau);
  const college = estCollege(niveau);
  const serie = college ? '' : codeSerie(sources.serieCode);
  const libelleSerie = propre(sources.serieLibelle);
  const classeNom = propre(sources.classeNom);
  const annee = propre(sources.anneeScolaire);

  const segments: string[] = [];
  if (serie) {
    segments.push(`SÉRIE ${majuscules(serie)}${libelleSerie ? ` (${majuscules(libelleSerie)})` : ''}`);
  } else if (niveau) {
    segments.push(`CLASSE DE ${niveauCanonique(niveau)}`);
  } else if (classeNom) {
    segments.push(`CLASSE ${majuscules(classeNom)}`);
  }
  if (annee) segments.push(majuscules(annee));
  return segments.join(SEPARATEUR_SEGMENTS);
}

/** Les deux lignes du bandeau du bulletin, composées uniquement d'informations enregistrées. */
export function composerEnteteBulletin(sources: SourcesEnteteBulletin): EnteteBulletin {
  return {
    ligne1: ligneTitreBulletin(sources),
    ligne2: ligneSousTitreBulletin(sources),
  };
}
