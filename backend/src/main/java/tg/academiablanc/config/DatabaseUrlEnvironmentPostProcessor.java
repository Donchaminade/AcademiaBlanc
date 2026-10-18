package tg.academiablanc.config;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

/** Convertit le DATABASE_URL Render (postgres://) en URL JDBC si aucune URL Spring n'est fournie. */
public class DatabaseUrlEnvironmentPostProcessor implements EnvironmentPostProcessor {
  @Override
  public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
    if (environment.getProperty("SPRING_DATASOURCE_URL") != null) return;
    String raw = environment.getProperty("DATABASE_URL");
    if (raw == null || raw.isBlank() || raw.startsWith("jdbc:")) return;
    URI uri = URI.create(raw.replaceFirst("^postgres(ql)?://", "http://"));
    String userInfo = uri.getUserInfo();
    if (userInfo == null || !userInfo.contains(":")) return;
    String username = userInfo.substring(0, userInfo.indexOf(':'));
    String password = userInfo.substring(userInfo.indexOf(':') + 1);
    int port = uri.getPort() == -1 ? 5432 : uri.getPort();
    String jdbc = "jdbc:postgresql://" + uri.getHost() + ":" + port + uri.getPath();
    Map<String, Object> values = new HashMap<>();
    values.put("spring.datasource.url", jdbc);
    values.put("spring.datasource.username", username);
    values.put("spring.datasource.password", password);
    values.put("spring.datasource.driver-class-name", "org.postgresql.Driver");
    environment.getPropertySources().addFirst(new MapPropertySource("render-database-url", values));
  }
}
