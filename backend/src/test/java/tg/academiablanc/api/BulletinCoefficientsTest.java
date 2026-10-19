package tg.academiablanc.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
 * Barème du bulletin : le coefficient saisi pour la classe de l’élève prime sur le coefficient
 * « toutes classes » ; total = Σ(note × coef) ; moyenne = total / Σ coef ; points max = 20 × Σ coef.
 */
@SpringBootTest
@AutoConfigureMockMvc
class BulletinCoefficientsTest {
  @Autowired
  private MockMvc mvc;
  @Autowired
  private ObjectMapper json;

  @Test
  void leCoefficientDeLaClassePrimeSurLeCoefficientGlobal() throws Exception {
    String token = inscrire("bareme-coef@ecole.tg", "College Bareme");
    long anneeId = json.readTree(lire(token, "/api/annees-scolaires")).get(0).get("id").asLong();
    long centreId = id(envoyer(token, post("/api/centres"), "{\"nom\":\"Centre\",\"code\":\"CB\",\"ville\":\"Lome\"}"));
    long sessionId = id(envoyer(token, post("/api/sessions"),
        "{\"anneeScolaireId\":" + anneeId + ",\"centreId\":" + centreId
            + ",\"nom\":\"BEPC BLANC\",\"typeExamen\":\"BEPC\",\"statut\":\"OUVERTE\"}"));

    long histoire = id(envoyer(token, post("/api/matieres"), "{\"nom\":\"Histoire-Géographie\",\"code\":\"HG\"}"));
    long maths = id(envoyer(token, post("/api/matieres"), "{\"nom\":\"Mathématiques\",\"code\":\"MATH\"}"));

    long troisieme = id(envoyer(token, post("/api/classes"),
        "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"3e\",\"niveau\":\"3e\"}"));
    long quatrieme = id(envoyer(token, post("/api/classes"),
        "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"4e\",\"niveau\":\"4e\"}"));

    // Histoire-Géographie : ×2 pour toutes les classes, mais ×4 en 3e. Mathématiques : ×3 partout.
    envoyer(token, post("/api/coefficients"), "{\"matiereId\":" + histoire + ",\"valeur\":2}");
    envoyer(token, post("/api/coefficients"), "{\"matiereId\":" + histoire + ",\"classeId\":" + troisieme + ",\"valeur\":4}");
    envoyer(token, post("/api/coefficients"), "{\"matiereId\":" + maths + ",\"valeur\":3}");

    long eleve3e = id(envoyer(token, post("/api/eleves"),
        "{\"classeId\":" + troisieme + ",\"sessionId\":" + sessionId + ",\"nomComplet\":\"AKAKPO Ama\",\"genre\":\"F\",\"numeroTable\":1}"));
    long eleve4e = id(envoyer(token, post("/api/eleves"),
        "{\"classeId\":" + quatrieme + ",\"sessionId\":" + sessionId + ",\"nomComplet\":\"MENSAH Kossi\",\"genre\":\"M\",\"numeroTable\":2}"));
    for (long eleve : new long[] {eleve3e, eleve4e}) {
      envoyer(token, post("/api/notes"),
          "{\"eleveId\":" + eleve + ",\"matiereId\":" + histoire + ",\"sessionId\":" + sessionId + ",\"valeur\":12,\"absent\":false}");
      envoyer(token, post("/api/notes"),
          "{\"eleveId\":" + eleve + ",\"matiereId\":" + maths + ",\"sessionId\":" + sessionId + ",\"valeur\":10,\"absent\":false}");
    }

    String corps = envoyer(token, get("/api/bulletins").param("sessionId", String.valueOf(sessionId)))
        .andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString();
    JsonNode bulletins = json.readTree(corps);

    // Élève de 3e : HG compte ×4 (coefficient de classe), total = 12×4 + 10×3 = 78, Σ coef = 7, moyenne = 11,14.
    JsonNode b3 = parEleve(bulletins, eleve3e);
    JsonNode hg3 = parMatiere(b3, histoire);
    assertNombre(hg3.get("coefficient"), 4);
    assertNombre(hg3.get("total"), 48);
    assertNombre(b3.get("totalPoints"), 78);
    assertNombre(b3.get("totalCoef"), 7);
    assertNombre(b3.get("moyenne"), 11.14);
    // Points maximum = 20 × Σ coef = 140 : la note sur 20 au coefficient 4 vaut au plus 80 points.
    assertEquals(0, new BigDecimal("140").compareTo(b3.get("totalCoef").decimalValue().multiply(new BigDecimal("20"))));

    // Élève de 4e : aucun coefficient propre, HG retombe sur ×2 ; total = 12×2 + 10×3 = 54, Σ coef = 5, moyenne = 10,80.
    JsonNode b4 = parEleve(bulletins, eleve4e);
    assertNombre(parMatiere(b4, histoire).get("coefficient"), 2);
    assertNombre(parMatiere(b4, histoire).get("total"), 24);
    assertNombre(b4.get("totalPoints"), 54);
    assertNombre(b4.get("totalCoef"), 5);
    assertNombre(b4.get("moyenne"), 10.80);
  }

  @Test
  void sansCoefficientSaisiLaMatiereCompteUn() throws Exception {
    String token = inscrire("bareme-defaut@ecole.tg", "College Defaut");
    long anneeId = json.readTree(lire(token, "/api/annees-scolaires")).get(0).get("id").asLong();
    long centreId = id(envoyer(token, post("/api/centres"), "{\"nom\":\"Centre\",\"code\":\"CD\",\"ville\":\"Lome\"}"));
    long sessionId = id(envoyer(token, post("/api/sessions"),
        "{\"anneeScolaireId\":" + anneeId + ",\"centreId\":" + centreId
            + ",\"nom\":\"BEPC BLANC\",\"typeExamen\":\"BEPC\",\"statut\":\"OUVERTE\"}"));
    long matiere = id(envoyer(token, post("/api/matieres"), "{\"nom\":\"Anglais\",\"code\":\"ANG\"}"));
    long classe = id(envoyer(token, post("/api/classes"), "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"3e\",\"niveau\":\"3e\"}"));
    long eleve = id(envoyer(token, post("/api/eleves"),
        "{\"classeId\":" + classe + ",\"sessionId\":" + sessionId + ",\"nomComplet\":\"DOSSOU Afi\",\"genre\":\"F\",\"numeroTable\":1}"));
    envoyer(token, post("/api/notes"),
        "{\"eleveId\":" + eleve + ",\"matiereId\":" + matiere + ",\"sessionId\":" + sessionId + ",\"valeur\":15,\"absent\":false}");

    envoyer(token, get("/api/bulletins").param("sessionId", String.valueOf(sessionId)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].lignes[0].coefficient").value(1))
        .andExpect(jsonPath("$[0].lignes[0].total").value(15.0))
        .andExpect(jsonPath("$[0].totalCoef").value(1.0))
        .andExpect(jsonPath("$[0].moyenne").value(15.0));
  }

  private static JsonNode parEleve(JsonNode bulletins, long eleveId) {
    for (JsonNode b : bulletins) {
      if (b.get("eleveId").asLong() == eleveId) return b;
    }
    throw new AssertionError("Bulletin introuvable pour l’élève " + eleveId);
  }

  private static JsonNode parMatiere(JsonNode bulletin, long matiereId) {
    for (JsonNode ligne : bulletin.get("lignes")) {
      if (ligne.get("matiereId").asLong() == matiereId) return ligne;
    }
    throw new AssertionError("Ligne introuvable pour la matière " + matiereId);
  }

  private static void assertNombre(JsonNode valeur, double attendu) {
    BigDecimal lu = valeur.decimalValue();
    assertEquals(0, BigDecimal.valueOf(attendu).compareTo(lu), () -> "attendu " + attendu + " mais lu " + lu);
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
