# État des boutons et actions

Audit de l’interface AcademiaBlanc (branche `feat/bulletins-download-rangs`).
Aucune action existante n’a été retirée. Seul le mot « Visa » a été enlevé de l’en-tête de colonne du bulletin (« Appréciation du professeur & Visa » → « Appréciation du professeur »). Les visas de signature (titulaire, sceau, colonne « Visa & Bulletin » du procès-verbal) sont inchangés.

Légende : **OK** = déjà fonctionnel ; **cassé** = ne produisait pas l’effet annoncé ; **factice** = simulait un succès (toast, délai, formule inventée).

| Action | Emplacement | Avant | Correctif | Comment tester |
|---|---|---|---|---|
| Recherche élève (Ctrl+K) | Barre latérale, `SearchModal` | OK | Inchangé | Ctrl+K, taper un nom, cliquer un résultat : ouvre le bulletin |
| Tableau de bord | Barre latérale | OK | Inchangé | Ouvre la vue synthèse |
| 1. Liste des élèves | Barre latérale | OK | Inchangé | Ouvre le registre |
| 2. Saisie des notes | Barre latérale | OK | Inchangé | Ouvre la grille de notes |
| 3. Bulletin officiel | Barre latérale | OK | Inchangé | Ouvre le bulletin du candidat courant |
| Télécharger tous les bulletins | Barre latérale (ex. « Impression groupée ») | cassé | Ouvre l’aperçu ; le bouton vert télécharge via le dialogue PDF (saut de page, zone fixe corrigée) | Cliquer, puis « Télécharger tous les bulletins », Enregistrer au format PDF : une page par candidat |
| Procès-verbal | Barre latérale | OK | Inchangé | Ouvre le palmarès |
| Paramètres | Barre latérale et pied de barre | OK | Inchangé | Ouvre la configuration |
| Compte établissement | Barre latérale | OK | Connexion par email + mot de passe vérifié | Voir la ligne Connexion |
| Session d’examen (liste) | Barre latérale | cassé | La valeur est transmise à l’en-tête du bulletin et à l’impression groupée | Choisir BEPC : le titre du bulletin change |
| Centre d’examen (liste) | Barre latérale | OK sur tableau de bord et PV | Affiché aussi sur la liste élèves | Changer le centre : le bandeau et le KPI se mettent à jour |
| Mode hors-ligne | Barre latérale | factice | État mémorisé ; les SMS/e-mails ne partent plus et le texte est copié | Activer LOCAL, ouvrir SMS : message copié, pas d’envoi |
| Saisir les notes / PV / candidat | Tableau de bord | OK | Inchangé | Les boutons changent de vue ou ouvrent le bulletin |
| Nouveau candidat | Liste élèves | OK | Inchangé | Le formulaire ajoute un candidat (localStorage) |
| Import CSV | Liste élèves | OK | Inchangé | « Charger un exemple » puis « Importer la liste » |
| Télécharger tous les bulletins | Liste élèves | cassé | Même aperçu PDF que la barre latérale | Voir ci-dessus |
| Feuille d’émargement | Liste élèves | cassé | Imprime un tableau nom / table / signature, pas l’écran d’admin | Bouton puis PDF : uniquement la feuille |
| Passer à la saisie / étapes 2 et 3 | Liste élèves | OK | Inchangé | Navigation |
| Modifier / supprimer / bulletin / notes (ligne) | Liste élèves | OK | Inchangé | Chaque icône ouvre l’action correspondante |
| Filtres genre | Liste élèves | OK | Inchangé | Tous / Garçons / Filles |
| Annuler / enregistrer (modales liste) | Liste élèves | OK | Inchangé | Ferme ou enregistre |
| Filtres admis / second tour / ajournés | Saisie, PV, aperçu groupé | cassé | « Admis » n’inclut plus les admissibles au second tour (`ADMISSIBLE` contient `ADMIS`) | Filtrer Admis : pas de décision « second tour » |
| Afficher le classement / explication des rangs | Saisie | OK | Inchangé | Déplie ou replie les blocs |
| Ajouter un candidat | Saisie | OK | Inchangé | Modale d’inscription |
| Notes (champs) | Saisie | OK | Bloquées si le PV est verrouillé ; valeurs hors 0–20 ignorées | Verrouiller le PV puis revenir à la saisie |
| Bulletin / arbitrage jury (ligne) | Saisie | OK | L’arbitrage est désactivé tant que le PV est verrouillé | Cadenas puis icône marteau inactive |
| Bonus de rachat | Modale jury | OK | Inchangé quand le PV est ouvert | Choisir un bonus, confirmer : moyenne mise à jour |
| Exporter CSV | PV | OK | Échappement des guillemets et des formules (`=`, `+`, `-`, `@`) | Télécharge un `.csv` ouvrable |
| Imprimer le registre | PV | OK | Titre de fichier `PV_…` | Dialogue PDF du palmarès |
| Verrouiller / déverrouiller le PV | PV | factice | Le verrou est mémorisé par établissement et bloque notes et rachat | Le libellé et la saisie suivent l’état |
| Filtres de palmarès + ouvrir bulletin | PV | OK | Filtre admis corrigé | Cliquer une ligne « bulletin » |
| Zoom 85 / 100 / 115 | Bulletin | OK | Inchangé | L’aperçu change d’échelle ; l’impression reste à taille réelle |
| Candidat précédent / suivant / liste | Bulletin | OK | Inchangé | Change le candidat affiché |
| Ce bulletin | Bulletin | OK | PDF nommé `Bulletin_<table>_<nom>` | Enregistrer au format PDF : un seul bulletin |
| Télécharger tous les bulletins | Bulletin | cassé | Ouvre l’aperçu groupé réellement imprimable | Voir la barre latérale |
| Signer numériquement | Bulletin | factice | Empreinte SHA-256 réelle (Web Crypto), signataire et titre obligatoires, série du candidat | Après signature, le nom apparaît sur le bulletin |
| SMS • Mail parents | Bulletin | factice | Valide téléphone et email ; ouvre `sms:` et `mailto:` ; hors-ligne : copie seulement. Plus de faux lien gouvernemental | En ligne : le système propose l’envoi. Hors-ligne : presse-papiers |
| Télécharger PDF A4 | Bulletin | factice | Même impression réelle que « Ce bulletin », sans délai ni toast trompeur | Un PDF du bulletin courant |
| Case « mention locale » | Modale SMS | cassé | La case existait dans l’état mais pas à l’écran ; elle ajuste le texte | Cocher / décocher met le message à jour |
| Fermer (toutes modales) | Modales | OK | Inchangé | Ferme sans enregistrer |
| Filtres Tous / Admis / Rattrapage | Aperçu groupé | cassé | Filtre admis corrigé ; impression du sous-ensemble | « Admis uniquement » puis télécharger |
| Télécharger tous les bulletins | Aperçu groupé | cassé | `print` sur les feuilles A4, plus sur la fenêtre fixe | Plusieurs pages, une par bulletin |
| Rétablir les valeurs | Paramètres | OK | Inchangé (demande confirmation) | Logos et textes ministériels par défaut |
| Prévisualiser sur le bulletin | Paramètres | OK | Inchangé | Ouvre la vue bulletin |
| Onglets Charte / Archives | Paramètres | OK | Inchangé | Change de panneau |
| Importer logo / sceau, appliquer URL | Paramètres | OK | Refuse autre chose qu’une image http(s) ou data:image, taille ≤ 1,5 Mo | Une URL `javascript:` est refusée |
| Supprimer le sceau | Paramètres | OK | Inchangé | L’emplacement redevient vide |
| Préréglages Togo / Côte d’Ivoire | Paramètres | OK | Inchangé | L’en-tête du bulletin change |
| Ouvrir le compte établissement | Paramètres | OK | Inchangé | Ouvre la connexion |
| Enregistrer les paramètres | Paramètres | OK | Inchangé | Rechargement : textes conservés |
| Archiver la session / ajouter une session | Archives | OK | Inchangé | La session apparaît dans l’historique local |
| Imprimer le bilan | Archives | OK | N’imprime plus l’en-tête de réglages | PDF du comparatif |
| Voir / supprimer une archive | Archives | OK | Inchangé | Détail ou retrait |
| Courbes taux / moyenne | Archives | OK | Inchangé | Le graphique change de métrique |
| Créer un compte | Auth | OK | Mot de passe obligatoire (≥ 6), email contrôlé, plus de mot de passe silencieux `password123` | Créer un établissement puis se reconnecter |
| Se connecter | Auth | cassé | Le mot de passe est maintenant comparé ; email ou nom exact | `direction@lycee-tokoin.tg` / `password123` |
| Bascule rapide d’établissement | Auth | OK | Conservée : bascule locale des comptes déjà présents sur l’appareil, sans ressaisir le mot de passe | Cliquer un établissement de la liste |
| Onglets créer / se connecter, Fermer | Auth | OK | Inchangé | Change d’écran ou ferme |
| Ctrl+P | Global | cassé | Bulletin courant, tous les bulletins si l’aperçu est ouvert, émargement sur la liste, PV sur le registre | Selon la vue active |

## Sécurité (contrôle de cette branche)

- Aucun secret ajouté dans le front. `GEMINI_API_KEY` et `APP_URL` restent documentés dans `.env.example` et ne sont pas lus par l’écran.
- Pas de `dangerouslySetInnerHTML`.
- Notes bornées à 0–20. Logo/sceau : schéma d’URL limité. CSV : cellules neutralisées contre l’injection de formule.
- `npm audit` : 0 vulnérabilité connue sur l’arbre installé avec `npm install --legacy-peer-deps` (conflit de pair `esbuild` déclaré en `^0.25.0` alors que Vite 8 en veut `^0.27` ou `^0.28` ; pas de fichier de verrouillage versionné, donc `npm ci` est impossible).
