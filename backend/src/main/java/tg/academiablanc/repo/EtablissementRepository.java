package tg.academiablanc.repo;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import tg.academiablanc.domain.Etablissement;

public interface EtablissementRepository extends JpaRepository<Etablissement, Long> {
  Optional<Etablissement> findByEmailIgnoreCase(String email);
  boolean existsByCode(String code);

  List<Etablissement> findAllByOrderByNomAsc();

  long countByPrereglageNationalId(Long prereglageNationalId);
}
