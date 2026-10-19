package tg.academiablanc.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
import tg.academiablanc.domain.Etablissement;

@SpringBootTest
@AutoConfigureMockMvc
class MatriculeTest {
  /** Année scolaire créée à l'inscription : 2024-2025 → préfixe « 24- ». */
  private static final String FORMAT = "24-[A-Z0-9-]+-\\d{5}";

  @Autowired
  private MockMvc mvc;
  @Autowired
  private ObjectMapper json;

  @Test
  void attribueDesMatriculesSequentielsALaCreationUnitaire() throws Exception {
    String token = inscrire("matricule-unitaire@ecole.tg", "Complexe Scolaire Horizon");
    long classeId = creerClasse(token, "Terminale D");

    JsonNode premier = creer(token, classeId, "ABALO Kossi", "M");
    JsonNode second = creer(token, classeId, "BONFOH Akouvi", "F");

    String prefixe = "24-COMP-LOME-";
    assertThat(premier.get("matricule").asText()).matches(FORMAT).startsWith(prefixe).endsWith("-00001");
    assertThat(second.get("matricule").asText()).matches(FORMAT).startsWith(prefixe).endsWith("-00002");
    assertThat(premier.get("matricule").asText()).isNotEqualTo(second.get("matricule").asText());
  }

  @Test
  void ignoreLeMatriculeFourniParLeClientEtLeFigeEnModification() throws Exception {
    String token = inscrire("matricule-fige@ecole.tg", "Lycee Verrouille");
    long classeId = creerClasse(token, "Seconde A");

    JsonNode cree = json.readTree(envoyer(token, post("/api/eleves"),
        "{\"classeId\":" + classeId + ",\"nomComplet\":\"DOSSOU Yawa\",\"genre\":\"F\",\"matricule\":\"TRICHE-999\"}")
        .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    String attribue = cree.get("matricule").asText();
    assertThat(attribue).matches(FORMAT).isNotEqualTo("TRICHE-999");

    long id = cree.get("id").asLong();
    JsonNode modifie = json.readTree(envoyer(token, put("/api/eleves/" + id),
        "{\"classeId\":" + classeId + ",\"nomComplet\":\"DOSSOU Yawa Rose\",\"genre\":\"F\",\"matricule\":\"AUTRE-1\"}")
        .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    assertThat(modifie.get("nomComplet").asText()).isEqualTo("DOSSOU Yawa Rose");
    assertThat(modifie.get("matricule").asText()).isEqualTo(attribue);
    assertThat(json.readTree(lire(token, "/api/eleves/" + id)).get("matricule").asText()).isEqualTo(attribue);
  }

  @Test
  void importEtCreationPartagentLaMemeSequenceEtChaqueEtablissementALaSienne() throws Exception {
    String token = inscrire("matricule-import@ecole.tg", "College Sequence");
    String autre = inscrire("matricule-autre@ecole.tg", "Institut Sequence");

    StringBuilder corps = new StringBuilder("{\"classeNom\":\"3e\",\"eleves\":[");
    for (int i = 1; i <= 11; i++) {
      if (i > 1) corps.append(',');
      corps.append("{\"nomComplet\":\"ELEVE Numero ").append(i).append("\",\"genre\":\"").append(i % 2 == 0 ? "F" : "M").append("\"}");
    }
    corps.append("]}");
    envoyer(token, post("/api/eleves/import"), corps.toString()).andExpect(status().isOk());

    JsonNode eleves = json.readTree(lire(token, "/api/eleves"));
    assertThat(eleves).hasSize(11);
    List<String> matricules = new ArrayList<>();
    for (JsonNode eleve : eleves) matricules.add(eleve.get("matricule").asText());
    assertThat(matricules).doesNotHaveDuplicates().allMatch(m -> m.matches(FORMAT));
    String prefixe = matricules.get(0).substring(0, matricules.get(0).length() - 5);
    assertThat(matricules).allMatch(m -> m.startsWith(prefixe));
    List<String> attendus = new ArrayList<>();
    for (int i = 1; i <= 11; i++) attendus.add(prefixe + String.format("%05d", i));
    assertThat(matricules).containsExactlyInAnyOrderElementsOf(attendus);

    // Une inscription unitaire après l'import poursuit la même séquence.
    long classeId = json.readTree(lire(token, "/api/classes")).get(0).get("id").asLong();
    JsonNode douzieme = creer(token, classeId, "ZOUMARO Dede", "F");
    assertThat(douzieme.get("matricule").asText()).isEqualTo(prefixe + "00012");

    // L'autre établissement démarre sa propre séquence à 00001, avec son propre code.
    long autreClasse = creerClasse(autre, "3e");
    JsonNode premierAutre = creer(autre, autreClasse, "AMEGAN Koffi", "M");
    assertThat(premierAutre.get("matricule").asText()).matches(FORMAT).endsWith("-00001").doesNotStartWith(prefixe);
  }

  @Test
  void nettoieLeCodeEtablissementPourLePrefixe() {
    Etablissement etab = new Etablissement();
    etab.setCode(" Collège Épi-01 ");
    etab.setNom("Collège Épi");
    assertThat(MatriculeService.codeEtablissement(etab)).isEqualTo("COLLEGEEPI-01");

    etab.setCode("  ");
    assertThat(MatriculeService.codeEtablissement(etab)).isEqualTo("COLL");

    etab.setNom("---");
    assertThat(MatriculeService.codeEtablissement(etab)).isEqualTo("ETAB");
  }

  private JsonNode creer(String token, long classeId, String nom, String genre) throws Exception {
    return json.readTree(envoyer(token, post("/api/eleves"),
        "{\"classeId\":" + classeId + ",\"nomComplet\":\"" + nom + "\",\"genre\":\"" + genre + "\"}")
        .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
  }

  private long creerClasse(String token, String nom) throws Exception {
    long anneeId = json.readTree(lire(token, "/api/annees-scolaires")).get(0).get("id").asLong();
    return json.readTree(envoyer(token, post("/api/classes"),
        "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"" + nom + "\",\"niveau\":\"" + nom + "\"}")
        .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asLong();
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

  private ResultActions envoyer(String token, org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request) throws Exception {
    return mvc.perform(request.header("Authorization", "Bearer " + token));
  }

  private ResultActions envoyer(String token, org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request, String body) throws Exception {
    return mvc.perform(request.header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content(body));
  }
}
