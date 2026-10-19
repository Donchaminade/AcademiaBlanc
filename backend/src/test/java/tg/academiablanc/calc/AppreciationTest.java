package tg.academiablanc.calc;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class AppreciationTest {

  @ParameterizedTest(name = "{0}/20 → {1}")
  @CsvSource({
      "0, Très insuffisant",
      "4, Très insuffisant",
      "4.99, Très insuffisant",
      "5, Insuffisant",
      "7, Insuffisant",
      "7.99, Insuffisant",
      "8, Mauvais",
      "9, Mauvais",
      "9.99, Mauvais",
      "10, Passable",
      "11, Passable",
      "11.99, Passable",
      "12, Assez bien",
      "13, Assez bien",
      "13.99, Assez bien",
      "14, Bien",
      "15, Bien",
      "15.99, Bien",
      "16, Très bien",
      "17, Très bien",
      "17.99, Très bien",
      "18, Excellent",
      "19, Excellent",
      "20, Excellent",
  })
  void baremeSurLaNoteDeLaMatiere(String note, String attendu) {
    assertEquals(attendu, Appreciation.selonNote(new BigDecimal(note)));
  }

  @Test
  void huitNotesDonnentHuitAppreciationsDifferentes() {
    Set<String> libelles = new HashSet<>();
    for (String note : new String[] {"4", "7", "9", "11", "13", "15", "17", "19"}) {
      libelles.add(Appreciation.selonNote(new BigDecimal(note)));
    }
    assertEquals(8, libelles.size());
  }

  @Test
  void noteAbsenteOuHorsBareme() {
    assertEquals("Non noté", Appreciation.selonNote(null));
    assertEquals("Non noté", Appreciation.selonNote(new BigDecimal("-0.01")));
    assertEquals("Non noté", Appreciation.selonNote(new BigDecimal("20.01")));
    assertEquals("Absent", Appreciation.selonNote(new BigDecimal("12"), true));
    assertEquals("Absent", Appreciation.selonNote(null, true));
    assertEquals("Assez bien", Appreciation.selonNote(new BigDecimal("12"), false));
  }

  @Test
  void leTexteLibrePrimeSurLAutomatique() {
    assertEquals("Des progrès à l'oral.", Appreciation.pourLigne(new BigDecimal("7"), false, "Des progrès à l'oral."));
    assertEquals("Insuffisant", Appreciation.pourLigne(new BigDecimal("7"), false, null));
    assertEquals("Insuffisant", Appreciation.pourLigne(new BigDecimal("7"), false, "   "));
    assertEquals("Absent", Appreciation.pourLigne(null, true, ""));
    assertEquals("Non noté", Appreciation.pourLigne(null, false, null));
  }

  @Test
  void normalisationDuTexteLibre() {
    assertEquals("Bon travail", Appreciation.normaliserManuelle("  Bon   travail  "));
    assertNull(Appreciation.normaliserManuelle(""));
    assertNull(Appreciation.normaliserManuelle("  "));
    assertNull(Appreciation.normaliserManuelle(null));
  }
}
