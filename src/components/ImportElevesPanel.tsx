import React, { useState } from 'react';
import { apiSend } from '../api/client';

interface Option { id: number; nom: string; }

interface Props {
  classes: Option[];
  sessions: Option[];
  /** Appelé après un import réussi pour recharger les listes de l'écran parent. */
  onImported?: () => void | Promise<void>;
}

interface LigneImport { nomComplet: string; genre: string; dateNaissance?: string; lieuNaissance?: string; }

interface ResultatImport {
  crees: number;
  ignores: number;
  total: number;
  classesCreees: string[];
  lignesIgnorees: { nomComplet: string; motif: string }[];
}

const NOUVELLE = '__nouvelle__';
const field = 'border border-[#eaedff] rounded px-2 py-1 text-[13px]';
const primary = 'px-3 py-1 rounded bg-[#00236f] text-white text-[12px] font-semibold disabled:opacity-50';

/** Transforme le texte collé (une ligne = `NOM Prénoms;Genre;JJ/MM/AAAA;Lieu`) en lignes d'import. */
export function parseLignesImport(texte: string): { lignes: LigneImport[]; erreur?: string } {
  const lignes: LigneImport[] = [];
  const brutes = texte.split(/\r?\n/);
  for (let i = 0; i < brutes.length; i++) {
    const brute = brutes[i].trim();
    if (!brute) continue;
    const [nomComplet = '', genreBrut = '', dateNaissance = '', lieuNaissance = ''] = brute.split(';').map((p) => p.trim());
    const genre = genreBrut.toUpperCase();
    if (!nomComplet) return { lignes, erreur: `Ligne ${i + 1} : le nom est vide.` };
    if (genre !== 'M' && genre !== 'F') return { lignes, erreur: `Ligne ${i + 1} (${nomComplet}) : le genre doit être M ou F.` };
    lignes.push({
      nomComplet,
      genre,
      dateNaissance: dateNaissance || undefined,
      lieuNaissance: lieuNaissance || undefined,
    });
  }
  if (lignes.length === 0) return { lignes, erreur: 'Collez au moins une ligne « NOM Prénoms;Genre;JJ/MM/AAAA;Lieu ».' };
  return { lignes };
}

export const ImportElevesPanel: React.FC<Props> = ({ classes, sessions, onImported }) => {
  const [texte, setTexte] = useState('');
  const [classeChoix, setClasseChoix] = useState(classes.length ? String(classes[0].id) : NOUVELLE);
  const [nouvelleClasse, setNouvelleClasse] = useState('3e');
  const [sessionId, setSessionId] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [resultat, setResultat] = useState<ResultatImport | null>(null);

  const importer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur('');
    setResultat(null);
    const { lignes, erreur: erreurParse } = parseLignesImport(texte);
    if (erreurParse) { setErreur(erreurParse); return; }
    const classeNom = nouvelleClasse.trim();
    if (classeChoix === NOUVELLE && !classeNom) { setErreur('Indiquez le nom de la nouvelle classe (ex. 3e).'); return; }
    const body = {
      classeId: classeChoix === NOUVELLE ? null : Number(classeChoix),
      classeNom: classeChoix === NOUVELLE ? classeNom : null,
      sessionId: sessionId ? Number(sessionId) : null,
      eleves: lignes,
    };
    setEnCours(true);
    try {
      const res = await apiSend<ResultatImport>('/api/eleves/import', 'POST', body);
      setResultat(res);
      if (res.crees > 0) setTexte('');
      await onImported?.();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Import impossible.');
    } finally {
      setEnCours(false);
    }
  };

  return (
    <form className="border-t border-[#eaedff] pt-3 space-y-2" onSubmit={(e) => void importer(e)}>
      <p className="text-[13px] font-semibold text-[#00236f]">Importer une liste</p>
      <p className="text-[12px] text-[#444651]">
        Une ligne par élève : <code>NOM Prénoms;Genre;JJ/MM/AAAA;Lieu</code> (genre M ou F ; date et lieu facultatifs).
        Les élèves déjà présents dans la classe sont ignorés. Le matricule n’est pas à saisir : il est attribué
        automatiquement par le serveur (format <code>AA-CODE_ETAB-NNNNN</code>).
      </p>
      <textarea
        required
        rows={5}
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        placeholder={'ADOUGBA Komlan Bruno;M;05/10/2010;LOME\nATTIKOUFIO Estelle;F;09/05/2012;Lomé'}
        className={`${field} w-full font-mono`}
      />
      <div className="flex flex-wrap gap-2 items-center">
        <select value={classeChoix} onChange={(e) => setClasseChoix(e.target.value)} className={field}>
          {classes.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}
          <option value={NOUVELLE}>Nouvelle classe…</option>
        </select>
        {classeChoix === NOUVELLE && (
          <input
            required
            placeholder="Nom de la classe (ex. 3e)"
            value={nouvelleClasse}
            onChange={(e) => setNouvelleClasse(e.target.value)}
            className={field}
          />
        )}
        <select value={sessionId} onChange={(e) => setSessionId(e.target.value)} className={field}>
          <option value="">Sans session</option>
          {sessions.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}
        </select>
        <button type="submit" className={primary} disabled={enCours}>{enCours ? 'Import en cours…' : 'Importer la liste'}</button>
      </div>
      {erreur && <p className="text-[12px] text-[#ba1a1a]">{erreur}</p>}
      {resultat && (
        <div className="text-[12px] text-[#0051d5] space-y-1">
          <p>
            {resultat.crees} élève{resultat.crees > 1 ? 's' : ''} créé{resultat.crees > 1 ? 's' : ''}, {resultat.ignores} ignoré{resultat.ignores > 1 ? 's' : ''} sur {resultat.total}.
            {resultat.classesCreees.length > 0 && ` Classe créée : ${resultat.classesCreees.join(', ')}.`}
          </p>
          {resultat.lignesIgnorees.length > 0 && (
            <ul className="text-[#444651] list-disc pl-5">
              {resultat.lignesIgnorees.map((l, i) => <li key={i}>{l.nomComplet} — {l.motif}</li>)}
            </ul>
          )}
        </div>
      )}
    </form>
  );
};
