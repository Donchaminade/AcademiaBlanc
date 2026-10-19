package tg.academiablanc.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Référentiel des types d'examen : CRUD plateforme et droits, lecture par les établissements,
 * rattachement des sessions (création, modification, type inactif, suppression d'un type utilisé)
 * et repli pour les sessions antérieures non rattachées.
 */
@SpringBootTest(properties = "app.platform.super-admin-email=proprio-types@logiciel.tg")
@AutoConfigureMockMvc
class TypesExamenTest {
  @Autowired
  private MockMvc mvc;
  @Autowired
  private ObjectMapper json;
  @Autowired
  private JdbcTemplate jdbc;

  @Test
  void referentielPlateformeEtDroits() throws Exception {
    JsonNode connexion = connexionProprietaire();
    assertEquals("SUPER_ADMIN", connexion.get("role").asText());
    assertTrue(liste(connexion.get("permissions")).contains("TYPES_EXAMEN:SUPPRIMER"));
    String proprio = connexion.get("token").asText();

    // Données initiales de la migration V13.
    JsonNode initiaux = json.readTree(corps(envoyer(proprio, get("/api/plateforme/types-examen")).andExpect(status().isOk())));
    List<String> codes = new ArrayList<>();
    initiaux.forEach(t -> codes.add(t.get("code").asText()));
    assertTrue(codes.containsAll(List.of("CEPD", "BEPC", "BAC1", "BAC2", "COMPO")), codes.toString());
    JsonNode bepc = trouver(initiaux, "BEPC");
    assertEquals("BEPC", bepc.get("libelleCourt").asText());
    assertEquals("Brevet d'Études du Premier Cycle", bepc.get("libelleLong").asText());
    assertEquals("COLLEGE", bepc.get("cycle").asText());
    assertTrue(bepc.has("sessions"), "compteur de sessions présent pour la plateforme");

    // Création, doublon de code, modification, suppression d'un type inutilisé.
    JsonNode cree = json.readTree(corps(envoyer(proprio, post("/api/plateforme/types-examen"),
        "{\"code\":\"bts\",\"libelleCourt\":\"BTS\",\"libelleLong\":\"Brevet de Technicien Supérieur\",\"cycle\":\"LYCEE\",\"ordre\":60}")
        .andExpect(status().isCreated())));
    long btsId = cree.get("id").asLong();
    assertEquals("BTS", cree.get("code").asText(), "le code est normalisé en majuscules");
    assertEquals(0, cree.get("sessions").asLong());
    envoyer(proprio, post("/api/plateforme/types-examen"),
        "{\"code\":\"BTS\",\"libelleCourt\":\"Doublon\",\"libelleLong\":\"Doublon\",\"cycle\":\"LYCEE\"}")
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.message").value(TypeExamenService.MESSAGE_CODE_DOUBLON));
    envoyer(proprio, put("/api/plateforme/types-examen/" + btsId),
        "{\"code\":\"BTS\",\"libelleCourt\":\"BTS blanc\",\"libelleLong\":\"Brevet de Technicien Supérieur\",\"cycle\":\"LYCEE\",\"ordre\":61,\"actif\":false}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.libelleCourt").value("BTS blanc"))
        .andExpect(jsonPath("$.actif").value(false));
    envoyer(proprio, delete("/api/plateforme/types-examen/" + btsId)).andExpect(status().isNoContent());
    envoyer(proprio, get("/api/plateforme/types-examen/" + btsId)).andExpect(status().isNotFound());

    // Gestionnaire avec le préréglage : lecture seule sur les types d'examen.
    JsonNode gestionnaire = json.readTree(corps(envoyer(proprio, post("/api/plateforme/gestionnaires"),
        "{\"nom\":\"Gestionnaire Types\",\"email\":\"gest-types@logiciel.tg\",\"motDePasse\":\"temp123\"}")
        .andExpect(status().isCreated())));
    assertTrue(gestionnaire.get("id").asLong() > 0);
    JsonNode connexionGest = connecter("gest-types@logiciel.tg", "temp123");
    List<String> droitsGest = liste(connexionGest.get("permissions"));
    assertTrue(droitsGest.contains("TYPES_EXAMEN:VOIR"));
    assertFalse(droitsGest.contains("TYPES_EXAMEN:CREER"));
    String gest = connexionGest.get("token").asText();
    envoyer(gest, get("/api/plateforme/types-examen")).andExpect(status().isOk());
    envoyer(gest, post("/api/plateforme/types-examen"),
        "{\"code\":\"X\",\"libelleCourt\":\"X\",\"libelleLong\":\"X\",\"cycle\":\"TOUS\"}")
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.message").value("Action non autorisée : CREER sur TYPES_EXAMEN"));
    envoyer(gest, delete("/api/plateforme/types-examen/" + bepc.get("id").asLong())).andExpect(status().isForbidden());

    // Un responsable d'établissement n'atteint pas la gestion du référentiel, mais le lit.
    String owner = inscrireEtablissement("owner-types@ecole.tg", "Lycee Types");
    envoyer(owner, get("/api/plateforme/types-examen")).andExpect(status().isForbidden());
    envoyer(owner, post("/api/plateforme/types-examen"),
        "{\"code\":\"Y\",\"libelleCourt\":\"Y\",\"libelleLong\":\"Y\",\"cycle\":\"TOUS\"}")
        .andExpect(status().isForbidden());
    JsonNode lecture = json.readTree(corps(envoyer(owner, get("/api/types-examen")).andExpect(status().isOk())));
    List<String> codesLus = new ArrayList<>();
    for (JsonNode t : lecture) {
      codesLus.add(t.get("code").asText());
      assertFalse(t.has("sessions"), "pas de compteur pour un établissement");
      assertFalse(t.has("actif"), "seuls les types actifs sont renvoyés");
    }
    assertTrue(codesLus.containsAll(List.of("CEPD", "BEPC", "BAC1", "BAC2", "COMPO")));
    JsonNode college = json.readTree(corps(envoyer(owner, get("/api/types-examen?cycle=COLLEGE")).andExpect(status().isOk())));
    List<String> codesCollege = new ArrayList<>();
    college.forEach(t -> codesCollege.add(t.get("code").asText()));
    assertTrue(codesCollege.contains("BEPC"));
    assertTrue(codesCollege.contains("COMPO"), "les types « TOUS » restent proposés");
    assertFalse(codesCollege.contains("BAC2"));
  }

  @Test
  void sessionRattacheeAuReferentiel() throws Exception {
    String proprio = connexionProprietaire().get("token").asText();
    JsonNode types = json.readTree(corps(envoyer(proprio, get("/api/plateforme/types-examen"))));
    long bepcId = trouver(types, "BEPC").get("id").asLong();
    long bac2Id = trouver(types, "BAC2").get("id").asLong();
    long bac1Id = trouver(types, "BAC1").get("id").asLong();
    // Le jeu de démonstration rattache déjà des sessions au BAC II : on raisonne en écart.
    long bac2Avant = trouver(types, "BAC2").get("sessions").asLong();
    long bepcAvant = trouver(types, "BEPC").get("sessions").asLong();

    String owner = inscrireEtablissement("owner-session-types@ecole.tg", "College Types");
    long annee = json.readTree(corps(envoyer(owner, get("/api/annees-scolaires")))).get(0).get("id").asLong();
    long centre = json.readTree(corps(envoyer(owner, post("/api/centres"), "{\"nom\":\"Centre Types\",\"code\":\"CT\",\"ville\":\"Lome\"}"))).get("id").asLong();

    // Création avec un type du référentiel : le texte reprend le libellé court.
    JsonNode session = json.readTree(corps(envoyer(owner, post("/api/sessions"),
        "{\"anneeScolaireId\":" + annee + ",\"centreId\":" + centre + ",\"nom\":\"BEPC Blanc 2026\",\"typeExamenId\":" + bepcId + ",\"statut\":\"OUVERTE\"}")
        .andExpect(status().isOk())));
    long sessionId = session.get("id").asLong();
    assertEquals(bepcId, session.get("typeExamenId").asLong());
    assertEquals("BEPC", session.get("typeExamenCode").asText());
    assertEquals("BEPC", session.get("typeExamen").asText());
    assertEquals("Brevet d'Études du Premier Cycle", session.get("typeExamenLibelleLong").asText());
    assertEquals("COLLEGE", session.get("typeExamenCycle").asText());
    assertFalse(session.get("typeExamenHorsReferentiel").asBoolean());

    // Le compteur de la plateforme suit ; la suppression du type utilisé est refusée (409).
    envoyer(proprio, get("/api/plateforme/types-examen/" + bepcId)).andExpect(jsonPath("$.sessions").value(bepcAvant + 1));
    envoyer(proprio, delete("/api/plateforme/types-examen/" + bepcId)).andExpect(status().isConflict());
    envoyer(proprio, get("/api/plateforme/types-examen/" + bepcId)).andExpect(status().isOk());

    // Sans type ni texte : refus.
    envoyer(owner, post("/api/sessions"),
        "{\"anneeScolaireId\":" + annee + ",\"centreId\":" + centre + ",\"nom\":\"Sans type\",\"statut\":\"OUVERTE\"}")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message").value(TypeExamenService.MESSAGE_TYPE_REQUIS));
    // Type inconnu : 404.
    envoyer(owner, post("/api/sessions"),
        "{\"anneeScolaireId\":" + annee + ",\"centreId\":" + centre + ",\"nom\":\"Inconnu\",\"typeExamenId\":999999,\"statut\":\"OUVERTE\"}")
        .andExpect(status().isNotFound());

    // Modification du type de la session.
    JsonNode modifiee = json.readTree(corps(envoyer(owner, put("/api/sessions/" + sessionId),
        "{\"anneeScolaireId\":" + annee + ",\"centreId\":" + centre + ",\"nom\":\"BAC II Blanc 2026\",\"typeExamenId\":" + bac2Id + ",\"serie\":\"D\",\"statut\":\"OUVERTE\"}")
        .andExpect(status().isOk())));
    assertEquals(bac2Id, modifiee.get("typeExamenId").asLong());
    assertEquals("BAC II", modifiee.get("typeExamen").asText());
    envoyer(proprio, get("/api/plateforme/types-examen/" + bepcId)).andExpect(jsonPath("$.sessions").value(bepcAvant));
    envoyer(proprio, get("/api/plateforme/types-examen/" + bac2Id)).andExpect(jsonPath("$.sessions").value(bac2Avant + 1));

    // Renommer le libellé court d'un type resynchronise le texte des sessions rattachées.
    envoyer(proprio, put("/api/plateforme/types-examen/" + bac2Id),
        "{\"code\":\"BAC2\",\"libelleCourt\":\"BAC 2\",\"libelleLong\":\"Baccalauréat Deuxième Partie\",\"cycle\":\"LYCEE\",\"ordre\":40,\"actif\":true}")
        .andExpect(status().isOk());
    envoyer(owner, get("/api/sessions/" + sessionId)).andExpect(jsonPath("$.typeExamen").value("BAC 2"))
        .andExpect(jsonPath("$.typeExamenLibelle").value("BAC 2"));
    envoyer(proprio, put("/api/plateforme/types-examen/" + bac2Id),
        "{\"code\":\"BAC2\",\"libelleCourt\":\"BAC II\",\"libelleLong\":\"Baccalauréat Deuxième Partie\",\"cycle\":\"LYCEE\",\"ordre\":40,\"actif\":true}")
        .andExpect(status().isOk());

    // Type désactivé : refusé pour une nouvelle session ; les sessions existantes le gardent et restent lisibles.
    envoyer(proprio, put("/api/plateforme/types-examen/" + bac1Id),
        "{\"code\":\"BAC1\",\"libelleCourt\":\"BAC I\",\"libelleLong\":\"Baccalauréat Première Partie (Probatoire)\",\"cycle\":\"LYCEE\",\"ordre\":30,\"actif\":false}")
        .andExpect(status().isOk());
    envoyer(owner, post("/api/sessions"),
        "{\"anneeScolaireId\":" + annee + ",\"centreId\":" + centre + ",\"nom\":\"Probatoire\",\"typeExamenId\":" + bac1Id + ",\"statut\":\"OUVERTE\"}")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message").value(TypeExamenService.MESSAGE_TYPE_INACTIF));
    JsonNode actifs = json.readTree(corps(envoyer(owner, get("/api/types-examen"))));
    for (JsonNode t : actifs) assertFalse("BAC1".equals(t.get("code").asText()), "un type désactivé n'est plus proposé");
    envoyer(proprio, put("/api/plateforme/types-examen/" + bac1Id),
        "{\"code\":\"BAC1\",\"libelleCourt\":\"BAC I\",\"libelleLong\":\"Baccalauréat Première Partie (Probatoire)\",\"cycle\":\"LYCEE\",\"ordre\":30,\"actif\":true}")
        .andExpect(status().isOk());

    // Client antérieur : texte seul reconnu et rattaché (« BAC II » → BAC2).
    JsonNode ancienne = json.readTree(corps(envoyer(owner, post("/api/sessions"),
        "{\"anneeScolaireId\":" + annee + ",\"centreId\":" + centre + ",\"nom\":\"Ancien client\",\"typeExamen\":\"BACCALAURÉAT II\",\"statut\":\"OUVERTE\"}")
        .andExpect(status().isOk())));
    assertEquals(bac2Id, ancienne.get("typeExamenId").asLong());
    assertEquals("BAC II", ancienne.get("typeExamen").asText());

    // Session antérieure à la migration, insérée sans type : repli sur le texte (reconnu), signalée hors référentiel.
    long etablissementId = jdbc.queryForObject("SELECT etablissement_id FROM session_examen WHERE id = ?", Long.class, sessionId);
    jdbc.update("INSERT INTO session_examen (etablissement_id, annee_scolaire_id, centre_id, nom, type_examen, statut) VALUES (?, ?, ?, ?, ?, ?)",
        etablissementId, annee, centre, "Session historique", "BACCALAURÉAT II", "OUVERTE");
    long historiqueId = jdbc.queryForObject("SELECT id FROM session_examen WHERE nom = 'Session historique'", Long.class);
    JsonNode historique = json.readTree(corps(envoyer(owner, get("/api/sessions/" + historiqueId)).andExpect(status().isOk())));
    assertTrue(historique.get("typeExamenId").isNull());
    assertTrue(historique.get("typeExamenHorsReferentiel").asBoolean());
    assertEquals("BACCALAURÉAT II", historique.get("typeExamen").asText(), "le texte d'origine est conservé");
    assertEquals("BAC2", historique.get("typeExamenCode").asText(), "mais reconnu pour l'affichage");
    assertEquals("BAC II", historique.get("typeExamenLibelle").asText());
    // Une modification depuis le formulaire la rattache définitivement.
    JsonNode rattachee = json.readTree(corps(envoyer(owner, put("/api/sessions/" + historiqueId),
        "{\"anneeScolaireId\":" + annee + ",\"centreId\":" + centre + ",\"nom\":\"Session historique\",\"typeExamenId\":" + bac2Id + ",\"statut\":\"OUVERTE\"}")
        .andExpect(status().isOk())));
    assertEquals(bac2Id, rattachee.get("typeExamenId").asLong());
    assertFalse(rattachee.get("typeExamenHorsReferentiel").asBoolean());
    assertEquals("BAC II", rattachee.get("typeExamen").asText());

    // Texte libre inconnu du référentiel : conservé tel quel, sans rattachement.
    JsonNode libre = json.readTree(corps(envoyer(owner, post("/api/sessions"),
        "{\"anneeScolaireId\":" + annee + ",\"centreId\":" + centre + ",\"nom\":\"Concours interne\",\"typeExamen\":\"Concours d'entrée\",\"statut\":\"OUVERTE\"}")
        .andExpect(status().isOk())));
    assertTrue(libre.get("typeExamenId").isNull());
    assertEquals("Concours d'entrée", libre.get("typeExamenLibelle").asText());
    assertTrue(libre.get("typeExamenHorsReferentiel").asBoolean());
  }

  private static JsonNode trouver(JsonNode types, String code) {
    for (JsonNode t : types) if (code.equals(t.get("code").asText())) return t;
    throw new AssertionError("type absent : " + code);
  }

  /** Les deux tests partagent la base : le compte du propriétaire n'est inscrit qu'une fois. */
  private JsonNode connexionProprietaire() throws Exception {
    String email = "proprio-types@logiciel.tg";
    int statut = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"" + email + "\",\"motDePasse\":\"secret1\"}"))
        .andReturn().getResponse().getStatus();
    if (statut != 200) {
      mvc.perform(post("/api/auth/signup")
              .contentType(MediaType.APPLICATION_JSON)
              .content("{\"nom\":\"Compte Proprio Types\",\"ville\":\"Lome\",\"email\":\"" + email
                  + "\",\"motDePasse\":\"secret1\",\"nomResponsable\":\"Proprietaire\"}"))
          .andExpect(status().isOk());
    }
    return connecter(email, "secret1");
  }

  private String inscrireEtablissement(String email, String nom) throws Exception {
    return json.readTree(mvc.perform(post("/api/auth/signup")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"nom\":\"" + nom + "\",\"ville\":\"Lome\",\"email\":\"" + email
                + "\",\"motDePasse\":\"secret1\",\"nomResponsable\":\"Proviseur\"}"))
        .andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString()).get("token").asText();
  }

  private JsonNode connecter(String email, String motDePasse) throws Exception {
    return json.readTree(mvc.perform(post("/api/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"" + email + "\",\"motDePasse\":\"" + motDePasse + "\"}"))
        .andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString());
  }

  private ResultActions envoyer(String token, MockHttpServletRequestBuilder request) throws Exception {
    return mvc.perform(request.header("Authorization", "Bearer " + token));
  }

  private ResultActions envoyer(String token, MockHttpServletRequestBuilder request, String body) throws Exception {
    return mvc.perform(request.header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content(body));
  }

  private static String corps(ResultActions actions) throws Exception {
    return actions.andReturn().getResponse().getContentAsString();
  }

  private static List<String> liste(JsonNode node) {
    List<String> values = new ArrayList<>();
    if (node != null) node.forEach(item -> values.add(item.asText()));
    return values;
  }
}
