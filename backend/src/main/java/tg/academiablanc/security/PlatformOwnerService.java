package tg.academiablanc.security;

import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tg.academiablanc.domain.Role;
import tg.academiablanc.domain.Utilisateur;
import tg.academiablanc.repo.UtilisateurRepository;

/**
 * Désigne le propriétaire du logiciel par email, sans créer de mot de passe.
 * L'inscription ne passe jamais par ici : un compte créé reste OWNER.
 */
@Service
public class PlatformOwnerService implements ApplicationListener<ApplicationReadyEvent> {
  private final UtilisateurRepository utilisateurs;
  private final String superAdminEmail;

  public PlatformOwnerService(
      UtilisateurRepository utilisateurs,
      @Value("${app.platform.super-admin-email:}") String superAdminEmail
  ) {
    this.utilisateurs = utilisateurs;
    this.superAdminEmail = normalize(superAdminEmail);
  }

  @Override
  @Transactional
  public void onApplicationEvent(ApplicationReadyEvent event) {
    synchronize();
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

  private void synchronize() {
    for (Utilisateur user : utilisateurs.findByRole(Role.SUPER_ADMIN)) {
      if (!superAdminEmail.equals(normalize(user.getEmail()))) {
        user.setRole(Role.OWNER);
        utilisateurs.save(user);
      }
    }
    if (superAdminEmail.isEmpty()) return;
    utilisateurs.findByEmailIgnoreCase(superAdminEmail).ifPresent(this::grant);
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
