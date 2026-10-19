package tg.academiablanc.api;

import java.net.URI;
import java.time.Instant;
import java.util.Locale;
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
 * Charte du bulletin portée par l'établissement du jeton : cachet et signatures téléversés (table
 * {@code etablissement}) et paramètres d'affichage de l'écran Paramètres (table {@code parametres_bulletin}) :
 * logo, sceau officiel, signataires, numérotation des tables. L'en-tête officiel (république, devise,
 * ministère) relève de la fiche de l'établissement ({@link ProfilEtablissementService}), pas de la charte.
 * Une valeur vide signifie « emplacement libre » pour une image et « valeur par défaut du logiciel » pour un texte.
 */
@Service
public class CharteService {
  /** Taille maximale d'une image encodée (data URL) : ~1,1 Mo d'octets une fois décodés. */
  public static final int MAX_LENGTH = 1_500_000;

  private static final Pattern DATA_IMAGE = Pattern.compile(
      "^data:image/[a-z0-9.+-]+;base64,[a-z0-9+/=\\s]+$", Pattern.CASE_INSENSITIVE);

  private final EtablissementRepository etablissements;
  private final ParametresBulletinRepository parametres;

  public CharteService(EtablissementRepository etablissements, ParametresBulletinRepository parametres) {
    this.etablissements = etablissements;
    this.parametres = parametres;
  }

  public record Charte(
      String sceauUrl,
      String signatureProviseurUrl,
      String signatureTitulaireUrl,
      String logoUrl,
      String sceauOfficielUrl,
      String titreSignataireJury,
      String nomSignataireJury,
      String titreTitulaire,
      String nomTitulaire,
      Integer premierNumeroTable,
      Boolean numerotationAutomatique
  ) {
    static Charte of(Etablissement school, ParametresBulletin params) {
      return new Charte(
          school.getSceauUrl(), school.getSignatureProviseurUrl(), school.getSignatureTitulaireUrl(),
          params.getLogoUrl(), params.getSceauOfficielUrl(), params.getTitreSignataireJury(), params.getNomSignataireJury(),
          params.getTitreTitulaire(), params.getNomTitulaire(), params.getPremierNumeroTable(),
          params.getNumerotationAutomatique());
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
    school.setSceauUrl(normalise(request.sceauUrl(), "sceau"));
    school.setSignatureProviseurUrl(normalise(request.signatureProviseurUrl(), "signature du proviseur"));
    school.setSignatureTitulaireUrl(normalise(request.signatureTitulaireUrl(), "signature du titulaire"));

    ParametresBulletin params = parametres.findById(school.getId()).orElseGet(() -> vierge(school.getId()));
    params.setLogoUrl(normalise(request.logoUrl(), "logo"));
    // Sceau officiel : « » (chaîne vide) est un choix explicite — emplacement laissé vierge pour un tampon
    // manuel — à distinguer de null (jamais renseigné : le client affiche son sceau par défaut).
    params.setSceauOfficielUrl(request.sceauOfficielUrl() != null && request.sceauOfficielUrl().isBlank()
        ? "" : normalise(request.sceauOfficielUrl(), "sceau officiel"));
    params.setTitreSignataireJury(texte(request.titreSignataireJury(), 120, "titre du signataire"));
    params.setNomSignataireJury(texte(request.nomSignataireJury(), 180, "nom du signataire"));
    params.setTitreTitulaire(texte(request.titreTitulaire(), 120, "titre du titulaire"));
    params.setNomTitulaire(texte(request.nomTitulaire(), 180, "nom du titulaire"));
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

  /** N'accepte que des images data: ou des URL http(s) ; une valeur vide efface l'image. */
  static String normalise(String value, String label) {
    if (value == null || value.isBlank()) return null;
    String trimmed = value.trim();
    if (trimmed.length() > MAX_LENGTH) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
          "Image trop lourde pour le " + label + " : réduisez-la avant de la téléverser.");
    }
    if (trimmed.toLowerCase(Locale.ROOT).startsWith("data:")) {
      if (!DATA_IMAGE.matcher(trimmed).matches()) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image invalide pour le " + label + ".");
      }
      return trimmed;
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
}
