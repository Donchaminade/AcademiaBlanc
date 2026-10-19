import { isSafeImageUrl } from './safeUrl';

/** Côté le plus grand d'une image de charte (logo, cachet, signature) après réduction. */
export const CHARTE_IMAGE_MAX_PX = 512;
/** Poids maximal d'une image après compression côté navigateur (octets décodés) : 300 Ko. */
export const CHARTE_IMAGE_MAX_OCTETS = 300 * 1024;
/** Limite appliquée par le serveur (1 Mo décodé) : au-delà, `PUT /api/etablissement/charte` répond 413. */
export const CHARTE_IMAGE_MAX_OCTETS_SERVEUR = 1024 * 1024;
/** Poids maximal du fichier choisi avant tout traitement (au-delà, la lecture seule gèlerait le navigateur). */
export const CHARTE_FICHIER_MAX_OCTETS = 15 * 1024 * 1024;

export const CHARTE_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'] as const;
/** Valeur de l'attribut `accept` des champs de fichier. */
export const CHARTE_IMAGE_ACCEPT = CHARTE_IMAGE_TYPES.join(',');

export const MESSAGE_FORMAT_REFUSE = 'Format non pris en charge : choisissez un fichier PNG, JPG, WebP ou SVG.';

export function isAcceptedCharteImage(file: Pick<File, 'type' | 'name'>): boolean {
  if ((CHARTE_IMAGE_TYPES as readonly string[]).includes(file.type)) return true;
  // Certains systèmes n'indiquent aucun type MIME : on se fie alors à l'extension.
  return file.type === '' && /\.(png|jpe?g|webp|svg)$/i.test(file.name);
}

/** Poids en octets de l'image portée par une data URL base64 (3 octets pour 4 caractères, moins le bourrage). */
export function octetsDataUrl(dataUrl: string): number {
  const virgule = dataUrl.indexOf(',');
  if (virgule < 0) return 0;
  const base64 = dataUrl.slice(virgule + 1).replace(/\s+/g, '');
  const bourrage = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - bourrage);
}

/** Poids lisible (« 184 Ko », « 1,2 Mo »). */
export function poidsLisible(octets: number): string {
  if (octets >= 1024 * 1024) return `${(octets / (1024 * 1024)).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`;
  return `${Math.max(1, Math.round(octets / 1024))} Ko`;
}

/**
 * Tailles successives essayées pour tenir dans la limite : le côté demandé, puis des réductions
 * jusqu'à 128 px. Un logo de barre latérale ou de bulletin reste net à ces tailles.
 */
export function paliersDeTaille(maxPx: number): number[] {
  const paliers: number[] = [];
  for (let size = maxPx; size >= 128; size = Math.round(size * 0.75)) paliers.push(size);
  return paliers;
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
    img.onerror = () => reject(new Error('Image illisible : le fichier est peut-être corrompu.'));
    img.src = src;
  });
}

/** Dimensions de rendu : un SVG sans taille intrinsèque est rendu carré au côté demandé. */
function dimensions(image: HTMLImageElement, maxPx: number): { width: number; height: number } {
  const naturalWidth = image.naturalWidth || maxPx;
  const naturalHeight = image.naturalHeight || maxPx;
  const ratio = Math.min(1, maxPx / Math.max(naturalWidth, naturalHeight));
  return {
    width: Math.max(1, Math.round(naturalWidth * ratio)),
    height: Math.max(1, Math.round(naturalHeight * ratio)),
  };
}

/** Vrai si l'image comporte des pixels (partiellement) transparents : un cachet ou un logo détouré. */
function aDeLaTransparence(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  const { data } = ctx.getImageData(0, 0, width, height);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250) return true;
  }
  return false;
}

function renderToDataUrl(
  image: HTMLImageElement,
  maxPx: number,
  mime: 'image/png' | 'image/jpeg',
  qualite = 0.85,
): { dataUrl: string; transparence: boolean } {
  const { width, height } = dimensions(image, maxPx);
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
  const transparence = mime === 'image/png' && aDeLaTransparence(ctx, width, height);
  return { dataUrl: canvas.toDataURL(mime, qualite), transparence };
}

/**
 * Prépare une image de charte (logo, cachet, signature) pour l'enregistrement en base : réduite à `maxPx`
 * sur son plus grand côté et compressée sous `maxOctets`, renvoyée en data URL PNG (transparence conservée)
 * ou JPEG (image opaque, plus légère). Un SVG ou un WebP est rastérisé en PNG : aucun script ni référence
 * externe ne peut ainsi atteindre la base ou les bulletins imprimés, et le poids devient prévisible.
 */
export async function downscaleCharteImage(
  file: File,
  maxPx: number = CHARTE_IMAGE_MAX_PX,
  maxOctets: number = CHARTE_IMAGE_MAX_OCTETS,
): Promise<string> {
  if (!isAcceptedCharteImage(file)) throw new Error(MESSAGE_FORMAT_REFUSE);
  if (file.size > CHARTE_FICHIER_MAX_OCTETS) {
    throw new Error(`Fichier trop lourd (${poidsLisible(file.size)}) : choisissez une image de moins de 15 Mo.`);
  }
  const image = await loadImage(await readAsDataUrl(file));
  const paliers = paliersDeTaille(maxPx);

  // 1) PNG : seul format qui conserve la transparence d'un logo ou d'un cachet détourés.
  for (const size of paliers) {
    const png = renderToDataUrl(image, size, 'image/png');
    if (octetsDataUrl(png.dataUrl) <= maxOctets) return verifier(png.dataUrl, maxOctets);
    // Une image opaque n'a rien à gagner à rester en PNG : le JPEG sera bien plus léger.
    if (!png.transparence) break;
  }

  // 2) JPEG sur fond blanc, qualité puis taille décroissantes (photo, logo scanné, image opaque).
  for (const qualite of [0.85, 0.75, 0.65]) {
    for (const size of paliers) {
      const { dataUrl } = renderToDataUrl(image, size, 'image/jpeg', qualite);
      if (octetsDataUrl(dataUrl) <= maxOctets) return verifier(dataUrl, maxOctets);
    }
  }
  throw new Error('Image trop lourde même après réduction : utilisez un fichier plus simple.');
}

function verifier(dataUrl: string, maxOctets: number): string {
  if (octetsDataUrl(dataUrl) > maxOctets || !isSafeImageUrl(dataUrl)) {
    throw new Error('Image trop lourde même après réduction : utilisez un fichier plus simple.');
  }
  return dataUrl;
}
