package tg.academiablanc.repo;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import tg.academiablanc.domain.PrereglageNational;

public interface PrereglageNationalRepository extends JpaRepository<PrereglageNational, Long> {
  List<PrereglageNational> findAllByOrderByOrdreAscNomPaysAsc();

  List<PrereglageNational> findByActifTrueOrderByOrdreAscNomPaysAsc();

  Optional<PrereglageNational> findByCodeIgnoreCase(String code);

  List<PrereglageNational> findByParDefautTrue();
}
