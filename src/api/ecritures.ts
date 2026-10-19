import { apiDelete, apiSend } from './client';
import { saveCharte } from './charte';
import type { CharteEtablissement, ParametrePersiste } from './charte';
import type { ProfilEtablissement } from './etablissement';
import { saveEnTete } from './prereglages';
import { enTeteDepuisSettings } from '../utils/prereglages';
import { APPRECIATION_LONGUEUR_MAX, appreciationManuelleValide, normaliserAppreciationManuelle } from '../utils/appreciation';
import type { AppSettings, Candidate } from '../types';

/**
 * Écritures de l'espace de travail en session connectée. Chaque gestionnaire d'`App.tsx` qui modifie
 * des données passe par l'une de ces fonctions quand `usingApi` est vrai : aucune donnée n'est
 * considérée enregistrée tant que le serveur n'a pas répondu, et toute erreur remonte à l'appelant
 * sous forme de promesse rejetée (aucun repli local silencieux, aucune exception synchrone).
 * Le test `ecritures.test.ts` vérifie ces contrats.
 */

/** Élève tel que renvoyé par `PUT /api/eleves/{id}`. */
export interface EleveApi {
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

export interface NoteApi {
  id?: number;
  eleveId: number;
  matiereId: number;
  sessionId?: number;
  valeur?: number | null;
  absent: boolean;
  /** Texte libre de l'enseignant ; absent ou `null` = appréciation automatique selon la note. */
  appreciation?: string | null;
}

export interface SignatureApi {
  signeLe: string;
  signataire: string | null;
  empreinte: string | null;
}

/**
 * Délibération du jury pour un élève dans une session (`GET/PUT /api/deliberations`) : observation
 * portée sur le bulletin et signature électronique. Elle ne modifie jamais la moyenne, qui reste
 * la moyenne réelle Σ(note × coef) / Σ coef.
 */
export interface DeliberationApi {
  id?: number;
  eleveId: number;
  sessionId: number;
  observation: string | null;
  signature: SignatureApi | null;
}

/** Vrai pour un élève enregistré sur l'API (identifiant numérique) ; faux pour une fiche de démonstration. */
export function estEleveApi(candidateId: string): boolean {
  return candidateId.trim() !== '' && Number.isFinite(Number(candidateId));
}

function exigerEleveApi(candidate: Candidate): number {
  if (!estEleveApi(candidate.id)) {
    throw new Error(`Fiche « ${candidate.fullName} » absente de la base : rechargez la liste des élèves.`);
  }
  return Number(candidate.id);
}

/** Corps de `PUT /api/eleves/{id}` ; le matricule n'est jamais envoyé (attribué et figé par le serveur). */
export function versEleve(candidate: Candidate): Record<string, unknown> {
  const classeId = Number(candidate.classeId);
  if (!Number.isFinite(classeId) || classeId <= 0) {
    throw new Error(`Classe inconnue pour « ${candidate.fullName} » : rechargez la liste des élèves.`);
  }
  return {
    classeId,
    sessionId: candidate.sessionId ?? null,
    nomComplet: candidate.fullName.trim(),
    genre: candidate.gender,
    numeroTable: candidate.tableNumber || null,
    dateNaissance: candidate.dob || null,
    lieuNaissance: candidate.birthPlace || null,
    etablissementOrigine: candidate.originSchool || null,
  };
}

/** Inscrit un élève dans une classe (`POST /api/eleves`) ; le matricule est attribué par le serveur. */
export async function creerEleve(candidate: Candidate, classeId: number, sessionId: number | null): Promise<EleveApi> {
  if (!Number.isFinite(classeId) || classeId <= 0) {
    throw new Error('Créez d’abord une classe dans Administration (barre latérale).');
  }
  return apiSend<EleveApi>('/api/eleves', 'POST', {
    classeId,
    sessionId,
    nomComplet: candidate.fullName.trim(),
    genre: candidate.gender,
    numeroTable: candidate.tableNumber || null,
    dateNaissance: candidate.dob || null,
    lieuNaissance: candidate.birthPlace || null,
    etablissementOrigine: candidate.originSchool || null,
  });
}

/** Retire un élève de la base (`DELETE /api/eleves/{id}`). */
export async function supprimerEleve(candidateId: string): Promise<void> {
  if (!estEleveApi(candidateId)) {
    throw new Error('Fiche absente de la base : rechargez la liste des élèves.');
  }
  return apiDelete(`/api/eleves/${Number(candidateId)}`);
}

/** Modifie la fiche d'un élève (crayon de la liste des candidats). */
export async function sauvegarderEleve(candidate: Candidate): Promise<EleveApi> {
  const id = exigerEleveApi(candidate);
  return apiSend<EleveApi>(`/api/eleves/${id}`, 'PUT', versEleve(candidate));
}

/**
 * Renumérotation des tables : n'envoie que les élèves dont le numéro change, tous en parallèle.
 * Résout le nombre de fiches modifiées sur le serveur ; rejette dès qu'une écriture échoue.
 */
export async function renumeroterEleves(avant: Candidate[], apres: Candidate[]): Promise<number> {
  const numeroAvant = new Map(avant.map((c) => [c.id, c.tableNumber]));
  const modifies = apres.filter((c) => numeroAvant.get(c.id) !== c.tableNumber);
  await Promise.all(modifies.map((c) => sauvegarderEleve(c)));
  return modifies.length;
}

export interface NoteSaisie {
  candidateId: string;
  subjectId: string;
  sessionId: number | null;
  score: number;
}

/** Enregistre une note sur 20 (`POST /api/notes` crée ou remplace la note de l'élève pour la matière et la session). */
export async function sauvegarderNote(saisie: NoteSaisie): Promise<NoteApi> {
  if (!saisie.sessionId) {
    throw new Error('Aucune session chargée : créez ou sélectionnez une session avant de saisir des notes.');
  }
  if (!estEleveApi(saisie.candidateId) || !Number.isFinite(Number(saisie.subjectId))) {
    throw new Error('Élève ou matière absent de la base : rechargez la page.');
  }
  if (!Number.isFinite(saisie.score) || saisie.score < 0 || saisie.score > 20) {
    throw new Error('La note doit être comprise entre 0 et 20.');
  }
  return apiSend<NoteApi>('/api/notes', 'POST', {
    eleveId: Number(saisie.candidateId),
    matiereId: Number(saisie.subjectId),
    sessionId: saisie.sessionId,
    valeur: saisie.score,
    absent: false,
  });
}

export interface AppreciationSaisie extends NoteSaisie {
  /** Texte libre de l'enseignant ; vide = retour à l'appréciation automatique. */
  appreciation: string;
}

/**
 * Enregistre l'appréciation du professeur d'une note existante (`POST /api/notes` avec la note
 * actuelle et le champ `appreciation` : texte libre, ou chaîne vide pour rétablir l'automatique).
 */
export async function sauvegarderAppreciation(saisie: AppreciationSaisie): Promise<NoteApi> {
  if (!saisie.sessionId) {
    throw new Error('Aucune session chargée : créez ou sélectionnez une session avant de saisir des appréciations.');
  }
  if (!estEleveApi(saisie.candidateId) || !Number.isFinite(Number(saisie.subjectId))) {
    throw new Error('Élève ou matière absent de la base : rechargez la page.');
  }
  if (!Number.isFinite(saisie.score) || saisie.score < 0 || saisie.score > 20) {
    throw new Error('Saisissez d’abord une note sur 20 avant son appréciation.');
  }
  const appreciation = normaliserAppreciationManuelle(saisie.appreciation);
  if (!appreciationManuelleValide(appreciation)) {
    throw new Error(`L’appréciation ne doit pas dépasser ${APPRECIATION_LONGUEUR_MAX} caractères.`);
  }
  return apiSend<NoteApi>('/api/notes', 'POST', {
    eleveId: Number(saisie.candidateId),
    matiereId: Number(saisie.subjectId),
    sessionId: saisie.sessionId,
    valeur: saisie.score,
    absent: false,
    appreciation,
  });
}

/**
 * Date de signature au format ISO 8601 attendu par le serveur. La fenêtre de signature produit
 * « JJ-MM-AAAA HH:mm:ss » (heure locale) ; une valeur ISO est reprise telle quelle.
 */
export function versInstant(signedAt: string): string {
  const local = /^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2})$/.exec(signedAt.trim());
  if (local) {
    const [, jour, mois, annee, heure, minute, seconde] = local.map(Number);
    return new Date(annee, mois - 1, jour, heure, minute, seconde).toISOString();
  }
  const date = new Date(signedAt);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

/** Corps de `PUT /api/deliberations` à partir de l'état complet du candidat (observation, signature). */
export function versDeliberation(candidate: Candidate, sessionId: number): Omit<DeliberationApi, 'id'> {
  return {
    eleveId: Number(candidate.id),
    sessionId,
    observation: candidate.generalObservation?.trim() || null,
    signature: candidate.digitalSignature
      ? {
          signeLe: versInstant(candidate.digitalSignature.signedAt),
          signataire: candidate.digitalSignature.signer || null,
          empreinte: candidate.digitalSignature.shaHash || null,
        }
      : null,
  };
}

/** Enregistre l'observation du conseil et la signature du bulletin d'un élève. */
export async function sauvegarderDeliberation(candidate: Candidate, sessionId: number | null): Promise<DeliberationApi> {
  exigerEleveApi(candidate);
  if (!sessionId) {
    throw new Error('Aucune session chargée : la délibération ne peut pas être rattachée à une session.');
  }
  return apiSend<DeliberationApi>('/api/deliberations', 'PUT', versDeliberation(candidate, sessionId));
}

/** Reporte une délibération lue sur l'API dans la fiche du candidat. */
export function appliquerDeliberation(candidate: Candidate, vue: DeliberationApi | undefined): Candidate {
  if (!vue) return candidate;
  return {
    ...candidate,
    generalObservation: vue.observation ?? '',
    digitalSignature: vue.signature
      ? { signedAt: vue.signature.signeLe, signer: vue.signature.signataire ?? '', shaHash: vue.signature.empreinte ?? '' }
      : undefined,
  };
}

/** Enregistre la charte du bulletin (logo, sceau, signataires, numérotation, cachet et signatures) ; la réponse fait foi. */
export async function sauvegarderParametres(settings: Pick<AppSettings, ParametrePersiste>): Promise<CharteEtablissement> {
  return saveCharte(settings);
}

/** Enregistre l'en-tête officiel du bulletin (république, devise, ministère, sigle…) sur la fiche de l'établissement. */
export async function sauvegarderEnTete(settings: AppSettings): Promise<ProfilEtablissement> {
  return saveEnTete(enTeteDepuisSettings(settings));
}
