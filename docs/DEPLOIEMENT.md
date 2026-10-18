# Déploiement

Le front de la branche `feat/backend-spring-admin` est en production Vercel : https://academia-chaminadegithubs-projects.vercel.app (alias https://academia-ochre-chi.vercel.app). Le nom `academia.vercel.app` est déjà pris par un autre compte Vercel. Ce changement ne déploie pas l’API : il décrit seulement le service https://academiablanc-api.onrender.com dans `render.yaml`. Le blueprint reste à appliquer à la main. Base prévue : PostgreSQL 16, région Francfort, plan gratuit. H2 sert aux tests locaux. MySQL n’est pas utilisé.

## Front sur Vercel

1. Importer le dépôt. Framework : Vite. Commande de build : `npm run build`. Dossier publié : `dist`.
2. `vercel.json` renvoie toutes les routes vers `index.html` pour que le routeur de l’écran survive au rechargement.
3. Variable déjà posée en Production et Preview : `VITE_API_URL` = `https://academiablanc-api.onrender.com`. Pas de secret dans cette variable.
4. `GEMINI_API_KEY` n’est pas utilisé par l’écran actuel. Ne pas le committer.

`CORS_ALLOWED_ORIGINS` de l’API vaut exactement `https://academia-chaminadegithubs-projects.vercel.app,https://academia-ochre-chi.vercel.app`. Pas de joker, et pas d’origine locale dans cette variable Render.

## API sur Render

1. Blueprint : `render.yaml` à la racine. L’appliquer ne fait pas partie de ce changement.
   - Service web Docker `academiablanc-api`, plan `free`, région Francfort. URL : https://academiablanc-api.onrender.com. Contexte `backend/`, `Dockerfile` multi-étapes Java 21. Santé : `/actuator/health`.
   - Postgres `academiablanc-db`, plan `free`, Francfort, Postgres 16.
   - `JAVA_TOOL_OPTIONS=-XX:MaxRAMPercentage=75.0 -XX:+UseSerialGC` pour tenir dans les 512 Mo de l’instance gratuite.
2. `JWT_SECRET` est généré par Render (`generateValue`). Ne pas le recopier dans le dépôt.
3. `DATABASE_URL` est relié à la base (`postgres://` ou `postgresql://`). Au démarrage, l’API le convertit en URL JDBC `jdbc:postgresql://…`, avec l’utilisateur et le mot de passe, sauf si `SPRING_DATASOURCE_URL` est déjà défini dans l’environnement (Docker ou Postgres local). Sans `DATABASE_URL`, le profil par défaut reste sur H2.
4. `SPRING_PROFILES_ACTIVE=prod` : pas de jeu de démonstration. Flyway est activé (`spring.flyway.enabled=true`) et applique les migrations au démarrage.
5. Le port d’écoute est `${PORT:8080}`.

Lancement local équivalent : `backend/docker-compose.yml` ou, sans Docker, `mvn spring-boot:run` (H2). Voir `backend/README.md` et `backend/.env.example`.

## Limites de l’offre gratuite Render

Le blueprint est sur l’offre gratuite uniquement : plan `free` pour le service web et pour Postgres, à Francfort. Aucun plan payant, aucun disque, aucune mise à l’échelle. URL du service : https://academiablanc-api.onrender.com.

- Le service web s’endort après 15 minutes sans trafic.
- Le démarrage à froid dure environ une minute.
- La base Postgres gratuite expire au bout de 30 jours, puis Render la supprime. Ne pas y mettre les notes réelles.

Rien dans ce changement ne déploie le service.
