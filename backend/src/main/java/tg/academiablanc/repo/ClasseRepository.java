package tg.academiablanc.repo;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import tg.academiablanc.domain.Classe;

public interface ClasseRepository extends JpaRepository<Classe, Long> {
  List<Classe> findByEtablissementIdOrderByNomAsc(Long etablissementId);

  long countByEtablissementId(Long etablissementId);

  Optional<Classe> findFirstByEtablissementIdAndNomIgnoreCase(Long etablissementId, String nom);

  boolean existsByEtablissementIdAndSerieIgnoreCase(Long etablissementId, String serie);
}
