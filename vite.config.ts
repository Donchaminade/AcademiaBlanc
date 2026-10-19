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
        // Le service worker prend la main dès son installation et se met à jour seul :
        // chaque build produit un nouveau manifeste de précache (hash par fichier),
        // les anciens caches sont supprimés (cleanupOutdatedCaches).
        registerType: 'autoUpdate',
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
          skipWaiting: true,
          // Application monopage : toute navigation (/connexion, /admin…) retombe sur index.html
          // hors connexion. Les appels /api/* ne sont jamais servis depuis le cache.
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [],
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
