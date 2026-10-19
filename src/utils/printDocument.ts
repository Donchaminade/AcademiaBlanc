export type PrintMode =
  | 'all-bulletins'
  | 'single-bulletin'
  | 'emargement'
  | 'candidats'
  | 'registre'
  | 'archives'
  | 'page';

/** Ouvre le dialogue d'impression (Enregistrer au format PDF) sur une zone précise. */
export function printDocument(mode: PrintMode, filename: string): void {
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
}
