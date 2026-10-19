import type { AppSettings } from '../types';
import { ligneTitreBulletin } from './bulletinEntete';
import { ministryMark } from './bulletinHeader';
import { ligneCentreExamen } from './sessionMode';

/**
 * Sources de l'en-tête commun des documents imprimés en paysage (liste des candidats, feuille
 * d'émargement, bilan des archives). Tout vient des paramètres enregistrés de l'établissement et de
 * la session chargée : aucun texte fictif n'est jamais substitué, un champ vide est simplement omis.
 */
export interface SourcesEnTeteDocument {
  /** Titre du document (« Liste des candidats », « Feuille d'émargement »…). */
  titre: string;
  settings: Pick<
    AppSettings,
    'institutionName' | 'institutionMotto' | 'logoUrl' | 'countryName' | 'motto' | 'ministryName' | 'ministrySigle' | 'regionalAuthority' | 'academicYear'
  >;
  /** Session inter-établissements : ni logo ni devise, « CENTRE D'EXAMEN : … » à la place du nom. */
  sessionInter?: boolean;
  /** Nom du centre d'examen (établissement hôte) ; à défaut le nom de l'établissement. */
  centreExamen?: string | null;
  /** Libellé du type d'examen de la session (« BEPC blanc », libellé long de préférence). */
  typeExamen?: string | null;
  /** Intitulé de la session (« Examen blanc n°1 »). */
  sessionNom?: string | null;
  /** Année scolaire ; à défaut `settings.academicYear`. */
  anneeScolaire?: string | null;
}

export interface EnTeteDocumentCompose {
  /** Logo à afficher dans la colonne de gauche ; null en inter-établissements ou sans logo enregistré. */
  logoUrl: string | null;
  /** Nom de l'établissement ou « CENTRE D'EXAMEN : … » en inter-établissements (toujours en majuscules). */
  nomEtablissement: string;
  /** Devise propre de l'établissement ; vide en inter-établissements. */
  devise: string;
  republique: string;
  deviseNationale: string;
  ministere: string;
  /** Sigle du ministère entre parenthèses (« (MEPST) ») ou vide. */
  sigleMinistere: string;
  autoriteRegionale: string;
  titre: string;
  /** « BEPC BLANC — EXAMEN BLANC N°1 » (type d'examen puis intitulé de session) ; vide sans information. */
  sousTitre: string;
  anneeScolaire: string;
  /** Pied de page : « NOM DE L'ÉTABLISSEMENT • Titre du document ». */
  piedDePage: string;
}

const propre = (valeur: string | null | undefined): string => (valeur ?? '').replace(/\s+/g, ' ').trim();

/** Date d'édition en toutes lettres (« 19 octobre 2026 »). */
export function dateEditionDocument(date: Date = new Date()): string {
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

/** Compose l'en-tête commun : seules les informations enregistrées apparaissent. */
export function composerEnTeteDocument(sources: SourcesEnTeteDocument): EnTeteDocumentCompose {
  const { settings } = sources;
  const inter = Boolean(sources.sessionInter);
  const nomEtab = propre(settings.institutionName);
  const centre = propre(sources.centreExamen) || nomEtab;
  const nomEtablissement = inter ? ligneCentreExamen(centre) : nomEtab.toLocaleUpperCase('fr-FR');
  const logo = propre(settings.logoUrl);
  const titre = propre(sources.titre);
  const piedNom = inter ? centre.toLocaleUpperCase('fr-FR') : nomEtab.toLocaleUpperCase('fr-FR');

  return {
    logoUrl: inter || !logo ? null : logo,
    nomEtablissement,
    devise: inter ? '' : propre(settings.institutionMotto),
    republique: propre(settings.countryName).toLocaleUpperCase('fr-FR'),
    deviseNationale: propre(settings.motto),
    ministere: propre(settings.ministryName).toLocaleUpperCase('fr-FR'),
    sigleMinistere: propre(settings.ministryName) ? ministryMark({ ministryName: settings.ministryName, ministrySigle: settings.ministrySigle }) : '',
    autoriteRegionale: propre(settings.regionalAuthority),
    titre,
    sousTitre: ligneTitreBulletin({ typeExamenLibelle: sources.typeExamen, sessionNom: sources.sessionNom }),
    anneeScolaire: propre(sources.anneeScolaire) || propre(settings.academicYear),
    piedDePage: [piedNom, titre].filter(Boolean).join(' • '),
  };
}
