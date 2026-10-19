package tg.academiablanc.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Délibération du jury enregistrée sur le serveur par élève et par session : le bonus de repêchage
 * s'ajoute à la moyenne du bulletin, l'observation et la signature sont relues telles quelles, et un
 * autre établissement ne voit rien. L'écriture exige BULLETINS:CREER.
 */
@SpringBootTest
@AutoConfigureMockMvc
class DeliberationFlowTest {
  @Autowired
  private MockMvc mvc;
  @Autowired
  private ObjectMapper json;

  @Test
  void bonusObservationEtSignatureSontPersistesEtRepercutesSurLeBulletin() throws Exception {
    String token = inscrire("delib-owner@ecole.tg", "Lycee Deliberation");
    long anneeId = json.readTree(lire(token, "/api/annees-scolaires")).get(0).get("id").asLong();
    long centreId = id(envoyer(token, post("/api/centres"), "{\"nom\":\"Centre\",\"code\":\"CD\",\"ville\":\"Lome\"}"));
    long sessionId = id(envoyer(token, post("/api/sessions"),
        "{\"anneeScolaireId\":" + anneeId + ",\"centreId\":" + centreId
            + ",\"nom\":\"BAC BLANC\",\"typeExamen\":\"BAC\",\"statut\":\"OUVERTE\"}"));
    long maths = id(envoyer(token, post("/api/matieres"), "{\"nom\":\"Mathématiques\",\"code\":\"MATH\"}"));
    long classe = id(envoyer(token, post("/api/classes"),
        "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"3e\",\"niveau\":\"3e\"}"));
    long eleve = id(envoyer(token, post("/api/eleves"),
        "{\"classeId\":" + classe + ",\"sessionId\":" + sessionId + ",\"nomComplet\":\"AKAKPO Ama\",\"genre\":\"F\",\"numeroTable\":1}"));
    envoyer(token, post("/api/notes"),
        "{\"eleveId\":" + eleve + ",\"matiereId\":" + maths + ",\"sessionId\":" + sessionId + ",\"valeur\":9.75,\"absent\":false}");

    // Aucune délibération au départ ; le bulletin affiche la moyenne brute.
    assertEquals(0, json.readTree(lire(token, "/api/deliberations?sessionId=" + sessionId)).size());
    assertNombre(parEleve(json.readTree(lire(token, "/api/bulletins?sessionId=" + sessionId)), eleve).get("moyenne"), 9.75);

    envoyer(token, put("/api/deliberations"),
        "{\"eleveId\":" + eleve + ",\"sessionId\":" + sessionId + ",\"bonusJury\":0.25,"
            + "\"observation\":\"Repêchage accordé au vu de l'assiduité.\"}")
        .andExpect(jsonPath("$.bonusJury").value(0.25))
        .andExpect(jsonPath("$.observation").value("Repêchage accordé au vu de l'assiduité."))
        .andExpect(jsonPath("$.signature").isEmpty());

    // Le bonus s'ajoute à la moyenne du bulletin calculé par le serveur (9,75 + 0,25 = 10,00).
    assertNombre(parEleve(json.readTree(lire(token, "/api/bulletins?sessionId=" + sessionId)), eleve).get("moyenne"), 10.0);

    // Un second enregistrement remplace le premier (une seule ligne par élève et par session) et ajoute la signature.
    envoyer(token, put("/api/deliberations"),
        "{\"eleveId\":" + eleve + ",\"sessionId\":" + sessionId + ",\"bonusJury\":0.5,\"observation\":\"Décision finale.\","
            + "\"signature\":{\"signeLe\":\"2026-06-01T10:00:00Z\",\"signataire\":\"Dr. Traoré (Le Proviseur)\",\"empreinte\":\"ABCDEF0123456789\"}}")
        .andExpect(jsonPath("$.bonusJury").value(0.5))
        .andExpect(jsonPath("$.signature.signataire").value("Dr. Traoré (Le Proviseur)"));
    JsonNode liste = json.readTree(lire(token, "/api/deliberations?sessionId=" + sessionId));
    assertEquals(1, liste.size());
    assertEquals(eleve, liste.get(0).get("eleveId").asLong());
    assertEquals("Décision finale.", liste.get(0).get("observation").asText());
    assertEquals("ABCDEF0123456789", liste.get(0).get("signature").get("empreinte").asText());
    assertNombre(parEleve(json.readTree(lire(token, "/api/bulletins?sessionId=" + sessionId)), eleve).get("moyenne"), 10.25);

    // Un bonus hors bornes ou un élève inconnu sont refusés.
    mvc.perform(put("/api/deliberations").header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"eleveId\":" + eleve + ",\"sessionId\":" + sessionId + ",\"bonusJury\":7}"))
        .andExpect(status().isBadRequest());
    mvc.perform(put("/api/deliberations").header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"eleveId\":999999,\"sessionId\":" + sessionId + ",\"bonusJury\":0.1}"))
        .andExpect(status().isNotFound());

    // Cloisonnement : un autre établissement ne lit pas cette session et ne peut pas délibérer sur cet élève.
    String autre = inscrire("delib-autre@ecole.tg", "Lycee Voisin");
    mvc.perform(get("/api/deliberations").param("sessionId", String.valueOf(sessionId))
            .header("Authorization", "Bearer " + autre))
        .andExpect(status().isNotFound());
    mvc.perform(put("/api/deliberations").header("Authorization", "Bearer " + autre)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"eleveId\":" + eleve + ",\"sessionId\":" + sessionId + ",\"bonusJury\":0.1}"))
        .andExpect(status().isNotFound());
    mvc.perform(get("/api/deliberations").param("sessionId", String.valueOf(sessionId))).andExpect(status().isForbidden());
  }

  @Test
  void ecritureReserveeAuDroitBulletinsCreer() throws Exception {
    String owner = inscrire("delib-droits@ecole.tg", "Lycee Droits");
    long anneeId = json.readTree(lire(owner, "/api/annees-scolaires")).get(0).get("id").asLong();
    long centreId = id(envoyer(owner, post("/api/centres"), "{\"nom\":\"Centre\",\"code\":\"CE\",\"ville\":\"Lome\"}"));
    long sessionId = id(envoyer(owner, post("/api/sessions"),
        "{\"anneeScolaireId\":" + anneeId + ",\"centreId\":" + centreId
            + ",\"nom\":\"BEPC BLANC\",\"typeExamen\":\"BEPC\",\"statut\":\"OUVERTE\"}"));
    long classe = id(envoyer(owner, post("/api/classes"),
        "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"3e\",\"niveau\":\"3e\"}"));
    long eleve = id(envoyer(owner, post("/api/eleves"),
        "{\"classeId\":" + classe + ",\"sessionId\":" + sessionId + ",\"nomComplet\":\"MENSAH Kossi\",\"genre\":\"M\"}"));

    // Enseignant : préréglage BULLETINS:VOIR seulement → lecture possible, délibération refusée.
    mvc.perform(post("/api/utilisateurs").header("Authorization", "Bearer " + owner)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"nom\":\"Prof\",\"email\":\"delib-prof@ecole.tg\",\"motDePasse\":\"temp123\",\"role\":\"ENSEIGNANT\"}"))
        .andExpect(status().isCreated());
    String prof = json.readTree(mvc.perform(post("/api/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"delib-prof@ecole.tg\",\"motDePasse\":\"temp123\"}"))
        .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("token").asText();

    mvc.perform(get("/api/deliberations").param("sessionId", String.valueOf(sessionId))
            .header("Authorization", "Bearer " + prof))
        .andExpect(status().isOk());
    mvc.perform(put("/api/deliberations").header("Authorization", "Bearer " + prof)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"eleveId\":" + eleve + ",\"sessionId\":" + sessionId + ",\"bonusJury\":0.1}"))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.message").value("Action non autorisée : CREER sur BULLETINS"));
  }

  private static JsonNode parEleve(JsonNode bulletins, long eleveId) {
    for (JsonNode b : bulletins) {
      if (b.get("eleveId").asLong() == eleveId) return b;
    }
    throw new AssertionError("Bulletin introuvable pour l’élève " + eleveId);
  }

  private static void assertNombre(JsonNode valeur, double attendu) {
    BigDecimal lu = valeur.decimalValue();
    assertEquals(0, BigDecimal.valueOf(attendu).compareTo(lu), () -> "attendu " + attendu + " mais lu " + lu);
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
    return mvc.perform(get(path).header("Authorization", "Bearer " + token))
        .andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString();
  }

  private ResultActions envoyer(String token, MockHttpServletRequestBuilder request, String body) throws Exception {
    return mvc.perform(request.header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content(body))
        .andExpect(status().isOk());
  }

  private long id(ResultActions actions) throws Exception {
    return json.readTree(actions.andReturn().getResponse().getContentAsString()).get("id").asLong();
  }
}
