import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { usePermissions } from '../api/permissions';
import {
  accepterTransfert,
  annulerTransfert,
  compterParStatut,
  csvHistorique,
  dateCourte,
  envoyerTransfert,
  libelleStatut,
  loadDetail,
  loadEnvois,
  loadOrigines,
  loadRecus,
  normaliserCode,
  recapitulatifEnvoi,
  refuserTransfert,
  resoudreDestinataire,
} from '../api/transferts';
import type { DetailTransfert, OrigineTransfert, StatutTransfert, TransfertVue } from '../api/transferts';
import { isForbidden } from '../api/client';
import { confirmAction, confirmAvecMotCle, demanderTexte, showError, toastSuccess } from '../utils/alerts';

export type OngletTransferts = 'envois' | 'recus';

interface TransfertsViewProps {
  /** Session active (identifiant et intitulé) ; `sessionInter` vrai pour une session inter-établissements. */
  sessionId: number | null;
  sessionName: string;
  sessionInter: boolean;
  /** Nom du centre d'examen (l'établissement hôte) en session inter-établissements. */
  centreExamen: string;
  /** Onglet ouvert à l'arrivée (depuis la liste des candidats : envois ; depuis le menu : reçus). */
  ongletInitial?: OngletTransferts;
  /** L'établissement a déjà un logo : l'invitation à l'ajouter après acceptation est inutile. */
  aUnLogo: boolean;
  /** Appelé après tout traitement d'un transfert reçu (badge « en attente » de la barre latérale). */
  onRecusChanged?: () => void;
  /** Ouvre la session recréée après une acceptation (procès-verbal). */
  onOpenSession?: (sessionId: number) => void;
  /** Ouvre le profil (charte graphique) depuis l'invitation à ajouter le logo. */
  onOpenProfil?: () => void;
}

const primary = 'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded bg-[#00236f] text-white text-[12px] font-bold hover:bg-[#1e3a8a] transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed';
const ghost = 'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-[#f2f3ff] text-[#444651] text-[12px] font-semibold hover:bg-[#e2e7ff] transition-colors disabled:opacity-50';
const danger = 'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-white text-red-700 text-[12px] font-bold border border-red-200 hover:bg-red-50 hover:border-red-300 transition-colors disabled:opacity-50';
const success = 'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded bg-emerald-700 text-white text-[12px] font-bold hover:bg-emerald-800 transition-colors shadow-xs disabled:opacity-50';
const field = 'bg-[#f2f3ff] text-[13px] py-2 px-3 rounded border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5] font-mono uppercase tracking-widest';

const messageErreur = (err: unknown, fallback: string) => (err instanceof Error && err.message.trim() ? err.message : fallback);

const STATUT_CLASSES: Record<StatutTransfert, string> = {
  EN_ATTENTE: 'bg-[#fff3e0] text-[#8a4b00] border-[#ffcc80]',
  ACCEPTE: 'bg-[#dcfce7] text-[#166534] border-[#86efac]',
  REFUSE: 'bg-red-50 text-red-800 border-red-200',
  ANNULE: 'bg-[#f2f3ff] text-[#444651] border-[#eaedff]',
};

const BadgeStatut: React.FC<{ statut: StatutTransfert }> = ({ statut }) => (
  <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUT_CLASSES[statut] ?? STATUT_CLASSES.ANNULE}`}>
    {libelleStatut(statut)}
  </span>
);

const Carte: React.FC<{ titre: string; icon: string; actions?: React.ReactNode; children: React.ReactNode; testId?: string }> = ({
  titre, icon, actions, children, testId,
}) => (
  <section className="bg-white p-4 md:p-5 rounded border border-[#eaedff] shadow-xs space-y-4" data-testid={testId}>
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eaedff] pb-2">
      <h3 className="text-[14px] font-bold text-[#00236f] uppercase tracking-wide flex items-center gap-2">
        <span className="material-symbols-outlined text-lg text-[#0051d5]">{icon}</span>
        {titre}
      </h3>
      {actions}
    </div>
    {children}
  </section>
);

const telechargerCsv = (contenu: string, nomFichier: string) => {
  const blob = new Blob([contenu], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  URL.revokeObjectURL(url);
};

const fmt = (value: number | null | undefined) => (value == null ? '—' : Number(value).toFixed(2));

export const TransfertsView: React.FC<TransfertsViewProps> = ({
  sessionId,
  sessionName,
  sessionInter,
  centreExamen,
  ongletInitial,
  aUnLogo,
  onRecusChanged,
  onOpenSession,
  onOpenProfil,
}) => {
  const { can } = usePermissions();
  const peutEnvoyer = can('TRANSFERTS', 'ENVOYER');
  const peutTraiter = can('TRANSFERTS', 'TRAITER');
  const envoisPossibles = sessionInter && sessionId != null;

  const [onglet, setOnglet] = useState<OngletTransferts>(ongletInitial ?? (envoisPossibles ? 'envois' : 'recus'));
  useEffect(() => {
    if (ongletInitial) setOnglet(ongletInitial);
  }, [ongletInitial]);

  // ----- Centre : origines et historique -----
  const [origines, setOrigines] = useState<OrigineTransfert[]>([]);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [envois, setEnvois] = useState<TransfertVue[]>([]);
  const [seulementSession, setSeulementSession] = useState(true);
  const [chargementEnvois, setChargementEnvois] = useState(false);
  const [erreurEnvois, setErreurEnvois] = useState('');
  const [enCours, setEnCours] = useState<string | null>(null);

  const chargerEnvois = useCallback(async () => {
    setChargementEnvois(true);
    setErreurEnvois('');
    try {
      const [listeOrigines, historique] = await Promise.all([
        envoisPossibles && sessionId != null ? loadOrigines(sessionId) : Promise.resolve([] as OrigineTransfert[]),
        loadEnvois(),
      ]);
      setOrigines(listeOrigines);
      setEnvois(historique);
    } catch (err) {
      if (isForbidden(err)) setErreurEnvois('Lecture des transferts non autorisée (droit TRANSFERTS : VOIR requis).');
      else setErreurEnvois(messageErreur(err, 'Impossible de charger les transferts.'));
    } finally {
      setChargementEnvois(false);
    }
  }, [envoisPossibles, sessionId]);

  // ----- Destinataire : reçus -----
  const [recus, setRecus] = useState<TransfertVue[]>([]);
  const [chargementRecus, setChargementRecus] = useState(false);
  const [erreurRecus, setErreurRecus] = useState('');
  const [detail, setDetail] = useState<DetailTransfert | null>(null);
  const [detailEnCours, setDetailEnCours] = useState<number | null>(null);
  const [traitement, setTraitement] = useState<number | null>(null);
  const [acceptation, setAcceptation] = useState<TransfertVue | null>(null);

  const chargerRecus = useCallback(async () => {
    setChargementRecus(true);
    setErreurRecus('');
    try {
      setRecus(await loadRecus());
    } catch (err) {
      if (isForbidden(err)) setErreurRecus('Lecture des transferts non autorisée (droit TRANSFERTS : VOIR requis).');
      else setErreurRecus(messageErreur(err, 'Impossible de charger les transferts reçus.'));
    } finally {
      setChargementRecus(false);
    }
  }, []);

  useEffect(() => {
    void chargerEnvois();
    void chargerRecus();
  }, [chargerEnvois, chargerRecus]);

  const envoyer = async (origine: OrigineTransfert) => {
    if (sessionId == null) return;
    const code = normaliserCode(codes[origine.etablissementOrigine] ?? '');
    if (!code) {
      await showError('Code incomplet', 'Le code de transfert comporte 8 caractères (lettres et chiffres), par exemple K7F3-9QZT.');
      return;
    }
    setEnCours(origine.etablissementOrigine);
    try {
      const destinataire = await resoudreDestinataire(code);
      const recap = recapitulatifEnvoi(sessionName, origine, destinataire);
      const confirme = await confirmAction({
        title: 'Envoyer les données de cet établissement ?',
        text: `${recap.lignes.join(' · ')}. Le destinataire devra accepter le transfert avant toute création de données chez lui.`,
        confirmText: 'Envoyer',
        icon: 'question',
      });
      if (!confirme) return;
      await envoyerTransfert(sessionId, origine.etablissementOrigine, code);
      setCodes((prev) => ({ ...prev, [origine.etablissementOrigine]: '' }));
      toastSuccess(`Transfert envoyé à ${recap.destinataire}.`);
      await chargerEnvois();
    } catch (err) {
      await showError('Envoi impossible', messageErreur(err, 'Une erreur inattendue est survenue.'));
    } finally {
      setEnCours(null);
    }
  };

  const annuler = async (origine: OrigineTransfert) => {
    const dernier = origine.dernierEnvoi;
    if (!dernier || dernier.statut !== 'EN_ATTENTE') return;
    const confirme = await confirmAction({
      title: 'Annuler ce transfert ?',
      text: `L’envoi vers ${dernier.destinataireNom ?? 'le destinataire'} (${origine.etablissementOrigine}, ${origine.effectif} élève${origine.effectif > 1 ? 's' : ''}) ne pourra plus être accepté.`,
      confirmText: 'Annuler le transfert',
      cancelText: 'Garder',
      icon: 'warning',
    });
    if (!confirme) return;
    setEnCours(origine.etablissementOrigine);
    try {
      await annulerTransfert(dernier.id);
      toastSuccess('Transfert annulé.');
      await chargerEnvois();
    } catch (err) {
      await showError('Annulation impossible', messageErreur(err, 'Une erreur inattendue est survenue.'));
    } finally {
      setEnCours(null);
    }
  };

  const ouvrirDetail = async (transfert: TransfertVue) => {
    if (detail?.transfert.id === transfert.id) {
      setDetail(null);
      return;
    }
    setDetailEnCours(transfert.id);
    try {
      setDetail(await loadDetail(transfert.id));
    } catch (err) {
      await showError('Détail indisponible', messageErreur(err, 'Impossible de lire le paquet transféré.'));
    } finally {
      setDetailEnCours(null);
    }
  };

  const accepter = async (transfert: TransfertVue) => {
    const confirme = await confirmAvecMotCle({
      title: 'Accepter ce transfert ?',
      lignes: [
        `Centre d’examen : ${transfert.sourceNom}${transfert.sourceVille ? ` (${transfert.sourceVille})` : ''}`,
        `Session : ${transfert.sessionNom}${transfert.anneeLibelle ? ` — ${transfert.anneeLibelle}` : ''}`,
        `Établissement d’origine déclaré : ${transfert.etablissementOrigine}`,
        `Effectif : ${transfert.effectif} élève${transfert.effectif > 1 ? 's' : ''}`,
        'Une session interne, ses classes, matières, élèves et notes seront créées dans votre base.',
        'Votre code de transfert actuel sera invalidé et remplacé par un nouveau.',
      ],
      motCle: 'ACCEPTER',
      confirmText: 'Accepter le transfert',
    });
    if (!confirme) return;
    setTraitement(transfert.id);
    try {
      const resultat = await accepterTransfert(transfert.id);
      setAcceptation(resultat);
      setDetail(null);
      toastSuccess('Transfert accepté : la session a été créée dans votre base.');
      await chargerRecus();
      onRecusChanged?.();
    } catch (err) {
      await showError('Acceptation impossible', messageErreur(err, 'Une erreur inattendue est survenue.'));
    } finally {
      setTraitement(null);
    }
  };

  const refuser = async (transfert: TransfertVue) => {
    const motif = await demanderTexte({
      title: 'Refuser ce transfert ?',
      text: `${transfert.sourceNom} — ${transfert.sessionNom} — ${transfert.etablissementOrigine} (${transfert.effectif} élève${transfert.effectif > 1 ? 's' : ''}). Le motif, facultatif, sera visible du centre d’examen. Votre code de transfert reste valable.`,
      placeholder: 'Motif du refus (facultatif)',
      confirmText: 'Refuser le transfert',
      maxLength: 500,
    });
    if (motif === null) return;
    setTraitement(transfert.id);
    try {
      await refuserTransfert(transfert.id, motif);
      setDetail(null);
      toastSuccess('Transfert refusé.');
      await chargerRecus();
      onRecusChanged?.();
    } catch (err) {
      await showError('Refus impossible', messageErreur(err, 'Une erreur inattendue est survenue.'));
    } finally {
      setTraitement(null);
    }
  };

  const historique = useMemo(
    () => (seulementSession && sessionId != null ? envois.filter((t) => t.sessionSourceId === sessionId) : envois),
    [envois, seulementSession, sessionId],
  );
  const compteRecus = useMemo(() => compterParStatut(recus), [recus]);

  const exporterCsv = () => {
    const nom = `transferts_${(seulementSession && sessionName ? sessionName : 'historique').replace(/[^\w-]+/g, '_')}.csv`;
    telechargerCsv(csvHistorique(historique), nom);
  };

  // Coefficient par matière du paquet (celui des lignes des élèves ; première ligne trouvée).
  const coefficientsPaquet = useMemo(() => {
    const coefs = new Map<number, number>();
    for (const eleve of detail?.paquet.eleves ?? []) {
      for (const ligne of eleve.lignes) if (!coefs.has(ligne.matiereId)) coefs.set(ligne.matiereId, ligne.coefficient);
    }
    return coefs;
  }, [detail]);

  const onglets: { id: OngletTransferts; label: string; icon: string; badge?: number }[] = [
    { id: 'envois', label: 'Envoyer (centre d’examen)', icon: 'outbox' },
    { id: 'recus', label: 'Transferts reçus', icon: 'move_to_inbox', badge: compteRecus.EN_ATTENTE },
  ];

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <header className="bg-white rounded p-4 md:p-6 shadow-sm border border-[#eaedff] flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#0051d5] bg-[#eaedff] px-2.5 py-1 rounded">
            Examen blanc inter-établissements
          </span>
          <h2 className="text-[18px] md:text-[22px] font-bold text-[#00236f] mt-1.5">Transferts de données d’examen</h2>
          <p className="text-[13px] text-[#444651] mt-0.5">
            Le centre d’examen envoie à chaque établissement d’origine les notes et le classement de ses élèves ; l’établissement
            les accepte avec son code de transfert personnel et retrouve une session complète dans sa base.
          </p>
        </div>
        <div className="flex items-center gap-1 bg-[#f2f3ff] p-1 rounded border border-[#eaedff]" role="tablist">
          {onglets.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={onglet === item.id}
              onClick={() => setOnglet(item.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-semibold transition-colors ${
                onglet === item.id ? 'bg-white text-[#00236f] shadow-xs' : 'text-[#444651] hover:text-[#131b2e]'
              }`}
              data-testid={`onglet-transferts-${item.id}`}
            >
              <span className="material-symbols-outlined text-base">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge ? (
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#ba1a1a] text-white font-bold">{item.badge}</span>
              ) : null}
            </button>
          ))}
        </div>
      </header>

      {acceptation && (
        <div className="bg-[#dcfce7] border border-[#86efac] rounded p-4 flex flex-wrap items-start gap-3 text-[13px] text-[#166534]" role="status" data-testid="bandeau-acceptation">
          <span className="material-symbols-outlined text-xl">task_alt</span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-bold">Transfert accepté : la session « {acceptation.sessionNom} — Centre {acceptation.sourceNom} » a été créée.</p>
            <p>
              Les bulletins s’impriment avec la charte de votre établissement (en-tête, cachet, signatures) et affichent le rang
              à l’examen commun. Les notes proviennent du centre et ne se modifient pas.
              {!aUnLogo && ' Ajoutez le logo de votre établissement dans Profil › Charte graphique pour qu’il figure sur les bulletins.'}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {onOpenSession && acceptation.sessionCreeeId != null && (
                <button type="button" onClick={() => onOpenSession(acceptation.sessionCreeeId as number)} className={success}>
                  <span className="material-symbols-outlined text-base">open_in_new</span>
                  <span>Ouvrir la session</span>
                </button>
              )}
              {!aUnLogo && onOpenProfil && (
                <button type="button" onClick={onOpenProfil} className={ghost}>
                  <span className="material-symbols-outlined text-base">add_photo_alternate</span>
                  <span>Ajouter mon logo</span>
                </button>
              )}
              <button type="button" onClick={() => setAcceptation(null)} className={ghost}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {onglet === 'envois' && (
        <>
          <Carte
            titre="Établissements d’origine de la session"
            icon="school"
            testId="transferts-origines"
            actions={(
              <span className="text-[11px] text-[#444651]">
                {envoisPossibles ? <>Session : <strong className="text-[#00236f]">{sessionName}</strong>{centreExamen ? <> · centre : <strong className="text-[#00236f]">{centreExamen}</strong></> : null}</> : null}
              </span>
            )}
          >
            {!envoisPossibles ? (
              <p className="text-[12px] text-[#444651] bg-[#f2f3ff] border border-[#eaedff] rounded px-3 py-2">
                La session active n’est pas une session inter-établissements : seul le centre d’examen d’une telle session peut
                envoyer des données. Choisissez une session inter-établissements dans la barre latérale.
              </p>
            ) : erreurEnvois ? (
              <p role="alert" className="text-[12px] text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">{erreurEnvois}</p>
            ) : chargementEnvois && origines.length === 0 ? (
              <p className="text-[12px] text-[#444651]">Chargement…</p>
            ) : origines.length === 0 ? (
              <p className="text-[12px] text-[#444651]">
                Aucun candidat d’un autre établissement dans cette session : renseignez l’établissement d’origine des candidats
                (import ou fiche élève) pour pouvoir transférer leurs résultats.
              </p>
            ) : (
              <div className="overflow-x-auto -mx-4 md:mx-0">
                <table className="w-full text-[12px] min-w-[720px]">
                  <thead>
                    <tr className="bg-[#f2f3ff] text-[#444651] uppercase text-[10.5px] tracking-wider">
                      <th className="text-left px-3 py-2 font-semibold">Établissement d’origine</th>
                      <th className="text-right px-3 py-2 font-semibold">Effectif</th>
                      <th className="text-right px-3 py-2 font-semibold">Notes</th>
                      <th className="text-left px-3 py-2 font-semibold">Dernier envoi</th>
                      {peutEnvoyer && <th className="text-left px-3 py-2 font-semibold">Code du destinataire</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eaedff]">
                    {origines.map((origine) => {
                      const dernier = origine.dernierEnvoi;
                      const occupe = enCours === origine.etablissementOrigine;
                      return (
                        <tr key={origine.etablissementOrigine} data-testid="ligne-origine">
                          <td className="px-3 py-2 font-semibold text-[#00236f]">{origine.etablissementOrigine}</td>
                          <td className="px-3 py-2 text-right font-mono">{origine.effectif}</td>
                          <td className="px-3 py-2 text-right font-mono">{origine.notesSaisies}</td>
                          <td className="px-3 py-2">
                            {dernier ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="flex items-center gap-2"><BadgeStatut statut={dernier.statut} /><span className="text-[#444651]">{dateCourte(dernier.envoyeLe)}</span></span>
                                <span className="text-[#444651]">→ {dernier.destinataireNom ?? '—'}{dernier.motifRefus ? ` · motif : ${dernier.motifRefus}` : ''}</span>
                              </div>
                            ) : <span className="text-[#9ca3af] italic">Jamais envoyé</span>}
                          </td>
                          {peutEnvoyer && (
                            <td className="px-3 py-2">
                              {dernier?.statut === 'EN_ATTENTE' ? (
                                <button type="button" onClick={() => void annuler(origine)} disabled={occupe} className={danger}>
                                  <span className="material-symbols-outlined text-base">cancel_schedule_send</span>
                                  <span>Annuler l’envoi</span>
                                </button>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    aria-label={`Code de transfert du destinataire pour ${origine.etablissementOrigine}`}
                                    placeholder="K7F3-9QZT"
                                    maxLength={12}
                                    value={codes[origine.etablissementOrigine] ?? ''}
                                    onChange={(e) => setCodes((prev) => ({ ...prev, [origine.etablissementOrigine]: e.target.value }))}
                                    className={`${field} w-36`}
                                    data-testid="champ-code-destinataire"
                                  />
                                  <button type="button" onClick={() => void envoyer(origine)} disabled={occupe} className={primary} data-testid="bouton-envoyer-transfert">
                                    <span className="material-symbols-outlined text-base">send</span>
                                    <span>{occupe ? 'Envoi…' : 'Envoyer'}</span>
                                  </button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {envoisPossibles && !peutEnvoyer && (
              <p className="text-[11px] text-[#444651]">Lecture seule : l’envoi requiert le droit TRANSFERTS : ENVOYER.</p>
            )}
          </Carte>

          <Carte
            titre="Historique des envois"
            icon="history"
            testId="transferts-historique"
            actions={(
              <div className="flex flex-wrap items-center gap-2">
                {sessionId != null && (
                  <label className="inline-flex items-center gap-1.5 text-[11px] text-[#444651] font-semibold">
                    <input type="checkbox" checked={seulementSession} onChange={(e) => setSeulementSession(e.target.checked)} className="accent-[#0051d5]" />
                    Cette session uniquement
                  </label>
                )}
                <button type="button" onClick={exporterCsv} disabled={historique.length === 0} className={ghost} data-testid="export-csv-transferts">
                  <span className="material-symbols-outlined text-base">download</span>
                  <span>Export CSV</span>
                </button>
              </div>
            )}
          >
            {historique.length === 0 ? (
              <p className="text-[12px] text-[#444651]">Aucun envoi{seulementSession && sessionId != null ? ' pour cette session' : ''}.</p>
            ) : (
              <div className="overflow-x-auto -mx-4 md:mx-0">
                <table className="w-full text-[12px] min-w-[760px]">
                  <thead>
                    <tr className="bg-[#f2f3ff] text-[#444651] uppercase text-[10.5px] tracking-wider">
                      <th className="text-left px-3 py-2 font-semibold">Destinataire</th>
                      <th className="text-left px-3 py-2 font-semibold">Origine</th>
                      <th className="text-right px-3 py-2 font-semibold">Effectif</th>
                      <th className="text-left px-3 py-2 font-semibold">Session</th>
                      <th className="text-left px-3 py-2 font-semibold">Envoyé le</th>
                      <th className="text-left px-3 py-2 font-semibold">Statut</th>
                      <th className="text-left px-3 py-2 font-semibold">Traitement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eaedff]">
                    {historique.map((t) => (
                      <tr key={t.id}>
                        <td className="px-3 py-2 font-semibold text-[#00236f]">{t.destinationNom}{t.destinationVille ? <span className="text-[#444651] font-normal"> · {t.destinationVille}</span> : null}</td>
                        <td className="px-3 py-2">{t.etablissementOrigine}</td>
                        <td className="px-3 py-2 text-right font-mono">{t.effectif}</td>
                        <td className="px-3 py-2">{t.sessionNom}{t.anneeLibelle ? <span className="text-[#444651]"> ({t.anneeLibelle})</span> : null}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{dateCourte(t.envoyeLe)}{t.envoyeParNom ? <span className="text-[#444651]"> · {t.envoyeParNom}</span> : null}</td>
                        <td className="px-3 py-2"><BadgeStatut statut={t.statut} /></td>
                        <td className="px-3 py-2 text-[#444651]">
                          {t.traiteLe ? dateCourte(t.traiteLe) : '—'}
                          {t.traiteParNom ? ` · ${t.traiteParNom}` : ''}
                          {t.motifRefus ? <span className="block italic">Motif : {t.motifRefus}</span> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Carte>
        </>
      )}

      {onglet === 'recus' && (
        <Carte
          titre="Transferts reçus"
          icon="move_to_inbox"
          testId="transferts-recus"
          actions={(
            <div className="flex items-center gap-2 text-[11px] text-[#444651]">
              <span>{compteRecus.EN_ATTENTE} en attente</span>
              <span>·</span>
              <span>{compteRecus.ACCEPTE} accepté{compteRecus.ACCEPTE > 1 ? 's' : ''}</span>
              <span>·</span>
              <span>{compteRecus.REFUSE} refusé{compteRecus.REFUSE > 1 ? 's' : ''}</span>
              <button type="button" onClick={() => void chargerRecus()} className={ghost} title="Actualiser">
                <span className="material-symbols-outlined text-base">refresh</span>
              </button>
            </div>
          )}
        >
          {erreurRecus ? (
            <p role="alert" className="text-[12px] text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">{erreurRecus}</p>
          ) : chargementRecus && recus.length === 0 ? (
            <p className="text-[12px] text-[#444651]">Chargement…</p>
          ) : recus.length === 0 ? (
            <p className="text-[12px] text-[#444651]">
              Aucun transfert reçu. Communiquez votre code de transfert (Profil de l’établissement) au centre d’examen qui accueille
              vos élèves : ses envois apparaîtront ici.
            </p>
          ) : (
            <ul className="space-y-3">
              {recus.map((t) => {
                const ouvert = detail?.transfert.id === t.id;
                const occupe = traitement === t.id;
                return (
                  <li key={t.id} className="rounded border border-[#eaedff] bg-[#faf8ff] p-3 md:p-4 space-y-3" data-testid="transfert-recu">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <BadgeStatut statut={t.statut} />
                          <span className="text-[13px] font-bold text-[#00236f]">{t.sessionNom}{t.anneeLibelle ? ` — ${t.anneeLibelle}` : ''}</span>
                        </div>
                        <p className="text-[12px] text-[#444651]">
                          Centre d’examen : <strong className="text-[#131b2e]">{t.sourceNom}</strong>{t.sourceVille ? ` (${t.sourceVille})` : ''} ·
                          origine déclarée : <strong className="text-[#131b2e]">{t.etablissementOrigine}</strong> ·
                          <strong className="text-[#131b2e]"> {t.effectif}</strong> élève{t.effectif > 1 ? 's' : ''}
                        </p>
                        <p className="text-[11px] text-[#444651]">
                          Envoyé le {dateCourte(t.envoyeLe)}{t.envoyeParNom ? ` par ${t.envoyeParNom}` : ''}
                          {t.traiteLe ? ` · traité le ${dateCourte(t.traiteLe)}${t.traiteParNom ? ` par ${t.traiteParNom}` : ''}` : ''}
                          {t.motifRefus ? ` · motif : ${t.motifRefus}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => void ouvrirDetail(t)} disabled={detailEnCours === t.id} className={ghost} data-testid="bouton-detail-transfert">
                          <span className="material-symbols-outlined text-base">{ouvert ? 'expand_less' : 'visibility'}</span>
                          <span>{ouvert ? 'Masquer' : 'Aperçu'}</span>
                        </button>
                        {t.statut === 'EN_ATTENTE' && peutTraiter && (
                          <>
                            <button type="button" onClick={() => void refuser(t)} disabled={occupe} className={danger} data-testid="bouton-refuser-transfert">
                              <span className="material-symbols-outlined text-base">block</span>
                              <span>Refuser</span>
                            </button>
                            <button type="button" onClick={() => void accepter(t)} disabled={occupe} className={success} data-testid="bouton-accepter-transfert">
                              <span className="material-symbols-outlined text-base">task_alt</span>
                              <span>{occupe ? 'Traitement…' : 'Accepter'}</span>
                            </button>
                          </>
                        )}
                        {t.statut === 'ACCEPTE' && t.sessionCreeeId != null && onOpenSession && (
                          <button type="button" onClick={() => onOpenSession(t.sessionCreeeId as number)} className={ghost}>
                            <span className="material-symbols-outlined text-base">open_in_new</span>
                            <span>Ouvrir la session</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {ouvert && detail && (
                      <div className="bg-white rounded border border-[#eaedff] p-3 space-y-3" data-testid="detail-transfert">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                          <div><span className="block uppercase font-bold text-[#444651]">Type d’examen</span><span className="text-[#131b2e]">{detail.paquet.typeExamenLibelle || detail.paquet.typeExamenCode || '—'}</span></div>
                          <div><span className="block uppercase font-bold text-[#444651]">Matières</span><span className="text-[#131b2e]">{detail.paquet.matieres.length}</span></div>
                          <div><span className="block uppercase font-bold text-[#444651]">Groupes de classement</span><span className="text-[#131b2e]">{detail.paquet.groupes.map((g) => `${g.niveau ?? ''}${g.serie ? ` ${g.serie}` : ''} (${g.effectif})`).join(', ') || '—'}</span></div>
                          <div><span className="block uppercase font-bold text-[#444651]">Généré le</span><span className="text-[#131b2e]">{dateCourte(detail.paquet.genereLe)}</span></div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {detail.paquet.matieres.map((m) => (
                            <span key={m.id} className="inline-flex items-center gap-1 rounded bg-[#f2f3ff] border border-[#eaedff] px-2 py-0.5 text-[11px] text-[#00236f] font-semibold">
                              {m.nom}
                              <span className="font-mono text-[#444651]">× {coefficientsPaquet.get(m.id) ?? '—'}</span>
                            </span>
                          ))}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-[12px] min-w-[640px]">
                            <thead>
                              <tr className="bg-[#f2f3ff] text-[#444651] uppercase text-[10.5px] tracking-wider">
                                <th className="text-left px-2 py-1.5 font-semibold">N°</th>
                                <th className="text-left px-2 py-1.5 font-semibold">Élève</th>
                                <th className="text-left px-2 py-1.5 font-semibold">Niveau / série</th>
                                <th className="text-right px-2 py-1.5 font-semibold">Notes</th>
                                <th className="text-right px-2 py-1.5 font-semibold">Moyenne</th>
                                <th className="text-right px-2 py-1.5 font-semibold">Rang (examen)</th>
                                <th className="text-left px-2 py-1.5 font-semibold">Mention</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#eaedff]">
                              {detail.paquet.eleves.map((e) => (
                                <tr key={e.id}>
                                  <td className="px-2 py-1.5 font-mono">{e.numeroTable ?? '—'}</td>
                                  <td className="px-2 py-1.5 font-semibold text-[#00236f]">{e.nomComplet}<span className="text-[#444651] font-normal"> · {e.genre}{e.dateNaissance ? ` · ${e.dateNaissance}` : ''}</span></td>
                                  <td className="px-2 py-1.5">{e.niveau ?? '—'}{e.serie ? ` ${e.serie}` : ''}</td>
                                  <td className="px-2 py-1.5 text-right font-mono">{e.lignes.filter((l) => l.note != null).length}</td>
                                  <td className="px-2 py-1.5 text-right font-mono font-bold">{fmt(e.stat?.moyenne)}</td>
                                  <td className="px-2 py-1.5 text-right font-mono">{e.stat?.rang != null ? `${e.stat.rang} / ${e.stat.effectifGroupe ?? '—'}` : '—'}</td>
                                  <td className="px-2 py-1.5">{e.stat?.mention ?? '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {!peutTraiter && recus.some((t) => t.statut === 'EN_ATTENTE') && (
            <p className="text-[11px] text-[#444651]">Lecture seule : accepter ou refuser requiert le droit TRANSFERTS : TRAITER.</p>
          )}
        </Carte>
      )}
    </div>
  );
};
