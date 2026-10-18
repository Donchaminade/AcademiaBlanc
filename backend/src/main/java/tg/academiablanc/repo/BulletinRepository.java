package tg.academiablanc.repo;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import tg.academiablanc.domain.Bulletin;

public interface BulletinRepository extends JpaRepository<Bulletin, Long> {
  List<Bulletin> findByEtablissementIdAndSessionId(Long etablissementId, Long sessionId);

  Optional<Bulletin> findByEleveIdAndSessionId(Long eleveId, Long sessionId);
}
