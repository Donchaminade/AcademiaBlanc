import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { isPlatformOwner } from '../../api/client';
import { loadAnalytique, type AnalytiqueVue } from '../../api/plateforme';
import { completerSerie, formatEntier, formatHorodatageUtc, moisDepuisInstant } from '../../utils/analytique';
import { GraphiqueInscriptions } from './GraphiqueInscriptions';

const ghost = 'inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded bg-[#f2f3ff] text-[#444651] text-[12px] font-semibold hover:bg-[#e2e7ff] transition-colors disabled:opacity-50';

interface CarteProps {
  label: string;
  valeur: number | null | undefined;
  icon: string;
  detail?: string;
  /** Action au clic (ex. ouvrir la page Abonnements filtrée) ; absente → carte statique. */
  onClick?: () => void;
  teinte?: 'bleu' | 'vert' | 'ambre' | 'rouge' | 'gris';
}

const TEINTES: Record<NonNullable<CarteProps['teinte']>, string> = {
  bleu: 'text-[#0051d5] bg-[#eaedff]',
  vert: 'text-[#166534] bg-[#dcfce7]',
  ambre: 'text-[#8a4b00] bg-[#fff3e0]',
  rouge: 'text-[#ba1a1a] bg-[#ffdad6]',
  gris: 'text-[#444651] bg-[#eef0f6]',
};

export const Carte: React.FC<CarteProps> = ({ label, valeur, icon, detail, onClick, teinte = 'bleu' }) => {
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
        className="text-left bg-white border border-[#eaedff] rounded p-4 shadow-xs hover:border-[#0051d5] hover:shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0051d5]"
        title="Ouvrir la liste correspondante"
      >
        {contenu}
      </button>
    );
  }
  return <div className="bg-white border border-[#eaedff] rounded p-4 shadow-xs">{contenu}</div>;
};

export const Section: React.FC<{ titre: string; sousTitre?: string; icon: string; children: React.ReactNode; actions?: React.ReactNode }> = ({
  titre, sousTitre, icon, children, actions,
}) => (
  <section className="bg-white p-4 md:p-5 rounded border border-[#eaedff] shadow-xs space-y-4">
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

/**
 * Tableau de bord analytique du propriétaire du logiciel : inscriptions sur 12 mois, total des
 * établissements. Aucune valeur n'est estimée côté client : tout vient de `GET /api/plateforme/analytique`.
 */
export const AnalytiquePanel: React.FC = () => {
  const proprietaire = isPlatformOwner();
  const [vue, setVue] = useState<AnalytiqueVue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const serie = useMemo(
    () => (vue ? completerSerie(vue.inscriptions, moisDepuisInstant(vue.calculeLe)) : []),
    [vue],
  );

  if (!proprietaire) {
    return (
      <div className="bg-white border border-[#eaedff] rounded p-6 text-[13px] text-[#444651]">
        Le tableau de bord analytique est réservé au propriétaire de la plateforme.
      </div>
    );
  }

  const inscritsDouzeMois = serie.reduce((acc, p) => acc + p.inscriptions, 0);

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

      {vue && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <Carte label="Total inscrits" valeur={vue.totalEtablissements} icon="domain" teinte="bleu" detail="Tous les établissements enregistrés" />
            <Carte label="Inscrits sur 12 mois" valeur={inscritsDouzeMois} icon="person_add" teinte="bleu" detail="Nouveaux comptes des 12 derniers mois" />
          </div>

          <Section
            titre="Inscriptions sur 12 mois glissants"
            sousTitre="Nouveaux établissements par mois civil (UTC) d’après la date de création du compte, et cumul des inscriptions."
            icon="bar_chart"
          >
            <GraphiqueInscriptions serie={serie} sansDate={vue.sansDateInscription} />
          </Section>
        </>
      )}
    </div>
  );
};
