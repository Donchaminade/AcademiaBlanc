# Classes, cycles, séries et programme

Ce document décrit comment une classe est caractérisée dans AcademiaBlanc : son **cycle**,
son **niveau**, au lycée seulement sa **série**, et son **programme** (les matières qui lui
sont affectées avec leurs coefficients). Il décrit aussi le référentiel des séries que chaque
établissement peut compléter.

Principe : **le collège n'a pas de série** (6e à 3e), et **les matières ne dépendent pas d'une
série**. Le catalogue des matières est commun à l'établissement ; on choisit ensuite une classe,
on coche ses matières, on fixe les coefficients et on valide.

## Cycles et niveaux

| Cycle   | Niveaux (codes canoniques) | Série |
|---------|----------------------------|-------|
| Collège | `6e`, `5e`, `4e`, `3e`     | aucune (une série sur une classe du collège est refusée : **400**) |
| Lycée   | `2nde`, `1ère`, `Tle`      | obligatoire, choisie dans le référentiel de l'établissement |

Le niveau est accepté sous ses formes usuelles (« Troisième », « 3ème », « Terminale », « Tle »…)
et ramené au code canonique par `ClasseNiveauUtil.canonique`. Un niveau non reconnu (par exemple
une classe du primaire) n'impose pas de série ; si une série est fournie, elle doit exister.

Le nom d'une classe se déduit du niveau et de la série : `3e`, `Tle D`, `1ère G2`
(`ClasseNiveauUtil.nomClasse`). Dans le formulaire d'administration, le nom est pré-rempli ainsi
lorsque le champ est laissé vide ; il reste modifiable (`Tle D1`, `3e A`…).

## Séries du lycée : deux familles

Les séries sont réparties en deux familles (`FamilleSerie`) :

| Famille     | Séries chargées par défaut | Libellés |
|-------------|----------------------------|----------|
| `GENERALE`  | `A4`, `C`, `D`             | Littéraire ; Mathématiques et Sciences physiques ; Mathématiques et Sciences naturelles |
| `TECHNIQUE` | `G1`, `G2`, `G3`, `F1`, `F2`, `F3`, `F4` | Techniques administratives ; Techniques quantitatives de gestion ; Techniques commerciales ; Construction mécanique ; Électronique ; Électrotechnique ; Génie civil |

« G » et « F » désignent les groupes de séries techniques ; les codes effectivement portés par les
classes sont `G1`, `G2`, `G3`, `F1`… La liste n'est **pas fermée** : chaque établissement ajoute
ses propres séries (`E`, `Ti`, `F5`, `G4`…) sans intervention technique.

Les défauts sont chargés automatiquement à la première consultation de `GET /api/series` par un
établissement qui n'a encore aucune série, ou à la demande via `POST /api/series/defauts`
(idempotent : seules les séries manquantes sont ajoutées, celles déjà présentes ne sont pas
modifiées).

### Modèle

Table `serie` (migration `V5__serie_referentiel.sql`) :

| Colonne            | Rôle |
|--------------------|------|
| `etablissement_id` | établissement propriétaire (cloisonnement multi-établissements) |
| `code`             | code court en majuscules (`A4`, `G2`, `F5`), unique par établissement |
| `libelle`          | intitulé lisible |
| `famille`          | `GENERALE` ou `TECHNIQUE` |
| `actif`            | une série inactive n'est plus proposée pour de nouvelles classes |
| `ordre`            | ordre d'affichage dans sa famille |

`classe.serie` reste une colonne texte : elle porte le **code** de la série (`D`, `G2`), normalisé
en majuscules à l'enregistrement. L'API vérifie que ce code existe (et est actif) pour
l'établissement avant de créer ou modifier une classe du lycée.

### API

Toutes les routes sont cloisonnées par établissement (jeton JWT). La lecture est ouverte à tout
utilisateur connecté ; les écritures sont réservées au responsable (`OWNER` / `ADMIN`), comme pour
les classes.

| Méthode  | Route                 | Rôle |
|----------|-----------------------|------|
| `GET`    | `/api/series`         | liste triée par famille puis ordre (charge les défauts si la liste est vide) |
| `GET`    | `/api/series/{id}`    | détail |
| `POST`   | `/api/series`         | création — corps `{ "code": "F5", "libelle": "Fabrication mécanique", "famille": "TECHNIQUE" }` (`actif`, `ordre` facultatifs) ; **409** si le code existe déjà |
| `PUT`    | `/api/series/{id}`    | modification ; **409** si l'on renomme une série utilisée par une classe |
| `DELETE` | `/api/series/{id}`    | suppression ; **409** si une classe utilise la série |
| `POST`   | `/api/series/defauts` | (re)charge les séries par défaut manquantes |

Côté classes (`POST`/`PUT /api/classes`) :

- collège + série → **400** ;
- lycée sans série → **400** ;
- lycée avec une série inconnue de l'établissement → **400** (« Ajoutez-la dans le référentiel des séries ») ;
- le code est renvoyé normalisé (`"f5"` → `"F5"`).

### Ajouter une série (écran Administration → Enseignants & Classes)

1. Dans la carte **Séries du lycée**, cliquer sur **Nouvelle série**, saisir le code, le libellé et
   la famille, puis **Ajouter**. Le bouton **Charger les séries par défaut** complète la liste avec
   les séries standard manquantes.
2. Ou, directement depuis le formulaire **Classes & titulaires** : choisir le cycle *Lycée*, puis
   dans le sélecteur **Série** (regroupé Générales / Techniques) l'option **+ Nouvelle série…** ;
   la série créée est aussitôt sélectionnée pour la classe.

Le tableau des classes affiche le cycle, le niveau, le nombre de matières au programme et, pour
le lycée, le code de série accompagné de sa famille. La colonne **Série** n'apparaît que si
l'établissement a au moins une classe de lycée ; elle reste vide pour une classe de collège.
Une série utilisée par au moins une classe ne peut pas être supprimée (le bouton est désactivé et
l'API répond 409).

### Où la série n'apparaît pas (collège)

- formulaire et tableau des classes : champ masqué, nom généré sans série (`3e`, pas `3e D`) ;
- en-tête du bulletin, impression groupée, signature : la mention « • Série … » est omise, même si
  la session d'examen porte une série ;
- programme des classes et coefficients : plus de colonne « Série » ;
- session d'examen : le formulaire n'envoie plus de série par défaut (la série est portée par la
  classe du lycée).

## Programme de classe

Le programme d'une classe est l'ensemble des matières qui lui sont affectées, chacune avec son
coefficient. Il est porté par la table `coefficient` (migration `V13__programme_classe.sql`) :

| Ligne `coefficient`                         | Sens |
|---------------------------------------------|------|
| `classe_id` renseigné                       | la matière est **au programme** de la classe, avec ce coefficient (une seule ligne par couple matière × classe : index unique `uk_coefficient_matiere_classe`) |
| `classe_id` nul (« toutes les classes »)    | coefficient **global**, utilisé seulement par les classes qui n'ont encore aucun programme |

Une classe **sans aucune ligne** n'a pas de programme défini : par compatibilité, son bulletin
retient toutes les matières de l'établissement avec les coefficients globaux (1 à défaut), et la
saisie des notes accepte toutes les matières. L'écran d'administration l'indique par un
avertissement et le tableau des classes affiche « à définir ».

Dès qu'un programme existe :

- le bulletin de chaque élève de la classe ne comporte **que** les matières du programme, avec
  ses coefficients (`BulletinService`) ; le rang par matière est calculé parmi les élèves qui ont
  la matière à leur programme ;
- une note dans une matière hors programme est **refusée** (`400`) par `POST`/`PUT /api/notes`,
  et la grille de saisie affiche la cellule désactivée.

### API

Lecture avec `COEFFICIENTS:VOIR`, écriture avec `COEFFICIENTS:MODIFIER`, cloisonnement par
établissement (classe ou matière d'un autre établissement : `404`).

| Méthode | Route | Rôle |
|---------|-------|------|
| `GET`   | `/api/classes/{id}/programme` | `[{ matiereId, code, nom, groupe, groupeLibelle, coefficient }]` dans l'ordre du bulletin (LT, SC, hors groupe) ; `[]` si aucun programme |
| `PUT`   | `/api/classes/{id}/programme` | corps `[{ "matiereId": 12, "coefficient": 3 }, …]` — **remplace** le programme (transactionnel : met à jour, crée, supprime) ; coefficient 0,5–20, 1 par défaut ; doublon ou valeur hors bornes : `400` ; `[]` retire le programme |
| `POST`  | `/api/classes/{id}/programme/copier-de/{autreId}` | copie le programme d'une autre classe (`400` si elle n'en a pas ou si c'est la même classe) |
| `GET`   | `/api/classes/{id}/programme/suggestions` | `[{ matiereId, code, coefficient }]` : coefficient suggéré pour chaque matière du catalogue selon le niveau et la série de la classe (rien n'est enregistré) |
| `POST`  | `/api/matieres/referentiel` | charge les 7 matières de base dans le catalogue (`{ matieresCreees, matieresExistantes }`) ; **ne crée plus aucun coefficient** |

Les anciennes routes `/api/coefficients` restent disponibles (« mode avancé ») ; créer une
deuxième ligne pour un couple matière × classe déjà au programme répond `409`.

### Écran Administration → Programme des classes

1. Choisir la classe (liste groupée Collège / Lycée, avec le nombre de matières déjà affectées).
2. Cocher les matières (groupées Littératures / Scientifiques / hors groupe) et saisir le
   coefficient de chacune. Raccourcis : **Tout cocher**, **Suggestions par défaut** (coche les
   matières de base et pré-remplit les coefficients proposés pour le niveau et la série — simple
   point de départ, modifiable), **Copier depuis une classe…**.
3. Vérifier le récapitulatif (« N matières, Σ coefficients = X, total max = 20·X pts ») puis
   **Valider le programme** (confirmation). Un indicateur signale les modifications non
   enregistrées ; changer de classe avec des modifications en attente demande confirmation.

## Coefficients suggérés et séries techniques

Les coefficients proposés par « Suggestions par défaut » sont indexés par niveau et par série
(`ReferentielMatieres.coefficientParDefaut`). `ClasseNiveauUtil.resolve` renvoie, en plus du
cycle et du niveau canonique, le code de la série et sa **famille** ;
`ClasseNiveauUtil.serieDeReference(serie, famille)` donne la série dont la grille s'applique :

- série générale : la série elle-même (`A4`, `C`, `D`) ;
- série technique : repli sur la grille **scientifique** (`D`) tant qu'aucune ligne spécifique
  à la série (`G2`, `F4`…) n'est définie par l'établissement.

Ces valeurs ne sont qu'une suggestion : seul le programme validé pour la classe fait foi.
