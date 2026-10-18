import React, { useRef, useState } from 'react';
import { downscaleCharteImage } from '../utils/imageAssets';

interface CharteAssetUploadProps {
  label: string;
  hint: string;
  icon: string;
  value?: string;
  /** Rendu de l'aperçu : rond pour un cachet, large pour une signature. */
  shape?: 'round' | 'wide';
  onChange: (dataUrl: string) => void;
  onError: (message: string) => void;
}

/**
 * Téléversement d'une image de charte (cachet ou signature) avec réduction côté navigateur,
 * aperçu et bouton « Retirer ». Sans image, l'emplacement du bulletin reste vide.
 */
export const CharteAssetUpload: React.FC<CharteAssetUploadProps> = ({
  label,
  hint,
  icon,
  value,
  shape = 'wide',
  onChange,
  onError,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const hasImage = Boolean(value && value.trim() !== '');

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      onChange(await downscaleCharteImage(file));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Image refusée.');
    } finally {
      setBusy(false);
    }
  };

  const previewBox = shape === 'round'
    ? 'w-20 h-20 rounded-full'
    : 'w-32 h-14 rounded-md';

  return (
    <div className="flex items-start gap-3 py-3 border-b border-[#eaedff] last:border-b-0">
      <div
        className={`${previewBox} shrink-0 bg-white border ${
          hasImage ? 'border-[#eaedff] shadow-xs' : 'border-dashed border-[#a0a5b5]'
        } flex items-center justify-center overflow-hidden p-1.5`}
      >
        {hasImage ? (
          <img src={value} alt={label} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-[8.5px] text-[#9ca3af] uppercase font-bold text-center leading-tight px-1">
            Vide
            <br />
            (à la main)
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-base text-[#0051d5]">{icon}</span>
          <span className="text-[12px] font-bold text-[#00236f]">{label}</span>
        </div>
        <p className="text-[10.5px] text-[#444651] leading-snug mt-0.5">{hint}</p>

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml"
          onChange={(e) => void handleFile(e)}
          className="hidden"
        />
        <div className="flex flex-wrap gap-1.5 mt-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#0051d5] text-white text-[11px] font-bold hover:bg-[#003ea8] transition-all shadow-xs disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-sm">upload_file</span>
            <span>{busy ? 'Traitement…' : hasImage ? 'Remplacer (PNG / JPG / SVG)' : 'Téléverser (PNG / JPG / SVG)'}</span>
          </button>
          {hasImage && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-900 text-[11px] font-bold border border-amber-200 transition-colors"
            >
              <span className="material-symbols-outlined text-sm text-amber-700">ink_eraser</span>
              <span>Retirer</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
