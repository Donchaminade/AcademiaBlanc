package tg.academiablanc.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import tg.academiablanc.api.ReferentielMatieres.Profil;
import tg.academiablanc.domain.Classe;
import tg.academiablanc.domain.Matiere;

class ReferentielMatieresTest {

  @Test
  void profilCollegePourLesNiveaux6eA3e() {
    assertThat(ReferentielMatieres.profilDe(classe("3ème A", "3ème", null))).isEqualTo(Profil.COLLEGE);
    assertThat(ReferentielMatieres.profilDe(classe("6e B", "Sixième", null))).isEqualTo(Profil.COLLEGE);
    assertThat(ReferentielMatieres.profilDe(classe("Quatrième", "4e", "Série A"))).isEqualTo(Profil.COLLEGE);
  }

  @Test
  void profilLyceeSelonLaSerie() {
    assertThat(ReferentielMatieres.profilDe(classe("Terminale D", "Terminale", "Série D"))).isEqualTo(Profil.LYCEE_D);
    assertThat(ReferentielMatieres.profilDe(classe("Tle C2", "Tle", "C"))).isEqualTo(Profil.LYCEE_C);
    assertThat(ReferentielMatieres.profilDe(classe("1ère A4", "Première", null))).isEqualTo(Profil.LYCEE_A);
    assertThat(ReferentielMatieres.profilDe(classe("2nde", "Seconde", null))).isEqualTo(Profil.DEFAUT);
    assertThat(ReferentielMatieres.profilDe(classe("Atelier", "Formation", null))).isEqualTo(Profil.DEFAUT);
  }

  @Test
  void coefficientsParDefautSuiventLeProfil() {
    Classe troisieme = classe("3ème", "3ème", null);
    assertThat(ReferentielMatieres.coefficientParDefaut("fr", troisieme)).isEqualByComparingTo(BigDecimal.valueOf(3));
    assertThat(ReferentielMatieres.coefficientParDefaut("ecm", troisieme)).isEqualByComparingTo(BigDecimal.ONE);

    Classe terminaleD = classe("Terminale D", "Terminale", "Série D");
    assertThat(ReferentielMatieres.coefficientParDefaut("MAT", terminaleD)).isEqualByComparingTo(BigDecimal.valueOf(4));
    assertThat(ReferentielMatieres.coefficientParDefaut("svt", terminaleD)).isEqualByComparingTo(BigDecimal.valueOf(4));

    Classe terminaleC = classe("Terminale C", "Terminale", "C");
    assertThat(ReferentielMatieres.coefficientParDefaut("mat", terminaleC)).isEqualByComparingTo(BigDecimal.valueOf(5));

    Classe premiereA = classe("1ère A", "Première", "A");
    assertThat(ReferentielMatieres.coefficientParDefaut("fr", premiereA)).isEqualByComparingTo(BigDecimal.valueOf(4));

    // Une matière hors référentiel reçoit 1 par défaut.
    assertThat(ReferentielMatieres.coefficientParDefaut("eps", premiereA)).isEqualByComparingTo(BigDecimal.ONE);
  }

  @Test
  void chaqueProfilCouvreToutesLesMatieres() {
    for (Profil profil : Profil.values()) {
      for (ReferentielMatieres.MatiereRef ref : ReferentielMatieres.MATIERES) {
        assertThat(ReferentielMatieres.COEFFICIENTS.get(profil)).containsKey(ref.code());
      }
    }
  }

  @Test
  void ordreBulletinPlaceLesLitterairesPuisLesScientifiquesPuisLesAutres() {
    List<Matiere> liste = new ArrayList<>(List.of(
        matiere("eps", "EPS", null),
        matiere("svt", "SVT", "SC"),
        matiere("mat", "Mathématiques", "SC"),
        matiere("ang", "Anglais", "LT"),
        matiere("fr", "Français", "LT"),
        matiere("art", "Arts plastiques", null)));
    liste.sort(ReferentielMatieres.ORDRE_BULLETIN);
    assertThat(liste).extracting(Matiere::getCode).containsExactly("fr", "ang", "mat", "svt", "art", "eps");
  }

  @Test
  void codeEtLibelleDeGroupeSontNormalises() {
    assertThat(ReferentielMatieres.codeGroupe(" lt ")).isEqualTo("LT");
    assertThat(ReferentielMatieres.libelleGroupe("sc")).isEqualTo("Enseignements Scientifiques");
    assertThat(ReferentielMatieres.codeGroupe("XX")).isNull();
    assertThat(ReferentielMatieres.codeGroupe("")).isNull();
    assertThat(ReferentielMatieres.libelleGroupe(null)).isNull();
  }

  private static Classe classe(String nom, String niveau, String serie) {
    Classe c = new Classe();
    c.setNom(nom);
    c.setNiveau(niveau);
    c.setSerie(serie);
    return c;
  }

  private static Matiere matiere(String code, String nom, String groupe) {
    Matiere m = new Matiere();
    m.setCode(code);
    m.setNom(nom);
    m.setGroupeCode(groupe);
    return m;
  }
}
