/**
 * Coordonnées de l'éditeur de la plateforme, reprises dans les trois documents légaux.
 *
 * À COMPLÉTER PAR LE PROPRIÉTAIRE avant publication : raison sociale exacte, adresse postale, email de
 * contact réellement relevé, et juridiction de référence. Aucun numéro d'immatriculation n'est inventé ici ;
 * ajoutez-le dans `raisonSociale` ou `adresse` une fois connu. Les textes eux-mêmes sont à faire valider par un
 * conseil juridique (ils ne constituent pas un avis juridique).
 */
export const PLATEFORME_CONTACT = {
  /** Nom commercial du service. */
  nomService: 'AcademiaBlanc',
  /** Dénomination de l'éditeur (raison sociale ou nom de l'exploitant). PLACEHOLDER à remplacer. */
  raisonSociale: 'AcademiaBlanc (éditeur — raison sociale à compléter)',
  /** Adresse postale de l'éditeur. PLACEHOLDER à remplacer. */
  adresse: 'Adresse postale à compléter, Lomé, Togo',
  /** Email de contact général et d'exercice des droits. */
  email: 'contact@academiablanc.app',
  /** Email du référent protection des données (par défaut, le contact général). */
  emailDonnees: 'contact@academiablanc.app',
  /** Ville dont les tribunaux sont compétents à défaut de médiation aboutie. */
  juridiction: 'Lomé (République togolaise)',
  /** Pays du droit applicable. */
  droitApplicable: 'droit togolais',
} as const;

/** Chemins publics des trois documents (déclarés aussi dans `src/utils/router.ts`). */
export const CHEMINS_LEGAUX = {
  cgu: '/cgu',
  confidentialite: '/confidentialite',
  conditions: '/conditions',
} as const;
