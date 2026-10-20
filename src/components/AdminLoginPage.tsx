import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
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

/** Longueur minimale à partir de laquelle l’étape « Identifiants » est cochée (indication visuelle seulement). */
const LONGUEUR_MDP_VISUELLE = 6;
/** Couleurs de la charte AcademiaBlanc (voir `@theme` dans `index.css`). */
const ACCENT = '#316bf3';
const ACCENT_FONCE = '#0051d5';
const VERT = '#22c55e';
const ROUGE = '#ef4444';

type Phase = 'repos' | 'chargement' | 'succes' | 'erreur';

const Coche: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

/** Cadenas dont l’anse peut s’ouvrir. */
const Cadenas: React.FC<{ ouvert: boolean; couleur: string; reduit: boolean }> = ({ ouvert, couleur, reduit }) => (
  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke={couleur} strokeWidth={2} strokeLinecap="round" aria-hidden="true">
    <motion.path
      d="M8 11V7.5a4 4 0 0 1 8 0V11"
      style={{ originX: '16px', originY: '11px' }}
      animate={ouvert ? { y: -4, rotate: reduit ? 0 : -12 } : { y: 0, rotate: 0 }}
      transition={{ duration: 0.2 }}
    />
    <rect x="5.5" y="11" width="13" height="9.5" rx="2.2" fill={couleur} fillOpacity={0.15} />
    <circle cx="12" cy="15.7" r="1.3" fill={couleur} stroke="none" />
  </svg>
);

const ETAPES = ['Identifiants', 'Vérification de sécurité', 'Authentification'] as const;

/**
 * Page `/admin` : entrée dédiée à la plateforme, connexion seulement (aucune création de compte),
 * non référencée depuis la vitrine. Seuls les rôles SUPER_ADMIN et GESTIONNAIRE_PLATEFORME ouvrent
 * l’application ; un compte d’établissement est refusé sans que son jeton soit conservé.
 */
export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({ onBack, onConnecte }) => {
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [voirMdp, setVoirMdp] = useState(false);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);
  const [serveurLent, setServeurLent] = useState(false);
  const [phase, setPhase] = useState<Phase>('repos');
  const [secouer, setSecouer] = useState(0);
  const [sessionOuverte, setSessionOuverte] = useState<AuthSession | null>(null);
  const [formulaireParti, setFormulaireParti] = useState(false);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const minuteursAnim = useRef<ReturnType<typeof setTimeout>[]>([]);
  const reduit = !!useReducedMotion();

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
    minuteursAnim.current.forEach(clearTimeout);
  }, []);

  const plus = (fn: () => void, ms: number) => {
    minuteursAnim.current.push(setTimeout(fn, reduit ? 0 : ms));
  };

  const terminerChargement = () => {
    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = null;
    setChargement(false);
    setServeurLent(false);
  };

  const echouer = (message: string) => {
    setErreur(message);
    setPhase('erreur');
    setSecouer((n) => n + 1);
    plus(() => setPhase((p) => (p === 'erreur' ? 'repos' : p)), 1200);
  };

  const soumettre = async (event: React.FormEvent) => {
    event.preventDefault();
    if (chargement || phase === 'succes') return;
    setErreur('');
    const identifiant = email.trim().toLowerCase();
    if (!isPlausibleEmail(identifiant) || !motDePasse) {
      echouer('Email et mot de passe sont obligatoires.');
      return;
    }

    setPhase('chargement');
    setChargement(true);
    setServeurLent(false);
    minuteur.current = setTimeout(() => setServeurLent(true), DELAI_NOTE_REVEIL_MS);
    try {
      const session = await loginPlateforme(identifiant, motDePasse);
      terminerChargement();
      // Double garde côté client : un serveur plus ancien pourrait répondre sans filtrer le rôle.
      if (!isPlatformAccount(session)) {
        echouer(MESSAGE_COMPTE_NON_PLATEFORME);
        return;
      }
      setSession(session);
      setSessionOuverte(session);
      setPhase('succes');
      plus(() => setFormulaireParti(true), 900);
    } catch (err) {
      terminerChargement();
      echouer(messageErreurConnexionAdmin(err));
    }
  };

  const emailValide = isPlausibleEmail(email.trim().toLowerCase());
  const mdpSaisi = motDePasse.length > 0;
  const etapesCochees =
    phase === 'succes' ? 3 : phase === 'chargement' ? 2 : phase === 'erreur' ? 0 : emailValide && motDePasse.length >= LONGUEUR_MDP_VISUELLE ? 1 : 0;
  const couleurHalo = phase === 'succes' ? VERT : phase === 'erreur' ? ROUGE : ACCENT;

  const lienRetour = (
    <a
      href={ROUTE_PATHS.vitrine}
      onClick={(event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onBack();
      }}
      className="inline-flex items-center gap-1 text-[12px] text-white/40 underline-offset-2 hover:text-white/80 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white rounded"
    >
      <span className="material-symbols-outlined text-sm" aria-hidden="true">arrow_back</span>
      <span>Retour au site</span>
    </a>
  );

  const champ =
    'w-full rounded-lg border bg-white/[0.03] px-3.5 py-2.5 text-[14px] text-white outline-none transition-colors placeholder:text-white/25 disabled:opacity-70';
  const libelle = 'block text-[12px] font-medium text-white/60 mb-1.5';

  return (
    <div className="min-h-dvh bg-black text-white antialiased flex flex-col font-sans">
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <section
          aria-labelledby="admin-connexion-titre"
          className="relative w-full max-w-[880px] overflow-hidden rounded-[20px] border border-white/[0.07] bg-[#0b0d14] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]"
        >
          {/* Filet lumineux supérieur à la couleur de la charte. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${ACCENT}, transparent)` }} />
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-10 -top-10 h-20 rounded-full blur-3xl" style={{ background: ACCENT, opacity: 0.12 }} />

          <div className="flex flex-col-reverse md:grid md:grid-cols-[1.15fr_1fr]">
            {/* Colonne gauche : formulaire puis vue de succès. */}
            <div className="relative px-6 py-7 sm:px-10 sm:py-10 md:min-h-[440px]">
              <AnimatePresence mode="wait">
                {!formulaireParti ? (
                  <motion.div
                    key="formulaire"
                    exit={reduit ? { opacity: 0 } : { opacity: 0, y: 24 }}
                    transition={{ duration: 0.3 }}
                  >
                    <h2 id="admin-connexion-titre" className="text-[26px] font-bold tracking-tight">Bon retour</h2>
                    <p className="mt-1 text-[13px] text-white/45">
                      Connectez-vous pour administrer la plateforme AcademiaBlanc.
                    </p>

                    <motion.form
                      onSubmit={soumettre}
                      noValidate
                      className="mt-7 space-y-4"
                      key={secouer}
                      animate={secouer && !reduit ? { x: [0, -10, 10, -7, 7, -3, 0] } : undefined}
                      transition={{ duration: 0.45 }}
                    >
                      <div>
                        <label htmlFor="admin-email" className={libelle}>Email</label>
                        <div className="relative">
                          <input
                            id="admin-email"
                            type="email"
                            autoComplete="username"
                            inputMode="email"
                            placeholder="administrateur@exemple.tg"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={chargement}
                            className={`${champ} pr-10 ${emailValide ? '' : 'border-white/10 focus:border-white/25'}`}
                            style={emailValide ? { borderColor: ACCENT, boxShadow: `0 0 0 3px ${ACCENT}22` } : undefined}
                          />
                          <AnimatePresence>
                            {emailValide && (
                              <motion.span
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0, opacity: 0 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                                className="absolute right-3 top-1/2 -mt-[9px] flex h-[18px] w-[18px] items-center justify-center rounded-full text-white"
                                style={{ background: ACCENT }}
                                aria-hidden="true"
                              >
                                <Coche className="h-3 w-3" />
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                      <div>
                        <label htmlFor="admin-mot-de-passe" className={libelle}>Mot de passe</label>
                        <div className="relative overflow-hidden rounded-lg">
                          <input
                            id="admin-mot-de-passe"
                            type={voirMdp ? 'text' : 'password'}
                            autoComplete="current-password"
                            placeholder="••••••••"
                            value={motDePasse}
                            onChange={(e) => setMotDePasse(e.target.value)}
                            disabled={chargement}
                            className={`${champ} pr-11 border-white/10 focus:border-white/25`}
                          />
                          <button
                            type="button"
                            onClick={() => setVoirMdp((v) => !v)}
                            aria-label={voirMdp ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                            aria-pressed={voirMdp}
                            className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded text-white/40 hover:text-white/80"
                          >
                            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{voirMdp ? 'visibility_off' : 'visibility'}</span>
                          </button>
                          {phase === 'chargement' && !reduit && (
                            <motion.span
                              aria-hidden="true"
                              className="pointer-events-none absolute inset-x-0 h-[2px]"
                              style={{ background: `linear-gradient(90deg, transparent, ${ACCENT}, transparent)`, boxShadow: `0 0 12px 2px ${ACCENT}` }}
                              initial={{ top: 0, opacity: 1 }}
                              animate={{ top: '100%', opacity: [1, 1, 0] }}
                              transition={{ duration: 0.5, ease: 'linear' }}
                            />
                          )}
                        </div>
                      </div>

                      <AnimatePresence>
                        {erreur && (
                          <motion.div
                            role="alert"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-[13px] text-red-300"
                          >
                            <span className="material-symbols-outlined text-base mt-px" aria-hidden="true">error</span>
                            <span>{erreur}</span>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <button
                        type="submit"
                        disabled={chargement || phase === 'succes'}
                        aria-busy={chargement}
                        className="relative mt-2 h-11 w-full overflow-hidden rounded-lg text-[14px] font-semibold text-white shadow-[0_8px_24px_-8px_rgba(49,107,243,0.7)] transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed"
                        style={{ background: `linear-gradient(90deg, ${ACCENT_FONCE}, ${ACCENT})` }}
                      >
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.span
                            key={chargement ? 'charge' : 'repos'}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="absolute inset-0 flex items-center justify-center gap-2"
                          >
                            {chargement ? (
                              <>
                                <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" aria-hidden="true" />
                                Authentification…
                              </>
                            ) : (
                              'Se connecter'
                            )}
                          </motion.span>
                        </AnimatePresence>
                      </button>

                      {chargement && serveurLent && (
                        <p role="status" className="text-center text-[12px] text-white/45">
                          Le serveur se réveille, jusqu’à une minute…
                        </p>
                      )}
                    </motion.form>

                    <div className="mt-6 text-center">{lienRetour}</div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="succes"
                    className="flex h-full min-h-[300px] flex-col items-center justify-center text-center"
                    initial="cache"
                    animate="visible"
                    variants={{ visible: { transition: { staggerChildren: reduit ? 0 : 0.08 } } }}
                  >
                    {[
                      <span key="c" className="flex h-16 w-16 items-center justify-center rounded-full text-white" style={{ background: VERT, boxShadow: `0 0 40px -6px ${VERT}` }}>
                        <Coche className="h-8 w-8" />
                      </span>,
                      <h2 key="t" className="mt-5 text-[26px] font-bold tracking-tight" role="status">Bon retour !</h2>,
                      <p key="s" className="mt-1 text-[13px] text-white/50">Connexion réussie.</p>,
                      <button
                        key="b"
                        type="button"
                        autoFocus
                        onClick={() => sessionOuverte && onConnecte(sessionOuverte)}
                        className="mt-7 h-11 rounded-lg px-8 text-[14px] font-semibold text-white hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                        style={{ background: `linear-gradient(90deg, ${ACCENT_FONCE}, ${ACCENT})` }}
                      >
                        Continuer →
                      </button>,
                    ].map((el, i) => (
                      <motion.div
                        key={i}
                        variants={{ cache: { opacity: 0, y: reduit ? 0 : 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }}
                      >
                        {el}
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Colonne droite : radar et étapes (au-dessus, compact, sur mobile). */}
            <div className="relative flex flex-row items-center gap-6 border-b border-white/[0.06] px-6 py-5 md:flex-col md:justify-center md:gap-10 md:border-b-0 md:border-l md:py-10" aria-hidden="true">
              <div className="relative flex h-20 w-20 shrink-0 items-center justify-center md:h-36 md:w-36">
                {[1, 0.72, 0.44].map((s) => (
                  <span key={s} className="absolute rounded-full border border-white/[0.06]" style={{ inset: `${((1 - s) / 2) * 100}%` }} />
                ))}
                {phase === 'chargement' && !reduit &&
                  [0, 0.6, 1.2].map((d) => (
                    <motion.span
                      key={d}
                      className="absolute inset-[28%] rounded-full border"
                      style={{ borderColor: ACCENT }}
                      initial={{ scale: 1, opacity: 0.7 }}
                      animate={{ scale: 2.6, opacity: 0 }}
                      transition={{ duration: 1.8, delay: d, repeat: Infinity, ease: 'easeOut' }}
                    />
                  ))}
                <motion.span
                  className="absolute inset-[22%] rounded-full blur-xl"
                  animate={{ background: couleurHalo, opacity: mdpSaisi || phase !== 'repos' ? 0.45 : 0 }}
                  transition={{ duration: 0.4 }}
                />
                <span className="relative flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[#0b0d14] md:h-16 md:w-16" style={{ borderColor: mdpSaisi || phase !== 'repos' ? `${couleurHalo}88` : undefined }}>
                  <AnimatePresence mode="wait">
                    {phase === 'succes' && formulaireParti ? (
                      <motion.span key="ok" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 16 }} style={{ color: VERT }}>
                        <Coche className="h-7 w-7" />
                      </motion.span>
                    ) : mdpSaisi || phase !== 'repos' ? (
                      <motion.span
                        key="cadenas"
                        initial={{ scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0, transition: { duration: 0.2 } }}
                        transition={{ type: 'spring', stiffness: 380, damping: 18 }}
                      >
                        <Cadenas ouvert={phase === 'succes'} couleur={phase === 'erreur' ? ROUGE : phase === 'succes' ? VERT : ACCENT} reduit={reduit} />
                      </motion.span>
                    ) : (
                      <motion.span key="point" className="h-2.5 w-2.5 rounded-full" style={{ background: ACCENT }} initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} />
                    )}
                  </AnimatePresence>
                </span>
              </div>

              <ul className="space-y-2.5 md:space-y-4 md:self-center">
                {ETAPES.map((etape, i) => {
                  const coche = i < etapesCochees;
                  return (
                    <li key={etape} className="flex items-center gap-3 text-[12px] md:text-[13px]">
                      <span className="relative flex h-[18px] w-[18px] items-center justify-center rounded-full border transition-colors" style={{ borderColor: coche ? ACCENT : 'rgba(255,255,255,0.18)' }}>
                        <AnimatePresence>
                          {coche && (
                            <motion.span key="c" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 20 }} style={{ color: ACCENT }}>
                              <Coche className="h-3 w-3" />
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </span>
                      <span className={`transition-colors duration-300 ${coche ? 'text-white font-medium' : 'text-white/35'}`}>{etape}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer className="px-4 py-3 text-center text-[11px] text-white/30 space-y-1">
        <p>AcademiaBlanc • Accès d’administration de la plateforme</p>
        <LiensLegaux nouvelOnglet />
      </footer>
    </div>
  );
};

export default AdminLoginPage;
