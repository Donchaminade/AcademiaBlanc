package tg.academiablanc.api;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** Archives des sessions : liste vide pour un établissement neuf, statistiques réelles après archivage. */
@SpringBootTest
@AutoConfigureMockMvc
class ArchivesFlowTest {
  @Autowired
  private MockMvc mvc;
  @Autowired
  private ObjectMapper json;

  @Test
  void unEtablissementSansArchiveRecoitUneListeVide() throws Exception {
    String token = inscrire("archives-vide@ecole.tg", "Lycee Sans Archive");

    envoyer(token, get("/api/archives"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$", hasSize(0)));
  }

  @Test
  void uneSessionOuverteNApparaitPasAvantArchivage() throws Exception {
    String token = inscrire("archives-ouverte@ecole.tg", "Lycee Session Ouverte");
    long anneeId = json.readTree(lire(token, "/api/annees-scolaires")).get(0).get("id").asLong();
    long centreId = id(envoyer(token, post("/api/centres"), "{\"nom\":\"Centre Nord\",\"code\":\"CN1\",\"ville\":\"Kara\"}"));
    envoyer(token, post("/api/sessions"),
        "{\"anneeScolaireId\":" + anneeId + ",\"centreId\":" + centreId
            + ",\"nom\":\"BAC Blanc 2025\",\"typeExamen\":\"BAC II\",\"serie\":\"D\",\"statut\":\"OUVERTE\"}");

    envoyer(token, get("/api/archives"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$", hasSize(0)));
  }

  @Test
  void archiverUneSessionCalculeEffectifAdmisEtTauxDepuisLesNotes() throws Exception {
    String token = inscrire("archives-notes@ecole.tg", "Lycee Avec Notes");
    long anneeId = json.readTree(lire(token, "/api/annees-scolaires")).get(0).get("id").asLong();
    long centreId = id(envoyer(token, post("/api/centres"), "{\"nom\":\"Centre Sud\",\"code\":\"CS1\",\"ville\":\"Lome\"}"));
    long sessionId = id(envoyer(token, post("/api/sessions"),
        "{\"anneeScolaireId\":" + anneeId + ",\"centreId\":" + centreId
            + ",\"nom\":\"BAC Blanc 2025\",\"typeExamen\":\"BAC II\",\"serie\":\"D\",\"statut\":\"OUVERTE\"}"));
    long mathsId = id(envoyer(token, post("/api/matieres"), "{\"nom\":\"Mathématiques\",\"code\":\"math\"}"));
    long classeId = id(envoyer(token, post("/api/classes"),
        "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"Tle D\",\"niveau\":\"Tle\",\"serie\":\"D\"}"));

    // Quatre candidats : 17 (admis, très bien), 12 (admis, assez bien), 9 (second tour), 5 (ajourné).
    noter(token, eleve(token, classeId, sessionId, "ABALO Koffi"), mathsId, sessionId, "17");
    noter(token, eleve(token, classeId, sessionId, "BOKO Ama"), mathsId, sessionId, "12");
    noter(token, eleve(token, classeId, sessionId, "DOSSOU Yao"), mathsId, sessionId, "9");
    noter(token, eleve(token, classeId, sessionId, "EDOH Afi"), mathsId, sessionId, "5");

    envoyer(token, post("/api/archives/" + sessionId))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.sessionId").value(sessionId))
        .andExpect(jsonPath("$.statut").value("ARCHIVEE"))
        .andExpect(jsonPath("$.archiveeLe", notNullValue()));

    envoyer(token, get("/api/archives"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$", hasSize(1)))
        .andExpect(jsonPath("$[0].sessionId").value(sessionId))
        .andExpect(jsonPath("$[0].anneeScolaire").value("2024-2025"))
        .andExpect(jsonPath("$[0].sessionNom").value("BAC Blanc 2025"))
        .andExpect(jsonPath("$[0].serie").value("D"))
        .andExpect(jsonPath("$[0].effectif").value(4))
        .andExpect(jsonPath("$[0].admis").value(2))
        .andExpect(jsonPath("$[0].tauxReussite").value(50.00))
        .andExpect(jsonPath("$[0].secondTour").value(1))
        .andExpect(jsonPath("$[0].ajournes").value(1))
        .andExpect(jsonPath("$[0].moyennePromo").value(10.75))
        .andExpect(jsonPath("$[0].noteMax").value(17.00))
        .andExpect(jsonPath("$[0].noteMin").value(5.00))
        .andExpect(jsonPath("$[0].mentions.tresBien").value(1))
        .andExpect(jsonPath("$[0].mentions.bien").value(0))
        .andExpect(jsonPath("$[0].mentions.assezBien").value(1))
        .andExpect(jsonPath("$[0].mentions.passable").value(0));

    // Les archives sont cloisonnées par établissement.
    String autre = inscrire("archives-autre@ecole.tg", "Autre Lycee");
    envoyer(autre, get("/api/archives")).andExpect(jsonPath("$", hasSize(0)));
    envoyer(autre, delete("/api/archives/" + sessionId)).andExpect(status().isNotFound());

    // Retirer l'archive rouvre la session sans toucher aux notes.
    envoyer(token, delete("/api/archives/" + sessionId)).andExpect(status().isNoContent());
    envoyer(token, get("/api/archives")).andExpect(jsonPath("$", hasSize(0)));
    envoyer(token, get("/api/sessions/" + sessionId))
        .andExpect(jsonPath("$.statut").value("OUVERTE"))
        .andExpect(jsonPath("$.archiveeLe", nullValue()));
    envoyer(token, get("/api/notes?sessionId=" + sessionId)).andExpect(jsonPath("$", hasSize(4)));
  }

  private long eleve(String token, long classeId, long sessionId, String nom) throws Exception {
    return id(envoyer(token, post("/api/eleves"),
        "{\"classeId\":" + classeId + ",\"sessionId\":" + sessionId + ",\"nomComplet\":\"" + nom + "\",\"genre\":\"M\"}"));
  }

  private void noter(String token, long eleveId, long matiereId, long sessionId, String valeur) throws Exception {
    envoyer(token, post("/api/notes"),
        "{\"eleveId\":" + eleveId + ",\"matiereId\":" + matiereId + ",\"sessionId\":" + sessionId
            + ",\"valeur\":" + valeur + ",\"absent\":false}");
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
