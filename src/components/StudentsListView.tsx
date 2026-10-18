import React, { useState } from 'react';
import { Candidate, Subject, AppSettings } from '../types';
import { printDocument } from '../utils/printDocument';
import { confirmDelete } from '../utils/alerts';
import { getToken } from '../api/client';

interface StudentsListViewProps {
  candidates: Candidate[];
  subjects: Subject[];
  onAddNewCandidate: (candidate: Candidate) => void;
  onUpdateCandidate: (candidate: Candidate) => void;
  onDeleteCandidate: (candidateId: string) => void;
  onSelectCandidate: (candidate: Candidate) => void;
  onNavigateToGrading: (candidate?: Candidate) => void;
  onNavigateToBulletin: (candidate: Candidate) => void;
  selectedSession: string;
  selectedCenter: string;
  settings?: AppSettings;
  onRenumberAlphabetically?: (startNumber?: number) => void;
  onBatchAddCandidates?: (candidates: Candidate[]) => void;
  onOpenBatchPrint?: () => void;
}

export const StudentsListView: React.FC<StudentsListViewProps> = ({
  candidates,
  subjects,
  onAddNewCandidate,
  onUpdateCandidate,
  onDeleteCandidate,
  onSelectCandidate,
  onNavigateToGrading,
  onNavigateToBulletin,
  selectedSession,
  selectedCenter,
  settings,
  onRenumberAlphabetically,
  onBatchAddCandidates,
  onOpenBatchPrint,
}) => {
  const [startTableNum, setStartTableNum] = useState<number>(settings?.startTableNumber || 138);
  /** Connecté à l'API : le matricule est attribué par le serveur et n'est pas saisi. */
  const matriculeServeur = !!getToken();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGender, setFilterGender] = useState<'all' | 'M' | 'F'>('all');
  const [filterGradeStatus, setFilterGradeStatus] = useState<'all' | 'complete' | 'pending'>('all');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);

  // New Student Form State
  const [newStudent, setNewStudent] = useState({
    tableNumber: candidates.length > 0 ? Math.max(...candidates.map((c) => c.tableNumber)) + 1 : 101,
    matricule: `24-BACD-094${candidates.length + 20}`,
    fullName: '',
    dob: '15/05/2006',
    birthPlace: 'Lomé',
    originSchool: 'Lycée Moderne de Tokoin',
    gender: 'M' as 'M' | 'F',
    parentPhone: '+228 90 12 34 56',
    parentEmail: 'parent.contact@edu.tg',
  });

  // Batch CSV Paste Text
  const [batchText, setBatchText] = useState('');

  // Check if candidate has completed grades
  const isCandidateGradesComplete = (cand: Candidate) => {
    return subjects.every((s) => cand.grades[s.id] && cand.grades[s.id].score > 0);
  };

  const filteredCandidates = candidates.filter((c) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      c.fullName.toLowerCase().includes(q) ||
      c.tableNumber.toString().includes(q) ||
      c.matricule.toLowerCase().includes(q) ||
      c.originSchool.toLowerCase().includes(q);

    if (!matchesSearch) return false;
    if (filterGender !== 'all' && c.gender !== filterGender) return false;

    const isComplete = isCandidateGradesComplete(c);
    if (filterGradeStatus === 'complete' && !isComplete) return false;
    if (filterGradeStatus === 'pending' && isComplete) return false;

    return true;
  });

  // Total Counts
  const totalStudents = candidates.length;
  const countM = candidates.filter((c) => c.gender === 'M').length;
  const countF = candidates.filter((c) => c.gender === 'F').length;
  const countComplete = candidates.filter(isCandidateGradesComplete).length;
  const countPending = totalStudents - countComplete;

  const handleCreateStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.fullName.trim()) return;

    const initialGrades: Record<string, { score: number; appreciation: string }> = {};
    subjects.forEach((s) => {
      initialGrades[s.id] = { score: 10.0, appreciation: 'En attente de notation.' };
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
      serie: selectedSession,
      examCenter: 'Centre N° 03 • Salle 12',
      examCenterName: selectedCenter,
      parentPhone: newStudent.parentPhone,
      parentEmail: newStudent.parentEmail,
      generalObservation: '« Candidat régulièrement inscrit pour la session d\'examen blanc. »',
      grades: initialGrades,
      isDeliberated: false,
    };

    onAddNewCandidate(created);
    setShowAddModal(false);
    setNewStudent({
      tableNumber: created.tableNumber + 1,
      matricule: `24-BACD-094${created.tableNumber - 100 + 25}`,
      fullName: '',
      dob: '15/05/2006',
      birthPlace: 'Yamoussoukro',
      originSchool: 'Lycée Scientifique Régional',
      gender: 'M',
      parentPhone: '+225 07 48 92 11 02',
      parentEmail: 'parent.contact@edu.ci',
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCandidate) return;
    onUpdateCandidate(editingCandidate);
    setEditingCandidate(null);
  };

  const handleBatchImport = () => {
    if (!batchText.trim()) return;
    const lines = batchText.trim().split('\n');
    const newBatchCandidates: Candidate[] = [];

    lines.forEach((line, idx) => {
      const parts = line.split(/[,;\t]/).map((p) => p.trim());
      if (parts.length >= 1 && parts[0]) {
        const fullName = parts[0];
        const gender = parts[1]?.toUpperCase() === 'F' ? 'F' : 'M';
        const dob = parts[2] || '14/09/2006';
        const school = parts[3] || 'Lycée Moderne de Tokoin';
        const phone = parts[4] || '+228 90 00 00 00';

        const initialGrades: Record<string, { score: number; appreciation: string }> = {};
        subjects.forEach((s) => {
          initialGrades[s.id] = { score: 10.0, appreciation: 'En attente de notation.' };
        });

        const newCand: Candidate = {
          id: `cand-batch-${Date.now()}-${idx}`,
          tableNumber: 0, // Assigned automatically by alphabetical order
          matricule: `24-BACD-095${idx + 30}`,
          fullName,
          dob,
          birthPlace: 'Lomé',
          originSchool: school,
          gender: gender as 'M' | 'F',
          serie: selectedSession,
          examCenter: 'Centre N° 01 • Salle 12',
          examCenterName: selectedCenter,
          parentPhone: phone,
          parentEmail: 'parent@edu.tg',
          generalObservation: '« Candidat importé depuis la liste officielle. »',
          grades: initialGrades,
          isDeliberated: false,
        };

        newBatchCandidates.push(newCand);
      }
    });

    if (newBatchCandidates.length > 0) {
      if (onBatchAddCandidates) {
        onBatchAddCandidates(newBatchCandidates);
      } else {
        newBatchCandidates.forEach((c) => onAddNewCandidate(c));
      }
    }

    setBatchText('');
    setShowBatchModal(false);
  };

  const loadSampleBatch = () => {
    setBatchText(`ADJOLOU Kokou Boris, M, 12/04/2006, Lycée de Tokoin, +228 90 11 22 33
AMOUZOU Afiwa Chimène, F, 24/07/2006, Collège Protestant Lomé, +228 91 44 55 66
AYEVA Kodjo Mawuli, M, 09/11/2005, Lycée d'Agoè-Nyivé, +228 92 77 88 99
LAWSON Boèvi Laté, M, 30/03/2007, Lycée Moderne de Tokoin, +228 93 23 45 67
MENSAH Ayélé Pierrette, F, 14/08/2006, Lycée Scientifique de Lomé, +228 90 88 99 00`);
  };

  return (
    <>
    <div className="students-ui p-8 max-w-[1440px] mx-auto space-y-6">
      {/* Workflow Navigation Banner */}
      <div className="bg-[#00236f] text-white p-4 rounded-lg shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-2xl text-[#90a8ff]">format_list_bulleted</span>
          <div>
            <h3 className="font-bold text-[15px] tracking-wide uppercase">
              Étape 1 : Liste &amp; Enregistrement des Élèves Candidats
            </h3>
            <p className="text-[12px] text-[#90a8ff]">
              Établissez et vérifiez la liste nominale avant de procéder à la saisie des notes et à la génération des bulletins.
            </p>
          </div>
        </div>

        {/* Step Indicator Badges */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-white text-[#00236f] text-[11px] font-bold shadow-xs">
            <span className="w-2 h-2 rounded-full bg-[#0051d5]"></span>
            <span>1. Inscription Élèves (Actif)</span>
          </span>
          <span className="text-[#90a8ff]">→</span>
          <button
            type="button"
            onClick={() => onNavigateToGrading()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#1e3a8a] text-white text-[11px] font-semibold hover:bg-[#316bf3] transition-colors"
          >
            <span>2. Saisie des Notes</span>
          </button>
          <span className="text-[#90a8ff]">→</span>
          <button
            type="button"
            onClick={() => {
              if (candidates.length > 0) onNavigateToBulletin(candidates[0]);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#1e3a8a] text-white text-[11px] font-semibold hover:bg-[#316bf3] transition-colors"
          >
            <span>3. Bulletins A4</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded border border-[#eaedff] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase font-bold text-[#444651] block">Candidats Inscrits</span>
            <span className="font-sans text-[28px] font-bold text-[#00236f] leading-none my-1 block">
              {totalStudents}
            </span>
            <span className="text-[11px] text-[#0051d5] font-medium font-mono">
              {selectedCenter}
            </span>
          </div>
          <div className="w-12 h-12 rounded-full bg-[#eaedff] flex items-center justify-center text-[#00236f]">
            <span className="material-symbols-outlined text-2xl">badge</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded border border-[#eaedff] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase font-bold text-[#444651] block">Parité Genre</span>
            <div className="flex items-center gap-3 my-1">
              <span className="font-sans text-[22px] font-bold text-[#00236f]">
                {countM} <span className="text-[12px] font-normal text-[#444651]">Garçons</span>
              </span>
              <span className="text-[#eaedff]">|</span>
              <span className="font-sans text-[22px] font-bold text-[#0051d5]">
                {countF} <span className="text-[12px] font-normal text-[#444651]">Filles</span>
              </span>
            </div>
            <span className="text-[11px] text-[#444651]">
              {totalStudents > 0 ? Math.round((countF / totalStudents) * 100) : 0}% de candidates
            </span>
          </div>
          <div className="w-12 h-12 rounded-full bg-[#eaedff] flex items-center justify-center text-[#0051d5]">
            <span className="material-symbols-outlined text-2xl">wc</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded border border-[#eaedff] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase font-bold text-[#444651] block">Statut Notation</span>
            <span className="font-sans text-[28px] font-bold text-[#0051d5] leading-none my-1 block">
              {countComplete}
            </span>
            <span className="text-[11px] text-[#444651]">
              candidats avec notes complètes
            </span>
          </div>
          <div className="w-12 h-12 rounded-full bg-[#dce1ff] flex items-center justify-center text-[#00236f]">
            <span className="material-symbols-outlined text-2xl">fact_check</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded border border-[#eaedff] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase font-bold text-[#444651] block">En Attente de Saisie</span>
            <span className="font-sans text-[28px] font-bold text-[#ba1a1a] leading-none my-1 block">
              {countPending}
            </span>
            <span className="text-[11px] text-[#444651]">
              copies non renseignées
            </span>
          </div>
          <div className="w-12 h-12 rounded-full bg-[#ffdad6] flex items-center justify-center text-[#ba1a1a]">
            <span className="material-symbols-outlined text-2xl">pending_actions</span>
          </div>
        </div>
      </div>

      {/* Main Action Bar */}
      <div className="bg-white p-4 rounded border border-[#eaedff] shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Search & Filters */}
        <div className="flex items-center gap-3 flex-1 min-w-[300px]">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Rechercher par nom, table, matricule ou lycée..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#f2f3ff] text-[13px] py-2 pl-9 pr-3 rounded border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5]"
            />
            <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-[#444651] text-base">
              search
            </span>
          </div>

          <div className="flex items-center gap-1 bg-[#f2f3ff] p-1 rounded border border-[#eaedff] text-[11px]">
            <button
              type="button"
              onClick={() => setFilterGender('all')}
              className={`px-2.5 py-1 rounded font-semibold transition-colors ${
                filterGender === 'all' ? 'bg-white text-[#00236f] shadow-xs' : 'text-[#444651]'
              }`}
            >
              Tous
            </button>
            <button
              type="button"
              onClick={() => setFilterGender('M')}
              className={`px-2.5 py-1 rounded font-semibold transition-colors ${
                filterGender === 'M' ? 'bg-white text-[#00236f] shadow-xs' : 'text-[#444651]'
              }`}
            >
              Garçons
            </button>
            <button
              type="button"
              onClick={() => setFilterGender('F')}
              className={`px-2.5 py-1 rounded font-semibold transition-colors ${
                filterGender === 'F' ? 'bg-white text-[#00236f] shadow-xs' : 'text-[#444651]'
              }`}
            >
              Filles
            </button>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#00236f] text-white text-[12px] font-bold hover:bg-[#1e3a8a] transition-all shadow-xs"
          >
            <span className="material-symbols-outlined text-base">person_add</span>
            <span>Nouveau Candidat</span>
          </button>

          <button
            type="button"
            onClick={() => setShowBatchModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#eaedff] text-[#00236f] text-[12px] font-semibold hover:bg-[#dce1ff] transition-colors"
          >
            <span className="material-symbols-outlined text-base">upload</span>
            <span>Import en Masse (CSV)</span>
          </button>

          {onOpenBatchPrint && (
            <button
              type="button"
              onClick={onOpenBatchPrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#0051d5] text-white text-[12px] font-bold hover:bg-[#003cb3] transition-all shadow-xs"
              title="Ouvrir l'aperçu puis télécharger tous les bulletins en PDF"
            >
              <span className="material-symbols-outlined text-base">print_connect</span>
              <span>Télécharger tous les bulletins ({candidates.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => printDocument('emargement', `Emargement_${selectedSession}`)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#f2f3ff] text-[#444651] text-[12px] font-semibold hover:bg-[#eaedff] transition-colors"
            title="Imprimer la feuille d'émargement des candidats inscrits"
          >
            <span className="material-symbols-outlined text-base">print</span>
            <span>Feuille d'Émargement</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateToGrading()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#0051d5] text-white text-[12px] font-bold hover:bg-[#003ea8] transition-all shadow-xs"
          >
            <span>Passer à la Saisie des Notes</span>
            <span className="material-symbols-outlined text-base">arrow_forward</span>
          </button>
        </div>
      </div>

      {/* Roster Table */}
      <div className="bg-white rounded border border-[#eaedff] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[12px]">
            <thead>
              <tr className="bg-[#00236f] text-white">
                <th className="py-2.5 px-3 font-semibold text-center w-16">Table</th>
                <th className="py-2.5 px-3 font-semibold min-w-[200px]">Nom et Prénoms</th>
                <th className="py-2.5 px-3 font-semibold">Matricule National</th>
                <th className="py-2.5 px-3 font-semibold">Date &amp; Lieu de Naissance</th>
                <th className="py-2.5 px-2 font-semibold text-center w-16">Genre</th>
                <th className="py-2.5 px-3 font-semibold">Établissement d'Origine</th>
                <th className="py-2.5 px-3 font-semibold">Contact Tuteur</th>
                <th className="py-2.5 px-3 font-semibold text-center">Statut Notes</th>
                <th className="py-2.5 px-3 font-semibold text-center min-w-[150px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eaedff]">
              {filteredCandidates.map((cand, idx) => {
                const isEven = idx % 2 === 0;
                const isComplete = isCandidateGradesComplete(cand);
                return (
                  <tr
                    key={cand.id}
                    className={`${isEven ? 'bg-white' : 'bg-[#faf8ff]'} hover:bg-[#eaedff]/60 transition-colors`}
                  >
                    <td className="py-2.5 px-3 font-mono font-bold text-center text-[#00236f]">
                      {cand.tableNumber}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-[#131b2e]">
                      {cand.fullName}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#0051d5] font-semibold">
                      {cand.matricule}
                    </td>
                    <td className="py-2.5 px-3 text-[#444651]">
                      {cand.dob} à {cand.birthPlace}
                    </td>
                    <td className="py-2.5 px-2 text-center font-bold">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${
                        cand.gender === 'F' ? 'bg-[#ffdcc3] text-[#653400]' : 'bg-[#dce1ff] text-[#00236f]'
                      }`}>
                        {cand.gender}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[#444651]">
                      {cand.originSchool}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-[#444651]">
                      <div>{cand.parentPhone}</div>
                      <div className="text-[10px] text-[#757682] truncate">{cand.parentEmail}</div>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-tight ${
                          isComplete
                            ? 'bg-[#eaedff] text-[#0051d5] border border-[#dce1ff]'
                            : 'bg-[#ffdad6] text-[#ba1a1a] border border-[#ffdad6]'
                        }`}
                      >
                        {isComplete ? 'Notes Saisies (8/8)' : 'En Attente (0/8)'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center space-x-1 whitespace-nowrap">
                      {/* Saisir les notes */}
                      <button
                        type="button"
                        onClick={() => {
                          onSelectCandidate(cand);
                          onNavigateToGrading(cand);
                        }}
                        className="p-1.5 rounded bg-[#eaedff] text-[#0051d5] hover:bg-[#dce1ff] transition-colors"
                        title="Saisir les notes de ce candidat"
                      >
                        <span className="material-symbols-outlined text-base">edit_note</span>
                      </button>

                      {/* Voir Bulletin */}
                      <button
                        type="button"
                        onClick={() => {
                          onSelectCandidate(cand);
                          onNavigateToBulletin(cand);
                        }}
                        className="p-1.5 rounded bg-[#eaedff] text-[#00236f] hover:bg-[#dce1ff] transition-colors"
                        title="Voir le Bulletin Officiel"
                      >
                        <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                      </button>

                      {/* Modifier infos élève */}
                      <button
                        type="button"
                        onClick={() => setEditingCandidate(cand)}
                        className="p-1.5 rounded hover:bg-[#eaedff] text-[#444651] transition-colors"
                        title="Modifier l'élève"
                      >
                        <span className="material-symbols-outlined text-base">edit</span>
                      </button>

                      {/* Supprimer élève */}
                      <button
                        type="button"
                        onClick={() => {
                          void confirmDelete(`${cand.fullName} (Table ${cand.tableNumber})`, 'L’élève sera retiré de la liste des candidats.').then((ok) => {
                            if (ok) onDeleteCandidate(cand.id);
                          });
                        }}
                        className="p-1.5 rounded hover:bg-[#ffdad6] text-[#ba1a1a] transition-colors"
                        title="Supprimer"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add New Candidate Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <form
            onSubmit={handleCreateStudent}
            className="bg-white rounded-lg shadow-2xl max-w-lg w-full p-6 border border-[#eaedff] space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#eaedff]">
              <div className="flex items-center gap-2 text-[#00236f]">
                <span className="material-symbols-outlined text-xl">person_add</span>
                <span className="font-bold text-[16px]">Inscription d'un Élève</span>
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
                <label className="block font-semibold text-[#444651] mb-1">Nom et Prénoms Complets</label>
                <input
                  required
                  type="text"
                  placeholder="ex: KOUASSI Marc Aurele"
                  value={newStudent.fullName}
                  onChange={(e) => setNewStudent({ ...newStudent, fullName: e.target.value })}
                  className="w-full bg-[#f2f3ff] py-2 px-3 rounded border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5] font-semibold"
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
                <label className="block font-semibold text-[#444651] mb-1">Matricule National</label>
                {matriculeServeur ? (
                  <div className="w-full bg-[#faf8ff] py-1.5 px-3 rounded border border-dashed border-[#dce1ff] text-[#757682] italic">
                    Attribué automatiquement à l'inscription
                  </div>
                ) : (
                  <input
                    type="text"
                    value={newStudent.matricule}
                    onChange={(e) => setNewStudent({ ...newStudent, matricule: e.target.value })}
                    className="w-full bg-[#f2f3ff] py-1.5 px-3 rounded border border-[#eaedff] font-mono outline-none"
                  />
                )}
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

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#eaedff]">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded text-[12px] text-[#444651] hover:bg-[#f2f3ff]"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded text-[12px] bg-[#00236f] text-white font-bold hover:bg-[#1e3a8a] shadow-xs"
              >
                Inscrire le Candidat
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Candidate Modal */}
      {editingCandidate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <form
            onSubmit={handleSaveEdit}
            className="bg-white rounded-lg shadow-2xl max-w-lg w-full p-6 border border-[#eaedff] space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#eaedff]">
              <div className="flex items-center gap-2 text-[#00236f]">
                <span className="material-symbols-outlined text-xl">edit</span>
                <span className="font-bold text-[16px]">Modifier la Fiche Élève</span>
              </div>
              <button
                type="button"
                onClick={() => setEditingCandidate(null)}
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
                  value={editingCandidate.fullName}
                  onChange={(e) => setEditingCandidate({ ...editingCandidate, fullName: e.target.value })}
                  className="w-full bg-[#f2f3ff] py-2 px-3 rounded border border-[#eaedff] outline-none font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#444651] mb-1">N° de Table</label>
                <input
                  type="number"
                  value={editingCandidate.tableNumber}
                  onChange={(e) => setEditingCandidate({ ...editingCandidate, tableNumber: Number(e.target.value) })}
                  className="w-full bg-[#f2f3ff] py-1.5 px-3 rounded border border-[#eaedff] font-mono outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#444651] mb-1">Matricule</label>
                <input
                  type="text"
                  value={editingCandidate.matricule}
                  readOnly={matriculeServeur}
                  title={matriculeServeur ? 'Matricule attribué par le serveur, non modifiable' : undefined}
                  onChange={(e) => setEditingCandidate({ ...editingCandidate, matricule: e.target.value })}
                  className={`w-full py-1.5 px-3 rounded border border-[#eaedff] font-mono outline-none ${matriculeServeur ? 'bg-[#faf8ff] text-[#757682] cursor-not-allowed' : 'bg-[#f2f3ff]'}`}
                />
              </div>

              <div>
                <label className="block font-semibold text-[#444651] mb-1">Date de Naissance</label>
                <input
                  type="text"
                  value={editingCandidate.dob}
                  onChange={(e) => setEditingCandidate({ ...editingCandidate, dob: e.target.value })}
                  className="w-full bg-[#f2f3ff] py-1.5 px-3 rounded border border-[#eaedff] outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#444651] mb-1">Lieu de Naissance</label>
                <input
                  type="text"
                  value={editingCandidate.birthPlace}
                  onChange={(e) => setEditingCandidate({ ...editingCandidate, birthPlace: e.target.value })}
                  className="w-full bg-[#f2f3ff] py-1.5 px-3 rounded border border-[#eaedff] outline-none"
                />
              </div>

              <div className="col-span-2">
                <label className="block font-semibold text-[#444651] mb-1">Établissement</label>
                <input
                  type="text"
                  value={editingCandidate.originSchool}
                  onChange={(e) => setEditingCandidate({ ...editingCandidate, originSchool: e.target.value })}
                  className="w-full bg-[#f2f3ff] py-1.5 px-3 rounded border border-[#eaedff] outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#444651] mb-1">Genre</label>
                <select
                  value={editingCandidate.gender}
                  onChange={(e) => setEditingCandidate({ ...editingCandidate, gender: e.target.value as 'M' | 'F' })}
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
                  value={editingCandidate.parentPhone}
                  onChange={(e) => setEditingCandidate({ ...editingCandidate, parentPhone: e.target.value })}
                  className="w-full bg-[#f2f3ff] py-1.5 px-3 rounded border border-[#eaedff] font-mono outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#eaedff]">
              <button
                type="button"
                onClick={() => setEditingCandidate(null)}
                className="px-4 py-2 rounded text-[12px] text-[#444651] hover:bg-[#f2f3ff]"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded text-[12px] bg-[#0051d5] text-white font-bold hover:bg-[#003ea8] shadow-xs"
              >
                Enregistrer les Modifications
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Batch Import Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-lg shadow-2xl max-w-xl w-full p-6 border border-[#eaedff] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#eaedff]">
              <div className="flex items-center gap-2 text-[#00236f]">
                <span className="material-symbols-outlined text-xl">upload_file</span>
                <span className="font-bold text-[16px]">Import en Masse de Candidats</span>
              </div>
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                className="text-[#444651] hover:text-[#131b2e]"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <p className="text-[12px] text-[#444651]">
              Collez votre liste d'élèves au format : <code className="bg-[#f2f3ff] px-1.5 py-0.5 rounded text-[#00236f] font-mono">Nom Prénom, Genre (M/F), Date Naissance, Établissement, Téléphone</code>
            </p>

            <textarea
              rows={6}
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              placeholder="Exemple:
KONE Bakary Amadou, M, 18/02/2006, Lycée Classique d'Abidjan, +225 07 11 22 33
OUATTARA Fatimata, F, 24/07/2006, Lycée Sainte Marie, +225 05 44 55 66"
              className="w-full bg-[#f2f3ff] text-[12px] p-3 rounded border border-[#eaedff] font-mono outline-none focus:bg-white focus:border-[#0051d5]"
            />

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={loadSampleBatch}
                className="text-[11px] text-[#0051d5] font-semibold hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">auto_fix_high</span>
                <span>Charger un exemple de 5 candidats</span>
              </button>
              <span className="text-[11px] text-[#444651]">
                {batchText ? batchText.trim().split('\n').length : 0} lignes prêtes
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#eaedff]">
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                className="px-4 py-2 rounded text-[12px] text-[#444651] hover:bg-[#f2f3ff]"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={!batchText.trim()}
                onClick={handleBatchImport}
                className="px-5 py-2 rounded text-[12px] bg-[#00236f] text-white font-bold hover:bg-[#1e3a8a] shadow-xs disabled:opacity-40"
              >
                Importer la Liste
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    <div className="emargement-sheet p-6 text-[#131b2e]">
      <h1 className="text-[18px] font-bold text-center">Feuille d'émargement</h1>
      <p className="text-center text-[12px] mt-1">{selectedSession} • {selectedCenter}</p>
      <table className="w-full mt-4 border-collapse text-[12px]">
        <thead>
          <tr>
            <th className="border border-black px-2 py-1 text-left">N° table</th>
            <th className="border border-black px-2 py-1 text-left">Nom et prénoms</th>
            <th className="border border-black px-2 py-1 text-left">Matricule</th>
            <th className="border border-black px-2 py-1 text-left">Signature</th>
          </tr>
        </thead>
        <tbody>
          {[...candidates]
            .sort((a, b) => a.tableNumber - b.tableNumber)
            .map((cand) => (
              <tr key={cand.id}>
                <td className="border border-black px-2 py-2">{cand.tableNumber}</td>
                <td className="border border-black px-2 py-2">{cand.fullName}</td>
                <td className="border border-black px-2 py-2">{cand.matricule}</td>
                <td className="border border-black px-2 py-2 h-8"></td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
    </>
  );
};
