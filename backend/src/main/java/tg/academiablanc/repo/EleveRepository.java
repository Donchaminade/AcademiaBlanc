package tg.academiablanc.repo;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import tg.academiablanc.domain.Eleve;

public interface EleveRepository extends JpaRepository<Eleve, Long> {
  List<Eleve> findByEtablissementIdOrderByNomCompletAsc(Long etablissementId);

  List<Eleve> findByEtablissementIdAndSessionId(Long etablissementId, Long sessionId);

  long countByEtablissementId(Long etablissementId);

  List<Eleve> findByEtablissementIdAndClasseId(Long etablissementId, Long classeId);

  boolean existsByEtablissementIdAndMatricule(Long etablissementId, String matricule);
}
