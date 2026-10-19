package tg.academiablanc.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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

/**
 * Paramètres du bulletin de l'écran Paramètres (logo, sceau officiel, pays, devise, ministère, signataires,
 * numérotation) : enregistrés sur le serveur avec la charte, relus tels quels, cloisonnés par établissement.
 */
@SpringBootTest
@AutoConfigureMockMvc
class ParametresBulletinFlowTest {
  @Autowired
  private MockMvc mvc;

  @Test
  void parametresEnregistresPuisRelusEtCloisonnes() throws Exception {
    String owner = inscrire("params-owner@ecole.tg", "Lycee Parametres");

    // Jamais renseignés : tous à null (le client applique alors ses valeurs par défaut).
    mvc.perform(get("/api/etablissement/charte").header("Authorization", "Bearer " + owner))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.pays").isEmpty())
        .andExpect(jsonPath("$.logoUrl").isEmpty())
        .andExpect(jsonPath("$.premierNumeroTable").isEmpty())
        .andExpect(jsonPath("$.numerotationAutomatique").isEmpty());

    mvc.perform(put("/api/etablissement/charte")
            .header("Authorization", "Bearer " + owner)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"sceauUrl\":null,\"signatureProviseurUrl\":null,\"signatureTitulaireUrl\":null,"
                + "\"logoUrl\":\"https://cdn.example.org/logo.png\",\"sceauOfficielUrl\":\"\","
                + "\"pays\":\"RÉPUBLIQUE TOGOLAISE\",\"deviseNationale\":\"Travail – Liberté – Patrie\","
                + "\"ministere\":\"  MINISTÈRE DES ENSEIGNEMENTS  \",\"titreSignataireJury\":\"Le Proviseur\","
                + "\"nomSignataireJury\":\"M. AGBODJI Koffi\",\"titreTitulaire\":\"Le Titulaire\",\"nomTitulaire\":\"Mme LAWSON Ayélé\","
                + "\"premierNumeroTable\":201,\"numerotationAutomatique\":false}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.logoUrl").value("https://cdn.example.org/logo.png"))
        // Chaîne vide conservée : l'établissement a choisi de laisser l'emplacement du sceau vierge.
        .andExpect(jsonPath("$.sceauOfficielUrl").value(""))
        .andExpect(jsonPath("$.pays").value("RÉPUBLIQUE TOGOLAISE"))
        .andExpect(jsonPath("$.ministere").value("MINISTÈRE DES ENSEIGNEMENTS"))
        .andExpect(jsonPath("$.nomSignataireJury").value("M. AGBODJI Koffi"))
        .andExpect(jsonPath("$.premierNumeroTable").value(201))
        .andExpect(jsonPath("$.numerotationAutomatique").value(false));

    // Relecture après un nouveau chargement de l'espace.
    mvc.perform(get("/api/etablissement/charte").header("Authorization", "Bearer " + owner))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.sceauOfficielUrl").value(""))
        .andExpect(jsonPath("$.deviseNationale").value("Travail – Liberté – Patrie"))
        .andExpect(jsonPath("$.nomTitulaire").value("Mme LAWSON Ayélé"))
        .andExpect(jsonPath("$.premierNumeroTable").value(201));

    // Un second enregistrement remplace le premier.
    mvc.perform(put("/api/etablissement/charte")
            .header("Authorization", "Bearer " + owner)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"pays\":\"RÉPUBLIQUE DE CÔTE D'IVOIRE\",\"premierNumeroTable\":101,\"numerotationAutomatique\":true}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.pays").value("RÉPUBLIQUE DE CÔTE D'IVOIRE"))
        .andExpect(jsonPath("$.logoUrl").isEmpty())
        .andExpect(jsonPath("$.premierNumeroTable").value(101))
        .andExpect(jsonPath("$.numerotationAutomatique").value(true));

    // Valeurs refusées : logo non image, numéro de table hors bornes, texte trop long.
    mvc.perform(put("/api/etablissement/charte").header("Authorization", "Bearer " + owner)
            .contentType(MediaType.APPLICATION_JSON).content("{\"logoUrl\":\"javascript:alert(1)\"}"))
        .andExpect(status().isBadRequest());
    mvc.perform(put("/api/etablissement/charte").header("Authorization", "Bearer " + owner)
            .contentType(MediaType.APPLICATION_JSON).content("{\"premierNumeroTable\":0}"))
        .andExpect(status().isBadRequest());
    mvc.perform(put("/api/etablissement/charte").header("Authorization", "Bearer " + owner)
            .contentType(MediaType.APPLICATION_JSON).content("{\"pays\":\"" + "P".repeat(121) + "\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message").value("Le pays ne doit pas dépasser 120 caractères."));

    // Un autre établissement garde ses propres valeurs (toutes vides ici).
    String autre = inscrire("params-autre@ecole.tg", "Lycee Voisin Params");
    mvc.perform(get("/api/etablissement/charte").header("Authorization", "Bearer " + autre))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.pays").isEmpty())
        .andExpect(jsonPath("$.premierNumeroTable").isEmpty());
  }

  private String inscrire(String email, String nom) throws Exception {
    String raw = mvc.perform(post("/api/auth/signup")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"nom\":\"" + nom + "\",\"ville\":\"Lome\",\"email\":\"" + email
                + "\",\"motDePasse\":\"secret1\",\"nomResponsable\":\"Proviseur\"}"))
        .andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString();
    return raw.split("\"token\":\"")[1].split("\"")[0];
  }
}
