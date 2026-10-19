-- Le titulaire qui vise le bulletin est l'enseignant affecté à la classe de l'élève
-- (classe.titulaire_id → professeur, V1) : plus de nom de titulaire saisi globalement pour
-- l'établissement. De même, le signataire officiel (proviseur / directeur) est le responsable
-- porté par la fiche de l'établissement (etablissement.nom_responsable) ; seul son titre
-- (« Le Proviseur », « Le Directeur ») reste un paramètre d'affichage du bulletin.
ALTER TABLE parametres_bulletin DROP COLUMN titre_titulaire;
ALTER TABLE parametres_bulletin DROP COLUMN nom_titulaire;
ALTER TABLE parametres_bulletin DROP COLUMN nom_signataire_jury;
