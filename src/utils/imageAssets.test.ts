import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CHARTE_IMAGE_ACCEPT,
  CHARTE_IMAGE_MAX_OCTETS,
  CHARTE_IMAGE_MAX_OCTETS_SERVEUR,
  CHARTE_IMAGE_MAX_PX,
  isAcceptedCharteImage,
  octetsDataUrl,
  paliersDeTaille,
  poidsLisible,
} from './imageAssets';

const dataUrl = (octets: number) => `data:image/png;base64,${Buffer.alloc(octets, 1).toString('base64')}`;

describe('images de la charte : validation et limites côté navigateur', () => {
  it('accepte PNG, JPG, WebP et SVG (et l’extension quand le type MIME manque)', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']) {
      assert.equal(isAcceptedCharteImage({ type, name: 'logo' }), true, type);
    }
    assert.equal(isAcceptedCharteImage({ type: '', name: 'logo.PNG' }), true);
    assert.equal(isAcceptedCharteImage({ type: 'image/gif', name: 'anim.gif' }), false);
    assert.equal(isAcceptedCharteImage({ type: 'application/pdf', name: 'logo.pdf' }), false);
    assert.equal(isAcceptedCharteImage({ type: 'text/html', name: 'logo.png' }), false);
    assert.equal(CHARTE_IMAGE_ACCEPT, 'image/png,image/jpeg,image/svg+xml,image/webp');
  });

  it('mesure le poids réel d’une data URL (bourrage base64 compris)', () => {
    assert.equal(octetsDataUrl(dataUrl(1_000)), 1_000);
    assert.equal(octetsDataUrl(dataUrl(1_001)), 1_001);
    assert.equal(octetsDataUrl(dataUrl(1_002)), 1_002);
    assert.equal(octetsDataUrl('data:image/png;base64,'), 0);
    assert.equal(octetsDataUrl('https://cdn.example.org/logo.png'), 0);
    // Les retours à la ligne éventuels ne comptent pas.
    assert.equal(octetsDataUrl(`data:image/png;base64,${Buffer.alloc(300, 1).toString('base64').match(/.{1,76}/g)!.join('\n')}`), 300);
  });

  it('limites : 512 px et ≈ 300 Ko côté navigateur, 1 Mo côté serveur', () => {
    assert.equal(CHARTE_IMAGE_MAX_PX, 512);
    assert.equal(CHARTE_IMAGE_MAX_OCTETS, 300 * 1024);
    assert.equal(CHARTE_IMAGE_MAX_OCTETS_SERVEUR, 1024 * 1024);
    assert.ok(CHARTE_IMAGE_MAX_OCTETS < CHARTE_IMAGE_MAX_OCTETS_SERVEUR);
    // Une image réduite par le navigateur passe toujours la limite du serveur.
    assert.ok(octetsDataUrl(dataUrl(CHARTE_IMAGE_MAX_OCTETS)) <= CHARTE_IMAGE_MAX_OCTETS_SERVEUR);
  });

  it('paliers de réduction décroissants jusqu’à 128 px', () => {
    const paliers = paliersDeTaille(512);
    assert.equal(paliers[0], 512);
    assert.ok(paliers.every((p, i) => i === 0 || p < paliers[i - 1]));
    assert.ok(paliers[paliers.length - 1] >= 128);
    assert.ok(paliers.length >= 4);
  });

  it('poids lisible en français', () => {
    assert.equal(poidsLisible(184 * 1024), '184 Ko');
    assert.equal(poidsLisible(500), '1 Ko');
    assert.equal(poidsLisible(1.2 * 1024 * 1024), '1,2 Mo');
  });
});
