package tg.academiablanc.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tg.academiablanc.abonnement.AbonnementService;
import tg.academiablanc.abonnement.HorlogeReglable;
import tg.academiablanc.abonnement.VerrouAbonnementFilter;

/**
 * Parcours complet des abonnements avec une horloge injectée : inscription en attente de paiement (écriture 423,
 * lecture OK), déclaration de paiement visible côté plateforme, activation mensuelle le 19 → échéance le 22 du mois
 * suivant, écritures OK, expiration simulée (423 + lecture seule), réactivation / prolongation, essai de 14 jours,
 * suspension, super admin jamais bloqué, isolation entre établissements, offre publique et paramètres.
 */
@SpringBootTest(properties = {
    "app.abonnement.statut-inscription=EN_ATTENTE_PAIEMENT",
    "app.platform.super-admin-email=proprio-abo@logiciel.tg",
    "app.platform.super-admin-password=secret-abo",
    "spring.datasource.url=jdbc:h2:mem:academiablanc-abonnements;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE"
})
@AutoConfigureMockMvc
@Import(AbonnementFlowTest.HorlogeDeTest.class)
class AbonnementFlowTest {
  static final Instant LE_19_OCTOBRE = Instant.parse("2026-10-19T10:00:00Z");

  @TestConfiguration
  static class HorlogeDeTest {
    @Bean
    @Primary
    HorlogeReglable horlogeReglable() {
      return new HorlogeReglable(LE_19_OCTOBRE);
    }
  }

  @Autowired
  private MockMvc mvc;
  @Autowired
  private ObjectMapper json;
  @Autowired
  private HorlogeReglable horloge;

  @BeforeEach
  void le19Octobre() {
    horloge.regler(LE_19_OCTOBRE);
  }

  @Test
  void inscriptionAttenteDeclarationActivationExpirationEtProlongation() throws Exception {
    JsonNode inscription = corps(mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
            .content("{\"nom\":\"Lycee Abonne\",\"ville\":\"Lome\",\"email\":\"abonne@ecole.tg\",\"motDePasse\":\"secret1\",\"acceptationConditions\":true,"
                + "\"nomResponsable\":\"Proviseur\",\"forfait\":\"MENSUEL\"}"))
        .andExpect(status().isCreated()).andExpect(jsonPath("$.role").value("OWNER")));
    String token = inscription.get("token").asText();
    long etabId = inscription.get("etablissementId").asLong();

    // En attente de paiement : connexion possible, lecture OK, écriture métier refusée en 423.
    JsonNode statut = corps(envoyer(token, get("/api/abonnement/statut")).andExpect(status().isOk()));
    assertEquals("EN_ATTENTE_PAIEMENT", statut.get("statut").asText());
    assertFalse(statut.get("acces").asBoolean());
    assertTrue(statut.get("lectureSeule").asBoolean());
    assertEquals("MENSUEL", statut.get("forfaitChoisi").asText());
    envoyer(token, get("/api/annees-scolaires")).andExpect(status().isOk());
    envoyer(token, post("/api/centres"), "{\"nom\":\"Centre Lome\",\"code\":\"C01\",\"ville\":\"Lome\"}")
        .andExpect(status().isLocked())
        .andExpect(jsonPath("$.code").value(VerrouAbonnementFilter.CODE))
        .andExpect(jsonPath("$.statut").value("EN_ATTENTE_PAIEMENT"))
        .andExpect(jsonPath("$.message").value(AbonnementService.MESSAGE_VERROUILLE_ATTENTE));
    // Le changement de mot de passe et la déclaration de paiement restent possibles.
    envoyer(token, put("/api/auth/mot-de-passe"), "{\"ancienMotDePasse\":\"secret1\",\"nouveauMotDePasse\":\"secret2\"}")
        .andExpect(status().isNoContent());
    JsonNode declaration = corps(envoyer(token, post("/api/abonnement/declarations"),
        "{\"montant\":15000,\"reference\":\"TM-2026-001\",\"operateur\":\"T-Money\",\"note\":\"Paiement du 19/10\"}")
        .andExpect(status().isCreated()));
    assertEquals("DECLARATION_PAIEMENT", declaration.get("type").asText());
    assertEquals("A_VERIFIER", declaration.get("statut").asText());
    assertEquals("abonne@ecole.tg", declaration.get("acteur").asText());
    long declarationId = declaration.get("id").asLong();
    envoyer(token, post("/api/abonnement/declarations"), "{\"montant\":15000,\"operateur\":\"Carte bleue\"}")
        .andExpect(status().isBadRequest());

    // Côté plateforme : la déclaration apparaît « À vérifier » dans l'onglet Paiements et sur la ligne de l'établissement.
    String admin = connexionPlateforme();
    JsonNode paiements = corps(envoyer(admin, get("/api/plateforme/abonnements/paiements")).andExpect(status().isOk()));
    assertTrue(paiements.get("declarationsAVerifier").asLong() >= 1);
    JsonNode ligneDeclaration = trouver(paiements.get("evenements"), "id", declarationId);
    assertEquals("Lycee Abonne", ligneDeclaration.get("etablissementNom").asText());
    assertEquals("A_VERIFIER", ligneDeclaration.get("statut").asText());
    JsonNode ligneEtab = trouver(corps(envoyer(admin, get("/api/plateforme/abonnements")).andExpect(status().isOk())), "id", etabId);
    assertEquals("EN_ATTENTE_PAIEMENT", ligneEtab.get("statut").asText());
    assertEquals(1, ligneEtab.get("declarationsAVerifier").asLong());
    assertEquals("abonne@ecole.tg", ligneEtab.get("email").asText());

    // Activation mensuelle le 19 octobre : fin le 19 novembre, échéance d'accès le 22 (3 jours de grâce), 34 jours restants.
    JsonNode active = corps(envoyer(admin, post("/api/plateforme/abonnements/" + etabId + "/activer"),
        "{\"forfait\":\"MENSUEL\",\"montant\":15000,\"reference\":\"TM-2026-001\",\"operateurMobile\":\"T-Money\",\"declarationId\":" + declarationId + "}")
        .andExpect(status().isOk()));
    assertEquals("ACTIF", active.get("statut").asText());
    assertEquals("MENSUEL", active.get("forfait").asText());
    assertEquals("2026-10-19T10:00:00Z", active.get("debut").asText());
    assertEquals("2026-11-19T10:00:00Z", active.get("fin").asText());
    assertEquals("2026-11-22T10:00:00Z", active.get("echeance").asText());
    assertEquals(34, active.get("joursRestants").asLong());
    assertTrue(active.get("acces").asBoolean());
    assertFalse(active.get("lectureSeule").asBoolean());
    assertEquals(0, active.get("declarationsAVerifier").asLong());

    JsonNode historique = corps(envoyer(admin, get("/api/plateforme/abonnements/" + etabId + "/historique")).andExpect(status().isOk()));
    assertEquals("TRAITEE", trouver(historique, "id", declarationId).get("statut").asText());
    JsonNode activation = trouver(historique, "type", "ACTIVATION");
    assertEquals("proprio-abo@logiciel.tg", activation.get("acteur").asText());
    assertEquals(15000, activation.get("montant").asLong());

    // Les écritures passent, le statut côté établissement suit.
    envoyer(token, post("/api/centres"), "{\"nom\":\"Centre Lome\",\"code\":\"C01\",\"ville\":\"Lome\"}").andExpect(status().isOk());
    statut = corps(envoyer(token, get("/api/abonnement/statut")));
    assertEquals("ACTIF", statut.get("statut").asText());
    assertFalse(statut.get("enGrace").asBoolean());

    // Le 20 novembre : période finie, grâce en cours → toujours actif, enGrace, 2 jours restants.
    horloge.regler(Instant.parse("2026-11-20T08:00:00Z"));
    statut = corps(envoyer(token, get("/api/abonnement/statut")));
    assertEquals("ACTIF", statut.get("statut").asText());
    assertTrue(statut.get("enGrace").asBoolean());
    assertEquals(2, statut.get("joursRestants").asLong());
    envoyer(token, post("/api/centres"), "{\"nom\":\"Centre Kara\",\"code\":\"C02\",\"ville\":\"Kara\"}").andExpect(status().isOk());

    // Le 23 novembre : expiré → lecture seule, 423 sur les écritures, lecture OK, événement EXPIRATION journalisé.
    horloge.regler(Instant.parse("2026-11-23T08:00:00Z"));
    statut = corps(envoyer(token, get("/api/abonnement/statut")));
    assertEquals("EXPIRE", statut.get("statut").asText());
    assertTrue(statut.get("lectureSeule").asBoolean());
    assertTrue(statut.get("acces").asBoolean());
    assertEquals(-1, statut.get("joursRestants").asLong());
    envoyer(token, post("/api/centres"), "{\"nom\":\"Centre Sokode\",\"code\":\"C03\",\"ville\":\"Sokode\"}")
        .andExpect(status().isLocked())
        .andExpect(jsonPath("$.statut").value("EXPIRE"))
        .andExpect(jsonPath("$.message").value(AbonnementService.MESSAGE_VERROUILLE_EXPIRE));
    envoyer(token, get("/api/centres")).andExpect(status().isOk());
    trouver(corps(envoyer(token, get("/api/abonnement/historique"))), "type", "EXPIRATION");

    // Réactivation après expiration : la nouvelle période repart de la date d'activation (ACTIVATION, pas PROLONGATION).
    JsonNode annuel = corps(envoyer(admin, post("/api/plateforme/abonnements/" + etabId + "/activer"),
        "{\"forfait\":\"ANNUEL\",\"montant\":150000,\"reference\":\"FL-77\",\"operateurMobile\":\"Flooz\"}").andExpect(status().isOk()));
    assertEquals("ACTIF", annuel.get("statut").asText());
    assertEquals("2026-11-23T08:00:00Z", annuel.get("debut").asText());
    assertEquals("2027-11-23T08:00:00Z", annuel.get("fin").asText());
    assertEquals("2027-11-26T08:00:00Z", annuel.get("echeance").asText());
    envoyer(token, post("/api/centres"), "{\"nom\":\"Centre Sokode\",\"code\":\"C03\",\"ville\":\"Sokode\"}").andExpect(status().isOk());

    // Activation pendant un abonnement actif : prolongation depuis la fin courante, aucun jour perdu.
    horloge.regler(Instant.parse("2027-06-01T12:00:00Z"));
    JsonNode prolonge = corps(envoyer(admin, post("/api/plateforme/abonnements/" + etabId + "/activer"),
        "{\"forfait\":\"MENSUEL\",\"debut\":\"2027-06-01\"}").andExpect(status().isOk()));
    assertEquals("2026-11-23T08:00:00Z", prolonge.get("debut").asText());
    assertEquals("2027-12-23T08:00:00Z", prolonge.get("fin").asText());
    assertEquals("2027-12-26T08:00:00Z", prolonge.get("echeance").asText());
    assertEquals("MENSUEL", prolonge.get("forfait").asText());
    historique = corps(envoyer(admin, get("/api/plateforme/abonnements/" + etabId + "/historique")));
    JsonNode prolongation = trouver(historique, "type", "PROLONGATION");
    assertEquals("2027-11-23T08:00:00Z", prolongation.get("periodeDebut").asText());
    // Sans montant précisé, le montant retenu est le tarif du forfait (0 tant que non saisi).
    assertEquals(0, prolongation.get("montant").asLong());
  }

  @Test
  void essaiDeQuatorzeJoursPuisExpiration() throws Exception {
    JsonNode inscription = corps(mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
        .content("{\"nom\":\"College Essai\",\"ville\":\"Kara\",\"email\":\"essai@ecole.tg\",\"motDePasse\":\"secret1\",\"acceptationConditions\":true,\"nomResponsable\":\"Directeur\"}")));
    String token = inscription.get("token").asText();
    long etabId = inscription.get("etablissementId").asLong();
    // Sans forfait précisé, l'annuel (recommandé) est retenu.
    assertEquals("ANNUEL", corps(envoyer(token, get("/api/abonnement/statut"))).get("forfaitChoisi").asText());

    String admin = connexionPlateforme();
    JsonNode essai = corps(envoyer(admin, post("/api/plateforme/abonnements/" + etabId + "/essai"), "{\"note\":\"Essai accordé au téléphone\"}")
        .andExpect(status().isOk()));
    assertEquals("ESSAI", essai.get("statut").asText());
    assertEquals("2026-11-02T10:00:00Z", essai.get("fin").asText());
    assertEquals("2026-11-02T10:00:00Z", essai.get("echeance").asText());
    assertEquals("2026-11-02T10:00:00Z", essai.get("essaiJusquAu").asText());
    assertEquals(14, essai.get("joursRestants").asLong());
    assertTrue(essai.get("acces").asBoolean());

    JsonNode statut = corps(envoyer(token, get("/api/abonnement/statut")));
    assertTrue(statut.get("essai").asBoolean());
    assertFalse(statut.get("lectureSeule").asBoolean());
    envoyer(token, post("/api/centres"), "{\"nom\":\"Centre Kara\",\"code\":\"K01\",\"ville\":\"Kara\"}").andExpect(status().isOk());

    horloge.regler(LE_19_OCTOBRE.plus(Duration.ofDays(12)));
    assertEquals(2, corps(envoyer(token, get("/api/abonnement/statut"))).get("joursRestants").asLong());

    horloge.regler(LE_19_OCTOBRE.plus(Duration.ofDays(15)));
    statut = corps(envoyer(token, get("/api/abonnement/statut")));
    assertEquals("EXPIRE", statut.get("statut").asText());
    assertTrue(statut.get("lectureSeule").asBoolean());
    envoyer(token, post("/api/centres"), "{\"nom\":\"Centre Kara 2\",\"code\":\"K02\",\"ville\":\"Kara\"}").andExpect(status().isLocked());
    envoyer(token, get("/api/centres")).andExpect(status().isOk());
    // L'historique de l'établissement garde l'essai et l'expiration, avec l'acteur de chaque action.
    JsonNode historique = corps(envoyer(token, get("/api/abonnement/historique")));
    assertEquals("proprio-abo@logiciel.tg", trouver(historique, "type", "ESSAI").get("acteur").asText());
    assertEquals("système", trouver(historique, "type", "EXPIRATION").get("acteur").asText());
  }

  @Test
  void suspensionPuisReactivation() throws Exception {
    JsonNode inscription = corps(mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
        .content("{\"nom\":\"Lycee Suspendu\",\"ville\":\"Sokode\",\"email\":\"suspendu@ecole.tg\",\"motDePasse\":\"secret1\",\"acceptationConditions\":true,\"nomResponsable\":\"Proviseur\",\"forfait\":\"ANNUEL\"}")));
    String token = inscription.get("token").asText();
    long etabId = inscription.get("etablissementId").asLong();
    String admin = connexionPlateforme();
    envoyer(admin, post("/api/plateforme/abonnements/" + etabId + "/activer"), "{\"forfait\":\"ANNUEL\",\"montant\":150000}")
        .andExpect(status().isOk());
    envoyer(token, post("/api/centres"), "{\"nom\":\"Centre\",\"code\":\"S01\",\"ville\":\"Sokode\"}").andExpect(status().isOk());

    JsonNode suspendu = corps(envoyer(admin, post("/api/plateforme/abonnements/" + etabId + "/suspendre"), "{\"note\":\"Impayé signalé\"}")
        .andExpect(status().isOk()));
    assertEquals("SUSPENDU", suspendu.get("statut").asText());
    assertTrue(suspendu.get("lectureSeule").asBoolean());
    envoyer(token, post("/api/centres"), "{\"nom\":\"Centre 2\",\"code\":\"S02\",\"ville\":\"Sokode\"}")
        .andExpect(status().isLocked())
        .andExpect(jsonPath("$.message").value(AbonnementService.MESSAGE_VERROUILLE_SUSPENDU));
    envoyer(token, get("/api/centres")).andExpect(status().isOk());
    envoyer(admin, post("/api/plateforme/abonnements/" + etabId + "/suspendre")).andExpect(status().isConflict());

    JsonNode reactive = corps(envoyer(admin, post("/api/plateforme/abonnements/" + etabId + "/reactiver")).andExpect(status().isOk()));
    assertEquals("ACTIF", reactive.get("statut").asText());
    assertEquals("2027-10-22T10:00:00Z", reactive.get("echeance").asText());
    envoyer(token, post("/api/centres"), "{\"nom\":\"Centre 2\",\"code\":\"S02\",\"ville\":\"Sokode\"}").andExpect(status().isOk());
  }

  @Test
  void leSuperAdminNEstJamaisBloqueEtLesEndpointsPlateformeSontReserves() throws Exception {
    String admin = connexionPlateforme();
    JsonNode statut = corps(envoyer(admin, get("/api/abonnement/statut")).andExpect(status().isOk()));
    assertTrue(statut.get("plateforme").asBoolean());
    assertTrue(statut.get("acces").asBoolean());
    assertFalse(statut.get("lectureSeule").asBoolean());
    // Écriture de plateforme : jamais 423.
    envoyer(admin, post("/api/plateforme/etablissements"),
        "{\"nom\":\"Lycee Cree Par Plateforme\",\"ville\":\"Lome\",\"email\":\"cree-plateforme@ecole.tg\",\"motDePasse\":\"secret1\",\"acceptationConditions\":true,\"nomResponsable\":\"Proviseur\"}")
        .andExpect(status().isCreated());
    // Un établissement créé par la plateforme démarre directement en essai.
    JsonNode ligne = trouver(corps(envoyer(admin, get("/api/plateforme/abonnements"))), "nom", "Lycee Cree Par Plateforme");
    assertEquals("ESSAI", ligne.get("statut").asText());

    // Un compte d'établissement n'atteint jamais les adresses de la plateforme.
    String owner = corps(mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
        .content("{\"nom\":\"Lycee Curieux\",\"ville\":\"Lome\",\"email\":\"curieux@ecole.tg\",\"motDePasse\":\"secret1\",\"acceptationConditions\":true,\"nomResponsable\":\"Proviseur\"}")))
        .get("token").asText();
    envoyer(owner, get("/api/plateforme/abonnements")).andExpect(status().isForbidden());
    envoyer(owner, get("/api/plateforme/abonnements/parametres")).andExpect(status().isForbidden());
    envoyer(owner, put("/api/plateforme/abonnements/parametres"), "{\"tarifMensuel\":1,\"tarifAnnuel\":1,\"dureeEssaiJours\":14,\"joursGrace\":3}")
        .andExpect(status().isForbidden());
  }

  @Test
  void unEtablissementNeLitPasLAbonnementDUnAutre() throws Exception {
    JsonNode a = corps(mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
        .content("{\"nom\":\"Lycee Isole A\",\"ville\":\"Lome\",\"email\":\"isole-a@ecole.tg\",\"motDePasse\":\"secret1\",\"acceptationConditions\":true,\"nomResponsable\":\"A\"}")));
    JsonNode b = corps(mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
        .content("{\"nom\":\"Lycee Isole B\",\"ville\":\"Lome\",\"email\":\"isole-b@ecole.tg\",\"motDePasse\":\"secret1\",\"acceptationConditions\":true,\"nomResponsable\":\"B\"}")));
    String admin = connexionPlateforme();
    envoyer(admin, post("/api/plateforme/abonnements/" + a.get("etablissementId").asLong() + "/activer"), "{\"forfait\":\"MENSUEL\",\"montant\":15000}")
        .andExpect(status().isOk());
    envoyer(b.get("token").asText(), post("/api/abonnement/declarations"), "{\"montant\":9000,\"operateur\":\"Wave\",\"reference\":\"W-1\"}")
        .andExpect(status().isCreated());

    // A est actif, B reste en attente : le verrou de B ne touche pas A et réciproquement.
    assertEquals("ACTIF", corps(envoyer(a.get("token").asText(), get("/api/abonnement/statut"))).get("statut").asText());
    assertEquals("EN_ATTENTE_PAIEMENT", corps(envoyer(b.get("token").asText(), get("/api/abonnement/statut"))).get("statut").asText());
    envoyer(a.get("token").asText(), post("/api/centres"), "{\"nom\":\"Centre A\",\"code\":\"A01\",\"ville\":\"Lome\"}").andExpect(status().isOk());
    envoyer(b.get("token").asText(), post("/api/centres"), "{\"nom\":\"Centre B\",\"code\":\"B01\",\"ville\":\"Lome\"}").andExpect(status().isLocked());

    // L'historique de A ne contient que ses événements (jamais la déclaration de B).
    JsonNode historiqueA = corps(envoyer(a.get("token").asText(), get("/api/abonnement/historique")));
    for (JsonNode ev : historiqueA) {
      assertEquals(a.get("etablissementId").asLong(), ev.get("etablissementId").asLong());
    }
    JsonNode historiqueB = corps(envoyer(b.get("token").asText(), get("/api/abonnement/historique")));
    assertEquals(1, historiqueB.size());
    assertEquals("DECLARATION_PAIEMENT", historiqueB.get(0).get("type").asText());
    // Et l'historique d'un autre établissement n'est pas atteignable depuis un compte d'établissement.
    envoyer(a.get("token").asText(), get("/api/plateforme/abonnements/" + b.get("etablissementId").asLong() + "/historique"))
        .andExpect(status().isForbidden());
  }

  @Test
  void offrePubliqueEtParametresCommerciaux() throws Exception {
    String admin = connexionPlateforme();
    // Remise à zéro : les tests partagent la base H2 de cette classe.
    envoyer(admin, put("/api/plateforme/abonnements/parametres"),
        "{\"tarifMensuel\":0,\"tarifAnnuel\":0,\"telWhatsapp\":\"\",\"telAppel\":\"\",\"beneficiaire\":\"\",\"instructions\":\"\",\"dureeEssaiJours\":14,\"joursGrace\":3}")
        .andExpect(status().isOk());
    mvc.perform(get("/api/public/offre"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.tarifMensuel").value(0))
        .andExpect(jsonPath("$.tarifAnnuel").value(0))
        .andExpect(jsonPath("$.devise").value("FCFA"))
        .andExpect(jsonPath("$.dureeEssaiJours").value(14))
        .andExpect(jsonPath("$.joursGrace").doesNotExist());

    envoyer(admin, put("/api/plateforme/abonnements/parametres"),
        "{\"tarifMensuel\":15000,\"tarifAnnuel\":150000,\"telWhatsapp\":\"+228 90 00 00 00\",\"telAppel\":\"+228 70 00 00 00\","
            + "\"beneficiaire\":\"AcademiaBlanc SARL\",\"instructions\":\"Flooz ou T-Money au numéro indiqué.\",\"dureeEssaiJours\":14,\"joursGrace\":3}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.tarifMensuel").value(15000))
        .andExpect(jsonPath("$.joursGrace").value(3));
    mvc.perform(get("/api/public/offre"))
        .andExpect(jsonPath("$.tarifAnnuel").value(150000))
        .andExpect(jsonPath("$.telWhatsapp").value("+228 90 00 00 00"))
        .andExpect(jsonPath("$.beneficiaire").value("AcademiaBlanc SARL"));
    // Le statut d'un établissement reprend les contacts et tarifs.
    JsonNode inscription = corps(mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
        .content("{\"nom\":\"Lycee Offre\",\"ville\":\"Lome\",\"email\":\"offre@ecole.tg\",\"motDePasse\":\"secret1\",\"acceptationConditions\":true,\"nomResponsable\":\"P\",\"forfait\":\"ANNUEL\"}")));
    JsonNode statut = corps(envoyer(inscription.get("token").asText(), get("/api/abonnement/statut")));
    assertEquals("+228 90 00 00 00", statut.get("contacts").get("telWhatsapp").asText());
    assertEquals(150000, statut.get("contacts").get("tarifAnnuel").asLong());

    // Tarif négatif ou grâce hors bornes : refusés.
    envoyer(admin, put("/api/plateforme/abonnements/parametres"), "{\"tarifMensuel\":-1,\"tarifAnnuel\":0,\"dureeEssaiJours\":14,\"joursGrace\":3}")
        .andExpect(status().isBadRequest());
    envoyer(admin, put("/api/plateforme/abonnements/parametres"), "{\"tarifMensuel\":0,\"tarifAnnuel\":0,\"dureeEssaiJours\":14,\"joursGrace\":99}")
        .andExpect(status().isBadRequest());

    // Un gestionnaire de plateforme consulte les paramètres mais ne les modifie pas.
    envoyer(admin, post("/api/plateforme/gestionnaires"),
        "{\"nom\":\"Gestion Abo\",\"email\":\"gestion-abo@logiciel.tg\",\"motDePasse\":\"gestion1\"}").andExpect(status().isCreated());
    String gestion = corps(mvc.perform(post("/api/auth/login-plateforme").contentType(MediaType.APPLICATION_JSON)
        .content("{\"email\":\"gestion-abo@logiciel.tg\",\"motDePasse\":\"gestion1\"}"))).get("token").asText();
    envoyer(gestion, get("/api/plateforme/abonnements/parametres")).andExpect(status().isOk());
    envoyer(gestion, get("/api/plateforme/abonnements")).andExpect(status().isOk());
    envoyer(gestion, put("/api/plateforme/abonnements/parametres"), "{\"tarifMensuel\":1,\"tarifAnnuel\":1,\"dureeEssaiJours\":14,\"joursGrace\":3}")
        .andExpect(status().isForbidden());
    // Remise à zéro pour les autres tests.
    envoyer(admin, put("/api/plateforme/abonnements/parametres"),
        "{\"tarifMensuel\":0,\"tarifAnnuel\":0,\"telWhatsapp\":\"\",\"telAppel\":\"\",\"beneficiaire\":\"\",\"instructions\":\"\",\"dureeEssaiJours\":14,\"joursGrace\":3}")
        .andExpect(status().isOk());
  }

  @Test
  void lesPaiementsDuMoisSontTotalises() throws Exception {
    horloge.regler(Instant.parse("2031-03-10T09:00:00Z"));
    JsonNode inscription = corps(mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
        .content("{\"nom\":\"Lycee Totaux\",\"ville\":\"Lome\",\"email\":\"totaux@ecole.tg\",\"motDePasse\":\"secret1\",\"acceptationConditions\":true,\"nomResponsable\":\"P\"}")));
    long etabId = inscription.get("etablissementId").asLong();
    String admin = connexionPlateforme();
    envoyer(admin, post("/api/plateforme/abonnements/" + etabId + "/activer"), "{\"forfait\":\"MENSUEL\",\"montant\":15000,\"reference\":\"A\"}")
        .andExpect(status().isOk());
    envoyer(admin, post("/api/plateforme/abonnements/" + etabId + "/activer"), "{\"forfait\":\"MENSUEL\",\"montant\":15000,\"reference\":\"B\"}")
        .andExpect(status().isOk());
    JsonNode mois = corps(envoyer(admin, get("/api/plateforme/abonnements/paiements?mois=2031-03")).andExpect(status().isOk()));
    assertEquals("2031-03", mois.get("mois").asText());
    assertEquals(30000, mois.get("totalMois").asLong());
    assertEquals(2, mois.get("nombrePaiementsMois").asLong());
    List<String> types = new ArrayList<>();
    for (JsonNode ev : mois.get("evenements")) types.add(ev.get("type").asText());
    assertTrue(types.contains("ACTIVATION") && types.contains("PROLONGATION"));
    envoyer(admin, get("/api/plateforme/abonnements/paiements?mois=mars")).andExpect(status().isBadRequest());
  }

  /* ------------------------------------------------------------------ */

  private String connexionPlateforme() throws Exception {
    return corps(mvc.perform(post("/api/auth/login-plateforme").contentType(MediaType.APPLICATION_JSON)
        .content("{\"email\":\"proprio-abo@logiciel.tg\",\"motDePasse\":\"secret-abo\"}")).andExpect(status().isOk()))
        .get("token").asText();
  }

  private ResultActions envoyer(String token, MockHttpServletRequestBuilder requete) throws Exception {
    return mvc.perform(requete.header("Authorization", "Bearer " + token));
  }

  private ResultActions envoyer(String token, MockHttpServletRequestBuilder requete, String corps) throws Exception {
    return mvc.perform(requete.header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content(corps));
  }

  private JsonNode corps(ResultActions actions) throws Exception {
    return json.readTree(actions.andReturn().getResponse().getContentAsString());
  }

  private static JsonNode trouver(JsonNode tableau, String champ, Object valeur) {
    for (JsonNode ligne : tableau) {
      JsonNode v = ligne.get(champ);
      if (v != null && v.asText().equals(String.valueOf(valeur))) return ligne;
    }
    throw new AssertionError("Aucune ligne avec " + champ + " = " + valeur + " dans " + tableau);
  }
}
