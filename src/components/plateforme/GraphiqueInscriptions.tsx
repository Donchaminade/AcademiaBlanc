import React, { useId } from 'react';
import {
  echelleGraphique,
  formatEntier,
  hauteurPct,
  initialeMois,
  libelleMoisCourt,
  libelleMoisLong,
  type PointInscription,
} from '../../utils/analytique';

interface GraphiqueInscriptionsProps {
  /** Série déjà complétée sur 12 mois, du plus ancien au plus récent. */
  serie: PointInscription[];
  /** Établissements sans date d'inscription, comptés dans le cumul initial (mention sous le graphique). */
  sansDate?: number;
}

/** Hauteur de la zone tracée (px) ; les valeurs des barres s'écrivent dans la marge haute. */
const HAUTEUR_TRACE = 200;
const MARGE_HAUTE = 22;

/**
 * Évolution des inscriptions sur 12 mois glissants : barres CSS (nouveaux établissements par mois) et
 * ligne SVG du cumul, sans bibliothèque de graphiques, dans l'esprit du graphique du bilan des archives.
 * Responsive dès 360 px (12 colonnes de ~22 px), valeurs écrites, tableau de données en repli.
 */
export const GraphiqueInscriptions: React.FC<GraphiqueInscriptionsProps> = ({ serie, sansDate = 0 }) => {
  const idTitre = useId();
  const idResume = useId();
  const maxInscriptions = Math.max(0, ...serie.map((p) => p.inscriptions));
  const maxCumul = Math.max(0, ...serie.map((p) => p.cumul));
  const vide = serie.length === 0 || (maxInscriptions === 0 && maxCumul === 0);
  const echelleBarres = echelleGraphique(maxInscriptions);
  const echelleCumul = echelleGraphique(maxCumul);
  const n = serie.length;

  const pointsLigne = serie
    .map((p, i) => `${(((i + 0.5) / Math.max(1, n)) * 100).toFixed(3)},${(100 - hauteurPct(p.cumul, echelleCumul)).toFixed(3)}`)
    .join(' ');

  const resume = vide
    ? 'Aucune inscription sur les 12 derniers mois.'
    : serie.map((p) => `${libelleMoisLong(p.mois)} : ${p.inscriptions} inscription${p.inscriptions > 1 ? 's' : ''}, cumul ${p.cumul}`).join(' ; ');

  if (vide) {
    return (
      <div className="border border-dashed border-[#dce1ff] rounded p-8 text-center" data-testid="graphique-vide">
        <span className="material-symbols-outlined text-3xl text-[#0051d5]">bar_chart</span>
        <p className="text-[13px] font-semibold text-[#00236f] mt-1">Aucune donnée</p>
        <p className="text-[12px] text-[#444651]">Aucun établissement inscrit sur les 12 derniers mois.</p>
      </div>
    );
  }

  return (
    <figure className="space-y-3" aria-labelledby={idTitre} data-testid="graphique-inscriptions">
      <figcaption id={idTitre} className="sr-only">
        Évolution des inscriptions d’établissements sur 12 mois glissants
      </figcaption>
      <p id={idResume} className="sr-only">{resume}</p>

      <div className="flex items-stretch" role="img" aria-describedby={idResume} aria-label="Graphique des inscriptions par mois et du cumul">
        {/* Axe gauche : nouveaux établissements */}
        <div className="relative w-7 shrink-0 text-[10px] text-[#444651] tabular-nums" style={{ height: HAUTEUR_TRACE + MARGE_HAUTE }} aria-hidden="true">
          {echelleBarres.graduations.map((g) => (
            <span
              key={g}
              className="absolute right-1 leading-none"
              style={{ bottom: `${(g / echelleBarres.plafond) * HAUTEUR_TRACE}px`, transform: 'translateY(50%)' }}
            >
              {formatEntier(g)}
            </span>
          ))}
        </div>

        {/* Zone tracée */}
        <div className="relative flex-1 min-w-0" style={{ height: HAUTEUR_TRACE + MARGE_HAUTE }}>
          <div className="absolute inset-x-0 bottom-0" style={{ height: HAUTEUR_TRACE }}>
            {/* Grille horizontale */}
            {echelleBarres.graduations.map((g) => (
              <div
                key={g}
                aria-hidden="true"
                className={`absolute inset-x-0 border-t ${g === 0 ? 'border-[#9aa3c7]' : 'border-dashed border-[#e3e7fb]'}`}
                style={{ bottom: `${(g / echelleBarres.plafond) * 100}%` }}
              />
            ))}

            {/* Barres */}
            <div className="absolute inset-0 flex items-end gap-[3px] sm:gap-2 px-1 sm:px-3" aria-hidden="true">
              {serie.map((p) => {
                const h = hauteurPct(p.inscriptions, echelleBarres);
                return (
                  <div key={p.mois} className="flex-1 min-w-0 h-full flex flex-col items-center justify-end" title={`${libelleMoisLong(p.mois)} : ${p.inscriptions} nouveau(x), cumul ${p.cumul}`}>
                    <span className={`text-[10px] sm:text-[11px] font-bold leading-none mb-1 tabular-nums ${p.inscriptions > 0 ? 'text-[#00236f]' : 'text-[#9aa3c7]'}`}>
                      {formatEntier(p.inscriptions)}
                    </span>
                    <div
                      className={`w-full max-w-[34px] rounded-t-sm ${p.inscriptions > 0 ? 'bg-gradient-to-t from-[#00236f] to-[#0051d5]' : 'border border-dashed border-[#c5cbe8]'}`}
                      style={{ height: p.inscriptions > 0 ? `${h}%` : '2px' }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Ligne du cumul (coordonnées en % ; trait non déformé) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polyline points={pointsLigne} fill="none" stroke="#b45309" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
              {serie.map((p, i) => (
                <span
                  key={p.mois}
                  className="absolute w-2 h-2 rounded-full bg-white border-2 border-[#b45309] -translate-x-1/2 translate-y-1/2"
                  style={{ left: `${((i + 0.5) / n) * 100}%`, bottom: `${hauteurPct(p.cumul, echelleCumul)}%` }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Axe droit : cumul */}
        <div className="relative w-8 shrink-0 text-[10px] text-[#b45309] tabular-nums" style={{ height: HAUTEUR_TRACE + MARGE_HAUTE }} aria-hidden="true">
          {echelleCumul.graduations.map((g) => (
            <span
              key={g}
              className="absolute left-1 leading-none"
              style={{ bottom: `${(g / echelleCumul.plafond) * HAUTEUR_TRACE}px`, transform: 'translateY(50%)' }}
            >
              {formatEntier(g)}
            </span>
          ))}
        </div>
      </div>

      {/* Libellés des mois et valeurs du cumul */}
      <div className="flex" aria-hidden="true">
        <div className="w-7 shrink-0" />
        <div className="flex-1 min-w-0 flex gap-[3px] sm:gap-2 px-1 sm:px-3">
          {serie.map((p, i) => {
            const nouvelleAnnee = i === 0 || p.mois.slice(0, 4) !== serie[i - 1].mois.slice(0, 4);
            return (
              <div key={p.mois} className="flex-1 min-w-0 text-center leading-tight">
                <div className="text-[10px] sm:text-[11px] font-semibold text-[#131b2e] truncate">
                  <span className="sm:hidden">{initialeMois(p.mois)}</span>
                  <span className="hidden sm:inline">{libelleMoisCourt(p.mois)}</span>
                </div>
                <div className={`text-[9px] sm:text-[10px] text-[#444651] truncate ${nouvelleAnnee ? '' : 'invisible'}`}>
                  <span className="sm:hidden">’{p.mois.slice(2, 4)}</span>
                  <span className="hidden sm:inline">{p.mois.slice(0, 4)}</span>
                </div>
                <div className="mt-1 text-[9px] sm:text-[10px] font-bold text-[#b45309] tabular-nums truncate" title="Cumul">{formatEntier(p.cumul)}</div>
              </div>
            );
          })}
        </div>
        <div className="w-8 shrink-0" />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#444651]">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-gradient-to-t from-[#00236f] to-[#0051d5]" aria-hidden="true" />
          Nouveaux établissements inscrits dans le mois (axe de gauche)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-4 border-t-2 border-[#b45309]" aria-hidden="true" />
          Cumul des inscriptions (axe de droite)
        </span>
        {sansDate > 0 && (
          <span className="basis-full text-[#444651]">
            Le cumul initial inclut {formatEntier(sansDate)} établissement{sansDate > 1 ? 's' : ''} sans date d’inscription connue (compte antérieur au suivi des dates).
          </span>
        )}
      </div>

      <details className="text-[12px]">
        <summary className="cursor-pointer text-[#0051d5] font-semibold select-none">Données du graphique (tableau)</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[360px] text-left text-[12px] border border-[#eaedff]">
            <caption className="sr-only">Inscriptions par mois et cumul sur 12 mois glissants</caption>
            <thead className="bg-[#f2f3ff] text-[10px] uppercase tracking-wider text-[#444651]">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">Mois</th>
                <th scope="col" className="px-3 py-2 font-semibold text-right">Nouveaux inscrits</th>
                <th scope="col" className="px-3 py-2 font-semibold text-right">Cumul</th>
              </tr>
            </thead>
            <tbody>
              {serie.map((p) => (
                <tr key={p.mois} className="border-t border-[#eaedff]">
                  <th scope="row" className="px-3 py-1.5 font-medium text-[#131b2e]">{libelleMoisLong(p.mois)}</th>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatEntier(p.inscriptions)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatEntier(p.cumul)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
};
