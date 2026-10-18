package tg.academiablanc.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
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
    Utilisateur user = utilisateurs.findByEmailIgnoreCase(request.email().trim())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email ou mot de passe incorrect."));
    if (!passwordEncoder.matches(request.motDePasse(), user.getMotDePasseHash())) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email ou mot de passe incorrect.");
    }
    if (!user.isActif()) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Compte désactivé. Contactez le responsable de l’établissement.");
    }
    user = platformOwners.alignOnLogin(user);
    Etablissement school = etablissementDe(user);
    if (school != null && !school.isActif() && user.getRole() != Role.SUPER_ADMIN) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Établissement désactivé par la plateforme.");
    }
    return reponse(user, school);
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
