import React from 'react';
import { Candidate } from '../types';
import { etablissementOrigineAffiche, libelleNiveauSerie, ligneCentreExamen, trierCandidatsListe } from '../utils/sessionMode';

interface ListeCandidatsSheetProps {
  candidates: Candidate[];
  /** Session inter-établissements : l'en-tête porte « CENTRE D'EXAMEN : … » et la colonne d'origine est toujours remplie. */
  sessionInter: boolean;
  /** Nom du centre d'examen (établissement hôte) ; en interne, le nom de l'établissement. */
  centreExamen: string;
  selectedSession: string;
  /** Libellé du type d'examen de la session (ex. « BEPC blanc ») ; facultatif. */
  examType?: string;
  academicYear?: string;
}

const dateEdition = () => new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

/**
 * Liste des candidats imprimable (A4 portrait) : masquée à l'écran, rendue seulement sous
 * `body[data-print-mode='candidats']`. Triée par classe (niveau / série, puis nom de classe) puis nom ;
 * l'en-tête du tableau se répète à chaque page et aucune ligne n'est coupée (règles `.registre-table`).
 */
export const ListeCandidatsSheet: React.FC<ListeCandidatsSheetProps> = ({
  candidates,
  sessionInter,
  centreExamen,
  selectedSession,
  examType,
  academicYear,
}) => {
  const lignes = trierCandidatsListe(candidates);
  const enTete = sessionInter ? ligneCentreExamen(centreExamen) : (centreExamen || '').trim();
  const sousTitre = [examType, selectedSession].filter((v) => v && v.trim()).join(' — ');
  const garcons = candidates.filter((c) => c.gender === 'M').length;

  return (
    <div className="candidats-sheet" data-testid="liste-candidats-sheet">
      <div className="registre-head">
        <div>
          {enTete && <div className="registre-school">{enTete}</div>}
          <h1 className="registre-title">Liste des candidats</h1>
          {sousTitre && <div className="registre-subtitle">{sousTitre}</div>}
        </div>
        <div className="registre-meta">
          {academicYear && <div>Année scolaire : <strong>{academicYear}</strong></div>}
          <div>Effectif : <strong>{candidates.length}</strong> ({garcons} G / {candidates.length - garcons} F)</div>
          <div>Édité le {dateEdition()}</div>
        </div>
      </div>

      <table className="registre-table candidats-table">
        <colgroup>
          <col style={{ width: '11mm' }} />
          <col />
          <col style={{ width: '9mm' }} />
          <col style={{ width: '19mm' }} />
          <col style={{ width: '16mm' }} />
          <col style={{ width: '42mm' }} />
          <col style={{ width: '30mm' }} />
        </colgroup>
        <thead>
          <tr>
            <th className="c">N° table</th>
            <th>Nom et prénoms</th>
            <th className="c">Genre</th>
            <th className="c">Date de naissance</th>
            <th className="c">Classe / série</th>
            <th>Établissement d'origine</th>
            <th className="c">Émargement</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((cand) => (
            <tr key={cand.id}>
              <td className="c mono">{cand.tableNumber || ''}</td>
              <td className="registre-name">{cand.fullName}</td>
              <td className="c">{cand.gender}</td>
              <td className="c">{cand.dob || ''}</td>
              <td className="c">{libelleNiveauSerie(cand)}</td>
              <td>{sessionInter ? etablissementOrigineAffiche(cand, centreExamen) : cand.originSchool}</td>
              <td className="candidats-emargement" />
            </tr>
          ))}
          {lignes.length === 0 && (
            <tr><td colSpan={7} className="c">Aucun candidat inscrit dans cette session.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
