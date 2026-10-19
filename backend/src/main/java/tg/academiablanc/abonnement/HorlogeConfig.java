package tg.academiablanc.abonnement;

import java.time.Clock;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Horloge UTC injectable : les tests fournissent leur propre {@link Clock} pour simuler le temps. */
@Configuration
public class HorlogeConfig {
  @Bean
  @ConditionalOnMissingBean(Clock.class)
  Clock horloge() {
    return Clock.systemUTC();
  }
}
