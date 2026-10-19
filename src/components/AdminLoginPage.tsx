import React, { useEffect, useRef, useState } from 'react';
import { ApiError, isPlatformAccount, isUnavailable, loginPlateforme, setSession } from '../api/client';
import type { AuthSession } from '../api/client';
import { isPlausibleEmail } from '../utils/safeUrl';
import { ROUTE_PATHS } from '../utils/router';
import { LiensLegaux } from './legal/LiensLegaux';

interface AdminLoginPageProps {
  /** Retour au site vitrine (`/`). */
  onBack: () => void;
  /** Appelé une fois la session d’un compte de la plateforme enregistrée. */
  onConnecte: (session: AuthSession) => void;
}

export const TITRE_ONGLET_ADMIN = 'Administration — AcademiaBlanc';
export const MESSAGE_IDENTIFIANTS_ADMIN = 'Email ou mot de passe incorrect';
export const MESSAGE_SERVEUR_INJOIGNABLE_ADMIN =
  'Serveur injoignable ou en cours de démarrage, réessayez dans une minute';
export const MESSAGE_COMPTE_NON_PLATEFORME =
  'Ce compte n’est pas un compte d’administration de la plateforme. Utilisez /connexion.';
/** Délai au-delà duquel on prévient que l’hébergement gratuit de l’API se réveille (Render). */
const DELAI_NOTE_REVEIL_MS = 3000;

/**
 * Phrase française pour une erreur de `loginPlateforme`. Le 401 « plateforme non initialisée » du
 * serveur est repris tel quel : il désigne une configuration manquante, pas un mauvais mot de passe.
 */
export function messageErreurConnexionAdmin(err: unknown): string {
  // Aucune réponse (réseau coupé, délai dépassé) ou passerelle 502/503/504 : serveur endormi ou arrêté.
  if (isUnavailable(err) || !(err instanceof ApiError)) return MESSAGE_SERVEUR_INJOIGNABLE_ADMIN;
  if (err.status === 401) {
    return /non initialis/i.test(err.message) ? err.message : MESSAGE_IDENTIFIANTS_ADMIN;
  }
  if (err.status === 403) return err.message || MESSAGE_COMPTE_NON_PLATEFORME;
  return err.message || MESSAGE_SERVEUR_INJOIGNABLE_ADMIN;
}

/**
 * Page `/admin` : entrée dédiée à la plateforme, connexion seulement (aucune création de compte),
 * non référencée depuis la vitrine. Seuls les rôles SUPER_ADMIN et GESTIONNAIRE_PLATEFORME ouvrent
 * l’application ; un compte d’établissement est refusé sans que son jeton soit conservé.
 */
export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({ onBack, onConnecte }) => {
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);
  const [serveurLent, setServeurLent] = useState(false);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const titrePrecedent = document.title;
    document.title = TITRE_ONGLET_ADMIN;
    // Page d’administration : jamais indexée, sans toucher au `index.html` partagé avec la vitrine.
    const robots = document.createElement('meta');
    robots.setAttribute('name', 'robots');
    robots.setAttribute('content', 'noindex');
    document.head.appendChild(robots);
    return () => {
      document.title = titrePrecedent;
      robots.remove();
    };
  }, []);

  useEffect(() => () => {
    if (minuteur.current) clearTimeout(minuteur.current);
  }, []);

  const terminerChargement = () => {
    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = null;
    setChargement(false);
    setServeurLent(false);
  };

  const soumettre = async (event: React.FormEvent) => {
    event.preventDefault();
    if (chargement) return;
    setErreur('');
    const identifiant = email.trim().toLowerCase();
    if (!isPlausibleEmail(identifiant) || !motDePasse) {
      setErreur('Email et mot de passe sont obligatoires.');
      return;
    }

    setChargement(true);
    setServeurLent(false);
    minuteur.current = setTimeout(() => setServeurLent(true), DELAI_NOTE_REVEIL_MS);
    try {
      const session = await loginPlateforme(identifiant, motDePasse);
      terminerChargement();
      // Double garde côté client : un serveur plus ancien pourrait répondre sans filtrer le rôle.
      if (!isPlatformAccount(session)) {
        setErreur(MESSAGE_COMPTE_NON_PLATEFORME);
        return;
      }
      setSession(session);
      onConnecte(session);
    } catch (err) {
      terminerChargement();
      setErreur(messageErreurConnexionAdmin(err));
    }
  };

  const lienRetour = (
    <a
      href={ROUTE_PATHS.vitrine}
      onClick={(event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onBack();
      }}
      className="inline-flex items-center gap-1 text-[12px] text-[#6b7280] underline-offset-2 hover:text-[#1f2430] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f2430] rounded"
    >
      <span className="material-symbols-outlined text-sm" aria-hidden="true">arrow_back</span>
      <span>Retour au site</span>
    </a>
  );

  const champ =
    'w-full rounded-md border border-[#d6d9e0] bg-white px-3 py-2.5 text-[14px] text-[#1f2430] outline-none transition-colors placeholder:text-[#9aa0ad] focus:border-[#1f2430] focus:ring-2 focus:ring-[#1f2430]/15 disabled:bg-[#f4f5f7] disabled:text-[#6b7280]';
  const libelle = 'block text-[12px] font-semibold text-[#3b4252] mb-1.5';

  return (
    <div className="min-h-dvh bg-[#f4f5f7] text-[#1f2430] antialiased flex flex-col">
      <header className="bg-[#1b2230] text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/10 border border-white/15">
              <span className="material-symbols-outlined text-xl" aria-hidden="true">shield_person</span>
            </span>
            <h1 className="text-[15px] font-semibold tracking-tight leading-tight">
              Administration de la plateforme — AcademiaBlanc
            </h1>
          </div>
          <span className="hidden sm:inline-flex items-center rounded-full border border-white/20 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-white/80">
            Accès réservé
          </span>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <section
          aria-labelledby="admin-connexion-titre"
          className="w-full max-w-md rounded-xl border border-[#e2e5ea] bg-white p-6 sm:p-8 shadow-[0_1px_2px_rgba(16,24,40,0.06),0_8px_24px_-12px_rgba(16,24,40,0.18)]"
        >
          <h2 id="admin-connexion-titre" className="text-[20px] font-semibold tracking-tight">
            Connexion
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-[#6b7280]">
            Réservée au propriétaire du logiciel et aux gestionnaires de la plateforme.
            Les établissements se connectent depuis le site.
          </p>

          <form onSubmit={soumettre} noValidate className="mt-6 space-y-4">
            <div>
              <label htmlFor="admin-email" className={libelle}>Email</label>
              <input
                id="admin-email"
                type="email"
                autoComplete="username"
                inputMode="email"
                placeholder="administrateur@exemple.tg"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={chargement}
                className={champ}
              />
            </div>
            <div>
              <label htmlFor="admin-mot-de-passe" className={libelle}>Mot de passe</label>
              <input
                id="admin-mot-de-passe"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                disabled={chargement}
                className={champ}
              />
            </div>

            {erreur && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-[#f1c0c0] bg-[#fdf3f3] px-3 py-2.5 text-[13px] text-[#9b1c1c]"
              >
                <span className="material-symbols-outlined text-base mt-px" aria-hidden="true">error</span>
                <span>{erreur}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={chargement}
              aria-busy={chargement}
              className="w-full rounded-md bg-[#1b2230] px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#2a3346] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1b2230] disabled:cursor-not-allowed disabled:bg-[#6b7280]"
            >
              {chargement ? 'Connexion…' : 'Se connecter'}
            </button>

            {chargement && serveurLent && (
              <p role="status" className="text-center text-[12px] text-[#6b7280]">
                Le serveur se réveille, jusqu’à une minute…
              </p>
            )}
          </form>

          <div className="mt-6 border-t border-[#eceef2] pt-4 text-center">
            {lienRetour}
          </div>
        </section>
      </main>

      <footer className="px-4 py-3 text-center text-[11px] text-[#9aa0ad] space-y-1">
        <p>AcademiaBlanc • Accès d’administration de la plateforme</p>
        <LiensLegaux nouvelOnglet />
      </footer>
    </div>
  );
};

export default AdminLoginPage;
