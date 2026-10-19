import { apiGet, apiSend } from './client';
import type { Candidate } from '../types';

/**
 * Transfert des données d'examen blanc entre établissements (`/api/transferts`).
 *
 * Le centre d'examen d'une session inter-établissements envoie à chaque établissement d'origine un paquet
 * figé (élèves, programme, notes, statistiques de l'examen commun) identifié par le code de transfert
 * personnel du destinataire. Le destinataire accepte (une session interne est recréée chez lui) ou refuse.
 */

export type StatutTransfert = 'EN_ATTENTE' | 'ACCEPTE' | 'REFUSE' | 'ANNULE';

export interface DestinataireTransfert {
  nom: string;
  ville: string | null;
}

export interface DernierEnvoi {
  id: number;
  statut: StatutTransfert;
  envoyeLe: string;
  traiteLe: string | null;
  destinataireNom: string | null;
  motifRefus: string | null;
}

/** Établissement d'origine présent dans la session du centre (`GET /api/transferts/origines`). */
export interface OrigineTransfert {
  etablissementOrigine: string;
  effectif: number;
  notesSaisies: number;
  dernierEnvoi: DernierEnvoi | null;
}

/** Fiche d'un transfert, telle que la voient le centre et le destinataire (jamais le code utilisé). */
export interface TransfertVue {
  id: number;
  statut: StatutTransfert;
  envoyeLe: string;
  traiteLe: string | null;
  motifRefus: string | null;
  etablissementOrigine: string;
  effectif: number;
  typeExamen: string | null;
  sessionNom: string;
  anneeLibelle: string | null;
  sessionSourceId: number | null;
  sessionCreeeId: number | null;
  sourceNom: string;
  sourceVille: string | null;
  destinationNom: string;
  destinationVille: string | null;
  envoyeParNom: string | null;
  traiteParNom: string | null;
}

export interface PaquetMatiere { id: number; nom: string; code: string | null; groupeCode: string | null }
export interface PaquetStatMatiere { matiereId: number; nom: string; effectif: number; noteMax: number | null; noteMin: number | null }
export interface PaquetGroupe {
  cle: string; niveau: string | null; serie: string | null; effectif: number; effectifNotes: number;
  moyenneGroupe: number | null; moyenneMax: number | null; moyenneMin: number | null; matieres: PaquetStatMatiere[];
}
export interface PaquetLigne {
  matiereId: number; coefficient: number; note: number | null; absent: boolean; nonNotee: boolean;
  appreciation: string | null; rang: number | null; noteMax: number | null; noteMin: number | null;
}
export interface PaquetStat {
  moyenne: number | null; rang: number | null; effectifGroupe: number | null; moyenneGroupe: number | null;
  moyenneMax: number | null; moyenneMin: number | null; mention: string | null; decision: string | null;
}
export interface PaquetEleve {
  id: number; nomComplet: string; genre: string; dateNaissance: string | null; lieuNaissance: string | null;
  niveau: string | null; serie: string | null; classeNom: string | null; numeroTable: number | null; groupe: string;
  lignes: PaquetLigne[]; stat: PaquetStat | null;
}
/** Instantané figé des données transférées (`transfert_examen.paquet`). */
export interface PaquetTransfert {
  version: number;
  genereLe: string;
  centreNom: string;
  centreVille: string | null;
  sessionNom: string;
  typeExamenCode: string | null;
  typeExamenLibelle: string | null;
  typeExamenLibelleLong: string | null;
  anneeLibelle: string | null;
  etablissementOrigine: string;
  matieres: PaquetMatiere[];
  groupes: PaquetGroupe[];
  eleves: PaquetEleve[];
}

export interface DetailTransfert { transfert: TransfertVue; paquet: PaquetTransfert }

/** Statistiques de l'examen commun d'une session issue d'un transfert (`GET /api/transferts/examen-commun`). */
export interface StatMatiereExamenCommun { matiereId: number; rang: number | null; noteMax: number | null; noteMin: number | null }
export interface StatEleveExamenCommun {
  eleveId: number; moyenne: number | null; rang: number | null; effectifGroupe: number | null; moyenneGroupe: number | null;
  moyenneMaxGroupe: number | null; moyenneMinGroupe: number | null; mention: string | null; decision: string | null;
  matieres: StatMatiereExamenCommun[];
}
export interface ExamenCommunVue {
  sessionId: number; transfertId: number; centre: string; centreVille: string | null; sessionSource: string;
  anneeSource: string | null; eleves: StatEleveExamenCommun[];
}

// ----- Lectures -----

/** Résout un code en destinataire (nom et ville seulement). 404 si aucun établissement actif ne correspond. */
export function resoudreDestinataire(code: string): Promise<DestinataireTransfert> {
  return apiGet<DestinataireTransfert>(`/api/transferts/destinataire?code=${encodeURIComponent(code.trim())}`);
}

export function loadOrigines(sessionId: number): Promise<OrigineTransfert[]> {
  return apiGet<OrigineTransfert[]>(`/api/transferts/origines?sessionId=${sessionId}`);
}

/** Envois du centre (toutes sessions, ou une session). */
export function loadEnvois(sessionId?: number | null): Promise<TransfertVue[]> {
  return apiGet<TransfertVue[]>(sessionId == null ? '/api/transferts/envois' : `/api/transferts/envois?sessionId=${sessionId}`);
}

export function loadRecus(): Promise<TransfertVue[]> {
  return apiGet<TransfertVue[]>('/api/transferts/recus');
}

export async function compterRecusEnAttente(): Promise<number> {
  const reponse = await apiGet<{ enAttente: number }>('/api/transferts/recus/en-attente');
  return Number(reponse?.enAttente ?? 0);
}

export function loadDetail(id: number): Promise<DetailTransfert> {
  return apiGet<DetailTransfert>(`/api/transferts/${id}`);
}

export function loadExamenCommun(sessionId: number): Promise<ExamenCommunVue> {
  return apiGet<ExamenCommunVue>(`/api/transferts/examen-commun?sessionId=${sessionId}`);
}

// ----- Écritures -----

export function envoyerTransfert(sessionId: number, etablissementOrigine: string, code: string): Promise<TransfertVue> {
  return apiSend<TransfertVue>('/api/transferts/envoyer', 'POST', { sessionId, etablissementOrigine, code: code.trim() });
}

export function annulerTransfert(id: number): Promise<TransfertVue> {
  return apiSend<TransfertVue>(`/api/transferts/${id}/annuler`, 'POST', {});
}

export function accepterTransfert(id: number): Promise<TransfertVue> {
  return apiSend<TransfertVue>(`/api/transferts/${id}/accepter`, 'POST', {});
}

export function refuserTransfert(id: number, motif: string): Promise<TransfertVue> {
  const propre = motif.trim();
  return apiSend<TransfertVue>(`/api/transferts/${id}/refuser`, 'POST', propre ? { motif: propre } : {});
}

// ----- Logique pure (testée sans réseau) -----

export const STATUT_LABELS: Record<StatutTransfert, string> = {
  EN_ATTENTE: 'En attente',
  ACCEPTE: 'Accepté',
  REFUSE: 'Refusé',
  ANNULE: 'Annulé',
};

export function libelleStatut(statut: StatutTransfert | string | null | undefined): string {
  return (statut && STATUT_LABELS[statut as StatutTransfert]) || (statut ?? '—');
}

/** Alphabet du code (sans 0, O, 1, I, L) et longueur utile : miroir de `CodeTransfertService`. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LONGUEUR = 8;

/**
 * Met en forme la saisie d'un code : majuscules, caractères hors alphabet retirés, tiret au milieu
 * (« k7f3 9qzt » → « K7F3-9QZT »). Renvoie null si le nombre de caractères utiles n'est pas 8.
 */
export function normaliserCode(saisie: string): string | null {
  const brut = (saisie || '').toUpperCase().split('').filter((c) => CODE_ALPHABET.includes(c)).join('');
  if (brut.length !== CODE_LONGUEUR) return null;
  return `${brut.slice(0, 4)}-${brut.slice(4)}`;
}

/** Masque un code pour l'affichage (« K7F3-9QZT » → « ••••-••••»). */
export function masquerCode(code: string): string {
  return code.replace(/[^-]/g, '•');
}

/** Clé de regroupement d'un nom d'établissement : accents, casse et espaces multiples ignorés. */
export function cleOrigine(nom: string | null | undefined): string {
  return (nom || '').normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim().toUpperCase();
}

export interface GroupeOrigine {
  etablissementOrigine: string;
  effectif: number;
  notesSaisies: number;
  candidats: Candidate[];
}

/**
 * Regroupe les candidats d'une session inter-établissements par établissement d'origine, le centre
 * d'examen exclu (ses propres élèves ne se transfèrent pas) ainsi que les candidats sans origine.
 * Même règle que `TransfertExamenService.candidatsParOrigine` côté API ; ordre alphabétique.
 */
export function regrouperParOrigine(candidats: readonly Candidate[], centreExamen: string): GroupeOrigine[] {
  const cleCentre = cleOrigine(centreExamen);
  const groupes = new Map<string, GroupeOrigine>();
  for (const candidat of candidats) {
    const cle = cleOrigine(candidat.originSchool);
    if (!cle || cle === cleCentre) continue;
    let groupe = groupes.get(cle);
    if (!groupe) {
      groupe = { etablissementOrigine: candidat.originSchool.trim().replace(/\s+/g, ' '), effectif: 0, notesSaisies: 0, candidats: [] };
      groupes.set(cle, groupe);
    }
    groupe.effectif += 1;
    groupe.notesSaisies += Object.values(candidat.grades).filter((g) => typeof g?.score === 'number' && !Number.isNaN(g.score)).length;
    groupe.candidats.push(candidat);
  }
  return [...groupes.values()].sort((a, b) => a.etablissementOrigine.localeCompare(b.etablissementOrigine, 'fr', { sensitivity: 'base' }));
}

export interface RecapitulatifEnvoi {
  session: string;
  origine: string;
  effectif: number;
  destinataire: string;
  /** Lignes prêtes à afficher dans la confirmation. */
  lignes: string[];
}

/** Récapitulatif affiché avant l'envoi : session, origine, effectif et destinataire résolu. */
export function recapitulatifEnvoi(
  session: string,
  origine: Pick<OrigineTransfert, 'etablissementOrigine' | 'effectif' | 'notesSaisies'>,
  destinataire: DestinataireTransfert,
): RecapitulatifEnvoi {
  const destinataireLibelle = destinataire.ville ? `${destinataire.nom} (${destinataire.ville})` : destinataire.nom;
  return {
    session,
    origine: origine.etablissementOrigine,
    effectif: origine.effectif,
    destinataire: destinataireLibelle,
    lignes: [
      `Session : ${session}`,
      `Établissement d’origine : ${origine.etablissementOrigine}`,
      `Effectif : ${origine.effectif} élève${origine.effectif > 1 ? 's' : ''} · ${origine.notesSaisies} note${origine.notesSaisies > 1 ? 's' : ''}`,
      `Destinataire : ${destinataireLibelle}`,
    ],
  };
}

/** Date et heure courtes en français ; « — » si absente ou invalide. */
export function dateCourte(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const champCsv = (valeur: string | number | null | undefined): string => {
  const texte = valeur == null ? '' : String(valeur);
  return /[";\n\r]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte;
};

/**
 * Historique des envois du centre en CSV (séparateur « ; », compatible Excel français) :
 * destinataire, origine, effectif, session, date d'envoi, statut, traitement, motif.
 */
export function csvHistorique(transferts: readonly TransfertVue[]): string {
  const entete = ['Destinataire', 'Ville', 'Établissement d’origine', 'Effectif', 'Session', 'Année', 'Envoyé le', 'Statut', 'Traité le', 'Traité par', 'Motif du refus'];
  const lignes = transferts.map((t) => [
    t.destinationNom, t.destinationVille, t.etablissementOrigine, t.effectif, t.sessionNom, t.anneeLibelle,
    dateCourte(t.envoyeLe), libelleStatut(t.statut), dateCourte(t.traiteLe), t.traiteParNom, t.motifRefus,
  ].map(champCsv).join(';'));
  return `\uFEFF${[entete.map(champCsv).join(';'), ...lignes].join('\r\n')}`;
}

/** Compte les transferts par statut (badges de l'écran). */
export function compterParStatut(transferts: readonly Pick<TransfertVue, 'statut'>[]): Record<StatutTransfert, number> {
  const compte: Record<StatutTransfert, number> = { EN_ATTENTE: 0, ACCEPTE: 0, REFUSE: 0, ANNULE: 0 };
  for (const t of transferts) if (t.statut in compte) compte[t.statut] += 1;
  return compte;
}
