import type { Candidate } from '../types';
import { trierCandidatsListe } from './sessionMode';

/**
 * Numéros de table. Un élève enregistré avant l'attribution automatique par le serveur (import ou
 * inscription sans session) n'a pas de `numero_table` : l'API renvoie `null`, que l'espace de travail
 * traduit en `0`. Ces fonctions distinguent ce cas (numéro manquant) d'un vrai numéro et complètent la
 * numérotation sans toucher aux numéros déjà attribués.
 */

/** Vrai quand le candidat a un numéro de table attribué (entier strictement positif). */
export function aUnNumeroTable(candidate: Pick<Candidate, 'tableNumber'>): boolean {
  return Number.isInteger(candidate.tableNumber) && candidate.tableNumber > 0;
}

/** Numéro de table à afficher : le numéro, ou une chaîne vide (jamais « 0 ») quand il n'est pas attribué. */
export function numeroTableAffiche(candidate: Pick<Candidate, 'tableNumber'>, vide = ''): string {
  return aUnNumeroTable(candidate) ? String(candidate.tableNumber) : vide;
}

/** Candidats sans numéro de table, dans l'ordre de la liste imprimée (classe puis nom). */
export function candidatsSansNumero(candidates: Candidate[]): Candidate[] {
  return trierCandidatsListe(candidates.filter((c) => !aUnNumeroTable(c)));
}

/**
 * Complète les numéros manquants par une numérotation séquentielle stable : les candidats sans numéro
 * sont triés par classe puis nom et reçoivent, à partir du premier numéro paramétré, les numéros
 * encore libres dans la session (un numéro déjà porté par un autre candidat est sauté).
 * Les candidats déjà numérotés sont rendus tels quels, l'ordre du tableau d'entrée est conservé.
 */
export function attribuerNumerosManquants(candidates: Candidate[], premierNumero: number): Candidate[] {
  const manquants = candidatsSansNumero(candidates);
  if (manquants.length === 0) return candidates;

  const pris = new Set(candidates.filter(aUnNumeroTable).map((c) => c.tableNumber));
  const debut = Number.isInteger(premierNumero) && premierNumero > 0 ? premierNumero : 1;
  const attribues = new Map<string, number>();
  let suivant = debut;
  for (const candidat of manquants) {
    while (pris.has(suivant)) suivant += 1;
    attribues.set(candidat.id, suivant);
    pris.add(suivant);
    suivant += 1;
  }
  return candidates.map((c) => (attribues.has(c.id) ? { ...c, tableNumber: attribues.get(c.id) as number } : c));
}

/**
 * Ordre de la feuille d'émargement : par numéro de table quand il est attribué ; les candidats sans
 * numéro viennent ensuite, par classe puis nom, pour rester visibles plutôt que mélangés en tête.
 */
export function trierPourEmargement(candidates: Candidate[]): Candidate[] {
  const numerotes = candidates.filter(aUnNumeroTable).sort((a, b) => a.tableNumber - b.tableNumber || a.fullName.localeCompare(b.fullName, 'fr'));
  return [...numerotes, ...candidatsSansNumero(candidates)];
}
