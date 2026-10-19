package tg.academiablanc.repo;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import tg.academiablanc.domain.SessionExamen;

public interface SessionExamenRepository extends JpaRepository<SessionExamen, Long> {
  List<SessionExamen> findByEtablissementIdOrderByNomAsc(Long etablissementId);

  long countByEtablissementId(Long etablissementId);
  long countByAnneeScolaireId(Long anneeScolaireId);
  long countByTypeExamenId(Long typeExamenId);

  /** Resynchronise le libellé texte de toutes les sessions rattachées à un type renommé. */
  @Modifying
  @Query("UPDATE SessionExamen s SET s.typeExamen = :libelle WHERE s.typeExamenId = :typeExamenId")
  int renommerTypeExamen(@Param("typeExamenId") Long typeExamenId, @Param("libelle") String libelle);
}
