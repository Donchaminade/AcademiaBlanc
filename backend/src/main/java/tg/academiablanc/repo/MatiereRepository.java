package tg.academiablanc.repo;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import tg.academiablanc.domain.Matiere;

public interface MatiereRepository extends JpaRepository<Matiere, Long> {
  List<Matiere> findByEtablissementIdOrderByNomAsc(Long etablissementId);
}
