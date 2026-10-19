package tg.academiablanc.abonnement;

import java.time.Clock;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tg.academiablanc.domain.ParametrePlateforme;
import tg.academiablanc.repo.ParametrePlateformeRepository;

/**
 * Paramètres commerciaux de la plateforme : tarifs (FCFA), téléphones de contact, bénéficiaire mobile money,
 * instructions de paiement, durée d'essai et jours de grâce. Stockés en clé / valeur ({@code parametres_plateforme}).
 * Les tarifs valent 0 tant que le super admin ne les a pas saisis : l'interface affiche « Tarif à confirmer ».
 */
@Service
public class ParametresCommerciauxService {
  private static final Logger log = LoggerFactory.getLogger(ParametresCommerciauxService.class);

  public static final String TARIF_MENSUEL = "TARIF_MENSUEL";
  public static final String TARIF_ANNUEL = "TARIF_ANNUEL";
  public static final String TEL_WHATSAPP = "TEL_WHATSAPP";
  public static final String TEL_APPEL = "TEL_APPEL";
  public static final String BENEFICIAIRE = "BENEFICIAIRE_MOBILE_MONEY";
  public static final String INSTRUCTIONS = "INSTRUCTIONS_PAIEMENT";
  public static final String DUREE_ESSAI = "DUREE_ESSAI_JOURS";
  public static final String JOURS_GRACE = "JOURS_GRACE";

  public static final int DUREE_ESSAI_DEFAUT = 14;
  public static final int JOURS_GRACE_DEFAUT = 3;
  public static final String DEVISE = "FCFA";

  /** Ensemble des paramètres, tels que lus ou tels qu'enregistrés par le super admin. */
  public record ParametresCommerciaux(
      long tarifMensuel,
      long tarifAnnuel,
      String devise,
      String telWhatsapp,
      String telAppel,
      String beneficiaire,
      String instructions,
      int dureeEssaiJours,
      int joursGrace,
      Instant modifieLe
  ) {
    public long tarif(tg.academiablanc.domain.Forfait forfait) {
      return forfait == tg.academiablanc.domain.Forfait.ANNUEL ? tarifAnnuel : tarifMensuel;
    }
  }

  /** Sous-ensemble public (page d'inscription / paiement) : aucune donnée interne (grâce…). */
  public record OffrePublique(
      long tarifMensuel,
      long tarifAnnuel,
      String devise,
      String telWhatsapp,
      String telAppel,
      String beneficiaire,
      String instructions,
      int dureeEssaiJours
  ) {}

  private final ParametrePlateformeRepository parametres;
  private final Clock horloge;

  public ParametresCommerciauxService(ParametrePlateformeRepository parametres, Clock horloge) {
    this.parametres = parametres;
    this.horloge = horloge;
  }

  @Transactional(readOnly = true)
  public ParametresCommerciaux lire() {
    Map<String, ParametrePlateforme> map = new HashMap<>();
    for (ParametrePlateforme p : parametres.findAll()) map.put(p.getCle(), p);
    Instant modifieLe = map.values().stream().map(ParametrePlateforme::getModifieLe)
        .filter(d -> d != null).max(Instant::compareTo).orElse(null);
    return new ParametresCommerciaux(
        entier(map, TARIF_MENSUEL, 0),
        entier(map, TARIF_ANNUEL, 0),
        DEVISE,
        texte(map, TEL_WHATSAPP),
        texte(map, TEL_APPEL),
        texte(map, BENEFICIAIRE),
        texte(map, INSTRUCTIONS),
        (int) entier(map, DUREE_ESSAI, DUREE_ESSAI_DEFAUT),
        (int) entier(map, JOURS_GRACE, JOURS_GRACE_DEFAUT),
        modifieLe);
  }

  @Transactional(readOnly = true)
  public OffrePublique offrePublique() {
    ParametresCommerciaux p = lire();
    return new OffrePublique(p.tarifMensuel(), p.tarifAnnuel(), p.devise(), p.telWhatsapp(), p.telAppel(),
        p.beneficiaire(), p.instructions(), p.dureeEssaiJours());
  }

  /** Remplace l'ensemble des paramètres ; {@code acteur} = email du super admin, journalisé. */
  @Transactional
  public ParametresCommerciaux enregistrer(ParametresCommerciaux saisie, String acteur) {
    if (saisie.tarifMensuel() < 0 || saisie.tarifAnnuel() < 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Un tarif ne peut pas être négatif.");
    }
    if (saisie.dureeEssaiJours() < 1 || saisie.dureeEssaiJours() > 365) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La durée d'essai doit être comprise entre 1 et 365 jours.");
    }
    if (saisie.joursGrace() < 0 || saisie.joursGrace() > 60) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Les jours de grâce doivent être compris entre 0 et 60.");
    }
    Instant maintenant = horloge.instant();
    poser(TARIF_MENSUEL, Long.toString(saisie.tarifMensuel()), acteur, maintenant);
    poser(TARIF_ANNUEL, Long.toString(saisie.tarifAnnuel()), acteur, maintenant);
    poser(TEL_WHATSAPP, nettoyer(saisie.telWhatsapp(), 40), acteur, maintenant);
    poser(TEL_APPEL, nettoyer(saisie.telAppel(), 40), acteur, maintenant);
    poser(BENEFICIAIRE, nettoyer(saisie.beneficiaire(), 180), acteur, maintenant);
    poser(INSTRUCTIONS, nettoyer(saisie.instructions(), 4000), acteur, maintenant);
    poser(DUREE_ESSAI, Integer.toString(saisie.dureeEssaiJours()), acteur, maintenant);
    poser(JOURS_GRACE, Integer.toString(saisie.joursGrace()), acteur, maintenant);
    log.info("Paramètres commerciaux enregistrés par {} : mensuel={} annuel={} essai={}j grâce={}j",
        acteur, saisie.tarifMensuel(), saisie.tarifAnnuel(), saisie.dureeEssaiJours(), saisie.joursGrace());
    return lire();
  }

  private void poser(String cle, String valeur, String acteur, Instant quand) {
    ParametrePlateforme p = parametres.findById(cle).orElseGet(() -> new ParametrePlateforme(cle, null));
    p.setValeur(valeur);
    p.setModifieLe(quand);
    p.setModifiePar(acteur);
    parametres.save(p);
  }

  private static long entier(Map<String, ParametrePlateforme> map, String cle, long defaut) {
    ParametrePlateforme p = map.get(cle);
    if (p == null || p.getValeur() == null || p.getValeur().isBlank()) return defaut;
    try {
      return Long.parseLong(p.getValeur().trim());
    } catch (NumberFormatException ex) {
      return defaut;
    }
  }

  private static String texte(Map<String, ParametrePlateforme> map, String cle) {
    ParametrePlateforme p = map.get(cle);
    return p == null || p.getValeur() == null ? "" : p.getValeur();
  }

  private static String nettoyer(String valeur, int max) {
    if (valeur == null) return "";
    String v = valeur.trim();
    return v.length() > max ? v.substring(0, max) : v;
  }
}
