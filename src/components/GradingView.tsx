import React, { useState } from 'react';
import { Candidate, Subject, CandidateComputedStats } from '../types';
import { decisionBucket } from '../utils/bulletinMetrics';
import { horsProgramme, subjectsFor } from '../utils/programme';

interface GradingViewProps {
  candidates: Candidate[];
  subjects: Subject[];
  allStats: Record<string, CandidateComputedStats>;
  /** Enregistre une note ; résout `false` si le serveur l'a refusée (la cellule reste « non enregistrée »). */
  onUpdateGrade: (candidateId: string, subjectId: string, newScore: number) => Promise<boolean>;
  onApplyJuryBonus: (candidateId: string, bonus: number) => void | Promise<void>;
  onSelectCandidate: (candidate: Candidate) => void;
  onNavigateToBulletin: (candidate: Candidate) => void;
  onAddNewCandidate: (candidate: Candidate) => void;
  juryLocked?: boolean;
  /** Session connectée : les notes sont enregistrées sur le serveur, cellule par cellule. */
  usingApi?: boolean;
}

/** État d'enregistrement d'une cellule de note : saisie en cours, envoi, enregistrée, refusée. */
type EtatCellule = 'modifiee' | 'envoi' | 'enregistree' | 'erreur';

const cleCellule = (candidateId: string, subjectId: string) => `${candidateId}:${subjectId}`;

export const GradingView: React.FC<GradingViewProps> = ({
  candidates,
  subjects,
  allStats,
  onUpdateGrade,
  onApplyJuryBonus,
  onNavigateToBulletin,
  onAddNewCandidate,
  juryLocked = false,
  usingApi = false,
}) => {
  // Valeur tapée mais pas encore validée (blur / Entrée), par cellule ; absente = valeur enregistrée affichée.
  const [brouillons, setBrouillons] = useState<Record<string, string>>({});
  const [etats, setEtats] = useState<Record<string, EtatCellule>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'admis' | 'rattrapage' | 'ajourne'>('all');
  const [selectedCandidateForBonus, setSelectedCandidateForBonus] = useState<Candidate | null>(null);
  const [bonusAmount, setBonusAmount] = useState<number>(0.15);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRankings, setShowRankings] = useState(false);
  const [showExplanation, setShowExplanation] = useState(true);
  const [newStudent, setNewStudent] = useState({
    tableNumber: 149,
    matricule: '24-BACD-09425',
    fullName: '',
    dob: '12/04/2006',
    birthPlace: 'Lomé',
    originSchool: 'Lycée Moderne',
    gender: 'F' as 'M' | 'F',
    parentPhone: '+228 90 00 11 22',
    parentEmail: 'parent@edu.tg',
  });

  // Ranked candidates from 1st to last strictly by weighted average
  const rankedCandidates = React.useMemo(() => {
    return [...candidates].sort((a, b) => {
      const avgA = allStats[a.id]?.average ?? 0;
      const avgB = allStats[b.id]?.average ?? 0;
      return avgB - avgA;
    });
  }, [candidates, allStats]);

  // Candidates with complete grades
  const completedCount = React.useMemo(() => {
    return candidates.filter((c) =>
      subjectsFor(c, subjects).every((s) => c.grades[s.id] && c.grades[s.id].score !== undefined && c.grades[s.id].score > 0)
    ).length;
  }, [candidates, subjects]);

  const filteredCandidates = candidates.filter((c) => {
    const matchesSearch =
      c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.tableNumber.toString().includes(searchQuery) ||
      c.matricule.toLowerCase().includes(searchQuery.toLowerCase());

    const stats = allStats[c.id];
    if (!matchesSearch) return false;

    if (filterStatus === 'admis') {
      return decisionBucket(stats?.decision) === 'admis';
    }
    if (filterStatus === 'rattrapage') {
      return stats && stats.average >= 8 && stats.average < 10;
    }
    if (filterStatus === 'ajourne') {
      return stats && stats.average < 8;
    }
    return true;
  });

  const poserEtat = (cle: string, etat: EtatCellule | null) => {
    setEtats((prev) => {
      const next = { ...prev };
      if (etat) next[cle] = etat; else delete next[cle];
      return next;
    });
  };

  /** Frappe : la valeur reste un brouillon « non enregistré » jusqu'à validation. */
  const handleScoreChange = (candidateId: string, subjectId: string, valStr: string) => {
    if (juryLocked) return;
    const cle = cleCellule(candidateId, subjectId);
    setBrouillons((prev) => ({ ...prev, [cle]: valStr }));
    poserEtat(cle, 'modifiee');
  };

  /** Validation (blur ou Entrée) : envoi au gestionnaire ; la cellule ne passe « enregistrée » qu'après son accord. */
  const validerNote = async (candidateId: string, subjectId: string, valeurActuelle: number) => {
    const cle = cleCellule(candidateId, subjectId);
    const brouillon = brouillons[cle];
    if (brouillon === undefined) return;
    const val = parseFloat(brouillon.replace(',', '.'));
    const arrondie = Math.round(val * 100) / 100;
    if (!Number.isFinite(val) || val < 0 || val > 20) {
      poserEtat(cle, 'erreur');
      return;
    }
    if (arrondie === valeurActuelle) {
      setBrouillons((prev) => { const next = { ...prev }; delete next[cle]; return next; });
      poserEtat(cle, null);
      return;
    }
    poserEtat(cle, 'envoi');
    const ok = await onUpdateGrade(candidateId, subjectId, arrondie);
    if (ok) {
      setBrouillons((prev) => { const next = { ...prev }; delete next[cle]; return next; });
      poserEtat(cle, 'enregistree');
    } else {
      poserEtat(cle, 'erreur');
    }
  };

  const nonEnregistrees = Object.values(etats).filter((etat) => etat === 'modifiee' || etat === 'erreur').length;
  const enCours = Object.values(etats).filter((etat) => etat === 'envoi').length;

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
          <span
            role="status"
            data-testid="etat-notes"
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded text-[12px] font-semibold border ${
              nonEnregistrees > 0
                ? 'bg-amber-50 text-amber-900 border-amber-300'
                : enCours > 0
                ? 'bg-[#eaedff] text-[#00236f] border-[#dce1ff]'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}
            title={usingApi
              ? 'Chaque note validée (Entrée ou sortie de la case) est enregistrée dans la base de l’établissement.'
              : 'Mode démonstration : les notes restent dans ce navigateur.'}
          >
            <span className="material-symbols-outlined text-base">
              {nonEnregistrees > 0 ? 'edit_note' : enCours > 0 ? 'progress_activity' : 'cloud_done'}
            </span>
            <span>
              {nonEnregistrees > 0
                ? `${nonEnregistrees} note(s) non enregistrée(s)`
                : enCours > 0
                ? 'Enregistrement…'
                : usingApi ? 'Notes enregistrées sur le serveur' : 'Notes enregistrées (démonstration)'}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setShowRankings(!showRankings)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded text-[12px] font-bold transition-all shadow-xs ${
              showRankings ? 'bg-[#0051d5] text-white' : 'bg-[#eaedff] text-[#00236f] hover:bg-[#dce1ff]'
            }`}
          >
            <span className="material-symbols-outlined text-base">leaderboard</span>
            <span>{showRankings ? 'Masquer le Palmarès' : `Palmarès en Direct (du 1er au ${candidates.length}e)`}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowExplanation(!showExplanation)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-[#f2f3ff] text-[#444651] text-[12px] font-semibold hover:bg-[#eaedff] transition-colors"
          >
            <span className="material-symbols-outlined text-base text-[#0051d5]">help</span>
            <span>Comment sont calculés les rangs ?</span>
          </button>

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

      {/* Educational Banner: How Ranks Work & Live vs Final */}
      {showExplanation && (
        <div className="bg-[#eaedff]/60 border border-[#dce1ff] rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#dce1ff]">
            <h3 className="text-[14px] font-bold text-[#00236f] flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-[#0051d5]">analytics</span>
              Règles Officielles de Calcul des Rangs (du 1er au Dernier)
            </h3>
            <span className="text-[11px] font-bold text-[#0051d5] bg-white px-2.5 py-0.5 rounded border border-[#dce1ff]">
              Moyenne Pondérée Décroissante
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[12px]">
            <div className="bg-white p-3.5 rounded border border-[#eaedff] space-y-1">
              <span className="font-bold text-[#00236f] block flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#0051d5] text-white text-[10px] flex items-center justify-center font-bold">1</span>
                Calcul de la Moyenne
              </span>
              <p className="text-[#444651] leading-relaxed">
                Chaque note est multipliée par son coefficient officiel (ex : Maths c.4, PC c.4, SVT c.4...). Le total des points est divisé par la somme des coefficients (29).
              </p>
            </div>

            <div className="bg-white p-3.5 rounded border border-[#eaedff] space-y-1">
              <span className="font-bold text-[#00236f] block flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#0051d5] text-white text-[10px] flex items-center justify-center font-bold">2</span>
                Tri du 1er au Dernier
              </span>
              <p className="text-[#444651] leading-relaxed">
                Le système trie automatiquement tous les élèves : la plus haute moyenne est <strong>1er (🥇)</strong>, la suivante <strong>2e (🥈)</strong>, puis <strong>3e (🥉)</strong> jusqu'au dernier. En cas d'égalité, ils sont ex-æquo.
              </p>
            </div>

            <div className="bg-white p-3.5 rounded border border-[#eaedff] space-y-1">
              <span className="font-bold text-[#00236f] block flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-bold">3</span>
                Calcul Instantané en Direct
              </span>
              <p className="text-[#444651] leading-relaxed">
                <strong>Pas besoin d'attendre d'avoir tout fini !</strong> Le rang s'actualise en temps réel à chaque note saisie. Dès que tous les élèves sont complétés, les rangs sont figés et définitifs.
              </p>
            </div>
          </div>

          <div className="pt-1 flex items-center justify-between text-[11px] text-[#444651]">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-emerald-600">check_circle</span>
              <span>État actuel de la saisie : <strong>{completedCount} / {candidates.length} élèves notés</strong></span>
            </span>
            <button
              type="button"
              onClick={() => setShowRankings(true)}
              className="text-[#0051d5] font-bold hover:underline flex items-center gap-1"
            >
              <span>Consulter le classement général de la classe</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
        </div>
      )}

      {/* Live Ranking Board (Du 1er au Dernier) */}
      {showRankings && (
        <div className="bg-white rounded-lg border-2 border-[#0051d5]/40 shadow-md p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#eaedff]">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#0051d5]">
                Palmarès Officiel • Ordre de Mérite
              </span>
              <h3 className="text-[17px] font-bold text-[#00236f]">
                Classement Général en Direct (du 1er au {rankedCandidates.length}e élève)
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowRankings(false)}
              className="p-1 rounded text-[#444651] hover:bg-[#f2f3ff]"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rankedCandidates.map((cand, idx) => {
              const stats = allStats[cand.id];
              const rankNum = idx + 1;
              const isFirst = rankNum === 1;
              const isSecond = rankNum === 2;
              const isThird = rankNum === 3;

              return (
                <div
                  key={cand.id}
                  onClick={() => onNavigateToBulletin(cand)}
                  className={`p-3.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isFirst
                      ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-300/40 shadow-xs'
                      : isSecond
                      ? 'bg-slate-50 border-slate-300 shadow-xs'
                      : isThird
                      ? 'bg-orange-50/60 border-orange-200 shadow-xs'
                      : 'bg-white border-[#eaedff] hover:border-[#0051d5] hover:bg-[#f2f3ff]'
                  }`}
                  title="Cliquer pour voir son bulletin officiel"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-[14px] shrink-0 font-mono shadow-xs border border-white">
                      {isFirst ? (
                        <span className="text-xl">🥇</span>
                      ) : isSecond ? (
                        <span className="text-xl">🥈</span>
                      ) : isThird ? (
                        <span className="text-xl">🥉</span>
                      ) : (
                        <span className="text-[#00236f] bg-[#eaedff] w-full h-full rounded-full flex items-center justify-center text-[12px]">
                          {rankNum}e
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-[#131b2e] truncate text-[13px] leading-tight">
                        {cand.fullName}
                      </div>
                      <div className="text-[11px] text-[#444651] mt-0.5">
                        Table {cand.tableNumber} • {stats?.decision.split(' ')[0] || 'En cours'}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-mono text-[16px] font-bold text-[#00236f] block">
                      {stats?.average.toFixed(2) || '0.00'}
                    </span>
                    <span className="text-[10px] text-[#444651]">/ 20.00</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                {subjects.map((s) => {
                  // Avec des programmes de classe, le coefficient dépend de la classe : il est affiché dans chaque cellule.
                  const parClasse = Object.keys(s.coefParClasse ?? {}).length > 0;
                  return (
                    <th key={s.id} className="py-2.5 px-2 font-semibold text-center min-w-[70px]" title={s.name}>
                      <div className="truncate text-[11px]">{s.name.slice(0, 7)}.</div>
                      <div className="text-[10px] text-[#90a8ff] font-mono">{parClasse ? 'c. selon classe' : `c.${s.coef}`}</div>
                    </th>
                  );
                })}
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
                      const cle = cleCellule(cand.id, s.id);
                      const etat = etats[cle];
                      const affichee = brouillons[cle] ?? String(grade);
                      if (horsProgramme(cand, s.id, subjects)) {
                        return (
                          <td key={s.id} className="py-1 px-1.5 text-center text-[#757682]" title="Matière hors programme de la classe de cet élève">
                            <span className="inline-block w-14 py-1 font-mono text-[11px] rounded border border-dashed border-[#dce1ff] bg-[#f8f9ff]">—</span>
                          </td>
                        );
                      }
                      const coefCellule = s.coefParClasse?.[cand.classeId ?? ''];
                      const titreEtat = etat === 'modifiee' ? 'Non enregistrée : validez par Entrée ou en quittant la case'
                        : etat === 'envoi' ? 'Enregistrement en cours…'
                        : etat === 'enregistree' ? (usingApi ? 'Enregistrée sur le serveur' : 'Enregistrée')
                        : etat === 'erreur' ? 'Refusée : note hors barème ou erreur du serveur, valeur non enregistrée'
                        : '';
                      return (
                        <td key={s.id} className="py-1 px-1.5 text-center">
                          <span className="relative inline-block">
                            <input
                              type="number"
                              min="0"
                              max="20"
                              step="0.5"
                              value={affichee}
                              disabled={juryLocked || etat === 'envoi'}
                              aria-label={`${cand.fullName} — ${s.name}`}
                              data-etat={etat ?? 'stable'}
                              title={juryLocked ? 'PV verrouillé : déverrouillez le registre pour modifier les notes' : `Note sur 20${coefCellule !== undefined ? ` — coefficient ${coefCellule}` : ''}${titreEtat ? ` — ${titreEtat}` : ''}`}
                              onChange={(e) => handleScoreChange(cand.id, s.id, e.target.value)}
                              onBlur={() => void validerNote(cand.id, s.id, grade)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLInputElement).blur(); }
                              }}
                              className={`w-14 text-center font-mono text-[12px] py-1 px-1 rounded border outline-none font-semibold transition-colors ${
                                etat === 'modifiee' || etat === 'envoi'
                                  ? 'bg-amber-50 text-amber-900 border-amber-400 border-dashed'
                                  : etat === 'erreur'
                                  ? 'bg-[#ffdad6] text-[#ba1a1a] border-[#ba1a1a]'
                                  : grade >= 14
                                  ? 'bg-[#eaedff] text-[#00236f] border-[#dce1ff]'
                                  : grade < 10
                                  ? 'bg-[#ffdad6]/60 text-[#ba1a1a] border-[#ffdad6]'
                                  : 'bg-white text-[#131b2e] border-[#eaedff]'
                              } focus:border-[#0051d5] focus:bg-white`}
                            />
                            {etat && (
                              <span
                                aria-hidden="true"
                                title={titreEtat}
                                className={`absolute -top-1.5 -right-1.5 material-symbols-outlined text-[13px] leading-none rounded-full bg-white ${
                                  etat === 'enregistree' ? 'text-emerald-600'
                                    : etat === 'erreur' ? 'text-[#ba1a1a]'
                                    : etat === 'envoi' ? 'text-[#0051d5] animate-spin'
                                    : 'text-amber-600'
                                }`}
                              >
                                {etat === 'enregistree' ? 'cloud_done' : etat === 'erreur' ? 'error' : etat === 'envoi' ? 'progress_activity' : 'edit'}
                              </span>
                            )}
                          </span>
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
                    <td className="py-2 px-2 font-mono text-center">
                      {stats ? (
                        <span className={`inline-flex items-center justify-center gap-0.5 px-2 py-0.5 rounded text-[11px] font-bold ${
                          stats.rank === 1
                            ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-xs'
                            : stats.rank === 2
                            ? 'bg-slate-100 text-slate-800 border border-slate-300'
                            : stats.rank === 3
                            ? 'bg-orange-100 text-orange-900 border border-orange-300'
                            : 'text-[#0051d5] bg-[#eaedff]'
                        }`}>
                          {stats.rank === 1 ? '🥇 1er' : stats.rank === 2 ? '🥈 2e' : stats.rank === 3 ? '🥉 3e' : `${stats.rank}e`}
                        </span>
                      ) : (
                        '—'
                      )}
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
                        onClick={() => {
                          if (!juryLocked) setSelectedCandidateForBonus(cand);
                        }}
                        disabled={juryLocked}
                        className="p-1 rounded bg-[#eaedff] text-[#0051d5] hover:bg-[#dce1ff] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title={juryLocked ? 'PV verrouillé' : 'Arbitrage / Rachat du jury'}
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
