package tg.academiablanc.security;

import java.util.Locale;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tg.academiablanc.domain.Role;
import tg.academiablanc.domain.Utilisateur;
import tg.academiablanc.repo.UtilisateurRepository;

/**
 * Compte du propriétaire du logiciel, piloté par les variables d'environnement.
 *
 * <p>{@code SUPER_ADMIN_EMAIL} désigne le compte. Au démarrage :
 * <ul>
 *   <li>s'il n'existe pas et que {@code SUPER_ADMIN_PASSWORD} est fourni, il est créé directement
 *       (rôle {@code SUPER_ADMIN}, aucun établissement) : le propriétaire n'a pas à s'inscrire ;</li>
 *   <li>s'il existe, il reçoit le rôle et, si le mot de passe fourni ne correspond plus au hash,
 *       le mot de passe est remplacé (réinitialisation depuis les variables du service).</li>
 * </ul>
 * L'inscription ne passe jamais par ici : un compte créé par le formulaire reste OWNER.
 * Le mot de passe n'est jamais écrit dans les journaux.
 */
@Service
public class PlatformOwnerService implements ApplicationListener<ApplicationReadyEvent> {
  private static final Logger log = LoggerFactory.getLogger(PlatformOwnerService.class);
  static final String NOM_PROPRIETAIRE = "Propriétaire de la plateforme";

  private final UtilisateurRepository utilisateurs;
  private final PasswordEncoder passwordEncoder;
  private final String superAdminEmail;
  private final String superAdminPassword;

  public PlatformOwnerService(
      UtilisateurRepository utilisateurs,
      PasswordEncoder passwordEncoder,
      @Value("${app.platform.super-admin-email:}") String superAdminEmail,
      @Value("${app.platform.super-admin-password:}") String superAdminPassword
  ) {
    this.utilisateurs = utilisateurs;
    this.passwordEncoder = passwordEncoder;
    this.superAdminEmail = normalize(superAdminEmail);
    this.superAdminPassword = superAdminPassword == null ? "" : superAdminPassword;
  }

  @Override
  @Transactional
  public void onApplicationEvent(ApplicationReadyEvent event) {
    synchronize();
  }

  /**
   * Vrai quand {@code SUPER_ADMIN_EMAIL} est posé et qu'un compte porte cet email : l'accès
   * d'administration de la plateforme est utilisable. Ne révèle rien sur les autres comptes.
   */
  @Transactional(readOnly = true)
  public boolean estInitialise() {
    return !superAdminEmail.isEmpty() && utilisateurs.findByEmailIgnoreCase(superAdminEmail).isPresent();
  }

  @Transactional
  public Utilisateur alignOnLogin(Utilisateur user) {
    if (user.getEmail() != null && superAdminEmail.equals(normalize(user.getEmail()))) {
      return grant(user);
    }
    if (user.getRole() == Role.SUPER_ADMIN) {
      user.setRole(Role.OWNER);
      return utilisateurs.save(user);
    }
    return user;
  }

  /** Aligne la base sur les variables d'environnement. Idempotent : rejouable à chaque démarrage. */
  @Transactional
  public void synchronize() {
    for (Utilisateur user : utilisateurs.findByRole(Role.SUPER_ADMIN)) {
      if (!superAdminEmail.equals(normalize(user.getEmail()))) {
        user.setRole(Role.OWNER);
        utilisateurs.save(user);
      }
    }
    if (superAdminEmail.isEmpty()) return;

    Optional<Utilisateur> existant = utilisateurs.findByEmailIgnoreCase(superAdminEmail);
    if (existant.isPresent()) {
      Utilisateur user = grant(existant.get());
      if (!superAdminPassword.isBlank() && !passwordEncoder.matches(superAdminPassword, user.getMotDePasseHash())) {
        user.setMotDePasseHash(passwordEncoder.encode(superAdminPassword));
        utilisateurs.save(user);
        log.info("Mot de passe du propriétaire de la plateforme ({}) mis à jour depuis SUPER_ADMIN_PASSWORD.", superAdminEmail);
      }
      return;
    }

    if (superAdminPassword.isBlank()) {
      log.warn("SUPER_ADMIN_EMAIL={} est défini mais aucun compte n'existe avec cet email et SUPER_ADMIN_PASSWORD est vide : "
          + "le compte du propriétaire de la plateforme n'a pas été créé. Posez SUPER_ADMIN_PASSWORD puis redémarrez l'API.",
          superAdminEmail);
      return;
    }
    Utilisateur proprietaire = new Utilisateur();
    proprietaire.setEtablissementId(null);
    proprietaire.setEmail(superAdminEmail);
    proprietaire.setNom(NOM_PROPRIETAIRE);
    proprietaire.setRole(Role.SUPER_ADMIN);
    proprietaire.setActif(true);
    proprietaire.setCreePar(null);
    proprietaire.setMotDePasseHash(passwordEncoder.encode(superAdminPassword));
    utilisateurs.save(proprietaire);
    log.info("Compte du propriétaire de la plateforme créé pour {} (SUPER_ADMIN, sans établissement).", superAdminEmail);
  }

  private Utilisateur grant(Utilisateur user) {
    if (user.getRole() == Role.SUPER_ADMIN) return user;
    user.setRole(Role.SUPER_ADMIN);
    return utilisateurs.save(user);
  }

  private static String normalize(String email) {
    if (email == null) return "";
    return email.trim().toLowerCase(Locale.ROOT);
  }
}
