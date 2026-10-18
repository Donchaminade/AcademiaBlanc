# Déploiement (fichiers seulement)

Rien n’est déployé par cet outillage. Les fichiers préparent Vercel pour le front et Render pour l’API et Postgres, région Francfort.

## Front sur Vercel

1. Importer le dépôt. Framework : Vite. Commande de build : `npm run build`. Dossier publié : `dist`.
2. `vercel.json` renvoie toutes les routes vers `index.html` pour que le routeur de l’écran survive au rechargement.
3. Variable d’environnement **Production** et **Preview** : `VITE_API_URL` = URL publique de l’API Render, par exemple `https://academiablanc-api.onrender.com`. Pas de secret dans cette variable.
4. `GEMINI_API_KEY` n’est pas utilisé par l’écran actuel. Ne pas le committer.

Les aperçus Vercel ont des domaines `*.vercel.app`. Les ajouter, avec le domaine de production, dans `CORS_ALLOWED_ORIGINS` de l’API (virgules, sans espace superflu).

## API sur Render

1. Blueprint : `render.yaml` à la racine.
   - Service web Docker `academiablanc-api`, contexte `backend/`, `Dockerfile` multi-étapes Java 21.
   - Santé : `/actuator/health`.
   - Postgres `academiablanc-db`, Francfort, Postgres 16.
2. `JWT_SECRET` est généré par Render (`generateValue`). Ne pas le recopier dans le dépôt.
3. `DATABASE_URL` est relié à la base. L’API transforme `postgres://…` en URL JDBC si `SPRING_DATASOURCE_URL` n’est pas défini.
4. `SPRING_PROFILES_ACTIVE=prod` : pas de jeu de démonstration, validation Flyway du schéma.
5. `CORS_ALLOWED_ORIGINS` autorise `https://academia.vercel.app`, les aperçus `https://academia-*.vercel.app`, et le front local.
6. Le port d’écoute est `$PORT` (défaut 8080).

Lancement local équivalent : `backend/docker-compose.yml` ou, sans Docker, `mvn spring-boot:run` (H2). Voir `backend/README.md` et `backend/.env.example`.

## Coût indicatif Render

Les tarifs changent : vérifier la page tarifs au moment de créer les services.

| Offre | Ordre de grandeur | Limite utile |
|---|---|---|
| Web gratuit | 0 USD | S’éteint après environ 15 minutes sans trafic ; réveil lent. Heures mensuelles plafonnées. |
| Web Starter | environ 7 USD / mois | Reste allumé. C’est le plan du blueprint. |
| Postgres gratuit | 0 USD | Expire au bout d’environ 30 jours, puis la base est supprimée. Ne pas y mettre les notes réelles. |
| Postgres Basic 256 Mo | environ 6 à 7 USD / mois | Base durable. C’est le plan du blueprint. |

Le blueprint évite le couple gratuit (extinction + expiration). Pour un essai court, on peut descendre les deux plans sur le gratuit en acceptant ces limites, puis revenir au Starter et au Basic avant toute saisie réelle.
