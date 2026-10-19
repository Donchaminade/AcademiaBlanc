import React, { useState, useMemo, useEffect } from 'react';
import { ArchivedSession, Candidate, CandidateComputedStats, AppSettings, AdminSection } from '../types';
import {
  getSchoolArchivedSessions,
  saveSchoolArchivedSessions,
  getCurrentSchoolId,
} from '../data/schoolsData';
import { archiverSession, loadArchives, retirerArchive } from '../api/archives';
import { printDocument } from '../utils/printDocument';
import { confirmDelete } from '../utils/alerts';
import { BilanArchivesSheet } from './print/BilanArchivesSheet';

interface ArchivedSessionsSectionProps {
  settings: AppSettings;
  candidates?: Candidate[];
  allStats?: Record<string, CandidateComputedStats>;
  onNavigateToBulletin?: () => void;
  /**
   * Session API active. Quand l'établissement est connecté à l'API, la vue n'affiche que les
   * archives réelles renvoyées par `GET /api/archives` ; le jeu de démonstration local est ignoré.
   */
  usingApi?: boolean;
  /** Session d'examen actuellement chargée depuis l'API (archivable en un clic). */
  activeSessionId?: number | null;
  /** Ouvre la session réelle correspondant à une archive (bouton « Consulter »). */
  onOpenSession?: (sessionId: number) => void;
  /** Ouvre l'écran Administration (API), par exemple sur les sessions. */
  onOpenAdmin?: (section?: AdminSection) => void;
}

export const ArchivedSessionsSection: React.FC<ArchivedSessionsSectionProps> = ({
  settings,
  candidates = [],
  allStats = {},
  usingApi = false,
  activeSessionId = null,
  onOpenSession,
  onOpenAdmin,
}) => {
  const currentSchoolId = getCurrentSchoolId();
  // En mode API, la liste part vide et se remplit uniquement avec les archives de l'établissement.
  const [sessions, setSessions] = useState<ArchivedSession[]>(() =>
    usingApi ? [] : getSchoolArchivedSessions(currentSchoolId)
  );
  const [loading, setLoading] = useState<boolean>(usingApi);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  const refreshFromApi = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setSessions(await loadArchives());
    } catch (err) {
      setSessions([]);
      setLoadError((err as Error).message || 'Impossible de charger les archives.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (usingApi) {
      void refreshFromApi();
    } else {
      setSessions(getSchoolArchivedSessions(currentSchoolId));
      setLoading(false);
      setLoadError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usingApi, currentSchoolId]);

  // Modal states
  const [showArchiveCurrentModal, setShowArchiveCurrentModal] = useState(false);
  const [showAddManualModal, setShowAddManualModal] = useState(false);
  const [selectedSessionForDetail, setSelectedSessionForDetail] = useState<ArchivedSession | null>(null);
  const [chartMetric, setChartMetric] = useState<'successRate' | 'average'>('successRate');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form state for archiving current session
  const [archiveNotes, setArchiveNotes] = useState(
    'Session régulière marquée par une bonne progression des candidats dans les séries scientifiques et littéraires.'
  );

  // Manual session form state
  const [manualForm, setManualForm] = useState({
    academicYear: '2020-2021',
    sessionName: 'BAC II Blanc 2021 - Série D',
    examType: 'BACCALAURÉAT DEUXIÈME PARTIE',
    candidatesCount: 30,
    admittedCount: 20,
    failedCount: 10,
    promoAverage: 10.95,
    highestAverage: 15.80,
    lowestAverage: 5.50,
    tresBien: 1,
    bien: 4,
    assezBien: 8,
    passable: 7,
    notes: 'Session d\'examen blanc sous protocole d\'émargement officiel.',
  });

  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Compute live current session stats if candidates are present
  const currentSessionLiveStats = useMemo(() => {
    if (!candidates || candidates.length === 0) {
      return null;
    }

    // Même règle que le bulletin et que l'API : admis à 10 de moyenne affichée, sinon ajourné ; un élève sans
    // aucune note n'est ni admis ni ajourné, et les taux portent sur les élèves classés.
    const count = candidates.length;
    let classes = 0;
    let admitted = 0;
    let failed = 0;
    let sumAvg = 0;
    let highest: number | null = null;
    let lowest: number | null = null;
    let tb = 0;
    let b = 0;
    let ab = 0;
    let p = 0;

    candidates.forEach((cand) => {
      const stat = allStats[cand.id];
      if (!stat || !stat.evaluated) return;
      const avg = stat.average;
      classes++;
      sumAvg += avg;
      if (highest === null || avg > highest) highest = avg;
      if (lowest === null || avg < lowest) lowest = avg;

      if (stat.decision === 'ADMIS') admitted++;
      else if (stat.decision === 'AJOURNÉ') failed++;

      if (stat.mention === 'TRÈS BIEN') tb++;
      else if (stat.mention === 'BIEN') b++;
      else if (stat.mention === 'ASSEZ BIEN') ab++;
      else if (stat.mention === 'PASSABLE') p++;
    });

    const promoAvg = classes > 0 ? Math.round((sumAvg / classes) * 100) / 100 : 0;
    const admittedRate = classes > 0 ? Math.round((admitted / classes) * 10000) / 100 : 0;
    const failedRate = classes > 0 ? Math.round((failed / classes) * 10000) / 100 : 0;

    return {
      candidatesCount: count,
      admittedCount: admitted,
      admittedRate,
      failedCount: failed,
      failedRate,
      promoAverage: promoAvg,
      highestAverage: highest ?? 0,
      lowestAverage: lowest ?? 0,
      mentionsBreakdown: {
        tresBien: tb,
        bien: b,
        assezBien: ab,
        passable: p,
      },
    };
  }, [candidates, allStats]);

  // Combined sorted list of sessions for multi-year timeline (chronological order)
  const sortedSessionsChronological = useMemo(() => {
    return [...sessions].sort((a, b) => a.academicYear.localeCompare(b.academicYear));
  }, [sessions]);

  // Reverse chronological (newest first) for table display
  const sortedSessionsDesc = useMemo(() => {
    return [...sessions].sort((a, b) => b.academicYear.localeCompare(a.academicYear));
  }, [sessions]);

  // Save changes to localStorage (demo mode only: API archives live on the server)
  const updateAndPersistSessions = (newList: ArchivedSession[]) => {
    setSessions(newList);
    if (!usingApi) saveSchoolArchivedSessions(currentSchoolId, newList);
  };

  // Archive current session
  const handleConfirmArchiveCurrent = () => {
    if (usingApi) {
      if (!activeSessionId) return;
      setArchiving(true);
      archiverSession(activeSessionId)
        .then(async (archived) => {
          await refreshFromApi();
          setShowArchiveCurrentModal(false);
          showNotification(`Session ${archived.sessionName} archivée : ses statistiques réelles figurent dans le registre.`);
        })
        .catch((err: Error) => showNotification(err.message || 'Archivage impossible.'))
        .finally(() => setArchiving(false));
      return;
    }
    if (!currentSessionLiveStats) return;

    // Check if session for this academic year already archived
    const existingIndex = sessions.findIndex((s) => s.academicYear === settings.academicYear);
    const newArchived: ArchivedSession = {
      id: `arch-${currentSchoolId}-${settings.academicYear}-${Date.now()}`,
      schoolId: currentSchoolId,
      academicYear: settings.academicYear,
      sessionName: settings.sessionName,
      examType: settings.examType,
      archivedAt: new Date().toLocaleDateString('fr-FR'),
      candidatesCount: currentSessionLiveStats.candidatesCount,
      admittedCount: currentSessionLiveStats.admittedCount,
      admittedRate: currentSessionLiveStats.admittedRate,
      failedCount: currentSessionLiveStats.failedCount,
      failedRate: currentSessionLiveStats.failedRate,
      promoAverage: currentSessionLiveStats.promoAverage,
      highestAverage: currentSessionLiveStats.highestAverage,
      lowestAverage: currentSessionLiveStats.lowestAverage,
      mentionsBreakdown: currentSessionLiveStats.mentionsBreakdown,
      notes: archiveNotes,
      signers: {
        principal: settings.jurySignerName,
      },
    };

    let updatedList: ArchivedSession[];
    if (existingIndex >= 0) {
      updatedList = [...sessions];
      updatedList[existingIndex] = newArchived;
      showNotification(`Session ${settings.academicYear} mise à jour dans les archives de l'établissement !`);
    } else {
      updatedList = [newArchived, ...sessions];
      showNotification(`Session ${settings.academicYear} archivée avec succès !`);
    }

    updateAndPersistSessions(updatedList);
    setShowArchiveCurrentModal(false);
  };

  // Add manual session
  const handleAddManualSession = (e: React.FormEvent) => {
    e.preventDefault();
    const total = Number(manualForm.candidatesCount);
    const adm = Number(manualForm.admittedCount);
    const fail = Number(manualForm.failedCount);

    const admittedRate = total > 0 ? Math.round((adm / total) * 10000) / 100 : 0;
    const failedRate = total > 0 ? Math.round((fail / total) * 10000) / 100 : 0;

    const newArchived: ArchivedSession = {
      id: `arch-${currentSchoolId}-${manualForm.academicYear}-${Date.now()}`,
      schoolId: currentSchoolId,
      academicYear: manualForm.academicYear,
      sessionName: manualForm.sessionName,
      examType: manualForm.examType,
      archivedAt: new Date().toLocaleDateString('fr-FR'),
      candidatesCount: total,
      admittedCount: adm,
      admittedRate,
      failedCount: fail,
      failedRate,
      promoAverage: Number(manualForm.promoAverage),
      highestAverage: Number(manualForm.highestAverage),
      lowestAverage: Number(manualForm.lowestAverage),
      mentionsBreakdown: {
        tresBien: Number(manualForm.tresBien),
        bien: Number(manualForm.bien),
        assezBien: Number(manualForm.assezBien),
        passable: Number(manualForm.passable),
      },
      notes: manualForm.notes,
      signers: {
        principal: settings.jurySignerName,
      },
    };

    const updated = [newArchived, ...sessions];
    updateAndPersistSessions(updated);
    setShowAddManualModal(false);
    showNotification(`Session d'archive ${manualForm.academicYear} enregistrée !`);
  };

  // Delete an archived session
  const handleDeleteSession = async (session: ArchivedSession) => {
    const { id, academicYear: year } = session;
    if (usingApi && session.sessionId) {
      const ok = await confirmDelete(
        `archive de la session ${session.sessionName} (${year})`,
        'La session redeviendra ouverte dans Administration ; ses élèves, notes et bulletins sont conservés.'
      );
      if (!ok) return;
      try {
        await retirerArchive(session.sessionId);
        await refreshFromApi();
        if (selectedSessionForDetail?.id === id) setSelectedSessionForDetail(null);
        showNotification(`Session ${year} retirée des archives.`);
      } catch (err) {
        showNotification((err as Error).message || 'Suppression impossible.');
      }
      return;
    }
    if (await confirmDelete(`archive de la session ${year}`, 'Les statistiques archivées de cette session seront perdues.')) {
      const updated = sessions.filter((s) => s.id !== id);
      updateAndPersistSessions(updated);
      if (selectedSessionForDetail?.id === id) {
        setSelectedSessionForDetail(null);
      }
      showNotification(`Session ${year} supprimée des archives.`);
    }
  };

  // « Consulter » : ouvre la session réelle quand elle existe, sinon la fiche d'archive.
  const handleConsult = (session: ArchivedSession) => {
    if (usingApi && session.sessionId && onOpenSession) {
      onOpenSession(session.sessionId);
      return;
    }
    setSelectedSessionForDetail(session);
  };

  const canArchiveCurrent = currentSessionLiveStats != null && (!usingApi || activeSessionId != null);
  const hasSessions = sessions.length > 0;

  // Totaux affichés quel que soit le nombre de sessions (0 quand le registre est vide)
  const totals = useMemo(() => {
    const candidates = sortedSessionsChronological.reduce((acc, s) => acc + s.candidatesCount, 0);
    const avgSuccess = sortedSessionsChronological.length === 0
      ? 0
      : Math.round(
        (sortedSessionsChronological.reduce((acc, s) => acc + s.admittedRate, 0) / sortedSessionsChronological.length) * 10
      ) / 10;
    return { candidates, avgSuccess };
  }, [sortedSessionsChronological]);

  // Key performance comparison metrics (deltas : au moins 2 sessions)
  const comparisonMetrics = useMemo(() => {
    if (sortedSessionsChronological.length < 2) return null;
    const first = sortedSessionsChronological[0];
    const last = sortedSessionsChronological[sortedSessionsChronological.length - 1];

    const rateDelta = Math.round((last.admittedRate - first.admittedRate) * 100) / 100;
    const avgDelta = Math.round((last.promoAverage - first.promoAverage) * 100) / 100;
    const totalCandidates = sortedSessionsChronological.reduce((acc, s) => acc + s.candidatesCount, 0);
    const avgSuccess =
      Math.round(
        (sortedSessionsChronological.reduce((acc, s) => acc + s.admittedRate, 0) /
          sortedSessionsChronological.length) *
          10
      ) / 10;

    return {
      rateDelta,
      avgDelta,
      totalCandidates,
      avgSuccess,
      firstYear: first.academicYear,
      lastYear: last.academicYear,
    };
  }, [sortedSessionsChronological]);

  return (
    <>
    {/* Écran : masqué à l'impression du bilan (`body[data-print-mode='archives']`) au profit de la feuille paysage. */}
    <div className="archives-ui space-y-6">
      {/* Banner: Archiving & Multi-Year Overview */}
      <div className="min-w-0 bg-gradient-to-r from-[#00236f] via-[#003cb3] to-[#0051d5] rounded-xl p-6 text-white shadow-md border border-[#90a8ff]/20">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex max-w-full flex-wrap items-center gap-2 px-2.5 py-0.5 rounded-full bg-white/15 text-[11px] font-bold uppercase tracking-wider">
              <span className="material-symbols-outlined text-sm shrink-0">history_edu</span>
              <span>Mémoire Académique &amp; Évaluation Pluriannuelle</span>
            </div>
            {!usingApi && (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400 text-[#3b2a00] text-[10px] font-bold uppercase tracking-wider"
                title="Jeu de données fictif affiché hors connexion. Connectez l'établissement pour voir ses archives réelles."
              >
                <span className="material-symbols-outlined text-xs">science</span>
                Données de démonstration
              </span>
            )}
          </div>
          <h3 className="text-xl font-bold tracking-tight leading-snug">
            Archives des Sessions &amp; Comparatif Interannuel
          </h3>
          <p className="text-[12.5px] text-white/80 leading-relaxed">
            {usingApi ? (
              <>
                Statistiques calculées uniquement à partir des sessions clôturées et des notes enregistrées pour l'établissement <strong className="text-white">« {settings.institutionName} »</strong>. Archivez la session en cours en un clic pour l'ajouter au registre.
              </>
            ) : (
              <>
                Exemple de registre pluriannuel pour <strong className="text-white">« {settings.institutionName} »</strong> : les chiffres ci-dessous sont fictifs et servent uniquement à présenter l'écran. Connectez l'établissement pour afficher ses archives réelles.
              </>
            )}
          </p>
        </div>

        <div className="mt-5 flex w-full flex-wrap items-center gap-2">
          {canArchiveCurrent && (
            <button
              type="button"
              onClick={() => setShowArchiveCurrentModal(true)}
              className="inline-flex max-w-full shrink-0 items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[12px] text-left shadow-sm transition-all active:scale-95"
              title={`Clôturer et archiver la session ${settings.sessionName || settings.academicYear}`}
            >
              <span className="material-symbols-outlined text-base shrink-0">archive</span>
              <span className="min-w-0 whitespace-normal">Archiver la Session Actuelle ({settings.academicYear})</span>
            </button>
          )}

          {!usingApi && (
            <button
              type="button"
              onClick={() => setShowAddManualModal(true)}
              className="inline-flex max-w-full shrink-0 items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-[12px] text-left transition-all border border-white/20"
            >
              <span className="material-symbols-outlined text-base shrink-0">add</span>
              <span className="min-w-0 whitespace-normal">Ajouter une Session Antérieure</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => printDocument('archives', `Bilan_sessions_${settings.institutionName}`)}
            className="inline-flex max-w-full shrink-0 items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-[12px] text-left transition-all border border-white/20"
            title="Imprimer le bilan des sessions d'examen (A4 paysage : tableau comparatif et graphique)"
            data-testid="bouton-imprimer-bilan"
          >
            <span className="material-symbols-outlined text-base shrink-0">print</span>
            <span className="whitespace-nowrap">Imprimer Bilan</span>
          </button>
        </div>
      </div>

      {/* Comparative KPI Cards : toujours visibles ; les deltas n'ont de sens qu'à partir de 2 sessions. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-[#eaedff] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#444651] uppercase tracking-wider block">
              Sessions Archivées
            </span>
            <span className="text-2xl font-bold text-[#00236f] mt-0.5 block">
              {sessions.length} {sessions.length > 1 ? 'Années' : 'Année'}
            </span>
            <span className="text-[11px] text-[#444651]">
              {comparisonMetrics
                ? `De ${comparisonMetrics.firstYear} à ${comparisonMetrics.lastYear}`
                : hasSessions
                ? `Session ${sortedSessionsChronological[0].academicYear}`
                : 'Aucune session clôturée'}
            </span>
          </div>
          <div className="w-11 h-11 rounded-lg bg-[#eaedff] flex items-center justify-center text-[#0051d5]">
            <span className="material-symbols-outlined text-2xl">event_repeat</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-[#eaedff] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#444651] uppercase tracking-wider block">
              Progression du Taux
            </span>
            {comparisonMetrics ? (
              <span
                className={`text-2xl font-bold mt-0.5 block ${
                  comparisonMetrics.rateDelta >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {comparisonMetrics.rateDelta >= 0 ? `+${comparisonMetrics.rateDelta}%` : `${comparisonMetrics.rateDelta}%`}
              </span>
            ) : (
              <span className="text-2xl font-bold mt-0.5 block text-[#9ca3af]">—</span>
            )}
            <span className="text-[11px] text-[#444651]">
              {comparisonMetrics ? 'Sur toute la période observée' : 'Disponible à partir de 2 sessions'}
            </span>
          </div>
          <div className="w-11 h-11 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
            <span className="material-symbols-outlined text-2xl">trending_up</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-[#eaedff] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#444651] uppercase tracking-wider block">
              Évolution de la Moyenne
            </span>
            {comparisonMetrics ? (
              <span
                className={`text-2xl font-bold mt-0.5 block ${
                  comparisonMetrics.avgDelta >= 0 ? 'text-[#0051d5]' : 'text-red-600'
                }`}
              >
                {comparisonMetrics.avgDelta >= 0 ? `+${comparisonMetrics.avgDelta} pts` : `${comparisonMetrics.avgDelta} pts`}
              </span>
            ) : (
              <span className="text-2xl font-bold mt-0.5 block text-[#9ca3af]">—</span>
            )}
            <span className="text-[11px] text-[#444651]">
              {comparisonMetrics ? 'Moyenne globale des promotions' : 'Disponible à partir de 2 sessions'}
            </span>
          </div>
          <div className="w-11 h-11 rounded-lg bg-[#eaedff] flex items-center justify-center text-[#0051d5]">
            <span className="material-symbols-outlined text-2xl">analytics</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-[#eaedff] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#444651] uppercase tracking-wider block">
              Candidats Historiques
            </span>
            <span className="text-2xl font-bold text-[#00236f] mt-0.5 block">
              {totals.candidates} {totals.candidates > 1 ? 'Élèves' : 'Élève'}
            </span>
            <span className="text-[11px] text-[#444651]">
              Taux moyen de réussite : {totals.candidates > 0 ? `${totals.avgSuccess}%` : '—'}
            </span>
          </div>
          <div className="w-11 h-11 rounded-lg bg-[#f2f3ff] flex items-center justify-center text-[#00236f]">
            <span className="material-symbols-outlined text-2xl">school</span>
          </div>
        </div>
      </div>

      {/* État de chargement / erreur (mode API) */}
      {usingApi && loading && (
        <div className="bg-white p-5 rounded-lg border border-[#eaedff] shadow-xs text-[13px] text-[#444651] flex items-center gap-2">
          <span className="material-symbols-outlined text-[#0051d5] animate-spin text-base">progress_activity</span>
          Chargement des archives de l'établissement…
        </div>
      )}
      {usingApi && !loading && loadError && (
        <div className="bg-red-50 p-5 rounded-lg border border-red-200 text-[13px] text-red-800 flex flex-wrap items-center justify-between gap-3">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => void refreshFromApi()}
            className="px-3 py-1.5 rounded bg-white border border-red-200 text-red-800 text-[12px] font-bold hover:bg-red-100"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* État vide : aucune session archivée */}
      {!loading && !loadError && !hasSessions && (
        <div className="bg-[#f2f3ff] border border-[#dce1ff] rounded-lg p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-[#0051d5] text-3xl">inventory_2</span>
              <div>
                <h4 className="text-[16px] font-bold text-[#00236f]">Aucune session archivée pour le moment.</h4>
                <p className="text-[13px] text-[#444651] mt-1 max-w-2xl">
                  Les sessions clôturées apparaîtront ici.
                  {usingApi
                    ? ' Créez vos sessions d’examen dans Administration, saisissez les notes, puis archivez la session en cours depuis ce même écran : ses statistiques réelles (effectif, admis, taux de réussite, moyenne de promotion, mentions) alimenteront le graphique et le tableau comparatif.'
                    : ' Archivez la session en cours ou ajoutez une session antérieure pour alimenter le comparateur.'}
                </p>
              </div>
            </div>
            {usingApi && onOpenAdmin && (
              <button
                type="button"
                onClick={() => onOpenAdmin('sessions')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#0051d5] text-white text-[13px] font-semibold hover:bg-[#003cb3] transition-colors shadow-xs"
              >
                <span className="material-symbols-outlined text-base">admin_panel_settings</span>
                <span>Ouvrir l’Administration (API)</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Multi-Year Visual Evolution Chart */}
      {hasSessions && (
      <div className="bg-white p-5 rounded-lg border border-[#eaedff] shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#eaedff]">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#0051d5]">
              Visualisation Graphique
            </span>
            <h4 className="text-[16px] font-bold text-[#00236f]">
              Évolution Comparée des Performances Interannuelles
            </h4>
          </div>

          <div className="inline-flex items-center bg-[#f2f3ff] p-1 rounded-md text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setChartMetric('successRate')}
              className={`px-3 py-1.5 rounded transition-all ${
                chartMetric === 'successRate'
                  ? 'bg-[#0051d5] text-white shadow-xs'
                  : 'text-[#444651] hover:text-[#00236f]'
              }`}
            >
              Taux de Réussite (%)
            </button>
            <button
              type="button"
              onClick={() => setChartMetric('average')}
              className={`px-3 py-1.5 rounded transition-all ${
                chartMetric === 'average'
                  ? 'bg-[#0051d5] text-white shadow-xs'
                  : 'text-[#444651] hover:text-[#00236f]'
              }`}
            >
              Moyenne Générale (/20)
            </button>
          </div>
        </div>

        {/* Visual Bar Chart */}
        <div className="pt-4 pb-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 items-end">
            {sortedSessionsChronological.map((sess, idx) => {
              const isSuccess = chartMetric === 'successRate';
              const val = isSuccess ? sess.admittedRate : sess.promoAverage;
              const maxVal = isSuccess ? 100 : 20;
              const pctHeight = Math.max(15, Math.min(100, Math.round((val / maxVal) * 100)));

              // Prev year comparison
              const prev = idx > 0 ? sortedSessionsChronological[idx - 1] : null;
              const prevVal = prev ? (isSuccess ? prev.admittedRate : prev.promoAverage) : null;
              const delta = prevVal !== null ? Math.round((val - prevVal) * 100) / 100 : null;

              return (
                <div key={sess.id} className="flex flex-col items-center group">
                  {/* Delta indicator pill */}
                  <div className="h-6 flex items-center mb-1">
                    {delta !== null ? (
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                          delta >= 0
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        <span className="material-symbols-outlined text-xs">
                          {delta >= 0 ? 'arrow_upward' : 'arrow_downward'}
                        </span>
                        {delta >= 0 ? `+${delta}` : delta}
                        {isSuccess ? '%' : ' pts'}
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#444651] uppercase font-semibold">
                        Session Référence
                      </span>
                    )}
                  </div>

                  {/* Value tag */}
                  <span className="text-[15px] font-bold text-[#00236f] mb-1">
                    {val.toFixed(2)}
                    {isSuccess ? '%' : ' / 20'}
                  </span>

                  {/* Visual Bar Column */}
                  <div className="w-full max-w-[120px] h-44 bg-[#f2f3ff] rounded-t-lg p-1.5 flex flex-col justify-end border border-[#eaedff] relative">
                    <div
                      style={{ height: `${pctHeight}%` }}
                      className={`w-full rounded-t-md transition-all duration-500 shadow-sm relative group-hover:brightness-110 flex flex-col justify-between p-1.5 ${
                        isSuccess
                          ? val >= 75
                            ? 'bg-gradient-to-t from-[#003cb3] to-emerald-500'
                            : 'bg-gradient-to-t from-[#003cb3] to-[#0051d5]'
                          : 'bg-gradient-to-t from-[#1e3a8a] to-[#316bf3]'
                      }`}
                    >
                      <span className="text-[10px] text-white/90 font-bold self-center">
                        {sess.admittedCount}/{sess.candidatesCount} adm.
                      </span>
                    </div>
                  </div>

                  {/* Label under bar */}
                  <div className="text-center mt-2 space-y-0.5">
                    <span className="font-bold text-[13px] text-[#00236f] block">
                      {sess.academicYear}
                    </span>
                    <span className="text-[11px] text-[#444651] block font-medium truncate max-w-[140px]">
                      {sess.sessionName}
                    </span>
                    <span className="text-[10px] text-[#0051d5] font-semibold bg-[#eaedff] px-2 py-0.5 rounded">
                      {sess.candidatesCount} candidats
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      )}

      {/* Multi-Year Detailed Comparative Table */}
      {hasSessions && (
      <div className="bg-white rounded-lg border border-[#eaedff] shadow-xs overflow-hidden">
        <div className="p-5 border-b border-[#eaedff] flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#0051d5]">
              Registre d'Archives
            </span>
            <h4 className="text-[16px] font-bold text-[#00236f]">
              Tableau Comparatif des Sessions d'Examens ({sessions.length})
            </h4>
          </div>
          {usingApi ? (
            <span className="text-[11.5px] text-[#444651]">
              Statistiques calculées à partir des notes enregistrées de l'établissement
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-amber-900 bg-amber-100 border border-amber-200 px-2.5 py-0.5 rounded-full">
              <span className="material-symbols-outlined text-xs">science</span>
              Données de démonstration
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[12px]">
            <thead>
              <tr className="bg-[#f2f3ff] text-[#00236f] font-bold border-b border-[#eaedff]">
                <th className="py-3 px-4">Année Scolaire</th>
                <th className="py-3 px-3">Session &amp; Série</th>
                <th className="py-3 px-3 text-center">Effectif</th>
                <th className="py-3 px-3 text-center">Admis</th>
                <th className="py-3 px-3 text-center">Taux Réussite</th>
                <th className="py-3 px-3 text-center">Ajournés</th>
                <th className="py-3 px-3 text-center">Moyenne Promo</th>
                <th className="py-3 px-3 text-center">Major (Note Max)</th>
                <th className="py-3 px-4 text-center">Mentions TB / B</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eaedff]">
              {sortedSessionsDesc.map((session) => (
                <tr key={session.id} className="hover:bg-[#f9faff] transition-colors">
                  <td className="py-3 px-4 font-bold text-[#00236f]">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-base text-[#0051d5]">event</span>
                      <span>{session.academicYear}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-semibold text-[#131b2e] block">
                      {session.sessionName}
                    </span>
                    <span className="text-[10px] text-[#444651] uppercase">
                      Archivé le {session.archivedAt}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center font-bold">
                    {session.candidatesCount}
                  </td>
                  <td className="py-3 px-3 text-center font-bold text-emerald-700">
                    {session.admittedCount}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                        session.admittedRate >= 75
                          ? 'bg-emerald-100 text-emerald-800'
                          : session.admittedRate >= 50
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {session.admittedRate.toFixed(2)}%
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center text-red-700 font-semibold">
                    {session.failedCount} ({session.failedRate.toFixed(1)}%)
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-bold text-[#0051d5]">
                    {session.promoAverage.toFixed(2)} / 20
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-bold text-[#00236f]">
                    {session.highestAverage.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-[11px]">
                      <span className="px-1.5 py-0.5 rounded bg-[#0051d5] text-white font-bold" title="Très Bien">
                        TB: {session.mentionsBreakdown.tresBien}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-[#eaedff] text-[#00236f] font-bold" title="Bien">
                        B: {session.mentionsBreakdown.bien}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => handleConsult(session)}
                        className="px-2.5 py-1 rounded bg-[#eaedff] hover:bg-[#dce1ff] text-[#00236f] text-[11px] font-bold transition-colors"
                        title={usingApi && session.sessionId
                          ? 'Ouvrir cette session (procès-verbal et bulletins)'
                          : 'Consulter le rapport complet de cette session'}
                      >
                        Consulter
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteSession(session)}
                        className="p-1 rounded text-red-500 hover:bg-red-50 transition-colors"
                        title={usingApi && session.sessionId
                          ? 'Retirer des archives (la session redevient ouverte)'
                          : 'Supprimer cette archive'}
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Modal: Archiver la Session Actuelle */}
      {showArchiveCurrentModal && currentSessionLiveStats && (
        <div className="modal-overlay fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="modal-panel bg-white rounded-xl shadow-2xl border border-[#eaedff] max-w-xl w-full p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#eaedff]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">archive</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#00236f]">
                    Archiver la Session en Cours
                  </h3>
                  <span className="text-[12px] text-[#444651]">
                    {settings.academicYear} • {settings.sessionName}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowArchiveCurrentModal(false)}
                className="text-[#444651] hover:text-[#131b2e] p-1 rounded"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Live Stats Preview */}
            <div className="bg-[#f2f3ff] p-4 rounded-lg border border-[#eaedff] space-y-2.5 text-[12px]">
              <span className="font-bold text-[#00236f] uppercase tracking-wide block">
                Statistiques calculées en direct sur le registre actuel :
              </span>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white p-2 rounded shadow-2xs">
                  <span className="text-[10px] text-[#444651] block uppercase">Candidats</span>
                  <span className="text-[16px] font-bold text-[#00236f]">
                    {currentSessionLiveStats.candidatesCount}
                  </span>
                </div>
                <div className="bg-white p-2 rounded shadow-2xs">
                  <span className="text-[10px] text-[#444651] block uppercase">Taux Réussite</span>
                  <span className="text-[16px] font-bold text-emerald-600">
                    {currentSessionLiveStats.admittedRate}%
                  </span>
                </div>
                <div className="bg-white p-2 rounded shadow-2xs">
                  <span className="text-[10px] text-[#444651] block uppercase">Moyenne Promo</span>
                  <span className="text-[16px] font-bold text-[#0051d5]">
                    {currentSessionLiveStats.promoAverage} / 20
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#444651] pt-1">
                <span>Admis: <strong>{currentSessionLiveStats.admittedCount}</strong></span>
                <span>Ajournés: <strong>{currentSessionLiveStats.failedCount}</strong></span>
                <span>Major: <strong>{currentSessionLiveStats.highestAverage} / 20</strong></span>
              </div>
            </div>

            {usingApi ? (
              <p className="text-[12px] text-[#444651] leading-relaxed bg-amber-50 border border-amber-200 rounded-lg p-3">
                La session passe au statut <strong>ARCHIVÉE</strong> sur le serveur : ses statistiques définitives
                (effectif, admis, ajournés, moyenne de promotion, major, mentions) sont calculées à partir
                des notes enregistrées, avec les mêmes règles que le bulletin. Vous pourrez la retirer des archives à tout moment.
              </p>
            ) : (
              <div>
                <label className="block text-[11.5px] font-bold uppercase text-[#444651] mb-1">
                  Observations Officielles &amp; Remarques du Conseil de Délibération
                </label>
                <textarea
                  rows={3}
                  value={archiveNotes}
                  onChange={(e) => setArchiveNotes(e.target.value)}
                  className="w-full bg-[#f2f3ff] text-[12.5px] p-2.5 rounded-lg border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5]"
                  placeholder="Indiquez ici les faits marquants de cette session..."
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#eaedff]">
              <button
                type="button"
                onClick={() => setShowArchiveCurrentModal(false)}
                className="px-4 py-2 rounded-lg text-[12px] font-semibold text-[#444651] hover:bg-[#f2f3ff]"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmArchiveCurrent}
                disabled={archiving}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[12px] shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {archiving ? 'Archivage en cours…' : "Confirmer l'Archivage Officiel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Ajouter Manuellement une Session Passée */}
      {showAddManualModal && (
        <div className="modal-overlay fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleAddManualSession}
            className="modal-panel bg-white rounded-xl shadow-2xl border border-[#eaedff] max-w-xl w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#eaedff]">
              <h3 className="text-lg font-bold text-[#00236f] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#0051d5]">note_add</span>
                Ajouter une Session d'Archives Passée
              </h3>
              <button
                type="button"
                onClick={() => setShowAddManualModal(false)}
                className="text-[#444651] hover:text-[#131b2e] p-1 rounded"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[12px]">
              <div>
                <label className="block font-bold text-[#444651] uppercase text-[10px] mb-1">
                  Année Scolaire (ex: 2020-2021)
                </label>
                <input
                  type="text"
                  required
                  value={manualForm.academicYear}
                  onChange={(e) => setManualForm({ ...manualForm, academicYear: e.target.value })}
                  className="w-full bg-[#f2f3ff] py-1.5 px-2.5 rounded border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#444651] uppercase text-[10px] mb-1">
                  Nom de la Session
                </label>
                <input
                  type="text"
                  required
                  value={manualForm.sessionName}
                  onChange={(e) => setManualForm({ ...manualForm, sessionName: e.target.value })}
                  className="w-full bg-[#f2f3ff] py-1.5 px-2.5 rounded border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#444651] uppercase text-[10px] mb-1">
                  Nombre Total de Candidats
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={manualForm.candidatesCount}
                  onChange={(e) => setManualForm({ ...manualForm, candidatesCount: Number(e.target.value) })}
                  className="w-full bg-[#f2f3ff] py-1.5 px-2.5 rounded border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#444651] uppercase text-[10px] mb-1">
                  Admis (Moyenne &gt;= 10)
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  value={manualForm.admittedCount}
                  onChange={(e) => setManualForm({ ...manualForm, admittedCount: Number(e.target.value) })}
                  className="w-full bg-[#f2f3ff] py-1.5 px-2.5 rounded border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#444651] uppercase text-[10px] mb-1">
                  Ajournés (Moyenne &lt; 10)
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  value={manualForm.failedCount}
                  onChange={(e) => setManualForm({ ...manualForm, failedCount: Number(e.target.value) })}
                  className="w-full bg-[#f2f3ff] py-1.5 px-2.5 rounded border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#444651] uppercase text-[10px] mb-1">
                  Moyenne Générale de Promo (/20)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min={0}
                  max={20}
                  value={manualForm.promoAverage}
                  onChange={(e) => setManualForm({ ...manualForm, promoAverage: Number(e.target.value) })}
                  className="w-full bg-[#f2f3ff] py-1.5 px-2.5 rounded border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#444651] uppercase text-[10px] mb-1">
                  Meilleure Note (Major)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min={0}
                  max={20}
                  value={manualForm.highestAverage}
                  onChange={(e) => setManualForm({ ...manualForm, highestAverage: Number(e.target.value) })}
                  className="w-full bg-[#f2f3ff] py-1.5 px-2.5 rounded border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-[#444651] mb-1">
                Observations de la Session
              </label>
              <textarea
                rows={2}
                value={manualForm.notes}
                onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                className="w-full bg-[#f2f3ff] text-[12px] p-2 rounded border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#eaedff]">
              <button
                type="button"
                onClick={() => setShowAddManualModal(false)}
                className="px-4 py-2 rounded-lg text-[12px] font-semibold text-[#444651] hover:bg-[#f2f3ff]"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-[#0051d5] hover:bg-[#003ea8] text-white font-bold text-[12px] shadow-sm transition-all"
              >
                Enregistrer l'Archive
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Détails d'une Session Archivée */}
      {selectedSessionForDetail && (
        <div className="modal-overlay fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="modal-panel bg-white rounded-xl shadow-2xl border border-[#eaedff] max-w-2xl w-full p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#eaedff]">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#0051d5]">
                  Fiche Officielle d'Archive
                </span>
                <h3 className="text-xl font-bold text-[#00236f]">
                  Session {selectedSessionForDetail.academicYear} • {selectedSessionForDetail.sessionName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSessionForDetail(null)}
                className="text-[#444651] hover:text-[#131b2e] p-1 rounded"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#f2f3ff] p-3 rounded-lg text-center border border-[#eaedff]">
                <span className="text-[10px] text-[#444651] uppercase font-bold block">Effectif</span>
                <span className="text-xl font-bold text-[#00236f]">{selectedSessionForDetail.candidatesCount}</span>
              </div>
              <div className="bg-emerald-50 p-3 rounded-lg text-center border border-emerald-100">
                <span className="text-[10px] text-emerald-800 uppercase font-bold block">Taux Réussite</span>
                <span className="text-xl font-bold text-emerald-700">{selectedSessionForDetail.admittedRate}%</span>
              </div>
              <div className="bg-[#eaedff] p-3 rounded-lg text-center border border-[#dce1ff]">
                <span className="text-[10px] text-[#00236f] uppercase font-bold block">Moyenne Promo</span>
                <span className="text-xl font-bold text-[#0051d5]">{selectedSessionForDetail.promoAverage} / 20</span>
              </div>
              <div className="bg-[#f2f3ff] p-3 rounded-lg text-center border border-[#eaedff]">
                <span className="text-[10px] text-[#444651] uppercase font-bold block">Major de Promo</span>
                <span className="text-xl font-bold text-[#00236f]">{selectedSessionForDetail.highestAverage} / 20</span>
              </div>
            </div>

            {/* Mentions Breakdown */}
            <div className="p-4 bg-white rounded-lg border border-[#eaedff] space-y-2">
              <span className="text-[11px] font-bold text-[#00236f] uppercase block">
                Répartition des Mentions Obtenues
              </span>
              <div className="grid grid-cols-4 gap-2 text-center text-[12px]">
                <div className="p-2 rounded bg-amber-50 border border-amber-200">
                  <span className="block text-[10px] text-amber-800 uppercase font-bold">Très Bien</span>
                  <span className="text-lg font-bold text-amber-900">{selectedSessionForDetail.mentionsBreakdown.tresBien}</span>
                </div>
                <div className="p-2 rounded bg-blue-50 border border-blue-200">
                  <span className="block text-[10px] text-blue-800 uppercase font-bold">Bien</span>
                  <span className="text-lg font-bold text-blue-900">{selectedSessionForDetail.mentionsBreakdown.bien}</span>
                </div>
                <div className="p-2 rounded bg-[#eaedff] border border-[#dce1ff]">
                  <span className="block text-[10px] text-[#00236f] uppercase font-bold">Assez Bien</span>
                  <span className="text-lg font-bold text-[#00236f]">{selectedSessionForDetail.mentionsBreakdown.assezBien}</span>
                </div>
                <div className="p-2 rounded bg-gray-50 border border-gray-200">
                  <span className="block text-[10px] text-gray-700 uppercase font-bold">Passable</span>
                  <span className="text-lg font-bold text-gray-800">{selectedSessionForDetail.mentionsBreakdown.passable}</span>
                </div>
              </div>
            </div>

            {/* Notes & Jury observations */}
            {selectedSessionForDetail.notes && (
              <div className="bg-[#f2f3ff] p-3.5 rounded-lg border border-[#eaedff]">
                <span className="text-[11px] font-bold text-[#444651] uppercase block mb-1">
                  Observations Officielles du Jury
                </span>
                <p className="text-[12.5px] italic text-[#131b2e] leading-relaxed">
                  « {selectedSessionForDetail.notes} »
                </p>
              </div>
            )}

            <div className="flex items-center justify-between text-[11px] text-[#444651] pt-2 border-t border-[#eaedff]">
              <span>Établissement : <strong>{settings.institutionName}</strong></span>
              <span>Date d'archivage : <strong>{selectedSessionForDetail.archivedAt}</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* Floating Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-[#00236f] text-white px-4 py-3 rounded shadow-2xl flex items-center gap-2.5 z-50 animate-bounce text-[12px] font-medium border border-[#90a8ff]/30">
          <span className="material-symbols-outlined text-[#316bf3] text-base">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
    <BilanArchivesSheet sessions={sessions} settings={settings} demonstration={!usingApi} />
    </>
  );
};
