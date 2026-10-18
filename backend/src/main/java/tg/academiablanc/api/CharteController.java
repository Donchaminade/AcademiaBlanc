package tg.academiablanc.api;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tg.academiablanc.api.CharteService.Charte;

/**
 * Cachet et signatures du bulletin de l'établissement porté par le jeton.
 * Lecture ouverte à tout le personnel (impression des bulletins), écriture réservée à OWNER / ADMIN.
 */
@RestController
@RequestMapping("/api/etablissement/charte")
public class CharteController {
  private final CharteService charte;

  public CharteController(CharteService charte) {
    this.charte = charte;
  }

  @GetMapping
  public Charte lire() {
    return charte.current();
  }

  @PutMapping
  public Charte modifier(@RequestBody Charte request) {
    return charte.update(request);
  }
}
