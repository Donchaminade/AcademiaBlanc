package tg.academiablanc.abonnement;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import tg.academiablanc.domain.Etablissement;
import tg.academiablanc.domain.EvenementAbonnement;
import tg.academiablanc.domain.Forfait;
import tg.academiablanc.domain.StatutAbonnement;
import tg.academiablanc.domain.TypeEvenementAbonnement;

/** Représentations JSON partagées par l'API de l'établissement et celle de la plateforme. */
public final class AbonnementVues {
  private AbonnementVues() {}

  @JsonInclude(JsonInclude.Include.NON_NULL)
  public record EvenementVue(
      Long id,
      Long etablissementId,
      String etablissementNom,
      TypeEvenementAbonnement type,
      String typeLibelle,
      Forfait forfait,
      Long montant,
      String reference,
      String operateurMobile,
      Instant periodeDebut,
      Instant periodeFin,
      String acteur,
      String note,
      String statut,
      Instant datePaiement,
      Instant creeLe
  ) {}

  public static EvenementVue vue(EvenementAbonnement ev, String etablissementNom) {
    return new EvenementVue(ev.getId(), ev.getEtablissementId(), etablissementNom, ev.getType(), ev.getType().libelle(),
        ev.getForfait(), ev.getMontant(), ev.getReference(), ev.getOperateurMobile(), ev.getPeriodeDebut(), ev.getPeriodeFin(),
        ev.getActeur(), ev.getNote(), ev.getStatut(), ev.getDatePaiement(), ev.getCreeLe());
  }

  /** Ligne de la liste « Établissements » du portail : fiche + statut effectif. {@code email} absent sans DETAILS. */
  @JsonInclude(JsonInclude.Include.NON_NULL)
  public record AbonnementEtablissementVue(
      Long id,
      String nom,
      String ville,
      String email,
      String nomResponsable,
      Instant creeLe,
      boolean actif,
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
      long declarationsAVerifier
  ) {}

  public static AbonnementEtablissementVue vue(Etablissement e, AbonnementService.EtatAbonnement etat, boolean details,
                                               long declarationsAVerifier) {
    return new AbonnementEtablissementVue(e.getId(), e.getNom(), e.getVille(), details ? e.getEmail() : null,
        details ? e.getNomResponsable() : null, e.getCreeLe(), e.isActif(), etat.statut(), etat.statutLibelle(), etat.forfait(),
        etat.forfaitChoisi(), etat.debut(), etat.fin(), etat.echeance(), etat.essaiJusquAu(), etat.joursRestants(), etat.enGrace(),
        etat.lectureSeule(), etat.acces(), declarationsAVerifier);
  }
}
