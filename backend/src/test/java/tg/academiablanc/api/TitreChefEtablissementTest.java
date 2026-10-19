package tg.academiablanc.api;

import static org.assertj.core.api.Assertions.assertThat;
import static tg.academiablanc.api.TitreChefEtablissement.DIRECTEUR;
import static tg.academiablanc.api.TitreChefEtablissement.NEUTRE;
import static tg.academiablanc.api.TitreChefEtablissement.PROVISEUR;

import java.util.List;
import org.junit.jupiter.api.Test;

/** Au collège on parle de Directeur, au lycée de Proviseur ; le profil peut imposer un autre titre. */
class TitreChefEtablissementTest {
  @Test
  void uneClasseDeCollegeEstDirigeeParUnDirecteur() {
    assertThat(TitreChefEtablissement.pour("3e", null, null, null)).isEqualTo(DIRECTEUR);
    assertThat(TitreChefEtablissement.pour("Troisième", null, null, null)).isEqualTo(DIRECTEUR);
    assertThat(TitreChefEtablissement.pour("6e", "Complexe scolaire", null, null)).isEqualTo(DIRECTEUR);
  }

  @Test
  void uneClasseDeLyceeEstDirigeeParUnProviseur() {
    assertThat(TitreChefEtablissement.pour("Tle", null, null, null)).isEqualTo(PROVISEUR);
    assertThat(TitreChefEtablissement.pour("Terminale", null, null, null)).isEqualTo(PROVISEUR);
    assertThat(TitreChefEtablissement.pour("2nde", "Complexe scolaire", null, null)).isEqualTo(PROVISEUR);
  }

  @Test
  void laSurchargeDuProfilPrimeSurToutLeReste() {
    assertThat(TitreChefEtablissement.pour("3e", null, null, "La Directrice")).isEqualTo("La Directrice");
    assertThat(TitreChefEtablissement.pour("Tle", "Lycée", null, "  Le Principal ")).isEqualTo("Le Principal");
    assertThat(TitreChefEtablissement.pour("3e", null, null, "   ")).as("surcharge blanche = automatique").isEqualTo(DIRECTEUR);
  }

  @Test
  void leTypeDeLEtablissementTrancheQuelQueSoitLeNiveau() {
    assertThat(TitreChefEtablissement.pour("Tle", "Collège d'enseignement général", null, null)).isEqualTo(DIRECTEUR);
    assertThat(TitreChefEtablissement.pour("3e", "Lycée public", null, null)).isEqualTo(PROVISEUR);
    assertThat(TitreChefEtablissement.pour(List.of("3e", "Tle"), "CEG de Kara", null, null))
        .as("session mixte dans un collège : Directeur").isEqualTo(DIRECTEUR);
    assertThat(TitreChefEtablissement.pour(List.of("3e", "Tle"), "Lycée moderne", null, null)).isEqualTo(PROVISEUR);
  }

  @Test
  void uneSessionMixteRetombeSurLEtablissement() {
    assertThat(TitreChefEtablissement.pour(List.of("3e", "4e"), null, null, null)).isEqualTo(DIRECTEUR);
    assertThat(TitreChefEtablissement.pour(List.of("Tle", "1ère"), null, null, null)).isEqualTo(PROVISEUR);
    assertThat(TitreChefEtablissement.pour(List.of("3e", "Tle"), "Complexe scolaire", "Complexe Les Lauriers", null)).isEqualTo(NEUTRE);
    assertThat(TitreChefEtablissement.pour(List.of("3e", "Tle"), null, "Collège Protestant de Lomé", null)).isEqualTo(DIRECTEUR);
    assertThat(TitreChefEtablissement.pour(List.of("3e", "Tle"), null, "Lycée Moderne de Tokoin", null)).isEqualTo(PROVISEUR);
    assertThat(TitreChefEtablissement.pour(List.of(), null, null, null)).isEqualTo(NEUTRE);
    assertThat(TitreChefEtablissement.pour((String) null, "Établissement confessionnel", "AcademiaBlanc", null)).isEqualTo(NEUTRE);
  }

  @Test
  void laCategorieEstLueDansUnTexteLibre() {
    assertThat(TitreChefEtablissement.categorie("COLLEGE PROTESTANT")).isEqualTo(TitreChefEtablissement.Categorie.COLLEGE);
    assertThat(TitreChefEtablissement.categorie("CEG Agoè-Nyivé")).isEqualTo(TitreChefEtablissement.Categorie.COLLEGE);
    assertThat(TitreChefEtablissement.categorie("Lycée public d'enseignement général")).isEqualTo(TitreChefEtablissement.Categorie.LYCEE);
    assertThat(TitreChefEtablissement.categorie("Complexe scolaire Les Lauriers")).isEqualTo(TitreChefEtablissement.Categorie.MIXTE);
    assertThat(TitreChefEtablissement.categorie("Collège et Lycée Moderne")).isEqualTo(TitreChefEtablissement.Categorie.MIXTE);
    assertThat(TitreChefEtablissement.categorie("Établissement confessionnel")).isNull();
    assertThat(TitreChefEtablissement.categorie("  ")).isNull();
    assertThat(TitreChefEtablissement.categorie(null)).isNull();
  }
}
