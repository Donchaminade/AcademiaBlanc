package tg.academiablanc.api;

import java.util.ArrayList;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import tg.academiablanc.domain.AnneeScolaire;
import tg.academiablanc.repo.ClasseRepository;
import tg.academiablanc.repo.SessionExamenRepository;

/**
 * Vérifie qu'une année scolaire peut être supprimée et explique, sinon, ce qui la retient.
 * Les règles sont contrôlées avant la requête SQL afin de renvoyer un message précis
 * (nombre de sessions et de classes rattachées) plutôt qu'une simple erreur de clé étrangère.
 */
@Component
public class AnneeDependances {
  public static final String MESSAGE_ANNEE_COURANTE =
      "L'année courante ne peut pas être supprimée. Définissez d'abord une autre année courante.";

  private final SessionExamenRepository sessions;
  private final ClasseRepository classes;

  public AnneeDependances(SessionExamenRepository sessions, ClasseRepository classes) {
    this.sessions = sessions;
    this.classes = classes;
  }

  /** Lève un 409 si l'année est courante ou si des sessions / classes y sont encore rattachées. */
  public void verifierSupprimable(AnneeScolaire annee) {
    if (annee.isCourante()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, MESSAGE_ANNEE_COURANTE);
    }
    long nbSessions = sessions.countByAnneeScolaireId(annee.getId());
    long nbClasses = classes.countByAnneeScolaireId(annee.getId());
    if (nbSessions > 0 || nbClasses > 0) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, messageRattachements(annee.getLibelle(), nbSessions, nbClasses));
    }
  }

  static String messageRattachements(String libelle, long nbSessions, long nbClasses) {
    List<String> parts = new ArrayList<>();
    if (nbSessions > 0) parts.add(nbSessions + (nbSessions > 1 ? " sessions" : " session"));
    if (nbClasses > 0) parts.add(nbClasses + (nbClasses > 1 ? " classes" : " classe"));
    boolean pluriel = nbSessions + nbClasses > 1;
    return "Impossible de supprimer l'année " + libelle + " : " + String.join(" et ", parts)
        + (pluriel ? " y sont rattachées" : " y est rattachée")
        + ". Supprimez-les ou rattachez-les à une autre année d'abord.";
  }
}
