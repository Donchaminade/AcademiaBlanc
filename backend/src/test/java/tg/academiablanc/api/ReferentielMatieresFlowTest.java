package tg.academiablanc.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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

@SpringBootTest
@AutoConfigureMockMvc
class ReferentielMatieresFlowTest {
  @Autowired
  private MockMvc mvc;
  @Autowired
  private ObjectMapper json;

  @Test
  void chargeSeulementLesMatieresDuCatalogueSansCoefficient() throws Exception {
    String token = inscrire("referentiel@ecole.tg", "Lycee Referentiel");
    long anneeId = json.readTree(lire(token, "/api/annees-scolaires")).get(0).get("id").asLong();

    // Une matière saisie à la main avant le chargement : elle est réutilisée (même code), pas dupliquée.
    long mathId = id(envoyer(token, post("/api/matieres"), "{\"nom\":\"Maths\",\"code\":\"MAT\"}"));
    // Des classes existent : le référentiel ne leur affecte plus rien automatiquement.
    envoyer(token, post("/api/classes"), "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"3ème A\",\"niveau\":\"3ème\"}");
    envoyer(token, post("/api/classes"),
        "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"Terminale D\",\"niveau\":\"Terminale\",\"serie\":\"D\"}");

    envoyer(token, post("/api/matieres/referentiel"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.matieresCreees").value(6))
        .andExpect(jsonPath("$.matieresExistantes").value(1))
        .andExpect(jsonPath("$.coefficientsCrees").doesNotExist());

    JsonNode matieres = json.readTree(lire(token, "/api/matieres"));
    assertThat(matieres).hasSize(7);
    JsonNode maths = trouver(matieres, "code", "mat");
    assertThat(maths.get("id").asLong()).isEqualTo(mathId);
    assertThat(maths.get("nom").asText()).isEqualTo("Mathématiques");
    assertThat(maths.get("groupeCode").asText()).isEqualTo("SC");
    assertThat(maths.get("groupeLibelle").asText()).isEqualTo("Enseignements Scientifiques");
    assertThat(trouver(matieres, "code", "fr").get("groupeCode").asText()).isEqualTo("LT");

    // Aucun coefficient créé : les classes n'ont pas encore de programme.
    assertThat(json.readTree(lire(token, "/api/coefficients"))).isEmpty();

    // Un ancien client qui envoie encore un corps n'est pas gêné ; relancer ne recrée rien.
    envoyer(token, post("/api/matieres/referentiel"), "{\"appliquerCoefficientsParDefaut\":true}")
        .andExpect(jsonPath("$.matieresCreees").value(0))
        .andExpect(jsonPath("$.matieresExistantes").value(7));
    assertThat(json.readTree(lire(token, "/api/matieres"))).hasSize(7);
    assertThat(json.readTree(lire(token, "/api/coefficients"))).isEmpty();
  }

  private static JsonNode trouver(JsonNode liste, String champ, String valeur) {
    for (JsonNode n : liste) {
      if (valeur.equals(n.get(champ).asText())) return n;
    }
    throw new AssertionError("Aucun élément avec " + champ + "=" + valeur);
  }

  private String inscrire(String email, String nom) throws Exception {
    String raw = mvc.perform(post("/api/auth/signup")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"nom\":\"" + nom + "\",\"ville\":\"Lome\",\"email\":\"" + email
                + "\",\"motDePasse\":\"secret1\",\"nomResponsable\":\"Proviseur Test\",\"acceptationConditions\":true}"))
        .andExpect(status().isCreated())
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
