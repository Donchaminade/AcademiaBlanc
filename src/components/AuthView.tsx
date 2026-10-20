import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from 'motion/react';
import {
  ApiError,
  MESSAGE_SERVEUR_INDISPONIBLE,
  PLATFORM_ROLE,
  getSession,
  getToken,
  isUnavailable,
  login as apiLogin,
  setSession,
  signup as apiSignup,
} from '../api/client';
import { isPlausibleEmail } from '../utils/safeUrl';
import { usePrereglageDefaut } from '../api/prereglages';
import { bandeauNational, drapeau } from '../utils/prereglages';
import { chargerOffre } from '../api/abonnement';
import type { Forfait, OffrePublique } from '../utils/abonnement';
import { ForfaitCards } from './abonnement/ForfaitCards';
import { AcceptationConditions } from './legal/AcceptationConditions';
import { MESSAGE_ACCEPTATION_REQUISE, boutonInscriptionDesactive } from '../legal/acceptation';
import { VERSION_CONDITIONS } from '../legal/versions';

/** Offre affichée tant que `/api/public/offre` n'a pas répondu : aucun tarif inventé (« Tarif à confirmer »). */
const OFFRE_INCONNUE: OffrePublique = {
  tarifMensuel: 0,
  tarifAnnuel: 0,
  devise: 'FCFA',
  telWhatsapp: '',
  telAppel: '',
  beneficiaire: '',
  instructions: '',
  dureeEssaiJours: 0,
};

/** Au-delà de ce délai sans réponse, l’écran prévient que le serveur gratuit est sans doute en train de redémarrer. */
const DELAI_NOTE_REVEIL_MS = 3_000;
/** Durée d’affichage de l’état « Succès ✓ » avant l’entrée dans l’application (indication visuelle seulement). */
const DELAI_SUCCES_MS = 900;

const BLEU = '#316bf3';
const BLEU_FONCE = '#0051d5';

function useAppelServeur() {
  const [enCours, setEnCours] = useState(false);
  const [attenteLongue, setAttenteLongue] = useState(false);
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);

  const arreter = useCallback(() => {
    if (minuterie.current) clearTimeout(minuterie.current);
    minuterie.current = null;
    setEnCours(false);
    setAttenteLongue(false);
  }, []);

  useEffect(() => () => { if (minuterie.current) clearTimeout(minuterie.current); }, []);

  const executer = useCallback(async <T,>(appel: () => Promise<T>): Promise<T> => {
    setEnCours(true);
    setAttenteLongue(false);
    minuterie.current = setTimeout(() => setAttenteLongue(true), DELAI_NOTE_REVEIL_MS);
    try {
      return await appel();
    } finally {
      arreter();
    }
  }, [arreter]);

  return { enCours, attenteLongue, executer };
}

/** Phrase française pour une erreur de connexion : jamais le texte brut d’une exception. */
function messageErreurConnexion(error: unknown): string {
  if (isUnavailable(error)) return MESSAGE_SERVEUR_INDISPONIBLE;
  if (error instanceof ApiError && error.status === 401) return 'Email ou mot de passe incorrect.';
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'Connexion impossible. Réessayez dans un instant.';
}

/** Phrase française pour une erreur de création de compte. */
function messageErreurInscription(error: unknown): string {
  if (isUnavailable(error)) return MESSAGE_SERVEUR_INDISPONIBLE;
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'Une erreur est survenue lors de la création du compte.';
}

interface AuthViewProps {
  /** Compte d'établissement créé sur le serveur (la session API est déjà enregistrée). */
  onAccountCreated: () => void;
  onApiReady?: () => void;
  onClose?: () => void;
  /** Ferme la session API en cours (affiché uniquement quand une session existe). */
  onLogout?: () => void;
  /** Conservé pour compatibilité : la page est toujours rendue en pleine page. */
  embedded?: boolean;
  /** Onglet présélectionné ; un changement ultérieur de la prop bascule l’onglet (routes /connexion et /inscription). */
  initialMode?: AuthMode;
  /** Appelé quand l’utilisateur change d’onglet, pour tenir l’URL à jour. */
  onModeChange?: (mode: AuthMode) => void;
  /** Masque le bouton « Fermer » (la page hôte fournit son propre retour). */
  hideCloseButton?: boolean;
  /** Lien « Retour au site » affiché sous le logo. */
  onBack?: () => void;
  /** Liens légaux affichés en bas du panneau de droite. */
  pied?: React.ReactNode;
}

export type AuthMode = 'login' | 'register';

type EtapeInscription = 'infos' | 'responsable' | 'forfait';
const ETAPES: { id: EtapeInscription; libelle: string }[] = [
  { id: 'infos', libelle: 'Établissement' },
  { id: 'responsable', libelle: 'Responsable & accès' },
  { id: 'forfait', libelle: 'Forfait' },
];

type HumeurMascotte = 'repos' | 'email' | 'motdepasse' | 'succes' | 'erreur';

/* ------------------------------------------------------------------------------------------------ */
/* Mascotte : petit hibou dessiné en SVG (aucune ressource externe).                                 */
/* ------------------------------------------------------------------------------------------------ */
const Mascotte: React.FC<{ humeur: HumeurMascotte; bulle: string; reduit: boolean }> = ({ humeur, bulle, reduit }) => {
  const visible = humeur !== 'repos';
  const cache = humeur === 'motdepasse';
  const position = !visible
    ? { x: -70, y: 0, rotate: -12, opacity: 0 }
    : cache
      ? { x: 0, y: 14, rotate: 0, opacity: 1 }
      : { x: 0, y: 0, rotate: humeur === 'erreur' ? -6 : 4, opacity: 1 };
  return (
    <div className="pointer-events-none relative h-[70px] w-full" aria-hidden="true">
      <motion.div
        className="absolute left-0 top-0"
        initial={false}
        animate={position}
        transition={reduit ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 18 }}
      >
        <svg width="62" height="62" viewBox="0 0 64 64">
          <ellipse cx="32" cy="38" rx="22" ry="22" fill={BLEU} />
          <path d="M14 22 L18 8 L26 18 Z M50 22 L46 8 L38 18 Z" fill={BLEU_FONCE} />
          <ellipse cx="32" cy="46" rx="13" ry="12" fill="#dbe6ff" />
          <circle cx="24" cy="32" r="8" fill="#fff" />
          <circle cx="40" cy="32" r="8" fill="#fff" />
          <motion.g initial={false} animate={{ scaleY: cache ? 0.1 : 1 }} style={{ originY: '32px' }}>
            <circle cx={humeur === 'email' ? 26 : 24} cy="33" r="3.4" fill="#131b2e" />
            <circle cx={humeur === 'email' ? 42 : 40} cy="33" r="3.4" fill="#131b2e" />
          </motion.g>
          <path d="M29 40 L35 40 L32 44 Z" fill="#f5b400" />
          {humeur === 'succes' && <path d="M26 49 Q32 54 38 49" stroke="#131b2e" strokeWidth="2" fill="none" strokeLinecap="round" />}
          {/* Ailes qui couvrent les yeux pendant la saisie du mot de passe */}
          <motion.ellipse
            cx="14" cy="44" rx="7" ry="12" fill={BLEU_FONCE}
            initial={false}
            animate={cache ? { x: 9, y: -12, rotate: 35 } : { x: 0, y: 0, rotate: 0 }}
            transition={reduit ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 20 }}
          />
          <motion.ellipse
            cx="50" cy="44" rx="7" ry="12" fill={BLEU_FONCE}
            initial={false}
            animate={cache ? { x: -9, y: -12, rotate: -35 } : { x: 0, y: 0, rotate: 0 }}
            transition={reduit ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 20 }}
          />
        </svg>
      </motion.div>
      <AnimatePresence mode="popLayout">
        {visible && (
          <motion.div
            key={bulle}
            className="absolute left-[70px] top-1 max-w-[230px] rounded-2xl rounded-bl-sm bg-[#131b2e] px-3 py-1.5 text-[12px] font-semibold text-white shadow-lg"
            initial={reduit ? { opacity: 0 } : { opacity: 0, scale: 0.6, x: -8 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={reduit ? { duration: 0.1 } : { type: 'spring', stiffness: 420, damping: 22 }}
            style={{ originX: 0, originY: 1 }}
          >
            {bulle}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ------------------------------------------------------------------------------------------------ */
/* Panneau gauche : dégradé maillé bleu + widgets « verre » aux données fictives.                    */
/* ------------------------------------------------------------------------------------------------ */
const flotte = (reduit: boolean, amplitude: number, duree: number, delai = 0) =>
  reduit ? {} : { animate: { y: [0, -amplitude, 0] }, transition: { duration: duree, repeat: Infinity, ease: 'easeInOut' as const, delay: delai } };

const verre = 'rounded-2xl border border-white/40 bg-white/20 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,20,80,0.25)] text-white';

const PanneauVitrine: React.FC<{ reduit: boolean; titre: string }> = ({ reduit, titre }) => (
  <div
    className="relative hidden h-full overflow-hidden rounded-[18px] lg:flex lg:flex-col lg:justify-end"
    style={{
      background:
        'radial-gradient(at 18% 20%, #6f9bff 0, transparent 50%), radial-gradient(at 85% 15%, #0051d5 0, transparent 55%), radial-gradient(at 70% 85%, #00236f 0, transparent 55%), radial-gradient(at 10% 90%, #316bf3 0, transparent 50%), #1f4fd1',
    }}
    aria-hidden="true"
  >
    {/* Carte résultats */}
    <motion.div className={`${verre} absolute left-[9%] top-[9%] w-[62%] p-4`} {...flotte(reduit, 8, 6)}>
      <div className="flex items-center justify-between text-[11px] text-white/80">
        <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[15px]">school</span>Examen blanc • Terminale D</span>
        <span className="rounded-full bg-white/25 px-2 py-0.5">T2</span>
      </div>
      <p className="mt-2 text-[26px] font-extrabold leading-none tracking-tight">14,62<span className="text-[14px] font-semibold text-white/70"> /20</span></p>
      <p className="mt-1 text-[11px] text-emerald-200">▲ +1,8 pt vs. trimestre 1</p>
      <svg viewBox="0 0 200 50" className="mt-2 h-12 w-full">
        <defs><linearGradient id="gAuth" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.5" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient></defs>
        <path d="M0 40 L25 34 L50 37 L75 25 L100 28 L125 18 L150 22 L175 10 L200 12 L200 50 L0 50 Z" fill="url(#gAuth)" />
        <path d="M0 40 L25 34 L50 37 L75 25 L100 28 L125 18 L150 22 L175 10 L200 12" stroke="#fff" strokeWidth="2" fill="none" />
      </svg>
    </motion.div>

    {/* Taux de réussite */}
    <motion.div className={`${verre} absolute right-[7%] top-[30%] flex items-center gap-3 p-3`} {...flotte(reduit, 10, 7, 0.8)}>
      <svg width="46" height="46" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="15" stroke="rgba(255,255,255,0.3)" strokeWidth="4" fill="none" />
        <circle cx="18" cy="18" r="15" stroke="#7cf0b4" strokeWidth="4" fill="none" strokeDasharray="73 94" strokeLinecap="round" transform="rotate(-90 18 18)" />
      </svg>
      <div>
        <p className="text-[18px] font-extrabold leading-none">78 %</p>
        <p className="text-[11px] text-white/80">Taux de réussite</p>
      </div>
    </motion.div>

    {/* Liste de candidats */}
    <motion.div className={`${verre} absolute left-[14%] top-[47%] w-[58%] p-3`} {...flotte(reduit, 7, 8, 1.6)}>
      <p className="mb-2 text-[11px] font-semibold text-white/80">Candidats • Série D</p>
      {[
        ['A. Koffi', '16,40', 'Admis'],
        ['E. Mensah', '12,85', 'Admis'],
        ['K. Amegah', '9,10', 'Ajourné'],
      ].map(([nom, moyenne, statut]) => (
        <div key={nom} className="flex items-center justify-between border-t border-white/15 py-1.5 text-[12px]">
          <span className="flex items-center gap-2"><span className="h-5 w-5 rounded-full bg-white/30" />{nom}</span>
          <span className="font-semibold">{moyenne}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statut === 'Admis' ? 'bg-emerald-300/30 text-emerald-100' : 'bg-red-300/30 text-red-100'}`}>{statut}</span>
        </div>
      ))}
    </motion.div>

    {/* Pastille bulletin */}
    <motion.div className={`${verre} absolute right-[10%] top-[66%] flex items-center gap-2 px-3 py-2 text-[12px] font-semibold`} {...flotte(reduit, 9, 6.5, 0.4)}>
      <span className="material-symbols-outlined text-[16px]">description</span> 248 bulletins générés
    </motion.div>

    <div className="relative p-8">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-white/70">AcademiaBlanc</p>
      <h2 className="mt-1 max-w-sm text-[28px] font-bold leading-tight tracking-tight text-white">{titre}</h2>
    </div>
  </div>
);

/* ------------------------------------------------------------------------------------------------ */
/* Champs                                                                                             */
/* ------------------------------------------------------------------------------------------------ */
const champ =
  'w-full rounded-lg border border-[#d4d7e3] bg-white px-3 py-2.5 text-[14px] text-[#131b2e] outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[#9a9db0] focus:border-[#316bf3] focus:shadow-[0_0_0_1px_#316bf3] disabled:opacity-60';
const etiquette = 'mb-1.5 block text-[13px] font-semibold text-[#131b2e]';

const ChampMotDePasse: React.FC<{
  id: string;
  valeur: string;
  onChange: (v: string) => void;
  autoComplete: string;
  onFocus?: () => void;
  onBlur?: () => void;
  disabled?: boolean;
}> = ({ id, valeur, onChange, autoComplete, onFocus, onBlur, disabled }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        placeholder="••••••••"
        value={valeur}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        className={`${champ} pr-11`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        aria-pressed={visible}
        className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[#5b5e70] hover:bg-[#f2f3ff]"
      >
        <span className="material-symbols-outlined text-[19px]" aria-hidden="true">{visible ? 'visibility_off' : 'visibility'}</span>
      </button>
    </div>
  );
};

type EtatBouton = 'repos' | 'charge' | 'succes';

/** Bouton principal : pression 0,97, fondu du libellé vers « … » + roue, vert « Succès ✓ » après une vraie réussite. */
const BoutonPrincipal: React.FC<{
  etat: EtatBouton;
  libelle: React.ReactNode;
  libelleCharge: string;
  disabled?: boolean;
  testId?: string;
  title?: string;
  ariaDisabled?: boolean;
  reduit: boolean;
}> = ({ etat, libelle, libelleCharge, disabled, testId, title, ariaDisabled, reduit }) => {
  const cle = etat;
  return (
    <motion.button
      type="submit"
      data-testid={testId}
      disabled={disabled}
      aria-disabled={ariaDisabled}
      title={title}
      whileTap={disabled || reduit ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className={`relative flex h-12 w-full items-center justify-center overflow-hidden rounded-lg text-[14px] font-bold text-white shadow-md transition-colors duration-300 disabled:cursor-not-allowed ${
        etat === 'succes' ? 'bg-emerald-600' : 'bg-[#0051d5] hover:bg-[#316bf3] disabled:opacity-60'
      } ${etat === 'charge' ? 'disabled:opacity-90 disabled:cursor-wait' : ''}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={cle}
          className="flex items-center gap-2"
          initial={{ opacity: 0, y: reduit ? 0 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduit ? 0 : -6 }}
          transition={{ duration: 0.18 }}
        >
          {etat === 'charge' && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
          )}
          {etat === 'repos' ? libelle : etat === 'charge' ? libelleCharge : 'Succès ✓'}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
};

export const AuthView: React.FC<AuthViewProps> = ({
  onAccountCreated,
  onApiReady,
  onClose,
  onLogout,
  initialMode = 'register',
  onModeChange,
  hideCloseButton = false,
  onBack,
  pied,
}) => {
  const reduit = useReducedMotion() ?? false;
  const prereglageDefaut = usePrereglageDefaut();
  const bandeau = bandeauNational(prereglageDefaut);
  const [mode, setMode] = useState<AuthMode>(initialMode);
  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);
  const changerMode = (next: AuthMode) => {
    setMode(next);
    setEtapeInscription('infos');
    setDirection(1);
    setFocus(null);
    onModeChange?.(next);
  };
  const activeSession = getToken() ? getSession() : null;

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    city: 'Lomé',
    region: 'Maritime (Grand Lomé)',
    type: 'Lycée Public d\'Enseignement Général',
    principalName: '',
    email: '',
    phone: '+228 ',
    password: '',
    confirmPassword: '',
    initialWithSampleStudents: false,
  });

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [regError, setRegError] = useState('');
  const [acceptationConditions, setAcceptationConditions] = useState(false);
  const connexion = useAppelServeur();
  const inscription = useAppelServeur();
  const [succes, setSucces] = useState(false);
  const [focus, setFocus] = useState<'email' | 'motdepasse' | null>(null);
  const secousse = useAnimationControls();
  const minuterieSucces = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Suite encore due (entrée dans l’application). Lancée au démontage si le délai visuel est interrompu. */
  const suiteSucces = useRef<(() => void) | null>(null);
  useEffect(() => () => {
    if (minuterieSucces.current) clearTimeout(minuterieSucces.current);
    const suite = suiteSucces.current;
    suiteSucces.current = null;
    suite?.();
  }, []);

  const secouer = useCallback(() => {
    if (reduit) return;
    void secousse.start({ x: [0, -10, 10, -7, 7, -3, 0], transition: { duration: 0.45 } });
  }, [reduit, secousse]);

  /** Affiche l’état « Succès ✓ » puis exécute la suite (entrée dans l’application). */
  const apresSucces = (suite: () => void) => {
    setSucces(true);
    suiteSucces.current = suite;
    minuterieSucces.current = setTimeout(() => {
      const enAttente = suiteSucces.current;
      suiteSucces.current = null;
      enAttente?.();
    }, reduit ? 150 : DELAI_SUCCES_MS);
  };

  const [etapeInscription, setEtapeInscription] = useState<EtapeInscription>('infos');
  const [direction, setDirection] = useState(1);
  const allerA = (etape: EtapeInscription) => {
    const avant = ETAPES.findIndex((e) => e.id === etapeInscription);
    const apres = ETAPES.findIndex((e) => e.id === etape);
    setDirection(apres >= avant ? 1 : -1);
    setEtapeInscription(etape);
  };
  const [forfait, setForfait] = useState<Forfait>('ANNUEL');
  const [offre, setOffre] = useState<OffrePublique>(OFFRE_INCONNUE);
  useEffect(() => {
    let actif = true;
    chargerOffre()
      .then((o) => { if (actif) setOffre(o); })
      .catch(() => { /* offre indisponible : « Tarif à confirmer » */ });
    return () => { actif = false; };
  }, []);

  /** Contrôle des informations de l'établissement ; renvoie le message d'erreur ou `null`. */
  const erreurInfos = (): string | null => {
    if (!formData.name.trim()) return 'Le nom officiel de l\'établissement est obligatoire.';
    if (!formData.principalName.trim()) return 'Le nom du chef d\'établissement (Directeur ou Proviseur) est obligatoire.';
    if (!isPlausibleEmail(formData.email)) return 'Indiquez une adresse email valide.';
    if (formData.password.trim().length < 6) return 'Le mot de passe doit contenir au moins 6 caractères.';
    if (formData.password !== formData.confirmPassword) return 'Les deux mots de passe ne correspondent pas.';
    return null;
  };

  /** Étape 1 → 2 : seul le nom de l’établissement est obligatoire sur cette étape (même message qu’avant). */
  const passerAuResponsable = (e: React.FormEvent) => {
    e.preventDefault();
    const erreur = formData.name.trim() ? null : 'Le nom officiel de l\'établissement est obligatoire.';
    setRegError(erreur ?? '');
    if (erreur) secouer();
    else allerA('responsable');
  };

  const passerAuForfait = (e: React.FormEvent) => {
    e.preventDefault();
    const erreur = erreurInfos() ?? (acceptationConditions ? null : MESSAGE_ACCEPTATION_REQUISE);
    setRegError(erreur ?? '');
    if (erreur) {
      secouer();
      if (!formData.name.trim()) allerA('infos');
    } else allerA('forfait');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inscription.enCours || succes) return;
    setRegError('');

    const erreur = erreurInfos();
    if (erreur) {
      setRegError(erreur);
      allerA(formData.name.trim() ? 'responsable' : 'infos');
      secouer();
      return;
    }
    if (!acceptationConditions) {
      setRegError(MESSAGE_ACCEPTATION_REQUISE);
      allerA('responsable');
      secouer();
      return;
    }

    try {
      const session = await inscription.executer(() => apiSignup({
        nom: formData.name.trim(),
        ville: formData.city.trim(),
        email: formData.email.trim(),
        motDePasse: formData.password,
        nomResponsable: formData.principalName.trim(),
        telephone: formData.phone.trim(),
        region: formData.region.trim(),
        typeEtablissement: formData.type.trim(),
        forfait,
        acceptationConditions,
        versionConditions: VERSION_CONDITIONS,
      }));
      // Le compte vit sur le serveur : aucun double local (et surtout pas le mot de passe) n'est écrit dans le navigateur.
      setSession(session);
      apresSucces(() => {
        onApiReady?.();
        onAccountCreated();
      });
    } catch (error) {
      setRegError(messageErreurInscription(error));
      secouer();
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (connexion.enCours || succes) return;
    setLoginError('');
    const email = loginEmail.trim().toLowerCase();
    if (!isPlausibleEmail(email) || !loginPassword) {
      setLoginError('Email et mot de passe sont obligatoires.');
      secouer();
      return;
    }

    try {
      const session = await connexion.executer(() => apiLogin(email, loginPassword));
      setSession(session);
      if (session.role === PLATFORM_ROLE) {
        onApiReady?.();
        return;
      }
      // Entrée directe dans l'espace du serveur : le registre de démonstration du navigateur n'est jamais consulté.
      apresSucces(() => {
        onApiReady?.();
        if (onClose) onClose();
      });
    } catch (error) {
      setLoginError(messageErreurConnexion(error));
      secouer();
    }
  };

  const blocErreur = (message: string) => (
    <motion.div
      role="alert"
      initial={reduit ? false : { opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-[12px] font-semibold text-red-700"
    >
      <span className="material-symbols-outlined text-base" aria-hidden="true">error</span>
      <span>{message}</span>
    </motion.div>
  );

  const noteReveil = (
    <p role="status" className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
      <span className="material-symbols-outlined animate-spin text-base" aria-hidden="true">progress_activity</span>
      <span>Le serveur se réveille, cela peut prendre jusqu’à une minute…</span>
    </p>
  );

  // Humeur et bulle de la mascotte.
  const humeur: HumeurMascotte = succes
    ? 'succes'
    : (mode === 'login' ? loginError : regError)
      ? 'erreur'
      : focus ?? (mode === 'register' ? 'email' : 'repos');
  const bulle = succes
    ? mode === 'login' ? 'Bienvenue ! On y va 🎉' : 'Compte créé, bravo ! 🎉'
    : humeur === 'erreur'
      ? 'Oups, on vérifie ça ensemble ?'
      : focus === 'motdepasse'
        ? 'Je ne regarde pas, promis 🙈'
        : mode === 'login'
          ? 'Bonjour ! Votre email d’établissement ?'
          : etapeInscription === 'infos'
            ? 'Présentez-moi votre établissement !'
            : etapeInscription === 'responsable'
              ? focus === 'email' ? 'L’adresse qui servira à vous connecter.' : 'Qui dirige l’établissement ?'
              : 'Dernière étape : votre forfait ✨';

  const indexEtape = ETAPES.findIndex((e) => e.id === etapeInscription);
  const variantesEtape = {
    entree: (d: number) => ({ x: reduit ? 0 : 30 * d, opacity: 0 }),
    centre: { x: 0, opacity: 1, transition: { duration: reduit ? 0.15 : 0.4, ease: 'easeOut' as const, delay: reduit ? 0 : 0.08 } },
    sortie: (d: number) => ({ x: reduit ? 0 : -30 * d, opacity: 0, transition: { duration: reduit ? 0.1 : 0.3, ease: 'easeIn' as const } }),
  };

  const focusProps = (cible: 'email' | 'motdepasse') => ({
    onFocus: () => setFocus(cible),
    onBlur: () => setFocus((f) => (f === cible ? null : f)),
  });

  const lienMode = (texte: string, lien: string, cible: AuthMode) => (
    <p className="text-center text-[13px] text-[#5b5e70]">
      {texte}{' '}
      <button type="button" onClick={() => changerMode(cible)} disabled={succes} className="font-bold text-[#0051d5] hover:underline disabled:opacity-60">
        {lien}
      </button>
    </p>
  );

  /* ---------------------------- Formulaire de connexion ---------------------------- */
  const formulaireConnexion = (
    <form onSubmit={handleLogin} className="space-y-4" aria-busy={connexion.enCours} noValidate>
      <div>
        <h1 className="text-[26px] font-bold tracking-tight text-[#131b2e]">Bon retour !</h1>
        <p className="mt-1 text-[14px] text-[#5b5e70]">Connectez-vous avec l'adresse email et le mot de passe de votre établissement.</p>
      </div>
      {loginError && blocErreur(loginError)}
      <div>
        <label htmlFor="connexion-email" className={etiquette}>Email</label>
        <input
          id="connexion-email"
          type="text"
          autoComplete="username"
          placeholder="secretariat@lycee.tg"
          value={loginEmail}
          onChange={(e) => setLoginEmail(e.target.value)}
          className={champ}
          {...focusProps('email')}
        />
      </div>
      <div>
        <label htmlFor="connexion-mdp" className={etiquette}>Mot de passe</label>
        <ChampMotDePasse id="connexion-mdp" valeur={loginPassword} onChange={setLoginPassword} autoComplete="current-password" {...focusProps('motdepasse')} />
      </div>
      {connexion.attenteLongue && noteReveil}
      <BoutonPrincipal
        etat={succes ? 'succes' : connexion.enCours ? 'charge' : 'repos'}
        libelle="Se connecter"
        libelleCharge="Connexion…"
        disabled={connexion.enCours || succes}
        reduit={reduit}
      />
      {lienMode('Pas encore de compte ?', 'Créer le compte de mon établissement', 'register')}
    </form>
  );

  /* ---------------------------- Étapes d’inscription ---------------------------- */
  const etapeInfos = (
    <form onSubmit={passerAuResponsable} className="space-y-4" data-testid="etape-infos" noValidate>
      {regError && blocErreur(regError)}
      <div>
        <label htmlFor="ins-nom" className={etiquette}>Nom de l'établissement <span className="text-red-500">*</span></label>
        <input id="ins-nom" type="text" required placeholder="Ex : Lycée de Baguida" value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={`${champ} font-semibold`} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ins-code" className={etiquette}>Code</label>
          <input id="ins-code" type="text" placeholder="Ex : LBAG-03 (optionnel)" value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })} className={`${champ} font-mono`} />
        </div>
        <div>
          <label htmlFor="ins-ville" className={etiquette}>Ville <span className="text-red-500">*</span></label>
          <select id="ins-ville" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className={champ}>
            <option value="Lomé">Lomé (Grand Lomé)</option>
            <option value="Kara">Kara</option>
            <option value="Sokodé">Sokodé</option>
            <option value="Atakpamé">Atakpamé</option>
            <option value="Kpalimé">Kpalimé</option>
            <option value="Dapaong">Dapaong</option>
            <option value="Tsévié">Tsévié</option>
            <option value="Aného">Aného</option>
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="ins-type" className={etiquette}>Type</label>
        <select id="ins-type" value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className={champ}>
          <option value="Lycée Public d'Enseignement Général">Lycée Public d'Enseignement Général</option>
          <option value="Lycée d'Enseignement Technique & Professionnel">Lycée d'Enseignement Technique &amp; Professionnel</option>
          <option value="Collège d'Enseignement Général (CEG)">Collège d'Enseignement Général (CEG)</option>
          <option value="Collège Privé">Collège Privé</option>
          <option value="Collège / Lycée Privé Laïc">Collège / Lycée Privé Laïc</option>
          <option value="Établissement Confessionnel (Protestant / Catholique / Islamique)">Établissement Confessionnel</option>
          <option value="Complexe Scolaire International">Complexe Scolaire International</option>
        </select>
      </div>
      <BoutonPrincipal etat="repos" libelle={<>Continuer <span aria-hidden="true">→</span></>} libelleCharge="" testId="bouton-continuer-responsable" reduit={reduit} />
      {lienMode('Déjà un compte ?', 'Se connecter', 'login')}
    </form>
  );

  const etapeResponsable = (
    <form onSubmit={passerAuForfait} className="space-y-4" data-testid="etape-responsable" noValidate>
      {regError && blocErreur(regError)}
      <div>
        <label htmlFor="ins-chef" className={etiquette}>Chef d'établissement (Directeur / Proviseur) <span className="text-red-500">*</span></label>
        <input id="ins-chef" type="text" required placeholder="Ex : M. Kodjo ADJOLOU" value={formData.principalName}
          onChange={(e) => setFormData({ ...formData, principalName: e.target.value })} className={`${champ} font-semibold`} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ins-email" className={etiquette}>Email <span className="text-red-500">*</span></label>
          <input id="ins-email" type="email" required placeholder="secretariat@lycee.tg" value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={champ} {...focusProps('email')} />
        </div>
        <div>
          <label htmlFor="ins-tel" className={etiquette}>Téléphone</label>
          <input id="ins-tel" type="text" placeholder="+228 90 00 00 00" value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className={champ} />
        </div>
        <div>
          <label htmlFor="ins-mdp" className={etiquette}>Mot de passe</label>
          <ChampMotDePasse id="ins-mdp" valeur={formData.password} autoComplete="new-password"
            onChange={(v) => setFormData({ ...formData, password: v })} {...focusProps('motdepasse')} />
        </div>
        <div>
          <label htmlFor="ins-mdp2" className={etiquette}>Confirmation</label>
          <ChampMotDePasse id="ins-mdp2" valeur={formData.confirmPassword} autoComplete="new-password"
            onChange={(v) => setFormData({ ...formData, confirmPassword: v })} {...focusProps('motdepasse')} />
        </div>
      </div>
      <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-[#eaedff] bg-[#f2f3ff] px-3 py-2">
        <input type="checkbox" checked={formData.initialWithSampleStudents}
          onChange={(e) => setFormData({ ...formData, initialWithSampleStudents: e.target.checked })}
          className="h-4 w-4 cursor-pointer rounded text-[#0051d5] focus:ring-0" />
        <span className="text-[12px] font-bold text-[#00236f]">Pré-charger 4 candidats modèles (Série D)</span>
      </label>
      {/* Acceptation des documents légaux : obligatoire, le bouton reste désactivé tant qu’elle n’est pas cochée */}
      <AcceptationConditions checked={acceptationConditions} onChange={setAcceptationConditions} disabled={inscription.enCours} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <button type="button" onClick={() => { setRegError(''); allerA('infos'); }}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-[#d4d7e3] px-5 text-[14px] font-semibold text-[#444651] hover:bg-[#f2f3ff]">
          <span className="material-symbols-outlined text-base" aria-hidden="true">arrow_back</span>Retour
        </button>
        <div className="flex-1">
          <BoutonPrincipal
            etat="repos"
            libelle={<>Continuer : choisir le forfait <span aria-hidden="true">→</span></>}
            libelleCharge=""
            testId="bouton-continuer-forfait"
            disabled={boutonInscriptionDesactive({ accepte: acceptationConditions, enCours: inscription.enCours })}
            ariaDisabled={!acceptationConditions || undefined}
            title={acceptationConditions ? undefined : 'Cochez la case d’acceptation des conditions pour continuer'}
            reduit={reduit}
          />
        </div>
      </div>
    </form>
  );

  const etapeForfait = (
    <form onSubmit={handleRegister} className="space-y-4" aria-busy={inscription.enCours} data-testid="etape-forfait">
      {regError && blocErreur(regError)}
      <p className="text-[13px] text-[#5b5e70]">
        Pour <strong className="text-[#131b2e]">{formData.name.trim()}</strong>. Le règlement se fait par mobile money après la création du compte ;
        votre espace est activé par la plateforme dès réception.
      </p>
      <ForfaitCards
        valeur={forfait}
        onChange={setForfait}
        tarifMensuel={offre.tarifMensuel}
        tarifAnnuel={offre.tarifAnnuel}
        devise={offre.devise}
        dureeEssaiJours={offre.dureeEssaiJours}
        disabled={inscription.enCours}
      />
      {inscription.attenteLongue && noteReveil}
      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <button type="button" onClick={() => { setRegError(''); allerA('responsable'); }} disabled={inscription.enCours || succes}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-[#d4d7e3] px-5 text-[14px] font-semibold text-[#444651] hover:bg-[#f2f3ff] disabled:opacity-60">
          <span className="material-symbols-outlined text-base" aria-hidden="true">arrow_back</span>Retour
        </button>
        <div className="flex-1">
          <BoutonPrincipal
            etat={succes ? 'succes' : inscription.enCours ? 'charge' : 'repos'}
            libelle="Créer le compte et passer au paiement"
            libelleCharge="Création…"
            testId="bouton-creer-compte"
            disabled={inscription.enCours || succes}
            reduit={reduit}
          />
        </div>
      </div>
    </form>
  );

  const titresEtape: Record<EtapeInscription, [string, string]> = {
    infos: ['Créez votre espace', 'Quelques informations sur votre établissement.'],
    responsable: ['Responsable & accès', 'Les identifiants qui ouvriront votre espace.'],
    forfait: ['Choisissez votre forfait', 'Mensuel ou annuel, selon vos besoins.'],
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#0b1020] p-0 font-[Inter,system-ui,sans-serif] sm:p-4 lg:p-8">
      <div className="grid min-h-dvh w-full max-w-[1180px] grid-cols-1 gap-2 bg-white p-2 sm:min-h-0 shadow-[0_30px_80px_rgba(0,0,0,0.45)] sm:rounded-[24px] lg:min-h-[680px] lg:grid-cols-2">
        <PanneauVitrine
          reduit={reduit}
          titre={mode === 'login' ? 'Gérez vos examens blancs et vos bulletins en un seul endroit.' : 'Lancez vos examens blancs en quelques minutes.'}
        />

        <div className="flex flex-col px-5 py-6 sm:px-10 lg:px-14 lg:py-10">
          {/* En-tête statique : logo + retour */}
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-[#00236f]">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0051d5] text-white">
                <span className="material-symbols-outlined text-xl" aria-hidden="true">account_balance</span>
              </span>
              AcademiaBlanc
            </span>
            <div className="flex items-center gap-1">
              {onBack && (
                <button type="button" onClick={onBack} disabled={succes}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-[#00236f] hover:bg-[#f2f3ff] disabled:opacity-60">
                  <span className="material-symbols-outlined text-base" aria-hidden="true">arrow_back</span>Retour au site
                </button>
              )}
              {onClose && !hideCloseButton && (
                <button type="button" onClick={onClose} disabled={succes} className="rounded-lg px-2 py-1.5 text-[13px] font-semibold text-[#444651] hover:bg-[#f2f3ff] disabled:opacity-60">Fermer</button>
              )}
            </div>
          </div>
          {/* Bandeau mobile (le panneau visuel est masqué sous 1024 px) */}
          <div className="mt-4 rounded-xl px-4 py-3 text-white lg:hidden" style={{ background: 'linear-gradient(120deg,#316bf3,#0051d5 60%,#00236f)' }}>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/80">{drapeau(prereglageDefaut.code)} {bandeau}</p>
            <p className="text-[14px] font-semibold">Portail Établissements &amp; Gestion des Bulletins</p>
          </div>

          {activeSession && !succes && (
            <div className="mt-4 flex min-w-0 items-center justify-between gap-2 rounded-lg bg-[#f2f3ff] px-3 py-2 text-[12px]">
              <span className="truncate text-[#444651]">Connecté : <strong className="text-[#00236f]">{activeSession.nomEtablissement || activeSession.email}</strong></span>
              {onLogout && (
                <button type="button" onClick={onLogout} className="shrink-0 rounded-lg border border-red-200 bg-white px-3 py-1 text-[12px] font-bold text-red-700 hover:bg-red-50">Se déconnecter</button>
              )}
            </div>
          )}

          <div className="mx-auto mt-6 flex w-full max-w-[440px] flex-1 flex-col justify-center lg:mt-4">
            <Mascotte humeur={humeur} bulle={bulle} reduit={reduit} />

            <motion.div animate={secousse}>
              {mode === 'login' ? (
                formulaireConnexion
              ) : (
                <div className="space-y-5">
                  {/* Titre et progression : statiques pendant le glissement des étapes */}
                  <div>
                    <h1 className="text-[26px] font-bold tracking-tight text-[#131b2e]">{titresEtape[etapeInscription][0]}</h1>
                    <p className="mt-1 text-[14px] text-[#5b5e70]">{titresEtape[etapeInscription][1]}</p>
                  </div>
                  <ol className="flex items-center gap-2" aria-label="Progression de l’inscription">
                    {ETAPES.map((etape, i) => (
                      <li key={etape.id} className="flex flex-1 flex-col gap-1.5" aria-current={i === indexEtape ? 'step' : undefined}>
                        <div className="h-1.5 overflow-hidden rounded-full bg-[#e6e8f2]">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: `linear-gradient(90deg, ${BLEU}, ${BLEU_FONCE})` }}
                            initial={false}
                            animate={{ width: i <= indexEtape ? '100%' : '0%' }}
                            transition={{ duration: reduit ? 0 : 0.45, ease: 'easeOut' }}
                          />
                        </div>
                        <span className={`text-[11px] font-semibold ${i <= indexEtape ? 'text-[#0051d5]' : 'text-[#9a9db0]'}`}>
                          {i < indexEtape ? '✓ ' : `${i + 1}. `}{etape.libelle}
                        </span>
                      </li>
                    ))}
                  </ol>
                  <div className="relative">
                    <AnimatePresence mode="wait" custom={direction} initial={false}>
                      <motion.div key={etapeInscription} custom={direction} variants={variantesEtape} initial="entree" animate="centre" exit="sortie">
                        {etapeInscription === 'infos' ? etapeInfos : etapeInscription === 'responsable' ? etapeResponsable : etapeForfait}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </motion.div>
          </div>

          {pied && <div className="mt-6">{pied}</div>}
        </div>
      </div>
    </div>
  );
};
