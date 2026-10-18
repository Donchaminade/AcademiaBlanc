package tg.academiablanc.repo;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import tg.academiablanc.domain.PermissionUtilisateur;

public interface PermissionUtilisateurRepository extends JpaRepository<PermissionUtilisateur, Long> {
  List<PermissionUtilisateur> findByUtilisateurId(Long utilisateurId);

  @Modifying
  @Query("delete from PermissionUtilisateur p where p.utilisateurId = :utilisateurId")
  void supprimerPour(@Param("utilisateurId") Long utilisateurId);
}
