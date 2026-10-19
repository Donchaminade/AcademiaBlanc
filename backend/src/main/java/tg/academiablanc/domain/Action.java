package tg.academiablanc.domain;

import java.util.EnumSet;
import java.util.Set;

/**
 * Actions élémentaires soumises aux permissions.
 * VOIR = lister, DETAILS = lire une fiche ou ses champs sensibles,
 * CREER / MODIFIER / SUPPRIMER = écriture, IMPRIMER = impression ou téléchargement (bulletins),
 * ENVOYER / TRAITER = transferts d'examen blanc (envoi par le centre, acceptation ou refus par le destinataire).
 */
public enum Action {
  VOIR,
  DETAILS,
  CREER,
  MODIFIER,
  SUPPRIMER,
  IMPRIMER,
  /** Transferts : envoyer un paquet (centre d'examen). */
  ENVOYER,
  /** Transferts : accepter ou refuser un paquet reçu. */
  TRAITER;

  /** Jeu d’actions des ressources de type « fiche » (liste, détail, création, modification, suppression). */
  public static final Set<Action> CRUD = EnumSet.of(VOIR, DETAILS, CREER, MODIFIER, SUPPRIMER);
}
