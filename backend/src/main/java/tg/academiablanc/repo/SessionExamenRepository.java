package tg.academiablanc.repo;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import tg.academiablanc.domain.SessionExamen;

public interface SessionExamenRepository extends JpaRepository<SessionExamen, Long> {
  List<SessionExamen> findByEtablissementIdOrderByNomAsc(Long etablissementId);
}
