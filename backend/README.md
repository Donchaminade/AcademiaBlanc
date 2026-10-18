# API AcademiaBlanc

Spring Boot 3, Java 21. Les données d’un établissement ne sont lisibles qu’avec le jeton de cet établissement.

## Démarrage local sans Docker (H2)

```bash
cd backend
mvn spring-boot:run
```

Santé : http://localhost:8080/actuator/health

Compte de démonstration (jeu chargé au premier démarrage) : `direction@lycee-tokoin.tg` / `password123`.

Le propriétaire du logiciel n’est pas ce compte. Après une inscription normale, poser `SUPER_ADMIN_EMAIL` sur l’email choisi, puis se reconnecter. Aucun mot de passe n’est fourni par l’API pour ce rôle. Voir `docs/DEPLOIEMENT.md`.

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
