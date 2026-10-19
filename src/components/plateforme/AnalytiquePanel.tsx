import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { isPlatformOwner } from '../../api/client';
import { loadAnalytique, type AnalytiqueVue, type StatutAbonnementAnalytique } from '../../api/plateforme';
import {
  completerSerie,
  formatDateUtc,
  formatEntier,
  formatFcfa,
  formatHorodatageUtc,
  formatTaux,
  formatVariation,
  moisDepuisInstant,
  PERIODES_REVENUS,
  resumerRevenus,
  type PeriodeRevenus,
} from '../../utils/analytique';
import { GraphiqueInscriptions } from './GraphiqueInscriptions';

const ghost = 'inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded bg-[#f2f3ff] text-[#444651] text-[12px] font-semibold hover:bg-[#e2e7ff] transition-colors disabled:opacity-50';

type Teinte = 'bleu' | 'vert' | 'ambre' | 'rouge' | 'gris' | 'violet';

const TEINTES: Record<Teinte, string> = {
  bleu: 'text-[#0051d5] bg-[#eaedff]',
  vert: 'text-[#166534] bg-[#dcfce7]',
  ambre: 'text-[#8a4b00] bg-[#fff3e0]',
  rouge: 'text-[#ba1a1a] bg-[#ffdad6]',
  gris: 'text-[#444651] bg-[#eef0f6]',
  violet: 'text-[#5b21b6] bg-[#ede9fe]',
};

interface CarteProps {
  label: string;
  valeur: number | null | undefined;
  icon: string;
  detail?: string;
  /** Action au clic (ex. ouvrir la page Abonnements filtrée) ; absente → carte statique. */
  onClick?: () => void;
  teinte?: Teinte;
  testId?: string;
}

export const Carte: React.FC<CarteProps> = ({ label, valeur, icon, detail, onClick, teinte = 'bleu', testId }) => {
  const contenu = (
    <>
      <div className="flex items-start gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#444651] leading-tight">
        <span className={`material-symbols-outlined text-base rounded p-0.5 shrink-0 ${TEINTES[teinte]}`}>{icon}</span>
        <span>{label}</span>
      </div>
      <p className="mt-2 text-[22px] font-bold text-[#00236f] leading-none tabular-nums">{formatEntier(valeur)}</p>
      {detail && <p className="mt-1 text-[11px] text-[#444651] leading-tight">{detail}</p>}
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        data-testid={testId}
        className="text-left bg-white border border-[#eaedff] rounded p-4 shadow-xs hover:border-[#0051d5] hover:shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0051d5]"
        title="Ouvrir la liste des abonnements filtrée sur ce statut"
      >
        {contenu}
      </button>
    );
  }
  return <div className="bg-white border border-[#eaedff] rounded p-4 shadow-xs" data-testid={testId}>{contenu}</div>;
};

export const Section: React.FC<{ titre: string; sousTitre?: string; icon: string; children: React.ReactNode; actions?: React.ReactNode; testId?: string }> = ({
  titre, sousTitre, icon, children, actions, testId,
}) => (
  <section className="bg-white p-4 md:p-5 rounded border border-[#eaedff] shadow-xs space-y-4" data-testid={testId}>
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eaedff] pb-3">
      <div className="flex items-start gap-3 min-w-0">
        <span className="shrink-0 w-9 h-9 rounded bg-[#eaedff] text-[#0051d5] flex items-center justify-center">
          <span className="material-symbols-outlined text-xl">{icon}</span>
        </span>
        <div className="min-w-0">
          <h3 className="text-[14px] font-bold text-[#00236f] uppercase tracking-wide">{titre}</h3>
          {sousTitre && <p className="text-[12px] text-[#444651] mt-0.5">{sousTitre}</p>}
        </div>
      </div>
      {actions}
    </header>
    {children}
  </section>
);

/** Info-bulle accessible : résumé au survol (`title`) et texte complet dépliable au clavier. */
const InfoBulle: React.FC<{ texte: string; libelle?: string }> = ({ texte, libelle = 'Définition' }) => (
  <details className="relative inline-block text-[11px] font-normal normal-case tracking-normal align-middle">
    <summary
      className="list-none cursor-pointer inline-flex items-center gap-1 text-[#0051d5] hover:underline select-none [&::-webkit-details-marker]:hidden"
      title={texte}
      aria-label={`${libelle} (afficher)`}
    >
      <span className="material-symbols-outlined text-[16px]" aria-hidden="true">info</span>
      <span>{libelle}</span>
    </summary>
    <p className="mt-1 max-w-prose rounded border border-[#eaedff] bg-[#f8f9ff] p-2 text-[#131b2e] leading-snug">{texte}</p>
  </details>
);

const Variation: React.FC<{ valeur: number | null; libelleReference: string }> = ({ valeur, libelleReference }) => {
  const couleur = valeur == null ? 'text-[#444651]' : valeur > 0 ? 'text-[#166534]' : valeur < 0 ? 'text-[#ba1a1a]' : 'text-[#444651]';
  const icone = valeur == null ? 'remove' : valeur > 0 ? 'trending_up' : valeur < 0 ? 'trending_down' : 'trending_flat';
  return (
    <span className={`inline-flex items-center gap-1 text-[12px] font-semibold ${couleur}`}>
      <span className="material-symbols-outlined text-base" aria-hidden="true">{icone}</span>
      {valeur == null ? 'Variation non calculable (base nulle)' : `${formatVariation(valeur)} vs ${libelleReference}`}
    </span>
  );
};

interface AnalytiquePanelProps {
  /**
   * Ouvre la page Abonnements filtrée sur un statut (cartes cliquables). Absente tant que la page
   * n'expose pas de filtre : les cartes restent alors de simples compteurs.
   */
  onOuvrirAbonnements?: (statut: StatutAbonnementAnalytique) => void;
}

/**
 * Tableau de bord analytique du propriétaire du logiciel : statuts d'abonnement, revenus déclarés et
 * confirmés, churn 30 jours, inscriptions sur 12 mois. Aucune valeur n'est estimée côté client : tout vient
 * de `GET /api/plateforme/analytique`, le client totalise et formate.
 */
export const AnalytiquePanel: React.FC<AnalytiquePanelProps> = ({ onOuvrirAbonnements }) => {
  const proprietaire = isPlatformOwner();
  const [vue, setVue] = useState<AnalytiqueVue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [periode, setPeriode] = useState<PeriodeRevenus>('mois-courant');

  const charger = useCallback(() => {
    if (!proprietaire) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    loadAnalytique()
      .then(setVue)
      .catch((err: Error) => setError(err.message || 'Impossible de charger le tableau de bord analytique.'))
      .finally(() => setLoading(false));
  }, [proprietaire]);

  useEffect(charger, [charger]);

  const moisCourant = vue ? moisDepuisInstant(vue.calculeLe) : null;
  const serie = useMemo(() => (vue && moisCourant ? completerSerie(vue.inscriptions, moisCourant) : []), [vue, moisCourant]);
  const revenus = useMemo(() => (vue && moisCourant ? resumerRevenus(vue.revenus, periode, moisCourant) : null), [vue, moisCourant, periode]);

  if (!proprietaire) {
    return (
      <div className="bg-white border border-[#eaedff] rounded p-6 text-[13px] text-[#444651]">
        Le tableau de bord analytique est réservé au propriétaire de la plateforme.
      </div>
    );
  }

  const inscritsDouzeMois = serie.reduce((acc, p) => acc + p.inscriptions, 0);
  const lien = (statut: StatutAbonnementAnalytique) => (onOuvrirAbonnements ? () => onOuvrirAbonnements(statut) : undefined);
  const aucunRevenu = vue ? vue.revenus.every((m) => m.declares === 0 && m.confirmes === 0 && m.nbDeclarations === 0 && m.nbConfirmations === 0) : true;

  return (
    <div className="space-y-4" data-testid="analytique-panel">
      <div className="bg-white rounded border border-[#eaedff] shadow-xs p-3 md:px-5 flex flex-wrap items-center justify-between gap-3">
        <div className="text-[12px] text-[#444651] min-w-0">
          {vue ? (
            <span>
              Calculé à <strong className="text-[#131b2e]">{formatHorodatageUtc(vue.calculeLe)}</strong>
              {' '}· mois civils et fenêtres glissantes en temps universel (UTC).
            </span>
          ) : (
            <span>Indicateurs calculés par le serveur en temps universel (UTC).</span>
          )}
        </div>
        <button type="button" onClick={charger} disabled={loading} className={ghost} data-testid="analytique-actualiser">
          <span className={`material-symbols-outlined text-base ${loading ? 'animate-spin' : ''}`}>refresh</span>
          {loading ? 'Actualisation…' : 'Actualiser'}
        </button>
      </div>

      {loading && !vue && (
        <div className="bg-white border border-[#eaedff] rounded p-6 text-[13px] text-[#444651]" role="status">
          Calcul des indicateurs…
        </div>
      )}

      {error && (
        <div className="bg-white border border-[#ffdad6] rounded p-4 text-[13px] text-[#ba1a1a] flex flex-wrap items-center justify-between gap-3" role="alert">
          <span>{error}</span>
          <button type="button" onClick={charger} className={ghost}>Réessayer</button>
        </div>
      )}

      {vue && revenus && (
        <>
          {/* Cartes */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3" data-testid="analytique-cartes">
            <Carte label="Actifs" valeur={vue.cartes.actifs} icon="verified" teinte="vert" detail="Abonnement payé en cours" onClick={lien('ACTIF')} testId="carte-actifs" />
            <Carte label="En essai" valeur={vue.cartes.essai} icon="hourglass_top" teinte="bleu" detail="Période d’essai en cours" onClick={lien('ESSAI')} testId="carte-essai" />
            <Carte label="En attente de paiement" valeur={vue.cartes.enAttentePaiement} icon="pending_actions" teinte="ambre" detail="Inscrits, aucun paiement activé" onClick={lien('EN_ATTENTE_PAIEMENT')} testId="carte-attente" />
            <Carte label="Suspendus" valeur={vue.cartes.suspendus} icon="block" teinte="rouge" detail="Suspendus par la plateforme" onClick={lien('SUSPENDU')} testId="carte-suspendus" />
            <Carte label="Expirés" valeur={vue.cartes.expires} icon="event_busy" teinte="gris" detail="Période et grâce dépassées" onClick={lien('EXPIRE')} testId="carte-expires" />
            <Carte label="Total inscrits" valeur={vue.cartes.total} icon="domain" teinte="violet" detail={`${formatEntier(inscritsDouzeMois)} sur les 12 derniers mois`} testId="carte-total" />
          </div>

          {/* Revenus */}
          <Section
            titre="Revenus"
            sousTitre={`Montants en ${vue.devise}, mois civils UTC. « Déclarés » ≠ « encaissés » : seules les activations et prolongations confirmées par vous valent encaissement.`}
            icon="payments"
            testId="analytique-revenus"
            actions={(
              <div role="radiogroup" aria-label="Période des revenus" className="inline-flex rounded border border-[#eaedff] bg-[#f2f3ff] p-0.5">
                {PERIODES_REVENUS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={periode === p.id}
                    onClick={() => setPeriode(p.id)}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold whitespace-nowrap transition-colors ${
                      periode === p.id ? 'bg-[#00236f] text-white shadow-xs' : 'text-[#444651] hover:bg-[#e2e7ff]'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          >
            <p className="text-[12px] text-[#444651]">
              Période : <strong className="text-[#131b2e]">{revenus.libelle}</strong> · comparée à {revenus.libelleReference}.
              {' '}<InfoBulle texte={vue.definitionRevenus} />
            </p>
            {aucunRevenu ? (
              <div className="border border-dashed border-[#dce1ff] rounded p-6 text-center">
                <p className="text-[13px] font-semibold text-[#00236f]">Aucune donnée</p>
                <p className="text-[12px] text-[#444651]">Aucune déclaration de paiement ni activation sur les 6 derniers mois.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded border border-[#eaedff] bg-[#fffaf0] p-4 space-y-1.5" data-testid="revenus-declares">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#8a4b00]">
                    <span className="material-symbols-outlined text-base">receipt_long</span>
                    Déclarés par les établissements
                  </div>
                  <p className="text-[22px] md:text-[26px] font-bold text-[#00236f] leading-none tabular-nums">{formatFcfa(revenus.total.declares)}</p>
                  <p className="text-[12px] text-[#444651]">
                    {formatEntier(revenus.total.nbDeclarations)} déclaration{revenus.total.nbDeclarations > 1 ? 's' : ''} · {revenus.libelleReference} : {formatFcfa(revenus.reference.declares)}
                  </p>
                  <Variation valeur={revenus.variationDeclares} libelleReference={revenus.libelleReference} />
                </div>
                <div className="rounded border border-[#eaedff] bg-[#f0fdf4] p-4 space-y-1.5" data-testid="revenus-confirmes">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#166534]">
                    <span className="material-symbols-outlined text-base">task_alt</span>
                    Encaissés / confirmés (activations, prolongations)
                  </div>
                  <p className="text-[22px] md:text-[26px] font-bold text-[#00236f] leading-none tabular-nums">{formatFcfa(revenus.total.confirmes)}</p>
                  <p className="text-[12px] text-[#444651]">
                    {formatEntier(revenus.total.nbConfirmations)} activation{revenus.total.nbConfirmations > 1 ? 's' : ''} · {revenus.libelleReference} : {formatFcfa(revenus.reference.confirmes)}
                  </p>
                  <Variation valeur={revenus.variationConfirmes} libelleReference={revenus.libelleReference} />
                </div>
              </div>
            )}
          </Section>

          {/* Churn */}
          <Section
            titre="Churn 30 jours"
            sousTitre={`Fenêtre glissante du ${formatDateUtc(vue.churn.debutFenetre)} au ${formatDateUtc(vue.churn.finFenetre)} (UTC).`}
            icon="person_off"
            testId="analytique-churn"
            actions={<InfoBulle texte={vue.churn.definition} libelle="Définition exacte" />}
          >
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded border border-[#eaedff] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#444651]">Taux</p>
                <p className="mt-1 text-[22px] font-bold text-[#00236f] leading-none tabular-nums" data-testid="churn-taux">
                  {formatTaux(vue.churn.taux)}
                </p>
                {vue.churn.taux == null && <p className="mt-1 text-[11px] text-[#444651]">Aucun établissement en service il y a 30 jours.</p>}
              </div>
              <div className="rounded border border-[#eaedff] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#444651]">Perdus</p>
                <p className="mt-1 text-[22px] font-bold text-[#ba1a1a] leading-none tabular-nums">{formatEntier(vue.churn.perdus)}</p>
                <p className="mt-1 text-[11px] text-[#444651]">Expirés ou suspendus sans retour</p>
              </div>
              <div className="rounded border border-[#eaedff] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#444651]">Base</p>
                <p className="mt-1 text-[22px] font-bold text-[#00236f] leading-none tabular-nums">{formatEntier(vue.churn.enServiceIlYA30Jours)}</p>
                <p className="mt-1 text-[11px] text-[#444651]">En service il y a 30 jours</p>
              </div>
            </div>
            {vue.churn.etablissements.length === 0 ? (
              <p className="text-[12px] text-[#444651]">Aucun établissement perdu sur la fenêtre.</p>
            ) : (
              <details className="text-[12px]" data-testid="churn-liste">
                <summary className="cursor-pointer text-[#0051d5] font-semibold select-none">
                  Établissements concernés ({formatEntier(vue.churn.etablissements.length)})
                </summary>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[320px] text-left text-[12px] border border-[#eaedff]">
                    <thead className="bg-[#f2f3ff] text-[10px] uppercase tracking-wider text-[#444651]">
                      <tr>
                        <th scope="col" className="px-3 py-2 font-semibold">Établissement</th>
                        <th scope="col" className="px-3 py-2 font-semibold">Date (UTC)</th>
                        <th scope="col" className="px-3 py-2 font-semibold">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vue.churn.etablissements.map((e) => (
                        <tr key={e.id} className="border-t border-[#eaedff]">
                          <td className="px-3 py-1.5 font-medium text-[#131b2e]">{e.nom}</td>
                          <td className="px-3 py-1.5 tabular-nums">{formatDateUtc(e.date)}</td>
                          <td className="px-3 py-1.5">
                            <span className={`inline-flex items-center text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                              e.statut === 'SUSPENDU' ? 'bg-[#ffdad6] text-[#ba1a1a]' : 'bg-[#eef0f6] text-[#444651]'
                            }`}>
                              {e.statutLibelle}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </Section>

          {/* Inscriptions */}
          <Section
            titre="Inscriptions sur 12 mois glissants"
            sousTitre="Nouveaux établissements par mois civil (UTC) d’après la date de création du compte, et cumul des inscriptions."
            icon="bar_chart"
            testId="analytique-inscriptions"
          >
            <GraphiqueInscriptions serie={serie} sansDate={vue.sansDateInscription} />
          </Section>
        </>
      )}
    </div>
  );
};
