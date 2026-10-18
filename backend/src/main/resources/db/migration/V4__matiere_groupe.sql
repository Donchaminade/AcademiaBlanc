-- Groupe de matières (UE) : LT = Enseignements Littératures, SC = Enseignements Scientifiques.
-- Colonnes facultatives : une matière hors référentiel n'a pas de groupe.
ALTER TABLE matiere ADD COLUMN groupe_code VARCHAR(10);
ALTER TABLE matiere ADD COLUMN groupe_libelle VARCHAR(120);

CREATE INDEX idx_matiere_groupe ON matiere (etablissement_id, groupe_code);
