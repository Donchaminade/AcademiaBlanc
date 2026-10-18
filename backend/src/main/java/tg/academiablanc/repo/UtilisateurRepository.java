package tg.academiablanc.repo;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import tg.academiablanc.domain.Utilisateur;

public interface UtilisateurRepository extends JpaRepository<Utilisateur, Long> {
  Optional<Utilisateur> findByEmailIgnoreCase(String email);
}
