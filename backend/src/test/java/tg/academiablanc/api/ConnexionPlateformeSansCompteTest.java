package tg.academiablanc.api;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tg.academiablanc.repo.UtilisateurRepository;

/**
 * SUPER_ADMIN_EMAIL est posé mais SUPER_ADMIN_PASSWORD est vide : aucun compte n'a été créé au démarrage.
 * La connexion d'administration le signale clairement au lieu d'un « identifiants incorrects » trompeur.
 */
@SpringBootTest(properties = {
    "app.platform.super-admin-email=proprio-absent@logiciel.tg",
    "app.platform.super-admin-password=",
    "spring.datasource.url=jdbc:h2:mem:academiablanc-login-plateforme-sans-compte;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE"
})
@AutoConfigureMockMvc
class ConnexionPlateformeSansCompteTest {
  @Autowired
  private MockMvc mvc;
  @Autowired
  private UtilisateurRepository utilisateurs;

  @Test
  void sansCompteProprietaireLaConnexionAdminRenvoieNonInitialise() throws Exception {
    assertFalse(utilisateurs.findByEmailIgnoreCase("proprio-absent@logiciel.tg").isPresent());

    mvc.perform(post("/api/auth/login-plateforme").contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"proprio-absent@logiciel.tg\",\"motDePasse\":\"peu-importe\"}"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.message").value(AuthController.MESSAGE_PLATEFORME_NON_INITIALISEE))
        .andExpect(jsonPath("$.token").doesNotExist());
  }
}
