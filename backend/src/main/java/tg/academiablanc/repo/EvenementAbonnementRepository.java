package tg.academiablanc.repo;

import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import tg.academiablanc.domain.EvenementAbonnement;
import tg.academiablanc.domain.TypeEvenementAbonnement;

public interface EvenementAbonnementRepository extends JpaRepository<EvenementAbonnement, Long> {
  List<EvenementAbonnement> findByEtablissementIdOrderByCreeLeDescIdDesc(Long etablissementId);

  List<EvenementAbonnement> findAllByOrderByCreeLeDescIdDesc();

  List<EvenementAbonnement> findByCreeLeBetweenOrderByCreeLeDescIdDesc(Instant debut, Instant fin);

  List<EvenementAbonnement> findByTypeAndStatutOrderByCreeLeDescIdDesc(TypeEvenementAbonnement type, String statut);

  long countByEtablissementIdAndTypeAndStatut(Long etablissementId, TypeEvenementAbonnement type, String statut);
}
