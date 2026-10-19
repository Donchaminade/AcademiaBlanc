import React, { useEffect, useState } from 'react';
import { accepterConditions, loadDerniereAcceptation } from '../../api/acceptations';
import type { DerniereAcceptation } from '../../api/acceptations';
import { VERSION_CONDITIONS, formaterDateAcceptation, versionLisible, versionObsolete } from '../../legal/versions';
import { AcceptationConditions } from './AcceptationConditions';

/** Rôles qui acceptent les conditions au nom de l’établissement (modale bloquante). */
export const ROLES_ACCEPTATION = ['OWNER', 'ADMIN'] as const;

export function peutAccepterConditions(role: string | null | undefined): boolean {
  return (ROLES_ACCEPTATION as readonly string[]).includes((role ?? '').toUpperCase());
}

interface ReacceptationConditionsProps {
  /** Rôle du compte connecté (OWNER, ADMIN, SECRETAIRE, ENSEIGNANT). */
  role: string;
  /** Appelé après enregistrement de la nouvelle acceptation. */
  onAccepte?: () => void;
}

type Etat =
  | { statut: 'verification' }
  | { statut: 'a-jour' }
  | { statut: 'obsolete'; derniere: DerniereAcceptation | null };

/**
 * À l’entrée dans l’espace d’un établissement : compare la dernière version acceptée
 * (`GET /api/etablissement/acceptations/derniere`) à `VERSION_CONDITIONS`.
 * - OWNER / ADMIN : modale bloquante « Les conditions ont été mises à jour » avec case + bouton Accepter
 *   (`POST /api/etablissement/acceptations`) ;
 * - autres rôles : bandeau d’information non bloquant, refermable.
 * Un serveur indisponible ou une API antérieure ne bloque jamais l’accès : rien n’est affiché.
 */
export const ReacceptationConditions: React.FC<ReacceptationConditionsProps> = ({ role, onAccepte }) => {
  const [etat, setEtat] = useState<Etat>({ statut: 'verification' });
  const [coche, setCoche] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [masque, setMasque] = useState(false);

  useEffect(() => {
    let actif = true;
    loadDerniereAcceptation()
      .then((derniere) => {
        if (!actif) return;
        setEtat(versionObsolete(derniere?.versionConditions) ? { statut: 'obsolete', derniere } : { statut: 'a-jour' });
      })
      .catch(() => {
        if (actif) setEtat({ statut: 'a-jour' });
      });
    return () => {
      actif = false;
    };
  }, []);

  if (etat.statut !== 'obsolete' || masque) return null;

  const dernierePhrase = etat.derniere
    ? `Dernière version acceptée : ${etat.derniere.versionConditions} (le ${formaterDateAcceptation(etat.derniere.accepteLe) ?? '—'}).`
    : 'Aucune acceptation des conditions n’est encore enregistrée pour cet établissement.';

  if (!peutAccepterConditions(role)) {
    return (
      <div role="status" className="fixed inset-x-3 top-16 z-40 mx-auto max-w-2xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-900 shadow-lg lg:left-auto lg:right-6 lg:top-6">
        <div className="flex items-start gap-2.5">
          <span className="material-symbols-outlined text-base text-amber-700" aria-hidden="true">info</span>
          <div className="min-w-0 flex-1">
            <p className="font-bold">Les conditions d’utilisation ont été mises à jour (version {VERSION_CONDITIONS}).</p>
            <p className="mt-0.5">
              Le responsable ou un administrateur de l’établissement doit les accepter à sa prochaine connexion. {dernierePhrase}
            </p>
          </div>
          <button type="button" onClick={() => setMasque(true)} className="shrink-0 rounded p-1 text-amber-800 hover:bg-amber-100" aria-label="Fermer">
            <span className="material-symbols-outlined text-base" aria-hidden="true">close</span>
          </button>
        </div>
      </div>
    );
  }

  const accepter = async () => {
    if (!coche || enCours) return;
    setEnCours(true);
    setErreur('');
    try {
      await accepterConditions(VERSION_CONDITIONS);
      setEtat({ statut: 'a-jour' });
      onAccepte?.();
    } catch (err) {
      setErreur(err instanceof Error && err.message.trim() ? err.message : 'Enregistrement impossible. Réessayez.');
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#00236f]/60 p-3 backdrop-blur-sm" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reacceptation-titre"
        aria-describedby="reacceptation-texte"
        className="w-full max-w-lg overflow-hidden rounded-xl border border-[#eaedff] bg-white shadow-2xl"
      >
        <div className="bg-gradient-to-r from-[#00236f] via-[#1e3a8a] to-[#0051d5] px-5 py-4 text-white">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">Documents légaux</p>
          <h2 id="reacceptation-titre" className="text-[18px] font-bold leading-tight">Les conditions ont été mises à jour</h2>
        </div>
        <div className="space-y-4 p-5">
          <p id="reacceptation-texte" className="text-[13px] leading-relaxed text-[#2b3245]">
            Une nouvelle version des Conditions générales d’utilisation, des Conditions d’utilisation et de la Politique de
            confidentialité est en vigueur depuis le <strong>{versionLisible(VERSION_CONDITIONS)}</strong> (version {VERSION_CONDITIONS}).
            En tant que responsable de l’établissement, vous devez en prendre connaissance et les accepter pour continuer.
          </p>
          <p className="text-[12px] text-[#444651]">{dernierePhrase}</p>
          <AcceptationConditions id="reacceptation-case" checked={coche} onChange={setCoche} disabled={enCours} />
          {erreur && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700">{erreur}</p>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void accepter()}
              disabled={!coche || enCours}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#00236f] px-5 py-2.5 text-[13px] font-bold text-white shadow-md transition-all hover:bg-[#1e3a8a] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-base ${enCours ? 'animate-spin' : ''}`} aria-hidden="true">
                {enCours ? 'progress_activity' : 'check_circle'}
              </span>
              <span>{enCours ? 'Enregistrement…' : 'Accepter'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReacceptationConditions;
