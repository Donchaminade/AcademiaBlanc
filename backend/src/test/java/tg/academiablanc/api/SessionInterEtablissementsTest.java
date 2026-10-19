package tg.academiablanc.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Session d'examen blanc inter-établissements : plusieurs établissements confondent leurs élèves dans
 * un même examen ; l'établissement qui crée la session est le centre d'examen. Les candidats externes
 * sont inscrits avec un établissement d'origine en texte libre et rattachés à une classe du centre
 * (programme et coefficients du centre), le numéro de table est attribué dans la session, le relevé
 * porte le centre d'examen et l'établissement d'origine (jamais le logo du centre : c'est au client de
 * ne pas l'imprimer), et le rang est calculé sur tous les candidats du même niveau, toutes classes
 * confondues. Une session interne garde strictement le comportement antérieur.
 */
@SpringBootTest
@AutoConfigureMockMvc
class SessionInterEtablissementsTest {
  @Autowired
  private MockMvc mvc;
  @Autowired
  private ObjectMapper json;

  @Test
  void sessionInterEtablissementsCentreOrigineEtRangDeSession() throws Exception {
    String token = inscrire("inter@ecole.tg", "Lycee Hote de Tokoin");
    long anneeId = json.readTree(lire(token, "/api/annees-scolaires")).get(0).get("id").asLong();
    long centreId = id(envoyer(token, post("/api/centres"), "{\"nom\":\"Centre 01\",\"code\":\"C01\",\"ville\":\"Lome\"}"));
    long bepcId = typeId(token, "BEPC");
    long maths = id(envoyer(token, post("/api/matieres"), "{\"nom\":\"Mathématiques\",\"code\":\"MATH\"}"));
    long francais = id(envoyer(token, post("/api/matieres"), "{\"nom\":\"Français\",\"code\":\"FR\"}"));
    // Deux classes de 3e du centre, même programme : les candidats y sont répartis mais classés ensemble.
    long troisiemeA = id(envoyer(token, post("/api/classes"), "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"3e A\",\"niveau\":\"3e\"}"));
    long troisiemeB = id(envoyer(token, post("/api/classes"), "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"3e B\",\"niveau\":\"3e\"}"));
    for (long classe : new long[] {troisiemeA, troisiemeB}) {
      envoyer(token, put("/api/classes/" + classe + "/programme"),
          "[{\"matiereId\":" + maths + ",\"coefficient\":4},{\"matiereId\":" + francais + ",\"coefficient\":3}]")
          .andExpect(status().isOk());
    }

    // Création de la session en mode inter-établissements : le centre d'examen est l'établissement créateur.
    ResultActions creation = envoyer(token, post("/api/sessions"),
        "{\"anneeScolaireId\":" + anneeId + ",\"centreId\":" + centreId
            + ",\"nom\":\"BEPC Blanc inter-établissements\",\"typeExamenId\":" + bepcId
            + ",\"statut\":\"OUVERTE\",\"mode\":\"INTER_ETABLISSEMENTS\"}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.mode").value("INTER_ETABLISSEMENTS"))
        .andExpect(jsonPath("$.centreExamen").value("Lycee Hote de Tokoin"));
    long sessionId = id(creation);
    envoyer(token, get("/api/sessions"))
        .andExpect(jsonPath("$[0].mode").value("INTER_ETABLISSEMENTS"))
        .andExpect(jsonPath("$[0].centreExamen").value("Lycee Hote de Tokoin"));

    // Deux candidats externes importés (établissement d'origine par défaut + surcharge par ligne),
    // numéros de table attribués dans la session à partir de 1.
    envoyer(token, post("/api/eleves/import"),
        "{\"classeId\":" + troisiemeA + ",\"sessionId\":" + sessionId + ",\"etablissementOrigine\":\"CEG Agoè-Nyivé\",\"eleves\":["
            + "{\"nomComplet\":\"AKAKPO Ama\",\"genre\":\"F\"},"
            + "{\"nomComplet\":\"MENSAH Kossi\",\"genre\":\"M\",\"classeId\":" + troisiemeB + ",\"etablissementOrigine\":\"Collège Protestant de Lomé\"}]}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.crees").value(2));
    // Un élève du centre lui-même, inscrit sans établissement d'origine ni numéro de table.
    long duCentre = id(envoyer(token, post("/api/eleves"),
        "{\"classeId\":" + troisiemeB + ",\"sessionId\":" + sessionId + ",\"nomComplet\":\"DOSSOU Afi\",\"genre\":\"F\"}"));

    JsonNode eleves = json.readTree(lire(token, "/api/eleves"));
    long ama = -1;
    long kossi = -1;
    for (JsonNode e : eleves) {
      String nom = e.get("nomComplet").asText();
      if (nom.equals("AKAKPO Ama")) {
        ama = e.get("id").asLong();
        assertEquals("CEG Agoè-Nyivé", e.get("etablissementOrigine").asText());
        assertEquals(1, e.get("numeroTable").asInt());
      } else if (nom.equals("MENSAH Kossi")) {
        kossi = e.get("id").asLong();
        assertEquals("Collège Protestant de Lomé", e.get("etablissementOrigine").asText());
        assertEquals(2, e.get("numeroTable").asInt());
      } else if (e.get("id").asLong() == duCentre) {
        assertTrue(e.get("etablissementOrigine").isNull(), "élève du centre : aucune origine saisie");
        assertEquals(3, e.get("numeroTable").asInt(), "numéro suivant libre dans la session");
      }
    }
    assertTrue(ama > 0 && kossi > 0);

    // Notes : Kossi (3e B) 1er, Ama (3e A) 2e, Afi (3e B) 3e — le rang traverse les classes du centre.
    noter(token, sessionId, ama, maths, 12);
    noter(token, sessionId, ama, francais, 10);
    noter(token, sessionId, kossi, maths, 16);
    noter(token, sessionId, kossi, francais, 15);
    noter(token, sessionId, duCentre, maths, 8);
    noter(token, sessionId, duCentre, francais, 9);

    JsonNode bulletins = bulletins(token, sessionId);
    assertEquals(3, bulletins.size());
    JsonNode bAma = parEleve(bulletins, ama);
    JsonNode bKossi = parEleve(bulletins, kossi);
    JsonNode bAfi = parEleve(bulletins, duCentre);

    for (JsonNode b : bulletins) {
      assertEquals("INTER_ETABLISSEMENTS", b.get("modeSession").asText());
      assertEquals("Lycee Hote de Tokoin", b.get("centreExamen").asText());
      assertEquals("Proviseur Test", b.get("responsableCentre").asText(), "le chef du centre signe le relevé");
      assertTrue(b.get("titulaireNom").isNull(), "aucun titulaire : les classes n'en ont pas");
    }
    assertEquals("CEG Agoè-Nyivé", bAma.get("etablissementOrigine").asText());
    assertEquals("Collège Protestant de Lomé", bKossi.get("etablissementOrigine").asText());
    assertEquals("Lycee Hote de Tokoin", bAfi.get("etablissementOrigine").asText(), "élève du centre : origine = établissement hôte");

    assertEquals(0, new BigDecimal("15.57").compareTo(bKossi.get("moyenne").decimalValue()));
    assertEquals(0, new BigDecimal("11.14").compareTo(bAma.get("moyenne").decimalValue()));
    assertEquals(0, new BigDecimal("8.43").compareTo(bAfi.get("moyenne").decimalValue()));
    assertEquals(1, bKossi.get("rang").asInt());
    assertEquals(2, bAma.get("rang").asInt());
    assertEquals(3, bAfi.get("rang").asInt());
    // Les extrêmes « de classe » portent sur tout le niveau 3e de la session, toutes classes confondues.
    assertEquals(0, new BigDecimal("15.57").compareTo(bAma.get("moyenneClasseMax").decimalValue()));
    assertEquals(0, new BigDecimal("8.43").compareTo(bAma.get("moyenneClasseMin").decimalValue()));
    assertEquals(0, new BigDecimal("16").compareTo(parMatiere(bAma, maths).get("noteMaxClasse").decimalValue()));
    assertEquals(2, parMatiere(bAma, maths).get("rang").asInt());

    // Le mode reste modifiable tant que la session est ouverte…
    envoyer(token, put("/api/sessions/" + sessionId),
        "{\"anneeScolaireId\":" + anneeId + ",\"centreId\":" + centreId
            + ",\"nom\":\"BEPC Blanc inter-établissements\",\"typeExamenId\":" + bepcId + ",\"statut\":\"OUVERTE\",\"mode\":\"INTER_ETABLISSEMENTS\"}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.mode").value("INTER_ETABLISSEMENTS"));
    // … et plus une fois la session archivée (PV verrouillé).
    envoyer(token, post("/api/archives/" + sessionId)).andExpect(status().isOk());
    envoyer(token, put("/api/sessions/" + sessionId),
        "{\"anneeScolaireId\":" + anneeId + ",\"centreId\":" + centreId
            + ",\"nom\":\"BEPC Blanc inter-établissements\",\"typeExamenId\":" + bepcId + ",\"statut\":\"ARCHIVEE\",\"mode\":\"INTERNE\"}")
        .andExpect(status().isConflict());
  }

  @Test
  void sessionInterneInchangee() throws Exception {
    String token = inscrire("interne@ecole.tg", "College Interne");
    long anneeId = json.readTree(lire(token, "/api/annees-scolaires")).get(0).get("id").asLong();
    long centreId = id(envoyer(token, post("/api/centres"), "{\"nom\":\"Centre\",\"code\":\"CT\",\"ville\":\"Lome\"}"));
    long bepcId = typeId(token, "BEPC");
    long maths = id(envoyer(token, post("/api/matieres"), "{\"nom\":\"Mathématiques\",\"code\":\"MATH\"}"));
    long troisiemeA = id(envoyer(token, post("/api/classes"), "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"3e A\",\"niveau\":\"3e\"}"));
    long troisiemeB = id(envoyer(token, post("/api/classes"), "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"3e B\",\"niveau\":\"3e\"}"));

    // Sans mode précisé (client antérieur), la session est interne.
    long sessionId = id(envoyer(token, post("/api/sessions"),
        "{\"anneeScolaireId\":" + anneeId + ",\"centreId\":" + centreId
            + ",\"nom\":\"BEPC Blanc\",\"typeExamenId\":" + bepcId + ",\"statut\":\"OUVERTE\"}")
        .andExpect(jsonPath("$.mode").value("INTERNE"))
        .andExpect(jsonPath("$.centreExamen").isEmpty()));
    long a = id(envoyer(token, post("/api/eleves"),
        "{\"classeId\":" + troisiemeA + ",\"sessionId\":" + sessionId + ",\"nomComplet\":\"AKAKPO Ama\",\"genre\":\"F\",\"numeroTable\":1}"));
    long b = id(envoyer(token, post("/api/eleves"),
        "{\"classeId\":" + troisiemeB + ",\"sessionId\":" + sessionId + ",\"nomComplet\":\"MENSAH Kossi\",\"genre\":\"M\",\"numeroTable\":2}"));
    noter(token, sessionId, a, maths, 12);
    noter(token, sessionId, b, maths, 16);

    JsonNode bulletins = bulletins(token, sessionId);
    JsonNode bA = parEleve(bulletins, a);
    assertEquals("INTERNE", bA.get("modeSession").asText());
    assertTrue(bA.get("centreExamen").isNull());
    assertTrue(bA.get("responsableCentre").isNull());
    assertTrue(bA.get("etablissementOrigine").isNull(), "mode interne : aucune origine substituée");
    // Rang sur toute la session (comportement antérieur) mais extrêmes par classe.
    assertEquals(2, bA.get("rang").asInt());
    assertEquals(0, new BigDecimal("12").compareTo(bA.get("moyenneClasseMax").decimalValue()));
  }

  private void noter(String token, long sessionId, long eleveId, long matiereId, int valeur) throws Exception {
    envoyer(token, post("/api/notes"),
        "{\"eleveId\":" + eleveId + ",\"matiereId\":" + matiereId + ",\"sessionId\":" + sessionId + ",\"valeur\":" + valeur + ",\"absent\":false}")
        .andExpect(status().isOk());
  }

  private static JsonNode parEleve(JsonNode bulletins, long eleveId) {
    for (JsonNode b : bulletins) {
      if (b.get("eleveId").asLong() == eleveId) return b;
    }
    throw new AssertionError("Bulletin introuvable pour l'élève " + eleveId);
  }

  private static JsonNode parMatiere(JsonNode bulletin, long matiereId) {
    for (JsonNode ligne : bulletin.get("lignes")) {
      if (ligne.get("matiereId").asLong() == matiereId) return ligne;
    }
    throw new AssertionError("Ligne introuvable pour la matière " + matiereId);
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
    return mvc.perform(request.header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content(body));
  }

  private long id(ResultActions result) throws Exception {
    return json.readTree(result.andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asLong();
  }
}
