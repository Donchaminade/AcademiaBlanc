import React from 'react';
import { AppSettings, ArchivedSession } from '../../types';
import {
  VALEUR_ABSENTE,
  barresBilan,
  formatEntier,
  formatNote,
  formatPourcent,
  ligneBilan,
  syntheseBilan,
  trierArchivesChronologique,
} from '../../utils/bilanArchives';
import type { SourcesEnTeteDocument } from '../../utils/documentPaysage';
import { EnTeteDocument, PiedDocument, piedDeDocument } from './EnTeteDocument';

export const TITRE_BILAN_ARCHIVES = "Bilan des sessions d'examen";

interface BilanArchivesSheetProps {
  sessions: ArchivedSession[];
  settings: AppSettings;
  /** Archives réelles de l'établissement (API) ou jeu de démonstration local. */
  demonstration?: boolean;
}

const COLONNES = 14;

/**
 * Bilan imprimable des sessions archivées (A4 paysage, gabarit commun `.document-paysage`) : masqué à l'écran,
 * rendu seulement sous `body[data-print-mode='archives']`. Tableau comparatif complet avec ligne de synthèse,
 * puis graphique à barres en CSS pur (taux de réussite par session). Données déjà chargées uniquement.
 */
export const BilanArchivesSheet: React.FC<BilanArchivesSheetProps> = ({ sessions, settings, demonstration = false }) => {
  const lignes = trierArchivesChronologique(sessions).map(ligneBilan);
  const synthese = syntheseBilan(lignes);
  const barres = barresBilan(lignes);
  const sources: SourcesEnTeteDocument = {
    titre: TITRE_BILAN_ARCHIVES,
    settings,
    sessionNom: demonstration ? 'Données de démonstration' : 'Comparatif interannuel',
    sansAnneeScolaire: true,
  };
  const annees = lignes.map((l) => l.anneeScolaire).filter((a) => a !== VALEUR_ABSENTE);
  const periode = annees.length === 0
    ? VALEUR_ABSENTE
    : annees.length === 1 ? annees[0] : `${annees[0]} → ${annees[annees.length - 1]}`;

  return (
    <div className="document-paysage archives-sheet" data-testid="bilan-archives-sheet">
      <EnTeteDocument
        {...sources}
        meta={[
          { label: 'Sessions archivées', value: lignes.length },
          { label: 'Période', value: periode },
        ]}
      />

      <table className="document-paysage-table archives-table">
        <colgroup>
          <col style={{ width: '20mm' }} />
          <col />
          <col style={{ width: '34mm' }} />
          <col style={{ width: '15mm' }} />
          <col style={{ width: '15mm' }} />
          <col style={{ width: '14mm' }} />
          <col style={{ width: '16mm' }} />
          <col style={{ width: '20mm' }} />
          <col style={{ width: '22mm' }} />
          <col style={{ width: '22mm' }} />
          <col style={{ width: '11mm' }} />
          <col style={{ width: '11mm' }} />
          <col style={{ width: '11mm' }} />
          <col style={{ width: '11mm' }} />
        </colgroup>
        <thead>
          <tr>
            <th className="c">Année scolaire</th>
            <th>Session</th>
            <th>Type d'examen</th>
            <th className="c">Effectif</th>
            <th className="c">Classés</th>
            <th className="c">Admis</th>
            <th className="c">Ajournés</th>
            <th className="c">Taux de réussite</th>
            <th className="c">Moyenne générale</th>
            <th className="c">Major (note)</th>
            <th className="c" title="Très bien">TB</th>
            <th className="c" title="Bien">B</th>
            <th className="c" title="Assez bien">AB</th>
            <th className="c" title="Passable">P</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((ligne) => (
            <tr key={ligne.id}>
              <td className="c nom">{ligne.anneeScolaire}</td>
              <td>{ligne.session}</td>
              <td>{ligne.typeExamen}</td>
              <td className="c">{formatEntier(ligne.effectif)}</td>
              <td className="c">{formatEntier(ligne.classes)}</td>
              <td className="c">{formatEntier(ligne.admis)}</td>
              <td className="c">{formatEntier(ligne.ajournes)}</td>
              <td className="c nom">{formatPourcent(ligne.tauxReussite)}</td>
              <td className="c">{formatNote(ligne.moyenne)}</td>
              <td className="c">{formatNote(ligne.major)}</td>
              <td className="c">{formatEntier(ligne.mentions.tresBien)}</td>
              <td className="c">{formatEntier(ligne.mentions.bien)}</td>
              <td className="c">{formatEntier(ligne.mentions.assezBien)}</td>
              <td className="c">{formatEntier(ligne.mentions.passable)}</td>
            </tr>
          ))}
          {lignes.length === 0 && (
            <tr><td colSpan={COLONNES} className="vide">Aucune session archivée pour le moment.</td></tr>
          )}
          {lignes.length > 0 && (
            <tr className="synthese" data-testid="bilan-synthese">
              <td className="c">Synthèse</td>
              <td colSpan={2}>{synthese.sessions} session{synthese.sessions > 1 ? 's' : ''}</td>
              <td className="c">{formatEntier(synthese.effectif)}</td>
              <td className="c">{formatEntier(synthese.classes)}</td>
              <td className="c">{formatEntier(synthese.admis)}</td>
              <td className="c">{formatEntier(synthese.ajournes)}</td>
              <td className="c">{formatPourcent(synthese.tauxReussite)}</td>
              <td className="c">{formatNote(synthese.moyenne)}</td>
              <td className="c">{formatNote(synthese.major)}</td>
              <td className="c">{formatEntier(synthese.mentions.tresBien)}</td>
              <td className="c">{formatEntier(synthese.mentions.bien)}</td>
              <td className="c">{formatEntier(synthese.mentions.assezBien)}</td>
              <td className="c">{formatEntier(synthese.mentions.passable)}</td>
            </tr>
          )}
        </tbody>
        <PiedDocument colonnes={COLONNES} texte={piedDeDocument(sources)} complement="Statistiques calculées à partir des notes enregistrées" />
      </table>

      {barres.length > 0 && (
        <div className="archives-graphique" data-testid="bilan-graphique">
          <div className="archives-graphique-titre">Taux de réussite par session (%)</div>
          <div className="archives-barres">
            {barres.map((barre) => (
              <div key={barre.id} className="archives-barre">
                <div className="archives-barre-valeur">{barre.valeur == null ? VALEUR_ABSENTE : formatPourcent(barre.valeur)}</div>
                <div
                  className={`archives-barre-colonne${barre.valeur == null ? ' sans-valeur' : ''}`}
                  /* Zone de 42 mm : 36 mm pour la barre (100 %), le reste pour la valeur écrite au-dessus. */
                  style={barre.valeur == null ? undefined : { height: `${(barre.hauteur * 0.36).toFixed(2)}mm` }}
                />
              </div>
            ))}
          </div>
          <div className="archives-barres-libelles">
            {barres.map((barre) => (
              <div key={barre.id}>
                <strong>{barre.libelle}</strong>
                <span>{barre.sousLibelle}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
