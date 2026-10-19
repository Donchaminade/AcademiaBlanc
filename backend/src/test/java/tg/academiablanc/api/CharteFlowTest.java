package tg.academiablanc.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import tg.academiablanc.domain.Role;
import tg.academiablanc.domain.Utilisateur;
import tg.academiablanc.repo.UtilisateurRepository;

@SpringBootTest
@AutoConfigureMockMvc
class CharteFlowTest {
  private static final String PNG_DATA_URL =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

  @Autowired
  private MockMvc mvc;
  @Autowired
  private ObjectMapper json;
  @Autowired
  private UtilisateurRepository utilisateurs;
  @Autowired
  private PasswordEncoder passwordEncoder;

  @Test
  void charteVideParDefautPuisEnregistreeEtCloisonnee() throws Exception {
    String owner = inscrire("charte-owner@ecole.tg", "Lycee Charte");
    String autre = inscrire("charte-autre@ecole.tg", "Lycee Voisin");

    mvc.perform(get("/api/etablissement/charte").header("Authorization", "Bearer " + owner))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.sceauUrl").isEmpty())
        .andExpect(jsonPath("$.signatureProviseurUrl").isEmpty())
        .andExpect(jsonPath("$.signatureTitulaireUrl").isEmpty());

    mvc.perform(put("/api/etablissement/charte")
            .header("Authorization", "Bearer " + owner)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"sceauUrl\":\"" + PNG_DATA_URL + "\",\"signatureProviseurUrl\":\"https://cdn.example.org/signature.png\",\"signatureTitulaireUrl\":\"\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.sceauUrl").value(PNG_DATA_URL))
        .andExpect(jsonPath("$.signatureProviseurUrl").value("https://cdn.example.org/signature.png"))
        .andExpect(jsonPath("$.signatureTitulaireUrl").isEmpty());

    mvc.perform(get("/api/etablissement/charte").header("Authorization", "Bearer " + owner))
        .andExpect(jsonPath("$.sceauUrl").value(PNG_DATA_URL));

    // Un autre établissement ne voit pas ce cachet.
    mvc.perform(get("/api/etablissement/charte").header("Authorization", "Bearer " + autre))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.sceauUrl").isEmpty());

    // Retirer l'image remet l'emplacement à vide.
    mvc.perform(put("/api/etablissement/charte")
            .header("Authorization", "Bearer " + owner)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"sceauUrl\":null,\"signatureProviseurUrl\":\"\",\"signatureTitulaireUrl\":null}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.sceauUrl").isEmpty())
        .andExpect(jsonPath("$.signatureProviseurUrl").isEmpty());
  }

  @Test
  void refuseLesValeursNonImage() throws Exception {
    String owner = inscrire("charte-invalide@ecole.tg", "Lycee Invalide");
    mvc.perform(put("/api/etablissement/charte")
            .header("Authorization", "Bearer " + owner)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"sceauUrl\":\"javascript:alert(1)\"}"))
        .andExpect(status().isBadRequest());
    mvc.perform(put("/api/etablissement/charte")
            .header("Authorization", "Bearer " + owner)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"sceauUrl\":\"data:text/html;base64,PGI+PC9iPg==\"}"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void lectureOuverteAuPersonnelMaisEcritureReserveeAuxResponsables() throws Exception {
    String owner = inscrire("charte-secretariat@ecole.tg", "Lycee Secretariat");
    long etablissementId = json.readTree(
        mvc.perform(get("/api/annees-scolaires").header("Authorization", "Bearer " + owner))
            .andReturn().getResponse().getContentAsString()).get(0).get("etablissementId").asLong();

    Utilisateur secretaire = new Utilisateur();
    secretaire.setEtablissementId(etablissementId);
    secretaire.setEmail("charte-secretaire@ecole.tg");
    secretaire.setMotDePasseHash(passwordEncoder.encode("secret1"));
    secretaire.setNom("Secrétaire");
    secretaire.setRole(Role.SECRETAIRE);
    utilisateurs.save(secretaire);
    String token = token(mvc.perform(post("/api/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"charte-secretaire@ecole.tg\",\"motDePasse\":\"secret1\"}"))
        .andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString());

    mvc.perform(get("/api/etablissement/charte").header("Authorization", "Bearer " + token))
        .andExpect(status().isOk());
    mvc.perform(put("/api/etablissement/charte")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"sceauUrl\":\"" + PNG_DATA_URL + "\"}"))
        .andExpect(status().isForbidden());
    mvc.perform(get("/api/etablissement/charte")).andExpect(status().isForbidden());
  }

  private String inscrire(String email, String nom) throws Exception {
    return token(mvc.perform(post("/api/auth/signup")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"nom\":\"" + nom + "\",\"ville\":\"Lome\",\"email\":\"" + email
                + "\",\"motDePasse\":\"secret1\",\"nomResponsable\":\"Proviseur\",\"acceptationConditions\":true}"))
        .andExpect(status().isCreated())
        .andReturn().getResponse().getContentAsString());
  }

  private String token(String raw) {
    return raw.split("\"token\":\"")[1].split("\"")[0];
  }
}
