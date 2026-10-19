import { Subject, Candidate, CandidateComputedStats, MentionType, DecisionType, AppSettings } from '../types';
import { camaradesDeClasse, extremesDesMoyennes, moyenneReelle } from '../utils/bulletinMetrics';
import { PREREGLAGES_DEMONSTRATION } from './prereglagesDemo';

/** Libellés d'en-tête d'un préréglage de démonstration (hors connexion uniquement). */
const enTeteDemo = (code: string) => {
  const p = PREREGLAGES_DEMONSTRATION.find((item) => item.code === code) ?? PREREGLAGES_DEMONSTRATION[0];
  return { countryName: p.republique, motto: p.devise, ministryName: p.ministere, ministrySigle: p.sigleMinistere };
};

export const DEFAULT_LOGO_URL =
  'https://lh3.googleusercontent.com/aida/AEtjO1UnLI6S9Hytui1A9d9UWXgFWkKNEQdHwWj-qv_pleqr6xChZjkQ_hVxD-aM7PabrfqOZDf9ugA6kc-rj7K5JTE5ElZ45ND0qIxztcta4O1_E_zARPdjnpxy_kv9bSHry0uk2wuFTcTfLZJhexrfQSF4HSuwKMiTsGgWQcvQfaqHxwznS1BwZ4da2_J3lUo_qIv5wq5JFlIKiUFVPFBC4eNorr5QR-ucmlOfuUJELObfQgYtwboTkHFNt04';

export const TOGO_SETTINGS: AppSettings = {
  logoUrl: DEFAULT_LOGO_URL,
  sealUrl: DEFAULT_LOGO_URL,
  institutionName: 'AcademiaBlanc',
  ...enTeteDemo('TG'),
  academicYear: 'ANNÉE ACADÉMIQUE 2024-2025',
  sessionName: 'SESSION NATIONALE JUIN 2025',
  examType: 'BACCALAURÉAT DEUXIÈME PARTIE (BAC II BLANC)',
  jurySignerTitle: 'Le Proviseur',
  jurySignerName: 'Dr. Aminata Traoré',
  principalTeacherTitle: 'Le Titulaire',
  principalTeacherName: 'M. Konan Germain',
  startTableNumber: 138,
  autoAssignTables: true,
};

export const CI_SETTINGS: AppSettings = {
  logoUrl: DEFAULT_LOGO_URL,
  sealUrl: DEFAULT_LOGO_URL,
  institutionName: 'AcademiaBlanc',
  ...enTeteDemo('CI'),
  academicYear: 'ANNÉE ACADÉMIQUE 2024-2025',
  sessionName: 'SESSION NATIONALE MAI 2025',
  examType: 'BACCALAURÉAT II (BLANC)',
  jurySignerTitle: 'Le Proviseur',
  jurySignerName: 'Dr. Aminata Traoré',
  principalTeacherTitle: 'Le Titulaire',
  principalTeacherName: 'M. Konan Germain',
  startTableNumber: 138,
  autoAssignTables: true,
};

export const DEFAULT_SETTINGS: AppSettings = TOGO_SETTINGS;

export const INITIAL_SUBJECTS: Subject[] = [
  { id: 'math', name: 'Mathématiques', teacher: 'M. Konan G.', coef: 4 },
  { id: 'pc', name: 'Sciences Physiques & Chimie', teacher: 'Mme Touré B.', coef: 4 },
  { id: 'svt', name: 'Sciences de la Vie et de la Terre (SVT)', teacher: 'Dr. Ouedraogo', coef: 4 },
  { id: 'fr', name: 'Français & Littérature', teacher: 'M. Diallo S.', coef: 2 },
  { id: 'philo', name: 'Philosophie', teacher: 'M. Bamba K.', coef: 2 },
  { id: 'ang', name: 'Anglais LV1', teacher: 'Mme Koffi A.', coef: 2 },
  { id: 'hg', name: 'Histoire-Géographie', teacher: 'M. Yao N.', coef: 2 },
  { id: 'eps', name: 'Éducation Physique (EPS)', teacher: 'M. Camara', coef: 1 },
];

export const INITIAL_CANDIDATES: Candidate[] = [
  {
    id: 'cand-146',
    tableNumber: 138,
    matricule: '24-BACD-09414',
    fullName: 'CISSE Fatoumata',
    dob: '19/08/2006',
    birthPlace: 'Atakpamé',
    originSchool: 'Lycée Scientifique de Lomé',
    gender: 'F',
    serie: 'BAC II Blanc 2025 - Série D',
    examCenter: 'Centre N° 01 • Salle 12',
    examCenterName: 'Lycée Moderne de Tokoin (Lomé)',
    parentPhone: '+228 93 99 88 77',
    parentEmail: 'cisse.contact@gouv.tg',
    generalObservation: '« Bon examen blanc. Esprit d\'analyse affirmé et belle constance dans les résultats. Mention Assez Bien méritée. »',
    grades: {
      math: { score: 14.0, appreciation: 'Très bonne maîtrise de l\'algèbre et de la géométrie.' },
      pc: { score: 13.5, appreciation: 'Bonne rigueur méthodologique.' },
      svt: { score: 14.0, appreciation: 'Excellents schémas et restitution rigoureuse.' },
      fr: { score: 12.5, appreciation: 'Style fluide et réfléchi.' },
      philo: { score: 11.5, appreciation: 'Bonne culture philosophique.' },
      ang: { score: 14.0, appreciation: 'Bonne aisance à l\'écrit.' },
      hg: { score: 13.0, appreciation: 'Solides repères historiques.' },
      eps: { score: 15.0, appreciation: 'Dynamique et volontaire.' },
    }
  },
  {
    id: 'cand-148',
    tableNumber: 139,
    matricule: '24-BACD-09415',
    fullName: 'DIOMANDE Alassane',
    dob: '30/10/2005',
    birthPlace: 'Dapaong',
    originSchool: 'Lycée de Kodjoviakopé',
    gender: 'M',
    serie: 'BAC II Blanc 2025 - Série D',
    examCenter: 'Centre N° 01 • Salle 12',
    examCenterName: 'Lycée Moderne de Tokoin (Lomé)',
    parentPhone: '+228 99 44 55 66',
    parentEmail: 'diomande.famille@gmail.com',
    generalObservation: '« Résultats très insuffisants. Nécessite un soutien scolaire approfondi et une remise à niveau dans toutes les matières scientifiques. »',
    grades: {
      math: { score: 6.5, appreciation: 'Grandes difficultés d\'assimilation des théorèmes.' },
      pc: { score: 7.0, appreciation: 'Formules non maîtrisées.' },
      svt: { score: 7.5, appreciation: 'Restitution trop superficielle.' },
      fr: { score: 8.0, appreciation: 'Nombreuses fautes de syntaxe.' },
      philo: { score: 6.0, appreciation: 'Devoir hors-sujet.' },
      ang: { score: 8.0, appreciation: 'Vocabulaire très limité.' },
      hg: { score: 7.5, appreciation: 'Lacunes importantes de repères.' },
      eps: { score: 11.0, appreciation: 'Participation correcte.' },
    }
  },
  {
    id: 'cand-147',
    tableNumber: 140,
    matricule: '24-BACD-09416',
    fullName: 'KABLAN Jean-Marc',
    dob: '11/01/2006',
    birthPlace: 'Aného',
    originSchool: 'Lycée Moderne de Tokoin',
    gender: 'M',
    serie: 'BAC II Blanc 2025 - Série D',
    examCenter: 'Centre N° 01 • Salle 12',
    examCenterName: 'Lycée Moderne de Tokoin (Lomé)',
    parentPhone: '+228 96 11 22 33',
    parentEmail: 'kablan.parents@moov.tg',
    generalObservation: '« Doit impérativement préparer les oraux de rattrapage en Mathématiques et Sciences Physiques. Capacité de rebond évidente si le travail est intensifié. »',
    grades: {
      math: { score: 8.0, appreciation: 'Trop de lacunes en analyse, reprise nécessaire.' },
      pc: { score: 8.5, appreciation: 'Connaissances expérimentales insuffisantes.' },
      svt: { score: 9.5, appreciation: 'Quelques bonnes réponses mais incomplet.' },
      fr: { score: 9.0, appreciation: 'Problème de gestion du temps lors de la rédaction.' },
      philo: { score: 8.5, appreciation: 'Confusion dans les concepts directeurs.' },
      ang: { score: 10.0, appreciation: 'Niveau moyen acceptable.' },
      hg: { score: 9.0, appreciation: 'Trop d\'approximations chronologiques.' },
      eps: { score: 13.0, appreciation: 'Bon investissement en sport.' },
    }
  },
  {
    id: 'cand-143',
    tableNumber: 141,
    matricule: '24-BACD-09417',
    fullName: 'KOFFI Aya Marie-Madeleine',
    dob: '02/03/2007',
    birthPlace: 'Kpalimé',
    originSchool: 'Lycée 2 Février (Lomé)',
    gender: 'F',
    serie: 'BAC II Blanc 2025 - Série D',
    examCenter: 'Centre N° 01 • Salle 12',
    examCenterName: 'Lycée Moderne de Tokoin (Lomé)',
    parentPhone: '+228 92 12 34 56',
    parentEmail: 'koffi.famille@laposte.tg',
    generalObservation: '« Élève d\'une excellence remarquable. Première de promotion. Maîtrise parfaite de l\'ensemble du cursus scientifique. »',
    digitalSignature: {
      signedAt: '15-05-2025 18:45:12',
      signer: 'Dr. Aminata Traoré',
      shaHash: 'a712f5e89d123b09cc45'
    },
    grades: {
      math: { score: 18.0, appreciation: 'Brillant et rigoureux, intuition mathématique exceptionnelle.' },
      pc: { score: 17.5, appreciation: 'Résultats parfaits en thermodynamique et chimie organique.' },
      svt: { score: 16.5, appreciation: 'Raisonnement scientifique remarquable et schémas précis.' },
      fr: { score: 14.5, appreciation: 'Excellente maîtrise stylistique.' },
      philo: { score: 14.0, appreciation: 'Culture philosophique riche et argumentation soignée.' },
      ang: { score: 17.0, appreciation: 'Bilingual level proficiency in speech and essay.' },
      hg: { score: 15.5, appreciation: 'Très bonne compréhension des enjeux géopolitiques.' },
      eps: { score: 16.0, appreciation: 'Très bonne participation et esprit sportif.' },
    }
  },
  {
    id: 'cand-142',
    tableNumber: 142,
    matricule: '24-BACD-09418',
    fullName: 'KOUAME Jean-Philippe Emmanuel',
    dob: '14/09/2006',
    birthPlace: 'Lomé',
    originSchool: 'Lycée Moderne de Tokoin',
    gender: 'M',
    serie: 'BAC II Blanc 2025 - Série D',
    examCenter: 'Centre N° 01 • Salle 12',
    examCenterName: 'Lycée Moderne de Tokoin (Lomé)',
    parentPhone: '+228 90 48 92 11',
    parentEmail: 'jp.kouame.famille@outlook.com',
    generalObservation: '« Examen blanc très prometteur pour les épreuves nationales définitives. Félicitations du jury pour la régularité du travail dans les disciplines scientifiques fondamentales. »',
    digitalSignature: {
      signedAt: '15-05-2025 18:42:09',
      signer: 'Dr. Aminata Traoré',
      shaHash: 'e9b4c73f88a109bd3c42'
    },
    grades: {
      math: { score: 16.5, appreciation: 'Excellent raisonnement analytique, rigueur géométrique exemplaire.' },
      pc: { score: 15.0, appreciation: 'Très bon travail expérimental, maîtrises des calculs stœchiométriques.' },
      svt: { score: 14.5, appreciation: 'Bonne restitution des synthèses biologiques.' },
      fr: { score: 13.0, appreciation: 'Dissertation bien structurée, vocabulaire riche.' },
      philo: { score: 12.5, appreciation: 'Analyse conceptuelle pertinente.' },
      ang: { score: 16.0, appreciation: 'Very fluent and accurate grammar skills.' },
      hg: { score: 14.0, appreciation: 'Bonne maîtrise de la cartographie.' },
      eps: { score: 17.0, appreciation: 'Excellente endurance athlétique.' },
    }
  },
  {
    id: 'cand-145',
    tableNumber: 143,
    matricule: '24-BACD-09419',
    fullName: "N'GUESSAN Yao David",
    dob: '05/06/2006',
    birthPlace: 'Sokodé',
    originSchool: 'Lycée d\'Agoè-Nyivé',
    gender: 'M',
    serie: 'BAC II Blanc 2025 - Série D',
    examCenter: 'Centre N° 01 • Salle 12',
    examCenterName: 'Lycée Moderne de Tokoin (Lomé)',
    parentPhone: '+228 90 65 43 21',
    parentEmail: 'nguessan.famille@yahoo.fr',
    generalObservation: '« Dossier scolaire exemplaire. Moyenne proche du seuil d\'admission : le conseil encourage un effort soutenu en sciences avant la session officielle. »',
    grades: {
      math: { score: 9.5, appreciation: 'Proche du niveau requis, manque de rigueur sur les suites.' },
      pc: { score: 9.5, appreciation: 'Des notions acquises mais des confusions récurrentes d\'unités.' },
      svt: { score: 10.0, appreciation: 'Moyenne atteinte de justesse.' },
      fr: { score: 10.5, appreciation: 'Devoir équilibré sans éclat particulier.' },
      philo: { score: 9.0, appreciation: 'Difficultés dans la problématisation du sujet.' },
      ang: { score: 10.5, appreciation: 'Expression simple mais compréhensible.' },
      hg: { score: 10.0, appreciation: 'Conforme aux attentes minimales.' },
      eps: { score: 12.0, appreciation: 'Attitude sérieuse et engagée.' },
    }
  },
  {
    id: 'cand-144',
    tableNumber: 144,
    matricule: '24-BACD-09420',
    fullName: 'TRAORE Bakary Mohamed',
    dob: '28/11/2006',
    birthPlace: 'Kara',
    originSchool: 'Collège Protestant Lomé',
    gender: 'M',
    serie: 'BAC II Blanc 2025 - Série D',
    examCenter: 'Centre N° 01 • Salle 12',
    examCenterName: 'Lycée Moderne de Tokoin (Lomé)',
    parentPhone: '+228 91 98 76 54',
    parentEmail: 'traore.bakary.parents@gmail.com',
    generalObservation: '« Travail satisfaisant dans l\'ensemble. Des efforts doivent être maintenus en mathématiques et philosophie pour conforter l\'admission définitive. »',
    grades: {
      math: { score: 10.5, appreciation: 'Résultats moyens, revoir le calcul intégral.' },
      pc: { score: 12.0, appreciation: 'Bonne participation et progrès notables en électricité.' },
      svt: { score: 11.5, appreciation: 'Ensemble convenable mais manque parfois de précision.' },
      fr: { score: 11.0, appreciation: 'Expression correcte, structure classique.' },
      philo: { score: 9.5, appreciation: 'Effort de réflexion mais argumentation fragile.' },
      ang: { score: 12.5, appreciation: 'Compréhension satisfaisante de l\'anglais technique.' },
      hg: { score: 11.0, appreciation: 'Apprentissage régulier des cours.' },
      eps: { score: 14.0, appreciation: 'Bonne régularité aux épreuves sportives.' },
    }
  }
];


export const PROMO_OVERALL_AVERAGE = 11.42;
export const TOTAL_CANDIDATES_COUNT = 138;

export function computeCandidateStats(
  candidate: Candidate,
  subjects: Subject[],
  allCandidates: Candidate[]
): CandidateComputedStats {
  // Même règle que l’API (`GradeCalculator`) : seules les matières du programme de la classe du
  // candidat comptent, avec le coefficient de cette classe ; une matière sans note est exclue du
  // numérateur et du dénominateur ; moyenne = Σ(note × coef) / Σ coef, jamais majorée.
  const { totalCoef, totalPoints, totalCoefProgramme, pointsMax, average, evaluated } = moyenneReelle(candidate, subjects);

  // Compute rank dynamically against all candidates sorted by descending average
  const allAverages = allCandidates.map(c => ({ id: c.id, avg: moyenneReelle(c, subjects).average }));

  // Sort candidates by average descending: highest average is 1st
  allAverages.sort((a, b) => b.avg - a.avg);

  // Calculate official competition rank (1er, 2e, 3e... with ex-aequo handling)
  let rank = 1;
  const foundIndex = allAverages.findIndex(item => item.id === candidate.id);
  if (foundIndex !== -1) {
    const candAvg = allAverages[foundIndex].avg;
    // Find the first index that has this same average to handle ties (ex-aequo)
    const firstWithThisAvg = allAverages.findIndex(item => Math.abs(item.avg - candAvg) < 0.001);
    rank = firstWithThisAvg !== -1 ? firstWithThisAvg + 1 : foundIndex + 1;
  }

  let mention: MentionType = 'PASSABLE';
  let decision: DecisionType = "ADMIS D'OFFICE À L'EXAMEN BLANC";

  if (average >= 16) {
    mention = 'TRÈS BIEN';
    decision = "ADMIS D'OFFICE À L'EXAMEN BLANC";
  } else if (average >= 14) {
    mention = 'BIEN';
    decision = "ADMIS D'OFFICE À L'EXAMEN BLANC";
  } else if (average >= 12) {
    mention = 'ASSEZ BIEN';
    decision = "ADMIS D'OFFICE À L'EXAMEN BLANC";
  } else if (average >= 10) {
    mention = 'PASSABLE';
    decision = "ADMIS D'OFFICE À L'EXAMEN BLANC";
  } else if (average >= 8) {
    mention = 'RATTRAPAGE';
    decision = "ADMISSIBLE AU SECOND TOUR (RATTRAPAGE)";
  } else {
    mention = 'AJOURNÉ';
    decision = "AJOURNÉ À L'EXAMEN BLANC";
  }

  const promoAvg = allAverages.length > 0 
    ? Math.round((allAverages.reduce((acc, curr) => acc + curr.avg, 0) / allAverages.length) * 100) / 100 
    : 10;
  const differenceToPromo = Math.round((average - promoAvg) * 100) / 100;
  const totalCandidates = allCandidates.length > 0 ? allCandidates.length : 1;

  // Extrêmes de la classe de l’élève (même session) : moyenne la plus forte, la plus faible, moyenne de classe.
  const classe = extremesDesMoyennes(camaradesDeClasse(candidate, allCandidates), subjects);

  return {
    totalCoef,
    totalPoints,
    totalCoefProgramme,
    pointsMax,
    average,
    evaluated,
    rank,
    totalCandidates,
    mention,
    decision,
    differenceToPromo,
    classAverage: classe.average,
    classHighestAverage: classe.highest,
    classLowestAverage: classe.lowest,
    classEvaluatedCount: classe.count,
  };
}

/**
 * Génère et réassigne automatiquement les numéros de table selon l'ordre alphabétique des noms (A → Z).
 */
export function autoAssignTableNumbers(
  candidatesList: Candidate[],
  startNumber: number = 138
): Candidate[] {
  // Tri alphabétique rigoureux selon le nom et prénoms (collation française)
  const sorted = [...candidatesList].sort((a, b) =>
    a.fullName.trim().localeCompare(b.fullName.trim(), 'fr', { sensitivity: 'base' })
  );

  return sorted.map((cand, idx) => ({
    ...cand,
    tableNumber: startNumber + idx,
  }));
}
