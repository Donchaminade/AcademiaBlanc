export interface Subject {
  id: string;
  name: string;
  teacher: string;
  coef: number;
}

export type MentionType = 'TRÈS BIEN' | 'BIEN' | 'ASSEZ BIEN' | 'PASSABLE' | 'RATTRAPAGE' | 'AJOURNÉ';

export type DecisionType = 
  | "ADMIS D'OFFICE À L'EXAMEN BLANC"
  | "ADMIS APRÈS DÉLIBÉRATION DU JURY"
  | "ADMISSIBLE AU SECOND TOUR (RATTRAPAGE)"
  | "AJOURNÉ À L'EXAMEN BLANC";

export interface CandidateGrade {
  score: number;
  appreciation: string;
}

export interface Candidate {
  id: string;
  tableNumber: number;
  matricule: string;
  fullName: string;
  dob: string;
  birthPlace: string;
  originSchool: string;
  gender: 'M' | 'F';
  serie: string;
  examCenter: string;
  examCenterName: string;
  parentPhone: string;
  parentEmail: string;
  grades: Record<string, CandidateGrade>;
  generalObservation: string;
  isDeliberated?: boolean;
  juryBonus?: number; // Repêchage points
  digitalSignature?: {
    signedAt: string;
    signer: string;
    shaHash: string;
  };
}

export interface CandidateComputedStats {
  totalCoef: number;
  totalPoints: number;
  average: number;
  rank: number;
  totalCandidates: number;
  mention: MentionType;
  decision: DecisionType;
  differenceToPromo: number;
}

export type ViewMode = 'dashboard' | 'students' | 'grading' | 'bulletin' | 'records' | 'settings' | 'admin' | 'auth';

export type AdminSection =
  | 'annees'
  | 'centres'
  | 'sessions'
  | 'matieres'
  | 'coefficients'
  | 'enseignants'
  | 'classes'
  | 'affectations'
  | 'eleves'
  | 'notes';

export interface AppSettings {
  logoUrl: string;
  sealUrl: string;
  institutionName: string;
  countryName: string;
  motto: string;
  ministryName: string;
  academicYear: string;
  sessionName: string;
  examType: string;
  jurySignerTitle?: string;
  jurySignerName: string;
  principalTeacherTitle?: string;
  principalTeacherName: string;
  startTableNumber: number;
  autoAssignTables: boolean;
}

export interface ArchivedSession {
  id: string;
  schoolId: string;
  academicYear: string;
  sessionName: string;
  examType: string;
  archivedAt: string;
  candidatesCount: number;
  admittedCount: number;
  admittedRate: number;
  catchupCount: number;
  catchupRate: number;
  failedCount: number;
  failedRate: number;
  promoAverage: number;
  highestAverage: number;
  lowestAverage: number;
  mentionsBreakdown: {
    tresBien: number;
    bien: number;
    assezBien: number;
    passable: number;
  };
  notes?: string;
  signers?: {
    principal?: string;
    juryPresident?: string;
  };
}

export interface SchoolAccount {
  id: string;
  name: string;
  code: string;
  city: string;
  region: string;
  type: string;
  principalName: string;
  email: string;
  phone: string;
  password?: string;
  createdAt: string;
  settings: AppSettings;
  candidates: Candidate[];
}
