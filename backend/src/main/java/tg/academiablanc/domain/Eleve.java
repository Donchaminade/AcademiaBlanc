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

@Entity
@Table(name = "eleve")
@Getter
@Setter
@NoArgsConstructor
public class Eleve {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "etablissement_id", nullable = false)
  private Long etablissementId;

  @Column(name = "classe_id", nullable = false)
  private Long classeId;

  @Column(name = "session_id")
  private Long sessionId;

  @Column(name = "nom_complet", nullable = false)
  private String nomComplet;

  @Column(nullable = false)
  private String matricule;

  @Column(name = "date_naissance")
  private String dateNaissance;

  @Column(name = "lieu_naissance")
  private String lieuNaissance;

  @Column(nullable = false, length = 1)
  private String genre;

  @Column(name = "numero_table")
  private Integer numeroTable;

  @Column(name = "etablissement_origine")
  private String etablissementOrigine;
}
