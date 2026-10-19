package tg.academiablanc.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import tg.academiablanc.domain.Role;
import tg.academiablanc.domain.Utilisateur;
import tg.academiablanc.repo.UtilisateurRepository;
import tg.academiablanc.security.PlatformOwnerService;

/**
 * Le propriétaire du logiciel n'a pas à s'inscrire : son compte est créé au démarrage
 * à partir de SUPER_ADMIN_EMAIL et SUPER_ADMIN_PASSWORD.
 */
@SpringBootTest(properties = {
    "app.platform.super-admin-email=Proprio-Seed@Logiciel.tg",
    "app.platform.super-admin-password=motdepasse-initial",
    // Base H2 dédiée : les autres contextes de test (autre SUPER_ADMIN_EMAIL) partagent la base par défaut
    // et rétrograderaient ce compte en OWNER à leur propre démarrage.
    "spring.datasource.url=jdbc:h2:mem:academiablanc-seed;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE"
})
@AutoConfigureMockMvc
class ProprietairePlateformeSeedTest {
  private static final String EMAIL = "proprio-seed@logiciel.tg";

  @Autowired
  private MockMvc mvc;
  @Autowired
  private ObjectMapper json;
  @Autowired
  private UtilisateurRepository utilisateurs;
  @Autowired
  private PasswordEncoder passwordEncoder;
  @Autowired
  private PlatformOwnerService platformOwners;

  @Test
  void compteCreeAuDemarrageSansEtablissementEtMotDePasseRejouable() throws Exception {
    // 1. Créé au démarrage, sans inscription, sans établissement.
    Utilisateur proprietaire = utilisateurs.findByEmailIgnoreCase(EMAIL).orElseThrow();
    assertEquals(Role.SUPER_ADMIN, proprietaire.getRole());
    assertNull(proprietaire.getEtablissementId(), "le propriétaire n'est rattaché à aucun établissement");
    assertTrue(proprietaire.isActif());
    assertNull(proprietaire.getCreePar());
    assertEquals(EMAIL, proprietaire.getEmail(), "l'email est normalisé en minuscules");
    assertTrue(passwordEncoder.matches("motdepasse-initial", proprietaire.getMotDePasseHash()));
    assertNotEquals("motdepasse-initial", proprietaire.getMotDePasseHash(), "le mot de passe est haché");

    // 2. Connexion avec le mot de passe fourni ; le jeton ne porte aucun établissement.
    JsonNode connexion = json.readTree(connecter("motdepasse-initial").andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString());
    assertEquals("SUPER_ADMIN", connexion.get("role").asText());
    assertTrue(connexion.get("etablissementId").isNull());
    assertEquals("Plateforme AcademiaBlanc", connexion.get("nomEtablissement").asText());
    List<String> droits = new ArrayList<>();
    connexion.get("permissions").forEach(item -> droits.add(item.asText()));
    assertTrue(droits.contains("ETABLISSEMENTS:SUPPRIMER"));
    assertTrue(droits.contains("GESTIONNAIRES:CREER"));
    assertFalse(droits.contains("MATIERES:SUPPRIMER"), "sans établissement, aucun droit sur les données pédagogiques");
    String token = connexion.get("token").asText();

    mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.role").value("SUPER_ADMIN"))
        .andExpect(jsonPath("$.etablissementId").doesNotExist())
        .andExpect(jsonPath("$.nomEtablissement").doesNotExist())
        .andExpect(jsonPath("$.actif").value(true));

    // 3. Accès aux écrans de la plateforme, refus des données d'établissement (aucun établissement).
    mvc.perform(get("/api/plateforme/etablissements").header("Authorization", "Bearer " + token))
        .andExpect(status().isOk());
    mvc.perform(get("/api/plateforme/gestionnaires").header("Authorization", "Bearer " + token))
        .andExpect(status().isOk());
    mvc.perform(get("/api/annees-scolaires").header("Authorization", "Bearer " + token))
        .andExpect(status().isForbidden());

    // 4. L'inscription avec cet email reste impossible : pas de second établissement pour le propriétaire.
    mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
            .content("{\"nom\":\"Doublon\",\"ville\":\"Lome\",\"email\":\"" + EMAIL
                + "\",\"motDePasse\":\"secret1\",\"nomResponsable\":\"X\",\"acceptationConditions\":true}"))
        .andExpect(status().is4xxClientError());

    // 5. Un redémarrage avec le même mot de passe ne touche à rien.
    String hashInitial = proprietaire.getMotDePasseHash();
    new PlatformOwnerService(utilisateurs, passwordEncoder, EMAIL, "motdepasse-initial").synchronize();
    assertEquals(hashInitial, utilisateurs.findByEmailIgnoreCase(EMAIL).orElseThrow().getMotDePasseHash());
    assertEquals(1, utilisateurs.findByRole(Role.SUPER_ADMIN).size(), "pas de doublon de compte");

    // 6. Changement de SUPER_ADMIN_PASSWORD puis redémarrage : l'accès est réinitialisé.
    new PlatformOwnerService(utilisateurs, passwordEncoder, EMAIL, "nouveau-motdepasse").synchronize();
    Utilisateur apres = utilisateurs.findByEmailIgnoreCase(EMAIL).orElseThrow();
    assertNotEquals(hashInitial, apres.getMotDePasseHash());
    assertEquals(Role.SUPER_ADMIN, apres.getRole());
    assertNull(apres.getEtablissementId());
    connecter("motdepasse-initial").andExpect(status().isUnauthorized());
    connecter("nouveau-motdepasse").andExpect(status().isOk())
        .andExpect(jsonPath("$.role").value("SUPER_ADMIN"));

    // 7. Variable vide au redémarrage : le compte existant est conservé tel quel.
    String hashNouveau = apres.getMotDePasseHash();
    new PlatformOwnerService(utilisateurs, passwordEncoder, EMAIL, "").synchronize();
    assertEquals(hashNouveau, utilisateurs.findByEmailIgnoreCase(EMAIL).orElseThrow().getMotDePasseHash());
    connecter("nouveau-motdepasse").andExpect(status().isOk());

    // Remet le mot de passe initial pour ne pas dépendre de l'ordre d'exécution des tests.
    new PlatformOwnerService(utilisateurs, passwordEncoder, EMAIL, "motdepasse-initial").synchronize();
  }

  @Test
  void sansMotDePasseAucunCompteNestCree() {
    String email = "proprio-sans-mdp@logiciel.tg";
    try {
      new PlatformOwnerService(utilisateurs, passwordEncoder, email, "").synchronize();
      assertFalse(utilisateurs.findByEmailIgnoreCase(email).isPresent(),
          "SUPER_ADMIN_EMAIL seul ne crée pas de compte : un avertissement est journalisé");
      new PlatformOwnerService(utilisateurs, passwordEncoder, email, "   ").synchronize();
      assertFalse(utilisateurs.findByEmailIgnoreCase(email).isPresent());
      // Changer d'email a rétrogradé le propriétaire amorcé au démarrage : c'est le comportement attendu.
      assertEquals(Role.OWNER, utilisateurs.findByEmailIgnoreCase(EMAIL).orElseThrow().getRole());
    } finally {
      // Rejoue le démarrage réel (propriétés du contexte) pour l'autre test, quel que soit l'ordre d'exécution.
      platformOwners.synchronize();
    }
    assertEquals(Role.SUPER_ADMIN, utilisateurs.findByEmailIgnoreCase(EMAIL).orElseThrow().getRole());
  }

  private ResultActions connecter(String motDePasse) throws Exception {
    return mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
        .content("{\"email\":\"" + EMAIL + "\",\"motDePasse\":\"" + motDePasse + "\"}"));
  }
}
