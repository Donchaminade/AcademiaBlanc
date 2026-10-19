/** Fonctions pures de l'import d'élèves (analyse du texte collé, phrase de résultat), testables sans navigateur. */

export interface LigneImport {
  nomComplet: string;
  genre: string;
  dateNaissance?: string;
  lieuNaissance?: string;
  /** 5e colonne facultative (session inter-établissements) : établissement d'origine du candidat. */
  etablissementOrigine?: string;
}

export interface ResultatImport {
  crees: number;
  ignores: number;
  total: number;
  classesCreees: string[];
  lignesIgnorees: { nomComplet: string; motif: string }[];
}

/**
 * Transforme le texte collé (une ligne = `NOM Prénoms;Genre;JJ/MM/AAAA;Lieu[;Établissement d'origine]`)
 * en lignes d'import. La 5e colonne, facultative, sert aux sessions inter-établissements.
 */
export function parseLignesImport(texte: string): { lignes: LigneImport[]; erreur?: string } {
  const lignes: LigneImport[] = [];
  const brutes = texte.split(/\r?\n/);
  for (let i = 0; i < brutes.length; i++) {
    const brute = brutes[i].trim();
    if (!brute) continue;
    // Séparateur `;` (format documenté) ; une liste copiée d'un tableur arrive avec des tabulations.
    const separateur = brute.includes(';') ? ';' : brute.includes('\t') ? '\t' : ',';
    const [nomComplet = '', genreBrut = '', dateNaissance = '', lieuNaissance = '', etablissementOrigine = ''] = brute.split(separateur).map((p) => p.trim());
    const genre = genreBrut.toUpperCase();
    if (!nomComplet) return { lignes, erreur: `Ligne ${i + 1} : le nom est vide.` };
    if (genre !== 'M' && genre !== 'F') return { lignes, erreur: `Ligne ${i + 1} (${nomComplet}) : le genre doit être M ou F.` };
    lignes.push({
      nomComplet,
      genre,
      dateNaissance: dateNaissance || undefined,
      lieuNaissance: lieuNaissance || undefined,
      // Clé absente (et non `undefined`) sans 5e colonne : la ligne garde sa forme historique.
      ...(etablissementOrigine ? { etablissementOrigine } : {}),
    });
  }
  if (lignes.length === 0) return { lignes, erreur: 'Collez au moins une ligne « NOM Prénoms;Genre;JJ/MM/AAAA;Lieu ».' };
  return { lignes };
}

/** Phrase de résultat : « 11 élèves enregistrés dans la base de l’établissement, 0 ignoré ». */
export function messageResultatImport(resultat: ResultatImport): string {
  const s = (n: number) => (n > 1 ? 's' : '');
  const classes = resultat.classesCreees.length > 0 ? ` Classe créée : ${resultat.classesCreees.join(', ')}.` : '';
  return `${resultat.crees} élève${s(resultat.crees)} enregistré${s(resultat.crees)} dans la base de l’établissement, `
    + `${resultat.ignores} ignoré${s(resultat.ignores)}.${classes}`;
}
