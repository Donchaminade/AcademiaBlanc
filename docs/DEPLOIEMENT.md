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
6. `SUPER_ADMIN_EMAIL` est dans le blueprint (`chaminade.don.adjolou@gmail.com`). `SUPER_ADMIN_PASSWORD` est déclaré avec `sync: false` : Render le demande à l’application du blueprint et il se saisit dans le tableau de bord (Environment). Il n’est jamais commité. Voir la section « Propriétaire du logiciel ».

Lancement local équivalent : `backend/docker-compose.yml` ou, sans Docker, `mvn spring-boot:run` (H2). Voir `backend/README.md` et `backend/.env.example`.

## Limites de l’offre gratuite Render

Le blueprint est sur l’offre gratuite uniquement : plan `free` pour le service web et pour Postgres, à Francfort. Aucun plan payant, aucun disque, aucune mise à l’échelle. URL du service : https://academiablanc-api.onrender.com.

- Le service web s’endort après 15 minutes sans trafic.
- Le démarrage à froid dure environ une minute.
- La base Postgres gratuite expire au bout de 30 jours, puis Render la supprime. Ne pas y mettre les notes réelles.

Rien dans ce changement ne déploie le service.

## Propriétaire du logiciel

Le rôle `SUPER_ADMIN` surveille tous les établissements. Il est distinct du compte d’un établissement (`OWNER`, `ADMIN`, `SECRETAIRE`) et du rôle `ENSEIGNANT`. L’écran s’appelle « Surveillance des établissements » et n’apparaît qu’avec ce rôle. L’API de lecture est `GET /api/plateforme/etablissements`.

`POST /api/auth/signup` crée toujours un établissement et un utilisateur `OWNER`. Elle n’accorde jamais `SUPER_ADMIN`, même si l’email est celui du propriétaire.

Le propriétaire n’a pas besoin de s’inscrire : son compte est créé directement au démarrage de l’API à partir de deux variables d’environnement.

| Variable | Rôle | Où |
|---|---|---|
| `SUPER_ADMIN_EMAIL` | Email du propriétaire. | `render.yaml` (`chaminade.don.adjolou@gmail.com`), `.env` local, `docker-compose`. |
| `SUPER_ADMIN_PASSWORD` | Mot de passe initial, ou nouveau mot de passe pour réinitialiser l’accès. | Tableau de bord Render (`sync: false`), `.env` local. Jamais dans le dépôt. |

Procédure :

1. Poser `SUPER_ADMIN_EMAIL` et `SUPER_ADMIN_PASSWORD` sur le service API (Render : Environment du service `academiablanc-api`).
2. Redéployer ou redémarrer l’API.
3. Se connecter sur `https://<front>/admin` (en production : https://academia-ochre-chi.vercel.app/admin) avec cet email et ce mot de passe. L’écran « Plateforme : établissements & gestionnaires » s’affiche directement.

La page `/admin` est l’entrée dédiée à la plateforme : connexion seulement, aucune création de compte, pas de lien depuis le site vitrine et balise `noindex`. Elle appelle `POST /api/auth/login-plateforme`, qui vérifie les identifiants comme `/api/auth/login` mais :

- refuse (403) tout compte qui n’est pas `SUPER_ADMIN` ou `GESTIONNAIRE_PLATEFORME` — un responsable d’établissement doit passer par `/connexion` ;
- répond 401 « Compte de la plateforme non initialisé : vérifiez `SUPER_ADMIN_EMAIL` et `SUPER_ADMIN_PASSWORD` sur le serveur » tant qu’aucun compte ne porte `SUPER_ADMIN_EMAIL` (variable vide, ou mot de passe absent au premier démarrage), sans confirmer l’existence d’autres comptes.

Se déconnecter depuis un compte de la plateforme ramène sur `/admin` ; un compte d’établissement revient sur le site. Le propriétaire et les gestionnaires peuvent toujours se connecter par `/connexion` : la vue Plateforme s’ouvre aussi.

Comportement au démarrage (`PlatformOwnerService`) :

- Aucun compte avec cet email et mot de passe fourni : l’utilisateur `SUPER_ADMIN` est créé (nom « Propriétaire de la plateforme », `etablissement_id` nul, `actif`, mot de passe haché BCrypt). Aucun établissement n’est créé.
- Aucun compte et mot de passe vide : rien n’est créé, un avertissement est journalisé. Poser `SUPER_ADMIN_PASSWORD` puis redémarrer.
- Compte existant (par exemple inscrit avant cette version) : il reçoit le rôle `SUPER_ADMIN` ; si `SUPER_ADMIN_PASSWORD` est fourni et ne correspond pas au mot de passe actuel, celui-ci est remplacé. Pour réinitialiser l’accès du propriétaire, il suffit donc de changer la variable sur Render et de redéployer. Avec la variable vide, le mot de passe en base est conservé.
- Le mot de passe n’apparaît jamais dans les journaux, seuls l’email et l’action (création, mise à jour) sont tracés.

Si `SUPER_ADMIN_EMAIL` est vide ou retiré, le démarrage retire `SUPER_ADMIN` des comptes qui ne correspondent plus, et la connexion suivante leur redonne le rôle `OWNER`. Tant que la variable reste posée, seul cet email reçoit le rôle.

Le compte créé automatiquement n’a aucun établissement : le jeton ne porte pas de `etablissement_id`, `GET /api/auth/me` renvoie `etablissementId: null`, et les API d’un établissement (`/api/annees-scolaires`, `/api/eleves`, `/api/notes`, etc.) lui sont refusées. Un compte propriétaire inscrit avant cette version garde l’établissement créé à l’inscription.

La réponse liste le nom, le code, la ville, l’état (actif ou désactivé), le contact enregistré (responsable, email, téléphone) et les effectifs : utilisateurs, classes, élèves, enseignants, sessions, notes. La date de création (`cree_le`, migration V12) n’est renseignée que pour les établissements créés après cette migration ; elle apparaît sur la page « Profil de l’établissement » de chaque compte. Un établissement peut être créé (`POST /api/plateforme/etablissements`) ou désactivé (`DELETE /api/plateforme/etablissements/{id}`, suppression logique : ses comptes ne peuvent plus se connecter, aucune donnée n’est effacée) puis réactivé. Il n’y a pas d’écriture inter-établissements ni de prise de contrôle d’un compte.

Le propriétaire peut aussi ajouter des gestionnaires de la plateforme (`GESTIONNAIRE_PLATEFORME`, onglet « Gestionnaires ») et limiter leurs droits action par action. Le modèle complet (ressources, actions, préréglages, règles de délégation) est décrit dans [ROLES_ET_PERMISSIONS.md](ROLES_ET_PERMISSIONS.md).
