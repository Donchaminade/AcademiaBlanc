import React, { Suspense, lazy, useState, useMemo, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { MobileHeader } from './components/MobileHeader';
import { MobileDrawer } from './components/MobileDrawer';
import { BottomNav } from './components/BottomNav';
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
import { DEFAULT_SETTINGS, INITIAL_SUBJECTS, TOGO_SETTINGS, computeCandidateStats, autoAssignTableNumbers } from './data/mockData';
import { ApiError, clearToken, getSession, getToken, isForbidden, isPlatformAccount, isPlatformOnlyAccount, refreshSession, roleLabel, setSession } from './api/client';
import {
  appliquerDeliberation,
  creerEleve,
  renumeroterEleves,
  sauvegarderAppreciation,
  sauvegarderDeliberation,
  sauvegarderEleve,
  sauvegarderEnTete,
  sauvegarderNote,
  sauvegarderParametres,
  supprimerEleve,
} from './api/ecritures';
import type { AuthSession } from './api/client';
import { loadProfil } from './api/etablissement';
import type { ProfilEtablissement } from './api/etablissement';
import { appliquerEnTeteAuxSettings, enTeteChanged, enTeteDepuisSettings } from './utils/prereglages';
import { usePermissions } from './api/permissions';
import { confirmAction, showError, toastSuccess } from './utils/alerts';
import { loadSchoolWorkspace, ExamOption, WorkspaceOptions } from './api/workspace';
import { horsProgramme } from './utils/programme';
import { APPRECIATION_LONGUEUR_MAX, appreciationManuelleValide, normaliserAppreciationManuelle } from './utils/appreciation';
import { applyCharte, charteChanged, loadCharte, parametresSansDemonstration } from './api/charte';
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
import { MODE_SESSION_DEFAUT, estSessionInter } from './utils/sessionMode';
import type { ModeSession } from './utils/sessionMode';
import { TIROIR_FERME, fermerTiroir, ouvrirTiroir, tiroirApresChangementDeVue } from './utils/mobileNav';
import type { EtatTiroir } from './utils/mobileNav';

// Site vitrine (GSAP, Three.js) chargé à la demande : l’application connectée n’embarque pas ces bibliothèques.
const LandingPage = lazy(() => import('./components/landing/LandingPage'));

/** Session inter-établissements : uniquement en session API (les données de démonstration restent internes). */
const usingApiInter = (mode: ModeSession): boolean => Boolean(getToken()) && estSessionInter(mode);

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
    // Jeton présent : aucune image de démonstration en attendant la charte de l'établissement.
    return getToken() ? parametresSansDemonstration(data.settings) : data.settings;
  });
  // Dernière modification du logo, du cachet ou des signatures sur le serveur (affichée dans Paramètres et Profil).
  const [charteModifieeLe, setCharteModifieeLe] = useState<string | null>(null);

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
  // Mode de la session active (interne / inter-établissements) et nom du centre d'examen en inter.
  const [activeSessionMode, setActiveSessionMode] = useState<ModeSession>(MODE_SESSION_DEFAUT);
  const [activeCentreExamen, setActiveCentreExamen] = useState<string>('');
  const sessionInter = usingApiInter(activeSessionMode);
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

  // Tiroir de navigation des écrans étroits (menu burger / « Plus ») ; se referme à tout changement de vue.
  const [tiroir, setTiroir] = useState<EtatTiroir>(TIROIR_FERME);
  const ouvrirMenuMobile = useCallback(() => setTiroir(ouvrirTiroir(currentView)), [currentView]);
  const fermerMenuMobile = useCallback(() => setTiroir(fermerTiroir()), []);
  useEffect(() => {
    setTiroir((etat) => tiroirApresChangementDeVue(etat, currentView));
  }, [currentView]);

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

  /**
   * Écriture : paramètres du bulletin. En session API, deux ressources du serveur sont concernées :
   * la charte (`PUT /api/etablissement/charte` : logo, sceau, signataires, numérotation, cachet et signatures)
   * et l'en-tête officiel (`PUT /api/etablissement/en-tete` : république, devise, ministère, sigle…) ;
   * l'état local n'est mis à jour qu'à partir des réponses. En démonstration, dans le navigateur.
   * `enTeteDejaEnregistre` : l'application d'un préréglage national a déjà copié l'en-tête côté serveur.
   * Résout `false` si le serveur a refusé : l'appelant n'affiche alors aucune confirmation.
   */
  const handleUpdateSettings = async (
    newSettings: AppSettings,
    options?: { enTeteDejaEnregistre?: boolean },
  ): Promise<boolean> => {
    if (usingApi) {
      const charteModifiee = charteChanged(settings, newSettings);
      const enTeteModifie = !options?.enTeteDejaEnregistre && enTeteChanged(settings, newSettings);
      const enTetePreregle = Boolean(options?.enTeteDejaEnregistre);
      if (!charteModifiee && !enTeteModifie && !enTetePreregle) return true;
      try {
        const charte = charteModifiee ? await sauvegarderParametres(newSettings) : null;
        const profil = enTeteModifie ? await sauvegarderEnTete(newSettings) : null;
        if (charte) setCharteModifieeLe(charte.modifieLe ?? null);
        setSettings((prev) => {
          let next = charte ? applyCharte(prev, charte) : prev;
          // Préréglage déjà appliqué par l'API : la fiche renvoyée a été reportée dans `newSettings`.
          if (profil || enTetePreregle) {
            next = appliquerEnTeteAuxSettings(next, profil ? profil.enTete : enTeteDepuisSettings(newSettings));
          }
          return next;
        });
        return true;
      } catch (err) {
        signalerErreur(err, 'Paramètres non enregistrés sur le serveur.');
        return false;
      }
    }
    setSettings(newSettings);
    saveSchoolData(currentSchoolId, newSettings, candidates);
    setSchools(getRegisteredSchools());
    return true;
  };

  /** Démonstration uniquement : la liste locale est mémorisée dans le navigateur. */
  const handleUpdateCandidates = (newCandidates: Candidate[]) => {
    setCandidates(newCandidates);
    if (!usingApi) saveSchoolData(currentSchoolId, settings, newCandidates);
  };

  /** Remplace un candidat par sa version relue sur le serveur, sans toucher aux autres. */
  const remplacerCandidat = (next: Candidate) => {
    setCandidates((prev) => prev.map((c) => (c.id === next.id ? next : c)));
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
    setActiveSessionMode(workspace.sessionMode);
    setActiveCentreExamen(workspace.centreExamen);
    if (charte) setCharteModifieeLe(charte.modifieLe ?? null);
    setSettings((prev) => {
      // En session API, les paramètres viennent du serveur (charte) ou des valeurs par défaut du logiciel :
      // rien n'est repris des réglages de démonstration mémorisés dans le navigateur, et aucune image de
      // démonstration (logo, sceau du logiciel) n'est affichée pour un vrai compte : sans logo, ses initiales.
      const base: AppSettings = parametresSansDemonstration(charte ? DEFAULT_SETTINGS : prev);
      const next: AppSettings = {
        ...base,
        institutionName: session?.nomEtablissement || prev.institutionName,
        // Devise propre de la fiche (pied de page) : jamais la valeur de démonstration en session connectée.
        institutionMotto: profil?.devise ?? '',
        academicYear: workspace.academicYear || prev.academicYear,
        sessionName: workspace.sessionName || prev.sessionName,
        // Libellé long du référentiel de la plateforme ; vide tant qu'aucune session n'existe (jamais la valeur de démo).
        examType: workspace.examTypeLong,
      };
      // République, devise et ministère viennent de l'établissement (préréglage national appliqué, puis ajusté).
      const avecEnTete = appliquerEnTeteAuxSettings(next, profil?.enTete);
      const avecCharte = charte ? applyCharte(avecEnTete, charte) : avecEnTete;
      // Le signataire officiel est le responsable de la fiche de l'établissement (page Profil), jamais la valeur
      // de démonstration ; le titulaire n'est pas un paramètre : il vient de la classe de chaque élève.
      return { ...avecCharte, jurySignerName: profil ? profil.nomResponsable : '' };
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
    setActiveSessionMode(MODE_SESSION_DEFAUT);
    setActiveCentreExamen('');
    setSelectedCandidateId('');
    setSelectedSession('');
    setSelectedCenter('');
    setSettings((prev) => ({ ...parametresSansDemonstration(prev), institutionName: session?.nomEtablissement || 'Plateforme AcademiaBlanc' }));
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
    setActiveSessionMode(MODE_SESSION_DEFAUT);
    setActiveCentreExamen('');
    setSelectedCandidateId('');
    setSelectedSession('');
    setSelectedCenter('');
    setSettings(getSchoolData(currentSchoolId).settings);
    setCharteModifieeLe(null);
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
      map[cand.id] = computeCandidateStats(cand, subjects, candidates, { inter: sessionInter });
    });
    return map;
  }, [candidates, subjects, sessionInter]);

  const selectedCandidate = useMemo(() => {
    return candidates.find((c) => c.id === selectedCandidateId) || candidates[0];
  }, [candidates, selectedCandidateId]);

  const computedStats = useMemo(() => {
    if (!selectedCandidate) {
      return {
        totalCoef: 0,
        totalPoints: 0,
        totalCoefProgramme: 0,
        pointsMax: 0,
        average: 0,
        evaluated: false,
        rank: 1,
        totalCandidates: 0,
        mention: null,
        decision: null,
        differenceToPromo: 0,
        classAverage: null,
        classHighestAverage: null,
        classLowestAverage: null,
        classEvaluatedCount: 0,
      };
    }
    return allStats[selectedCandidate.id] || computeCandidateStats(selectedCandidate, subjects, candidates, { inter: sessionInter });
  }, [allStats, selectedCandidate, subjects, candidates, sessionInter]);

  // L'appréciation reste celle de l'enseignant si elle existe ; vide = automatique selon la note.
  const avecNote = (candidate: Candidate, subjectId: string, score: number, appreciation?: string): Candidate => ({
    ...candidate,
    grades: {
      ...candidate.grades,
      [subjectId]: { score, appreciation: appreciation ?? candidate.grades[subjectId]?.appreciation ?? '' },
    },
  });

  const avecAppreciation = (candidate: Candidate, subjectId: string, appreciation: string): Candidate => {
    const grade = candidate.grades[subjectId];
    if (!grade) return candidate;
    return { ...candidate, grades: { ...candidate.grades, [subjectId]: { ...grade, appreciation } } };
  };

  /**
   * Écriture : note d'un candidat dans une matière. En session API la note part au serveur
   * (`POST /api/notes`) et la grille n'est mise à jour qu'avec la valeur renvoyée ; résout `false`
   * en cas de refus (la cellule reste marquée « non enregistrée »).
   */
  const handleUpdateGrade = async (candidateId: string, subjectId: string, newScore: number): Promise<boolean> => {
    const cible = candidates.find((c) => c.id === candidateId);
    if (!cible) return false;
    if (horsProgramme(cible, subjectId, subjects)) {
      showToast('Cette matière n’est pas au programme de la classe de cet élève.');
      return false;
    }
    if (usingApi) {
      try {
        const note = await sauvegarderNote({ candidateId, subjectId, sessionId: activeSessionId, score: newScore });
        remplacerCandidat(avecNote(cible, subjectId, Number(note.valeur ?? newScore), note.appreciation ?? ''));
        return true;
      } catch (err) {
        signalerErreur(err, 'Note non enregistrée.');
        return false;
      }
    }
    handleUpdateCandidates(candidates.map((c) => (c.id === candidateId ? avecNote(c, subjectId, newScore) : c)));
    return true;
  };

  /**
   * Écriture : appréciation du professeur pour une matière (texte libre ≤ 60 caractères ; vide =
   * retour à l'appréciation automatique selon la note). En session API, `POST /api/notes` reprend la
   * note existante avec le champ `appreciation` et la grille n'est mise à jour qu'avec la réponse.
   */
  const handleUpdateAppreciation = async (candidateId: string, subjectId: string, appreciation: string): Promise<boolean> => {
    const cible = candidates.find((c) => c.id === candidateId);
    const grade = cible?.grades[subjectId];
    if (!cible || !grade) {
      showToast('Saisissez d’abord une note avant son appréciation.');
      return false;
    }
    if (usingApi) {
      try {
        const note = await sauvegarderAppreciation({ candidateId, subjectId, sessionId: activeSessionId, score: grade.score, appreciation });
        remplacerCandidat(avecAppreciation(cible, subjectId, note.appreciation ?? ''));
        return true;
      } catch (err) {
        signalerErreur(err, 'Appréciation non enregistrée.');
        return false;
      }
    }
    const texte = normaliserAppreciationManuelle(appreciation);
    if (!appreciationManuelleValide(texte)) {
      showToast(`L’appréciation ne doit pas dépasser ${APPRECIATION_LONGUEUR_MAX} caractères.`);
      return false;
    }
    handleUpdateCandidates(candidates.map((c) => (c.id === candidateId ? avecAppreciation(c, subjectId, texte) : c)));
    return true;
  };

  /** Écriture : signature électronique du bulletin du candidat sélectionné (enregistrée avec l'observation du conseil dans la délibération). */
  const handleSign = async (signedAt: string, signer: string, shaHash: string): Promise<void> => {
    if (!selectedCandidate) return;
    const signe: Candidate = { ...selectedCandidate, digitalSignature: { signedAt, signer, shaHash } };
    if (usingApi) {
      try {
        const vue = await sauvegarderDeliberation(signe, activeSessionId);
        remplacerCandidat(appliquerDeliberation(selectedCandidate, vue));
        toastSuccess(`Signature de ${signer} enregistrée sur le serveur.`);
      } catch (err) {
        signalerErreur(err, 'Signature non enregistrée.');
      }
      return;
    }
    handleUpdateCandidates(candidates.map((c) => (c.id === selectedCandidate.id ? signe : c)));
    showToast(`Signature électronique X.509 de ${signer} apposée et scellée avec succès.`);
  };

  // Écriture : inscription d'un candidat. En session API, `POST /api/eleves` puis relecture de la liste.
  const handleAddNewCandidate = (newCand: Candidate) => {
    if (usingApi) {
      if (!activeClasseId) {
        showToast('Créez d’abord une classe dans Administration (barre latérale).');
        openAdmin('classes');
        return;
      }
      // Le matricule n'est pas envoyé : il est attribué par le serveur.
      void creerEleve(newCand, activeClasseId, activeSessionId)
        .then((cree) => applyWorkspace(activeSessionId ?? undefined)
          .then(() => toastSuccess(`${newCand.fullName} est enregistré dans la base — matricule ${cree.matricule}.`)))
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

  // Écriture : ajout groupé (démonstration uniquement ; en session API l'import passe par ImportElevesPanel).
  const handleBatchAddCandidates = (newCands: Candidate[]) => {
    if (usingApi) {
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

  /**
   * Écriture : fiche d'un élève (crayon de la liste). En session API, `PUT /api/eleves/{id}` puis relecture
   * de la liste depuis le serveur ; résout `false` si le serveur a refusé (la fenêtre reste ouverte).
   * En démonstration, les numéros de table sont recalculés localement.
   */
  const handleUpdateCandidate = async (updated: Candidate): Promise<boolean> => {
    if (usingApi) {
      try {
        await sauvegarderEleve(updated);
        await applyWorkspace(activeSessionId ?? undefined);
        toastSuccess(`Fiche de ${updated.fullName} enregistrée sur le serveur.`);
        return true;
      } catch (err) {
        signalerErreur(err, 'Fiche non enregistrée.');
        return false;
      }
    }
    const list = candidates.map((c) => (c.id === updated.id ? updated : c));
    const finalList = settings.autoAssignTables !== false
      ? autoAssignTableNumbers(list, settings.startTableNumber || 101)
      : list;

    handleUpdateCandidates(finalList);
    showToast(`Fiche de ${updated.fullName} mise à jour (N° de table recalculé automatiquement).`);
    return true;
  };

  // Écriture : retrait d'un candidat. En session API, `DELETE /api/eleves/{id}` puis relecture de la liste.
  const handleDeleteCandidate = (candidateId: string) => {
    if (usingApi) {
      void supprimerEleve(candidateId)
        .then(() => applyWorkspace(activeSessionId ?? undefined))
        .then(() => toastSuccess('Élève retiré de la base.'))
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

  /**
   * Écriture : renumérotation alphabétique des tables. En session API, chaque élève dont le numéro
   * change est enregistré (`PUT /api/eleves/{id}`) puis la liste est relue depuis le serveur.
   */
  const handleRenumberAlphabetically = async (startNumber?: number): Promise<void> => {
    const base = startNumber ?? settings.startTableNumber ?? 101;
    const renumbered = autoAssignTableNumbers(candidates, base);
    if (usingApi) {
      try {
        const modifies = await renumeroterEleves(candidates, renumbered);
        await applyWorkspace(activeSessionId ?? undefined);
        toastSuccess(modifies > 0
          ? `${modifies} numéro(s) de table enregistré(s) sur le serveur (${base} → ${base + candidates.length - 1}).`
          : 'Numéros de table déjà à jour sur le serveur.');
      } catch (err) {
        signalerErreur(err, 'Numéros de table non enregistrés.');
      }
      return;
    }
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

  // Fiche enregistrée depuis le profil : le nom et le signataire officiel suivent dans la barre latérale, les bulletins
  // et la session ; la devise propre alimente le pied de page du bulletin.
  const handleProfilChanged = (profil: ProfilEtablissement) => {
    setSettings((prev) => ({ ...prev, institutionName: profil.nom, jurySignerName: profil.nomResponsable, institutionMotto: profil.devise ?? '' }));
    const session = getSession();
    if (session) setSession({ ...session, nomEtablissement: profil.nom });
  };

  // Jeton présent : état de chargement jusqu'à la réponse de l'API, sans aucune donnée de démonstration à l'écran.
  if (workspaceLoading && currentView !== 'auth') {
    return (
      <div className="min-h-dvh bg-[#faf8ff] flex items-center justify-center p-4 sm:p-6" aria-busy="true" role="status">
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
        <Suspense fallback={<div className="min-h-dvh bg-[#faf8ff]" aria-busy="true" />}>
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

  const platformOwner = isPlatformAccount(getSession()) || accountRole === 'SUPER_ADMIN' || accountRole === 'GESTIONNAIRE_PLATEFORME';
  // Depuis le tiroir mobile, une action qui n'est pas un changement de vue doit aussi refermer le tiroir.
  const depuisTiroir = (action?: () => void) => (action ? () => { fermerMenuMobile(); action(); } : undefined);
  const sidebarProps = {
    currentView,
    onViewChange: setCurrentView,
    selectedSession,
    onSessionChange: (label: string) => {
      setSelectedSession(label);
      const match = apiSessions.find((item) => item.label === label);
      if (match) {
        applyWorkspace(match.id).catch((err: Error) => showToast(err.message || 'Session introuvable.'));
      }
    },
    selectedCenter,
    onCenterChange: setSelectedCenter,
    isOfflineMode,
    onToggleOffline: handleToggleOffline,
    settings,
    candidatesCount: candidates.length,
    onOpenBatchPrint: peutImprimer && !sessionPlateformeSeule ? () => setIsBatchPrintModalOpen(true) : undefined,
    onOpenProfil: sessionPlateformeSeule ? undefined : () => setCurrentView('profil'),
    onConnexion: usingApi ? undefined : ouvrirConnexion,
    onOpenSearch: sessionPlateformeSeule ? undefined : () => setIsSearchModalOpen(true),
    sessionOptions: usingApi ? apiSessions.map((item) => item.label) : undefined,
    examType: usingApi ? activeExamType : undefined,
    sessionMode: usingApi ? activeSessionMode : undefined,
    centreExamen: usingApi ? activeCentreExamen : undefined,
    centerOptions: usingApi ? apiCenters : undefined,
    platformOwner,
    platformOnly: sessionPlateformeSeule,
    usingApi,
    apiUser: usingApi ? apiUser : null,
    onOpenAdmin: usingApi && adminAccess && !sessionPlateformeSeule ? () => openAdmin() : undefined,
    onLogout: usingApi ? handleLogout : undefined,
  };
  // Une fenêtre plein écran (recherche, signature, SMS, impression groupée) couvre la barre du bas.
  const fenetreOuverte = isSignatureModalOpen || isSmsModalOpen || isSearchModalOpen || isBatchPrintModalOpen;

  return (
    <div className="bg-[#faf8ff] text-[#131b2e] min-h-dvh antialiased flex">
      {/* Écrans étroits : en-tête compact fixe avec menu burger */}
      <MobileHeader
        institutionName={settings.institutionName}
        logoUrl={settings.logoUrl}
        subtitle={sessionPlateformeSeule ? 'Administration du logiciel' : (selectedSession || (usingApi ? activeExamType : '') || undefined)}
        menuOpen={tiroir.ouvert}
        onOpenMenu={ouvrirMenuMobile}
        onOpenSearch={sessionPlateformeSeule ? undefined : () => setIsSearchModalOpen(true)}
      />

      {/* Sidebar Navigation (bureau, à partir de lg) */}
      <Sidebar {...sidebarProps} />

      {/* Tiroir mobile : la même navigation complète, en panneau latéral plein écran */}
      <MobileDrawer open={tiroir.ouvert} onClose={fermerMenuMobile} label="Menu de navigation">
        <Sidebar
          {...sidebarProps}
          variant="drawer"
          onClose={fermerMenuMobile}
          onOpenBatchPrint={depuisTiroir(sidebarProps.onOpenBatchPrint)}
          onOpenSearch={depuisTiroir(sidebarProps.onOpenSearch)}
          onToggleOffline={handleToggleOffline}
          onLogout={depuisTiroir(sidebarProps.onLogout)}
          onConnexion={depuisTiroir(sidebarProps.onConnexion)}
        />
      </MobileDrawer>

      {/* Main Content Area - Navigated via Sidebar (bureau) ou barre du bas + tiroir (mobile) */}
      <div className="app-chrome w-full min-h-dvh flex flex-col pt-14 pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pl-80 lg:pt-0 lg:pb-0">
        {/* View Routing */}
        <main className="relative bg-[#faf8ff] flex-1 min-w-0">
          {currentView === 'bulletin' && !selectedCandidate && (
            <div className="p-4 md:p-10 text-[14px] text-[#444651] space-y-3">
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
            <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
              <div className="bg-white rounded p-4 md:p-6 shadow-sm border border-[#eaedff] flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#0051d5] bg-[#eaedff] px-2.5 py-1 rounded">
                    Administration (API)
                  </span>
                  <h2 className="text-[18px] md:text-[22px] font-bold text-[#00236f] mt-1.5">
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
              sessionInter={sessionInter}
              centreExamen={activeCentreExamen}
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
              sessionInter={sessionInter}
              centreExamen={activeCentreExamen}
              examType={usingApi ? activeExamType : undefined}
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
              charteModifieeLe={charteModifieeLe}
              onRetablirSceauDemo={usingApi ? undefined : () => void handleUpdateSettings({ ...settings, sealUrl: TOGO_SETTINGS.sealUrl })}
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
              onUpdateAppreciation={handleUpdateAppreciation}
              peutAnnoter={!usingApi || can('NOTES', 'CREER') || can('NOTES', 'MODIFIER')}
              usingApi={usingApi}
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
              examTypeLong={usingApi ? activeExamTypeLong : undefined}
              settings={settings}
              sessionInter={sessionInter}
              centreExamen={activeCentreExamen}
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
              charteModifieeLe={charteModifieeLe}
            />
          )}
        </main>
      </div>

      {/* Écrans étroits : barre d'onglets fixe en bas (Tableau, Candidats, Notes, Bulletins, Plus) */}
      <BottomNav
        currentView={currentView}
        onViewChange={setCurrentView}
        onOpenMenu={ouvrirMenuMobile}
        menuOpen={tiroir.ouvert}
        hidden={fenetreOuverte}
        platformOnly={sessionPlateformeSeule}
        platformOwner={platformOwner}
      />

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
          sessionInter={sessionInter}
          centreExamen={activeCentreExamen}
          onClose={() => setIsBatchPrintModalOpen(false)}
        />
      )}

      {/* Administrative Toast Simulation */}
      {toastMessage && (
        <div className="fixed left-4 right-4 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] lg:left-auto lg:right-6 lg:bottom-6 bg-[#00236f] text-white px-4 py-3 rounded shadow-2xl flex items-center gap-2.5 z-50 animate-bounce text-[12px] font-medium border border-[#90a8ff]/30">
          <span className="material-symbols-outlined text-[#316bf3] text-base">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
