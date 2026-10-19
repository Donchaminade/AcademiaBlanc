package tg.academiablanc.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Paramètres d'affichage du bulletin propres à l'établissement (écran Paramètres).
 * Une valeur nulle signifie « valeur par défaut du logiciel » : le client applique alors son préréglage.
 * Le logo n'en fait plus partie : il est porté par {@link Etablissement} avec le cachet et les signatures (V20).
 * Les noms des signataires n'en font pas partie : le titulaire est l'enseignant affecté à la classe
 * ({@code classe.titulaire_id}), le signataire officiel est le responsable de la fiche de l'établissement.
 */
@Entity
@Table(name = "parametres_bulletin")
@Getter
@Setter
@NoArgsConstructor
public class ParametresBulletin {
  @Id
  @Column(name = "etablissement_id")
  private Long etablissementId;

  @Column(name = "sceau_officiel_url", columnDefinition = "TEXT")
  private String sceauOfficielUrl;

  @Column(name = "titre_signataire_jury")
  private String titreSignataireJury;

  @Column(name = "premier_numero_table")
  private Integer premierNumeroTable;

  @Column(name = "numerotation_automatique")
  private Boolean numerotationAutomatique;

  @Column(name = "modifie_le", nullable = false)
  private Instant modifieLe;
}
