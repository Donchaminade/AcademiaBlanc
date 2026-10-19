import React, { useState } from 'react';
import { Candidate } from '../types';

interface SignatureModalProps {
  candidate: Candidate;
  onClose: () => void;
  onSign: (signedAt: string, signer: string, shaHash: string) => void;
}

export const SignatureModal: React.FC<SignatureModalProps> = ({
  candidate,
  onClose,
  onSign,
}) => {
  const [signerName, setSignerName] = useState('Dr. Aminata Traoré');
  const [role, setRole] = useState('Proviseure de l\'Établissement');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleConfirm = async () => {
    const name = signerName.trim();
    const title = role.trim();
    if (name.length < 3 || title.length < 3) return;
    setIsProcessing(true);
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const payload = JSON.stringify({
      matricule: candidate.matricule,
      table: candidate.tableNumber,
      name: candidate.fullName,
      signer: name,
      role: title,
      signedAt: dateStr,
    });
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
    const shaHash = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    onSign(dateStr, `${name} (${title})`, shaHash);
    setIsProcessing(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 border border-[#eaedff] space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#eaedff]">
          <div className="flex items-center gap-2 text-[#00236f]">
            <span className="material-symbols-outlined text-xl">draw</span>
            <span className="font-bold text-[16px]">Signature Numérique Certifiée</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#444651] hover:text-[#131b2e] transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="space-y-3">
          <div className="p-3 bg-[#f2f3ff] rounded border border-[#eaedff]">
            <p className="text-[11px] uppercase font-bold text-[#444651]">Document Cible</p>
            <p className="text-[13px] font-bold text-[#00236f] mt-0.5">
              Relevé de notes - Table {candidate.tableNumber} : {candidate.fullName}
            </p>
            <p className="font-mono text-[11px] text-[#444651] mt-0.5">
              Matricule : {candidate.matricule}{candidate.serie ? ` • ${candidate.serie}` : ''}
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-[#444651] mb-1">
              Signataire autorisée
            </label>
            <input
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              className="w-full bg-[#f2f3ff] text-[13px] font-semibold text-[#131b2e] py-2 px-3 rounded border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-[#444651] mb-1">
              Titre / Qualité
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-[#f2f3ff] text-[13px] text-[#131b2e] py-2 px-3 rounded border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5]"
            />
          </div>

          <div className="p-3 bg-[#faf8ff] rounded border border-[#eaedff] space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#0051d5]">
              <span className="material-symbols-outlined text-sm">verified</span>
              <span>Certificat X.509 de l'État</span>
            </div>
            <p className="text-[11px] text-[#444651] leading-relaxed">
              L'application du sceau apposera un hash SHA-256 et verrouillera les notes de ce candidat contre toute altération ultérieure.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#eaedff]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded text-[12px] font-medium text-[#444651] hover:bg-[#f2f3ff] transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleConfirm}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#00236f] text-white text-[12px] font-bold hover:bg-[#1e3a8a] transition-all shadow-xs disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm">verified_user</span>
            <span>{isProcessing ? 'Scellement en cours...' : 'Apposer le Sceau & Signer'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
