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

/**
 * Envoi, par le centre d'une session inter-établissements, des données d'un établissement d'origine à
 * l'établissement correspondant (résolu par son code de transfert). Le paquet est un instantané JSON
 * figé au moment de l'envoi ({@link #paquet}) ; le reste décrit son cycle de vie.
 * N'implémente pas {@link TenantOwned} : deux établissements (source et destination) y ont accès.
 */
@Entity
@Table(name = "transfert_examen")
@Getter
@Setter
@NoArgsConstructor
public class TransfertExamen {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "etablissement_source_id", nullable = false)
  private Long etablissementSourceId;

  /** Session inter-établissements du centre ; null si elle a été supprimée depuis (l'historique reste). */
  @Column(name = "session_source_id")
  private Long sessionSourceId;

  /** Libellé de l'établissement d'origine tel que saisi sur les candidats ({@code eleve.etablissement_origine}). */
  @Column(name = "etablissement_origine", nullable = false)
  private String etablissementOrigine;

  @Column(name = "etablissement_destination_id", nullable = false)
  private Long etablissementDestinationId;

  /** Code de transfert du destinataire au moment de l'envoi ; jamais exposé par l'API. */
  @Column(name = "code_utilise", nullable = false)
  private String codeUtilise;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private StatutTransfert statut = StatutTransfert.EN_ATTENTE;

  @Column(name = "envoye_le", nullable = false)
  private Instant envoyeLe;

  @Column(name = "envoye_par")
  private Long envoyePar;

  @Column(name = "traite_le")
  private Instant traiteLe;

  @Column(name = "traite_par")
  private Long traitePar;

  @Column(name = "motif_refus")
  private String motifRefus;

  /** Session interne créée chez le destinataire à l'acceptation ; null tant que non accepté ou si supprimée. */
  @Column(name = "session_creee_id")
  private Long sessionCreeeId;

  @Column(nullable = false)
  private int effectif;

  @Column(name = "type_examen")
  private String typeExamen;

  @Column(name = "session_nom", nullable = false)
  private String sessionNom;

  @Column(name = "annee_libelle")
  private String anneeLibelle;

  @Column(nullable = false, columnDefinition = "TEXT")
  private String paquet;

  public boolean estEnAttente() {
    return statut == StatutTransfert.EN_ATTENTE;
  }
}
