import React from 'react';
import { AppSettings, Candidate } from '../../types';
import { TITRE_CHEF_CENTRE, libelleNiveauSerie } from '../../utils/sessionMode';
import { numeroTableAffiche, trierPourEmargement } from '../../utils/numerosTable';
import type { SourcesEnTeteDocument } from '../../utils/documentPaysage';
import { libelleClasses, settingsEnTete } from '../ListeCandidatsSheet';
import { EnTeteDocument, PiedDocument, piedDeDocument } from './EnTeteDocument';

export const TITRE_FEUILLE_EMARGEMENT = "Feuille d'émargement";

/** Colonnes de signature par défaut : trois journées d'épreuves. */
export const COLONNES_SIGNATURE_DEFAUT = ['Épreuve / Jour 1', 'Jour 2', 'Jour 3'] as const;

interface FeuilleEmargementSheetProps {
  candidates: Candidate[];
  sessionInter: boolean;
  /** Nom du centre d'examen (établissement hôte) ; en interne, le nom de l'établissement. */
  centreExamen: string;
  selectedSession: string;
  examType?: string;
  academicYear?: string;
  settings?: AppSettings;
  /** Intitulés des colonnes de signature (par défaut trois journées). */
  colonnesSignature?: ReadonlyArray<string>;
}

/**
 * Titre du responsable qui signe la feuille : le chef du centre en inter-établissements, sinon le titre
 * du signataire officiel des paramètres (« Le Proviseur », « La Directrice »…), à défaut « Le Chef d'établissement ».
 */
export function titreSignataireEmargement(sessionInter: boolean, settings?: Pick<AppSettings, 'jurySignerTitle'>): string {
  return sessionInter ? TITRE_CHEF_CENTRE : (settings?.jurySignerTitle?.trim() || "Le Chef d'établissement");
}

/**
 * Feuille d'émargement imprimable (A4 paysage, gabarit commun `.document-paysage`) : masquée à l'écran, rendue
 * seulement sous `body[data-print-mode='emargement']`. Par numéro de table ; les candidats sans numéro suivent,
 * par classe puis nom. Lignes hautes (≥ 9 mm) pour signer, en-tête de tableau répété à chaque page.
 */
export const FeuilleEmargementSheet: React.FC<FeuilleEmargementSheetProps> = ({
  candidates,
  sessionInter,
  centreExamen,
  selectedSession,
  examType,
  academicYear,
  settings,
  colonnesSignature = COLONNES_SIGNATURE_DEFAUT,
}) => {
  const lignes = trierPourEmargement(candidates);
  const sources: SourcesEnTeteDocument = {
    titre: TITRE_FEUILLE_EMARGEMENT,
    settings: settingsEnTete(settings, centreExamen),
    sessionInter,
    centreExamen,
    typeExamen: examType,
    sessionNom: selectedSession,
    anneeScolaire: academicYear,
  };
  const colonnes = 4 + colonnesSignature.length;
  const signataireNom = (settings?.jurySignerName ?? '').trim();

  return (
    <div className="document-paysage emargement-sheet" data-testid="feuille-emargement-sheet">
      <EnTeteDocument
        {...sources}
        meta={[
          { label: 'Effectif', value: candidates.length },
          { label: 'Classes', value: libelleClasses(candidates) },
        ]}
      />

      <table className="document-paysage-table emargement-table">
        <colgroup>
          <col style={{ width: '14mm' }} />
          <col style={{ width: '36mm' }} />
          <col />
          <col style={{ width: '20mm' }} />
          {colonnesSignature.map((libelle) => <col key={libelle} style={{ width: '42mm' }} />)}
        </colgroup>
        <thead>
          <tr>
            <th className="c">N° table</th>
            <th>Matricule</th>
            <th>Nom et prénoms</th>
            <th className="c">Classe / série</th>
            {colonnesSignature.map((libelle) => <th key={libelle} className="c">{libelle}</th>)}
          </tr>
        </thead>
        <tbody>
          {lignes.map((cand) => (
            <tr key={cand.id}>
              <td className="c mono">{numeroTableAffiche(cand)}</td>
              <td className="mono">{cand.matricule}</td>
              <td className="nom">{cand.fullName}</td>
              <td className="c">{libelleNiveauSerie(cand)}</td>
              {colonnesSignature.map((libelle) => <td key={libelle} className="signature" />)}
            </tr>
          ))}
          {lignes.length === 0 && (
            <tr><td colSpan={colonnes} className="vide">Aucun candidat inscrit dans cette session.</td></tr>
          )}
        </tbody>
        <PiedDocument colonnes={colonnes} texte={piedDeDocument(sources)} complement={`${candidates.length} candidat${candidates.length > 1 ? 's' : ''}`} />
      </table>

      <div className="emargement-bas">
        <div className="emargement-comptage">
          <span>Présents : <i /></span>
          <span>Absents : <i /></span>
          <span>Observations : <i style={{ maxWidth: 'none' }} /></span>
        </div>
        <div className="emargement-signature">
          <div className="emargement-signature-titre">Le Surveillant</div>
          <div className="emargement-signature-espace" />
          <div className="emargement-signature-nom">Nom et prénoms : ……………………</div>
        </div>
        <div className="emargement-signature">
          <div className="emargement-signature-titre">{titreSignataireEmargement(sessionInter, settings)}</div>
          <div className="emargement-signature-espace" />
          <div className="emargement-signature-nom">{signataireNom || 'Nom et prénoms : ……………………'}</div>
        </div>
      </div>
    </div>
  );
};
