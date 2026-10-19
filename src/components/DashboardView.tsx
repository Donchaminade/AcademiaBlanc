import React, { useMemo } from 'react';
import { Candidate, Subject, CandidateComputedStats, AdminSection } from '../types';
import { ADMIN_STEPS } from './AdminParametres';
import { DEMO_EXAM_LABEL } from '../utils/bulletinHeader';

interface DashboardViewProps {
  candidates: Candidate[];
  subjects: Subject[];
  allStats: Record<string, CandidateComputedStats>;
  onSelectCandidate: (candidate: Candidate) => void;
  onNavigate: (view: 'dashboard' | 'grading' | 'bulletin' | 'records' | 'students') => void;
  selectedSession: string;
  selectedCenter: string;
  /** Vrai quand les données proviennent de l'API de l'établissement (aucune valeur de démonstration). */
  usingApi?: boolean;
  /** Vrai si au moins une session existe côté API. */
  hasApiSession?: boolean;
  /** Libellé court du type d'examen de la session active (ex. « BEPC », « BAC II »), issu du référentiel de la plateforme. */
  examType?: string;
  /** Ouvre l'écran d'administration, éventuellement sur une section précise. */
  onOpenAdmin?: (section?: AdminSection) => void;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function standardDeviation(values: number[], mean: number): number {
  if (values.length === 0) return 0;
  const variance = values.reduce((acc, value) => acc + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

const MENTION_LABELS: Record<CandidateComputedStats['mention'], string> = {
  'TRÈS BIEN': 'Très Bien',
  'BIEN': 'Bien',
  'ASSEZ BIEN': 'Assez Bien',
  'PASSABLE': 'Passable',
  'RATTRAPAGE': 'Second Tour',
  'AJOURNÉ': 'Ajourné',
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  candidates,
  subjects,
  allStats,
  onSelectCandidate,
  onNavigate,
  selectedSession,
  selectedCenter,
  usingApi = false,
  hasApiSession = true,
  examType,
  onOpenAdmin,
}) => {
  const summary = useMemo(() => {
    const total = candidates.length;
    const boys = candidates.filter((c) => c.gender === 'M').length;
    const girls = total - boys;
    const evaluated = candidates.filter((c) => Object.keys(c.grades || {}).length > 0);
    const evaluatedStats = evaluated
      .map((c) => ({ candidate: c, stats: allStats[c.id] }))
      .filter((item): item is { candidate: Candidate; stats: CandidateComputedStats } => Boolean(item.stats));
    const averages = evaluatedStats.map((item) => item.stats.average);

    const admitted = evaluatedStats.filter((item) => item.stats.average >= 10).length;
    const secondTour = evaluatedStats.filter((item) => item.stats.average >= 8 && item.stats.average < 10).length;
    const ajournes = evaluatedStats.length - admitted - secondTour;
    const successRate = evaluatedStats.length > 0 ? round2((admitted / evaluatedStats.length) * 100) : null;

    const mean = averages.length > 0 ? round2(averages.reduce((acc, value) => acc + value, 0) / averages.length) : null;
    const med = averages.length > 0 ? round2(median(averages)) : null;
    const stdDev = averages.length > 0 && mean != null ? round2(standardDeviation(averages, mean)) : null;

    const major = evaluatedStats.reduce<{ candidate: Candidate; stats: CandidateComputedStats } | null>((best, item) => {
      if (!best || item.stats.average > best.stats.average) return item;
      return best;
    }, null);

    const mentionsCount: Record<CandidateComputedStats['mention'], number> = {
      'TRÈS BIEN': 0,
      'BIEN': 0,
      'ASSEZ BIEN': 0,
      'PASSABLE': 0,
      'RATTRAPAGE': 0,
      'AJOURNÉ': 0,
    };
    evaluatedStats.forEach((item) => {
      mentionsCount[item.stats.mention] += 1;
    });

    const totalCoef = subjects.reduce((acc, subject) => acc + subject.coef, 0);

    return {
      total,
      boys,
      girls,
      evaluatedCount: evaluatedStats.length,
      admitted,
      secondTour,
      ajournes,
      successRate,
      mean,
      median: med,
      stdDev,
      major,
      mentionsCount,
      totalCoef,
    };
  }, [candidates, allStats, subjects]);

  const isEmpty = summary.total === 0;
  const fmt = (value: number | null, digits = 2) => (value == null ? '—' : value.toFixed(digits));
  const sessionLabel = selectedSession || (usingApi ? 'Aucune session' : '');
  const centerLabel = selectedCenter || (usingApi ? 'Aucun centre' : '');
  const headerSubtitle = [sessionLabel, centerLabel].filter(Boolean).join(' • ');

  const renderGuidance = () => (
    <div className="mt-5 pt-4 border-t border-[#dce1ff]">
      <p className="text-[12px] font-bold text-[#00236f] uppercase tracking-wide">
        Par où commencer ? Ordre de saisie conseillé
      </p>
      <ol className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px]">
        {ADMIN_STEPS.map((step, index) => (
          <li key={step.section} className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onOpenAdmin?.(step.section)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-[#dce1ff] text-[#00236f] font-semibold hover:bg-[#eaedff] hover:border-[#0051d5] transition-colors"
            >
              <span className="font-mono text-[10px] text-[#0051d5]">{index + 1}</span>
              <span>{step.label}</span>
            </button>
            {index < ADMIN_STEPS.length - 1 && <span className="text-[#90a8ff]">→</span>}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[11px] text-[#444651]">
        Chaque lien ouvre l’écran Administration directement sur la section correspondante.
      </p>
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Session Header Banner */}
      <div className="bg-white rounded p-6 shadow-sm border border-[#eaedff] flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#0051d5] bg-[#eaedff] px-2.5 py-1 rounded">
              Contrôle Académique Officiel
            </span>
            <span className="text-[12px] text-[#444651]">
              {usingApi ? (examType || 'Session de l’établissement') : DEMO_EXAM_LABEL}
            </span>
          </div>
          <h2 className="text-[22px] font-bold text-[#00236f] mt-1.5">
            Tableau de Bord &amp; Synthèse de Délibération
          </h2>
          <p className="text-[13px] text-[#444651] mt-0.5">
            {headerSubtitle}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('grading')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#eaedff] text-[#00236f] text-[13px] font-semibold hover:bg-[#dce1ff] transition-colors"
          >
            <span className="material-symbols-outlined text-base">edit_note</span>
            <span>Accéder à la Saisie</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('records')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#00236f] text-white text-[13px] font-semibold hover:bg-[#1e3a8a] transition-colors shadow-xs"
          >
            <span className="material-symbols-outlined text-base">assignment_turned_in</span>
            <span>Voir le Procès-Verbal Global</span>
          </button>
        </div>
      </div>

      {/* Empty state: no student registered yet */}
      {isEmpty && (
        <div className="bg-[#f2f3ff] border border-[#dce1ff] rounded p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-[#0051d5] text-3xl">school</span>
              <div>
                <h3 className="text-[16px] font-bold text-[#00236f]">
                  {usingApi && !hasApiSession
                    ? 'Aucune session d’examen créée'
                    : 'Aucun élève inscrit pour cette session'}
                </h3>
                <p className="text-[13px] text-[#444651] mt-1 max-w-2xl">
                  {usingApi
                    ? 'Les statistiques ci-dessous se calculent uniquement à partir des élèves et des notes enregistrés dans la base de votre établissement. Commencez par renseigner vos données dans l’écran Administration.'
                    : 'Ajoutez des candidats depuis la liste des candidats pour voir apparaître les statistiques de la session.'}
                </p>
              </div>
            </div>
            {usingApi && onOpenAdmin ? (
              <button
                type="button"
                onClick={() => onOpenAdmin(hasApiSession ? 'eleves' : 'sessions')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#0051d5] text-white text-[13px] font-semibold hover:bg-[#003cb3] transition-colors shadow-xs"
              >
                <span className="material-symbols-outlined text-base">admin_panel_settings</span>
                <span>Ouvrir l’Administration (API)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate('students')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#0051d5] text-white text-[13px] font-semibold hover:bg-[#003cb3] transition-colors shadow-xs"
              >
                <span className="material-symbols-outlined text-base">group_add</span>
                <span>Inscrire des candidats</span>
              </button>
            )}
          </div>
          {usingApi && onOpenAdmin && renderGuidance()}
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-white p-5 rounded border border-[#eaedff] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-[#444651]">Effectif Évalué</span>
            <span className="material-symbols-outlined text-[#0051d5]">group</span>
          </div>
          <div className="my-2">
            <div className="font-sans text-[32px] font-bold text-[#00236f] leading-none">
              {summary.total}
            </div>
            <div className="font-mono text-[11px] text-[#444651] mt-1">
              {summary.total === 0
                ? 'Aucun élève inscrit'
                : `${summary.evaluatedCount}/${summary.total} avec notes saisies`}
            </div>
          </div>
          <div className="text-[12px] text-[#0051d5] font-medium pt-2 border-t border-[#eaedff] flex items-center justify-between">
            <span>Garçons: {summary.boys}</span>
            <span>Filles: {summary.girls}</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white p-5 rounded border border-[#eaedff] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-[#444651]">Taux de Réussite</span>
            <span className="material-symbols-outlined text-[#0051d5]">check_circle</span>
          </div>
          <div className="my-2">
            <div className="font-sans text-[32px] font-bold text-[#0051d5] leading-none">
              {summary.successRate == null ? '—' : `${summary.successRate.toFixed(1)}%`}
            </div>
            <div className="font-mono text-[11px] text-[#444651] mt-1">
              {summary.evaluatedCount === 0
                ? 'Aucune note saisie'
                : `${summary.admitted} admis d'office ou par délibération`}
            </div>
          </div>
          <div className="text-[12px] text-[#444651] pt-2 border-t border-[#eaedff] flex items-center justify-between font-mono">
            <span>2nd Tour: {summary.secondTour}</span>
            <span className="text-[#ba1a1a]">Ajournés: {summary.ajournes}</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white p-5 rounded border border-[#eaedff] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-[#444651]">Moyenne Promotion</span>
            <span className="material-symbols-outlined text-[#0051d5]">insights</span>
          </div>
          <div className="my-2">
            <div className="font-sans text-[32px] font-bold text-[#00236f] leading-none">
              {fmt(summary.mean)}
            </div>
            <div className="font-mono text-[11px] text-[#444651] mt-1">
              sur 20.00 (Seuil d'éligibilité: 10.00)
            </div>
          </div>
          <div className="text-[12px] text-[#0051d5] font-medium pt-2 border-t border-[#eaedff] flex items-center justify-between font-mono">
            <span>Médiane: {fmt(summary.median)}</span>
            <span>Écart type: {fmt(summary.stdDev)}</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white p-5 rounded border border-[#eaedff] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-[#444651]">Major de Promotion</span>
            <span className="material-symbols-outlined text-[#0051d5]">military_tech</span>
          </div>
          <div className="my-2">
            <div className="font-sans text-[28px] font-bold text-[#00236f] leading-none truncate">
              {summary.major ? summary.major.stats.average.toFixed(2) : '—'}
              <span className="text-[14px] font-normal text-[#444651]"> /20</span>
            </div>
            <div className="text-[12px] text-[#131b2e] font-semibold truncate mt-1">
              {summary.major ? summary.major.candidate.fullName : 'Aucun candidat évalué'}
            </div>
          </div>
          <div className="text-[11px] text-[#0051d5] font-semibold pt-2 border-t border-[#eaedff]">
            {summary.major
              ? `Mention ${MENTION_LABELS[summary.major.stats.mention]}${summary.major.candidate.tableNumber ? ` • Table N° ${summary.major.candidate.tableNumber}` : ''}`
              : 'En attente de notes'}
          </div>
        </div>
      </div>

      {/* Mentions Breakdown & Subject Benchmark Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Mentions Distribution */}
        <div className="lg:col-span-5 bg-white p-5 rounded border border-[#eaedff] shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-[15px] font-bold text-[#00236f] uppercase tracking-wide">
              Répartition des Mentions du Jury
            </h3>
            <p className="text-[12px] text-[#444651] mt-0.5">
              Conformité aux seuils ministériels officiels
            </p>

            <div className="mt-4 space-y-2.5">
              {[
                { label: 'Très Bien (≥ 16/20)', count: summary.mentionsCount['TRÈS BIEN'], bg: 'bg-[#00236f]', text: 'text-[#00236f]' },
                { label: 'Bien (14 – 15.99)', count: summary.mentionsCount['BIEN'], bg: 'bg-[#0051d5]', text: 'text-[#0051d5]' },
                { label: 'Assez Bien (12 – 13.99)', count: summary.mentionsCount['ASSEZ BIEN'], bg: 'bg-[#316bf3]', text: 'text-[#316bf3]' },
                { label: 'Passable (10 – 11.99)', count: summary.mentionsCount['PASSABLE'], bg: 'bg-[#90a8ff]', text: 'text-[#00236f]' },
                { label: 'Second Tour (8 – 9.99)', count: summary.mentionsCount['RATTRAPAGE'], bg: 'bg-[#fc922b]', text: 'text-[#fc922b]' },
                { label: 'Ajourné (< 8/20)', count: summary.mentionsCount['AJOURNÉ'], bg: 'bg-[#ba1a1a]', text: 'text-[#ba1a1a]' },
              ].map((m, idx) => {
                const pct = summary.evaluatedCount > 0 ? Math.round((m.count / summary.evaluatedCount) * 100) : 0;
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="font-medium text-[#131b2e]">{m.label}</span>
                      <span className="font-mono font-bold text-[#131b2e]">
                        {m.count} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-[#f2f3ff] rounded-xs overflow-hidden">
                      <div
                        className={`h-full ${m.bg}`}
                        style={{ width: m.count > 0 ? `${Math.max(pct, 2)}%` : '0%' }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
            {summary.evaluatedCount === 0 && (
              <p className="mt-3 text-[12px] text-[#444651] italic">
                Aucune mention : aucune note n’a encore été saisie.
              </p>
            )}
          </div>

          <div className="mt-4 p-3 bg-[#f2f3ff] rounded text-[11px] text-[#444651] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#0051d5] text-base">gavel</span>
            <span>
              Les candidats avec moyenne entre 09.80 et 09.99 sont soumis à l'arbitrage de repêchage du jury.
            </span>
          </div>
        </div>

        {/* Subjects Performance Table */}
        <div className="lg:col-span-7 bg-white p-5 rounded border border-[#eaedff] shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-[15px] font-bold text-[#00236f] uppercase tracking-wide">
                Bilan Pédagogique par Discipline
              </h3>
              <p className="text-[12px] text-[#444651]">
                Disciplines, enseignants et coefficients de la session
              </p>
            </div>
            <span className="text-[11px] font-mono text-[#0051d5] font-semibold bg-[#eaedff] px-2 py-1 rounded">
              Total Coef: {summary.totalCoef}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[12px]">
              <thead>
                <tr className="bg-[#f2f3ff] text-[#00236f] border-b border-[#eaedff]">
                  <th className="py-2 px-3 font-bold">Matière</th>
                  <th className="py-2 px-2 font-bold">Enseignant</th>
                  <th className="py-2 px-2 font-bold text-center">Coef</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eaedff]">
                {subjects.map(s => (
                  <tr key={s.id} className="hover:bg-[#f2f3ff]/50 transition-colors">
                    <td className="py-2 px-3 font-semibold text-[#131b2e]">{s.name}</td>
                    <td className="py-2 px-2 text-[#444651]">{s.teacher || <span className="italic">Non affecté</span>}</td>
                    <td className="py-2 px-2 font-mono text-center font-bold text-[#00236f]">
                      {s.coef}
                      {s.coefDefault && <span className="text-[#fc922b]" title="Aucun coefficient saisi : 1 par défaut">*</span>}
                    </td>
                  </tr>
                ))}
                {subjects.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-5 px-3 text-center text-[#444651]">
                      <span className="italic">Aucune matière enregistrée.</span>
                      {usingApi && onOpenAdmin && (
                        <>
                          {' '}
                          <button
                            type="button"
                            onClick={() => onOpenAdmin('matieres')}
                            className="font-semibold text-[#0051d5] hover:underline"
                          >
                            Ajouter des matières et coefficients
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {subjects.some((s) => s.coefDefault) && (
              <p className="mt-2 text-[11px] text-[#444651]">
                <span className="text-[#fc922b] font-bold">*</span> Aucun coefficient saisi pour cette matière : 1 est appliqué par défaut.
                {usingApi && onOpenAdmin && (
                  <>
                    {' '}
                    <button
                      type="button"
                      onClick={() => onOpenAdmin('coefficients')}
                      className="font-semibold text-[#0051d5] hover:underline"
                    >
                      Saisir les coefficients
                    </button>
                  </>
                )}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Rapid Candidate Access List */}
      <div className="bg-white p-5 rounded border border-[#eaedff] shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-[15px] font-bold text-[#00236f] uppercase tracking-wide">
              Candidats de la session
            </h3>
            <p className="text-[12px] text-[#444651]">
              Cliquez sur un candidat pour ouvrir directement son Bulletin Officiel et son export PDF
            </p>
          </div>
          <span className="font-mono text-[11px] text-[#0051d5] font-semibold bg-[#eaedff] px-2 py-1 rounded">
            {summary.total}
          </span>
        </div>

        {candidates.length === 0 ? (
          <p className="text-[12px] text-[#444651] italic py-3">
            Aucun candidat à afficher pour le moment.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {candidates.map(cand => {
              const stats = allStats[cand.id];
              const hasGrades = Object.keys(cand.grades || {}).length > 0;
              return (
                <button
                  key={cand.id}
                  type="button"
                  onClick={() => {
                    onSelectCandidate(cand);
                    onNavigate('bulletin');
                  }}
                  className="p-3 text-left bg-[#f2f3ff]/60 hover:bg-[#eaedff] rounded border border-[#eaedff] transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-[#444651]">
                      <span className="font-mono font-bold text-[#0051d5]">
                        {cand.tableNumber ? `Table ${cand.tableNumber}` : 'Sans table'}
                      </span>
                      <span className="font-mono font-bold text-[#00236f] bg-white px-1.5 py-0.2 rounded border border-[#eaedff]">
                        {stats && hasGrades ? (stats.rank === 1 ? '🥇 1er' : stats.rank === 2 ? '🥈 2e' : stats.rank === 3 ? '🥉 3e' : `${stats.rank}e`) : '—'}
                      </span>
                    </div>
                    <div className="text-[13px] font-bold text-[#00236f] group-hover:text-[#0051d5] transition-colors mt-1 line-clamp-1">
                      {cand.fullName}
                    </div>
                    <div className="text-[11px] text-[#444651] truncate mt-0.5">
                      {cand.originSchool}
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-[#eaedff] flex items-center justify-between">
                    <span className="font-mono text-[13px] font-bold text-[#00236f]">
                      {stats && hasGrades ? `${stats.average.toFixed(2)}/20` : '—'}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      !hasGrades
                        ? 'bg-[#eaedff] text-[#444651]'
                        : stats?.mention === 'TRÈS BIEN' || stats?.mention === 'BIEN'
                        ? 'bg-[#0051d5] text-white'
                        : stats?.mention === 'ASSEZ BIEN'
                        ? 'bg-[#eaedff] text-[#00236f]'
                        : stats?.mention === 'PASSABLE'
                        ? 'bg-[#eaedff] text-[#0051d5]'
                        : 'bg-[#ffdad6] text-[#ba1a1a]'
                    }`}>
                      {hasGrades ? (stats?.mention || 'EN COURS') : 'EN COURS'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
