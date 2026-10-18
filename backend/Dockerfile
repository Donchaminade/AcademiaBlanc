FROM maven:3.9.11-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn -q -DskipTests package

FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
RUN useradd --system --uid 10001 app
COPY --from=build /app/target/academiablanc-api-0.1.0.jar /app/app.jar
USER app
EXPOSE 8080
ENV PORT=8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
