import { impressionAutorisee } from './verrouImpression';

export type PrintMode =
  | 'all-bulletins'
  | 'single-bulletin'
  | 'emargement'
  | 'candidats'
  | 'registre'
  | 'archives'
  | 'page';

/**
 * Ouvre le dialogue d'impression (Enregistrer au format PDF) sur une zone précise.
 * Résout `false` sans ouvrir le dialogue quand l'abonnement de l'établissement est en lecture seule
 * (garde `verrouImpression`, posée depuis l'état renvoyé par le serveur).
 */
export function printDocument(mode: PrintMode, filename: string): boolean {
  if (!impressionAutorisee()) return false;
  const previousTitle = document.title;
  document.body.setAttribute('data-print-mode', mode);
  const safe = filename.replace(/[^\p{L}\p{N}\s._-]+/gu, '').trim() || 'document';
  document.title = safe;

  const cleanup = () => {
    document.body.removeAttribute('data-print-mode');
    document.title = previousTitle;
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
  return true;
}
