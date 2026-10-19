/** Cycle d’une classe : collège (6e–3e, sans série) ou lycée (2nde–Tle, avec série). Miroir de ClasseNiveauUtil côté API. */
export type Cycle = 'COLLEGE' | 'LYCEE';

export const NIVEAUX: Record<Cycle, { code: string; label: string }[]> = {
  COLLEGE: [
    { code: '6e', label: '6e — Sixième' },
    { code: '5e', label: '5e — Cinquième' },
    { code: '4e', label: '4e — Quatrième' },
    { code: '3e', label: '3e — Troisième' },
  ],
  LYCEE: [
    { code: '2nde', label: '2nde — Seconde' },
    { code: '1ère', label: '1ère — Première' },
    { code: 'Tle', label: 'Tle — Terminale' },
  ],
};

const NIVEAU_ALIAS: Record<string, string> = {
  '6E': '6e', '6EME': '6e', SIXIEME: '6e',
  '5E': '5e', '5EME': '5e', CINQUIEME: '5e',
  '4E': '4e', '4EME': '4e', QUATRIEME: '4e',
  '3E': '3e', '3EME': '3e', TROISIEME: '3e',
  '2NDE': '2nde', '2DE': '2nde', SECONDE: '2nde',
  '1ERE': '1ère', '1RE': '1ère', PREMIERE: '1ère',
  TLE: 'Tle', TERMINALE: 'Tle',
};

/** Code canonique d’un niveau saisi librement (« Troisième » → « 3e »), ou la valeur d’origine. */
export const niveauCanonique = (niveau: string): string => {
  const compact = niveau.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return NIVEAU_ALIAS[compact] ?? niveau;
};

/** Collège si le niveau est 6e–3e ; tout autre niveau est traité comme lycée. */
export const cycleDeNiveau = (niveau: string): Cycle =>
  NIVEAUX.COLLEGE.some((n) => n.code === niveauCanonique(niveau)) ? 'COLLEGE' : 'LYCEE';

export const estCollege = (niveau?: string | null): boolean => !!niveau && cycleDeNiveau(niveau) === 'COLLEGE';

/** Nom de classe proposé : « 3e », « Tle D », « 1ère G2 » — jamais de série au collège. */
export const nomClasseSuggere = (niveau: string, serie: string): string =>
  serie && !estCollege(niveau) ? `${niveau} ${serie}` : niveau;
