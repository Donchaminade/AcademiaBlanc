package tg.academiablanc.repo;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import tg.academiablanc.domain.Role;
import tg.academiablanc.domain.Utilisateur;

public interface UtilisateurRepository extends JpaRepository<Utilisateur, Long> {
  Optional<Utilisateur> findByEmailIgnoreCase(String email);

  List<Utilisateur> findByRole(Role role);

  long countByEtablissementId(Long etablissementId);

  List<Utilisateur> findByEtablissementIdOrderByNomAsc(Long etablissementId);

  List<Utilisateur> findByRoleInOrderByNomAsc(Collection<Role> roles);
}
