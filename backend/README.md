# API AcademiaBlanc

Spring Boot 3, Java 21. Les données d’un établissement ne sont lisibles qu’avec le jeton de cet établissement.

## Démarrage local sans Docker (H2)

```bash
cd backend
mvn spring-boot:run
```

Santé : http://localhost:8080/actuator/health

Compte de démonstration (jeu chargé au premier démarrage) : `direction@lycee-tokoin.tg` / `password123`.

Le propriétaire du logiciel n’est pas ce compte et n’a pas à s’inscrire : poser `SUPER_ADMIN_EMAIL` et `SUPER_ADMIN_PASSWORD`, démarrer l’API, le compte `SUPER_ADMIN` (sans établissement) est créé automatiquement. Changer `SUPER_ADMIN_PASSWORD` puis redémarrer réinitialise son mot de passe. Voir `docs/DEPLOIEMENT.md`.

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
