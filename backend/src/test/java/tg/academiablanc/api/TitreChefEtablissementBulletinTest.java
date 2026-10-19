package tg.academiablanc.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Le bulletin expose le titre du chef d'établissement ({@code titreResponsable}) : « Le Directeur » pour un élève
 * de collège, « Le Proviseur » pour un élève de lycée ; le type de la fiche de l'établissement tranche quand il est
 * connu, et le titre saisi dans le profil (charte, {@code titreSignataireJury}) prime.
 */
@SpringBootTest
@AutoConfigureMockMvc
class TitreChefEtablissementBulletinTest {
  @Autowired
  private MockMvc mvc;
  @Autowired
  private ObjectMapper json;

  @Test
  void leTitreSuitLeNiveauDeLaClassePuisLaSurchargeDuProfil() throws Exception {
    // Établissement sans type ni mot-clé dans le nom : seul le niveau de la classe décide.
    String token = inscrire("titre-chef@ecole.tg", "Groupe Test Sans Indice", null);
    long anneeId = json.readTree(lire(token, "/api/annees-scolaires")).get(0).get("id").asLong();
    long centreId = id(envoyer(token, post("/api/centres"), "{\"nom\":\"Centre\",\"code\":\"CT\",\"ville\":\"Lome\"}"));
    long sessionId = id(envoyer(token, post("/api/sessions"),
        "{\"anneeScolaireId\":" + anneeId + ",\"centreId\":" + centreId
            + ",\"nom\":\"EXAMEN BLANC\",\"typeExamen\":\"BEPC\",\"statut\":\"OUVERTE\"}"));
    long maths = id(envoyer(token, post("/api/matieres"), "{\"nom\":\"Mathématiques\",\"code\":\"MATH\"}"));
    long troisieme = id(envoyer(token, post("/api/classes"), "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"3e\",\"niveau\":\"3e\"}"));
    long terminale = id(envoyer(token, post("/api/classes"),
        "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"Tle D\",\"niveau\":\"Tle\",\"serie\":\"D\"}"));
    long eleve3e = id(envoyer(token, post("/api/eleves"),
        "{\"classeId\":" + troisieme + ",\"sessionId\":" + sessionId + ",\"nomComplet\":\"AKAKPO Ama\",\"genre\":\"F\",\"numeroTable\":1}"));
    long eleveTle = id(envoyer(token, post("/api/eleves"),
        "{\"classeId\":" + terminale + ",\"sessionId\":" + sessionId + ",\"nomComplet\":\"MENSAH Kossi\",\"genre\":\"M\",\"numeroTable\":2}"));
    for (long eleve : new long[] {eleve3e, eleveTle}) {
      envoyer(token, post("/api/notes"),
          "{\"eleveId\":" + eleve + ",\"matiereId\":" + maths + ",\"sessionId\":" + sessionId + ",\"valeur\":12,\"absent\":false}");
    }

    JsonNode bulletins = bulletins(token, sessionId);
    assertEquals(TitreChefEtablissement.DIRECTEUR, parEleve(bulletins, eleve3e).get("titreResponsable").asText(), "3e → Directeur");
    assertEquals(TitreChefEtablissement.PROVISEUR, parEleve(bulletins, eleveTle).get("titreResponsable").asText(), "Tle D → Proviseur");

    // Surcharge saisie dans le profil (charte) : elle prime pour toutes les classes.
    envoyer(token, put("/api/etablissement/charte"), "{\"titreSignataireJury\":\"La Directrice\"}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.titreSignataireJury").value("La Directrice"));
    bulletins = bulletins(token, sessionId);
    assertEquals("La Directrice", parEleve(bulletins, eleve3e).get("titreResponsable").asText());
    assertEquals("La Directrice", parEleve(bulletins, eleveTle).get("titreResponsable").asText());

    // Retour à l'automatique : titre vide → null sur le serveur, le niveau décide de nouveau.
    envoyer(token, put("/api/etablissement/charte"), "{\"titreSignataireJury\":\"  \"}")
        .andExpect(jsonPath("$.titreSignataireJury").isEmpty());
    bulletins = bulletins(token, sessionId);
    assertEquals(TitreChefEtablissement.DIRECTEUR, parEleve(bulletins, eleve3e).get("titreResponsable").asText());
    assertEquals(TitreChefEtablissement.PROVISEUR, parEleve(bulletins, eleveTle).get("titreResponsable").asText());

    // Type de la fiche : un collège n'affiche jamais « Proviseur », même pour une classe de Tle.
    envoyer(token, put("/api/etablissement"),
        "{\"nom\":\"Groupe Test Sans Indice\",\"typeEtablissement\":\"Collège d'enseignement général\",\"ville\":\"Lome\","
            + "\"email\":\"titre-chef@ecole.tg\",\"nomResponsable\":\"M. AGBODJI\"}")
        .andExpect(status().isOk());
    bulletins = bulletins(token, sessionId);
    assertEquals(TitreChefEtablissement.DIRECTEUR, parEleve(bulletins, eleveTle).get("titreResponsable").asText(),
        "établissement de type collège + classe de Tle → Directeur");
  }

  @Test
  void unEtablissementDeTypeLyceeSigneProviseurMemeAuCollege() throws Exception {
    String token = inscrire("titre-lycee@ecole.tg", "Groupe Test Lycee", "Lycée public d'enseignement général");
    long anneeId = json.readTree(lire(token, "/api/annees-scolaires")).get(0).get("id").asLong();
    long centreId = id(envoyer(token, post("/api/centres"), "{\"nom\":\"Centre\",\"code\":\"CL\",\"ville\":\"Lome\"}"));
    long sessionId = id(envoyer(token, post("/api/sessions"),
        "{\"anneeScolaireId\":" + anneeId + ",\"centreId\":" + centreId
            + ",\"nom\":\"BEPC BLANC\",\"typeExamen\":\"BEPC\",\"statut\":\"OUVERTE\"}"));
    long troisieme = id(envoyer(token, post("/api/classes"), "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"3e\",\"niveau\":\"3e\"}"));
    long eleve = id(envoyer(token, post("/api/eleves"),
        "{\"classeId\":" + troisieme + ",\"sessionId\":" + sessionId + ",\"nomComplet\":\"DOSSOU Afi\",\"genre\":\"F\",\"numeroTable\":1}"));
    assertEquals(TitreChefEtablissement.PROVISEUR, parEleve(bulletins(token, sessionId), eleve).get("titreResponsable").asText());
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

  private String inscrire(String email, String nom, String type) throws Exception {
    String raw = mvc.perform(post("/api/auth/signup")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"nom\":\"" + nom + "\",\"ville\":\"Lome\",\"email\":\"" + email
                + "\",\"motDePasse\":\"secret1\",\"nomResponsable\":\"Chef Test\""
                + (type == null ? "" : ",\"typeEtablissement\":\"" + type + "\"") + "}"))
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
    return mvc.perform(request.header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content(body));
  }

  private long id(ResultActions result) throws Exception {
    return json.readTree(result.andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asLong();
  }
}
