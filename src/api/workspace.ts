import { apiGet, isForbidden } from './client';
import { Candidate, Subject } from '../types';
import { estCollege } from '../utils/niveaux';
import { coefficientEffectif } from '../utils/coefficients';
import { appliquerDeliberation } from './ecritures';
import type { DeliberationApi } from './ecritures';
import { SessionTypeExamen, libelleCourtSession, libelleLongSession } from './typesExamen';

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
interface SessionApi extends SessionTypeExamen { id: number; nom: string; serie?: string; anneeScolaireId: number; centreId: number; }
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

export interface WorkspaceOptions {
  /**
   * `true` : la liste affiche tous les élèves enregistrés, quelle que soit leur session.
   * Sinon (défaut), les élèves rattachés à une autre session que la session chargée sont écartés ;
   * ceux sans session restent toujours visibles.
   */
  toutesSessions?: boolean;
}

export interface SchoolWorkspace {
  sessionId: number | null;
  classeId: number | null;
  sessions: ExamOption[];
  centers: ExamOption[];
  /** Classes de l'établissement (choix de la classe à l'import). */
  classes: ExamOption[];
  /** Nombre total d'élèves enregistrés dans la base de l'établissement (avant tout filtre de session). */
  elevesEnBase: number;
  /** Élèves enregistrés mais écartés de la liste parce que rattachés à une autre session. */
  elevesMasques: number;
  subjects: Subject[];
  candidates: Candidate[];
  academicYear: string;
  sessionName: string;
  /** Libellé court du type d'examen de la session active (« BEPC », « BAC II »), pour les listes et la barre latérale. */
  examType: string;
  /** Libellé long du référentiel (« Brevet d'Études du Premier Cycle »), imprimé en tête du bulletin. */
  examTypeLong: string;
  centerLabel: string;
  /** Somme des coefficients réellement enregistrés sur l'API (0 si aucune matière). */
  totalCoef: number;
  /** Nombre de coefficients explicitement saisis (les matières sans coefficient comptent 1 par défaut). */
  coefficientsCount: number;
}

/**
 * Élèves à afficher pour la session chargée : ceux de cette session et ceux sans session.
 * Avec `toutesSessions`, aucun élève enregistré n'est écarté.
 */
export function filtrerRoster<T extends { sessionId?: number | null }>(
  eleves: T[],
  sessionId: number | null,
  options: WorkspaceOptions = {},
): T[] {
  if (options.toutesSessions || sessionId == null) return eleves;
  return eleves.filter((eleve) => eleve.sessionId == null || eleve.sessionId === sessionId);
}

export async function loadSchoolWorkspace(preferredSessionId?: number, options: WorkspaceOptions = {}): Promise<SchoolWorkspace> {
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
  const [notes, deliberations]: [NoteApi[], DeliberationApi[]] = session
    ? await Promise.all([
      lire<NoteApi>(`/api/notes?sessionId=${session.id}`),
      // Délibérations du jury (repêchage, observation, signature) : absentes sur une ancienne API.
      lire<DeliberationApi>(`/api/deliberations?sessionId=${session.id}`).catch(() => [] as DeliberationApi[]),
    ])
    : [[], []];
  const annee = annees.find((item) => item.courante) || annees[0];
  const centre = centres.find((item) => item.id === session?.centreId) || centres[0];
  const teacherName = (matiereId: number, classeId?: number) => {
    const link = affectations.find((item) => item.matiereId === matiereId && (classeId == null || item.classeId === classeId))
      || affectations.find((item) => item.matiereId === matiereId);
    return profs.find((item) => item.id === link?.professeurId)?.nom || '';
  };
  // Coefficient commun de la matière (« toutes classes », sinon 1) : affiché dans les en-têtes partagés.
  // Le coefficient propre à la classe de chaque élève est résolu plus bas, candidat par candidat,
  // comme le fait l’API (BulletinService.coefDe) : il prime sur le coefficient commun.
  const subjects: Subject[] = matieres.map((matiere) => {
    const coef = coefficientEffectif(coefficients, matiere.id, null);
    // Programme des classes : une ligne (matière, classe) = la matière est au programme de la classe.
    const coefParClasse: Record<string, number> = {};
    coefficients
      .filter((item) => item.matiereId === matiere.id && item.classeId != null)
      .forEach((item) => { coefParClasse[String(item.classeId)] = Number(item.valeur); });
    return {
      id: String(matiere.id),
      name: matiere.nom,
      teacher: teacherName(matiere.id),
      coef: coef.valeur,
      coefDefault: coef.source === 'defaut',
      coefParClasse,
    };
  });
  const coefsPourClasse = (classeId: number): Record<string, number> =>
    Object.fromEntries(matieres.map((matiere) => [String(matiere.id), coefficientEffectif(coefficients, matiere.id, classeId).valeur]));

  const roster = filtrerRoster(eleves, session?.id ?? null, options);

  const candidates: Candidate[] = roster.map((eleve) => {
    const classe = classes.find((item) => item.id === eleve.classeId);
    const grades: Candidate['grades'] = {};
    notes.filter((note) => note.eleveId === eleve.id && !note.absent && note.valeur != null).forEach((note) => {
      grades[String(note.matiereId)] = { score: Number(note.valeur), appreciation: '' };
    });
    const candidate: Candidate = {
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
      sessionId: eleve.sessionId ?? null,
      examCenter: centre?.code || '',
      examCenterName: centre ? `${centre.nom}${centre.ville ? ` (${centre.ville})` : ''}` : '',
      parentPhone: '',
      parentEmail: '',
      grades,
      coefs: coefsPourClasse(eleve.classeId),
      generalObservation: '',
    };
    return appliquerDeliberation(candidate, deliberations.find((item) => item.eleveId === eleve.id));
  });

  return {
    sessionId: session?.id ?? null,
    classeId: classes[0]?.id ?? null,
    sessions: sessions.map((item) => ({ id: item.id, label: item.nom })),
    centers: centres.map((item) => ({ id: item.id, label: `${item.nom}${item.code ? ` (${item.code})` : ''}` })),
    classes: classes.map((item) => ({ id: item.id, label: item.nom })),
    elevesEnBase: eleves.length,
    elevesMasques: eleves.length - roster.length,
    subjects,
    candidates,
    academicYear: annee?.libelle || '',
    sessionName: session?.nom || '',
    examType: libelleCourtSession(session),
    examTypeLong: libelleLongSession(session),
    centerLabel: centre ? `${centre.nom}${centre.code ? ` (${centre.code})` : ''}` : '',
    totalCoef: subjects.reduce((sum, subject) => sum + subject.coef, 0),
    coefficientsCount: coefficients.length,
  };
}
