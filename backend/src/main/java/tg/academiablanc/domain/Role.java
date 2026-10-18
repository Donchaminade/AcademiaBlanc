package tg.academiablanc.domain;

/**
 * Rôles = préréglages de permissions. Les droits effectifs sont dans permission_utilisateur,
 * sauf pour OWNER et SUPER_ADMIN qui ont toujours tout et ne peuvent pas être restreints.
 */
public enum Role {
  /** Créateur du compte de l’établissement : tous les droits sur son établissement. */
  OWNER,
  ADMIN,
  SECRETAIRE,
  ENSEIGNANT,
  /** Propriétaire du logiciel. N'administre pas un établissement et ne voit les autres que via /api/plateforme. */
  SUPER_ADMIN,
  /** Gestionnaire de la plateforme ajouté par le propriétaire du logiciel ; aucun établissement rattaché. */
  GESTIONNAIRE_PLATEFORME;

  /** Rôles qu’un responsable d’établissement peut attribuer à ses utilisateurs. */
  public boolean estRoleEtablissement() {
    return this == ADMIN || this == SECRETAIRE || this == ENSEIGNANT;
  }

  public boolean estPlateforme() {
    return this == SUPER_ADMIN || this == GESTIONNAIRE_PLATEFORME;
  }

  /** Rôles dont les droits sont complets et non modifiables. */
  public boolean estIntouchable() {
    return this == OWNER || this == SUPER_ADMIN;
  }
}
