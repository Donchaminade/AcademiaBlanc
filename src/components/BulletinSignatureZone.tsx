import React from 'react';

interface BulletinSignatureZoneProps {
  /** Cachet téléversé (carte du proviseur). Absent = rien n'est dessiné. */
  stampUrl?: string;
  /** Signature manuscrite téléversée. Absent = rien n'est dessiné. */
  signatureUrl?: string;
  stampAlt?: string;
  signatureAlt?: string;
  /** Hauteur de la zone à l'écran (identique avec ou sans image, pour l'apposition physique). */
  className?: string;
}

function present(value?: string): value is string {
  return Boolean(value && value.trim() !== '');
}

/**
 * Zone centrale d'une carte de signature du bulletin. Sans image téléversée, elle reste
 * strictement vide : l'espace blanc est conservé pour le cachet humide et la signature à la main.
 */
export const BulletinSignatureZone: React.FC<BulletinSignatureZoneProps> = ({
  stampUrl,
  signatureUrl,
  stampAlt = 'Cachet de l’établissement',
  signatureAlt = 'Signature',
  className = 'h-12',
}) => {
  const hasStamp = present(stampUrl);
  const hasSignature = present(signatureUrl);

  return (
    <div className={`bulletin-signature-zone w-full ${className} my-0 flex items-center justify-center gap-2`}>
      {hasStamp && (
        <img src={stampUrl} alt={stampAlt} className="bulletin-signature-stamp-img h-full w-auto max-w-[45%] object-contain" />
      )}
      {hasSignature && (
        <img
          src={signatureUrl}
          alt={signatureAlt}
          className={`bulletin-signature-sign-img h-full w-auto object-contain ${hasStamp ? 'max-w-[50%]' : 'max-w-[80%]'}`}
        />
      )}
    </div>
  );
};
