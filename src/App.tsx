import React, { Suspense, lazy, useState, useMemo, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { BulletinView } from './components/BulletinView';
import { DashboardView } from './components/DashboardView';
import { StudentsListView } from './components/StudentsListView';
import { GradingView } from './components/GradingView';
import { RecordsView } from './components/RecordsView';
import { SettingsView } from './components/SettingsView';
import { AdminParametres } from './components/AdminParametres';
import { AuthPage } from './components/AuthPage';
import { EtablissementProfilView } from './components/EtablissementProfilView';
import { AdminLoginPage } from './components/AdminLoginPage';
import { PlateformeView } from './components/PlateformeView';
import { AllBulletinsPrintModal } from './components/AllBulletinsPrintModal';
import { SignatureModal } from './components/SignatureModal';
import { SmsModal } from './components/SmsModal';
import { SearchModal } from './components/SearchModal';
import { INITIAL_SUBJECTS, computeCandidateStats, autoAssignTableNumbers } from './data/mockData';
import { ApiError, apiDelete, apiSend, clearToken, getSession, getToken, isForbidden, isPlatformAccount, isPlatformOnlyAccount, refreshSession, roleLabel, setSession } from './api/client';
import type { AuthSession } from './api/client';
import { loadProfil } from './api/etablissement';
import type { ProfilEtablissement } from './api/etablissement';
import { saveEnTete } from './api/prereglages';
import { appliquerEnTeteAuxSettings, enTeteChanged, enTeteDepuisSettings } from './utils/prereglages';
import { usePermissions } from './api/permissions';
import { confirmAction, showError } from './utils/alerts';
import { loadSchoolWorkspace, ExamOption, WorkspaceOptions } from './api/workspace';
import { horsProgramme } from './utils/programme';
import { applyCharte, charteChanged, loadCharte, saveCharte } from './api/charte';
import {
  getRegisteredSchools,
  getCurrentSchoolId,
  setCurrentSchoolId,
  getSchoolData,
  saveSchoolData,
  getSchoolArchivedSessions,
} from './data/schoolsData';
import { Candidate, Subject, ViewMode, AppSettings, SchoolAccount, AdminSection } from './types';
import { printDocument } from './utils/printDocument';
import { usePublicRoute } from './utils/router';

// Site vitrine (GSAP, Three.js) chargé à la demande : l’application connectée n’embarque pas ces bibliothèques.
const LandingPage = lazy(() => import('./components/landing/LandingPage'));

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
  const [apiClasses, setApiClasses] = useState<ExamOption[]>([]);
  // Compteurs lus sur l'API : total d'élèves enregistrés et élèves écartés par le filtre de session.
  const [elevesEnBase, setElevesEnBase] = useState(0);
  const [elevesMasques, setElevesMasques] = useState(0);
  const [toutesSessions, setToutesSessions] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [activeClasseId, setActiveClasseId] = useState<number | null>(null);
  const [activeExamType, setActiveExamType] = useState<string>('');
  const [activeExamTypeLong, setActiveExamTypeLong] = useState<string>('');
  const [usingApi, setUsingApi] = useState<boolean>(() => Boolean(getToken()));
  // Jeton présent au chargement : rien n'est affiché (surtout pas de données de démonstration)
  // tant que la session n'est pas relue et l'espace de l'établissement chargé depuis l'API.
  const [workspaceLoading, setWorkspaceLoading] = useState<boolean>(() => Boolean(getToken()));
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
  // Session plateforme sans établissement : barre latérale réduite, aucune vue d'établissement accessible.
  const [sessionPlateformeSeule, setSessionPlateformeSeule] = useState<boolean>(() => Boolean(getToken()) && isPlatformOnlyAccount());
  // Hors application : `/` (vitrine), `/connexion`, `/inscription`.
  const [route, navigate] = usePublicRoute();
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
  const handleUpdateSettings = (newSettings: AppSettings, options?: { enTeteDejaEnregistre?: boolean }) => {
    setSettings(newSettings);
    saveSchoolData(currentSchoolId, newSettings, candidates);
    setSchools(getRegisteredSchools());
    // Cachet et signatures suivent l'établissement sur l'API pour être retrouvés depuis un autre poste.
    if (getToken() && charteChanged(settings, newSettings)) {
      void saveCharte(newSettings).catch((err: unknown) =>
        signalerErreur(err, 'Cachet / signatures non enregistrés sur le serveur.'));
    }
    // L'en-tête officiel (république, devise, ministère) est porté par l'établissement sur l'API ;
    // l'application d'un préréglage l'a déjà enregistré côté serveur.
    if (getToken() && !options?.enTeteDejaEnregistre && enTeteChanged(settings, newSettings)) {
      void saveEnTete(enTeteDepuisSettings(newSettings)).catch((err: unknown) =>
        signalerErreur(err, 'En-tête officiel non enregistré sur le serveur.'));
    }
  };

  const handleUpdateCandidates = (newCandidates: Candidate[]) => {
    setCandidates(newCandidates);
    if (!getToken()) saveSchoolData(currentSchoolId, settings, newCandidates);
  };

  const applyWorkspace = async (sessionId?: number, options: WorkspaceOptions = { toutesSessions }) => {
    const [workspace, charte, profil] = await Promise.all([
      loadSchoolWorkspace(sessionId, options),
      // Une charte ou une fiche indisponible (ancienne API) ne doit pas bloquer le chargement de l'espace.
      loadCharte().catch(() => null),
      loadProfil().catch(() => null),
    ]);
    const session = getSession();
    setUsingApi(true);
    setSessionPlateformeSeule(false);
    setApiUser(session ? { name: session.nomUtilisateur || session.email, role: roleLabel(session.role) } : null);
    setSubjects(workspace.subjects);
    setCandidates(workspace.candidates);
    setApiSessions(workspace.sessions);
    setApiCenters(workspace.centers.map((item) => item.label));
    setApiClasses(workspace.classes);
    setElevesEnBase(workspace.elevesEnBase);
    setElevesMasques(workspace.elevesMasques);
    setActiveSessionId(workspace.sessionId);
    setActiveClasseId(workspace.classeId);
    setActiveExamType(workspace.examType);
    setActiveExamTypeLong(workspace.examTypeLong);
    setSettings((prev) => {
      const next: AppSettings = {
        ...prev,
        institutionName: session?.nomEtablissement || prev.institutionName,
        academicYear: workspace.academicYear || prev.academicYear,
        sessionName: workspace.sessionName || prev.sessionName,
        // Libellé long du référentiel de la plateforme ; vide tant qu'aucune session n'existe (jamais la valeur de démo).
        examType: workspace.examTypeLong,
      };
      // République, devise et ministère viennent de l'établissement (préréglage national appliqué, puis ajusté).
      const avecEnTete = appliquerEnTeteAuxSettings(next, profil?.enTete);
      return charte ? applyCharte(avecEnTete, charte) : avecEnTete;
    });
    // Les libellés viennent exclusivement de l'API : vide tant qu'aucune session / aucun centre n'existe.
    setSelectedSession(workspace.sessionName);
    setSelectedCenter(workspace.centerLabel);
    setSelectedCandidateId((current) => workspace.candidates.some((item) => item.id === current)
      ? current
      : workspace.candidates[0]?.id || '');
  };

  /**
   * Compte de niveau plateforme sans établissement (propriétaire créé au démarrage, gestionnaire) :
   * aucun espace de travail à charger, mais la session API doit être marquée active pour que la barre
   * latérale affiche le compte et la déconnexion au lieu des données de démonstration. L'espace de
   * démonstration chargé avant la connexion (candidats, matières, session et centre fictifs) est vidé :
   * aucun compteur ni libellé fictif ne doit apparaître pour un vrai compte.
   */
  const appliquerSessionPlateforme = (session: AuthSession | null) => {
    setUsingApi(true);
    setSessionPlateformeSeule(true);
    setApiUser(session ? { name: session.nomUtilisateur || session.email, role: roleLabel(session.role) } : null);
    setCandidates([]);
    setSubjects([]);
    setApiSessions([]);
    setApiCenters([]);
    setApiClasses([]);
    setElevesEnBase(0);
    setElevesMasques(0);
    setActiveSessionId(null);
    setActiveClasseId(null);
    setActiveExamType('');
    setSelectedCandidateId('');
    setSelectedSession('');
    setSelectedCenter('');
    setSettings((prev) => ({ ...prev, institutionName: session?.nomEtablissement || 'Plateforme AcademiaBlanc' }));
    setIsSignatureModalOpen(false);
    setIsSmsModalOpen(false);
    setIsSearchModalOpen(false);
    setIsBatchPrintModalOpen(false);
    setCurrentView('plateforme');
  };

  const handleApiReady = () => {
    const session = getSession();
    const role = session?.role ?? '';
    setAccountRole(role);
    if (isPlatformAccount(session)) {
      if (!session?.etablissementId) {
        appliquerSessionPlateforme(session);
        return;
      }
      setCurrentView('plateforme');
    }
    setWorkspaceLoading(true);
    applyWorkspace()
      .catch((err: Error) => showToast(err.message || 'Impossible de charger la base.'))
      .finally(() => setWorkspaceLoading(false));
  };

  const reloadWorkspace = () => {
    if (!getToken()) return;
    applyWorkspace(activeSessionId ?? undefined).catch((err: Error) => showToast(err.message || 'Impossible de recharger la base.'));
  };

  /** « Toutes les sessions » : relit la liste sans écarter les élèves rattachés à une autre session. */
  const handleToutesSessionsChange = (toutes: boolean) => {
    setToutesSessions(toutes);
    applyWorkspace(activeSessionId ?? undefined, { toutesSessions: toutes })
      .catch((err: Error) => showToast(err.message || 'Impossible de recharger la base.'));
  };

  const openAdmin = (section?: AdminSection) => {
    setAdminTarget((prev) => ({ section: section ?? null, nonce: prev.nonce + 1 }));
    setCurrentView('admin');
  };

  // « Consulter » une archive : charge la session réelle correspondante et ouvre son procès-verbal.
  const openArchivedSession = (sessionId: number) => {
    if (!getToken()) return;
    const match = apiSessions.find((item) => item.id === sessionId);
    if (match) setSelectedSession(match.label);
    applyWorkspace(sessionId)
      .then(() => {
        setCurrentView('records');
        showToast(`Session ${match?.label ?? sessionId} chargée : procès-verbal et bulletins de cette session.`);
      })
      .catch((err: Error) => showToast(err.message || 'Session introuvable.'));
  };

  // Déconnexion : efface le JWT et vide tout l'espace de travail pour qu'aucune donnée
  // de l'établissement précédent ne reste affichée, puis revient à l'écran de connexion.
  const handleLogout = async () => {
    const confirmed = await confirmAction({ title: 'Se déconnecter ?', confirmText: 'Se déconnecter' });
    if (!confirmed) return;
    // Un compte de la plateforme revient sur son entrée dédiée `/admin`, un établissement sur la vitrine.
    const comptePlateforme = isPlatformAccount(getSession());
    clearToken();
    setUsingApi(false);
    setSessionPlateformeSeule(false);
    setApiUser(null);
    setAccountRole('');
    setCandidates([]);
    setSubjects([]);
    setApiSessions([]);
    setApiCenters([]);
    setApiClasses([]);
    setElevesEnBase(0);
    setElevesMasques(0);
    setToutesSessions(false);
    setActiveSessionId(null);
    setActiveClasseId(null);
    setActiveExamType('');
    setSelectedCandidateId('');
    setSelectedSession('');
    setSelectedCenter('');
    setSettings(getSchoolData(currentSchoolId).settings);
    setAdminTarget({ section: null, nonce: 0 });
    setIsSignatureModalOpen(false);
    setIsSmsModalOpen(false);
    setIsSearchModalOpen(false);
    setIsBatchPrintModalOpen(false);
    setCurrentView('auth');
    navigate(comptePlateforme ? 'admin' : 'vitrine');
  };

  useEffect(() => {
    if (!getToken()) return;
    // Les droits peuvent avoir changé depuis la connexion : la session est relue sur l’API avant de charger la base.
    refreshSession()
      .then((session) => {
        if (session) setAccountRole(session.role);
        if (isPlatformAccount(session) && !session?.etablissementId) {
          appliquerSessionPlateforme(session);
          return undefined;
        }
        return applyWorkspace();
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) {
          // Jeton expiré ou révoqué : retour explicite à la connexion plutôt qu'un espace vide ou de démonstration.
          clearToken();
          setUsingApi(false);
          setApiUser(null);
          setCurrentView('auth');
          navigate('connexion', { replace: true });
        }
        showToast(err instanceof Error && err.message ? err.message : 'Impossible de charger la base.');
      })
      .finally(() => setWorkspaceLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Une fois dans l’application, `/connexion`, `/inscription` et `/admin` n’ont plus de sens : l’URL revient
  // sur `/` (une session plateforme déjà active ouvre donc directement la vue Plateforme depuis `/admin`).
  useEffect(() => {
    if (currentView !== 'auth' && route !== 'vitrine') navigate('vitrine', { replace: true });
  }, [currentView, route, navigate]);

  // Un compte plateforme sans établissement n'a aucune vue d'établissement : tout écart revient sur la vue Plateforme.
  useEffect(() => {
    if (sessionPlateformeSeule && currentView !== 'plateforme' && currentView !== 'auth') setCurrentView('plateforme');
  }, [sessionPlateformeSeule, currentView]);

  // Switch active establishment
  const handleSelectSchool = (schoolId: string) => {
    const target = schools.find((s) => s.id === schoolId);
    if (!target) return;

    setCurrentSchoolIdState(schoolId);
    setCurrentSchoolId(schoolId);

    if (getToken()) {
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
    const cible = candidates.find((c) => c.id === candidateId);
    if (horsProgramme(cible, subjectId, subjects)) {
      showToast('Cette matière n’est pas au programme de la classe de cet élève.');
      return;
    }
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
      // Le matricule n'est pas envoyé : il est attribué par le serveur.
      void apiSend<{ matricule: string }>('/api/eleves', 'POST', {
        classeId: activeClasseId,
        sessionId: activeSessionId,
        nomComplet: newCand.fullName,
        genre: newCand.gender,
        numeroTable: newCand.tableNumber || null,
        dateNaissance: newCand.dob || null,
        lieuNaissance: newCand.birthPlace || null,
        etablissementOrigine: newCand.originSchool || null,
      }).then((cree) => applyWorkspace(activeSessionId ?? undefined)
        .then(() => showToast(`${newCand.fullName} est enregistré dans la base — matricule ${cree.matricule}.`)))
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

  // Batch add candidates with automatic alphabetical table assignment (mode démonstration uniquement)
  const handleBatchAddCandidates = (newCands: Candidate[]) => {
    if (getToken()) {
      // En session API, l'import passe par `POST /api/eleves/import` (ImportElevesPanel) : rien n'est ajouté localement,
      // sinon la liste semblerait enregistrée puis disparaîtrait au rechargement.
      void showError('Import non enregistré', 'Utilisez « Import en Masse » : la liste est alors enregistrée dans la base de l’établissement.');
      return;
    }
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
      // Aucun élève ni bulletin pour une session plateforme : recherche et impression groupée sans objet.
      if (sessionPlateformeSeule) return;

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
  }, [candidates, selectedCandidateId, currentView, isBatchPrintModalOpen, selectedCandidate, settings.institutionName, selectedSession, usingApi, can, sessionPlateformeSeule]);

  // Impression des bulletins : libre hors API, soumise à BULLETINS:IMPRIMER une fois connecté.
  const peutImprimer = !usingApi || can('BULLETINS', 'IMPRIMER');

  // Hors connexion : la page de connexion remplace l'ancienne modale du portail d'authentification.
  const ouvrirConnexion = () => {
    setCurrentView('auth');
    navigate('connexion');
  };

  // Fiche enregistrée depuis le profil : le nom suit dans la barre latérale, les bulletins et la session.
  const handleProfilChanged = (profil: ProfilEtablissement) => {
    setSettings((prev) => ({ ...prev, institutionName: profil.nom }));
    const session = getSession();
    if (session) setSession({ ...session, nomEtablissement: profil.nom });
  };

  // Jeton présent : état de chargement jusqu'à la réponse de l'API, sans aucune donnée de démonstration à l'écran.
  if (workspaceLoading && currentView !== 'auth') {
    return (
      <div className="min-h-screen bg-[#faf8ff] flex items-center justify-center p-6" aria-busy="true" role="status">
        <div className="bg-white border border-[#eaedff] rounded-lg shadow-sm px-8 py-6 flex items-center gap-4 max-w-md w-full">
          <span className="material-symbols-outlined text-3xl text-[#0051d5] animate-spin">progress_activity</span>
          <div>
            <p className="text-[14px] font-bold text-[#00236f]">Chargement de l’espace de l’établissement…</p>
            <p className="text-[12px] text-[#444651] mt-0.5">Lecture des élèves, classes et sessions enregistrés sur le serveur.</p>
          </div>
        </div>
      </div>
    );
  }

  // Hors application : site vitrine, puis pages pleine écran de connexion / création de compte.
  if (currentView === 'auth') {
    if (route === 'vitrine') {
      return (
        <Suspense fallback={<div className="min-h-screen bg-[#faf8ff]" aria-busy="true" />}>
          <LandingPage onConnexion={() => navigate('connexion')} onInscription={() => navigate('inscription')} />
        </Suspense>
      );
    }
    if (route === 'admin') {
      return (
        <AdminLoginPage
          onBack={() => navigate('vitrine')}
          // Session déjà enregistrée par la page : `handleApiReady` ouvre la vue Plateforme, l’URL revient sur `/`.
          onConnecte={() => {
            handleApiReady();
            navigate('vitrine', { replace: true });
          }}
        />
      );
    }
    return (
      <AuthPage
        mode={route === 'connexion' ? 'login' : 'register'}
        onModeChange={(mode) => navigate(mode === 'login' ? 'connexion' : 'inscription', { replace: true })}
        onBack={() => navigate('vitrine')}
        onSelectSchool={handleSelectSchool}
        onAccountCreated={handleAccountCreated}
        onApiReady={handleApiReady}
        // Après connexion sans compte local correspondant : entrée dans l’application.
        onClose={() => {
          if (getToken()) setCurrentView('bulletin');
          else navigate('vitrine');
        }}
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
        onOpenBatchPrint={peutImprimer && !sessionPlateformeSeule ? () => setIsBatchPrintModalOpen(true) : undefined}
        onOpenProfil={sessionPlateformeSeule ? undefined : () => setCurrentView('profil')}
        onConnexion={usingApi ? undefined : ouvrirConnexion}
        onOpenSearch={sessionPlateformeSeule ? undefined : () => setIsSearchModalOpen(true)}
        sessionOptions={usingApi ? apiSessions.map((item) => item.label) : undefined}
        examType={usingApi ? activeExamType : undefined}
        centerOptions={usingApi ? apiCenters : undefined}
        platformOwner={isPlatformAccount(getSession()) || accountRole === 'SUPER_ADMIN' || accountRole === 'GESTIONNAIRE_PLATEFORME'}
        platformOnly={sessionPlateformeSeule}
        usingApi={usingApi}
        apiUser={usingApi ? apiUser : null}
        onOpenAdmin={usingApi && adminAccess && !sessionPlateformeSeule ? () => openAdmin() : undefined}
        onLogout={usingApi ? handleLogout : undefined}
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
                activeSessionId={activeSessionId}
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
              examTypeLong={usingApi ? activeExamTypeLong : undefined}
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
              importApi={usingApi ? {
                classes: apiClasses,
                sessions: apiSessions,
                sessionId: activeSessionId,
                onImported: () => applyWorkspace(activeSessionId ?? undefined)
                  .catch((err: Error) => showToast(err.message || 'Impossible de recharger la base.')),
              } : undefined}
              rosterApi={usingApi ? {
                total: elevesEnBase,
                masques: elevesMasques,
                toutesSessions,
                onToutesSessionsChange: handleToutesSessionsChange,
              } : undefined}
            />
          )}

          {currentView === 'plateforme' && <PlateformeView />}

          {currentView === 'profil' && !sessionPlateformeSeule && (
            <EtablissementProfilView
              usingApi={usingApi}
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              demoSchool={usingApi ? null : currentSchool}
              demoStats={usingApi ? undefined : {
                eleves: candidates.length,
                archives: getSchoolArchivedSessions(currentSchoolId).length,
              }}
              onProfilChanged={handleProfilChanged}
              onLogout={usingApi ? handleLogout : undefined}
              onConnexion={usingApi ? undefined : ouvrirConnexion}
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
              examType={usingApi ? activeExamType : undefined}
              juryLocked={juryLocked}
              onToggleJuryLock={handleToggleJuryLock}
            />
          )}

          {currentView === 'settings' && (
            <SettingsView
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              onNavigate={setCurrentView}
              onOpenProfil={sessionPlateformeSeule ? undefined : () => setCurrentView('profil')}
              candidates={candidates}
              allStats={allStats}
              onAdminDataChanged={reloadWorkspace}
              usingApi={usingApi}
              activeSessionId={activeSessionId}
              onOpenSession={openArchivedSession}
              onOpenAdmin={usingApi ? openAdmin : undefined}
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
          examTypeLong={usingApi ? activeExamTypeLong : undefined}
          onClose={() => setIsBatchPrintModalOpen(false)}
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
