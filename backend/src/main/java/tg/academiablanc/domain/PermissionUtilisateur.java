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

/** Une case de la matrice de droits d’un utilisateur : ressource × action → accordée ou non. */
@Entity
@Table(name = "permission_utilisateur")
@Getter
@Setter
@NoArgsConstructor
public class PermissionUtilisateur {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "utilisateur_id", nullable = false)
  private Long utilisateurId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private Ressource ressource;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private Action action;

  @Column(nullable = false)
  private boolean accorde = true;

  public PermissionUtilisateur(Long utilisateurId, Ressource ressource, Action action, boolean accorde) {
    this.utilisateurId = utilisateurId;
    this.ressource = ressource;
    this.action = action;
    this.accorde = accorde;
  }
}
