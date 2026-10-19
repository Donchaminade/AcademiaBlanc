package tg.academiablanc.config;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Horloge UTC de l'application, injectable dans les services qui agrègent par période
 * (tableau de bord analytique). Les tests déclarent une horloge figée {@code @Primary}.
 */
@Configuration
public class HorlogeConfig {
  @Bean
  Clock horloge() {
    return Clock.systemUTC();
  }
}
