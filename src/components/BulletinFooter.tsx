import React from 'react';
import { bulletinFooterText } from '../utils/bulletinFooter';

interface BulletinFooterProps {
  /** Nom de l'établissement (`settings.institutionName`). */
  institutionName?: string | null;
  /** Devise propre à l'établissement (`settings.institutionMotto`, fiche du profil) ; facultative. */
  institutionMotto?: string | null;
}

/**
 * Dernier élément de la page A4 : fine ligne dorée puis « NOM DE L'ÉTABLISSEMENT • Devise »
 * en petite taille, aligné à gauche. Rien n'est rendu sans nom ni devise.
 */
export const BulletinFooter: React.FC<BulletinFooterProps> = ({ institutionName, institutionMotto }) => {
  const texte = bulletinFooterText(institutionName, institutionMotto);
  if (!texte) return null;
  return (
    <div className="bulletin-footer relative z-10 mt-3 pt-1.5 border-t border-or">
      <p className="bulletin-footer-text text-[9px] text-[#444651] leading-tight text-left">{texte}</p>
    </div>
  );
};
