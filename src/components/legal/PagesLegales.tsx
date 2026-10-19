import React from 'react';
import type { LegalRoute } from '../../utils/router';
import { CguPage } from './CguPage';
import { ConfidentialitePage } from './ConfidentialitePage';
import { ConditionsPage } from './ConditionsPage';

/** Aiguillage des trois documents légaux ; chargé à la demande par l’application (import dynamique). */
export const PagesLegales: React.FC<{ route: LegalRoute; onRetour: () => void }> = ({ route, onRetour }) => {
  if (route === 'cgu') return <CguPage onRetour={onRetour} />;
  if (route === 'confidentialite') return <ConfidentialitePage onRetour={onRetour} />;
  return <ConditionsPage onRetour={onRetour} />;
};

export default PagesLegales;
