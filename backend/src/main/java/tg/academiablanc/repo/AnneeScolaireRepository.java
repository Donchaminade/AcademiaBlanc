package tg.academiablanc.repo;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import tg.academiablanc.domain.AnneeScolaire;

public interface AnneeScolaireRepository extends JpaRepository<AnneeScolaire, Long> {
  List<AnneeScolaire> findByEtablissementIdOrderByLibelleDesc(Long etablissementId);
}
