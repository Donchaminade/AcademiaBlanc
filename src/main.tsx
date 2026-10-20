import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import {MiseAJourBanner} from './components/MiseAJourBanner';
import {
  appliquerVersionEnAttente,
  doitAppliquerSansDemander,
  optionsNavigateur,
  planifierVerifications,
  rechargerUneFois,
  signalerNouvelleVersion,
} from './pwa/miseAJour';
import './index.css';

// Service worker généré au build (Workbox) : précache de l'application, de ses styles, polices et icônes
// pour un rendu complet hors connexion. Les appels à l'API ne sont jamais servis depuis un cache.
// Un nouveau build attend (« prompt ») : appliqué aussitôt s'il est détecté au chargement, sinon proposé par
// le bandeau « Nouvelle version disponible — Actualiser » ; la présence d'une mise à jour est vérifiée toutes
// les heures et au retour sur l'onglet (voir src/pwa/miseAJour.ts).
const chargeA = performance.now();
const appliquer = () => appliquerVersionEnAttente({
  activer: () => activerVersionEnAttente(),
  priseDeControle: () => new Promise<void>((resolve) => {
    navigator.serviceWorker?.addEventListener('controllerchange', () => resolve(), {once: true});
  }),
  attendre: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  recharger: () => window.location.reload(),
});
const activerVersionEnAttente = registerSW({
  immediate: true,
  onNeedReload: () => rechargerUneFois(),
  onNeedRefresh() {
    if (doitAppliquerSansDemander(performance.now() - chargeA, window.location.pathname)) {
      void appliquer();
      return;
    }
    signalerNouvelleVersion(appliquer);
  },
  onRegisteredSW(_url, registration) {
    if (registration) planifierVerifications(registration, optionsNavigateur());
  },
});

createRoot(document.getElementById('root')!).render(
  <>
    <App />
    <MiseAJourBanner />
  </>,
);
