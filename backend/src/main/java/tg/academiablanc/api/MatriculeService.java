package tg.academiablanc.api;

import java.text.Normalizer;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import tg.academiablanc.domain.AnneeScolaire;
import tg.academiablanc.domain.Eleve;
import tg.academiablanc.domain.Etablissement;
import tg.academiablanc.repo.AnneeScolaireRepository;
import tg.academiablanc.repo.EleveRepository;
import tg.academiablanc.repo.EtablissementRepository;

/**
 * Attribution automatique des matricules — seule source de vérité pour toute création d'élève
 * (formulaire « Inscrire l'élève », import en masse, etc.). Le client n'envoie jamais de matricule.
 *
 * <p>Format : {@code <AA>-<CODE_ETAB>-<NNNNN>}, ex. {@code 25-LYCE-LOME-01-00001}.
 * <ul>
 *   <li>{@code AA} : deux derniers chiffres de l'année de début de l'année scolaire courante
 *       (à défaut la plus récente ; à défaut l'année civile en cours).</li>
 *   <li>{@code CODE_ETAB} : code de l'établissement en majuscules, sans espaces ni accents
 *       (repli : quatre premières lettres du nom, puis {@code ETAB}).</li>
 *   <li>{@code NNNNN} : numéro d'ordre sur cinq chiffres, propre à chaque couple établissement + année,
 *       calculé à partir du plus grand suffixe déjà enregistré pour ce préfixe.</li>
 * </ul>
 * Les matricules déjà présents en base (anciens formats compris) ne sont jamais modifiés.
 */
@Service
public class MatriculeService {
  private static final int LARGEUR_SEQUENCE = 5;
  private static final Pattern ANNEE_LIBELLE = Pattern.compile("(\\d{4})");

  private final EleveRepository eleves;
  private final EtablissementRepository etablissements;
  private final AnneeScolaireRepository annees;

  public MatriculeService(EleveRepository eleves, EtablissementRepository etablissements, AnneeScolaireRepository annees) {
    this.eleves = eleves;
    this.etablissements = etablissements;
    this.annees = annees;
  }

  /** Préfixe {@code AA-CODE_ETAB-} de l'établissement pour l'année scolaire courante. */
  public String prefixe(Long etablissementId) {
    String code = etablissements.findById(etablissementId).map(MatriculeService::codeEtablissement).orElse("ETAB");
    return String.format("%02d-%s-", anneeDeDebut(etablissementId) % 100, code);
  }

  /** Prochain matricule libre pour l'établissement (lecture du plus grand suffixe existant). */
  public String generer(Long etablissementId) {
    return sequence(etablissementId).suivant();
  }

  /**
   * Séquence réutilisable pour attribuer plusieurs matricules d'affilée (import) sans relire la base
   * à chaque élève : le point de départ est lu une fois dans la transaction courante.
   */
  public Sequence sequence(Long etablissementId) {
    String prefixe = prefixe(etablissementId);
    return new Sequence(prefixe, dernierSuffixe(etablissementId, prefixe));
  }

  /**
   * Attribue un matricule neuf à l'élève et l'enregistre. En cas de collision (deux inscriptions
   * simultanées), un second matricule est calculé et l'enregistrement est retenté une fois.
   * À appeler hors transaction englobante pour que la nouvelle tentative soit possible.
   */
  public Eleve enregistrerNouveau(Eleve eleve) {
    for (int tentative = 1; ; tentative++) {
      eleve.setMatricule(generer(eleve.getEtablissementId()));
      try {
        return eleves.save(eleve);
      } catch (DataIntegrityViolationException ex) {
        if (tentative >= 2 || !eleves.existsByEtablissementIdAndMatricule(eleve.getEtablissementId(), eleve.getMatricule())) {
          throw new ResponseStatusException(HttpStatus.CONFLICT, "Attribution du matricule impossible, réessayez.", ex);
        }
      }
    }
  }

  /** Compteur en mémoire démarré après le plus grand suffixe déjà utilisé pour le préfixe. */
  public static final class Sequence {
    private final String prefixe;
    private int dernier;

    private Sequence(String prefixe, int dernier) {
      this.prefixe = prefixe;
      this.dernier = dernier;
    }

    public String prefixe() {
      return prefixe;
    }

    public String suivant() {
      dernier++;
      return prefixe + String.format("%0" + LARGEUR_SEQUENCE + "d", dernier);
    }
  }

  private int dernierSuffixe(Long etablissementId, String prefixe) {
    int max = 0;
    List<String> existants = eleves.findMatriculesCommencantPar(etablissementId, prefixe);
    for (String matricule : existants) {
      String suffixe = matricule.substring(prefixe.length());
      if (suffixe.chars().allMatch(Character::isDigit) && !suffixe.isEmpty()) {
        try {
          max = Math.max(max, Integer.parseInt(suffixe));
        } catch (NumberFormatException ignored) {
          // suffixe trop long pour un int : ancien matricule manuel, on l'ignore
        }
      }
    }
    return max;
  }

  private int anneeDeDebut(Long etablissementId) {
    List<AnneeScolaire> liste = annees.findByEtablissementIdOrderByLibelleDesc(etablissementId);
    AnneeScolaire courante = liste.stream().filter(AnneeScolaire::isCourante).findFirst()
        .orElse(liste.isEmpty() ? null : liste.get(0));
    if (courante != null) {
      if (courante.getDateDebut() != null) return courante.getDateDebut().getYear();
      Matcher m = ANNEE_LIBELLE.matcher(courante.getLibelle() == null ? "" : courante.getLibelle());
      if (m.find()) return Integer.parseInt(m.group(1));
    }
    return LocalDate.now().getYear();
  }

  static String codeEtablissement(Etablissement etablissement) {
    String code = nettoyer(etablissement.getCode());
    if (!code.isBlank()) return code;
    String nom = nettoyer(etablissement.getNom()).replace("-", "");
    if (nom.length() > 4) nom = nom.substring(0, 4);
    return nom.isBlank() ? "ETAB" : nom;
  }

  /** Majuscules, sans accents ni espaces ; seuls les lettres, chiffres et tirets sont conservés. */
  private static String nettoyer(String valeur) {
    if (valeur == null) return "";
    String sansAccents = Normalizer.normalize(valeur, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
    return sansAccents.toUpperCase(Locale.ROOT)
        .replaceAll("[^A-Z0-9-]", "")
        .replaceAll("-{2,}", "-")
        .replaceAll("^-+|-+$", "");
  }
}
