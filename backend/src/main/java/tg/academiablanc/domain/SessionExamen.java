package tg.academiablanc.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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

  /**
   * Libellé court du type d'examen, conservé en texte pour les bulletins et archives.
   * Synchronisé avec le référentiel dès qu'un {@link #typeExamenId} est rattaché.
   */
  @Column(name = "type_examen", nullable = false)
  private String typeExamen;

  /** Type du référentiel de la plateforme ; absent pour une session antérieure non rattachée. */
  @Column(name = "type_examen_id")
  private Long typeExamenId;

  private String serie;

  @Column(nullable = false)
  private String statut;

  /** Renseignée quand la session est archivée ou clôturée ; vide tant qu'elle est ouverte. */
  @Column(name = "archivee_le")
  private Instant archiveeLe;

  /** Interne (élèves de l'établissement) ou inter-établissements (l'établissement est le centre d'examen). */
  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 30)
  private ModeSession mode = ModeSession.INTERNE;

  public boolean estInterEtablissements() {
    return ModeSession.ouDefaut(mode) == ModeSession.INTER_ETABLISSEMENTS;
  }

  /**
   * Deux sessions sont « sœurs » quand elles portent le même examen dans la même année scolaire
   * (« BEPC blanc n°1 » en novembre puis « BEPC blanc n°2 » en février) : leurs candidats sont
   * communs, sans réimport des élèves. Le type est comparé par référentiel, sinon par libellé.
   */
  public boolean memeExamenMemeAnnee(SessionExamen autre) {
    if (autre == null || anneeScolaireId == null || !anneeScolaireId.equals(autre.anneeScolaireId)) return false;
    if (typeExamenId != null && autre.typeExamenId != null) return typeExamenId.equals(autre.typeExamenId);
    return typeExamen != null && autre.typeExamen != null && typeExamen.trim().equalsIgnoreCase(autre.typeExamen.trim());
  }
}
