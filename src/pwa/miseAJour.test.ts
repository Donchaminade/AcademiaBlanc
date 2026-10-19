import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DELAI_APPLICATION_SILENCIEUSE_MS,
  DELAI_MAX_PRISE_DE_CONTROLE_MS,
  ESPACEMENT_RETOUR_ONGLET_MS,
  INTERVALLE_VERIFICATION_MS,
  appliquerVersionEnAttente,
  doitAppliquerSansDemander,
  ignorerNouvelleVersion,
  lireEtatMiseAJour,
  planifierVerifications,
  rechargerUneFois,
  reinitialiserRechargement,
  signalerNouvelleVersion,
  surEtatMiseAJour,
} from './miseAJour';

/** Horloge et document simulés : les minuteries se déclenchent à la main. */
function simulateur() {
  let temps = 0;
  const intervalles: { handler: () => void; ms: number; actif: boolean }[] = [];
  const ecouteurs = new Set<() => void>();
  let visibilite = 'visible';
  return {
    avancer(ms: number) {
      temps += ms;
    },
    tic() {
      intervalles.filter((item) => item.actif).forEach((item) => item.handler());
    },
    masquerPuisRevenir() {
      visibilite = 'hidden';
      ecouteurs.forEach((ecouteur) => ecouteur());
      visibilite = 'visible';
      ecouteurs.forEach((ecouteur) => ecouteur());
    },
    intervalles,
    ecouteurs,
    options: (enLigne = true) => ({
      horloge: {
        setInterval: (handler: () => void, ms: number) => {
          const item = { handler, ms, actif: true };
          intervalles.push(item);
          return item;
        },
        clearInterval: (id: unknown) => {
          (id as { actif: boolean }).actif = false;
        },
        maintenant: () => temps,
      },
      document: {
        addEventListener: (_type: 'visibilitychange', listener: () => void) => { ecouteurs.add(listener); },
        removeEventListener: (_type: 'visibilitychange', listener: () => void) => { ecouteurs.delete(listener); },
        get visibilityState() { return visibilite; },
      },
      enLigne: () => enLigne,
    }),
  };
}

describe('mise à jour du service worker', () => {
  it('une nouvelle version trouvée au chargement s’applique sans demander ; plus tard, le bandeau décide', () => {
    assert.equal(doitAppliquerSansDemander(0), true);
    assert.equal(doitAppliquerSansDemander(DELAI_APPLICATION_SILENCIEUSE_MS - 1), true);
    assert.equal(doitAppliquerSansDemander(DELAI_APPLICATION_SILENCIEUSE_MS), false);
    assert.equal(doitAppliquerSansDemander(45 * 60 * 1000), false);
  });

  it('vérifie toutes les heures, et au retour sur l’onglet au plus toutes les cinq minutes', async () => {
    const sim = simulateur();
    let appels = 0;
    const registration = { update: async () => { appels += 1; } };
    const arreter = planifierVerifications(registration, sim.options());

    assert.equal(sim.intervalles.length, 1);
    assert.equal(sim.intervalles[0].ms, INTERVALLE_VERIFICATION_MS);
    assert.equal(INTERVALLE_VERIFICATION_MS, 60 * 60 * 1000);

    sim.tic();
    assert.equal(appels, 1, 'vérification horaire');

    // Retour sur l'onglet juste après le chargement : trop tôt, rien.
    sim.masquerPuisRevenir();
    assert.equal(appels, 1);

    sim.avancer(ESPACEMENT_RETOUR_ONGLET_MS);
    sim.masquerPuisRevenir();
    assert.equal(appels, 2, 'vérification au retour sur l’onglet');

    // Un second retour immédiat n'en déclenche pas une nouvelle.
    sim.masquerPuisRevenir();
    assert.equal(appels, 2);

    arreter();
    sim.tic();
    sim.avancer(ESPACEMENT_RETOUR_ONGLET_MS);
    sim.masquerPuisRevenir();
    assert.equal(appels, 2, 'plus rien après l’arrêt');
    assert.equal(sim.ecouteurs.size, 0);
  });

  it('hors connexion, aucune sollicitation du réseau ; un échec de vérification est avalé', async () => {
    const sim = simulateur();
    let appels = 0;
    planifierVerifications({ update: async () => { appels += 1; } }, sim.options(false));
    sim.tic();
    assert.equal(appels, 0);

    const sim2 = simulateur();
    planifierVerifications({ update: () => Promise.reject(new Error('réseau')) }, sim2.options());
    sim2.tic();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it('« Actualiser » active la version en attente puis recharge une seule fois, même sans prise de contrôle', async () => {
    reinitialiserRechargement();
    const journal: string[] = [];
    let prisDeControle: () => void = () => undefined;
    await appliquerVersionEnAttente({
      activer: async () => { journal.push('activer'); },
      // L'écoute est posée avant l'activation, jamais avant (sinon la première prise de contrôle l'aurait déjà résolue).
      priseDeControle: () => { journal.push('écoute'); return new Promise<void>((resolve) => { prisDeControle = () => { journal.push('contrôle'); resolve(); }; }); },
      // La prise de contrôle arrive pendant l'attente : on recharge sans attendre le délai maximal.
      attendre: async (ms) => { journal.push(`attendre ${ms}`); prisDeControle(); await new Promise((resolve) => setTimeout(resolve, 20)); },
      recharger: () => { journal.push('recharger'); },
    });
    assert.deepEqual(journal, ['écoute', 'activer', `attendre ${DELAI_MAX_PRISE_DE_CONTROLE_MS}`, 'contrôle', 'recharger']);

    // Second signal (événement « controlling » de workbox-window) : pas de deuxième rechargement.
    rechargerUneFois(() => journal.push('recharger bis'));
    assert.equal(journal.filter((item) => item.startsWith('recharger')).length, 1);

    // Sans prise de contrôle (première visite, page non contrôlée) : rechargement après le délai maximal.
    reinitialiserRechargement();
    const journal2: string[] = [];
    await appliquerVersionEnAttente({
      activer: async () => undefined,
      priseDeControle: () => new Promise<void>(() => undefined),
      attendre: async (ms) => { journal2.push(`délai ${ms}`); },
      recharger: () => { journal2.push('recharger'); },
    });
    assert.deepEqual(journal2, [`délai ${DELAI_MAX_PRISE_DE_CONTROLE_MS}`, 'recharger']);
    reinitialiserRechargement();
  });

  it('l’état du bandeau : disponible après signalement, replié après « Plus tard »', async () => {
    let notifications = 0;
    const desabonner = surEtatMiseAJour(() => { notifications += 1; });
    assert.equal(lireEtatMiseAJour().disponible, false);

    let applique = false;
    signalerNouvelleVersion(async () => { applique = true; });
    assert.equal(lireEtatMiseAJour().disponible, true);
    assert.equal(notifications, 1);
    await lireEtatMiseAJour().appliquer();
    assert.equal(applique, true);

    ignorerNouvelleVersion();
    assert.equal(lireEtatMiseAJour().disponible, false);
    assert.equal(notifications, 2);
    desabonner();
    signalerNouvelleVersion(async () => undefined);
    assert.equal(notifications, 2);
    ignorerNouvelleVersion();
  });
});
