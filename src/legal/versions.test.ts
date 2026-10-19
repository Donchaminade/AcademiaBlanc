import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DATE_MISE_A_JOUR_CONDITIONS,
  VERSION_CONDITIONS,
  formaterDateAcceptation,
  phraseAcceptation,
  versionLisible,
  versionObsolete,
} from './versions';
import { LIBELLE_ACCEPTATION, boutonInscriptionDesactive } from './acceptation';

describe('VERSION_CONDITIONS', () => {
  it('est une date ISO (AAAA-MM-JJ) et la date de mise à jour la suit', () => {
    assert.match(VERSION_CONDITIONS, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(DATE_MISE_A_JOUR_CONDITIONS, VERSION_CONDITIONS);
    assert.equal(versionLisible('2026-10-19'), '19/10/2026');
    assert.equal(versionLisible('v2'), 'v2');
  });
});

describe('versionObsolete (détection d’une version obsolète)', () => {
  it('exige une acceptation quand aucune n’est enregistrée', () => {
    assert.equal(versionObsolete(null), true);
    assert.equal(versionObsolete(undefined), true);
    assert.equal(versionObsolete('  '), true);
  });

  it('est à jour quand la dernière version acceptée est la version courante', () => {
    assert.equal(versionObsolete(VERSION_CONDITIONS), false);
    assert.equal(versionObsolete(' 2026-10-19 ', '2026-10-19'), false);
  });

  it('est obsolète quand une version antérieure a été acceptée', () => {
    assert.equal(versionObsolete('2025-01-01', '2026-10-19'), true);
    assert.equal(versionObsolete('2026-10-18', '2026-10-19'), true);
  });

  it('ne réclame rien pour une version plus récente que la courante (déploiement en cours)', () => {
    assert.equal(versionObsolete('2027-01-01', '2026-10-19'), false);
  });
});

describe('formaterDateAcceptation (formatage de la date)', () => {
  it('affiche la date et l’heure en UTC quel que soit le fuseau du navigateur', () => {
    assert.equal(formaterDateAcceptation('2026-10-19T15:36:12Z'), '19/10/2026 à 15:36 UTC');
    assert.equal(formaterDateAcceptation('2026-10-19T15:36:12.123456Z'), '19/10/2026 à 15:36 UTC');
    // Décalage horaire dans la chaîne : la valeur affichée reste l’instant UTC.
    assert.equal(formaterDateAcceptation('2026-10-19T17:36:12+02:00'), '19/10/2026 à 15:36 UTC');
  });

  it('complète les jours, mois, heures et minutes à deux chiffres', () => {
    assert.equal(formaterDateAcceptation('2026-01-05T07:04:00Z'), '05/01/2026 à 07:04 UTC');
  });

  it('renvoie null pour une valeur absente ou illisible', () => {
    assert.equal(formaterDateAcceptation(null), null);
    assert.equal(formaterDateAcceptation(''), null);
    assert.equal(formaterDateAcceptation('pas une date'), null);
  });

  it('compose la phrase du profil', () => {
    assert.equal(
      phraseAcceptation({ accepteLe: '2026-10-19T15:36:00Z', versionConditions: '2026-10-19' }),
      'Conditions acceptées le 19/10/2026 à 15:36 UTC, version 2026-10-19',
    );
    assert.equal(phraseAcceptation(null), null);
    assert.equal(phraseAcceptation({ accepteLe: 'n/a', versionConditions: '2026-10-19' }), null);
  });
});

describe('boutonInscriptionDesactive (case à cocher obligatoire)', () => {
  it('désactive le bouton tant que la case n’est pas cochée', () => {
    assert.equal(boutonInscriptionDesactive({ accepte: false, enCours: false }), true);
  });

  it('active le bouton une fois la case cochée', () => {
    assert.equal(boutonInscriptionDesactive({ accepte: true, enCours: false }), false);
  });

  it('reste désactivé pendant l’appel au serveur', () => {
    assert.equal(boutonInscriptionDesactive({ accepte: true, enCours: true }), true);
  });

  it('nomme les trois documents dans le libellé de la case', () => {
    assert.ok(LIBELLE_ACCEPTATION.includes('Conditions générales d’utilisation'));
    assert.ok(LIBELLE_ACCEPTATION.includes('Conditions d’utilisation'));
    assert.ok(LIBELLE_ACCEPTATION.includes('Politique de confidentialité'));
  });
});
