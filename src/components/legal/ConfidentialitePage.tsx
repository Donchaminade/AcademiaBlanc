import React from 'react';
import { PageLegale } from './PageLegale';
import {
  CHAPEAU_CONFIDENTIALITE,
  DESCRIPTION_CONFIDENTIALITE,
  SECTIONS_CONFIDENTIALITE,
  TITRE_CONFIDENTIALITE,
} from '../../legal/textes/confidentialite';

/** Page publique `/confidentialite`. */
export const ConfidentialitePage: React.FC<{ onRetour: () => void }> = ({ onRetour }) => (
  <PageLegale
    route="confidentialite"
    titre={TITRE_CONFIDENTIALITE}
    chapeau={CHAPEAU_CONFIDENTIALITE}
    description={DESCRIPTION_CONFIDENTIALITE}
    sections={SECTIONS_CONFIDENTIALITE}
    onRetour={onRetour}
  />
);

export default ConfidentialitePage;
