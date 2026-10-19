/**
 * Garde d'impression / téléchargement, sans React : posée par l'état d'abonnement reçu du serveur
 * (`lectureSeule`), consultée par `printDocument` avant tout `window.print()` et par les boutons
 * Imprimer / PDF / CSV pour se griser. Le serveur reste la source de vérité ; cette garde ne fait que
 * refléter sa réponse.
 */

interface Verrou {
  actif: boolean;
  motif: string;
}

let verrou: Verrou = { actif: false, motif: '' };
const abonnes = new Set<() => void>();

export function definirVerrouImpression(actif: boolean, motif = ''): void {
  if (verrou.actif === actif && verrou.motif === (actif ? motif : '')) return;
  verrou = { actif, motif: actif ? motif : '' };
  abonnes.forEach((listener) => listener());
}

export function impressionAutorisee(): boolean {
  return !verrou.actif;
}

export function motifVerrouImpression(): string {
  return verrou.motif;
}

export function onVerrouImpressionChange(listener: () => void): () => void {
  abonnes.add(listener);
  return () => {
    abonnes.delete(listener);
  };
}

/** Instantané pour `useSyncExternalStore` (chaîne stable). */
export function instantaneVerrouImpression(): string {
  return verrou.actif ? `1|${verrou.motif}` : '0|';
}
