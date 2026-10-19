package tg.academiablanc.api;

import java.net.URI;
import java.time.Instant;
import java.util.Locale;
import java.util.Objects;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tg.academiablanc.domain.Etablissement;
import tg.academiablanc.domain.ParametresBulletin;
import tg.academiablanc.repo.EtablissementRepository;
import tg.academiablanc.repo.ParametresBulletinRepository;
import tg.academiablanc.security.Tenant;

/**
 * Charte du bulletin portée par l'établissement du jeton : logo, cachet et signatures téléversés (table
 * {@code etablissement}, images encodées en data URL et conservées en base — jamais sur le disque du serveur)
 * et paramètres d'affichage de l'écran Paramètres (table {@code parametres_bulletin}) : sceau officiel,
 * titre du chef d'établissement, numérotation des tables. L'en-tête officiel (république, devise, ministère)
 * relève de la fiche de l'établissement ({@link ProfilEtablissementService}), pas de la charte. Les noms des
 * signataires non plus : le titulaire est l'enseignant affecté à la classe de l'élève ({@link BulletinService}),
 * le signataire officiel est le responsable de la fiche de l'établissement.
 * Une valeur vide signifie « emplacement libre » pour une image et « valeur par défaut du logiciel » pour un texte ;
 * pour le titre du chef d'établissement, null = automatique (« Le Directeur » au collège, « Le Proviseur » au lycée,
 * voir {@link TitreChefEtablissement}), toute autre valeur est un remplacement manuel saisi dans le profil.
 */
@Service
public class CharteService {
  /** Poids maximal d'une image une fois décodée : 1 Mo. Le navigateur réduit les images bien en deçà (≈ 300 Ko). */
  public static final long MAX_OCTETS = 1024L * 1024L;
  /** Message renvoyé (413) pour une image trop lourde ; le libellé de l'image est ajouté. */
  public static final String MESSAGE_TROP_LOURDE = "Image trop lourde pour le %s (1 Mo maximum) : réduisez-la avant de la téléverser.";

  private static final Pattern DATA_IMAGE = Pattern.compile(
      "^data:image/(png|jpeg|jpg|webp|gif|svg\\+xml);base64,([a-z0-9+/=\\s]+)$", Pattern.CASE_INSENSITIVE);

  private final EtablissementRepository etablissements;
  private final ParametresBulletinRepository parametres;

  public CharteService(EtablissementRepository etablissements, ParametresBulletinRepository parametres) {
    this.etablissements = etablissements;
    this.parametres = parametres;
  }

  /**
   * Charte renvoyée et reçue par {@code /api/etablissement/charte}. {@code modifieLe} (lecture seule) date la
   * dernière modification du logo, du cachet ou des signatures ; null tant qu'aucune image n'a été enregistrée.
   */
  public record Charte(
      String logoUrl,
      String sceauUrl,
      String signatureProviseurUrl,
      String signatureTitulaireUrl,
      String sceauOfficielUrl,
      String titreSignataireJury,
      Integer premierNumeroTable,
      Boolean numerotationAutomatique,
      Instant modifieLe
  ) {
    static Charte of(Etablissement school, ParametresBulletin params) {
      return new Charte(
          school.getLogoUrl(), school.getSceauUrl(), school.getSignatureProviseurUrl(), school.getSignatureTitulaireUrl(),
          params.getSceauOfficielUrl(), params.getTitreSignataireJury(),
          params.getPremierNumeroTable(), params.getNumerotationAutomatique(), school.getCharteModifieeLe());
    }
  }

  @Transactional(readOnly = true)
  public Charte current() {
    Etablissement school = school();
    return Charte.of(school, parametres.findById(school.getId()).orElseGet(() -> vierge(school.getId())));
  }

  @Transactional
  public Charte update(Charte request) {
    Etablissement school = school();
    String logo = normalise(request.logoUrl(), "logo");
    String sceau = normalise(request.sceauUrl(), "sceau");
    String signatureProviseur = normalise(request.signatureProviseurUrl(), "signature du chef d'établissement");
    String signatureTitulaire = normalise(request.signatureTitulaireUrl(), "signature du titulaire");
    boolean imagesModifiees = !Objects.equals(logo, school.getLogoUrl())
        || !Objects.equals(sceau, school.getSceauUrl())
        || !Objects.equals(signatureProviseur, school.getSignatureProviseurUrl())
        || !Objects.equals(signatureTitulaire, school.getSignatureTitulaireUrl());
    school.setLogoUrl(logo);
    school.setSceauUrl(sceau);
    school.setSignatureProviseurUrl(signatureProviseur);
    school.setSignatureTitulaireUrl(signatureTitulaire);
    if (imagesModifiees) school.setCharteModifieeLe(Instant.now());

    ParametresBulletin params = parametres.findById(school.getId()).orElseGet(() -> vierge(school.getId()));
    // Sceau officiel : « » (chaîne vide) est un choix explicite — emplacement laissé vierge pour un tampon
    // manuel — à distinguer de null (jamais renseigné : le client affiche son sceau par défaut).
    params.setSceauOfficielUrl(request.sceauOfficielUrl() != null && request.sceauOfficielUrl().isBlank()
        ? "" : normalise(request.sceauOfficielUrl(), "sceau officiel"));
    params.setTitreSignataireJury(texte(request.titreSignataireJury(), 120, "titre du chef d'établissement"));
    if (request.premierNumeroTable() != null && (request.premierNumeroTable() < 1 || request.premierNumeroTable() > 99_999)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le premier numéro de table doit être compris entre 1 et 99999.");
    }
    params.setPremierNumeroTable(request.premierNumeroTable());
    params.setNumerotationAutomatique(request.numerotationAutomatique());
    params.setModifieLe(Instant.now());

    return Charte.of(etablissements.save(school), parametres.save(params));
  }

  private static ParametresBulletin vierge(Long etablissementId) {
    ParametresBulletin params = new ParametresBulletin();
    params.setEtablissementId(etablissementId);
    params.setModifieLe(Instant.now());
    return params;
  }

  private Etablissement school() {
    return etablissements.findById(Tenant.current().etablissementId())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Établissement introuvable."));
  }

  /** Texte libre borné ; vide → null (valeur par défaut du logiciel). */
  static String texte(String value, int max, String label) {
    if (value == null || value.isBlank()) return null;
    String trimmed = value.trim();
    if (trimmed.length() > max) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
          "Le " + label + " ne doit pas dépasser " + max + " caractères.");
    }
    return trimmed;
  }

  /**
   * N'accepte que des images data: (PNG, JPEG, WebP, GIF, SVG) d'au plus {@link #MAX_OCTETS} une fois décodées,
   * ou des URL http(s) (valeurs héritées) ; une valeur vide efface l'image.
   */
  static String normalise(String value, String label) {
    if (value == null || value.isBlank()) return null;
    String trimmed = value.trim();
    if (trimmed.toLowerCase(Locale.ROOT).startsWith("data:")) {
      // Contrôle du poids avant celui du format : une expression régulière sur plusieurs mégaoctets est inutile.
      if (octetsDecodes(trimmed) > MAX_OCTETS) {
        throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, String.format(MESSAGE_TROP_LOURDE, label));
      }
      if (!DATA_IMAGE.matcher(trimmed).matches()) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image invalide pour le " + label
            + " : formats acceptés PNG, JPG, WebP ou SVG.");
      }
      return trimmed;
    }
    if (trimmed.length() > 2_048) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
          "Adresse trop longue pour le " + label + " : utilisez une image téléversée.");
    }
    try {
      String scheme = URI.create(trimmed).getScheme();
      if (scheme == null || !(scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https"))) {
        throw new IllegalArgumentException();
      }
    } catch (IllegalArgumentException ex) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
          "Adresse invalide pour le " + label + " : utilisez une URL http(s) ou une image téléversée.");
    }
    return trimmed;
  }

  /** Poids en octets de l'image portée par une data URL base64 (3 octets pour 4 caractères, moins le bourrage). */
  static long octetsDecodes(String dataUrl) {
    int virgule = dataUrl.indexOf(',');
    if (virgule < 0) return 0;
    long caracteres = 0;
    long bourrage = 0;
    for (int i = virgule + 1; i < dataUrl.length(); i++) {
      char c = dataUrl.charAt(i);
      if (Character.isWhitespace(c)) continue;
      caracteres++;
      if (c == '=') bourrage++;
    }
    return Math.max(0, caracteres * 3 / 4 - bourrage);
  }
}
