import React from 'react';
import { TITRE_CHEF_CENTRE, TITRE_PRESIDENT_JURY, ligneCentreExamen } from '../utils/sessionMode';
import { BulletinSignatureZone } from './BulletinSignatureZone';

/**
 * Blocs propres au relevé d'une session inter-établissements. Le relevé interne ne les utilise jamais :
 * il garde son sceau, son cachet, son titulaire et son pied de page.
 */

interface LigneCentreExamenProps {
  centreExamen: string;
  /** Variante resserrée de l'impression groupée. */
  compact?: boolean;
}

/** « CENTRE D'EXAMEN : LYCÉE … » sous l'en-tête république / ministère, à la place du sceau de l'établissement. */
export const LigneCentreExamen: React.FC<LigneCentreExamenProps> = ({ centreExamen, compact = false }) => {
  const ligne = ligneCentreExamen(centreExamen);
  if (!ligne) return null;
  return (
    <div
      className={`bulletin-centre-examen relative z-10 text-center ${compact ? 'py-1 mb-1.5' : 'py-1.5 mb-2'} border-y border-[#00236f]/40`}
      data-testid="bulletin-centre-examen"
    >
      <span className={`${compact ? 'text-[11.5px]' : 'text-[12.5px]'} font-bold uppercase tracking-[0.08em] text-[#00236f]`}>{ligne}</span>
    </div>
  );
};

interface SignaturesInterProps {
  /** Nom du responsable de l'établissement hôte (profil) : signe comme chef du centre. */
  chefCentre: string;
  compact?: boolean;
}

/**
 * Cartes « Le Président du jury » (nom laissé à compléter) et « Le Chef du centre » (responsable de
 * l'établissement hôte). Aucun cachet ni signature téléversés : les espaces restent blancs.
 */
export const SignaturesInter: React.FC<SignaturesInterProps> = ({ chefCentre, compact = false }) => {
  const titre = `${compact ? 'text-[10px]' : 'text-[11px]'} text-[#444651] uppercase tracking-wider font-bold block leading-tight`;
  const nom = `${compact ? 'text-[12px]' : 'text-[13px]'} font-semibold mt-0.5 block leading-tight`;
  const legende = `${compact ? 'text-[9px]' : 'text-[10px]'} text-[#444651] italic leading-tight`;
  const carte = `bulletin-signature-card flex flex-col items-center justify-between ${compact ? 'min-h-[46px] py-0.5' : 'min-h-[52px] py-1'} bg-[#f2f3ff]/50 px-2 rounded-xs border border-[#eaedff]`;
  return (
    <div
      className={`bulletin-signatures relative z-10 grid grid-cols-2 text-center mx-auto ${compact ? 'pt-0.5 gap-1.5 max-w-xl' : 'pt-1 gap-2 max-w-2xl'}`}
      data-testid="bulletin-signatures-inter"
    >
      <div className={carte}>
        <div>
          <span className={titre}>{TITRE_PRESIDENT_JURY}</span>
          <span className={`${nom} text-[#757682]`} title="Nom du président du jury à compléter à la main">
            Nom et prénoms : ……………………………
          </span>
        </div>
        <BulletinSignatureZone signatureAlt={`Signature — ${TITRE_PRESIDENT_JURY}`} className={compact ? 'h-11' : 'h-12'} />
        <span className={legende}>Signature du président du jury</span>
      </div>
      <div className={carte}>
        <div>
          <span className={titre}>{TITRE_CHEF_CENTRE}</span>
          <span className={`${nom} text-[#00236f] font-bold`} data-testid="bulletin-chef-centre">
            {chefCentre.trim() || '……………………………'}
          </span>
        </div>
        <BulletinSignatureZone signatureAlt={`Signature — ${TITRE_CHEF_CENTRE}`} className={compact ? 'h-11' : 'h-12'} />
        <span className={legende}>Signature du chef du centre</span>
      </div>
    </div>
  );
};
