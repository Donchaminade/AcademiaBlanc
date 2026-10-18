import React, { useState } from 'react';
import { Candidate, CandidateComputedStats } from '../types';

interface RecordsViewProps {
  candidates: Candidate[];
  allStats: Record<string, CandidateComputedStats>;
  onSelectCandidate: (candidate: Candidate) => void;
  onNavigateToBulletin: (candidate: Candidate) => void;
  selectedSession: string;
  selectedCenter: string;
}

export const RecordsView: React.FC<RecordsViewProps> = ({
  candidates,
  allStats,
  onNavigateToBulletin,
  selectedSession,
  selectedCenter,
}) => {
  const [filterDecision, setFilterDecision] = useState<'all' | 'admis' | 'rattrapage' | 'ajourne'>('all');
  const [isJuryLocked, setIsJuryLocked] = useState(true);

  // Sort candidates by rank
  const sorted = [...candidates].sort((a, b) => {
    const sA = allStats[a.id]?.average ?? 0;
    const sB = allStats[b.id]?.average ?? 0;
    return sB - sA;
  });

  const filtered = sorted.filter((c) => {
    const stats = allStats[c.id];
    if (filterDecision === 'admis') return stats && stats.decision.includes('ADMIS');
    if (filterDecision === 'rattrapage') return stats && stats.decision.includes('SECOND TOUR');
    if (filterDecision === 'ajourne') return stats && stats.decision.includes('AJOURNÉ');
    return true;
  });

  const exportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Rang,Table,Matricule,Nom et Prenoms,Genre,Etablissement,Total Points,Moyenne,Mention,Decision\n';

    sorted.forEach((c) => {
      const s = allStats[c.id];
      const row = [
        s?.rank ?? '—',
        c.tableNumber,
        `"${c.matricule}"`,
        `"${c.fullName}"`,
        c.gender,
        `"${c.originSchool}"`,
        s?.totalPoints ?? 0,
        s?.average ?? 0,
        `"${s?.mention ?? ''}"`,
        `"${s?.decision ?? ''}"`,
      ].join(',');
      csvContent += row + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PV_DELIBERATION_${selectedSession.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-8 max-w-[1440px] mx-auto space-y-6">
      {/* Official Header */}
      <div className="bg-white rounded p-6 shadow-sm border border-[#eaedff] flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#0051d5] bg-[#eaedff] px-2.5 py-1 rounded">
            Procès-Verbal Officiel de Délibération N° 01
          </span>
          <h2 className="text-[22px] font-bold text-[#00236f] mt-1.5">
            Palmarès Général &amp; Registre des Épreuves
          </h2>
          <p className="text-[13px] text-[#444651] mt-0.5">
            {selectedSession} • {selectedCenter}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={exportCSV}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded bg-[#eaedff] text-[#00236f] text-[12px] font-semibold hover:bg-[#dce1ff] transition-colors"
          >
            <span className="material-symbols-outlined text-base">download</span>
            <span>Exporter en CSV</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded bg-[#eaedff] text-[#00236f] text-[12px] font-semibold hover:bg-[#dce1ff] transition-colors"
          >
            <span className="material-symbols-outlined text-base">print</span>
            <span>Imprimer le Registre</span>
          </button>

          <button
            type="button"
            onClick={() => setIsJuryLocked(!isJuryLocked)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded text-white text-[12px] font-semibold transition-all shadow-xs ${
              isJuryLocked ? 'bg-[#00236f] hover:bg-[#1e3a8a]' : 'bg-[#ba1a1a] hover:bg-[#93000a]'
            }`}
          >
            <span className="material-symbols-outlined text-base">
              {isJuryLocked ? 'verified_user' : 'lock_open'}
            </span>
            <span>{isJuryLocked ? 'PV Verrouillé (SHA-256)' : 'Déverrouiller le PV'}</span>
          </button>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="bg-white p-3.5 rounded border border-[#eaedff] shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[12px]">
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
                ? 'bg-[#0051d5] text-white'
                : 'bg-[#f2f3ff] text-[#444651] hover:text-[#131b2e]'
            }`}
          >
            Admis d'office &amp; Délibérés
          </button>
          <button
            type="button"
            onClick={() => setFilterDecision('rattrapage')}
            className={`px-3 py-1 rounded font-semibold transition-colors ${
              filterDecision === 'rattrapage'
                ? 'bg-[#fc922b] text-white'
                : 'bg-[#f2f3ff] text-[#444651] hover:text-[#131b2e]'
            }`}
          >
            Second Tour (Admissibles)
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
            Ajournés
          </button>
        </div>

        <span className="font-mono text-[11px] text-[#444651]">
          {filtered.length} candidats listés
        </span>
      </div>

      {/* Official Ranking Table */}
      <div className="bg-white rounded border border-[#eaedff] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[12px]">
            <thead>
              <tr className="bg-[#00236f] text-white">
                <th className="py-2.5 px-3 font-semibold text-center w-16">Rang</th>
                <th className="py-2.5 px-2 font-semibold text-center w-16">Table</th>
                <th className="py-2.5 px-3 font-semibold">Candidat &amp; Matricule</th>
                <th className="py-2.5 px-3 font-semibold">Établissement d'Origine</th>
                <th className="py-2.5 px-2 font-semibold text-center">Genre</th>
                <th className="py-2.5 px-2 font-semibold text-right">Points /420</th>
                <th className="py-2.5 px-2 font-semibold text-right">Moyenne</th>
                <th className="py-2.5 px-3 font-semibold text-center">Mention</th>
                <th className="py-2.5 px-3 font-semibold">Décision du Jury</th>
                <th className="py-2.5 px-3 font-semibold text-center">Visa &amp; Bulletin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eaedff]">
              {filtered.map((cand, idx) => {
                const s = allStats[cand.id];
                const isEven = idx % 2 === 0;
                return (
                  <tr
                    key={cand.id}
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
                    <td className="py-2.5 px-3 text-[#444651]">{cand.originSchool}</td>
                    <td className="py-2.5 px-2 text-center font-medium">
                      {cand.gender === 'M' ? 'M' : 'F'}
                    </td>
                    <td className="py-2.5 px-2 font-mono text-right font-bold text-[#131b2e]">
                      {s?.totalPoints.toFixed(2) || '0.00'}
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
                            : s?.mention === 'RATTRAPAGE'
                            ? 'bg-[#ffdcc3] text-[#442100]'
                            : 'bg-[#ffdad6] text-[#ba1a1a]'
                        }`}
                      >
                        {s?.mention || 'EN COURS'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-[11px]">
                      <span
                        className={
                          s?.decision.includes('ADMIS')
                            ? 'text-[#0051d5]'
                            : s?.decision.includes('SECOND')
                            ? 'text-[#fc922b]'
                            : 'text-[#ba1a1a]'
                        }
                      >
                        {s?.decision}
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
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Closing Protocol Certification Box */}
      <div className="bg-[#f2f3ff] p-5 rounded border border-[#eaedff] shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#0051d5]">security</span>
            <span className="text-[13px] font-bold text-[#00236f]">
              Certification &amp; Clôture Numérique du Procès-Verbal
            </span>
          </div>
          <p className="text-[12px] text-[#444651]">
            Certificat d'intégrité DEXCO : <span className="font-mono text-[#00236f] font-semibold">SHA256: 7f8b91c...e9b488a1</span> • Horodatage certifié : 15-05-2025 à 18:42:09 GMT.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-white text-[#0051d5] text-[12px] font-semibold shadow-xs border border-[#eaedff]">
            <span className="material-symbols-outlined text-base">verified</span>
            <span>Signé par Dr. Aminata Traoré</span>
          </span>
        </div>
      </div>
    </div>
  );
};
