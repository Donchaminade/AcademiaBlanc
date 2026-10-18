package tg.academiablanc.api;

import java.net.URI;
import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tg.academiablanc.domain.Etablissement;
import tg.academiablanc.repo.EtablissementRepository;
import tg.academiablanc.security.Tenant;

/**
 * Charte graphique du bulletin (cachet et signatures téléversés), portée par l'établissement du jeton.
 * Une valeur vide signifie que l'emplacement reste libre sur le bulletin pour une apposition physique.
 */
@Service
public class CharteService {
  /** Taille maximale d'une image encodée (data URL) : ~1,1 Mo d'octets une fois décodés. */
  public static final int MAX_LENGTH = 1_500_000;

  private static final Pattern DATA_IMAGE = Pattern.compile(
      "^data:image/[a-z0-9.+-]+;base64,[a-z0-9+/=\\s]+$", Pattern.CASE_INSENSITIVE);

  private final EtablissementRepository etablissements;

  public CharteService(EtablissementRepository etablissements) {
    this.etablissements = etablissements;
  }

  public record Charte(String sceauUrl, String signatureProviseurUrl, String signatureTitulaireUrl) {
    static Charte of(Etablissement school) {
      return new Charte(school.getSceauUrl(), school.getSignatureProviseurUrl(), school.getSignatureTitulaireUrl());
    }
  }

  @Transactional(readOnly = true)
  public Charte current() {
    return Charte.of(school());
  }

  @Transactional
  public Charte update(Charte request) {
    Etablissement school = school();
    school.setSceauUrl(normalise(request.sceauUrl(), "sceau"));
    school.setSignatureProviseurUrl(normalise(request.signatureProviseurUrl(), "signature du proviseur"));
    school.setSignatureTitulaireUrl(normalise(request.signatureTitulaireUrl(), "signature du titulaire"));
    return Charte.of(etablissements.save(school));
  }

  private Etablissement school() {
    return etablissements.findById(Tenant.current().etablissementId())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Établissement introuvable."));
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
