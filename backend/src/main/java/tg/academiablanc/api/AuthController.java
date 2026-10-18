package tg.academiablanc.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import tg.academiablanc.domain.AnneeScolaire;
import tg.academiablanc.domain.Etablissement;
import tg.academiablanc.domain.Role;
import tg.academiablanc.domain.Utilisateur;
import tg.academiablanc.repo.AnneeScolaireRepository;
import tg.academiablanc.repo.EtablissementRepository;
import tg.academiablanc.repo.UtilisateurRepository;
import tg.academiablanc.security.JwtService;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
  private final EtablissementRepository etablissements;
  private final UtilisateurRepository utilisateurs;
  private final AnneeScolaireRepository annees;
  private final PasswordEncoder passwordEncoder;
  private final JwtService jwtService;

  public AuthController(
      EtablissementRepository etablissements,
      UtilisateurRepository utilisateurs,
      AnneeScolaireRepository annees,
      PasswordEncoder passwordEncoder,
      JwtService jwtService
  ) {
    this.etablissements = etablissements;
    this.utilisateurs = utilisateurs;
    this.annees = annees;
    this.passwordEncoder = passwordEncoder;
    this.jwtService = jwtService;
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

  public record AuthResponse(String token, Long etablissementId, String role, String nomEtablissement, String email) {}

  @PostMapping("/signup")
  @Transactional
  public AuthResponse signup(@Valid @RequestBody SignupRequest request) {
    String email = request.email().trim().toLowerCase(Locale.ROOT);
    if (utilisateurs.findByEmailIgnoreCase(email).isPresent() || etablissements.findByEmailIgnoreCase(email).isPresent()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Cet email est déjà utilisé.");
    }
    String code = codeFrom(request.nom(), request.ville());
    int suffix = 1;
    String unique = code;
    while (etablissements.existsByCode(unique)) {
      suffix++;
      unique = code + "-" + suffix;
    }

    Etablissement school = new Etablissement();
    school.setNom(request.nom().trim());
    school.setCode(unique);
    school.setVille(request.ville().trim());
    school.setRegion(blankToNull(request.region()));
    school.setTypeEtablissement(blankToNull(request.typeEtablissement()));
    school.setEmail(email);
    school.setTelephone(blankToNull(request.telephone()));
    school.setNomResponsable(request.nomResponsable().trim());
    school = etablissements.save(school);

    Utilisateur owner = new Utilisateur();
    owner.setEtablissementId(school.getId());
    owner.setEmail(email);
    owner.setMotDePasseHash(passwordEncoder.encode(request.motDePasse()));
    owner.setNom(request.nomResponsable().trim());
    owner.setRole(Role.OWNER);
    owner = utilisateurs.save(owner);

    AnneeScolaire annee = new AnneeScolaire();
    annee.setEtablissementId(school.getId());
    annee.setLibelle("2024-2025");
    annee.setDateDebut(LocalDate.of(2024, 9, 1));
    annee.setDateFin(LocalDate.of(2025, 7, 31));
    annee.setCourante(true);
    annees.save(annee);

    return new AuthResponse(jwtService.create(owner), school.getId(), owner.getRole().name(), school.getNom(), owner.getEmail());
  }

  @PostMapping("/login")
  public AuthResponse login(@Valid @RequestBody LoginRequest request) {
    Utilisateur user = utilisateurs.findByEmailIgnoreCase(request.email().trim())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email ou mot de passe incorrect."));
    if (!passwordEncoder.matches(request.motDePasse(), user.getMotDePasseHash())) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email ou mot de passe incorrect.");
    }
    Etablissement school = etablissements.findById(user.getEtablissementId())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Établissement introuvable."));
    return new AuthResponse(jwtService.create(user), school.getId(), user.getRole().name(), school.getNom(), user.getEmail());
  }

  private static String codeFrom(String nom, String ville) {
    String left = nom.replaceAll("[^A-Za-z]", "").toUpperCase(Locale.ROOT);
    String right = ville.replaceAll("[^A-Za-z]", "").toUpperCase(Locale.ROOT);
    left = left.length() > 4 ? left.substring(0, 4) : left;
    right = right.length() > 4 ? right.substring(0, 4) : right;
    if (left.isBlank()) left = "ETAB";
    if (right.isBlank()) right = "VILLE";
    return left + "-" + right + "-01";
  }

  private static String blankToNull(String value) {
    if (value == null || value.isBlank()) return null;
    return value.trim();
  }
}
