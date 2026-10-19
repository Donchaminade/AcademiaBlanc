package tg.academiablanc.repo;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import tg.academiablanc.domain.TypeExamen;

public interface TypeExamenRepository extends JpaRepository<TypeExamen, Long> {
  List<TypeExamen> findAllByOrderByOrdreAscLibelleCourtAsc();

  List<TypeExamen> findByActifTrueOrderByOrdreAscLibelleCourtAsc();

  Optional<TypeExamen> findByCodeIgnoreCase(String code);
}
