/**
 * Boutons « remplissage liquide » — référence @code.xr (reel Dc7xjbKTa7h).
 * Repos : fond d'origine. Clic : libellé de chargement, l'icône glisse vers le bas, un liquide bleu clair
 * (#c5ceff) monte avec une crête en vague. Succès : coche, fond bleu clair, texte marine. Erreur : rouge +
 * secousse. Retour au repos après 2,5 s. Mouvement réduit : pas de vague, simple fondu du remplissage.
 *
 * Deux modes : `action` (le bouton exécute et suit la promesse) ou contrôlé (`enCours` / `echec`, pour les
 * boutons `type="submit"` dont le formulaire gère l'envoi).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  DELAI_RETOUR_REPOS_MS,
  DUREE_MIN_CHARGEMENT_MS,
  executerAction,
  niveauRemplissage,
  peutDeclencher,
  progressionSimulee,
  transition,
  type EtatLiquide,
  type EvenementLiquide,
} from './liquidState';

export const LIQUIDE = { marine: '#00236f', bleu: '#0051d5', clair: '#c5ceff' } as const;

const attendre = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Hook partagé : état, progression, déclenchement. */
export function useLiquide(opts: {
  action?: () => unknown;
  enCours?: boolean;
  echec?: boolean;
  progression?: number;
}) {
  const [etat, setEtat] = useState<EtatLiquide>('repos');
  const [simulee, setSimulee] = useState(0);
  const debut = useRef(0);
  const etatRef = useRef(etat);
  etatRef.current = etat;
  const envoyer = useCallback((ev: EvenementLiquide) => setEtat((e) => transition(e, ev)), []);

  // Progression simulée pendant le chargement.
  useEffect(() => {
    if (etat !== 'chargement') return;
    debut.current = performance.now();
    setSimulee(0);
    const id = window.setInterval(() => setSimulee(progressionSimulee(performance.now() - debut.current)), 80);
    return () => window.clearInterval(id);
  }, [etat]);

  // Retour au repos.
  useEffect(() => {
    if (etat !== 'succes' && etat !== 'erreur') return;
    const id = window.setTimeout(() => envoyer('reinitialiser'), DELAI_RETOUR_REPOS_MS);
    return () => window.clearTimeout(id);
  }, [etat, envoyer]);

  // Mode contrôlé (formulaires).
  const precedent = useRef(opts.enCours);
  useEffect(() => {
    if (opts.enCours === undefined) return;
    if (opts.enCours && !precedent.current) envoyer('cliquer');
    if (!opts.enCours && precedent.current) envoyer(opts.echec ? 'rejeter' : 'resoudre');
    precedent.current = opts.enCours;
  }, [opts.enCours, opts.echec, envoyer]);

  const declencher = useCallback(async () => {
    if (!opts.action || !peutDeclencher(etatRef.current)) return;
    envoyer('cliquer');
    const t0 = performance.now();
    // Impression (`window.print`) et CSV (`a.click`) doivent rester dans le tour du clic :
    // un délai sort du geste utilisateur (Safari / iOS) et peut viser une modale déjà fermée.
    const issue = executerAction(opts.action);
    const reste = DUREE_MIN_CHARGEMENT_MS - (performance.now() - t0);
    if (reste > 0) await attendre(reste);
    envoyer(await issue);
  }, [opts.action, envoyer]);

  const niveau = niveauRemplissage(etat, opts.progression ?? simulee);
  return { etat, niveau, declencher };
}

/** Remplissage liquide (calque décoratif) : monte du bas, crête en vague. */
export const Remplissage: React.FC<{ etat: EtatLiquide; niveau: number }> = ({ etat, niveau }) => {
  const reduire = useReducedMotion();
  const visible = etat === 'chargement' || etat === 'succes';
  const couleur = etat === 'erreur' ? '#dc2626' : LIQUIDE.clair;
  if (reduire) {
    return (
      <motion.span
        aria-hidden="true"
        data-liquide="remplissage"
        className="pointer-events-none absolute inset-0 z-0"
        style={{ background: couleur }}
        initial={false}
        animate={{ opacity: etat === 'erreur' ? 1 : visible ? Math.max(0.35, niveau) : 0 }}
        transition={{ duration: 0.25 }}
      />
    );
  }
  return (
    <motion.span
      aria-hidden="true"
      data-liquide="remplissage"
      className="pointer-events-none absolute inset-x-0 bottom-0 top-0 z-0"
      initial={false}
      animate={{ y: etat === 'erreur' ? '0%' : `${(1 - niveau) * 100 + (visible ? 0 : 12)}%` }}
      transition={{ duration: etat === 'succes' ? 0.25 : 0.4, ease: 'easeOut' }}
    >
      <span className="absolute inset-0 top-[5px]" style={{ background: couleur }} />
      {etat === 'chargement' && (
        <motion.svg
          className="absolute left-0 top-0 h-[6px] w-[200%]"
          viewBox="0 0 200 6"
          preserveAspectRatio="none"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: 1.1, ease: 'linear', repeat: Infinity }}
        >
          <path d="M0 3 Q12.5 0 25 3 T50 3 T75 3 T100 3 T125 3 T150 3 T175 3 T200 3 V6 H0 Z" fill={couleur} />
        </motion.svg>
      )}
    </motion.span>
  );
};

/** Icône qui glisse : l'icône de repos sort vers le bas, la coche (ou l'erreur) arrive par le haut. */
export const IconeGlissante: React.FC<{ etat: EtatLiquide; icone?: string; className?: string }> = ({ etat, icone, className = 'text-base' }) => {
  const reduire = useReducedMotion();
  const nom = etat === 'succes' ? 'check' : etat === 'erreur' ? 'error' : etat === 'chargement' ? null : icone;
  if (!icone) return null;
  return (
    <span className={`relative z-10 inline-flex shrink-0 overflow-hidden ${className}`} style={{ width: '1em', height: '1em' }} aria-hidden="true">
      <AnimatePresence initial={false} mode="wait">
        {nom && (
          <motion.span
            key={nom}
            className={`material-symbols-outlined ${className}`}
            style={{ lineHeight: 1 }}
            initial={reduire ? { opacity: 0 } : { y: '-110%' }}
            animate={reduire ? { opacity: 1 } : { y: '0%', transition: { duration: 0.3, ease: 'easeOut' } }}
            exit={reduire ? { opacity: 0 } : { y: '110%', transition: { duration: 0.3, ease: 'easeIn' } }}
          >
            {nom}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
};

type BaseBouton = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'children' | 'onAnimationStart' | 'onDrag' | 'onDragStart' | 'onDragEnd'>;

export interface LiquidButtonProps extends BaseBouton {
  /** Action asynchrone (ou synchrone) suivie par le bouton. Absente : mode contrôlé. */
  action?: () => unknown;
  enCours?: boolean;
  echec?: boolean;
  /** Progression réelle 0 → 1 si connue (sinon simulée). */
  progression?: number;
  icone?: string;
  iconeClassName?: string;
  libelle: React.ReactNode;
  libelleChargement?: React.ReactNode;
  libelleSucces?: React.ReactNode;
  libelleErreur?: React.ReactNode;
  libelleClassName?: string;
}

const CLASSE_COMMUNE =
  'relative isolate overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0051d5] focus-visible:ring-offset-2 transition-colors';

function classeEtat(etat: EtatLiquide): string {
  if (etat === 'succes') return '!bg-[#c5ceff] !text-[#00236f]';
  if (etat === 'erreur') return '!bg-red-600 !text-white !border-red-600';
  return '';
}

const SECOUSSE = { x: [0, -6, 6, -4, 4, 0], transition: { duration: 0.4 } };

/** Bouton large à remplissage liquide (s'utilise à la place d'un `<button>` existant, mêmes classes). */
export const LiquidButton: React.FC<LiquidButtonProps> = ({
  action, enCours, echec, progression, icone, iconeClassName, libelle,
  libelleChargement = 'Téléchargement…', libelleSucces = 'Terminé', libelleErreur = 'Échec',
  libelleClassName, className = '', type = 'button', disabled, ...rest
}) => {
  const { etat, niveau, declencher } = useLiquide({ action, enCours, echec, progression });
  const texte = etat === 'chargement' ? libelleChargement : etat === 'succes' ? libelleSucces : etat === 'erreur' ? libelleErreur : libelle;
  return (
    <motion.button
      {...rest}
      type={type}
      disabled={disabled}
      onClick={action ? () => void declencher() : undefined}
      aria-busy={etat === 'chargement'}
      data-etat-liquide={etat}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      animate={etat === 'erreur' ? SECOUSSE : { x: 0 }}
      className={`${className} ${CLASSE_COMMUNE} ${classeEtat(etat)}`}
    >
      <Remplissage etat={etat} niveau={niveau} />
      <IconeGlissante etat={etat} icone={icone} className={iconeClassName} />
      <span className={`relative z-10 ${libelleClassName ?? ''}`} aria-live="polite">{texte}</span>
    </motion.button>
  );
};

export interface LiquidIconButtonProps extends BaseBouton {
  action?: () => unknown;
  enCours?: boolean;
  echec?: boolean;
  progression?: number;
  icone: string;
  iconeClassName?: string;
  'aria-label': string;
}

/** Bouton icône carré à remplissage liquide. */
export const LiquidIconButton: React.FC<LiquidIconButtonProps> = ({
  action, enCours, echec, progression, icone, iconeClassName = 'text-xl', className = '', type = 'button', disabled, ...rest
}) => {
  const { etat, niveau, declencher } = useLiquide({ action, enCours, echec, progression });
  return (
    <motion.button
      {...rest}
      type={type}
      disabled={disabled}
      onClick={action ? () => void declencher() : undefined}
      aria-busy={etat === 'chargement'}
      data-etat-liquide={etat}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      animate={etat === 'erreur' ? SECOUSSE : { x: 0 }}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#00236f] text-white ${className} ${CLASSE_COMMUNE} ${classeEtat(etat)}`}
    >
      <Remplissage etat={etat} niveau={niveau} />
      <IconeGlissante etat={etat} icone={icone} className={iconeClassName} />
    </motion.button>
  );
};
