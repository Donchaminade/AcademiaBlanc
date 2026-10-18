package tg.academiablanc.repo;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import tg.academiablanc.domain.Affectation;

public interface AffectationRepository extends JpaRepository<Affectation, Long> {
  List<Affectation> findByEtablissementId(Long etablissementId);

  boolean existsByEtablissementIdAndProfesseurIdAndMatiereIdAndClasseId(
      Long etablissementId, Long professeurId, Long matiereId, Long classeId);
}
