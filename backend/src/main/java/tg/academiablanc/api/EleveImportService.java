package tg.academiablanc.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tg.academiablanc.domain.AnneeScolaire;
import tg.academiablanc.domain.Classe;
import tg.academiablanc.domain.Eleve;
import tg.academiablanc.domain.Etablissement;
import tg.academiablanc.repo.AnneeScolaireRepository;
import tg.academiablanc.repo.ClasseRepository;
import tg.academiablanc.repo.EleveRepository;
import tg.academiablanc.repo.EtablissementRepository;
import tg.academiablanc.repo.SessionExamenRepository;
import tg.academiablanc.security.Tenant;

/**
 * Import en masse d'élèves pour l'établissement du jeton : crée la classe au besoin,
 * génère les matricules manquants et ignore les doublons (même nom dans la même classe).
 */
@Service
public class EleveImportService {
  private static final Map<String, String> NIVEAUX = Map.ofEntries(
      Map.entry("6E", "Sixième"), Map.entry("6EME", "Sixième"), Map.entry("SIXIEME", "Sixième"),
      Map.entry("5E", "Cinquième"), Map.entry("5EME", "Cinquième"), Map.entry("CINQUIEME", "Cinquième"),
      Map.entry("4E", "Quatrième"), Map.entry("4EME", "Quatrième"), Map.entry("QUATRIEME", "Quatrième"),
      Map.entry("3E", "Troisième"), Map.entry("3EME", "Troisième"), Map.entry("TROISIEME", "Troisième"),
      Map.entry("2NDE", "Seconde"), Map.entry("2DE", "Seconde"), Map.entry("SECONDE", "Seconde"),
      Map.entry("1ERE", "Première"), Map.entry("1RE", "Première"), Map.entry("PREMIERE", "Première"),
      Map.entry("TLE", "Terminale"), Map.entry("TERMINALE", "Terminale"));

  public record Ligne(@NotBlank @Size(max = 180) String nomComplet, @NotBlank @Size(min = 1, max = 1) String genre,
                      @Size(max = 20) String dateNaissance, @Size(max = 120) String lieuNaissance, @Size(max = 60) String matricule,
                      Long classeId, @Size(max = 120) String classeNom, Long sessionId) {}

  /** Classe et session par défaut pour toutes les lignes ; chaque ligne peut les surcharger. */
  public record Demande(Long classeId, @Size(max = 120) String classeNom, Long sessionId, @NotEmpty @Valid List<Ligne> eleves) {}

  public record LigneIgnoree(String nomComplet, String motif) {}

  public record Resultat(int crees, int ignores, int total, List<String> classesCreees, List<LigneIgnoree> lignesIgnorees) {}

  private final EleveRepository eleves;
  private final ClasseRepository classes;
  private final AnneeScolaireRepository annees;
  private final SessionExamenRepository sessions;
  private final EtablissementRepository etablissements;

  public EleveImportService(EleveRepository eleves, ClasseRepository classes, AnneeScolaireRepository annees,
                            SessionExamenRepository sessions, EtablissementRepository etablissements) {
    this.eleves = eleves;
    this.classes = classes;
    this.annees = annees;
    this.sessions = sessions;
    this.etablissements = etablissements;
  }

  @Transactional
  public Resultat importer(Demande demande) {
    Tenant.requireStaff();
    Long etab = Tenant.current().etablissementId();
    String codeEtab = etablissements.findById(etab).map(Etablissement::getCode).orElse("ETAB");

    Map<String, Classe> classesResolues = new HashMap<>();
    Map<Long, Set<String>> nomsParClasse = new HashMap<>();
    Map<Long, Integer> compteurs = new HashMap<>();
    List<String> classesCreees = new ArrayList<>();
    List<LigneIgnoree> ignorees = new ArrayList<>();
    int crees = 0;

    for (int i = 0; i < demande.eleves().size(); i++) {
      Ligne ligne = demande.eleves().get(i);
      int numero = i + 1;
      String nom = espaces(ligne.nomComplet());
      String genre = ligne.genre().trim().toUpperCase(Locale.ROOT);
      if (!genre.equals("M") && !genre.equals("F")) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ligne " + numero + " (" + nom + ") : le genre doit être M ou F.");
      }
      Long classeId = ligne.classeId() != null ? ligne.classeId() : demande.classeId();
      String classeNom = vide(ligne.classeNom()) ? demande.classeNom() : ligne.classeNom();
      Classe classe = resoudreClasse(etab, classeId, classeNom, numero, classesResolues, classesCreees);
      Long sessionId = ligne.sessionId() != null ? ligne.sessionId() : demande.sessionId();
      if (sessionId != null) verifierSession(sessionId);

      Set<String> noms = nomsParClasse.computeIfAbsent(classe.getId(), id -> {
        Set<String> existants = new HashSet<>();
        for (Eleve existant : eleves.findByEtablissementIdAndClasseId(etab, id)) {
          existants.add(cle(existant.getNomComplet()));
        }
        return existants;
      });
      if (!noms.add(cle(nom))) {
        ignorees.add(new LigneIgnoree(nom, "déjà inscrit dans la classe " + classe.getNom()));
        continue;
      }

      String matricule;
      if (vide(ligne.matricule())) {
        matricule = genererMatricule(etab, codeEtab, classe, compteurs);
      } else {
        matricule = ligne.matricule().trim();
        if (eleves.existsByEtablissementIdAndMatricule(etab, matricule)) {
          noms.remove(cle(nom));
          ignorees.add(new LigneIgnoree(nom, "matricule " + matricule + " déjà utilisé"));
          continue;
        }
      }

      Eleve eleve = new Eleve();
      eleve.setEtablissementId(etab);
      eleve.setClasseId(classe.getId());
      eleve.setSessionId(sessionId);
      eleve.setNomComplet(nom);
      eleve.setMatricule(matricule);
      eleve.setDateNaissance(vide(ligne.dateNaissance()) ? null : ligne.dateNaissance().trim());
      eleve.setLieuNaissance(vide(ligne.lieuNaissance()) ? null : ligne.lieuNaissance().trim());
      eleve.setGenre(genre);
      eleves.save(eleve);
      crees++;
    }
    return new Resultat(crees, ignorees.size(), demande.eleves().size(), classesCreees, ignorees);
  }

  private Classe resoudreClasse(Long etab, Long classeId, String classeNom, int numero,
                                Map<String, Classe> cache, List<String> classesCreees) {
    if (classeId != null) {
      return cache.computeIfAbsent("id:" + classeId, k -> {
        Classe classe = classes.findById(classeId).orElseThrow(EleveImportService::absent);
        Tenant.same(classe.getEtablissementId());
        return classe;
      });
    }
    if (vide(classeNom)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ligne " + numero + " : indiquez la classe (classeId ou classeNom).");
    }
    String nom = espaces(classeNom);
    return cache.computeIfAbsent("nom:" + cle(nom), k ->
        classes.findFirstByEtablissementIdAndNomIgnoreCase(etab, nom).orElseGet(() -> {
          Classe classe = new Classe();
          classe.setEtablissementId(etab);
          classe.setAnneeScolaireId(anneeCourante(etab));
          classe.setNom(nom);
          classe.setNiveau(niveauPour(nom));
          classe.setSerie(null);
          Classe creee = classes.save(classe);
          classesCreees.add(creee.getNom());
          return creee;
        }));
  }

  private Long anneeCourante(Long etab) {
    List<AnneeScolaire> liste = annees.findByEtablissementIdOrderByLibelleDesc(etab);
    if (liste.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Créez d'abord une année scolaire avant d'importer des élèves.");
    }
    return liste.stream().filter(AnneeScolaire::isCourante).findFirst().orElse(liste.get(0)).getId();
  }

  private void verifierSession(Long id) {
    var session = sessions.findById(id).orElseThrow(EleveImportService::absent);
    Tenant.same(session.getEtablissementId());
  }

  private String genererMatricule(Long etab, String codeEtab, Classe classe, Map<Long, Integer> compteurs) {
    String codeClasse = sansAccents(classe.getNom()).toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
    if (codeClasse.isBlank()) codeClasse = "CL";
    String prefixe = codeEtab + "-" + codeClasse + "-";
    int suivant = compteurs.computeIfAbsent(classe.getId(), id -> eleves.findByEtablissementIdAndClasseId(etab, id).size() + 1);
    String matricule = prefixe + String.format("%03d", suivant);
    while (eleves.existsByEtablissementIdAndMatricule(etab, matricule)) {
      suivant++;
      matricule = prefixe + String.format("%03d", suivant);
    }
    compteurs.put(classe.getId(), suivant + 1);
    return matricule;
  }

  static String niveauPour(String nomClasse) {
    String compact = sansAccents(nomClasse).toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
    for (Map.Entry<String, String> entry : NIVEAUX.entrySet()) {
      if (compact.startsWith(entry.getKey())) return entry.getValue();
    }
    return nomClasse;
  }

  private static String cle(String valeur) {
    return sansAccents(espaces(valeur)).toUpperCase(Locale.ROOT);
  }

  private static String sansAccents(String valeur) {
    return Normalizer.normalize(valeur, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
  }

  private static String espaces(String valeur) {
    return valeur.trim().replaceAll("\\s+", " ");
  }

  private static boolean vide(String valeur) {
    return valeur == null || valeur.isBlank();
  }

  private static ResponseStatusException absent() {
    return new ResponseStatusException(HttpStatus.NOT_FOUND, "Ressource introuvable.");
  }
}
