-- Appréciation du professeur saisie à la main pour une note (texte libre, 60 caractères au plus).
-- NULL = appréciation automatique calculée sur la note de la matière (calc/Appreciation.java).
ALTER TABLE note ADD COLUMN appreciation VARCHAR(60);
