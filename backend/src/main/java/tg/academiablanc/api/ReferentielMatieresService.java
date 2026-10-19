package tg.academiablanc.api;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tg.academiablanc.api.ReferentielMatieres.MatiereRef;
import tg.academiablanc.domain.Matiere;
import tg.academiablanc.repo.MatiereRepository;
import tg.academiablanc.security.Tenant;

/**
 * Charge le catalogue des matières de base dans l'établissement du jeton : crée les matières
 * manquantes (par code) et renseigne leur groupe. Relançable sans effet de bord.
 *
 * <p>Aucun coefficient n'est créé ici : les matières sont ensuite affectées classe par classe
 * dans le programme de la classe ({@link ProgrammeClasseService}), où les coefficients par
 * défaut du référentiel ne sont qu'une suggestion pré-remplie.</p>
 */
@Service
public class ReferentielMatieresService {

  public record Resultat(int matieresCreees, int matieresExistantes) {}

  private final MatiereRepository matieres;

  public ReferentielMatieresService(MatiereRepository matieres) {
    this.matieres = matieres;
  }

  @Transactional
  public Resultat charger() {
    Long etab = Tenant.current().etablissementId();

    Map<String, Matiere> existantes = new HashMap<>();
    for (Matiere m : matieres.findByEtablissementIdOrderByNomAsc(etab)) {
      existantes.put(m.getCode().toLowerCase(Locale.ROOT), m);
    }

    int creees = 0;
    int dejaLa = 0;
    for (MatiereRef ref : ReferentielMatieres.MATIERES) {
      Matiere m = existantes.get(ref.code());
      if (m == null) {
        m = new Matiere();
        m.setEtablissementId(etab);
        m.setCode(ref.code());
        creees++;
      } else {
        dejaLa++;
      }
      m.setNom(ref.nom());
      m.setGroupeCode(ref.groupeCode());
      m.setGroupeLibelle(ref.groupeLibelle());
      matieres.save(m);
    }
    return new Resultat(creees, dejaLa);
  }
}
