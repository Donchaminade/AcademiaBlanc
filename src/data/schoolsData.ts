import { SchoolAccount, Candidate, AppSettings, ArchivedSession } from '../types';
import { INITIAL_CANDIDATES, TOGO_SETTINGS, autoAssignTableNumbers } from './mockData';

export const PROTESTANT_CANDIDATES: Candidate[] = [
  {
    id: 'cand-prot-101',
    tableNumber: 101,
    matricule: '24-BACD-08101',
    fullName: 'ADJOLOU Kokouvi Chaminade',
    dob: '12/04/2006',
    birthPlace: 'Lomé',
    originSchool: 'Collège Protestant de Lomé',
    gender: 'M',
    serie: 'Baccalauréat Général - Série D',
    examCenter: 'Centre 02 - Collège Protestant Lomé',
    examCenterName: 'Collège Protestant Lomé (Centre 02)',
    parentPhone: '+228 90 45 67 89',
    parentEmail: 'chaminade.dondah.adjolou@gmail.com',
    grades: {
      math: { score: 18.5, appreciation: 'Excellent travail de raisonnement.' },
      pc: { score: 17.0, appreciation: 'Très brillante maîtrise en sciences physiques.' },
      svt: { score: 16.5, appreciation: 'Remarquable synthèse biologique.' },
      fr: { score: 15.0, appreciation: 'Bonne expression écrite et argumentation solide.' },
      philo: { score: 14.0, appreciation: 'Bonne rigueur conceptuelle.' },
      ang: { score: 17.5, appreciation: 'Fluide et pertinent à l\'oral comme à l\'écrit.' },
      hg: { score: 15.5, appreciation: 'Très bonne maîtrise chronologique et spatiale.' },
      eps: { score: 16.0, appreciation: 'Excellente endurance.' }
    },
    generalObservation: '« Félicitations du Conseil. Travail d\'élite et exemplaire. »',
    digitalSignature: {
      signedAt: '15/05/2025 18:30:00',
      signer: 'M. le Directeur ADJOLOU Kodjo',
      shaHash: 'prot_7f9c...44a1'
    }
  },
  {
    id: 'cand-prot-102',
    tableNumber: 102,
    matricule: '24-BACD-08102',
    fullName: 'AMEGAVIE Elom Essi',
    dob: '25/07/2006',
    birthPlace: 'Kpalimé',
    originSchool: 'Collège Protestant de Lomé',
    gender: 'F',
    serie: 'Baccalauréat Général - Série D',
    examCenter: 'Centre 02 - Collège Protestant Lomé',
    examCenterName: 'Collège Protestant Lomé (Centre 02)',
    parentPhone: '+228 91 22 33 44',
    parentEmail: 'famille.amegavie@gmail.com',
    grades: {
      math: { score: 14.5, appreciation: 'Bonne rigueur mathématique.' },
      pc: { score: 13.5, appreciation: 'Bon travail régulier.' },
      svt: { score: 15.0, appreciation: 'Très bonne compréhension des cycles.' },
      fr: { score: 16.0, appreciation: 'Écriture fine et soignée.' },
      philo: { score: 14.5, appreciation: 'Bonne dissertation.' },
      ang: { score: 16.0, appreciation: 'Très bon niveau.' },
      hg: { score: 14.0, appreciation: 'Connaissances solides.' },
      eps: { score: 15.0, appreciation: 'Bonne participation.' }
    },
    generalObservation: '« Élève assidue, très bon potentiel académique. »'
  },
  {
    id: 'cand-prot-103',
    tableNumber: 103,
    matricule: '24-BACD-08103',
    fullName: 'LAWSON Ayite David',
    dob: '08/02/2006',
    birthPlace: 'Aného',
    originSchool: 'Collège Protestant de Lomé',
    gender: 'M',
    serie: 'Baccalauréat Général - Série D',
    examCenter: 'Centre 02 - Collège Protestant Lomé',
    examCenterName: 'Collège Protestant Lomé (Centre 02)',
    parentPhone: '+228 92 11 88 99',
    parentEmail: 'contact.lawson@laposte.tg',
    grades: {
      math: { score: 12.0, appreciation: 'Assez bon, peut approfondir.' },
      pc: { score: 12.5, appreciation: 'Résultats satisfaisants.' },
      svt: { score: 13.0, appreciation: 'Bonne régularité.' },
      fr: { score: 12.5, appreciation: 'Correct.' },
      philo: { score: 11.5, appreciation: 'Passable.' },
      ang: { score: 14.0, appreciation: 'Bonne compréhension.' },
      hg: { score: 13.0, appreciation: 'Travail sérieux.' },
      eps: { score: 14.0, appreciation: 'Apte.' }
    },
    generalObservation: '« Ensemble convenable. Admis d\'office avec mention Assez Bien. »'
  },
  {
    id: 'cand-prot-104',
    tableNumber: 104,
    matricule: '24-BACD-08104',
    fullName: 'MENSAH Edwige Akossiwa',
    dob: '30/11/2006',
    birthPlace: 'Lomé',
    originSchool: 'Collège Protestant de Lomé',
    gender: 'F',
    serie: 'Baccalauréat Général - Série D',
    examCenter: 'Centre 02 - Collège Protestant Lomé',
    examCenterName: 'Collège Protestant Lomé (Centre 02)',
    parentPhone: '+228 93 44 55 66',
    parentEmail: 'parent.mensah@tg.org',
    grades: {
      math: { score: 16.0, appreciation: 'Très bons calculs différentiels.' },
      pc: { score: 15.5, appreciation: 'Excellente tenue en laboratoire.' },
      svt: { score: 16.0, appreciation: 'Raisonnement scientifique précis.' },
      fr: { score: 14.5, appreciation: 'Style clair et structuré.' },
      philo: { score: 13.5, appreciation: 'Bonne réflexion.' },
      ang: { score: 15.5, appreciation: 'Aisance remarquable.' },
      hg: { score: 15.0, appreciation: 'Travail approfondi.' },
      eps: { score: 15.0, appreciation: 'Bon dynamisme.' }
    },
    generalObservation: '« Très bon travail d\'ensemble tout au long de la session. »'
  }
];

export const INITIAL_SCHOOLS: SchoolAccount[] = [
  {
    id: 'school_tokoin',
    name: 'Lycée Moderne de Tokoin',
    code: 'LMT-LOMÉ-01',
    city: 'Lomé',
    region: 'Maritime (Grand Lomé)',
    type: 'Lycée Public d\'Enseignement Général',
    principalName: 'Mme le Proviseur Dr. A. KOUAME',
    email: 'direction@lycee-tokoin.tg',
    phone: '+228 22 21 00 11',
    password: 'password123',
    createdAt: '2025-01-10',
    settings: {
      ...TOGO_SETTINGS,
      institutionName: 'Lycée Moderne de Tokoin',
      jurySignerName: 'Mme le Proviseur Dr. A. KOUAME',
      startTableNumber: 138,
      autoAssignTables: true,
    },
    candidates: INITIAL_CANDIDATES
  },
  {
    id: 'school_protestant',
    name: 'Collège Protestant de Lomé',
    code: 'CPL-LOMÉ-02',
    city: 'Lomé',
    region: 'Maritime (Grand Lomé)',
    type: 'Établissement Confessionnel d\'Enseignement Général',
    principalName: 'M. le Directeur Général Pasteur E. ADJOLOU',
    email: 'administration@collegeprotestant-lome.tg',
    phone: '+228 22 22 34 56',
    password: 'password123',
    createdAt: '2025-02-15',
    settings: {
      ...TOGO_SETTINGS,
      institutionName: 'Collège Protestant de Lomé',
      jurySignerName: 'M. le Directeur Général Pasteur E. ADJOLOU',
      principalTeacherName: 'M. le Titulaire K. AGBEMEDJI',
      sessionName: 'Session Régionale du Baccalauréat Blanc',
      academicYear: 'Année Scolaire 2024-2025',
      startTableNumber: 101,
      autoAssignTables: true,
    },
    candidates: PROTESTANT_CANDIDATES
  }
];

const SCHOOLS_REGISTRY_KEY = 'academiablanc_schools_registry_v1';
const CURRENT_SCHOOL_ID_KEY = 'academiablanc_current_school_id_v1';

export function getRegisteredSchools(): SchoolAccount[] {
  try {
    const raw = localStorage.getItem(SCHOOLS_REGISTRY_KEY);
    if (raw) {
      const parsed: SchoolAccount[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Fallback
  }
  // Initialize with defaults if empty
  saveRegisteredSchools(INITIAL_SCHOOLS);
  return INITIAL_SCHOOLS;
}

export function saveRegisteredSchools(schools: SchoolAccount[]): void {
  try {
    localStorage.setItem(SCHOOLS_REGISTRY_KEY, JSON.stringify(schools));
  } catch {
    // quota ignore
  }
}

export function getCurrentSchoolId(): string {
  try {
    const id = localStorage.getItem(CURRENT_SCHOOL_ID_KEY);
    if (id) {
      const schools = getRegisteredSchools();
      if (schools.some(s => s.id === id)) {
        return id;
      }
    }
  } catch {
    // ignore
  }
  return 'school_tokoin';
}

export function setCurrentSchoolId(id: string): void {
  try {
    localStorage.setItem(CURRENT_SCHOOL_ID_KEY, id);
  } catch {
    // ignore
  }
}

export function getSchoolData(schoolId: string): { settings: AppSettings; candidates: Candidate[] } {
  try {
    const raw = localStorage.getItem(`academiablanc_school_data_${schoolId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.settings && Array.isArray(parsed.candidates)) {
        return parsed;
      }
    }
  } catch {
    // fallback
  }

  // Look up in registered schools
  const schools = getRegisteredSchools();
  const school = schools.find(s => s.id === schoolId) || schools[0] || INITIAL_SCHOOLS[0];
  
  return {
    settings: school.settings,
    candidates: school.candidates || []
  };
}

export function saveSchoolData(schoolId: string, settings: AppSettings, candidates: Candidate[]): void {
  try {
    localStorage.setItem(
      `academiablanc_school_data_${schoolId}`,
      JSON.stringify({ settings, candidates })
    );

    // Also update in registered schools array
    const schools = getRegisteredSchools();
    const updated = schools.map(s => {
      if (s.id === schoolId) {
        return {
          ...s,
          name: settings.institutionName || s.name,
          principalName: settings.jurySignerName || s.principalName,
          settings,
          candidates
        };
      }
      return s;
    });
    saveRegisteredSchools(updated);
  } catch {
    // ignore
  }
}

export function createSchoolAccount(params: {
  name: string;
  code?: string;
  city: string;
  region?: string;
  type?: string;
  principalName: string;
  email: string;
  phone: string;
  password?: string;
  initialWithSampleStudents: boolean;
}): SchoolAccount {
  const newId = `school_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const code = params.code && params.code.trim() 
    ? params.code.trim() 
    : `${params.name.replace(/[^a-zA-Z]/g, '').substring(0, 4).toUpperCase()}-${params.city.substring(0, 4).toUpperCase()}-01`;

  const defaultTitle = params.type?.includes('Collège') || params.type?.includes('CEG')
    ? 'Le Principal'
    : params.name.toLowerCase().includes('collège')
    ? 'Le Directeur'
    : 'Le Proviseur';

  const settings: AppSettings = {
    ...TOGO_SETTINGS,
    institutionName: params.name,
    jurySignerTitle: defaultTitle,
    jurySignerName: params.principalName,
    principalTeacherTitle: 'Le Titulaire',
    startTableNumber: 101,
    autoAssignTables: true,
  };

  let candidates: Candidate[] = [];
  if (params.initialWithSampleStudents) {
    candidates = autoAssignTableNumbers(
      PROTESTANT_CANDIDATES.map((c, i) => ({
        ...c,
        id: `cand-${newId}-${i + 1}`,
        originSchool: params.name,
        examCenterName: `${params.name} (Centre d'Examen)`,
      })),
      101
    );
  }

  const newAccount: SchoolAccount = {
    id: newId,
    name: params.name,
    code,
    city: params.city,
    region: params.region || 'Maritime (Togo)',
    type: params.type || 'Lycée d\'Enseignement Général',
    principalName: params.principalName,
    email: params.email,
    phone: params.phone,
    password: params.password || 'password123',
    createdAt: new Date().toISOString().split('T')[0],
    settings,
    candidates
  };

  const schools = getRegisteredSchools();
  schools.push(newAccount);
  saveRegisteredSchools(schools);
  saveSchoolData(newId, settings, candidates);
  setCurrentSchoolId(newId);

  return newAccount;
}

/**
 * Sessions d'examens historiques par défaut pour comparaison pluriannuelle
 */
export function getDefaultArchivedSessions(schoolId: string): ArchivedSession[] {
  return [
    {
      id: `arch-${schoolId}-2023-2024`,
      schoolId,
      academicYear: '2023-2024',
      sessionName: 'BAC II Blanc 2024 - Série D',
      examType: 'BACCALAURÉAT DEUXIÈME PARTIE',
      archivedAt: '18/05/2024',
      candidatesCount: 42,
      admittedCount: 33,
      admittedRate: 78.57,
      catchupCount: 6,
      catchupRate: 14.29,
      failedCount: 3,
      failedRate: 7.14,
      promoAverage: 12.45,
      highestAverage: 17.80,
      lowestAverage: 7.90,
      mentionsBreakdown: {
        tresBien: 4,
        bien: 9,
        assezBien: 12,
        passable: 8,
      },
      notes: 'Excellente promotion. Progression remarquable en Mathématiques et Sciences Physiques.',
      signers: {
        principal: 'Dr. Aminata Traoré',
        juryPresident: 'Prof. Koffi Mensah',
      },
    },
    {
      id: `arch-${schoolId}-2022-2023`,
      schoolId,
      academicYear: '2022-2023',
      sessionName: 'BAC II Blanc 2023 - Série D',
      examType: 'BACCALAURÉAT DEUXIÈME PARTIE',
      archivedAt: '20/05/2023',
      candidatesCount: 38,
      admittedCount: 28,
      admittedRate: 73.68,
      catchupCount: 7,
      catchupRate: 18.42,
      failedCount: 3,
      failedRate: 7.89,
      promoAverage: 11.90,
      highestAverage: 16.90,
      lowestAverage: 6.85,
      mentionsBreakdown: {
        tresBien: 2,
        bien: 7,
        assezBien: 11,
        passable: 8,
      },
      notes: 'Session stable avec net progrès en SVT et régularité exemplaire aux épreuves sportives.',
      signers: {
        principal: 'Dr. Aminata Traoré',
        juryPresident: 'Dr. Edoh Kossi',
      },
    },
    {
      id: `arch-${schoolId}-2021-2022`,
      schoolId,
      academicYear: '2021-2022',
      sessionName: 'BAC II Blanc 2022 - Série D',
      examType: 'BACCALAURÉAT DEUXIÈME PARTIE',
      archivedAt: '22/05/2022',
      candidatesCount: 35,
      admittedCount: 24,
      admittedRate: 68.57,
      catchupCount: 8,
      catchupRate: 22.86,
      failedCount: 3,
      failedRate: 8.57,
      promoAverage: 11.20,
      highestAverage: 16.15,
      lowestAverage: 6.20,
      mentionsBreakdown: {
        tresBien: 1,
        bien: 5,
        assezBien: 9,
        passable: 9,
      },
      notes: 'Session post-réforme curriculaire avec bon taux d\'admissibilité au second tour.',
      signers: {
        principal: 'M. Messan Agbémébia',
        juryPresident: 'Dr. Edoh Kossi',
      },
    },
  ];
}

/**
 * Récupère les sessions archivées de l'établissement spécifié
 */
export function getSchoolArchivedSessions(schoolId: string): ArchivedSession[] {
  try {
    const raw = localStorage.getItem(`academiablanc_sessions_${schoolId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error loading school archived sessions', e);
  }
  const defaults = getDefaultArchivedSessions(schoolId);
  saveSchoolArchivedSessions(schoolId, defaults);
  return defaults;
}

/**
 * Sauvegarde les sessions archivées pour un établissement
 */
export function saveSchoolArchivedSessions(schoolId: string, sessions: ArchivedSession[]): void {
  try {
    localStorage.setItem(`academiablanc_sessions_${schoolId}`, JSON.stringify(sessions));
  } catch (e) {
    console.error('Error saving school archived sessions', e);
  }
}

