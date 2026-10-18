import React, { useState, useEffect, useRef } from 'react';
import { Candidate, CandidateComputedStats } from '../types';

interface SearchModalProps {
  candidates: Candidate[];
  allStats: Record<string, CandidateComputedStats>;
  onClose: () => void;
  onSelectCandidate: (candidate: Candidate) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  candidates,
  allStats,
  onClose,
  onSelectCandidate,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const matches = candidates.filter((c) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      c.fullName.toLowerCase().includes(q) ||
      c.tableNumber.toString().includes(q) ||
      c.matricule.toLowerCase().includes(q) ||
      c.originSchool.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-start justify-center p-4 pt-20 z-50 animate-in fade-in">
      <div className="bg-white rounded-lg shadow-2xl max-w-xl w-full border border-[#eaedff] overflow-hidden">
        {/* Search Input */}
        <div className="p-3 bg-[#f2f3ff] border-b border-[#eaedff] flex items-center gap-2">
          <span className="material-symbols-outlined text-[#0051d5]">search</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Rechercher par nom, numéro de table (ex: 142), matricule..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-[14px] text-[#131b2e] outline-none font-medium placeholder-[#444651]"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-[#e2e7ff] text-[#444651]"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto divide-y divide-[#eaedff]">
          {matches.length === 0 ? (
            <div className="p-8 text-center text-[#444651] text-[13px]">
              Aucun candidat trouvé pour "{query}".
            </div>
          ) : (
            matches.map((cand) => {
              const stats = allStats[cand.id];
              return (
                <button
                  key={cand.id}
                  type="button"
                  onClick={() => {
                    onSelectCandidate(cand);
                    onClose();
                  }}
                  className="w-full p-3 text-left hover:bg-[#eaedff] transition-colors flex items-center justify-between group"
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-[#0051d5] bg-[#eaedff] px-1.5 py-0.5 rounded">
                        N° {cand.tableNumber}
                      </span>
                      <span className="text-[13px] font-bold text-[#00236f] group-hover:text-[#0051d5] truncate">
                        {cand.fullName}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#444651] mt-0.5 font-mono truncate">
                      {cand.matricule} • {cand.originSchool}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-mono text-[14px] font-bold text-[#00236f] block">
                      {stats ? `${stats.average.toFixed(2)}/20` : '—'}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-[#0051d5]">
                      {stats?.mention || 'EN COURS'}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="p-2.5 bg-[#faf8ff] border-t border-[#eaedff] text-[11px] text-[#444651] flex items-center justify-between">
          <span>Touche Échap pour fermer</span>
          <span className="font-mono">{matches.length} candidats</span>
        </div>
      </div>
    </div>
  );
};
