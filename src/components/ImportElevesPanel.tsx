import React, { useEffect, useState } from 'react';
import { apiSend, getToken } from '../api/client';
import { showError, toastSuccess } from '../utils/alerts';
import { messageResultatImport, parseLignesImport } from '../utils/importEleves';
import type { ResultatImport } from '../utils/importEleves';

export { parseLignesImport, messageResultatImport } from '../utils/importEleves';

interface Option { id: number; nom: string; }

interface Props {
  classes: Option[];
  sessions: Option[];
  /** Session présélectionnée (la session active de l'écran) ; `null` ou absente : « Sans session ». */
  defaultSessionId?: number | null;
  /** Appelé après un import réussi pour recharger les listes de l'écran parent depuis le serveur. */
  onImported?: () => void | Promise<void>;
  /** Sans bordure haute ni titre : le panneau est déjà encadré (modale). */
  embedded?: boolean;
  /** Session inter-établissements : le champ « Établissement d'origine » est mis en avant (5e colonne ou valeur par défaut). */
  sessionInter?: boolean;
  /** Nom du centre d'examen (établissement hôte), rappelé dans l'aide du champ d'origine. */
  centreExamen?: string;
}

const NOUVELLE = '__nouvelle__';
const field = 'border border-[#eaedff] rounded px-2 py-1 text-[13px]';
const primary = 'px-3 py-1 rounded bg-[#00236f] text-white text-[12px] font-semibold disabled:opacity-50';

export const ImportElevesPanel: React.FC<Props> = ({ classes, sessions, defaultSessionId = null, onImported, embedded = false, sessionInter = false, centreExamen = '' }) => {
  const connecte = Boolean(getToken());
  const [texte, setTexte] = useState('');
  const [etablissementOrigine, setEtablissementOrigine] = useState('');
  const [classeChoix, setClasseChoix] = useState(classes.length ? String(classes[0].id) : NOUVELLE);
  const [nouvelleClasse, setNouvelleClasse] = useState('3e');
  const [sessionId, setSessionId] = useState(defaultSessionId != null ? String(defaultSessionId) : '');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [resultat, setResultat] = useState<ResultatImport | null>(null);

  // Les listes arrivent souvent après le premier rendu : on garde un choix valide.
  useEffect(() => {
    if (classeChoix !== NOUVELLE && !classes.some((item) => String(item.id) === classeChoix)) {
      setClasseChoix(classes.length ? String(classes[0].id) : NOUVELLE);
    }
  }, [classes, classeChoix]);
  useEffect(() => {
    if (sessionId && !sessions.some((item) => String(item.id) === sessionId)) {
      setSessionId(defaultSessionId != null && sessions.some((item) => item.id === defaultSessionId) ? String(defaultSessionId) : '');
    }
  }, [sessions, sessionId, defaultSessionId]);

  const importer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur('');
    setResultat(null);
    if (!connecte) {
      setErreur('Connectez-vous : hors connexion, rien n’est enregistré sur le serveur.');
      return;
    }
    const { lignes, erreur: erreurParse } = parseLignesImport(texte);
    if (erreurParse) { setErreur(erreurParse); return; }
    const classeNom = nouvelleClasse.trim();
    if (classeChoix === NOUVELLE && !classeNom) { setErreur('Indiquez le nom de la nouvelle classe (ex. 3e).'); return; }
    const body = {
      classeId: classeChoix === NOUVELLE ? null : Number(classeChoix),
      classeNom: classeChoix === NOUVELLE ? classeNom : null,
      sessionId: sessionId ? Number(sessionId) : null,
      // Origine par défaut des lignes sans 5e colonne ; vide = élèves du centre (de l'établissement).
      etablissementOrigine: etablissementOrigine.trim() || null,
      eleves: lignes,
    };
    setEnCours(true);
    try {
      // Toujours l'API : aucune ligne n'est ajoutée localement, la liste est relue depuis le serveur.
      const res = await apiSend<ResultatImport>('/api/eleves/import', 'POST', body);
      setResultat(res);
      if (res.crees > 0) setTexte('');
      toastSuccess(messageResultatImport(res));
      await onImported?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import impossible.';
      setErreur(message);
      await showError('Import impossible', `${message} Aucun élève n’a été ajouté.`);
    } finally {
      setEnCours(false);
    }
  };

  return (
    <form className={`${embedded ? '' : 'border-t border-[#eaedff] pt-3 '}space-y-2`} onSubmit={(e) => void importer(e)}>
      {!embedded && <p className="text-[13px] font-semibold text-[#00236f]">Importer une liste</p>}
      {!connecte && (
        <p role="alert" className="text-[12px] rounded border border-[#ffb4ab] bg-[#ffdad6] text-[#93000a] px-3 py-2">
          Données de démonstration, non enregistrées sur le serveur — connectez-vous pour importer des élèves dans la base de l’établissement.
        </p>
      )}
      <p className="text-[12px] text-[#444651]">
        Une ligne par élève : <code>NOM Prénoms;Genre;JJ/MM/AAAA;Lieu{sessionInter ? ';Établissement d’origine' : ''}</code> (genre M ou F ; date et lieu facultatifs).
        Les élèves déjà présents dans la classe sont ignorés. Le matricule n’est pas à saisir : il est attribué
        automatiquement par le serveur (format <code>AA-CODE_ETAB-NNNNN</code>).
        {sessionInter
          ? ' En session inter-établissements, un numéro de table est attribué à chaque candidat dans l’ordre d’inscription ; la 5e colonne « Établissement d’origine » est facultative : à défaut, l’établissement saisi ci-dessous est utilisé, et sans lui le candidat est compté comme élève du centre.'
          : ' Une 5e colonne « Établissement d’origine » peut être ajoutée pour un candidat venu d’une autre école.'}
      </p>
      <textarea
        required
        rows={5}
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        placeholder={sessionInter
          ? 'ADOUGBA Komlan Bruno;M;05/10/2010;LOME;CEG Agoè-Nyivé\nATTIKOUFIO Estelle;F;09/05/2012;Lomé;Collège Saint-Joseph'
          : 'ADOUGBA Komlan Bruno;M;05/10/2010;LOME\nATTIKOUFIO Estelle;F;09/05/2012;Lomé'}
        className={`${field} w-full font-mono`}
      />
      <label className={`flex flex-col gap-1 text-[12px] ${sessionInter ? 'rounded border border-[#ffcc80] bg-[#fff8ee] px-3 py-2 text-[#8a4b00]' : 'text-[#444651]'}`}>
        <span className="font-semibold">Établissement d’origine par défaut{sessionInter ? '' : ' (facultatif)'}</span>
        <input
          value={etablissementOrigine}
          onChange={(e) => setEtablissementOrigine(e.target.value)}
          maxLength={180}
          placeholder={sessionInter ? 'Ex. CEG Agoè-Nyivé — vide : élèves du centre' : 'Vide : élèves de l’établissement'}
          className={`${field} w-full bg-white`}
          data-testid="import-etablissement-origine"
        />
        {sessionInter && (
          <span className="text-[11px]">
            Appliqué aux lignes sans 5e colonne. Centre d’examen : <strong>{centreExamen || 'cet établissement'}</strong>.
          </span>
        )}
      </label>
      <div className="flex flex-wrap gap-2 items-center">
        <select aria-label="Classe" value={classeChoix} onChange={(e) => setClasseChoix(e.target.value)} className={field}>
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
        <select aria-label="Session" value={sessionId} onChange={(e) => setSessionId(e.target.value)} className={field}>
          <option value="">Sans session (visible dans toutes les sessions)</option>
          {sessions.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}
        </select>
        <button type="submit" className={primary} disabled={enCours || !connecte}>{enCours ? 'Import en cours…' : 'Importer la liste'}</button>
      </div>
      {erreur && <p role="alert" className="text-[12px] text-[#ba1a1a]">{erreur}</p>}
      {resultat && (
        <div className="text-[12px] text-[#0051d5] space-y-1">
          <p>{messageResultatImport(resultat)}</p>
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
