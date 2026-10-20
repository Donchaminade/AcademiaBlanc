/**
 * Animations par défaut d'AcademiaBlanc : révélations douces au défilement, cascades de cartes,
 * petits « pops » pour badges et chiffres, orbes de fond en dérive lente.
 * Respecte « prefers-reduced-motion » : seuls les fondus doux (opacité) sont conservés, sans déplacement ni zoom.
 * À ne jamais utiliser sur les vues d'impression, les lignes de tableau ou les champs de saisie.
 */
import React from 'react';
import { motion, useReducedMotion, type Variants } from 'motion/react';

export { useReducedMotion };

type Tag = 'div' | 'section' | 'ul' | 'ol' | 'li' | 'dl' | 'header' | 'span' | 'p' | 'h1';

const MOTION_TAGS = {
  div: motion.div,
  section: motion.section,
  ul: motion.ul,
  ol: motion.ol,
  li: motion.li,
  dl: motion.dl,
  header: motion.header,
  span: motion.span,
  p: motion.p,
  h1: motion.h1,
} as const;

type BaseProps = {
  as?: Tag;
  className?: string;
  children?: React.ReactNode;
  id?: string;
  role?: string;
  'aria-label'?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
  'aria-labelledby'?: string;
};

const VIEWPORT = { once: true, amount: 0.2 } as const;
const EASE = 'easeOut' as const;

function pick(as: Tag | undefined) {
  return MOTION_TAGS[as ?? 'div'] as React.ComponentType<Record<string, unknown>>;
}

function plain(as: Tag | undefined, props: BaseProps) {
  const { as: _as, children, ...rest } = props;
  return React.createElement(as ?? 'div', { ...rest, 'data-motion': '' }, children);
}

/** Révélation au défilement : opacité 0→1, y 40→0, 0,5 s, easeOut, une seule fois (20 % visible). */
export const Reveal: React.FC<BaseProps & { delay?: number; y?: number; onLoad?: boolean }> = ({ delay = 0, y = 40, onLoad, ...props }) => {
  const reduce = useReducedMotion();
  const Comp = pick(props.as);
  const { as: _as, children, ...rest } = props;
  const anim = reduce ? { opacity: 1 } : { opacity: 1, y: 0 };
  return (
    <Comp
      {...rest}
      data-motion=""
      initial={reduce ? { opacity: 0 } : { opacity: 0, y }}
      {...(onLoad ? { animate: anim } : { whileInView: anim, viewport: VIEWPORT })}
      transition={{ duration: 0.5, ease: EASE, delay }}
    >
      {children}
    </Comp>
  );
};

const staggerVariants = (stagger: number, delayChildren: number): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren } },
});

/** Conteneur de cascade : ses StaggerItem apparaissent l'un après l'autre (0,08 s par défaut). */
export const Stagger: React.FC<BaseProps & { stagger?: number; delay?: number; onLoad?: boolean }> = ({
  stagger = 0.08,
  delay = 0,
  onLoad,
  ...props
}) => {
  const reduce = useReducedMotion();
  const Comp = pick(props.as);
  const { as: _as, children, ...rest } = props;
  return (
    <Comp
      {...rest}
      data-motion=""
      variants={staggerVariants(stagger, delay)}
      initial="hidden"
      {...(onLoad ? { animate: 'show' } : { whileInView: 'show', viewport: VIEWPORT })}
    >
      {children}
    </Comp>
  );
};

const itemVariants: Record<'card' | 'rise' | 'pop', Variants> = {
  /** Carte : pop 0.95→1 avec montée. */
  card: { hidden: { opacity: 0, y: 40, scale: 0.95 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: EASE } } },
  /** Élément de texte (cascade du hero). */
  rise: { hidden: { opacity: 0, y: 40 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } } },
  /** Petit badge / chiffre : 0.8→1 en 0,35 s. */
  pop: { hidden: { opacity: 0, scale: 0.8 }, show: { opacity: 1, scale: 1, transition: { duration: 0.35, ease: EASE } } },
};

/** Mouvement réduit : fondu seul. */
const fadeVariants: Variants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.4, ease: EASE } } };

/** Enfant d'un Stagger. */
export const StaggerItem: React.FC<BaseProps & { variant?: 'card' | 'rise' | 'pop' }> = ({ variant = 'card', ...props }) => {
  const reduce = useReducedMotion();
  const Comp = pick(props.as);
  const { as: _as, children, ...rest } = props;
  return (
    <Comp {...rest} data-motion="" variants={reduce ? fadeVariants : itemVariants[variant]}>
      {children}
    </Comp>
  );
};

/** Badge ou chiffre autonome : pop 0.8→1, 0,35 s, à l'entrée dans la vue. */
export const Pop: React.FC<BaseProps & { delay?: number }> = ({ delay = 0, ...props }) => {
  const reduce = useReducedMotion();
  const Comp = pick(props.as);
  const { as: _as, children, ...rest } = props;
  return (
    <Comp
      {...rest}
      data-motion=""
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
      whileInView={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
      viewport={VIEWPORT}
      transition={{ duration: 0.35, ease: EASE, delay }}
    >
      {children}
    </Comp>
  );
};

/** Apparition légère d'une vue de l'application (pas de délai perceptible pour le travail). */
export const PageReveal: React.FC<BaseProps> = (props) => {
  const reduce = useReducedMotion();
  if (reduce) return plain(props.as, props);
  const Comp = pick(props.as);
  const { as: _as, children, ...rest } = props;
  return (
    <Comp {...rest} data-motion="" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }}>
      {children}
    </Comp>
  );
};

const ORBS = [
  { cls: 'left-[-10%] top-[-15%] h-[34rem] w-[34rem] bg-[#316bf3]/35', x: ['0%', '18%', '-6%', '0%'], y: ['0%', '12%', '20%', '0%'], d: 15 },
  { cls: 'right-[-12%] top-[10%] h-[30rem] w-[30rem] bg-[#0051d5]/30', x: ['0%', '-15%', '8%', '0%'], y: ['0%', '18%', '-10%', '0%'], d: 17 },
  { cls: 'bottom-[-20%] left-[30%] h-[28rem] w-[28rem] bg-[#90a8ff]/25', x: ['0%', '12%', '-18%', '0%'], y: ['0%', '-14%', '6%', '0%'], d: 19 },
];

/** 2–3 grandes orbes floues aux bleus de la charte, en dérive lente et continue. Décoratives. */
export const GradientOrbs: React.FC<{ className?: string }> = ({ className = '' }) => {
  const reduce = useReducedMotion();
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      {ORBS.map((orb, i) =>
        reduce ? (
          <div key={i} className={`absolute rounded-full blur-3xl ${orb.cls}`} />
        ) : (
          <motion.div
            key={i}
            className={`absolute rounded-full blur-3xl will-change-transform ${orb.cls}`}
            animate={{ x: orb.x, y: orb.y }}
            transition={{ duration: orb.d, ease: 'linear', repeat: Infinity }}
          />
        ),
      )}
    </div>
  );
};
