package tg.academiablanc.repo;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import tg.academiablanc.domain.Eleve;

public interface EleveRepository extends JpaRepository<Eleve, Long> {
  /** Matricules de l'établissement commençant par le préfixe donné (calcul du prochain numéro d'ordre). */
  @Query("select e.matricule from Eleve e where e.etablissementId = :etab and e.matricule like concat(:prefixe, '%')")
  List<String> findMatriculesCommencantPar(@Param("etab") Long etablissementId, @Param("prefixe") String prefixe);

  List<Eleve> findByEtablissementIdOrderByNomCompletAsc(Long etablissementId);

  List<Eleve> findByEtablissementIdAndSessionId(Long etablissementId, Long sessionId);

  long countByEtablissementId(Long etablissementId);

  List<Eleve> findByEtablissementIdAndClasseId(Long etablissementId, Long classeId);

  boolean existsByEtablissementIdAndMatricule(Long etablissementId, String matricule);
}
