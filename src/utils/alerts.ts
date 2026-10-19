import Swal, { type SweetAlertIcon, type SweetAlertOptions } from 'sweetalert2';

/**
 * Boîtes de dialogue et toasts SweetAlert2 aux couleurs de l’application.
 * Toutes les fenêtres se ferment au clavier (Échap) et rendent le focus
 * à l’élément qui les a ouvertes.
 */

const baseClasses: SweetAlertOptions['customClass'] = {
  popup: 'rounded-lg border border-[#eaedff] shadow-lg font-inter',
  title: 'text-[18px] font-bold text-[#00236f]',
  htmlContainer: 'text-[13px] text-[#444651]',
  confirmButton:
    'inline-flex items-center justify-center px-4 py-2 rounded bg-[#00236f] text-white text-[12px] font-bold hover:bg-[#1e3a8a] transition-colors mx-1 focus:outline-none focus:ring-2 focus:ring-[#0051d5] focus:ring-offset-2',
  cancelButton:
    'inline-flex items-center justify-center px-4 py-2 rounded bg-[#f2f3ff] text-[#444651] text-[12px] font-semibold hover:bg-[#e2e7ff] transition-colors mx-1 focus:outline-none focus:ring-2 focus:ring-[#0051d5] focus:ring-offset-2',
  actions: 'gap-1',
};

const dangerClasses: SweetAlertOptions['customClass'] = {
  ...baseClasses,
  confirmButton:
    'inline-flex items-center justify-center px-4 py-2 rounded bg-[#ba1a1a] text-white text-[12px] font-bold hover:bg-[#93000a] transition-colors mx-1 focus:outline-none focus:ring-2 focus:ring-[#ba1a1a] focus:ring-offset-2',
};

const Modal = Swal.mixin({
  buttonsStyling: false,
  customClass: baseClasses,
  allowEscapeKey: true,
  allowOutsideClick: true,
  returnFocus: true,
  reverseButtons: true,
  focusConfirm: true,
  confirmButtonText: 'OK',
  cancelButtonText: 'Annuler',
});

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 2500,
  timerProgressBar: true,
  customClass: {
    popup: 'rounded border border-[#eaedff] shadow-md font-inter',
    title: 'text-[13px] font-semibold text-[#131b2e]',
  },
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer);
    toast.addEventListener('mouseleave', Swal.resumeTimer);
  },
});

/** Demande confirmation avant une suppression. Résout `true` si l’utilisateur confirme. */
export async function confirmDelete(label: string, detail?: string): Promise<boolean> {
  const result = await Modal.fire({
    icon: 'warning',
    title: 'Confirmer la suppression',
    html: `Supprimer <strong>« ${escapeHtml(label)} »</strong> ?${detail ? `<br/><span class="text-[12px]">${escapeHtml(detail)}</span>` : ''}`,
    showCancelButton: true,
    confirmButtonText: 'Supprimer',
    cancelButtonText: 'Annuler',
    focusCancel: true,
    focusConfirm: false,
    customClass: dangerClasses,
  });
  return result.isConfirmed;
}

/** Demande confirmation pour une action non destructive (réinitialisation, envoi, etc.). */
export async function confirmAction(options: {
  title: string;
  text?: string;
  confirmText?: string;
  cancelText?: string;
  icon?: SweetAlertIcon;
}): Promise<boolean> {
  const result = await Modal.fire({
    icon: options.icon ?? 'question',
    title: options.title,
    text: options.text,
    showCancelButton: true,
    confirmButtonText: options.confirmText ?? 'Confirmer',
    cancelButtonText: options.cancelText ?? 'Annuler',
  });
  return result.isConfirmed;
}

/**
 * Confirmation forte d'une action irréversible : l'utilisateur doit recopier un mot-clé (« ACCEPTER ») ;
 * le bouton de confirmation n'a jamais le focus par défaut (Entrée seule ne valide pas).
 * `lignes` : récapitulatif affiché au-dessus du champ (texte brut, échappé).
 */
export async function confirmAvecMotCle(options: {
  title: string;
  lignes: string[];
  motCle: string;
  confirmText?: string;
  icon?: SweetAlertIcon;
}): Promise<boolean> {
  const recap = options.lignes.map((l) => `<li>${escapeHtml(l)}</li>`).join('');
  const result = await Modal.fire({
    icon: options.icon ?? 'warning',
    title: options.title,
    html: `<ul class="text-left text-[12px] list-disc pl-5 space-y-0.5">${recap}</ul>`
      + `<p class="mt-3 text-[12px]">Pour confirmer, tapez <strong>${escapeHtml(options.motCle)}</strong> ci-dessous.</p>`,
    input: 'text',
    inputPlaceholder: options.motCle,
    inputAttributes: { autocapitalize: 'characters', autocomplete: 'off', spellcheck: 'false' },
    inputValidator: (value) => (value.trim().toUpperCase() === options.motCle.toUpperCase() ? null : `Tapez exactement ${options.motCle} pour confirmer.`),
    showCancelButton: true,
    confirmButtonText: options.confirmText ?? 'Confirmer',
    cancelButtonText: 'Annuler',
    focusConfirm: false,
    focusCancel: false,
    customClass: dangerClasses,
  });
  return result.isConfirmed;
}

/**
 * Saisie d'un texte facultatif (motif de refus…). Résout `null` si l'utilisateur annule,
 * sinon le texte saisi (éventuellement vide).
 */
export async function demanderTexte(options: {
  title: string;
  text?: string;
  placeholder?: string;
  confirmText?: string;
  maxLength?: number;
}): Promise<string | null> {
  const result = await Modal.fire({
    icon: 'question',
    title: options.title,
    text: options.text,
    input: 'textarea',
    inputPlaceholder: options.placeholder,
    inputAttributes: options.maxLength ? { maxlength: String(options.maxLength) } : undefined,
    showCancelButton: true,
    confirmButtonText: options.confirmText ?? 'Valider',
    cancelButtonText: 'Annuler',
    focusConfirm: false,
    customClass: dangerClasses,
  });
  if (!result.isConfirmed) return null;
  return typeof result.value === 'string' ? result.value : '';
}

/** Toast vert en haut à droite, fermé automatiquement. */
export function toastSuccess(message: string): void {
  void Toast.fire({ icon: 'success', title: message });
}

/** Toast rouge en haut à droite, fermé automatiquement. */
export function toastError(message: string): void {
  void Toast.fire({ icon: 'error', title: message, timer: 4000 });
}

/** Toast bleu d’information. */
export function toastInfo(message: string): void {
  void Toast.fire({ icon: 'info', title: message });
}

/** Fenêtre d’information bloquante. */
export function showInfo(title: string, text?: string): Promise<void> {
  return Modal.fire({ icon: 'info', title, text }).then(() => undefined);
}

/** Fenêtre d’erreur avec le message renvoyé par le serveur. */
export function showError(title: string, text?: string): Promise<void> {
  return Modal.fire({ icon: 'error', title, text }).then(() => undefined);
}

/** Fenêtre de succès bloquante (pour les opérations importantes). */
export function showSuccess(title: string, text?: string): Promise<void> {
  return Modal.fire({ icon: 'success', title, text }).then(() => undefined);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
