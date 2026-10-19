package tg.academiablanc.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Base64;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tg.academiablanc.repo.EtablissementRepository;

/**
 * Logo de l'établissement conservé en base : téléversé en data URL via la charte, relu par la charte et par la
 * fiche de l'établissement à chaque connexion, cloisonné par établissement, borné à 1 Mo, retiré sur demande.
 */
@SpringBootTest
@AutoConfigureMockMvc
class LogoEtablissementFlowTest {
  private static final String PNG_DATA_URL =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

  @Autowired
  private MockMvc mvc;
  @Autowired
  private EtablissementRepository etablissements;

  @Test
  void logoTeleverseEnBasePuisReluParLaCharteEtLaFicheEtCloisonne() throws Exception {
    String owner = inscrire("logo-owner@ecole.tg", "Lycee Logo");
    String autre = inscrire("logo-autre@ecole.tg", "Lycee Voisin Logo");

    // Nouveau compte : aucun logo (le client affiche les initiales), aucune date de charte.
    mvc.perform(get("/api/etablissement/charte").header("Authorization", "Bearer " + owner))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.logoUrl").isEmpty())
        .andExpect(jsonPath("$.modifieLe").isEmpty());
    mvc.perform(get("/api/etablissement").header("Authorization", "Bearer " + owner))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.logoUrl").isEmpty());

    // Logo WebP d'environ 200 Ko (ordre de grandeur après réduction par le navigateur).
    String logo = dataUrl("image/webp", 200 * 1024);
    mvc.perform(put("/api/etablissement/charte")
            .header("Authorization", "Bearer " + owner)
            .contentType(MediaType.APPLICATION_JSON)
            .content(("{\"logoUrl\":\"" + logo + "\",\"sceauUrl\":\"" + PNG_DATA_URL + "\"}")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.logoUrl").value(logo))
        .andExpect(jsonPath("$.sceauUrl").value(PNG_DATA_URL))
        .andExpect(jsonPath("$.modifieLe").isNotEmpty());

    // Relu à la connexion suivante : par la charte et par la fiche de l'établissement.
    mvc.perform(get("/api/etablissement/charte").header("Authorization", "Bearer " + owner))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.logoUrl").value(logo))
        .andExpect(jsonPath("$.modifieLe").isNotEmpty());
    mvc.perform(get("/api/etablissement").header("Authorization", "Bearer " + owner))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.logoUrl").value(logo))
        .andExpect(jsonPath("$.charteModifieeLe").isNotEmpty());

    // Stocké dans la ligne de l'établissement (pas sur le disque).
    assertThat(etablissements.findAll())
        .filteredOn(e -> "Lycee Logo".equals(e.getNom()))
        .singleElement()
        .satisfies(e -> {
          assertThat(e.getLogoUrl()).isEqualTo(logo);
          assertThat(e.getCharteModifieeLe()).isNotNull();
        });

    // Cloisonnement : l'autre établissement n'a toujours aucun logo.
    mvc.perform(get("/api/etablissement/charte").header("Authorization", "Bearer " + autre))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.logoUrl").isEmpty());
    mvc.perform(get("/api/etablissement").header("Authorization", "Bearer " + autre))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.logoUrl").isEmpty());

    // Retrait : logo vide → emplacement libre ; le cachet est conservé.
    mvc.perform(put("/api/etablissement/charte")
            .header("Authorization", "Bearer " + owner)
            .contentType(MediaType.APPLICATION_JSON)
            .content(("{\"logoUrl\":\"\",\"sceauUrl\":\"" + PNG_DATA_URL + "\"}")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.logoUrl").isEmpty())
        .andExpect(jsonPath("$.sceauUrl").value(PNG_DATA_URL));
    mvc.perform(get("/api/etablissement").header("Authorization", "Bearer " + owner))
        .andExpect(jsonPath("$.logoUrl").isEmpty());
  }

  @Test
  void logoAuDelaDUnMoRefuseEn413AvecMessageFrancais() throws Exception {
    String owner = inscrire("logo-lourd@ecole.tg", "Lycee Logo Lourd");

    // 1 Mo + 1 octet décodés : refusé, réponse JSON lisible par le client.
    mvc.perform(put("/api/etablissement/charte")
            .header("Authorization", "Bearer " + owner)
            .contentType(MediaType.APPLICATION_JSON)
            .content(("{\"logoUrl\":\"" + dataUrl("image/png", CharteService.MAX_OCTETS + 1) + "\"}")))
        .andExpect(status().isPayloadTooLarge())
        .andExpect(jsonPath("$.message").value(String.format(CharteService.MESSAGE_TROP_LOURDE, "logo")));

    // Même règle pour le cachet et les signatures.
    mvc.perform(put("/api/etablissement/charte")
            .header("Authorization", "Bearer " + owner)
            .contentType(MediaType.APPLICATION_JSON)
            .content(("{\"signatureProviseurUrl\":\"" + dataUrl("image/jpeg", CharteService.MAX_OCTETS + 1024) + "\"}")))
        .andExpect(status().isPayloadTooLarge())
        .andExpect(jsonPath("$.message").value(String.format(CharteService.MESSAGE_TROP_LOURDE, "signature du chef d'établissement")));

    // Rien n'a été enregistré.
    mvc.perform(get("/api/etablissement/charte").header("Authorization", "Bearer " + owner))
        .andExpect(jsonPath("$.logoUrl").isEmpty())
        .andExpect(jsonPath("$.signatureProviseurUrl").isEmpty())
        .andExpect(jsonPath("$.modifieLe").isEmpty());

    // Exactement 1 Mo : accepté.
    mvc.perform(put("/api/etablissement/charte")
            .header("Authorization", "Bearer " + owner)
            .contentType(MediaType.APPLICATION_JSON)
            .content(("{\"logoUrl\":\"" + dataUrl("image/png", CharteService.MAX_OCTETS) + "\"}")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.logoUrl").isNotEmpty());

    // Formats hors image refusés en 400.
    mvc.perform(put("/api/etablissement/charte")
            .header("Authorization", "Bearer " + owner)
            .contentType(MediaType.APPLICATION_JSON)
            .content(("{\"logoUrl\":\"data:application/pdf;base64,JVBERi0=\"}")))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message").value("Image invalide pour le logo : formats acceptés PNG, JPG, WebP ou SVG."));
  }

  @Test
  void octetsDecodesSuitLaTailleReelleDeLImage() {
    byte[] bytes = new byte[1_000];
    String dataUrl = "data:image/png;base64," + Base64.getEncoder().encodeToString(bytes);
    assertThat(CharteService.octetsDecodes(dataUrl)).isEqualTo(1_000);
    assertThat(CharteService.octetsDecodes("data:image/png;base64," + Base64.getEncoder().encodeToString(new byte[1_001]))).isEqualTo(1_001);
    assertThat(CharteService.octetsDecodes("data:image/png;base64," + Base64.getEncoder().encodeToString(new byte[1_002]))).isEqualTo(1_002);
    assertThat(CharteService.octetsDecodes("https://cdn.example.org/logo.png")).isZero();
  }

  /** Data URL base64 d'une image factice de {@code octets} octets. */
  private static String dataUrl(String mime, long octets) {
    return "data:" + mime + ";base64," + Base64.getEncoder().encodeToString(new byte[(int) octets]);
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
