import React, { useState } from 'react';
import { AppSettings, Candidate, CandidateComputedStats } from '../types';
import { decisionBucket } from '../utils/bulletinMetrics';
import { ligneTitreBulletin } from '../utils/bulletinEntete';
import { printDocument } from '../utils/printDocument';
import { titreChefDepuisSettings } from '../utils/titreChef';
import {
  TITRE_CHEF_CENTRE,
  TITRE_PRESIDENT_JURY,
  etablissementOrigineAffiche,
  libelleNiveauSerie,
  ligneCentreExamen,
  totauxParEtablissement,
  trierPalmares,
} from '../utils/sessionMode';

type FiltreDecision = 'all' | 'admis' | 'ajourne';

const LIBELLES_FILTRE: Record<FiltreDecision, string> = {
  all: 'Tous les candidats',
  admis: 'Admis',
  ajourne: 'Ajournés',
};

/** Décision pour la colonne étroite du PV imprimé : « Admis », « Ajourné », « — » sans note. */
const decisionCourte = (decision: string | null | undefined): string => {
  switch (decisionBucket(decision)) {
    case 'admis': return 'Admis';
    case 'ajourne': return 'Ajourné';
    default: return '—';
  }
};

const libelleRang = (rank: number): string =>
  rank === 1 ? '1er' : `${rank}e`;

interface RecordsViewProps {
  candidates: Candidate[];
  allStats: Record<string, CandidateComputedStats>;
  onSelectCandidate: (candidate: Candidate) => void;
  onNavigateToBulletin: (candidate: Candidate) => void;
  selectedSession: string;
  selectedCenter: string;
  /** Libellé court du type d'examen de la session active (« BEPC », « BAC II ») ; absent en démonstration. */
  examType?: string;
  /** Libellé long du type d'examen (`type_examen.libelle_long`), pour l'en-tête imprimé ; absent en démonstration. */
  examTypeLong?: string;
  /** Paramètres de l'établissement : nom, année scolaire et signataire officiel du PV imprimé. */
  settings?: AppSettings;
  juryLocked: boolean;
  onToggleJuryLock: () => void;
  /**
   * Session inter-établissements : palmarès par niveau / série (rang calculé dans le groupe sur toute la
   * session), en-tête « Centre d'examen », établissement d'origine toujours renseigné, totaux par établissement.
   */
  sessionInter?: boolean;
  /** Nom du centre d'examen (établissement hôte) en session inter-établissements. */
  centreExamen?: string;
  /** Session inter-établissements, droit TRANSFERTS : envoyer les résultats aux établissements d'origine. */
  onOpenTransferts?: () => void;
  /** Session issue d'un transfert : centre d'examen émetteur (bandeau d'information). */
  transfertCentre?: string;
}

export const RecordsView: React.FC<RecordsViewProps> = ({
  candidates,
  allStats,
  onNavigateToBulletin,
  selectedSession,
  selectedCenter,
  examType,
  examTypeLong,
  settings,
  juryLocked,
  onToggleJuryLock,
  sessionInter = false,
  centreExamen = '',
  onOpenTransferts,
  transfertCentre,
}) => {
  const [filterDecision, setFilterDecision] = useState<FiltreDecision>('all');

  // En-tête imprimé : mêmes sources que le bandeau du bulletin (type d'examen et intitulé de la session en base).
  const titreSession = ligneTitreBulletin({
    typeExamenLibelle: examTypeLong ?? examType ?? settings?.examType,
    sessionNom: selectedSession || settings?.sessionName,
  });
  const anneeScolaire = (settings?.academicYear ?? '').trim();
  const nomEtablissement = (settings?.institutionName ?? '').trim() || selectedCenter;
  const nomCentre = (centreExamen || '').trim() || nomEtablissement;
  // En inter-établissements, le PV est signé par le chef du centre (responsable de l'établissement hôte) ; sinon par le
  // chef d'établissement : Le Directeur si la session est de collège, Le Proviseur au lycée (ou le titre saisi dans le profil).
  const signataireTitre = sessionInter
    ? TITRE_CHEF_CENTRE
    : titreChefDepuisSettings({ jurySignerTitle: settings?.jurySignerTitle, typeEtablissement: settings?.typeEtablissement, institutionName: nomEtablissement }, candidates);
  const signataireNom = (settings?.jurySignerName ?? '').trim();
  const dateEdition = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const bulletinsSignes = candidates.filter((cand) => Boolean(cand.digitalSignature)).length;
  const origine = (cand: Candidate): string => (sessionInter ? etablissementOrigineAffiche(cand, nomCentre) : cand.originSchool);

  // Palmarès : par moyenne décroissante ; en inter-établissements, par niveau / série puis moyenne
  // (le rang de chaque candidat est celui de son groupe sur toute la session).
  const sorted = trierPalmares(candidates, allStats, sessionInter);
  const totauxEtablissements = sessionInter ? totauxParEtablissement(candidates, allStats, nomCentre) : [];
  /** Libellé du groupe affiché en tête de chaque bloc du palmarès inter (« 3e », « Tle D »). */
  const groupeDe = (cand: Candidate): string => (sessionInter ? libelleNiveauSerie(cand) : '');
  const effectifGroupe = (groupe: string): number => candidates.filter((c) => libelleNiveauSerie(c) === groupe).length;

  // Compteurs des filtres : admis (moyenne affichée ≥ 10) et ajournés ; un élève sans note n'est dans aucun des deux.
  const nbAdmis = sorted.filter((c) => decisionBucket(allStats[c.id]?.decision) === 'admis').length;
  const nbAjournes = sorted.filter((c) => decisionBucket(allStats[c.id]?.decision) === 'ajourne').length;

  const filtered = sorted.filter((c) => {
    const stats = allStats[c.id];
    if (filterDecision === 'admis') return decisionBucket(stats?.decision) === 'admis';
    if (filterDecision === 'ajourne') return decisionBucket(stats?.decision) === 'ajourne';
    return true;
  });

  const csvCell = (value: string | number) => {
    const raw = String(value ?? '');
    const guarded = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
    return `"${guarded.replace(/"/g, '""')}"`;
  };

  const exportCSV = () => {
    const lines = [`Rang,Table,Matricule,Nom et Prenoms,Genre,${sessionInter ? 'Classe / serie,' : ''}Etablissement,Total Points,Total Maximum,Moyenne,Mention,Decision`];
    sorted.forEach((c) => {
      const s = allStats[c.id];
      lines.push([
        csvCell(s?.rank ?? '—'),
        csvCell(c.tableNumber),
        csvCell(c.matricule),
        csvCell(c.fullName),
        csvCell(c.gender),
        ...(sessionInter ? [csvCell(libelleNiveauSerie(c))] : []),
        csvCell(origine(c)),
        csvCell(s?.totalPoints ?? 0),
        csvCell(s?.pointsMax ?? 0),
        csvCell(s?.average ?? 0),
        csvCell(s?.mention ?? ''),
        csvCell(s?.decision ?? ''),
      ].join(','));
    });
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PV_DELIBERATION_${selectedSession.replace(/[^\p{L}\p{N}._-]+/gu, '_')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <>
    <div className="registre-ui p-4 md:p-8 max-w-[1440px] mx-auto space-y-4 md:space-y-6">
      {transfertCentre && (
        <div
          className="bg-[#fff3e0] border border-[#ffcc80] rounded px-4 py-2.5 text-[12px] text-[#8a4b00] flex items-center gap-2 no-print"
          role="status"
          data-testid="bandeau-session-transfert"
        >
          <span className="material-symbols-outlined text-base">move_to_inbox</span>
          <span>
            <strong>Session issue d’un transfert — centre : {transfertCentre}.</strong>{' '}
            Rang et extrêmes de l’examen commun ; les notes du centre ne se modifient pas ici.
          </span>
        </div>
      )}
      {/* Official Header */}
      <div className="bg-white rounded p-4 md:p-6 shadow-sm border border-[#eaedff] flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#0051d5] bg-[#eaedff] px-2.5 py-1 rounded">
            Procès-Verbal de Délibération
          </span>
          <h2 className="text-[18px] md:text-[22px] font-bold text-[#00236f] mt-1.5">
            Palmarès Général &amp; Registre des Épreuves
          </h2>
          <p className="text-[13px] text-[#444651] mt-0.5">
            {examType ? `${examType} • ` : ''}{selectedSession} • {sessionInter ? `Centre d'examen : ${nomCentre}` : selectedCenter}
          </p>
          {sessionInter && (
            <p className="text-[11.5px] text-[#8a4b00] mt-1" data-testid="pv-inter-info">
              Session inter-établissements : rang calculé par niveau / série sur l'ensemble des candidats du centre, toutes classes confondues.
            </p>
          )}
        </div>

        <div className="toolbar-actions flex items-center gap-2 flex-wrap w-full md:w-auto">
          <button
            type="button"
            onClick={exportCSV}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded bg-[#eaedff] text-[#00236f] text-[12px] font-semibold hover:bg-[#dce1ff] transition-colors"
          >
            <span className="material-symbols-outlined text-base">download</span>
            <span>Exporter en CSV</span>
          </button>

          {sessionInter && onOpenTransferts && (
            <button
              type="button"
              onClick={onOpenTransferts}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded bg-[#fff3e0] text-[#8a4b00] border border-[#ffcc80] text-[12px] font-semibold hover:bg-[#ffe6c2] transition-colors"
              title="Envoyer les notes et le classement aux établissements d'origine (code de transfert du destinataire)"
              data-testid="bouton-transferts-pv"
            >
              <span className="material-symbols-outlined text-base">swap_horiz</span>
              <span>Transferts aux établissements</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => printDocument('registre', `PV_${selectedSession}`)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded bg-[#eaedff] text-[#00236f] text-[12px] font-semibold hover:bg-[#dce1ff] transition-colors"
          >
            <span className="material-symbols-outlined text-base">print</span>
            <span>Imprimer le Registre</span>
          </button>

          <button
            type="button"
            onClick={onToggleJuryLock}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded text-white text-[12px] font-semibold transition-all shadow-xs ${
              juryLocked ? 'bg-[#00236f] hover:bg-[#1e3a8a]' : 'bg-[#ba1a1a] hover:bg-[#93000a]'
            }`}
          >
            <span className="material-symbols-outlined text-base">
              {juryLocked ? 'lock' : 'lock_open'}
            </span>
            <span>{juryLocked ? 'PV verrouillé — cliquer pour déverrouiller' : 'Verrouiller le PV'}</span>
          </button>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="bg-white p-3.5 rounded border border-[#eaedff] shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <span className="text-[#444651] font-semibold uppercase text-[11px]">Filtrer le palmarès :</span>
          <button
            type="button"
            onClick={() => setFilterDecision('all')}
            className={`px-3 py-1 rounded font-semibold transition-colors ${
              filterDecision === 'all'
                ? 'bg-[#00236f] text-white'
                : 'bg-[#f2f3ff] text-[#444651] hover:text-[#131b2e]'
            }`}
          >
            Tous les candidats ({candidates.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterDecision('admis')}
            className={`px-3 py-1 rounded font-semibold transition-colors ${
              filterDecision === 'admis'
                ? 'bg-emerald-600 text-white'
                : 'bg-[#f2f3ff] text-[#444651] hover:text-[#131b2e]'
            }`}
          >
            Admis ({nbAdmis})
          </button>
          <button
            type="button"
            onClick={() => setFilterDecision('ajourne')}
            className={`px-3 py-1 rounded font-semibold transition-colors ${
              filterDecision === 'ajourne'
                ? 'bg-[#ba1a1a] text-white'
                : 'bg-[#f2f3ff] text-[#444651] hover:text-[#131b2e]'
            }`}
          >
            Ajournés ({nbAjournes})
          </button>
        </div>

        <span className="font-mono text-[11px] text-[#444651]">
          {filtered.length} candidats listés
        </span>
      </div>

      {/* Official Ranking Table */}
      <div className="bg-white rounded border border-[#eaedff] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-sticky-first w-full text-left border-collapse text-[12px]">
            <thead>
              <tr className="bg-[#00236f] text-white">
                <th className="py-2.5 px-3 font-semibold text-center w-16">Rang</th>
                <th className="py-2.5 px-2 font-semibold text-center w-16">Table</th>
                <th className="py-2.5 px-3 font-semibold">Candidat &amp; Matricule</th>
                <th className="py-2.5 px-3 font-semibold">Établissement d'Origine</th>
                <th className="py-2.5 px-2 font-semibold text-center">Genre</th>
                <th className="py-2.5 px-2 font-semibold text-right">Points / max</th>
                <th className="py-2.5 px-2 font-semibold text-right">Moyenne</th>
                <th className="py-2.5 px-3 font-semibold text-center">Mention</th>
                <th className="py-2.5 px-3 font-semibold">Décision</th>
                <th className="py-2.5 px-3 font-semibold text-center">Visa &amp; Bulletin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eaedff]">
              {filtered.map((cand, idx) => {
                const s = allStats[cand.id];
                const isEven = idx % 2 === 0;
                const groupe = groupeDe(cand);
                const nouveauGroupe = sessionInter && (idx === 0 || groupeDe(filtered[idx - 1]) !== groupe);
                return (
                  <React.Fragment key={cand.id}>
                  {nouveauGroupe && (
                    <tr className="bg-[#eaedff]">
                      <td colSpan={10} className="py-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-[#00236f]">
                        {groupe || 'Sans niveau'} — {effectifGroupe(groupe)} candidat{effectifGroupe(groupe) > 1 ? 's' : ''}
                      </td>
                    </tr>
                  )}
                  <tr
                    className={`${isEven ? 'bg-white' : 'bg-[#faf8ff]'} hover:bg-[#eaedff]/60 transition-colors`}
                  >
                    <td className="py-2.5 px-3 font-mono font-bold text-center">
                      {s ? (
                        <span className={`inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded text-[11px] ${
                          s.rank === 1
                            ? 'bg-amber-100 text-amber-900 border border-amber-300 font-extrabold shadow-xs'
                            : s.rank === 2
                            ? 'bg-slate-100 text-slate-800 border border-slate-300 font-bold'
                            : s.rank === 3
                            ? 'bg-orange-100 text-orange-900 border border-orange-300 font-bold'
                            : 'text-[#00236f]'
                        }`}>
                          {s.rank === 1 ? '🥇 1er' : s.rank === 2 ? '🥈 2e' : s.rank === 3 ? '🥉 3e' : `${s.rank < 10 ? `0${s.rank}` : s.rank}e`}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2.5 px-2 font-mono font-semibold text-center text-[#0051d5]">
                      {cand.tableNumber}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-[#131b2e]">{cand.fullName}</div>
                      <div className="font-mono text-[11px] text-[#444651]">{cand.matricule}</div>
                    </td>
                    <td className="py-2.5 px-3 text-[#444651]">{origine(cand)}</td>
                    <td className="py-2.5 px-2 text-center font-medium">
                      {cand.gender === 'M' ? 'M' : 'F'}
                    </td>
                    <td className="py-2.5 px-2 font-mono text-right font-bold text-[#131b2e] whitespace-nowrap">
                      {s?.totalPoints.toFixed(2) || '0.00'}
                      <span className="block text-[10px] font-medium text-[#444651]" title="20 × Σ coefficients du programme de la classe">
                        / {s?.pointsMax.toFixed(0) || '—'}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 font-mono text-right font-bold text-[#00236f] text-[13px]">
                      {s?.average.toFixed(2) || '0.00'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-tight uppercase ${
                          s?.mention === 'TRÈS BIEN' || s?.mention === 'BIEN'
                            ? 'bg-[#0051d5] text-white'
                            : s?.mention === 'ASSEZ BIEN'
                            ? 'bg-[#eaedff] text-[#00236f]'
                            : s?.mention === 'PASSABLE'
                            ? 'bg-[#eaedff] text-[#0051d5]'
                            : s?.mention === 'AJOURNÉ'
                            ? 'bg-[#ffdad6] text-[#ba1a1a]'
                            : 'bg-[#f2f3ff] text-[#444651]'
                        }`}
                      >
                        {s?.mention || 'EN COURS'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-[11px]">
                      <span
                        className={
                          s?.decision === 'ADMIS'
                            ? 'text-emerald-700'
                            : s?.decision === 'AJOURNÉ'
                            ? 'text-[#ba1a1a]'
                            : 'text-[#444651]'
                        }
                      >
                        {s?.decision ?? '—'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => onNavigateToBulletin(cand)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#eaedff] text-[#00236f] hover:bg-[#dce1ff] text-[11px] font-semibold transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">visibility</span>
                        <span>Bulletin</span>
                      </button>
                    </td>
                  </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {sessionInter && totauxEtablissements.length > 0 && (
        <div className="bg-white rounded border border-[#eaedff] shadow-sm overflow-hidden" data-testid="pv-totaux-etablissements">
          <div className="px-4 py-2.5 border-b border-[#eaedff] text-[12px] font-bold uppercase tracking-wider text-[#00236f]">
            Résultats par établissement d'origine
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[12px]">
            <thead>
              <tr className="bg-[#f2f3ff] text-[#444651]">
                <th className="py-2 px-4 font-semibold">Établissement</th>
                <th className="py-2 px-3 font-semibold text-right">Effectif</th>
                <th className="py-2 px-3 font-semibold text-right">Évalués</th>
                <th className="py-2 px-3 font-semibold text-right">Admis</th>
                <th className="py-2 px-4 font-semibold text-right">Taux d'admission</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eaedff]">
              {totauxEtablissements.map((t) => (
                <tr key={t.etablissement}>
                  <td className="py-2 px-4 font-semibold text-[#131b2e]">{t.etablissement}</td>
                  <td className="py-2 px-3 font-mono text-right">{t.effectif}</td>
                  <td className="py-2 px-3 font-mono text-right">{t.evalues}</td>
                  <td className="py-2 px-3 font-mono text-right text-[#0051d5] font-bold">{t.admis}</td>
                  <td className="py-2 px-4 font-mono text-right">{t.taux == null ? '—' : `${t.taux.toFixed(1)} %`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Closing Protocol Certification Box */}
      <div className="bg-[#f2f3ff] p-4 md:p-5 rounded border border-[#eaedff] shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#0051d5]">security</span>
            <span className="text-[13px] font-bold text-[#00236f]">
              Certification &amp; Clôture Numérique du Procès-Verbal
            </span>
          </div>
          <p className="text-[12px] text-[#444651] break-words">
            {bulletinsSignes > 0
              ? `${bulletinsSignes} bulletin${bulletinsSignes > 1 ? 's' : ''} signé${bulletinsSignes > 1 ? 's' : ''} électroniquement sur ${candidates.length} • Procès-verbal édité le ${dateEdition}.`
              : `Aucun bulletin signé électroniquement pour l'instant • Procès-verbal édité le ${dateEdition}.`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-white text-[#0051d5] text-[12px] font-semibold shadow-xs border border-[#eaedff]">
            <span className="material-symbols-outlined text-base">{signataireNom ? 'verified' : 'badge'}</span>
            <span>{signataireNom ? `${signataireTitre} : ${signataireNom}` : 'Signataire à renseigner dans le profil de l’établissement'}</span>
          </span>
        </div>
      </div>
    </div>

    {/* Gabarit imprimé du PV (visible uniquement à l'impression, mode « registre ») */}
    <div className="registre-sheet">
      <div className="registre-head">
        <div>
          <div className="registre-school">{sessionInter ? ligneCentreExamen(nomCentre) : nomEtablissement}</div>
          <h1 className="registre-title">Procès-verbal de délibération — Palmarès</h1>
          <div className="registre-subtitle">
            {[titreSession, anneeScolaire].filter(Boolean).join(' • ')}
          </div>
        </div>
        <div className="registre-meta">
          <div>{LIBELLES_FILTRE[filterDecision]} ({filtered.length})</div>
          <div>Édité le {dateEdition}</div>
        </div>
      </div>

      <table className="registre-table">
        <colgroup>
          <col style={{ width: '6%' }} />
          <col style={{ width: '6%' }} />
          <col style={{ width: '24%' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '6%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '12%' }} />
        </colgroup>
        <thead>
          <tr>
            <th className="c">Rang</th>
            <th className="c">Table</th>
            <th>Candidat &amp; matricule</th>
            <th>Établissement d'origine</th>
            <th className="c">Genre</th>
            <th className="r">Points / max</th>
            <th className="r">Moyenne</th>
            <th className="c">Mention</th>
            <th>Décision</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((cand, idx) => {
            const s = allStats[cand.id];
            const groupe = groupeDe(cand);
            const nouveauGroupe = sessionInter && (idx === 0 || groupeDe(filtered[idx - 1]) !== groupe);
            return (
              <React.Fragment key={cand.id}>
              {nouveauGroupe && (
                <tr className="registre-groupe">
                  <td colSpan={9}>{groupe || 'Sans niveau'} — {effectifGroupe(groupe)} candidat{effectifGroupe(groupe) > 1 ? 's' : ''} (rang dans le groupe)</td>
                </tr>
              )}
              <tr>
                <td className="c">
                  {s ? (
                    <span className={s.rank <= 3 ? 'registre-badge registre-podium' : ''}>{libelleRang(s.rank)}</span>
                  ) : '—'}
                </td>
                <td className="c mono">{cand.tableNumber}</td>
                <td>
                  <div className="registre-name">{cand.fullName}</div>
                  <div className="registre-matricule">{cand.matricule}</div>
                </td>
                <td>{origine(cand)}</td>
                <td className="c">{cand.gender === 'M' ? 'M' : 'F'}</td>
                <td className="r mono">{s?.totalPoints.toFixed(2) ?? '0.00'} / {s?.pointsMax.toFixed(0) ?? '—'}</td>
                <td className="r mono registre-moyenne">{s?.average.toFixed(2) ?? '0.00'}</td>
                <td className="c"><span className="registre-badge">{s?.mention || 'EN COURS'}</span></td>
                <td>{decisionCourte(s?.decision)}</td>
              </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {sessionInter && totauxEtablissements.length > 0 && (
        <div className="registre-totaux">
          <div className="registre-subtitle">Résultats par établissement d'origine</div>
          <table className="registre-table">
            <colgroup>
              <col style={{ width: '52%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '12%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Établissement</th>
                <th className="r">Effectif</th>
                <th className="r">Évalués</th>
                <th className="r">Admis</th>
                <th className="r">Taux</th>
              </tr>
            </thead>
            <tbody>
              {totauxEtablissements.map((t) => (
                <tr key={t.etablissement}>
                  <td className="registre-name">{t.etablissement}</td>
                  <td className="r mono">{t.effectif}</td>
                  <td className="r mono">{t.evalues}</td>
                  <td className="r mono">{t.admis}</td>
                  <td className="r mono">{t.taux == null ? '—' : `${t.taux.toFixed(1)} %`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="registre-signatures">
        {sessionInter && (
          <div className="registre-signature">
            <div className="registre-signature-title">{TITRE_PRESIDENT_JURY}</div>
            <div className="registre-signature-space" />
            <div className="registre-signature-name">Nom et prénoms : ……………………</div>
          </div>
        )}
        <div className="registre-signature">
          <div className="registre-signature-title">{signataireTitre}</div>
          <div className="registre-signature-space" />
          {signataireNom && <div className="registre-signature-name">{signataireNom}</div>}
        </div>
      </div>
    </div>
    </>
  );
};
