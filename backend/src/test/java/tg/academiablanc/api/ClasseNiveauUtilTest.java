package tg.academiablanc.api;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import tg.academiablanc.domain.FamilleSerie;

class ClasseNiveauUtilTest {
  @Test
  void reconnaitLesNiveauxDuCollegeEtDuLycee() {
    assertThat(ClasseNiveauUtil.cycleDe("Troisième")).contains(ClasseNiveauUtil.Cycle.COLLEGE);
    assertThat(ClasseNiveauUtil.cycleDe("6ème")).contains(ClasseNiveauUtil.Cycle.COLLEGE);
    assertThat(ClasseNiveauUtil.cycleDe("2nde")).contains(ClasseNiveauUtil.Cycle.LYCEE);
    assertThat(ClasseNiveauUtil.cycleDe("Première")).contains(ClasseNiveauUtil.Cycle.LYCEE);
    assertThat(ClasseNiveauUtil.cycleDe("Tle")).contains(ClasseNiveauUtil.Cycle.LYCEE);
    assertThat(ClasseNiveauUtil.cycleDe("CM2")).isEmpty();
    assertThat(ClasseNiveauUtil.canonique("Terminale")).contains("Tle");
  }

  @Test
  void resolveRetourneLaFamilleEtLeNomGenere() {
    var tle = ClasseNiveauUtil.resolve("Terminale", "g2", FamilleSerie.TECHNIQUE);
    assertThat(tle.lycee()).isTrue();
    assertThat(tle.niveau()).isEqualTo("Tle");
    assertThat(tle.serie()).isEqualTo("G2");
    assertThat(tle.famille()).isEqualTo(FamilleSerie.TECHNIQUE);
    assertThat(ClasseNiveauUtil.nomClasse("Terminale", "g2")).isEqualTo("Tle G2");
    assertThat(SerieService.normaliserCode("Série D")).isEqualTo("D");
    assertThat(SerieService.normaliserCode("  série  a4 ")).isEqualTo("A4");
    assertThat(SerieService.normaliserCode("SERIE G2")).isEqualTo("G2");
    assertThat(ClasseNiveauUtil.nomClasse("Terminale", "Série D")).isEqualTo("Tle D");

    var troisieme = ClasseNiveauUtil.resolve("3e", null, null);
    assertThat(troisieme.college()).isTrue();
    assertThat(troisieme.serie()).isNull();
    assertThat(troisieme.famille()).isNull();
    assertThat(ClasseNiveauUtil.nomClasse("Troisième", null)).isEqualTo("3e");
  }

  @Test
  void lesSeriesTechniquesRetombentSurLesCoefficientsScientifiques() {
    assertThat(ClasseNiveauUtil.serieDeReference("A4", FamilleSerie.GENERALE)).isEqualTo("A4");
    assertThat(ClasseNiveauUtil.serieDeReference("F4", FamilleSerie.TECHNIQUE)).isEqualTo("D");
    assertThat(ClasseNiveauUtil.serieDeReference(null, null)).isNull();
  }
}
