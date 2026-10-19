-- Profil de l'établissement : adresse postale, devise propre et date de création du compte.
-- cree_le reste NULL pour les établissements créés avant cette migration : l'interface
-- affiche alors « non renseignée » plutôt qu'une date reconstituée.
ALTER TABLE etablissement ADD COLUMN adresse VARCHAR(240);
ALTER TABLE etablissement ADD COLUMN devise VARCHAR(160);
ALTER TABLE etablissement ADD COLUMN cree_le TIMESTAMP;
