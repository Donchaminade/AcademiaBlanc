package tg.academiablanc.api;

import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Appréciation du professeur sur chaque ligne du bulletin : calculée sur la note de la matière
 * (et non sur la moyenne générale), remplaçable par un texte libre saisi avec la note, rétablie
 * à l'automatique quand ce texte est vidé.
 */
@SpringBootTest
@AutoConfigureMockMvc
class AppreciationFlowTest {
  @Autowired
  private MockMvc mvc;
  @Autowired
  private ObjectMapper json;

  @Test
  void chaqueMatiereRecoitSonAppreciationSelonSaNote() throws Exception {
    String token = inscrire("appreciation-bareme@ecole.tg", "College Appreciation");
    long anneeId = json.readTree(lire(token, "/api/annees-scolaires")).get(0).get("id").asLong();
    long centreId = id(envoyer(token, post("/api/centres"), "{\"nom\":\"Centre\",\"code\":\"CA\",\"ville\":\"Lome\"}"));
    long sessionId = id(envoyer(token, post("/api/sessions"),
        "{\"anneeScolaireId\":" + anneeId + ",\"centreId\":" + centreId
            + ",\"nom\":\"BEPC BLANC\",\"typeExamen\":\"BEPC\",\"statut\":\"OUVERTE\"}"));
    long classe = id(envoyer(token, post("/api/classes"), "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"3e\",\"niveau\":\"3e\"}"));
    long eleve = id(envoyer(token, post("/api/eleves"),
        "{\"classeId\":" + classe + ",\"sessionId\":" + sessionId + ",\"nomComplet\":\"DOSSOU Afi\",\"genre\":\"F\",\"numeroTable\":1}"));

    String[] codes = {"M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9"};
    String[] notes = {"4", "7", "9", "11", "13", "15", "17", "19", null};
    String[] attendues = {"Très insuffisant", "Insuffisant", "Mauvais", "Passable", "Assez bien", "Bien", "Très bien", "Excellent", "Absent"};
    long[] matieres = new long[codes.length];
    for (int i = 0; i < codes.length; i++) {
      matieres[i] = id(envoyer(token, post("/api/matieres"), "{\"nom\":\"Matière " + codes[i] + "\",\"code\":\"" + codes[i] + "\"}"));
      String corps = notes[i] == null
          ? "{\"eleveId\":" + eleve + ",\"matiereId\":" + matieres[i] + ",\"sessionId\":" + sessionId + ",\"absent\":true}"
          : "{\"eleveId\":" + eleve + ",\"matiereId\":" + matieres[i] + ",\"sessionId\":" + sessionId + ",\"valeur\":" + notes[i] + ",\"absent\":false}";
      envoyer(token, post("/api/notes"), corps);
    }

    JsonNode bulletin = json.readTree(lire(token, "/api/bulletins?sessionId=" + sessionId)).get(0);
    Set<String> distinctes = new HashSet<>();
    for (int i = 0; i < codes.length; i++) {
      String appreciation = parMatiere(bulletin, matieres[i]).get("appreciation").asText();
      assertEquals(attendues[i], appreciation, "matière " + codes[i] + " notée " + notes[i]);
      distinctes.add(appreciation);
    }
    assertEquals(9, distinctes.size());
    // Moyenne des huit notes présentes = 95 / 8 = 11,88 : appréciation générale et mention cohérentes.
    assertEquals("Passable", bulletin.get("appreciation").asText());
    assertEquals("PASSABLE", bulletin.get("mention").asText());
  }

  @Test
  void leTexteLibreDeLEnseignantRemplaceLAutomatiquePuisSeRetablit() throws Exception {
    String token = inscrire("appreciation-manuelle@ecole.tg", "College Manuel");
    long anneeId = json.readTree(lire(token, "/api/annees-scolaires")).get(0).get("id").asLong();
    long centreId = id(envoyer(token, post("/api/centres"), "{\"nom\":\"Centre\",\"code\":\"CM\",\"ville\":\"Lome\"}"));
    long sessionId = id(envoyer(token, post("/api/sessions"),
        "{\"anneeScolaireId\":" + anneeId + ",\"centreId\":" + centreId
            + ",\"nom\":\"BEPC BLANC\",\"typeExamen\":\"BEPC\",\"statut\":\"OUVERTE\"}"));
    long classe = id(envoyer(token, post("/api/classes"), "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"3e\",\"niveau\":\"3e\"}"));
    long eleve = id(envoyer(token, post("/api/eleves"),
        "{\"classeId\":" + classe + ",\"sessionId\":" + sessionId + ",\"nomComplet\":\"MENSAH Kossi\",\"genre\":\"M\",\"numeroTable\":2}"));
    long matiere = id(envoyer(token, post("/api/matieres"), "{\"nom\":\"Anglais\",\"code\":\"ANG\"}"));
    String base = "\"eleveId\":" + eleve + ",\"matiereId\":" + matiere + ",\"sessionId\":" + sessionId;

    // Note seule : appréciation automatique.
    envoyer(token, post("/api/notes"), "{" + base + ",\"valeur\":7,\"absent\":false}")
        .andExpect(jsonPath("$.appreciation").value(nullValue()));
    assertEquals("Insuffisant", premiereLigne(token, sessionId).get("appreciation").asText());

    // Texte libre : enregistré compacté et porté sur le bulletin.
    envoyer(token, post("/api/notes"), "{" + base + ",\"valeur\":7,\"absent\":false,\"appreciation\":\"  Des progrès   à l'oral.  \"}")
        .andExpect(jsonPath("$.appreciation").value("Des progrès à l'oral."));
    assertEquals("Des progrès à l'oral.", premiereLigne(token, sessionId).get("appreciation").asText());

    // Nouvelle note sans champ appreciation : le texte libre est conservé.
    envoyer(token, post("/api/notes"), "{" + base + ",\"valeur\":12,\"absent\":false}")
        .andExpect(jsonPath("$.appreciation").value("Des progrès à l'oral."));

    // Texte vidé : retour à l'automatique (sur la nouvelle note).
    envoyer(token, post("/api/notes"), "{" + base + ",\"valeur\":12,\"absent\":false,\"appreciation\":\"\"}")
        .andExpect(jsonPath("$.appreciation").value(nullValue()));
    assertEquals("Assez bien", premiereLigne(token, sessionId).get("appreciation").asText());

    // Plus de 60 caractères : refusé.
    mvc.perform(post("/api/notes").header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
            .content("{" + base + ",\"valeur\":12,\"absent\":false,\"appreciation\":\"" + "a".repeat(61) + "\"}"))
        .andExpect(status().isBadRequest());
  }

  private JsonNode premiereLigne(String token, long sessionId) throws Exception {
    return json.readTree(lire(token, "/api/bulletins?sessionId=" + sessionId)).get(0).get("lignes").get(0);
  }

  private static JsonNode parMatiere(JsonNode bulletin, long matiereId) {
    for (JsonNode ligne : bulletin.get("lignes")) {
      if (ligne.get("matiereId").asLong() == matiereId) return ligne;
    }
    throw new AssertionError("Ligne introuvable pour la matière " + matiereId);
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
    return envoyer(token, get(path)).andReturn().getResponse().getContentAsString();
  }

  private ResultActions envoyer(String token, MockHttpServletRequestBuilder request) throws Exception {
    return mvc.perform(request.header("Authorization", "Bearer " + token));
  }

  private ResultActions envoyer(String token, MockHttpServletRequestBuilder request, String body) throws Exception {
    return mvc.perform(request.header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content(body))
        .andExpect(status().isOk());
  }

  private long id(ResultActions actions) throws Exception {
    return json.readTree(actions.andReturn().getResponse().getContentAsString()).get("id").asLong();
  }
}
