import React from 'react';
import { AppSettings, Candidate, CandidateComputedStats } from '../../types';
import type { SourcesEnTeteDocument } from '../../utils/documentPaysage';
import {
  TITRE_PROCES_VERBAL,
  classeMention,
  classePodium,
  decisionImprimee,
  libelleRangImprime,
  mentionVerrouillage,
  nombreFr,
  partiesResumePalmares,
  repartitionMentions,
  statistiquesPalmares,
  tauxFr,
} from '../../utils/procesVerbal';
import {
  TITRE_CHEF_CENTRE,
  TITRE_PRESIDENT_JURY,
  etablissementOrigineAffiche,
  libelleNiveauSerie,
  totauxParEtablissement,
} from '../../utils/sessionMode';
import { titreChefDepuisSettings } from '../../utils/titreChef';
import { settingsEnTete } from '../ListeCandidatsSheet';
import { EnTeteDocument, PiedDocument, piedDeDocument } from './EnTeteDocument';

interface ProcesVerbalSheetProps {
  /** Tous les candidats de la session (statistiques, totaux par établissement). */
  candidates: Candidate[];
  /** Candidats imprimés, déjà triés dans l'ordre du palmarès et filtrés (tous / admis / ajournés). */
  lignes: Candidate[];
  /** Libellé du filtre actif (« Tous les candidats », « Admis », « Ajournés »). */
  libelleFiltre: string;
  allStats: Record<string, CandidateComputedStats>;
  sessionInter: boolean;
  /** Nom du centre d'examen (établissement hôte) ; en interne, le nom de l'établissement. */
  centreExamen: string;
  selectedSession: string;
  /** Libellé du type d'examen (long de préférence). */
  examType?: string;
  academicYear?: string;
  settings?: AppSettings;
  /** PV verrouillé par le jury : mention discrète en bas de la feuille. */
  juryLocked: boolean;
  /** Date ISO du verrouillage, si connue. */
  juryLockedAt?: string | null;
}

/**
 * Procès-verbal de délibération imprimable (A4 paysage, gabarit commun `.document-paysage`) : masqué à l'écran,
 * rendu seulement sous `body[data-print-mode='registre']`. En-tête décoré avec le logo de l'établissement en
 * session interne ; en inter-établissements l'emplacement du logo reste vide mais le décor est conservé et
 * l'en-tête porte « CENTRE D'EXAMEN : … ». Palmarès avec pastilles de rang, de mention et de décision,
 * encadré de statistiques et zone de signatures ; en inter, blocs par niveau / série et totaux par établissement.
 */
export const ProcesVerbalSheet: React.FC<ProcesVerbalSheetProps> = ({
  candidates,
  lignes,
  libelleFiltre,
  allStats,
  sessionInter,
  centreExamen,
  selectedSession,
  examType,
  academicYear,
  settings,
  juryLocked,
  juryLockedAt,
}) => {
  const nomEtablissement = (settings?.institutionName ?? '').trim() || centreExamen;
  const nomCentre = (centreExamen || '').trim() || nomEtablissement;
  const sources: SourcesEnTeteDocument = {
    titre: TITRE_PROCES_VERBAL,
    settings: settingsEnTete(settings, nomCentre),
    sessionInter,
    centreExamen: nomCentre,
    typeExamen: examType,
    sessionNom: selectedSession,
    anneeScolaire: academicYear,
  };
  const stats = statistiquesPalmares(candidates, allStats);
  const totaux = sessionInter ? totauxParEtablissement(candidates, allStats, nomCentre) : [];
  const origine = (cand: Candidate): string => (sessionInter ? etablissementOrigineAffiche(cand, nomCentre) : cand.originSchool);
  const groupeDe = (cand: Candidate): string => (sessionInter ? libelleNiveauSerie(cand) : '');
  const effectifGroupe = (groupe: string): number => candidates.filter((c) => libelleNiveauSerie(c) === groupe).length;
  const colonnes = sessionInter ? 9 : 8;

  // Signataires : en inter-établissements, le président du jury et le chef du centre ; en interne, le président
  // du jury (ligne vide) et le chef d'établissement (Le Directeur au collège, Le Proviseur au lycée, ou le titre du profil).
  const titreChef = sessionInter
    ? TITRE_CHEF_CENTRE
    : titreChefDepuisSettings({ jurySignerTitle: settings?.jurySignerTitle, typeEtablissement: settings?.typeEtablissement, institutionName: nomEtablissement }, candidates);
  const nomChef = (settings?.jurySignerName ?? '').trim();

  return (
    <div className="document-paysage pv-sheet" data-testid="proces-verbal-sheet">
      <EnTeteDocument
        {...sources}
        emplacementLogo
        meta={[
          { label: 'Palmarès', value: `${libelleFiltre} (${lignes.length})` },
          {
            label: 'Résultats',
            multiligne: true,
            value: partiesResumePalmares(stats).map((partie, i) => (
              <React.Fragment key={partie}>
                {i > 0 && <span className="document-paysage-sep"> • </span>}
                <span className="pv-resume-partie">{partie}</span>
              </React.Fragment>
            )),
          },
        ]}
      />

      <table className="document-paysage-table pv-table pv-palmares">
        <colgroup>
          <col style={{ width: '15mm' }} />
          <col style={{ width: '14mm' }} />
          <col />
          {sessionInter && <col style={{ width: '52mm' }} />}
          <col style={{ width: '12mm' }} />
          <col style={{ width: '27mm' }} />
          <col style={{ width: '18mm' }} />
          <col style={{ width: '26mm' }} />
          <col style={{ width: '22mm' }} />
        </colgroup>
        <thead>
          <tr>
            <th className="c">Rang</th>
            <th className="c">N° table</th>
            <th>Candidat &amp; matricule</th>
            {sessionInter && <th>Établissement d'origine</th>}
            <th className="c">Genre</th>
            <th className="r">Points / max</th>
            <th className="r">Moyenne</th>
            <th className="c">Mention</th>
            <th className="c">Décision</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((cand, idx) => {
            const s = allStats[cand.id];
            const groupe = groupeDe(cand);
            const nouveauGroupe = sessionInter && (idx === 0 || groupeDe(lignes[idx - 1]) !== groupe);
            const decision = decisionImprimee(s?.decision);
            return (
              <React.Fragment key={cand.id}>
                {nouveauGroupe && (
                  <tr className="pv-groupe">
                    <td colSpan={colonnes}>
                      {groupe || 'Sans niveau'} — {effectifGroupe(groupe)} candidat{effectifGroupe(groupe) > 1 ? 's' : ''} (rang dans le groupe)
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="c">
                    {s?.evaluated ? <span className={classePodium(s.rank)}>{libelleRangImprime(s.rank)}</span> : '—'}
                  </td>
                  <td className="c mono">{cand.tableNumber}</td>
                  <td>
                    <div className="pv-nom">{cand.fullName}</div>
                    <div className="pv-matricule">{cand.matricule}</div>
                  </td>
                  {sessionInter && <td className="pv-origine">{origine(cand)}</td>}
                  <td className="c">{cand.gender === 'M' ? 'M' : 'F'}</td>
                  <td className="r mono">{s?.totalPoints.toFixed(2) ?? '0.00'} / {s?.pointsMax.toFixed(0) ?? '—'}</td>
                  <td className="r mono pv-moyenne">{s?.average.toFixed(2) ?? '0.00'}</td>
                  <td className="c"><span className={classeMention(s?.mention)}>{s?.mention || 'EN COURS'}</span></td>
                  <td className="c"><span className={decision.classe}>{decision.texte}</span></td>
                </tr>
              </React.Fragment>
            );
          })}
          {lignes.length === 0 && (
            <tr><td colSpan={colonnes} className="vide">Aucun candidat pour ce filtre.</td></tr>
          )}
        </tbody>
        <PiedDocument colonnes={colonnes} texte={piedDeDocument(sources)} complement={`${candidates.length} candidat${candidates.length > 1 ? 's' : ''}`} />
      </table>

      {sessionInter && totaux.length > 0 && (
        <div className="pv-totaux" data-testid="pv-totaux-etablissements-imprime">
          <div className="pv-section-titre">Résultats par établissement d'origine</div>
          <table className="document-paysage-table pv-table">
            <colgroup>
              <col />
              <col style={{ width: '30mm' }} />
              <col style={{ width: '30mm' }} />
              <col style={{ width: '30mm' }} />
              <col style={{ width: '34mm' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Établissement</th>
                <th className="r">Effectif</th>
                <th className="r">Évalués</th>
                <th className="r">Admis</th>
                <th className="r">Taux d'admission</th>
              </tr>
            </thead>
            <tbody>
              {totaux.map((t) => (
                <tr key={t.etablissement}>
                  <td className="nom">{t.etablissement}</td>
                  <td className="r mono">{t.effectif}</td>
                  <td className="r mono">{t.evalues}</td>
                  <td className="r mono pv-moyenne">{t.admis}</td>
                  <td className="r mono">{tauxFr(t.taux)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="pv-bas">
        <div className="pv-stats" data-testid="pv-statistiques">
          <div className="pv-section-titre">Statistiques</div>
          <dl className="pv-stats-grille">
            <div><dt>Effectif</dt><dd>{stats.effectif}</dd></div>
            <div><dt>Classés</dt><dd>{stats.classes}</dd></div>
            <div><dt>Admis</dt><dd className="pv-decision-admis">{stats.admis}</dd></div>
            <div><dt>Ajournés</dt><dd className="pv-decision-ajourne">{stats.ajournes}</dd></div>
            <div><dt>Taux</dt><dd>{tauxFr(stats.taux)}</dd></div>
            <div><dt>Moyenne max.</dt><dd>{nombreFr(stats.moyenneMax)}</dd></div>
            <div><dt>Moyenne min.</dt><dd>{nombreFr(stats.moyenneMin)}</dd></div>
            <div><dt>Moyenne session</dt><dd>{nombreFr(stats.moyenneSession)}</dd></div>
          </dl>
          <div className="pv-stats-mentions"><span>Mentions :</span> {repartitionMentions(stats)}</div>
          {juryLocked && (
            <div className="pv-verrou" data-testid="pv-verrou">{mentionVerrouillage(juryLockedAt)}</div>
          )}
        </div>

        <div className="pv-signature">
          <div className="pv-signature-titre">{TITRE_PRESIDENT_JURY}</div>
          <div className="pv-signature-espace" />
          <div className="pv-signature-nom">Nom et prénoms : ……………………</div>
        </div>
        <div className="pv-signature">
          <div className="pv-signature-titre">{titreChef}</div>
          <div className="pv-signature-espace" />
          <div className="pv-signature-nom">{nomChef || 'Nom et prénoms : ……………………'}</div>
        </div>
      </div>
    </div>
  );
};
