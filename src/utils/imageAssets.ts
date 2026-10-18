import { isSafeImageUrl } from './safeUrl';

/** Côté le plus grand d'une image de cachet / signature après réduction. */
export const CHARTE_IMAGE_MAX_PX = 600;
/** Longueur maximale de la data URL acceptée (identique à la limite de l'API). */
export const CHARTE_IMAGE_MAX_LENGTH = 1_500_000;

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml'];

export function isAcceptedCharteImage(file: File): boolean {
  return ACCEPTED_TYPES.includes(file.type);
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Lecture du fichier impossible.'));
    };
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image illisible.'));
    img.src = src;
  });
}

/**
 * Réduit une image PNG / JPG à `maxPx` sur son plus grand côté et renvoie une data URL.
 * La transparence des PNG est conservée (indispensable pour un cachet ou une signature détourés).
 * Un SVG est conservé tel quel : il est déjà léger et s'adapte à toute taille.
 */
export async function downscaleCharteImage(file: File, maxPx: number = CHARTE_IMAGE_MAX_PX): Promise<string> {
  if (!isAcceptedCharteImage(file)) {
    throw new Error('Format non pris en charge : choisissez un fichier PNG, JPG ou SVG.');
  }
  const original = await readAsDataUrl(file);

  if (file.type === 'image/svg+xml') {
    if (original.length > CHARTE_IMAGE_MAX_LENGTH) {
      throw new Error('Fichier SVG trop lourd (1 Mo maximum).');
    }
    if (!isSafeImageUrl(original)) throw new Error('Fichier SVG invalide.');
    return original;
  }

  const image = await loadImage(original);
  const isJpeg = file.type === 'image/jpeg';
  const sizes = [maxPx, Math.round(maxPx * 0.75), Math.round(maxPx * 0.5)];

  let result = '';
  for (const size of sizes) {
    result = renderToDataUrl(image, size, isJpeg ? 'image/jpeg' : 'image/png');
    if (result.length <= CHARTE_IMAGE_MAX_LENGTH) break;
  }
  if (result.length > CHARTE_IMAGE_MAX_LENGTH) {
    // Dernier recours pour les PNG très lourds : aplatir sur fond blanc en JPEG.
    result = renderToDataUrl(image, sizes[sizes.length - 1], 'image/jpeg');
  }
  if (result.length > CHARTE_IMAGE_MAX_LENGTH || !isSafeImageUrl(result)) {
    throw new Error('Image trop lourde même après réduction : utilisez un fichier plus simple.');
  }
  return result;
}

function renderToDataUrl(image: HTMLImageElement, maxPx: number, mime: 'image/png' | 'image/jpeg'): string {
  const ratio = Math.min(1, maxPx / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
  const width = Math.max(1, Math.round((image.naturalWidth || 1) * ratio));
  const height = Math.max(1, Math.round((image.naturalHeight || 1) * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Traitement de l’image impossible dans ce navigateur.');
  if (mime === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL(mime, 0.85);
}
