-- Les moyennes du bulletin sont les moyennes réelles Σ(note × coef) / Σ coef : aucun point de
-- repêchage n'est plus ajouté par le jury. La colonne qui portait ce bonus disparaît ; la délibération
-- ne conserve que l'observation du conseil et la signature électronique du bulletin.
ALTER TABLE deliberation_jury DROP COLUMN bonus_jury;
