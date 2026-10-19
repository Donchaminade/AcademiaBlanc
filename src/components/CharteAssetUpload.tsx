import React, { useRef, useState } from 'react';
import { CHARTE_IMAGE_ACCEPT, downscaleCharteImage, octetsDataUrl, poidsLisible } from '../utils/imageAssets';

interface CharteAssetUploadProps {
  label: string;
  hint: string;
  icon: string;
  value?: string;
  /** Rendu de l'aperçu : rond pour un cachet, large pour une signature, carré pour un logo. */
  shape?: 'round' | 'wide' | 'square';
  /** Texte affiché sous l'aperçu quand l'emplacement est vide. */
  emptyLabel?: React.ReactNode;
  /**
   * Ligne d'état sous le libellé (session connectée) : « Enregistré sur le serveur · mis à jour le … ».
   * Absente hors connexion.
   */
  status?: React.ReactNode;
  /** Libellé du bouton de retrait (« Retirer » par défaut). */
  removeLabel?: string;
  /** Lecture seule : aperçu sans boutons. */
  readOnly?: boolean;
  onChange: (dataUrl: string) => unknown;
  onError: (message: string) => void;
}

/**
 * Téléversement d'une image de charte (logo, cachet ou signature) : réduction et compression côté
 * navigateur (≤ 512 px, ≈ 300 Ko), aperçu, poids, bouton « Retirer ». L'image part ensuite au serveur
 * en data URL et vit dans la base de l'établissement ; sans image, l'emplacement reste vide.
 */
export const CharteAssetUpload: React.FC<CharteAssetUploadProps> = ({
  label,
  hint,
  icon,
  value,
  shape = 'wide',
  emptyLabel,
  status,
  removeLabel = 'Retirer',
  readOnly = false,
  onChange,
  onError,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'traitement' | 'enregistrement' | null>(null);
  const hasImage = Boolean(value && value.trim() !== '');
  const poids = hasImage && value!.startsWith('data:') ? poidsLisible(octetsDataUrl(value!)) : null;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy('traitement');
    try {
      const dataUrl = await downscaleCharteImage(file);
      setBusy('enregistrement');
      await onChange(dataUrl);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Image refusée.');
    } finally {
      setBusy(null);
    }
  };

  const previewBox = shape === 'round'
    ? 'w-20 h-20 rounded-full'
    : shape === 'square'
      ? 'w-24 h-24 rounded-lg'
      : 'w-32 h-14 rounded-md';

  return (
    <div className="flex items-start gap-3 py-3 border-b border-[#eaedff] last:border-b-0" data-testid={`charte-${shape}`}>
      <div
        className={`${previewBox} shrink-0 bg-white border ${
          hasImage ? 'border-[#eaedff] shadow-xs' : 'border-dashed border-[#a0a5b5]'
        } flex items-center justify-center overflow-hidden p-1.5`}
      >
        {hasImage ? (
          <img src={value} alt={label} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-[8.5px] text-[#9ca3af] uppercase font-bold text-center leading-tight px-1">
            {emptyLabel ?? (<>Vide<br />(à la main)</>)}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-base text-[#0051d5]">{icon}</span>
          <span className="text-[12px] font-bold text-[#00236f]">{label}</span>
        </div>
        <p className="text-[10.5px] text-[#444651] leading-snug mt-0.5">{hint}</p>
        {status && (
          <p className="text-[10.5px] font-semibold text-[#166534] leading-snug mt-1 flex items-center gap-1" data-testid="charte-statut">
            <span className="material-symbols-outlined text-[13px]">cloud_done</span>
            <span>{status}{poids ? ` · ${poids}` : ''}</span>
          </p>
        )}

        {!readOnly && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={CHARTE_IMAGE_ACCEPT}
              onChange={(e) => void handleFile(e)}
              className="hidden"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#0051d5] text-white text-[11px] font-bold hover:bg-[#003ea8] transition-all shadow-xs disabled:opacity-60"
              >
                <span className={`material-symbols-outlined text-sm ${busy ? 'animate-spin' : ''}`}>
                  {busy ? 'progress_activity' : 'upload_file'}
                </span>
                <span>
                  {busy === 'traitement'
                    ? 'Réduction de l’image…'
                    : busy === 'enregistrement'
                      ? 'Enregistrement…'
                      : hasImage ? 'Remplacer (PNG / JPG / WebP / SVG)' : 'Téléverser (PNG / JPG / WebP / SVG)'}
                </span>
              </button>
              {hasImage && (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void onChange('')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-900 text-[11px] font-bold border border-amber-200 transition-colors disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-sm text-amber-700">ink_eraser</span>
                  <span>{removeLabel}</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
