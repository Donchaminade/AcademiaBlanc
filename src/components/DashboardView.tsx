import React from 'react';
import { Candidate, Subject, CandidateComputedStats } from '../types';
import { PROMO_AVERAGES, PROMO_OVERALL_AVERAGE } from '../data/mockData';

interface DashboardViewProps {
  candidates: Candidate[];
  subjects: Subject[];
  allStats: Record<string, CandidateComputedStats>;
  onSelectCandidate: (candidate: Candidate) => void;
  onNavigate: (view: 'dashboard' | 'grading' | 'bulletin' | 'records') => void;
  selectedSession: string;
  selectedCenter: string;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  candidates,
  subjects,
  allStats,
  onSelectCandidate,
  onNavigate,
  selectedSession,
  selectedCenter,
}) => {
  // Aggregate stats across cohort
  const total = candidates.length;
  const admitted = candidates.filter(c => {
    const s = allStats[c.id];
    return s && (s.decision.includes('ADMIS') || s.average >= 10);
  }).length;
  const secondTour = candidates.filter(c => {
    const s = allStats[c.id];
    return s && s.average >= 8 && s.average < 10;
  }).length;
  const ajournes = total - admitted - secondTour;

  const successRate = total > 0 ? ((admitted / total) * 100).toFixed(1) : '0';

  // Mention distribution
  const mentionsCount = {
    'TRÈS BIEN': 0,
    'BIEN': 0,
    'ASSEZ BIEN': 0,
    'PASSABLE': 0,
    'RATTRAPAGE': 0,
    'AJOURNÉ': 0,
  };

  candidates.forEach(c => {
    const s = allStats[c.id];
    if (s && mentionsCount[s.mention] !== undefined) {
      mentionsCount[s.mention]++;
    }
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Session Header Banner */}
      <div className="bg-white rounded p-6 shadow-sm border border-[#eaedff] flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#0051d5] bg-[#eaedff] px-2.5 py-1 rounded">
              Contrôle Académique Officiel
            </span>
            <span className="text-[12px] text-[#444651]">Session Régionale d'Examen</span>
          </div>
          <h2 className="text-[22px] font-bold text-[#00236f] mt-1.5">
            Tableau de Bord &amp; Synthèse de Délibération
          </h2>
          <p className="text-[13px] text-[#444651] mt-0.5">
            {selectedSession} • {selectedCenter}
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
              138
            </div>
            <div className="font-mono text-[11px] text-[#444651] mt-1">
              100% de présence certifiée
            </div>
          </div>
          <div className="text-[12px] text-[#0051d5] font-medium pt-2 border-t border-[#eaedff] flex items-center justify-between">
            <span>Garçons: 72</span>
            <span>Filles: 66</span>
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
              {successRate}%
            </div>
            <div className="font-mono text-[11px] text-[#444651] mt-1">
              {admitted} admis d'office ou par délibération
            </div>
          </div>
          <div className="text-[12px] text-[#444651] pt-2 border-t border-[#eaedff] flex items-center justify-between font-mono">
            <span>2nd Tour: {secondTour}</span>
            <span className="text-[#ba1a1a]">Ajournés: {ajournes}</span>
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
              {PROMO_OVERALL_AVERAGE.toFixed(2)}
            </div>
            <div className="font-mono text-[11px] text-[#444651] mt-1">
              sur 20.00 (Seuil d'éligibilité: 10.00)
            </div>
          </div>
          <div className="text-[12px] text-[#0051d5] font-medium pt-2 border-t border-[#eaedff] flex items-center justify-between font-mono">
            <span>Médiane: 11.20</span>
            <span>Écart type: 2.14</span>
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
              16.42<span className="text-[14px] font-normal text-[#444651]"> /20</span>
            </div>
            <div className="text-[12px] text-[#131b2e] font-semibold truncate mt-1">
              KOFFI Aya Marie-Madeleine
            </div>
          </div>
          <div className="text-[11px] text-[#0051d5] font-semibold pt-2 border-t border-[#eaedff]">
            Mention Très Bien • Table N° 143
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
                { label: 'Très Bien (≥ 16/20)', count: mentionsCount['TRÈS BIEN'], bg: 'bg-[#00236f]', text: 'text-[#00236f]' },
                { label: 'Bien (14 – 15.99)', count: mentionsCount['BIEN'], bg: 'bg-[#0051d5]', text: 'text-[#0051d5]' },
                { label: 'Assez Bien (12 – 13.99)', count: mentionsCount['ASSEZ BIEN'], bg: 'bg-[#316bf3]', text: 'text-[#316bf3]' },
                { label: 'Passable (10 – 11.99)', count: mentionsCount['PASSABLE'], bg: 'bg-[#90a8ff]', text: 'text-[#00236f]' },
                { label: 'Second Tour (8 – 9.99)', count: mentionsCount['RATTRAPAGE'], bg: 'bg-[#fc922b]', text: 'text-[#fc922b]' },
                { label: 'Ajourné (< 8/20)', count: mentionsCount['AJOURNÉ'], bg: 'bg-[#ba1a1a]', text: 'text-[#ba1a1a]' },
              ].map((m, idx) => {
                const pct = total > 0 ? Math.round((m.count / total) * 100) : 0;
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
                        style={{ width: `${Math.max(pct, 4)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
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
                Moyennes calculées sur l'ensemble de la promotion (138 candidats)
              </p>
            </div>
            <span className="text-[11px] font-mono text-[#0051d5] font-semibold bg-[#eaedff] px-2 py-1 rounded">
              Total Coef: 21
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[12px]">
              <thead>
                <tr className="bg-[#f2f3ff] text-[#00236f] border-b border-[#eaedff]">
                  <th className="py-2 px-3 font-bold">Matière</th>
                  <th className="py-2 px-2 font-bold">Enseignant</th>
                  <th className="py-2 px-2 font-bold text-center">Coef</th>
                  <th className="py-2 px-2 font-bold text-right">Moy. Promo</th>
                  <th className="py-2 px-2 font-bold text-right">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eaedff]">
                {subjects.map(s => {
                  const p = PROMO_AVERAGES[s.id] || { avg: 10.0 };
                  const isGood = p.avg >= 12;
                  const isLow = p.avg < 10;
                  return (
                    <tr key={s.id} className="hover:bg-[#f2f3ff]/50 transition-colors">
                      <td className="py-2 px-3 font-semibold text-[#131b2e]">{s.name}</td>
                      <td className="py-2 px-2 text-[#444651]">{s.teacher}</td>
                      <td className="py-2 px-2 font-mono text-center font-bold text-[#00236f]">{s.coef}</td>
                      <td className="py-2 px-2 font-mono text-right font-bold text-[#131b2e]">{p.avg.toFixed(2)}</td>
                      <td className="py-2 px-2 text-right">
                        <span className={`inline-block font-mono text-[10px] px-2 py-0.5 rounded font-semibold ${
                          isGood ? 'bg-[#dce1ff] text-[#00236f]' : isLow ? 'bg-[#ffdad6] text-[#ba1a1a]' : 'bg-[#eaedff] text-[#0051d5]'
                        }`}>
                          {isGood ? 'FORT' : isLow ? 'À RENFORCER' : 'STABLE'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Rapid Candidate Access List */}
      <div className="bg-white p-5 rounded border border-[#eaedff] shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-[15px] font-bold text-[#00236f] uppercase tracking-wide">
              Candidats Récents du Centre 03
            </h3>
            <p className="text-[12px] text-[#444651]">
              Cliquez sur un candidat pour ouvrir directement son Bulletin Officiel et son export PDF
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {candidates.map(cand => {
            const stats = allStats[cand.id];
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
                    <span className="font-mono font-bold text-[#0051d5]">Table {cand.tableNumber}</span>
                    <span className="font-mono font-bold text-[#00236f] bg-white px-1.5 py-0.2 rounded border border-[#eaedff]">
                      {stats ? (stats.rank === 1 ? '🥇 1er' : stats.rank === 2 ? '🥈 2e' : stats.rank === 3 ? '🥉 3e' : `${stats.rank}e`) : '—'}
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
                    {stats ? `${stats.average.toFixed(2)}/20` : '—'}
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    stats?.mention === 'TRÈS BIEN' || stats?.mention === 'BIEN'
                      ? 'bg-[#0051d5] text-white'
                      : stats?.mention === 'ASSEZ BIEN'
                      ? 'bg-[#eaedff] text-[#00236f]'
                      : stats?.mention === 'PASSABLE'
                      ? 'bg-[#eaedff] text-[#0051d5]'
                      : 'bg-[#ffdad6] text-[#ba1a1a]'
                  }`}>
                    {stats?.mention || 'EN COURS'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
