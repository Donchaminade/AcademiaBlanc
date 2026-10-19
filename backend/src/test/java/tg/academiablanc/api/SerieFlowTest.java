package tg.academiablanc.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tg.academiablanc.domain.FamilleSerie;

@SpringBootTest
@AutoConfigureMockMvc
class SerieFlowTest {
  @Autowired
  private MockMvc mvc;
  @Autowired
  private ObjectMapper json;

  @Test
  void laListeChargeLesSeriesParDefautParFamille() throws Exception {
    String token = inscrire("series-defaut@ecole.tg", "Lycee Series");

    JsonNode liste = json.readTree(lire(token, "/api/series"));
    assertThat(codes(liste, "GENERALE")).containsExactly("A4", "C", "D");
    assertThat(codes(liste, "TECHNIQUE")).containsExactly("G1", "G2", "G3", "F1", "F2", "F3", "F4");
    assertThat(liste.size()).isEqualTo(SerieService.DEFAUTS.size());

    // Recharger les défauts est idempotent : aucune série en double.
    envoyer(token, post("/api/series/defauts"), "{}").andExpect(status().isOk());
    assertThat(json.readTree(lire(token, "/api/series")).size()).isEqualTo(SerieService.DEFAUTS.size());
  }

  @Test
  void ajoutDuneSeriePersonnaliseePuisClasseDuLycee() throws Exception {
    String token = inscrire("series-f5@ecole.tg", "Lycee Technique F5");
    long anneeId = json.readTree(lire(token, "/api/annees-scolaires")).get(0).get("id").asLong();

    // Avant l'ajout, « Tle F5 » est refusée : la série n'existe pas pour l'établissement.
    envoyerBrut(token, post("/api/classes"), classe(anneeId, "Tle F5", "Tle", "F5"))
        .andExpect(status().isBadRequest());

    long serieId = id(envoyer(token, post("/api/series"),
        "{\"code\":\"f5\",\"libelle\":\"Fabrication mécanique\",\"famille\":\"TECHNIQUE\"}")
        .andExpect(jsonPath("$.code").value("F5"))
        .andExpect(jsonPath("$.famille").value(FamilleSerie.TECHNIQUE.name()))
        .andExpect(jsonPath("$.actif").value(true)));
    envoyerBrut(token, post("/api/series"), "{\"code\":\"F5\",\"libelle\":\"Doublon\",\"famille\":\"TECHNIQUE\"}")
        .andExpect(status().isConflict());

    long classeId = id(envoyer(token, post("/api/classes"), classe(anneeId, "Tle F5", "Tle", "f5"))
        .andExpect(jsonPath("$.serie").value("F5")));

    // Une série utilisée par une classe ne peut être ni supprimée ni renommée.
    envoyer(token, delete("/api/series/" + serieId)).andExpect(status().isConflict());
    envoyerBrut(token, put("/api/series/" + serieId), "{\"code\":\"F6\",\"libelle\":\"Fabrication\",\"famille\":\"TECHNIQUE\"}")
        .andExpect(status().isConflict());
    // Le libellé et la famille restent modifiables.
    envoyer(token, put("/api/series/" + serieId), "{\"code\":\"F5\",\"libelle\":\"Fabrication mécanique avancée\",\"famille\":\"TECHNIQUE\"}")
        .andExpect(jsonPath("$.libelle").value("Fabrication mécanique avancée"));

    // Un autre établissement ne voit pas F5 et ne peut pas l'utiliser.
    String autre = inscrire("series-autre@ecole.tg", "Autre lycee");
    assertThat(codes(json.readTree(lire(autre, "/api/series")), "TECHNIQUE")).doesNotContain("F5");
    envoyer(autre, get("/api/series/" + serieId)).andExpect(status().isNotFound());
    long autreAnnee = json.readTree(lire(autre, "/api/annees-scolaires")).get(0).get("id").asLong();
    envoyerBrut(autre, post("/api/classes"), classe(autreAnnee, "Tle F5", "Tle", "F5"))
        .andExpect(status().isBadRequest());

    // Une fois la classe supprimée, la série se supprime.
    envoyer(token, delete("/api/classes/" + classeId)).andExpect(status().isNoContent());
    envoyer(token, delete("/api/series/" + serieId)).andExpect(status().isNoContent());
    envoyer(token, get("/api/series/" + serieId)).andExpect(status().isNotFound());
  }

  @Test
  void collegeSansSerieEtLyceeAvecSerieObligatoire() throws Exception {
    String token = inscrire("series-college@ecole.tg", "College Lycee Mixte");
    long anneeId = json.readTree(lire(token, "/api/annees-scolaires")).get(0).get("id").asLong();

    envoyerBrut(token, post("/api/classes"), classe(anneeId, "3e A", "3e", "D"))
        .andExpect(status().isBadRequest());
    envoyer(token, post("/api/classes"), classe(anneeId, "3e", "Troisième", null))
        .andExpect(jsonPath("$.serie").doesNotExist());

    envoyerBrut(token, post("/api/classes"), classe(anneeId, "2nde", "2nde", null))
        .andExpect(status().isBadRequest());
    envoyer(token, post("/api/classes"), classe(anneeId, "2nde A4", "Seconde", "A4"))
        .andExpect(jsonPath("$.serie").value("A4"));
    envoyer(token, post("/api/classes"), classe(anneeId, "Tle G2", "Tle", "g2"))
        .andExpect(jsonPath("$.serie").value("G2"));
  }

  private static String classe(long anneeId, String nom, String niveau, String serie) {
    return "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"" + nom + "\",\"niveau\":\"" + niveau + "\""
        + (serie == null ? "" : ",\"serie\":\"" + serie + "\"") + "}";
  }

  private static List<String> codes(JsonNode liste, String famille) {
    List<String> codes = new ArrayList<>();
    for (JsonNode item : liste) {
      if (famille.equals(item.get("famille").asText())) codes.add(item.get("code").asText());
    }
    return codes;
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
    return envoyer(token, get(path)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
  }

  private ResultActions envoyer(String token, MockHttpServletRequestBuilder request) throws Exception {
    return mvc.perform(request.header("Authorization", "Bearer " + token));
  }

  private ResultActions envoyerBrut(String token, MockHttpServletRequestBuilder request, String body) throws Exception {
    return mvc.perform(request.header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content(body));
  }

  private ResultActions envoyer(String token, MockHttpServletRequestBuilder request, String body) throws Exception {
    return envoyerBrut(token, request, body).andExpect(status().isOk());
  }

  private long id(ResultActions actions) throws Exception {
    return json.readTree(actions.andReturn().getResponse().getContentAsString()).get("id").asLong();
  }
}
