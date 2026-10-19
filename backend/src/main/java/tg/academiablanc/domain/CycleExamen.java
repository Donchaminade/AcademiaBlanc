package tg.academiablanc.domain;

/**
 * Cycle visé par un type d'examen. Sert à grouper le choix dans les formulaires et à avertir
 * (sans bloquer) quand les classes d'une session ne correspondent pas.
 * Le CEPD (primaire) est rangé sous TOUS : l'application ne gère pas de classes du primaire.
 */
public enum CycleExamen {
  COLLEGE,
  LYCEE,
  TOUS;

  /** Vrai si un type de ce cycle est proposé pour le cycle demandé (TOUS convient toujours). */
  public boolean convientPour(CycleExamen demande) {
    return demande == null || demande == TOUS || this == TOUS || this == demande;
  }
}
