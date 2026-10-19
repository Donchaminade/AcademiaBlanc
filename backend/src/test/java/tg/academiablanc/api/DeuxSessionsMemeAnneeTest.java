package tg.academiablanc.api;

import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Un établissement organise autant d'examens blancs qu'il veut dans la même année scolaire :
 * « BEPC blanc n°1 » en novembre, puis « BEPC blanc n°2 » en février, même type d'examen, même
 * classe de 3e, mêmes élèves. La seconde session reprend les élèves de la première sans réimport,
 * ses notes sont saisies à part (jamais mélangées ni écrasées), chaque session imprime ses propres
 * bulletins et la première, archivée, reste consultable et n'empêche pas d'en créer une nouvelle.
 */
@SpringBootTest
@AutoConfigureMockMvc
class DeuxSessionsMemeAnneeTest {
  @Autowired
  private MockMvc mvc;
  @Autowired
  private ObjectMapper json;

  @Test
  void unSecondBepcBlancDansLaMemeAnneeReprendLesElevesSansMelangerLesNotes() throws Exception {
    String token = inscrire("deux-sessions@ecole.tg", "College Deux Sessions");
    long anneeId = json.readTree(lire(token, "/api/annees-scolaires")).get(0).get("id").asLong();
    long centreId = id(envoyer(token, post("/api/centres"), "{\"nom\":\"Centre\",\"code\":\"CT\",\"ville\":\"Lome\"}"));
    long bepcId = typeId(token, "BEPC");

    long troisieme = id(envoyer(token, post("/api/classes"),
        "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"3e A\",\"niveau\":\"3e\"}"));
    long maths = id(envoyer(token, post("/api/matieres"), "{\"nom\":\"Mathématiques\",\"code\":\"MATH\"}"));
    long francais = id(envoyer(token, post("/api/matieres"), "{\"nom\":\"Français\",\"code\":\"FR\"}"));
    // Programme de la 3e : maths coef 4, français coef 3 (commun à toutes les sessions de l'année).
    envoyer(token, post("/api/coefficients"), "{\"matiereId\":" + maths + ",\"classeId\":" + troisieme + ",\"valeur\":4}")
        .andExpect(status().isOk());
    envoyer(token, post("/api/coefficients"), "{\"matiereId\":" + francais + ",\"classeId\":" + troisieme + ",\"valeur\":3}")
        .andExpect(status().isOk());

    // Session A : BEPC blanc n°1, élèves importés en la désignant comme session active.
    long sessionA = id(envoyer(token, post("/api/sessions"),
        "{\"anneeScolaireId\":" + anneeId + ",\"centreId\":" + centreId
            + ",\"nom\":\"BEPC Blanc n°1 – novembre\",\"typeExamenId\":" + bepcId + ",\"statut\":\"OUVERTE\"}"));
    long ama = id(envoyer(token, post("/api/eleves"),
        "{\"classeId\":" + troisieme + ",\"sessionId\":" + sessionA + ",\"nomComplet\":\"AKAKPO Ama\",\"genre\":\"F\",\"numeroTable\":1}"));
    long kossi = id(envoyer(token, post("/api/eleves"),
        "{\"classeId\":" + troisieme + ",\"sessionId\":" + sessionA + ",\"nomComplet\":\"MENSAH Kossi\",\"genre\":\"M\",\"numeroTable\":2}"));
    noter(token, sessionA, ama, maths, 12);
    noter(token, sessionA, ama, francais, 10);
    noter(token, sessionA, kossi, maths, 8);
    noter(token, sessionA, kossi, francais, 14);

    JsonNode bulletinsA = bulletins(token, sessionA);
    assertEquals(Set.of(ama, kossi), elevesDe(bulletinsA));
    BigDecimal moyenneAmaA = moyenne(bulletinsA, ama);
    BigDecimal moyenneKossiA = moyenne(bulletinsA, kossi);
    assertEquals(0, new BigDecimal("11.14").compareTo(moyenneAmaA), "Ama : (12×4 + 10×3) / 7");
    assertEquals(0, new BigDecimal("10.57").compareTo(moyenneKossiA), "Kossi : (8×4 + 14×3) / 7");
    assertEquals(1, rang(bulletinsA, ama));
    assertEquals(2, rang(bulletinsA, kossi));

    // La session A est archivée (PV verrouillé) : cela n'empêche pas d'ouvrir la suivante.
    envoyer(token, post("/api/archives/" + sessionA)).andExpect(status().isOk());

    // Deux sessions ne peuvent pas porter le même intitulé : on ne saurait plus les distinguer.
    envoyer(token, post("/api/sessions"),
        "{\"anneeScolaireId\":" + anneeId + ",\"centreId\":" + centreId
            + ",\"nom\":\"bepc blanc n°1 – novembre\",\"typeExamenId\":" + bepcId + ",\"statut\":\"OUVERTE\"}")
        .andExpect(status().isConflict());

    // Session B : BEPC blanc n°2, même année, même type, même classe ; aucun élève réimporté.
    long sessionB = id(envoyer(token, post("/api/sessions"),
        "{\"anneeScolaireId\":" + anneeId + ",\"centreId\":" + centreId
            + ",\"nom\":\"BEPC Blanc n°2 – février\",\"typeExamenId\":" + bepcId + ",\"statut\":\"OUVERTE\"}"));
    assertNotEquals(sessionA, sessionB);

    // Avant toute note, B présente déjà les candidats de A (élèves non notés, moyenne vide).
    JsonNode bulletinsBVides = bulletins(token, sessionB);
    assertEquals(Set.of(ama, kossi), elevesDe(bulletinsBVides));
    assertTrue(parEleve(bulletinsBVides, ama).get("moyenne").isNull(), "aucune note de A ne fuit dans B");
    envoyer(token, get("/api/notes").param("sessionId", String.valueOf(sessionB))).andExpect(jsonPath("$", hasSize(0)));

    // Notes de B, différentes et inversant le classement.
    noter(token, sessionB, ama, maths, 6);
    noter(token, sessionB, ama, francais, 9);
    noter(token, sessionB, kossi, maths, 16);
    noter(token, sessionB, kossi, francais, 15);

    JsonNode bulletinsB = bulletins(token, sessionB);
    assertEquals(Set.of(ama, kossi), elevesDe(bulletinsB));
    assertEquals(0, new BigDecimal("7.29").compareTo(moyenne(bulletinsB, ama)), "Ama en B : (6×4 + 9×3) / 7");
    assertEquals(0, new BigDecimal("15.57").compareTo(moyenne(bulletinsB, kossi)), "Kossi en B : (16×4 + 15×3) / 7");
    assertEquals(2, rang(bulletinsB, ama));
    assertEquals(1, rang(bulletinsB, kossi));
    assertEquals("BEPC Blanc n°2 – février", parEleve(bulletinsB, ama).get("entete").get("sessionNom").asText());

    // La session A n'a pas bougé : mêmes notes, mêmes moyennes, même classement, même bandeau.
    JsonNode bulletinsARelus = bulletins(token, sessionA);
    assertEquals(0, moyenneAmaA.compareTo(moyenne(bulletinsARelus, ama)));
    assertEquals(0, moyenneKossiA.compareTo(moyenne(bulletinsARelus, kossi)));
    assertEquals(1, rang(bulletinsARelus, ama));
    assertEquals("BEPC Blanc n°1 – novembre", parEleve(bulletinsARelus, ama).get("entete").get("sessionNom").asText());
    envoyer(token, get("/api/notes").param("sessionId", String.valueOf(sessionA))).andExpect(jsonPath("$", hasSize(4)));
    envoyer(token, get("/api/notes").param("sessionId", String.valueOf(sessionB))).andExpect(jsonPath("$", hasSize(4)));

    // Les deux sessions restent listées ; seule A figure aux archives, avec ses statistiques propres.
    JsonNode sessions = json.readTree(lire(token, "/api/sessions"));
    Set<Long> ids = new HashSet<>();
    for (JsonNode s : sessions) ids.add(s.get("id").asLong());
    assertTrue(ids.containsAll(Set.of(sessionA, sessionB)));
    JsonNode archives = json.readTree(lire(token, "/api/archives"));
    assertEquals(1, archives.size());
    assertEquals(sessionA, archives.get(0).get("sessionId").asLong());
    assertEquals(2, archives.get(0).get("effectif").asInt());

    // Renommer B en reprenant l'intitulé de A est refusé ; garder son propre nom reste permis.
    envoyer(token, put("/api/sessions/" + sessionB),
        "{\"anneeScolaireId\":" + anneeId + ",\"centreId\":" + centreId
            + ",\"nom\":\"BEPC Blanc n°1 – novembre\",\"typeExamenId\":" + bepcId + ",\"statut\":\"OUVERTE\"}")
        .andExpect(status().isConflict());
    envoyer(token, put("/api/sessions/" + sessionB),
        "{\"anneeScolaireId\":" + anneeId + ",\"centreId\":" + centreId
            + ",\"nom\":\"BEPC Blanc n°2 – février\",\"typeExamenId\":" + bepcId + ",\"statut\":\"OUVERTE\"}")
        .andExpect(status().isOk());
  }

  @Test
  void unExamenDUnAutreTypeDansLaMemeAnneeGardeSesPropresCandidats() throws Exception {
    String token = inscrire("deux-types@ecole.tg", "Lycee Deux Types");
    long anneeId = json.readTree(lire(token, "/api/annees-scolaires")).get(0).get("id").asLong();
    long centreId = id(envoyer(token, post("/api/centres"), "{\"nom\":\"Centre\",\"code\":\"CT\",\"ville\":\"Lome\"}"));
    envoyer(token, post("/api/series/defauts"), "{}");
    long bepcId = typeId(token, "BEPC");
    long bac2Id = typeId(token, "BAC2");
    long troisieme = id(envoyer(token, post("/api/classes"), "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"3e\",\"niveau\":\"3e\"}"));
    long terminale = id(envoyer(token, post("/api/classes"), "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"Tle D\",\"niveau\":\"Tle\",\"serie\":\"D\"}"));

    long bepc1 = id(envoyer(token, post("/api/sessions"), "{\"anneeScolaireId\":" + anneeId + ",\"centreId\":" + centreId
        + ",\"nom\":\"BEPC Blanc n°1\",\"typeExamenId\":" + bepcId + ",\"statut\":\"OUVERTE\"}"));
    long bac = id(envoyer(token, post("/api/sessions"), "{\"anneeScolaireId\":" + anneeId + ",\"centreId\":" + centreId
        + ",\"nom\":\"BAC II Blanc\",\"typeExamenId\":" + bac2Id + ",\"statut\":\"OUVERTE\"}"));
    long collegien = id(envoyer(token, post("/api/eleves"),
        "{\"classeId\":" + troisieme + ",\"sessionId\":" + bepc1 + ",\"nomComplet\":\"AKAKPO Ama\",\"genre\":\"F\"}"));
    long lyceen = id(envoyer(token, post("/api/eleves"),
        "{\"classeId\":" + terminale + ",\"sessionId\":" + bac + ",\"nomComplet\":\"MENSAH Kossi\",\"genre\":\"M\"}"));

    long bepc2 = id(envoyer(token, post("/api/sessions"), "{\"anneeScolaireId\":" + anneeId + ",\"centreId\":" + centreId
        + ",\"nom\":\"BEPC Blanc n°2\",\"typeExamenId\":" + bepcId + ",\"statut\":\"OUVERTE\"}"));

    // Le second BEPC reprend le collégien du premier, pas le lycéen du BAC ; et réciproquement.
    assertEquals(Set.of(collegien), elevesDe(bulletins(token, bepc2)));
    assertEquals(Set.of(collegien), elevesDe(bulletins(token, bepc1)));
    assertEquals(Set.of(lyceen), elevesDe(bulletins(token, bac)));
  }

  private void noter(String token, long sessionId, long eleveId, long matiereId, int valeur) throws Exception {
    envoyer(token, post("/api/notes"),
        "{\"eleveId\":" + eleveId + ",\"matiereId\":" + matiereId + ",\"sessionId\":" + sessionId + ",\"valeur\":" + valeur + ",\"absent\":false}")
        .andExpect(status().isOk());
  }

  private static Set<Long> elevesDe(JsonNode bulletins) {
    Set<Long> ids = new HashSet<>();
    for (JsonNode b : bulletins) ids.add(b.get("eleveId").asLong());
    return ids;
  }

  private static BigDecimal moyenne(JsonNode bulletins, long eleveId) {
    return parEleve(bulletins, eleveId).get("moyenne").decimalValue();
  }

  private static int rang(JsonNode bulletins, long eleveId) {
    return parEleve(bulletins, eleveId).get("rang").asInt();
  }

  private static JsonNode parEleve(JsonNode bulletins, long eleveId) {
    for (JsonNode b : bulletins) {
      if (b.get("eleveId").asLong() == eleveId) return b;
    }
    throw new AssertionError("Bulletin introuvable pour l'élève " + eleveId);
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
    return mvc.perform(request.header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content(body));
  }

  private long id(ResultActions result) throws Exception {
    return json.readTree(result.andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asLong();
  }
}
