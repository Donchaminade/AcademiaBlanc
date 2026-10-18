package tg.academiablanc.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = "app.platform.super-admin-email=proprio@logiciel.tg")
@AutoConfigureMockMvc
class PlateformeSurveillanceTest {
  @Autowired
  private MockMvc mvc;
  @Autowired
  private ObjectMapper json;

  @Test
  void ecoleRefuseeEtProprietaireListeLesEtablissements() throws Exception {
    mvc.perform(get("/api/plateforme/etablissements")).andExpect(status().isForbidden());

    JsonNode inscription = json.readTree(mvc.perform(post("/api/auth/signup")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"nom":"Compte Proprietaire","ville":"Lome","email":"proprio@logiciel.tg","motDePasse":"secret1","nomResponsable":"Proprietaire Logiciel"}
                """))
        .andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString());
    assertEquals("OWNER", inscription.get("role").asText(), "l'inscription ne doit pas accorder SUPER_ADMIN");

    String ecoleToken = token(mvc.perform(post("/api/auth/signup")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"nom":"Lycee Isole","ville":"Kara","email":"isole@ecole.tg","motDePasse":"secret1","nomResponsable":"Proviseur Isole"}
                """))
        .andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString());

    mvc.perform(get("/api/plateforme/etablissements").header("Authorization", "Bearer " + ecoleToken))
        .andExpect(status().isForbidden());
    JsonNode anneesEcole = json.readTree(mvc.perform(get("/api/annees-scolaires").header("Authorization", "Bearer " + ecoleToken))
        .andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString());
    assertEquals(1, anneesEcole.size());

    JsonNode connexion = json.readTree(mvc.perform(post("/api/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"proprio@logiciel.tg\",\"motDePasse\":\"secret1\"}"))
        .andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString());
    assertEquals("SUPER_ADMIN", connexion.get("role").asText());
    String proprioToken = connexion.get("token").asText();

    JsonNode anneesProprio = json.readTree(mvc.perform(get("/api/annees-scolaires").header("Authorization", "Bearer " + proprioToken))
        .andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString());
    assertEquals(1, anneesProprio.size(), "le rôle plateforme ne lève pas le filtre des API d'établissement");

    String body = mvc.perform(get("/api/plateforme/etablissements").header("Authorization", "Bearer " + proprioToken))
        .andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString();
    assertFalse(body.contains("CISSE"), "la surveillance ne renvoie pas les noms d'élèves");
    assertFalse(body.contains("motDePasse"), "la surveillance ne renvoie pas de secret");

    JsonNode liste = json.readTree(body);
    assertTrue(liste.size() >= 2);
    JsonNode proprio = trouver(liste, "proprio@logiciel.tg");
    assertEquals("Compte Proprietaire", proprio.get("nom").asText());
    assertEquals("Proprietaire Logiciel", proprio.get("nomResponsable").asText());
    assertEquals(1, proprio.get("utilisateurs").asLong());
    assertEquals(0, proprio.get("classes").asLong());
    assertEquals(0, proprio.get("eleves").asLong());
    assertEquals(0, proprio.get("professeurs").asLong());
    assertEquals(0, proprio.get("sessions").asLong());
    assertEquals(0, proprio.get("notes").asLong());

    JsonNode tokoin = trouver(liste, "direction@lycee-tokoin.tg");
    assertEquals("Lycée Moderne de Tokoin", tokoin.get("nom").asText());
    assertEquals(1, tokoin.get("utilisateurs").asLong());
    assertEquals(1, tokoin.get("classes").asLong());
    assertEquals(3, tokoin.get("eleves").asLong());
    assertEquals(1, tokoin.get("professeurs").asLong());
    assertEquals(1, tokoin.get("sessions").asLong());
    assertEquals(24, tokoin.get("notes").asLong());
    assertTrue(liste.toString().contains("isole@ecole.tg"));
  }

  private static String token(String raw) throws Exception {
    return new ObjectMapper().readTree(raw).get("token").asText();
  }

  private static JsonNode trouver(JsonNode liste, String email) {
    for (JsonNode item : liste) {
      if (email.equals(item.get("email").asText())) return item;
    }
    throw new AssertionError("Établissement absent : " + email);
  }
}
