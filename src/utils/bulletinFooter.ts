/**
 * Pied de page du relevé : « NOM DE L'ÉTABLISSEMENT • Devise ».
 *
 * Le nom vient de `settings.institutionName` (`Etablissement.nom` en session connectée), la devise de
 * `settings.institutionMotto` (`Etablissement.devise`, saisie dans le profil) — à ne pas confondre avec
 * la devise nationale (`settings.motto`), imprimée dans l'en-tête à droite de la république.
 * Sans devise, seul le nom est imprimé ; sans nom ni devise, la chaîne est vide et le pied n'est pas rendu.
 */
export function bulletinFooterText(institutionName?: string | null, institutionMotto?: string | null): string {
  const nom = (institutionName ?? '').replace(/\s+/g, ' ').trim().toLocaleUpperCase('fr-FR');
  const devise = (institutionMotto ?? '').replace(/\s+/g, ' ').trim();
  if (!nom) return devise;
  return devise ? `${nom} • ${devise}` : nom;
}
