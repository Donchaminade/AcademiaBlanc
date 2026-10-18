package tg.academiablanc.api;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tg.academiablanc.domain.Action;
import tg.academiablanc.domain.Professeur;
import tg.academiablanc.domain.Ressource;
import tg.academiablanc.domain.Role;
import tg.academiablanc.domain.Utilisateur;
import tg.academiablanc.repo.EtablissementRepository;
import tg.academiablanc.repo.PermissionUtilisateurRepository;
import tg.academiablanc.repo.ProfesseurRepository;
import tg.academiablanc.repo.UtilisateurRepository;
import tg.academiablanc.security.PermissionService;
import tg.academiablanc.security.PermissionService.Droit;

/**
 * Opérations communes aux comptes d’établissement (/api/utilisateurs) et aux gestionnaires
 * de la plateforme (/api/plateforme/gestionnaires) : création, matrice de droits, mot de passe, suppression.
 */
@Service
public class UtilisateursService {
  private final UtilisateurRepository utilisateurs;
  private final PermissionUtilisateurRepository permissions;
  private final ProfesseurRepository professeurs;
  private final EtablissementRepository etablissements;
  private final PasswordEncoder passwordEncoder;
  private final PermissionService droits;

  public UtilisateursService(
      UtilisateurRepository utilisateurs,
      PermissionUtilisateurRepository permissions,
      ProfesseurRepository professeurs,
      EtablissementRepository etablissements,
      PasswordEncoder passwordEncoder,
      PermissionService droits
  ) {
    this.utilisateurs = utilisateurs;
    this.permissions = permissions;
    this.professeurs = professeurs;
    this.etablissements = etablissements;
    this.passwordEncoder = passwordEncoder;
    this.droits = droits;
  }

  /** Fiche renvoyée au front. {@code permissions} est null quand l’appelant n’a pas le droit DETAILS. */
  public record Vue(
      Long id,
      String nom,
      String email,
      String role,
      boolean actif,
      Long etablissementId,
      Long professeurId,
      Long creePar,
      /** Faux pour OWNER et SUPER_ADMIN : droits complets, non modifiables. */
      boolean restreignable,
      List<String> permissions
  ) {}

  /** Description de la matrice (ressources et actions applicables) et des préréglages, pour l’éditeur du front. */
  public record Referentiel(
      List<RessourceVue> ressources,
      Map<String, List<String>> prereglages
  ) {}

  public record RessourceVue(String code, List<String> actions) {}

  public Vue vue(Utilisateur user, boolean avecDetails) {
    Long professeurId = null;
    if (user.getRole() == Role.ENSEIGNANT) {
      professeurId = professeurs.findByUtilisateurId(user.getId()).stream().map(Professeur::getId).findFirst().orElse(null);
    }
    return new Vue(
        user.getId(),
        user.getNom(),
        avecDetails ? user.getEmail() : masquer(user.getEmail()),
        user.getRole().name(),
        user.isActif(),
        user.getEtablissementId(),
        professeurId,
        avecDetails ? user.getCreePar() : null,
        !user.getRole().estIntouchable(),
        avecDetails ? droits.codesDe(user) : null);
  }

  public Referentiel referentiel(boolean plateforme, List<Role> roles) {
    Set<Ressource> ressources = plateforme ? Ressource.plateforme() : Ressource.etablissement();
    List<RessourceVue> vues = ressources.stream()
        .map(r -> new RessourceVue(r.name(), r.actionsApplicables().stream().map(Action::name).toList()))
        .toList();
    Map<String, List<String>> prereglages = new LinkedHashMap<>();
    for (Role role : roles) {
      prereglages.put(role.name(), PermissionService.prereglage(role).stream().map(Droit::code).sorted().toList());
    }
    return new Referentiel(vues, prereglages);
  }

  /**
   * Crée un compte avec le préréglage de son rôle (limité aux droits de l’auteur), ou avec la matrice
   * fournie si {@code codes} est non nul (chaque droit doit alors être détenu par l’auteur).
   */
  @Transactional
  public Utilisateur creer(Utilisateur auteur, String nom, String email, String motDePasse, Role role,
                           Long etablissementId, Collection<String> codes, Long professeurId) {
    String normalise = EtablissementService.normaliser(email);
    if (normalise.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "L’email est obligatoire.");
    }
    if (utilisateurs.findByEmailIgnoreCase(normalise).isPresent() || etablissements.findByEmailIgnoreCase(normalise).isPresent()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Cet email est déjà utilisé.");
    }
    Utilisateur user = new Utilisateur();
    user.setNom(nom.trim());
    user.setEmail(normalise);
    user.setMotDePasseHash(passwordEncoder.encode(motDePasse));
    user.setRole(role);
    user.setEtablissementId(etablissementId);
    user.setActif(true);
    user.setCreePar(auteur.getId());
    user = utilisateurs.save(user);

    Set<Droit> accordes;
    if (codes != null) {
      accordes = PermissionService.depuisCodes(codes);
      droits.verifierDelegation(auteur, accordes);
    } else {
      accordes = droits.prereglageDelegable(auteur, role);
    }
    droits.remplacer(user, accordes);
    lierProfesseur(user, professeurId);
    return user;
  }

  @Transactional
  public void definirPermissions(Utilisateur auteur, Utilisateur cible, Collection<String> codes) {
    interdireSoi(auteur, cible, "Vous ne pouvez pas modifier vos propres droits.");
    Set<Droit> accordes = PermissionService.depuisCodes(codes);
    droits.verifierDelegation(auteur, accordes);
    droits.remplacer(cible, accordes);
  }

  /** Réapplique le préréglage du rôle de la cible (limité aux droits de l’auteur). */
  @Transactional
  public void appliquerPrereglage(Utilisateur auteur, Utilisateur cible) {
    interdireSoi(auteur, cible, "Vous ne pouvez pas modifier vos propres droits.");
    droits.remplacer(cible, droits.prereglageDelegable(auteur, cible.getRole()));
  }

  @Transactional
  public Utilisateur modifier(Utilisateur auteur, Utilisateur cible, String nom, String email, Role role, Boolean actif, Long professeurId) {
    interdireSoi(auteur, cible, "Modifiez votre propre compte depuis votre profil, pas depuis cette liste.");
    interdireIntouchable(cible);
    if (nom != null && !nom.isBlank()) cible.setNom(nom.trim());
    if (email != null && !email.isBlank()) {
      String normalise = EtablissementService.normaliser(email);
      boolean prisParAutre = utilisateurs.findByEmailIgnoreCase(normalise).map(u -> !u.getId().equals(cible.getId())).orElse(false)
          || etablissements.findByEmailIgnoreCase(normalise).isPresent();
      if (prisParAutre) throw new ResponseStatusException(HttpStatus.CONFLICT, "Cet email est déjà utilisé.");
      cible.setEmail(normalise);
    }
    if (role != null && role != cible.getRole()) {
      cible.setRole(role);
      // Changer de rôle repart du préréglage du nouveau rôle.
      droits.remplacer(cible, droits.prereglageDelegable(auteur, role));
    }
    if (actif != null) cible.setActif(actif);
    Utilisateur saved = utilisateurs.save(cible);
    if (professeurId != null) lierProfesseur(saved, professeurId);
    return saved;
  }

  @Transactional
  public void reinitialiserMotDePasse(Utilisateur auteur, Utilisateur cible, String motDePasse) {
    interdireSoi(auteur, cible, "Utilisez le changement de mot de passe de votre profil.");
    interdireIntouchable(cible);
    if (motDePasse == null || motDePasse.length() < 6) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le mot de passe temporaire doit contenir au moins 6 caractères.");
    }
    cible.setMotDePasseHash(passwordEncoder.encode(motDePasse));
    utilisateurs.save(cible);
  }

  @Transactional
  public void supprimer(Utilisateur auteur, Utilisateur cible) {
    interdireSoi(auteur, cible, "Vous ne pouvez pas supprimer votre propre compte.");
    interdireIntouchable(cible);
    for (Professeur prof : professeurs.findByUtilisateurId(cible.getId())) {
      prof.setUtilisateurId(null);
      professeurs.save(prof);
    }
    for (Utilisateur cree : utilisateurs.findAll()) {
      if (cible.getId().equals(cree.getCreePar())) {
        cree.setCreePar(null);
        utilisateurs.save(cree);
      }
    }
    permissions.supprimerPour(cible.getId());
    utilisateurs.delete(cible);
    utilisateurs.flush();
  }

  private void lierProfesseur(Utilisateur user, Long professeurId) {
    if (professeurId == null) return;
    if (user.getRole() != Role.ENSEIGNANT) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Seul un compte ENSEIGNANT se relie à une fiche enseignant.");
    }
    Professeur prof = professeurs.findById(professeurId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Fiche enseignant introuvable."));
    if (prof.getEtablissementId() == null || !prof.getEtablissementId().equals(user.getEtablissementId())) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Fiche enseignant introuvable.");
    }
    for (Professeur autre : professeurs.findByUtilisateurId(user.getId())) {
      if (!autre.getId().equals(prof.getId())) {
        autre.setUtilisateurId(null);
        professeurs.save(autre);
      }
    }
    prof.setUtilisateurId(user.getId());
    professeurs.save(prof);
  }

  private static void interdireSoi(Utilisateur auteur, Utilisateur cible, String message) {
    if (auteur.getId().equals(cible.getId())) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, message);
    }
  }

  private static void interdireIntouchable(Utilisateur cible) {
    if (cible.getRole().estIntouchable()) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Ce compte ne peut pas être modifié ni supprimé par un autre utilisateur.");
    }
  }

  private static String masquer(String email) {
    if (email == null) return null;
    int at = email.indexOf('@');
    if (at <= 1) return email;
    return email.charAt(0) + "…" + email.substring(at);
  }
}
