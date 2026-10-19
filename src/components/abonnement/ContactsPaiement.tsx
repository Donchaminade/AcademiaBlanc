import React from 'react';
import { lienTel, lienWhatsApp, messageWhatsApp } from '../../utils/abonnement';
import type { Forfait } from '../../utils/abonnement';

interface ContactsPaiementProps {
  telWhatsapp: string;
  telAppel: string;
  beneficiaire?: string;
  instructions?: string;
  /** Pré-remplissage du message WhatsApp. */
  nomEtablissement: string;
  forfait: Forfait | null | undefined;
  montant: number;
  devise?: string;
  /** Disposition compacte (bandeau) : boutons seuls, sans bloc d'instructions. */
  compact?: boolean;
  /** Boutons blancs sur fond rouge (bandeau expiré). */
  surFondSombre?: boolean;
}

/**
 * Boutons « WhatsApp » (`https://wa.me/<numéro>?text=…` pré-rempli avec le nom de l'établissement, le forfait
 * et le montant) et « Appeler » (`tel:`), plus les instructions de paiement mobile money saisies par le super
 * admin. Sans numéro renseigné, un texte explicite remplace les boutons : rien n'est inventé.
 */
export const ContactsPaiement: React.FC<ContactsPaiementProps> = ({
  telWhatsapp,
  telAppel,
  beneficiaire,
  instructions,
  nomEtablissement,
  forfait,
  montant,
  devise = 'FCFA',
  compact = false,
  surFondSombre = false,
}) => {
  const wa = lienWhatsApp(telWhatsapp, messageWhatsApp({ nomEtablissement, forfait, montant, devise }));
  const tel = lienTel(telAppel || telWhatsapp);
  const aucunContact = !wa && !tel;

  const classeWa = surFondSombre
    ? 'bg-white text-[#0b7a3b] hover:bg-emerald-50 border-white'
    : 'bg-[#25D366] text-white hover:bg-[#1ebe5b] border-transparent';
  const classeTel = surFondSombre
    ? 'bg-white/15 text-white hover:bg-white/25 border-white/40'
    : 'bg-white text-[#00236f] hover:bg-[#f2f3ff] border-[#dce1ff]';
  const taille = compact ? 'px-3 py-1.5 text-[12px]' : 'px-4 py-2.5 text-[13px]';

  return (
    <div className={compact ? 'flex flex-wrap items-center gap-2' : 'space-y-3'} data-testid="contacts-paiement">
      {!compact && (beneficiaire || instructions) && (
        <div className="rounded-lg border border-[#eaedff] bg-[#f2f3ff] p-3 text-[12.5px] text-[#131b2e] space-y-1.5">
          {beneficiaire && (
            <p>
              <span className="font-bold text-[#00236f]">Bénéficiaire mobile money : </span>
              <span className="font-semibold">{beneficiaire}</span>
            </p>
          )}
          {instructions && <p className="whitespace-pre-line text-[#444651]">{instructions}</p>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-2 rounded-lg border font-bold shadow-xs transition-colors ${classeWa} ${taille}`}
            data-testid="bouton-whatsapp"
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">chat</span>
            <span>WhatsApp</span>
          </a>
        )}
        {tel && (
          <a
            href={tel}
            className={`inline-flex items-center gap-2 rounded-lg border font-bold transition-colors ${classeTel} ${taille}`}
            data-testid="bouton-appeler"
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">call</span>
            <span>Appeler{telAppel ? ` ${telAppel}` : ''}</span>
          </a>
        )}
        {aucunContact && (
          <p className={`text-[12px] ${surFondSombre ? 'text-white/90' : 'text-[#444651]'}`}>
            Numéros de contact non encore renseignés par la plateforme.
          </p>
        )}
      </div>
    </div>
  );
};
