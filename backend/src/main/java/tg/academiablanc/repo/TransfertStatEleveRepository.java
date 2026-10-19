package tg.academiablanc.repo;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import tg.academiablanc.domain.TransfertStatEleve;

public interface TransfertStatEleveRepository extends JpaRepository<TransfertStatEleve, Long> {
  List<TransfertStatEleve> findByEtablissementIdAndSessionId(Long etablissementId, Long sessionId);
}
