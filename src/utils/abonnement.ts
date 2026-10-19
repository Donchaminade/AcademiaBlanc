/**
 * Abonnements : types miroir de l'API (`GET /api/abonnement/statut`, `/api/plateforme/abonnements/**`) et
 * fonctions pures d'affichage (badge, libellés, montants, liens WhatsApp / appel, export CSV).
 *
 * Le serveur est seul juge du verrouillage : `joursRestants`, `lectureSeule`, `acces` et `enGrace` viennent de lui,
 * calculés en UTC ; rien ici ne consulte l'horloge du navigateur pour décider d'un état.
 */

export type StatutAbonnement = 'EN_ATTENTE_PAIEMENT' | 'ESSAI' | 'ACTIF' | 'EXPIRE' | 'SUSPENDU';
export type Forfait = 'MENSUEL' | 'ANNUEL';
export type TypeEvenementAbonnement =
  | 'ESSAI' | 'ACTIVATION' | 'PROLONGATION' | 'SUSPENSION' | 'REACTIVATION' | 'DECLARATION_PAIEMENT' | 'EXPIRATION';

export interface ContactsAbonnement {
  telWhatsapp: string;
  telAppel: string;
  beneficiaire: string;
  instructions: string;
  tarifMensuel: number;
  tarifAnnuel: number;
  devise: string;
}

export interface EtatAbonnement {
  etablissementId: number | null;
  statut: StatutAbonnement;
  statutLibelle: string;
  forfait: Forfait | null;
  forfaitChoisi: Forfait | null;
  debut: string | null;
  fin: string | null;
  echeance: string | null;
  essaiJusquAu: string | null;
  joursRestants: number | null;
  enGrace: boolean;
  lectureSeule: boolean;
  acces: boolean;
  essai: boolean;
  /** Compte de niveau plateforme : jamais de badge ni de verrou. */
  plateforme: boolean;
  message: string | null;
  contacts: ContactsAbonnement;
  maintenant: string;
}

export interface EvenementAbonnement {
  id: number;
  etablissementId: number;
  etablissementNom?: string;
  type: TypeEvenementAbonnement;
  typeLibelle: string;
  forfait?: Forfait | null;
  montant?: number | null;
  reference?: string | null;
  operateurMobile?: string | null;
  periodeDebut?: string | null;
  periodeFin?: string | null;
  acteur?: string | null;
  note?: string | null;
  statut?: string | null;
  datePaiement?: string | null;
  creeLe: string;
}

export interface OffrePublique {
  tarifMensuel: number;
  tarifAnnuel: number;
  devise: string;
  telWhatsapp: string;
  telAppel: string;
  beneficiaire: string;
  instructions: string;
  dureeEssaiJours: number;
}

export const OPERATEURS_MOBILE = ['Flooz', 'T-Money', 'Mixx by Yas', 'Orange Money', 'MTN MoMo', 'Wave', 'Autre'] as const;
export type OperateurMobile = (typeof OPERATEURS_MOBILE)[number];

export const FORFAIT_LABELS: Record<Forfait, string> = { MENSUEL: 'Mensuel', ANNUEL: 'Annuel' };

export const STATUT_LABELS: Record<StatutAbonnement, string> = {
  EN_ATTENTE_PAIEMENT: 'En attente de paiement',
  ESSAI: 'Essai',
  ACTIF: 'Actif',
  EXPIRE: 'Expiré',
  SUSPENDU: 'Suspendu',
};

export const TYPE_EVENEMENT_LABELS: Record<TypeEvenementAbonnement, string> = {
  ESSAI: 'Mode essai',
  ACTIVATION: 'Activation',
  PROLONGATION: 'Prolongation',
  SUSPENSION: 'Suspension',
  REACTIVATION: 'Réactivation',
  DECLARATION_PAIEMENT: 'Déclaration de paiement',
  EXPIRATION: 'Expiration',
};

/** Dernier seuil : badge rouge à J-3 et en dessous. */
export const SEUIL_ROUGE_JOURS = 3;
/** Abonnement actif : badge orange à partir de J-7. */
export const SEUIL_ORANGE_JOURS = 7;

export type TonBadge = 'vert' | 'orange' | 'rouge' | 'neutre';

export interface BadgeAbonnement {
  /** Texte complet (en-tête bureau). */
  libelle: string;
  /** Texte court (en-tête mobile 360 px). */
  court: string;
  ton: TonBadge;
  /** Infobulle. */
  titre: string;
}

/** Date `JJ/MM/AAAA` d'un instant ISO, lue en UTC (comme le serveur) ; vide si absente. */
export function formatDateFr(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const jj = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${jj}/${mm}/${date.getUTCFullYear()}`;
}

/** Date et heure `JJ/MM/AAAA HH:MM` (UTC). */
export function formatDateHeureFr(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mn = String(date.getUTCMinutes()).padStart(2, '0');
  return `${formatDateFr(iso)} ${hh}:${mn} UTC`;
}

/** `15 000 FCFA` (espace insécable fine entre les milliers). */
export function formatFcfa(montant: number | null | undefined, devise = 'FCFA'): string {
  const valeur = Math.max(0, Math.round(Number(montant) || 0));
  const texte = valeur.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
  return `${texte}\u00a0${devise}`;
}

/** Tarif saisi par le super admin, ou « Tarif à confirmer » tant qu'il vaut 0. */
export function tarifAffiche(montant: number | null | undefined, devise = 'FCFA'): string {
  return montant && montant > 0 ? formatFcfa(montant, devise) : 'Tarif à confirmer';
}

/** Tarif du forfait d'après les contacts / l'offre ; 0 si non saisi. */
export function tarifDuForfait(forfait: Forfait | null | undefined, offre: Pick<ContactsAbonnement, 'tarifMensuel' | 'tarifAnnuel'>): number {
  if (forfait === 'MENSUEL') return offre.tarifMensuel || 0;
  if (forfait === 'ANNUEL') return offre.tarifAnnuel || 0;
  return 0;
}

/**
 * Badge d'en-tête selon l'état renvoyé par le serveur. `null` pour un compte plateforme.
 * Essai : « Essai — J-12 », vert puis rouge les 3 derniers jours. Actif : « Abonnement jusqu'au 22/11/2026 »,
 * discret, orange à J-7, rouge à J-3. Expiré / suspendu : rouge. En attente : orange.
 */
export function badgeAbonnement(etat: EtatAbonnement | null | undefined): BadgeAbonnement | null {
  if (!etat || etat.plateforme) return null;
  const jours = etat.joursRestants ?? 0;
  const echeance = formatDateFr(etat.echeance);
  switch (etat.statut) {
    case 'ESSAI': {
      const j = Math.max(0, jours);
      return {
        libelle: `Essai — J-${j}`,
        court: `Essai J-${j}`,
        ton: j <= SEUIL_ROUGE_JOURS ? 'rouge' : 'vert',
        titre: `Période d'essai : ${j} jour${j > 1 ? 's' : ''} restant${j > 1 ? 's' : ''}${echeance ? ` (jusqu'au ${echeance})` : ''}. Cliquez pour voir votre abonnement.`,
      };
    }
    case 'ACTIF': {
      const ton: TonBadge = jours <= SEUIL_ROUGE_JOURS ? 'rouge' : jours <= SEUIL_ORANGE_JOURS ? 'orange' : 'neutre';
      const grace = etat.enGrace ? ' — période de grâce' : '';
      return {
        libelle: `Abonnement jusqu'au ${echeance}${grace}`,
        court: `Jusqu'au ${echeance}`,
        ton,
        titre: `Abonnement ${etat.forfait ? FORFAIT_LABELS[etat.forfait].toLowerCase() : ''} actif, ${jours} jour${jours > 1 ? 's' : ''} restant${jours > 1 ? 's' : ''}${grace}. Cliquez pour voir votre abonnement.`,
      };
    }
    case 'EXPIRE':
      return { libelle: 'Abonnement expiré — lecture seule', court: 'Expiré', ton: 'rouge', titre: 'Abonnement expiré : réglez pour réactiver l\'écriture et l\'impression.' };
    case 'SUSPENDU':
      return { libelle: 'Abonnement suspendu — lecture seule', court: 'Suspendu', ton: 'rouge', titre: 'Abonnement suspendu par la plateforme : contactez-nous.' };
    case 'EN_ATTENTE_PAIEMENT':
    default:
      return { libelle: 'En attente de paiement', court: 'En attente', ton: 'orange', titre: 'Compte en attente d\'activation.' };
  }
}

/** Phrase du bandeau rouge persistant quand l'espace est en lecture seule ; `null` sinon. */
export function messageVerrou(etat: EtatAbonnement | null | undefined): string | null {
  if (!etat || !etat.lectureSeule || etat.plateforme) return null;
  if (etat.statut === 'SUSPENDU') return 'Abonnement suspendu — contactez la plateforme pour le réactiver.';
  if (etat.statut === 'EN_ATTENTE_PAIEMENT') return 'Compte en attente d\'activation — réglez le forfait choisi puis déclarez le paiement.';
  return 'Abonnement expiré — réglez pour réactiver.';
}

export const MOTIF_IMPRESSION_VERROUILLEE =
  'Impression et téléchargement désactivés : abonnement expiré ou suspendu. Réglez votre abonnement pour les réactiver.';

/** Message WhatsApp pré-rempli : nom de l'établissement, forfait et montant. */
export function messageWhatsApp(params: { nomEtablissement: string; forfait: Forfait | null | undefined; montant: number; devise?: string }): string {
  const forfait = params.forfait ? FORFAIT_LABELS[params.forfait].toLowerCase() : 'à préciser';
  const montant = params.montant > 0 ? formatFcfa(params.montant, params.devise) : 'montant à confirmer';
  return `Bonjour, je suis ${params.nomEtablissement.trim()} (AcademiaBlanc). Je souhaite activer l'abonnement ${forfait} (${montant}). Merci de m'indiquer la marche à suivre pour le paiement mobile money.`;
}

/** Chiffres seuls d'un numéro (« +228 90 00 00 00 » → « 22890000000 ») ; vide si aucun chiffre. */
export function chiffresNumero(numero: string | null | undefined): string {
  return (numero ?? '').replace(/\D+/g, '');
}

/** Lien `https://wa.me/<numéro>?text=…` ; `null` sans numéro exploitable. */
export function lienWhatsApp(numero: string | null | undefined, message: string): string | null {
  const chiffres = chiffresNumero(numero);
  if (chiffres.length < 8) return null;
  return `https://wa.me/${chiffres}?text=${encodeURIComponent(message)}`;
}

/** Lien `tel:+22870000000` ; `null` sans numéro exploitable. */
export function lienTel(numero: string | null | undefined): string | null {
  const brut = (numero ?? '').trim();
  const chiffres = chiffresNumero(brut);
  if (chiffres.length < 8) return null;
  return `tel:${brut.startsWith('+') ? '+' : ''}${chiffres}`;
}

const cellule = (valeur: string | number | null | undefined): string => {
  const texte = valeur == null ? '' : String(valeur);
  return /[;"\n]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte;
};

/** Export CSV (séparateur « ; », BOM UTF-8) de l'historique des paiements / activations / essais. */
export function csvPaiements(evenements: readonly EvenementAbonnement[]): string {
  const entete = ['Date', 'Établissement', 'Type', 'Forfait', 'Montant (FCFA)', 'Référence', 'Opérateur mobile', 'Période du', 'Période au', 'Statut', 'Acteur', 'Note'];
  const lignes = evenements.map((ev) => [
    formatDateHeureFr(ev.creeLe),
    ev.etablissementNom ?? '',
    TYPE_EVENEMENT_LABELS[ev.type] ?? ev.typeLibelle ?? ev.type,
    ev.forfait ? FORFAIT_LABELS[ev.forfait] : '',
    ev.montant ?? '',
    ev.reference ?? '',
    ev.operateurMobile ?? '',
    formatDateFr(ev.periodeDebut),
    formatDateFr(ev.periodeFin),
    ev.statut === 'A_VERIFIER' ? 'À vérifier' : ev.statut === 'TRAITEE' ? 'Traitée' : '',
    ev.acteur ?? '',
    ev.note ?? '',
  ].map(cellule).join(';'));
  return `\uFEFF${[entete.join(';'), ...lignes].join('\n')}`;
}

/** Libellé lisible du statut d'une déclaration. */
export function libelleStatutDeclaration(statut: string | null | undefined): string {
  if (statut === 'A_VERIFIER') return 'À vérifier';
  if (statut === 'TRAITEE') return 'Traitée';
  return '';
}
