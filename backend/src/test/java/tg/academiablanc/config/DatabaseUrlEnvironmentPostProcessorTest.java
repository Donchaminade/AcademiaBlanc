package tg.academiablanc.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringApplication;
import org.springframework.core.io.support.SpringFactoriesLoader;
import org.springframework.mock.env.MockEnvironment;

class DatabaseUrlEnvironmentPostProcessorTest {

  private final DatabaseUrlEnvironmentPostProcessor processor = new DatabaseUrlEnvironmentPostProcessor();

  @Test
  void estEnregistreAupresDeSpringBoot() {
    List<String> names = SpringFactoriesLoader.loadFactoryNames(
        org.springframework.boot.env.EnvironmentPostProcessor.class, getClass().getClassLoader());
    assertTrue(names.contains(DatabaseUrlEnvironmentPostProcessor.class.getName()));
  }

  @Test
  void convertitPostgresUrlAvecPortEtMotDePasseEncode() {
    MockEnvironment env = new MockEnvironment()
        .withProperty("spring.datasource.url", "jdbc:postgresql://localhost:5432/academiablanc")
        .withProperty("SPRING_DATASOURCE_URL", "jdbc:postgresql://localhost:5432/academiablanc")
        .withProperty("spring.datasource.username", "academiablanc")
        .withProperty("DATABASE_URL", "postgres://renderuser:p%40ss@dpg-abc.frankfurt-postgres.render.com:5432/academiablanc");

    processor.postProcessEnvironment(env, new SpringApplication());

    assertEquals(
        "jdbc:postgresql://dpg-abc.frankfurt-postgres.render.com:5432/academiablanc",
        env.getProperty("spring.datasource.url"));
    assertEquals("renderuser", env.getProperty("spring.datasource.username"));
    assertEquals("p@ss", env.getProperty("spring.datasource.password"));
    assertEquals("org.postgresql.Driver", env.getProperty("spring.datasource.driver-class-name"));
  }

  @Test
  void convertitPostgresqlSansPortEtConserveSslMode() {
    DatabaseUrlEnvironmentPostProcessor.JdbcDatasource jdbc = DatabaseUrlEnvironmentPostProcessor.toJdbc(
        "postgresql://user:secret@dpg-interne/academiablanc?sslmode=require");

    assertEquals("jdbc:postgresql://dpg-interne:5432/academiablanc?sslmode=require", jdbc.url());
    assertEquals("user", jdbc.username());
    assertEquals("secret", jdbc.password());
  }

  @Test
  void sansDatabaseUrlLeProfilLocalResteInchange() {
    MockEnvironment env = new MockEnvironment()
        .withProperty("spring.datasource.url", "jdbc:h2:mem:academiablanc");

    processor.postProcessEnvironment(env, new SpringApplication());

    assertEquals("jdbc:h2:mem:academiablanc", env.getProperty("spring.datasource.url"));
    assertNull(env.getPropertySources().get(DatabaseUrlEnvironmentPostProcessor.PROPERTY_SOURCE));
  }

  @Test
  void urlJdbcExpliciteDansLesProprietesSystemeEstPrioritaire() {
    System.setProperty("SPRING_DATASOURCE_URL", "jdbc:postgresql://localhost:5432/local");
    try {
      MockEnvironment env = new MockEnvironment()
          .withProperty("DATABASE_URL", "postgres://user:pass@host:5432/db");
      processor.postProcessEnvironment(env, new SpringApplication());
      assertNull(env.getPropertySources().get(DatabaseUrlEnvironmentPostProcessor.PROPERTY_SOURCE));
      assertTrue(DatabaseUrlEnvironmentPostProcessor.explicitDatasourceUrl());
    } finally {
      System.clearProperty("SPRING_DATASOURCE_URL");
    }
  }
}
