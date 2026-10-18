# API AcademiaBlanc

Spring Boot 3, Java 21. Les données d’un établissement ne sont lisibles qu’avec le jeton de cet établissement.

## Démarrage local sans Docker (H2)

```bash
cd backend
mvn spring-boot:run
```

Santé : http://localhost:8080/actuator/health

Compte de démonstration (jeu chargé au premier démarrage) : `direction@lycee-tokoin.tg` / `password123`.

## Démarrage avec Postgres

```bash
cd backend
docker compose up --build
```

Le mot de passe Postgres du fichier compose est un secret de développement, pas une valeur de production.

## Tests

```bash
cd backend
mvn test
```
