import React from 'react';
import { PageLegale } from './PageLegale';
import { CHAPEAU_CGU, DESCRIPTION_CGU, SECTIONS_CGU, TITRE_CGU } from '../../legal/textes/cgu';

/** Page publique `/cgu`. */
export const CguPage: React.FC<{ onRetour: () => void }> = ({ onRetour }) => (
  <PageLegale
    route="cgu"
    titre={TITRE_CGU}
    chapeau={CHAPEAU_CGU}
    description={DESCRIPTION_CGU}
    sections={SECTIONS_CGU}
    onRetour={onRetour}
  />
);

export default CguPage;
