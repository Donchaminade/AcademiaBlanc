export interface Subject {
  id: string;
  name: string;
  teacher: string;
  coef: number;
  /** Vrai quand aucun coefficient n'a été saisi sur l'API : la valeur 1 est appliquée par défaut. */
  coefDefault?: boolean;
  /**
   * Coefficient de la matière dans le programme de chaque classe (clé : id de classe).
   * Une classe absente de cette table n'a pas la matière à son programme.
   */
  coefParClasse?: Record<string, number>;
}

export type MentionType = 'TRÈS BIEN' | 'BIEN' | 'ASSEZ BIEN' | 'PASSABLE' | 'RATTRAPAGE' | 'AJOURNÉ';

/** Décision déduite de la seule moyenne réelle Σ(note × coef) / Σ coef : aucun point n'est jamais ajouté. */
export type DecisionType =
  | "ADMIS D'OFFICE À L'EXAMEN BLANC"
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
  /** Série de la classe (lycée uniquement) ; vide au collège. */
  serie: string;
  /** Identifiant de la classe sur l'API ; absent pour les données de démonstration. */
  classeId?: string;
  /** Session d'examen de rattachement sur l'API (null = élève sans session) ; absent hors API. */
  sessionId?: number | null;
  examCenter: string;
  examCenterName: string;
  parentPhone: string;
  parentEmail: string;
  grades: Record<string, CandidateGrade>;
  /**
   * Coefficient effectif par matière pour la classe de l’élève (le coefficient saisi pour sa classe
   * prime sur le coefficient « toutes classes »). Absent hors API : `Subject.coef` s’applique.
   */
  coefs?: Record<string, number>;
  generalObservation: string;
  digitalSignature?: {
    signedAt: string;
    signer: string;
    shaHash: string;
  };
}

export interface CandidateComputedStats {
  /** Σ des coefficients des matières réellement notées (règle de l'API : une matière sans note ne compte pas). */
  totalCoef: number;
  /** Σ(note × coef) des matières notées. */
  totalPoints: number;
  /** Σ des coefficients de tout le programme de la classe, notes saisies ou non. */
  totalCoefProgramme: number;
  /** Total maximal du bulletin : 20 × Σ coefficients du programme de la classe. */
  pointsMax: number;
  /** Moyenne réelle Σ(note × coef) / Σ coef, arrondie au centième ; 0 sans aucune note. */
  average: number;
  /** Vrai dès qu'une note au moins est saisie (sinon la moyenne 0 n'a pas de sens). */
  evaluated: boolean;
  rank: number;
  totalCandidates: number;
  mention: MentionType;
  decision: DecisionType;
  differenceToPromo: number;
  /** Moyenne des moyennes des élèves notés de la même classe (même session) ; null sans élève noté. */
  classAverage: number | null;
  /** Moyenne la plus forte de la classe ; null sans élève noté. */
  classHighestAverage: number | null;
  /** Moyenne la plus faible de la classe ; null sans élève noté. */
  classLowestAverage: number | null;
  /** Nombre d'élèves notés dans la classe (dénominateur des extrêmes). */
  classEvaluatedCount: number;
}

export type ViewMode = 'dashboard' | 'students' | 'grading' | 'bulletin' | 'records' | 'settings' | 'admin' | 'auth' | 'plateforme' | 'profil';

export type AdminSection =
  | 'annees'
  | 'centres'
  | 'sessions'
  | 'matieres'
  | 'programme'
  | 'coefficients'
  | 'enseignants'
  | 'classes'
  | 'series'
  | 'affectations'
  | 'eleves'
  | 'notes'
  | 'utilisateurs';

export interface AppSettings {
  logoUrl: string;
  sealUrl: string;
  institutionName: string;
  /**
   * Devise propre à l'établissement (`Etablissement.devise`, fiche du profil), imprimée en pied de page
   * après le nom ; vide = nom seul. Distincte de `motto`, la devise nationale de l'en-tête.
   */
  institutionMotto?: string;
  countryName: string;
  motto: string;
  ministryName: string;
  /** Sigle officiel du ministère (MEPST, MENA…) ; vide = déduit du nom par `ministrySigle()`. */
  ministrySigle?: string;
  /** Libellé de l'autorité régionale (direction régionale…) ; vide = ligne absente du bulletin. */
  regionalAuthority?: string;
  /** Mention de pied de page issue du préréglage national ; réservée, non imprimée pour l'instant. */
  footerNote?: string;
  /** Préréglage national appliqué en dernier (identifiant de la plateforme) ; null = en-tête saisi à la main. */
  prereglageNationalId?: number | null;
  academicYear: string;
  sessionName: string;
  examType: string;
  jurySignerTitle?: string;
  jurySignerName: string;
  principalTeacherTitle?: string;
  principalTeacherName: string;
  /** Cachet affiché dans la carte « Le Proviseur » ; vide = emplacement libre pour le cachet physique. */
  sceauUrl?: string;
  /** Signature manuscrite du proviseur ; vide = signature à la main sur le papier. */
  signatureProviseurUrl?: string;
  /** Signature manuscrite du titulaire ; vide = signature à la main sur le papier. */
  signatureTitulaireUrl?: string;
  startTableNumber: number;
  autoAssignTables: boolean;
}

export interface ArchivedSession {
  id: string;
  schoolId: string;
  /** Identifiant de la session réelle sur l'API ; absent pour une archive de démonstration ou saisie à la main. */
  sessionId?: number;
  academicYear: string;
  sessionName: string;
  examType: string;
  serie?: string;
  statut?: string;
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
