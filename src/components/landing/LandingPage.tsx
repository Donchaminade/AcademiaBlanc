import React, { useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ROUTE_PATHS } from '../../utils/router';
import { usePrereglageDefaut } from '../../api/prereglages';
import { bandeauNational } from '../../utils/prereglages';
import { LiensLegaux } from '../legal/LiensLegaux';
import { economieAnnuelle, formatMontant, lienAppel, lienWhatsapp } from './offrePublique';
import { useOffrePublique } from './useOffrePublique';
// Photo : Santi Vedrí (Unsplash, https://unsplash.com/photos/O5EMzfdxedg), licence Unsplash — voir CREDITS.md.
import heroPhotoLarge from '../../assets/landing/hero-classe-1920.jpg';
import heroPhotoSmall from '../../assets/landing/hero-classe-960.jpg';
import { motion, useReducedMotion } from 'motion/react';
import { GradientOrbs, Pop, Reveal, Stagger, StaggerItem } from '../motion/Reveal';
import { AccentBar, CountUp, Float, ScrollProgress, WordsRise, useParallax, useSectionProgress, useSpotlight } from '../motion/LandingFx';
import { useMotionValueEvent, useScroll, useTransform } from 'motion/react';

interface LandingPageProps {
  onConnexion: () => void;
  onInscription: () => void;
}

/** Adresse de contact affichée quand la plateforme ne publie pas de numéro (surchargeable par VITE_CONTACT_EMAIL). */
const CONTACT_EMAIL: string =
  (typeof import.meta.env?.VITE_CONTACT_EMAIL === 'string' && import.meta.env.VITE_CONTACT_EMAIL) || 'contact@academiablanc.app';

const MESSAGE_WHATSAPP = 'Bonjour, je souhaite des informations sur AcademiaBlanc pour mon établissement.';

const NAV_LINKS: { href: string; label: string }[] = [
  { href: '#fonctionnalites', label: 'Fonctionnalités' },
  { href: '#comment-ca-marche', label: 'Comment ça marche' },
  { href: '#tarifs', label: 'Tarifs' },
  { href: '#contact', label: 'Contact' },
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
    title: 'Examens blancs inter-établissements et transfert des résultats',
    text:
      'Plusieurs établissements organisent la même session. L’établissement hôte devient centre d’examen et accueille les candidats extérieurs, rattachés à leur établissement d’origine. À la fin du jury, chaque établissement récupère les résultats de ses candidats.',
    points: [
      'Classement sur l’ensemble des candidats du centre, résultats détaillés par établissement d’origine',
      'Transfert des résultats par code personnel vers chaque établissement d’origine',
      'Relevés neutres, sans logo, remis à chaque établissement',
    ],
    featured: true,
  },
  {
    icon: 'account_balance',
    title: 'Un espace par établissement',
    text:
      'Logo, cachet et signatures enregistrés une fois ; république, ministère et devise réglés par préréglage national. Les données de chaque établissement sont cloisonnées : aucun autre établissement n’y accède.',
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
      'Import CSV ou simple collage depuis un tableur. Matricules et numéros de table attribués automatiquement, liste des candidats et feuille d’émargement imprimables.',
  },
  {
    icon: 'event_repeat',
    title: 'Sessions illimitées',
    text:
      'BEPC blanc n° 1, n° 2, composition du trimestre : autant de sessions que nécessaire par année scolaire. CEPD, BEPC, BAC I, BAC II ou compositions. Archives consultables à tout moment.',
  },
  {
    icon: 'grid_on',
    title: 'Saisie des notes par matrice',
    text:
      'Une grille candidats × matières. Appréciations proposées automatiquement selon la note, modifiables. Absences prises en compte dans les calculs.',
  },
  {
    icon: 'description',
    title: 'Relevés sur une page A4',
    text:
      'Moyennes pondérées, rang, moyennes extrêmes de la classe, minimum et maximum par matière, mention, décision et visa des parents. Impression groupée d’une classe entière ou téléchargement PDF.',
  },
  {
    icon: 'fact_check',
    title: 'Procès-verbal, liste des candidats et émargement',
    text:
      'Palmarès complet avec rang, moyenne, mention et décision, filtres admis / ajournés, export CSV, verrouillage du PV. Liste des candidats et feuille d’émargement par salle pour le jour de l’épreuve.',
  },
  {
    icon: 'manage_accounts',
    title: 'Équipe et permissions',
    text:
      'Comptes secrétaire, enseignant et autres rôles, avec des droits réglés par établissement. Le compte créateur conserve tous les droits.',
  },
  {
    icon: 'install_mobile',
    title: 'Mobile et hors ligne',
    text:
      'Application installable sur téléphone, tablette et ordinateur (PWA). L’interface reste disponible sans connexion ; les données sont conservées sur un serveur sécurisé.',
  },
];

const ETAPES: { icon: string; title: string; text: string }[] = [
  {
    icon: 'domain_add',
    title: 'Créer le compte de l’établissement',
    text: 'Nom, logo, cachet, signatures. Le préréglage national renseigne république, ministère et devise. L’essai gratuit démarre aussitôt.',
  },
  {
    icon: 'tune',
    title: 'Classes, matières et programme',
    text: 'Niveaux et séries, catalogue de matières, coefficients par classe, titulaires et enseignants. Invitez votre équipe.',
  },
  {
    icon: 'edit_note',
    title: 'Session, candidats et notes',
    text: 'Ouvrez la session, seul ou avec d’autres établissements, importez les candidats, saisissez les notes dans la matrice. Rangs et mentions suivent.',
  },
  {
    icon: 'print',
    title: 'Imprimer et transférer',
    text: 'Relevés A4 de toute la classe, liste des candidats, feuille d’émargement et procès-verbal verrouillé. Résultats transférés aux établissements d’origine.',
  },
];

const AVANTAGES_FORFAIT: string[] = [
  'Toutes les fonctionnalités, sans restriction',
  'Sessions et archives illimitées',
  'Comptes pour toute l’équipe de l’établissement',
  'Examens inter-établissements et transfert des résultats',
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
    data-shimmer={magnetic ? '' : undefined}
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

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fc922b]';
const btnPrimary = `relative overflow-hidden inline-flex items-center justify-center gap-2 rounded-lg bg-[#0051d5] px-5 py-3 text-[14px] font-bold text-white shadow-md transition-colors hover:bg-[#003cb3] ${focusRing}`;
const btnLight = `inline-flex items-center justify-center gap-2 rounded-lg border border-white/35 bg-white/10 px-5 py-3 text-[14px] font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/20 ${focusRing}`;
const btnOnDark = `relative overflow-hidden inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-[14px] font-bold text-[#00236f] shadow-md transition-colors hover:bg-[#dce1ff] ${focusRing}`;
const btnGhost =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-[#c5c5d3] bg-white px-5 py-3 text-[14px] font-bold text-[#00236f] transition-colors hover:border-[#0051d5] hover:bg-[#f2f3ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0051d5]';
const lienTexte = 'rounded-sm font-semibold text-[#131b2e] transition-colors hover:text-[#0051d5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0051d5]';

/** Étiquette de document imprimé (en-tête des maquettes). */
const SheetTag: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="rounded bg-[#eaedff] px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[#00236f]">{children}</span>
);

/** En-tête de section : surtitre, titre h2 et chapeau. */
const SectionHeading: React.FC<{ id: string; surtitre: string; titre: string; children: React.ReactNode }> = ({ id, surtitre, titre, children }) => (
  <Reveal className="max-w-2xl">
    <span className="text-[11px] font-bold uppercase tracking-widest text-[#0051d5]">{surtitre}</span>
    <h2 id={id} className="mt-2 text-[28px] font-extrabold leading-tight tracking-tight text-[#00236f] sm:text-[36px]">
      {titre}
    </h2>
    <AccentBar />
    <p className="mt-4 text-[15px] leading-relaxed text-[#444651] sm:text-[16px]">{children}</p>
  </Reveal>
);

export const LandingPage: React.FC<LandingPageProps> = ({ onConnexion, onInscription }) => {
  // Bandeau national : préréglage par défaut de la plateforme (repli local si l'API est injoignable).
  const prereglageDefaut = usePrereglageDefaut();
  const bandeau = bandeauNational(prereglageDefaut);
  // Offre commerciale publique : montants et numéros publiés par la plateforme, jamais inventés.
  const offre = useOffrePublique();
  const whatsapp = lienWhatsapp(offre.telWhatsapp, MESSAGE_WHATSAPP);
  const appel = lienAppel(offre.telAppel);
  const economie = economieAnnuelle(offre);
  const tarifsConnus = offre.tarifMensuel !== null || offre.tarifAnnuel !== null;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  useSpotlight(rootRef);
  const heroParallax = useParallax(120);
  const heroTextParallax = useParallax(-40);
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, 'change', (v) => setScrolled(v > 40));
  const etapesRef = useRef<HTMLDivElement | null>(null);
  const etapesProgress = useSectionProgress(etapesRef);
  const [etapeAtteinte, setEtapeAtteinte] = useState(reduceMotion ? 4 : 0);
  useMotionValueEvent(etapesProgress, 'change', (v) => setEtapeAtteinte((prev) => Math.max(prev, Math.min(4, Math.floor(v * 4 + 0.35)))));
  const etapesLine = useTransform(etapesProgress, [0, 1], [0, 1]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const mm = gsap.matchMedia(root);

    // Sans préférence « moins d’animations » : entrée du hero au chargement, révélation des sections au
    // défilement, cascade des cartes et micro-interactions. Sinon, rien n’est appliqué : tout reste visible.
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      // Entrées et révélations : composants motion (../motion/Reveal). GSAP ne gère plus que les micro-interactions.
      const cleanups: (() => void)[] = [];
      gsap.utils.toArray<HTMLElement>('[data-magnetic]').forEach((button) => {
        const icon = button.querySelector<HTMLElement>('.material-symbols-outlined');
        const enter = () => {
          gsap.to(button, { scale: 1.03, y: -2, duration: 0.25, ease: 'power2.out', overwrite: 'auto' });
          if (icon) gsap.to(icon, { x: 3, duration: 0.25, ease: 'power2.out', overwrite: 'auto' });
        };
        const leave = () => {
          gsap.to(button, { scale: 1, y: 0, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
          if (icon) gsap.to(icon, { x: 0, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
        };
        const press = () => gsap.to(button, { scale: 0.97, duration: 0.1, ease: 'power1.out', overwrite: 'auto' });
        const release = () => gsap.to(button, { scale: 1.03, duration: 0.2, ease: 'power2.out', overwrite: 'auto' });
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

    return () => {
      // Supprime tous les tweens créés dans ce contexte.
      mm.revert();
    };
  }, []);

  const closeMenu = () => setMenuOpen(false);

  const reperes: { value: string; label: string }[] = [
    { value: `${offre.dureeEssaiJours} j`, label: 'd’essai gratuit, sans engagement' },
    { value: 'A4', label: 'Relevé de notes sur une page' },
    { value: 'PWA', label: 'Mobile et hors ligne' },
  ];

  const contactHref = whatsapp ?? '#contact';
  const contactExterne = whatsapp !== null;

  return (
    <div ref={rootRef} className="landing-root min-h-dvh overflow-x-clip bg-[#faf8ff] text-[#131b2e] antialiased">
      <a
        href="#accueil"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-[13px] focus:font-bold focus:text-[#00236f] focus:shadow-lg"
      >
        Aller au contenu
      </a>

      <ScrollProgress />
      {/* Barre de navigation fixe et translucide */}
      <motion.header
        initial={reduceMotion ? false : { opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className={`fixed inset-x-0 top-0 z-40 border-b border-white/10 text-white transition-[background-color,box-shadow,backdrop-filter] duration-300 ${scrolled ? 'bg-[#00133f]/85 shadow-lg backdrop-blur-xl supports-[backdrop-filter]:bg-[#00133f]/75' : 'bg-[#00133f]/70 backdrop-blur-md supports-[backdrop-filter]:bg-[#00133f]/60'}`}>
        <nav aria-label="Navigation principale" className={`mx-auto flex max-w-6xl origin-top items-center justify-between gap-4 px-4 transition-[height] duration-300 sm:px-6 ${scrolled ? 'h-14' : 'h-16'}`}>
          <a href="#accueil" className={`flex min-w-0 shrink-0 items-center gap-2.5 rounded-lg ${focusRing}`} onClick={closeMenu}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#00236f]">
              <span className="material-symbols-outlined text-xl">account_balance</span>
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[16px] font-bold leading-tight tracking-tight">AcademiaBlanc</span>
              <span className="block truncate text-[11px] font-medium leading-tight text-white/75">Examens blancs • {prereglageDefaut.sigleMinistere}</span>
            </span>
          </a>

          <ul className="hidden items-center gap-6 lg:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} className={`whitespace-nowrap rounded-sm text-[13px] font-semibold text-white/85 transition-colors hover:text-white ${focusRing}`}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            <RouteLink href={ROUTE_PATHS.connexion} onNavigate={onConnexion} className={`${btnLight} whitespace-nowrap px-4 py-2 text-[13px]`} magnetic>
              <span className="material-symbols-outlined text-base">login</span>
              <span>Se connecter</span>
            </RouteLink>
            <RouteLink href={ROUTE_PATHS.inscription} onNavigate={onInscription} className={`${btnPrimary} whitespace-nowrap px-4 py-2 text-[13px]`} magnetic>
              <span className="material-symbols-outlined text-base">domain_add</span>
              <span>Créer un compte</span>
            </RouteLink>
          </div>

          <button
            type="button"
            className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/30 text-white lg:hidden ${focusRing}`}
            aria-expanded={menuOpen}
            aria-controls="menu-mobile"
            aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="material-symbols-outlined text-2xl">{menuOpen ? 'close' : 'menu'}</span>
          </button>
        </nav>

        {menuOpen && (
          <div id="menu-mobile" className="border-t border-[#eaedff] bg-white px-4 py-4 text-[#131b2e] lg:hidden">
            <ul className="space-y-1">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={closeMenu}
                    className="block rounded-lg px-3 py-2.5 text-[14px] font-semibold text-[#131b2e] hover:bg-[#f2f3ff] focus-visible:outline-2 focus-visible:outline-[#0051d5]"
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
                <span>Créer un compte</span>
              </RouteLink>
            </div>
          </div>
        )}
      </motion.header>

      <main>
        {/* Accueil : photo pleine largeur, dégradé sombre, texte blanc */}
        <section
          id="accueil"
          aria-labelledby="titre-accueil"
          className="relative isolate flex min-h-[92svh] overflow-hidden bg-[#00133f] text-white"
        >
          <motion.div className="absolute inset-x-0 -top-[8%] -z-20 h-[116%] will-change-transform" style={reduceMotion ? undefined : { y: heroParallax }} aria-hidden="true">
          <picture className="absolute inset-0" aria-hidden="true">
            <source media="(max-width: 767px)" srcSet={heroPhotoSmall} />
            <motion.img
              initial={reduceMotion ? false : { opacity: 0, scale: 1.06 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.2, ease: 'easeOut', delay: 0.5 }}
              src={heroPhotoLarge}
              srcSet={`${heroPhotoSmall} 960w, ${heroPhotoLarge} 1920w`}
              sizes="100vw"
              width={1920}
              height={1280}
              alt=""
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="h-full w-full object-cover object-[60%_30%] md:object-[68%_30%]"
            />
          </picture>
          </motion.div>
          {/* Dégradés de lisibilité (contraste AA du texte blanc) : voile uniforme sur mobile où le texte couvre
              toute la largeur ; sur écran large, plus dense à gauche sous le texte, photo visible à droite. */}
          <div
            className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(0,17,55,0.78)_0%,rgba(0,17,55,0.64)_55%,rgba(0,17,55,0.84)_100%)] md:bg-[linear-gradient(90deg,rgba(0,17,55,0.94)_0%,rgba(0,17,55,0.86)_38%,rgba(0,17,55,0.5)_70%,rgba(0,17,55,0.3)_100%)]"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(0,17,55,0.5)_0%,rgba(0,17,55,0)_30%,rgba(0,17,55,0.2)_75%,#00133f_100%)]"
            aria-hidden="true"
          />

          <GradientOrbs className="-z-10" />
          <div className="landing-grid pointer-events-none absolute inset-0 -z-10 opacity-60 [background-image:radial-gradient(rgba(169,188,255,0.18)_1px,transparent_1px)]" aria-hidden="true" />

          <motion.div style={reduceMotion ? undefined : { y: heroTextParallax }} className="mx-auto flex w-full max-w-6xl flex-col justify-center px-4 pb-16 pt-28 sm:px-6 lg:pb-24 lg:pt-36">
            <Stagger onLoad stagger={0.1} delay={0.1} className="max-w-3xl">
              <StaggerItem
                as="span"
                variant="pop"
                className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-white/90"
              >
                <motion.span
                  className="material-symbols-outlined text-sm text-[#fc922b]"
                  animate={reduceMotion ? undefined : { rotate: [0, -12, 8, 0] }}
                  transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 2.5, ease: 'easeInOut' }}
                >flag</motion.span>
                <span className="truncate">{bandeau}</span>
              </StaggerItem>
              <StaggerItem
                as="h1"
                variant="rise"
                id="titre-accueil"
                className="mt-5 text-[34px] font-extrabold leading-[1.08] tracking-tight sm:text-[46px] lg:text-[58px]"
              >
                <WordsRise text="La gestion scolaire et les examens blancs," delay={0.25} />
                <br className="hidden sm:block" />
                <span className="text-[#a9bcff]"> <WordsRise text="du candidat au procès-verbal." delay={0.65} className="landing-gradient-text" /></span>
              </StaggerItem>
              <StaggerItem as="p" variant="rise" className="mt-5 max-w-2xl text-[16px] leading-relaxed text-white/90 sm:text-[18px]">
                Établissements, classes du collège au lycée, matières et programmes. Candidats importés en masse,
                notes saisies en matrice, moyennes et rangs calculés. Relevés A4, liste des candidats et
                procès-verbal prêts à imprimer, seul ou avec d’autres établissements.
              </StaggerItem>
              <StaggerItem variant="rise" className="mt-8 flex flex-col gap-3 sm:flex-row">
                <RouteLink href={ROUTE_PATHS.inscription} onNavigate={onInscription} className={btnPrimary} magnetic>
                  <span className="material-symbols-outlined text-lg">domain_add</span>
                  <span>Créer le compte de mon établissement</span>
                </RouteLink>
                <a
                  href={contactHref}
                  className={btnLight}
                  data-magnetic=""
                  target={contactExterne ? '_blank' : undefined}
                  rel={contactExterne ? 'noopener noreferrer' : undefined}
                >
                  <span className="material-symbols-outlined text-lg">{contactExterne ? 'chat' : 'mail'}</span>
                  <span>Nous contacter</span>
                </a>
              </StaggerItem>
              <StaggerItem variant="rise">
                <dl className="mt-10 grid max-w-2xl grid-cols-3 gap-4 border-t border-white/20 pt-6">
                  {reperes.map((item, index) => (
                    <Pop key={item.label} delay={0.6 + index * 0.1}>
                      <Float amp={5} duration={4 + index * 0.6} delay={index * 0.5} className="flex flex-col">
                        <dt className="order-2 text-[11px] font-medium leading-snug text-white/80 sm:text-[12px]">{item.label}</dt>
                        <dd className="font-mono text-[22px] font-bold text-white sm:text-[26px]"><CountUp value={item.value} /></dd>
                      </Float>
                    </Pop>
                  ))}
                </dl>
              </StaggerItem>
            </Stagger>
          </motion.div>
        </section>

        {/* Fonctionnalités */}
        <section id="fonctionnalites" aria-labelledby="titre-fonctionnalites" className="relative isolate overflow-hidden scroll-mt-16 py-20 sm:py-24">
          <GradientOrbs className="-z-10 opacity-25" />
          <div className="landing-grid pointer-events-none absolute inset-0 -z-10 opacity-50" aria-hidden="true" />
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading id="titre-fonctionnalites" surtitre="Fonctionnalités" titre="Tout l’examen blanc, de la préparation aux résultats.">
              Une plateforme conçue pour le système éducatif francophone : collège, lycée, séries, coefficients,
              mentions et décisions tels que vos jurys les pratiquent.
            </SectionHeading>

            <Stagger as="ul" className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FONCTIONNALITES.map((item) =>
                item.featured ? (
                  <StaggerItem as="li"
                    key={item.title}
                    data-spot="" data-lift=""
                    className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#00236f] via-[#1e3a8a] to-[#0051d5] p-6 text-white shadow-lg sm:col-span-2 lg:col-span-3 lg:grid lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-10 lg:p-8"
                  >
                    <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#316bf3]/40 blur-3xl" aria-hidden="true" />
                    <div className="absolute -bottom-12 left-1/3 h-36 w-36 rounded-full bg-[#fc922b]/25 blur-3xl" aria-hidden="true" />
                    <div className="relative">
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-white/90">
                        <span className="material-symbols-outlined text-sm text-[#fc922b]">groups</span>
                        Plusieurs établissements, une session
                      </span>
                      <div className="mt-4 flex items-start gap-3">
                        <span className="landing-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white">
                          <span className="material-symbols-outlined text-2xl">{item.icon}</span>
                        </span>
                        <h3 className="text-[20px] font-extrabold leading-tight tracking-tight sm:text-[24px]">{item.title}</h3>
                      </div>
                      <p className="mt-4 text-[14px] leading-relaxed text-white/85 sm:text-[15px]">{item.text}</p>
                    </div>
                    <ul className="relative mt-6 grid gap-2.5 lg:mt-0">
                      {item.points?.map((point) => (
                        <li key={point} className="flex items-start gap-2.5 rounded-lg border border-white/15 bg-white/10 px-3.5 py-2.5 text-[13px] font-semibold backdrop-blur-sm">
                          <span className="material-symbols-outlined mt-px shrink-0 text-lg text-[#fc922b]">check_circle</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </StaggerItem>
                ) : (
                  <StaggerItem as="li"
                    key={item.title}
                    data-spot="" data-lift=""
                    className="rounded-xl border border-[#eaedff] bg-white p-6 shadow-[0_1px_8px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-[0_6px_24px_rgba(0,35,111,0.08)]"
                  >
                    <span className="landing-icon flex h-11 w-11 items-center justify-center rounded-lg bg-[#eaedff] text-[#0051d5]">
                      <span className="material-symbols-outlined text-2xl">{item.icon}</span>
                    </span>
                    <h3 className="mt-4 text-[17px] font-bold leading-snug text-[#00236f]">{item.title}</h3>
                    <p className="mt-2 text-[14px] leading-relaxed text-[#444651]">{item.text}</p>
                  </StaggerItem>
                ),
              )}
            </Stagger>
          </div>
        </section>

        {/* Documents imprimés */}
        <section id="documents" aria-labelledby="titre-documents" className="relative isolate overflow-hidden scroll-mt-16 bg-white py-20 sm:py-24">
          <GradientOrbs className="-z-10 opacity-25" />
          <div className="landing-grid pointer-events-none absolute inset-0 -z-10 opacity-50" aria-hidden="true" />
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading id="titre-documents" surtitre="Documents imprimés" titre="Des documents prêts à imprimer, au format A4.">
              Relevé de notes, liste des candidats, feuille d’émargement et procès-verbal reprennent la charte de
              l’établissement : république, ministère, devise, logo, cachet et signatures. Lors d’un examen
              inter-établissements, les relevés sont neutres, sans logo.
            </SectionHeading>

            <Stagger as="ul" className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Relevé de notes */}
              <StaggerItem as="li" data-spot="" data-lift="" className="flex min-w-0 flex-col rounded-xl border border-[#eaedff] bg-[#faf8ff] p-5">
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
              </StaggerItem>

              {/* Liste des candidats */}
              <StaggerItem as="li" data-spot="" data-lift="" className="flex min-w-0 flex-col rounded-xl border border-[#eaedff] bg-[#faf8ff] p-5">
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
                <h3 className="mt-5 text-[17px] font-bold text-[#00236f]">Liste des candidats et feuille d’émargement</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-[#444651]">
                  Numéros de table et matricules attribués automatiquement, feuille d’émargement par salle pour le jour
                  de l’épreuve. En inter-établissements, l’établissement d’origine de chaque candidat est indiqué.
                </p>
              </StaggerItem>

              {/* Procès-verbal */}
              <StaggerItem as="li" data-spot="" data-lift="" className="flex min-w-0 flex-col rounded-xl border border-[#eaedff] bg-[#faf8ff] p-5 md:col-span-2 lg:col-span-1">
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
              </StaggerItem>
            </Stagger>
          </div>
        </section>

        {/* Comment ça marche */}
        <section id="comment-ca-marche" aria-labelledby="titre-etapes" className="relative isolate overflow-hidden scroll-mt-16 py-20 sm:py-24">
          <GradientOrbs className="-z-10 opacity-25" />
          <div className="landing-grid pointer-events-none absolute inset-0 -z-10 opacity-50" aria-hidden="true" />
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading id="titre-etapes" surtitre="Comment ça marche" titre="Quatre étapes. De l’établissement au procès-verbal.">
              Pas de configuration compliquée. Vous avancez dans l’ordre, à votre rythme, et vous retrouvez vos
              sessions passées dans les archives.
            </SectionHeading>

            <div ref={etapesRef} className="relative mt-12">
              <motion.div
                style={{ transformOrigin: 'left center', scaleX: reduceMotion ? 1 : etapesLine }}
                className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-[#0051d5] via-[#90a8ff] to-[#fc922b] lg:block"
                aria-hidden="true"
              />
              <Stagger as="ol" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {ETAPES.map((etape, index) => (
                  <StaggerItem as="li" key={etape.title} data-spot="" data-lift="" className="relative rounded-xl border border-[#eaedff] bg-white p-6">
                    <div className="flex items-center gap-3">
                      <span className="landing-icon flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#00236f] text-white shadow-md">
                        <span className="material-symbols-outlined text-2xl">{etape.icon}</span>
                      </span>
                      <motion.span
                        className="inline-block font-mono text-[28px] font-bold text-[#dce1ff]"
                        initial={false}
                        animate={reduceMotion ? undefined : etapeAtteinte > index ? { scale: [1, 1.35, 1], opacity: 1 } : { scale: 0.85, opacity: 0.5 }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                      >0{index + 1}</motion.span>
                    </div>
                    <h3 className="mt-5 text-[17px] font-bold leading-snug text-[#00236f]">{etape.title}</h3>
                    <p className="mt-2 text-[14px] leading-relaxed text-[#444651]">{etape.text}</p>
                  </StaggerItem>
                ))}
              </Stagger>
            </div>
          </div>
        </section>

        {/* Tarifs */}
        <section id="tarifs" aria-labelledby="titre-tarifs" className="relative isolate overflow-hidden scroll-mt-16 bg-white py-20 sm:py-24">
          <GradientOrbs className="-z-10 opacity-25" />
          <div className="landing-grid pointer-events-none absolute inset-0 -z-10 opacity-50" aria-hidden="true" />
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading id="titre-tarifs" surtitre="Tarifs" titre={`${offre.dureeEssaiJours} jours d’essai gratuit, puis un abonnement au choix.`}>
              Un seul abonnement par établissement, toutes les fonctionnalités incluses. L’essai démarre à la création
              du compte, sans paiement ni engagement.
            </SectionHeading>

            <Stagger as="ul" className="mt-12 grid gap-6 lg:grid-cols-2">
              {/* Mensuel */}
              <StaggerItem as="li" data-spot="" data-lift="" className="flex flex-col rounded-xl border border-[#eaedff] bg-[#faf8ff] p-6 sm:p-8">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[20px] font-extrabold tracking-tight text-[#00236f]">Mensuel</h3>
                    <p className="mt-1 text-[13px] text-[#444651]">Facturé chaque mois, résiliable à tout moment.</p>
                  </div>
                  <span className="landing-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#eaedff] text-[#0051d5]">
                    <span className="material-symbols-outlined text-2xl">calendar_month</span>
                  </span>
                </div>
                <div className="mt-6 min-h-[3.5rem]">
                  {offre.tarifMensuel !== null ? (
                    <p className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-mono text-[34px] font-bold leading-none text-[#00236f]">{formatMontant(offre.tarifMensuel, offre.devise)}</span>
                      <span className="text-[13px] font-semibold text-[#444651]">par mois</span>
                    </p>
                  ) : (
                    <p className="text-[17px] font-bold leading-snug text-[#00236f]">Tarif communiqué à l’inscription</p>
                  )}
                </div>
                <ul className="mt-6 grid gap-2.5 text-[14px] text-[#131b2e]">
                  {AVANTAGES_FORFAIT.map((avantage) => (
                    <li key={avantage} className="flex items-start gap-2.5">
                      <span className="material-symbols-outlined mt-px shrink-0 text-lg text-[#0051d5]">check_circle</span>
                      <span>{avantage}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8 flex flex-col gap-2 sm:flex-row">
                  <RouteLink href={ROUTE_PATHS.inscription} onNavigate={onInscription} className={btnGhost}>
                    <span className="material-symbols-outlined text-lg">domain_add</span>
                    <span>Commencer l’essai gratuit</span>
                  </RouteLink>
                  {!tarifsConnus && (
                    <a href="#contact" className={`${btnGhost} border-transparent bg-transparent`}>
                      <span className="material-symbols-outlined text-lg">mail</span>
                      <span>Contact</span>
                    </a>
                  )}
                </div>
              </StaggerItem>

              {/* Annuel (recommandé) */}
              <StaggerItem as="li" className="landing-glow relative flex">
              <div
                data-spot="" data-lift=""
                className="relative flex w-full flex-col overflow-hidden rounded-xl bg-gradient-to-br from-[#00236f] via-[#1e3a8a] to-[#0051d5] p-6 text-white shadow-lg sm:p-8"
              >
                <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#316bf3]/40 blur-3xl" aria-hidden="true" />
                <div className="relative flex items-start justify-between gap-3">
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white/95">
                      <span className="material-symbols-outlined text-sm text-[#fc922b]">star</span>
                      Recommandé
                    </span>
                    <h3 className="mt-3 text-[20px] font-extrabold tracking-tight">Annuel</h3>
                    <p className="mt-1 text-[13px] text-white/85">Un seul paiement pour toute l’année scolaire.</p>
                  </div>
                  <span className="landing-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white">
                    <span className="material-symbols-outlined text-2xl">event_available</span>
                  </span>
                </div>
                <div className="relative mt-6 min-h-[3.5rem]">
                  {offre.tarifAnnuel !== null ? (
                    <>
                      <p className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-mono text-[34px] font-bold leading-none">{formatMontant(offre.tarifAnnuel, offre.devise)}</span>
                        <span className="text-[13px] font-semibold text-white/85">par an</span>
                      </p>
                      {economie !== null && (
                        <p className="mt-2 text-[13px] font-semibold text-[#ffd9b0]">
                          Soit {formatMontant(economie, offre.devise)} de moins que douze mois au tarif mensuel.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-[17px] font-bold leading-snug">Tarif communiqué à l’inscription</p>
                  )}
                </div>
                <ul className="relative mt-6 grid gap-2.5 text-[14px]">
                  {AVANTAGES_FORFAIT.map((avantage) => (
                    <li key={avantage} className="flex items-start gap-2.5">
                      <span className="material-symbols-outlined mt-px shrink-0 text-lg text-[#fc922b]">check_circle</span>
                      <span>{avantage}</span>
                    </li>
                  ))}
                </ul>
                <div className="relative mt-8 flex flex-col gap-2 sm:flex-row">
                  <RouteLink href={ROUTE_PATHS.inscription} onNavigate={onInscription} className={btnOnDark} magnetic>
                    <span className="material-symbols-outlined text-lg">domain_add</span>
                    <span>Commencer l’essai gratuit</span>
                  </RouteLink>
                  {!tarifsConnus && (
                    <a href="#contact" className={btnLight}>
                      <span className="material-symbols-outlined text-lg">mail</span>
                      <span>Contact</span>
                    </a>
                  )}
                </div>
              </div>
              </StaggerItem>
            </Stagger>

            <Reveal className="mt-8 grid gap-4 rounded-xl border border-[#eaedff] bg-[#faf8ff] p-5 text-[14px] leading-relaxed text-[#444651] sm:grid-cols-3 sm:p-6">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined mt-0.5 shrink-0 text-xl text-[#0051d5]">hourglass_top</span>
                <p>
                  <strong className="font-bold text-[#00236f]">Essai de {offre.dureeEssaiJours} jours.</strong> Toutes les fonctionnalités, dès la
                  création du compte, sans carte ni paiement.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined mt-0.5 shrink-0 text-xl text-[#0051d5]">phone_android</span>
                <p>
                  <strong className="font-bold text-[#00236f]">Paiement par mobile money.</strong> Le forfait choisi est réglé depuis votre
                  téléphone, au bénéficiaire indiqué à l’inscription.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined mt-0.5 shrink-0 text-xl text-[#0051d5]">verified_user</span>
                <p>
                  <strong className="font-bold text-[#00236f]">Activation par l’équipe.</strong> Après réception du paiement, l’équipe
                  AcademiaBlanc active l’abonnement de l’établissement.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" aria-labelledby="titre-contact" className="relative isolate overflow-hidden scroll-mt-16 py-20 sm:py-24">
          <GradientOrbs className="-z-10 opacity-25" />
          <div className="landing-grid pointer-events-none absolute inset-0 -z-10 opacity-50" aria-hidden="true" />
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading id="titre-contact" surtitre="Contact" titre="Une question avant de commencer ? Parlons‑en.">
              Démonstration, organisation d’un examen blanc inter-établissements, modalités de paiement : l’équipe
              AcademiaBlanc vous répond en français, aux heures ouvrées.
            </SectionHeading>

            <Stagger as="ul" className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {whatsapp && (
                <StaggerItem as="li">
                  <a
                    href={whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-spot="" data-lift="" className={`flex h-full flex-col rounded-xl border border-[#eaedff] bg-white p-6 shadow-[0_1px_8px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-[0_6px_24px_rgba(0,35,111,0.08)] ${focusRing}`}
                  >
                    <span className="landing-icon flex h-11 w-11 items-center justify-center rounded-lg bg-[#dcfce7] text-[#166534]">
                      <span className="material-symbols-outlined text-2xl">chat</span>
                    </span>
                    <h3 className="mt-4 text-[17px] font-bold text-[#00236f]">WhatsApp</h3>
                    <p className="mt-1 break-words font-mono text-[15px] font-bold text-[#131b2e]">{offre.telWhatsapp}</p>
                    <p className="mt-2 text-[14px] leading-relaxed text-[#444651]">Écrivez-nous, nous répondons rapidement.</p>
                  </a>
                </StaggerItem>
              )}
              {appel && (
                <StaggerItem as="li">
                  <a
                    href={appel}
                    data-spot="" data-lift="" className={`flex h-full flex-col rounded-xl border border-[#eaedff] bg-white p-6 shadow-[0_1px_8px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-[0_6px_24px_rgba(0,35,111,0.08)] ${focusRing}`}
                  >
                    <span className="landing-icon flex h-11 w-11 items-center justify-center rounded-lg bg-[#eaedff] text-[#0051d5]">
                      <span className="material-symbols-outlined text-2xl">call</span>
                    </span>
                    <h3 className="mt-4 text-[17px] font-bold text-[#00236f]">Appel</h3>
                    <p className="mt-1 break-words font-mono text-[15px] font-bold text-[#131b2e]">{offre.telAppel}</p>
                    <p className="mt-2 text-[14px] leading-relaxed text-[#444651]">Du lundi au vendredi, aux heures ouvrées.</p>
                  </a>
                </StaggerItem>
              )}
              <StaggerItem as="li">
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  data-spot="" data-lift="" className={`flex h-full flex-col rounded-xl border border-[#eaedff] bg-white p-6 shadow-[0_1px_8px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-[0_6px_24px_rgba(0,35,111,0.08)] ${focusRing}`}
                >
                  <span className="landing-icon flex h-11 w-11 items-center justify-center rounded-lg bg-[#eaedff] text-[#0051d5]">
                    <span className="material-symbols-outlined text-2xl">mail</span>
                  </span>
                  <h3 className="mt-4 text-[17px] font-bold text-[#00236f]">Courriel</h3>
                  <p className="mt-1 break-all font-mono text-[15px] font-bold text-[#131b2e]">{CONTACT_EMAIL}</p>
                  <p className="mt-2 text-[14px] leading-relaxed text-[#444651]">Pour une demande détaillée ou un devis destiné à votre direction.</p>
                </a>
              </StaggerItem>
            </Stagger>
          </div>
        </section>

        {/* Appel à l’action final */}
        <section aria-labelledby="titre-cta" className="pb-20 sm:pb-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal
              className="landing-cta-move relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#00236f] via-[#1e3a8a] to-[#0051d5] px-6 py-12 text-white shadow-xl sm:px-12 sm:py-16"
            >
              <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-[#316bf3]/40 blur-3xl" aria-hidden="true" />
              <div className="absolute -bottom-12 left-1/3 h-40 w-40 rounded-full bg-[#fc922b]/25 blur-3xl" aria-hidden="true" />
              <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_auto]">
                <div>
                  <h2 id="titre-cta" className="text-[28px] font-extrabold leading-tight tracking-tight sm:text-[36px]">
                    Prêt pour votre prochaine session ?
                  </h2>
                  <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/85 sm:text-[16px]">
                    Créez le compte de votre établissement, invitez votre équipe, importez vos candidats. Le jour du
                    jury, relevés, liste des candidats et procès-verbal sont prêts à imprimer.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-stretch">
                  <RouteLink href={ROUTE_PATHS.inscription} onNavigate={onInscription} className={`${btnOnDark} lg:whitespace-nowrap`} magnetic>
                    <span className="material-symbols-outlined text-lg">domain_add</span>
                    <span>Créer le compte de mon établissement</span>
                  </RouteLink>
                  <RouteLink href={ROUTE_PATHS.connexion} onNavigate={onConnexion} className={`${btnLight} lg:whitespace-nowrap`} magnetic>
                    <span className="material-symbols-outlined text-lg">login</span>
                    <span>Se connecter</span>
                  </RouteLink>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      {/* Pied de page */}
      <footer className="border-t border-[#eaedff] bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#00236f] text-white">
                <span className="material-symbols-outlined text-xl">account_balance</span>
              </span>
              <span className="text-[16px] font-bold tracking-tight text-[#00236f]">AcademiaBlanc</span>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-[#444651]">
              Gestion scolaire et examens blancs, seul ou entre établissements : candidats, notes, moyennes et
              rangs, relevés, liste des candidats, feuille d’émargement et procès-verbal.
            </p>
          </div>
          <nav aria-label="Pied de page" className="contents">
            <div className="text-[13px]">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#757682]">Site</p>
              <ul className="mt-3 space-y-2">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} className={lienTexte}>{link.label}</a>
                  </li>
                ))}
                <li>
                  <a href="#documents" className={lienTexte}>Documents imprimés</a>
                </li>
              </ul>
            </div>
            <div className="text-[13px]">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#757682]">Compte</p>
              <ul className="mt-3 space-y-2">
                <li>
                  <RouteLink href={ROUTE_PATHS.connexion} onNavigate={onConnexion} className={lienTexte}>
                    Se connecter
                  </RouteLink>
                </li>
                <li>
                  <RouteLink href={ROUTE_PATHS.inscription} onNavigate={onInscription} className={lienTexte}>
                    Créer un compte
                  </RouteLink>
                </li>
                <li>
                  <a href={`mailto:${CONTACT_EMAIL}`} className={lienTexte}>{CONTACT_EMAIL}</a>
                </li>
              </ul>
            </div>
          </nav>
        </div>
        <div className="space-y-1.5 border-t border-[#eaedff] bg-[#faf8ff] px-4 py-4 text-center text-[11px] text-[#444651] sm:px-6">
          {/* Documents légaux : CGU, confidentialité, conditions d’utilisation + © année AcademiaBlanc */}
          <LiensLegaux />
          <p>AcademiaBlanc • {bandeau}</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
