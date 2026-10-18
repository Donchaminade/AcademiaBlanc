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

  @Column(name = "etablissement_id", nullable = false)
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
}
