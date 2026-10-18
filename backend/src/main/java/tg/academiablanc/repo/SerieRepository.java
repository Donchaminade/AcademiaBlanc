package tg.academiablanc.repo;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import tg.academiablanc.domain.Serie;

public interface SerieRepository extends JpaRepository<Serie, Long> {
  List<Serie> findByEtablissementIdOrderByFamilleAscOrdreAscCodeAsc(Long etablissementId);

  Optional<Serie> findByEtablissementIdAndCodeIgnoreCase(Long etablissementId, String code);

  boolean existsByEtablissementId(Long etablissementId);
}
