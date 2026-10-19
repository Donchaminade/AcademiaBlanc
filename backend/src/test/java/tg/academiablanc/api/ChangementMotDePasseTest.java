package tg.academiablanc.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class ChangementMotDePasseTest {
  @Autowired
  private MockMvc mvc;

  @Test
  void lAncienMotDePasseEstVerifiePuisLeNouveauSertALaConnexion() throws Exception {
    String token = inscrire("mdp-owner@ecole.tg");

    mvc.perform(put("/api/auth/mot-de-passe")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"ancienMotDePasse\":\"mauvais\",\"nouveauMotDePasse\":\"nouveau1\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message").value(AuthController.MESSAGE_ANCIEN_MOT_DE_PASSE));

    mvc.perform(put("/api/auth/mot-de-passe")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"ancienMotDePasse\":\"secret1\",\"nouveauMotDePasse\":\"secret1\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message").value(AuthController.MESSAGE_MOT_DE_PASSE_IDENTIQUE));

    // Trop court : validation du corps.
    mvc.perform(put("/api/auth/mot-de-passe")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"ancienMotDePasse\":\"secret1\",\"nouveauMotDePasse\":\"abc\"}"))
        .andExpect(status().isBadRequest());

    mvc.perform(put("/api/auth/mot-de-passe")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"ancienMotDePasse\":\"secret1\",\"nouveauMotDePasse\":\"nouveau1\"}"))
        .andExpect(status().isNoContent());

    mvc.perform(post("/api/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"mdp-owner@ecole.tg\",\"motDePasse\":\"secret1\"}"))
        .andExpect(status().isUnauthorized());
    mvc.perform(post("/api/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"mdp-owner@ecole.tg\",\"motDePasse\":\"nouveau1\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.token").isNotEmpty());
  }

  @Test
  void sansJetonLeChangementEstRefuse() throws Exception {
    mvc.perform(put("/api/auth/mot-de-passe")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"ancienMotDePasse\":\"secret1\",\"nouveauMotDePasse\":\"nouveau1\"}"))
        .andExpect(status().isForbidden());
  }

  private String inscrire(String email) throws Exception {
    String raw = mvc.perform(post("/api/auth/signup")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"nom\":\"Lycee Mot de passe\",\"ville\":\"Lome\",\"email\":\"" + email
                + "\",\"motDePasse\":\"secret1\",\"nomResponsable\":\"Proviseur\"}"))
        .andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString();
    return raw.split("\"token\":\"")[1].split("\"")[0];
  }
}
