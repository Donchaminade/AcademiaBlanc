export interface BulletinHeaderInfo {
  mainTitle: string;
  subTitle: string;
  examBadge: string;
}

/** Libellé neutre sous le logo uniquement si aucun nom d'établissement n'est enregistré. */
export const ESTABLISHMENT_CAPTION_FALLBACK = 'ÉTABLISSEMENT';

/**
 * Nom officiel affiché, centré, sous le logo du bulletin.
 * Reprend `settings.institutionName` (réglages locaux, ou `Etablissement.nom`
 * repris dans la session après connexion). Le libellé de repli ne s'applique
 * que lorsque ce nom est absent ou vide.
 */
export function establishmentCaption(institutionName?: string | null): string {
  const name = (institutionName ?? '').replace(/\s+/g, ' ').trim();
  if (!name) return ESTABLISHMENT_CAPTION_FALLBACK;
  return name.toLocaleUpperCase('fr-FR');
}

const SIGLE_STOPWORDS = new Set([
  'a',
  'au',
  'aux',
  'd',
  'de',
  'des',
  'du',
  'en',
  'et',
  'l',
  'la',
  'le',
  'les',
  'pour',
]);

/**
 * Sigle officiel entre parenthèses, placé sous le nom du ministère.
 * MEPST pour l'enseignement primaire, secondaire et technique ;
 * MESR pour l'enseignement supérieur et la recherche.
 */
export function ministrySigle(ministryName: string): string {
  const normalized = (ministryName || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const explicit: Array<[RegExp, string]> = [
    [/ENSEIGNEMENTS?\s+PRIMAIRE[\s,]+SECONDAIRE/i, 'MEPST'],
    [/ENSEIGNEMENT\s+SUPERIEUR/i, 'MESR'],
    [/EDUCATION\s+NATIONALE/i, 'MENA'],
  ];

  for (const [pattern, sigle] of explicit) {
    if (pattern.test(normalized)) return `(${sigle})`;
  }

  const words = normalized
    .split(/[^A-Za-z0-9]+/)
    .filter((word) => word.length > 0 && !SIGLE_STOPWORDS.has(word.toLowerCase()));
  const letters = words.map((word) => word.charAt(0).toUpperCase()).join('');
  return letters ? `(${letters})` : '';
}

/**
 * Calcule dynamiquement les mentions et titres officiels de l'en-tête du bulletin
 * en fonction de la session choisie (ex : BEPC, BAC I, BAC II Série D, Série C, etc.)
 */
export function getBulletinHeaderInfo(
  sessionName: string,
  candidateSerie?: string
): BulletinHeaderInfo {
  const norm = (sessionName || '').toUpperCase();
  const serie = (candidateSerie || '').toUpperCase();

  // 1. BEPC (Brevet d'Études du Premier Cycle)
  if (norm.includes('BEPC') || serie.includes('BEPC')) {
    return {
      mainTitle: "RELEVÉ DE NOTES & BULLETIN OFFICIEL DU BREVET D'ÉTUDES DU PREMIER CYCLE (BEPC BLANC)",
      subTitle: "ENSEIGNEMENT SECONDAIRE GÉNÉRAL (PREMIER CYCLE) • DÉLIBÉRATION DU JURY N° 01",
      examBadge: "BREVET D'ÉTUDES DU PREMIER CYCLE (BEPC)",
    };
  }

  // 2. BAC I (Première partie)
  if (
    norm.includes('BAC I') ||
    norm.includes('BACCALAURÉAT I') ||
    norm.includes('PREMIÈRE PARTIE') ||
    norm.includes('BAC 1') ||
    serie.includes('BAC I')
  ) {
    if (norm.includes('A4') || serie.includes('A4') || norm.includes('SÉRIE A') || serie.includes('SÉRIE A')) {
      return {
        mainTitle: "RELEVÉ DE NOTES & BULLETIN OFFICIEL DU BACCALAURÉAT PREMIÈRE PARTIE (BAC I BLANC)",
        subTitle: "SÉRIE A4 (LITTÉRAIRE & SCIENCES HUMAINES) • DÉLIBÉRATION OFFICIELLE DU JURY N° 01",
        examBadge: "BACCALAURÉAT PREMIÈRE PARTIE (BAC I)",
      };
    }
    if (norm.includes('SÉRIE C') || serie.includes('SÉRIE C')) {
      return {
        mainTitle: "RELEVÉ DE NOTES & BULLETIN OFFICIEL DU BACCALAURÉAT PREMIÈRE PARTIE (BAC I BLANC)",
        subTitle: "SÉRIE C (MATHÉMATIQUES & SCIENCES PHYSIQUES) • DÉLIBÉRATION DU JURY N° 01",
        examBadge: "BACCALAURÉAT PREMIÈRE PARTIE (BAC I)",
      };
    }
    if (norm.includes('SÉRIE D') || serie.includes('SÉRIE D')) {
      return {
        mainTitle: "RELEVÉ DE NOTES & BULLETIN OFFICIEL DU BACCALAURÉAT PREMIÈRE PARTIE (BAC I BLANC)",
        subTitle: "SÉRIE D (SCIENCES DE LA NATURE & MATHÉMATIQUES) • DÉLIBÉRATION DU JURY N° 01",
        examBadge: "BACCALAURÉAT PREMIÈRE PARTIE (BAC I)",
      };
    }
    return {
      mainTitle: "RELEVÉ DE NOTES & BULLETIN OFFICIEL DU BACCALAURÉAT PREMIÈRE PARTIE (BAC I BLANC)",
      subTitle: "ENSEIGNEMENT SECONDAIRE DU SECOND CYCLE • DÉLIBÉRATION DU JURY N° 01",
      examBadge: "BACCALAURÉAT PREMIÈRE PARTIE (BAC I)",
    };
  }

  // 3. CEPD (Certificat d'Études du Premier Degré)
  if (norm.includes('CEPD') || norm.includes('CERTIFICAT D\'ÉTUDES')) {
    return {
      mainTitle: "RELEVÉ DE NOTES & CERTIFICAT OFFICIEL DE L'EXAMEN BLANC DU CEPD",
      subTitle: "ENSEIGNEMENT PRIMAIRE FONDAMENTAL • DÉLIBÉRATION DU JURY N° 01",
      examBadge: "CERTIFICAT D'ÉTUDES DU PREMIER DEGRÉ (CEPD)",
    };
  }

  // 4. BAC II (Deuxième partie / Terminale)
  if (
    norm.includes('BAC II') ||
    norm.includes('BACCALAURÉAT II') ||
    norm.includes('DEUXIÈME PARTIE') ||
    norm.includes('BAC 2') ||
    norm.includes('BACCALAURÉAT')
  ) {
    if (norm.includes('SÉRIE C') || serie.includes('SÉRIE C')) {
      return {
        mainTitle: "RELEVÉ DE NOTES & BULLETIN OFFICIEL DE L'EXAMEN BLANC DU BACCALAURÉAT (BAC II)",
        subTitle: "SÉRIE C (MATHÉMATIQUES & SCIENCES PHYSIQUES) • DÉLIBÉRATION OFFICIELLE DU JURY N° 01",
        examBadge: "BACCALAURÉAT DEUXIÈME PARTIE (BAC II)",
      };
    }
    if (norm.includes('SÉRIE A') || serie.includes('SÉRIE A') || norm.includes('A4') || serie.includes('A4')) {
      return {
        mainTitle: "RELEVÉ DE NOTES & BULLETIN OFFICIEL DE L'EXAMEN BLANC DU BACCALAURÉAT (BAC II)",
        subTitle: "SÉRIE A4 (LITTÉRAIRE & LANGUES) • DÉLIBÉRATION OFFICIELLE DU JURY N° 01",
        examBadge: "BACCALAURÉAT DEUXIÈME PARTIE (BAC II)",
      };
    }
    // Default Série D
    return {
      mainTitle: "RELEVÉ DE NOTES & BULLETIN OFFICIEL DE L'EXAMEN BLANC DU BACCALAURÉAT",
      subTitle: "SÉRIE D (SCIENTIFIQUE) • DÉLIBÉRATION OFFICIELLE DU JURY N° 01",
      examBadge: "BACCALAURÉAT DEUXIÈME PARTIE (BAC II)",
    };
  }

  // 5. Fallback générique
  return {
    mainTitle: `RELEVÉ DE NOTES & BULLETIN OFFICIEL - ${sessionName.toUpperCase()}`,
    subTitle: `DÉLIBÉRATION OFFICIELLE DU JURY N° 01 • PROPRIÉTÉ ACADÉMIQUE`,
    examBadge: sessionName,
  };
}

export const OFFICIAL_RESPONSIBLE_TITLES = [
  'Le Proviseur',
  'La Proviseure',
  'Le Directeur',
  'La Directrice',
  'Le Principal',
  'La Principale',
  'Le Chef d\'Établissement',
  'Le Président du Jury',
  'La Présidente du Jury',
  'Le Censeur des Études',
  'Le Directeur des Études',
];

export const OFFICIAL_TEACHER_TITLES = [
  'Le Titulaire',
  'La Titulaire',
  'Le Professeur Principal',
  'La Professeure Principale',
  'L\'Enseignant Titulaire',
  'L\'Éducateur Référent',
  'Le Maître de Classe',
];
