import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classeMention,
  classePodium,
  decisionImprimee,
  libelleMention,
  libelleRangImprime,
  mentionVerrouillage,
  nombreFr,
  repartitionMentions,
  resumePalmares,
  statistiquesPalmares,
  tauxFr,
} from './procesVerbal';

const stat = (average: number, mention: 'TRÈS BIEN' | 'BIEN' | 'ASSEZ BIEN' | 'PASSABLE' | 'AJOURNÉ', decision: 'ADMIS' | 'AJOURNÉ') => ({
  average,
  evaluated: true,
  mention,
  decision,
});

const candidats = Array.from({ length: 12 }, (_, i) => ({ id: `c${i + 1}` }));
const stats = {
  c1: stat(17.41, 'TRÈS BIEN', 'ADMIS'),
  c2: stat(14, 'BIEN', 'ADMIS'),
  c3: stat(13.53, 'ASSEZ BIEN', 'ADMIS'),
  c4: stat(12.47, 'ASSEZ BIEN', 'ADMIS'),
  c5: stat(12.29, 'ASSEZ BIEN', 'ADMIS'),
  c6: stat(11.35, 'PASSABLE', 'ADMIS'),
  c7: stat(11, 'PASSABLE', 'ADMIS'),
  c8: stat(10.76, 'PASSABLE', 'ADMIS'),
  c9: stat(9.65, 'AJOURNÉ', 'AJOURNÉ'),
  c10: stat(8.35, 'AJOURNÉ', 'AJOURNÉ'),
  c11: stat(8.12, 'AJOURNÉ', 'AJOURNÉ'),
  // Candidat sans aucune note : inscrit mais ni classé, ni admis, ni ajourné.
  c12: { average: 0, evaluated: false, mention: null, decision: null },
};

describe('statistiquesPalmares', () => {
  it('compte effectif, classés, admis, ajournés, taux, moyennes et mentions de la session', () => {
    const s = statistiquesPalmares(candidats, stats);
    assert.equal(s.effectif, 12);
    assert.equal(s.classes, 11);
    assert.equal(s.admis, 8);
    assert.equal(s.ajournes, 3);
    assert.equal(s.taux, 72.7);
    assert.equal(s.moyenneSession, 11.72);
    assert.equal(s.moyenneMax, 17.41);
    assert.equal(s.moyenneMin, 8.12);
    assert.deepEqual(s.mentions.map((m) => m.nombre), [1, 1, 3, 3, 3]);
  });

  it('reste neutre sans candidat noté', () => {
    const s = statistiquesPalmares([{ id: 'x' }], { x: { average: 0, evaluated: false, mention: null, decision: null } });
    assert.equal(s.effectif, 1);
    assert.equal(s.classes, 0);
    assert.equal(s.taux, null);
    assert.equal(s.moyenneSession, null);
    assert.equal(s.moyenneMax, null);
    assert.equal(repartitionMentions(s), '—');
    assert.equal(resumePalmares(s), 'Admis 0 • Ajournés 0 • Taux — • Moyenne de la session —');
  });

  it('compose le résumé et la répartition en notation française', () => {
    const s = statistiquesPalmares(candidats, stats);
    assert.equal(resumePalmares(s), 'Admis 8 • Ajournés 3 • Taux 72,7 % • Moyenne de la session 11,72');
    assert.equal(repartitionMentions(s), 'Très bien 1 • Bien 1 • Assez bien 3 • Passable 3 • Ajourné 3');
    assert.equal(nombreFr(11.5), '11,50');
    assert.equal(nombreFr(null), '—');
    assert.equal(tauxFr(100), '100,0 %');
    assert.equal(libelleMention('TRÈS BIEN'), 'Très bien');
  });
});

describe('pastilles imprimées du PV', () => {
  it('rang : 1er puis Ne, podium doré / argenté / bronze seulement pour les trois premiers', () => {
    assert.equal(libelleRangImprime(1), '1er');
    assert.equal(libelleRangImprime(2), '2e');
    assert.equal(libelleRangImprime(11), '11e');
    assert.equal(classePodium(1), 'pv-rang pv-rang-or');
    assert.equal(classePodium(2), 'pv-rang pv-rang-argent');
    assert.equal(classePodium(3), 'pv-rang pv-rang-bronze');
    assert.equal(classePodium(4), 'pv-rang');
    assert.equal(classePodium(undefined), 'pv-rang');
  });

  it('mention et décision : une classe par valeur, neutre sans note', () => {
    assert.equal(classeMention('TRÈS BIEN'), 'pv-mention pv-mention-tres-bien');
    assert.equal(classeMention('PASSABLE'), 'pv-mention pv-mention-passable');
    assert.equal(classeMention('AJOURNÉ'), 'pv-mention pv-mention-ajourne');
    assert.equal(classeMention(null), 'pv-mention pv-mention-attente');
    assert.deepEqual(decisionImprimee('ADMIS'), { texte: 'Admis', classe: 'pv-decision pv-decision-admis' });
    assert.deepEqual(decisionImprimee('AJOURNÉ'), { texte: 'Ajourné', classe: 'pv-decision pv-decision-ajourne' });
    assert.deepEqual(decisionImprimee(null), { texte: '—', classe: 'pv-decision' });
  });
});

describe('mentionVerrouillage', () => {
  it('date et heure en français quand la date du verrou est connue', () => {
    const texte = mentionVerrouillage(new Date(2026, 9, 19, 17, 26));
    assert.equal(texte, 'PV verrouillé le 19 octobre 2026 à 17:26');
    assert.equal(mentionVerrouillage(new Date(2026, 9, 19, 17, 26).toISOString()), texte);
  });

  it('sans date (ancien verrou) : mention simple', () => {
    assert.equal(mentionVerrouillage(null), 'PV verrouillé');
    assert.equal(mentionVerrouillage('pas une date'), 'PV verrouillé');
  });
});
