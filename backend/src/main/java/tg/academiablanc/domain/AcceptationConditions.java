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

/**
 * Acceptation horodatée des documents légaux par un responsable d'établissement.
 * Lignes ajoutées uniquement (inscription puis chaque ré-acceptation) ; jamais modifiées.
 */
@Entity
@Table(name = "acceptation_conditions")
@Getter
@Setter
@NoArgsConstructor
public class AcceptationConditions implements TenantOwned {
  /** Longueur maximale conservée pour l'agent utilisateur (colonne VARCHAR(255)). */
  public static final int USER_AGENT_MAX = 255;
  public static final int ADRESSE_IP_MAX = 64;

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "etablissement_id", nullable = false)
  private Long etablissementId;

  @Column(name = "utilisateur_id", nullable = false)
  private Long utilisateurId;

  @Column(nullable = false)
  private String email;

  /** Version des conditions acceptées (date ISO, ex. « 2026-10-19 »). */
  @Column(name = "version_conditions", nullable = false)
  private String versionConditions;

  /** Instant UTC du serveur. */
  @Column(name = "accepte_le", nullable = false)
  private Instant accepteLe;

  @Column(name = "adresse_ip")
  private String adresseIp;

  @Column(name = "user_agent")
  private String userAgent;
}
