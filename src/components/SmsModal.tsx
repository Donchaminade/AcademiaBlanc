import React, { useState } from 'react';
import { Candidate, CandidateComputedStats } from '../types';

interface SmsModalProps {
  candidate: Candidate;
  stats: CandidateComputedStats;
  onClose: () => void;
  onSent: (msg: string) => void;
}

export const SmsModal: React.FC<SmsModalProps> = ({
  candidate,
  stats,
  onClose,
  onSent,
}) => {
  const [phone, setPhone] = useState(candidate.parentPhone);
  const [email, setEmail] = useState(candidate.parentEmail);
  const [includeDetails, setIncludeDetails] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const defaultMessage = `[ACADEMIABLANCS DEXCO] Relevé officiel de ${candidate.fullName} (Table ${candidate.tableNumber}): Moyenne ${stats.average.toFixed(2)}/20, Rang ${stats.rank}e/138, Décision: ${stats.decision}. Mention: ${stats.mention}. Téléchargez le bulletin officiel certifié sur: https://academiablanc.gouv.ci/v/${candidate.matricule}`;

  const [message, setMessage] = useState(defaultMessage);

  const handleSend = () => {
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      onSent(`SMS & Notification transmis avec succès au numéro ${phone} et à ${email}`);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
      <div className="bg-white rounded-lg shadow-2xl max-w-xl w-full p-6 border border-[#eaedff] space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#eaedff]">
          <div className="flex items-center gap-2 text-[#00236f]">
            <span className="material-symbols-outlined text-xl">send_to_mobile</span>
            <span className="font-bold text-[16px]">Notification aux Parents &amp; Tuteurs</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#444651] hover:text-[#131b2e] transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3 text-[12px]">
            <div>
              <label className="block font-bold text-[#444651] uppercase text-[11px] mb-1">
                Numéro Mobile SMS
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-[#f2f3ff] font-mono py-1.5 px-3 rounded border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#444651] uppercase text-[11px] mb-1">
                Adresse Email Tuteur
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#f2f3ff] py-1.5 px-3 rounded border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5]"
              />
            </div>

            <div className="pt-1">
              <label className="block font-bold text-[#444651] uppercase text-[11px] mb-1">
                Texte du Message SMS
              </label>
              <textarea
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full bg-[#f2f3ff] text-[12px] p-2 rounded border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5] resize-none leading-relaxed"
              ></textarea>
              <span className="text-[10px] text-[#444651] block text-right mt-1 font-mono">
                {message.length} caractères (1 SMS GSM-7)
              </span>
            </div>
          </div>

          {/* Smartphone Simulator Preview */}
          <div className="bg-[#131b2e] rounded-xl p-3 text-white flex flex-col justify-between shadow-md">
            <div>
              <div className="flex items-center justify-between text-[10px] text-gray-400 pb-2 border-b border-gray-700">
                <span>DEXCO-OFFICIEL</span>
                <span className="font-mono">18:42</span>
              </div>
              <div className="mt-3 bg-[#1e3a8a] text-white p-2.5 rounded-lg text-[11px] leading-relaxed shadow-xs">
                {message}
              </div>
            </div>

            <div className="mt-3 pt-2 text-center text-[10px] text-gray-400">
              Passerelle SMS Nationale DEXCO • Priorité Haute
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#eaedff]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded text-[12px] font-medium text-[#444651] hover:bg-[#f2f3ff]"
          >
            Fermer
          </button>
          <button
            type="button"
            disabled={isSending}
            onClick={handleSend}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#0051d5] text-white text-[12px] font-bold hover:bg-[#003ea8] transition-all shadow-xs disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm">send</span>
            <span>{isSending ? 'Envoi en cours...' : 'Envoyer SMS & Email'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
