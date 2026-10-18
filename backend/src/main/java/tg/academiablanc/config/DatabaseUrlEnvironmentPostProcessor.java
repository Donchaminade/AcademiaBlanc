package tg.academiablanc.config;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

/**
 * Convertit le {@code DATABASE_URL} Render ({@code postgres://} ou {@code postgresql://}) en URL JDBC.
 * Sans cette variable, la configuration locale (H2 ou Postgres) reste inchangée.
 * Une {@code SPRING_DATASOURCE_URL} posée dans l'environnement (Docker, Postgres local) est prioritaire.
 */
public class DatabaseUrlEnvironmentPostProcessor implements EnvironmentPostProcessor {

  static final String PROPERTY_SOURCE = "render-database-url";

  @Override
  public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
    if (explicitDatasourceUrl()) {
      return;
    }
    String raw = environment.getProperty("DATABASE_URL");
    if (raw == null || raw.isBlank() || raw.startsWith("jdbc:")) {
      return;
    }
    JdbcDatasource jdbc = toJdbc(raw.trim());
    Map<String, Object> values = new HashMap<>();
    values.put("spring.datasource.url", jdbc.url());
    values.put("spring.datasource.username", jdbc.username());
    values.put("spring.datasource.password", jdbc.password());
    values.put("spring.datasource.driver-class-name", "org.postgresql.Driver");
    environment.getPropertySources().addFirst(new MapPropertySource(PROPERTY_SOURCE, values));
  }

  /** Vrai seulement si l'URL JDBC est fournie hors des fichiers YAML (variable ou propriété système). */
  static boolean explicitDatasourceUrl() {
    return hasText(System.getenv("SPRING_DATASOURCE_URL"))
        || hasText(System.getProperty("spring.datasource.url"))
        || hasText(System.getProperty("SPRING_DATASOURCE_URL"));
  }

  static JdbcDatasource toJdbc(String raw) {
    if (!raw.startsWith("postgres://") && !raw.startsWith("postgresql://")) {
      throw new IllegalArgumentException("DATABASE_URL doit commencer par postgres:// ou postgresql://.");
    }
    URI uri;
    try {
      uri = new URI(raw.replaceFirst("^postgres(ql)?://", "http://"));
    } catch (Exception ex) {
      throw new IllegalArgumentException("DATABASE_URL n'est pas une URL utilisable.", ex);
    }
    String userInfo = uri.getUserInfo();
    if (userInfo == null || !userInfo.contains(":")) {
      throw new IllegalArgumentException("DATABASE_URL doit contenir un utilisateur et un mot de passe.");
    }
    int colon = userInfo.indexOf(':');
    String username = userInfo.substring(0, colon);
    String password = userInfo.substring(colon + 1);
    if (uri.getHost() == null || uri.getHost().isBlank() || uri.getPath() == null || uri.getPath().length() < 2) {
      throw new IllegalArgumentException("DATABASE_URL doit contenir un hôte et un nom de base.");
    }
    int port = uri.getPort() == -1 ? 5432 : uri.getPort();
    String jdbc = "jdbc:postgresql://" + uri.getHost() + ":" + port + uri.getPath();
    if (uri.getRawQuery() != null && !uri.getRawQuery().isBlank()) {
      jdbc = jdbc + "?" + uri.getRawQuery();
    }
    return new JdbcDatasource(jdbc, username, password);
  }

  private static boolean hasText(String value) {
    return value != null && !value.isBlank();
  }

  record JdbcDatasource(String url, String username, String password) {}
}
