import { apiDelete, apiGet, apiSend, getSession } from './client';
import { ArchivedSession } from '../types';

/** Réponse de `GET /api/archives` : une session archivée de l'établissement, statistiques calculées sur ses notes. */
export interface ArchiveApi {
  sessionId: number;
  anneeScolaireId: number;
  anneeScolaire: string | null;
  sessionNom: string;
  typeExamen: string;
  serie: string | null;
  statut: string;
  archiveeLe: string | null;
  effectif: number;
  /** Élèves ayant au moins une note : dénominateur des taux. */
  classes: number;
  /** Admis : moyenne affichée ≥ 10/20 ; les autres élèves classés sont ajournés. */
  admis: number;
  tauxReussite: number;
  ajournes: number;
  tauxAjournes: number;
  moyennePromo: number | null;
  noteMax: number | null;
  noteMin: number | null;
  mentions: { tresBien: number; bien: number; assezBien: number; passable: number };
}

function dateFr(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('fr-FR');
}

/** Libellé « BAC Blanc 2025 - Série D » à partir du nom de session et de la série (si elle n'y figure pas déjà). */
function libelleSession(archive: ArchiveApi): string {
  const serie = archive.serie?.trim();
  if (!serie || archive.sessionNom.toLowerCase().includes(serie.toLowerCase())) return archive.sessionNom;
  return `${archive.sessionNom} - ${serie.toLowerCase().startsWith('série') ? serie : `Série ${serie}`}`;
}

/** Convertit une archive de l'API vers le modèle affiché par la vue Archives. */
export function toArchivedSession(archive: ArchiveApi): ArchivedSession {
  return {
    id: `api-${archive.sessionId}`,
    sessionId: archive.sessionId,
    schoolId: String(getSession()?.etablissementId ?? ''),
    academicYear: archive.anneeScolaire || '—',
    sessionName: libelleSession(archive),
    examType: archive.typeExamen,
    serie: archive.serie || undefined,
    statut: archive.statut,
    archivedAt: dateFr(archive.archiveeLe),
    candidatesCount: archive.effectif,
    classesCount: Number.isFinite(Number(archive.classes)) ? Number(archive.classes) : undefined,
    admittedCount: archive.admis,
    admittedRate: Number(archive.tauxReussite) || 0,
    failedCount: archive.ajournes,
    failedRate: Number(archive.tauxAjournes) || 0,
    promoAverage: archive.moyennePromo == null ? 0 : Number(archive.moyennePromo),
    highestAverage: archive.noteMax == null ? 0 : Number(archive.noteMax),
    lowestAverage: archive.noteMin == null ? 0 : Number(archive.noteMin),
    mentionsBreakdown: {
      tresBien: archive.mentions?.tresBien ?? 0,
      bien: archive.mentions?.bien ?? 0,
      assezBien: archive.mentions?.assezBien ?? 0,
      passable: archive.mentions?.passable ?? 0,
    },
  };
}

/** Sessions archivées de l'établissement connecté (vide tant qu'aucune session n'est clôturée). */
export async function loadArchives(): Promise<ArchivedSession[]> {
  const archives = await apiGet<ArchiveApi[]>('/api/archives');
  return archives.map(toArchivedSession);
}

/** Archive une session ouverte : elle rejoint le registre avec ses statistiques réelles. */
export async function archiverSession(sessionId: number): Promise<ArchivedSession> {
  const archive = await apiSend<ArchiveApi>(`/api/archives/${sessionId}`, 'POST', {});
  return toArchivedSession(archive);
}

/** Retire une session des archives : elle redevient ouverte, ses notes sont conservées. */
export function retirerArchive(sessionId: number): Promise<void> {
  return apiDelete(`/api/archives/${sessionId}`);
}
