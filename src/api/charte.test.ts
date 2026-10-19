import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyCharte, charteChanged, estImageDemo, parametresSansDemonstration, versCharte } from './charte';
import { DEFAULT_LOGO_URL, DEFAULT_SETTINGS } from '../data/mockData';

const LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('charte de l’établissement : logo, sceau et signatures conservés en base', () => {
  it('aucune image de démonstration n’est affichée ni envoyée pour un vrai compte', () => {
    assert.equal(estImageDemo(DEFAULT_LOGO_URL), true);
    assert.equal(estImageDemo('https://lh3.googleusercontent.com/aida/xyz'), true);
    assert.equal(estImageDemo(LOGO), false);
    assert.equal(estImageDemo(''), false);
    assert.equal(estImageDemo(null), false);

    const base = parametresSansDemonstration(DEFAULT_SETTINGS);
    assert.equal(base.logoUrl, '');
    assert.equal(base.sealUrl, '');
    assert.equal(base.institutionName, DEFAULT_SETTINGS.institutionName);
    // Une image propre à l'établissement est conservée.
    assert.equal(parametresSansDemonstration({ ...DEFAULT_SETTINGS, logoUrl: LOGO }).logoUrl, LOGO);

    const corps = versCharte(DEFAULT_SETTINGS);
    assert.equal(corps.logoUrl, null);
    assert.equal(corps.sceauOfficielUrl, '');
  });

  it('la charte reçue du serveur fait foi : logo présent affiché, logo absent → emplacement vide (initiales)', () => {
    const avecLogo = applyCharte(DEFAULT_SETTINGS, {
      logoUrl: LOGO, sceauUrl: null, signatureProviseurUrl: null, signatureTitulaireUrl: null, sceauOfficielUrl: null,
    });
    assert.equal(avecLogo.logoUrl, LOGO);
    assert.equal(avecLogo.sealUrl, '');
    assert.equal(avecLogo.sceauUrl, '');

    // Retrait du logo : la réponse (null) remplace bien l'ancien logo, elle ne le laisse pas réapparaître.
    const retire = applyCharte(avecLogo, {
      logoUrl: null, sceauUrl: null, signatureProviseurUrl: null, signatureTitulaireUrl: null, sceauOfficielUrl: null,
    });
    assert.equal(retire.logoUrl, '');
    // Les textes absents du serveur gardent la valeur locale.
    assert.equal(retire.jurySignerName, DEFAULT_SETTINGS.jurySignerName);
  });

  it('le changement de logo déclenche l’enregistrement de la charte', () => {
    const base = parametresSansDemonstration(DEFAULT_SETTINGS);
    assert.equal(charteChanged(base, { ...base, logoUrl: LOGO }), true);
    assert.equal(charteChanged(base, { ...base, institutionName: 'Autre' }), false);
    assert.equal(versCharte({ ...base, logoUrl: LOGO }).logoUrl, LOGO);
    assert.equal(versCharte({ ...base, logoUrl: '' }).logoUrl, null);
  });
});
