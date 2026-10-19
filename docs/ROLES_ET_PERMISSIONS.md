# Rôles et permissions

Deux niveaux d’administration, chacun avec des droits réglables action par action.

- **Niveau 1 — établissement.** La personne qui a créé le compte de l’établissement (rôle `OWNER`) a tous les droits sur son école. Elle ajoute les autres utilisateurs (administration, secrétariat, enseignants) et décide, pour chacun, ce qu’il peut voir, ouvrir, créer, modifier ou supprimer, ressource par ressource.
- **Niveau 2 — plateforme.** Le propriétaire du logiciel (`SUPER_ADMIN`, désigné par `SUPER_ADMIN_EMAIL`) voit tous les établissements. Il ajoute des gestionnaires (`GESTIONNAIRE_PLATEFORME`) et les restreint de la même façon : par exemple voir et ajouter des établissements, sans pouvoir les désactiver ni consulter les contacts.

Le serveur est la seule référence : chaque méthode de l’API vérifie le droit avant d’agir. L’interface se contente de masquer ce qui n’est pas permis ; un refus renvoie quand même `403` avec un message clair, affiché tel quel à l’écran.

## Permission = ressource + action

Une permission s’écrit `RESSOURCE:ACTION` (par exemple `MATIERES:SUPPRIMER`).

### Actions

| Action | Sens |
| --- | --- |
| `VOIR` | Lister les fiches (`GET /api/...`). |
| `DETAILS` | Ouvrir une fiche (`GET /api/.../{id}`) ou voir ses champs sensibles (contacts d’un établissement, matrice d’un utilisateur). |
| `CREER` | Ajouter une fiche (`POST`). Pour les bulletins : générer / recalculer. |
| `MODIFIER` | Modifier une fiche (`PUT`). Pour les établissements : réactiver. |
| `SUPPRIMER` | Supprimer (`DELETE`). Pour les établissements : désactiver (les données restent). |
| `IMPRIMER` | Imprimer ou télécharger (bulletins uniquement, côté interface). |

### Ressources

Établissement (cloisonnées par `etablissement_id`) :

| Ressource | Actions applicables | API |
| --- | --- | --- |
| `ANNEES` | Voir, Détails, Créer, Modifier, Supprimer | `/api/annees-scolaires` |
| `CENTRES` | idem | `/api/centres` |
| `SESSIONS` | idem | `/api/sessions` |
| `MATIERES` | idem (`CREER` couvre le chargement des matières de base) | `/api/matieres`, `/api/matieres/referentiel` |
| `COEFFICIENTS` | idem (`VOIR` couvre la lecture du programme d’une classe et ses suggestions, `MODIFIER` son remplacement et sa copie) | `/api/coefficients`, `/api/classes/{id}/programme`, `/api/classes/{id}/programme/copier-de/{autreId}`, `/api/classes/{id}/programme/suggestions` |
| `ENSEIGNANTS` | idem | `/api/professeurs` |
| `CLASSES` | idem (`MODIFIER` couvre le titulaire) | `/api/classes` |
| `SERIES` | idem (`CREER` couvre le chargement des séries par défaut) | `/api/series`, `/api/series/defauts` |
| `AFFECTATIONS` | idem | `/api/affectations` |
| `ELEVES` | idem (`CREER` couvre l’import) | `/api/eleves`, `/api/eleves/import` |
| `NOTES` | idem | `/api/notes` |
| `BULLETINS` | Voir, Créer (générer), Imprimer | `/api/bulletins`, `/api/bulletins/generer` |
| `PARAMETRES` | Voir, Modifier | écran Paramètres, charte graphique `/api/etablissement/charte` (lecture aussi ouverte avec `BULLETINS:VOIR`), fiche de l’établissement `PUT /api/etablissement` (lecture `GET /api/etablissement` et `GET /api/etablissement/statistiques` ouverte à tout utilisateur de l’établissement) |
| `UTILISATEURS` | Voir, Détails, Créer, Modifier, Supprimer | `/api/utilisateurs` |

Plateforme :

| Ressource | Actions applicables | API |
| --- | --- | --- |
| `ETABLISSEMENTS` | Voir, Détails, Créer, Modifier (réactiver), Supprimer (désactiver) | `/api/plateforme/etablissements` |
| `GESTIONNAIRES` | Voir, Détails, Créer, Modifier, Supprimer | `/api/plateforme/gestionnaires` |
| `TYPES_EXAMEN` | Voir, Détails, Créer, Modifier (dont activer / désactiver), Supprimer (refusé `409` si des sessions l’utilisent) | `/api/plateforme/types-examen` — lecture des types actifs par les établissements : `GET /api/types-examen` (tout utilisateur connecté, sans droit particulier), voir `docs/EXAMENS.md` |

Règle complémentaire inchangée : un `ENSEIGNANT` ne saisit ou ne modifie une note que pour une matière et une classe qui lui sont affectées (fiche enseignant reliée à son compte).

## Rôles = préréglages

Le rôle choisi à la création copie une matrice de départ dans `permission_utilisateur`. Elle est ensuite librement ajustée case par case ; le rôle reste visible comme étiquette. Changer le rôle d’un compte réapplique le préréglage du nouveau rôle.

| Ressource | OWNER | ADMIN | SECRETAIRE | ENSEIGNANT |
| --- | --- | --- | --- | --- |
| ANNEES, CENTRES, SESSIONS | tout | tout | Voir, Détails | Voir |
| MATIERES, COEFFICIENTS | tout | tout | Voir, Détails | Voir |
| ENSEIGNANTS, CLASSES, SERIES, AFFECTATIONS | tout | tout | Voir, Détails | Voir |
| ELEVES | tout | tout | Voir, Détails, Créer, Modifier | Voir |
| NOTES | tout | tout | Voir, Détails, Créer, Modifier | Voir, Détails, Créer, Modifier (ses affectations) |
| BULLETINS | tout | tout | Voir, Créer, Imprimer | Voir |
| PARAMETRES | tout | tout | Voir | — |
| UTILISATEURS | tout | Voir, Détails | — | — |

Le secrétariat ne supprime rien par défaut. Seul `OWNER` gère les utilisateurs par défaut (`UTILISATEURS:CREER / MODIFIER / SUPPRIMER`) ; il peut déléguer ces droits à un `ADMIN`.

| Ressource | SUPER_ADMIN | GESTIONNAIRE_PLATEFORME (défaut) |
| --- | --- | --- |
| ETABLISSEMENTS | tout | Voir, Détails |
| GESTIONNAIRES | tout | Voir |
| TYPES_EXAMEN | tout | Voir |
| ressources d’établissement | tout (sur son propre établissement) | — |

`OWNER` et `SUPER_ADMIN` ont toujours tout : leur matrice n’est pas stockée, ne se modifie pas et leur compte ne peut être ni désactivé ni supprimé par un autre utilisateur.

### Garantie du créateur du compte (OWNER)

Le créateur du compte de son établissement a tous les droits CRUD sur tout son établissement. Cette garantie est **implicite dans le code**, pas un préréglage qui pourrait manquer ou être retiré :

- `PermissionService.droitsDe` renvoie `tous(Ressource.etablissement())` dès que le rôle est `OWNER`, **avant** toute lecture de `permission_utilisateur`. Une ligne absente, ou une ligne parasite « refusée », ne change rien.
- `EtablissementService.creer` (inscription publique `POST /api/auth/signup` et ajout par la plateforme) crée toujours le compte en `OWNER` sans écrire la moindre ligne de permission.
- Les comptes `OWNER` existants avant la migration `V10` n’ont donc aucune action à faire : la colonne `actif` est créée à `TRUE` et leurs droits sont complets dès le redémarrage.
- `Role.estIntouchable()` protège l’`OWNER` partout : `PermissionService.remplacer` refuse (`403`) toute matrice ou préréglage ciblant un `OWNER` ; `UtilisateursService.modifier`, `reinitialiserMotDePasse` et `supprimer` refusent (`403`) de le modifier, de le désactiver, de changer son mot de passe ou de le supprimer, qu’il s’agisse de lui-même ou d’un `ADMIN` qu’il a créé.
- Personne ne crée ni ne promeut un autre `OWNER` : `POST /api/utilisateurs` et `PUT /api/utilisateurs/{id}` n’acceptent que `ADMIN`, `SECRETAIRE`, `ENSEIGNANT` (`400` sinon).
- Dans l’onglet **Utilisateurs & droits**, l’`OWNER` apparaît avec `restreignable = false` : « Tous les droits », sans bouton Droits, Désactiver, Mot de passe ni Supprimer.

Le test `OwnerDroitsCompletsTest` vérifie ce contrat de bout en bout (CRUD complet sans aucune ligne de permission, puis refus de toute tentative de restriction par l’OWNER lui-même ou par un ADMIN).

## Règles de sécurité

- **On ne donne pas ce qu’on n’a pas.** Un utilisateur ne peut accorder qu’un droit qu’il détient lui-même. À la création d’un compte, le préréglage est limité aux droits de l’auteur ; une matrice explicite contenant un droit non détenu est refusée (`403 Vous ne pouvez pas accorder un droit que vous ne détenez pas : …`).
- **On ne modifie pas ses propres droits**, ni son propre état (actif), ni son propre compte depuis la liste ; on ne se supprime pas soi-même.
- **Cloisonnement.** `/api/utilisateurs` ne montre et ne touche que les comptes de l’établissement de l’appelant (`404` sinon). `/api/plateforme/gestionnaires` n’atteint que les comptes de niveau plateforme.
- **Effet immédiat.** Les droits sont relus en base à chaque requête : une restriction s’applique sans nouveau jeton. Un compte désactivé, ou l’utilisateur d’un établissement désactivé, reçoit `403` partout et ne peut plus se connecter.
- **Message de refus.** `{ "status": 403, "message": "Action non autorisée : SUPPRIMER sur MATIERES" }`.
- **Comptes antérieurs.** Un utilisateur sans aucune ligne dans `permission_utilisateur` (créé avant cette version) hérite du préréglage de son rôle. Dès qu’une matrice est enregistrée, toutes les cases applicables sont stockées (accordées ou non).

## Comment faire

### Le responsable d’un établissement ajoute un utilisateur

1. Administration → onglet **Utilisateurs & droits** (visible avec `UTILISATEURS:VOIR`).
2. **Ajouter un utilisateur** : nom, email de connexion, mot de passe temporaire (6 caractères minimum), rôle. Option **Personnaliser les droits** pour partir d’une matrice sur mesure. Pour un enseignant, relier sa fiche enseignant afin que la règle « ses affectations » fonctionne.
3. Communiquer le mot de passe temporaire directement : **aucun email n’est envoyé**.
4. Bouton **Droits** sur une ligne : cocher / décocher les cases, **Appliquer le préréglage du rôle**, puis **Enregistrer les droits**. Les cases grisées sont des droits que vous ne détenez pas.
5. **Mot de passe** réinitialise un mot de passe temporaire ; **Désactiver** bloque la connexion sans rien effacer ; **Supprimer** efface le compte et sa matrice.

API : `GET/POST /api/utilisateurs`, `GET /api/utilisateurs/referentiel`, `GET/PUT/DELETE /api/utilisateurs/{id}`, `PUT /api/utilisateurs/{id}/permissions` (`{ "permissions": ["ELEVES:CREER", …] }`), `POST /api/utilisateurs/{id}/permissions/prereglage`, `POST /api/utilisateurs/{id}/reinitialiser-mot-de-passe` (`{ "motDePasse": "…" }`).

### Le propriétaire du logiciel ajoute un gestionnaire

1. Se connecter avec le compte désigné par `SUPER_ADMIN_EMAIL` (voir `docs/DEPLOIEMENT.md`). L’écran **Plateforme : établissements & gestionnaires** apparaît dans la barre latérale.
2. Onglet **Gestionnaires** → **Ajouter un gestionnaire** : nom, email, mot de passe temporaire, droits (préréglage `Voir` + `Détails` sur les établissements, ou matrice personnalisée).
3. Un gestionnaire n’est rattaché à aucun établissement (`etablissement_id` nul) : il n’a accès à aucune donnée pédagogique, uniquement à `/api/plateforme/**` selon ses droits.
4. Onglet **Établissements** : la liste demande `ETABLISSEMENTS:VOIR` ; les contacts et effectifs demandent `DETAILS` ; **Ajouter un établissement** (crée l’école et son `OWNER` avec un mot de passe temporaire) demande `CREER` ; **Désactiver** demande `SUPPRIMER` ; **Réactiver** demande `MODIFIER`. On ne désactive pas l’établissement qui porte le compte `SUPER_ADMIN`.
5. Onglet **Types d’examen** : le référentiel commun (CEPD, BEPC, BAC I, BAC II, composition…) que chaque établissement choisit pour ses sessions. La liste demande `TYPES_EXAMEN:VOIR` ; **Créer**, **Modifier** / **Désactiver** / **Réactiver** et **Supprimer** demandent respectivement `CREER`, `MODIFIER` et `SUPPRIMER`. Un type utilisé par des sessions ne se supprime pas : il se désactive (voir `docs/EXAMENS.md`).

API : `GET/POST /api/plateforme/etablissements`, `GET /api/plateforme/etablissements/{id}`, `DELETE /api/plateforme/etablissements/{id}` (désactivation), `PUT /api/plateforme/etablissements/{id}/reactiver`, `GET/POST /api/plateforme/gestionnaires`, `GET /api/plateforme/gestionnaires/referentiel`, `GET/PUT/DELETE /api/plateforme/gestionnaires/{id}`, `PUT …/{id}/permissions`, `POST …/{id}/permissions/prereglage`, `POST …/{id}/reinitialiser-mot-de-passe`.

### Connexion et interface

`POST /api/auth/login` et `POST /api/auth/signup` renvoient `permissions` (liste de codes) ; `GET /api/auth/me` relit le compte (rôle, établissement, permissions, actif). Le front utilise `usePermissions().can('MATIERES', 'SUPPRIMER')` pour masquer formulaires et boutons ; l’entrée **Administration** n’apparaît qu’avec au moins un droit d’écriture ou `UTILISATEURS:VOIR` ; l’impression des bulletins demande `BULLETINS:IMPRIMER`.

## Schéma

Migration `V10__permissions_utilisateurs.sql` :

- `utilisateur.etablissement_id` devient nullable (gestionnaires de la plateforme) ; ajout de `actif` (défaut vrai) et `cree_par` (créateur, nullable).
- `etablissement.actif` (défaut vrai) pour la désactivation douce.
- Table `permission_utilisateur (id, utilisateur_id, ressource, action, accorde)` avec unicité `(utilisateur_id, ressource, action)` et suppression en cascade avec l’utilisateur.

## Variables d’environnement

`SUPER_ADMIN_EMAIL` : email du propriétaire, qui reçoit `SUPER_ADMIN` au démarrage et à la connexion. Sans elle, personne n’a le rôle plateforme et les gestionnaires existants gardent leurs droits mais ne peuvent plus être gérés.

`SUPER_ADMIN_PASSWORD` : mot de passe du propriétaire. Au démarrage, si aucun compte ne porte `SUPER_ADMIN_EMAIL`, l’API crée directement le compte `SUPER_ADMIN` (sans inscription, sans établissement) avec ce mot de passe ; si le compte existe et que la valeur a changé, le mot de passe est réinitialisé. Jamais commitée : variable du service (Render, `sync: false`) ou `.env` local. Détails dans `docs/DEPLOIEMENT.md`.
