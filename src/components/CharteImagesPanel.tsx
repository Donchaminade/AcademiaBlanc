import React from 'react';
import { AppSettings } from '../types';
import { IMAGES_CHARTE } from '../api/charte';
import { CharteAssetUpload } from './CharteAssetUpload';

export type ImageCharte = (typeof IMAGES_CHARTE)[number];

interface CharteImagesPanelProps {
  settings: AppSettings;
  /** Session connectée : les images vivent dans la base de l'établissement et sont relues à chaque connexion. */
  usingApi: boolean;
  /** Dernière modification du logo, du cachet ou des signatures sur le serveur (ISO 8601). */
  modifieLe?: string | null;
  /** Lecture seule (droit PARAMETRES : MODIFIER absent) : aperçus sans boutons. */
  readOnly?: boolean;
  /** Enregistre une image (data URL) ou la retire (chaîne vide) ; résout `false` si le serveur a refusé. */
  onChange: (champ: ImageCharte, dataUrl: string) => void | boolean | Promise<boolean>;
  onError: (message: string) => void;
  /** Hors connexion uniquement : réactive le sceau de démonstration du logiciel. */
  onRetablirSceauDemo?: () => void;
}

const dateCourte = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/**
 * Point unique de gestion des images de l'établissement : logo, sceau officiel du bulletin, cachet et
 * signatures. Utilisé par la page « Profil de l'établissement » (carte Charte graphique) et par l'onglet
 * Paramètres, qui partagent ainsi le même chemin d'enregistrement (`PUT /api/etablissement/charte`).
 */
export const CharteImagesPanel: React.FC<CharteImagesPanelProps> = ({
  settings,
  usingApi,
  modifieLe,
  readOnly = false,
  onChange,
  onError,
  onRetablirSceauDemo,
}) => {
  const date = dateCourte(modifieLe);
  const statut = (present: boolean | undefined, avecDate = true): React.ReactNode => {
    if (!usingApi || !present) return undefined;
    return avecDate && date
      ? `Enregistré sur le serveur de l’établissement · mis à jour le ${date}`
      : 'Enregistré sur le serveur de l’établissement';
  };
  const sans = (value: string | undefined) => !value || value.trim() === '';

  return (
    <div className="space-y-1" data-testid="charte-images">
      {!usingApi && (
        <p className="text-[10.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 leading-snug">
          <span className="font-bold uppercase tracking-wider">Démonstration</span> — images conservées dans ce navigateur
          seulement. Connectez l’établissement pour les enregistrer dans sa base et les retrouver depuis tout poste.
        </p>
      )}

      <CharteAssetUpload
        label="Logo de l’établissement"
        hint="Affiché dans la barre latérale et sur la page Profil. PNG détouré ou JPG ; réduit à 512 px (≈ 300 Ko) avant l’envoi."
        icon="image"
        shape="square"
        value={settings.logoUrl}
        emptyLabel={<>Aucun logo<br />(initiales affichées)</>}
        status={statut(!sans(settings.logoUrl))}
        readOnly={readOnly}
        onChange={(dataUrl) => onChange('logoUrl', dataUrl)}
        onError={onError}
      />

      <CharteAssetUpload
        label="Sceau officiel du jury / DEXCO"
        hint="Imprimé au centre de l’en-tête du bulletin et en filigrane. Vide : l’emplacement est laissé libre pour un tampon manuel à l’encre."
        icon="verified"
        shape="round"
        value={settings.sealUrl}
        emptyLabel={<>Zone vierge<br />(tampon manuel)</>}
        status={statut(!sans(settings.sealUrl), false)}
        removeLabel="Ne rien mettre (tampon manuel)"
        readOnly={readOnly}
        onChange={(dataUrl) => onChange('sealUrl', dataUrl)}
        onError={onError}
      />
      {!usingApi && !readOnly && sans(settings.sealUrl) && onRetablirSceauDemo && (
        <div className="pb-3 border-b border-[#eaedff]">
          <button
            type="button"
            onClick={onRetablirSceauDemo}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#eaedff] hover:bg-[#dce1ff] text-[#00236f] text-[11px] font-bold border border-[#dce1ff] transition-colors"
          >
            <span className="material-symbols-outlined text-sm text-[#0051d5]">verified</span>
            <span>Rétablir le sceau de démonstration</span>
          </button>
        </div>
      )}

      <CharteAssetUpload
        label="Sceau / cachet de l’établissement"
        hint="Cachet rond ou rectangulaire affiché dans la carte du proviseur, idéalement PNG détouré (fond transparent)."
        icon="approval"
        shape="round"
        value={settings.sceauUrl}
        status={statut(!sans(settings.sceauUrl))}
        readOnly={readOnly}
        onChange={(dataUrl) => onChange('sceauUrl', dataUrl)}
        onError={onError}
      />
      <CharteAssetUpload
        label={`Signature du ${(settings.jurySignerTitle || 'Proviseur').replace(/^le\s+/i, '')}`}
        hint="Signature manuscrite scannée, affichée à côté du cachet."
        icon="draw"
        value={settings.signatureProviseurUrl}
        status={statut(!sans(settings.signatureProviseurUrl))}
        readOnly={readOnly}
        onChange={(dataUrl) => onChange('signatureProviseurUrl', dataUrl)}
        onError={onError}
      />
      <CharteAssetUpload
        label="Signature du Titulaire"
        hint="Optionnelle : signature scannée du titulaire de la classe (le nom du titulaire vient de la classe de chaque élève)."
        icon="draw"
        value={settings.signatureTitulaireUrl}
        status={statut(!sans(settings.signatureTitulaireUrl))}
        readOnly={readOnly}
        onChange={(dataUrl) => onChange('signatureTitulaireUrl', dataUrl)}
        onError={onError}
      />
    </div>
  );
};
