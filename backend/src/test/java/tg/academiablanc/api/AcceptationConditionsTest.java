package tg.academiablanc.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import tg.academiablanc.domain.AcceptationConditions;
import tg.academiablanc.domain.Role;
import tg.academiablanc.domain.Utilisateur;
import tg.academiablanc.repo.AcceptationConditionsRepository;
import tg.academiablanc.repo.EtablissementRepository;
import tg.academiablanc.repo.UtilisateurRepository;

@SpringBootTest
@AutoConfigureMockMvc
class AcceptationConditionsTest {
  private static final String UA_LONG = "Mozilla/5.0 " + "x".repeat(400);

  @Autowired
  private MockMvc mvc;
  @Autowired
  private ObjectMapper json;
  @Autowired
  private AcceptationConditionsRepository acceptations;
  @Autowired
  private EtablissementRepository etablissements;
  @Autowired
  private UtilisateurRepository utilisateurs;
  @Autowired
  private PasswordEncoder passwordEncoder;

  @Test
  void inscriptionSansAcceptationRefuseeEtAucunCompteCree() throws Exception {
    for (String variante : new String[] {"", ",\"acceptationConditions\":false", ",\"acceptationConditions\":null"}) {
      mvc.perform(post("/api/auth/signup")
              .contentType(MediaType.APPLICATION_JSON)
              .content("{\"nom\":\"Lycee Sans Case\",\"ville\":\"Lome\",\"email\":\"sans-case@ecole.tg\","
                  + "\"motDePasse\":\"secret1\",\"nomResponsable\":\"Proviseur\"" + variante + "}"))
          .andExpect(status().isBadRequest())
          .andExpect(jsonPath("$.message").value(AcceptationConditionsService.MESSAGE_ACCEPTATION_REQUISE));
    }
    assertTrue(etablissements.findByEmailIgnoreCase("sans-case@ecole.tg").isEmpty(), "aucun établissement ne doit être créé");
    assertTrue(utilisateurs.findByEmailIgnoreCase("sans-case@ecole.tg").isEmpty(), "aucun compte ne doit être créé");
  }

  @Test
  void inscriptionAvecAcceptationEnregistreLaPreuveHorodatee() throws Exception {
    Instant avant = Instant.now().minusSeconds(1);
    JsonNode reponse = json.readTree(mvc.perform(post("/api/auth/signup")
            .contentType(MediaType.APPLICATION_JSON)
            .header("User-Agent", UA_LONG)
            .header("X-Forwarded-For", "41.207.188.10, 10.0.0.2")
            .content("{\"nom\":\"Lycee Preuve\",\"ville\":\"Lome\",\"email\":\"preuve@ecole.tg\","
                + "\"motDePasse\":\"secret1\",\"nomResponsable\":\"Proviseur\","
                + "\"acceptationConditions\":true,\"versionConditions\":\"2026-10-19\"}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.token").isNotEmpty())
        .andReturn().getResponse().getContentAsString());
    long etablissementId = reponse.get("etablissementId").asLong();
    long utilisateurId = reponse.get("utilisateurId").asLong();

    List<AcceptationConditions> lignes = acceptations.findByEtablissementIdOrderByAccepteLeDescIdDesc(etablissementId);
    assertEquals(1, lignes.size(), "une seule ligne d'acceptation à l'inscription");
    AcceptationConditions ligne = lignes.get(0);
    assertEquals(utilisateurId, ligne.getUtilisateurId());
    assertEquals("preuve@ecole.tg", ligne.getEmail());
    assertEquals("2026-10-19", ligne.getVersionConditions());
    assertEquals("41.207.188.10", ligne.getAdresseIp(), "première adresse de X-Forwarded-For");
    assertNotNull(ligne.getUserAgent());
    assertEquals(255, ligne.getUserAgent().length(), "agent utilisateur tronqué à 255 caractères");
    assertTrue(UA_LONG.startsWith(ligne.getUserAgent()));
    Instant accepteLe = ligne.getAccepteLe();
    assertNotNull(accepteLe);
    assertTrue(accepteLe.isAfter(avant), "horodatage du serveur, au moment de l'inscription");
    assertTrue(Duration.between(accepteLe, Instant.now()).toMinutes() < 5);

    // Le chef relit l'historique : la date est renvoyée en ISO 8601 UTC (suffixe Z).
    String token = reponse.get("token").asText();
    mvc.perform(get("/api/etablissement/acceptations").header("Authorization", "Bearer " + token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(1))
        .andExpect(jsonPath("$[0].versionConditions").value("2026-10-19"))
        .andExpect(jsonPath("$[0].email").value("preuve@ecole.tg"))
        .andExpect(jsonPath("$[0].adresseIp").value("41.207.188.10"))
        .andExpect(jsonPath("$[0].accepteLe").value(org.hamcrest.Matchers.endsWith("Z")));
    mvc.perform(get("/api/etablissement/acceptations/derniere").header("Authorization", "Bearer " + token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.versionConditions").value("2026-10-19"))
        .andExpect(jsonPath("$.accepteLe").isNotEmpty());
  }

  @Test
  void laVersionParDefautEstEnregistreeQuandLeClientNEnIndiquePas() throws Exception {
    JsonNode reponse = json.readTree(mvc.perform(post("/api/auth/signup")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"nom\":\"Lycee Defaut\",\"ville\":\"Kara\",\"email\":\"defaut-version@ecole.tg\","
                + "\"motDePasse\":\"secret1\",\"nomResponsable\":\"Proviseur\",\"acceptationConditions\":true}"))
        .andExpect(status().isCreated())
        .andReturn().getResponse().getContentAsString());
    AcceptationConditions ligne = acceptations
        .findFirstByEtablissementIdOrderByAccepteLeDescIdDesc(reponse.get("etablissementId").asLong()).orElseThrow();
    assertEquals("2026-10-19", ligne.getVersionConditions());
  }

  @Test
  void lectureReserveeAuChefEtReacceptationAjouteUneLigne() throws Exception {
    JsonNode owner = inscrire("chef-acceptation@ecole.tg", "Lycee Chef");
    String tokenOwner = owner.get("token").asText();
    long etablissementId = owner.get("etablissementId").asLong();

    Utilisateur enseignant = new Utilisateur();
    enseignant.setEtablissementId(etablissementId);
    enseignant.setEmail("prof-acceptation@ecole.tg");
    enseignant.setMotDePasseHash(passwordEncoder.encode("secret1"));
    enseignant.setNom("Enseignant");
    enseignant.setRole(Role.ENSEIGNANT);
    utilisateurs.save(enseignant);
    String tokenProf = json.readTree(mvc.perform(post("/api/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"prof-acceptation@ecole.tg\",\"motDePasse\":\"secret1\"}"))
        .andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString()).get("token").asText();

    // Un enseignant ne lit pas l'historique et ne peut pas accepter au nom de l'établissement…
    mvc.perform(get("/api/etablissement/acceptations").header("Authorization", "Bearer " + tokenProf))
        .andExpect(status().isForbidden());
    mvc.perform(post("/api/etablissement/acceptations")
            .header("Authorization", "Bearer " + tokenProf)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"acceptationConditions\":true,\"versionConditions\":\"2027-01-01\"}"))
        .andExpect(status().isForbidden());
    // … mais connaît la dernière version acceptée (information non bloquante dans l'interface).
    mvc.perform(get("/api/etablissement/acceptations/derniere").header("Authorization", "Bearer " + tokenProf))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.versionConditions").value("2026-10-19"));
    // Sans jeton : refusé.
    mvc.perform(get("/api/etablissement/acceptations")).andExpect(status().isForbidden());

    // Ré-acceptation par le chef : la case reste obligatoire, puis une nouvelle ligne s'ajoute (l'ancienne reste).
    mvc.perform(post("/api/etablissement/acceptations")
            .header("Authorization", "Bearer " + tokenOwner)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"acceptationConditions\":false,\"versionConditions\":\"2027-01-01\"}"))
        .andExpect(status().isBadRequest());
    mvc.perform(post("/api/etablissement/acceptations")
            .header("Authorization", "Bearer " + tokenOwner)
            .header("User-Agent", "Chrome/130")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"acceptationConditions\":true,\"versionConditions\":\"2027-01-01\"}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.versionConditions").value("2027-01-01"))
        .andExpect(jsonPath("$.userAgent").value("Chrome/130"));

    mvc.perform(get("/api/etablissement/acceptations").header("Authorization", "Bearer " + tokenOwner))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(2))
        .andExpect(jsonPath("$[0].versionConditions").value("2027-01-01"))
        .andExpect(jsonPath("$[1].versionConditions").value("2026-10-19"));
    mvc.perform(get("/api/etablissement/acceptations/derniere").header("Authorization", "Bearer " + tokenOwner))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.versionConditions").value("2027-01-01"));
    assertEquals(2, acceptations.findByEtablissementIdOrderByAccepteLeDescIdDesc(etablissementId).size());
  }

  private JsonNode inscrire(String email, String nom) throws Exception {
    return json.readTree(mvc.perform(post("/api/auth/signup")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"nom\":\"" + nom + "\",\"ville\":\"Lome\",\"email\":\"" + email
                + "\",\"motDePasse\":\"secret1\",\"nomResponsable\":\"Proviseur\",\"acceptationConditions\":true,\"versionConditions\":\"2026-10-19\"}"))
        .andExpect(status().isCreated())
        .andReturn().getResponse().getContentAsString());
  }
}
