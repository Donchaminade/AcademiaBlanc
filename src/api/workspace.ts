import { apiGet, isForbidden } from './client';
import { Candidate, Subject } from '../types';
import { estCollege } from '../utils/niveaux';
import { coefficientEffectif } from '../utils/coefficients';
import { appliquerDeliberation } from './ecritures';
import type { DeliberationApi } from './ecritures';
import { SessionTypeExamen, libelleCourtSession, libelleLongSession } from './typesExamen';
import { MODE_SESSION_DEFAUT, estSessionInter } from '../utils/sessionMode';
import type { ModeSession } from '../utils/sessionMode';
import { loadExamenCommun } from './transferts';
import type { ExamenCommunVue } from './transferts';

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
/**
 * `mode` et `centreExamen` (nom de l'établissement hôte en inter-établissements) : absents sur une ancienne API.
 * `transfertSourceId` / `transfertCentre` : session recréée à partir d'un transfert reçu (centre émetteur).
 */
interface SessionApi extends SessionTypeExamen {
  id: number; nom: string; statut?: string; serie?: string; anneeScolaireId: number; centreId: number;
  mode?: ModeSession | null; centreExamen?: string | null;
  transfertSourceId?: number | null; transfertCentre?: string | null;
}
interface Matiere { id: number; nom: string; code: string; }
interface Professeur { id: number; nom: string; }
/** `titulaireId` : enseignant désigné titulaire dans Administration › Classes ; null ou absent = sans titulaire. */
interface Classe { id: number; nom: string; niveau?: string; serie?: string; titulaireId?: number | null; }
/** Série du référentiel de l'établissement (`/api/series`) : le libellé imprimé en tête du bulletin. */
interface SerieApi { id: number; code: string; libelle: string; }
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
interface NoteApi { eleveId: number; matiereId: number; valeur?: number | null; absent: boolean; appreciation?: string | null; }

export interface ExamOption { id: number; label: string; /** Mode de la session (absent pour un centre ou une classe). */ mode?: ModeSession; }

export interface WorkspaceOptions {
  /**
   * `true` : la liste affiche tous les élèves enregistrés, quelle que soit leur session.
   * Sinon (défaut), seuls restent les élèves de la session chargée, ceux de ses sessions sœurs
   * (même examen, même année scolaire) et ceux sans session.
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
  /** Mode de la session chargée : interne (défaut) ou inter-établissements. */
  sessionMode: ModeSession;
  /** Nom du centre d'examen d'une session inter-établissements (l'établissement hôte) ; vide en mode interne. */
  centreExamen: string;
  /**
   * Session issue d'un transfert : nom du centre d'examen émetteur (bandeau « Session issue d'un transfert »,
   * verrou de la saisie des notes) ; vide pour une session ordinaire.
   */
  transfertCentre: string;
  /** Somme des coefficients réellement enregistrés sur l'API (0 si aucune matière). */
  totalCoef: number;
  /** Nombre de coefficients explicitement saisis (les matières sans coefficient comptent 1 par défaut). */
  coefficientsCount: number;
}

/** Champs d'une session qui déterminent ses « sœurs » : même examen dans la même année scolaire. */
export type SessionFamille = Pick<SessionApi, 'id' | 'anneeScolaireId' | 'typeExamenId' | 'typeExamen' | 'transfertSourceId'>;

/** Session recréée chez le destinataire à partir d'un transfert reçu (miroir de `SessionExamen.estIssueDunTransfert`). */
export function estSessionTransferee(session: Pick<SessionApi, 'transfertSourceId'> | null | undefined): boolean {
  return session?.transfertSourceId != null;
}

/**
 * Identifiants des sessions sœurs de `session` (elle comprise) : même année scolaire et même type
 * d'examen (par référentiel, sinon par libellé). Un « BEPC blanc n°2 » en février reprend ainsi les
 * élèves importés pour le « BEPC blanc n°1 » de novembre, sans réimport.
 * Une session issue d'un transfert n'a pas de sœur et n'en est pour personne : ses élèves viennent
 * du centre d'examen et ne se mélangent pas aux sessions propres de l'établissement (même règle que l'API).
 */
export function sessionsSoeurs(session: SessionFamille | null | undefined, sessions: readonly SessionFamille[]): number[] {
  if (!session) return [];
  if (estSessionTransferee(session)) return [session.id];
  const memeType = (autre: SessionFamille) => (session.typeExamenId != null && autre.typeExamenId != null
    ? session.typeExamenId === autre.typeExamenId
    : (session.typeExamen || '').trim().toLowerCase() !== '' && (session.typeExamen || '').trim().toLowerCase() === (autre.typeExamen || '').trim().toLowerCase());
  const ids = sessions
    .filter((autre) => !estSessionTransferee(autre) && autre.anneeScolaireId === session.anneeScolaireId && memeType(autre))
    .map((autre) => autre.id);
  return ids.includes(session.id) ? ids : [session.id, ...ids];
}

/**
 * Élèves à afficher pour la session chargée : ceux de cette session, ceux de ses sessions sœurs
 * (`soeurs`, cf. {@link sessionsSoeurs}) et ceux sans session. Avec `toutesSessions`, aucun élève
 * enregistré n'est écarté. Pour une session issue d'un transfert (`stricte`), seuls ses propres élèves
 * restent : ceux sans session appartiennent à l'établissement, pas à l'examen commun.
 */
export function filtrerRoster<T extends { sessionId?: number | null }>(
  eleves: T[],
  sessionId: number | null,
  options: WorkspaceOptions = {},
  soeurs: readonly number[] = [],
  stricte = false,
): T[] {
  if (options.toutesSessions || sessionId == null) return eleves;
  if (stricte) return eleves.filter((eleve) => eleve.sessionId === sessionId);
  return eleves.filter((eleve) => eleve.sessionId == null || eleve.sessionId === sessionId || soeurs.includes(eleve.sessionId));
}

/**
 * Statistiques de l'examen commun par élève (clé : id d'élève), prêtes à être portées par les candidats.
 * Les ids de matières sont ceux de l'établissement destinataire (alignés à l'acceptation du transfert).
 */
export function statsExamenCommunParEleve(vue: ExamenCommunVue | null | undefined): Record<string, Candidate['examenCommun']> {
  const resultat: Record<string, Candidate['examenCommun']> = {};
  for (const stat of vue?.eleves ?? []) {
    const matieres: NonNullable<Candidate['examenCommun']>['matieres'] = {};
    for (const m of stat.matieres ?? []) {
      matieres[String(m.matiereId)] = { rang: m.rang ?? null, noteMax: m.noteMax ?? null, noteMin: m.noteMin ?? null };
    }
    resultat[String(stat.eleveId)] = {
      rang: stat.rang ?? null,
      effectif: stat.effectifGroupe ?? null,
      moyenneGroupe: stat.moyenneGroupe ?? null,
      moyenneMax: stat.moyenneMaxGroupe ?? null,
      moyenneMin: stat.moyenneMinGroupe ?? null,
      matieres,
    };
  }
  return resultat;
}

/** Miroir de `SessionStatut.estArchivee` côté API : archivée, clôturée, fermée ou terminée (casse et accents ignorés). */
export function estSessionArchivee(statut: string | null | undefined): boolean {
  const normalise = (statut || '').trim().normalize('NFD').replace(/\p{M}/gu, '').toUpperCase();
  return /^(ARCHIV|CLOTUR|FERME|TERMIN)/.test(normalise);
}

/**
 * Session chargée à l'ouverture : celle demandée si elle existe ; sinon une session encore ouverte
 * (de l'année courante de préférence) plutôt qu'une session archivée ; à défaut la première de la liste.
 * Ainsi, après avoir archivé le « BEPC blanc n°1 », on arrive directement sur le « n°2 ».
 */
export function sessionParDefaut<S extends Pick<SessionApi, 'id' | 'statut' | 'anneeScolaireId'>>(
  sessions: readonly S[],
  preferredSessionId: number | undefined,
  annees: readonly Pick<Annee, 'id' | 'courante'>[] = [],
): S | null {
  const demandee = sessions.find((item) => item.id === preferredSessionId);
  if (demandee) return demandee;
  const ouvertes = sessions.filter((item) => !estSessionArchivee(item.statut));
  const anneeCourante = annees.find((item) => item.courante)?.id;
  return ouvertes.find((item) => item.anneeScolaireId === anneeCourante) || ouvertes[0] || sessions[0] || null;
}

/**
 * Nom du titulaire d'une classe (visa du bulletin) : l'enseignant que l'administration a affecté à la classe.
 * Chaîne vide si la classe n'a pas de titulaire ou si l'enseignant n'est pas lisible : le bulletin laisse
 * alors la ligne à compléter, sans jamais substituer un nom de démonstration.
 */
export function titulaireDeClasse(
  classe: Pick<Classe, 'titulaireId'> | null | undefined,
  professeurs: readonly Pick<Professeur, 'id' | 'nom'>[],
): string {
  if (classe?.titulaireId == null) return '';
  return professeurs.find((item) => item.id === classe.titulaireId)?.nom.trim() || '';
}

/** Libellé de la série de la classe (« Sciences expérimentales ») ; vide au collège ou hors référentiel. */
export function libelleSerie(
  classe: Pick<Classe, 'serie' | 'niveau'> | null | undefined,
  series: readonly Pick<SerieApi, 'code' | 'libelle'>[],
): string {
  const code = (classe?.serie || '').trim();
  if (!code || estCollege(classe?.niveau)) return '';
  return series.find((item) => item.code.toLowerCase() === code.toLowerCase())?.libelle.trim() || '';
}

export async function loadSchoolWorkspace(preferredSessionId?: number, options: WorkspaceOptions = {}): Promise<SchoolWorkspace> {
  const [annees, centres, sessions, matieres, profs, classes, affectations, coefficients, eleves, series] = await Promise.all([
    lire<Annee>('/api/annees-scolaires'),
    lire<Centre>('/api/centres'),
    lire<SessionApi>('/api/sessions'),
    lire<Matiere>('/api/matieres'),
    lire<Professeur>('/api/professeurs'),
    lire<Classe>('/api/classes'),
    lire<Affectation>('/api/affectations'),
    lire<Coefficient>('/api/coefficients'),
    lire<EleveApi>('/api/eleves'),
    // Libellés des séries (« D » → « Sciences expérimentales ») ; absents sur une ancienne API.
    lire<SerieApi>('/api/series').catch(() => [] as SerieApi[]),
  ]);

  const session = sessionParDefaut(sessions, preferredSessionId, annees);
  const transferee = estSessionTransferee(session);
  const [notes, deliberations, examenCommun]: [NoteApi[], DeliberationApi[], ExamenCommunVue | null] = session
    ? await Promise.all([
      lire<NoteApi>(`/api/notes?sessionId=${session.id}`),
      // Délibérations du jury (observation, signature) : absentes sur une ancienne API.
      lire<DeliberationApi>(`/api/deliberations?sessionId=${session.id}`).catch(() => [] as DeliberationApi[]),
      // Session issue d'un transfert : rang et extrêmes de l'examen commun figés par le centre.
      transferee ? loadExamenCommun(session.id).catch(() => null) : Promise.resolve(null),
    ])
    : [[], [], null];
  const statsCommunes = statsExamenCommunParEleve(examenCommun);
  // Année scolaire de la session chargée (imprimée sur le bulletin) ; à défaut l'année courante.
  const annee = annees.find((item) => item.id === session?.anneeScolaireId)
    || annees.find((item) => item.courante)
    || annees[0];
  const centre = centres.find((item) => item.id === session?.centreId) || centres[0];
  const sessionMode: ModeSession = session?.mode ?? MODE_SESSION_DEFAUT;
  const inter = estSessionInter(sessionMode);
  const centreExamen = inter ? (session?.centreExamen || '').trim() : '';
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

  const roster = filtrerRoster(eleves, session?.id ?? null, options, sessionsSoeurs(session, sessions), transferee);

  const candidates: Candidate[] = roster.map((eleve) => {
    const classe = classes.find((item) => item.id === eleve.classeId);
    const grades: Candidate['grades'] = {};
    notes.filter((note) => note.eleveId === eleve.id && !note.absent && note.valeur != null).forEach((note) => {
      // Texte libre de l'enseignant ; vide = appréciation automatique selon la note (utils/appreciation.ts).
      grades[String(note.matiereId)] = { score: Number(note.valeur), appreciation: note.appreciation ?? '' };
    });
    const candidate: Candidate = {
      id: String(eleve.id),
      tableNumber: eleve.numeroTable || 0,
      matricule: eleve.matricule,
      fullName: eleve.nomComplet,
      dob: eleve.dateNaissance || '',
      birthPlace: eleve.lieuNaissance || '',
      // En inter-établissements, un candidat sans origine saisie est un élève du centre d'examen.
      originSchool: eleve.etablissementOrigine || (inter ? centreExamen : ''),
      gender: eleve.genre === 'M' ? 'M' : 'F',
      // La classe porte le code du référentiel (« D », « G2 ») ; le bulletin attend « Série D ».
      // Au collège (6e–3e) il n'y a pas de série, même si la session en porte une.
      serie: classe?.serie ? `Série ${classe.serie}` : (classe && estCollege(classe.niveau) ? '' : session?.serie || ''),
      serieLibelle: libelleSerie(classe, series),
      niveau: classe?.niveau || '',
      classeNom: classe?.nom || '',
      classeId: String(eleve.classeId),
      // Titulaire de la classe de l'élève (« 3e → M. X ») : c'est lui qui vise le bulletin.
      titulaire: titulaireDeClasse(classe, profs),
      sessionId: eleve.sessionId ?? null,
      examCenter: centre?.code || '',
      // Inter-établissements : le centre d'examen est l'établissement hôte, pas un centre saisi à part.
      examCenterName: inter && centreExamen ? centreExamen : (centre ? `${centre.nom}${centre.ville ? ` (${centre.ville})` : ''}` : ''),
      parentPhone: '',
      parentEmail: '',
      grades,
      coefs: coefsPourClasse(eleve.classeId),
      generalObservation: '',
    };
    const commun = statsCommunes[String(eleve.id)];
    if (commun) candidate.examenCommun = commun;
    return appliquerDeliberation(candidate, deliberations.find((item) => item.eleveId === eleve.id));
  });

  return {
    sessionId: session?.id ?? null,
    classeId: classes[0]?.id ?? null,
    sessions: sessions.map((item) => ({ id: item.id, label: item.nom, mode: item.mode ?? MODE_SESSION_DEFAUT })),
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
    sessionMode,
    centreExamen,
    transfertCentre: transferee ? (session?.transfertCentre || examenCommun?.centre || '').trim() : '',
    totalCoef: subjects.reduce((sum, subject) => sum + subject.coef, 0),
    coefficientsCount: coefficients.length,
  };
}
