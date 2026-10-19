package tg.academiablanc.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
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
 * Transfert des données d'un examen blanc commun par code personnel, de bout en bout :
 * H (centre) organise une session inter-établissements avec trois candidats (deux de Y, un de Z), saisit les
 * notes, envoie à Y le paquet de ses deux élèves grâce au code de Y ; Y le refuse puis l'accepte : une session
 * interne verrouillée est créée chez Y avec classes, matières, programme, élèves, notes et le rang de l'examen
 * commun ; le code de Y change ; Z ne voit rien ; H ne lit pas les données de Y.
 */
@SpringBootTest
@AutoConfigureMockMvc
class TransfertExamenFlowTest {
  @Autowired
  private MockMvc mvc;
  @Autowired
  private ObjectMapper json;

  @Test
  void transfertDeBoutEnBout() throws Exception {
    String h = inscrire("centre-h@ecole.tg", "CS Harmonia");
    String y = inscrire("ecole-y@ecole.tg", "College Y");
    String z = inscrire("ecole-z@ecole.tg", "College Z");

    // --- Code de transfert : visible du chef (OWNER), absent pour un secrétaire ---------------------------------
    JsonNode profilY = json.readTree(lire(y, "/api/etablissement"));
    String codeY = profilY.get("codeTransfert").asText();
    assertTrue(codeY.matches("[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}"), "code lisible sans ambiguïté : " + codeY);
    envoyer(y, post("/api/utilisateurs"),
        "{\"nom\":\"Sec Y\",\"email\":\"sec-y@ecole.tg\",\"motDePasse\":\"temp123\",\"role\":\"SECRETAIRE\"}")
        .andExpect(status().isCreated());
    String secY = connecter("sec-y@ecole.tg", "temp123");
    JsonNode profilSec = json.readTree(lire(secY, "/api/etablissement"));
    assertTrue(profilSec.get("codeTransfert").isNull(), "le secrétariat ne voit pas le code");
    envoyer(secY, post("/api/etablissement/code-transfert/regenerer")).andExpect(status().isForbidden());
    envoyer(secY, get("/api/transferts/recus")).andExpect(status().isForbidden());
    // Régénération par le chef : nouveau code, l'ancien devient invalide.
    String codeYAvant = codeY;
    codeY = json.readTree(corps(envoyer(y, post("/api/etablissement/code-transfert/regenerer")).andExpect(status().isOk())))
        .get("codeTransfert").asText();
    assertNotEquals(codeYAvant, codeY);

    // --- Session inter-établissements chez H : 3 candidats (2 de Y, 1 de Z), notes --------------------------------
    long anneeH = json.readTree(lire(h, "/api/annees-scolaires")).get(0).get("id").asLong();
    long centreH = id(envoyer(h, post("/api/centres"), "{\"nom\":\"Centre 01\",\"code\":\"C01\",\"ville\":\"Lome\"}"));
    long bepc = typeId(h, "BEPC");
    long maths = id(envoyer(h, post("/api/matieres"), "{\"nom\":\"Mathématiques\",\"code\":\"MATH\"}"));
    long francais = id(envoyer(h, post("/api/matieres"), "{\"nom\":\"Français\",\"code\":\"FR\"}"));
    long troisieme = id(envoyer(h, post("/api/classes"), "{\"anneeScolaireId\":" + anneeH + ",\"nom\":\"3e A\",\"niveau\":\"3e\"}"));
    envoyer(h, put("/api/classes/" + troisieme + "/programme"),
        "[{\"matiereId\":" + maths + ",\"coefficient\":4},{\"matiereId\":" + francais + ",\"coefficient\":3}]").andExpect(status().isOk());
    long sessionH = id(envoyer(h, post("/api/sessions"),
        "{\"anneeScolaireId\":" + anneeH + ",\"centreId\":" + centreH + ",\"nom\":\"BEPC Blanc 2026\",\"typeExamenId\":" + bepc
            + ",\"statut\":\"OUVERTE\",\"mode\":\"INTER_ETABLISSEMENTS\"}"));
    envoyer(h, post("/api/eleves/import"),
        "{\"classeId\":" + troisieme + ",\"sessionId\":" + sessionH + ",\"eleves\":["
            + "{\"nomComplet\":\"AKAKPO Ama\",\"genre\":\"F\",\"dateNaissance\":\"2010-04-12\",\"etablissementOrigine\":\"Collège Y\"},"
            + "{\"nomComplet\":\"MENSAH Kossi\",\"genre\":\"M\",\"dateNaissance\":\"2009-11-02\",\"etablissementOrigine\":\"Collège Y\"},"
            + "{\"nomComplet\":\"DOSSOU Afi\",\"genre\":\"F\",\"etablissementOrigine\":\"Collège Z\"}]}")
        .andExpect(status().isOk()).andExpect(jsonPath("$.crees").value(3));
    long ama = -1, kossi = -1, afi = -1;
    for (JsonNode e : json.readTree(lire(h, "/api/eleves"))) {
      switch (e.get("nomComplet").asText()) {
        case "AKAKPO Ama" -> ama = e.get("id").asLong();
        case "MENSAH Kossi" -> kossi = e.get("id").asLong();
        case "DOSSOU Afi" -> afi = e.get("id").asLong();
        default -> { }
      }
    }
    // Kossi 1er (15,57), Ama 2e (11,14), Afi 3e (8,43) : le rang commun traverse les établissements.
    noter(h, sessionH, kossi, maths, 16); noter(h, sessionH, kossi, francais, 15);
    noter(h, sessionH, ama, maths, 12); noter(h, sessionH, ama, francais, 10);
    noter(h, sessionH, afi, maths, 8); noter(h, sessionH, afi, francais, 9);

    // --- Origines vues par le centre ------------------------------------------------------------------------
    JsonNode origines = json.readTree(corps(envoyer(h, get("/api/transferts/origines").param("sessionId", String.valueOf(sessionH)))
        .andExpect(status().isOk())));
    assertEquals(2, origines.size());
    assertEquals("Collège Y", origines.get(0).get("etablissementOrigine").asText());
    assertEquals(2, origines.get(0).get("effectif").asInt());
    assertEquals(4, origines.get(0).get("notesSaisies").asInt());
    assertTrue(origines.get(0).get("dernierEnvoi").isNull());

    // --- Résolution du code : neutre si inconnu, nom + ville sinon -------------------------------------------
    envoyer(h, get("/api/transferts/destinataire").param("code", "AAAA-BBBB")).andExpect(status().isNotFound());
    envoyer(h, get("/api/transferts/destinataire").param("code", codeYAvant)).andExpect(status().isNotFound());
    JsonNode destinataire = json.readTree(corps(envoyer(h, get("/api/transferts/destinataire").param("code", codeY.toLowerCase().replace("-", " ")))
        .andExpect(status().isOk())));
    assertEquals("College Y", destinataire.get("nom").asText());
    assertEquals("Lome", destinataire.get("ville").asText());
    assertEquals(2, destinataire.size(), "nom et ville seulement");

    // --- Envoi : code invalide → erreur neutre ; code valide → paquet de 2 élèves ----------------------------
    envoyer(h, post("/api/transferts/envoyer"),
        "{\"sessionId\":" + sessionH + ",\"etablissementOrigine\":\"Collège Y\",\"code\":\"ZZZZ-ZZZZ\"}")
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.message").value(CodeTransfertService.MESSAGE_CODE_INCONNU));
    JsonNode envoi1 = json.readTree(corps(envoyer(h, post("/api/transferts/envoyer"),
        "{\"sessionId\":" + sessionH + ",\"etablissementOrigine\":\"Collège Y\",\"code\":\"" + codeY + "\"}")
        .andExpect(status().isOk())));
    long transfert1 = envoi1.get("id").asLong();
    assertEquals("EN_ATTENTE", envoi1.get("statut").asText());
    assertEquals(2, envoi1.get("effectif").asInt());
    assertEquals("College Y", envoi1.get("destinationNom").asText());
    assertTrue(envoi1.get("codeUtilise") == null, "le code n'est jamais renvoyé");
    // Second envoi pour la même origine tant que le premier est en attente : refusé.
    envoyer(h, post("/api/transferts/envoyer"),
        "{\"sessionId\":" + sessionH + ",\"etablissementOrigine\":\"Collège Y\",\"code\":\"" + codeY + "\"}")
        .andExpect(status().isConflict());

    // Détail lisible par H et Y, pas par Z ; paquet = 2 élèves seulement, avec le rang commun.
    JsonNode detail = json.readTree(corps(envoyer(y, get("/api/transferts/" + transfert1)).andExpect(status().isOk())));
    assertEquals(2, detail.get("paquet").get("eleves").size());
    assertEquals("CS Harmonia", detail.get("paquet").get("centreNom").asText());
    Set<String> noms = new HashSet<>();
    for (JsonNode e : detail.get("paquet").get("eleves")) {
      noms.add(e.get("nomComplet").asText());
      assertEquals(3, e.get("stat").get("effectifGroupe").asInt(), "effectif du groupe complet (Y + Z)");
      if (e.get("nomComplet").asText().equals("AKAKPO Ama")) assertEquals(2, e.get("stat").get("rang").asInt());
    }
    assertEquals(Set.of("AKAKPO Ama", "MENSAH Kossi"), noms);
    envoyer(h, get("/api/transferts/" + transfert1)).andExpect(status().isOk());
    envoyer(z, get("/api/transferts/" + transfert1)).andExpect(status().isNotFound());
    assertEquals(0, json.readTree(lire(z, "/api/transferts/recus")).size());
    assertEquals(1, json.readTree(lire(y, "/api/transferts/recus")).size());
    assertEquals(1, json.readTree(lire(y, "/api/transferts/recus/en-attente")).get("enAttente").asInt());

    // --- Refus : code inchangé, le centre voit le motif, renvoi possible --------------------------------------
    envoyer(y, post("/api/transferts/" + transfert1 + "/refuser"), "{\"motif\":\"Liste incomplète\"}")
        .andExpect(status().isOk()).andExpect(jsonPath("$.statut").value("REFUSE"));
    assertEquals(codeY, json.readTree(lire(y, "/api/etablissement")).get("codeTransfert").asText());
    JsonNode envois = json.readTree(lire(h, "/api/transferts/envois"));
    assertEquals("REFUSE", envois.get(0).get("statut").asText());
    assertEquals("Liste incomplète", envois.get(0).get("motifRefus").asText());
    // Z (étranger) ne peut pas accepter ; refus d'un paquet déjà traité : 409.
    envoyer(z, post("/api/transferts/" + transfert1 + "/accepter")).andExpect(status().isNotFound());
    envoyer(y, post("/api/transferts/" + transfert1 + "/accepter")).andExpect(status().isConflict());

    long transfert2 = id(envoyer(h, post("/api/transferts/envoyer"),
        "{\"sessionId\":" + sessionH + ",\"etablissementOrigine\":\"Collège Y\",\"code\":\"" + codeY + "\"}"));
    JsonNode originesApres = json.readTree(lire(h, "/api/transferts/origines?sessionId=" + sessionH));
    assertEquals("EN_ATTENTE", originesApres.get(0).get("dernierEnvoi").get("statut").asText());

    // --- Acceptation chez Y ---------------------------------------------------------------------------------
    int sessionsYAvant = json.readTree(lire(y, "/api/sessions")).size();
    JsonNode accepte = json.readTree(corps(envoyer(y, post("/api/transferts/" + transfert2 + "/accepter")).andExpect(status().isOk())));
    assertEquals("ACCEPTE", accepte.get("statut").asText());
    long sessionY = accepte.get("sessionCreeeId").asLong();
    // Second « accepter » → 409 ; le code de Y a changé.
    envoyer(y, post("/api/transferts/" + transfert2 + "/accepter")).andExpect(status().isConflict());
    String codeYApres = json.readTree(lire(y, "/api/etablissement")).get("codeTransfert").asText();
    assertNotEquals(codeY, codeYApres, "le code utilisé est invalidé à l'acceptation");
    envoyer(h, get("/api/transferts/destinataire").param("code", codeY)).andExpect(status().isNotFound());

    JsonNode sessionsY = json.readTree(lire(y, "/api/sessions"));
    assertEquals(sessionsYAvant + 1, sessionsY.size());
    JsonNode sessionCreee = null;
    for (JsonNode s : sessionsY) if (s.get("id").asLong() == sessionY) sessionCreee = s;
    assertNotNull(sessionCreee);
    assertEquals("BEPC Blanc 2026 — Centre CS Harmonia", sessionCreee.get("nom").asText());
    assertEquals("INTERNE", sessionCreee.get("mode").asText());
    assertEquals(transfert2, sessionCreee.get("transfertSourceId").asLong());
    assertEquals("CS Harmonia", sessionCreee.get("transfertCentre").asText());
    assertEquals("BEPC", sessionCreee.get("typeExamenCode").asText());

    JsonNode elevesY = json.readTree(lire(y, "/api/eleves"));
    assertEquals(2, elevesY.size());
    long amaY = -1;
    long classeY = -1;
    for (JsonNode e : elevesY) {
      assertEquals(sessionY, e.get("sessionId").asLong());
      assertTrue(e.get("etablissementOrigine").isNull(), "élève de Y désormais : aucune origine");
      assertTrue(e.get("matricule").asText().contains("COLL"), "matricule de Y : " + e.get("matricule").asText());
      classeY = e.get("classeId").asLong();
      if (e.get("nomComplet").asText().equals("AKAKPO Ama")) amaY = e.get("id").asLong();
    }
    assertTrue(amaY > 0);
    JsonNode classesY = json.readTree(lire(y, "/api/classes"));
    assertEquals(1, classesY.size());
    assertEquals("3e", classesY.get(0).get("niveau").asText());
    JsonNode matieresY = json.readTree(lire(y, "/api/matieres"));
    assertEquals(2, matieresY.size());
    JsonNode programmeY = json.readTree(lire(y, "/api/classes/" + classeY + "/programme"));
    assertEquals(2, programmeY.size());
    JsonNode notesY = json.readTree(lire(y, "/api/notes?sessionId=" + sessionY));
    assertEquals(4, notesY.size());

    // Bulletins de Y : moyenne recalculée identique, rang et extrêmes de l'examen commun (3 candidats, pas 2).
    JsonNode bulletinsY = bulletins(y, sessionY);
    assertEquals(2, bulletinsY.size());
    JsonNode bAma = parEleve(bulletinsY, amaY);
    assertEquals(0, new BigDecimal("11.14").compareTo(bAma.get("moyenne").decimalValue()));
    assertEquals(2, bAma.get("rang").asInt(), "rang à l'examen commun");
    assertEquals(3, bAma.get("examenCommun").get("effectifGroupe").asInt());
    assertEquals("CS Harmonia", bAma.get("examenCommun").get("centre").asText());
    assertEquals(0, new BigDecimal("8.43").compareTo(bAma.get("moyenneClasseMin").decimalValue()), "minimum du groupe commun (Afi, chez Z)");
    assertEquals(0, new BigDecimal("15.57").compareTo(bAma.get("moyenneClasseMax").decimalValue()));
    long mathsY = -1;
    for (JsonNode m : matieresY) if (m.get("nom").asText().equals("Mathématiques")) mathsY = m.get("id").asLong();
    JsonNode ligneMaths = parMatiere(bAma, mathsY);
    assertEquals(2, ligneMaths.get("rang").asInt());
    assertEquals(0, new BigDecimal("8").compareTo(ligneMaths.get("noteMinClasse").decimalValue()), "min de la matière dans le groupe commun");
    assertEquals(0, new BigDecimal("4").compareTo(ligneMaths.get("coefficient").decimalValue()), "coefficient du paquet");
    assertEquals("PASSABLE", bAma.get("mention").asText());
    assertEquals("ADMIS", bAma.get("decision").asText());
    // Examen commun lisible par l'API dédiée, et bulletin interne : logo / titre du chef de Y, aucun centre inter.
    JsonNode commun = json.readTree(lire(y, "/api/transferts/examen-commun?sessionId=" + sessionY));
    assertEquals("CS Harmonia", commun.get("centre").asText());
    assertEquals(2, commun.get("eleves").size());
    assertEquals("INTERNE", bAma.get("modeSession").asText());
    assertEquals("College Y", bAma.get("etablissementNom").asText());

    // Session verrouillée en saisie : aucune note ne se modifie chez Y.
    envoyer(y, post("/api/notes"),
        "{\"eleveId\":" + amaY + ",\"matiereId\":" + mathsY + ",\"sessionId\":" + sessionY + ",\"valeur\":19,\"absent\":false}")
        .andExpect(status().isConflict());

    // --- Isolation : H ne lit pas les données de Y hors du transfert ; Z ne voit rien ----------------------------
    envoyer(h, get("/api/sessions/" + sessionY)).andExpect(status().isNotFound());
    envoyer(h, get("/api/notes").param("sessionId", String.valueOf(sessionY))).andExpect(status().isNotFound());
    envoyer(h, get("/api/transferts/examen-commun").param("sessionId", String.valueOf(sessionY))).andExpect(status().isNotFound());
    assertEquals(3, json.readTree(lire(h, "/api/eleves")).size(), "H garde ses 3 candidats");
    assertEquals(0, json.readTree(lire(z, "/api/transferts/envois")).size());
    assertEquals(0, json.readTree(lire(z, "/api/eleves")).size());
    // Historique du centre : deux envois (refusé puis accepté), conservés après archivage de la session.
    envoyer(h, post("/api/archives/" + sessionH)).andExpect(status().isOk());
    JsonNode historique = json.readTree(lire(h, "/api/transferts/envois"));
    assertEquals(2, historique.size());
    assertEquals("ACCEPTE", historique.get(0).get("statut").asText());
    assertFalse(historique.get(0).has("codeUtilise"));
  }

  @Test
  void annulationEtGardeFous() throws Exception {
    String h = inscrire("centre-h2@ecole.tg", "Lycee Centre");
    String y = inscrire("ecole-y2@ecole.tg", "Lycee Y");
    String codeY = json.readTree(lire(y, "/api/etablissement")).get("codeTransfert").asText();
    long anneeH = json.readTree(lire(h, "/api/annees-scolaires")).get(0).get("id").asLong();
    long centreH = id(envoyer(h, post("/api/centres"), "{\"nom\":\"Centre\",\"code\":\"CT\",\"ville\":\"Kara\"}"));
    long bac = typeId(h, "BAC2");
    long classe = id(envoyer(h, post("/api/classes"), "{\"anneeScolaireId\":" + anneeH + ",\"nom\":\"3e\",\"niveau\":\"3e\"}"));
    // Session interne : aucun transfert possible.
    long interne = id(envoyer(h, post("/api/sessions"),
        "{\"anneeScolaireId\":" + anneeH + ",\"centreId\":" + centreH + ",\"nom\":\"Interne\",\"typeExamenId\":" + bac + ",\"statut\":\"OUVERTE\"}"));
    envoyer(h, get("/api/transferts/origines").param("sessionId", String.valueOf(interne))).andExpect(status().isBadRequest());
    long inter = id(envoyer(h, post("/api/sessions"),
        "{\"anneeScolaireId\":" + anneeH + ",\"centreId\":" + centreH + ",\"nom\":\"Inter\",\"typeExamenId\":" + bac
            + ",\"statut\":\"OUVERTE\",\"mode\":\"INTER_ETABLISSEMENTS\"}"));
    envoyer(h, post("/api/eleves"),
        "{\"classeId\":" + classe + ",\"sessionId\":" + inter + ",\"nomComplet\":\"ABALO Koffi\",\"genre\":\"M\",\"etablissementOrigine\":\"Lycée Y\"}")
        .andExpect(status().isOk());
    // Son propre code : refusé explicitement.
    String codeH = json.readTree(lire(h, "/api/etablissement")).get("codeTransfert").asText();
    envoyer(h, get("/api/transferts/destinataire").param("code", codeH)).andExpect(status().isBadRequest());
    envoyer(h, post("/api/transferts/envoyer"),
        "{\"sessionId\":" + inter + ",\"etablissementOrigine\":\"Lycée Y\",\"code\":\"" + codeH + "\"}").andExpect(status().isNotFound());
    // Origine inconnue : 404.
    envoyer(h, post("/api/transferts/envoyer"),
        "{\"sessionId\":" + inter + ",\"etablissementOrigine\":\"Lycée Inconnu\",\"code\":\"" + codeY + "\"}").andExpect(status().isNotFound());
    long transfert = id(envoyer(h, post("/api/transferts/envoyer"),
        "{\"sessionId\":" + inter + ",\"etablissementOrigine\":\"lycee y\",\"code\":\"" + codeY + "\"}"));
    // Y ne peut pas annuler ; H annule ; Y ne peut plus accepter ; H peut renvoyer.
    envoyer(y, post("/api/transferts/" + transfert + "/annuler")).andExpect(status().isNotFound());
    envoyer(h, post("/api/transferts/" + transfert + "/annuler")).andExpect(status().isOk()).andExpect(jsonPath("$.statut").value("ANNULE"));
    envoyer(h, post("/api/transferts/" + transfert + "/annuler")).andExpect(status().isConflict());
    envoyer(y, post("/api/transferts/" + transfert + "/accepter")).andExpect(status().isConflict());
    envoyer(h, post("/api/transferts/envoyer"),
        "{\"sessionId\":" + inter + ",\"etablissementOrigine\":\"Lycée Y\",\"code\":\"" + codeY + "\"}").andExpect(status().isOk());
    // Un secrétaire de H (préréglage) n'a aucun droit sur les transferts ; un ADMIN de H les a d'office.
    envoyer(h, post("/api/utilisateurs"),
        "{\"nom\":\"Sec H\",\"email\":\"sec-h2@ecole.tg\",\"motDePasse\":\"temp123\",\"role\":\"SECRETAIRE\"}").andExpect(status().isCreated());
    envoyer(connecter("sec-h2@ecole.tg", "temp123"), get("/api/transferts/envois")).andExpect(status().isForbidden());
    envoyer(h, post("/api/utilisateurs"),
        "{\"nom\":\"Adm H\",\"email\":\"adm-h2@ecole.tg\",\"motDePasse\":\"temp123\",\"role\":\"ADMIN\"}").andExpect(status().isCreated());
    String admH = connecter("adm-h2@ecole.tg", "temp123");
    assertEquals(2, json.readTree(lire(admH, "/api/transferts/envois")).size());
    assertFalse(json.readTree(lire(admH, "/api/etablissement")).get("codeTransfert").isNull(), "l'ADMIN voit le code");
  }

  /* ------------------------------------------------------------------ */

  private void noter(String token, long sessionId, long eleveId, long matiereId, int valeur) throws Exception {
    envoyer(token, post("/api/notes"),
        "{\"eleveId\":" + eleveId + ",\"matiereId\":" + matiereId + ",\"sessionId\":" + sessionId + ",\"valeur\":" + valeur + ",\"absent\":false}")
        .andExpect(status().isOk());
  }

  private static JsonNode parEleve(JsonNode bulletins, long eleveId) {
    for (JsonNode b : bulletins) if (b.get("eleveId").asLong() == eleveId) return b;
    throw new AssertionError("Bulletin introuvable pour l'élève " + eleveId);
  }

  private static JsonNode parMatiere(JsonNode bulletin, long matiereId) {
    for (JsonNode ligne : bulletin.get("lignes")) if (ligne.get("matiereId").asLong() == matiereId) return ligne;
    throw new AssertionError("Ligne introuvable pour la matière " + matiereId);
  }

  private long typeId(String token, String code) throws Exception {
    for (JsonNode type : json.readTree(lire(token, "/api/types-examen"))) {
      if (code.equals(type.get("code").asText())) return type.get("id").asLong();
    }
    throw new AssertionError("Type d'examen " + code + " absent du référentiel");
  }

  private JsonNode bulletins(String token, long sessionId) throws Exception {
    return json.readTree(corps(envoyer(token, get("/api/bulletins").param("sessionId", String.valueOf(sessionId))).andExpect(status().isOk())));
  }

  private String inscrire(String email, String nom) throws Exception {
    String raw = mvc.perform(post("/api/auth/signup")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"nom\":\"" + nom + "\",\"ville\":\"Lome\",\"email\":\"" + email
                + "\",\"motDePasse\":\"secret1\",\"nomResponsable\":\"Chef Test\"}"))
        .andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString();
    return json.readTree(raw).get("token").asText();
  }

  private String connecter(String email, String motDePasse) throws Exception {
    String raw = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"" + email + "\",\"motDePasse\":\"" + motDePasse + "\"}"))
        .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    return json.readTree(raw).get("token").asText();
  }

  private String lire(String token, String path) throws Exception {
    return corps(envoyer(token, get(path)).andExpect(status().isOk()));
  }

  private static String corps(ResultActions result) throws Exception {
    return result.andReturn().getResponse().getContentAsString();
  }

  private ResultActions envoyer(String token, MockHttpServletRequestBuilder request) throws Exception {
    return mvc.perform(request.header("Authorization", "Bearer " + token));
  }

  private ResultActions envoyer(String token, MockHttpServletRequestBuilder request, String body) throws Exception {
    return mvc.perform(request.header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content(body));
  }

  private long id(ResultActions result) throws Exception {
    return json.readTree(corps(result.andExpect(status().isOk()))).get("id").asLong();
  }
}
