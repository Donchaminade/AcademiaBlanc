package tg.academiablanc.domain;

/** Forfaits proposés : un mois calendaire ou douze mois, chacun suivi des jours de grâce. */
public enum Forfait {
  MENSUEL(1),
  ANNUEL(12);

  private final int mois;

  Forfait(int mois) {
    this.mois = mois;
  }

  public int mois() {
    return mois;
  }

  public String libelle() {
    return this == MENSUEL ? "Mensuel" : "Annuel";
  }
}
