package tg.academiablanc.api;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
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

/** Suppression d'une année scolaire : règles métier, messages en français et cloisonnement. */
@SpringBootTest
@AutoConfigureMockMvc
class SuppressionAnneeTest {
  @Autowired
  private MockMvc mvc;
  @Autowired
  private ObjectMapper json;

  @Test
  void leResponsableSupprimeUneAnneeSansRattachement() throws Exception {
    String token = inscrire("annee-libre@ecole.tg", "CS Harmonia Libre");
    long libre = creerAnnee(token, "2026-2027");

    envoyer(token, delete("/api/annees-scolaires/" + libre)).andExpect(status().isNoContent());
    envoyer(token, get("/api/annees-scolaires/" + libre))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.message").value("Ressource introuvable."));
  }

  @Test
  void uneAnneeAvecSessionEtClassesRenvoie409AvecLesComptes() throws Exception {
    String token = inscrire("annee-liee@ecole.tg", "CS Harmonia Liee");
    long annee = creerAnnee(token, "2025-2026");
    long centre = id(envoyer(token, post("/api/centres"), "{\"nom\":\"Centre Lome\",\"code\":\"C01\",\"ville\":\"Lome\"}"));
    envoyer(token, post("/api/sessions"),
        "{\"anneeScolaireId\":" + annee + ",\"centreId\":" + centre + ",\"nom\":\"BAC 2026\",\"typeExamen\":\"BAC II\",\"statut\":\"OUVERTE\"}");
    envoyer(token, post("/api/classes"), "{\"anneeScolaireId\":" + annee + ",\"nom\":\"Tle D1\",\"niveau\":\"Terminale\"}");
    envoyer(token, post("/api/classes"), "{\"anneeScolaireId\":" + annee + ",\"nom\":\"Tle D2\",\"niveau\":\"Terminale\"}");

    envoyer(token, delete("/api/annees-scolaires/" + annee))
        .andExpect(status().isConflict())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$.message").value(
            "Impossible de supprimer l'année 2025-2026 : 1 session et 2 classes y sont rattachées. "
                + "Supprimez-les ou rattachez-les à une autre année d'abord."));

    // L'année est toujours là.
    envoyer(token, get("/api/annees-scolaires/" + annee)).andExpect(status().isOk());
  }

  @Test
  void lAnneeCouranteNeSeSupprimePasTantQuUneAutreNEstPasCourante() throws Exception {
    String token = inscrire("annee-courante@ecole.tg", "CS Harmonia Courante");
    long courante = idAnneeCourante(token);
    long autre = creerAnnee(token, "2026-2027");

    envoyer(token, delete("/api/annees-scolaires/" + courante))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.message").value(AnneeDependances.MESSAGE_ANNEE_COURANTE));

    // Bascule de l'année courante puis suppression de l'ancienne.
    envoyer(token, put("/api/annees-scolaires/" + autre + "/courante"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.courante").value(true));
    envoyer(token, get("/api/annees-scolaires/" + courante)).andExpect(jsonPath("$.courante").value(false));
    envoyer(token, delete("/api/annees-scolaires/" + courante)).andExpect(status().isNoContent());
  }

  @Test
  void unAutreEtablissementNeVoitNiNeSupprimeLAnnee() throws Exception {
    String harmonia = inscrire("annee-harmonia@ecole.tg", "CS Harmonia");
    String intrus = inscrire("annee-intrus@ecole.tg", "Autre college");
    long annee = creerAnnee(harmonia, "2026-2027");

    envoyer(intrus, delete("/api/annees-scolaires/" + annee))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.message").value("Ressource introuvable."));
    envoyer(intrus, put("/api/annees-scolaires/" + annee + "/courante")).andExpect(status().isNotFound());
    envoyer(harmonia, get("/api/annees-scolaires/" + annee)).andExpect(status().isOk());
  }

  @Test
  void lesRefusDeSecuriteOntUnCorpsJson() throws Exception {
    mvc.perform(delete("/api/annees-scolaires/1"))
        .andExpect(status().isForbidden())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$.message", containsString("Authentification requise")));
  }

  @Test
  void laSuppressionDUnCentreUtiliseRenvoie409Explicite() throws Exception {
    String token = inscrire("centre-lie@ecole.tg", "CS Harmonia Centre");
    long annee = creerAnnee(token, "2026-2027");
    long centre = id(envoyer(token, post("/api/centres"), "{\"nom\":\"Centre Kara\",\"code\":\"C02\",\"ville\":\"Kara\"}"));
    envoyer(token, post("/api/sessions"),
        "{\"anneeScolaireId\":" + annee + ",\"centreId\":" + centre + ",\"nom\":\"BAC 2027\",\"typeExamen\":\"BAC II\",\"statut\":\"OUVERTE\"}");

    envoyer(token, delete("/api/centres/" + centre))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.message", containsString("Suppression impossible")));
  }

  private long creerAnnee(String token, String libelle) throws Exception {
    return id(envoyer(token, post("/api/annees-scolaires"), "{\"libelle\":\"" + libelle + "\",\"courante\":false}"));
  }

  private long idAnneeCourante(String token) throws Exception {
    JsonNode liste = json.readTree(envoyer(token, get("/api/annees-scolaires")).andReturn().getResponse().getContentAsString());
    for (JsonNode annee : liste) {
      if (annee.get("courante").asBoolean()) return annee.get("id").asLong();
    }
    throw new AssertionError("Aucune année courante après l'inscription");
  }

  private String inscrire(String email, String nom) throws Exception {
    String raw = mvc.perform(post("/api/auth/signup")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"nom\":\"" + nom + "\",\"ville\":\"Lome\",\"email\":\"" + email
                + "\",\"motDePasse\":\"secret1\",\"nomResponsable\":\"Direction\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.role").value("OWNER"))
        .andReturn().getResponse().getContentAsString();
    return json.readTree(raw).get("token").asText();
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
