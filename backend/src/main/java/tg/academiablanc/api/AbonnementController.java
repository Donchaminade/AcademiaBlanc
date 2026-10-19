package tg.academiablanc.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import tg.academiablanc.abonnement.AbonnementService;
import tg.academiablanc.abonnement.AbonnementService.EtatAbonnement;
import tg.academiablanc.abonnement.AbonnementVues;
import tg.academiablanc.abonnement.AbonnementVues.EvenementVue;
import tg.academiablanc.abonnement.ParametresCommerciauxService;
import tg.academiablanc.domain.Etablissement;
import tg.academiablanc.domain.Forfait;
import tg.academiablanc.domain.Role;
import tg.academiablanc.domain.Utilisateur;
import tg.academiablanc.security.PermissionService;

/**
 * Abonnement vu par l'établissement connecté : statut calculé par le serveur (dates UTC, jours restants,
 * lecture seule, accès), historique de ses propres paiements et déclaration « J'ai effectué le paiement ».
 * Ces adresses restent accessibles quand l'espace est verrouillé (liste blanche du filtre 423).
 * Un établissement ne lit jamais l'abonnement d'un autre : tout part de l'établissement du jeton.
 */
@RestController
@RequestMapping("/api/abonnement")
public class AbonnementController {
  private final AbonnementService abonnements;
  private final PermissionService droits;

  public AbonnementController(AbonnementService abonnements, PermissionService droits) {
    this.abonnements = abonnements;
    this.droits = droits;
  }

  public record DeclarationPaiementRequest(
      Forfait forfait,
      @NotNull Long montant,
      @Size(max = 120) String reference,
      @Size(max = 40) String operateur,
      Instant datePaiement,
      @Size(max = 1000) String note
  ) {}

  /** Référentiel pour le formulaire de déclaration. */
  public record ReferentielDeclaration(List<String> operateurs, List<String> forfaits) {}

  @GetMapping("/statut")
  public EtatAbonnement statut() {
    Utilisateur moi = droits.courant();
    if (moi.getEtablissementId() == null || moi.getRole() == Role.SUPER_ADMIN) return abonnements.etatPlateforme();
    return abonnements.etat(moi.getEtablissementId());
  }

  @GetMapping("/historique")
  public List<EvenementVue> historique() {
    Utilisateur moi = droits.courant();
    if (moi.getEtablissementId() == null) return List.of();
    Etablissement e = abonnements.charger(moi.getEtablissementId());
    return abonnements.historique(e.getId()).stream().map(ev -> AbonnementVues.vue(ev, e.getNom())).toList();
  }

  @GetMapping("/referentiel")
  public ReferentielDeclaration referentiel() {
    droits.courant();
    return new ReferentielDeclaration(AbonnementService.OPERATEURS_MOBILE.stream().sorted().toList(),
        List.of(Forfait.MENSUEL.name(), Forfait.ANNUEL.name()));
  }

  /** Déclaration de paiement, réservée au responsable et aux administrateurs de l'établissement. */
  @PostMapping("/declarations")
  @ResponseStatus(HttpStatus.CREATED)
  public EvenementVue declarer(@Valid @RequestBody DeclarationPaiementRequest request) {
    Utilisateur moi = droits.courant();
    if (moi.getEtablissementId() == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ce compte n'est rattaché à aucun établissement.");
    }
    if (moi.getRole() != Role.OWNER && moi.getRole() != Role.ADMIN && moi.getRole() != Role.SUPER_ADMIN) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Seul le responsable ou un administrateur de l'établissement peut déclarer un paiement.");
    }
    Etablissement e = abonnements.charger(moi.getEtablissementId());
    var ev = abonnements.declarerPaiement(e, request.forfait(), request.montant(), request.reference(), request.operateur(),
        request.datePaiement(), request.note(), moi.getEmail());
    return AbonnementVues.vue(ev, e.getNom());
  }

  /** Offre publique : tarifs, téléphones et instructions, sans authentification (page d'inscription / paiement). */
  @RestController
  public static class OffrePublique {
    private final ParametresCommerciauxService parametres;

    public OffrePublique(ParametresCommerciauxService parametres) {
      this.parametres = parametres;
    }

    @GetMapping("/api/public/offre")
    public ParametresCommerciauxService.OffrePublique offre() {
      return parametres.offrePublique();
    }
  }
}
