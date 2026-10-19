import React, { useEffect } from 'react';
import { DATE_MISE_A_JOUR_CONDITIONS, VERSION_CONDITIONS, versionLisible } from '../../legal/versions';
import { ROUTE_PATHS, clicNavigationInterne, naviguerVersChemin } from '../../utils/router';
import type { LegalRoute } from '../../utils/router';
import { LIENS_LEGAUX, LiensLegaux } from './LiensLegaux';

/** Une section d’un document légal : ancre du sommaire, titre et contenu. */
export interface SectionLegale {
  id: string;
  titre: string;
  contenu: React.ReactNode;
}

interface PageLegaleProps {
  route: LegalRoute;
  /** Titre du document (balise <title>, h1). */
  titre: string;
  /** Phrase d’introduction sous le titre. */
  chapeau: string;
  /** Contenu de la balise meta description (≈ 150 caractères). */
  description: string;
  sections: SectionLegale[];
  /** Retour à l’accueil (`/`). */
  onRetour: () => void;
}

/* Typographie commune aux trois textes : lisible sur mobile, sans dépendance de plugin. */
export const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[15px] leading-relaxed text-[#2b3245]">{children}</p>
);
export const Ul: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-[#2b3245] marker:text-[#0051d5]">{children}</ul>
);
export const H3: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="pt-1 text-[15px] font-bold text-[#00236f]">{children}</h3>
);
export const Note: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="rounded-lg border border-[#dce1ff] bg-[#f2f3ff] px-3.5 py-2.5 text-[13.5px] leading-relaxed text-[#00236f]">{children}</p>
);

/** Met à jour (ou crée) une balise <meta name=…> et renvoie la fonction qui rétablit l’ancienne valeur. */
function definirMeta(name: string, content: string): () => void {
  let meta = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  const creee = !meta;
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', name);
    document.head.appendChild(meta);
  }
  const precedent = meta.getAttribute('content');
  meta.setAttribute('content', content);
  const cible = meta;
  return () => {
    if (creee) cible.remove();
    else if (precedent !== null) cible.setAttribute('content', precedent);
  };
}

/** Lien canonique de la page (ces pages sont publiques et indexables). */
function definirCanonique(chemin: string): () => void {
  const lien = document.createElement('link');
  lien.setAttribute('rel', 'canonical');
  lien.setAttribute('href', `${window.location.origin}${chemin}`);
  document.head.appendChild(lien);
  return () => lien.remove();
}

/**
 * Gabarit des trois documents légaux : sommaire ancré (colonne fixe à partir de lg, liste en haut sur
 * mobile), version et date de dernière mise à jour, bouton de retour à l’accueil, métadonnées title /
 * description / canonical, et aucune balise `noindex` : ces pages doivent être indexables.
 */
export const PageLegale: React.FC<PageLegaleProps> = ({ route, titre, chapeau, description, sections, onRetour }) => {
  useEffect(() => {
    const titrePrecedent = document.title;
    document.title = `${titre} • AcademiaBlanc`;
    const retablirDescription = definirMeta('description', description);
    const retablirRobots = definirMeta('robots', 'index, follow');
    const retablirCanonique = definirCanonique(ROUTE_PATHS[route]);
    return () => {
      document.title = titrePrecedent;
      retablirDescription();
      retablirRobots();
      retablirCanonique();
    };
  }, [route, titre, description]);

  // Ancre présente dans l’URL à l’ouverture : la section visée est amenée à l’écran une fois rendue.
  useEffect(() => {
    const ancre = window.location.hash.replace(/^#/, '');
    if (!ancre) return;
    const cible = document.getElementById(ancre);
    if (cible) cible.scrollIntoView({ block: 'start' });
  }, [route]);

  const autres = LIENS_LEGAUX.filter((item) => item.route !== route);

  return (
    <div className="min-h-dvh bg-[#faf8ff] text-[#131b2e] antialiased flex flex-col">
      <header className="sticky top-0 z-10 border-b border-[#eaedff] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <a
            href={ROUTE_PATHS.vitrine}
            onClick={(event) => {
              if (!clicNavigationInterne(event)) return;
              event.preventDefault();
              onRetour();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-[#00236f] transition-colors hover:bg-[#f2f3ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0051d5]"
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">arrow_back</span>
            <span>Retour à l’accueil</span>
          </a>
          <span className="flex items-center gap-2 text-[14px] font-bold tracking-tight text-[#00236f]">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00236f] text-white">
              <span className="material-symbols-outlined text-lg" aria-hidden="true">account_balance</span>
            </span>
            AcademiaBlanc
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:py-12">
        <div className="mb-8 space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#0051d5]">Document légal</p>
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-[#00236f] sm:text-[32px]">{titre}</h1>
          <p className="max-w-3xl text-[15px] leading-relaxed text-[#444651]">{chapeau}</p>
          <dl className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[12.5px] text-[#444651]">
            <div className="flex items-center gap-1.5">
              <dt className="font-semibold text-[#00236f]">Version</dt>
              <dd><code className="rounded bg-white px-1.5 py-0.5 font-mono text-[12px] border border-[#eaedff]">{VERSION_CONDITIONS}</code></dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="font-semibold text-[#00236f]">Dernière mise à jour</dt>
              <dd>
                <time dateTime={DATE_MISE_A_JOUR_CONDITIONS}>{versionLisible(DATE_MISE_A_JOUR_CONDITIONS)}</time>
              </dd>
            </div>
          </dl>
        </div>

        <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-12">
          <nav aria-label="Sommaire" className="lg:sticky lg:top-20 lg:self-start">
            <details className="rounded-xl border border-[#eaedff] bg-white shadow-xs lg:open:shadow-none" open>
              <summary className="cursor-pointer list-none px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[#757682] lg:cursor-default">
                Sommaire
              </summary>
              <ol className="space-y-0.5 px-2 pb-3">
                {sections.map((section, index) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="flex gap-2 rounded-lg px-2 py-1.5 text-[13px] leading-snug text-[#2b3245] hover:bg-[#f2f3ff] hover:text-[#0051d5]"
                    >
                      <span className="w-5 shrink-0 font-mono text-[12px] text-[#757682]">{index + 1}.</span>
                      <span>{section.titre}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </details>
            <div className="mt-4 hidden rounded-xl border border-[#eaedff] bg-white p-4 lg:block">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#757682]">Autres documents</p>
              <ul className="mt-2 space-y-1.5">
                {autres.map((item) => (
                  <li key={item.route}>
                    <a
                      href={ROUTE_PATHS[item.route]}
                      className="text-[13px] font-semibold text-[#00236f] hover:text-[#0051d5]"
                      onClick={(event) => {
                        if (!clicNavigationInterne(event)) return;
                        event.preventDefault();
                        naviguerVersChemin(ROUTE_PATHS[item.route]);
                      }}
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          <article className="min-w-0 space-y-9">
            {sections.map((section, index) => (
              <section key={section.id} id={section.id} aria-labelledby={`${section.id}-titre`} className="scroll-mt-24 space-y-3">
                <h2 id={`${section.id}-titre`} className="flex gap-2.5 text-[19px] font-bold leading-snug text-[#00236f] sm:text-[21px]">
                  <span className="font-mono text-[15px] text-[#0051d5] pt-0.5">{index + 1}.</span>
                  <span>{section.titre}</span>
                </h2>
                <div className="space-y-3">{section.contenu}</div>
              </section>
            ))}
            <div className="border-t border-[#eaedff] pt-6">
              <a
                href={ROUTE_PATHS.vitrine}
                onClick={(event) => {
                  if (!clicNavigationInterne(event)) return;
                  event.preventDefault();
                  onRetour();
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-[#00236f] px-4 py-2.5 text-[13px] font-bold text-white shadow-md transition-colors hover:bg-[#1e3a8a]"
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">home</span>
                <span>Retour à l’accueil</span>
              </a>
            </div>
          </article>
        </div>
      </main>

      <footer className="border-t border-[#eaedff] bg-white px-4 py-4 sm:px-6">
        <LiensLegaux />
      </footer>
    </div>
  );
};

export default PageLegale;
