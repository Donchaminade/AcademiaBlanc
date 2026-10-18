-- Charte graphique du bulletin : cachet et signatures téléversés par l'établissement.
-- Valeurs : URL http(s) ou image encodée en data URL ; NULL = emplacement laissé vide
-- sur le bulletin pour apposition physique (cachet humide, signature manuscrite).
ALTER TABLE etablissement ADD COLUMN sceau_url TEXT;
ALTER TABLE etablissement ADD COLUMN signature_proviseur_url TEXT;
ALTER TABLE etablissement ADD COLUMN signature_titulaire_url TEXT;
