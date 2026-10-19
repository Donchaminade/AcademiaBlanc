package tg.academiablanc.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Préréglage national géré par la plateforme : république, devise, ministère de tutelle et sigle
 * repris dans l'en-tête des bulletins. Un établissement l'applique puis ajuste librement ses champs.
 */
@Entity
@Table(name = "prereglage_national")
@Getter
@Setter
@NoArgsConstructor
public class PrereglageNational {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  /** Code ISO 3166-1 alpha-2 en majuscules (TG, CI…), unique. */
  @Column(nullable = false, length = 2)
  private String code;

  @Column(name = "nom_pays", nullable = false)
  private String nomPays;

  /** Nom officiel de l'État tel qu'imprimé sur le bulletin (« RÉPUBLIQUE TOGOLAISE »). */
  @Column(nullable = false)
  private String republique;

  @Column(nullable = false)
  private String devise;

  @Column(nullable = false)
  private String ministere;

  @Column(name = "sigle_ministere", nullable = false)
  private String sigleMinistere;

  /** Libellé de l'autorité régionale (direction régionale, inspection…) ; null si non utilisé. */
  @Column(name = "autorite_regionale")
  private String autoriteRegionale;

  /** Mention de pied de page du bulletin ; null si aucune. */
  @Column(name = "pied_de_page")
  private String piedDePage;

  @Column(nullable = false)
  private int ordre;

  @Column(nullable = false)
  private boolean actif = true;

  /** Un seul préréglage par défaut : utilisé par la vitrine, les pages d'authentification et les nouveaux établissements. */
  @Column(name = "par_defaut", nullable = false)
  private boolean parDefaut;
}
