import React, { useState, useMemo, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { BulletinView } from './components/BulletinView';
import { DashboardView } from './components/DashboardView';
import { StudentsListView } from './components/StudentsListView';
import { GradingView } from './components/GradingView';
import { RecordsView } from './components/RecordsView';
import { SettingsView } from './components/SettingsView';
import { SignatureModal } from './components/SignatureModal';
import { SmsModal } from './components/SmsModal';
import { SearchModal } from './components/SearchModal';
import { INITIAL_CANDIDATES, INITIAL_SUBJECTS, computeCandidateStats, DEFAULT_SETTINGS, autoAssignTableNumbers } from './data/mockData';
import { Candidate, Subject, ViewMode, AppSettings } from './types';

export default function App() {
  const [candidates, setCandidates] = useState<Candidate[]>(INITIAL_CANDIDATES);
  const [subjects] = useState<Subject[]>(INITIAL_SUBJECTS);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('cand-142');
  const [currentView, setCurrentView] = useState<ViewMode>('bulletin');
  const [selectedSession, setSelectedSession] = useState<string>('BAC II Blanc 2025 - Série D');
  const [selectedCenter, setSelectedCenter] = useState<string>('Lycée Moderne de Tokoin (Centre 01)');
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);

  // Settings state with localStorage persistence (defaults to Togo as requested)
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      localStorage.removeItem('academiablanc_settings_togo');
      localStorage.removeItem('academiablanc_settings_togo_v2');
      const saved = localStorage.getItem('academiablanc_settings_togo_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        delete parsed.directionName;
        delete parsed.regionalDirection;
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch {
      // Fallback
    }
    return DEFAULT_SETTINGS;
  });

  const handleUpdateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem('academiablanc_settings_togo_v3', JSON.stringify(newSettings));
    } catch {
      // Ignore localStorage quotas
    }
  };

  // Modals state
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Compute stats for all candidates
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
    return allStats[selectedCandidate.id] || computeCandidateStats(selectedCandidate, subjects, candidates);
  }, [allStats, selectedCandidate, subjects, candidates]);

  // Update a grade for a candidate
  const handleUpdateGrade = (candidateId: string, subjectId: string, newScore: number) => {
    setCandidates((prev) =>
      prev.map((c) => {
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
      })
    );
  };

  // Apply jury bonus (repêchage)
  const handleApplyJuryBonus = (candidateId: string, bonus: number) => {
    setCandidates((prev) =>
      prev.map((c) => {
        if (c.id !== candidateId) return c;
        return {
          ...c,
          juryBonus: bonus,
          generalObservation: `« Délibération spéciale du Jury : bonus de repêchage de +${bonus.toFixed(2)} pts accordé au vu de l'assiduité. »`,
        };
      })
    );
    showToast(`Délibération enregistrée : +${bonus.toFixed(2)} pts de rachat accordés.`);
  };

  // Sign digitally
  const handleSign = (signedAt: string, signer: string, shaHash: string) => {
    setCandidates((prev) =>
      prev.map((c) => {
        if (c.id !== selectedCandidate.id) return c;
        return {
          ...c,
          digitalSignature: {
            signedAt,
            signer,
            shaHash,
          },
        };
      })
    );
    showToast(`Signature électronique X.509 de ${signer} apposée et scellée avec succès.`);
  };

  // Add new candidate with automatic alphabetical table assignment
  const handleAddNewCandidate = (newCand: Candidate) => {
    setCandidates((prev) => {
      const updatedList = [...prev, newCand];
      if (settings.autoAssignTables !== false) {
        return autoAssignTableNumbers(updatedList, settings.startTableNumber || 138);
      }
      return updatedList;
    });
    setSelectedCandidateId(newCand.id);
    showToast(`Candidat ${newCand.fullName} inscrit ! N° de table généré automatiquement par ordre alphabétique.`);
  };

  // Batch add candidates with automatic alphabetical table assignment
  const handleBatchAddCandidates = (newCands: Candidate[]) => {
    setCandidates((prev) => {
      const updatedList = [...prev, ...newCands];
      if (settings.autoAssignTables !== false) {
        return autoAssignTableNumbers(updatedList, settings.startTableNumber || 138);
      }
      return updatedList;
    });
    showToast(`${newCands.length} candidats importés et numérotés automatiquement par ordre alphabétique (A → Z) !`);
  };

  // Update candidate and synchronize alphabetical table numbers if name changes
  const handleUpdateCandidate = (updated: Candidate) => {
    setCandidates((prev) => {
      const list = prev.map((c) => (c.id === updated.id ? updated : c));
      if (settings.autoAssignTables !== false) {
        return autoAssignTableNumbers(list, settings.startTableNumber || 138);
      }
      return list;
    });
    showToast(`Fiche de ${updated.fullName} mise à jour (N° de table recalculé automatiquement).`);
  };

  // Delete candidate and re-index table numbers
  const handleDeleteCandidate = (candidateId: string) => {
    setCandidates((prev) => {
      const remaining = prev.filter((c) => c.id !== candidateId);
      if (selectedCandidateId === candidateId && remaining.length > 0) {
        setSelectedCandidateId(remaining[0].id);
      }
      if (settings.autoAssignTables !== false) {
        return autoAssignTableNumbers(remaining, settings.startTableNumber || 138);
      }
      return remaining;
    });
    showToast('Candidat retiré du registre et numéros de table réajustés.');
  };

  // Manual trigger to re-generate table numbers alphabetically A-Z
  const handleRenumberAlphabetically = (startNumber?: number) => {
    const base = startNumber ?? settings.startTableNumber ?? 138;
    setCandidates((prev) => autoAssignTableNumbers(prev, base));
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
      />

      {/* Main Content Area */}
      <div className="pl-80 w-full min-h-screen flex flex-col">
        {/* Top Header */}
        <TopHeader
          currentView={currentView}
          onViewChange={setCurrentView}
          isOfflineMode={isOfflineMode}
          onOpenSearch={() => setIsSearchModalOpen(true)}
        />

        {/* View Routing */}
        <main className="relative pt-16 bg-[#faf8ff] flex-1">
          {currentView === 'bulletin' && (
            <BulletinView
              candidates={candidates}
              selectedCandidate={selectedCandidate}
              onSelectCandidate={(c) => setSelectedCandidateId(c.id)}
              subjects={subjects}
              computedStats={computedStats}
              onOpenSignature={() => setIsSignatureModalOpen(true)}
              onOpenSms={() => setIsSmsModalOpen(true)}
              onDownloadPdf={handleDownloadPdf}
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
            />
          )}
        </main>
      </div>

      {/* Signature Modal */}
      {isSignatureModalOpen && (
        <SignatureModal
          candidate={selectedCandidate}
          onClose={() => setIsSignatureModalOpen(false)}
          onSign={handleSign}
        />
      )}

      {/* SMS & Mail Parents Modal */}
      {isSmsModalOpen && (
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
