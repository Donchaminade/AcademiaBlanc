import { apiDelete, apiGet, apiSend } from './client';

/** Famille d’une série du lycée : générale (A4, C, D…) ou technique (G1, F4…). */
export type FamilleSerie = 'GENERALE' | 'TECHNIQUE';

export interface Serie {
  id: number;
  code: string;
  libelle: string;
  famille: FamilleSerie;
  actif: boolean;
  ordre: number;
}

export interface SeriePayload {
  code: string;
  libelle: string;
  famille: FamilleSerie;
  actif?: boolean;
  ordre?: number;
}

export const FAMILLES: { value: FamilleSerie; label: string; short: string }[] = [
  { value: 'GENERALE', label: 'Séries générales', short: 'Générale' },
  { value: 'TECHNIQUE', label: 'Séries techniques', short: 'Technique' },
];

export const familleLabel = (famille: FamilleSerie | undefined): string =>
  FAMILLES.find((f) => f.value === famille)?.short ?? '—';

/** Regroupe les séries par famille, dans l’ordre Générale puis Technique. */
export function grouperSeries(series: Serie[]): { famille: FamilleSerie; label: string; items: Serie[] }[] {
  return FAMILLES.map((f) => ({
    famille: f.value,
    label: f.label,
    items: series
      .filter((s) => s.famille === f.value)
      .sort((a, b) => a.ordre - b.ordre || a.code.localeCompare(b.code)),
  }));
}

export const listerSeries = () => apiGet<Serie[]>('/api/series');
export const creerSerie = (body: SeriePayload) => apiSend<Serie>('/api/series', 'POST', body);
export const modifierSerie = (id: number, body: SeriePayload) => apiSend<Serie>(`/api/series/${id}`, 'PUT', body);
export const supprimerSerie = (id: number) => apiDelete(`/api/series/${id}`);
export const chargerSeriesDefaut = () => apiSend<Serie[]>('/api/series/defauts', 'POST', {});
