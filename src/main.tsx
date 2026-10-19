import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import {MiseAJourBanner} from './components/MiseAJourBanner';
import {doitAppliquerSansDemander, optionsNavigateur, planifierVerifications, signalerNouvelleVersion} from './pwa/miseAJour';
import './index.css';

// Service worker généré au build (Workbox) : précache de l'application, de ses styles, polices et icônes
// pour un rendu complet hors connexion. Les appels à l'API ne sont jamais servis depuis un cache.
// Un nouveau build attend (« prompt ») : appliqué aussitôt s'il est détecté au chargement, sinon proposé par
// le bandeau « Nouvelle version disponible — Actualiser » ; la présence d'une mise à jour est vérifiée toutes
// les heures et au retour sur l'onglet (voir src/pwa/miseAJour.ts).
const chargeA = performance.now();
const appliquerMiseAJour = registerSW({
  immediate: true,
  onNeedRefresh() {
    if (doitAppliquerSansDemander(performance.now() - chargeA)) {
      void appliquerMiseAJour();
      return;
    }
    signalerNouvelleVersion(() => appliquerMiseAJour());
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
