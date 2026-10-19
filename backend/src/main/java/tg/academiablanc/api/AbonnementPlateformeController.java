package tg.academiablanc.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import tg.academiablanc.abonnement.AbonnementService;
import tg.academiablanc.abonnement.AbonnementVues;
import tg.academiablanc.abonnement.AbonnementVues.AbonnementEtablissementVue;
import tg.academiablanc.abonnement.AbonnementVues.EvenementVue;
import tg.academiablanc.abonnement.ParametresCommerciauxService;
import tg.academiablanc.abonnement.ParametresCommerciauxService.ParametresCommerciaux;
import tg.academiablanc.domain.Action;
import tg.academiablanc.domain.Etablissement;
import tg.academiablanc.domain.EvenementAbonnement;
import tg.academiablanc.domain.Forfait;
import tg.academiablanc.domain.Ressource;
import tg.academiablanc.domain.Role;
import tg.academiablanc.domain.TypeEvenementAbonnement;
import tg.academiablanc.domain.Utilisateur;
import tg.academiablanc.repo.EtablissementRepository;
import tg.academiablanc.repo.EvenementAbonnementRepository;
import tg.academiablanc.security.PermissionService;

/**
 * Portail super admin : abonnements des établissements (liste, activation après paiement mobile money, essai,
 * suspension, réactivation, historique), historique global des paiements et paramètres commerciaux.
 * Protégé par les rôles de plateforme ({@code /api/plateforme/**}) et les droits ETABLISSEMENTS ; les tarifs
 * ne se modifient que par le propriétaire du logiciel (SUPER_ADMIN). Chaque action est journalisée avec son acteur.
 */
@RestController
@RequestMapping("/api/plateforme/abonnements")
public class AbonnementPlateformeController {
  private final AbonnementService abonnements;
  private final ParametresCommerciauxService parametres;
  private final EtablissementRepository etablissements;
  private final EvenementAbonnementRepository evenements;
  private final PermissionService droits;

  public AbonnementPlateformeController(
      AbonnementService abonnements,
      ParametresCommerciauxService parametres,
      EtablissementRepository etablissements,
      EvenementAbonnementRepository evenements,
      PermissionService droits
  ) {
    this.abonnements = abonnements;
    this.parametres = parametres;
    this.etablissements = etablissements;
    this.evenements = evenements;
    this.droits = droits;
  }

  public record ActivationRequest(
      @NotNull Forfait forfait,
      /** Date de début (UTC) ; aujourd'hui par défaut. Ignorée si un abonnement actif est prolongé. */
      LocalDate debut,
      Long montant,
      @Size(max = 120) String reference,
      @Size(max = 40) String operateurMobile,
      @Size(max = 1000) String note,
      /** Déclaration de paiement rapprochée de cette activation (passe à TRAITEE). */
      Long declarationId
  ) {}

  public record NoteRequest(@Size(max = 1000) String note) {}

  public record ParametresRequest(
      @NotNull Long tarifMensuel,
      @NotNull Long tarifAnnuel,
      @Size(max = 40) String telWhatsapp,
      @Size(max = 40) String telAppel,
      @Size(max = 180) String beneficiaire,
      @Size(max = 4000) String instructions,
      @NotNull Integer dureeEssaiJours,
      @NotNull Integer joursGrace
  ) {}

  /** Onglet Paiements : lignes (filtrées par mois si demandé) et totaux du mois courant. */
  public record PaiementsVue(
      List<EvenementVue> evenements,
      String mois,
      long totalMois,
      long nombrePaiementsMois,
      long declarationsAVerifier,
      String devise
  ) {}

  /* ------------------------------------------------------------------ */
  /* Établissements                                                      */
  /* ------------------------------------------------------------------ */

  @GetMapping
  @Transactional
  public List<AbonnementEtablissementVue> lister() {
    Utilisateur moi = droits.exiger(Ressource.ETABLISSEMENTS, Action.VOIR);
    boolean details = droits.peut(moi, Ressource.ETABLISSEMENTS, Action.DETAILS);
    return etablissements.findAllByOrderByNomAsc().stream()
        .map(e -> AbonnementVues.vue(e, abonnements.etat(e), details, aVerifier(e.getId())))
        .toList();
  }

  @GetMapping("/{id}")
  @Transactional
  public AbonnementEtablissementVue detail(@PathVariable Long id) {
    droits.exiger(Ressource.ETABLISSEMENTS, Action.DETAILS);
    Etablissement e = abonnements.charger(id);
    return AbonnementVues.vue(e, abonnements.etat(e), true, aVerifier(id));
  }

  @GetMapping("/{id}/historique")
  public List<EvenementVue> historique(@PathVariable Long id) {
    droits.exiger(Ressource.ETABLISSEMENTS, Action.DETAILS);
    Etablissement e = abonnements.charger(id);
    return abonnements.historique(id).stream().map(ev -> AbonnementVues.vue(ev, e.getNom())).toList();
  }

  @PostMapping("/{id}/activer")
  @Transactional
  public AbonnementEtablissementVue activer(@PathVariable Long id, @Valid @RequestBody ActivationRequest request) {
    Utilisateur moi = droits.exiger(Ressource.ETABLISSEMENTS, Action.MODIFIER);
    Etablissement e = abonnements.charger(id);
    Instant debut = request.debut() == null ? null : request.debut().atStartOfDay(ZoneOffset.UTC).toInstant();
    if (request.montant() != null && request.montant() < 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le montant ne peut pas être négatif.");
    }
    abonnements.activer(e, request.forfait(), debut, request.montant(), request.reference(), request.operateurMobile(),
        request.note(), request.declarationId(), moi.getEmail());
    return AbonnementVues.vue(e, abonnements.etat(e), true, aVerifier(id));
  }

  @PostMapping("/{id}/essai")
  @Transactional
  public AbonnementEtablissementVue essai(@PathVariable Long id, @RequestBody(required = false) NoteRequest request) {
    Utilisateur moi = droits.exiger(Ressource.ETABLISSEMENTS, Action.MODIFIER);
    Etablissement e = abonnements.charger(id);
    abonnements.demarrerEssai(e, moi.getEmail(), request == null ? null : request.note());
    return AbonnementVues.vue(e, abonnements.etat(e), true, aVerifier(id));
  }

  @PostMapping("/{id}/suspendre")
  @Transactional
  public AbonnementEtablissementVue suspendre(@PathVariable Long id, @RequestBody(required = false) NoteRequest request) {
    Utilisateur moi = droits.exiger(Ressource.ETABLISSEMENTS, Action.MODIFIER);
    Etablissement e = abonnements.charger(id);
    if (e.getId().equals(moi.getEtablissementId())) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Vous ne pouvez pas suspendre votre propre établissement.");
    }
    abonnements.suspendre(e, request == null ? null : request.note(), moi.getEmail());
    return AbonnementVues.vue(e, abonnements.etat(e), true, aVerifier(id));
  }

  @PostMapping("/{id}/reactiver")
  @Transactional
  public AbonnementEtablissementVue reactiver(@PathVariable Long id, @RequestBody(required = false) NoteRequest request) {
    Utilisateur moi = droits.exiger(Ressource.ETABLISSEMENTS, Action.MODIFIER);
    Etablissement e = abonnements.charger(id);
    abonnements.reactiver(e, request == null ? null : request.note(), moi.getEmail());
    return AbonnementVues.vue(e, abonnements.etat(e), true, aVerifier(id));
  }

  /* ------------------------------------------------------------------ */
  /* Paiements                                                           */
  /* ------------------------------------------------------------------ */

  /** {@code mois} au format AAAA-MM (UTC) : filtre la liste ; les totaux portent toujours sur ce mois (courant par défaut). */
  @GetMapping("/paiements")
  public PaiementsVue paiements(@RequestParam(required = false) String mois) {
    droits.exiger(Ressource.ETABLISSEMENTS, Action.DETAILS);
    YearMonth cible;
    try {
      cible = mois == null || mois.isBlank() ? YearMonth.from(abonnements.maintenant().atZone(ZoneOffset.UTC)) : YearMonth.parse(mois.trim());
    } catch (RuntimeException ex) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mois invalide : attendu AAAA-MM.");
    }
    Instant debut = cible.atDay(1).atStartOfDay(ZoneOffset.UTC).toInstant();
    Instant fin = cible.plusMonths(1).atDay(1).atStartOfDay(ZoneOffset.UTC).toInstant();
    List<EvenementAbonnement> lignes = mois == null || mois.isBlank()
        ? evenements.findAllByOrderByCreeLeDescIdDesc()
        : evenements.findByCreeLeBetweenOrderByCreeLeDescIdDesc(debut, fin);
    Map<Long, String> noms = etablissements.findAll().stream().collect(Collectors.toMap(Etablissement::getId, Etablissement::getNom));
    List<EvenementAbonnement> duMois = evenements.findByCreeLeBetweenOrderByCreeLeDescIdDesc(debut, fin);
    long total = duMois.stream().filter(AbonnementPlateformeController::estEncaissement).mapToLong(ev -> ev.getMontant() == null ? 0 : ev.getMontant()).sum();
    long nombre = duMois.stream().filter(AbonnementPlateformeController::estEncaissement).count();
    long aVerifier = evenements.findByTypeAndStatutOrderByCreeLeDescIdDesc(TypeEvenementAbonnement.DECLARATION_PAIEMENT, EvenementAbonnement.STATUT_A_VERIFIER).size();
    return new PaiementsVue(
        lignes.stream().map(ev -> AbonnementVues.vue(ev, noms.getOrDefault(ev.getEtablissementId(), "—"))).toList(),
        cible.toString(), total, nombre, aVerifier, ParametresCommerciauxService.DEVISE);
  }

  private static boolean estEncaissement(EvenementAbonnement ev) {
    return ev.getType() == TypeEvenementAbonnement.ACTIVATION || ev.getType() == TypeEvenementAbonnement.PROLONGATION;
  }

  /* ------------------------------------------------------------------ */
  /* Paramètres commerciaux                                              */
  /* ------------------------------------------------------------------ */

  @GetMapping("/parametres")
  public ParametresCommerciaux lireParametres() {
    droits.exiger(Ressource.ETABLISSEMENTS, Action.VOIR);
    return parametres.lire();
  }

  @PutMapping("/parametres")
  public ParametresCommerciaux enregistrerParametres(@Valid @RequestBody ParametresRequest request) {
    Utilisateur moi = droits.courant();
    if (moi.getRole() != Role.SUPER_ADMIN) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Seul le propriétaire du logiciel modifie les tarifs et les contacts.");
    }
    return parametres.enregistrer(new ParametresCommerciaux(request.tarifMensuel(), request.tarifAnnuel(),
        ParametresCommerciauxService.DEVISE, request.telWhatsapp(), request.telAppel(), request.beneficiaire(),
        request.instructions(), request.dureeEssaiJours(), request.joursGrace(), null), moi.getEmail());
  }

  /* ------------------------------------------------------------------ */

  private long aVerifier(Long etablissementId) {
    return evenements.countByEtablissementIdAndTypeAndStatut(etablissementId, TypeEvenementAbonnement.DECLARATION_PAIEMENT,
        EvenementAbonnement.STATUT_A_VERIFIER);
  }
}
