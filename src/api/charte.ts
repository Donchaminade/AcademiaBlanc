import { apiGet, apiSend } from './client';
import { AppSettings } from '../types';

/** Cachet et signatures du bulletin, portés par l'établissement du jeton (GET/PUT /api/etablissement/charte). */
export interface CharteEtablissement {
  sceauUrl: string | null;
  signatureProviseurUrl: string | null;
  signatureTitulaireUrl: string | null;
}

export const CHARTE_FIELDS = ['sceauUrl', 'signatureProviseurUrl', 'signatureTitulaireUrl'] as const;
export type CharteField = (typeof CHARTE_FIELDS)[number];

export function loadCharte(): Promise<CharteEtablissement> {
  return apiGet<CharteEtablissement>('/api/etablissement/charte');
}

// Le PUT remplace les trois images d'un coup. Les écritures partent donc l'une
// après l'autre, et un instantané déjà remplacé n'est pas envoyé : sinon la
// réponse la plus lente réécrit `null` sur une image téléversée entre-temps.
let charteWrite: Promise<void> = Promise.resolve();
let charteWriteSeq = 0;

export function saveCharte(charte: Pick<AppSettings, CharteField>): Promise<CharteEtablissement> {
  const seq = ++charteWriteSeq;
  const body: CharteEtablissement = {
    sceauUrl: charte.sceauUrl || null,
    signatureProviseurUrl: charte.signatureProviseurUrl || null,
    signatureTitulaireUrl: charte.signatureTitulaireUrl || null,
  };
  const write = charteWrite.then(() => {
    if (seq !== charteWriteSeq) return body;
    return apiSend<CharteEtablissement>('/api/etablissement/charte', 'PUT', body);
  });
  charteWrite = write.then(() => undefined, () => undefined);
  return write;
}

/** Vrai si au moins une image de la charte diffère entre deux jeux de paramètres. */
export function charteChanged(before: AppSettings, after: AppSettings): boolean {
  return CHARTE_FIELDS.some((field) => (before[field] || '') !== (after[field] || ''));
}

/** Applique la charte reçue de l'API aux paramètres (null → emplacement vide). */
export function applyCharte(settings: AppSettings, charte: CharteEtablissement): AppSettings {
  return {
    ...settings,
    sceauUrl: charte.sceauUrl || '',
    signatureProviseurUrl: charte.signatureProviseurUrl || '',
    signatureTitulaireUrl: charte.signatureTitulaireUrl || '',
  };
}
