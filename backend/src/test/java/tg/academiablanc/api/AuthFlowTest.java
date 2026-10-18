package tg.academiablanc.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
class AuthFlowTest {
  @Autowired
  private MockMvc mvc;

  @Test
  void unInviteNeLitPasLesAnnees() throws Exception {
    mvc.perform(get("/api/annees-scolaires")).andExpect(status().isForbidden());
  }

  @Test
  void inscriptionPuisLectureCloisonnee() throws Exception {
    String raw = mvc.perform(post("/api/auth/signup")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"nom":"Lycee Test Isolation","ville":"Lome","email":"isolation@ecole.tg","motDePasse":"secret1","nomResponsable":"Proviseur Test"}
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.token").isNotEmpty())
        .andReturn()
        .getResponse()
        .getContentAsString();
    String token = raw.split("\"token\":\"")[1].split("\"")[0];
    mvc.perform(get("/api/annees-scolaires").header("Authorization", "Bearer " + token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].libelle").value("2024-2025"))
        .andExpect(jsonPath("$[0].etablissementId").isNumber());
  }
}
