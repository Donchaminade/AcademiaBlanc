import React, { useEffect, useMemo, useState } from 'react';
import { PLATFORM_ROLE, getSession, isPlatformAccount } from '../../api/client';
import { usePermissions } from '../../api/permissions';
import {
  activerAbonnement,
  demarrerEssai,
  enregistrerParametresCommerciaux,
  historiqueEtablissement,
  lireParametresCommerciaux,
  listerAbonnements,
  listerPaiements,
  reactiverAbonnement,
  suspendreAbonnement,
} from '../../api/abonnementsPlateforme';
import type { AbonnementEtablissement, PaiementsPlateforme, ParametresCommerciaux } from '../../api/abonnementsPlateforme';
import {
  FORFAIT_LABELS,
  OPERATEURS_MOBILE,
  STATUT_LABELS,
  csvPaiements,
  formatDateFr,
  formatFcfa,
  tarifAffiche,
  tarifDuForfait,
} from '../../utils/abonnement';
import type { EvenementAbonnement, Forfait, StatutAbonnement } from '../../utils/abonnement';
import { confirmAction, showError, toastSuccess } from '../../utils/alerts';
import { HistoriqueAbonnement } from '../abonnement/HistoriqueAbonnement';

type Onglet = 'etablissements' | 'paiements';

const field = 'w-full bg-[#f2f3ff] text-[13px] py-2 px-3 rounded border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5]';
const primary = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded bg-[#00236f] text-white text-[12px] font-bold hover:bg-[#1e3a8a] transition-colors shadow-xs disabled:opacity-50';
const ghost = 'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-[#f2f3ff] text-[#444651] text-[12px] font-semibold hover:bg-[#e2e7ff] transition-colors disabled:opacity-50';
const action = 'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-[#00236f] text-white text-[12px] font-bold hover:bg-[#1e3a8a] transition-colors disabled:opacity-50';

const Field: React.FC<{ label: string; className?: string; children: React.ReactNode }> = ({ label, className = '', children }) => (
  <label className={`flex flex-col gap-1 min-w-0 ${className}`}>
    <span className="text-[11px] font-bold uppercase tracking-wide text-[#444651]">{label}</span>
    {children}
  </label>
);

const STATUTS: StatutAbonnement[] = ['ESSAI', 'ACTIF', 'EXPIRE', 'EN_ATTENTE_PAIEMENT', 'SUSPENDU'];

const CLASSE_STATUT: Record<StatutAbonnement, string> = {
  ESSAI: 'bg-[#dcfce7] text-[#166534]',
  ACTIF: 'bg-[#dbeafe] text-[#1e3a8a]',
  EXPIRE: 'bg-[#ffdad6] text-[#ba1a1a]',
  EN_ATTENTE_PAIEMENT: 'bg-amber-100 text-amber-900',
  SUSPENDU: 'bg-[#ffdad6] text-[#ba1a1a]',
};

const aujourdhuiIso = (): string => new Date().toISOString().slice(0, 10);
const moisCourantIso = (): string => new Date().toISOString().slice(0, 7);

const telechargerCsv = (contenu: string, nom: string) => {
  const blob = new Blob([contenu], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
  URL.revokeObjectURL(url);
};

/** Cible d'une activation : établissement, et déclaration « À vérifier » qui pré-remplit le formulaire. */
interface CibleActivation {
  etablissement: AbonnementEtablissement;
  declaration?: EvenementAbonnement;
}

interface ActivationModalProps {
  cible: CibleActivation;
  parametres: ParametresCommerciaux | null;
  onClose: () => void;
  onDone: () => void;
}

const ActivationModal: React.FC<ActivationModalProps> = ({ cible, parametres, onClose, onDone }) => {
  const { etablissement, declaration } = cible;
  const forfaitInitial: Forfait = declaration?.forfait ?? etablissement.forfait ?? etablissement.forfaitChoisi ?? 'ANNUEL';
  const [forfait, setForfait] = useState<Forfait>(forfaitInitial);
  const tarifs = parametres ?? { tarifMensuel: 0, tarifAnnuel: 0 };
  const [debut, setDebut] = useState(aujourdhuiIso);
  const [montant, setMontant] = useState<string>(() => {
    if (declaration?.montant) return String(declaration.montant);
    const tarif = tarifDuForfait(forfaitInitial, tarifs);
    return tarif > 0 ? String(tarif) : '';
  });
  const [reference, setReference] = useState(declaration?.reference ?? '');
  const [operateur, setOperateur] = useState<string>(declaration?.operateurMobile ?? '');
  const [note, setNote] = useState(declaration ? `Déclaration n° ${declaration.id} vérifiée.` : '');
  const [envoi, setEnvoi] = useState(false);

  const prolongation = etablissement.statut === 'ACTIF' && !!etablissement.fin;

  const changerForfait = (next: Forfait) => {
    setForfait(next);
    const tarif = tarifDuForfait(next, tarifs);
    if (tarif > 0 && !declaration?.montant) setMontant(String(tarif));
  };

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (envoi) return;
    setEnvoi(true);
    try {
      await activerAbonnement(etablissement.id, {
        forfait,
        debut: debut || undefined,
        montant: montant.trim() === '' ? undefined : Math.round(Number(montant)),
        reference: reference.trim() || undefined,
        operateurMobile: operateur || undefined,
        note: note.trim() || undefined,
        declarationId: declaration?.id,
      });
      toastSuccess(`Abonnement ${FORFAIT_LABELS[forfait].toLowerCase()} ${prolongation ? 'prolongé' : 'activé'} pour « ${etablissement.nom} ».`);
      onDone();
    } catch (err) {
      await showError('Activation impossible', err instanceof Error ? err.message : 'Une erreur inattendue est survenue.');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="titre-activation">
      <form onSubmit={(e) => void soumettre(e)} className="w-full sm:max-w-lg bg-white rounded-t-xl sm:rounded-xl shadow-2xl max-h-[92dvh] overflow-y-auto" data-testid="modale-activation">
        <div className="px-4 sm:px-5 py-3 border-b border-[#eaedff] flex items-start justify-between gap-3 sticky top-0 bg-white">
          <div className="min-w-0">
            <h3 id="titre-activation" className="text-[15px] font-bold text-[#00236f]">{prolongation ? 'Prolonger l’abonnement' : 'Activer l’abonnement'}</h3>
            <p className="text-[12px] text-[#444651] truncate">{etablissement.nom} · {etablissement.ville}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#444651] hover:bg-[#f2f3ff]">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-4 sm:p-5 space-y-3">
          {declaration && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
              Pré-rempli depuis la déclaration de paiement du {formatDateFr(declaration.creeLe)} ({declaration.operateurMobile || 'opérateur non précisé'}). Elle passera à « Traitée ».
            </p>
          )}
          {prolongation && (
            <p className="rounded-lg border border-[#dce1ff] bg-[#f2f3ff] px-3 py-2 text-[12px] text-[#00236f]">
              Abonnement actif jusqu’au {formatDateFr(etablissement.fin)} : la nouvelle période démarre à cette date, aucun jour n’est perdu.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Forfait">
              <select value={forfait} onChange={(e) => changerForfait(e.target.value as Forfait)} className={field} data-testid="activation-forfait">
                <option value="MENSUEL">Mensuel (1 mois)</option>
                <option value="ANNUEL">Annuel (12 mois)</option>
              </select>
            </Field>
            <Field label="Date de début">
              <input type="date" value={debut} onChange={(e) => setDebut(e.target.value)} className={field} disabled={prolongation} data-testid="activation-debut" />
            </Field>
            <Field label={`Montant encaissé (${parametres?.devise ?? 'FCFA'})`}>
              <input type="number" min={0} step={1} inputMode="numeric" value={montant} onChange={(e) => setMontant(e.target.value)} className={`${field} font-mono`} placeholder={tarifDuForfait(forfait, tarifs) > 0 ? '' : 'Tarif à confirmer'} data-testid="activation-montant" />
            </Field>
            <Field label="Opérateur mobile money">
              <select value={operateur} onChange={(e) => setOperateur(e.target.value)} className={field}>
                <option value="">— Non précisé —</option>
                {OPERATEURS_MOBILE.map((op) => <option key={op} value={op}>{op}</option>)}
              </select>
            </Field>
            <Field label="Référence mobile money" className="sm:col-span-2">
              <input type="text" maxLength={120} value={reference} onChange={(e) => setReference(e.target.value)} className={`${field} font-mono`} placeholder="Identifiant de la transaction" data-testid="activation-reference" />
            </Field>
            <Field label="Note" className="sm:col-span-2">
              <textarea rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} className={field} />
            </Field>
          </div>
        </div>
        <div className="px-4 sm:px-5 py-3 border-t border-[#eaedff] flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sticky bottom-0 bg-white">
          <button type="button" onClick={onClose} className={ghost}>Annuler</button>
          <button type="submit" disabled={envoi} className={primary} data-testid="activation-confirmer">
            <span className={`material-symbols-outlined text-base ${envoi ? 'animate-spin' : ''}`} aria-hidden="true">{envoi ? 'progress_activity' : 'verified'}</span>
            {prolongation ? 'Prolonger' : 'Activer'}
          </button>
        </div>
      </form>
    </div>
  );
};

interface HistoriqueModalProps {
  etablissement: AbonnementEtablissement;
  onClose: () => void;
}

const HistoriqueModal: React.FC<HistoriqueModalProps> = ({ etablissement, onClose }) => {
  const [evenements, setEvenements] = useState<EvenementAbonnement[] | null>(null);
  const [erreur, setErreur] = useState('');
  useEffect(() => {
    historiqueEtablissement(etablissement.id)
      .then(setEvenements)
      .catch((err: Error) => setErreur(err.message || 'Historique indisponible.'));
  }, [etablissement.id]);
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true">
      <div className="w-full sm:max-w-4xl bg-white rounded-t-xl sm:rounded-xl shadow-2xl max-h-[92dvh] overflow-y-auto">
        <div className="px-4 sm:px-5 py-3 border-b border-[#eaedff] flex items-start justify-between gap-3 sticky top-0 bg-white">
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold text-[#00236f]">Historique de l’abonnement</h3>
            <p className="text-[12px] text-[#444651] truncate">{etablissement.nom}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#444651] hover:bg-[#f2f3ff]">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-4 sm:p-5">
          {!evenements && !erreur && <p className="text-[13px] text-[#444651]">Chargement…</p>}
          {erreur && <p className="text-[13px] text-[#ba1a1a]">{erreur}</p>}
          {evenements && <HistoriqueAbonnement evenements={evenements} avecActeur />}
        </div>
      </div>
    </div>
  );
};

interface ParametresFormProps {
  parametres: ParametresCommerciaux;
  modifiable: boolean;
  onSaved: (p: ParametresCommerciaux) => void;
}

const ParametresCommerciauxForm: React.FC<ParametresFormProps> = ({ parametres, modifiable, onSaved }) => {
  const [form, setForm] = useState({
    tarifMensuel: String(parametres.tarifMensuel),
    tarifAnnuel: String(parametres.tarifAnnuel),
    telWhatsapp: parametres.telWhatsapp ?? '',
    telAppel: parametres.telAppel ?? '',
    beneficiaire: parametres.beneficiaire ?? '',
    instructions: parametres.instructions ?? '',
    dureeEssaiJours: String(parametres.dureeEssaiJours),
    joursGrace: String(parametres.joursGrace),
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      tarifMensuel: String(parametres.tarifMensuel),
      tarifAnnuel: String(parametres.tarifAnnuel),
      telWhatsapp: parametres.telWhatsapp ?? '',
      telAppel: parametres.telAppel ?? '',
      beneficiaire: parametres.beneficiaire ?? '',
      instructions: parametres.instructions ?? '',
      dureeEssaiJours: String(parametres.dureeEssaiJours),
      joursGrace: String(parametres.joursGrace),
    });
  }, [parametres]);

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = await enregistrerParametresCommerciaux({
        tarifMensuel: Math.max(0, Math.round(Number(form.tarifMensuel) || 0)),
        tarifAnnuel: Math.max(0, Math.round(Number(form.tarifAnnuel) || 0)),
        telWhatsapp: form.telWhatsapp.trim(),
        telAppel: form.telAppel.trim(),
        beneficiaire: form.beneficiaire.trim(),
        instructions: form.instructions.trim(),
        dureeEssaiJours: Math.round(Number(form.dureeEssaiJours) || 14),
        joursGrace: Math.round(Number(form.joursGrace) || 0),
      });
      toastSuccess('Paramètres commerciaux enregistrés.');
      onSaved(saved);
    } catch (err) {
      await showError('Enregistrement impossible', err instanceof Error ? err.message : 'Une erreur inattendue est survenue.');
    } finally {
      setSaving(false);
    }
  };

  const tarifsManquants = !(Number(form.tarifMensuel) > 0) || !(Number(form.tarifAnnuel) > 0);

  return (
    <form onSubmit={(e) => void enregistrer(e)} className="space-y-3" data-testid="formulaire-parametres-commerciaux">
      {tarifsManquants && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-900">
          Tarif à confirmer : tant qu’un tarif vaut 0, les établissements voient « Tarif à confirmer » au lieu d’un montant. Saisissez vos prix réels.
        </p>
      )}
      <fieldset disabled={!modifiable} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 disabled:opacity-80">
        <Field label="Tarif mensuel (FCFA)">
          <input type="number" min={0} step={1} inputMode="numeric" value={form.tarifMensuel} onChange={(e) => setForm({ ...form, tarifMensuel: e.target.value })} className={`${field} font-mono`} data-testid="param-tarif-mensuel" />
        </Field>
        <Field label="Tarif annuel (FCFA)">
          <input type="number" min={0} step={1} inputMode="numeric" value={form.tarifAnnuel} onChange={(e) => setForm({ ...form, tarifAnnuel: e.target.value })} className={`${field} font-mono`} data-testid="param-tarif-annuel" />
        </Field>
        <Field label="Durée d’essai (jours)">
          <input type="number" min={1} max={365} step={1} value={form.dureeEssaiJours} onChange={(e) => setForm({ ...form, dureeEssaiJours: e.target.value })} className={`${field} font-mono`} />
        </Field>
        <Field label="Jours de grâce">
          <input type="number" min={0} max={60} step={1} value={form.joursGrace} onChange={(e) => setForm({ ...form, joursGrace: e.target.value })} className={`${field} font-mono`} />
        </Field>
        <Field label="Numéro WhatsApp (public)">
          <input type="text" maxLength={40} value={form.telWhatsapp} onChange={(e) => setForm({ ...form, telWhatsapp: e.target.value })} className={field} placeholder="+228 90 00 00 00" data-testid="param-whatsapp" />
        </Field>
        <Field label="Numéro d’appel (public)">
          <input type="text" maxLength={40} value={form.telAppel} onChange={(e) => setForm({ ...form, telAppel: e.target.value })} className={field} placeholder="+228 90 00 00 00" />
        </Field>
        <Field label="Bénéficiaire mobile money" className="lg:col-span-2">
          <input type="text" maxLength={180} value={form.beneficiaire} onChange={(e) => setForm({ ...form, beneficiaire: e.target.value })} className={field} placeholder="Nom affiché au moment du transfert" />
        </Field>
        <Field label="Instructions de paiement (affichées aux établissements)" className="col-span-full">
          <textarea rows={3} maxLength={4000} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} className={field} placeholder="Ex : Flooz ou T-Money au numéro ci-dessus, puis déclarez la référence reçue par SMS." />
        </Field>
      </fieldset>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-[#444651]">
          {parametres.modifieLe ? `Dernière modification : ${formatDateFr(parametres.modifieLe)}.` : 'Jamais modifiés.'}
          {!modifiable && ' Seul le propriétaire du logiciel (SUPER_ADMIN) peut modifier ces paramètres.'}
        </p>
        {modifiable && (
          <button type="submit" disabled={saving} className={primary} data-testid="param-enregistrer">
            <span className="material-symbols-outlined text-base" aria-hidden="true">save</span>
            Enregistrer
          </button>
        )}
      </div>
    </form>
  );
};

/**
 * Portail super admin « Abonnements » : onglet Établissements (statut, forfait, échéance, jours restants,
 * filtres, recherche, Activer / Mode essai / Suspendre / Réactiver / Historique), onglet Paiements (historique
 * global, totaux du mois, déclarations « À vérifier » avec Activer pré-rempli, export CSV) et bloc
 * Paramètres commerciaux (tarifs, numéros, bénéficiaire, instructions, essai, grâce).
 */
/** Filtre de statut demandé depuis l'extérieur (carte du tableau de bord analytique) ; le jeton distingue deux demandes identiques. */
export interface DemandeFiltreAbonnements {
  statut: StatutAbonnement;
  jeton: number;
}

interface AbonnementsPlateformeViewProps {
  filtreDemande?: DemandeFiltreAbonnements | null;
}

export const AbonnementsPlateformeView: React.FC<AbonnementsPlateformeViewProps> = ({ filtreDemande = null }) => {
  const { can, permissions } = usePermissions();
  const allowed = isPlatformAccount();
  const canVoir = can('ETABLISSEMENTS', 'VOIR');
  const canDetails = can('ETABLISSEMENTS', 'DETAILS');
  const canModifier = can('ETABLISSEMENTS', 'MODIFIER');
  const superAdmin = getSession()?.role === PLATFORM_ROLE;

  const [onglet, setOnglet] = useState<Onglet>('etablissements');
  const [liste, setListe] = useState<AbonnementEtablissement[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [filtres, setFiltres] = useState<Set<StatutAbonnement>>(new Set());
  const [recherche, setRecherche] = useState('');
  const [parametres, setParametres] = useState<ParametresCommerciaux | null>(null);
  const [parametresOuverts, setParametresOuverts] = useState(false);
  const [paiements, setPaiements] = useState<PaiementsPlateforme | null>(null);
  const [mois, setMois] = useState<string>(moisCourantIso);
  const [toutLHistorique, setToutLHistorique] = useState(false);
  const [activation, setActivation] = useState<CibleActivation | null>(null);
  const [historiqueDe, setHistoriqueDe] = useState<AbonnementEtablissement | null>(null);
  const [actionEnCours, setActionEnCours] = useState<number | null>(null);

  const chargerListe = () => {
    if (!allowed || !canVoir) {
      setChargement(false);
      return;
    }
    setChargement(true);
    setErreur('');
    listerAbonnements()
      .then(setListe)
      .catch((err: Error) => setErreur(err.message || 'Impossible de charger les abonnements.'))
      .finally(() => setChargement(false));
  };

  const chargerParametres = () => {
    if (!allowed || !canVoir) return;
    lireParametresCommerciaux()
      .then((p) => {
        setParametres(p);
        if (p.tarifMensuel <= 0 || p.tarifAnnuel <= 0) setParametresOuverts(true);
      })
      .catch(() => setParametres(null));
  };

  const chargerPaiements = () => {
    if (!allowed || !canDetails) return;
    listerPaiements(toutLHistorique ? undefined : mois)
      .then(setPaiements)
      .catch((err: Error) => setErreur(err.message || 'Impossible de charger les paiements.'));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { chargerListe(); chargerParametres(); }, [allowed, canVoir, permissions.join(',')]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(chargerPaiements, [allowed, canDetails, mois, toutLHistorique, permissions.join(',')]);

  useEffect(() => {
    if (!filtreDemande) return;
    setOnglet('etablissements');
    setFiltres(new Set([filtreDemande.statut]));
  }, [filtreDemande]);

  const toutRecharger = () => {
    chargerListe();
    chargerPaiements();
  };

  const filtree = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return liste.filter((item) => {
      if (filtres.size > 0 && !filtres.has(item.statut)) return false;
      if (!q) return true;
      return [item.nom, item.ville, item.email ?? '', item.nomResponsable ?? ''].some((v) => v.toLowerCase().includes(q));
    });
  }, [liste, filtres, recherche]);

  const compteurs = useMemo(() => {
    const base: Record<StatutAbonnement, number> = { ESSAI: 0, ACTIF: 0, EXPIRE: 0, EN_ATTENTE_PAIEMENT: 0, SUSPENDU: 0 };
    liste.forEach((item) => { base[item.statut] += 1; });
    return base;
  }, [liste]);
  const declarationsAVerifier = liste.reduce((acc, item) => acc + (item.declarationsAVerifier || 0), 0);

  if (!allowed) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto">
        <div className="bg-white border border-[#eaedff] rounded p-6 text-[13px] text-[#444651]">
          Cet écran est réservé au propriétaire du logiciel et à ses gestionnaires.
        </div>
      </div>
    );
  }

  const basculerFiltre = (statut: StatutAbonnement) => {
    setFiltres((prev) => {
      const next = new Set(prev);
      if (next.has(statut)) next.delete(statut);
      else next.add(statut);
      return next;
    });
  };

  const executer = async (item: AbonnementEtablissement, action: () => Promise<unknown>, succes: string, titreErreur: string) => {
    setActionEnCours(item.id);
    try {
      await action();
      toastSuccess(succes);
      toutRecharger();
    } catch (err) {
      await showError(titreErreur, err instanceof Error ? err.message : 'Une erreur inattendue est survenue.');
    } finally {
      setActionEnCours(null);
    }
  };

  const modeEssai = async (item: AbonnementEtablissement) => {
    const duree = parametres?.dureeEssaiJours ?? 14;
    const ok = await confirmAction({
      title: 'Accorder un essai',
      text: `« ${item.nom} » disposera de ${duree} jours d’accès complet à compter d’aujourd’hui, sans paiement.`,
      confirmText: `Accorder ${duree} jours`,
    });
    if (!ok) return;
    await executer(item, () => demarrerEssai(item.id), `Essai de ${duree} jours accordé à « ${item.nom} ».`, 'Essai impossible');
  };

  const suspendre = async (item: AbonnementEtablissement) => {
    const ok = await confirmAction({
      title: 'Suspendre cet abonnement',
      text: `« ${item.nom} » passe en lecture seule : connexion et consultation possibles, aucune écriture ni impression. Réversible à tout moment.`,
      confirmText: 'Suspendre',
      icon: 'warning',
    });
    if (!ok) return;
    await executer(item, () => suspendreAbonnement(item.id), `« ${item.nom} » suspendu.`, 'Suspension impossible');
  };

  const reactiver = async (item: AbonnementEtablissement) => {
    const ok = await confirmAction({
      title: 'Réactiver cet abonnement',
      text: `« ${item.nom} » retrouve l’état de son abonnement avant suspension (actif, essai ou expiré selon l’échéance).`,
      confirmText: 'Réactiver',
    });
    if (!ok) return;
    await executer(item, () => reactiverAbonnement(item.id), `« ${item.nom} » réactivé.`, 'Réactivation impossible');
  };

  const ouvrirActivationDepuisDeclaration = (ev: EvenementAbonnement) => {
    const etab = liste.find((item) => item.id === ev.etablissementId);
    if (!etab) {
      void showError('Établissement introuvable', 'Rechargez la page puis réessayez.');
      return;
    }
    setActivation({ etablissement: etab, declaration: ev });
  };

  const exporterCsv = () => {
    if (!paiements) return;
    telechargerCsv(csvPaiements(paiements.evenements), `Paiements_AcademiaBlanc_${toutLHistorique ? 'complet' : paiements.mois}.csv`);
  };

  const onglets: { key: Onglet; label: string; icon: string; visible: boolean; badge?: number }[] = [
    { key: 'etablissements', label: 'Établissements', icon: 'domain', visible: canVoir },
    { key: 'paiements', label: 'Paiements', icon: 'receipt_long', visible: canDetails, badge: declarationsAVerifier },
  ];
  const ongletsVisibles = onglets.filter((o) => o.visible);
  const ongletCourant: Onglet | null = ongletsVisibles.some((o) => o.key === onglet) ? onglet : (ongletsVisibles[0]?.key ?? null);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-4 md:space-y-6" data-testid="page-abonnements-plateforme">
      <div className="bg-white rounded p-4 md:p-6 shadow-sm border border-[#eaedff]">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#0051d5] bg-[#eaedff] px-2.5 py-1 rounded">Plateforme</span>
        <h2 className="text-[20px] md:text-[22px] font-bold text-[#00236f] mt-1.5">Abonnements &amp; paiements</h2>
        <p className="text-[13px] text-[#444651] mt-0.5 max-w-3xl">
          Statut de chaque établissement (essai, actif, expiré, en attente de paiement, suspendu), activation manuelle après
          paiement mobile money, historique global des encaissements et paramètres commerciaux. Chaque action est journalisée
          avec votre adresse.
        </p>
      </div>

      <nav aria-label="Sections des abonnements" className="bg-white rounded border border-[#eaedff] shadow-xs p-1.5 flex gap-1 overflow-x-auto">
        {ongletsVisibles.map((item) => {
          const active = ongletCourant === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setOnglet(item.key)}
              aria-current={active ? 'page' : undefined}
              data-testid={`onglet-${item.key}`}
              className={`inline-flex shrink-0 items-center gap-2 px-3.5 py-2 rounded text-[12px] font-bold whitespace-nowrap transition-colors ${
                active ? 'bg-[#00236f] text-white shadow-xs' : 'text-[#444651] hover:bg-[#f2f3ff] hover:text-[#00236f]'
              }`}
            >
              <span className="material-symbols-outlined text-base">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge ? (
                <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-white text-[#00236f]' : 'bg-amber-100 text-amber-900'}`} title="Déclarations de paiement à vérifier">
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {ongletsVisibles.length === 0 && (
        <div className="bg-white border border-[#eaedff] rounded p-6 text-[13px] text-[#444651]">
          Votre compte ne détient aucun droit de consultation sur les établissements.
        </div>
      )}

      {ongletCourant === 'etablissements' && (
        <section className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {STATUTS.map((statut) => {
              const actif = filtres.has(statut);
              return (
                <button
                  key={statut}
                  type="button"
                  onClick={() => basculerFiltre(statut)}
                  aria-pressed={actif}
                  data-testid={`filtre-${statut.toLowerCase()}`}
                  className={`rounded-lg border p-3 text-left transition-colors ${actif ? 'border-[#0051d5] bg-[#f2f3ff] shadow-xs' : 'border-[#eaedff] bg-white hover:border-[#90a8ff]'}`}
                >
                  <span className={`inline-flex items-center text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${CLASSE_STATUT[statut]}`}>{STATUT_LABELS[statut]}</span>
                  <p className="mt-1.5 text-[20px] font-bold text-[#00236f] leading-none">{compteurs[statut]}</p>
                </button>
              );
            })}
          </div>

          <div className="bg-white rounded border border-[#eaedff] shadow-xs p-3 flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-2.5 top-2 text-[#444651] text-lg" aria-hidden="true">search</span>
              <input
                type="search"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Rechercher un établissement, une ville, un email…"
                className={`${field} pl-9`}
                aria-label="Rechercher"
                data-testid="recherche-abonnements"
              />
            </div>
            {filtres.size > 0 && (
              <button type="button" onClick={() => setFiltres(new Set())} className={ghost}>
                <span className="material-symbols-outlined text-base">filter_alt_off</span>
                Tous les statuts
              </button>
            )}
            <button type="button" onClick={toutRecharger} className={ghost} title="Recharger">
              <span className="material-symbols-outlined text-base">refresh</span>
              Actualiser
            </button>
          </div>

          {chargement && <div className="bg-white border border-[#eaedff] rounded p-6 text-[13px] text-[#444651]">Chargement des abonnements…</div>}
          {!chargement && erreur && <div className="bg-white border border-[#eaedff] rounded p-6 text-[13px] text-[#ba1a1a]">{erreur}</div>}
          {!chargement && !erreur && filtree.length === 0 && (
            <div className="bg-white border border-dashed border-[#dce1ff] rounded p-10 text-center space-y-2">
              <span className="material-symbols-outlined text-4xl text-[#0051d5]">domain_disabled</span>
              <p className="text-[13px] text-[#444651]">Aucun établissement ne correspond.</p>
            </div>
          )}
          {!chargement && !erreur && filtree.length > 0 && (
            <div className="bg-white border border-[#eaedff] rounded shadow-xs overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-[13px]" data-testid="table-abonnements">
                <thead className="bg-[#f2f3ff] text-[11px] uppercase tracking-wider text-[#444651]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Établissement</th>
                    {canDetails && <th className="px-4 py-3 font-semibold">Responsable</th>}
                    <th className="px-4 py-3 font-semibold">Inscrit le</th>
                    <th className="px-4 py-3 font-semibold">Forfait</th>
                    <th className="px-4 py-3 font-semibold">Statut</th>
                    <th className="px-4 py-3 font-semibold">Échéance</th>
                    <th className="px-4 py-3 font-semibold text-right">Jours restants</th>
                    {canModifier && <th className="px-4 py-3 font-semibold text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtree.map((item) => {
                    const jours = item.joursRestants;
                    const alerte = jours != null && jours <= 3 && (item.statut === 'ESSAI' || item.statut === 'ACTIF');
                    const occupe = actionEnCours === item.id;
                    return (
                      <tr key={item.id} className={`border-t border-[#eaedff] align-top ${item.actif ? '' : 'opacity-60'}`} data-testid={`ligne-abonnement-${item.id}`}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-[#00236f]">{item.nom}</p>
                          <p className="text-[12px] text-[#444651]">{item.ville}</p>
                          {item.declarationsAVerifier > 0 && (
                            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold uppercase px-2 py-0.5">
                              <span className="material-symbols-outlined text-[13px]">receipt_long</span>
                              {item.declarationsAVerifier} à vérifier
                            </span>
                          )}
                        </td>
                        {canDetails && (
                          <td className="px-4 py-3 text-[#131b2e]">
                            <p className="font-medium">{item.nomResponsable || '—'}</p>
                            <p className="text-[12px] text-[#444651] break-all">{item.email || '—'}</p>
                          </td>
                        )}
                        <td className="px-4 py-3 whitespace-nowrap">{formatDateFr(item.creeLe) || '—'}</td>
                        <td className="px-4 py-3">
                          {item.forfait ? FORFAIT_LABELS[item.forfait] : item.forfaitChoisi ? <span className="text-[#444651]">{FORFAIT_LABELS[item.forfaitChoisi]} (choisi)</span> : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${CLASSE_STATUT[item.statut]}`}>{STATUT_LABELS[item.statut]}</span>
                          {item.enGrace && <p className="text-[11px] text-amber-900 mt-1">Période de grâce</p>}
                          {!item.actif && <p className="text-[11px] text-[#ba1a1a] mt-1">Compte désactivé</p>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">{formatDateFr(item.echeance) || '—'}</td>
                        <td className={`px-4 py-3 text-right font-mono font-semibold ${alerte ? 'text-[#ba1a1a]' : 'text-[#131b2e]'}`}>
                          {jours == null ? '—' : jours}
                        </td>
                        {canModifier && (
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap justify-end gap-1.5">
                              <button type="button" disabled={occupe} onClick={() => setActivation({ etablissement: item })} className={action} data-testid={`activer-${item.id}`}>
                                <span className="material-symbols-outlined text-base">verified</span>
                                {item.statut === 'ACTIF' ? 'Prolonger' : 'Activer'}
                              </button>
                              {item.statut !== 'SUSPENDU' && item.statut !== 'ACTIF' && (
                                <button type="button" disabled={occupe} onClick={() => void modeEssai(item)} className={`${ghost} text-[#166534] hover:bg-[#dcfce7]`} data-testid={`essai-${item.id}`}>
                                  <span className="material-symbols-outlined text-base">hourglass_top</span>
                                  Mode essai
                                </button>
                              )}
                              {item.statut === 'SUSPENDU' ? (
                                <button type="button" disabled={occupe} onClick={() => void reactiver(item)} className={`${ghost} text-[#166534] hover:bg-[#dcfce7]`}>
                                  <span className="material-symbols-outlined text-base">play_circle</span>
                                  Réactiver
                                </button>
                              ) : (
                                <button type="button" disabled={occupe} onClick={() => void suspendre(item)} className={`${ghost} text-[#ba1a1a] hover:bg-[#ffdad6]`}>
                                  <span className="material-symbols-outlined text-base">pause_circle</span>
                                  Suspendre
                                </button>
                              )}
                              {canDetails && (
                                <button type="button" onClick={() => setHistoriqueDe(item)} className={ghost} title="Historique de l’abonnement">
                                  <span className="material-symbols-outlined text-base">history</span>
                                  Historique
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {ongletCourant === 'paiements' && (
        <section className="space-y-3" data-testid="onglet-paiements-contenu">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white border border-[#eaedff] rounded p-4 shadow-xs">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#444651]">Encaissé {paiements ? `en ${paiements.mois}` : 'ce mois'}</p>
              <p className="mt-2 text-[22px] font-bold text-[#00236f] leading-none" data-testid="total-mois">{paiements ? formatFcfa(paiements.totalMois, paiements.devise) : '—'}</p>
            </div>
            <div className="bg-white border border-[#eaedff] rounded p-4 shadow-xs">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#444651]">Activations / prolongations du mois</p>
              <p className="mt-2 text-[22px] font-bold text-[#00236f] leading-none">{paiements ? paiements.nombrePaiementsMois : '—'}</p>
            </div>
            <div className={`border rounded p-4 shadow-xs ${paiements && paiements.declarationsAVerifier > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-[#eaedff]'}`}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#444651]">Déclarations à vérifier</p>
              <p className="mt-2 text-[22px] font-bold text-amber-900 leading-none">{paiements ? paiements.declarationsAVerifier : '—'}</p>
            </div>
          </div>

          <div className="bg-white rounded border border-[#eaedff] shadow-xs p-3 flex flex-col sm:flex-row sm:items-center gap-2">
            <label className="flex items-center gap-2 text-[12px] font-semibold text-[#444651]">
              <span>Mois</span>
              <input type="month" value={mois} onChange={(e) => setMois(e.target.value || moisCourantIso())} disabled={toutLHistorique} className={`${field} w-auto`} />
            </label>
            <label className="flex items-center gap-2 text-[12px] font-semibold text-[#444651] cursor-pointer">
              <input type="checkbox" checked={toutLHistorique} onChange={(e) => setToutLHistorique(e.target.checked)} className="w-4 h-4" />
              <span>Tout l’historique</span>
            </label>
            <div className="flex-1" />
            <button type="button" onClick={exporterCsv} disabled={!paiements || paiements.evenements.length === 0} className={ghost} data-testid="export-csv-paiements">
              <span className="material-symbols-outlined text-base">download</span>
              Exporter CSV
            </button>
          </div>

          {!paiements && !erreur && <div className="bg-white border border-[#eaedff] rounded p-6 text-[13px] text-[#444651]">Chargement des paiements…</div>}
          {erreur && <div className="bg-white border border-[#eaedff] rounded p-6 text-[13px] text-[#ba1a1a]">{erreur}</div>}
          {paiements && (
            <div className="bg-white border border-[#eaedff] rounded shadow-xs p-3">
              <HistoriqueAbonnement
                evenements={paiements.evenements}
                avecEtablissement
                avecActeur
                vide={toutLHistorique ? 'Aucun événement enregistré.' : 'Aucun événement ce mois-ci.'}
                onTraiter={canModifier ? ouvrirActivationDepuisDeclaration : undefined}
              />
            </div>
          )}
        </section>
      )}

      {canVoir && (
        <section className="bg-white rounded border border-[#eaedff] shadow-xs" data-testid="bloc-parametres-commerciaux">
          <button
            type="button"
            onClick={() => setParametresOuverts((v) => !v)}
            aria-expanded={parametresOuverts}
            className="w-full flex items-center justify-between gap-3 px-4 md:px-5 py-3.5 text-left"
          >
            <span className="flex items-center gap-3">
              <span className="shrink-0 w-9 h-9 rounded bg-[#eaedff] text-[#0051d5] flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">sell</span>
              </span>
              <span>
                <span className="block text-[14px] font-bold text-[#00236f] uppercase tracking-wide">Paramètres commerciaux</span>
                <span className="block text-[12px] text-[#444651]">
                  {parametres
                    ? `Mensuel : ${tarifAffiche(parametres.tarifMensuel)} · Annuel : ${tarifAffiche(parametres.tarifAnnuel)} · Essai ${parametres.dureeEssaiJours} j · Grâce ${parametres.joursGrace} j`
                    : 'Tarifs, numéros WhatsApp et d’appel, bénéficiaire mobile money, instructions, durée d’essai, jours de grâce.'}
                </span>
              </span>
            </span>
            <span className="material-symbols-outlined text-[#444651]">{parametresOuverts ? 'expand_less' : 'expand_more'}</span>
          </button>
          {parametresOuverts && (
            <div className="px-4 md:px-5 pb-5 border-t border-[#eaedff] pt-4">
              {parametres ? (
                <ParametresCommerciauxForm parametres={parametres} modifiable={superAdmin} onSaved={(p) => { setParametres(p); toutRecharger(); }} />
              ) : (
                <p className="text-[13px] text-[#444651]">Paramètres indisponibles.</p>
              )}
            </div>
          )}
        </section>
      )}

      {activation && (
        <ActivationModal
          cible={activation}
          parametres={parametres}
          onClose={() => setActivation(null)}
          onDone={() => {
            setActivation(null);
            toutRecharger();
          }}
        />
      )}
      {historiqueDe && <HistoriqueModal etablissement={historiqueDe} onClose={() => setHistoriqueDe(null)} />}
    </div>
  );
};
