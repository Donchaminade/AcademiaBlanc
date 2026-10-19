-- Le titre du chef d'établissement imprimé sur le bulletin et le PV se déduit désormais du niveau :
-- « Le Directeur » au collège (6e–3e), « Le Proviseur » au lycée (2nde–Tle), le type de la fiche de
-- l'établissement tranchant quand il est connu. `parametres_bulletin.titre_signataire_jury` devient
-- un remplacement manuel facultatif (féminisation, cas particuliers) : NULL = automatique.
-- Les valeurs « Le Proviseur » enregistrées jusqu'ici étaient la valeur par défaut du logiciel, pas
-- un choix : elles repassent à NULL, sinon les collèges déjà créés garderaient « Proviseur ».
UPDATE parametres_bulletin
SET titre_signataire_jury = NULL
WHERE titre_signataire_jury IS NOT NULL
  AND LOWER(TRIM(titre_signataire_jury)) IN ('le proviseur', 'proviseur');
