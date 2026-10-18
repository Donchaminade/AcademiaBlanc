package tg.academiablanc.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
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

@SpringBootTest(properties = "app.platform.super-admin-email=proprio-gest@logiciel.tg")
@AutoConfigureMockMvc
class GestionnairesPlateformeTest {
  @Autowired
  private MockMvc mvc;
  @Autowired
  private ObjectMapper json;

  @Test
  void proprietaireAjouteUnGestionnaireRestreint() throws Exception {
    inscrire("proprio-gest@logiciel.tg", "Compte Proprio Gest");
    JsonNode connexion = connecter("proprio-gest@logiciel.tg", "secret1");
    assertEquals("SUPER_ADMIN", connexion.get("role").asText());
    List<String> droits = liste(connexion.get("permissions"));
    assertTrue(droits.contains("ETABLISSEMENTS:SUPPRIMER"));
    assertTrue(droits.contains("GESTIONNAIRES:CREER"));
    assertTrue(droits.contains("MATIERES:SUPPRIMER"), "SUPER_ADMIN garde tout");
    String proprio = connexion.get("token").asText();

    // Le SUPER_ADMIN voit les contacts et les effectifs.
    JsonNode complet = json.readTree(corps(envoyer(proprio, get("/api/plateforme/etablissements")).andExpect(status().isOk())));
    assertTrue(complet.get(0).has("email"));
    assertTrue(complet.get(0).has("utilisateurs"));

    // Gestionnaire avec VOIR seulement (pas DETAILS, pas SUPPRIMER).
    JsonNode gestionnaire = json.readTree(corps(envoyer(proprio, post("/api/plateforme/gestionnaires"),
        "{\"nom\":\"Gestionnaire Lecture\",\"email\":\"gest-lecture@logiciel.tg\",\"motDePasse\":\"temp123\","
            + "\"permissions\":[\"ETABLISSEMENTS:VOIR\",\"GESTIONNAIRES:VOIR\"]}")
        .andExpect(status().isCreated())));
    long gestionnaireId = gestionnaire.get("id").asLong();
    assertTrue(gestionnaire.get("etablissementId").isNull(), "un gestionnaire n'a pas d'établissement");

    JsonNode connexionGest = connecter("gest-lecture@logiciel.tg", "temp123");
    assertEquals("GESTIONNAIRE_PLATEFORME", connexionGest.get("role").asText());
    assertTrue(connexionGest.get("etablissementId").isNull());
    assertEquals(List.of("ETABLISSEMENTS:VOIR", "GESTIONNAIRES:VOIR"), liste(connexionGest.get("permissions")));
    String gest = connexionGest.get("token").asText();

    JsonNode liste = json.readTree(corps(envoyer(gest, get("/api/plateforme/etablissements")).andExpect(status().isOk())));
    assertTrue(liste.size() >= 1);
    for (JsonNode item : liste) {
      assertFalse(item.has("email"), "pas de contact sans DETAILS");
      assertFalse(item.has("telephone"));
      assertFalse(item.has("nomResponsable"));
      assertFalse(item.has("eleves"), "pas d'effectifs sans DETAILS");
      assertTrue(item.has("nom"));
      assertTrue(item.has("actif"));
    }
    long cibleId = liste.get(0).get("id").asLong();
    envoyer(gest, get("/api/plateforme/etablissements/" + cibleId)).andExpect(status().isForbidden());
    envoyer(gest, delete("/api/plateforme/etablissements/" + cibleId)).andExpect(status().isForbidden())
        .andExpect(jsonPath("$.message").value("Action non autorisée : SUPPRIMER sur ETABLISSEMENTS"));
    envoyer(gest, post("/api/plateforme/etablissements"),
        "{\"nom\":\"Refuse\",\"ville\":\"Kara\",\"email\":\"refuse@ecole.tg\",\"motDePasse\":\"secret1\",\"nomResponsable\":\"X\"}")
        .andExpect(status().isForbidden());
    // Aucun droit sur les données d'un établissement.
    envoyer(gest, get("/api/annees-scolaires")).andExpect(status().isForbidden());
    envoyer(gest, get("/api/eleves")).andExpect(status().isForbidden());
    // Ni sur ses propres droits ou ceux des autres gestionnaires.
    envoyer(gest, put("/api/plateforme/gestionnaires/" + gestionnaireId + "/permissions"), "{\"permissions\":[\"ETABLISSEMENTS:SUPPRIMER\"]}")
        .andExpect(status().isForbidden());
    // Liste des gestionnaires sans DETAILS : emails masqués, pas de matrice.
    JsonNode gestionnaires = json.readTree(corps(envoyer(gest, get("/api/plateforme/gestionnaires")).andExpect(status().isOk())));
    assertTrue(gestionnaires.size() >= 2);
    for (JsonNode item : gestionnaires) {
      assertTrue(item.get("permissions").isNull());
      assertTrue(item.get("email").asText().contains("…"));
    }

    // Le propriétaire accorde CREER : le gestionnaire crée un établissement avec son OWNER.
    envoyer(proprio, put("/api/plateforme/gestionnaires/" + gestionnaireId + "/permissions"),
        "{\"permissions\":[\"ETABLISSEMENTS:VOIR\",\"ETABLISSEMENTS:DETAILS\",\"ETABLISSEMENTS:CREER\",\"GESTIONNAIRES:VOIR\"]}")
        .andExpect(status().isOk());
    JsonNode cree = json.readTree(corps(envoyer(gest, post("/api/plateforme/etablissements"),
        "{\"nom\":\"Lycee Ajoute\",\"ville\":\"Kara\",\"email\":\"ajoute@ecole.tg\",\"motDePasse\":\"secret1\",\"nomResponsable\":\"Proviseur Ajoute\"}")
        .andExpect(status().isCreated())));
    long ajouteId = cree.get("id").asLong();
    assertEquals(1, cree.get("utilisateurs").asLong());
    JsonNode ownerAjoute = connecter("ajoute@ecole.tg", "secret1");
    assertEquals("OWNER", ownerAjoute.get("role").asText());
    assertTrue(liste(ownerAjoute.get("permissions")).contains("MATIERES:SUPPRIMER"));

    // Toujours pas de suppression pour le gestionnaire ; le propriétaire désactive puis réactive.
    envoyer(gest, delete("/api/plateforme/etablissements/" + ajouteId)).andExpect(status().isForbidden());
    envoyer(proprio, delete("/api/plateforme/etablissements/" + ajouteId)).andExpect(status().isNoContent());
    mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"ajoute@ecole.tg\",\"motDePasse\":\"secret1\"}"))
        .andExpect(status().isForbidden());
    envoyer(ownerAjoute.get("token").asText(), get("/api/annees-scolaires")).andExpect(status().isForbidden());
    envoyer(proprio, put("/api/plateforme/etablissements/" + ajouteId + "/reactiver")).andExpect(status().isOk())
        .andExpect(jsonPath("$.actif").value(true));
    connecter("ajoute@ecole.tg", "secret1");

    // Le propriétaire ne peut pas désactiver son propre établissement ; le SUPER_ADMIN est intouchable.
    long proprioId = connexion.get("utilisateurId").asLong();
    long proprioEtab = connexion.get("etablissementId").asLong();
    envoyer(proprio, delete("/api/plateforme/etablissements/" + proprioEtab)).andExpect(status().isForbidden());
    envoyer(gest, put("/api/plateforme/gestionnaires/" + proprioId + "/permissions"), "{\"permissions\":[]}").andExpect(status().isForbidden());

    // Un gestionnaire ne peut pas atteindre un utilisateur d'établissement via /gestionnaires.
    long ownerAjouteId = ownerAjoute.get("utilisateurId").asLong();
    envoyer(proprio, get("/api/plateforme/gestionnaires/" + ownerAjouteId)).andExpect(status().isNotFound());

    // Suppression du gestionnaire par le propriétaire.
    envoyer(proprio, delete("/api/plateforme/gestionnaires/" + gestionnaireId)).andExpect(status().isNoContent());
    envoyer(gest, get("/api/plateforme/etablissements")).andExpect(status().isUnauthorized());
    assertNull(json.readTree(corps(envoyer(proprio, get("/api/plateforme/gestionnaires"))))
        .findValue("gest-lecture@logiciel.tg"));
  }

  private void inscrire(String email, String nom) throws Exception {
    mvc.perform(post("/api/auth/signup")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"nom\":\"" + nom + "\",\"ville\":\"Lome\",\"email\":\"" + email
                + "\",\"motDePasse\":\"secret1\",\"nomResponsable\":\"Proprietaire\"}"))
        .andExpect(status().isOk());
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
