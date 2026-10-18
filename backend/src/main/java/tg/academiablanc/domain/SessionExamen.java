package tg.academiablanc.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "session_examen")
@Getter
@Setter
@NoArgsConstructor
public class SessionExamen implements TenantOwned {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "etablissement_id", nullable = false)
  private Long etablissementId;

  @Column(name = "annee_scolaire_id", nullable = false)
  private Long anneeScolaireId;

  @Column(name = "centre_id", nullable = false)
  private Long centreId;

  @Column(nullable = false)
  private String nom;

  @Column(name = "type_examen", nullable = false)
  private String typeExamen;

  private String serie;

  @Column(nullable = false)
  private String statut;

  /** Renseignée quand la session est archivée ou clôturée ; vide tant qu'elle est ouverte. */
  @Column(name = "archivee_le")
  private Instant archiveeLe;
}
