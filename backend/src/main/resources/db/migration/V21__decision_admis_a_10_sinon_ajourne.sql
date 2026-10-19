-- Règle unique de décision : moyenne générale affichée ≥ 10/20 → ADMIS, sinon AJOURNÉ. La catégorie
-- intermédiaire « rattrapage » (8 à 9,99) disparaît : les bulletins déjà générés qui la portaient en
-- mention sont normalisés, comme les recalculera désormais GradeCalculator.
UPDATE bulletin SET mention = 'AJOURNÉ' WHERE mention = 'RATTRAPAGE';
