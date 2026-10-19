import React from 'react';
import { ROUTE_PATHS, clicNavigationInterne, naviguerVersChemin } from '../../utils/router';
import type { LegalRoute } from '../../utils/router';

export const LIENS_LEGAUX: { route: LegalRoute; label: string }[] = [
  { route: 'cgu', label: 'Conditions générales d’utilisation' },
  { route: 'confidentialite', label: 'Politique de confidentialité' },
  { route: 'conditions', label: 'Conditions d’utilisation' },
];

interface LiensLegauxProps {
  /** `sombre` : texte clair sur fond foncé. */
  variant?: 'clair' | 'sombre';
  /** Ouvre les documents dans un nouvel onglet (formulaires : la saisie en cours n’est pas perdue). */
  nouvelOnglet?: boolean;
  /** Masque la mention « © année AcademiaBlanc » (quand le conteneur l’affiche déjà). */
  sansCopyright?: boolean;
  className?: string;
}

/**
 * Bloc discret des trois documents légaux + « © année AcademiaBlanc », réutilisé dans le pied de la
 * vitrine, sous les formulaires de connexion / inscription et sur la page `/admin`. Autonome : la
 * navigation interne passe par `naviguerVersChemin`, sans prop à faire descendre depuis l’application.
 */
export const LiensLegaux: React.FC<LiensLegauxProps> = ({ variant = 'clair', nouvelOnglet = false, sansCopyright = false, className = '' }) => {
  const lien = variant === 'sombre'
    ? 'text-white/80 hover:text-white underline-offset-2 hover:underline'
    : 'text-[#444651] hover:text-[#0051d5] underline-offset-2 hover:underline';
  const separateur = variant === 'sombre' ? 'text-white/40' : 'text-[#c3c6d4]';
  const copyright = variant === 'sombre' ? 'text-white/70' : 'text-[#757682]';

  return (
    <nav aria-label="Informations légales" className={`flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] ${className}`}>
      {LIENS_LEGAUX.map((item, index) => (
        <React.Fragment key={item.route}>
          {index > 0 && <span aria-hidden="true" className={separateur}>·</span>}
          <a
            href={ROUTE_PATHS[item.route]}
            target={nouvelOnglet ? '_blank' : undefined}
            rel={nouvelOnglet ? 'noopener noreferrer' : undefined}
            className={`font-semibold ${lien}`}
            onClick={(event) => {
              if (nouvelOnglet || !clicNavigationInterne(event)) return;
              event.preventDefault();
              naviguerVersChemin(ROUTE_PATHS[item.route]);
            }}
          >
            {item.label}
          </a>
        </React.Fragment>
      ))}
      {!sansCopyright && (
        <>
          <span aria-hidden="true" className={separateur}>·</span>
          <span className={copyright}>© {new Date().getFullYear()} AcademiaBlanc</span>
        </>
      )}
    </nav>
  );
};

export default LiensLegaux;
