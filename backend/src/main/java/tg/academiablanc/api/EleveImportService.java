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
import tg.academiablanc.domain.SessionExamen;
import tg.academiablanc.repo.AnneeScolaireRepository;
import tg.academiablanc.repo.ClasseRepository;
import tg.academiablanc.repo.EleveRepository;
import tg.academiablanc.repo.ParametresBulletinRepository;
import tg.academiablanc.repo.SessionExamenRepository;
import tg.academiablanc.security.Tenant;

/**
 * Import en masse d'élèves pour l'établissement du jeton : crée la classe au besoin,
 * attribue un matricule à chaque élève via {@link MatriculeService} et ignore les doublons
 * (même nom dans la même classe). Les élèves rattachés à une session reçoivent le numéro de
 * table suivant libre dans cette session ; en session inter-établissements, chaque ligne peut
 * porter l'établissement d'origine du candidat (texte libre, établissement hôte si vide).
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

  /** Une ligne d'import ; le matricule n'est pas accepté, il est toujours attribué par le serveur. */
  public record Ligne(@NotBlank @Size(max = 180) String nomComplet, @NotBlank @Size(min = 1, max = 1) String genre,
                      @Size(max = 20) String dateNaissance, @Size(max = 120) String lieuNaissance,
                      Long classeId, @Size(max = 120) String classeNom, Long sessionId,
                      @Size(max = 180) String etablissementOrigine) {}

  /**
   * Classe, session et établissement d'origine par défaut pour toutes les lignes ; chaque ligne peut
   * les surcharger. Un établissement d'origine vide laisse la colonne nulle (élève de l'établissement).
   */
  public record Demande(Long classeId, @Size(max = 120) String classeNom, Long sessionId,
                        @Size(max = 180) String etablissementOrigine, @NotEmpty @Valid List<Ligne> eleves) {}

  public record LigneIgnoree(String nomComplet, String motif) {}

  public record Resultat(int crees, int ignores, int total, List<String> classesCreees, List<LigneIgnoree> lignesIgnorees) {}

  private final EleveRepository eleves;
  private final ClasseRepository classes;
  private final AnneeScolaireRepository annees;
  private final SessionExamenRepository sessions;
  private final MatriculeService matricules;
  private final ParametresBulletinRepository parametres;

  public EleveImportService(EleveRepository eleves, ClasseRepository classes, AnneeScolaireRepository annees,
                            SessionExamenRepository sessions, MatriculeService matricules,
                            ParametresBulletinRepository parametres) {
    this.eleves = eleves;
    this.classes = classes;
    this.annees = annees;
    this.sessions = sessions;
    this.matricules = matricules;
    this.parametres = parametres;
  }

  @Transactional
  public Resultat importer(Demande demande) {
    // Le droit ELEVES:CREER est vérifié par le contrôleur.
    Long etab = Tenant.current().etablissementId();
    MatriculeService.Sequence sequence = matricules.sequence(etab);

    Map<String, Classe> classesResolues = new HashMap<>();
    Map<Long, Set<String>> nomsParClasse = new HashMap<>();
    List<String> classesCreees = new ArrayList<>();
    List<LigneIgnoree> ignorees = new ArrayList<>();
    // Prochain numéro de table par session : lu une fois, puis incrémenté au fil des lignes créées.
    Map<Long, Integer> prochainNumeroParSession = new HashMap<>();
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
      String origine = vide(ligne.etablissementOrigine()) ? demande.etablissementOrigine() : ligne.etablissementOrigine();

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

      Eleve eleve = new Eleve();
      eleve.setEtablissementId(etab);
      eleve.setClasseId(classe.getId());
      eleve.setSessionId(sessionId);
      eleve.setNomComplet(nom);
      eleve.setMatricule(sequence.suivant());
      eleve.setDateNaissance(vide(ligne.dateNaissance()) ? null : ligne.dateNaissance().trim());
      eleve.setLieuNaissance(vide(ligne.lieuNaissance()) ? null : ligne.lieuNaissance().trim());
      eleve.setGenre(genre);
      eleve.setEtablissementOrigine(vide(origine) ? null : espaces(origine));
      if (sessionId != null) {
        int table = prochainNumeroParSession.computeIfAbsent(sessionId, id -> prochainNumeroTable(etab, id));
        eleve.setNumeroTable(table);
        prochainNumeroParSession.put(sessionId, table + 1);
      }
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

  /**
   * Numéro de table suivant dans une session : le plus grand numéro déjà attribué aux candidats de la
   * session et de ses sessions sœurs (même examen, même année), plus un ; à défaut le premier numéro
   * de table paramétré pour l'établissement (Paramètres › numérotation), sinon 1.
   */
  public int prochainNumeroTable(Long etab, Long sessionId) {
    SessionExamen session = sessions.findById(sessionId).orElseThrow(EleveImportService::absent);
    Set<Long> famille = new HashSet<>();
    famille.add(session.getId());
    for (SessionExamen autre : sessions.findByEtablissementIdOrderByNomAsc(etab)) {
      if (session.memeExamenMemeAnnee(autre)) famille.add(autre.getId());
    }
    int max = 0;
    for (Eleve eleve : eleves.findByEtablissementIdOrderByNomCompletAsc(etab)) {
      if (eleve.getSessionId() != null && famille.contains(eleve.getSessionId()) && eleve.getNumeroTable() != null) {
        max = Math.max(max, eleve.getNumeroTable());
      }
    }
    if (max > 0) return max + 1;
    return parametres.findById(etab)
        .map(params -> params.getPremierNumeroTable())
        .filter(premier -> premier != null && premier > 0)
        .orElse(1);
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
