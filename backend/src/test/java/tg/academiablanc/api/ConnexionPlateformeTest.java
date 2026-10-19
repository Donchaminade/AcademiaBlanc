package tg.academiablanc.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import tg.academiablanc.domain.Role;
import tg.academiablanc.domain.Utilisateur;
import tg.academiablanc.repo.UtilisateurRepository;

/**
 * {@code POST /api/auth/login-plateforme} : connexion de la page {@code /admin}, réservée aux rôles
 * de la plateforme. Même vérification des identifiants que {@code /login}, mais un compte
 * d'établissement est refusé (403) au lieu de recevoir un jeton.
 */
@SpringBootTest(properties = {
    "app.platform.super-admin-email=proprio-admin@logiciel.tg",
    "app.platform.super-admin-password=secret-admin",
    // Base H2 dédiée : les autres contextes (autre SUPER_ADMIN_EMAIL) rétrograderaient ce compte en OWNER.
    "spring.datasource.url=jdbc:h2:mem:academiablanc-login-plateforme;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE"
})
@AutoConfigureMockMvc
class ConnexionPlateformeTest {
  private static final String EMAIL_PROPRIO = "proprio-admin@logiciel.tg";

  @Autowired
  private MockMvc mvc;
  @Autowired
  private ObjectMapper json;
  @Autowired
  private UtilisateurRepository utilisateurs;

  @Test
  void leProprietaireObtientUnJetonDePlateforme() throws Exception {
    JsonNode reponse = json.readTree(connexionPlateforme(EMAIL_PROPRIO, "secret-admin")
        .andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString());
    assertEquals("SUPER_ADMIN", reponse.get("role").asText());
    assertTrue(reponse.get("etablissementId").isNull());
    assertEquals("Plateforme AcademiaBlanc", reponse.get("nomEtablissement").asText());

    String token = reponse.get("token").asText();
    mvc.perform(get("/api/plateforme/etablissements").header("Authorization", "Bearer " + token))
        .andExpect(status().isOk());
    mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.role").value("SUPER_ADMIN"));
  }

  @Test
  void unGestionnaireDePlateformeEstAccepte() throws Exception {
    String tokenProprio = json.readTree(connexionPlateforme(EMAIL_PROPRIO, "secret-admin")
        .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("token").asText();
    mvc.perform(post("/api/plateforme/gestionnaires")
            .header("Authorization", "Bearer " + tokenProprio)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"nom\":\"Gestionnaire Admin\",\"email\":\"gestion-admin@logiciel.tg\",\"motDePasse\":\"gestion1\"}"))
        .andExpect(status().is2xxSuccessful());

    Utilisateur gestionnaire = utilisateurs.findByEmailIgnoreCase("gestion-admin@logiciel.tg").orElseThrow();
    assertEquals(Role.GESTIONNAIRE_PLATEFORME, gestionnaire.getRole());

    connexionPlateforme("gestion-admin@logiciel.tg", "gestion1")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.role").value("GESTIONNAIRE_PLATEFORME"))
        .andExpect(jsonPath("$.token").isNotEmpty());
  }

  @Test
  void unCompteEtablissementEstRefuseSansJeton() throws Exception {
    mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
            .content("{\"nom\":\"Lycee Non Plateforme\",\"ville\":\"Lome\",\"email\":\"owner-admin@ecole.tg\","
                + "\"motDePasse\":\"secret1\",\"nomResponsable\":\"Proviseur\",\"acceptationConditions\":true}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.role").value("OWNER"));

    // Le même compte entre normalement par /login…
    connexion("/api/auth/login", "owner-admin@ecole.tg", "secret1").andExpect(status().isOk());
    // … mais jamais par la connexion d'administration : 403 avec un message explicite, sans jeton.
    connexionPlateforme("owner-admin@ecole.tg", "secret1")
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.message").value(AuthController.MESSAGE_COMPTE_NON_PLATEFORME))
        .andExpect(jsonPath("$.token").doesNotExist());
  }

  @Test
  void identifiantsIncorrectsRenvoient401() throws Exception {
    connexionPlateforme(EMAIL_PROPRIO, "mauvais-mot-de-passe")
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.message").value(AuthController.MESSAGE_IDENTIFIANTS));
    // Un email inconnu reçoit exactement le même message : aucune énumération de comptes.
    connexionPlateforme("inconnu@nulle-part.tg", "secret-admin")
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.message").value(AuthController.MESSAGE_IDENTIFIANTS));
  }

  private ResultActions connexionPlateforme(String email, String motDePasse) throws Exception {
    return connexion("/api/auth/login-plateforme", email, motDePasse);
  }

  private ResultActions connexion(String chemin, String email, String motDePasse) throws Exception {
    return mvc.perform(post(chemin).contentType(MediaType.APPLICATION_JSON)
        .content("{\"email\":\"" + email + "\",\"motDePasse\":\"" + motDePasse + "\"}"));
  }
}
