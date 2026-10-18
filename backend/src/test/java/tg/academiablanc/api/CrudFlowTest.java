package tg.academiablanc.api;

import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class CrudFlowTest {
  @Autowired
  private MockMvc mvc;
  @Autowired
  private ObjectMapper json;

  @Test
  void creationLectureModificationSuppression() throws Exception {
    String token = inscrire("crud-complet@ecole.tg", "Lycee CRUD");
    long anneeId = json.readTree(lire(token, "/api/annees-scolaires")).get(0).get("id").asLong();

    long centreId = id(envoyer(token, post("/api/centres"),
        "{\"nom\":\"Centre Lome\",\"code\":\"C99\",\"ville\":\"Lome\"}"));
    envoyer(token, get("/api/centres/" + centreId))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value("C99"));
    envoyer(token, put("/api/centres/" + centreId),
        "{\"nom\":\"Centre Lome II\",\"code\":\"C99\",\"ville\":\"Lome\"}")
        .andExpect(jsonPath("$.nom").value("Centre Lome II"));

    long sessionId = id(envoyer(token, post("/api/sessions"),
        "{\"anneeScolaireId\":" + anneeId + ",\"centreId\":" + centreId
            + ",\"nom\":\"Session CRUD\",\"typeExamen\":\"BAC II\",\"statut\":\"OUVERTE\"}"));
    envoyer(token, delete("/api/centres/" + centreId)).andExpect(status().isConflict());

    long matiereId = id(envoyer(token, post("/api/matieres"), "{\"nom\":\"Mathématiques\",\"code\":\"math\"}"));
    envoyer(token, put("/api/matieres/" + matiereId), "{\"nom\":\"Maths\",\"code\":\"math\"}")
        .andExpect(jsonPath("$.nom").value("Maths"));
    long coefId = id(envoyer(token, post("/api/coefficients"),
        "{\"matiereId\":" + matiereId + ",\"valeur\":4}"));
    envoyer(token, put("/api/coefficients/" + coefId),
        "{\"matiereId\":" + matiereId + ",\"valeur\":3}")
        .andExpect(jsonPath("$.valeur").value(3));

    long profId = id(envoyer(token, post("/api/professeurs"), "{\"nom\":\"M. Konan\",\"email\":\"konan@ecole.tg\"}"));
    long classeId = id(envoyer(token, post("/api/classes"),
        "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"Terminale D\",\"niveau\":\"Terminale\",\"serie\":\"Série D\",\"titulaireId\":" + profId + "}"));
    envoyer(token, get("/api/classes/" + classeId))
        .andExpect(jsonPath("$.titulaireId").value(profId));
    long affectationId = id(envoyer(token, post("/api/affectations"),
        "{\"professeurId\":" + profId + ",\"matiereId\":" + matiereId + ",\"classeId\":" + classeId + "}"));

    long eleveId = id(envoyer(token, post("/api/eleves"),
        "{\"classeId\":" + classeId + ",\"sessionId\":" + sessionId
            + ",\"nomComplet\":\"CISSE Fatoumata\",\"genre\":\"F\",\"numeroTable\":12}"));
    envoyer(token, put("/api/eleves/" + eleveId),
        "{\"classeId\":" + classeId + ",\"sessionId\":" + sessionId
            + ",\"nomComplet\":\"CISSE Fatou\",\"genre\":\"F\",\"numeroTable\":12}")
        .andExpect(jsonPath("$.nomComplet").value("CISSE Fatou"))
        .andExpect(jsonPath("$.matricule", matchesPattern("24-LYCE-LOME-[0-9-]+-00001")));
    long noteId = id(envoyer(token, post("/api/notes"),
        "{\"eleveId\":" + eleveId + ",\"matiereId\":" + matiereId + ",\"sessionId\":" + sessionId + ",\"valeur\":14.5,\"absent\":false}"));
    envoyer(token, get("/api/notes/" + noteId)).andExpect(jsonPath("$.valeur").value(14.5));
    envoyer(token, put("/api/notes/" + noteId),
        "{\"eleveId\":" + eleveId + ",\"matiereId\":" + matiereId + ",\"sessionId\":" + sessionId + ",\"valeur\":15,\"absent\":false}")
        .andExpect(jsonPath("$.valeur").value(15));

    String autre = inscrire("crud-autre@ecole.tg", "Autre lycee");
    envoyer(autre, get("/api/centres/" + centreId)).andExpect(status().isNotFound());

    envoyer(token, delete("/api/notes/" + noteId)).andExpect(status().isNoContent());
    envoyer(token, get("/api/notes/" + noteId)).andExpect(status().isNotFound());
    envoyer(token, delete("/api/eleves/" + eleveId)).andExpect(status().isNoContent());
    envoyer(token, delete("/api/affectations/" + affectationId)).andExpect(status().isNoContent());
    envoyer(token, delete("/api/classes/" + classeId)).andExpect(status().isNoContent());
    envoyer(token, delete("/api/professeurs/" + profId)).andExpect(status().isNoContent());
    envoyer(token, delete("/api/coefficients/" + coefId)).andExpect(status().isNoContent());
    envoyer(token, delete("/api/matieres/" + matiereId)).andExpect(status().isNoContent());
    envoyer(token, delete("/api/sessions/" + sessionId)).andExpect(status().isNoContent());
    envoyer(token, delete("/api/centres/" + centreId)).andExpect(status().isNoContent());
    envoyer(token, get("/api/centres/" + centreId)).andExpect(status().isNotFound());
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

  private org.springframework.test.web.servlet.ResultActions envoyer(String token, org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request) throws Exception {
    return mvc.perform(request.header("Authorization", "Bearer " + token));
  }

  private org.springframework.test.web.servlet.ResultActions envoyer(String token, org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request, String body) throws Exception {
    return mvc.perform(request.header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content(body))
        .andExpect(status().isOk());
  }

  private long id(org.springframework.test.web.servlet.ResultActions actions) throws Exception {
    MvcResult result = actions.andReturn();
    JsonNode node = json.readTree(result.getResponse().getContentAsString());
    return node.get("id").asLong();
  }
}
