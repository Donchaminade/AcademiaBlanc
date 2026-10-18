package tg.academiablanc.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
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
  void chargeLesMatieresEtLesCoefficientsParClasseSansEcraserLExistant() throws Exception {
    String token = inscrire("referentiel@ecole.tg", "Lycee Referentiel");
    long anneeId = json.readTree(lire(token, "/api/annees-scolaires")).get(0).get("id").asLong();

    // Une matière saisie à la main avant le chargement : elle est réutilisée (même code), pas dupliquée.
    long mathId = id(envoyer(token, post("/api/matieres"), "{\"nom\":\"Maths\",\"code\":\"MAT\"}"));
    long troisiemeId = id(envoyer(token, post("/api/classes"),
        "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"3ème A\",\"niveau\":\"3ème\"}"));
    long terminaleDId = id(envoyer(token, post("/api/classes"),
        "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"Terminale D\",\"niveau\":\"Terminale\",\"serie\":\"Série D\"}"));
    long premiereAId = id(envoyer(token, post("/api/classes"),
        "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"1ère A4\",\"niveau\":\"Première\"}"));
    // Coefficient déjà fixé par l'établissement : il doit être conservé tel quel.
    envoyer(token, post("/api/coefficients"),
        "{\"matiereId\":" + mathId + ",\"classeId\":" + terminaleDId + ",\"valeur\":7}");

    envoyer(token, post("/api/matieres/referentiel"), "{\"appliquerCoefficientsParDefaut\":true}")
        .andExpect(jsonPath("$.matieresCreees").value(6))
        .andExpect(jsonPath("$.matieresExistantes").value(1))
        .andExpect(jsonPath("$.coefficientsCrees").value(20))
        .andExpect(jsonPath("$.coefficientsExistants").value(1));

    JsonNode matieres = json.readTree(lire(token, "/api/matieres"));
    assertThat(matieres).hasSize(7);
    JsonNode maths = trouver(matieres, "code", "mat");
    assertThat(maths.get("id").asLong()).isEqualTo(mathId);
    assertThat(maths.get("nom").asText()).isEqualTo("Mathématiques");
    assertThat(maths.get("groupeCode").asText()).isEqualTo("SC");
    assertThat(maths.get("groupeLibelle").asText()).isEqualTo("Enseignements Scientifiques");
    assertThat(trouver(matieres, "code", "fr").get("groupeCode").asText()).isEqualTo("LT");

    JsonNode coefficients = json.readTree(lire(token, "/api/coefficients"));
    assertThat(coefficients).hasSize(21);
    long frId = trouver(matieres, "code", "fr").get("id").asLong();
    long svtId = trouver(matieres, "code", "svt").get("id").asLong();
    assertThat(valeur(coefficients, mathId, terminaleDId)).isEqualByComparingTo(BigDecimal.valueOf(7));
    assertThat(valeur(coefficients, svtId, terminaleDId)).isEqualByComparingTo(BigDecimal.valueOf(4));
    assertThat(valeur(coefficients, frId, troisiemeId)).isEqualByComparingTo(BigDecimal.valueOf(3));
    assertThat(valeur(coefficients, mathId, troisiemeId)).isEqualByComparingTo(BigDecimal.valueOf(3));
    assertThat(valeur(coefficients, frId, premiereAId)).isEqualByComparingTo(BigDecimal.valueOf(4));
    assertThat(valeur(coefficients, svtId, premiereAId)).isEqualByComparingTo(BigDecimal.ONE);

    // Relance sans corps : rien n'est recréé, tout est signalé comme existant.
    envoyer(token, post("/api/matieres/referentiel"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.matieresCreees").value(0))
        .andExpect(jsonPath("$.matieresExistantes").value(7))
        .andExpect(jsonPath("$.coefficientsCrees").value(0))
        .andExpect(jsonPath("$.coefficientsExistants").value(21));
    assertThat(json.readTree(lire(token, "/api/coefficients"))).hasSize(21);
  }

  @Test
  void surchargesEtCibleDeClassesSontRespectees() throws Exception {
    String token = inscrire("referentiel-cible@ecole.tg", "College Cible");
    long anneeId = json.readTree(lire(token, "/api/annees-scolaires")).get(0).get("id").asLong();
    long cinquiemeId = id(envoyer(token, post("/api/classes"),
        "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"5ème\",\"niveau\":\"5ème\"}"));
    envoyer(token, post("/api/classes"), "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"6ème\",\"niveau\":\"6ème\"}");

    envoyer(token, post("/api/matieres/referentiel"),
        "{\"classes\":[{\"classeId\":" + cinquiemeId + "}],\"coefficients\":{\"FR\":{\"" + cinquiemeId + "\":2.5}}}")
        .andExpect(jsonPath("$.matieresCreees").value(7))
        .andExpect(jsonPath("$.coefficientsCrees").value(7));

    JsonNode matieres = json.readTree(lire(token, "/api/matieres"));
    JsonNode coefficients = json.readTree(lire(token, "/api/coefficients"));
    assertThat(coefficients).hasSize(7);
    long frId = trouver(matieres, "code", "fr").get("id").asLong();
    assertThat(valeur(coefficients, frId, cinquiemeId)).isEqualByComparingTo(new BigDecimal("2.5"));

    // Coefficient hors bornes refusé, et rien d'enregistré.
    mvc.perform(post("/api/matieres/referentiel").header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"appliquerCoefficientsParDefaut\":false,\"coefficients\":{\"mat\":{\"" + cinquiemeId + "\":25}}}"))
        .andExpect(status().isBadRequest());
    assertThat(json.readTree(lire(token, "/api/coefficients"))).hasSize(7);

    // Classe d'un autre établissement : introuvable.
    String autre = inscrire("referentiel-autre@ecole.tg", "Autre college");
    mvc.perform(post("/api/matieres/referentiel").header("Authorization", "Bearer " + autre)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"classes\":[{\"classeId\":" + cinquiemeId + "}]}"))
        .andExpect(status().isNotFound());
  }

  private static JsonNode trouver(JsonNode liste, String champ, String valeur) {
    for (JsonNode n : liste) {
      if (valeur.equals(n.get(champ).asText())) return n;
    }
    throw new AssertionError("Aucun élément avec " + champ + "=" + valeur);
  }

  private static BigDecimal valeur(JsonNode coefficients, long matiereId, long classeId) {
    List<BigDecimal> trouves = new ArrayList<>();
    for (JsonNode c : coefficients) {
      if (c.get("matiereId").asLong() == matiereId && !c.get("classeId").isNull() && c.get("classeId").asLong() == classeId) {
        trouves.add(c.get("valeur").decimalValue());
      }
    }
    assertThat(trouves).as("un seul coefficient pour matière %d / classe %d", matiereId, classeId).hasSize(1);
    return trouves.get(0);
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
