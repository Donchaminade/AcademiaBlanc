package tg.academiablanc.repo;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import tg.academiablanc.domain.CentreExamen;

public interface CentreExamenRepository extends JpaRepository<CentreExamen, Long> {
  List<CentreExamen> findByEtablissementIdOrderByNomAsc(Long etablissementId);
}
