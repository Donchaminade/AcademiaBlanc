/**
 * Offre commerciale publique affichée par la vitrine (section Tarifs et Contact).
 *
 * Source : `GET /api/public/offre`, sans jeton, publié par la gestion des abonnements. La vitrine
 * n'invente jamais un prix : tant que le serveur ne communique pas de montant (endpoint absent,
 * injoignable ou tarif à 0 non encore saisi par la plateforme), elle affiche « Tarif communiqué à
 * l'inscription » et renvoie vers le contact.
 */
export interface OffrePublique {
  /** Montant mensuel dans `devise`, `null` tant qu'il n'est pas communiqué. */
  tarifMensuel: number | null;
  /** Montant annuel dans `devise`, `null` tant qu'il n'est pas communiqué. */
  tarifAnnuel: number | null;
  devise: string;
  /** Numéro WhatsApp tel que saisi par la plateforme, `null` si absent. */
  telWhatsapp: string | null;
  /** Numéro d'appel tel que saisi par la plateforme, `null` si absent. */
  telAppel: string | null;
  dureeEssaiJours: number;
}

/** Durée d'essai annoncée tant que l'offre publique n'a pas répondu. */
export const DUREE_ESSAI_DEFAUT_JOURS = 14;
export const DEVISE_DEFAUT = 'FCFA';

/** Offre « muette » : aucun prix ni numéro, essai par défaut. Utilisée avant la réponse et en repli. */
export const OFFRE_INCONNUE: OffrePublique = {
  tarifMensuel: null,
  tarifAnnuel: null,
  devise: DEVISE_DEFAUT,
  telWhatsapp: null,
  telAppel: null,
  dureeEssaiJours: DUREE_ESSAI_DEFAUT_JOURS,
};

function montant(valeur: unknown): number | null {
  const n = typeof valeur === 'string' ? Number(valeur.replace(/\s/g, '')) : valeur;
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

function texte(valeur: unknown): string | null {
  if (typeof valeur !== 'string') return null;
  const t = valeur.trim();
  return t.length > 0 ? t : null;
}

function premier<T>(source: Record<string, unknown>, cles: string[], lire: (v: unknown) => T | null): T | null {
  for (const cle of cles) {
    const v = lire(source[cle]);
    if (v !== null) return v;
  }
  return null;
}

/**
 * Interprète la réponse de `GET /api/public/offre`. Tolère quelques variantes de nommage et ignore
 * les montants nuls ou négatifs (tarif « à confirmer »). Renvoie `null` si la réponse n'est pas un objet.
 */
export function parseOffrePublique(data: unknown): OffrePublique | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const source = data as Record<string, unknown>;
  const essai = montant(source.dureeEssaiJours ?? source.essaiJours ?? source.dureeEssai);
  return {
    tarifMensuel: premier(source, ['tarifMensuel', 'prixMensuel', 'mensuel'], montant),
    tarifAnnuel: premier(source, ['tarifAnnuel', 'prixAnnuel', 'annuel'], montant),
    devise: premier(source, ['devise', 'monnaie'], texte) ?? DEVISE_DEFAUT,
    telWhatsapp: premier(source, ['telWhatsapp', 'whatsapp', 'telephoneWhatsapp'], texte),
    telAppel: premier(source, ['telAppel', 'telephone', 'telephoneAppel'], texte),
    dureeEssaiJours: essai ?? DUREE_ESSAI_DEFAUT_JOURS,
  };
}

/** `15000` → « 15 000 FCFA » (séparateur de milliers insécable fin, comme en typographie française). */
export function formatMontant(valeur: number, devise: string): string {
  const entier = Math.round(Math.abs(valeur)).toString();
  const groupes = entier.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
  return `${valeur < 0 ? '-' : ''}${groupes}\u00a0${devise}`;
}

/**
 * Économie réalisée avec le forfait annuel par rapport à douze mensualités, ou `null` si l'un des
 * montants manque ou si l'annuel n'est pas plus avantageux.
 */
export function economieAnnuelle(offre: Pick<OffrePublique, 'tarifMensuel' | 'tarifAnnuel'>): number | null {
  if (offre.tarifMensuel === null || offre.tarifAnnuel === null) return null;
  const economie = offre.tarifMensuel * 12 - offre.tarifAnnuel;
  return economie > 0 ? economie : null;
}

/**
 * Chiffres internationaux d'un numéro saisi librement (« +228 90 00 00 00 », « 00228…», « 90000000 »).
 * Les numéros locaux à 8 chiffres sans indicatif sont renvoyés tels quels : `wa.me` exige un indicatif,
 * mais le lien `tel:` reste composable depuis le pays.
 */
export function chiffresNumero(numero: string): string {
  let chiffres = numero.replace(/[^\d+]/g, '');
  if (chiffres.startsWith('00')) chiffres = chiffres.slice(2);
  return chiffres.replace(/\+/g, '');
}

/** Lien WhatsApp `https://wa.me/<indicatif+numéro>`, `null` si le numéro est inexploitable. */
export function lienWhatsapp(numero: string | null, message?: string): string | null {
  if (!numero) return null;
  const chiffres = chiffresNumero(numero);
  if (chiffres.length < 8) return null;
  const base = `https://wa.me/${chiffres}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** Lien `tel:` composable, `null` si le numéro est inexploitable. */
export function lienAppel(numero: string | null): string | null {
  if (!numero) return null;
  const chiffres = chiffresNumero(numero);
  if (chiffres.length < 8) return null;
  const avecIndicatif = numero.trim().startsWith('+') || numero.trim().startsWith('00') || chiffres.length > 8;
  return `tel:${avecIndicatif ? '+' : ''}${chiffres}`;
}
