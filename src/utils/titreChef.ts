import type { AppSettings, Candidate } from '../types';
import { cycleDeNiveau, type Cycle } from './niveaux';

/**
 * Titre du chef d'établissement imprimé sur le bulletin, le PV et les documents signés par le responsable
 * de la fiche de l'établissement. Miroir de `TitreChefEtablissement` côté API.
 *
 * Règle : au collège (6e–3e) on parle de Directeur, au lycée (2nde–Tle) de Proviseur. Le titre se déduit
 * donc du niveau de la classe de l'élève (bulletin) ou des niveaux de la session (PV) ; le type porté par
 * la fiche de l'établissement (collège / lycée / complexe scolaire) tranche quand il est connu, et une
 * surcharge saisie dans le profil (« La Directrice », « Le Principal »…) prime toujours.
 */
export const TITRE_DIRECTEUR = 'Le Directeur';
export const TITRE_PROVISEUR = 'Le Proviseur';
/** Repli quand ni le niveau ni le type de l'établissement ne permettent de trancher. */
export const TITRE_CHEF_NEUTRE = "Le Chef d'établissement";

/** Titres proposés dans le profil pour remplacer le titre automatique (féminisation, cas particuliers). */
export const TITRES_CHEF_PROPOSES = ['Le Directeur', 'La Directrice', 'Le Proviseur', 'La Proviseure'] as const;

/** Libellé affiché dans le profil pour le choix « Automatique ». */
export const LIBELLE_TITRE_AUTOMATIQUE = 'Automatique — Le Directeur au collège, Le Proviseur au lycée';

/**
 * Catégorie lue dans le type (ou le nom) de l'établissement : `COLLEGE` (collège, CEG), `LYCEE`,
 * `MIXTE` (complexe scolaire, collège-lycée) ; null si le texte ne dit rien.
 */
export type CategorieEtablissement = 'COLLEGE' | 'LYCEE' | 'MIXTE';

const normaliser = (texte: string): string =>
  texte.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function categorieEtablissement(type: string | null | undefined): CategorieEtablissement | null {
  const texte = normaliser((type ?? '').trim());
  if (!texte) return null;
  const college = /\bcolleges?\b/.test(texte) || /\bceg\b/.test(texte) || /\bcours secondaires?\b/.test(texte);
  const lycee = /\blycees?\b/.test(texte);
  if (/\bcomplexes?\b/.test(texte) || /\bgroupes? scolaires?\b/.test(texte) || (college && lycee)) return 'MIXTE';
  if (college) return 'COLLEGE';
  if (lycee) return 'LYCEE';
  return null;
}

export interface OptionsTitreChef {
  /** Niveau de la classe de l'élève (« 3e », « Tle ») pour un bulletin. */
  niveau?: string | null;
  /** Niveaux des candidats concernés (PV, liste) ; les valeurs vides ou inconnues sont ignorées. */
  niveaux?: ReadonlyArray<string | null | undefined>;
  /** Type porté par la fiche de l'établissement (texte libre : « Lycée public… », « Collège… », « Complexe scolaire… »). */
  typeEtablissement?: string | null;
  /** Nom de l'établissement, lu en dernier recours quand le type ne dit rien (« Lycée Moderne de Tokoin »). */
  nomEtablissement?: string | null;
  /** Titre saisi dans le profil ; vide ou absent = automatique. */
  surcharge?: string | null;
}

const titreDuCycle = (cycle: Cycle): string => (cycle === 'COLLEGE' ? TITRE_DIRECTEUR : TITRE_PROVISEUR);

/** Cycles distincts des niveaux renseignés ; un niveau inconnu est traité comme lycée (règle de `cycleDeNiveau`). */
function cyclesDe(options: OptionsTitreChef): Set<Cycle> {
  const niveaux = [options.niveau, ...(options.niveaux ?? [])];
  const cycles = new Set<Cycle>();
  for (const niveau of niveaux) {
    const valeur = (niveau ?? '').trim();
    if (valeur) cycles.add(cycleDeNiveau(valeur));
  }
  return cycles;
}

/**
 * Titre du chef d'établissement :
 * 1. la surcharge du profil si elle est renseignée ;
 * 2. un établissement de type collège → « Le Directeur », de type lycée → « Le Proviseur », quel que soit le niveau ;
 * 3. sinon le niveau : collège → « Le Directeur », lycée → « Le Proviseur » (un complexe scolaire suit la classe) ;
 * 4. niveaux mélangés ou inconnus : le nom de l'établissement s'il tranche, sinon « Le Chef d'établissement ».
 */
export function titreChefEtablissement(options: OptionsTitreChef = {}): string {
  const surcharge = (options.surcharge ?? '').trim();
  if (surcharge) return surcharge;

  const categorieType = categorieEtablissement(options.typeEtablissement);
  if (categorieType === 'COLLEGE') return TITRE_DIRECTEUR;
  if (categorieType === 'LYCEE') return TITRE_PROVISEUR;

  const cycles = cyclesDe(options);
  if (cycles.size === 1) return titreDuCycle([...cycles][0]);

  if (categorieType === null) {
    const categorieNom = categorieEtablissement(options.nomEtablissement);
    if (categorieNom === 'COLLEGE') return TITRE_DIRECTEUR;
    if (categorieNom === 'LYCEE') return TITRE_PROVISEUR;
  }
  return TITRE_CHEF_NEUTRE;
}

/**
 * Titre du chef d'établissement pour les paramètres courants et les candidats concernés : le seul candidat du
 * bulletin, ou tous les candidats de la session pour le PV.
 */
export function titreChefDepuisSettings(
  settings: Pick<AppSettings, 'jurySignerTitle' | 'typeEtablissement' | 'institutionName'>,
  candidats: ReadonlyArray<Pick<Candidate, 'niveau'>> = [],
): string {
  return titreChefEtablissement({
    niveaux: candidats.map((candidat) => candidat.niveau),
    typeEtablissement: settings.typeEtablissement,
    nomEtablissement: settings.institutionName,
    surcharge: settings.jurySignerTitle,
  });
}

/** « Le Directeur » → « Directeur » (libellés du type « Signature du Directeur »). */
export function sansArticle(titre: string): string {
  return titre.replace(/^(le|la|l')\s*/i, '').trim();
}
