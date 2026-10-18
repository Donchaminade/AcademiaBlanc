# Importer une liste d'élèves

Les élèves sont enregistrés **dans la base de données de votre établissement** (pas en
données statiques) via l'API, cloisonnés par le jeton de connexion. Deux façons de faire :
depuis l'écran Administration, ou avec `curl`.

## 1. Depuis l'application

Administration → section **Élèves** → bloc **Importer une liste** (sous le formulaire
« Inscrire l'élève »).

1. Collez la liste ci-dessous dans la zone de texte (une ligne par élève :
   `NOM Prénoms;Genre;JJ/MM/AAAA;Lieu`, genre `M` ou `F`, date et lieu facultatifs).
2. Classe : choisissez une classe existante ou **Nouvelle classe…** et tapez `3e`
   (la classe est créée automatiquement sur l'année scolaire courante, niveau « Troisième »).
3. Session : facultative.
4. Cliquez sur **Importer la liste**. Le résultat affiche le nombre d'élèves créés et ignorés.

Relancer le même import ne crée pas de doublons : un élève déjà présent dans la même
classe (même nom, accents et casse ignorés) est ignoré et listé.

### Matricule : automatique, jamais saisi

Le matricule n'apparaît ni dans la liste à coller ni dans le formulaire « Inscrire
l'élève » : il est **attribué par le serveur** à chaque création d'élève (import ou
inscription unitaire), puis **figé** (la modification d'une fiche ne peut pas le changer).

Format : `AA-CODE_ETAB-NNNNN`, par exemple `25-LYCE-LOME-01-00001`.

| Partie | Signification |
|---|---|
| `AA` | Deux derniers chiffres de l'année de début de l'année scolaire courante (à défaut la plus récente, sinon l'année civile). |
| `CODE_ETAB` | Code de l'établissement en majuscules, sans espaces ni accents (repli : quatre premières lettres du nom). |
| `NNNNN` | Numéro d'ordre sur cinq chiffres, continu pour l'établissement et l'année : `00001`, `00002`… quelle que soit la classe ou la voie de création. |

Chaque établissement a sa propre séquence (unicité garantie par la contrainte
`(etablissement_id, matricule)`). Les matricules déjà enregistrés, y compris ceux d'un
ancien format, ne sont jamais réécrits.

### Liste prête à coller — classe 3e

```text
ADOUGBA Komlan Bruno;M;05/10/2010;LOME
ATTIKOUFIO Estelle;F;09/05/2012;Lomé
AWESSO Adeline Essorezime;F;03/03/2012;TSEVIE
BAH-TRAORE Hikmat;F;12/06/2012;Lomé
BATOKI Essodolom Majoie;M;31/12/2012;TOKOIN
KARMA Biguediname Simonne;M;03/06/2011;KARA
KEZIE Essossohim Pascal;M;23/03/2010;Lomé
KOUASSI Iman Natacha;F;03/08/2013;HAHO
MIZOU Kinangba Roland;M;31/12/2014;TSEVIE
TCHALLA Emmanuella;F;31/12/2012;Dzové
WOBOTI Nadjat;M;07/11/2012;Lomé
```

## 2. Avec curl

Rôles autorisés : `OWNER`, `ADMIN`, `SECRETAIRE` (les mêmes que « Inscrire l'élève »).

Récupérez d'abord un jeton :

```bash
curl -s https://academiablanc-api.onrender.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"votre-email@etablissement.tg","motDePasse":"VOTRE_MOT_DE_PASSE"}'
# -> {"token":"...", ...}
```

Puis importez (remplacez `VOTRE_JETON`) :

```bash
curl -s https://academiablanc-api.onrender.com/api/eleves/import \
  -H 'Authorization: Bearer VOTRE_JETON' \
  -H 'Content-Type: application/json' \
  -d '{
    "classeNom": "3e",
    "eleves": [
      {"nomComplet":"ADOUGBA Komlan Bruno","genre":"M","dateNaissance":"05/10/2010","lieuNaissance":"LOME"},
      {"nomComplet":"ATTIKOUFIO Estelle","genre":"F","dateNaissance":"09/05/2012","lieuNaissance":"Lomé"},
      {"nomComplet":"AWESSO Adeline Essorezime","genre":"F","dateNaissance":"03/03/2012","lieuNaissance":"TSEVIE"},
      {"nomComplet":"BAH-TRAORE Hikmat","genre":"F","dateNaissance":"12/06/2012","lieuNaissance":"Lomé"},
      {"nomComplet":"BATOKI Essodolom Majoie","genre":"M","dateNaissance":"31/12/2012","lieuNaissance":"TOKOIN"},
      {"nomComplet":"KARMA Biguediname Simonne","genre":"M","dateNaissance":"03/06/2011","lieuNaissance":"KARA"},
      {"nomComplet":"KEZIE Essossohim Pascal","genre":"M","dateNaissance":"23/03/2010","lieuNaissance":"Lomé"},
      {"nomComplet":"KOUASSI Iman Natacha","genre":"F","dateNaissance":"03/08/2013","lieuNaissance":"HAHO"},
      {"nomComplet":"MIZOU Kinangba Roland","genre":"M","dateNaissance":"31/12/2014","lieuNaissance":"TSEVIE"},
      {"nomComplet":"TCHALLA Emmanuella","genre":"F","dateNaissance":"31/12/2012","lieuNaissance":"Dzové"},
      {"nomComplet":"WOBOTI Nadjat","genre":"M","dateNaissance":"07/11/2012","lieuNaissance":"Lomé"}
    ]
  }'
```

Réponse attendue au premier appel :

```json
{"crees":11,"ignores":0,"total":11,"classesCreees":["3e"],"lignesIgnorees":[]}
```

Au second appel identique : `"crees":0,"ignores":11` et la liste des élèves ignorés.

## Référence de l'API

`POST /api/eleves/import` — corps JSON :

| Champ | Type | Description |
|---|---|---|
| `classeId` | nombre | Classe existante de l'établissement (prioritaire sur `classeNom`). |
| `classeNom` | texte | Nom de classe ; créée si elle n'existe pas (niveau déduit : `3e` → Troisième, `4e` → Quatrième, `Tle` → Terminale…). |
| `sessionId` | nombre | Session d'examen facultative appliquée aux élèves. |
| `eleves[]` | liste | Au moins une ligne. |
| `eleves[].nomComplet` | texte | Obligatoire : `NOM Prénoms`. |
| `eleves[].genre` | `M` / `F` | Obligatoire. |
| `eleves[].dateNaissance` | texte | Facultatif, stocké tel quel (`JJ/MM/AAAA`). |
| `eleves[].lieuNaissance` | texte | Facultatif. |
| `eleves[].classeId` / `classeNom` / `sessionId` | | Surcharges par ligne des valeurs globales. |

Le champ `matricule` n'est pas accepté : s'il est envoyé, il est ignoré et un matricule
`AA-CODE_ETAB-NNNNN` est attribué par le serveur (voir ci-dessus). Il en va de même pour
`POST /api/eleves` ; `PUT /api/eleves/{id}` ne modifie jamais le matricule.

Réponse : `{ crees, ignores, total, classesCreees[], lignesIgnorees[{ nomComplet, motif }] }`.

Erreurs : `400` genre invalide ou classe non indiquée, `403` rôle insuffisant,
`404` classe/session d'un autre établissement.
