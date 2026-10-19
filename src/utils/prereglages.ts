import type { AppSettings } from '../types';

/** Préréglage national tel que lu par un établissement (`GET /api/prereglages-nationaux`) ou la vitrine. */
export interface PrereglageNational {
  id: number;
  /** Code ISO 3166-1 alpha-2 (TG, CI…). */
  code: string;
  nomPays: string;
  republique: string;
  devise: string;
  ministere: string;
  sigleMinistere: string;
  autoriteRegionale: string | null;
  piedDePage: string | null;
  parDefaut: boolean;
}

/** En-tête officiel du bulletin porté par l'établissement (`enTete` de `GET /api/etablissement`). */
export interface EnTeteEtablissement {
  prereglageNationalId: number | null;
  republique: string | null;
  deviseNationale: string | null;
  ministere: string | null;
  sigleMinistere: string | null;
  autoriteRegionale: string | null;
  piedDePage: string | null;
}

/** Drapeau en émoji à partir du code ISO2 (indicateurs régionaux) ; chaîne vide si le code est invalide. */
export function drapeau(code: string): string {
  const iso = (code || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(iso)) return '';
  return String.fromCodePoint(...[...iso].map((lettre) => 0x1f1e6 + lettre.charCodeAt(0) - 65));
}

const MOTS_INVARIABLES = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'd', 'l', 'en', 'au', 'aux']);

/**
 * « RÉPUBLIQUE TOGOLAISE » → « République Togolaise », « RÉPUBLIQUE DE CÔTE D'IVOIRE » → « République de Côte d'Ivoire ».
 * Sert aux bandeaux de la vitrine et des pages d'authentification ; le bulletin garde les majuscules.
 */
export function titreRepublique(republique: string): string {
  const mots = (republique || '').trim().toLocaleLowerCase('fr-FR').split(/\s+/).filter(Boolean);
  return mots
    .map((mot, index) => mot
      .split(/(['’])/)
      .map((partie) => {
        if (partie === "'" || partie === '’' || partie === '') return partie;
        if (index > 0 && MOTS_INVARIABLES.has(partie)) return partie;
        return partie.charAt(0).toLocaleUpperCase('fr-FR') + partie.slice(1);
      })
      .join(''))
    .join(' ');
}

/** Bandeau court « République Togolaise • MEPST » de la vitrine. */
export function bandeauNational(prereglage: Pick<PrereglageNational, 'republique' | 'sigleMinistere'>): string {
  const titre = titreRepublique(prereglage.republique);
  return prereglage.sigleMinistere ? `${titre} • ${prereglage.sigleMinistere}` : titre;
}

/** Copie les libellés d'un préréglage dans les paramètres ; les autres champs (logos, signataires…) sont conservés. */
export function appliquerPrereglageAuxSettings(settings: AppSettings, prereglage: PrereglageNational): AppSettings {
  return {
    ...settings,
    countryName: prereglage.republique,
    motto: prereglage.devise,
    ministryName: prereglage.ministere,
    ministrySigle: prereglage.sigleMinistere,
    regionalAuthority: prereglage.autoriteRegionale ?? '',
    footerNote: prereglage.piedDePage ?? '',
    prereglageNationalId: prereglage.id > 0 ? prereglage.id : null,
  };
}

/** Reporte l'en-tête enregistré sur l'API dans les paramètres ; un champ vide côté serveur laisse la valeur locale. */
export function appliquerEnTeteAuxSettings(settings: AppSettings, enTete: EnTeteEtablissement | null | undefined): AppSettings {
  if (!enTete) return settings;
  return {
    ...settings,
    countryName: enTete.republique || settings.countryName,
    motto: enTete.deviseNationale || settings.motto,
    ministryName: enTete.ministere || settings.ministryName,
    ministrySigle: enTete.sigleMinistere || '',
    regionalAuthority: enTete.autoriteRegionale || '',
    footerNote: enTete.piedDePage || '',
    prereglageNationalId: enTete.prereglageNationalId ?? null,
  };
}

/** Corps de `PUT /api/etablissement/en-tete` à partir des paramètres. */
export function enTeteDepuisSettings(settings: AppSettings): EnTeteEtablissement {
  const vide = (value: string | undefined) => (value && value.trim() ? value.trim() : null);
  return {
    prereglageNationalId: settings.prereglageNationalId ?? null,
    republique: vide(settings.countryName),
    deviseNationale: vide(settings.motto),
    ministere: vide(settings.ministryName),
    sigleMinistere: vide(settings.ministrySigle),
    autoriteRegionale: vide(settings.regionalAuthority),
    piedDePage: vide(settings.footerNote),
  };
}

const CHAMPS_EN_TETE: (keyof AppSettings)[] = [
  'countryName', 'motto', 'ministryName', 'ministrySigle', 'regionalAuthority', 'footerNote', 'prereglageNationalId',
];

/** Vrai si l'en-tête officiel diffère entre deux jeux de paramètres. */
export function enTeteChanged(before: AppSettings, after: AppSettings): boolean {
  return CHAMPS_EN_TETE.some((champ) => (before[champ] ?? '') !== (after[champ] ?? ''));
}

/** Préréglage sélectionné dans le bloc « 1 clic » : par identifiant mémorisé, sinon par république identique. */
export function prereglageCourant(settings: AppSettings, liste: PrereglageNational[]): PrereglageNational | null {
  if (settings.prereglageNationalId != null) {
    const parId = liste.find((item) => item.id === settings.prereglageNationalId);
    if (parId) return parId;
  }
  const republique = (settings.countryName || '').trim().toLocaleUpperCase('fr-FR');
  return liste.find((item) => item.republique.trim().toLocaleUpperCase('fr-FR') === republique) ?? null;
}
