package tg.academiablanc.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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

/**
 * Pied de page du relevé : chaque bulletin porte le nom de l'établissement et sa devise propre
 * ({@code etablissement.devise}, saisie dans le profil), distincte de la devise nationale de l'en-tête.
 * Sans devise saisie, le champ vaut null et le pied de page n'affiche que le nom.
 */
@SpringBootTest
@AutoConfigureMockMvc
class BulletinPiedDePageTest {
  @Autowired
  private MockMvc mvc;
  @Autowired
  private ObjectMapper json;

  @Test
  void leBulletinPorteLeNomEtLaDeviseDeLEtablissement() throws Exception {
    String token = inscrire("pied-devise@ecole.tg", "Complexe Scolaire Harmonia");
    long sessionId = sessionAvecUnEleveNote(token, "CH");

    // Aucune devise saisie : le nom seul est exposé, la devise vaut null.
    envoyer(token, get("/api/bulletins").param("sessionId", String.valueOf(sessionId)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].etablissementNom").value("Complexe Scolaire Harmonia"))
        .andExpect(jsonPath("$[0].etablissementDevise").isEmpty());

    // La devise propre est saisie dans le profil ; la devise nationale de l'en-tête n'est pas concernée.
    envoyer(token, put("/api/etablissement"),
        "{\"nom\":\"Complexe Scolaire Harmonia\",\"ville\":\"Lome\",\"email\":\"pied-devise@ecole.tg\","
            + "\"nomResponsable\":\"Proviseur Test\",\"devise\":\"Discipline – Excellence – Réussite\"}");
    envoyer(token, put("/api/etablissement/en-tete"),
        "{\"prereglageNationalId\":null,\"republique\":\"RÉPUBLIQUE TOGOLAISE\",\"deviseNationale\":\"Travail – Liberté – Patrie\","
            + "\"ministere\":\"MINISTÈRE\",\"sigleMinistere\":\"MEPST\",\"autoriteRegionale\":null,\"piedDePage\":null}");

    envoyer(token, get("/api/bulletins").param("sessionId", String.valueOf(sessionId)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].etablissementNom").value("Complexe Scolaire Harmonia"))
        .andExpect(jsonPath("$[0].etablissementDevise").value("Discipline – Excellence – Réussite"));
  }

  @Test
  void unNomModifieEstReprisSurLeBulletin() throws Exception {
    String token = inscrire("pied-nom@ecole.tg", "College Avant");
    long sessionId = sessionAvecUnEleveNote(token, "CA");

    envoyer(token, put("/api/etablissement"),
        "{\"nom\":\"Collège Après\",\"ville\":\"Kara\",\"email\":\"pied-nom@ecole.tg\",\"nomResponsable\":\"Proviseur Test\",\"devise\":\"   \"}");

    // Une devise faite d'espaces compte comme absente.
    envoyer(token, get("/api/bulletins").param("sessionId", String.valueOf(sessionId)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].etablissementNom").value("Collège Après"))
        .andExpect(jsonPath("$[0].etablissementDevise").isEmpty());
  }

  private long sessionAvecUnEleveNote(String token, String codeCentre) throws Exception {
    long anneeId = json.readTree(lire(token, "/api/annees-scolaires")).get(0).get("id").asLong();
    long centreId = id(envoyer(token, post("/api/centres"), "{\"nom\":\"Centre\",\"code\":\"" + codeCentre + "\",\"ville\":\"Lome\"}"));
    long sessionId = id(envoyer(token, post("/api/sessions"),
        "{\"anneeScolaireId\":" + anneeId + ",\"centreId\":" + centreId
            + ",\"nom\":\"BEPC BLANC\",\"typeExamen\":\"BEPC\",\"statut\":\"OUVERTE\"}"));
    long matiere = id(envoyer(token, post("/api/matieres"), "{\"nom\":\"Anglais\",\"code\":\"ANG\"}"));
    long classe = id(envoyer(token, post("/api/classes"), "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"3e\",\"niveau\":\"3e\"}"));
    long eleve = id(envoyer(token, post("/api/eleves"),
        "{\"classeId\":" + classe + ",\"sessionId\":" + sessionId + ",\"nomComplet\":\"DOSSOU Afi\",\"genre\":\"F\",\"numeroTable\":1}"));
    envoyer(token, post("/api/notes"),
        "{\"eleveId\":" + eleve + ",\"matiereId\":" + matiere + ",\"sessionId\":" + sessionId + ",\"valeur\":15,\"absent\":false}");
    return sessionId;
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
