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

/**
 * Libellé de la bande année du bulletin.
 * Reprend `settings.academicYear` (réglages locaux, ou `Annee.libelle`
 * repris dans la session). Aucune année n'est ajoutée ici.
 */
export function academicYearCaption(academicYear?: string | null): string {
  const label = (academicYear ?? '').replace(/\s+/g, ' ').trim();
  return label.toLocaleUpperCase('fr-FR');
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

/** Libellé de démonstration affiché hors connexion, explicitement étiqueté pour ne pas passer pour une donnée réelle. */
export const DEMO_EXAM_LABEL = 'BAC II (démonstration)';

/**
 * Sigle imprimé sous le nom du ministère : celui enregistré avec le préréglage national
 * (`settings.ministrySigle`) s'il existe, sinon déduit du nom par `ministrySigle()`.
 */
export function ministryMark(settings: { ministryName: string; ministrySigle?: string }): string {
  const explicit = (settings.ministrySigle || '').trim();
  if (explicit) return `(${explicit.replace(/^\(|\)$/g, '')})`;
  return ministrySigle(settings.ministryName);
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
