import { apiGet, apiSend } from './client';
import type { MeResponse } from './client';
import type { EnTeteEtablissement } from '../utils/prereglages';

/** Fiche de l'établissement du jeton (`GET /api/etablissement`). */
export interface ProfilEtablissement {
  id: number;
  nom: string;
  code: string;
  typeEtablissement: string | null;
  ville: string;
  region: string | null;
  adresse: string | null;
  telephone: string | null;
  email: string;
  nomResponsable: string;
  devise: string | null;
  actif: boolean;
  /** ISO 8601 ; null pour un établissement créé avant l'ajout de cette date. */
  creeLe: string | null;
  /** En-tête officiel du bulletin (république, devise nationale, ministère, sigle…). */
  enTete: EnTeteEtablissement;
}

/** Champs modifiables (`PUT /api/etablissement`) : le code, l'état et la date de création sont fixés par la plateforme. */
export type ModificationProfil = Pick<
  ProfilEtablissement,
  'nom' | 'typeEtablissement' | 'ville' | 'region' | 'adresse' | 'telephone' | 'email' | 'nomResponsable' | 'devise'
>;

export const CHAMPS_MODIFIABLES: (keyof ModificationProfil)[] = [
  'nom', 'typeEtablissement', 'ville', 'region', 'adresse', 'telephone', 'email', 'nomResponsable', 'devise',
];

/** Effectifs réels de l'établissement (`GET /api/etablissement/statistiques`). */
export interface StatistiquesEtablissement {
  utilisateurs: number;
  classes: number;
  eleves: number;
  professeurs: number;
  sessions: number;
  archives: number;
}

export function loadProfil(): Promise<ProfilEtablissement> {
  return apiGet<ProfilEtablissement>('/api/etablissement');
}

export function saveProfil(modification: ModificationProfil): Promise<ProfilEtablissement> {
  return apiSend<ProfilEtablissement>('/api/etablissement', 'PUT', modification);
}

export function loadStatistiques(): Promise<StatistiquesEtablissement> {
  return apiGet<StatistiquesEtablissement>('/api/etablissement/statistiques');
}

export function loadMonCompte(): Promise<MeResponse> {
  return apiGet<MeResponse>('/api/auth/me');
}

/** Change le mot de passe du compte courant ; 400 si l'ancien est faux (message du serveur). */
export function changerMotDePasse(ancienMotDePasse: string, nouveauMotDePasse: string): Promise<void> {
  return apiSend<void>('/api/auth/mot-de-passe', 'PUT', { ancienMotDePasse, nouveauMotDePasse });
}

/** Extrait les champs modifiables d'une fiche, les valeurs nulles devenant des chaînes vides pour le formulaire. */
export function versFormulaire(profil: ProfilEtablissement): Record<keyof ModificationProfil, string> {
  const form = {} as Record<keyof ModificationProfil, string>;
  for (const champ of CHAMPS_MODIFIABLES) form[champ] = profil[champ] ?? '';
  return form;
}

/** Convertit le formulaire en requête : les champs facultatifs vides sont envoyés à null. */
export function versModification(form: Record<keyof ModificationProfil, string>): ModificationProfil {
  const vide = (value: string) => (value.trim() === '' ? null : value.trim());
  return {
    nom: form.nom.trim(),
    ville: form.ville.trim(),
    email: form.email.trim(),
    nomResponsable: form.nomResponsable.trim(),
    typeEtablissement: vide(form.typeEtablissement),
    region: vide(form.region),
    adresse: vide(form.adresse),
    telephone: vide(form.telephone),
    devise: vide(form.devise),
  };
}
