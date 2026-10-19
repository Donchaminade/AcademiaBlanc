package tg.academiablanc.api;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
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
 * « Anciennes données » après connexion : garde-fous côté serveur. Aucune réponse de l'API ne doit pouvoir
 * être conservée par un cache (navigateur, service worker, passerelle), et aucune lecture ne doit renvoyer
 * les élèves, notes, sessions ou classes d'un autre établissement.
 */
@SpringBootTest
@AutoConfigureMockMvc
class DonneesFraichesTest {
  @Autowired
  private MockMvc mvc;
  @Autowired
  private ObjectMapper json;

  @Test
  void lesReponsesDeLApiNeSontJamaisMisesEnCache() throws Exception {
    String token = inscrire("fraiches-cache@ecole.tg", "Lycee Cache");
    for (String chemin : new String[] {"/api/eleves", "/api/sessions", "/api/classes", "/api/matieres", "/api/annees-scolaires", "/api/etablissement", "/api/etablissement/charte", "/api/auth/me"}) {
      envoyer(token, get(chemin))
          .andExpect(status().isOk())
          .andExpect(header().string("Cache-Control", containsString("no-store")))
          .andExpect(header().string("Pragma", "no-cache"))
          .andExpect(header().string("Expires", "0"));
    }
    // La connexion elle-même (jeton) n'est pas plus cachable.
    mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"fraiches-cache@ecole.tg\",\"motDePasse\":\"secret1\"}"))
        .andExpect(status().isOk())
        .andExpect(header().string("Cache-Control", containsString("no-store")));
  }

  @Test
  void unEtablissementNeVoitJamaisLesDonneesDUnAutre() throws Exception {
    String a = inscrire("fraiches-a@ecole.tg", "Lycee A Fraiches");
    long anneeA = json.readTree(lire(a, "/api/annees-scolaires")).get(0).get("id").asLong();
    long centreA = id(envoyer(a, post("/api/centres"), "{\"nom\":\"Centre A\",\"code\":\"CA1\",\"ville\":\"Kara\"}"));
    long sessionA = id(envoyer(a, post("/api/sessions"),
        "{\"anneeScolaireId\":" + anneeA + ",\"centreId\":" + centreA + ",\"nom\":\"BEPC blanc A\",\"typeExamen\":\"BEPC\",\"statut\":\"OUVERTE\"}"));
    long matiereA = id(envoyer(a, post("/api/matieres"), "{\"nom\":\"Français\",\"code\":\"fr\"}"));
    long classeA = id(envoyer(a, post("/api/classes"), "{\"anneeScolaireId\":" + anneeA + ",\"nom\":\"3e A\",\"niveau\":\"3e\"}"));
    long eleveA = id(envoyer(a, post("/api/eleves"),
        "{\"classeId\":" + classeA + ",\"sessionId\":" + sessionA + ",\"nomComplet\":\"AMEGAN Koffi\",\"genre\":\"M\",\"numeroTable\":1}"));
    envoyer(a, post("/api/notes"),
        "{\"eleveId\":" + eleveA + ",\"matiereId\":" + matiereA + ",\"sessionId\":" + sessionA + ",\"valeur\":12,\"absent\":false}");
    envoyer(a, get("/api/eleves")).andExpect(jsonPath("$", hasSize(1)));

    // Compte B, autre établissement : espace vierge, aucune trace de A.
    String b = inscrire("fraiches-b@ecole.tg", "College B Fraiches");
    envoyer(b, get("/api/eleves")).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(0)));
    envoyer(b, get("/api/sessions")).andExpect(jsonPath("$", hasSize(0)));
    envoyer(b, get("/api/classes")).andExpect(jsonPath("$", hasSize(0)));
    envoyer(b, get("/api/matieres")).andExpect(jsonPath("$", hasSize(0)));
    envoyer(b, get("/api/centres")).andExpect(jsonPath("$", hasSize(0)));
    envoyer(b, get("/api/annees-scolaires")).andExpect(jsonPath("$[*].id").value(not(hasItem((int) anneeA))));

    // Lectures ciblées sur les ressources de A : introuvables pour B (ni fuite, ni indice d'existence).
    envoyer(b, get("/api/eleves/" + eleveA)).andExpect(status().isNotFound());
    envoyer(b, get("/api/classes/" + classeA)).andExpect(status().isNotFound());
    envoyer(b, get("/api/sessions/" + sessionA)).andExpect(status().isNotFound());
    envoyer(b, get("/api/notes?sessionId=" + sessionA)).andExpect(status().isNotFound());
    envoyer(b, get("/api/bulletins?sessionId=" + sessionA)).andExpect(status().isNotFound());
    envoyer(b, get("/api/deliberations?sessionId=" + sessionA)).andExpect(status().isNotFound());

    // La fiche et la charte lues par B sont les siennes.
    envoyer(b, get("/api/etablissement")).andExpect(jsonPath("$.nom").value("College B Fraiches"));
    envoyer(b, get("/api/auth/me")).andExpect(jsonPath("$.nomEtablissement").value("College B Fraiches"));

    // Et A retrouve toujours ses données après le passage de B.
    envoyer(a, get("/api/eleves")).andExpect(jsonPath("$", hasSize(1))).andExpect(jsonPath("$[0].nomComplet").value("AMEGAN Koffi"));
    envoyer(a, get("/api/notes?sessionId=" + sessionA)).andExpect(jsonPath("$", hasSize(1)));
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
