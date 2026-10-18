package tg.academiablanc.domain;

public enum Role {
  OWNER,
  ADMIN,
  SECRETAIRE,
  ENSEIGNANT,
  /** Propriétaire du logiciel. N'administre pas un établissement et ne voit les autres que via /api/plateforme. */
  SUPER_ADMIN
}
