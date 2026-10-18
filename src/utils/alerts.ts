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
