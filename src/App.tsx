import React, { useState, useMemo, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { BulletinView } from './components/BulletinView';
import { DashboardView } from './components/DashboardView';
import { StudentsListView } from './components/StudentsListView';
import { GradingView } from './components/GradingView';
import { RecordsView } from './components/RecordsView';
import { SettingsView } from './components/SettingsView';
import { AuthView } from './components/AuthView';
import { AllBulletinsPrintModal } from './components/AllBulletinsPrintModal';
import { SignatureModal } from './components/SignatureModal';
import { SmsModal } from './components/SmsModal';
import { SearchModal } from './components/SearchModal';
import { INITIAL_SUBJECTS, computeCandidateStats, autoAssignTableNumbers } from './data/mockData';
import {
  getRegisteredSchools,
  getCurrentSchoolId,
  setCurrentSchoolId,
  getSchoolData,
  saveSchoolData,
} from './data/schoolsData';
import { Candidate, Subject, ViewMode, AppSettings, SchoolAccount } from './types';

export default function App() {
  // Establishment Multi-Tenant State
  const [schools, setSchools] = useState<SchoolAccount[]>(() => getRegisteredSchools());
  const [currentSchoolId, setCurrentSchoolIdState] = useState<string>(() => getCurrentSchoolId());

  const currentSchool = useMemo(() => {
    return schools.find((s) => s.id === currentSchoolId) || schools[0];
  }, [schools, currentSchoolId]);

  // Isolated data state for the currently logged-in establishment
  const [candidates, setCandidates] = useState<Candidate[]>(() => {
    const data = getSchoolData(getCurrentSchoolId());
    return data.candidates;
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const data = getSchoolData(getCurrentSchoolId());
    return data.settings;
  });

  const [subjects] = useState<Subject[]>(INITIAL_SUBJECTS);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>(() => {
    const data = getSchoolData(getCurrentSchoolId());
    return data.candidates[0]?.id || '';
  });

  const [currentView, setCurrentView] = useState<ViewMode>('bulletin');
  const [selectedSession, setSelectedSession] = useState<string>('BAC II Blanc 2025 - Série D');
  const [selectedCenter, setSelectedCenter] = useState<string>(() => {
    return `${currentSchool?.name || 'Lycée Moderne de Tokoin'} (Centre 01)`;
  });
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);

  // Modals state
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isBatchPrintModalOpen, setIsBatchPrintModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Sync isolated data on changes
  const handleUpdateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    saveSchoolData(currentSchoolId, newSettings, candidates);
    setSchools(getRegisteredSchools());
  };

  const handleUpdateCandidates = (newCandidates: Candidate[]) => {
    setCandidates(newCandidates);
    saveSchoolData(currentSchoolId, settings, newCandidates);
  };

  // Switch active establishment
  const handleSelectSchool = (schoolId: string) => {
    const target = schools.find((s) => s.id === schoolId);
    if (!target) return;

    setCurrentSchoolIdState(schoolId);
    setCurrentSchoolId(schoolId);

    const schoolData = getSchoolData(schoolId);
    setCandidates(schoolData.candidates);
    setSettings(schoolData.settings);
    setSelectedCandidateId(schoolData.candidates[0]?.id || '');
    setSelectedCenter(`${target.name} (Centre d'Examen)`);

    setIsAuthModalOpen(false);
    if (currentView === 'auth') {
      setCurrentView('bulletin');
    }

    showToast(`Espace de l'établissement "${target.name}" chargé avec succès. Données 100% isolées.`);
  };

  // Handle new establishment registration
  const handleAccountCreated = (newSchool: SchoolAccount) => {
    setSchools(getRegisteredSchools());
    setCurrentSchoolIdState(newSchool.id);
    setCurrentSchoolId(newSchool.id);

    setCandidates(newSchool.candidates);
    setSettings(newSchool.settings);
    setSelectedCandidateId(newSchool.candidates[0]?.id || '');
    setSelectedCenter(`${newSchool.name} (Centre d'Examen)`);

    setIsAuthModalOpen(false);
    if (currentView === 'auth') {
      setCurrentView('dashboard');
    }

    showToast(`Compte créé avec succès pour ${newSchool.name} ! Bienvenue sur votre espace souverain.`);
  };

  // Compute stats for all candidates of the active school
  const allStats = useMemo(() => {
    const map: Record<string, ReturnType<typeof computeCandidateStats>> = {};
    candidates.forEach((cand) => {
      map[cand.id] = computeCandidateStats(cand, subjects, candidates);
    });
    return map;
  }, [candidates, subjects]);

  const selectedCandidate = useMemo(() => {
    return candidates.find((c) => c.id === selectedCandidateId) || candidates[0];
  }, [candidates, selectedCandidateId]);

  const computedStats = useMemo(() => {
    if (!selectedCandidate) {
      return {
        totalCoef: 29,
        totalPoints: 0,
        average: 0,
        rank: 1,
        totalCandidates: 0,
        mention: 'AJOURNÉ' as const,
        decision: "AJOURNÉ À L'EXAMEN BLANC" as const,
        differenceToPromo: 0,
      };
    }
    return allStats[selectedCandidate.id] || computeCandidateStats(selectedCandidate, subjects, candidates);
  }, [allStats, selectedCandidate, subjects, candidates]);

  // Update a grade for a candidate
  const handleUpdateGrade = (candidateId: string, subjectId: string, newScore: number) => {
    const updated = candidates.map((c) => {
      if (c.id !== candidateId) return c;
      const currentApprec = c.grades[subjectId]?.appreciation || 'Travail évalué.';
      return {
        ...c,
        grades: {
          ...c.grades,
          [subjectId]: {
            score: newScore,
            appreciation: currentApprec,
          },
        },
      };
    });
    handleUpdateCandidates(updated);
  };

  // Apply jury bonus (repêchage)
  const handleApplyJuryBonus = (candidateId: string, bonus: number) => {
    const updated = candidates.map((c) => {
      if (c.id !== candidateId) return c;
      return {
        ...c,
        juryBonus: bonus,
        generalObservation: `« Délibération spéciale du Jury : bonus de repêchage de +${bonus.toFixed(2)} pts accordé au vu de l'assiduité. »`,
      };
    });
    handleUpdateCandidates(updated);
    showToast(`Délibération enregistrée : +${bonus.toFixed(2)} pts de rachat accordés.`);
  };

  // Sign digitally
  const handleSign = (signedAt: string, signer: string, shaHash: string) => {
    if (!selectedCandidate) return;
    const updated = candidates.map((c) => {
      if (c.id !== selectedCandidate.id) return c;
      return {
        ...c,
        digitalSignature: {
          signedAt,
          signer,
          shaHash,
        },
      };
    });
    handleUpdateCandidates(updated);
    showToast(`Signature électronique X.509 de ${signer} apposée et scellée avec succès.`);
  };

  // Add new candidate with automatic alphabetical table assignment
  const handleAddNewCandidate = (newCand: Candidate) => {
    const updatedList = [...candidates, newCand];
    const finalList = settings.autoAssignTables !== false
      ? autoAssignTableNumbers(updatedList, settings.startTableNumber || 101)
      : updatedList;

    handleUpdateCandidates(finalList);
    setSelectedCandidateId(newCand.id);
    showToast(`Candidat ${newCand.fullName} inscrit ! N° de table généré automatiquement par ordre alphabétique.`);
  };

  // Batch add candidates with automatic alphabetical table assignment
  const handleBatchAddCandidates = (newCands: Candidate[]) => {
    const updatedList = [...candidates, ...newCands];
    const finalList = settings.autoAssignTables !== false
      ? autoAssignTableNumbers(updatedList, settings.startTableNumber || 101)
      : updatedList;

    handleUpdateCandidates(finalList);
    showToast(`${newCands.length} candidats importés et numérotés automatiquement par ordre alphabétique (A → Z) !`);
  };

  // Update candidate and synchronize alphabetical table numbers if name changes
  const handleUpdateCandidate = (updated: Candidate) => {
    const list = candidates.map((c) => (c.id === updated.id ? updated : c));
    const finalList = settings.autoAssignTables !== false
      ? autoAssignTableNumbers(list, settings.startTableNumber || 101)
      : list;

    handleUpdateCandidates(finalList);
    showToast(`Fiche de ${updated.fullName} mise à jour (N° de table recalculé automatiquement).`);
  };

  // Delete candidate and re-index table numbers
  const handleDeleteCandidate = (candidateId: string) => {
    const remaining = candidates.filter((c) => c.id !== candidateId);
    if (selectedCandidateId === candidateId && remaining.length > 0) {
      setSelectedCandidateId(remaining[0].id);
    }
    const finalList = settings.autoAssignTables !== false
      ? autoAssignTableNumbers(remaining, settings.startTableNumber || 101)
      : remaining;

    handleUpdateCandidates(finalList);
    showToast('Candidat retiré du registre et numéros de table réajustés.');
  };

  // Manual trigger to re-generate table numbers alphabetically A-Z
  const handleRenumberAlphabetically = (startNumber?: number) => {
    const base = startNumber ?? settings.startTableNumber ?? 101;
    const renumbered = autoAssignTableNumbers(candidates, base);
    handleUpdateCandidates(renumbered);
    showToast(`Tables générées automatiquement de ${base} à ${base + candidates.length - 1} selon l'ordre alphabétique des noms (A → Z) !`);
  };

  // PDF download simulation
  const handleDownloadPdf = () => {
    showToast('Génération du PDF vectoriel A4 (Haute Résolution 300 DPI) en cours...');
    setTimeout(() => {
      window.print();
    }, 600);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchModalOpen(true);
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        window.print();
      }

      if (currentView === 'bulletin') {
        const currentIndex = candidates.findIndex((c) => c.id === selectedCandidateId);
        if (e.key === 'ArrowLeft' && currentIndex > 0) {
          setSelectedCandidateId(candidates[currentIndex - 1].id);
        } else if (e.key === 'ArrowRight' && currentIndex < candidates.length - 1) {
          setSelectedCandidateId(candidates[currentIndex + 1].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [candidates, selectedCandidateId, currentView]);

  // If in auth view mode full-screen
  if (currentView === 'auth') {
    return (
      <AuthView
        currentSchool={currentSchool}
        onSelectSchool={handleSelectSchool}
        onAccountCreated={handleAccountCreated}
        onClose={() => setCurrentView('bulletin')}
      />
    );
  }

  return (
    <div className="bg-[#faf8ff] text-[#131b2e] min-h-screen antialiased flex">
      {/* Sidebar Navigation */}
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        selectedSession={selectedSession}
        onSessionChange={setSelectedSession}
        selectedCenter={selectedCenter}
        onCenterChange={setSelectedCenter}
        isOfflineMode={isOfflineMode}
        onToggleOffline={() => {
          setIsOfflineMode(!isOfflineMode);
          showToast(!isOfflineMode ? 'Passage en mode hors-ligne simulé.' : 'Connexion rétablie.');
        }}
        settings={settings}
        candidatesCount={candidates.length}
        onOpenBatchPrint={() => setIsBatchPrintModalOpen(true)}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenSearch={() => setIsSearchModalOpen(true)}
      />

      {/* Main Content Area - Navigated strictly via Sidebar */}
      <div className="pl-80 w-full min-h-screen flex flex-col">
        {/* View Routing */}
        <main className="relative bg-[#faf8ff] flex-1">
          {currentView === 'bulletin' && selectedCandidate && (
            <BulletinView
              candidates={candidates}
              selectedCandidate={selectedCandidate}
              onSelectCandidate={(c) => setSelectedCandidateId(c.id)}
              subjects={subjects}
              computedStats={computedStats}
              onOpenSignature={() => setIsSignatureModalOpen(true)}
              onOpenSms={() => setIsSmsModalOpen(true)}
              onDownloadPdf={handleDownloadPdf}
              onPrintAll={() => setIsBatchPrintModalOpen(true)}
              settings={settings}
            />
          )}

          {currentView === 'students' && (
            <StudentsListView
              candidates={candidates}
              subjects={subjects}
              onAddNewCandidate={handleAddNewCandidate}
              onUpdateCandidate={handleUpdateCandidate}
              onDeleteCandidate={handleDeleteCandidate}
              onSelectCandidate={(c) => setSelectedCandidateId(c.id)}
              onNavigateToGrading={(c) => {
                if (c) setSelectedCandidateId(c.id);
                setCurrentView('grading');
              }}
              onNavigateToBulletin={(c) => {
                setSelectedCandidateId(c.id);
                setCurrentView('bulletin');
              }}
              selectedSession={selectedSession}
              selectedCenter={selectedCenter}
              settings={settings}
              onRenumberAlphabetically={handleRenumberAlphabetically}
              onBatchAddCandidates={handleBatchAddCandidates}
              onOpenBatchPrint={() => setIsBatchPrintModalOpen(true)}
            />
          )}

          {currentView === 'dashboard' && (
            <DashboardView
              candidates={candidates}
              subjects={subjects}
              allStats={allStats}
              onSelectCandidate={(c) => setSelectedCandidateId(c.id)}
              onNavigate={setCurrentView}
              selectedSession={selectedSession}
              selectedCenter={selectedCenter}
            />
          )}

          {currentView === 'grading' && (
            <GradingView
              candidates={candidates}
              subjects={subjects}
              allStats={allStats}
              onUpdateGrade={handleUpdateGrade}
              onApplyJuryBonus={handleApplyJuryBonus}
              onSelectCandidate={(c) => setSelectedCandidateId(c.id)}
              onNavigateToBulletin={(c) => {
                setSelectedCandidateId(c.id);
                setCurrentView('bulletin');
              }}
              onAddNewCandidate={handleAddNewCandidate}
            />
          )}

          {currentView === 'records' && (
            <RecordsView
              candidates={candidates}
              allStats={allStats}
              onSelectCandidate={(c) => setSelectedCandidateId(c.id)}
              onNavigateToBulletin={(c) => {
                setSelectedCandidateId(c.id);
                setCurrentView('bulletin');
              }}
              selectedSession={selectedSession}
              selectedCenter={selectedCenter}
            />
          )}

          {currentView === 'settings' && (
            <SettingsView
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              onNavigate={setCurrentView}
              onOpenAuth={() => setIsAuthModalOpen(true)}
              candidates={candidates}
              allStats={allStats}
            />
          )}
        </main>
      </div>

      {/* Signature Modal */}
      {isSignatureModalOpen && selectedCandidate && (
        <SignatureModal
          candidate={selectedCandidate}
          onClose={() => setIsSignatureModalOpen(false)}
          onSign={handleSign}
        />
      )}

      {/* SMS & Mail Parents Modal */}
      {isSmsModalOpen && selectedCandidate && (
        <SmsModal
          candidate={selectedCandidate}
          stats={computedStats}
          onClose={() => setIsSmsModalOpen(false)}
          onSent={(msg) => showToast(msg)}
        />
      )}

      {/* Quick Search Modal */}
      {isSearchModalOpen && (
        <SearchModal
          candidates={candidates}
          allStats={allStats}
          onClose={() => setIsSearchModalOpen(false)}
          onSelectCandidate={(c) => {
            setSelectedCandidateId(c.id);
            setCurrentView('bulletin');
          }}
        />
      )}

      {/* 1-Click All Bulletins Batch Print Modal */}
      {isBatchPrintModalOpen && (
        <AllBulletinsPrintModal
          candidates={candidates}
          subjects={subjects}
          allStats={allStats}
          settings={settings}
          onClose={() => setIsBatchPrintModalOpen(false)}
        />
      )}

      {/* Establishment Accounts / Login Modal */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-4xl">
            <AuthView
              currentSchool={currentSchool}
              onSelectSchool={handleSelectSchool}
              onAccountCreated={handleAccountCreated}
              onClose={() => setIsAuthModalOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Administrative Toast Simulation */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-[#00236f] text-white px-4 py-3 rounded shadow-2xl flex items-center gap-2.5 z-50 animate-bounce text-[12px] font-medium border border-[#90a8ff]/30">
          <span className="material-symbols-outlined text-[#316bf3] text-base">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
