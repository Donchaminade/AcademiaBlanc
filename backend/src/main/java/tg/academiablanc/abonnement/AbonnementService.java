package tg.academiablanc.abonnement;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tg.academiablanc.abonnement.ParametresCommerciauxService.ParametresCommerciaux;
import tg.academiablanc.domain.Etablissement;
import tg.academiablanc.domain.EvenementAbonnement;
import tg.academiablanc.domain.Forfait;
import tg.academiablanc.domain.StatutAbonnement;
import tg.academiablanc.domain.TypeEvenementAbonnement;
import tg.academiablanc.repo.EtablissementRepository;
import tg.academiablanc.repo.EvenementAbonnementRepository;

/**
 * Cycle de vie de l'abonnement d'un établissement : inscription (en attente de paiement), essai,
 * activation / prolongation par le super admin après un paiement mobile money, suspension, réactivation,
 * déclaration de paiement par l'établissement, expiration (lecture seule).
 *
 * <p>Toutes les dates sont en UTC ({@link Instant}) et proviennent de l'horloge injectée ; le statut
 * effectif ({@link #etat(Etablissement)}) est recalculé à chaque lecture à partir des dates enregistrées,
 * le client n'utilise jamais son horloge locale pour décider d'un verrouillage.
 */
@Service
public class AbonnementService {
  private static final Logger log = LoggerFactory.getLogger(AbonnementService.class);

  public static final String ACTEUR_SYSTEME = "système";
  public static final Set<String> OPERATEURS_MOBILE =
      Set.of("Flooz", "T-Money", "Mixx by Yas", "Orange Money", "MTN MoMo", "Wave", "Autre");

  public static final String MESSAGE_VERROUILLE_EXPIRE =
      "Abonnement expiré : l'espace est en lecture seule. Réglez votre abonnement pour réactiver l'écriture et l'impression.";
  public static final String MESSAGE_VERROUILLE_SUSPENDU =
      "Abonnement suspendu par la plateforme : l'espace est en lecture seule. Contactez-nous pour le réactiver.";
  public static final String MESSAGE_VERROUILLE_ATTENTE =
      "Compte en attente d'activation : réglez le forfait choisi puis déclarez le paiement ; l'écriture est bloquée jusqu'à l'activation.";

  /** Contacts et tarifs renvoyés avec le statut, pour l'écran Paiement / Activation et la page Abonnement. */
  public record Contacts(
      String telWhatsapp,
      String telAppel,
      String beneficiaire,
      String instructions,
      long tarifMensuel,
      long tarifAnnuel,
      String devise
  ) {}

  /**
   * Statut effectif calculé par le serveur. {@code acces} = l'application peut s'ouvrir (faux en attente de
   * paiement) ; {@code lectureSeule} = toute écriture métier, impression ou export est refusée ;
   * {@code joursRestants} = jours civils UTC avant {@code echeance} (null sans échéance).
   */
  public record EtatAbonnement(
      Long etablissementId,
      StatutAbonnement statut,
      String statutLibelle,
      Forfait forfait,
      Forfait forfaitChoisi,
      Instant debut,
      Instant fin,
      Instant echeance,
      Instant essaiJusquAu,
      Long joursRestants,
      boolean enGrace,
      boolean lectureSeule,
      boolean acces,
      boolean essai,
      boolean plateforme,
      String message,
      Contacts contacts,
      Instant maintenant
  ) {}

  private final EtablissementRepository etablissements;
  private final EvenementAbonnementRepository evenements;
  private final ParametresCommerciauxService parametres;
  private final Clock horloge;
  private final StatutAbonnement statutInscription;

  public AbonnementService(
      EtablissementRepository etablissements,
      EvenementAbonnementRepository evenements,
      ParametresCommerciauxService parametres,
      Clock horloge,
      @Value("${app.abonnement.statut-inscription:EN_ATTENTE_PAIEMENT}") String statutInscription
  ) {
    this.etablissements = etablissements;
    this.evenements = evenements;
    this.parametres = parametres;
    this.horloge = horloge;
    this.statutInscription = StatutAbonnement.valueOf(statutInscription.trim().toUpperCase(Locale.ROOT));
  }

  public Instant maintenant() {
    return horloge.instant();
  }

  /* ------------------------------------------------------------------ */
  /* Lecture                                                             */
  /* ------------------------------------------------------------------ */

  /** Statut effectif ; détecte et journalise l'expiration au passage (idempotent). */
  @Transactional
  public EtatAbonnement etat(Etablissement e) {
    Instant now = horloge.instant();
    ParametresCommerciaux p = parametres.lire();
    Contacts contacts = new Contacts(p.telWhatsapp(), p.telAppel(), p.beneficiaire(), p.instructions(),
        p.tarifMensuel(), p.tarifAnnuel(), p.devise());
    StatutAbonnement stocke = e.getStatutAbonnement() == null ? StatutAbonnement.EN_ATTENTE_PAIEMENT : e.getStatutAbonnement();

    if (stocke == StatutAbonnement.SUSPENDU) {
      return etat(e, StatutAbonnement.SUSPENDU, now, false, true, true, MESSAGE_VERROUILLE_SUSPENDU, contacts);
    }
    if (stocke == StatutAbonnement.EN_ATTENTE_PAIEMENT) {
      return etat(e, StatutAbonnement.EN_ATTENTE_PAIEMENT, now, false, true, false, MESSAGE_VERROUILLE_ATTENTE, contacts);
    }
    Instant echeance = e.getAbonnementEcheance();
    if (echeance == null || !now.isBefore(echeance)) {
      if (stocke != StatutAbonnement.EXPIRE) {
        e.setStatutAbonnement(StatutAbonnement.EXPIRE);
        etablissements.save(e);
        journaliser(e, TypeEvenementAbonnement.EXPIRATION, e.getForfait(), null, null, null,
            e.getAbonnementDebut(), e.getAbonnementFin(), ACTEUR_SYSTEME,
            stocke == StatutAbonnement.ESSAI ? "Fin de la période d'essai." : "Fin de la période payée et des jours de grâce.",
            null, null, now);
        log.info("Abonnement de l'établissement {} ({}) expiré le {}.", e.getId(), e.getNom(), now);
      }
      return etat(e, StatutAbonnement.EXPIRE, now, false, true, true, MESSAGE_VERROUILLE_EXPIRE, contacts);
    }
    boolean enGrace = e.getAbonnementFin() != null && !now.isBefore(e.getAbonnementFin());
    // Un EXPIRE enregistré dont l'échéance est de nouveau à venir (horloge ajustée, données reprises) redevient actif ou essai.
    StatutAbonnement effectif = stocke == StatutAbonnement.EXPIRE
        ? (e.getForfait() != null ? StatutAbonnement.ACTIF : StatutAbonnement.ESSAI)
        : stocke;
    return etat(e, effectif, now, enGrace, false, true, null, contacts);
  }

  private EtatAbonnement etat(Etablissement e, StatutAbonnement statut, Instant now, boolean enGrace,
                              boolean lectureSeule, boolean acces, String message, Contacts contacts) {
    Instant echeance = e.getAbonnementEcheance();
    Long jours = echeance == null || statut == StatutAbonnement.EN_ATTENTE_PAIEMENT ? null : CalculEcheance.joursRestants(now, echeance);
    return new EtatAbonnement(e.getId(), statut, statut.libelle(), e.getForfait(), e.getForfaitChoisi(),
        e.getAbonnementDebut(), e.getAbonnementFin(), echeance, e.getEssaiJusquAu(), jours, enGrace, lectureSeule,
        acces, statut == StatutAbonnement.ESSAI, false, message, contacts, now);
  }

  /** Statut « plateforme » pour un compte sans établissement ou le propriétaire du logiciel : jamais verrouillé. */
  public EtatAbonnement etatPlateforme() {
    ParametresCommerciaux p = parametres.lire();
    Contacts contacts = new Contacts(p.telWhatsapp(), p.telAppel(), p.beneficiaire(), p.instructions(),
        p.tarifMensuel(), p.tarifAnnuel(), p.devise());
    return new EtatAbonnement(null, StatutAbonnement.ACTIF, "Plateforme", null, null, null, null, null, null, null,
        false, false, true, false, true, null, contacts, horloge.instant());
  }

  /** Vrai si l'établissement est en lecture seule (expiré, suspendu ou en attente de paiement). Filtre HTTP. */
  @Transactional
  public boolean lectureSeule(Long etablissementId) {
    return etablissements.findById(etablissementId).map(e -> etat(e).lectureSeule()).orElse(false);
  }

  @Transactional
  public EtatAbonnement etat(Long etablissementId) {
    return etat(charger(etablissementId));
  }

  @Transactional(readOnly = true)
  public List<EvenementAbonnement> historique(Long etablissementId) {
    return evenements.findByEtablissementIdOrderByCreeLeDescIdDesc(etablissementId);
  }

  /* ------------------------------------------------------------------ */
  /* Écriture                                                            */
  /* ------------------------------------------------------------------ */

  /**
   * État initial d'un établissement qui vient d'être créé. Inscription publique : statut configuré
   * ({@code app.abonnement.statut-inscription}, EN_ATTENTE_PAIEMENT par défaut, ESSAI possible) ;
   * création par la plateforme : essai immédiat.
   */
  @Transactional
  public void initialiser(Etablissement e, Forfait forfaitChoisi, boolean parPlateforme, String acteur) {
    e.setForfaitChoisi(forfaitChoisi);
    if (parPlateforme || statutInscription == StatutAbonnement.ESSAI) {
      demarrerEssai(e, acteur, parPlateforme ? "Essai accordé à la création par la plateforme." : "Essai accordé à l'inscription.");
      return;
    }
    e.setStatutAbonnement(StatutAbonnement.EN_ATTENTE_PAIEMENT);
    etablissements.save(e);
  }

  /** Essai de la durée paramétrée à partir de maintenant, confirmé par le super admin (ou accordé à la création). */
  @Transactional
  public EvenementAbonnement demarrerEssai(Etablissement e, String acteur, String note) {
    Instant now = horloge.instant();
    ParametresCommerciaux p = parametres.lire();
    CalculEcheance.Periode periode = CalculEcheance.essai(now, p.dureeEssaiJours());
    e.setStatutAbonnement(StatutAbonnement.ESSAI);
    e.setForfait(null);
    e.setAbonnementDebut(periode.debut());
    e.setAbonnementFin(periode.fin());
    e.setAbonnementEcheance(periode.echeance());
    e.setEssaiJusquAu(periode.fin());
    etablissements.save(e);
    log.info("Essai de {} jours accordé à l'établissement {} ({}) par {} jusqu'au {}.",
        p.dureeEssaiJours(), e.getId(), e.getNom(), acteur, periode.fin());
    return journaliser(e, TypeEvenementAbonnement.ESSAI, null, null, null, null, periode.debut(), periode.fin(),
        acteur, note == null ? "Essai de " + p.dureeEssaiJours() + " jours." : note, null, null, now);
  }

  /**
   * Activation après paiement. Pendant un abonnement actif, la nouvelle période prolonge la période en cours
   * (PROLONGATION) ; sinon elle démarre à {@code debutDemande} (par défaut maintenant). Le montant vaut le tarif
   * du forfait s'il n'est pas précisé ; {@code declarationId} rapproche une déclaration de paiement (TRAITEE).
   */
  @Transactional
  public EvenementAbonnement activer(Etablissement e, Forfait forfait, Instant debutDemande, Long montant, String reference,
                                     String operateurMobile, String note, Long declarationId, String acteur) {
    if (forfait == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choisissez un forfait (MENSUEL ou ANNUEL).");
    Instant now = horloge.instant();
    ParametresCommerciaux p = parametres.lire();
    Instant activation = debutDemande == null ? now : debutDemande;
    StatutAbonnement avant = etat(e).statut();
    Instant finCourante = avant == StatutAbonnement.ACTIF ? e.getAbonnementFin() : null;
    CalculEcheance.Periode periode = CalculEcheance.activer(activation, finCourante, forfait, p.joursGrace());
    boolean prolongation = finCourante != null && finCourante.isAfter(activation);

    e.setStatutAbonnement(StatutAbonnement.ACTIF);
    e.setForfait(forfait);
    if (!prolongation) e.setAbonnementDebut(periode.debut());
    e.setAbonnementFin(periode.fin());
    e.setAbonnementEcheance(periode.echeance());
    etablissements.save(e);

    if (declarationId != null) {
      evenements.findById(declarationId)
          .filter(d -> d.getEtablissementId().equals(e.getId()) && d.getType() == TypeEvenementAbonnement.DECLARATION_PAIEMENT)
          .ifPresent(d -> {
            d.setStatut(EvenementAbonnement.STATUT_TRAITEE);
            evenements.save(d);
          });
    }
    long montantRetenu = montant == null ? p.tarif(forfait) : montant;
    TypeEvenementAbonnement type = prolongation ? TypeEvenementAbonnement.PROLONGATION : TypeEvenementAbonnement.ACTIVATION;
    log.info("{} {} de l'établissement {} ({}) par {} : {} {} réf. {} — période {} → {} (échéance {}).",
        type.libelle(), forfait.libelle().toLowerCase(Locale.ROOT), e.getId(), e.getNom(), acteur, montantRetenu,
        p.devise(), reference, periode.debut(), periode.fin(), periode.echeance());
    return journaliser(e, type, forfait, montantRetenu, reference, operateurMobile, periode.debut(), periode.fin(),
        acteur, note, null, null, now);
  }

  @Transactional
  public EvenementAbonnement suspendre(Etablissement e, String note, String acteur) {
    if (e.getStatutAbonnement() == StatutAbonnement.SUSPENDU) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Cet établissement est déjà suspendu.");
    }
    Instant now = horloge.instant();
    e.setStatutAbonnement(StatutAbonnement.SUSPENDU);
    etablissements.save(e);
    log.info("Abonnement de l'établissement {} ({}) suspendu par {}.", e.getId(), e.getNom(), acteur);
    return journaliser(e, TypeEvenementAbonnement.SUSPENSION, e.getForfait(), null, null, null, null, null, acteur, note, null, null, now);
  }

  /** Lève la suspension : le statut redevient celui que dictent les dates (actif, essai, expiré ou en attente). */
  @Transactional
  public EvenementAbonnement reactiver(Etablissement e, String note, String acteur) {
    if (e.getStatutAbonnement() != StatutAbonnement.SUSPENDU) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Cet établissement n'est pas suspendu.");
    }
    Instant now = horloge.instant();
    StatutAbonnement retour;
    if (e.getAbonnementEcheance() == null) {
      retour = StatutAbonnement.EN_ATTENTE_PAIEMENT;
    } else if (!now.isBefore(e.getAbonnementEcheance())) {
      retour = StatutAbonnement.EXPIRE;
    } else {
      retour = e.getForfait() != null ? StatutAbonnement.ACTIF : StatutAbonnement.ESSAI;
    }
    e.setStatutAbonnement(retour);
    etablissements.save(e);
    log.info("Abonnement de l'établissement {} ({}) réactivé par {} : statut {}.", e.getId(), e.getNom(), acteur, retour);
    return journaliser(e, TypeEvenementAbonnement.REACTIVATION, e.getForfait(), null, null, null,
        e.getAbonnementDebut(), e.getAbonnementFin(), acteur, note, null, null, now);
  }

  /** Déclaration « J'ai effectué le paiement » par l'établissement ; visible côté plateforme avec le statut À vérifier. */
  @Transactional
  public EvenementAbonnement declarerPaiement(Etablissement e, Forfait forfait, Long montant, String reference,
                                              String operateurMobile, Instant datePaiement, String note, String acteur) {
    if (montant == null || montant <= 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indiquez le montant réglé (en FCFA).");
    }
    String operateur = operateurMobile == null || operateurMobile.isBlank() ? "Autre" : operateurMobile.trim();
    if (!OPERATEURS_MOBILE.contains(operateur)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Opérateur inconnu : " + String.join(", ", OPERATEURS_MOBILE.stream().sorted().toList()) + ".");
    }
    Instant now = horloge.instant();
    Forfait retenu = forfait != null ? forfait : e.getForfaitChoisi();
    log.info("Déclaration de paiement de l'établissement {} ({}) par {} : {} FCFA, {} réf. {}.",
        e.getId(), e.getNom(), acteur, montant, operateur, reference);
    return journaliser(e, TypeEvenementAbonnement.DECLARATION_PAIEMENT, retenu, montant, reference, operateur, null, null,
        acteur, note, EvenementAbonnement.STATUT_A_VERIFIER, datePaiement == null ? now : datePaiement, now);
  }

  /* ------------------------------------------------------------------ */

  public Etablissement charger(Long id) {
    return etablissements.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Établissement introuvable."));
  }

  private EvenementAbonnement journaliser(Etablissement e, TypeEvenementAbonnement type, Forfait forfait, Long montant,
                                          String reference, String operateurMobile, Instant periodeDebut, Instant periodeFin,
                                          String acteur, String note, String statut, Instant datePaiement, Instant creeLe) {
    EvenementAbonnement ev = new EvenementAbonnement();
    ev.setEtablissementId(e.getId());
    ev.setType(type);
    ev.setForfait(forfait);
    ev.setMontant(montant);
    ev.setReference(tronquer(reference, 120));
    ev.setOperateurMobile(tronquer(operateurMobile, 40));
    ev.setPeriodeDebut(periodeDebut);
    ev.setPeriodeFin(periodeFin);
    ev.setActeur(tronquer(acteur, 180));
    ev.setNote(tronquer(note, 1000));
    ev.setStatut(statut);
    ev.setDatePaiement(datePaiement);
    ev.setCreeLe(creeLe);
    return evenements.save(ev);
  }

  private static String tronquer(String valeur, int max) {
    if (valeur == null) return null;
    String v = valeur.trim();
    if (v.isEmpty()) return null;
    return v.length() > max ? v.substring(0, max) : v;
  }
}
