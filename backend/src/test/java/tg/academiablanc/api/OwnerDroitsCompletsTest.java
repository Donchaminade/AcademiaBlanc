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
import tg.academiablanc.domain.PermissionUtilisateur;
import tg.academiablanc.domain.Ressource;
import tg.academiablanc.repo.PermissionUtilisateurRepository;
import tg.academiablanc.security.PermissionService;
import tg.academiablanc.security.PermissionService.Droit;

/**
 * Exigence du propriétaire du logiciel : le créateur du compte d’un établissement (OWNER) détient
 * tous les droits CRUD sur tout son établissement, sans dépendre d’aucune ligne de permission,
 * et personne ne peut les lui retirer.
 */
@SpringBootTest
@AutoConfigureMockMvc
class OwnerDroitsCompletsTest {
  @Autowired
  private MockMvc mvc;
  @Autowired
  private ObjectMapper json;
  @Autowired
  private PermissionUtilisateurRepository permissions;

  @Test
  void ownerSansAucuneLigneDePermissionFaitUnCrudComplet() throws Exception {
    JsonNode inscription = inscrire("owner-complet@ecole.tg", "Lycee Owner Complet");
    long ownerId = inscription.get("utilisateurId").asLong();
    String owner = inscription.get("token").asText();
    assertEquals("OWNER", inscription.get("role").asText());

    // Droit implicite : aucune ligne en base, mais toutes les cases de l’établissement sont accordées.
    assertTrue(permissions.findByUtilisateurId(ownerId).isEmpty(), "l’OWNER ne dépend d’aucune ligne permission_utilisateur");
    List<String> attendus = PermissionService.tous(Ressource.etablissement()).stream().map(Droit::code).sorted().toList();
    assertEquals(attendus, liste(inscription.get("permissions")));
    assertFalse(attendus.isEmpty());
    assertFalse(attendus.stream().anyMatch(c -> c.startsWith("ETABLISSEMENTS:") || c.startsWith("GESTIONNAIRES:")));

    // CRUD sur chaque ressource de l’établissement.
    long anneeId = id(envoyer(owner, post("/api/annees-scolaires"),
        "{\"libelle\":\"2031-2032\",\"dateDebut\":\"2031-09-01\",\"dateFin\":\"2032-07-31\",\"courante\":false}"));
    envoyer(owner, get("/api/annees-scolaires/" + anneeId)).andExpect(status().isOk());
    envoyer(owner, put("/api/annees-scolaires/" + anneeId),
        "{\"libelle\":\"2031-2032 bis\",\"dateDebut\":\"2031-09-01\",\"dateFin\":\"2032-07-31\",\"courante\":false}")
        .andExpect(jsonPath("$.libelle").value("2031-2032 bis"));

    long centreId = id(envoyer(owner, post("/api/centres"), "{\"nom\":\"Centre Owner\",\"code\":\"OW1\",\"ville\":\"Lome\"}"));
    envoyer(owner, put("/api/centres/" + centreId), "{\"nom\":\"Centre Owner II\",\"code\":\"OW1\",\"ville\":\"Lome\"}")
        .andExpect(status().isOk());
    long sessionId = id(envoyer(owner, post("/api/sessions"),
        "{\"anneeScolaireId\":" + anneeId + ",\"centreId\":" + centreId
            + ",\"nom\":\"Session Owner\",\"typeExamen\":\"BAC II\",\"statut\":\"OUVERTE\"}"));
    envoyer(owner, get("/api/sessions/" + sessionId)).andExpect(status().isOk());
    // Bulletins consultés et générés sur la session encore vide : un bulletin persisté bloquerait ensuite la suppression de l’élève.
    envoyer(owner, get("/api/bulletins?sessionId=" + sessionId)).andExpect(status().isOk());
    envoyer(owner, post("/api/bulletins/generer?sessionId=" + sessionId)).andExpect(status().isOk());

    long matiereId = id(envoyer(owner, post("/api/matieres"), "{\"nom\":\"Histoire\",\"code\":\"his\"}"));
    envoyer(owner, put("/api/matieres/" + matiereId), "{\"nom\":\"Histoire-Géo\",\"code\":\"his\"}").andExpect(status().isOk());
    long coefId = id(envoyer(owner, post("/api/coefficients"), "{\"matiereId\":" + matiereId + ",\"valeur\":2}"));
    envoyer(owner, put("/api/coefficients/" + coefId), "{\"matiereId\":" + matiereId + ",\"valeur\":3}").andExpect(status().isOk());

    long profId = id(envoyer(owner, post("/api/professeurs"), "{\"nom\":\"Mme Lawson\",\"email\":\"lawson@ecole.tg\"}"));
    envoyer(owner, put("/api/professeurs/" + profId), "{\"nom\":\"Mme Lawson-Body\"}").andExpect(status().isOk());

    envoyer(owner, post("/api/series/defauts"), "{}").andExpect(status().isOk());
    envoyer(owner, get("/api/series")).andExpect(status().isOk());
    long serieId = id(envoyer(owner, post("/api/series"), "{\"code\":\"OW\",\"libelle\":\"Serie Owner\",\"famille\":\"TECHNIQUE\"}"));
    envoyer(owner, get("/api/series/" + serieId)).andExpect(status().isOk());

    long classeId = id(envoyer(owner, post("/api/classes"),
        "{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"Tle OW\",\"niveau\":\"Tle\",\"serie\":\"OW\",\"titulaireId\":" + profId + "}"));
    envoyer(owner, put("/api/classes/" + classeId + "/titulaire"), "{\"professeurId\":" + profId + "}").andExpect(status().isOk());
    long affectationId = id(envoyer(owner, post("/api/affectations"),
        "{\"professeurId\":" + profId + ",\"matiereId\":" + matiereId + ",\"classeId\":" + classeId + "}"));

    long eleveId = id(envoyer(owner, post("/api/eleves"),
        "{\"classeId\":" + classeId + ",\"sessionId\":" + sessionId + ",\"nomComplet\":\"MENSAH Kossi\",\"genre\":\"M\",\"numeroTable\":7}"));
    envoyer(owner, get("/api/eleves/" + eleveId)).andExpect(status().isOk());
    envoyer(owner, put("/api/eleves/" + eleveId),
        "{\"classeId\":" + classeId + ",\"sessionId\":" + sessionId + ",\"nomComplet\":\"MENSAH Kossi A.\",\"genre\":\"M\",\"numeroTable\":7}")
        .andExpect(status().isOk());
    long noteId = id(envoyer(owner, post("/api/notes"),
        "{\"eleveId\":" + eleveId + ",\"matiereId\":" + matiereId + ",\"sessionId\":" + sessionId + ",\"valeur\":14.5,\"absent\":false}"));
    envoyer(owner, put("/api/notes/" + noteId),
        "{\"eleveId\":" + eleveId + ",\"matiereId\":" + matiereId + ",\"sessionId\":" + sessionId + ",\"valeur\":15,\"absent\":false}")
        .andExpect(status().isOk());
    envoyer(owner, get("/api/notes?sessionId=" + sessionId)).andExpect(status().isOk());

    // Paramètres / charte et utilisateurs.
    envoyer(owner, get("/api/etablissement/charte")).andExpect(status().isOk());
    envoyer(owner, put("/api/etablissement/charte"),
        "{\"sceauUrl\":\"\",\"signatureProviseurUrl\":\"https://cdn.example.org/owner.png\",\"signatureTitulaireUrl\":\"\"}")
        .andExpect(status().isOk());
    envoyer(owner, get("/api/utilisateurs/referentiel")).andExpect(status().isOk());
    long secretaireId = json.readTree(corps(envoyer(owner, post("/api/utilisateurs"),
        "{\"nom\":\"Sec Owner\",\"email\":\"owner-sec@ecole.tg\",\"motDePasse\":\"temp123\",\"role\":\"SECRETAIRE\"}")
        .andExpect(status().isCreated()))).get("id").asLong();
    envoyer(owner, get("/api/utilisateurs/" + secretaireId)).andExpect(status().isOk())
        .andExpect(jsonPath("$.restreignable").value(true));

    // Des lignes parasites en base (toutes refusées) ne réduisent pas l’OWNER : le droit est implicite.
    List<PermissionUtilisateur> parasites = new ArrayList<>();
    for (Droit droit : PermissionService.tous(Ressource.etablissement())) {
      parasites.add(new PermissionUtilisateur(ownerId, droit.ressource(), droit.action(), false));
    }
    permissions.saveAll(parasites);
    JsonNode me = json.readTree(corps(envoyer(owner, get("/api/auth/me")).andExpect(status().isOk())));
    assertEquals(attendus, liste(me.get("permissions")));
    assertTrue(me.get("actif").asBoolean());

    // Suppressions, toujours sans dépendre des lignes.
    envoyer(owner, delete("/api/notes/" + noteId)).andExpect(status().isNoContent());
    envoyer(owner, delete("/api/eleves/" + eleveId)).andExpect(status().isNoContent());
    envoyer(owner, delete("/api/affectations/" + affectationId)).andExpect(status().isNoContent());
    envoyer(owner, delete("/api/classes/" + classeId)).andExpect(status().isNoContent());
    envoyer(owner, delete("/api/series/" + serieId)).andExpect(status().isNoContent());
    envoyer(owner, delete("/api/professeurs/" + profId)).andExpect(status().isNoContent());
    envoyer(owner, delete("/api/coefficients/" + coefId)).andExpect(status().isNoContent());
    envoyer(owner, delete("/api/matieres/" + matiereId)).andExpect(status().isNoContent());
    envoyer(owner, delete("/api/sessions/" + sessionId)).andExpect(status().isNoContent());
    envoyer(owner, delete("/api/centres/" + centreId)).andExpect(status().isNoContent());
    envoyer(owner, delete("/api/annees-scolaires/" + anneeId)).andExpect(status().isNoContent());
    envoyer(owner, delete("/api/utilisateurs/" + secretaireId)).andExpect(status().isNoContent());
  }

  @Test
  void personneNePeutReduireNiDesactiverLOwner() throws Exception {
    JsonNode inscription = inscrire("owner-intouchable@ecole.tg", "Lycee Owner Intouchable");
    long ownerId = inscription.get("utilisateurId").asLong();
    String owner = inscription.get("token").asText();
    List<String> tousLesDroits = liste(inscription.get("permissions"));

    // Vue de l’OWNER dans la liste : droits complets, non modifiables.
    JsonNode comptes = json.readTree(corps(envoyer(owner, get("/api/utilisateurs")).andExpect(status().isOk())));
    JsonNode vueOwner = null;
    for (JsonNode compte : comptes) if (compte.get("id").asLong() == ownerId) vueOwner = compte;
    assertTrue(vueOwner != null);
    assertFalse(vueOwner.get("restreignable").asBoolean());
    assertEquals(tousLesDroits, liste(vueOwner.get("permissions")));

    // L’OWNER ne peut pas réduire ses propres droits, ni se désactiver, ni se supprimer.
    envoyer(owner, put("/api/utilisateurs/" + ownerId + "/permissions"), "{\"permissions\":[]}").andExpect(status().isForbidden());
    envoyer(owner, post("/api/utilisateurs/" + ownerId + "/permissions/prereglage")).andExpect(status().isForbidden());
    envoyer(owner, put("/api/utilisateurs/" + ownerId), "{\"actif\":false}").andExpect(status().isForbidden());
    envoyer(owner, delete("/api/utilisateurs/" + ownerId)).andExpect(status().isForbidden());

    // Un ADMIN créé par l’OWNER avec la totalité des droits délégables…
    String codes = json.writeValueAsString(tousLesDroits);
    JsonNode admin = json.readTree(corps(envoyer(owner, post("/api/utilisateurs"),
        "{\"nom\":\"Admin Total\",\"email\":\"owner-admin-total@ecole.tg\",\"motDePasse\":\"temp123\",\"role\":\"ADMIN\",\"permissions\":" + codes + "}")
        .andExpect(status().isCreated())));
    assertEquals(tousLesDroits, liste(admin.get("permissions")));
    assertTrue(admin.get("restreignable").asBoolean(), "un ADMIN reste restreignable, contrairement à l’OWNER");
    String adm = connecter("owner-admin-total@ecole.tg", "temp123").get("token").asText();

    // … ne peut ni restreindre, ni désactiver, ni modifier, ni supprimer l’OWNER.
    envoyer(adm, put("/api/utilisateurs/" + ownerId + "/permissions"), "{\"permissions\":[\"MATIERES:VOIR\"]}")
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.message").value("Les droits de ce compte sont complets et ne se modifient pas."));
    envoyer(adm, post("/api/utilisateurs/" + ownerId + "/permissions/prereglage")).andExpect(status().isForbidden());
    envoyer(adm, put("/api/utilisateurs/" + ownerId), "{\"actif\":false}").andExpect(status().isForbidden())
        .andExpect(jsonPath("$.message").value("Ce compte ne peut pas être modifié ni supprimé par un autre utilisateur."));
    envoyer(adm, put("/api/utilisateurs/" + ownerId), "{\"nom\":\"Usurpateur\",\"role\":\"SECRETAIRE\"}").andExpect(status().isForbidden());
    envoyer(adm, post("/api/utilisateurs/" + ownerId + "/reinitialiser-mot-de-passe"), "{\"motDePasse\":\"pirate1\"}")
        .andExpect(status().isForbidden());
    envoyer(adm, delete("/api/utilisateurs/" + ownerId)).andExpect(status().isForbidden());

    // Ni créer un second OWNER, ni promouvoir quelqu’un OWNER.
    envoyer(adm, post("/api/utilisateurs"),
        "{\"nom\":\"Faux Owner\",\"email\":\"owner-faux@ecole.tg\",\"motDePasse\":\"temp123\",\"role\":\"OWNER\"}")
        .andExpect(status().isBadRequest());
    long secretaireId = json.readTree(corps(envoyer(adm, post("/api/utilisateurs"),
        "{\"nom\":\"Sec\",\"email\":\"owner-sec2@ecole.tg\",\"motDePasse\":\"temp123\",\"role\":\"SECRETAIRE\"}")
        .andExpect(status().isCreated()))).get("id").asLong();
    envoyer(adm, put("/api/utilisateurs/" + secretaireId), "{\"role\":\"OWNER\"}").andExpect(status().isBadRequest());
    envoyer(adm, put("/api/utilisateurs/" + secretaireId), "{\"role\":\"SUPER_ADMIN\"}").andExpect(status().isBadRequest());

    // L’OWNER reste intact : actif, tous les droits, toujours aucune ligne de permission, et il garde la main sur l’ADMIN.
    JsonNode me = json.readTree(corps(envoyer(owner, get("/api/auth/me")).andExpect(status().isOk())));
    assertTrue(me.get("actif").asBoolean());
    assertEquals("OWNER", me.get("role").asText());
    assertEquals(tousLesDroits, liste(me.get("permissions")));
    assertTrue(permissions.findByUtilisateurId(ownerId).isEmpty());
    connecter("owner-intouchable@ecole.tg", "secret1");
    envoyer(owner, put("/api/utilisateurs/" + admin.get("id").asLong()), "{\"actif\":false}").andExpect(status().isOk())
        .andExpect(jsonPath("$.actif").value(false));
    envoyer(adm, get("/api/matieres")).andExpect(status().isForbidden());
  }

  private long id(ResultActions actions) throws Exception {
    return json.readTree(corps(actions.andExpect(status().is2xxSuccessful()))).get("id").asLong();
  }

  private JsonNode inscrire(String email, String nom) throws Exception {
    return json.readTree(mvc.perform(post("/api/auth/signup")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"nom\":\"" + nom + "\",\"ville\":\"Lome\",\"email\":\"" + email
                + "\",\"motDePasse\":\"secret1\",\"nomResponsable\":\"Fondateur Test\"}"))
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
