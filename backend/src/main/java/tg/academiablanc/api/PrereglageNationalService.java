package tg.academiablanc.api;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tg.academiablanc.domain.PrereglageNational;
import tg.academiablanc.repo.EtablissementRepository;
import tg.academiablanc.repo.PrereglageNationalRepository;

/**
 * Référentiel des préréglages nationaux (pays, république, devise, ministère) tenu par la plateforme.
 * Les établissements n'en lisent que les entrées actives ; la vitrine et les pages d'authentification
 * n'affichent que l'entrée par défaut, unique.
 */
@Service
public class PrereglageNationalService {
  public static final String MESSAGE_UTILISE = "Ce préréglage est appliqué par au moins un établissement : désactivez-le au lieu de le supprimer.";
  public static final String MESSAGE_DEFAUT_PROTEGE = "Ce préréglage est celui par défaut : désignez-en d'abord un autre.";
  public static final String MESSAGE_AUCUN = "Aucun préréglage national n'est défini par défaut.";

  private final PrereglageNationalRepository prereglages;
  private final EtablissementRepository etablissements;

  public PrereglageNationalService(PrereglageNationalRepository prereglages, EtablissementRepository etablissements) {
    this.prereglages = prereglages;
    this.etablissements = etablissements;
  }

  /** Vue complète pour la plateforme ; {@code etablissements} = nombre d'établissements qui l'appliquent. */
  public record Vue(
      Long id,
      String code,
      String nomPays,
      String republique,
      String devise,
      String ministere,
      String sigleMinistere,
      String autoriteRegionale,
      String piedDePage,
      int ordre,
      boolean actif,
      boolean parDefaut,
      Long etablissements
  ) {}

  /** Vue allégée (établissements connectés et endpoint public) : libellés d'en-tête uniquement. */
  public record VueLecture(
      Long id,
      String code,
      String nomPays,
      String republique,
      String devise,
      String ministere,
      String sigleMinistere,
      String autoriteRegionale,
      String piedDePage,
      boolean parDefaut
  ) {
    static VueLecture of(PrereglageNational p) {
      return new VueLecture(p.getId(), p.getCode(), p.getNomPays(), p.getRepublique(), p.getDevise(), p.getMinistere(),
          p.getSigleMinistere(), p.getAutoriteRegionale(), p.getPiedDePage(), p.isParDefaut());
    }
  }

  /** Corps de création et de modification. L'ordre et l'état par défaut sont facultatifs. */
  public record Saisie(
      String code,
      String nomPays,
      String republique,
      String devise,
      String ministere,
      String sigleMinistere,
      String autoriteRegionale,
      String piedDePage,
      Integer ordre,
      Boolean actif,
      Boolean parDefaut
  ) {}

  @Transactional(readOnly = true)
  public List<Vue> lister() {
    return prereglages.findAllByOrderByOrdreAscNomPaysAsc().stream().map(this::vue).toList();
  }

  @Transactional(readOnly = true)
  public List<VueLecture> listerActifs() {
    return prereglages.findByActifTrueOrderByOrdreAscNomPaysAsc().stream().map(VueLecture::of).toList();
  }

  /** Préréglage par défaut, sinon le premier actif ; vide si le référentiel est vide ou entièrement inactif. */
  @Transactional(readOnly = true)
  public Optional<PrereglageNational> parDefaut() {
    Optional<PrereglageNational> defaut = prereglages.findByParDefautTrue().stream().filter(PrereglageNational::isActif).findFirst();
    if (defaut.isPresent()) return defaut;
    return prereglages.findByActifTrueOrderByOrdreAscNomPaysAsc().stream().findFirst();
  }

  @Transactional(readOnly = true)
  public VueLecture lectureParDefaut() {
    return parDefaut().map(VueLecture::of)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, MESSAGE_AUCUN));
  }

  @Transactional
  public Vue creer(Saisie saisie) {
    PrereglageNational p = new PrereglageNational();
    renseigner(p, saisie);
    if (prereglages.findByCodeIgnoreCase(p.getCode()).isPresent()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Le code pays « " + p.getCode() + " » existe déjà.");
    }
    p.setActif(saisie.actif() == null || saisie.actif());
    p = prereglages.save(p);
    boolean premier = prereglages.count() == 1;
    if (Boolean.TRUE.equals(saisie.parDefaut()) || premier) definirParDefaut(p);
    return vue(p);
  }

  @Transactional
  public Vue modifier(Long id, Saisie saisie) {
    PrereglageNational p = trouver(id);
    renseigner(p, saisie);
    Optional<PrereglageNational> homonyme = prereglages.findByCodeIgnoreCase(p.getCode());
    if (homonyme.isPresent() && !homonyme.get().getId().equals(id)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Le code pays « " + p.getCode() + " » existe déjà.");
    }
    if (saisie.actif() != null) changerActif(p, saisie.actif());
    if (Boolean.TRUE.equals(saisie.parDefaut())) definirParDefaut(p);
    return vue(prereglages.save(p));
  }

  /** Activation / désactivation douce : un préréglage inactif n'est plus proposé mais reste appliqué là où il l'était. */
  @Transactional
  public Vue activer(Long id, boolean actif) {
    PrereglageNational p = trouver(id);
    changerActif(p, actif);
    return vue(prereglages.save(p));
  }

  @Transactional
  public Vue definirParDefaut(Long id) {
    PrereglageNational p = trouver(id);
    if (!p.isActif()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Un préréglage désactivé ne peut pas être celui par défaut.");
    }
    definirParDefaut(p);
    return vue(p);
  }

  /** 409 si un établissement l'applique encore ou s'il est le préréglage par défaut. */
  @Transactional
  public void supprimer(Long id) {
    PrereglageNational p = trouver(id);
    if (etablissements.countByPrereglageNationalId(id) > 0) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, MESSAGE_UTILISE);
    }
    if (p.isParDefaut() && prereglages.count() > 1) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, MESSAGE_DEFAUT_PROTEGE);
    }
    prereglages.delete(p);
  }

  /** Préréglage applicable par un établissement : il doit exister et être actif. */
  @Transactional(readOnly = true)
  public PrereglageNational applicable(Long id) {
    PrereglageNational p = trouver(id);
    if (!p.isActif()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ce préréglage national est désactivé par la plateforme.");
    }
    return p;
  }

  public boolean existe(Long id) {
    return prereglages.existsById(id);
  }

  public Vue vue(PrereglageNational p) {
    return new Vue(p.getId(), p.getCode(), p.getNomPays(), p.getRepublique(), p.getDevise(), p.getMinistere(),
        p.getSigleMinistere(), p.getAutoriteRegionale(), p.getPiedDePage(), p.getOrdre(), p.isActif(), p.isParDefaut(),
        etablissements.countByPrereglageNationalId(p.getId()));
  }

  private PrereglageNational trouver(Long id) {
    return prereglages.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Préréglage national introuvable."));
  }

  private void changerActif(PrereglageNational p, boolean actif) {
    if (!actif && p.isParDefaut() && prereglages.count() > 1) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, MESSAGE_DEFAUT_PROTEGE);
    }
    p.setActif(actif);
    if (!actif) p.setParDefaut(false);
  }

  private void definirParDefaut(PrereglageNational cible) {
    for (PrereglageNational autre : prereglages.findByParDefautTrue()) {
      if (!autre.getId().equals(cible.getId())) {
        autre.setParDefaut(false);
        prereglages.save(autre);
      }
    }
    cible.setParDefaut(true);
    prereglages.save(cible);
  }

  private static void renseigner(PrereglageNational p, Saisie s) {
    String code = obligatoire(s.code(), "Le code pays est obligatoire.", 2).toUpperCase(Locale.ROOT);
    if (!code.matches("[A-Z]{2}")) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le code pays doit être un code ISO à deux lettres (ex. TG).");
    }
    p.setCode(code);
    p.setNomPays(obligatoire(s.nomPays(), "Le nom du pays est obligatoire.", 120));
    p.setRepublique(obligatoire(s.republique(), "Le nom officiel de la république est obligatoire.", 160));
    p.setDevise(obligatoire(s.devise(), "La devise nationale est obligatoire.", 160));
    p.setMinistere(obligatoire(s.ministere(), "Le nom du ministère est obligatoire.", 240));
    p.setSigleMinistere(obligatoire(s.sigleMinistere(), "Le sigle du ministère est obligatoire.", 20).toUpperCase(Locale.ROOT));
    p.setAutoriteRegionale(facultatif(s.autoriteRegionale(), 160));
    p.setPiedDePage(facultatif(s.piedDePage(), 240));
    if (s.ordre() != null) p.setOrdre(s.ordre());
  }

  private static String obligatoire(String value, String message, int max) {
    if (value == null || value.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    return borner(value.trim(), max);
  }

  private static String facultatif(String value, int max) {
    if (value == null || value.isBlank()) return null;
    return borner(value.trim(), max);
  }

  private static String borner(String value, int max) {
    if (value.length() > max) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
          String.format(Locale.ROOT, "Valeur trop longue (%d caractères maximum).", max));
    }
    return value;
  }
}
