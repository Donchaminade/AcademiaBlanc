import React from 'react';
import { AppSettings, Candidate } from '../types';
import { etablissementOrigineAffiche, libelleNiveauSerie, trierCandidatsListe } from '../utils/sessionMode';
import { numeroTableAffiche } from '../utils/numerosTable';
import type { SourcesEnTeteDocument } from '../utils/documentPaysage';
import { EnTeteDocument, PiedDocument, piedDeDocument } from './print/EnTeteDocument';

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
  /** Paramètres de l'établissement (logo, devise, république, ministère) pour le bandeau commun. */
  settings?: AppSettings;
}

export const TITRE_LISTE_CANDIDATS = 'Liste des candidats';

/** Libellé des classes concernées : les noms quand ils sont peu nombreux, sinon leur nombre. */
export function libelleClasses(candidates: Candidate[]): string {
  const classes = [...new Set(candidates.map((c) => (c.classeNom || '').trim() || libelleNiveauSerie(c)).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
  if (classes.length === 0) return '—';
  if (classes.length <= 3) return classes.join(', ');
  return `${classes.length} classes`;
}

/** Paramètres minimaux quand aucun réglage n'est chargé (démonstration sans profil) : seul le nom du centre apparaît. */
export function settingsEnTete(settings: AppSettings | undefined, nom: string): SourcesEnTeteDocument['settings'] {
  return settings ?? {
    institutionName: nom,
    institutionMotto: '',
    logoUrl: '',
    countryName: '',
    motto: '',
    ministryName: '',
    ministrySigle: '',
    regionalAuthority: '',
    academicYear: '',
  };
}

/**
 * Liste des candidats imprimable (A4 paysage, gabarit commun `.document-paysage`) : masquée à l'écran, rendue
 * seulement sous `body[data-print-mode='candidats']`. Triée par classe (niveau / série, puis nom de classe) puis
 * nom ; l'en-tête bleu du tableau se répète à chaque page et aucune ligne n'est coupée.
 */
export const ListeCandidatsSheet: React.FC<ListeCandidatsSheetProps> = ({
  candidates,
  sessionInter,
  centreExamen,
  selectedSession,
  examType,
  academicYear,
  settings,
}) => {
  const lignes = trierCandidatsListe(candidates);
  const garcons = candidates.filter((c) => c.gender === 'M').length;
  const avecLieu = candidates.some((c) => (c.birthPlace || '').trim());
  const avecOrigine = sessionInter || candidates.some((c) => (c.originSchool || '').trim());
  const sources: SourcesEnTeteDocument = {
    titre: TITRE_LISTE_CANDIDATS,
    settings: settingsEnTete(settings, centreExamen),
    sessionInter,
    centreExamen,
    typeExamen: examType,
    sessionNom: selectedSession,
    anneeScolaire: academicYear,
  };
  const colonnes = 7 + (avecLieu ? 1 : 0) + (avecOrigine ? 1 : 0);

  return (
    <div className="document-paysage candidats-sheet" data-testid="liste-candidats-sheet">
      <EnTeteDocument
        {...sources}
        meta={[
          { label: 'Effectif', value: <>{candidates.length} ({garcons} G / {candidates.length - garcons} F)</> },
          { label: 'Classes', value: libelleClasses(candidates) },
        ]}
      />

      <table className="document-paysage-table candidats-table">
        <colgroup>
          <col style={{ width: '13mm' }} />
          <col style={{ width: '34mm' }} />
          <col />
          <col style={{ width: '10mm' }} />
          <col style={{ width: '20mm' }} />
          {avecLieu && <col style={{ width: '30mm' }} />}
          <col style={{ width: '18mm' }} />
          {avecOrigine && <col style={{ width: '46mm' }} />}
          <col style={{ width: '38mm' }} />
        </colgroup>
        <thead>
          <tr>
            <th className="c">N° table</th>
            <th>Matricule</th>
            <th>Nom et prénoms</th>
            <th className="c">Genre</th>
            <th className="c">Date de naissance</th>
            {avecLieu && <th>Lieu de naissance</th>}
            <th className="c">Classe / série</th>
            {avecOrigine && <th>Établissement d'origine</th>}
            <th>Observations</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((cand) => (
            <tr key={cand.id}>
              <td className="c mono">{numeroTableAffiche(cand)}</td>
              <td className="mono">{cand.matricule}</td>
              <td className="nom">{cand.fullName}</td>
              <td className="c">{cand.gender}</td>
              <td className="c">{cand.dob || ''}</td>
              {avecLieu && <td>{cand.birthPlace || ''}</td>}
              <td className="c">{libelleNiveauSerie(cand)}</td>
              {avecOrigine && <td>{sessionInter ? etablissementOrigineAffiche(cand, centreExamen) : cand.originSchool}</td>}
              <td />
            </tr>
          ))}
          {lignes.length === 0 && (
            <tr><td colSpan={colonnes} className="vide">Aucun candidat inscrit dans cette session.</td></tr>
          )}
        </tbody>
        <PiedDocument colonnes={colonnes} texte={piedDeDocument(sources)} complement={`${candidates.length} candidat${candidates.length > 1 ? 's' : ''}`} />
      </table>
    </div>
  );
};
