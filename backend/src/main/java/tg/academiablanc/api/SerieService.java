package tg.academiablanc.api;

import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tg.academiablanc.domain.FamilleSerie;
import tg.academiablanc.domain.Serie;
import tg.academiablanc.repo.ClasseRepository;
import tg.academiablanc.repo.SerieRepository;

/**
 * Référentiel des séries du lycée, propre à chaque établissement.
 *
 * <p>Les séries par défaut (générales A4, C, D ; techniques G1–G3, F1–F4) sont insérées
 * à la première consultation d'un établissement qui n'en possède aucune, ou à la demande
 * via {@link #chargerDefauts(Long)}. L'établissement peut ensuite ajouter ses propres séries
 * (E, Ti, F5…) : la liste n'est pas fermée.</p>
 */
@Service
public class SerieService {
  /** Séries proposées par défaut, dans l'ordre d'affichage de chaque famille. */
  public record SerieDefaut(String code, String libelle, FamilleSerie famille) {}

  public static final List<SerieDefaut> DEFAUTS = List.of(
      new SerieDefaut("A4", "Littéraire", FamilleSerie.GENERALE),
      new SerieDefaut("C", "Mathématiques et Sciences physiques", FamilleSerie.GENERALE),
      new SerieDefaut("D", "Mathématiques et Sciences naturelles", FamilleSerie.GENERALE),
      new SerieDefaut("G1", "Techniques administratives", FamilleSerie.TECHNIQUE),
      new SerieDefaut("G2", "Techniques quantitatives de gestion", FamilleSerie.TECHNIQUE),
      new SerieDefaut("G3", "Techniques commerciales", FamilleSerie.TECHNIQUE),
      new SerieDefaut("F1", "Construction mécanique", FamilleSerie.TECHNIQUE),
      new SerieDefaut("F2", "Électronique", FamilleSerie.TECHNIQUE),
      new SerieDefaut("F3", "Électrotechnique", FamilleSerie.TECHNIQUE),
      new SerieDefaut("F4", "Génie civil", FamilleSerie.TECHNIQUE)
  );

  /**
   * Préfixe libre saisi avant le référentiel (« Série D », « serie A4 »).
   * La casse Unicode est prise en compte pour que « SÉRIE » et « Série » soient équivalents.
   */
  private static final Pattern PREFIXE_LIBELLE = Pattern.compile("^(?iu)s[eé]rie\\s+");

  private final SerieRepository series;
  private final ClasseRepository classes;

  public SerieService(SerieRepository series, ClasseRepository classes) {
    this.series = series;
    this.classes = classes;
  }

  /** Liste ordonnée (famille, ordre, code) ; charge les défauts si l'établissement n'a encore aucune série. */
  @Transactional
  public List<Serie> lister(Long etablissementId) {
    if (!series.existsByEtablissementId(etablissementId)) {
      chargerDefauts(etablissementId);
    }
    return series.findByEtablissementIdOrderByFamilleAscOrdreAscCodeAsc(etablissementId);
  }

  /** Insère les séries par défaut manquantes sans toucher aux séries existantes (idempotent). */
  @Transactional
  public List<Serie> chargerDefauts(Long etablissementId) {
    int ordre = 0;
    for (SerieDefaut defaut : DEFAUTS) {
      ordre++;
      if (series.findByEtablissementIdAndCodeIgnoreCase(etablissementId, defaut.code()).isPresent()) continue;
      Serie serie = new Serie();
      serie.setEtablissementId(etablissementId);
      serie.setCode(defaut.code());
      serie.setLibelle(defaut.libelle());
      serie.setFamille(defaut.famille());
      serie.setActif(true);
      serie.setOrdre(ordre);
      series.save(serie);
    }
    return series.findByEtablissementIdOrderByFamilleAscOrdreAscCodeAsc(etablissementId);
  }

  @Transactional
  public Serie creer(Long etablissementId, String code, String libelle, FamilleSerie famille, Boolean actif, Integer ordre) {
    String codeNormalise = normaliserCode(code);
    if (series.findByEtablissementIdAndCodeIgnoreCase(etablissementId, codeNormalise).isPresent()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "La série « " + codeNormalise + " » existe déjà.");
    }
    Serie serie = new Serie();
    serie.setEtablissementId(etablissementId);
    serie.setCode(codeNormalise);
    serie.setLibelle(libelle.trim());
    serie.setFamille(famille);
    serie.setActif(actif == null || actif);
    serie.setOrdre(ordre != null ? ordre : prochainOrdre(etablissementId));
    return series.save(serie);
  }

  @Transactional
  public Serie modifier(Serie serie, String code, String libelle, FamilleSerie famille, Boolean actif, Integer ordre) {
    String codeNormalise = normaliserCode(code);
    series.findByEtablissementIdAndCodeIgnoreCase(serie.getEtablissementId(), codeNormalise)
        .filter(autre -> !autre.getId().equals(serie.getId()))
        .ifPresent(autre -> {
          throw new ResponseStatusException(HttpStatus.CONFLICT, "La série « " + codeNormalise + " » existe déjà.");
        });
    if (!codeNormalise.equalsIgnoreCase(serie.getCode()) && utiliseeParUneClasse(serie)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT,
          "Impossible de renommer la série « " + serie.getCode() + "» : des classes l'utilisent encore.");
    }
    serie.setCode(codeNormalise);
    serie.setLibelle(libelle.trim());
    serie.setFamille(famille);
    if (actif != null) serie.setActif(actif);
    if (ordre != null) serie.setOrdre(ordre);
    return series.save(serie);
  }

  @Transactional
  public void supprimer(Serie serie) {
    if (utiliseeParUneClasse(serie)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT,
          "Impossible de supprimer la série « " + serie.getCode() + " » : des classes l'utilisent encore.");
    }
    series.delete(serie);
  }

  /**
   * Retourne la série active de l'établissement portant ce code, ou 400 si elle n'existe pas
   * ou si elle est inactive.
   */
  @Transactional
  public Serie exiger(Long etablissementId, String code) {
    return exiger(etablissementId, code, false);
  }

  /**
   * Comme {@link #exiger(Long, String)}, mais une série inactive reste valable lorsque
   * {@code conserverSiInactive} est vrai : la classe la porte déjà, on ne fait que l'enregistrer
   * à nouveau (nom, titulaire…). L'attribuer à une autre classe reste refusé.
   */
  @Transactional
  public Serie exiger(Long etablissementId, String code, boolean conserverSiInactive) {
    if (code == null || code.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La série est obligatoire pour une classe du lycée.");
    }
    lister(etablissementId);
    String codeNormalise = normaliserCode(code);
    Serie serie = series.findByEtablissementIdAndCodeIgnoreCase(etablissementId, codeNormalise)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
            "Série « " + code.trim() + " » inconnue pour cet établissement. Ajoutez-la dans le référentiel des séries."));
    if (!serie.isActif() && !conserverSiInactive) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
          "La série « " + serie.getCode() + " » est inactive et n'est plus proposée pour une nouvelle classe.");
    }
    return serie;
  }

  /**
   * Une classe historique peut encore porter le libellé « Série D » tant que la migration
   * n'a pas réécrit la ligne : ce libellé compte comme une utilisation du code « D ».
   */
  private boolean utiliseeParUneClasse(Serie serie) {
    Long etab = serie.getEtablissementId();
    String code = serie.getCode();
    return classes.existsByEtablissementIdAndSerieIgnoreCase(etab, code)
        || classes.existsByEtablissementIdAndSerieIgnoreCase(etab, "Série " + code)
        || classes.existsByEtablissementIdAndSerieIgnoreCase(etab, "Serie " + code);
  }

  private int prochainOrdre(Long etablissementId) {
    return series.findByEtablissementIdOrderByFamilleAscOrdreAscCodeAsc(etablissementId).stream()
        .mapToInt(Serie::getOrdre).max().orElse(0) + 1;
  }

  /**
   * Code court en majuscules, sans espaces superflus (« f5 » → « F5 », « Série D » → « D »).
   */
  public static String normaliserCode(String code) {
    if (code == null || code.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le code de la série est obligatoire.");
    }
    String texte = PREFIXE_LIBELLE.matcher(code.trim()).replaceFirst("");
    if (texte.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le code de la série est obligatoire.");
    }
    return texte.replaceAll("\\s+", "").toUpperCase(Locale.ROOT);
  }
}
