import React, { useEffect, useState } from 'react';

interface LogoEtablissementProps {
  /** Logo enregistré (data URL ou URL) ; vide = aucun logo. */
  src?: string | null;
  /** Nom de l'établissement : ses initiales remplacent le logo absent ou illisible. */
  nom: string;
  className?: string;
  /** Taille du texte des initiales (classe Tailwind). */
  initialesClassName?: string;
  alt?: string;
}

export const initialesEtablissement = (nom: string): string =>
  nom
    .split(/\s+/)
    .filter((part) => part && !/^(de|du|des|la|le|les|d'|l')$/i.test(part))
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '?';

/**
 * Logo de l'établissement avec repli sur ses initiales : aucune image de démonstration n'est jamais
 * affichée. Si l'image ne se charge pas (ancienne URL distante disparue), les initiales prennent le relais.
 */
export const LogoEtablissement: React.FC<LogoEtablissementProps> = ({
  src,
  nom,
  className = 'h-10 w-10',
  initialesClassName = 'text-[13px]',
  alt,
}) => {
  const [illisible, setIllisible] = useState(false);
  useEffect(() => setIllisible(false), [src]);
  const image = src && src.trim() !== '' && !illisible ? src : null;

  if (image) {
    return (
      <img
        src={image}
        alt={alt ?? `Logo de ${nom}`}
        onError={() => setIllisible(true)}
        className={`${className} object-contain`}
        data-testid="logo-etablissement"
      />
    );
  }
  return (
    <span
      aria-label={alt ?? `Initiales de ${nom}`}
      title={nom}
      data-testid="logo-initiales"
      className={`${className} ${initialesClassName} rounded-md bg-[#00236f] text-white font-bold tracking-tight inline-flex items-center justify-center select-none`}
    >
      {initialesEtablissement(nom)}
    </span>
  );
};
