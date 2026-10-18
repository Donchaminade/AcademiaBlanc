package tg.academiablanc.repo;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import tg.academiablanc.domain.Note;

public interface NoteRepository extends JpaRepository<Note, Long> {
  List<Note> findByEtablissementIdAndSessionId(Long etablissementId, Long sessionId);

  Optional<Note> findByEleveIdAndMatiereIdAndSessionId(Long eleveId, Long matiereId, Long sessionId);

  long countByEtablissementId(Long etablissementId);
}
