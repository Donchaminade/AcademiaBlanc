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
class ProfilEtablissementTest {
  @Autowired
  private MockMvc mvc;
  @Autowired
  private ObjectMapper json;
  @Autowired
  private UtilisateurRepository utilisateurs;
  @Autowired
  private PasswordEncoder passwordEncoder;

  @Test
  void leProfilRefleteLInscriptionPuisSeModifie() throws Exception {
    String owner = inscrire("profil-owner@ecole.tg", "Lycee Profil");

    mvc.perform(get("/api/etablissement").header("Authorization", "Bearer " + owner))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.nom").value("Lycee Profil"))
        .andExpect(jsonPath("$.ville").value("Lome"))
        .andExpect(jsonPath("$.code").isNotEmpty())
        .andExpect(jsonPath("$.email").value("profil-owner@ecole.tg"))
        .andExpect(jsonPath("$.nomResponsable").value("Proviseur"))
        .andExpect(jsonPath("$.actif").value(true))
        .andExpect(jsonPath("$.creeLe").isNotEmpty())
        .andExpect(jsonPath("$.adresse").isEmpty())
        .andExpect(jsonPath("$.devise").isEmpty());

    mvc.perform(put("/api/etablissement")
            .header("Authorization", "Bearer " + owner)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"nom":"Lycée Profil Rénové","typeEtablissement":"Lycée public","ville":"Kara","region":"Kara",
                 "adresse":"BP 12, quartier Tomdè","telephone":"+228 90 00 00 00","email":"Contact@Lycee-Profil.tg",
                 "nomResponsable":"Mme AMEGAN","devise":"Travail et rigueur"}
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.nom").value("Lycée Profil Rénové"))
        .andExpect(jsonPath("$.ville").value("Kara"))
        .andExpect(jsonPath("$.adresse").value("BP 12, quartier Tomdè"))
        .andExpect(jsonPath("$.email").value("contact@lycee-profil.tg"))
        .andExpect(jsonPath("$.devise").value("Travail et rigueur"));

    // Le nom modifié est celui que relit la session (barre latérale, bulletins).
    mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + owner))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.nomEtablissement").value("Lycée Profil Rénové"));

    // Un champ obligatoire vide est refusé.
    mvc.perform(put("/api/etablissement")
            .header("Authorization", "Bearer " + owner)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"nom\":\"  \",\"ville\":\"Kara\",\"email\":\"contact@lycee-profil.tg\",\"nomResponsable\":\"X\"}"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void lEmailDUnAutreEtablissementEstRefuse() throws Exception {
    String owner = inscrire("profil-a@ecole.tg", "Lycee A");
    inscrire("profil-b@ecole.tg", "Lycee B");

    mvc.perform(put("/api/etablissement")
            .header("Authorization", "Bearer " + owner)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"nom\":\"Lycee A\",\"ville\":\"Lome\",\"email\":\"profil-b@ecole.tg\",\"nomResponsable\":\"Proviseur\"}"))
        .andExpect(status().isConflict());
  }

  @Test
  void lesStatistiquesSontCellesDeLEtablissementSeulement() throws Exception {
    String owner = inscrire("profil-stats@ecole.tg", "Lycee Stats");
    inscrire("profil-stats-voisin@ecole.tg", "Lycee Voisin");

    mvc.perform(get("/api/etablissement/statistiques").header("Authorization", "Bearer " + owner))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.utilisateurs").value(1))
        .andExpect(jsonPath("$.classes").value(0))
        .andExpect(jsonPath("$.eleves").value(0))
        .andExpect(jsonPath("$.sessions").value(0))
        .andExpect(jsonPath("$.archives").value(0));

    long anneeId = json.readTree(
        mvc.perform(get("/api/annees-scolaires").header("Authorization", "Bearer " + owner))
            .andReturn().getResponse().getContentAsString()).get(0).get("id").asLong();
    mvc.perform(post("/api/classes")
            .header("Authorization", "Bearer " + owner)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"anneeScolaireId\":" + anneeId + ",\"nom\":\"Tle D1\",\"niveau\":\"Tle\",\"serie\":\"D\"}"))
        .andExpect(status().isOk());

    mvc.perform(get("/api/etablissement/statistiques").header("Authorization", "Bearer " + owner))
        .andExpect(jsonPath("$.classes").value(1));
  }

  @Test
  void lectureOuverteAuPersonnelMaisEcritureReserveeAuxResponsables() throws Exception {
    String owner = inscrire("profil-droits@ecole.tg", "Lycee Droits");
    long etablissementId = json.readTree(
        mvc.perform(get("/api/etablissement").header("Authorization", "Bearer " + owner))
            .andReturn().getResponse().getContentAsString()).get("id").asLong();

    Utilisateur enseignant = new Utilisateur();
    enseignant.setEtablissementId(etablissementId);
    enseignant.setEmail("profil-enseignant@ecole.tg");
    enseignant.setMotDePasseHash(passwordEncoder.encode("secret1"));
    enseignant.setNom("Enseignant");
    enseignant.setRole(Role.ENSEIGNANT);
    utilisateurs.save(enseignant);
    String token = token(mvc.perform(post("/api/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"profil-enseignant@ecole.tg\",\"motDePasse\":\"secret1\"}"))
        .andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString());

    mvc.perform(get("/api/etablissement").header("Authorization", "Bearer " + token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.nom").value("Lycee Droits"));
    mvc.perform(get("/api/etablissement/statistiques").header("Authorization", "Bearer " + token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.utilisateurs").value(2));
    mvc.perform(put("/api/etablissement")
            .header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"nom\":\"Piraté\",\"ville\":\"Lome\",\"email\":\"profil-droits@ecole.tg\",\"nomResponsable\":\"X\"}"))
        .andExpect(status().isForbidden());
    mvc.perform(get("/api/etablissement")).andExpect(status().isForbidden());
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
