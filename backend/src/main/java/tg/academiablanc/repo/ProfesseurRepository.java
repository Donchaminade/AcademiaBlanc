package tg.academiablanc.repo;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import tg.academiablanc.domain.Professeur;

public interface ProfesseurRepository extends JpaRepository<Professeur, Long> {
  List<Professeur> findByEtablissementIdOrderByNomAsc(Long etablissementId);

  long countByEtablissementId(Long etablissementId);

  List<Professeur> findByUtilisateurId(Long utilisateurId);
}
