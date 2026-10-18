package tg.academiablanc.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@SpringBootTest
@AutoConfigureMockMvc
class ImportElevesTest {
  private static final String[][] TROISIEME = {
      {"ADOUGBA Komlan Bruno", "M", "05/10/2010", "LOME"},
      {"ATTIKOUFIO Estelle", "F", "09/05/2012", "Lomé"},
      {"AWESSO Adeline Essorezime", "F", "03/03/2012", "TSEVIE"},
      {"BAH-TRAORE Hikmat", "F", "12/06/2012", "Lomé"},
      {"BATOKI Essodolom Majoie", "M", "31/12/2012", "TOKOIN"},
      {"KARMA Biguediname Simonne", "M", "03/06/2011", "KARA"},
      {"KEZIE Essossohim Pascal", "M", "23/03/2010", "Lomé"},
      {"KOUASSI Iman Natacha", "F", "03/08/2013", "HAHO"},
      {"MIZOU Kinangba Roland", "M", "31/12/2014", "TSEVIE"},
      {"TCHALLA Emmanuella", "F", "31/12/2012", "Dzové"},
      {"WOBOTI Nadjat", "M", "07/11/2012", "Lomé"},
  };

  @Autowired
  private MockMvc mvc;
  @Autowired
  private ObjectMapper json;

  @Test
  void importeLaTroisiemeCreeLaClasseEtIgnoreLesDoublons() throws Exception {
    String token = inscrire("import-3e@ecole.tg", "College Import");
    String corps = demande("3e");

    envoyer(token, post("/api/eleves/import"), corps)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.crees").value(11))
        .andExpect(jsonPath("$.ignores").value(0))
        .andExpect(jsonPath("$.total").value(11))
        .andExpect(jsonPath("$.classesCreees[0]").value("3e"));

    JsonNode classes = json.readTree(lire(token, "/api/classes"));
    assertThat(classes).hasSize(1);
    assertThat(classes.get(0).get("nom").asText()).isEqualTo("3e");
    assertThat(classes.get(0).get("niveau").asText()).isEqualTo("Troisième");
    long classeId = classes.get(0).get("id").asLong();

    JsonNode eleves = json.readTree(lire(token, "/api/eleves"));
    assertThat(eleves).hasSize(11);
    List<String> noms = new ArrayList<>();
    List<String> matricules = new ArrayList<>();
    for (JsonNode eleve : eleves) {
      noms.add(eleve.get("nomComplet").asText());
      matricules.add(eleve.get("matricule").asText());
      assertThat(eleve.get("classeId").asLong()).isEqualTo(classeId);
      assertThat(eleve.get("genre").asText()).isIn("M", "F");
      assertThat(eleve.get("dateNaissance").asText()).matches("\\d{2}/\\d{2}/\\d{4}");
      assertThat(eleve.get("lieuNaissance").asText()).isNotBlank();
    }
    assertThat(noms).contains("ADOUGBA Komlan Bruno", "BAH-TRAORE Hikmat", "WOBOTI Nadjat");
    assertThat(matricules).doesNotHaveDuplicates().allMatch(m -> m.matches("[A-Z0-9-]+-3E-\\d{3}"));
    JsonNode adougba = eleves.get(0);
    assertThat(adougba.get("nomComplet").asText()).isEqualTo("ADOUGBA Komlan Bruno");
    assertThat(adougba.get("genre").asText()).isEqualTo("M");
    assertThat(adougba.get("dateNaissance").asText()).isEqualTo("05/10/2010");
    assertThat(adougba.get("lieuNaissance").asText()).isEqualTo("LOME");

    // Relance identique : tout est ignoré, rien n'est dupliqué, la classe n'est pas recréée.
    envoyer(token, post("/api/eleves/import"), corps)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.crees").value(0))
        .andExpect(jsonPath("$.ignores").value(11))
        .andExpect(jsonPath("$.classesCreees").isEmpty())
        .andExpect(jsonPath("$.lignesIgnorees[0].nomComplet").value("ADOUGBA Komlan Bruno"));
    assertThat(json.readTree(lire(token, "/api/eleves"))).hasSize(11);
    assertThat(json.readTree(lire(token, "/api/classes"))).hasSize(1);

    // Un autre établissement ne voit ni la classe ni les élèves.
    String autre = inscrire("import-autre@ecole.tg", "Autre college");
    assertThat(json.readTree(lire(autre, "/api/eleves"))).isEmpty();
    assertThat(json.readTree(lire(autre, "/api/classes"))).isEmpty();
    envoyer(autre, get("/api/classes/" + classeId)).andExpect(status().isNotFound());
    envoyer(autre, post("/api/eleves/import").contentType(MediaType.APPLICATION_JSON)
        .content("{\"classeId\":" + classeId + ",\"eleves\":[{\"nomComplet\":\"INTRUS Test\",\"genre\":\"M\"}]}"))
        .andExpect(status().isNotFound());
  }

  @Test
  void importeDansUneClasseExistanteEtRefuseUnGenreInvalide() throws Exception {
    String token = inscrire("import-existante@ecole.tg", "Lycee Import");
    long anneeId = json.readTree(lire(token, "/api/annees-scolaires")).get(0).get("id").asLong();
    long classeId = json.readTree(envoyer(token, post("/api/classes"),
        "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"Troisième A\",\"niveau\":\"Troisième\"}")
        .andReturn().getResponse().getContentAsString()).get("id").asLong();

    envoyer(token, post("/api/eleves/import"),
        "{\"classeNom\":\"troisième a\",\"eleves\":[{\"nomComplet\":\"KOFFI  Ama\",\"genre\":\"f\",\"matricule\":\"EXT-01\"},"
            + "{\"nomComplet\":\"koffi ama\",\"genre\":\"F\"}]}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.crees").value(1))
        .andExpect(jsonPath("$.ignores").value(1))
        .andExpect(jsonPath("$.classesCreees").isEmpty());

    JsonNode eleves = json.readTree(lire(token, "/api/eleves"));
    assertThat(eleves).hasSize(1);
    assertThat(eleves.get(0).get("nomComplet").asText()).isEqualTo("KOFFI Ama");
    assertThat(eleves.get(0).get("genre").asText()).isEqualTo("F");
    assertThat(eleves.get(0).get("matricule").asText()).isEqualTo("EXT-01");
    assertThat(eleves.get(0).get("classeId").asLong()).isEqualTo(classeId);

    envoyer(token, post("/api/eleves/import").contentType(MediaType.APPLICATION_JSON)
        .content("{\"classeId\":" + classeId + ",\"eleves\":[{\"nomComplet\":\"X Y\",\"genre\":\"H\"}]}"))
        .andExpect(status().isBadRequest());
    envoyer(token, post("/api/eleves/import").contentType(MediaType.APPLICATION_JSON)
        .content("{\"eleves\":[{\"nomComplet\":\"X Y\",\"genre\":\"M\"}]}"))
        .andExpect(status().isBadRequest());
  }

  private String demande(String classeNom) {
    StringBuilder sb = new StringBuilder("{\"classeNom\":\"").append(classeNom).append("\",\"eleves\":[");
    for (int i = 0; i < TROISIEME.length; i++) {
      String[] l = TROISIEME[i];
      if (i > 0) sb.append(',');
      sb.append("{\"nomComplet\":\"").append(l[0]).append("\",\"genre\":\"").append(l[1])
          .append("\",\"dateNaissance\":\"").append(l[2]).append("\",\"lieuNaissance\":\"").append(l[3]).append("\"}");
    }
    return sb.append("]}").toString();
  }

  private String inscrire(String email, String nom) throws Exception {
    String raw = mvc.perform(post("/api/auth/signup")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"nom\":\"" + nom + "\",\"ville\":\"Lome\",\"email\":\"" + email
                + "\",\"motDePasse\":\"secret1\",\"nomResponsable\":\"Proviseur Test\"}"))
        .andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString();
    return json.readTree(raw).get("token").asText();
  }

  private String lire(String token, String path) throws Exception {
    return envoyer(token, get(path)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
  }

  private ResultActions envoyer(String token, org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request) throws Exception {
    return mvc.perform(request.header("Authorization", "Bearer " + token));
  }

  private ResultActions envoyer(String token, org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request, String body) throws Exception {
    return mvc.perform(request.header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content(body));
  }
}
