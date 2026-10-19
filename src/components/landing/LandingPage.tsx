import React, { useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ROUTE_PATHS } from '../../utils/router';
import { usePrereglageDefaut } from '../../api/prereglages';
import { bandeauNational } from '../../utils/prereglages';

gsap.registerPlugin(ScrollTrigger);

interface LandingPageProps {
  onConnexion: () => void;
  onInscription: () => void;
}

const NAV_LINKS: { href: string; label: string }[] = [
  { href: '#accueil', label: 'Accueil' },
  { href: '#fonctionnalites', label: 'Fonctionnalités' },
  { href: '#documents', label: 'Documents' },
  { href: '#comment-ca-marche', label: 'Comment ça marche' },
  { href: '#a-propos', label: 'À propos' },
];

interface Fonctionnalite {
  icon: string;
  title: string;
  text: string;
  points?: string[];
  featured?: boolean;
}

const FONCTIONNALITES: Fonctionnalite[] = [
  {
    icon: 'hub',
    title: 'Examen blanc inter-établissements',
    text:
      'Plusieurs écoles organisent la même session. L’établissement hôte devient centre d’examen et accueille les candidats extérieurs, rattachés à leur établissement d’origine.',
    points: [
      'Classement sur l’ensemble des candidats du centre',
      'Résultats détaillés par établissement d’origine',
      'Relevés neutres, sans logo, remis à chaque école',
    ],
    featured: true,
  },
  {
    icon: 'account_balance',
    title: 'Un espace par établissement',
    text:
      'Logo, cachet et signatures enregistrés une fois. République, ministère et devise réglés par préréglage national, repris sur chaque document.',
  },
  {
    icon: 'school',
    title: 'Du collège au lycée',
    text:
      'Classes de la 6e à la 3e et de la 2nde à la Tle avec leurs séries (A4, D, C, G, F4…). Catalogue de matières, programme et coefficients par classe, titulaires et enseignants.',
  },
  {
    icon: 'group_add',
    title: 'Candidats importés en masse',
    text:
      'Import CSV ou simple collage depuis un tableur. Matricules et numéros de table attribués automatiquement. Liste des candidats imprimable avec émargement.',
  },
  {
    icon: 'event_repeat',
    title: 'Sessions illimitées',
    text:
      'BEPC blanc n° 1, n° 2, composition du trimestre : autant de sessions que nécessaire par année. CEPD, BEPC, BAC I, BAC II ou compositions. Archives consultables à tout moment.',
  },
  {
    icon: 'grid_on',
    title: 'Saisie des notes par matrice',
    text:
      'Une grille candidats × matières. Appréciations proposées automatiquement selon la note, modifiables. Absences prises en compte dans les calculs.',
  },
  {
    icon: 'description',
    title: 'Relevés et bulletins sur une page A4',
    text:
      'Moyennes pondérées, rang, moyenne la plus forte et la plus faible de la classe, minimum et maximum par matière, mention, décision et visa des parents. Impression groupée d’une classe entière ou téléchargement PDF.',
  },
  {
    icon: 'fact_check',
    title: 'Procès-verbal et tableau de bord',
    text:
      'Palmarès complet avec rang, moyenne, mention et décision, filtres admis / ajournés, export CSV, impression A4 et verrouillage du PV. Effectifs, taux de réussite et répartition des mentions en un coup d’œil.',
  },
  {
    icon: 'manage_accounts',
    title: 'Équipe et permissions',
    text:
      'Comptes secrétaire, enseignant et autres rôles, avec des droits réglés par établissement. Le compte créateur conserve tous les droits.',
  },
];

const ATOUTS: { icon: string; title: string; text: string }[] = [
  {
    icon: 'verified',
    title: 'Fiable',
    text: 'Moyennes pondérées, rangs, mentions et décisions sont calculés par la plateforme. Plus d’erreurs de report.',
  },
  {
    icon: 'touch_app',
    title: 'Simple',
    text: 'Une interface en français, pensée pour le secrétariat et les enseignants, sur ordinateur comme sur téléphone.',
  },
  {
    icon: 'lock',
    title: 'Souverain',
    text: 'Chaque établissement dispose de son espace. Ses données sont isolées et conservées sur un serveur sécurisé.',
  },
];

const ETAPES: { icon: string; title: string; text: string }[] = [
  {
    icon: 'domain_add',
    title: 'Créer l’établissement et sa charte',
    text: 'Nom, logo, cachet, signatures. Le préréglage national renseigne république, ministère et devise.',
  },
  {
    icon: 'tune',
    title: 'Classes, matières et programme',
    text: 'Niveaux et séries, catalogue de matières, coefficients par classe, titulaires et enseignants.',
  },
  {
    icon: 'edit_note',
    title: 'Session, candidats et notes',
    text: 'Ouvrez la session, importez les candidats, saisissez les notes dans la matrice. Rangs et mentions suivent.',
  },
  {
    icon: 'print',
    title: 'Imprimer relevés, liste et PV',
    text: 'Relevés A4 de toute la classe, liste des candidats avec émargement et procès-verbal verrouillé.',
  },
];

const REPERES: { value: string; label: string }[] = [
  { value: 'A4', label: 'Relevé sur une page' },
  { value: '∞', label: 'Sessions par année' },
  { value: 'PWA', label: 'Mobile et hors ligne' },
];

const PV_LIGNES: [string, string, string, string, string][] = [
  ['1', 'AKAKPO Mawuli', '16,42', 'Très bien', 'Admis'],
  ['2', 'KOUASSI Aya', '14,88', 'Bien', 'Admis'],
  ['3', 'LAWSON Essi', '13,15', 'Assez bien', 'Admis'],
  ['4', 'TRAORÉ Issa', '10,07', 'Passable', 'Admis'],
  ['5', 'DOSSOU Koffi', '08,96', '—', 'Ajourné'],
];

const LISTE_LIGNES: [string, string, string][] = [
  ['101', 'AB-25-0101', 'ABALO Komlan'],
  ['102', 'AB-25-0102', 'AGBÉKO Sena'],
  ['103', 'AB-25-0103', 'BAMBA Mariam'],
  ['104', 'AB-25-0104', 'DJOBO Afi'],
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

/** Étiquette de document imprimé (en-tête des maquettes). */
const SheetTag: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="rounded bg-[#eaedff] px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[#00236f]">{children}</span>
);

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

      // Grilles de cartes : apparition en cascade, déclenchée par le conteneur.
      gsap.utils.toArray<HTMLElement>('[data-cards]').forEach((grid) => {
        gsap.from(grid.querySelectorAll('[data-card]'), {
          y: 32,
          autoAlpha: 0,
          duration: 0.7,
          stagger: 0.08,
          ease: 'power2.out',
          scrollTrigger: { trigger: grid, start: 'top 82%', once: true },
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
    <div ref={rootRef} className="min-h-dvh overflow-x-clip bg-[#faf8ff] text-[#131b2e] antialiased">
      <a
        href="#accueil"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-[13px] focus:font-bold focus:text-[#00236f] focus:shadow-lg"
      >
        Aller au contenu
      </a>

      {/* Barre de navigation */}
      <header className="sticky top-0 z-40 border-b border-[#eaedff] bg-white/85 backdrop-blur-md">
        <nav aria-label="Navigation principale" className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <a href="#accueil" className="flex min-w-0 shrink-0 items-center gap-2.5" onClick={closeMenu}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#00236f] text-white">
              <span className="material-symbols-outlined text-xl">account_balance</span>
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[16px] font-bold leading-tight tracking-tight text-[#00236f]">AcademiaBlanc</span>
              <span className="block text-[11px] font-medium leading-tight text-[#444651]">Examens blancs • {prereglageDefaut.sigleMinistere}</span>
            </span>
          </a>

          <ul className="hidden items-center gap-5 lg:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="whitespace-nowrap text-[13px] font-semibold text-[#444651] transition-colors hover:text-[#0051d5]">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            <RouteLink href={ROUTE_PATHS.connexion} onNavigate={onConnexion} className={`${btnGhost} whitespace-nowrap px-4 py-2 text-[13px]`} magnetic>
              <span className="material-symbols-outlined text-base">login</span>
              <span>Se connecter</span>
            </RouteLink>
            <RouteLink href={ROUTE_PATHS.inscription} onNavigate={onInscription} className={`${btnPrimary} whitespace-nowrap px-4 py-2 text-[13px]`} magnetic>
              <span className="material-symbols-outlined text-base">domain_add</span>
              <span className="2xl:hidden">Créer le compte</span>
              <span className="hidden 2xl:inline">Créer le compte de mon établissement</span>
            </RouteLink>
          </div>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#eaedff] text-[#00236f] lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="menu-mobile"
            aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="material-symbols-outlined text-2xl">{menuOpen ? 'close' : 'menu'}</span>
          </button>
        </nav>

        {menuOpen && (
          <div id="menu-mobile" className="border-t border-[#eaedff] bg-white px-4 py-4 lg:hidden">
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
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
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
          {/* Voile de lisibilité sous le texte. */}
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
                <span className="text-[#90a8ff]">du candidat au procès-verbal.</span>
              </h1>
              <p data-hero className="mt-5 max-w-xl text-[16px] leading-relaxed text-white/85 sm:text-[18px]">
                Importez vos candidats, saisissez les notes, laissez la plateforme calculer moyennes, rangs et mentions.
                Imprimez relevés, liste des candidats et procès-verbal. Seul ou avec d’autres établissements.
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

            {/* Aperçu stylisé d’un relevé */}
            <div data-hero-visual data-parallax className="relative mx-auto w-full max-w-md lg:max-w-none">
              <div className="absolute -left-6 -top-6 h-24 w-24 rounded-full bg-[#316bf3]/40 blur-2xl" aria-hidden="true" />
              <div className="absolute -bottom-8 -right-4 h-28 w-28 rounded-full bg-[#fc922b]/30 blur-2xl" aria-hidden="true" />
              <div
                className="relative rounded-xl border border-white/20 bg-white p-5 text-[#131b2e] shadow-2xl sm:p-6"
                role="img"
                aria-label="Aperçu d’un relevé de notes : matières, notes, coefficients, moyenne, rang, mention et décision"
              >
                <div className="flex items-start justify-between gap-3 border-b border-[#eaedff] pb-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#0051d5]">Relevé de notes</p>
                    <p className="mt-1 text-[15px] font-bold text-[#00236f]">BAC II blanc n° 1 • Tle D</p>
                    <p className="text-[11px] text-[#444651]">Table n° 104 • Année 2025-2026</p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-[#eaedff] px-2.5 py-1 font-mono text-[11px] font-bold text-[#00236f]">1 page A4</span>
                </div>
                <table className="mt-3 w-full text-[12px]">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wider text-[#757682]">
                      <th className="py-1 font-semibold">Matière</th>
                      <th className="py-1 text-right font-semibold">Note /20</th>
                      <th className="py-1 text-center font-semibold">Coef.</th>
                      <th className="hidden py-1 text-center font-semibold sm:table-cell">Min – Max</th>
                    </tr>
                  </thead>
                  <tbody className="font-medium">
                    {[
                      ['Mathématiques', '4', '15,50', '04,00 – 17,50'],
                      ['Sciences physiques', '3', '13,00', '05,50 – 16,00'],
                      ['SVT', '3', '14,25', '06,00 – 18,00'],
                      ['Philosophie', '2', '12,00', '07,00 – 15,00'],
                      ['Anglais', '2', '16,00', '05,00 – 17,00'],
                    ].map(([matiere, coef, note, minMax]) => (
                      <tr key={matiere} data-row className="border-t border-[#f2f3ff]">
                        <td className="py-1.5">{matiere}</td>
                        <td className="py-1.5 text-right font-mono font-bold text-[#00236f]">{note}</td>
                        <td className="py-1.5 text-center font-mono text-[#444651]">{coef}</td>
                        <td className="hidden py-1.5 text-center font-mono text-[11px] text-[#757682] sm:table-cell">{minMax}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div data-row className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-[#f2f3ff] px-3 py-2.5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#444651]">Moyenne</p>
                    <p className="font-mono text-[20px] font-bold text-[#00236f]">14,21<span className="text-[12px] text-[#757682]">/20</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#444651]">Rang</p>
                    <p className="font-mono text-[16px] font-bold text-[#0051d5]">3<sup>e</sup> / 62</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="rounded-lg bg-[#00236f] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Bien</span>
                    <span className="rounded-lg bg-[#dcfce7] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#166534]">Admis</span>
                  </div>
                </div>
                <div data-row className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] text-[#444651]">
                  <span>Classe : plus forte 16,42 • plus faible 06,13</span>
                  <span className="inline-flex items-center gap-1">
                    <span className="material-symbols-outlined text-base text-[#0051d5]">verified</span>
                    Cachet, signatures, visa des parents.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Fonctionnalités */}
        <section id="fonctionnalites" aria-labelledby="titre-fonctionnalites" className="py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div data-reveal className="max-w-2xl">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#0051d5]">Fonctionnalités</span>
              <h2 id="titre-fonctionnalites" className="mt-2 text-[28px] font-extrabold leading-tight tracking-tight text-[#00236f] sm:text-[36px]">
                Tout l’examen blanc, de la préparation aux résultats.
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-[#444651] sm:text-[16px]">
                Une plateforme conçue pour le système éducatif francophone : collège, lycée, séries, coefficients,
                mentions et décisions tels que vos jurys les pratiquent.
              </p>
            </div>

            <ul data-cards className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FONCTIONNALITES.map((item) =>
                item.featured ? (
                  <li
                    key={item.title}
                    data-card
                    className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#00236f] via-[#1e3a8a] to-[#0051d5] p-6 text-white shadow-lg sm:col-span-2 lg:col-span-3 lg:grid lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-10 lg:p-8"
                  >
                    <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#316bf3]/40 blur-3xl" aria-hidden="true" />
                    <div className="absolute -bottom-12 left-1/3 h-36 w-36 rounded-full bg-[#fc922b]/25 blur-3xl" aria-hidden="true" />
                    <div className="relative">
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-white/90">
                        <span className="material-symbols-outlined text-sm text-[#fc922b]">groups</span>
                        Plusieurs écoles, une session
                      </span>
                      <div className="mt-4 flex items-center gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white">
                          <span className="material-symbols-outlined text-2xl">{item.icon}</span>
                        </span>
                        <h3 className="text-[20px] font-extrabold leading-tight tracking-tight sm:text-[24px]">{item.title}</h3>
                      </div>
                      <p className="mt-4 text-[14px] leading-relaxed text-white/85 sm:text-[15px]">{item.text}</p>
                    </div>
                    <ul className="relative mt-6 grid gap-2.5 lg:mt-0">
                      {item.points?.map((point) => (
                        <li key={point} className="flex items-start gap-2.5 rounded-lg border border-white/15 bg-white/10 px-3.5 py-2.5 text-[13px] font-semibold backdrop-blur-sm">
                          <span className="material-symbols-outlined mt-px text-lg text-[#fc922b]">check_circle</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ) : (
                  <li
                    key={item.title}
                    data-card
                    className="rounded-xl border border-[#eaedff] bg-white p-6 shadow-[0_1px_8px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-[0_6px_24px_rgba(0,35,111,0.08)]"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#eaedff] text-[#0051d5]">
                      <span className="material-symbols-outlined text-2xl">{item.icon}</span>
                    </span>
                    <h3 className="mt-4 text-[17px] font-bold leading-snug text-[#00236f]">{item.title}</h3>
                    <p className="mt-2 text-[14px] leading-relaxed text-[#444651]">{item.text}</p>
                  </li>
                ),
              )}
            </ul>
          </div>
        </section>

        {/* Documents imprimés */}
        <section id="documents" aria-labelledby="titre-documents" className="bg-white py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div data-reveal className="max-w-2xl">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#0051d5]">Documents imprimés</span>
              <h2 id="titre-documents" className="mt-2 text-[28px] font-extrabold leading-tight tracking-tight text-[#00236f] sm:text-[36px]">
                Trois documents prêts à imprimer, au format A4.
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-[#444651] sm:text-[16px]">
                Chaque document reprend la charte de l’établissement : république, ministère, devise, logo, cachet et
                signatures. Lors d’un examen inter-établissements, les relevés sont neutres, sans logo.
              </p>
            </div>

            <ul data-cards className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Relevé de notes */}
              <li data-card className="flex min-w-0 flex-col rounded-xl border border-[#eaedff] bg-[#faf8ff] p-5">
                <div
                  className="min-w-0 rounded-lg border border-[#eaedff] bg-white p-4 text-[#131b2e] shadow-sm"
                  role="img"
                  aria-label="Maquette d’un relevé de notes : en-tête de l’établissement, notes par matière, moyenne, rang, mention, décision et visa des parents"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-[#eaedff] pb-2">
                    <div className="min-w-0">
                      <p className="truncate text-[9px] font-bold uppercase tracking-widest text-[#757682]">République • Ministère • Devise</p>
                      <p className="mt-1 text-[12px] font-bold text-[#00236f]">Relevé de notes • BEPC blanc n° 2</p>
                      <p className="text-[10px] text-[#444651]">3e • Table n° 027 • Matricule AB-25-0027</p>
                    </div>
                    <SheetTag>A4</SheetTag>
                  </div>
                  <table className="mt-2 w-full table-fixed text-[10px]">
                    <thead>
                      <tr className="text-left text-[9px] uppercase tracking-wider text-[#757682]">
                        <th className="py-0.5 font-semibold">Matière</th>
                        <th className="w-12 py-0.5 text-right font-semibold">Note</th>
                        <th className="w-9 py-0.5 text-center font-semibold">Coef.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['Français', '12,50', '3'],
                        ['Mathématiques', '14,00', '3'],
                        ['Histoire-géographie', '11,00', '2'],
                        ['Anglais', '15,50', '2'],
                      ].map(([matiere, note, coef]) => (
                        <tr key={matiere} className="border-t border-[#f2f3ff]">
                          <td className="truncate py-1">{matiere}</td>
                          <td className="py-1 text-right font-mono font-bold text-[#00236f]">{note}</td>
                          <td className="py-1 text-center font-mono text-[#444651]">{coef}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
                    <div className="rounded bg-[#f2f3ff] px-1 py-1.5">
                      <p className="text-[8px] font-bold uppercase tracking-wider text-[#757682]">Moyenne</p>
                      <p className="font-mono text-[12px] font-bold text-[#00236f]">13,20</p>
                    </div>
                    <div className="rounded bg-[#f2f3ff] px-1 py-1.5">
                      <p className="text-[8px] font-bold uppercase tracking-wider text-[#757682]">Rang</p>
                      <p className="font-mono text-[12px] font-bold text-[#0051d5]">7 / 48</p>
                    </div>
                    <div className="rounded bg-[#f2f3ff] px-1 py-1.5">
                      <p className="text-[8px] font-bold uppercase tracking-wider text-[#757682]">Décision</p>
                      <p className="text-[11px] font-bold text-[#166534]">Admis</p>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-1.5 text-[8px] font-semibold uppercase tracking-wider text-[#757682]">
                    <div className="h-8 rounded border border-dashed border-[#c5c5d3] px-1 pt-1">Titulaire</div>
                    <div className="h-8 rounded border border-dashed border-[#c5c5d3] px-1 pt-1">Direction</div>
                    <div className="h-8 rounded border border-dashed border-[#c5c5d3] px-1 pt-1">Visa parents</div>
                  </div>
                </div>
                <h3 className="mt-5 text-[17px] font-bold text-[#00236f]">Relevé de notes</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-[#444651]">
                  Une page par candidat : notes et coefficients, moyenne pondérée, rang, mention, décision, moyennes
                  extrêmes de la classe et visa des parents. Impression groupée de la classe ou PDF.
                </p>
              </li>

              {/* Liste des candidats */}
              <li data-card className="flex min-w-0 flex-col rounded-xl border border-[#eaedff] bg-[#faf8ff] p-5">
                <div
                  className="min-w-0 rounded-lg border border-[#eaedff] bg-white p-4 text-[#131b2e] shadow-sm"
                  role="img"
                  aria-label="Maquette d’une liste des candidats : numéro de table, matricule, nom et colonne d’émargement"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-[#eaedff] pb-2">
                    <div className="min-w-0">
                      <p className="truncate text-[9px] font-bold uppercase tracking-widest text-[#757682]">Centre d’examen • Salle 2</p>
                      <p className="mt-1 text-[12px] font-bold text-[#00236f]">Liste des candidats • Tle A4</p>
                      <p className="text-[10px] text-[#444651]">BAC II blanc n° 1 • 48 candidats</p>
                    </div>
                    <SheetTag>A4</SheetTag>
                  </div>
                  <table className="mt-2 w-full table-fixed text-[10px]">
                    <thead>
                      <tr className="text-left text-[9px] uppercase tracking-wider text-[#757682]">
                        <th className="w-8 py-0.5 font-semibold">N°</th>
                        <th className="w-[4.6rem] py-0.5 font-semibold">Matricule</th>
                        <th className="py-0.5 font-semibold">Candidat</th>
                        <th className="w-14 py-0.5 text-center font-semibold">Émarg.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {LISTE_LIGNES.map(([table, matricule, nom]) => (
                        <tr key={table} className="border-t border-[#f2f3ff]">
                          <td className="py-1.5 font-mono font-bold text-[#00236f]">{table}</td>
                          <td className="truncate py-1.5 font-mono text-[9px] text-[#444651]">{matricule}</td>
                          <td className="truncate py-1.5 font-medium">{nom}</td>
                          <td className="py-1.5">
                            <span className="block h-4 rounded border border-dashed border-[#c5c5d3]" aria-hidden="true" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 text-[9px] text-[#757682]">… 44 autres candidats, classés par numéro de table.</p>
                </div>
                <h3 className="mt-5 text-[17px] font-bold text-[#00236f]">Liste des candidats</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-[#444651]">
                  Numéros de table et matricules attribués automatiquement, colonne d’émargement pour le jour de
                  l’épreuve. En inter-établissements, l’établissement d’origine de chaque candidat est indiqué.
                </p>
              </li>

              {/* Procès-verbal */}
              <li data-card className="flex min-w-0 flex-col rounded-xl border border-[#eaedff] bg-[#faf8ff] p-5 md:col-span-2 lg:col-span-1">
                <div
                  className="min-w-0 rounded-lg border border-[#eaedff] bg-white p-4 text-[#131b2e] shadow-sm"
                  role="img"
                  aria-label="Maquette d’un procès-verbal : rang, candidat, moyenne, mention et décision pour chaque candidat"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-[#eaedff] pb-2">
                    <div className="min-w-0">
                      <p className="truncate text-[9px] font-bold uppercase tracking-widest text-[#757682]">Procès-verbal de délibération</p>
                      <p className="mt-1 text-[12px] font-bold text-[#00236f]">Palmarès • 3e • BEPC blanc n° 2</p>
                      <p className="text-[10px] text-[#444651]">48 candidats • 39 admis • taux de réussite 81 %</p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded bg-[#dcfce7] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#166534]">
                      <span className="material-symbols-outlined text-[12px]">lock</span>
                      Verrouillé
                    </span>
                  </div>
                  <table className="mt-2 w-full table-fixed text-[10px]">
                    <thead>
                      <tr className="text-left text-[9px] uppercase tracking-wider text-[#757682]">
                        <th className="w-8 py-0.5 font-semibold">Rang</th>
                        <th className="py-0.5 font-semibold">Candidat</th>
                        <th className="w-10 py-0.5 text-right font-semibold">Moy.</th>
                        <th className="w-[3.6rem] py-0.5 pl-1.5 font-semibold">Mention</th>
                        <th className="w-12 py-0.5 text-right font-semibold">Décision</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PV_LIGNES.map(([rang, nom, moyenne, mention, decision]) => (
                        <tr key={rang} className="border-t border-[#f2f3ff]">
                          <td className="py-1.5 font-mono font-bold text-[#00236f]">{rang}</td>
                          <td className="truncate py-1.5 font-medium">{nom}</td>
                          <td className="py-1.5 text-right font-mono font-bold text-[#00236f]">{moyenne}</td>
                          <td className="truncate py-1.5 pl-1.5 text-[#444651]">{mention}</td>
                          <td className={`py-1.5 text-right font-bold ${decision === 'Admis' ? 'text-[#166534]' : 'text-[#b42318]'}`}>{decision}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[9px] font-semibold text-[#444651]">
                    <span className="rounded bg-[#f2f3ff] px-1.5 py-0.5">Filtre : admis / ajournés</span>
                    <span className="rounded bg-[#f2f3ff] px-1.5 py-0.5">Export CSV</span>
                    <span className="rounded bg-[#f2f3ff] px-1.5 py-0.5">Impression A4</span>
                  </div>
                </div>
                <h3 className="mt-5 text-[17px] font-bold text-[#00236f]">Procès-verbal et palmarès</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-[#444651]">
                  La liste complète des candidats avec rang, moyenne, mention et décision : admis à partir de 10,
                  ajourné sinon. Filtres, export CSV, impression et verrouillage une fois le jury terminé.
                </p>
              </li>
            </ul>
          </div>
        </section>

        {/* Comment ça marche */}
        <section id="comment-ca-marche" aria-labelledby="titre-etapes" className="py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div data-reveal className="max-w-2xl">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#0051d5]">Comment ça marche</span>
              <h2 id="titre-etapes" className="mt-2 text-[28px] font-extrabold leading-tight tracking-tight text-[#00236f] sm:text-[36px]">
                Quatre étapes. De l’établissement au procès-verbal.
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-[#444651] sm:text-[16px]">
                Pas de configuration compliquée. Vous avancez dans l’ordre, à votre rythme, et vous retrouvez vos
                sessions passées dans les archives.
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
                  <li key={etape.title} data-step className="relative rounded-xl border border-[#eaedff] bg-white p-6">
                    <div className="flex items-center gap-3">
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#00236f] text-white shadow-md">
                        <span className="material-symbols-outlined text-2xl">{etape.icon}</span>
                      </span>
                      <span className="font-mono text-[28px] font-bold text-[#dce1ff]">0{index + 1}</span>
                    </div>
                    <h3 className="mt-5 text-[17px] font-bold leading-snug text-[#00236f]">{etape.title}</h3>
                    <p className="mt-2 text-[14px] leading-relaxed text-[#444651]">{etape.text}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* À propos */}
        <section id="a-propos" aria-labelledby="titre-a-propos" className="bg-white py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div data-reveal className="max-w-2xl">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#0051d5]">À propos</span>
              <h2 id="titre-a-propos" className="mt-2 text-[28px] font-extrabold leading-tight tracking-tight text-[#00236f] sm:text-[36px]">
                Une plateforme pensée pour les établissements du Togo et de Côte d’Ivoire.
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-[#444651] sm:text-[16px]">
                AcademiaBlanc gère les examens blancs et les compositions du collège et du lycée. Elle suit les
                candidats, calcule les moyennes, les rangs et les mentions, et édite des relevés, des listes et des
                procès-verbaux conformes aux usages du système éducatif francophone. Le secrétariat gagne des heures,
                les enseignants se concentrent sur les notes, le chef d’établissement signe en confiance.
              </p>
              <p className="mt-3 text-[15px] leading-relaxed text-[#444651] sm:text-[16px]">
                L’application fonctionne sur ordinateur et sur téléphone, y compris hors connexion pour l’interface.
                Les données sont conservées sur un serveur sécurisé.
              </p>
            </div>

            <ul data-cards className="mt-12 grid gap-5 sm:grid-cols-3">
              {ATOUTS.map((atout) => (
                <li
                  key={atout.title}
                  data-card
                  className="rounded-xl border border-[#eaedff] bg-[#faf8ff] p-6"
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
                    Créez le compte de votre établissement, invitez votre équipe, importez vos candidats. Le jour du
                    jury, relevés, liste et procès-verbal sont prêts à imprimer.
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
              Gestion des examens blancs, seul ou entre établissements : candidats, notes, moyennes et rangs, relevés,
              liste des candidats et procès-verbal.
            </p>
          </div>
          <nav aria-label="Pied de page" className="grid grid-cols-2 gap-8 text-[13px]">
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
