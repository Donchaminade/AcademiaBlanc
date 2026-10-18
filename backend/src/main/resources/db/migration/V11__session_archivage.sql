-- Date d'archivage d'une session d'examen (renseignée quand la session passe au statut ARCHIVEE / CLOTUREE).
ALTER TABLE session_examen ADD COLUMN archivee_le TIMESTAMP;
