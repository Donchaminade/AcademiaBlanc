package tg.academiablanc.repo;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import tg.academiablanc.domain.StatutTransfert;
import tg.academiablanc.domain.TransfertExamen;

public interface TransfertExamenRepository extends JpaRepository<TransfertExamen, Long> {
  List<TransfertExamen> findByEtablissementSourceIdOrderByEnvoyeLeDesc(Long etablissementSourceId);
  List<TransfertExamen> findByEtablissementSourceIdAndSessionSourceIdOrderByEnvoyeLeDesc(Long etablissementSourceId, Long sessionSourceId);
  List<TransfertExamen> findByEtablissementDestinationIdOrderByEnvoyeLeDesc(Long etablissementDestinationId);
  long countByEtablissementDestinationIdAndStatut(Long etablissementDestinationId, StatutTransfert statut);
}
