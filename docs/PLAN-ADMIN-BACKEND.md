# Plan administration et backend

Décision retenue : **API Java Spring Boot 3** (Java 21), front Vite/React inchangé dans son rôle d’interface, **PostgreSQL 16** en production sur Render. H2 en mémoire sert aux tests et au démarrage local sans Docker. MySQL n’est pas retenu. Ce document regroupe les points 5, 8, 9, 10 et 11. Le code de départ est dans `backend/`. Il ne remplace pas encore tout le stockage navigateur des bulletins.

## 1. Parcours

1. Écran d’ouverture : créer un compte établissement ou se connecter.
2. Le jeton JWT porte `etablissementId` et le rôle. Toutes les lectures et écritures filtrent sur cet identifiant. Une ressource d’un autre établissement répond 404, pas 403, pour ne pas révéler qu’elle existe.
3. Espace paramètres : année scolaire, centres, sessions, matières, coefficients, enseignants, classes, titulaire, affectations, élèves, notes.
4. Génération des bulletins à partir des notes de la session.

Le ministère n’est pas un tenant. Chaque établissement saisit lui-même le pays, la devise et le ministère dans ses paramètres (déjà présents dans `AppSettings` côté écran).

## 2. Modèle de données

Isolation : chaque table métier a `etablissement_id`. Les index et les requêtes Spring Data partent de cet identifiant. En Postgres, une politique de sécurité au niveau des lignes (RLS) pourra doubler le filtre applicatif ; elle n’est pas activée dans ce premier schéma, le filtre est dans les services.

| Entité | Champs clés | Relations |
|---|---|---|
| etablissement | nom, code, ville, région, type, email, téléphone, responsable | racine du tenant |
| utilisateur | email, hash du mot de passe, nom, rôle | N–1 établissement |
| annee_scolaire | libellé, dates, courante | N–1 établissement |
| centre_examen | nom, ville, code | N–1 établissement |
| session_examen | nom, type, série, statut | N–1 année, N–1 centre, N–1 établissement |
| classe | nom, niveau, série, titulaire_id | N–1 année ; titulaire N–1 professeur |
| professeur | nom, email, utilisateur_id optionnel | N–1 établissement |
| matiere | nom, code unique par établissement | N–1 établissement |
| coefficient | valeur, série optionnelle | N–1 matière, N–1 classe (ou coefficient général si classe nulle) |
| affectation | — | professeur + matière + classe, unique |
| eleve | matricule unique par établissement, genre, table, classe, session | N–1 classe |
| note | valeur 0–20 ou absent | élève + matière + session, unique |
| bulletin | moyenne, rang, mention, appréciation, totaux, date | élève + session, recalculé puis stocké |

Rôles : `OWNER` (créateur du compte), `ADMIN` (même droits de paramétrage), `SECRETAIRE` (années, centres, sessions, élèves, notes, bulletins ; pas les affectations ni le titulaire), `ENSEIGNANT` (lecture, saisie des notes seulement sur ses affectations), `SUPER_ADMIN` (propriétaire du logiciel, surveillance en lecture seule de tous les établissements, sans droit d’écriture sur les API d’un établissement). Le titulaire n’est pas un rôle : c’est `classe.titulaire_id`. Sur le bulletin, son nom alimente « Le Titulaire » ; le responsable de l’établissement alimente le signataire (proviseur, directeur, principal). La désignation du propriétaire est décrite dans `docs/DEPLOIEMENT.md`.

## 3. Authentification

- `POST /api/auth/signup` crée l’établissement, l’utilisateur `OWNER` et une année courante. Mot de passe BCrypt, jamais renvoyé. Cette route ne peut pas créer un `SUPER_ADMIN`.
- `POST /api/auth/login` renvoie un JWT (12 h). Si l’email est celui de `SUPER_ADMIN_EMAIL`, le jeton porte le rôle `SUPER_ADMIN`. Le compte du propriétaire est créé automatiquement au démarrage à partir de `SUPER_ADMIN_EMAIL` et `SUPER_ADMIN_PASSWORD` (sans établissement) ; voir `docs/DEPLOIEMENT.md`.
- `GET /api/plateforme/etablissements` est réservé à `SUPER_ADMIN`. Les autres routes restent filtrées par `etablissement_id`.
- Le front envoie `Authorization: Bearer`. Le jeton reste en `sessionStorage`, pas dans l’URL.
- CORS : liste `CORS_ALLOWED_ORIGINS` (domaine Vercel de production et aperçus).

Endpoints métier (tous authentifiés, filtrés par établissement) : `/api/annees-scolaires`, `/api/centres`, `/api/sessions`, `/api/matieres`, `/api/coefficients`, `/api/professeurs`, `/api/classes`, `/api/classes/{id}/titulaire`, `/api/affectations`, `/api/eleves`, `/api/notes`, `/api/bulletins` et `/api/bulletins/generer`.

## 4. Coefficients et écarts avec l’écran actuel

Formules retenues, notes sur 20 :

- total matière = note × coefficient (12/20 avec coef 2 → 24) ;
- moyenne générale = Σ(note × coef) / Σ(coef) ;
- une absence ou une note manquante est exclue des deux sommes, elle ne vaut pas zéro ;
- rang par matière et rang général : tri décroissant, ex æquo au même rang, le suivant saute (1, 2, 2, 4) ;
- appréciation du professeur : calculée sur la note /20 de chaque matière (`calc/Appreciation.java`, `src/utils/appreciation.ts`) : [0;5[ Très insuffisant, [5;8[ Insuffisant, [8;10[ Mauvais, [10;12[ Passable, [12;14[ Assez bien, [14;16[ Bien, [16;18[ Très bien, [18;20] Excellent ; absence → Absent, sans note → Non noté. L'enseignant peut la remplacer par un texte libre (≤ 60 caractères, colonne `note.appreciation`, vide = automatique).

Le bulletin (`computeCandidateStats` dans `src/data/mockData.ts`, qui s’appuie sur `moyenneReelle` de `src/utils/bulletinMetrics.ts`) applique exactement ces règles, comme `GradeCalculator` côté API :

- moyenne réelle Σ(note × coef) / Σ(coef) sur le programme de la classe de l’élève ; **aucun point de repêchage** n’est ajouté (la modale « Arbitrage de délibération du jury » et la colonne `bonus_jury` ont été supprimées, migration V17) ; la délibération ne porte plus que l’observation du conseil et la signature ;
- une matière sans note est exclue du numérateur **et** du dénominateur (`totalCoef` ne compte que les matières notées) ; le total maximal `pointsMax` = 20 × Σ coef de tout le programme de la classe (ex. 8 matières de démonstration, Σ coef 21 → 420 points), jamais une constante ;
- le bulletin porte aussi la moyenne de classe, la moyenne la plus forte et la plus faible de la classe (même classe, même session) et, par matière, la note min / max de la classe (`moyenneClasse`, `moyenneClasseMax`, `moyenneClasseMin`, `noteMaxClasse`, `noteMinClasse` sur `/api/bulletins`) ;
- le rang général est un classement de compétition avec ex æquo sur toute la session ;
- le rang par matière était une formule fictive (« 140 − note × 7 » et « / 138 ») ; la branche des bulletins le remplace par un vrai rang, sans dénominateur ;
- la colonne Moy. Promo n’est pas cette moyenne : ce sont les constantes `PROMO_AVERAGES` (mathématiques 10,80, etc.), identiques pour tous les élèves.

## 5. Web et bureau

Recommandation : **une API HTTP et le React actuel**, réutilisable plus tard dans Tauri ou Electron.

- Le web (Vercel) parle à l’API (Render).
- Un bureau emballe le même build et pointe `VITE_API_URL` vers la même API, ou vers une API locale.
- Le mode hors-ligne déjà esquissé dans l’écran peut garder une file locale ; la source de vérité reste Postgres dès qu’il y a plusieurs postes dans l’établissement.
- Ne pas dupliquer la logique de notes dans le bureau : elle vit dans `GradeCalculator`.

## 6. Écrans paramètres

Déjà amorcés dans l’onglet Administration : années, centres, sessions, matières, enseignants, classes et titulaire. À compléter au même endroit : coefficients par classe ou par série, affectations enseignant–matière–classe, élèves et saisie des notes, puis bouton « générer les bulletins ». Le bulletin imprimé doit lire le titulaire de la classe et les titres de signataire de l’établissement, pas des libellés figés.

## 7. Migration des données statiques

Le chargeur `DemoDataSeeder` reprend, au premier démarrage local, le lycée de Tokoin (CISSE, KOFFI, DIOMANDE) et le Collège Protestant (ADJOLOU), les huit matières et leurs coefficients de `INITIAL_SUBJECTS`. Les mots de passe de démo sont hachés. En profil `prod`, ce chargement est coupé. La suite : importer le `localStorage` existant (écoles, candidats, notes) par un endpoint d’import réservé à l’OWNER, puis cesser d’écrire les notes seulement dans le navigateur.

## 8. Volume de travail

Le socle (schéma, auth, isolation, calculs, écrans paramètres de base) est commencé sur cette branche. Il reste à brancher la saisie des notes et l’impression des bulletins sur l’API, à couvrir les rôles secrétaire et enseignant dans l’interface, puis à importer l’historique local. Ce sont les trois lots les plus larges ; le déploiement décrit dans `docs/DEPLOIEMENT.md` est prêt en fichiers seulement.
