package tg.academiablanc.api;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tg.academiablanc.abonnement.AbonnementService;
import tg.academiablanc.abonnement.ParametresCommerciauxService;
import tg.academiablanc.domain.Etablissement;
import tg.academiablanc.domain.EvenementAbonnement;
import tg.academiablanc.domain.StatutAbonnement;
import tg.academiablanc.domain.TypeEvenementAbonnement;
import tg.academiablanc.repo.EtablissementRepository;
import tg.academiablanc.repo.EvenementAbonnementRepository;

/**
 * Tableau de bord analytique du propriétaire du logiciel : agrégats calculés en UTC à partir de la table
 * {@code etablissement} (inscriptions) et de l'historique {@code evenement_abonnement} (revenus, churn, statuts).
 * Aucune valeur n'est estimée : une série vide reste vide, un taux sans base est null.
 *
 * <p>Toutes les bornes de période sont des mois civils UTC ou des fenêtres glissantes en jours ; l'horloge est
 * injectée pour les tests. Les statuts des cartes sont les statuts <em>effectifs</em> rendus par
 * {@link AbonnementService#etat(Etablissement)} : une expiration dont l'échéance est dépassée est constatée
 * (et journalisée) au passage, comme sur la page Abonnements, afin que cartes et churn restent cohérents.
 */
@Service
public class AnalytiquePlateformeService {
  /** Nombre de mois de la série d'inscriptions (mois courant inclus). */
  public static final int MOIS_INSCRIPTIONS = 12;
  /** Nombre de mois de la série des revenus (mois courant inclus) : permet « 3 derniers mois » et sa comparaison. */
  public static final int MOIS_REVENUS = 6;
  /** Largeur de la fenêtre du churn. */
  public static final Duration FENETRE_CHURN = Duration.ofDays(30);

  /** Événements qui changent le statut d'un établissement (les déclarations de paiement n'en changent pas). */
  static final Set<TypeEvenementAbonnement> TYPES_STATUT = EnumSet.of(
      TypeEvenementAbonnement.ESSAI, TypeEvenementAbonnement.ACTIVATION, TypeEvenementAbonnement.PROLONGATION,
      TypeEvenementAbonnement.SUSPENSION, TypeEvenementAbonnement.REACTIVATION, TypeEvenementAbonnement.EXPIRATION);
  /** Événements qui placent (ou replacent) l'établissement en service : essai ou abonnement en cours. */
  static final Set<TypeEvenementAbonnement> TYPES_EN_SERVICE = EnumSet.of(
      TypeEvenementAbonnement.ESSAI, TypeEvenementAbonnement.ACTIVATION, TypeEvenementAbonnement.PROLONGATION,
      TypeEvenementAbonnement.REACTIVATION);
  /** Événements qui font passer l'établissement à un statut inactif. */
  static final Set<TypeEvenementAbonnement> TYPES_INACTIFS = EnumSet.of(
      TypeEvenementAbonnement.SUSPENSION, TypeEvenementAbonnement.EXPIRATION);
  /** Montants encaissés confirmés par le propriétaire : activations et prolongations. */
  static final Set<TypeEvenementAbonnement> TYPES_CONFIRMES = EnumSet.of(
      TypeEvenementAbonnement.ACTIVATION, TypeEvenementAbonnement.PROLONGATION);
  static final Set<TypeEvenementAbonnement> TYPES_REVENUS = EnumSet.of(
      TypeEvenementAbonnement.ACTIVATION, TypeEvenementAbonnement.PROLONGATION, TypeEvenementAbonnement.DECLARATION_PAIEMENT);

  public static final String DEFINITION_CHURN =
      "Churn 30 jours = établissements en service il y a 30 jours (essai ou abonnement dont la période, grâce comprise, "
      + "courait encore d'après leur dernier événement d'abonnement) et passés depuis à Expiré ou Suspendu "
      + "(événement EXPIRATION ou SUSPENSION dans la fenêtre) sans retour en service postérieur (activation, prolongation, "
      + "réactivation ou nouvel essai), rapportés au nombre d'établissements en service il y a 30 jours. "
      + "Les expirations sont datées de leur constat par le serveur ; la fenêtre est glissante, en temps universel (UTC).";

  public static final String DEFINITION_REVENUS =
      "Déclarés = montants des déclarations de paiement enregistrées dans le mois (à vérifier ou traitées), datées de "
      + "leur saisie. Encaissés / confirmés = montants des activations et prolongations enregistrées par le propriétaire "
      + "dans le mois. Mois civils en temps universel (UTC).";

  private final EtablissementRepository etablissements;
  private final EvenementAbonnementRepository evenements;
  private final AbonnementService abonnements;
  private final ParametresCommerciauxService parametres;
  private final Clock horloge;

  public AnalytiquePlateformeService(
      EtablissementRepository etablissements,
      EvenementAbonnementRepository evenements,
      AbonnementService abonnements,
      ParametresCommerciauxService parametres,
      Clock horloge
  ) {
    this.etablissements = etablissements;
    this.evenements = evenements;
    this.abonnements = abonnements;
    this.parametres = parametres;
    this.horloge = horloge;
  }

  /* ------------------------------------------------------------------ */
  /* DTO                                                                 */
  /* ------------------------------------------------------------------ */

  /** Un mois de la série d'inscriptions : {@code mois} au format {@code AAAA-MM} (UTC). */
  public record PointInscription(String mois, long inscriptions, long cumul) {}

  /** Effectifs par statut effectif à l'instant du calcul ; {@code total} = toutes les lignes de {@code etablissement}. */
  public record Cartes(long actifs, long essai, long enAttentePaiement, long suspendus, long expires, long total) {}

  /**
   * Revenus d'un mois civil UTC. {@code declares} = déclarations de paiement (tous statuts) saisies dans le mois ;
   * {@code confirmes} = activations et prolongations enregistrées dans le mois.
   */
  public record RevenusMois(String mois, long declares, long nbDeclarations, long confirmes, long nbConfirmations) {}

  public record EtablissementChurn(Long id, String nom, Instant date, StatutAbonnement statut, String statutLibelle) {}

  /**
   * @param enServiceIlYA30Jours base du taux (essai ou abonnement en cours il y a 30 jours)
   * @param perdus établissements de cette base passés à Expiré ou Suspendu sans retour en service
   * @param taux {@code perdus / enServiceIlYA30Jours × 100} arrondi au dixième ; null sans base
   */
  public record Churn(
      Instant debutFenetre,
      Instant finFenetre,
      long enServiceIlYA30Jours,
      long perdus,
      Double taux,
      List<EtablissementChurn> etablissements,
      String definition
  ) {}

  /**
   * Vue complète du tableau de bord.
   *
   * @param calculeLe instant UTC du calcul
   * @param devise devise des montants (paramètres commerciaux, FCFA par défaut)
   * @param revenus {@value #MOIS_REVENUS} mois civils, du plus ancien au mois courant
   * @param sansDateInscription établissements dont {@code cree_le} est NULL (antérieurs à V12) : absents des barres
   *     mensuelles, comptés dans le cumul initial
   * @param inscriptions {@value #MOIS_INSCRIPTIONS} mois glissants, du plus ancien au mois courant
   */
  public record AnalytiqueVue(
      Instant calculeLe,
      String devise,
      Cartes cartes,
      List<RevenusMois> revenus,
      String definitionRevenus,
      Churn churn,
      long sansDateInscription,
      List<PointInscription> inscriptions
  ) {}

  /* ------------------------------------------------------------------ */
  /* Calcul                                                              */
  /* ------------------------------------------------------------------ */

  /**
   * Transaction en écriture : la lecture du statut effectif journalise les expirations échues
   * (idempotent, comme la liste des abonnements du portail).
   */
  @Transactional
  public AnalytiqueVue calculer() {
    Instant maintenant = horloge.instant();
    List<Etablissement> tous = etablissements.findAll();
    Map<Long, String> noms = new LinkedHashMap<>();
    for (Etablissement e : tous) noms.put(e.getId(), e.getNom());
    Cartes cartes = cartes(tous);
    int joursGrace = parametres.lire().joursGrace();
    return new AnalytiqueVue(
        maintenant,
        parametres.lire().devise(),
        cartes,
        revenus(maintenant),
        DEFINITION_REVENUS,
        churn(maintenant, joursGrace, noms),
        etablissements.countByCreeLeIsNull(),
        inscriptions(maintenant)
    );
  }

  /** Statuts effectifs (expirations échues constatées au passage) comptés par carte. */
  Cartes cartes(List<Etablissement> tous) {
    long actifs = 0;
    long essai = 0;
    long attente = 0;
    long suspendus = 0;
    long expires = 0;
    for (Etablissement e : tous) {
      StatutAbonnement statut = abonnements.etat(e).statut();
      switch (statut) {
        case ACTIF -> actifs++;
        case ESSAI -> essai++;
        case EN_ATTENTE_PAIEMENT -> attente++;
        case SUSPENDU -> suspendus++;
        case EXPIRE -> expires++;
      }
    }
    return new Cartes(actifs, essai, attente, suspendus, expires, tous.size());
  }

  /** Revenus par mois civil UTC sur les {@value #MOIS_REVENUS} derniers mois, regroupés en Java pour rester en UTC quel que soit le fuseau du serveur SQL. */
  List<RevenusMois> revenus(Instant maintenant) {
    YearMonth moisCourant = YearMonth.from(maintenant.atOffset(ZoneOffset.UTC));
    YearMonth premier = moisCourant.minusMonths(MOIS_REVENUS - 1L);
    Instant debut = debutDuMois(premier);
    Instant fin = debutDuMois(moisCourant.plusMonths(1));

    Map<YearMonth, long[]> cumuls = new LinkedHashMap<>();
    for (YearMonth m = premier; !m.isAfter(moisCourant); m = m.plusMonths(1)) cumuls.put(m, new long[4]);
    for (EvenementAbonnement ev : evenements.findByTypeInAndCreeLeGreaterThanEqualAndCreeLeLessThanOrderByCreeLeAscIdAsc(TYPES_REVENUS, debut, fin)) {
      long[] c = cumuls.get(YearMonth.from(ev.getCreeLe().atOffset(ZoneOffset.UTC)));
      if (c == null) continue;
      long montant = ev.getMontant() == null ? 0 : ev.getMontant();
      if (ev.getType() == TypeEvenementAbonnement.DECLARATION_PAIEMENT) {
        c[0] += montant;
        c[1]++;
      } else if (TYPES_CONFIRMES.contains(ev.getType())) {
        c[2] += montant;
        c[3]++;
      }
    }
    List<RevenusMois> serie = new ArrayList<>(MOIS_REVENUS);
    cumuls.forEach((m, c) -> serie.add(new RevenusMois(m.toString(), c[0], c[1], c[2], c[3])));
    return serie;
  }

  /** Voir {@link #DEFINITION_CHURN}. Reconstitué à partir de l'historique des événements de statut. */
  Churn churn(Instant maintenant, int joursGrace, Map<Long, String> noms) {
    Instant debutFenetre = maintenant.minus(FENETRE_CHURN);
    Map<Long, List<EvenementAbonnement>> parEtablissement = new LinkedHashMap<>();
    for (EvenementAbonnement ev : evenements.findByTypeInAndCreeLeLessThanEqualOrderByCreeLeAscIdAsc(TYPES_STATUT, maintenant)) {
      parEtablissement.computeIfAbsent(ev.getEtablissementId(), k -> new ArrayList<>()).add(ev);
    }

    long enService = 0;
    List<EtablissementChurn> perdus = new ArrayList<>();
    for (Map.Entry<Long, List<EvenementAbonnement>> entree : parEtablissement.entrySet()) {
      List<EvenementAbonnement> historique = entree.getValue();
      EvenementAbonnement dernierAvant = null;
      for (EvenementAbonnement ev : historique) {
        if (!ev.getCreeLe().isAfter(debutFenetre)) dernierAvant = ev;
      }
      if (dernierAvant == null || !enServiceA(dernierAvant, debutFenetre, joursGrace)) continue;
      enService++;

      EvenementAbonnement dernierInactif = null;
      boolean retourApres = false;
      for (EvenementAbonnement ev : historique) {
        if (!ev.getCreeLe().isAfter(debutFenetre)) continue;
        if (TYPES_INACTIFS.contains(ev.getType())) {
          dernierInactif = ev;
          retourApres = false;
        } else if (dernierInactif != null && TYPES_EN_SERVICE.contains(ev.getType())) {
          retourApres = true;
        }
      }
      if (dernierInactif != null && !retourApres) {
        StatutAbonnement statut = dernierInactif.getType() == TypeEvenementAbonnement.SUSPENSION
            ? StatutAbonnement.SUSPENDU : StatutAbonnement.EXPIRE;
        perdus.add(new EtablissementChurn(entree.getKey(), noms.getOrDefault(entree.getKey(), "Établissement n°" + entree.getKey()),
            dernierInactif.getCreeLe(), statut, statut.libelle()));
      }
    }
    perdus.sort(Comparator.comparing(EtablissementChurn::date).reversed().thenComparing(EtablissementChurn::nom));
    Double taux = enService == 0 ? null : Math.round(perdus.size() * 1000.0 / enService) / 10.0;
    return new Churn(debutFenetre, maintenant, enService, perdus.size(), taux, perdus, DEFINITION_CHURN);
  }

  /**
   * Un établissement était en service à {@code instant} si son dernier événement de statut antérieur le plaçait
   * en essai ou en abonnement, et que la période correspondante (grâce comprise pour un abonnement) courait encore.
   */
  static boolean enServiceA(EvenementAbonnement dernier, Instant instant, int joursGrace) {
    if (!TYPES_EN_SERVICE.contains(dernier.getType())) return false;
    Instant fin = dernier.getPeriodeFin();
    if (fin == null) return true;
    boolean essai = dernier.getType() == TypeEvenementAbonnement.ESSAI
        || (dernier.getType() == TypeEvenementAbonnement.REACTIVATION && dernier.getForfait() == null);
    Instant echeance = essai ? fin : fin.atOffset(ZoneOffset.UTC).plusDays(Math.max(0, joursGrace)).toInstant();
    return echeance.isAfter(instant);
  }

  /**
   * Série des 12 derniers mois civils UTC (mois courant inclus). Le cumul part des établissements
   * inscrits avant la fenêtre, auxquels s'ajoutent ceux sans date connue.
   */
  List<PointInscription> inscriptions(Instant maintenant) {
    YearMonth moisCourant = YearMonth.from(maintenant.atOffset(ZoneOffset.UTC));
    YearMonth premier = moisCourant.minusMonths(MOIS_INSCRIPTIONS - 1L);
    Instant debut = debutDuMois(premier);
    Instant fin = debutDuMois(moisCourant.plusMonths(1));

    Map<YearMonth, Long> parMois = new LinkedHashMap<>();
    for (Object[] ligne : etablissements.compterInscriptionsParMois(debut, fin)) {
      int annee = ((Number) ligne[0]).intValue();
      int mois = ((Number) ligne[1]).intValue();
      parMois.put(YearMonth.of(annee, mois), ((Number) ligne[2]).longValue());
    }

    long cumul = etablissements.countByCreeLeBefore(debut) + etablissements.countByCreeLeIsNull();
    List<PointInscription> serie = new ArrayList<>(MOIS_INSCRIPTIONS);
    for (YearMonth m = premier; !m.isAfter(moisCourant); m = m.plusMonths(1)) {
      long n = parMois.getOrDefault(m, 0L);
      cumul += n;
      serie.add(new PointInscription(m.toString(), n, cumul));
    }
    return serie;
  }

  static Instant debutDuMois(YearMonth mois) {
    return mois.atDay(1).atStartOfDay(ZoneOffset.UTC).toInstant();
  }
}
