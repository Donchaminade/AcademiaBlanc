package tg.academiablanc.api;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tg.academiablanc.domain.Etablissement;
import tg.academiablanc.repo.ClasseRepository;
import tg.academiablanc.repo.EleveRepository;
import tg.academiablanc.repo.EtablissementRepository;
import tg.academiablanc.repo.NoteRepository;
import tg.academiablanc.repo.ProfesseurRepository;
import tg.academiablanc.repo.SessionExamenRepository;
import tg.academiablanc.repo.UtilisateurRepository;
import tg.academiablanc.security.Tenant;

/**
 * Surveillance en lecture seule pour le propriétaire du logiciel.
 * La table etablissement ne stocke pas de date de création.
 * Aucune écriture, suppression ou prise de contrôle de compte.
 */
@RestController
@RequestMapping("/api/plateforme")
public class PlateformeController {
  private final EtablissementRepository etablissements;
  private final UtilisateurRepository utilisateurs;
  private final ClasseRepository classes;
  private final EleveRepository eleves;
  private final ProfesseurRepository professeurs;
  private final SessionExamenRepository sessions;
  private final NoteRepository notes;

  public PlateformeController(
      EtablissementRepository etablissements,
      UtilisateurRepository utilisateurs,
      ClasseRepository classes,
      EleveRepository eleves,
      ProfesseurRepository professeurs,
      SessionExamenRepository sessions,
      NoteRepository notes
  ) {
    this.etablissements = etablissements;
    this.utilisateurs = utilisateurs;
    this.classes = classes;
    this.eleves = eleves;
    this.professeurs = professeurs;
    this.sessions = sessions;
    this.notes = notes;
  }

  public record EtablissementSurveillance(
      Long id,
      String nom,
      String code,
      String ville,
      String region,
      String typeEtablissement,
      String email,
      String telephone,
      String nomResponsable,
      long utilisateurs,
      long classes,
      long eleves,
      long professeurs,
      long sessions,
      long notes
  ) {}

  @GetMapping("/etablissements")
  public List<EtablissementSurveillance> etablissements() {
    Tenant.requirePlatform();
    return etablissements.findAllByOrderByNomAsc().stream().map(this::surveiller).toList();
  }

  private EtablissementSurveillance surveiller(Etablissement school) {
    Long id = school.getId();
    return new EtablissementSurveillance(
        id,
        school.getNom(),
        school.getCode(),
        school.getVille(),
        school.getRegion(),
        school.getTypeEtablissement(),
        school.getEmail(),
        school.getTelephone(),
        school.getNomResponsable(),
        utilisateurs.countByEtablissementId(id),
        classes.countByEtablissementId(id),
        eleves.countByEtablissementId(id),
        professeurs.countByEtablissementId(id),
        sessions.countByEtablissementId(id),
        notes.countByEtablissementId(id)
    );
  }
}
