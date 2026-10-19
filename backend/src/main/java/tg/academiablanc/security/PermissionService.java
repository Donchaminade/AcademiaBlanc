package tg.academiablanc.security;

import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tg.academiablanc.domain.Action;
import tg.academiablanc.domain.PermissionUtilisateur;
import tg.academiablanc.domain.Ressource;
import tg.academiablanc.domain.Role;
import tg.academiablanc.domain.Utilisateur;
import tg.academiablanc.repo.EtablissementRepository;
import tg.academiablanc.repo.PermissionUtilisateurRepository;
import tg.academiablanc.repo.UtilisateurRepository;

/**
 * Résolution et contrôle des permissions fines.
 *
 * <ul>
 *   <li>OWNER détient toujours tous les droits de son établissement ; SUPER_ADMIN détient tout (établissement et plateforme),
 *       ou seulement la plateforme s’il n’est rattaché à aucun établissement. Ni l’un ni l’autre ne peut être restreint.</li>
 *   <li>Les autres rôles sont des préréglages : à la création d’un compte, la matrice du rôle est copiée dans
 *       {@code permission_utilisateur}, puis librement ajustée case par case.</li>
 *   <li>Un compte sans aucune ligne de permission (créé avant cette fonctionnalité) hérite du préréglage de son rôle.</li>
 *   <li>Les droits sont relus en base à chaque requête : une restriction s’applique immédiatement, sans nouveau jeton.</li>
 * </ul>
 */
@Service
public class PermissionService {
  private final UtilisateurRepository utilisateurs;
  private final PermissionUtilisateurRepository permissions;
  private final EtablissementRepository etablissements;

  public PermissionService(
      UtilisateurRepository utilisateurs,
      PermissionUtilisateurRepository permissions,
      EtablissementRepository etablissements
  ) {
    this.utilisateurs = utilisateurs;
    this.permissions = permissions;
    this.etablissements = etablissements;
  }

  /** Une case de la matrice. Code textuel : {@code RESSOURCE:ACTION}. */
  public record Droit(Ressource ressource, Action action) {
    public String code() {
      return ressource.name() + ":" + action.name();
    }

    /** Analyse « RESSOURCE:ACTION ». Rejette les couples sans signification pour la ressource. */
    public static Droit depuis(String code) {
      String[] parts = code == null ? new String[0] : code.trim().toUpperCase().split(":");
      if (parts.length != 2) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Permission invalide : « " + code + " » (attendu RESSOURCE:ACTION).");
      }
      Ressource ressource;
      Action action;
      try {
        ressource = Ressource.valueOf(parts[0]);
        action = Action.valueOf(parts[1]);
      } catch (IllegalArgumentException ex) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Permission inconnue : « " + code + " ».");
      }
      if (!ressource.accepte(action)) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "L’action " + action + " ne s’applique pas à " + ressource + ".");
      }
      return new Droit(ressource, action);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Contrôle d’accès                                                    */
  /* ------------------------------------------------------------------ */

  /**
   * Charge l’utilisateur du jeton courant et vérifie que son compte (et son établissement) sont actifs.
   * 401 si le jeton ne correspond plus à un compte.
   */
  public Utilisateur courant() {
    CurrentUser jeton = Tenant.current();
    Utilisateur user = utilisateurs.findById(jeton.userId())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Compte introuvable. Reconnectez-vous."));
    if (!user.isActif()) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Compte désactivé. Contactez le responsable de l’établissement.");
    }
    if (user.getEtablissementId() != null && user.getRole() != Role.SUPER_ADMIN) {
      boolean etablissementActif = etablissements.findById(user.getEtablissementId())
          .map(e -> e.isActif())
          .orElse(false);
      if (!etablissementActif) {
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Établissement désactivé par la plateforme.");
      }
    }
    return user;
  }

  /**
   * Chef d'établissement : le créateur du compte (OWNER) ou un administrateur de l'école (ADMIN). Seuls ces
   * rôles voient et régénèrent le code de transfert de l'établissement.
   */
  public static boolean estChefEtablissement(Utilisateur user) {
    return user != null && user.getEtablissementId() != null && (user.getRole() == Role.OWNER || user.getRole() == Role.ADMIN);
  }

  /** Exige {@code ressource:action} pour l’utilisateur courant ; 403 avec un message explicite sinon. */
  public Utilisateur exiger(Ressource ressource, Action action) {
    Utilisateur user = courant();
    if (!peut(user, ressource, action)) {
      throw refus(ressource, action);
    }
    return user;
  }

  public static ResponseStatusException refus(Ressource ressource, Action action) {
    return new ResponseStatusException(HttpStatus.FORBIDDEN, "Action non autorisée : " + action.name() + " sur " + ressource.name());
  }

  public boolean peut(Utilisateur user, Ressource ressource, Action action) {
    if (!ressource.accepte(action)) return false;
    return droitsDe(user).contains(new Droit(ressource, action));
  }

  /* ------------------------------------------------------------------ */
  /* Résolution                                                          */
  /* ------------------------------------------------------------------ */

  /** Droits effectifs d’un utilisateur. */
  public Set<Droit> droitsDe(Utilisateur user) {
    Role role = user.getRole();
    if (role == Role.SUPER_ADMIN) {
      // Propriétaire créé au démarrage : aucun établissement, donc aucune donnée pédagogique à atteindre.
      if (user.getEtablissementId() == null) return tous(Ressource.plateforme());
      return tous(EnumSet.allOf(Ressource.class));
    }
    if (role == Role.OWNER) return tous(Ressource.etablissement());
    List<PermissionUtilisateur> lignes = permissions.findByUtilisateurId(user.getId());
    if (lignes.isEmpty()) return prereglage(role);
    Set<Droit> droits = new LinkedHashSet<>();
    Set<Ressource> domaine = domaine(role);
    boolean transfertsRegles = false;
    for (PermissionUtilisateur ligne : lignes) {
      if (ligne.getRessource() == Ressource.TRANSFERTS) transfertsRegles = true;
      if (ligne.isAccorde() && domaine.contains(ligne.getRessource()) && ligne.getRessource().accepte(ligne.getAction())) {
        droits.add(new Droit(ligne.getRessource(), ligne.getAction()));
      }
    }
    // Les transferts d'examen blanc sont accordés d'office à l'administrateur de l'école : un compte ADMIN dont
    // la matrice a été enregistrée avant l'existence de cette ressource les reçoit tant qu'elle n'est pas re-saisie.
    if (role == Role.ADMIN && !transfertsRegles) droits.addAll(tous(List.of(Ressource.TRANSFERTS)));
    return droits;
  }

  /** Codes « RESSOURCE:ACTION » triés, pour la réponse de connexion et le front. */
  public List<String> codesDe(Utilisateur user) {
    return droitsDe(user).stream().map(Droit::code).sorted().toList();
  }

  /** Ressources sur lesquelles un rôle peut recevoir des droits. */
  public static Set<Ressource> domaine(Role role) {
    return role.estPlateforme() ? Ressource.plateforme() : Ressource.etablissement();
  }

  public static Set<Droit> tous(Collection<Ressource> ressources) {
    Set<Droit> droits = new LinkedHashSet<>();
    for (Ressource r : ressources) {
      for (Action a : r.actionsApplicables()) droits.add(new Droit(r, a));
    }
    return droits;
  }

  /** Préréglage d’un rôle : point de départ copié à la création, puis ajustable. */
  public static Set<Droit> prereglage(Role role) {
    Set<Droit> droits = new LinkedHashSet<>();
    switch (role) {
      case OWNER -> droits.addAll(tous(Ressource.etablissement()));
      case SUPER_ADMIN -> droits.addAll(tous(EnumSet.allOf(Ressource.class)));
      case ADMIN -> {
        droits.addAll(tous(Ressource.etablissement()));
        droits.removeIf(d -> d.ressource() == Ressource.UTILISATEURS && d.action() != Action.VOIR && d.action() != Action.DETAILS);
      }
      case SECRETAIRE -> {
        for (Ressource r : Ressource.etablissement()) {
          if (r == Ressource.UTILISATEURS || r == Ressource.TRANSFERTS) continue;
          if (r.accepte(Action.VOIR)) droits.add(new Droit(r, Action.VOIR));
          if (r.accepte(Action.DETAILS)) droits.add(new Droit(r, Action.DETAILS));
        }
        ajouter(droits, Ressource.ELEVES, Action.CREER, Action.MODIFIER);
        ajouter(droits, Ressource.NOTES, Action.CREER, Action.MODIFIER);
        ajouter(droits, Ressource.BULLETINS, Action.CREER, Action.IMPRIMER);
      }
      case ENSEIGNANT -> {
        for (Ressource r : List.of(Ressource.ANNEES, Ressource.CENTRES, Ressource.SESSIONS, Ressource.MATIERES,
            Ressource.COEFFICIENTS, Ressource.ENSEIGNANTS, Ressource.CLASSES, Ressource.SERIES, Ressource.AFFECTATIONS,
            Ressource.ELEVES)) {
          droits.add(new Droit(r, Action.VOIR));
        }
        // Saisie des notes limitée à ses propres affectations : règle complémentaire dans SchoolController.
        ajouter(droits, Ressource.NOTES, Action.VOIR, Action.DETAILS, Action.CREER, Action.MODIFIER);
        ajouter(droits, Ressource.BULLETINS, Action.VOIR);
      }
      case GESTIONNAIRE_PLATEFORME -> {
        ajouter(droits, Ressource.ETABLISSEMENTS, Action.VOIR, Action.DETAILS);
        ajouter(droits, Ressource.GESTIONNAIRES, Action.VOIR);
        ajouter(droits, Ressource.TYPES_EXAMEN, Action.VOIR);
        ajouter(droits, Ressource.PREREGLAGES, Action.VOIR);
      }
    }
    return droits;
  }

  private static void ajouter(Set<Droit> droits, Ressource ressource, Action... actions) {
    for (Action a : actions) droits.add(new Droit(ressource, a));
  }

  /* ------------------------------------------------------------------ */
  /* Écriture                                                            */
  /* ------------------------------------------------------------------ */

  /**
   * Remplace la matrice complète d’un utilisateur. Toutes les cases applicables au domaine de son rôle
   * sont enregistrées (accordées ou non), pour qu’un compte explicitement restreint ne retombe jamais sur le préréglage.
   */
  @Transactional
  public void remplacer(Utilisateur cible, Set<Droit> accordes) {
    if (cible.getRole().estIntouchable()) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Les droits de ce compte sont complets et ne se modifient pas.");
    }
    permissions.supprimerPour(cible.getId());
    permissions.flush();
    List<PermissionUtilisateur> lignes = new ArrayList<>();
    for (Droit droit : tous(domaine(cible.getRole()))) {
      lignes.add(new PermissionUtilisateur(cible.getId(), droit.ressource(), droit.action(), accordes.contains(droit)));
    }
    permissions.saveAll(lignes);
  }

  /** 403 si l’auteur tente d’accorder un droit qu’il ne détient pas lui-même. */
  public void verifierDelegation(Utilisateur auteur, Set<Droit> accordes) {
    Set<Droit> siens = droitsDe(auteur);
    List<String> manquants = accordes.stream().filter(d -> !siens.contains(d)).map(Droit::code).sorted().toList();
    if (!manquants.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN,
          "Vous ne pouvez pas accorder un droit que vous ne détenez pas : " + String.join(", ", manquants));
    }
  }

  /** Droits d’un préréglage limités à ceux de l’auteur (un responsable restreint ne délègue pas plus que lui-même). */
  public Set<Droit> prereglageDelegable(Utilisateur auteur, Role role) {
    Set<Droit> siens = droitsDe(auteur);
    Set<Droit> resultat = new LinkedHashSet<>(prereglage(role));
    resultat.retainAll(siens);
    return resultat;
  }

  /** Convertit une liste de codes en droits, en ignorant les doublons. */
  public static Set<Droit> depuisCodes(Collection<String> codes) {
    Set<Droit> droits = new HashSet<>();
    if (codes == null) return droits;
    for (String code : codes) droits.add(Droit.depuis(code));
    return droits;
  }
}
