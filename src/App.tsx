import React, { useState, useMemo, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { BulletinView } from './components/BulletinView';
import { DashboardView } from './components/DashboardView';
import { StudentsListView } from './components/StudentsListView';
import { GradingView } from './components/GradingView';
import { RecordsView } from './components/RecordsView';
import { SettingsView } from './components/SettingsView';
import { AdminParametres } from './components/AdminParametres';
import { AuthView } from './components/AuthView';
import { PlateformeView } from './components/PlateformeView';
import { AllBulletinsPrintModal } from './components/AllBulletinsPrintModal';
import { SignatureModal } from './components/SignatureModal';
import { SmsModal } from './components/SmsModal';
import { SearchModal } from './components/SearchModal';
import { INITIAL_SUBJECTS, computeCandidateStats, autoAssignTableNumbers } from './data/mockData';
import { apiDelete, apiSend, getSession, getToken, isForbidden, isPlatformAccount, refreshSession, roleLabel } from './api/client';
import { usePermissions } from './api/permissions';
import { showError } from './utils/alerts';
import { loadSchoolWorkspace, ExamOption } from './api/workspace';
import {
  getRegisteredSchools,
  getCurrentSchoolId,
  setCurrentSchoolId,
  getSchoolData,
  saveSchoolData,
} from './data/schoolsData';
import { Candidate, Subject, ViewMode, AppSettings, SchoolAccount, AdminSection } from './types';
import { printDocument } from './utils/printDocument';

export default function App() {
  // Establishment Multi-Tenant State
  const [schools, setSchools] = useState<SchoolAccount[]>(() => getRegisteredSchools());
  const [currentSchoolId, setCurrentSchoolIdState] = useState<string>(() => getCurrentSchoolId());

  const currentSchool = useMemo(() => {
    return schools.find((s) => s.id === currentSchoolId) || schools[0];
  }, [schools, currentSchoolId]);

  // Isolated data state for the currently logged-in establishment
  const [candidates, setCandidates] = useState<Candidate[]>(() => {
    if (getToken()) return [];
    const data = getSchoolData(getCurrentSchoolId());
    return data.candidates;
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const data = getSchoolData(getCurrentSchoolId());
    return data.settings;
  });

  // En mode API, aucune matière de démonstration : la liste vient de l'espace de travail chargé.
  const [subjects, setSubjects] = useState<Subject[]>(() => (getToken() ? [] : INITIAL_SUBJECTS));
  const [apiSessions, setApiSessions] = useState<ExamOption[]>([]);
  const [apiCenters, setApiCenters] = useState<string[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [activeClasseId, setActiveClasseId] = useState<number | null>(null);
  const [activeExamType, setActiveExamType] = useState<string>('');
  const [usingApi, setUsingApi] = useState<boolean>(() => Boolean(getToken()));
  const [apiUser, setApiUser] = useState<{ name: string; role: string } | null>(() => {
    const session = getSession();
    if (!getToken() || !session) return null;
    return { name: session.nomUtilisateur || session.email, role: roleLabel(session.role) };
  });
  const [adminTarget, setAdminTarget] = useState<{ section: AdminSection | null; nonce: number }>({ section: null, nonce: 0 });
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>(() => {
    if (getToken()) return '';
    const data = getSchoolData(getCurrentSchoolId());
    return data.candidates[0]?.id || '';
  });

  const [accountRole, setAccountRole] = useState(() => getSession()?.role ?? '');
  const { can, adminAccess } = usePermissions();
  const [currentView, setCurrentView] = useState<ViewMode>(() => {
    if (isPlatformAccount()) return 'plateforme';
    return getToken() ? 'bulletin' : 'auth';
  });
  const [selectedSession, setSelectedSession] = useState<string>(() => (getToken() ? '' : 'BAC II Blanc 2025 - Série D'));
  const [selectedCenter, setSelectedCenter] = useState<string>(() => {
    if (getToken()) return '';
    return `${currentSchool?.name || 'Lycée Moderne de Tokoin'} (Centre 01)`;
  });
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('academiablanc_offline') === '1';
    } catch {
      return false;
    }
  });
  const [juryLocked, setJuryLocked] = useState<boolean>(() => {
    try {
      return localStorage.getItem(`academiablanc_jury_lock_${getCurrentSchoolId()}`) === '1';
    } catch {
      return false;
    }
  });

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

  /** Un refus du serveur (403) s’affiche en fenêtre avec son message ; les autres erreurs en toast. */
  const signalerErreur = (err: unknown, fallback: string) => {
    if (isForbidden(err)) {
      void showError('Action non autorisée', err.message);
      return;
    }
    showToast(err instanceof Error && err.message ? err.message : fallback);
  };

  // Sync isolated data on changes
  const handleUpdateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    saveSchoolData(currentSchoolId, newSettings, candidates);
    setSchools(getRegisteredSchools());
  };

  const handleUpdateCandidates = (newCandidates: Candidate[]) => {
    setCandidates(newCandidates);
    if (!getToken()) saveSchoolData(currentSchoolId, settings, newCandidates);
  };

  const applyWorkspace = async (sessionId?: number) => {
    const workspace = await loadSchoolWorkspace(sessionId);
    const session = getSession();
    setUsingApi(true);
    setApiUser(session ? { name: session.nomUtilisateur || session.email, role: roleLabel(session.role) } : null);
    setSubjects(workspace.subjects);
    setCandidates(workspace.candidates);
    setApiSessions(workspace.sessions);
    setApiCenters(workspace.centers.map((item) => item.label));
    setActiveSessionId(workspace.sessionId);
    setActiveClasseId(workspace.classeId);
    setActiveExamType(workspace.examType);
    setSettings((prev) => ({
      ...prev,
      institutionName: session?.nomEtablissement || prev.institutionName,
      academicYear: workspace.academicYear || prev.academicYear,
      sessionName: workspace.sessionName || prev.sessionName,
      examType: workspace.examType || prev.examType,
    }));
    // Les libellés viennent exclusivement de l'API : vide tant qu'aucune session / aucun centre n'existe.
    setSelectedSession(workspace.sessionName);
    setSelectedCenter(workspace.centerLabel);
    setSelectedCandidateId((current) => workspace.candidates.some((item) => item.id === current)
      ? current
      : workspace.candidates[0]?.id || '');
  };

  const handleApiReady = () => {
    const session = getSession();
    const role = session?.role ?? '';
    setAccountRole(role);
    if (isPlatformAccount(session)) {
      setIsAuthModalOpen(false);
      setCurrentView('plateforme');
      if (!session?.etablissementId) return;
    }
    applyWorkspace().catch((err: Error) => showToast(err.message || 'Impossible de charger la base.'));
  };

  const reloadWorkspace = () => {
    if (!getToken()) return;
    applyWorkspace(activeSessionId ?? undefined).catch((err: Error) => showToast(err.message || 'Impossible de recharger la base.'));
  };

  const openAdmin = (section?: AdminSection) => {
    setAdminTarget((prev) => ({ section: section ?? null, nonce: prev.nonce + 1 }));
    setCurrentView('admin');
  };

  useEffect(() => {
    if (!getToken()) return;
    // Les droits peuvent avoir changé depuis la connexion : la session est relue sur l’API avant de charger la base.
    refreshSession()
      .then((session) => {
        if (session) setAccountRole(session.role);
        if (isPlatformAccount(session) && !session?.etablissementId) return undefined;
        return applyWorkspace();
      })
      .catch((err: Error) => showToast(err.message || 'Impossible de charger la base.'));
  }, []);

  // Switch active establishment
  const handleSelectSchool = (schoolId: string) => {
    const target = schools.find((s) => s.id === schoolId);
    if (!target) return;

    setCurrentSchoolIdState(schoolId);
    setCurrentSchoolId(schoolId);

    if (getToken()) {
      setIsAuthModalOpen(false);
      if (currentView === 'auth') setCurrentView('bulletin');
      applyWorkspace().catch((err: Error) => showToast(err.message || 'Impossible de charger la base.'));
      return;
    }

    const schoolData = getSchoolData(schoolId);
    setCandidates(schoolData.candidates);
    setSettings(schoolData.settings);
    setSelectedCandidateId(schoolData.candidates[0]?.id || '');
    setSelectedCenter(`${target.name} (Centre d'Examen)`);
    try {
      setJuryLocked(localStorage.getItem(`academiablanc_jury_lock_${schoolId}`) === '1');
    } catch {
      setJuryLocked(false);
    }

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
    if (getToken() && activeSessionId && Number.isFinite(Number(candidateId)) && Number.isFinite(Number(subjectId))) {
      void apiSend('/api/notes', 'POST', {
        eleveId: Number(candidateId),
        matiereId: Number(subjectId),
        sessionId: activeSessionId,
        valeur: newScore,
        absent: false,
      }).catch((err: unknown) => signalerErreur(err, 'Note non enregistrée.'));
    }
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
    if (getToken()) {
      if (!activeClasseId) {
        showToast('Créez d’abord une classe dans Administration (barre latérale).');
        openAdmin('classes');
        return;
      }
      void apiSend('/api/eleves', 'POST', {
        classeId: activeClasseId,
        sessionId: activeSessionId,
        nomComplet: newCand.fullName,
        matricule: newCand.matricule,
        genre: newCand.gender,
        numeroTable: newCand.tableNumber || null,
        dateNaissance: newCand.dob || null,
        lieuNaissance: newCand.birthPlace || null,
        etablissementOrigine: newCand.originSchool || null,
      }).then(() => applyWorkspace(activeSessionId ?? undefined))
        .then(() => showToast(`${newCand.fullName} est enregistré dans la base.`))
        .catch((err: unknown) => signalerErreur(err, 'Inscription impossible.'));
      return;
    }
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
    if (getToken() && Number.isFinite(Number(candidateId))) {
      void apiDelete(`/api/eleves/${candidateId}`)
        .then(() => applyWorkspace(activeSessionId ?? undefined))
        .then(() => showToast('Élève retiré de la base.'))
        .catch((err: unknown) => signalerErreur(err, 'Suppression impossible.'));
      return;
    }
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

  const handleDownloadPdf = () => {
    if (!selectedCandidate) return;
    printDocument(
      'single-bulletin',
      `Bulletin_${selectedCandidate.tableNumber}_${selectedCandidate.fullName}`,
    );
  };

  const handleToggleOffline = () => {
    const next = !isOfflineMode;
    setIsOfflineMode(next);
    try {
      localStorage.setItem('academiablanc_offline', next ? '1' : '0');
    } catch {
      // quota ignore
    }
    showToast(next ? 'Mode hors-ligne actif : les envois externes sont suspendus.' : 'Connexion rétablie.');
  };

  const handleToggleJuryLock = () => {
    const next = !juryLocked;
    setJuryLocked(next);
    try {
      localStorage.setItem(`academiablanc_jury_lock_${currentSchoolId}`, next ? '1' : '0');
    } catch {
      // quota ignore
    }
    showToast(next ? 'Procès-verbal verrouillé : la saisie des notes est bloquée.' : 'Procès-verbal déverrouillé : la saisie est de nouveau possible.');
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
        if (usingApi && !can('BULLETINS', 'IMPRIMER')) {
          void showError('Action non autorisée', 'Votre compte ne détient pas le droit IMPRIMER sur BULLETINS.');
          return;
        }
        if (isBatchPrintModalOpen) {
          printDocument('all-bulletins', `Bulletins_${settings.institutionName}`);
        } else if (currentView === 'bulletin' && selectedCandidate) {
          printDocument(
            'single-bulletin',
            `Bulletin_${selectedCandidate.tableNumber}_${selectedCandidate.fullName}`,
          );
        } else if (currentView === 'records') {
          printDocument('registre', `PV_${selectedSession}`);
        } else if (currentView === 'students') {
          printDocument('emargement', `Emargement_${selectedSession}`);
        } else {
          printDocument('page', document.title);
        }
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
  }, [candidates, selectedCandidateId, currentView, isBatchPrintModalOpen, selectedCandidate, settings.institutionName, selectedSession, usingApi, can]);

  // Impression des bulletins : libre hors API, soumise à BULLETINS:IMPRIMER une fois connecté.
  const peutImprimer = !usingApi || can('BULLETINS', 'IMPRIMER');

  // If in auth view mode full-screen
  if (currentView === 'auth') {
    return (
      <AuthView
        currentSchool={currentSchool}
        onSelectSchool={handleSelectSchool}
        onAccountCreated={handleAccountCreated}
        onApiReady={handleApiReady}
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
        onSessionChange={(label) => {
          setSelectedSession(label);
          const match = apiSessions.find((item) => item.label === label);
          if (match) {
            applyWorkspace(match.id).catch((err: Error) => showToast(err.message || 'Session introuvable.'));
          }
        }}
        selectedCenter={selectedCenter}
        onCenterChange={setSelectedCenter}
        isOfflineMode={isOfflineMode}
        onToggleOffline={handleToggleOffline}
        settings={settings}
        candidatesCount={candidates.length}
        onOpenBatchPrint={peutImprimer ? () => setIsBatchPrintModalOpen(true) : undefined}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenSearch={() => setIsSearchModalOpen(true)}
        sessionOptions={usingApi ? apiSessions.map((item) => item.label) : undefined}
        centerOptions={usingApi ? apiCenters : undefined}
        platformOwner={isPlatformAccount(getSession()) || accountRole === 'SUPER_ADMIN' || accountRole === 'GESTIONNAIRE_PLATEFORME'}
        usingApi={usingApi}
        apiUser={usingApi ? apiUser : null}
        onOpenAdmin={usingApi && adminAccess ? () => openAdmin() : undefined}
      />

      {/* Main Content Area - Navigated strictly via Sidebar */}
      <div className="app-chrome pl-80 w-full min-h-screen flex flex-col">
        {/* View Routing */}
        <main className="relative bg-[#faf8ff] flex-1">
          {currentView === 'bulletin' && !selectedCandidate && (
            <div className="p-10 text-[14px] text-[#444651] space-y-3">
              <p>
                {usingApi
                  ? 'Aucun élève dans la base de cet établissement. Créez une classe et un élève dans Administration, ou depuis la liste des élèves.'
                  : 'Connectez l’établissement pour afficher les élèves enregistrés.'}
              </p>
              {usingApi && (
                <button
                  type="button"
                  onClick={() => openAdmin('eleves')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#0051d5] text-white text-[13px] font-semibold hover:bg-[#003cb3] transition-colors"
                >
                  <span className="material-symbols-outlined text-base">admin_panel_settings</span>
                  <span>Ouvrir l’Administration (API)</span>
                </button>
              )}
            </div>
          )}

          {currentView === 'admin' && (
            <div className="p-8 max-w-5xl mx-auto space-y-6">
              <div className="bg-white rounded p-6 shadow-sm border border-[#eaedff] flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#0051d5] bg-[#eaedff] px-2.5 py-1 rounded">
                    Administration (API)
                  </span>
                  <h2 className="text-[22px] font-bold text-[#00236f] mt-1.5">
                    Données de l’établissement
                  </h2>
                  <p className="text-[13px] text-[#444651] mt-0.5">
                    Années scolaires, centres, sessions, matières et coefficients, enseignants, classes, affectations, élèves et notes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentView('dashboard')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#eaedff] text-[#00236f] text-[13px] font-semibold hover:bg-[#dce1ff] transition-colors"
                >
                  <span className="material-symbols-outlined text-base">analytics</span>
                  <span>Retour au tableau de bord</span>
                </button>
              </div>
              <AdminParametres
                section={adminTarget.section}
                scrollKey={adminTarget.nonce}
                onDataChanged={reloadWorkspace}
              />
            </div>
          )}

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
              onPrintAll={peutImprimer ? () => setIsBatchPrintModalOpen(true) : undefined}
              canPrint={peutImprimer}
              settings={settings}
              selectedSession={selectedSession}
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
              onOpenBatchPrint={peutImprimer ? () => setIsBatchPrintModalOpen(true) : undefined}
            />
          )}

          {currentView === 'plateforme' && <PlateformeView />}

          {currentView === 'dashboard' && (
            <DashboardView
              candidates={candidates}
              subjects={subjects}
              allStats={allStats}
              onSelectCandidate={(c) => setSelectedCandidateId(c.id)}
              onNavigate={setCurrentView}
              selectedSession={selectedSession}
              selectedCenter={selectedCenter}
              usingApi={usingApi}
              hasApiSession={apiSessions.length > 0}
              examType={activeExamType}
              onOpenAdmin={usingApi && adminAccess ? openAdmin : undefined}
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
              juryLocked={juryLocked}
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
              juryLocked={juryLocked}
              onToggleJuryLock={handleToggleJuryLock}
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
              onAdminDataChanged={reloadWorkspace}
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
          isOffline={isOfflineMode}
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
          selectedSession={selectedSession}
          onClose={() => setIsBatchPrintModalOpen(false)}
        />
      )}

      {/* Establishment Accounts / Login Modal */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-4xl flex justify-center">
            <AuthView
              embedded
              currentSchool={currentSchool}
              onSelectSchool={handleSelectSchool}
              onAccountCreated={handleAccountCreated}
              onApiReady={handleApiReady}
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
