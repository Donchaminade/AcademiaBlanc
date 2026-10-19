package tg.academiablanc.repo;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import tg.academiablanc.domain.Coefficient;

public interface CoefficientRepository extends JpaRepository<Coefficient, Long> {
  List<Coefficient> findByEtablissementId(Long etablissementId);

  /** Lignes du programme d'une classe (une par matière affectée). */
  List<Coefficient> findByEtablissementIdAndClasseId(Long etablissementId, Long classeId);

  boolean existsByEtablissementIdAndClasseId(Long etablissementId, Long classeId);

  Optional<Coefficient> findFirstByEtablissementIdAndMatiereIdAndClasseId(Long etablissementId, Long matiereId, Long classeId);
}
