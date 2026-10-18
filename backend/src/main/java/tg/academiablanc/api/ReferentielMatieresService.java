package tg.academiablanc.api;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tg.academiablanc.api.ReferentielMatieres.MatiereRef;
import tg.academiablanc.domain.Classe;
import tg.academiablanc.domain.Coefficient;
import tg.academiablanc.domain.Matiere;
import tg.academiablanc.repo.ClasseRepository;
import tg.academiablanc.repo.CoefficientRepository;
import tg.academiablanc.repo.MatiereRepository;
import tg.academiablanc.security.Tenant;

/**
 * Charge le référentiel des matières principales dans l'établissement du jeton :
 * crée les matières manquantes (par code), renseigne leur groupe, puis crée pour chaque
 * classe un coefficient par matière s'il n'en existe pas encore. Relançable sans effet de bord.
 */
@Service
public class ReferentielMatieresService {

  /** Classe ciblée ; sans liste, toutes les classes de l'établissement sont traitées. */
  public record ClasseCible(Long classeId) {}

  /**
   * Demande de chargement.
   *
   * @param appliquerCoefficientsParDefaut vrai (défaut) pour créer les coefficients manquants d'après le référentiel
   * @param classes classes à traiter ; nulle ou vide = toutes les classes de l'établissement
   * @param coefficients surcharges facultatives : code matière → (classeId → valeur), prioritaires sur le référentiel
   */
  public record Demande(Boolean appliquerCoefficientsParDefaut, List<ClasseCible> classes,
                        Map<String, Map<Long, BigDecimal>> coefficients) {
    public boolean coefficientsVoulus() {
      return appliquerCoefficientsParDefaut == null || appliquerCoefficientsParDefaut;
    }
  }

  public record Resultat(int matieresCreees, int matieresExistantes, int coefficientsCrees, int coefficientsExistants) {}

  private final MatiereRepository matieres;
  private final CoefficientRepository coefficients;
  private final ClasseRepository classes;

  public ReferentielMatieresService(MatiereRepository matieres, CoefficientRepository coefficients, ClasseRepository classes) {
    this.matieres = matieres;
    this.coefficients = coefficients;
    this.classes = classes;
  }

  @Transactional
  public Resultat charger(Demande demande) {
    Long etab = Tenant.current().etablissementId();
    Demande d = demande != null ? demande : new Demande(null, null, null);

    Map<String, Matiere> existantes = new HashMap<>();
    for (Matiere m : matieres.findByEtablissementIdOrderByNomAsc(etab)) {
      existantes.put(m.getCode().toLowerCase(Locale.ROOT), m);
    }

    int creees = 0;
    int dejaLa = 0;
    Map<String, Matiere> parCode = new HashMap<>();
    for (MatiereRef ref : ReferentielMatieres.MATIERES) {
      Matiere m = existantes.get(ref.code());
      if (m == null) {
        m = new Matiere();
        m.setEtablissementId(etab);
        m.setCode(ref.code());
        creees++;
      } else {
        dejaLa++;
      }
      m.setNom(ref.nom());
      m.setGroupeCode(ref.groupeCode());
      m.setGroupeLibelle(ref.groupeLibelle());
      parCode.put(ref.code(), matieres.save(m));
    }

    int coefsCrees = 0;
    int coefsExistants = 0;
    if (d.coefficientsVoulus() || (d.coefficients() != null && !d.coefficients().isEmpty())) {
      Map<String, Map<Long, BigDecimal>> surcharges = normaliserSurcharges(d.coefficients());
      for (Classe classe : classesCibles(etab, d.classes())) {
        for (MatiereRef ref : ReferentielMatieres.MATIERES) {
          Matiere m = parCode.get(ref.code());
          if (coefficients.findFirstByEtablissementIdAndMatiereIdAndClasseId(etab, m.getId(), classe.getId()).isPresent()) {
            coefsExistants++;
            continue;
          }
          BigDecimal valeur = surcharges.getOrDefault(ref.code(), Map.of()).get(classe.getId());
          if (valeur == null) {
            if (!d.coefficientsVoulus()) continue;
            valeur = ReferentielMatieres.coefficientParDefaut(ref.code(), classe);
          }
          Coefficient c = new Coefficient();
          c.setEtablissementId(etab);
          c.setMatiereId(m.getId());
          c.setClasseId(classe.getId());
          c.setSerie(classe.getSerie());
          c.setValeur(valeur);
          coefficients.save(c);
          coefsCrees++;
        }
      }
    }
    return new Resultat(creees, dejaLa, coefsCrees, coefsExistants);
  }

  private List<Classe> classesCibles(Long etab, List<ClasseCible> cibles) {
    List<Classe> toutes = classes.findByEtablissementIdOrderByNomAsc(etab);
    if (cibles == null || cibles.isEmpty()) return toutes;
    List<Classe> retenues = new ArrayList<>();
    for (ClasseCible cible : cibles) {
      if (cible == null || cible.classeId() == null) continue;
      Classe classe = toutes.stream().filter(c -> c.getId().equals(cible.classeId())).findFirst()
          .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ressource introuvable."));
      if (!retenues.contains(classe)) retenues.add(classe);
    }
    return retenues;
  }

  private static Map<String, Map<Long, BigDecimal>> normaliserSurcharges(Map<String, Map<Long, BigDecimal>> brut) {
    Map<String, Map<Long, BigDecimal>> propre = new HashMap<>();
    if (brut == null) return propre;
    for (Map.Entry<String, Map<Long, BigDecimal>> e : brut.entrySet()) {
      if (e.getKey() == null || e.getValue() == null) continue;
      String code = e.getKey().trim().toLowerCase(Locale.ROOT);
      for (Map.Entry<Long, BigDecimal> v : e.getValue().entrySet()) {
        if (v.getKey() == null || v.getValue() == null) continue;
        if (v.getValue().compareTo(new BigDecimal("0.5")) < 0 || v.getValue().compareTo(BigDecimal.valueOf(20)) > 0) {
          throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le coefficient de " + code + " doit être compris entre 0,5 et 20.");
        }
        propre.computeIfAbsent(code, k -> new HashMap<>()).put(v.getKey(), v.getValue());
      }
    }
    return propre;
  }
}
