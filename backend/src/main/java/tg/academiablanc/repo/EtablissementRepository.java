package tg.academiablanc.repo;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import tg.academiablanc.domain.Etablissement;

public interface EtablissementRepository extends JpaRepository<Etablissement, Long> {
  Optional<Etablissement> findByEmailIgnoreCase(String email);
  boolean existsByCode(String code);
  Optional<Etablissement> findByCodeTransfert(String codeTransfert);
  boolean existsByCodeTransfert(String codeTransfert);
  List<Etablissement> findByCodeTransfertIsNull();

  List<Etablissement> findAllByOrderByNomAsc();

  long countByPrereglageNationalId(Long prereglageNationalId);

  /* ---------------- Analytique plateforme (agrégats UTC) ---------------- */

  /** Établissements antérieurs à la migration V12 : date d'inscription inconnue. */
  long countByCreeLeIsNull();

  long countByCreeLeBefore(Instant limite);

  /**
   * Nombre d'inscriptions par mois civil UTC (année, mois, nombre) sur l'intervalle {@code [debut, fin[}.
   * La colonne est stockée en UTC (hibernate.jdbc.time_zone), l'extraction se fait donc en UTC.
   */
  @Query("""
      SELECT YEAR(e.creeLe), MONTH(e.creeLe), COUNT(e)
      FROM Etablissement e
      WHERE e.creeLe >= :debut AND e.creeLe < :fin
      GROUP BY YEAR(e.creeLe), MONTH(e.creeLe)
      """)
  List<Object[]> compterInscriptionsParMois(@Param("debut") Instant debut, @Param("fin") Instant fin);
}
