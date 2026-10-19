package tg.academiablanc.repo;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import tg.academiablanc.domain.DeliberationJury;

public interface DeliberationJuryRepository extends JpaRepository<DeliberationJury, Long> {
  List<DeliberationJury> findByEtablissementIdAndSessionId(Long etablissementId, Long sessionId);

  Optional<DeliberationJury> findByEleveIdAndSessionId(Long eleveId, Long sessionId);
}
