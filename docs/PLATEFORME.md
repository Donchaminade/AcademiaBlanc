# Plateforme : préréglages nationaux (pays, ministère, devise)

L’en-tête officiel du bulletin — « RÉPUBLIQUE TOGOLAISE / Travail – Liberté – Patrie / Ministère… (MEPST) » — n’est plus codé dans l’interface. Il repose sur un référentiel créé et tenu par la plateforme, que chaque établissement applique puis ajuste.

## Avant / après

Avant : le bloc « Préréglages nationaux en 1 clic » de l’écran Paramètres proposait deux constantes du front (`TOGO_SETTINGS`, `CI_SETTINGS` dans `src/data/mockData.ts`) ; la vitrine et les pages de connexion affichaient « République Togolaise • MEPST » en dur ; l’en-tête du bulletin ne vivait que dans les réglages locaux du navigateur (IndexedDB).

Après :

- la plateforme gère un référentiel `prereglage_national` (onglet **Pays & ministères** de la vue Plateforme) ;
- chaque établissement porte son en-tête officiel (`etablissement.republique`, `devise_nationale`, `ministere`, `sigle_ministere`, `autorite_regionale`, `pied_de_page`) et le préréglage appliqué en dernier (`prereglage_national_id`) ;
- le bloc « 1 clic » lit `GET /api/prereglages-nationaux` ; hors connexion (espace de démonstration), une liste locale étiquetée **Démonstration** (`src/data/prereglagesDemo.ts`) est affichée ;
- la vitrine et les pages `/connexion`, `/inscription` affichent le préréglage **par défaut** de la plateforme (`GET /api/public/prereglage-defaut`, sans jeton) avec repli local si l’API est injoignable.

## Modèle

Table `prereglage_national` (migration `V13__prereglage_national.sql`) :

| Colonne | Sens |
| --- | --- |
| `code` | ISO 3166-1 alpha-2, unique (`TG`, `CI`…), normalisé en majuscules ; sert au drapeau de l’interface. |
| `nom_pays` | « Togo », « Côte d’Ivoire ». |
| `republique` | Nom officiel imprimé : « RÉPUBLIQUE TOGOLAISE ». |
| `devise` | « Travail – Liberté – Patrie ». |
| `ministere`, `sigle_ministere` | Ministère de tutelle et son sigle (`MEPST`, `MENA`). |
| `autorite_regionale` | Facultatif : ligne ajoutée sous le sigle (direction régionale…). |
| `pied_de_page` | Facultatif : mention réservée, affichée dans l’aperçu mais pas encore imprimée. |
| `ordre`, `actif`, `par_defaut` | Tri, désactivation douce, préréglage par défaut (un seul à vrai). |

La migration insère le Togo (par défaut) et la Côte d’Ivoire, et applique le Togo aux établissements existants pour que leurs bulletins ne changent pas.

Un préréglage **désactivé** n’est plus proposé ni applicable, mais les établissements qui l’avaient appliqué gardent leur en-tête et la référence. Le préréglage par défaut ne peut être ni désactivé ni supprimé tant qu’un autre n’a pas été désigné ; définir un préréglage par défaut retire ce statut aux autres. La **suppression** est refusée (409) si un établissement est rattaché au préréglage : désactiver à la place. Modifier un préréglage ne modifie pas les établissements qui l’ont déjà appliqué.

## API

Plateforme (ressource `PREREGLAGES`, SUPER_ADMIN tout, GESTIONNAIRE_PLATEFORME `VOIR` par défaut) :

| Méthode | URL | Droit |
| --- | --- | --- |
| `GET` | `/api/plateforme/prereglages-nationaux` | `VOIR` — liste complète avec `etablissements` (nombre d’établissements rattachés) |
| `POST` | `/api/plateforme/prereglages-nationaux` | `CREER` — le premier préréglage créé devient celui par défaut |
| `PUT` | `/api/plateforme/prereglages-nationaux/{id}` | `MODIFIER` |
| `PUT` | `/api/plateforme/prereglages-nationaux/{id}/actif` `{ "actif": false }` | `SUPPRIMER` pour désactiver, `MODIFIER` pour réactiver |
| `PUT` | `/api/plateforme/prereglages-nationaux/{id}/defaut` | `MODIFIER` |
| `DELETE` | `/api/plateforme/prereglages-nationaux/{id}` | `SUPPRIMER` — 409 si utilisé ou par défaut |

Corps de création / modification : `code`, `nomPays`, `republique`, `devise`, `ministere`, `sigleMinistere` (obligatoires), `autoriteRegionale`, `piedDePage`, `ordre`, `parDefaut`.

Établissement :

| Méthode | URL | Droit |
| --- | --- | --- |
| `GET` | `/api/prereglages-nationaux` | tout utilisateur connecté — préréglages actifs, triés |
| `GET` | `/api/etablissement` | la fiche contient `enTete` (`prereglageNationalId`, `republique`, `deviseNationale`, `ministere`, `sigleMinistere`, `autoriteRegionale`, `piedDePage`) |
| `POST` | `/api/etablissement/prereglage-national/{id}` | `PARAMETRES:MODIFIER` — copie les libellés du préréglage dans l’en-tête et mémorise l’identifiant |
| `PUT` | `/api/etablissement/en-tete` | `PARAMETRES:MODIFIER` — en-tête saisi à la main (l’identifiant mémorisé est conservé s’il désigne un préréglage existant) |
| `PUT` | `/api/etablissement` | `PARAMETRES:MODIFIER` — accepte aussi `enTete` ; absent, l’en-tête reste inchangé |

Public : `GET /api/public/prereglage-defaut` (sans jeton) renvoie le préréglage par défaut, sinon le premier actif, sinon 404. Un nouvel établissement (inscription ou création par la plateforme) reçoit cet en-tête à sa création.

## Interface

- **Paramètres → Charte graphique & établissement** : le bloc « Préréglages nationaux en 1 clic » liste les préréglages de l’API (badge « Référentiel de la plateforme ») ou la liste de démonstration hors connexion (badge « Démonstration »). Cliquer applique le préréglage côté serveur et met à jour les champs Pays, Devise, Ministère et Sigle, modifiables ensuite ; chaque enregistrement renvoie l’en-tête à l’API (`PUT /api/etablissement/en-tete`). Cachet, signatures et logos ne sont pas touchés.
- **Bulletin** : le sigle imprimé est celui enregistré (`ministrySigle`) ; à défaut il est déduit du nom du ministère comme avant. L’autorité régionale, si renseignée, s’ajoute sous le sigle.
- **Plateforme → Pays & ministères** : tableau (drapeau, en-tête, ministère, état, nombre d’établissements), formulaire créer / modifier avec **aperçu de l’en-tête du bulletin**, boutons **Par défaut**, **Désactiver / Réactiver** (confirmation), **Supprimer** (confirmation, seulement si aucun établissement n’est rattaché). L’affichage suit `usePermissions().can('PREREGLAGES', …)` ; le serveur reste la référence.

## Tests

`backend/src/test/java/tg/academiablanc/api/PrereglagesNationauxTest.java` : migration (Togo par défaut, tri), lecture établissement, application à un établissement et modification de l’en-tête, CRUD plateforme avec droits (OWNER 403, gestionnaire `VOIR` seulement), unicité du défaut, 409 à la suppression d’un préréglage utilisé, endpoint public sans jeton. Côté front, `src/utils/prereglages.test.ts` couvre les utilitaires (drapeau, casse de titre, application d’un préréglage, détection des changements).
