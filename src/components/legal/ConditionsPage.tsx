import React from 'react';
import { PageLegale } from './PageLegale';
import { CHAPEAU_CONDITIONS, DESCRIPTION_CONDITIONS, SECTIONS_CONDITIONS, TITRE_CONDITIONS } from '../../legal/textes/conditions';

/** Page publique `/conditions` (charte d’usage). */
export const ConditionsPage: React.FC<{ onRetour: () => void }> = ({ onRetour }) => (
  <PageLegale
    route="conditions"
    titre={TITRE_CONDITIONS}
    chapeau={CHAPEAU_CONDITIONS}
    description={DESCRIPTION_CONDITIONS}
    sections={SECTIONS_CONDITIONS}
    onRetour={onRetour}
  />
);

export default ConditionsPage;
