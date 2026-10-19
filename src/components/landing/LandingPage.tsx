import React, { Suspense, lazy, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ROUTE_PATHS } from '../../utils/router';
import { usePrereglageDefaut } from '../../api/prereglages';
import { bandeauNational } from '../../utils/prereglages';

// Three.js n’est chargé que lorsque la vitrine s’affiche : l’application connectée n’en dépend pas.
const HeroScene = lazy(() => import('./HeroScene'));

gsap.registerPlugin(ScrollTrigger);

interface LandingPageProps {
  onConnexion: () => void;
  onInscription: () => void;
}

const NAV_LINKS: { href: string; label: string }[] = [
  { href: '#accueil', label: 'Accueil' },
  { href: '#a-propos', label: 'À propos' },
  { href: '#comment-ca-marche', label: 'Comment ça marche' },
];

const ATOUTS: { icon: string; title: string; text: string }[] = [
  {
    icon: 'verified',
    title: 'Fiable',
    text: 'Moyennes, rangs et mentions sont calculés par la plateforme. Plus d’erreurs de report.',
  },
  {
    icon: 'touch_app',
    title: 'Simple',
    text: 'Une interface en français, pensée pour le secrétariat et les enseignants. Aucune formation longue.',
  },
  {
    icon: 'lock',
    title: 'Souverain',
    text: 'Chaque établissement a son espace. Ses données restent isolées et protégées.',
  },
];

const ETAPES: { icon: string; title: string; text: string }[] = [
  {
    icon: 'domain_add',
    title: 'Créez votre compte',
    text: 'Renseignez l’établissement et le responsable. Votre espace est prêt en une minute.',
  },
  {
    icon: 'tune',
    title: 'Préparez la session',
    text: 'Classes, matières, coefficients, centres : tout se règle dans l’administration.',
  },
  {
    icon: 'edit_note',
    title: 'Saisissez les notes',
    text: 'Les enseignants saisissent, le jury délibère. Les rangs se mettent à jour aussitôt.',
  },
  {
    icon: 'print',
    title: 'Imprimez les bulletins',
    text: 'Bulletins A4, procès-verbal et listes d’émargement. Cachet et signatures inclus.',
  },
];

const REPERES: { value: string; label: string }[] = [
  { value: 'A4', label: 'Bulletins prêts à imprimer' },
  { value: '4', label: 'Étapes, du compte au bulletin' },
  { value: '100 %', label: 'Données isolées par établissement' },
];

/** Lien interne : vraie balise `a` (ouverture dans un nouvel onglet possible), navigation sans rechargement. */
const RouteLink: React.FC<{
  href: string;
  onNavigate: () => void;
  className?: string;
  children: React.ReactNode;
  magnetic?: boolean;
}> = ({ href, onNavigate, className, children, magnetic }) => (
  <a
    href={href}
    data-magnetic={magnetic ? '' : undefined}
    className={className}
    onClick={(event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      onNavigate();
    }}
  >
    {children}
  </a>
);

const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-[#0051d5] px-5 py-3 text-[14px] font-bold text-white shadow-md transition-colors hover:bg-[#003cb3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fc922b]';
const btnLight =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-white/30 bg-white/10 px-5 py-3 text-[14px] font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fc922b]';
const btnOnDark =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-[14px] font-bold text-[#00236f] shadow-md transition-colors hover:bg-[#dce1ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fc922b]';
const btnGhost =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-[#c5c5d3] bg-white px-5 py-3 text-[14px] font-bold text-[#00236f] transition-colors hover:border-[#0051d5] hover:bg-[#f2f3ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0051d5]';

export const LandingPage: React.FC<LandingPageProps> = ({ onConnexion, onInscription }) => {
  // Bandeau national : préréglage par défaut de la plateforme (repli local si l'API est injoignable).
  const prereglageDefaut = usePrereglageDefaut();
  const bandeau = bandeauNational(prereglageDefaut);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const heroRef = useRef<HTMLElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const hero = heroRef.current;
    if (!root || !hero) return undefined;

    const mm = gsap.matchMedia(root);

    // Sans préférence « moins d’animations » : apparition du hero, révélations au défilement,
    // parallaxe léger et micro-interactions. Sinon, rien n’est appliqué et tout reste visible.
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
      intro
        .from('[data-hero]', { y: 28, autoAlpha: 0, duration: 0.8, stagger: 0.12 }, 0.1)
        .from('[data-hero-visual]', { y: 48, autoAlpha: 0, rotate: 3, duration: 1.1 }, 0.45)
        .from('[data-hero-visual] [data-row]', { x: -12, autoAlpha: 0, duration: 0.4, stagger: 0.07 }, 0.9);

      gsap.to('[data-parallax]', {
        yPercent: -14,
        ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.6 },
      });
      gsap.to('[data-parallax-slow]', {
        yPercent: 10,
        ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.6 },
      });

      gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((element) => {
        gsap.from(element, {
          y: 36,
          autoAlpha: 0,
          duration: 0.8,
          ease: 'power2.out',
          scrollTrigger: { trigger: element, start: 'top 85%', once: true },
        });
      });

      gsap.from('[data-step]', {
        y: 40,
        autoAlpha: 0,
        duration: 0.7,
        stagger: 0.14,
        ease: 'power2.out',
        scrollTrigger: { trigger: '[data-steps]', start: 'top 78%', once: true },
      });
      gsap.from('[data-step-line]', {
        scaleX: 0,
        transformOrigin: 'left center',
        duration: 1.2,
        ease: 'power2.inOut',
        scrollTrigger: { trigger: '[data-steps]', start: 'top 78%', once: true },
      });

      const cleanups: (() => void)[] = [];
      gsap.utils.toArray<HTMLElement>('[data-magnetic]').forEach((button) => {
        const icon = button.querySelector<HTMLElement>('.material-symbols-outlined');
        const enter = () => {
          gsap.to(button, { scale: 1.04, y: -1, duration: 0.25, ease: 'power2.out', overwrite: 'auto' });
          if (icon) gsap.to(icon, { x: 3, duration: 0.25, ease: 'power2.out', overwrite: 'auto' });
        };
        const leave = () => {
          gsap.to(button, { scale: 1, y: 0, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
          if (icon) gsap.to(icon, { x: 0, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
        };
        const press = () => gsap.to(button, { scale: 0.97, duration: 0.1, ease: 'power1.out', overwrite: 'auto' });
        const release = () => gsap.to(button, { scale: 1.04, duration: 0.2, ease: 'power2.out', overwrite: 'auto' });
        button.addEventListener('pointerenter', enter);
        button.addEventListener('pointerleave', leave);
        button.addEventListener('pointerdown', press);
        button.addEventListener('pointerup', release);
        button.addEventListener('pointercancel', leave);
        cleanups.push(() => {
          button.removeEventListener('pointerenter', enter);
          button.removeEventListener('pointerleave', leave);
          button.removeEventListener('pointerdown', press);
          button.removeEventListener('pointerup', release);
          button.removeEventListener('pointercancel', leave);
        });
      });

      return () => cleanups.forEach((fn) => fn());
    });

    // Polices chargées après le premier rendu : les positions de déclenchement sont recalculées.
    const refresh = () => ScrollTrigger.refresh();
    document.fonts?.ready.then(refresh).catch(() => undefined);
    window.addEventListener('load', refresh);

    return () => {
      window.removeEventListener('load', refresh);
      mm.revert();
    };
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div ref={rootRef} className="min-h-screen bg-[#faf8ff] text-[#131b2e] antialiased">
      <a
        href="#accueil"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-[13px] focus:font-bold focus:text-[#00236f] focus:shadow-lg"
      >
        Aller au contenu
      </a>

      {/* Barre de navigation */}
      <header className="sticky top-0 z-40 border-b border-[#eaedff] bg-white/85 backdrop-blur-md">
        <nav aria-label="Navigation principale" className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <a href="#accueil" className="flex items-center gap-2.5 min-w-0" onClick={closeMenu}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#00236f] text-white">
              <span className="material-symbols-outlined text-xl">account_balance</span>
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[16px] font-bold leading-tight tracking-tight text-[#00236f]">AcademiaBlanc</span>
              <span className="block text-[11px] font-medium leading-tight text-[#444651]">Examens blancs • {prereglageDefaut.sigleMinistere}</span>
            </span>
          </a>

          <ul className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="text-[13px] font-semibold text-[#444651] transition-colors hover:text-[#0051d5]">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="hidden items-center gap-2 md:flex">
            <RouteLink href={ROUTE_PATHS.connexion} onNavigate={onConnexion} className={`${btnGhost} px-4 py-2 text-[13px]`} magnetic>
              <span className="material-symbols-outlined text-base">login</span>
              <span>Se connecter</span>
            </RouteLink>
            <RouteLink href={ROUTE_PATHS.inscription} onNavigate={onInscription} className={`${btnPrimary} px-4 py-2 text-[13px]`} magnetic>
              <span className="material-symbols-outlined text-base">domain_add</span>
              <span>Créer le compte de mon établissement</span>
            </RouteLink>
          </div>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#eaedff] text-[#00236f] md:hidden"
            aria-expanded={menuOpen}
            aria-controls="menu-mobile"
            aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="material-symbols-outlined text-2xl">{menuOpen ? 'close' : 'menu'}</span>
          </button>
        </nav>

        {menuOpen && (
          <div id="menu-mobile" className="border-t border-[#eaedff] bg-white px-4 py-4 md:hidden">
            <ul className="space-y-1">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={closeMenu}
                    className="block rounded-lg px-3 py-2.5 text-[14px] font-semibold text-[#131b2e] hover:bg-[#f2f3ff]"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-3 grid gap-2">
              <RouteLink href={ROUTE_PATHS.connexion} onNavigate={onConnexion} className={btnGhost}>
                <span className="material-symbols-outlined text-base">login</span>
                <span>Se connecter</span>
              </RouteLink>
              <RouteLink href={ROUTE_PATHS.inscription} onNavigate={onInscription} className={btnPrimary}>
                <span className="material-symbols-outlined text-base">domain_add</span>
                <span>Créer le compte de mon établissement</span>
              </RouteLink>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* Accueil */}
        <section
          id="accueil"
          ref={heroRef}
          aria-labelledby="titre-accueil"
          className="relative isolate flex overflow-hidden bg-[#00236f] text-white lg:min-h-[calc(100svh-4rem)]"
        >
          <div className="absolute inset-0 -z-10" aria-hidden="true">
            <Suspense fallback={null}>
              <HeroScene />
            </Suspense>
          </div>
          {/* Voile de lisibilité au-dessus de la scène, sous le texte. */}
          <div
            className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(0,35,111,0.55)_0%,rgba(0,35,111,0.35)_55%,#00236f_100%)]"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 -z-10 bg-[radial-gradient(60%_70%_at_20%_45%,rgba(0,35,111,0.75)_0%,rgba(0,35,111,0)_100%)]"
            aria-hidden="true"
          />

          <div className="mx-auto grid w-full max-w-6xl items-center gap-12 self-center px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:pb-24 lg:pt-20">
            <div data-parallax-slow>
              <span
                data-hero
                className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-white/90"
              >
                <span className="material-symbols-outlined text-sm text-[#fc922b]">flag</span>
                {bandeau}
              </span>
              <h1
                id="titre-accueil"
                data-hero
                className="mt-5 text-[36px] font-extrabold leading-[1.08] tracking-tight sm:text-[46px] lg:text-[56px]"
              >
                Les examens blancs,
                <br />
                <span className="text-[#90a8ff]">sans paperasse.</span>
              </h1>
              <p data-hero className="mt-5 max-w-xl text-[16px] leading-relaxed text-white/85 sm:text-[18px]">
                Inscrivez vos candidats. Saisissez les notes. Délibérez. Imprimez des bulletins au format A4.
                Tout au même endroit, pour votre établissement.
              </p>
              <div data-hero className="mt-8 flex flex-col gap-3 sm:flex-row">
                <RouteLink href={ROUTE_PATHS.inscription} onNavigate={onInscription} className={btnPrimary} magnetic>
                  <span className="material-symbols-outlined text-lg">domain_add</span>
                  <span>Créer le compte de mon établissement</span>
                </RouteLink>
                <RouteLink href={ROUTE_PATHS.connexion} onNavigate={onConnexion} className={btnLight} magnetic>
                  <span className="material-symbols-outlined text-lg">login</span>
                  <span>Se connecter</span>
                </RouteLink>
              </div>
              <dl data-hero className="mt-10 grid grid-cols-3 gap-4 border-t border-white/15 pt-6">
                {REPERES.map((item) => (
                  <div key={item.label} className="flex flex-col">
                    <dt className="order-2 text-[11px] font-medium leading-snug text-white/70 sm:text-[12px]">{item.label}</dt>
                    <dd className="font-mono text-[22px] font-bold text-white sm:text-[26px]">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Aperçu stylisé d’un bulletin */}
            <div data-hero-visual data-parallax className="relative mx-auto w-full max-w-md lg:max-w-none">
              <div className="absolute -left-6 -top-6 h-24 w-24 rounded-full bg-[#316bf3]/40 blur-2xl" aria-hidden="true" />
              <div className="absolute -bottom-8 -right-4 h-28 w-28 rounded-full bg-[#fc922b]/30 blur-2xl" aria-hidden="true" />
              <div
                className="relative rounded-xl border border-white/20 bg-white p-5 text-[#131b2e] shadow-2xl sm:p-6"
                role="img"
                aria-label="Aperçu d’un bulletin : matières, notes, moyenne et mention"
              >
                <div className="flex items-start justify-between gap-3 border-b border-[#eaedff] pb-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#0051d5]">Bulletin d’examen blanc</p>
                    <p className="mt-1 text-[15px] font-bold text-[#00236f]">BAC II Blanc • Série D</p>
                    <p className="text-[11px] text-[#444651]">Table n° 104 • Session 2025</p>
                  </div>
                  <span className="rounded-lg bg-[#eaedff] px-2.5 py-1 font-mono text-[11px] font-bold text-[#00236f]">A4</span>
                </div>
                <table className="mt-3 w-full text-[12px]">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wider text-[#757682]">
                      <th className="py-1 font-semibold">Matière</th>
                      <th className="py-1 text-right font-semibold">Note</th>
                      <th className="py-1 text-center font-semibold">Coef.</th>
                    </tr>
                  </thead>
                  <tbody className="font-medium">
                    {[
                      ['Mathématiques', '4', '15,50'],
                      ['Sciences physiques', '3', '13,00'],
                      ['SVT', '3', '14,25'],
                      ['Philosophie', '2', '12,00'],
                      ['Anglais', '2', '16,00'],
                    ].map(([matiere, coef, note]) => (
                      <tr key={matiere} data-row className="border-t border-[#f2f3ff]">
                        <td className="py-1.5">{matiere}</td>
                        <td className="py-1.5 text-right font-mono font-bold text-[#00236f]">{note}</td>
                        <td className="py-1.5 text-center font-mono text-[#444651]">{coef}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div data-row className="mt-3 flex items-center justify-between rounded-lg bg-[#f2f3ff] px-3 py-2.5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#444651]">Moyenne générale</p>
                    <p className="font-mono text-[20px] font-bold text-[#00236f]">14,21<span className="text-[12px] text-[#757682]">/20</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#444651]">Rang</p>
                    <p className="font-mono text-[16px] font-bold text-[#0051d5]">3<sup>e</sup> / 62</p>
                  </div>
                  <span className="rounded-lg bg-[#00236f] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white">
                    Bien
                  </span>
                </div>
                <div data-row className="mt-3 flex items-center gap-2 text-[11px] text-[#444651]">
                  <span className="material-symbols-outlined text-base text-[#0051d5]">verified</span>
                  Cachet et signatures de l’établissement apposés.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* À propos */}
        <section id="a-propos" aria-labelledby="titre-a-propos" className="py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div data-reveal className="max-w-2xl">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#0051d5]">À propos</span>
              <h2 id="titre-a-propos" className="mt-2 text-[28px] font-extrabold leading-tight tracking-tight text-[#00236f] sm:text-[36px]">
                Une plateforme faite pour les établissements togolais.
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-[#444651] sm:text-[16px]">
                AcademiaBlanc gère les examens blancs du collège et du lycée. Elle suit les candidats, calcule les
                moyennes et édite des bulletins conformes. Le secrétariat gagne des heures. Les enseignants se
                concentrent sur les notes. Le chef d’établissement signe en confiance.
              </p>
            </div>

            <ul className="mt-12 grid gap-5 sm:grid-cols-3">
              {ATOUTS.map((atout) => (
                <li
                  key={atout.title}
                  data-reveal
                  className="rounded-xl border border-[#eaedff] bg-white p-6 shadow-[0_1px_8px_rgba(0,0,0,0.04)]"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#eaedff] text-[#0051d5]">
                    <span className="material-symbols-outlined text-2xl">{atout.icon}</span>
                  </span>
                  <h3 className="mt-4 text-[17px] font-bold text-[#00236f]">{atout.title}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-[#444651]">{atout.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Comment ça marche */}
        <section id="comment-ca-marche" aria-labelledby="titre-etapes" className="bg-white py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div data-reveal className="max-w-2xl">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#0051d5]">Comment ça marche</span>
              <h2 id="titre-etapes" className="mt-2 text-[28px] font-extrabold leading-tight tracking-tight text-[#00236f] sm:text-[36px]">
                Quatre étapes. Du compte au bulletin.
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-[#444651] sm:text-[16px]">
                Pas de configuration compliquée. Vous avancez dans l’ordre, à votre rythme.
              </p>
            </div>

            <div data-steps className="relative mt-12">
              <div
                data-step-line
                className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-[#0051d5] via-[#90a8ff] to-[#fc922b] lg:block"
                aria-hidden="true"
              />
              <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {ETAPES.map((etape, index) => (
                  <li key={etape.title} data-step className="relative rounded-xl border border-[#eaedff] bg-[#faf8ff] p-6">
                    <div className="flex items-center gap-3">
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#00236f] text-white shadow-md">
                        <span className="material-symbols-outlined text-2xl">{etape.icon}</span>
                      </span>
                      <span className="font-mono text-[28px] font-bold text-[#dce1ff]">0{index + 1}</span>
                    </div>
                    <h3 className="mt-5 text-[17px] font-bold text-[#00236f]">{etape.title}</h3>
                    <p className="mt-2 text-[14px] leading-relaxed text-[#444651]">{etape.text}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* Appel à l’action final */}
        <section aria-labelledby="titre-cta" className="py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div
              data-reveal
              className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#00236f] via-[#1e3a8a] to-[#0051d5] px-6 py-12 text-white shadow-xl sm:px-12 sm:py-16"
            >
              <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-[#316bf3]/40 blur-3xl" aria-hidden="true" />
              <div className="absolute -bottom-12 left-1/3 h-40 w-40 rounded-full bg-[#fc922b]/25 blur-3xl" aria-hidden="true" />
              <div className="relative grid items-center gap-8 lg:grid-cols-[1.3fr_1fr]">
                <div>
                  <h2 id="titre-cta" className="text-[28px] font-extrabold leading-tight tracking-tight sm:text-[36px]">
                    Prêt pour votre prochaine session ?
                  </h2>
                  <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/85 sm:text-[16px]">
                    Créez le compte de votre établissement. Préparez l’examen blanc. Imprimez les bulletins le jour J.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
                  <RouteLink href={ROUTE_PATHS.inscription} onNavigate={onInscription} className={btnOnDark} magnetic>
                    <span className="material-symbols-outlined text-lg">domain_add</span>
                    <span>Créer le compte</span>
                  </RouteLink>
                  <RouteLink href={ROUTE_PATHS.connexion} onNavigate={onConnexion} className={btnLight} magnetic>
                    <span className="material-symbols-outlined text-lg">login</span>
                    <span>Se connecter</span>
                  </RouteLink>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Pied de page */}
      <footer className="border-t border-[#eaedff] bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#00236f] text-white">
                <span className="material-symbols-outlined text-xl">account_balance</span>
              </span>
              <span className="text-[16px] font-bold tracking-tight text-[#00236f]">AcademiaBlanc</span>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-[#444651]">
              Gestion des examens blancs : candidats, notes, délibération et bulletins certifiés.
            </p>
          </div>
          <nav aria-label="Pied de page" className="grid grid-cols-2 gap-8 text-[13px] sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#757682]">Site</p>
              <ul className="mt-3 space-y-2">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} className="font-semibold text-[#131b2e] hover:text-[#0051d5]">{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#757682]">Compte</p>
              <ul className="mt-3 space-y-2">
                <li>
                  <RouteLink href={ROUTE_PATHS.connexion} onNavigate={onConnexion} className="font-semibold text-[#131b2e] hover:text-[#0051d5]">
                    Se connecter
                  </RouteLink>
                </li>
                <li>
                  <RouteLink href={ROUTE_PATHS.inscription} onNavigate={onInscription} className="font-semibold text-[#131b2e] hover:text-[#0051d5]">
                    Créer un compte
                  </RouteLink>
                </li>
              </ul>
            </div>
          </nav>
        </div>
        <div className="border-t border-[#eaedff] bg-[#faf8ff] px-4 py-4 text-center text-[11px] text-[#444651] sm:px-6">
          AcademiaBlanc • {bandeau} • © {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
