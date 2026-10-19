import type { PrereglageNational } from '../utils/prereglages';

/**
 * Préréglages nationaux de démonstration, utilisés uniquement hors connexion (espace local sans API)
 * et comme repli de la vitrine quand le serveur est injoignable. Le référentiel réel est géré par la
 * plateforme (`/api/plateforme/prereglages-nationaux`) et lu par `GET /api/prereglages-nationaux`.
 */
export const PREREGLAGES_DEMONSTRATION: PrereglageNational[] = [
  {
    id: -1,
    code: 'TG',
    nomPays: 'Togo',
    republique: 'RÉPUBLIQUE TOGOLAISE',
    devise: 'Travail – Liberté – Patrie',
    ministere: 'MINISTÈRE DES ENSEIGNEMENTS PRIMAIRE, SECONDAIRE ET TECHNIQUE',
    sigleMinistere: 'MEPST',
    autoriteRegionale: null,
    piedDePage: null,
    parDefaut: true,
  },
  {
    id: -2,
    code: 'CI',
    nomPays: "Côte d'Ivoire",
    republique: "RÉPUBLIQUE DE CÔTE D'IVOIRE",
    devise: 'Union – Discipline – Travail',
    ministere: "MINISTÈRE DE L'ÉDUCATION NATIONALE ET DE L'ALPHABÉTISATION",
    sigleMinistere: 'MENA',
    autoriteRegionale: null,
    piedDePage: null,
    parDefaut: false,
  },
];

export const PREREGLAGE_DEMONSTRATION_DEFAUT: PrereglageNational =
  PREREGLAGES_DEMONSTRATION.find((item) => item.parDefaut) ?? PREREGLAGES_DEMONSTRATION[0];
