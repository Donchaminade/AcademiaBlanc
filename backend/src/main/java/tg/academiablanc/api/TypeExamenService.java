package tg.academiablanc.api;

import java.text.Normalizer;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tg.academiablanc.domain.CycleExamen;
import tg.academiablanc.domain.Etablissement;
import tg.academiablanc.domain.ModeSession;
import tg.academiablanc.domain.SessionExamen;
import tg.academiablanc.domain.TypeExamen;
import tg.academiablanc.repo.EtablissementRepository;
import tg.academiablanc.repo.SessionExamenRepository;
import tg.academiablanc.repo.TypeExamenRepository;

/**
 * Référentiel des types d'examen de la plateforme et rattachement des sessions d'examen.
 *
 * <p>Le référentiel est commun à tous les établissements. Un type utilisé par au moins une session
 * ne se supprime pas : on le désactive (il disparaît des formulaires, les sessions existantes le gardent).</p>
 */
@Service
public class TypeExamenService {
  public static final String MESSAGE_TYPE_INCONNU = "Type d'examen introuvable.";
  public static final String MESSAGE_TYPE_INACTIF = "Ce type d'examen est désactivé : choisissez un type actif.";
  public static final String MESSAGE_TYPE_REQUIS = "Choisissez un type d'examen.";
  public static final String MESSAGE_CODE_DOUBLON = "Un type d'examen porte déjà ce code.";

  private final TypeExamenRepository types;
  private final SessionExamenRepository sessions;
  private final EtablissementRepository etablissements;

  public TypeExamenService(TypeExamenRepository types, SessionExamenRepository sessions, EtablissementRepository etablissements) {
    this.types = types;
    this.sessions = sessions;
    this.etablissements = etablissements;
  }

  /** Fiche d'un type pour la plateforme, avec le nombre de sessions (tous établissements) qui l'utilisent. */
  public record TypeExamenVue(
      Long id,
      String code,
      String libelleCourt,
      String libelleLong,
      CycleExamen cycle,
      int ordre,
      boolean actif,
      long sessions
  ) {}

  /** Fiche d'un type pour les établissements : lecture seule, sans compteur. */
  public record TypeExamenChoix(Long id, String code, String libelleCourt, String libelleLong, CycleExamen cycle, int ordre) {}

  /**
   * Session d'examen enrichie du type du référentiel (ou du repli texte pour une session non rattachée).
   * {@code mode} : INTERNE ou INTER_ETABLISSEMENTS ; {@code centreExamen} : nom de l'établissement hôte
   * ({@code etablissement.nom}) quand la session est inter-établissements, null en mode interne.
   */
  public record SessionVue(
      Long id,
      Long etablissementId,
      Long anneeScolaireId,
      Long centreId,
      String nom,
      String typeExamen,
      Long typeExamenId,
      String typeExamenCode,
      String typeExamenLibelle,
      String typeExamenLibelleLong,
      CycleExamen typeExamenCycle,
      /** Vrai quand la session n'est pas rattachée au référentiel (créée avant cette version). */
      boolean typeExamenHorsReferentiel,
      String serie,
      String statut,
      Instant archiveeLe,
      ModeSession mode,
      String centreExamen
  ) {}

  /* ------------------------------------------------------------------ */
  /* Lecture                                                             */
  /* ------------------------------------------------------------------ */

  public List<TypeExamenVue> listerTous() {
    return types.findAllByOrderByOrdreAscLibelleCourtAsc().stream().map(this::vue).toList();
  }

  /** Types actifs, éventuellement limités à un cycle (les types « TOUS » restent proposés). */
  public List<TypeExamenChoix> listerActifs(CycleExamen cycle) {
    return types.findByActifTrueOrderByOrdreAscLibelleCourtAsc().stream()
        .filter(t -> t.getCycle().convientPour(cycle))
        .map(t -> new TypeExamenChoix(t.getId(), t.getCode(), t.getLibelleCourt(), t.getLibelleLong(), t.getCycle(), t.getOrdre()))
        .toList();
  }

  public TypeExamen charger(Long id) {
    return types.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, MESSAGE_TYPE_INCONNU));
  }

  public TypeExamenVue vue(TypeExamen type) {
    return new TypeExamenVue(type.getId(), type.getCode(), type.getLibelleCourt(), type.getLibelleLong(), type.getCycle(),
        type.getOrdre(), type.isActif(), sessions.countByTypeExamenId(type.getId()));
  }

  /* ------------------------------------------------------------------ */
  /* Écriture (plateforme)                                               */
  /* ------------------------------------------------------------------ */

  @Transactional
  public TypeExamenVue creer(String code, String libelleCourt, String libelleLong, CycleExamen cycle, Integer ordre, Boolean actif) {
    String codeNormalise = normaliserCode(code);
    if (types.findByCodeIgnoreCase(codeNormalise).isPresent()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, MESSAGE_CODE_DOUBLON);
    }
    TypeExamen type = new TypeExamen();
    type.setCode(codeNormalise);
    appliquer(type, libelleCourt, libelleLong, cycle, ordre, actif);
    return vue(types.save(type));
  }

  @Transactional
  public TypeExamenVue modifier(TypeExamen type, String code, String libelleCourt, String libelleLong, CycleExamen cycle, Integer ordre, Boolean actif) {
    String codeNormalise = normaliserCode(code);
    Optional<TypeExamen> homonyme = types.findByCodeIgnoreCase(codeNormalise);
    if (homonyme.isPresent() && !homonyme.get().getId().equals(type.getId())) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, MESSAGE_CODE_DOUBLON);
    }
    type.setCode(codeNormalise);
    appliquer(type, libelleCourt, libelleLong, cycle, ordre, actif);
    TypeExamen enregistre = types.save(type);
    // Les sessions gardent un libellé texte pour les bulletins et archives : on le resynchronise.
    sessions.renommerTypeExamen(enregistre.getId(), enregistre.getLibelleCourt());
    return vue(enregistre);
  }

  /** 409 si des sessions utilisent le type : il faut alors le désactiver. */
  @Transactional
  public void supprimer(TypeExamen type) {
    long utilisations = sessions.countByTypeExamenId(type.getId());
    if (utilisations > 0) {
      throw new ResponseStatusException(HttpStatus.CONFLICT,
          "Ce type d'examen est utilisé par " + utilisations + " session" + (utilisations > 1 ? "s" : "")
              + " : désactivez-le plutôt que de le supprimer.");
    }
    types.delete(type);
    types.flush();
  }

  private static void appliquer(TypeExamen type, String libelleCourt, String libelleLong, CycleExamen cycle, Integer ordre, Boolean actif) {
    type.setLibelleCourt(libelleCourt.trim());
    type.setLibelleLong(libelleLong.trim());
    type.setCycle(cycle == null ? CycleExamen.TOUS : cycle);
    if (ordre != null) type.setOrdre(ordre);
    if (actif != null) type.setActif(actif);
  }

  private static String normaliserCode(String code) {
    String brut = code == null ? "" : code.trim().toUpperCase(Locale.ROOT);
    if (brut.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le code du type d'examen est obligatoire.");
    return brut;
  }

  /* ------------------------------------------------------------------ */
  /* Sessions                                                            */
  /* ------------------------------------------------------------------ */

  /**
   * Rattache une session à un type : par identifiant (type actif exigé), sinon en reconnaissant le libellé texte
   * fourni par un client antérieur. Le texte de la session reprend toujours le libellé court du référentiel.
   */
  public void rattacher(SessionExamen session, Long typeExamenId, String typeExamenTexte) {
    String texte = typeExamenTexte == null ? "" : typeExamenTexte.trim();
    if (typeExamenId != null) {
      TypeExamen type = charger(typeExamenId);
      if (!type.isActif()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, MESSAGE_TYPE_INACTIF);
      session.setTypeExamenId(type.getId());
      session.setTypeExamen(type.getLibelleCourt());
      return;
    }
    if (texte.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, MESSAGE_TYPE_REQUIS);
    Optional<TypeExamen> devine = deviner(texte).filter(TypeExamen::isActif);
    session.setTypeExamenId(devine.map(TypeExamen::getId).orElse(null));
    session.setTypeExamen(devine.map(TypeExamen::getLibelleCourt).orElse(texte));
  }

  /** Vue d'une session : type rattaché, sinon repli sur le texte (en essayant de le reconnaître). */
  public SessionVue vue(SessionExamen session) {
    TypeExamen type = session.getTypeExamenId() == null ? null : types.findById(session.getTypeExamenId()).orElse(null);
    boolean horsReferentiel = type == null;
    if (type == null) type = deviner(session.getTypeExamen()).orElse(null);
    return new SessionVue(
        session.getId(),
        session.getEtablissementId(),
        session.getAnneeScolaireId(),
        session.getCentreId(),
        session.getNom(),
        session.getTypeExamen(),
        horsReferentiel ? null : type.getId(),
        type == null ? null : type.getCode(),
        type == null ? session.getTypeExamen() : type.getLibelleCourt(),
        type == null ? session.getTypeExamen() : type.getLibelleLong(),
        type == null ? null : type.getCycle(),
        horsReferentiel,
        session.getSerie(),
        session.getStatut(),
        session.getArchiveeLe(),
        ModeSession.ouDefaut(session.getMode()),
        session.estInterEtablissements() ? nomCentre(session.getEtablissementId()) : null
    );
  }

  /** Nom du centre d'examen d'une session inter-établissements : l'établissement qui l'a créée. */
  public String nomCentre(Long etablissementId) {
    return etablissements.findById(etablissementId).map(Etablissement::getNom).orElse(null);
  }

  /**
   * Reconnaît un type d'après un libellé libre (« BAC II », « BACCALAURÉAT II », « bepc blanc »…).
   * Même logique que la migration V14 : code ou libellés exacts, puis motifs BEPC / CEPD / BAC I / BAC II.
   */
  public Optional<TypeExamen> deviner(String texte) {
    if (texte == null || texte.isBlank()) return Optional.empty();
    String norm = sansAccents(texte).toUpperCase(Locale.ROOT).trim();
    List<TypeExamen> tous = types.findAllByOrderByOrdreAscLibelleCourtAsc();
    for (TypeExamen t : tous) {
      if (norm.equals(t.getCode()) || norm.equals(sansAccents(t.getLibelleCourt()).toUpperCase(Locale.ROOT))
          || norm.equals(sansAccents(t.getLibelleLong()).toUpperCase(Locale.ROOT))) {
        return Optional.of(t);
      }
    }
    String code;
    if (norm.contains("BEPC")) code = "BEPC";
    else if (norm.contains("CEPD")) code = "CEPD";
    else if (norm.contains("BAC") && (norm.matches(".*BAC\\S*\\s+II\\b.*") || norm.matches(".*BAC\\S*\\s+2\\b.*") || norm.contains("DEUXIEME PARTIE"))) code = "BAC2";
    else if (norm.contains("BAC") && (norm.matches(".*BAC\\S*\\s+I\\b.*") || norm.matches(".*BAC\\S*\\s+1\\b.*")
        || norm.contains("PREMIERE PARTIE") || norm.contains("PROBATOIRE"))) code = "BAC1";
    else if (norm.contains("BAC")) code = "BAC2";
    else if (norm.contains("COMPO") || norm.contains("BLANC INTERNE")) code = "COMPO";
    else return Optional.empty();
    return types.findByCodeIgnoreCase(code);
  }

  private static String sansAccents(String valeur) {
    return Normalizer.normalize(valeur == null ? "" : valeur, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
  }
}
