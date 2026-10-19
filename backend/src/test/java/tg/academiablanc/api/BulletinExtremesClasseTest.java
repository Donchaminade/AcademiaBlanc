package tg.academiablanc.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
 * Extrêmes de la classe sur le bulletin : moyenne de classe, moyenne la plus forte et la plus faible
 * (même classe, même session), note min / max par matière ; total maximal = 20 × Σ coef du programme de
 * la classe de l’élève ; une matière sans note est exclue des deux sommes sans toucher au total maximal.
 */
@SpringBootTest
@AutoConfigureMockMvc
class BulletinExtremesClasseTest {
  @Autowired
  private MockMvc mvc;
  @Autowired
  private ObjectMapper json;

  @Test
  void extremesDeLaClasseEtTotalMaximalDuProgramme() throws Exception {
    String token = inscrire("extremes-classe@ecole.tg", "College Extremes");
    long anneeId = json.readTree(lire(token, "/api/annees-scolaires")).get(0).get("id").asLong();
    long centreId = id(envoyer(token, post("/api/centres"), "{\"nom\":\"Centre\",\"code\":\"CX\",\"ville\":\"Lome\"}"));
    long sessionId = id(envoyer(token, post("/api/sessions"),
        "{\"anneeScolaireId\":" + anneeId + ",\"centreId\":" + centreId
            + ",\"nom\":\"BEPC BLANC\",\"typeExamen\":\"BEPC\",\"statut\":\"OUVERTE\"}"));

    long maths = id(envoyer(token, post("/api/matieres"), "{\"nom\":\"Mathématiques\",\"code\":\"MATH\"}"));
    long francais = id(envoyer(token, post("/api/matieres"), "{\"nom\":\"Français\",\"code\":\"FR\"}"));
    long histoire = id(envoyer(token, post("/api/matieres"), "{\"nom\":\"Histoire-Géographie\",\"code\":\"HG\"}"));

    // 3e A : MATH ×3, FR ×2 (Σ 5 → 100 points max). 3e B : MATH ×4, FR ×2, HG ×1 (Σ 7 → 140 points max).
    long classeA = id(envoyer(token, post("/api/classes"),
        "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"3e A\",\"niveau\":\"3e\"}"));
    long classeB = id(envoyer(token, post("/api/classes"),
        "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"3e B\",\"niveau\":\"3e\"}"));
    envoyer(token, put("/api/classes/" + classeA + "/programme"),
        "[{\"matiereId\":" + maths + ",\"coefficient\":3},{\"matiereId\":" + francais + ",\"coefficient\":2}]");
    envoyer(token, put("/api/classes/" + classeB + "/programme"),
        "[{\"matiereId\":" + maths + ",\"coefficient\":4},{\"matiereId\":" + francais + ",\"coefficient\":2},{\"matiereId\":" + histoire + ",\"coefficient\":1}]");

    long a1 = eleve(token, classeA, sessionId, "ABALO Kodjo", 1);
    long a2 = eleve(token, classeA, sessionId, "AKAKPO Ama", 2);
    long a3 = eleve(token, classeA, sessionId, "ADJO Essi", 3); // inscrite, aucune note
    long b1 = eleve(token, classeB, sessionId, "BOKO Yao", 4);

    note(token, a1, maths, sessionId, "12");
    note(token, a1, francais, sessionId, "8");
    note(token, a2, maths, sessionId, "15");
    note(token, a2, francais, sessionId, "14");
    note(token, b1, maths, sessionId, "10");
    note(token, b1, histoire, sessionId, "16"); // Français non noté en 3e B

    JsonNode bulletins = json.readTree(lire(token, "/api/bulletins?sessionId=" + sessionId));
    JsonNode bulletinA1 = parEleve(bulletins, a1);
    JsonNode bulletinA2 = parEleve(bulletins, a2);
    JsonNode bulletinA3 = parEleve(bulletins, a3);
    JsonNode bulletinB1 = parEleve(bulletins, b1);

    // Moyennes réelles : A1 = (36 + 16) / 5 = 10,40 ; A2 = (45 + 28) / 5 = 14,60.
    assertNombre(bulletinA1.get("moyenne"), 10.40);
    assertNombre(bulletinA2.get("moyenne"), 14.60);
    assertTrue(bulletinA3.get("moyenne").isNull(), "sans note, pas de moyenne");

    // Extrêmes de la 3e A sur les deux élèves notés ; A3 (sans note) voit les mêmes extrêmes.
    for (JsonNode bulletin : new JsonNode[] {bulletinA1, bulletinA2, bulletinA3}) {
      assertNombre(bulletin.get("moyenneClasse"), 12.50);
      assertNombre(bulletin.get("moyenneClasseMax"), 14.60);
      assertNombre(bulletin.get("moyenneClasseMin"), 10.40);
    }

    // Total maximal : 20 × Σ coef du programme de la classe, pas d’un jeu global de matières (3 matières).
    assertNombre(bulletinA1.get("totalCoefProgramme"), 5);
    assertNombre(bulletinA1.get("pointsMax"), 100);
    assertNombre(bulletinA3.get("pointsMax"), 100);
    assertNombre(bulletinB1.get("totalCoefProgramme"), 7);
    assertNombre(bulletinB1.get("pointsMax"), 140);

    // Note min / max de la classe par matière (3e A : MATH 12–15, FR 8–14).
    JsonNode mathsA1 = parMatiere(bulletinA1, maths);
    assertNombre(mathsA1.get("noteMaxClasse"), 15);
    assertNombre(mathsA1.get("noteMinClasse"), 12);
    JsonNode francaisA1 = parMatiere(bulletinA1, francais);
    assertNombre(francaisA1.get("noteMaxClasse"), 14);
    assertNombre(francaisA1.get("noteMinClasse"), 8);
    assertEquals(2, bulletinA1.get("lignes").size(), "la 3e A n’a que ses deux matières au bulletin");

    // 3e B : la matière non notée est exclue du numérateur et du dénominateur (B1 = (40 + 16) / 5 = 11,20),
    // le total maximal reste celui du programme complet, et ses extrêmes ne mélangent pas les classes.
    assertNombre(bulletinB1.get("moyenne"), 11.20);
    assertNombre(bulletinB1.get("totalCoef"), 5);
    assertNombre(bulletinB1.get("totalPoints"), 56);
    assertNombre(bulletinB1.get("moyenneClasse"), 11.20);
    assertNombre(bulletinB1.get("moyenneClasseMax"), 11.20);
    assertNombre(bulletinB1.get("moyenneClasseMin"), 11.20);
    assertEquals(3, bulletinB1.get("lignes").size());
    JsonNode francaisB1 = parMatiere(bulletinB1, francais);
    assertTrue(francaisB1.get("absent").asBoolean());
    assertTrue(francaisB1.get("noteMaxClasse").isNull(), "aucune note de français en 3e B");
    assertTrue(francaisB1.get("noteMinClasse").isNull());
    assertNombre(parMatiere(bulletinB1, maths).get("noteMaxClasse"), 10);

    // Le rang général reste calculé sur toute la session : A2 (14,60) 1er, B1 (11,20) 2e, A1 (10,40) 3e.
    assertEquals(1, bulletinA2.get("rang").asInt());
    assertEquals(2, bulletinB1.get("rang").asInt());
    assertEquals(3, bulletinA1.get("rang").asInt());
    assertTrue(bulletinA3.get("rang").isNull());
  }

  private long eleve(String token, long classeId, long sessionId, String nom, int table) throws Exception {
    return id(envoyer(token, post("/api/eleves"),
        "{\"classeId\":" + classeId + ",\"sessionId\":" + sessionId + ",\"nomComplet\":\"" + nom + "\",\"genre\":\"M\",\"numeroTable\":" + table + "}"));
  }

  private void note(String token, long eleveId, long matiereId, long sessionId, String valeur) throws Exception {
    envoyer(token, post("/api/notes"),
        "{\"eleveId\":" + eleveId + ",\"matiereId\":" + matiereId + ",\"sessionId\":" + sessionId + ",\"valeur\":" + valeur + ",\"absent\":false}");
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
                + "\",\"motDePasse\":\"secret1\",\"nomResponsable\":\"Proviseur Test\",\"acceptationConditions\":true}"))
        .andExpect(status().isCreated())
        .andReturn().getResponse().getContentAsString();
    return json.readTree(raw).get("token").asText();
  }

  private String lire(String token, String path) throws Exception {
    return mvc.perform(get(path).header("Authorization", "Bearer " + token))
        .andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString();
  }

  private ResultActions envoyer(String token, MockHttpServletRequestBuilder request, String body) throws Exception {
    return mvc.perform(request.header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content(body))
        .andExpect(status().isOk());
  }

  private long id(ResultActions actions) throws Exception {
    return json.readTree(actions.andReturn().getResponse().getContentAsString()).get("id").asLong();
  }
}
