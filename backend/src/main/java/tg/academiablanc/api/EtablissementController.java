package tg.academiablanc.api;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tg.academiablanc.api.ProfilEtablissementService.EnTete;
import tg.academiablanc.api.ProfilEtablissementService.Modification;
import tg.academiablanc.api.ProfilEtablissementService.Profil;
import tg.academiablanc.api.ProfilEtablissementService.Statistiques;
import tg.academiablanc.domain.Action;
import tg.academiablanc.domain.Ressource;
import tg.academiablanc.security.PermissionService;

/**
 * Profil de l'établissement du jeton. Lecture ouverte à tout utilisateur de l'établissement
 * (la fiche figure déjà sur chaque bulletin), écriture réservée à PARAMETRES:MODIFIER.
 */
@RestController
@RequestMapping("/api/etablissement")
public class EtablissementController {
  private final ProfilEtablissementService profil;
  private final PermissionService droits;

  public EtablissementController(ProfilEtablissementService profil, PermissionService droits) {
    this.profil = profil;
    this.droits = droits;
  }

  @GetMapping
  public Profil lire() {
    return profil.profil(droits.courant());
  }

  @PutMapping
  public Profil modifier(@RequestBody Modification request) {
    return profil.modifier(droits.exiger(Ressource.PARAMETRES, Action.MODIFIER), request);
  }

  /** En-tête officiel du bulletin seul (république, devise nationale, ministère, sigle). */
  @PutMapping("/en-tete")
  public Profil modifierEnTete(@RequestBody EnTete request) {
    return profil.modifierEnTete(droits.exiger(Ressource.PARAMETRES, Action.MODIFIER), request);
  }

  /** Applique un préréglage national actif : ses libellés sont copiés dans l'en-tête, modifiables ensuite. */
  @PostMapping("/prereglage-national/{id}")
  public Profil appliquerPrereglage(@PathVariable Long id) {
    return profil.appliquerPrereglage(droits.exiger(Ressource.PARAMETRES, Action.MODIFIER), id);
  }

  @GetMapping("/statistiques")
  public Statistiques statistiques() {
    return profil.statistiques(droits.courant());
  }
}
