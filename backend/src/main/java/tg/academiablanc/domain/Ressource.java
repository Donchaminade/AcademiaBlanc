package tg.academiablanc.domain;

import java.util.EnumSet;
import java.util.Set;

/**
 * Ressources soumises aux permissions fines.
 * Les ressources « établissement » sont cloisonnées par etablissement_id ;
 * les ressources « plateforme » ne concernent que le propriétaire du logiciel et ses gestionnaires.
 */
public enum Ressource {
  ANNEES(false, Action.CRUD),
  CENTRES(false, Action.CRUD),
  SESSIONS(false, Action.CRUD),
  MATIERES(false, Action.CRUD),
  COEFFICIENTS(false, Action.CRUD),
  ENSEIGNANTS(false, Action.CRUD),
  CLASSES(false, Action.CRUD),
  /** Référentiel des séries du lycée (générales et techniques). */
  SERIES(false, Action.CRUD),
  AFFECTATIONS(false, Action.CRUD),
  ELEVES(false, Action.CRUD),
  NOTES(false, Action.CRUD),
  /** VOIR = consulter les bulletins, CREER = générer / recalculer, IMPRIMER = imprimer ou télécharger. */
  BULLETINS(false, EnumSet.of(Action.VOIR, Action.CREER, Action.IMPRIMER)),
  /** Paramètres d’affichage de l’établissement (écran Paramètres). */
  PARAMETRES(false, EnumSet.of(Action.VOIR, Action.MODIFIER)),
  /** Comptes des utilisateurs de l’établissement et leurs droits. */
  UTILISATEURS(false, Action.CRUD),
  /** Plateforme : établissements inscrits. SUPPRIMER désactive, MODIFIER réactive. */
  ETABLISSEMENTS(true, Action.CRUD),
  /** Plateforme : gestionnaires (sous-administrateurs) du logiciel. */
  GESTIONNAIRES(true, Action.CRUD);

  private final boolean plateforme;
  private final Set<Action> actions;

  Ressource(boolean plateforme, Set<Action> actions) {
    this.plateforme = plateforme;
    this.actions = actions;
  }

  public boolean estPlateforme() {
    return plateforme;
  }

  /** Actions qui ont un sens pour cette ressource. */
  public Set<Action> actionsApplicables() {
    return actions;
  }

  public boolean accepte(Action action) {
    return actions.contains(action);
  }

  public static Set<Ressource> etablissement() {
    EnumSet<Ressource> set = EnumSet.noneOf(Ressource.class);
    for (Ressource r : values()) if (!r.plateforme) set.add(r);
    return set;
  }

  public static Set<Ressource> plateforme() {
    EnumSet<Ressource> set = EnumSet.noneOf(Ressource.class);
    for (Ressource r : values()) if (r.plateforme) set.add(r);
    return set;
  }
}
