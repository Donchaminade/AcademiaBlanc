import { apiGet, isForbidden } from './client';
import { Candidate, Subject } from '../types';
import { estCollege } from '../utils/niveaux';

/** Une liste refusée (droit VOIR absent) est traitée comme vide : l’écran reste utilisable avec les droits détenus. */
async function lire<T>(path: string): Promise<T[]> {
  try {
    return await apiGet<T[]>(path);
  } catch (err) {
    if (isForbidden(err)) return [];
    throw err;
  }
}

interface Annee { id: number; libelle: string; courante: boolean; }
interface Centre { id: number; nom: string; code: string; ville?: string; }
interface SessionApi { id: number; nom: string; typeExamen: string; serie?: string; anneeScolaireId: number; centreId: number; }
interface Matiere { id: number; nom: string; code: string; }
interface Professeur { id: number; nom: string; }
interface Classe { id: number; nom: string; niveau?: string; serie?: string; titulaireId?: number; }
interface Affectation { professeurId: number; matiereId: number; classeId: number; }
interface Coefficient { matiereId: number; classeId?: number | null; valeur: number; }
interface EleveApi {
  id: number;
  nomComplet: string;
  matricule: string;
  genre: string;
  classeId: number;
  sessionId?: number | null;
  numeroTable?: number | null;
  dateNaissance?: string | null;
  lieuNaissance?: string | null;
  etablissementOrigine?: string | null;
}
interface NoteApi { eleveId: number; matiereId: number; valeur?: number | null; absent: boolean; }

export interface ExamOption { id: number; label: string; }

export interface SchoolWorkspace {
  sessionId: number | null;
  classeId: number | null;
  sessions: ExamOption[];
  centers: ExamOption[];
  subjects: Subject[];
  candidates: Candidate[];
  academicYear: string;
  sessionName: string;
  examType: string;
  centerLabel: string;
  /** Somme des coefficients réellement enregistrés sur l'API (0 si aucune matière). */
  totalCoef: number;
  /** Nombre de coefficients explicitement saisis (les matières sans coefficient comptent 1 par défaut). */
  coefficientsCount: number;
}

export async function loadSchoolWorkspace(preferredSessionId?: number): Promise<SchoolWorkspace> {
  const [annees, centres, sessions, matieres, profs, classes, affectations, coefficients, eleves] = await Promise.all([
    lire<Annee>('/api/annees-scolaires'),
    lire<Centre>('/api/centres'),
    lire<SessionApi>('/api/sessions'),
    lire<Matiere>('/api/matieres'),
    lire<Professeur>('/api/professeurs'),
    lire<Classe>('/api/classes'),
    lire<Affectation>('/api/affectations'),
    lire<Coefficient>('/api/coefficients'),
    lire<EleveApi>('/api/eleves'),
  ]);

  const session = sessions.find((item) => item.id === preferredSessionId) || sessions[0] || null;
  const notes = session ? await lire<NoteApi>(`/api/notes?sessionId=${session.id}`) : [];
  const annee = annees.find((item) => item.courante) || annees[0];
  const centre = centres.find((item) => item.id === session?.centreId) || centres[0];
  const teacherName = (matiereId: number, classeId?: number) => {
    const link = affectations.find((item) => item.matiereId === matiereId && (classeId == null || item.classeId === classeId))
      || affectations.find((item) => item.matiereId === matiereId);
    return profs.find((item) => item.id === link?.professeurId)?.nom || '';
  };
  const coefOf = (matiereId: number, classeId?: number): { value: number; isDefault: boolean } => {
    const specific = coefficients.find((item) => item.matiereId === matiereId && item.classeId === classeId);
    const general = coefficients.find((item) => item.matiereId === matiereId && (item.classeId == null));
    const saved = specific?.valeur ?? general?.valeur;
    return saved == null ? { value: 1, isDefault: true } : { value: Number(saved), isDefault: false };
  };

  const subjects: Subject[] = matieres.map((matiere) => {
    const coef = coefOf(matiere.id);
    // Programme des classes : une ligne (matière, classe) = la matière est au programme de la classe.
    const coefParClasse: Record<string, number> = {};
    coefficients
      .filter((item) => item.matiereId === matiere.id && item.classeId != null)
      .forEach((item) => { coefParClasse[String(item.classeId)] = Number(item.valeur); });
    return {
      id: String(matiere.id),
      name: matiere.nom,
      teacher: teacherName(matiere.id),
      coef: coef.value,
      coefDefault: coef.isDefault,
      coefParClasse,
    };
  });

  const roster = session
    ? eleves.filter((eleve) => eleve.sessionId == null || eleve.sessionId === session.id)
    : eleves;

  const candidates: Candidate[] = roster.map((eleve) => {
    const classe = classes.find((item) => item.id === eleve.classeId);
    const grades: Candidate['grades'] = {};
    notes.filter((note) => note.eleveId === eleve.id && !note.absent && note.valeur != null).forEach((note) => {
      grades[String(note.matiereId)] = { score: Number(note.valeur), appreciation: '' };
    });
    return {
      id: String(eleve.id),
      tableNumber: eleve.numeroTable || 0,
      matricule: eleve.matricule,
      fullName: eleve.nomComplet,
      dob: eleve.dateNaissance || '',
      birthPlace: eleve.lieuNaissance || '',
      originSchool: eleve.etablissementOrigine || '',
      gender: eleve.genre === 'M' ? 'M' : 'F',
      // La classe porte le code du référentiel (« D », « G2 ») ; le bulletin attend « Série D ».
      // Au collège (6e–3e) il n'y a pas de série, même si la session en porte une.
      serie: classe?.serie ? `Série ${classe.serie}` : (classe && estCollege(classe.niveau) ? '' : session?.serie || ''),
      classeId: String(eleve.classeId),
      examCenter: centre?.code || '',
      examCenterName: centre ? `${centre.nom}${centre.ville ? ` (${centre.ville})` : ''}` : '',
      parentPhone: '',
      parentEmail: '',
      grades,
      generalObservation: '',
    };
  });

  return {
    sessionId: session?.id ?? null,
    classeId: classes[0]?.id ?? null,
    sessions: sessions.map((item) => ({ id: item.id, label: item.nom })),
    centers: centres.map((item) => ({ id: item.id, label: `${item.nom}${item.code ? ` (${item.code})` : ''}` })),
    subjects,
    candidates,
    academicYear: annee?.libelle || '',
    sessionName: session?.nom || '',
    examType: session?.typeExamen || '',
    centerLabel: centre ? `${centre.nom}${centre.code ? ` (${centre.code})` : ''}` : '',
    totalCoef: subjects.reduce((sum, subject) => sum + subject.coef, 0),
    coefficientsCount: coefficients.length,
  };
}
