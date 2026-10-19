package tg.academiablanc.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
 * Le bandeau de titre du bulletin n'est plus un texte figé (« Baccalauréat deuxième partie », « Série D »,
 * « Jury n° 01 ») : {@code BulletinVue.entete} expose le type d'examen et l'intitulé de la session, l'année
 * scolaire de la session, puis le niveau et la série de la classe de l'élève — jamais de série au collège.
 */
@SpringBootTest
@AutoConfigureMockMvc
class BulletinEnteteSessionTest {
  @Autowired
  private MockMvc mvc;
  @Autowired
  private ObjectMapper json;

  @Test
  void leBandeauReprendLeTypeEtLIntituleDeLaSessionPuisLaClasseDeLEleve() throws Exception {
    String token = inscrire("entete-bulletin@ecole.tg", "Lycee Entete");
    long anneeId = json.readTree(lire(token, "/api/annees-scolaires")).get(0).get("id").asLong();
    String anneeLibelle = json.readTree(lire(token, "/api/annees-scolaires")).get(0).get("libelle").asText();
    long centreId = id(envoyer(token, post("/api/centres"), "{\"nom\":\"Centre\",\"code\":\"CT\",\"ville\":\"Lome\"}"));
    envoyer(token, post("/api/series/defauts"), "{}");

    long bepcId = typeId(token, "BEPC");
    long bac2Id = typeId(token, "BAC2");
    // Session rattachée au type BEPC du référentiel, avec un intitulé libre ; elle porte une série qui ne doit
    // jamais apparaître sur le bulletin d'un élève du collège.
    long sessionBepc = id(envoyer(token, post("/api/sessions"),
        "{\"anneeScolaireId\":" + anneeId + ",\"centreId\":" + centreId
            + ",\"nom\":\"Examen blanc 2e trimestre\",\"typeExamenId\":" + bepcId + ",\"serie\":\"D\",\"statut\":\"OUVERTE\"}"));
    long sessionBac = id(envoyer(token, post("/api/sessions"),
        "{\"anneeScolaireId\":" + anneeId + ",\"centreId\":" + centreId
            + ",\"nom\":\"BAC II Blanc 2026\",\"typeExamenId\":" + bac2Id + ",\"statut\":\"OUVERTE\"}"));
    long maths = id(envoyer(token, post("/api/matieres"), "{\"nom\":\"Mathématiques\",\"code\":\"MATH\"}"));

    long troisieme = id(envoyer(token, post("/api/classes"),
        "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"3e B\",\"niveau\":\"Troisième\"}"));
    long terminaleD = id(envoyer(token, post("/api/classes"),
        "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"Tle D\",\"niveau\":\"Tle\",\"serie\":\"D\"}"));

    long eleve3e = id(envoyer(token, post("/api/eleves"),
        "{\"classeId\":" + troisieme + ",\"sessionId\":" + sessionBepc + ",\"nomComplet\":\"AKAKPO Ama\",\"genre\":\"F\",\"numeroTable\":1}"));
    long eleveTle = id(envoyer(token, post("/api/eleves"),
        "{\"classeId\":" + terminaleD + ",\"sessionId\":" + sessionBac + ",\"nomComplet\":\"MENSAH Kossi\",\"genre\":\"M\",\"numeroTable\":2}"));
    envoyer(token, post("/api/notes"),
        "{\"eleveId\":" + eleve3e + ",\"matiereId\":" + maths + ",\"sessionId\":" + sessionBepc + ",\"valeur\":12,\"absent\":false}");
    envoyer(token, post("/api/notes"),
        "{\"eleveId\":" + eleveTle + ",\"matiereId\":" + maths + ",\"sessionId\":" + sessionBac + ",\"valeur\":14,\"absent\":false}");

    // Collège (3e, BEPC) : type + intitulé, niveau canonique, aucune série malgré celle de la session.
    JsonNode entete3e = parEleve(bulletins(token, sessionBepc), eleve3e).get("entete");
    assertEquals("Brevet d'Études du Premier Cycle", entete3e.get("typeExamenLibelle").asText());
    assertEquals("BEPC", entete3e.get("typeExamenCode").asText());
    assertEquals("Examen blanc 2e trimestre", entete3e.get("sessionNom").asText());
    assertEquals(anneeLibelle, entete3e.get("anneeScolaire").asText());
    assertEquals("3e", entete3e.get("classeNiveau").asText());
    assertEquals("3e B", entete3e.get("classeNom").asText());
    assertTrue(entete3e.get("classeSerie").isNull(), "pas de série au collège");
    assertTrue(entete3e.get("classeSerieLibelle").isNull());

    // Lycée (Tle D, BAC II) : série de la classe et libellé du référentiel de l'établissement.
    JsonNode enteteTle = parEleve(bulletins(token, sessionBac), eleveTle).get("entete");
    assertEquals("Baccalauréat Deuxième Partie", enteteTle.get("typeExamenLibelle").asText());
    assertEquals("BAC2", enteteTle.get("typeExamenCode").asText());
    assertEquals("BAC II Blanc 2026", enteteTle.get("sessionNom").asText());
    assertEquals("Tle", enteteTle.get("classeNiveau").asText());
    assertEquals("D", enteteTle.get("classeSerie").asText());
    assertEquals("Mathématiques et Sciences naturelles", enteteTle.get("classeSerieLibelle").asText());

    // L'intitulé et le type se modifient dans le formulaire de session : le bandeau suit immédiatement.
    envoyer(token, put("/api/sessions/" + sessionBac),
        "{\"anneeScolaireId\":" + anneeId + ",\"centreId\":" + centreId
            + ",\"nom\":\"Composition du 3e trimestre\",\"typeExamen\":\"Évaluation interne\",\"statut\":\"OUVERTE\"}");
    JsonNode modifie = parEleve(bulletins(token, sessionBac), eleveTle).get("entete");
    assertEquals("Composition du 3e trimestre", modifie.get("sessionNom").asText());
    assertEquals("Évaluation interne", modifie.get("typeExamenLibelle").asText(), "hors référentiel : le texte saisi fait foi");
    assertTrue(modifie.get("typeExamenCode").isNull());
  }

  private long typeId(String token, String code) throws Exception {
    for (JsonNode type : json.readTree(lire(token, "/api/types-examen"))) {
      if (code.equals(type.get("code").asText())) return type.get("id").asLong();
    }
    throw new AssertionError("Type d'examen " + code + " absent du référentiel");
  }

  private JsonNode bulletins(String token, long sessionId) throws Exception {
    return json.readTree(envoyer(token, get("/api/bulletins").param("sessionId", String.valueOf(sessionId)))
        .andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString());
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
