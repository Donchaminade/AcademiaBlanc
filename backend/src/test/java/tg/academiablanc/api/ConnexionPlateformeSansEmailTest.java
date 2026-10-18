package tg.academiablanc.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/**
 * SUPER_ADMIN_EMAIL vide : la plateforme n'a pas de propriétaire. Même un compte d'établissement
 * existant reçoit le message « non initialisé », qui ne confirme ni n'infirme son existence.
 */
@SpringBootTest(properties = {
    "app.platform.super-admin-email=",
    "app.platform.super-admin-password=",
    "spring.datasource.url=jdbc:h2:mem:academiablanc-login-plateforme-sans-email;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE"
})
@AutoConfigureMockMvc
class ConnexionPlateformeSansEmailTest {
  @Autowired
  private MockMvc mvc;

  @Test
  void sansEmailConfigureLaConnexionAdminRenvoieNonInitialise() throws Exception {
    mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
            .content("{\"nom\":\"Lycee Sans Proprio\",\"ville\":\"Kara\",\"email\":\"owner-sans-proprio@ecole.tg\","
                + "\"motDePasse\":\"secret1\",\"nomResponsable\":\"Proviseur\"}"))
        .andExpect(status().isOk());

    for (String email : new String[] {"owner-sans-proprio@ecole.tg", "inconnu@nulle-part.tg"}) {
      mvc.perform(post("/api/auth/login-plateforme").contentType(MediaType.APPLICATION_JSON)
              .content("{\"email\":\"" + email + "\",\"motDePasse\":\"secret1\"}"))
          .andExpect(status().isUnauthorized())
          .andExpect(jsonPath("$.message").value(AuthController.MESSAGE_PLATEFORME_NON_INITIALISEE))
          .andExpect(jsonPath("$.token").doesNotExist());
    }
  }
}
