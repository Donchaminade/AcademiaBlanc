package tg.academiablanc.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import tg.academiablanc.domain.Etablissement;
import tg.academiablanc.domain.Role;
import tg.academiablanc.domain.Utilisateur;
import tg.academiablanc.repo.EtablissementRepository;
import tg.academiablanc.repo.UtilisateurRepository;
import tg.academiablanc.security.JwtService;
import tg.academiablanc.security.PermissionService;
import tg.academiablanc.security.PlatformOwnerService;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
  private final EtablissementRepository etablissements;
  private final UtilisateurRepository utilisateurs;
  private final EtablissementService creation;
  private final PasswordEncoder passwordEncoder;
  private final JwtService jwtService;
  private final PlatformOwnerService platformOwners;
  private final PermissionService droits;

  public AuthController(
      EtablissementRepository etablissements,
      UtilisateurRepository utilisateurs,
      EtablissementService creation,
      PasswordEncoder passwordEncoder,
      JwtService jwtService,
      PlatformOwnerService platformOwners,
      PermissionService droits
  ) {
    this.etablissements = etablissements;
    this.utilisateurs = utilisateurs;
    this.creation = creation;
    this.passwordEncoder = passwordEncoder;
    this.jwtService = jwtService;
    this.platformOwners = platformOwners;
    this.droits = droits;
  }

  public record SignupRequest(
      @NotBlank @Size(max = 180) String nom,
      @NotBlank @Size(max = 120) String ville,
      @NotBlank @Email @Size(max = 180) String email,
      @NotBlank @Size(min = 6, max = 80) String motDePasse,
      @NotBlank @Size(max = 180) String nomResponsable,
      @Size(max = 40) String telephone,
      @Size(max = 120) String region,
      @Size(max = 160) String typeEtablissement
  ) {}

  public record LoginRequest(
      @NotBlank @Size(max = 180) String email,
      @NotBlank @Size(max = 80) String motDePasse
  ) {}

  /** Réponse de connexion. {@code permissions} = codes « RESSOURCE:ACTION » détenus, pour masquer l’interface. */
  public record AuthResponse(
      String token,
      Long utilisateurId,
      Long etablissementId,
      String role,
      String nomEtablissement,
      String email,
      String nomUtilisateur,
      List<String> permissions
  ) {}

  /** Compte courant, relu en base : rôle, établissement et permissions à jour. */
  public record MeResponse(
      Long utilisateurId,
      Long etablissementId,
      String role,
      String nomEtablissement,
      String email,
      String nomUtilisateur,
      boolean actif,
      List<String> permissions
  ) {}

  @PostMapping("/signup")
  public AuthResponse signup(@Valid @RequestBody SignupRequest request) {
    EtablissementService.Creation created = creation.creer(
        request.nom(), request.ville(), request.email(), request.motDePasse(), request.nomResponsable(),
        request.telephone(), request.region(), request.typeEtablissement(), null);
    return reponse(created.owner(), created.etablissement());
  }

  @PostMapping("/login")
  public AuthResponse login(@Valid @RequestBody LoginRequest request) {
    Utilisateur user = authentifier(request);
    Etablissement school = etablissementDe(user);
    if (school != null && !school.isActif() && user.getRole() != Role.SUPER_ADMIN) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Établissement désactivé par la plateforme.");
    }
    return reponse(user, school);
  }

  /**
   * Connexion réservée à l'administration de la plateforme (page {@code /admin} du front).
   * Mêmes identifiants que {@code /login}, mais seuls les rôles de plateforme (SUPER_ADMIN,
   * GESTIONNAIRE_PLATEFORME) obtiennent un jeton ; un compte d'établissement reçoit 403.
   * Tant qu'aucun compte ne correspond à SUPER_ADMIN_EMAIL, la réponse est un 401 explicite
   * qui ne confirme l'existence d'aucun autre compte.
   */
  @PostMapping("/login-plateforme")
  public AuthResponse loginPlateforme(@Valid @RequestBody LoginRequest request) {
    if (!platformOwners.estInitialise()) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, MESSAGE_PLATEFORME_NON_INITIALISEE);
    }
    Utilisateur user = authentifier(request);
    if (!user.getRole().estPlateforme()) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, MESSAGE_COMPTE_NON_PLATEFORME);
    }
    return reponse(user, etablissementDe(user));
  }

  public static final String MESSAGE_IDENTIFIANTS = "Email ou mot de passe incorrect.";
  public static final String MESSAGE_PLATEFORME_NON_INITIALISEE =
      "Compte de la plateforme non initialisé : vérifiez SUPER_ADMIN_EMAIL et SUPER_ADMIN_PASSWORD sur le serveur.";
  public static final String MESSAGE_COMPTE_NON_PLATEFORME =
      "Ce compte n’est pas un compte d’administration de la plateforme. Utilisez /connexion.";

  /** Vérifie email + mot de passe, l'état actif, puis aligne le rôle plateforme sur SUPER_ADMIN_EMAIL. */
  private Utilisateur authentifier(LoginRequest request) {
    Utilisateur user = utilisateurs.findByEmailIgnoreCase(request.email().trim())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, MESSAGE_IDENTIFIANTS));
    if (!passwordEncoder.matches(request.motDePasse(), user.getMotDePasseHash())) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, MESSAGE_IDENTIFIANTS);
    }
    if (!user.isActif()) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Compte désactivé. Contactez le responsable de l’établissement.");
    }
    return platformOwners.alignOnLogin(user);
  }

  @GetMapping("/me")
  public MeResponse me() {
    Utilisateur user = droits.courant();
    Etablissement school = etablissementDe(user);
    return new MeResponse(
        user.getId(),
        user.getEtablissementId(),
        user.getRole().name(),
        school == null ? null : school.getNom(),
        user.getEmail(),
        user.getNom(),
        user.isActif(),
        droits.codesDe(user));
  }

  public record MotDePasseRequest(
      @NotBlank @Size(max = 80) String ancienMotDePasse,
      @NotBlank @Size(min = 6, max = 80) String nouveauMotDePasse
  ) {}

  public static final String MESSAGE_ANCIEN_MOT_DE_PASSE = "L’ancien mot de passe est incorrect.";
  public static final String MESSAGE_MOT_DE_PASSE_IDENTIQUE = "Le nouveau mot de passe doit différer de l’ancien.";

  /** Changement du mot de passe du compte courant : l'ancien est vérifié, le nouveau est haché en BCrypt. */
  @PutMapping("/mot-de-passe")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Transactional
  public void changerMotDePasse(@Valid @RequestBody MotDePasseRequest request) {
    Utilisateur user = droits.courant();
    if (!passwordEncoder.matches(request.ancienMotDePasse(), user.getMotDePasseHash())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, MESSAGE_ANCIEN_MOT_DE_PASSE);
    }
    if (request.ancienMotDePasse().equals(request.nouveauMotDePasse())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, MESSAGE_MOT_DE_PASSE_IDENTIQUE);
    }
    user.setMotDePasseHash(passwordEncoder.encode(request.nouveauMotDePasse()));
    utilisateurs.save(user);
  }

  private Etablissement etablissementDe(Utilisateur user) {
    if (user.getEtablissementId() == null) return null;
    return etablissements.findById(user.getEtablissementId())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Établissement introuvable."));
  }

  private AuthResponse reponse(Utilisateur user, Etablissement school) {
    return new AuthResponse(
        jwtService.create(user),
        user.getId(),
        school == null ? null : school.getId(),
        user.getRole().name(),
        school == null ? "Plateforme AcademiaBlanc" : school.getNom(),
        user.getEmail(),
        user.getNom(),
        droits.codesDe(user));
  }
}
