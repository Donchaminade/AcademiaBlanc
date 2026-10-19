import type { Candidate } from '../types';

/** Intitulé de la carte de visa du bulletin ; le nom vient de la classe de l'élève, jamais d'un réglage global. */
export const TITRE_TITULAIRE = 'Le Titulaire';

/** Ligne laissée à compléter à la main quand la classe n'a pas de titulaire affecté. */
export const TITULAIRE_A_COMPLETER = '________________';

/**
 * Nom imprimé sous « Le Titulaire » : l'enseignant affecté à la classe de l'élève, sinon une ligne vide.
 * Aucune valeur de démonstration n'est jamais substituée.
 */
export function nomTitulaireAffiche(candidate: Pick<Candidate, 'titulaire'> | null | undefined): string {
  const nom = candidate?.titulaire?.trim();
  return nom ? nom : TITULAIRE_A_COMPLETER;
}

/** Vrai quand la classe de l'élève a un titulaire désigné. */
export function aUnTitulaire(candidate: Pick<Candidate, 'titulaire'> | null | undefined): boolean {
  return Boolean(candidate?.titulaire?.trim());
}
