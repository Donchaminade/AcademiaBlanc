package tg.academiablanc.repo;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import tg.academiablanc.domain.AcceptationConditions;

public interface AcceptationConditionsRepository extends JpaRepository<AcceptationConditions, Long> {
  List<AcceptationConditions> findByEtablissementIdOrderByAccepteLeDescIdDesc(Long etablissementId);

  Optional<AcceptationConditions> findFirstByEtablissementIdOrderByAccepteLeDescIdDesc(Long etablissementId);
}
