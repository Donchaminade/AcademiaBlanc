package tg.academiablanc.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tg.academiablanc.domain.Etablissement;
import tg.academiablanc.repo.EtablissementRepository;

/**
 * Tableau de bord analytique : base H2 dédiée (sans jeu de démonstration) et horloge figée au
 * 19 octobre 2026 12:00 UTC, pour des valeurs attendues exactes.
 */
@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:analytique;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE",
    "app.seed.enabled=false",
    "app.platform.super-admin-email=analytique@logiciel.tg",
    "app.platform.super-admin-password=secret-analytique",
})
@AutoConfigureMockMvc
class AnalytiquePlateformeTest {
  static final Instant MAINTENANT = Instant.parse("2026-10-19T12:00:00Z");

  @TestConfiguration
  static class HorlogeFigee {
    @Bean
    @Primary
    Clock horlogeFigee() {
      return Clock.fixed(MAINTENANT, ZoneOffset.UTC);
    }
  }

  @Autowired
  private MockMvc mvc;
  @Autowired
  private ObjectMapper json;
  @Autowired
  private EtablissementRepository etablissements;

  @Test
  void inscriptionsSurDouzeMoisEtAccesReserveAuProprietaire() throws Exception {
    // Fenêtre : 2025-11 → 2026-10. Inscriptions réparties sur 14 mois (2025-09 → 2026-10) + une sans date.
    etab("Avant fenetre 1", "2025-09-10T08:00:00Z");
    etab("Avant fenetre 2 (dernier instant)", "2025-10-31T23:59:59Z");
    etab("Novembre (premier instant)", "2025-11-01T00:00:00Z");
    etab("Decembre", "2025-12-05T10:00:00Z");
    etab("Fevrier A", "2026-02-14T10:00:00Z");
    etab("Fevrier B", "2026-02-20T10:00:00Z");
    etab("Avril", "2026-04-01T00:00:00Z");
    etab("Juin (dernier instant)", "2026-06-30T23:59:59Z");
    etab("Aout A", "2026-08-20T10:00:00Z");
    etab("Aout B", "2026-08-21T10:00:00Z");
    etab("Aout C", "2026-08-22T10:00:00Z");
    etab("Octobre A", "2026-10-19T11:00:00Z");
    etab("Octobre apres l'horloge, meme mois", "2026-10-25T09:00:00Z");
    etab("Sans date (avant V12)", null);

    // Compte d'établissement créé par l'API : sa date d'inscription est ramenée dans le mois courant.
    String ecole = token(mvc.perform(post("/api/auth/signup")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"nom":"Lycee Analytique","ville":"Kara","email":"ecole-analytique@ecole.tg","motDePasse":"secret1","nomResponsable":"Proviseur"}
                """))
        .andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString());
    Etablissement inscrit = etablissements.findByEmailIgnoreCase("ecole-analytique@ecole.tg").orElseThrow();
    inscrit.setCreeLe(Instant.parse("2026-10-02T06:00:00Z"));
    etablissements.save(inscrit);

    // Sans jeton, compte d'établissement et gestionnaire de la plateforme : refusés.
    mvc.perform(get("/api/plateforme/analytique")).andExpect(status().isForbidden());
    mvc.perform(get("/api/plateforme/analytique").header("Authorization", "Bearer " + ecole))
        .andExpect(status().isForbidden());

    String proprio = token(mvc.perform(post("/api/auth/login-plateforme")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"analytique@logiciel.tg\",\"motDePasse\":\"secret-analytique\"}"))
        .andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString());

    mvc.perform(post("/api/plateforme/gestionnaires").header("Authorization", "Bearer " + proprio)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"nom\":\"Gestionnaire\",\"email\":\"gest-analytique@logiciel.tg\",\"motDePasse\":\"temp123\","
                + "\"permissions\":[\"ETABLISSEMENTS:VOIR\",\"ETABLISSEMENTS:DETAILS\"]}"))
        .andExpect(status().isCreated());
    String gestionnaire = token(mvc.perform(post("/api/auth/login-plateforme")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"gest-analytique@logiciel.tg\",\"motDePasse\":\"temp123\"}"))
        .andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString());
    mvc.perform(get("/api/plateforme/analytique").header("Authorization", "Bearer " + gestionnaire))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.message").value(AnalytiquePlateformeController.MESSAGE_RESERVE));

    JsonNode vue = json.readTree(mvc.perform(get("/api/plateforme/analytique").header("Authorization", "Bearer " + proprio))
        .andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString());

    assertEquals("2026-10-19T12:00:00Z", vue.get("calculeLe").asText());
    assertEquals(15, vue.get("totalEtablissements").asLong());
    assertEquals(1, vue.get("sansDateInscription").asLong());

    JsonNode serie = vue.get("inscriptions");
    assertEquals(12, serie.size());
    List<String> moisAttendus = List.of("2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04",
        "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10");
    long[] inscriptionsAttendues = {1, 1, 0, 2, 0, 1, 0, 1, 0, 3, 0, 3};
    // Cumul initial : 2 établissements avant la fenêtre + 1 sans date.
    long[] cumulsAttendus = {4, 5, 5, 7, 7, 8, 8, 9, 9, 12, 12, 15};
    for (int i = 0; i < 12; i++) {
      JsonNode point = serie.get(i);
      assertEquals(moisAttendus.get(i), point.get("mois").asText(), "mois n°" + i);
      assertEquals(inscriptionsAttendues[i], point.get("inscriptions").asLong(), "inscriptions " + moisAttendus.get(i));
      assertEquals(cumulsAttendus[i], point.get("cumul").asLong(), "cumul " + moisAttendus.get(i));
    }
  }

  private Etablissement etab(String nom, String creeLe) {
    Etablissement e = new Etablissement();
    e.setNom(nom);
    e.setCode("ANA-" + Math.abs(nom.hashCode()));
    e.setVille("Lome");
    e.setEmail(nom.toLowerCase().replaceAll("[^a-z0-9]+", "-") + "@analytique.tg");
    e.setNomResponsable("Responsable");
    e.setActif(true);
    e.setCreeLe(creeLe == null ? null : Instant.parse(creeLe));
    return etablissements.save(e);
  }

  private static String token(String raw) throws Exception {
    return new ObjectMapper().readTree(raw).get("token").asText();
  }
}
