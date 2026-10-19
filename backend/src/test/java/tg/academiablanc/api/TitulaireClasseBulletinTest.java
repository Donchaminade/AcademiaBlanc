package tg.academiablanc.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Le titulaire qui vise le bulletin est l'enseignant affecté à la classe de l'élève
 * ({@code classe.titulaire_id}), pas un réglage global de l'établissement : le bulletin expose
 * {@code titulaireNom}, null pour une classe sans titulaire, et un enseignant d'un autre
 * établissement ne peut pas être désigné.
 */
@SpringBootTest
@AutoConfigureMockMvc
class TitulaireClasseBulletinTest {
  @Autowired
  private MockMvc mvc;
  @Autowired
  private ObjectMapper json;

  @Test
  void leBulletinPorteLeTitulaireDeLaClasseDeLEleve() throws Exception {
    String token = inscrire("titulaire-3e@ecole.tg", "College Titulaire");
    long anneeId = json.readTree(lire(token, "/api/annees-scolaires")).get(0).get("id").asLong();
    long centreId = id(envoyer(token, post("/api/centres"), "{\"nom\":\"Centre\",\"code\":\"CT\",\"ville\":\"Lome\"}"));
    long sessionId = id(envoyer(token, post("/api/sessions"),
        "{\"anneeScolaireId\":" + anneeId + ",\"centreId\":" + centreId
            + ",\"nom\":\"BEPC BLANC\",\"typeExamen\":\"BEPC\",\"statut\":\"OUVERTE\"}"));
    long maths = id(envoyer(token, post("/api/matieres"), "{\"nom\":\"Mathématiques\",\"code\":\"MATH\"}"));

    long konan = id(envoyer(token, post("/api/professeurs"), "{\"nom\":\"M. KONAN Germain\",\"email\":\"konan@ecole.tg\"}"));
    long lawson = id(envoyer(token, post("/api/professeurs"), "{\"nom\":\"Mme LAWSON Ayélé\"}"));

    // 3e créée sans titulaire, puis titulaire désigné par PUT /api/classes/{id} (champ titulaireId) ; 4e sans titulaire.
    long troisieme = id(envoyer(token, post("/api/classes"),
        "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"3e\",\"niveau\":\"3e\"}"));
    long quatrieme = id(envoyer(token, post("/api/classes"),
        "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"4e\",\"niveau\":\"4e\"}"));
    envoyer(token, put("/api/classes/" + troisieme),
        "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"3e\",\"niveau\":\"3e\",\"titulaireId\":" + konan + "}")
        .andExpect(jsonPath("$.titulaireId").value(konan));
    envoyer(token, get("/api/classes/" + troisieme)).andExpect(jsonPath("$.titulaireId").value(konan));

    long eleve3e = id(envoyer(token, post("/api/eleves"),
        "{\"classeId\":" + troisieme + ",\"sessionId\":" + sessionId + ",\"nomComplet\":\"AKAKPO Ama\",\"genre\":\"F\",\"numeroTable\":1}"));
    long eleve4e = id(envoyer(token, post("/api/eleves"),
        "{\"classeId\":" + quatrieme + ",\"sessionId\":" + sessionId + ",\"nomComplet\":\"MENSAH Kossi\",\"genre\":\"M\",\"numeroTable\":2}"));
    for (long eleve : new long[] {eleve3e, eleve4e}) {
      envoyer(token, post("/api/notes"),
          "{\"eleveId\":" + eleve + ",\"matiereId\":" + maths + ",\"sessionId\":" + sessionId + ",\"valeur\":12,\"absent\":false}");
    }

    JsonNode bulletins = json.readTree(envoyer(token, get("/api/bulletins").param("sessionId", String.valueOf(sessionId)))
        .andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString());
    assertEquals("M. KONAN Germain", parEleve(bulletins, eleve3e).get("titulaireNom").asText());
    assertTrue(parEleve(bulletins, eleve4e).get("titulaireNom").isNull(),
        "une classe sans titulaire laisse le visa à compléter : titulaireNom null");

    // Changement de titulaire : le bulletin suit l'affectation, sans autre réglage.
    envoyer(token, put("/api/classes/" + troisieme + "/titulaire"), "{\"professeurId\":" + lawson + "}")
        .andExpect(jsonPath("$.titulaireId").value(lawson));
    bulletins = json.readTree(envoyer(token, get("/api/bulletins").param("sessionId", String.valueOf(sessionId)))
        .andReturn().getResponse().getContentAsString());
    assertEquals("Mme LAWSON Ayélé", parEleve(bulletins, eleve3e).get("titulaireNom").asText());

    // Retrait du titulaire (titulaireId absent) : la classe redevient sans titulaire.
    envoyer(token, put("/api/classes/" + troisieme),
        "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"3e\",\"niveau\":\"3e\"}")
        .andExpect(jsonPath("$.titulaireId").isEmpty());
    bulletins = json.readTree(envoyer(token, get("/api/bulletins").param("sessionId", String.valueOf(sessionId)))
        .andReturn().getResponse().getContentAsString());
    assertTrue(parEleve(bulletins, eleve3e).get("titulaireNom").isNull());
  }

  @Test
  void unEnseignantDUnAutreEtablissementNePeutPasEtreTitulaire() throws Exception {
    String ecole = inscrire("titulaire-ecole@ecole.tg", "College Ecole");
    String voisin = inscrire("titulaire-voisin@ecole.tg", "College Voisin");
    long anneeId = json.readTree(lire(ecole, "/api/annees-scolaires")).get(0).get("id").asLong();
    long classe = id(envoyer(ecole, post("/api/classes"), "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"3e\",\"niveau\":\"3e\"}"));
    long profVoisin = id(envoyer(voisin, post("/api/professeurs"), "{\"nom\":\"M. AILLEURS\"}"));

    mvc.perform(put("/api/classes/" + classe).header("Authorization", "Bearer " + ecole)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"3e\",\"niveau\":\"3e\",\"titulaireId\":" + profVoisin + "}"))
        .andExpect(status().isNotFound());
    mvc.perform(put("/api/classes/" + classe + "/titulaire").header("Authorization", "Bearer " + ecole)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"professeurId\":" + profVoisin + "}"))
        .andExpect(status().isNotFound());
    mvc.perform(post("/api/classes").header("Authorization", "Bearer " + ecole)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"4e\",\"niveau\":\"4e\",\"titulaireId\":" + profVoisin + "}"))
        .andExpect(status().isNotFound());
    envoyer(ecole, get("/api/classes/" + classe)).andExpect(jsonPath("$.titulaireId").isEmpty());
  }

  private static JsonNode parEleve(JsonNode bulletins, long eleveId) {
    for (JsonNode b : bulletins) {
      if (b.get("eleveId").asLong() == eleveId) return b;
    }
    throw new AssertionError("Bulletin introuvable pour l’élève " + eleveId);
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
