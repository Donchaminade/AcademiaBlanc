package tg.academiablanc.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.List;
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
import tg.academiablanc.abonnement.HorlogeReglable;
import tg.academiablanc.domain.Etablissement;
import tg.academiablanc.domain.EvenementAbonnement;
import tg.academiablanc.domain.Forfait;
import tg.academiablanc.domain.TypeEvenementAbonnement;
import tg.academiablanc.repo.EtablissementRepository;
import tg.academiablanc.repo.EvenementAbonnementRepository;

/**
 * Tableau de bord analytique : base H2 dédiée (sans jeu de démonstration) et horloge réglable, figée pour le
 * calcul au 19 octobre 2026 12:00 UTC. Le jeu de données est construit chronologiquement par l'API des abonnements
 * (activations, essais, suspensions, expirations constatées) et par des déclarations de paiement insérées en base.
 *
 * <p>Attendus : 4 actifs, 3 en essai, 4 en attente, 2 suspendus, 2 expirés (15 au total) ; revenus août / septembre /
 * octobre ; churn 30 jours = 2 perdus sur 5 en service (40 %) : une suspension et une expiration dans la fenêtre,
 * une suspension hors fenêtre et une expiration suivie d'une activation ignorées ; inscriptions sur 14 mois.
 */
@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:analytique;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE",
    "app.seed.enabled=false",
    "app.abonnement.statut-inscription=EN_ATTENTE_PAIEMENT",
    "app.platform.super-admin-email=analytique@logiciel.tg",
    "app.platform.super-admin-password=secret-analytique",
})
@AutoConfigureMockMvc
@Import(AnalytiquePlateformeTest.HorlogeDeTest.class)
class AnalytiquePlateformeTest {
  static final Instant MAINTENANT = Instant.parse("2026-10-19T12:00:00Z");

  @TestConfiguration
  static class HorlogeDeTest {
    @Bean
    @Primary
    HorlogeReglable horlogeReglable() {
      return new HorlogeReglable(MAINTENANT);
    }
  }

  @Autowired
  private MockMvc mvc;
  @Autowired
  private ObjectMapper json;
  @Autowired
  private EtablissementRepository etablissements;
  @Autowired
  private EvenementAbonnementRepository evenements;
  @Autowired
  private HorlogeReglable horloge;

  private String proprio;

  @Test
  void cartesRevenusChurnInscriptionsEtAccesReserveAuProprietaire() throws Exception {
    // --- Établissements : inscriptions réparties sur 14 mois (fenêtre 2025-11 → 2026-10) + une sans date.
    Etablissement avant1 = etab("Avant fenetre 1", "2025-09-10T08:00:00Z");
    etab("Avant fenetre 2 (dernier instant)", "2025-10-31T23:59:59Z");
    Etablissement novembre = etab("Novembre (premier instant)", "2025-11-01T00:00:00Z");
    Etablissement decembre = etab("Decembre", "2025-12-05T10:00:00Z");
    Etablissement fevrierA = etab("Fevrier A", "2026-02-14T10:00:00Z");
    Etablissement fevrierB = etab("Fevrier B", "2026-02-20T10:00:00Z");
    Etablissement avril = etab("Avril", "2026-04-01T00:00:00Z");
    etab("Juin (dernier instant)", "2026-06-30T23:59:59Z");
    etab("Aout A", "2026-08-20T10:00:00Z");
    Etablissement aoutB = etab("Aout B", "2026-08-21T10:00:00Z");
    Etablissement aoutC = etab("Aout C", "2026-08-22T10:00:00Z");
    Etablissement octobreA = etab("Octobre A", "2026-10-19T11:00:00Z");
    Etablissement octobreB = etab("Octobre apres l'horloge, meme mois", "2026-10-25T09:00:00Z");
    Etablissement sansDate = etab("Sans date (avant V12)", null);

    // Compte d'établissement créé par l'API (en attente de paiement) : date d'inscription ramenée dans le mois courant.
    horloge.regler(Instant.parse("2026-10-02T06:00:00Z"));
    String ecole = token(mvc.perform(post("/api/auth/signup")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"nom":"Lycee Analytique","ville":"Kara","email":"ecole-analytique@ecole.tg","motDePasse":"secret1","nomResponsable":"Proviseur","acceptationConditions":true}
                """))
        .andExpect(status().isCreated())
        .andReturn().getResponse().getContentAsString());
    Etablissement inscrit = etablissements.findByEmailIgnoreCase("ecole-analytique@ecole.tg").orElseThrow();
    inscrit.setCreeLe(Instant.parse("2026-10-02T06:00:00Z"));
    etablissements.save(inscrit);

    proprio = token(mvc.perform(post("/api/auth/login-plateforme")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"analytique@logiciel.tg\",\"motDePasse\":\"secret-analytique\"}"))
        .andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString());

    // --- Historique d'abonnement, dans l'ordre chronologique (horloge réglée avant chaque action).
    activer("2026-08-05T09:00:00Z", novembre, Forfait.MENSUEL, 15000);          // expire le 8 sept. (fin 5 sept. + 3 j de grâce)
    declarer("2026-08-12T09:00:00Z", decembre, 15000, "TRAITEE");
    activer("2026-08-20T09:00:00Z", fevrierA, Forfait.MENSUEL, 15000);
    activer("2026-08-25T09:00:00Z", aoutC, Forfait.ANNUEL, 150000);
    activer("2026-09-01T09:00:00Z", aoutB, Forfait.ANNUEL, 150000);
    declarer("2026-09-03T09:00:00Z", decembre, 15000, "A_VERIFIER");
    activer("2026-09-05T09:00:00Z", avant1, Forfait.ANNUEL, 150000);
    suspendre("2026-09-10T09:00:00Z", aoutC);                                   // suspension HORS fenêtre (avant le 19 sept. 12:00)
    essai("2026-09-10T10:00:00Z", octobreA);                                    // essai jusqu'au 24 sept.
    essai("2026-09-12T10:00:00Z", octobreB);                                    // essai jusqu'au 26 sept.
    declarer("2026-09-14T09:00:00Z", avant1, 150000, "TRAITEE");
    activer("2026-09-15T09:00:00Z", fevrierA, Forfait.MENSUEL, 15000);          // PROLONGATION : fin 20 oct., échéance 23 oct.
    constater("2026-09-25T09:00:00Z", octobreA);                                // EXPIRATION constatée dans la fenêtre
    constater("2026-09-28T09:00:00Z", octobreB);                                // EXPIRATION… puis activation : pas un churn
    activer("2026-10-01T09:00:00Z", octobreB, Forfait.MENSUEL, 15000);
    activer("2026-10-02T09:00:00Z", decembre, Forfait.MENSUEL, 15000);
    declarer("2026-10-02T10:00:00Z", decembre, 15000, "TRAITEE");
    suspendre("2026-10-05T09:00:00Z", aoutB);                                   // suspension DANS la fenêtre
    essai("2026-10-10T09:00:00Z", fevrierB);
    declarer("2026-10-10T10:00:00Z", fevrierB, 15000, "A_VERIFIER");
    essai("2026-10-15T09:00:00Z", avril);
    essai("2026-10-18T09:00:00Z", sansDate);
    declarer("2026-10-19T11:30:00Z", avril, 150000, "A_VERIFIER");
    declarer("2026-03-15T09:00:00Z", avant1, 999999, "TRAITEE");                // hors des 6 mois : ignorée
    horloge.regler(MAINTENANT);

    // --- Accès : sans jeton, compte d'établissement et gestionnaire de la plateforme refusés.
    mvc.perform(get("/api/plateforme/analytique")).andExpect(status().isForbidden());
    mvc.perform(get("/api/plateforme/analytique").header("Authorization", "Bearer " + ecole))
        .andExpect(status().isForbidden());
    mvc.perform(post("/api/plateforme/gestionnaires").header("Authorization", "Bearer " + proprio)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"nom\":\"Gestionnaire\",\"email\":\"gest-analytique@logiciel.tg\",\"motDePasse\":\"temp123\","
                + "\"permissions\":[\"ETABLISSEMENTS:VOIR\",\"ETABLISSEMENTS:DETAILS\"]}"))
        .andExpect(status().isCreated());
    String gestionnaire = token(mvc.perform(post("/api/auth/login-plateforme")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"gest-analytique@logiciel.tg\",\"motDePasse\":\"temp123\"}"))
        .andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString());
    mvc.perform(get("/api/plateforme/analytique").header("Authorization", "Bearer " + gestionnaire))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.message").value(AnalytiquePlateformeController.MESSAGE_RESERVE));

    // --- Vue du propriétaire.
    JsonNode vue = json.readTree(mvc.perform(get("/api/plateforme/analytique").header("Authorization", "Bearer " + proprio))
        .andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString());

    assertEquals("2026-10-19T12:00:00Z", vue.get("calculeLe").asText());
    assertEquals("FCFA", vue.get("devise").asText());

    JsonNode cartes = vue.get("cartes");
    assertEquals(4, cartes.get("actifs").asLong(), "actifs : avant1 (annuel), decembre, fevrierA (prolongé), octobreB (réactivé)");
    assertEquals(3, cartes.get("essai").asLong(), "essai : fevrierB, avril, sansDate");
    assertEquals(4, cartes.get("enAttentePaiement").asLong(), "attente : avant2, juin, aoutA, inscrit par l'API");
    assertEquals(2, cartes.get("suspendus").asLong(), "suspendus : aoutB, aoutC");
    assertEquals(2, cartes.get("expires").asLong(), "expirés : octobreA, novembre (constaté au calcul)");
    assertEquals(15, cartes.get("total").asLong());

    JsonNode revenus = vue.get("revenus");
    assertEquals(6, revenus.size());
    assertRevenus(revenus.get(0), "2026-05", 0, 0, 0, 0);
    assertRevenus(revenus.get(1), "2026-06", 0, 0, 0, 0);
    assertRevenus(revenus.get(2), "2026-07", 0, 0, 0, 0);
    assertRevenus(revenus.get(3), "2026-08", 15000, 1, 180000, 3);
    assertRevenus(revenus.get(4), "2026-09", 165000, 2, 315000, 3);
    assertRevenus(revenus.get(5), "2026-10", 180000, 3, 30000, 2);
    assertTrue(vue.get("definitionRevenus").asText().contains("Déclarés"));

    JsonNode churn = vue.get("churn");
    assertEquals("2026-09-19T12:00:00Z", churn.get("debutFenetre").asText());
    assertEquals("2026-10-19T12:00:00Z", churn.get("finFenetre").asText());
    assertEquals(5, churn.get("enServiceIlYA30Jours").asLong(), "avant1, fevrierA, aoutB, octobreA, octobreB");
    assertEquals(2, churn.get("perdus").asLong());
    assertEquals(40.0, churn.get("taux").asDouble(), 0.0001);
    assertTrue(churn.get("definition").asText().startsWith("Churn 30 jours"));
    JsonNode perdus = churn.get("etablissements");
    assertEquals(2, perdus.size());
    assertEquals("Aout B", perdus.get(0).get("nom").asText());
    assertEquals("SUSPENDU", perdus.get(0).get("statut").asText());
    assertEquals("Suspendu", perdus.get(0).get("statutLibelle").asText());
    assertEquals("2026-10-05T09:00:00Z", perdus.get(0).get("date").asText());
    assertEquals("Octobre A", perdus.get(1).get("nom").asText());
    assertEquals("EXPIRE", perdus.get(1).get("statut").asText());
    assertEquals("2026-09-25T09:00:00Z", perdus.get(1).get("date").asText());

    assertEquals(1, vue.get("sansDateInscription").asLong());
    JsonNode serie = vue.get("inscriptions");
    assertEquals(12, serie.size());
    List<String> moisAttendus = List.of("2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04",
        "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10");
    long[] inscriptionsAttendues = {1, 1, 0, 2, 0, 1, 0, 1, 0, 3, 0, 3};
    // Cumul initial : 2 établissements avant la fenêtre + 1 sans date.
    long[] cumulsAttendus = {4, 5, 5, 7, 7, 8, 8, 9, 9, 12, 12, 15};
    for (int i = 0; i < 12; i++) {
      JsonNode point = serie.get(i);
      assertEquals(moisAttendus.get(i), point.get("mois").asText(), "mois n°" + i);
      assertEquals(inscriptionsAttendues[i], point.get("inscriptions").asLong(), "inscriptions " + moisAttendus.get(i));
      assertEquals(cumulsAttendus[i], point.get("cumul").asLong(), "cumul " + moisAttendus.get(i));
    }

    // Un second calcul est idempotent (l'expiration de « novembre » n'est journalisée qu'une fois).
    JsonNode bis = json.readTree(mvc.perform(get("/api/plateforme/analytique").header("Authorization", "Bearer " + proprio))
        .andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString());
    assertEquals(2, bis.get("cartes").get("expires").asLong());
    assertEquals(2, bis.get("churn").get("perdus").asLong());
    assertEquals(1, evenements.findByEtablissementIdOrderByCreeLeDescIdDesc(novembre.getId()).stream()
        .filter(ev -> ev.getType() == TypeEvenementAbonnement.EXPIRATION).count());
  }

  @Test
  void sansAucunEvenementLeChurnEstSansBaseEtLesRevenusNuls() throws Exception {
    // Base partagée par la classe : ce test ne dépend que de l'absence de taux quand la base est nulle,
    // vérifiée directement sur le service avec une fenêtre très ancienne.
    horloge.regler(Instant.parse("2020-01-15T00:00:00Z"));
    JsonNode vue = json.readTree(mvc.perform(get("/api/plateforme/analytique")
            .header("Authorization", "Bearer " + token(mvc.perform(post("/api/auth/login-plateforme")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"analytique@logiciel.tg\",\"motDePasse\":\"secret-analytique\"}"))
                .andReturn().getResponse().getContentAsString())))
        .andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString());
    assertNull(vue.get("churn").get("taux").numberValue(), "aucune base : taux null, jamais 0 %");
    assertEquals(0, vue.get("churn").get("enServiceIlYA30Jours").asLong());
    assertEquals(0, vue.get("churn").get("etablissements").size());
    for (JsonNode mois : vue.get("revenus")) {
      assertEquals(0, mois.get("declares").asLong());
      assertEquals(0, mois.get("confirmes").asLong());
    }
    for (JsonNode point : vue.get("inscriptions")) {
      assertEquals(0, point.get("inscriptions").asLong());
    }
    horloge.regler(MAINTENANT);
  }

  /* ------------------------------------------------------------------ */

  private void activer(String quand, Etablissement e, Forfait forfait, long montant) throws Exception {
    horloge.regler(Instant.parse(quand));
    mvc.perform(post("/api/plateforme/abonnements/" + e.getId() + "/activer").header("Authorization", "Bearer " + proprio)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"forfait\":\"" + forfait + "\",\"montant\":" + montant + ",\"reference\":\"REF-" + e.getId() + "\",\"operateurMobile\":\"Flooz\"}"))
        .andExpect(status().isOk());
  }

  private void essai(String quand, Etablissement e) throws Exception {
    horloge.regler(Instant.parse(quand));
    mvc.perform(post("/api/plateforme/abonnements/" + e.getId() + "/essai").header("Authorization", "Bearer " + proprio))
        .andExpect(status().isOk());
  }

  private void suspendre(String quand, Etablissement e) throws Exception {
    horloge.regler(Instant.parse(quand));
    mvc.perform(post("/api/plateforme/abonnements/" + e.getId() + "/suspendre").header("Authorization", "Bearer " + proprio)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"note\":\"Impayé\"}"))
        .andExpect(status().isOk());
  }

  /** Lecture du statut par le portail : constate (et journalise) l'expiration à cette date. */
  private void constater(String quand, Etablissement e) throws Exception {
    horloge.regler(Instant.parse(quand));
    mvc.perform(get("/api/plateforme/abonnements/" + e.getId()).header("Authorization", "Bearer " + proprio))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.statut").value("EXPIRE"));
  }

  private void declarer(String quand, Etablissement e, long montant, String statut) {
    EvenementAbonnement ev = new EvenementAbonnement();
    ev.setEtablissementId(e.getId());
    ev.setType(TypeEvenementAbonnement.DECLARATION_PAIEMENT);
    ev.setForfait(montant >= 100000 ? Forfait.ANNUEL : Forfait.MENSUEL);
    ev.setMontant(montant);
    ev.setReference("DECL-" + e.getId() + "-" + quand.substring(0, 10));
    ev.setOperateurMobile("T-Money");
    ev.setActeur(e.getEmail());
    ev.setStatut(statut);
    ev.setDatePaiement(Instant.parse(quand));
    ev.setCreeLe(Instant.parse(quand));
    evenements.save(ev);
  }

  private Etablissement etab(String nom, String creeLe) {
    Etablissement e = new Etablissement();
    e.setNom(nom);
    e.setCode("ANA-" + Math.abs(nom.hashCode()));
    e.setVille("Lome");
    e.setEmail(nom.toLowerCase().replaceAll("[^a-z0-9]+", "-") + "@analytique.tg");
    e.setNomResponsable("Responsable");
    e.setActif(true);
    e.setCreeLe(creeLe == null ? null : Instant.parse(creeLe));
    return etablissements.save(e);
  }

  private static String token(String raw) throws Exception {
    return new ObjectMapper().readTree(raw).get("token").asText();
  }

  private static void assertRevenus(JsonNode mois, String libelle, long declares, long nbDeclarations, long confirmes, long nbConfirmations) {
    assertEquals(libelle, mois.get("mois").asText());
    assertEquals(declares, mois.get("declares").asLong(), "déclarés " + libelle);
    assertEquals(nbDeclarations, mois.get("nbDeclarations").asLong(), "nb déclarations " + libelle);
    assertEquals(confirmes, mois.get("confirmes").asLong(), "confirmés " + libelle);
    assertEquals(nbConfirmations, mois.get("nbConfirmations").asLong(), "nb confirmations " + libelle);
  }
}
