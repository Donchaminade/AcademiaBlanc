-- Logo de l'établissement conservé en base, avec le cachet et les signatures (V9) : l'image encodée en
-- data URL (PNG / JPEG / WebP / SVG, réduite par le navigateur avant envoi, 1 Mo maximum côté serveur)
-- vit dans la ligne de l'établissement, jamais sur le disque du serveur (système de fichiers éphémère).
-- Le logo quitte `parametres_bulletin` (V16) : c'est une donnée d'identité de l'établissement, relue à
-- chaque connexion avec sa fiche, pas un réglage d'affichage du bulletin.
ALTER TABLE etablissement ADD COLUMN logo_url TEXT;
-- Dernière modification du logo, du cachet ou des signatures (affichée dans l'écran Paramètres).
ALTER TABLE etablissement ADD COLUMN charte_modifiee_le TIMESTAMP;

UPDATE etablissement e
SET logo_url = (SELECT p.logo_url FROM parametres_bulletin p WHERE p.etablissement_id = e.id),
    charte_modifiee_le = (SELECT p.modifie_le FROM parametres_bulletin p WHERE p.etablissement_id = e.id AND p.logo_url IS NOT NULL);

ALTER TABLE parametres_bulletin DROP COLUMN logo_url;

-- L'ancien client envoyait le logo de démonstration (image hébergée chez Google) comme sceau officiel
-- de tout établissement qui enregistrait ses paramètres : aucune valeur de démonstration ne doit
-- figurer dans la base d'un vrai compte. NULL = sceau jamais renseigné (emplacement laissé vide).
UPDATE parametres_bulletin
SET sceau_officiel_url = NULL
WHERE sceau_officiel_url LIKE 'https://lh3.googleusercontent.com/%';
