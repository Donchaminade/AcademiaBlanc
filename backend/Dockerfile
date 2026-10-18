# Étape 1 : compilation. Image Maven + JDK 21, cohérente avec <java.version>21</java.version> du pom.
FROM maven:3.9.11-eclipse-temurin-21 AS build
WORKDIR /app

# Le plan gratuit Render offre 512 Mo : on borne la JVM de Maven pour éviter un OOM silencieux.
ENV MAVEN_OPTS="-Xmx512m -XX:+UseSerialGC -Dmaven.repo.local=/root/.m2/repository"

# Les dépendances sont résolues dans une couche séparée : elle reste en cache tant que pom.xml ne change pas.
COPY pom.xml .
RUN mvn -B -q -DskipTests dependency:go-offline

# Les tests tournent en CI (mvn -B test), pas dans l'image.
COPY src ./src
RUN mvn -B -q -DskipTests package \
    && cp target/academiablanc-api-*.jar target/app.jar

# Étape 2 : exécution. JRE 21 seul, utilisateur non privilégié.
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
RUN useradd --system --uid 10001 app
COPY --from=build /app/target/app.jar /app/app.jar
USER app
EXPOSE 8080
# Render injecte PORT ; Spring écoute sur ${PORT:8080} (application.yml).
ENV PORT=8080
# JAVA_TOOL_OPTIONS (MaxRAMPercentage, SerialGC) est posé par render.yaml et lu automatiquement par la JVM.
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
