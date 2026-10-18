# Classes, cycles et séries

Ce document décrit comment une classe est caractérisée dans AcademiaBlanc : son **cycle**,
son **niveau** et, au lycée, sa **série**. Il décrit aussi le référentiel des séries que chaque
établissement peut compléter.

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

Le tableau des classes affiche le cycle, le niveau et le code de série accompagné de sa famille.
Une série utilisée par au moins une classe ne peut pas être supprimée (le bouton est désactivé et
l'API répond 409).

## Coefficients par défaut et séries techniques

Les coefficients par défaut sont indexés par niveau et par série. `ClasseNiveauUtil.resolve`
renvoie, en plus du cycle et du niveau canonique, le code de la série et sa **famille**.
`ClasseNiveauUtil.serieDeReference(serie, famille)` donne la série dont la grille s'applique :

- série générale : la série elle-même (`A4`, `C`, `D`) ;
- série technique : repli sur la grille **scientifique** (`D`) tant qu'aucune ligne spécifique
  à la série (`G2`, `F4`…) n'est définie par l'établissement.

Un coefficient saisi pour une classe précise (`coefficient.classe_id`) l'emporte toujours sur ces
valeurs par défaut.
