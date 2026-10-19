package tg.academiablanc.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
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

/** Programme des classes : affectation groupée des matières avec leurs coefficients. */
@SpringBootTest
@AutoConfigureMockMvc
class ProgrammeClasseFlowTest {
  @Autowired
  private MockMvc mvc;
  @Autowired
  private ObjectMapper json;

  @Test
  void definitRemplaceEtCopieLeProgrammeDUneClasse() throws Exception {
    String token = inscrire("programme@ecole.tg", "College Programme");
    long anneeId = json.readTree(lire(token, "/api/annees-scolaires")).get(0).get("id").asLong();
    envoyer(token, post("/api/matieres/referentiel")).andExpect(status().isOk());
    JsonNode matieres = json.readTree(lire(token, "/api/matieres"));
    long fr = idDe(matieres, "fr");
    long mat = idDe(matieres, "mat");
    long svt = idDe(matieres, "svt");
    long epsId = id(envoyer(token, post("/api/matieres"), "{\"nom\":\"EPS\",\"code\":\"eps\"}"));

    long troisiemeId = id(envoyer(token, post("/api/classes"),
        "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"3e A\",\"niveau\":\"3e\"}"));
    long troisiemeBId = id(envoyer(token, post("/api/classes"),
        "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"3e B\",\"niveau\":\"3e\"}"));

    // Aucun programme au départ.
    envoyer(token, get("/api/classes/" + troisiemeId + "/programme")).andExpect(jsonPath("$", hasSize(0)));

    // Les suggestions couvrent tout le catalogue (grille collège : FR 3, MAT 3 ; hors référentiel : 1).
    JsonNode suggestions = json.readTree(lire(token, "/api/classes/" + troisiemeId + "/programme/suggestions"));
    assertThat(suggestions).hasSize(8);
    assertThat(coefDe(suggestions, fr)).isEqualByComparingTo(BigDecimal.valueOf(3));
    assertThat(coefDe(suggestions, epsId)).isEqualByComparingTo(BigDecimal.ONE);

    // Première définition : coefficient absent → 1 ; ordre du bulletin (LT puis SC puis hors groupe).
    envoyer(token, put("/api/classes/" + troisiemeId + "/programme"),
        "[{\"matiereId\":" + mat + ",\"coefficient\":3},{\"matiereId\":" + fr + ",\"coefficient\":3},{\"matiereId\":" + epsId + "}]")
        .andExpect(jsonPath("$", hasSize(3)))
        .andExpect(jsonPath("$[0].code").value("fr"))
        .andExpect(jsonPath("$[0].groupe").value("LT"))
        .andExpect(jsonPath("$[1].code").value("mat"))
        .andExpect(jsonPath("$[1].coefficient").value(3))
        .andExpect(jsonPath("$[2].code").value("eps"))
        .andExpect(jsonPath("$[2].coefficient").value(1));
    assertThat(json.readTree(lire(token, "/api/coefficients"))).hasSize(3);

    // Remplacement : MAT mis à jour, EPS retiré, SVT ajouté → toujours 3 lignes, pas de doublon.
    envoyer(token, put("/api/classes/" + troisiemeId + "/programme"),
        "[{\"matiereId\":" + mat + ",\"coefficient\":4},{\"matiereId\":" + fr + ",\"coefficient\":3},{\"matiereId\":" + svt + ",\"coefficient\":2}]")
        .andExpect(jsonPath("$", hasSize(3)))
        .andExpect(jsonPath("$[*].code", contains("fr", "mat", "svt")));
    JsonNode programme = json.readTree(lire(token, "/api/classes/" + troisiemeId + "/programme"));
    assertThat(coefDe(programme, mat)).isEqualByComparingTo(BigDecimal.valueOf(4));
    assertThat(json.readTree(lire(token, "/api/coefficients"))).hasSize(3);

    // Validation : coefficient hors bornes, doublon, matière inconnue.
    refuser(token, put("/api/classes/" + troisiemeId + "/programme"),
        "[{\"matiereId\":" + fr + ",\"coefficient\":25}]", 400);
    refuser(token, put("/api/classes/" + troisiemeId + "/programme"),
        "[{\"matiereId\":" + fr + "},{\"matiereId\":" + fr + "}]", 400);
    refuser(token, put("/api/classes/" + troisiemeId + "/programme"),
        "[{\"matiereId\":999999}]", 404);
    // Rien n'a bougé.
    assertThat(json.readTree(lire(token, "/api/classes/" + troisiemeId + "/programme"))).hasSize(3);

    // Copie vers la 3e B, puis refus de copier depuis une classe sans programme ou depuis soi-même.
    envoyer(token, post("/api/classes/" + troisiemeBId + "/programme/copier-de/" + troisiemeId))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$", hasSize(3)));
    assertThat(coefDe(json.readTree(lire(token, "/api/classes/" + troisiemeBId + "/programme")), mat))
        .isEqualByComparingTo(BigDecimal.valueOf(4));
    long videId = id(envoyer(token, post("/api/classes"),
        "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"6e\",\"niveau\":\"6e\"}"));
    envoyer(token, post("/api/classes/" + troisiemeBId + "/programme/copier-de/" + videId)).andExpect(status().isBadRequest());
    envoyer(token, post("/api/classes/" + troisiemeBId + "/programme/copier-de/" + troisiemeBId)).andExpect(status().isBadRequest());

    // L'ancien formulaire coefficient par coefficient ne crée pas de doublon dans un programme.
    mvc.perform(post("/api/coefficients").header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"matiereId\":" + mat + ",\"classeId\":" + troisiemeId + ",\"valeur\":5}"))
        .andExpect(status().isConflict());

    // Liste vide : le programme est retiré.
    envoyer(token, put("/api/classes/" + troisiemeBId + "/programme"), "[]").andExpect(jsonPath("$", hasSize(0)));
    assertThat(json.readTree(lire(token, "/api/coefficients"))).hasSize(3);
  }

  @Test
  void leProgrammeEstCloisonneParEtablissement() throws Exception {
    String token = inscrire("programme-a@ecole.tg", "Lycee A");
    String autre = inscrire("programme-b@ecole.tg", "Lycee B");
    long anneeId = json.readTree(lire(token, "/api/annees-scolaires")).get(0).get("id").asLong();
    long classeId = id(envoyer(token, post("/api/classes"),
        "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"Tle D\",\"niveau\":\"Tle\",\"serie\":\"D\"}"));
    long matiereA = id(envoyer(token, post("/api/matieres"), "{\"nom\":\"Maths\",\"code\":\"mat\"}"));
    long matiereB = id(envoyer(autre, post("/api/matieres"), "{\"nom\":\"Maths B\",\"code\":\"mat\"}"));

    // Un autre établissement ne voit ni ne modifie le programme.
    envoyer(autre, get("/api/classes/" + classeId + "/programme")).andExpect(status().isNotFound());
    refuser(autre, put("/api/classes/" + classeId + "/programme"), "[{\"matiereId\":" + matiereB + "}]", 404);
    // Une matière d'un autre établissement est refusée dans le programme.
    refuser(token, put("/api/classes/" + classeId + "/programme"), "[{\"matiereId\":" + matiereB + "}]", 404);
    envoyer(token, get("/api/classes/" + classeId + "/programme")).andExpect(jsonPath("$", hasSize(0)));

    envoyer(token, put("/api/classes/" + classeId + "/programme"), "[{\"matiereId\":" + matiereA + ",\"coefficient\":4}]")
        .andExpect(jsonPath("$", hasSize(1)));
    assertThat(json.readTree(lire(autre, "/api/coefficients"))).isEmpty();
  }

  @Test
  void leBulletinEtLesNotesSeLimitentAuProgrammeDeLaClasse() throws Exception {
    String token = inscrire("programme-bulletin@ecole.tg", "Lycee Bulletin");
    long anneeId = json.readTree(lire(token, "/api/annees-scolaires")).get(0).get("id").asLong();
    long centreId = id(envoyer(token, post("/api/centres"), "{\"nom\":\"Centre\",\"code\":\"C1\",\"ville\":\"Lome\"}"));
    long sessionId = id(envoyer(token, post("/api/sessions"),
        "{\"anneeScolaireId\":" + anneeId + ",\"centreId\":" + centreId
            + ",\"nom\":\"Examen blanc\",\"typeExamen\":\"BLANC\",\"statut\":\"OUVERTE\"}"));
    long fr = id(envoyer(token, post("/api/matieres"), "{\"nom\":\"Français\",\"code\":\"fr\",\"groupeCode\":\"LT\"}"));
    long mat = id(envoyer(token, post("/api/matieres"), "{\"nom\":\"Mathématiques\",\"code\":\"mat\",\"groupeCode\":\"SC\"}"));
    long philo = id(envoyer(token, post("/api/matieres"), "{\"nom\":\"Philosophie\",\"code\":\"philo\",\"groupeCode\":\"LT\"}"));
    // Coefficient global : seul repli des classes sans programme.
    envoyer(token, post("/api/coefficients"), "{\"matiereId\":" + mat + ",\"valeur\":2}");

    long troisiemeId = id(envoyer(token, post("/api/classes"),
        "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"3e\",\"niveau\":\"3e\"}"));
    long terminaleId = id(envoyer(token, post("/api/classes"),
        "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"Tle A4\",\"niveau\":\"Tle\",\"serie\":\"A4\"}"));
    // La 3e a un programme sans philosophie ; la Tle A4 n'a pas de programme (comportement historique).
    envoyer(token, put("/api/classes/" + troisiemeId + "/programme"),
        "[{\"matiereId\":" + fr + ",\"coefficient\":3},{\"matiereId\":" + mat + ",\"coefficient\":3}]")
        .andExpect(status().isOk());

    long collegien = eleve(token, troisiemeId, sessionId, "ABALO Koffi");
    long lyceen = eleve(token, terminaleId, sessionId, "BOKO Ama");
    noter(token, collegien, fr, sessionId, "12");
    noter(token, collegien, mat, sessionId, "16");
    // Note hors programme refusée pour le collégien, acceptée pour le lycéen (classe sans programme).
    refuser(token, post("/api/notes"),
        "{\"eleveId\":" + collegien + ",\"matiereId\":" + philo + ",\"sessionId\":" + sessionId + ",\"valeur\":10,\"absent\":false}", 400);
    noter(token, lyceen, philo, sessionId, "14");
    noter(token, lyceen, fr, sessionId, "10");

    JsonNode bulletins = json.readTree(lire(token, "/api/bulletins?sessionId=" + sessionId));
    assertThat(bulletins).hasSize(2);
    JsonNode duCollegien = parEleve(bulletins, collegien);
    JsonNode duLyceen = parEleve(bulletins, lyceen);

    // 3e : deux lignes (FR, MAT) avec les coefficients du programme → (12×3 + 16×3) / 6 = 14.
    assertThat(duCollegien.get("lignes")).hasSize(2);
    assertThat(duCollegien.get("totalCoef").decimalValue()).isEqualByComparingTo(BigDecimal.valueOf(6));
    assertThat(duCollegien.get("moyenne").decimalValue()).isEqualByComparingTo(BigDecimal.valueOf(14));
    for (JsonNode ligne : duCollegien.get("lignes")) {
      assertThat(ligne.get("matiereId").asLong()).isNotEqualTo(philo);
    }

    // Tle A4 sans programme : toutes les matières, coefficients globaux (MAT 2, autres 1) ; MAT absente,
    // donc exclue du total des coefficients (règle GradeCalculator) : (10 + 14) / 2 = 12.
    assertThat(duLyceen.get("lignes")).hasSize(3);
    assertThat(duLyceen.get("totalCoef").decimalValue()).isEqualByComparingTo(BigDecimal.valueOf(2));
    assertThat(duLyceen.get("moyenne").decimalValue()).isEqualByComparingTo(BigDecimal.valueOf(12));
    JsonNode ligneMat = null;
    for (JsonNode ligne : duLyceen.get("lignes")) {
      if (ligne.get("matiereId").asLong() == mat) ligneMat = ligne;
    }
    assertThat(ligneMat).isNotNull();
    assertThat(ligneMat.get("absent").asBoolean()).isTrue();
    assertThat(ligneMat.get("coefficient").decimalValue()).isEqualByComparingTo(BigDecimal.valueOf(2));
  }

  @Test
  void uneClasseDuCollegeNAPasDeSerie() throws Exception {
    String token = inscrire("programme-college@ecole.tg", "College Sans Serie");
    long anneeId = json.readTree(lire(token, "/api/annees-scolaires")).get(0).get("id").asLong();
    refuser(token, post("/api/classes"),
        "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"4e D\",\"niveau\":\"4e\",\"serie\":\"D\"}", 400);
    envoyer(token, post("/api/classes"), "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"4e\",\"niveau\":\"Quatrième\",\"serie\":\"\"}")
        .andExpect(jsonPath("$.serie", nullValue()));
    assertThat(ClasseNiveauUtil.nomClasse("Troisième", null)).isEqualTo("3e");
    assertThat(ClasseNiveauUtil.nomClasse("Terminale", "d")).isEqualTo("Tle D");
  }

  private static long idDe(JsonNode matieres, String code) {
    for (JsonNode n : matieres) {
      if (code.equals(n.get("code").asText())) return n.get("id").asLong();
    }
    throw new AssertionError("Matière " + code + " absente");
  }

  private static BigDecimal coefDe(JsonNode lignes, long matiereId) {
    for (JsonNode n : lignes) {
      if (n.get("matiereId").asLong() == matiereId) return n.get("coefficient").decimalValue();
    }
    throw new AssertionError("Matière " + matiereId + " absente du programme");
  }

  private static JsonNode parEleve(JsonNode bulletins, long eleveId) {
    for (JsonNode n : bulletins) {
      if (n.get("eleveId").asLong() == eleveId) return n;
    }
    throw new AssertionError("Bulletin de l'élève " + eleveId + " absent");
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

  private void refuser(String token, MockHttpServletRequestBuilder request, String body, int statut) throws Exception {
    mvc.perform(request.header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content(body))
        .andExpect(status().is(statut));
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
