import React, { useEffect, useState } from 'react';
import { chargerHistoriqueAbonnement, rafraichirAbonnement } from '../../api/abonnement';
import { FORFAIT_LABELS, tarifAffiche, tarifDuForfait } from '../../utils/abonnement';
import type { EtatAbonnement, EvenementAbonnement, Forfait } from '../../utils/abonnement';
import { ContactsPaiement } from './ContactsPaiement';
import { DeclarationPaiementForm } from './DeclarationPaiementForm';
import { toastInfo, toastSuccess } from '../../utils/alerts';

interface PaiementActivationScreenProps {
  etat: EtatAbonnement;
  nomEtablissement: string;
  peutDeclarer: boolean;
  /** Appelé quand le serveur signale que l'accès est ouvert (activation ou essai accordé). */
  onActive: () => void;
  onLogout: () => void;
}

/**
 * Écran « Paiement / Activation », affiché après l'inscription et à chaque connexion tant que le compte est
 * EN_ATTENTE_PAIEMENT : récapitulatif forfait + montant, instructions, WhatsApp / Appeler, déclaration
 * « J'ai effectué le paiement » et « Vérifier mon activation ». Aucun accès aux autres écrans tant que le
 * serveur n'a pas ouvert l'accès.
 */
export const PaiementActivationScreen: React.FC<PaiementActivationScreenProps> = ({ etat, nomEtablissement, peutDeclarer, onActive, onLogout }) => {
  const [forfait, setForfait] = useState<Forfait>(etat.forfait ?? etat.forfaitChoisi ?? 'ANNUEL');
  const [declarer, setDeclarer] = useState(false);
  const [verification, setVerification] = useState(false);
  const [declarations, setDeclarations] = useState<EvenementAbonnement[]>([]);

  useEffect(() => {
    chargerHistoriqueAbonnement()
      .then((liste) => setDeclarations(liste.filter((ev) => ev.type === 'DECLARATION_PAIEMENT')))
      .catch(() => setDeclarations([]));
  }, []);

  const montant = tarifDuForfait(forfait, etat.contacts);
  const enAttenteVerification = declarations.some((ev) => ev.statut === 'A_VERIFIER');

  const verifier = async () => {
    setVerification(true);
    try {
      const prochain = await rafraichirAbonnement();
      if (prochain && prochain.acces) {
        toastSuccess('Votre espace est activé. Bienvenue !');
        onActive();
      } else {
        toastInfo('Activation pas encore confirmée : la plateforme vérifie votre paiement.');
      }
    } catch {
      toastInfo('Vérification impossible pour le moment. Réessayez dans un instant.');
    } finally {
      setVerification(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[#faf8ff] text-[#131b2e] antialiased flex flex-col" data-testid="ecran-paiement-activation">
      <header className="border-b border-[#eaedff] bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <span className="flex items-center gap-2 text-[14px] font-bold tracking-tight text-[#00236f] min-w-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#00236f] text-white">
              <span className="material-symbols-outlined text-lg" aria-hidden="true">account_balance</span>
            </span>
            <span className="truncate">{nomEtablissement}</span>
          </span>
          <button
            type="button"
            onClick={onLogout}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-red-700 text-[12px] font-bold border border-red-200 hover:bg-red-50 transition-colors"
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">logout</span>
            <span>Se déconnecter</span>
          </button>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl p-3 sm:p-6 space-y-4">
        <div className="rounded-xl bg-gradient-to-r from-[#00236f] via-[#1e3a8a] to-[#0051d5] text-white p-5 sm:p-6 shadow-lg">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 border border-white/25 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
            <span className="material-symbols-outlined text-[14px]" aria-hidden="true">schedule</span>
            {etat.statutLibelle || 'En attente de paiement'}
          </span>
          <h1 className="mt-2 text-[20px] sm:text-[24px] font-bold tracking-tight">Activez votre espace AcademiaBlanc</h1>
          <p className="mt-1 text-[13px] text-white/85 max-w-2xl">
            Votre compte est créé. Réglez le forfait choisi par mobile money, déclarez le paiement, et la plateforme
            ouvre votre espace après vérification. Vous pouvez aussi nous écrire sur WhatsApp pour demander un essai.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <section className="lg:col-span-2 bg-white rounded-xl border border-[#eaedff] shadow-xs p-4 sm:p-5 space-y-3" data-testid="recap-forfait">
            <h2 className="text-[13px] font-bold uppercase tracking-wide text-[#00236f]">Récapitulatif</h2>
            <div className="rounded-lg border border-[#dce1ff] bg-[#f2f3ff] p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#444651]">Forfait choisi</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="text-[18px] font-bold text-[#00236f]">{FORFAIT_LABELS[forfait]}</p>
                <select
                  aria-label="Changer de forfait"
                  value={forfait}
                  onChange={(e) => setForfait(e.target.value as Forfait)}
                  className="bg-white text-[12px] py-1 px-2 rounded border border-[#dce1ff] outline-none focus:border-[#0051d5]"
                >
                  <option value="ANNUEL">Annuel</option>
                  <option value="MENSUEL">Mensuel</option>
                </select>
              </div>
              <p className="mt-2 text-[22px] font-bold text-[#131b2e] leading-none" data-testid="recap-montant">{tarifAffiche(montant, etat.contacts.devise)}</p>
              <p className="text-[12px] text-[#444651] mt-1">
                {forfait === 'ANNUEL' ? '12 mois d’accès' : '1 mois d’accès'} à compter de l’activation, puis quelques jours de grâce.
              </p>
            </div>
            <ContactsPaiement
              telWhatsapp={etat.contacts.telWhatsapp}
              telAppel={etat.contacts.telAppel}
              beneficiaire={etat.contacts.beneficiaire}
              instructions={etat.contacts.instructions}
              nomEtablissement={nomEtablissement}
              forfait={forfait}
              montant={montant}
              devise={etat.contacts.devise}
            />
          </section>

          <section className="lg:col-span-3 bg-white rounded-xl border border-[#eaedff] shadow-xs p-4 sm:p-5 space-y-3">
            <h2 className="text-[13px] font-bold uppercase tracking-wide text-[#00236f]">Après votre paiement</h2>
            <ol className="space-y-2 text-[13px] text-[#131b2e]">
              {[
                'Effectuez le transfert mobile money vers le bénéficiaire indiqué (montant du forfait).',
                'Cliquez sur « J’ai effectué le paiement » et renseignez la référence de la transaction.',
                'La plateforme vérifie et active votre espace ; cliquez ensuite sur « Vérifier mon activation ».',
              ].map((etape, index) => (
                <li key={etape} className="flex items-start gap-2.5">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-[#00236f] text-white text-[12px] font-bold flex items-center justify-center">{index + 1}</span>
                  <span>{etape}</span>
                </li>
              ))}
            </ol>

            {enAttenteVerification && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] font-semibold text-amber-900" data-testid="declaration-en-attente">
                Votre déclaration de paiement a bien été transmise : elle est en cours de vérification par la plateforme.
              </p>
            )}

            {peutDeclarer && !declarer && (
              <button
                type="button"
                onClick={() => setDeclarer(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#00236f] text-white text-[13px] font-bold hover:bg-[#1e3a8a] transition-colors shadow-xs"
                data-testid="bouton-ouvrir-declaration"
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">task_alt</span>
                <span>J’ai effectué le paiement</span>
              </button>
            )}
            {peutDeclarer && declarer && (
              <div className="rounded-lg border border-[#eaedff] bg-[#faf8ff] p-4">
                <DeclarationPaiementForm
                  forfaitParDefaut={forfait}
                  offre={etat.contacts}
                  onAnnuler={() => setDeclarer(false)}
                  onDeclare={(ev) => {
                    setDeclarer(false);
                    setDeclarations((prev) => [ev, ...prev]);
                  }}
                />
              </div>
            )}
            {!peutDeclarer && (
              <p className="text-[12px] text-[#444651]">Seul le responsable de l’établissement peut déclarer un paiement.</p>
            )}

            <div className="pt-2 border-t border-[#eaedff] flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void verifier()}
                disabled={verification}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0051d5] text-white text-[13px] font-bold hover:bg-[#003cb3] transition-colors shadow-xs disabled:opacity-60 disabled:cursor-wait"
                data-testid="bouton-verifier-activation"
              >
                <span className={`material-symbols-outlined text-base ${verification ? 'animate-spin' : ''}`} aria-hidden="true">{verification ? 'progress_activity' : 'refresh'}</span>
                <span>Vérifier mon activation</span>
              </button>
              <span className="text-[12px] text-[#444651]">Le statut est relu sur le serveur ; aucun accès n’est ouvert depuis ce navigateur.</span>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};
