package tg.academiablanc.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "utilisateur")
@Getter
@Setter
@NoArgsConstructor
public class Utilisateur {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  /** Null pour un gestionnaire de la plateforme. */
  @Column(name = "etablissement_id")
  private Long etablissementId;

  @Column(nullable = false)
  private String email;

  @Column(name = "mot_de_passe_hash", nullable = false)
  private String motDePasseHash;

  @Column(nullable = false)
  private String nom;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private Role role;

  @Column(nullable = false)
  private boolean actif = true;

  /** Utilisateur qui a créé ce compte (null pour une inscription). */
  @Column(name = "cree_par")
  private Long creePar;
}
