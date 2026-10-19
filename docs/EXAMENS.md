# Types d’examen et sessions

Le **type d’examen** d’une session (CEPD, BEPC, BAC I, BAC II, composition…) n’est plus figé : il vient d’un
référentiel commun à toute la plateforme, géré par le propriétaire du logiciel, et chaque établissement le
choisit à la création ou à la modification d’une session.

## Référentiel de la plateforme

Table `type_examen` (migration `V13__type_examen.sql`) :

| Colonne | Sens |
| --- | --- |
| `code` | clé fonctionnelle unique, en majuscules (`CEPD`, `BEPC`, `BAC1`, `BAC2`, `COMPO`) |
| `libelle_court` | affiché dans les listes, la barre latérale, le PV et les archives (« BEPC », « BAC II ») |
| `libelle_long` | imprimé en tête du bulletin (« Brevet d’Études du Premier Cycle ») |
| `cycle` | `COLLEGE`, `LYCEE` ou `TOUS` : groupe le sélecteur et déclenche un avertissement non bloquant |
| `ordre`, `actif` | ordre d’affichage ; un type désactivé n’est plus proposé mais les sessions qui l’utilisent le gardent |

Données initiales : CEPD (`TOUS`, l’application ne gère pas de classes du primaire), BEPC (`COLLEGE`),
BAC I / Probatoire (`LYCEE`), BAC II (`LYCEE`), Composition / Examen blanc interne (`TOUS`).

API plateforme (ressource `TYPES_EXAMEN`, voir `docs/ROLES_ET_PERMISSIONS.md`) :

- `GET /api/plateforme/types-examen` — tous les types, avec `sessions` = nombre de sessions (tous établissements) qui les utilisent ;
- `GET /api/plateforme/types-examen/{id}` ;
- `POST /api/plateforme/types-examen` — `{ code, libelleCourt, libelleLong, cycle, ordre, actif }` (`409` si le code existe) ;
- `PUT /api/plateforme/types-examen/{id}` — même corps ; `actif: false` désactive ; renommer le libellé court met à jour le texte des sessions rattachées ;
- `DELETE /api/plateforme/types-examen/{id}` — suppression définitive, `409` dès qu’une session utilise le type.

Lecture par les établissements : `GET /api/types-examen` (types actifs, option `?cycle=COLLEGE|LYCEE` qui garde aussi
les types `TOUS`), accessible à tout utilisateur connecté.

## Sessions

`session_examen.type_examen_id` (nullable) référence le type. La colonne texte `type_examen` est conservée et
synchronisée avec le libellé court du référentiel : les bulletins et archives existants continuent de la lire.

`POST/PUT /api/sessions` acceptent `typeExamenId` (type **actif** exigé, `400` sinon). Le champ texte `typeExamen`
n’est accepté qu’en repli pour les anciens clients : il est reconnu quand c’est possible (« BAC II »,
« BACCALAURÉAT II » → `BAC2`) et sinon conservé tel quel, sans rattachement.

Les réponses de `/api/sessions` ajoutent `typeExamenId`, `typeExamenCode`, `typeExamenLibelle`,
`typeExamenLibelleLong`, `typeExamenCycle` et `typeExamenHorsReferentiel` (vrai pour une session antérieure
non rattachée : son texte d’origine fait foi, l’interface la signale « Hors référentiel » et propose de choisir un type).

### Sessions existantes

La migration rattache les sessions d’après leur libellé texte : `BEPC`, `CEPD`, `BAC I` / première partie /
probatoire, puis tout libellé contenant « BAC » vers `BAC2` (l’ancien type figé était « BACCALAURÉAT II »),
enfin « composition ». Le texte des sessions rattachées reprend le libellé court. Une session dont le texte
n’est reconnu par aucune règle reste non rattachée (`type_examen_id` nul) et continue d’afficher son texte.

## Interface

- **Administration › Année & Sessions** : champ **Examen** (sélecteur groupé Collège / Lycée / Tous) à la
  création et à la modification ; nom de session proposé « BEPC Blanc 2026 » à partir du type et de l’année,
  modifiable ; avertissement non bloquant si le cycle du type ne correspond pas aux classes concernées ; colonne
  **Examen** du tableau = libellé court du référentiel.
- **Bulletin** (vue et impression groupée) : titre = libellé long en majuscules suivi de « — EXAMEN BLANC »
  (`BREVET D’ÉTUDES DU PREMIER CYCLE — EXAMEN BLANC`) ; le sous-titre par série est conservé.
- **Tableau de bord, PV / palmarès, barre latérale, archives** : libellé court de la session active.
- **Mode démonstration** (sans connexion) : la valeur affichée est étiquetée « BAC II (démonstration) ».
- **Plateforme › Types d’examen** : tableau (code, libellés, cycle, ordre, état, sessions), formulaire
  créer / modifier, activer / désactiver avec confirmation, suppression (confirmée) uniquement si inutilisé.
