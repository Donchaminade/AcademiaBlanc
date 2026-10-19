package tg.academiablanc.abonnement;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

/** Horloge de test : instant fixé puis déplacé à volonté pour simuler l'écoulement du temps (UTC). */
public class HorlogeReglable extends Clock {
  private volatile Instant instant;

  public HorlogeReglable(Instant depart) {
    this.instant = depart;
  }

  public void regler(Instant nouveau) {
    this.instant = nouveau;
  }

  public void avancer(Duration duree) {
    this.instant = instant.plus(duree);
  }

  @Override
  public ZoneId getZone() {
    return ZoneOffset.UTC;
  }

  @Override
  public Clock withZone(ZoneId zone) {
    return this;
  }

  @Override
  public Instant instant() {
    return instant;
  }
}
