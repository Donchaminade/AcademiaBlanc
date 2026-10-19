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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest(properties = "app.platform.super-admin-email=proprio-pays@logiciel.tg")
@AutoConfigureMockMvc
class PrereglagesNationauxTest {
  private static final String PLATEFORME = "/api/plateforme/prereglages-nationaux";

  @Autowired
  private MockMvc mvc;
  @Autowired
  private ObjectMapper json;

  @Test
  void laMigrationFournitLeTogoParDefautEtLaCoteDIvoire() throws Exception {
    JsonNode defaut = json.readTree(corps(mvc.perform(get("/api/public/prereglage-defaut")).andExpect(status().isOk())));
    assertEquals("TG", defaut.get("code").asText());
    assertEquals("RÉPUBLIQUE TOGOLAISE", defaut.get("republique").asText());
    assertEquals("MEPST", defaut.get("sigleMinistere").asText());
    assertTrue(defaut.get("parDefaut").asBoolean());

    String owner = inscrire("pays-lecture@ecole.tg", "Lycee Lecture");
    JsonNode actifs = json.readTree(corps(envoyer(owner, get("/api/prereglages-nationaux")).andExpect(status().isOk())));
    List<String> codes = new ArrayList<>();
    actifs.forEach(item -> codes.add(item.get("code").asText()));
    assertTrue(codes.indexOf("TG") < codes.indexOf("CI"), "tri par ordre : " + codes);
    assertFalse(actifs.get(0).has("etablissements"), "la vue établissement ne compte pas les usages");

    // Sans jeton : la liste des établissements est protégée, le préréglage par défaut ne l'est pas.
    mvc.perform(get("/api/prereglages-nationaux")).andExpect(status().isForbidden());
  }

  @Test
  void unNouvelEtablissementRecoitLEnTeteParDefautPuisAppliqueUnAutrePrereglage() throws Exception {
    String owner = inscrire("pays-applique@ecole.tg", "Lycee Applique");
    JsonNode profil = json.readTree(corps(envoyer(owner, get("/api/etablissement")).andExpect(status().isOk())));
    assertEquals("RÉPUBLIQUE TOGOLAISE", profil.get("enTete").get("republique").asText());
    assertEquals("MEPST", profil.get("enTete").get("sigleMinistere").asText());
    long togoId = profil.get("enTete").get("prereglageNationalId").asLong();

    long ciId = idDuCode(owner, "CI");
    JsonNode applique = json.readTree(corps(envoyer(owner, post("/api/etablissement/prereglage-national/" + ciId))
        .andExpect(status().isOk())));
    assertEquals(ciId, applique.get("enTete").get("prereglageNationalId").asLong());
    assertEquals("RÉPUBLIQUE DE CÔTE D'IVOIRE", applique.get("enTete").get("republique").asText());
    assertEquals("Union – Discipline – Travail", applique.get("enTete").get("deviseNationale").asText());
    assertEquals("MENA", applique.get("enTete").get("sigleMinistere").asText());

    // Les champs copiés restent modifiables, l'identifiant du préréglage est conservé.
    envoyer(owner, put("/api/etablissement/en-tete"),
        "{\"prereglageNationalId\":" + ciId + ",\"republique\":\"RÉPUBLIQUE DE CÔTE D'IVOIRE\",\"deviseNationale\":\"Union – Discipline – Travail\","
            + "\"ministere\":\"MINISTÈRE DE L'ÉDUCATION NATIONALE\",\"sigleMinistere\":\"MEN\"}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.enTete.ministere").value("MINISTÈRE DE L'ÉDUCATION NATIONALE"))
        .andExpect(jsonPath("$.enTete.sigleMinistere").value("MEN"))
        .andExpect(jsonPath("$.enTete.prereglageNationalId").value(ciId));

    // PUT /api/etablissement sans enTete laisse l'en-tête intact ; avec enTete, il le remplace.
    envoyer(owner, put("/api/etablissement"),
        "{\"nom\":\"Lycee Applique\",\"ville\":\"Lome\",\"email\":\"pays-applique@ecole.tg\",\"nomResponsable\":\"Proviseur\"}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.enTete.sigleMinistere").value("MEN"));
    envoyer(owner, put("/api/etablissement"),
        "{\"nom\":\"Lycee Applique\",\"ville\":\"Lome\",\"email\":\"pays-applique@ecole.tg\",\"nomResponsable\":\"Proviseur\","
            + "\"enTete\":{\"prereglageNationalId\":" + togoId + ",\"republique\":\"RÉPUBLIQUE TOGOLAISE\",\"deviseNationale\":\"Travail – Liberté – Patrie\","
            + "\"ministere\":\"MINISTÈRE DES ENSEIGNEMENTS PRIMAIRE, SECONDAIRE ET TECHNIQUE\",\"sigleMinistere\":\"MEPST\"}}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.enTete.prereglageNationalId").value(togoId))
        .andExpect(jsonPath("$.enTete.sigleMinistere").value("MEPST"));

    // Un préréglage inexistant ne s'applique pas.
    envoyer(owner, post("/api/etablissement/prereglage-national/999999")).andExpect(status().isNotFound());
  }

  @Test
  void leProprietaireGereLeReferentielEtLeOwnerNYAccedePas() throws Exception {
    JsonNode connexion = proprietaire();
    assertTrue(liste(connexion.get("permissions")).contains("PREREGLAGES:SUPPRIMER"));
    String proprio = connexion.get("token").asText();
    String owner = inscrire("pays-owner@ecole.tg", "Lycee Owner");

    // Le compte d'un établissement n'atteint pas la gestion plateforme.
    envoyer(owner, get(PLATEFORME)).andExpect(status().isForbidden());
    envoyer(owner, post(PLATEFORME), saisie("BJ", "Bénin", false)).andExpect(status().isForbidden());

    // Création, avec compteur d'établissements.
    JsonNode liste = json.readTree(corps(envoyer(proprio, get(PLATEFORME)).andExpect(status().isOk())));
    int avant = liste.size();
    assertTrue(liste.get(0).has("etablissements"));
    JsonNode benin = json.readTree(corps(envoyer(proprio, post(PLATEFORME), saisie("bj", "Bénin", false))
        .andExpect(status().isCreated())));
    long beninId = benin.get("id").asLong();
    assertEquals("BJ", benin.get("code").asText(), "code normalisé en majuscules");
    assertEquals(0, benin.get("etablissements").asLong());
    assertFalse(benin.get("parDefaut").asBoolean());
    assertEquals(avant + 1, json.readTree(corps(envoyer(proprio, get(PLATEFORME)))).size());

    // Doublon de code et champ obligatoire manquant.
    envoyer(proprio, post(PLATEFORME), saisie("BJ", "Bénin bis", false)).andExpect(status().isConflict());
    envoyer(proprio, post(PLATEFORME), "{\"code\":\"GH\",\"nomPays\":\"Ghana\"}").andExpect(status().isBadRequest());
    envoyer(proprio, post(PLATEFORME), saisie("GHA", "Ghana", false)).andExpect(status().isBadRequest());

    // Modification.
    envoyer(proprio, put(PLATEFORME + "/" + beninId), saisie("BJ", "République du Bénin", false))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.nomPays").value("République du Bénin"));

    // Un préréglage inactif disparaît de la liste des établissements, mais reste visible pour la plateforme.
    envoyer(proprio, put(PLATEFORME + "/" + beninId + "/actif"), "{\"actif\":false}")
        .andExpect(status().isOk()).andExpect(jsonPath("$.actif").value(false));
    JsonNode actifs = json.readTree(corps(envoyer(owner, get("/api/prereglages-nationaux"))));
    actifs.forEach(item -> assertFalse("BJ".equals(item.get("code").asText())));
    envoyer(owner, post("/api/etablissement/prereglage-national/" + beninId)).andExpect(status().isBadRequest());
    envoyer(proprio, put(PLATEFORME + "/" + beninId + "/defaut")).andExpect(status().isBadRequest());
    envoyer(proprio, put(PLATEFORME + "/" + beninId + "/actif"), "{\"actif\":true}")
        .andExpect(status().isOk()).andExpect(jsonPath("$.actif").value(true));

    // Un seul préréglage par défaut à la fois ; celui par défaut ne se supprime ni ne se désactive.
    envoyer(proprio, put(PLATEFORME + "/" + beninId + "/defaut")).andExpect(status().isOk())
        .andExpect(jsonPath("$.parDefaut").value(true));
    JsonNode apres = json.readTree(corps(envoyer(proprio, get(PLATEFORME))));
    int defauts = 0;
    for (JsonNode item : apres) if (item.get("parDefaut").asBoolean()) defauts++;
    assertEquals(1, defauts);
    assertEquals("BJ", json.readTree(corps(mvc.perform(get("/api/public/prereglage-defaut")))).get("code").asText());
    envoyer(proprio, delete(PLATEFORME + "/" + beninId)).andExpect(status().isConflict());
    envoyer(proprio, put(PLATEFORME + "/" + beninId + "/actif"), "{\"actif\":false}").andExpect(status().isConflict());

    long togoId = idDuCode(owner, "TG");
    envoyer(proprio, put(PLATEFORME + "/" + togoId + "/defaut")).andExpect(status().isOk());

    // Suppression refusée (409) tant qu'un établissement l'applique, possible ensuite.
    envoyer(owner, post("/api/etablissement/prereglage-national/" + beninId)).andExpect(status().isOk());
    assertEquals(1, json.readTree(corps(envoyer(proprio, get(PLATEFORME)))).findValues("code").stream()
        .filter(n -> "BJ".equals(n.asText())).count());
    envoyer(proprio, delete(PLATEFORME + "/" + beninId)).andExpect(status().isConflict())
        .andExpect(jsonPath("$.message").value(PrereglageNationalService.MESSAGE_UTILISE));
    envoyer(owner, post("/api/etablissement/prereglage-national/" + togoId)).andExpect(status().isOk());
    envoyer(proprio, delete(PLATEFORME + "/" + beninId)).andExpect(status().isNoContent());
    envoyer(proprio, delete(PLATEFORME + "/" + beninId)).andExpect(status().isNotFound());
  }

  @Test
  void leGestionnaireVoitParDefautMaisNeModifiePas() throws Exception {
    String proprio = proprietaire().get("token").asText();
    envoyer(proprio, post("/api/plateforme/gestionnaires"),
        "{\"nom\":\"Gestionnaire Pays\",\"email\":\"gest-pays@logiciel.tg\",\"motDePasse\":\"temp123\"}")
        .andExpect(status().isCreated());
    JsonNode connexion = connecter("gest-pays@logiciel.tg", "temp123");
    List<String> droits = liste(connexion.get("permissions"));
    assertTrue(droits.contains("PREREGLAGES:VOIR"));
    assertFalse(droits.contains("PREREGLAGES:CREER"));
    String gest = connexion.get("token").asText();

    envoyer(gest, get(PLATEFORME)).andExpect(status().isOk());
    envoyer(gest, post(PLATEFORME), saisie("SN", "Sénégal", false)).andExpect(status().isForbidden())
        .andExpect(jsonPath("$.message").value("Action non autorisée : CREER sur PREREGLAGES"));
    long togoId = json.readTree(corps(envoyer(gest, get(PLATEFORME)))).get(0).get("id").asLong();
    envoyer(gest, put(PLATEFORME + "/" + togoId + "/actif"), "{\"actif\":false}").andExpect(status().isForbidden());
    envoyer(gest, delete(PLATEFORME + "/" + togoId)).andExpect(status().isForbidden());
  }

  /** Le propriétaire est inscrit une seule fois pour toute la classe (contexte et base H2 partagés). */
  private JsonNode proprietaire() throws Exception {
    mvc.perform(post("/api/auth/signup")
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"nom\":\"Compte Proprio Pays\",\"ville\":\"Lome\",\"email\":\"proprio-pays@logiciel.tg\","
            + "\"motDePasse\":\"secret1\",\"nomResponsable\":\"Proprietaire\"}"));
    return connecter("proprio-pays@logiciel.tg", "secret1");
  }

  private long idDuCode(String token, String code) throws Exception {
    for (JsonNode item : json.readTree(corps(envoyer(token, get("/api/prereglages-nationaux"))))) {
      if (code.equals(item.get("code").asText())) return item.get("id").asLong();
    }
    throw new AssertionError("Préréglage absent : " + code);
  }

  private static String saisie(String code, String pays, boolean parDefaut) {
    return "{\"code\":\"" + code + "\",\"nomPays\":\"" + pays + "\",\"republique\":\"RÉPUBLIQUE DU " + pays.toUpperCase()
        + "\",\"devise\":\"Fraternité – Justice – Travail\",\"ministere\":\"MINISTÈRE DES ENSEIGNEMENTS SECONDAIRE, TECHNIQUE ET DE LA FORMATION PROFESSIONNELLE\","
        + "\"sigleMinistere\":\"MESTFP\",\"ordre\":5,\"parDefaut\":" + parDefaut + "}";
  }

  private String inscrire(String email, String nom) throws Exception {
    return json.readTree(corps(mvc.perform(post("/api/auth/signup")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"nom\":\"" + nom + "\",\"ville\":\"Lome\",\"email\":\"" + email
                + "\",\"motDePasse\":\"secret1\",\"nomResponsable\":\"Proviseur\"}"))
        .andExpect(status().isOk()))).get("token").asText();
  }

  private JsonNode connecter(String email, String motDePasse) throws Exception {
    return json.readTree(corps(mvc.perform(post("/api/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"" + email + "\",\"motDePasse\":\"" + motDePasse + "\"}"))
        .andExpect(status().isOk())));
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
