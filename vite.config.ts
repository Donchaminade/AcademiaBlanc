import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

const DESCRIPTION =
  "Plateforme officielle de gestion des examens d'État, saisie des notes, délibération du jury et édition des bulletins certifiés ISO 216.";

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        // Chaque build produit un nouveau manifeste de précache (hash par fichier) et les anciens caches
        // sont supprimés (cleanupOutdatedCaches). Le nouveau service worker attend (« prompt ») au lieu
        // de prendre la main au milieu d'une saisie : src/main.tsx l'applique aussitôt s'il est détecté au
        // chargement, sinon propose le bandeau « Nouvelle version disponible — Actualiser », et vérifie
        // les mises à jour toutes les heures (une PWA installée ne navigue jamais : sans cela, l'ancien
        // build resterait servi indéfiniment après un déploiement).
        registerType: 'prompt',
        manifest: {
          id: '/',
          name: "AcademiaBlanc - Examens d'État",
          short_name: 'AcademiaBlanc',
          description: DESCRIPTION,
          lang: 'fr',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'any',
          background_color: '#faf8ff',
          theme_color: '#00236f',
          icons: [
            {src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png'},
            {src: '/icons/pwa-512x512.png', sizes: '512x512', type: 'image/png'},
            {src: '/icons/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable'},
          ],
        },
        workbox: {
          // Précache au build : index.html, JS/CSS hachés, polices woff2, icônes, manifest.
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}'],
          // La police variable Material Symbols (≈3,9 Mo) dépasse la limite par défaut de 2 Mio.
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          // Pas de skipWaiting : le nouveau service worker reste en attente jusqu'à l'actualisation
          // décidée par l'utilisateur (ou immédiate au chargement), sinon l'ancienne page recevrait des
          // fichiers du nouveau build.
          skipWaiting: false,
          // Application monopage : toute navigation (/connexion, /admin…) retombe sur index.html
          // hors connexion. Les appels /api/* ne sont jamais servis depuis le cache.
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/api\//],
          // L'API (même origine ou serveur distant) passe toujours par le réseau : aucune réponse
          // d'élèves, de notes ou de paramètres n'est conservée dans un cache du service worker.
          runtimeCaching: [
            {
              urlPattern: ({url}) => url.pathname.startsWith('/api/'),
              handler: 'NetworkOnly',
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
