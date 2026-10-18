import React, { useState } from 'react';
import { Candidate, Subject, CandidateComputedStats } from '../types';

interface GradingViewProps {
  candidates: Candidate[];
  subjects: Subject[];
  allStats: Record<string, CandidateComputedStats>;
  onUpdateGrade: (candidateId: string, subjectId: string, newScore: number) => void;
  onApplyJuryBonus: (candidateId: string, bonus: number) => void;
  onSelectCandidate: (candidate: Candidate) => void;
  onNavigateToBulletin: (candidate: Candidate) => void;
  onAddNewCandidate: (candidate: Candidate) => void;
}

export const GradingView: React.FC<GradingViewProps> = ({
  candidates,
  subjects,
  allStats,
  onUpdateGrade,
  onApplyJuryBonus,
  onNavigateToBulletin,
  onAddNewCandidate,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'admis' | 'rattrapage' | 'ajourne'>('all');
  const [selectedCandidateForBonus, setSelectedCandidateForBonus] = useState<Candidate | null>(null);
  const [bonusAmount, setBonusAmount] = useState<number>(0.15);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStudent, setNewStudent] = useState({
    tableNumber: 149,
    matricule: '24-BACD-09425',
    fullName: '',
    dob: '12/04/2006',
    birthPlace: 'Yamoussoukro',
    originSchool: 'Lycée Moderne Mixte',
    gender: 'F' as 'M' | 'F',
    parentPhone: '+225 07 00 11 22 33',
    parentEmail: 'parent@edu.ci',
  });

  const filteredCandidates = candidates.filter((c) => {
    const matchesSearch =
      c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.tableNumber.toString().includes(searchQuery) ||
      c.matricule.toLowerCase().includes(searchQuery.toLowerCase());

    const stats = allStats[c.id];
    if (!matchesSearch) return false;

    if (filterStatus === 'admis') {
      return stats && (stats.decision.includes('ADMIS') || stats.average >= 10);
    }
    if (filterStatus === 'rattrapage') {
      return stats && stats.average >= 8 && stats.average < 10;
    }
    if (filterStatus === 'ajourne') {
      return stats && stats.average < 8;
    }
    return true;
  });

  const handleScoreChange = (candidateId: string, subjectId: string, valStr: string) => {
    const val = parseFloat(valStr);
    if (!isNaN(val) && val >= 0 && val <= 20) {
      onUpdateGrade(candidateId, subjectId, Math.round(val * 100) / 100);
    }
  };

  const submitAddCandidate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.fullName.trim()) return;

    const initialGrades: Record<string, { score: number; appreciation: string }> = {};
    subjects.forEach((s) => {
      initialGrades[s.id] = { score: 10.0, appreciation: 'Ensemble convenable.' };
    });

    const created: Candidate = {
      id: `cand-${Date.now()}`,
      tableNumber: Number(newStudent.tableNumber),
      matricule: newStudent.matricule,
      fullName: newStudent.fullName.trim(),
      dob: newStudent.dob,
      birthPlace: newStudent.birthPlace,
      originSchool: newStudent.originSchool,
      gender: newStudent.gender,
      serie: 'BAC II Blanc 2025 - Série D',
      examCenter: 'Centre N° 03 • Salle 12',
      examCenterName: 'Lycée Moderne Mixte',
      parentPhone: newStudent.parentPhone,
      parentEmail: newStudent.parentEmail,
      generalObservation: '« Candidat inscrit sur bordereau officiel. Travail régulier. »',
      grades: initialGrades,
      isDeliberated: true,
    };

    onAddNewCandidate(created);
    setShowAddModal(false);
    setNewStudent({
      tableNumber: created.tableNumber + 1,
      matricule: `24-BACD-094${created.tableNumber - 140 + 26}`,
      fullName: '',
      dob: '12/04/2006',
      birthPlace: 'Yamoussoukro',
      originSchool: 'Lycée Moderne Mixte',
      gender: 'M',
      parentPhone: '+225 07 00 11 22 33',
      parentEmail: 'parent@edu.ci',
    });
  };

  return (
    <div className="p-8 max-w-[1440px] mx-auto space-y-6">
      {/* Header with Search and Action Toolbar */}
      <div className="bg-white rounded p-6 shadow-sm border border-[#eaedff] flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#0051d5] bg-[#eaedff] px-2.5 py-1 rounded">
            Secrétariat du Jury • Saisie des Notes
          </span>
          <h2 className="text-[22px] font-bold text-[#00236f] mt-1.5">
            Bordereau Numérique d'Émargement &amp; Délibération
          </h2>
          <p className="text-[13px] text-[#444651] mt-0.5">
            Saisie assistée des notes sur 20.00 avec calcul instantané des totaux pondérés et de la mention.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded bg-[#00236f] text-white text-[12px] font-semibold hover:bg-[#1e3a8a] transition-all shadow-xs"
          >
            <span className="material-symbols-outlined text-base">person_add</span>
            <span>Ajouter un Candidat</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded border border-[#eaedff] shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 min-w-[280px] max-w-md">
          <div className="relative w-full">
            <input
              type="text"
              placeholder="Rechercher par nom, table, matricule..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#f2f3ff] text-[#131b2e] text-[13px] py-2 pl-9 pr-4 rounded outline-none border border-[#eaedff] focus:bg-white focus:border-[#0051d5] transition-all"
            />
            <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-[#444651] text-base">
              search
            </span>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-1.5 bg-[#f2f3ff] p-1 rounded border border-[#eaedff]">
          <button
            type="button"
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded text-[12px] font-semibold transition-colors ${
              filterStatus === 'all'
                ? 'bg-white text-[#00236f] shadow-xs'
                : 'text-[#444651] hover:text-[#131b2e]'
            }`}
          >
            Tous ({candidates.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('admis')}
            className={`px-3 py-1.5 rounded text-[12px] font-semibold transition-colors ${
              filterStatus === 'admis'
                ? 'bg-white text-[#0051d5] shadow-xs'
                : 'text-[#444651] hover:text-[#131b2e]'
            }`}
          >
            Admis d'office
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('rattrapage')}
            className={`px-3 py-1.5 rounded text-[12px] font-semibold transition-colors ${
              filterStatus === 'rattrapage'
                ? 'bg-white text-[#fc922b] shadow-xs'
                : 'text-[#444651] hover:text-[#131b2e]'
            }`}
          >
            Second Tour (8-9.99)
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('ajourne')}
            className={`px-3 py-1.5 rounded text-[12px] font-semibold transition-colors ${
              filterStatus === 'ajourne'
                ? 'bg-white text-[#ba1a1a] shadow-xs'
                : 'text-[#444651] hover:text-[#131b2e]'
            }`}
          >
            Ajournés (&lt; 8)
          </button>
        </div>
      </div>

      {/* Dense Grading Matrix Table */}
      <div className="bg-white rounded border border-[#eaedff] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[12px]">
            <thead>
              <tr className="bg-[#00236f] text-white">
                <th className="py-2.5 px-3 font-semibold sticky left-0 bg-[#00236f] z-10 w-16 text-center">
                  Table
                </th>
                <th className="py-2.5 px-3 font-semibold sticky left-16 bg-[#00236f] z-10 min-w-[200px]">
                  Candidat &amp; Matricule
                </th>
                {subjects.map((s) => (
                  <th key={s.id} className="py-2.5 px-2 font-semibold text-center min-w-[70px]">
                    <div className="truncate text-[11px]">{s.name.slice(0, 7)}.</div>
                    <div className="text-[10px] text-[#90a8ff] font-mono">c.{s.coef}</div>
                  </th>
                ))}
                <th className="py-2.5 px-2 font-semibold text-right min-w-[65px]">Points</th>
                <th className="py-2.5 px-2 font-semibold text-right min-w-[70px]">Moyenne</th>
                <th className="py-2.5 px-2 font-semibold text-center min-w-[60px]">Rang</th>
                <th className="py-2.5 px-3 font-semibold text-center min-w-[110px]">Mention</th>
                <th className="py-2.5 px-3 font-semibold text-center min-w-[100px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eaedff]">
              {filteredCandidates.map((cand, idx) => {
                const stats = allStats[cand.id];
                const isEven = idx % 2 === 0;
                return (
                  <tr
                    key={cand.id}
                    className={`${isEven ? 'bg-white' : 'bg-[#faf8ff]'} hover:bg-[#eaedff]/60 transition-colors`}
                  >
                    {/* Table Number */}
                    <td className="py-2 px-3 font-mono font-bold text-center text-[#00236f] sticky left-0 bg-inherit z-10 border-r border-[#eaedff]">
                      {cand.tableNumber}
                    </td>

                    {/* Candidate Name & Info */}
                    <td className="py-2 px-3 sticky left-16 bg-inherit z-10 border-r border-[#eaedff]">
                      <div className="font-semibold text-[#131b2e] leading-tight">
                        {cand.fullName}
                      </div>
                      <div className="text-[11px] text-[#444651] font-mono mt-0.5">
                        {cand.matricule} • {cand.gender}
                      </div>
                    </td>

                    {/* Subject Inputs */}
                    {subjects.map((s) => {
                      const grade = cand.grades[s.id]?.score ?? 0;
                      return (
                        <td key={s.id} className="py-1 px-1.5 text-center">
                          <input
                            type="number"
                            min="0"
                            max="20"
                            step="0.5"
                            value={grade}
                            onChange={(e) => handleScoreChange(cand.id, s.id, e.target.value)}
                            className={`w-14 text-center font-mono text-[12px] py-1 px-1 rounded border outline-none font-semibold transition-colors ${
                              grade >= 14
                                ? 'bg-[#eaedff] text-[#00236f] border-[#dce1ff]'
                                : grade < 10
                                ? 'bg-[#ffdad6]/60 text-[#ba1a1a] border-[#ffdad6]'
                                : 'bg-white text-[#131b2e] border-[#eaedff]'
                            } focus:border-[#0051d5] focus:bg-white`}
                          />
                        </td>
                      );
                    })}

                    {/* Total Points */}
                    <td className="py-2 px-2 font-mono text-right font-bold text-[#131b2e]">
                      {stats?.totalPoints.toFixed(2) || '0.00'}
                    </td>

                    {/* Weighted Average */}
                    <td className="py-2 px-2 font-mono text-right font-bold text-[#00236f]">
                      {stats?.average.toFixed(2) || '0.00'}
                      {cand.juryBonus && cand.juryBonus > 0 && (
                        <span className="block text-[9px] text-[#0051d5] font-semibold">
                          +{cand.juryBonus.toFixed(2)} jury
                        </span>
                      )}
                    </td>

                    {/* Rank */}
                    <td className="py-2 px-2 font-mono text-center font-semibold text-[#0051d5]">
                      {stats ? `${stats.rank}e` : '—'}
                    </td>

                    {/* Mention */}
                    <td className="py-2 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-tight uppercase ${
                          stats?.mention === 'TRÈS BIEN' || stats?.mention === 'BIEN'
                            ? 'bg-[#0051d5] text-white'
                            : stats?.mention === 'ASSEZ BIEN'
                            ? 'bg-[#eaedff] text-[#00236f]'
                            : stats?.mention === 'PASSABLE'
                            ? 'bg-[#eaedff] text-[#0051d5]'
                            : stats?.mention === 'RATTRAPAGE'
                            ? 'bg-[#ffdcc3] text-[#442100]'
                            : 'bg-[#ffdad6] text-[#ba1a1a]'
                        }`}
                      >
                        {stats?.mention || 'EN COURS'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-2 px-3 text-center space-x-1 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onNavigateToBulletin(cand)}
                        className="p-1 rounded bg-[#eaedff] text-[#00236f] hover:bg-[#dce1ff] transition-colors"
                        title="Ouvrir le Bulletin Officiel"
                      >
                        <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedCandidateForBonus(cand)}
                        className="p-1 rounded bg-[#eaedff] text-[#0051d5] hover:bg-[#dce1ff] transition-colors"
                        title="Arbitrage / Rachat du jury"
                      >
                        <span className="material-symbols-outlined text-base">gavel</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Jury Repêchage Modal */}
      {selectedCandidateForBonus && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 border border-[#eaedff] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#eaedff]">
              <div className="flex items-center gap-2 text-[#00236f]">
                <span className="material-symbols-outlined text-xl">gavel</span>
                <span className="font-bold text-[15px]">Arbitrage de Délibération du Jury</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCandidateForBonus(null)}
                className="text-[#444651] hover:text-[#131b2e]"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div>
              <p className="text-[13px] text-[#131b2e] font-semibold">
                {selectedCandidateForBonus.fullName} (Table {selectedCandidateForBonus.tableNumber})
              </p>
              <p className="text-[12px] text-[#444651] mt-0.5">
                Moyenne actuelle :{' '}
                <span className="font-mono font-bold text-[#00236f]">
                  {allStats[selectedCandidateForBonus.id]?.average.toFixed(2)}/20
                </span>
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-[#444651] uppercase">
                Points de repêchage accordés par le conseil :
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[0.10, 0.15, 0.25, 0.50].map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBonusAmount(b)}
                    className={`py-1.5 rounded font-mono text-[12px] font-bold border transition-colors ${
                      bonusAmount === b
                        ? 'bg-[#00236f] text-white border-[#00236f]'
                        : 'bg-[#f2f3ff] text-[#131b2e] border-[#eaedff] hover:bg-[#eaedff]'
                    }`}
                  >
                    +{b.toFixed(2)}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-[#444651] italic leading-snug">
              Note du protocole : Le rachat par le jury est inscrit dans le procès-verbal d'examen blanc avec mention des critères d'assiduité.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#eaedff]">
              <button
                type="button"
                onClick={() => setSelectedCandidateForBonus(null)}
                className="px-3 py-1.5 rounded text-[12px] text-[#444651] hover:bg-[#f2f3ff]"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  onApplyJuryBonus(selectedCandidateForBonus.id, bonusAmount);
                  setSelectedCandidateForBonus(null);
                }}
                className="px-4 py-1.5 rounded text-[12px] bg-[#0051d5] text-white font-semibold hover:bg-[#003ea8]"
              >
                Valider la Délibération
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Candidate Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form
            onSubmit={submitAddCandidate}
            className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 border border-[#eaedff] space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#eaedff]">
              <div className="flex items-center gap-2 text-[#00236f]">
                <span className="material-symbols-outlined text-xl">person_add</span>
                <span className="font-bold text-[15px]">Enregistrement d'un Candidat</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-[#444651] hover:text-[#131b2e]"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[12px]">
              <div className="col-span-2">
                <label className="block font-semibold text-[#444651] mb-1">Nom et Prénoms</label>
                <input
                  required
                  type="text"
                  placeholder="ex: KOUASSI Marc Aurele"
                  value={newStudent.fullName}
                  onChange={(e) => setNewStudent({ ...newStudent, fullName: e.target.value })}
                  className="w-full bg-[#f2f3ff] py-1.5 px-3 rounded border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#444651] mb-1">N° de Table</label>
                <input
                  type="number"
                  value={newStudent.tableNumber}
                  onChange={(e) => setNewStudent({ ...newStudent, tableNumber: Number(e.target.value) })}
                  className="w-full bg-[#f2f3ff] py-1.5 px-3 rounded border border-[#eaedff] font-mono outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#444651] mb-1">Matricule</label>
                <input
                  type="text"
                  value={newStudent.matricule}
                  onChange={(e) => setNewStudent({ ...newStudent, matricule: e.target.value })}
                  className="w-full bg-[#f2f3ff] py-1.5 px-3 rounded border border-[#eaedff] font-mono outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#444651] mb-1">Date de Naissance</label>
                <input
                  type="text"
                  value={newStudent.dob}
                  onChange={(e) => setNewStudent({ ...newStudent, dob: e.target.value })}
                  className="w-full bg-[#f2f3ff] py-1.5 px-3 rounded border border-[#eaedff] outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#444651] mb-1">Lieu de Naissance</label>
                <input
                  type="text"
                  value={newStudent.birthPlace}
                  onChange={(e) => setNewStudent({ ...newStudent, birthPlace: e.target.value })}
                  className="w-full bg-[#f2f3ff] py-1.5 px-3 rounded border border-[#eaedff] outline-none"
                />
              </div>

              <div className="col-span-2">
                <label className="block font-semibold text-[#444651] mb-1">Établissement d'Origine</label>
                <input
                  type="text"
                  value={newStudent.originSchool}
                  onChange={(e) => setNewStudent({ ...newStudent, originSchool: e.target.value })}
                  className="w-full bg-[#f2f3ff] py-1.5 px-3 rounded border border-[#eaedff] outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#444651] mb-1">Genre</label>
                <select
                  value={newStudent.gender}
                  onChange={(e) => setNewStudent({ ...newStudent, gender: e.target.value as 'M' | 'F' })}
                  className="w-full bg-[#f2f3ff] py-1.5 px-3 rounded border border-[#eaedff] outline-none"
                >
                  <option value="M">Masculin (M)</option>
                  <option value="F">Féminin (F)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#444651] mb-1">Téléphone Tuteur</label>
                <input
                  type="text"
                  value={newStudent.parentPhone}
                  onChange={(e) => setNewStudent({ ...newStudent, parentPhone: e.target.value })}
                  className="w-full bg-[#f2f3ff] py-1.5 px-3 rounded border border-[#eaedff] font-mono outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#eaedff]">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 rounded text-[12px] text-[#444651] hover:bg-[#f2f3ff]"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded text-[12px] bg-[#00236f] text-white font-semibold hover:bg-[#1e3a8a]"
              >
                Inscrire au Bordereau
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
