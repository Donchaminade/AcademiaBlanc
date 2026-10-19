package tg.academiablanc.api;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tg.academiablanc.domain.Classe;
import tg.academiablanc.domain.Coefficient;
import tg.academiablanc.domain.Matiere;
import tg.academiablanc.repo.ClasseRepository;
import tg.academiablanc.repo.CoefficientRepository;
import tg.academiablanc.repo.MatiereRepository;
import tg.academiablanc.security.Tenant;

/**
 * Programme d'une classe : l'ensemble des matières qui lui sont affectées, chacune avec son
 * coefficient. Il est porté par la table {@code coefficient} : une ligne (matière, classe) =
 * « la matière est au programme de la classe ». Une classe sans aucune ligne n'a pas de
 * programme défini : le bulletin retombe alors sur toutes les matières et les coefficients
 * globaux (compatibilité avec les établissements qui n'ont pas encore affecté leurs matières).
 */
@Service
public class ProgrammeClasseService {

  public static final BigDecimal COEFFICIENT_MIN = new BigDecimal("0.5");
  public static final BigDecimal COEFFICIENT_MAX = BigDecimal.valueOf(20);

  /** Une matière du programme, telle que renvoyée par l'API. */
  public record LigneProgramme(Long matiereId, String code, String nom, String groupe, String groupeLibelle, BigDecimal coefficient) {}

  /** Une matière à affecter ; coefficient facultatif (1 par défaut). */
  public record LigneDemande(Long matiereId, BigDecimal coefficient) {}

  /** Coefficient proposé pour une matière du catalogue, d'après le niveau et la série de la classe. */
  public record Suggestion(Long matiereId, String code, BigDecimal coefficient) {}

  private final ClasseRepository classes;
  private final MatiereRepository matieres;
  private final CoefficientRepository coefficients;

  public ProgrammeClasseService(ClasseRepository classes, MatiereRepository matieres, CoefficientRepository coefficients) {
    this.classes = classes;
    this.matieres = matieres;
    this.coefficients = coefficients;
  }

  /** Programme de la classe, dans l'ordre du bulletin (LT, SC, puis hors groupe). Vide si rien n'est défini. */
  @Transactional(readOnly = true)
  public List<LigneProgramme> lire(Long classeId) {
    Classe classe = classeDuTenant(classeId);
    return lignes(classe.getEtablissementId(), classe.getId());
  }

  /**
   * Remplace le programme de la classe : met à jour les coefficients des matières conservées,
   * crée les nouvelles affectations et supprime celles qui ne figurent plus dans la demande.
   * Une liste vide retire le programme (la classe repasse en mode « coefficients globaux »).
   */
  @Transactional
  public List<LigneProgramme> remplacer(Long classeId, List<LigneDemande> demande) {
    Classe classe = classeDuTenant(classeId);
    Long etab = classe.getEtablissementId();
    Map<Long, BigDecimal> voulu = normaliser(etab, demande);

    Map<Long, Coefficient> existants = new HashMap<>();
    for (Coefficient c : coefficients.findByEtablissementIdAndClasseId(etab, classe.getId())) {
      existants.put(c.getMatiereId(), c);
    }
    for (Map.Entry<Long, BigDecimal> e : voulu.entrySet()) {
      Coefficient c = existants.remove(e.getKey());
      if (c == null) {
        c = new Coefficient();
        c.setEtablissementId(etab);
        c.setMatiereId(e.getKey());
        c.setClasseId(classe.getId());
        c.setSerie(classe.getSerie());
      }
      c.setValeur(e.getValue());
      coefficients.save(c);
    }
    coefficients.deleteAll(existants.values());
    coefficients.flush();
    return lignes(etab, classe.getId());
  }

  /** Copie le programme d'une autre classe du même établissement (remplace celui de la cible). */
  @Transactional
  public List<LigneProgramme> copier(Long classeId, Long sourceId) {
    Classe cible = classeDuTenant(classeId);
    Classe source = classeDuTenant(sourceId);
    if (cible.getId().equals(source.getId())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choisissez une autre classe que celle-ci comme modèle.");
    }
    List<LigneDemande> lignes = new ArrayList<>();
    for (Coefficient c : coefficients.findByEtablissementIdAndClasseId(source.getEtablissementId(), source.getId())) {
      lignes.add(new LigneDemande(c.getMatiereId(), c.getValeur()));
    }
    if (lignes.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La classe « " + source.getNom() + " » n'a pas encore de programme à copier.");
    }
    return remplacer(cible.getId(), lignes);
  }

  /**
   * Suggestion de départ pour l'écran d'affectation : toutes les matières du catalogue, avec le
   * coefficient par défaut du référentiel selon le niveau et la série de la classe (1 pour une
   * matière hors référentiel). Rien n'est enregistré.
   */
  @Transactional(readOnly = true)
  public List<Suggestion> suggerer(Long classeId) {
    Classe classe = classeDuTenant(classeId);
    List<Matiere> catalogue = new ArrayList<>(matieres.findByEtablissementIdOrderByNomAsc(classe.getEtablissementId()));
    catalogue.sort(ReferentielMatieres.ORDRE_BULLETIN);
    List<Suggestion> suggestions = new ArrayList<>();
    for (Matiere m : catalogue) {
      suggestions.add(new Suggestion(m.getId(), m.getCode(), ReferentielMatieres.coefficientParDefaut(m.getCode(), classe)));
    }
    return suggestions;
  }

  /** Coefficients du programme (matière → valeur) ; vide si la classe n'a aucun programme défini. */
  @Transactional(readOnly = true)
  public Map<Long, BigDecimal> programmeDe(Long etablissementId, Long classeId) {
    Map<Long, BigDecimal> map = new LinkedHashMap<>();
    if (classeId == null) return map;
    for (Coefficient c : coefficients.findByEtablissementIdAndClasseId(etablissementId, classeId)) {
      map.putIfAbsent(c.getMatiereId(), c.getValeur());
    }
    return map;
  }

  /** Vrai si la classe a un programme et que la matière n'en fait pas partie. */
  @Transactional(readOnly = true)
  public boolean horsProgramme(Long etablissementId, Long classeId, Long matiereId) {
    Map<Long, BigDecimal> programme = programmeDe(etablissementId, classeId);
    return !programme.isEmpty() && !programme.containsKey(matiereId);
  }

  private List<LigneProgramme> lignes(Long etab, Long classeId) {
    Map<Long, BigDecimal> programme = programmeDe(etab, classeId);
    if (programme.isEmpty()) return List.of();
    List<Matiere> retenues = new ArrayList<>();
    for (Matiere m : matieres.findByEtablissementIdOrderByNomAsc(etab)) {
      if (programme.containsKey(m.getId())) retenues.add(m);
    }
    retenues.sort(ReferentielMatieres.ORDRE_BULLETIN);
    List<LigneProgramme> resultat = new ArrayList<>();
    for (Matiere m : retenues) {
      resultat.add(new LigneProgramme(m.getId(), m.getCode(), m.getNom(), m.getGroupeCode(), m.getGroupeLibelle(), programme.get(m.getId())));
    }
    return resultat;
  }

  /** Vérifie chaque ligne : matière de l'établissement, pas de doublon, coefficient dans [0,5 ; 20] (1 par défaut). */
  private Map<Long, BigDecimal> normaliser(Long etab, List<LigneDemande> demande) {
    Map<Long, BigDecimal> voulu = new LinkedHashMap<>();
    if (demande == null) return voulu;
    for (LigneDemande ligne : demande) {
      if (ligne == null || ligne.matiereId() == null) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Chaque ligne du programme doit désigner une matière.");
      }
      Matiere matiere = matieres.findById(ligne.matiereId())
          .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Matière introuvable."));
      Tenant.same(matiere.getEtablissementId());
      if (!etab.equals(matiere.getEtablissementId())) {
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Matière introuvable.");
      }
      BigDecimal coefficient = ligne.coefficient() == null ? BigDecimal.ONE : ligne.coefficient();
      if (coefficient.compareTo(COEFFICIENT_MIN) < 0 || coefficient.compareTo(COEFFICIENT_MAX) > 0) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
            "Le coefficient de « " + matiere.getNom() + " » doit être compris entre 0,5 et 20.");
      }
      if (voulu.put(matiere.getId(), coefficient) != null) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La matière « " + matiere.getNom() + " » figure deux fois dans le programme.");
      }
    }
    return voulu;
  }

  private Classe classeDuTenant(Long classeId) {
    Classe classe = classes.findById(classeId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ressource introuvable."));
    Tenant.same(classe.getEtablissementId());
    return classe;
  }
}
