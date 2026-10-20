/**
 * Effets d'animation de la page d'accueil (landing) uniquement : titres mot par mot, compteurs,
 * barre de progression, flottement, lignes qui se tracent, projecteur qui suit le curseur.
 * Transform et opacité seulement. Tout est neutralisé avec « prefers-reduced-motion ».
 */
import React, { useEffect, useRef, useState } from 'react';
import { animate, motion, useInView, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from 'motion/react';

/** Mots d'un texte qui montent l'un après l'autre (niveau mot, jamais lettre). */
export const WordsRise: React.FC<{ text: string; className?: string; delay?: number; stagger?: number }> = ({ text, className, delay = 0, stagger = 0.06 }) => {
  const reduce = useReducedMotion();
  if (reduce) return <span className={className}>{text}</span>;
  const words = text.split(' ').filter(Boolean);
  return (
    <span className={className}>
      {words.map((w, i) => (
        <React.Fragment key={`${w}-${i}`}>
          <span className="inline-block overflow-hidden pb-[0.08em] align-bottom">
            <motion.span
              className="inline-block will-change-transform"
              initial={{ y: '105%', opacity: 0 }}
              animate={{ y: '0%', opacity: 1 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: delay + i * stagger }}
            >
              {w}
            </motion.span>
          </span>
          {i < words.length - 1 ? ' ' : ''}
        </React.Fragment>
      ))}
    </span>
  );
};

/** Compte de 0 à la partie numérique initiale d'une valeur (« 14 j ») à l'entrée dans la vue. */
export const CountUp: React.FC<{ value: string; className?: string }> = ({ value, className }) => {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const match = /^(\d+)(.*)$/.exec(value);
  const target = match ? Number(match[1]) : null;
  const [shown, setShown] = useState<string>(reduce || target === null ? value : `0${match?.[2] ?? ''}`);
  useEffect(() => {
    if (reduce || target === null) { setShown(value); return undefined; }
    if (!inView) return undefined;
    const ctrl = animate(0, target, { duration: 1.4, ease: 'easeOut', onUpdate: (v) => setShown(`${Math.round(v)}${match?.[2] ?? ''}`) });
    return () => ctrl.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, reduce, value]);
  return <span ref={ref} className={className}>{shown}</span>;
};

/** Fine barre de progression de défilement en haut de l'écran. */
export const ScrollProgress: React.FC = () => {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 });
  if (reduce) return null;
  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX, transformOrigin: '0% 50%' }}
      className="fixed inset-x-0 top-0 z-[55] h-[3px] bg-gradient-to-r from-[#0051d5] via-[#90a8ff] to-[#fc922b]"
    />
  );
};

/** Flottement doux et continu (badges, chiffres). */
export const Float: React.FC<{ children: React.ReactNode; className?: string; amp?: number; duration?: number; delay?: number }> = ({ children, className, amp = 6, duration = 4, delay = 0 }) => {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      animate={{ y: [0, -amp, 0] }}
      transition={{ duration, ease: 'easeInOut', repeat: Infinity, delay }}
    >
      {children}
    </motion.div>
  );
};

/** Barre d'accent sous un titre de section, qui se trace à l'entrée dans la vue. */
export const AccentBar: React.FC = () => {
  const reduce = useReducedMotion();
  const cls = 'mt-4 block h-1 w-16 rounded-full bg-gradient-to-r from-[#0051d5] to-[#fc922b]';
  if (reduce) return <span aria-hidden="true" className={cls} />;
  return (
    <motion.span
      aria-hidden="true"
      className={cls}
      style={{ transformOrigin: '0% 50%' }}
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, amount: 0.8 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.25 }}
    />
  );
};

/** Progression de défilement d'un élément (0 → 1 pendant sa traversée de l'écran). */
export function useSectionProgress(ref: React.RefObject<HTMLElement | null>): MotionValue<number> {
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 85%', 'end 60%'] });
  return useSpring(scrollYProgress, { stiffness: 100, damping: 25 });
}

/** Parallaxe verticale liée au défilement de la page (px pour 0 → 600 px de défilement). */
export function useParallax(distance: number): MotionValue<number> {
  const { scrollY } = useScroll();
  return useTransform(scrollY, [0, 600], [0, distance], { clamp: false });
}

/**
 * Projecteur qui suit le curseur sur les éléments [data-spot] (ordinateur uniquement, pas au toucher).
 * Met à jour les variables CSS --mx / --my ; le halo est dessiné en CSS (opacité seulement).
 */
export function useSpotlight(root: React.RefObject<HTMLElement | null>): void {
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = root.current;
    if (!el || reduce) return undefined;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return undefined;
    let frame = 0;
    const onMove = (event: PointerEvent) => {
      const card = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-spot]');
      if (!card) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${event.clientX - r.left}px`);
        card.style.setProperty('--my', `${event.clientY - r.top}px`);
      });
    };
    el.addEventListener('pointermove', onMove, { passive: true });
    return () => { el.removeEventListener('pointermove', onMove); cancelAnimationFrame(frame); };
  }, [root, reduce]);
}

export { motion, useReducedMotion, useTransform };
