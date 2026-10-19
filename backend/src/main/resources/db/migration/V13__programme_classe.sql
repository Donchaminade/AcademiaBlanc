-- Programme de classe : l'affectation d'une matière à une classe est portée par la table
-- coefficient. Une ligne (matiere_id, classe_id) signifie « la matière fait partie du programme
-- de la classe, avec ce coefficient ». Les lignes sans classe (classe_id NULL) restent des
-- coefficients globaux, utilisés seulement par les classes qui n'ont encore aucun programme.
--
-- Une seule ligne par couple matière × classe : les doublons hérités sont réduits à la plus ancienne.
DELETE FROM coefficient c
WHERE c.classe_id IS NOT NULL
  AND c.id <> (SELECT MIN(c2.id) FROM coefficient c2 WHERE c2.matiere_id = c.matiere_id AND c2.classe_id = c.classe_id);

CREATE UNIQUE INDEX uk_coefficient_matiere_classe ON coefficient (matiere_id, classe_id);
CREATE INDEX idx_coefficient_classe ON coefficient (classe_id);
