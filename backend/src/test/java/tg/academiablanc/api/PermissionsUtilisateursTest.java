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

@SpringBootTest
@AutoConfigureMockMvc
class PermissionsUtilisateursTest {
  @Autowired
  private MockMvc mvc;
  @Autowired
  private ObjectMapper json;

  @Test
  void ownerRestreintUneSecretaireActionParAction() throws Exception {
    JsonNode inscription = inscrire("perm-owner@ecole.tg", "Lycee Permissions");
    String owner = inscription.get("token").asText();
    assertEquals("OWNER", inscription.get("role").asText());
    List<String> droitsOwner = liste(inscription.get("permissions"));
    assertTrue(droitsOwner.contains("MATIERES:SUPPRIMER"));
    assertTrue(droitsOwner.contains("UTILISATEURS:CREER"));
    assertFalse(droitsOwner.contains("ETABLISSEMENTS:VOIR"), "un OWNER n'a pas de droit plateforme");

    long anneeId = json.readTree(corps(envoyer(owner, get("/api/annees-scolaires")))).get(0).get("id").asLong();
    long classeId = json.readTree(corps(envoyer(owner, post("/api/classes"),
        "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"Tle D\",\"niveau\":\"Terminale\"}").andExpect(status().isOk())))
        .get("id").asLong();
    long matiereId = json.readTree(corps(envoyer(owner, post("/api/matieres"), "{\"nom\":\"Physique\",\"code\":\"phy\"}")
        .andExpect(status().isOk()))).get("id").asLong();

    // Secrétaire limitée à ELEVES:CREER + MATIERES:VOIR (pas de DETAILS, pas de SUPPRIMER).
    JsonNode secretaire = json.readTree(corps(envoyer(owner, post("/api/utilisateurs"),
        "{\"nom\":\"Afi Secretaire\",\"email\":\"perm-secretaire@ecole.tg\",\"motDePasse\":\"temp123\",\"role\":\"SECRETAIRE\","
            + "\"permissions\":[\"ELEVES:CREER\",\"MATIERES:VOIR\"]}")
        .andExpect(status().isCreated())));
    long secretaireId = secretaire.get("id").asLong();
    assertEquals(List.of("ELEVES:CREER", "MATIERES:VOIR"), liste(secretaire.get("permissions")));

    JsonNode connexion = connecter("perm-secretaire@ecole.tg", "temp123");
    assertEquals("SECRETAIRE", connexion.get("role").asText());
    assertEquals(List.of("ELEVES:CREER", "MATIERES:VOIR"), liste(connexion.get("permissions")));
    String sec = connexion.get("token").asText();

    // Peut créer un élève…
    JsonNode eleve = json.readTree(corps(envoyer(sec, post("/api/eleves"),
        "{\"classeId\":" + classeId + ",\"nomComplet\":\"KOFFI Ama\",\"matricule\":\"P-01\",\"genre\":\"F\"}")
        .andExpect(status().is2xxSuccessful())));
    long eleveId = eleve.get("id").asLong();
    // … mais ni le lister, ni le supprimer.
    envoyer(sec, get("/api/eleves")).andExpect(status().isForbidden())
        .andExpect(jsonPath("$.message").value("Action non autorisée : VOIR sur ELEVES"));
    envoyer(sec, delete("/api/eleves/" + eleveId)).andExpect(status().isForbidden())
        .andExpect(jsonPath("$.message").value("Action non autorisée : SUPPRIMER sur ELEVES"));
    // Matières : liste oui, détail non, suppression non.
    envoyer(sec, get("/api/matieres")).andExpect(status().isOk());
    envoyer(sec, get("/api/matieres/" + matiereId)).andExpect(status().isForbidden())
        .andExpect(jsonPath("$.message").value("Action non autorisée : DETAILS sur MATIERES"));
    envoyer(sec, delete("/api/matieres/" + matiereId)).andExpect(status().isForbidden())
        .andExpect(jsonPath("$.message").value("Action non autorisée : SUPPRIMER sur MATIERES"));
    // Pas de gestion des utilisateurs.
    envoyer(sec, get("/api/utilisateurs")).andExpect(status().isForbidden());
    envoyer(sec, put("/api/utilisateurs/" + secretaireId + "/permissions"), "{\"permissions\":[\"MATIERES:SUPPRIMER\"]}")
        .andExpect(status().isForbidden());

    // /me reflète les droits relus en base.
    JsonNode me = json.readTree(corps(envoyer(sec, get("/api/auth/me")).andExpect(status().isOk())));
    assertEquals("perm-secretaire@ecole.tg", me.get("email").asText());
    assertEquals(List.of("ELEVES:CREER", "MATIERES:VOIR"), liste(me.get("permissions")));

    // L'OWNER élargit les droits : effet immédiat sans nouveau jeton.
    envoyer(owner, put("/api/utilisateurs/" + secretaireId + "/permissions"),
        "{\"permissions\":[\"ELEVES:VOIR\",\"ELEVES:CREER\",\"ELEVES:SUPPRIMER\",\"MATIERES:VOIR\",\"MATIERES:DETAILS\"]}")
        .andExpect(status().isOk());
    envoyer(sec, get("/api/eleves")).andExpect(status().isOk());
    envoyer(sec, get("/api/matieres/" + matiereId)).andExpect(status().isOk());
    envoyer(sec, delete("/api/eleves/" + eleveId)).andExpect(status().isNoContent());

    // Un admin délégué ne peut pas accorder ce qu'il ne détient pas, ni éditer ses propres droits.
    JsonNode admin = json.readTree(corps(envoyer(owner, post("/api/utilisateurs"),
        "{\"nom\":\"Kodjo Admin\",\"email\":\"perm-admin@ecole.tg\",\"motDePasse\":\"temp123\",\"role\":\"ADMIN\","
            + "\"permissions\":[\"UTILISATEURS:VOIR\",\"UTILISATEURS:DETAILS\",\"UTILISATEURS:MODIFIER\",\"MATIERES:VOIR\"]}")
        .andExpect(status().isCreated())));
    long adminId = admin.get("id").asLong();
    String adm = connecter("perm-admin@ecole.tg", "temp123").get("token").asText();
    envoyer(adm, put("/api/utilisateurs/" + secretaireId + "/permissions"), "{\"permissions\":[\"MATIERES:SUPPRIMER\"]}")
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.message").value("Vous ne pouvez pas accorder un droit que vous ne détenez pas : MATIERES:SUPPRIMER"));
    envoyer(adm, put("/api/utilisateurs/" + secretaireId + "/permissions"), "{\"permissions\":[\"MATIERES:VOIR\"]}")
        .andExpect(status().isOk());
    envoyer(adm, put("/api/utilisateurs/" + adminId + "/permissions"), "{\"permissions\":[\"MATIERES:VOIR\",\"MATIERES:SUPPRIMER\"]}")
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.message").value("Vous ne pouvez pas modifier vos propres droits."));

    // L'OWNER ne peut pas être restreint, ni supprimé.
    long ownerId = inscription.get("utilisateurId").asLong();
    envoyer(adm, put("/api/utilisateurs/" + ownerId + "/permissions"), "{\"permissions\":[]}").andExpect(status().isForbidden());
    envoyer(owner, delete("/api/utilisateurs/" + ownerId)).andExpect(status().isForbidden());

    // Un autre établissement ne voit pas ces utilisateurs.
    String autre = inscrire("perm-autre@ecole.tg", "Autre Lycee").get("token").asText();
    JsonNode listeAutre = json.readTree(corps(envoyer(autre, get("/api/utilisateurs")).andExpect(status().isOk())));
    assertEquals(1, listeAutre.size());
    envoyer(autre, get("/api/utilisateurs/" + secretaireId)).andExpect(status().isNotFound());
    envoyer(autre, put("/api/utilisateurs/" + secretaireId + "/permissions"), "{\"permissions\":[]}").andExpect(status().isNotFound());

    // Désactivation : la connexion et les requêtes sont refusées.
    envoyer(owner, put("/api/utilisateurs/" + secretaireId), "{\"actif\":false}").andExpect(status().isOk())
        .andExpect(jsonPath("$.actif").value(false));
    mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"perm-secretaire@ecole.tg\",\"motDePasse\":\"temp123\"}"))
        .andExpect(status().isForbidden());
    envoyer(sec, get("/api/matieres")).andExpect(status().isForbidden());

    // Réinitialisation du mot de passe par l'OWNER puis suppression.
    envoyer(owner, put("/api/utilisateurs/" + secretaireId), "{\"actif\":true}").andExpect(status().isOk());
    envoyer(owner, post("/api/utilisateurs/" + secretaireId + "/reinitialiser-mot-de-passe"), "{\"motDePasse\":\"nouveau1\"}")
        .andExpect(status().isNoContent());
    connecter("perm-secretaire@ecole.tg", "nouveau1");
    envoyer(owner, delete("/api/utilisateurs/" + secretaireId)).andExpect(status().isNoContent());
    envoyer(owner, get("/api/utilisateurs/" + secretaireId)).andExpect(status().isNotFound());
  }

  @Test
  void prereglageSecretaireEtEnseignant() throws Exception {
    String owner = inscrire("perm-presets@ecole.tg", "Lycee Prereglages").get("token").asText();
    JsonNode referentiel = json.readTree(corps(envoyer(owner, get("/api/utilisateurs/referentiel")).andExpect(status().isOk())));
    List<String> secretaire = liste(referentiel.get("prereglages").get("SECRETAIRE"));
    assertTrue(secretaire.contains("ELEVES:CREER"));
    assertTrue(secretaire.contains("NOTES:MODIFIER"));
    assertTrue(secretaire.contains("BULLETINS:IMPRIMER"));
    assertFalse(secretaire.stream().anyMatch(code -> code.endsWith(":SUPPRIMER")), "le secrétariat ne supprime rien par défaut");
    assertFalse(secretaire.contains("UTILISATEURS:VOIR"));
    List<String> enseignant = liste(referentiel.get("prereglages").get("ENSEIGNANT"));
    assertTrue(enseignant.contains("NOTES:CREER"));
    assertTrue(enseignant.contains("BULLETINS:VOIR"));
    assertFalse(enseignant.contains("ELEVES:CREER"));

    // Création sans matrice explicite = préréglage du rôle.
    JsonNode cree = json.readTree(corps(envoyer(owner, post("/api/utilisateurs"),
        "{\"nom\":\"Sec Defaut\",\"email\":\"perm-sec-defaut@ecole.tg\",\"motDePasse\":\"temp123\",\"role\":\"SECRETAIRE\"}")
        .andExpect(status().isCreated())));
    assertEquals(secretaire, liste(cree.get("permissions")));
    String sec = connecter("perm-sec-defaut@ecole.tg", "temp123").get("token").asText();
    long matiereId = json.readTree(corps(envoyer(owner, post("/api/matieres"), "{\"nom\":\"SVT\",\"code\":\"svt\"}")
        .andExpect(status().isOk()))).get("id").asLong();
    envoyer(sec, get("/api/matieres/" + matiereId)).andExpect(status().isOk());
    envoyer(sec, delete("/api/matieres/" + matiereId)).andExpect(status().isForbidden());
    envoyer(sec, post("/api/matieres"), "{\"nom\":\"Chimie\",\"code\":\"chi\"}").andExpect(status().isForbidden());
  }

  private JsonNode inscrire(String email, String nom) throws Exception {
    return json.readTree(mvc.perform(post("/api/auth/signup")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"nom\":\"" + nom + "\",\"ville\":\"Lome\",\"email\":\"" + email
                + "\",\"motDePasse\":\"secret1\",\"nomResponsable\":\"Proviseur Test\"}"))
        .andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString());
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
