import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Service worker généré au build (Workbox) : précache de l'application, de ses styles,
// polices et icônes pour un rendu complet hors connexion ; mise à jour silencieuse.
registerSW({immediate: true});

createRoot(document.getElementById('root')!).render(<App />);
