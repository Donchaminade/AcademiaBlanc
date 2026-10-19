-- Mode d'une session d'examen blanc :
--   INTERNE              : les candidats sont les élèves de l'établissement ; relevés avec logo,
--                          cachet et pied de page de l'établissement (comportement historique) ;
--   INTER_ETABLISSEMENTS : plusieurs établissements organisent l'examen ensemble ; l'établissement
--                          qui crée la session est le centre d'examen (etablissement.nom), les
--                          candidats viennent d'établissements d'origine divers (eleve.etablissement_origine,
--                          colonne de V1) et les relevés ne portent ni logo ni cachet d'établissement.
ALTER TABLE session_examen ADD COLUMN mode VARCHAR(30) NOT NULL DEFAULT 'INTERNE';
