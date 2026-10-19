import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PREREGLAGES_DEMONSTRATION } from '../data/prereglagesDemo';
import type { AppSettings } from '../types';
import { ministryMark } from './bulletinHeader';
import {
  appliquerEnTeteAuxSettings,
  appliquerPrereglageAuxSettings,
  bandeauNational,
  drapeau,
  enTeteChanged,
  enTeteDepuisSettings,
  prereglageCourant,
  titreRepublique,
} from './prereglages';

const base: AppSettings = {
  logoUrl: '',
  sealUrl: '',
  institutionName: 'Lycée Test',
  countryName: 'RÉPUBLIQUE TOGOLAISE',
  motto: 'Travail – Liberté – Patrie',
  ministryName: 'MINISTÈRE DES ENSEIGNEMENTS PRIMAIRE, SECONDAIRE ET TECHNIQUE',
  academicYear: '2024-2025',
  sessionName: 'BAC II',
  examType: 'BAC',
  jurySignerName: 'X',
  principalTeacherName: 'Y',
  sceauUrl: 'data:image/png;base64,cachet',
  startTableNumber: 1,
  autoAssignTables: true,
};

describe('préréglages nationaux', () => {
  it('convertit un code ISO2 en drapeau et rejette les codes invalides', () => {
    assert.equal(drapeau('TG'), '🇹🇬');
    assert.equal(drapeau('ci'), '🇨🇮');
    assert.equal(drapeau('TGO'), '');
    assert.equal(drapeau(''), '');
  });

  it('met la république en casse de titre pour la vitrine', () => {
    assert.equal(titreRepublique('RÉPUBLIQUE TOGOLAISE'), 'République Togolaise');
    assert.equal(titreRepublique("RÉPUBLIQUE DE CÔTE D'IVOIRE"), "République de Côte d'Ivoire");
    assert.equal(bandeauNational({ republique: 'RÉPUBLIQUE DU BÉNIN', sigleMinistere: 'MESTFP' }), 'République du Bénin • MESTFP');
  });

  it("applique un préréglage sans toucher aux logos, cachet et signataires", () => {
    const ci = PREREGLAGES_DEMONSTRATION[1];
    const next = appliquerPrereglageAuxSettings(base, ci);
    assert.equal(next.countryName, "RÉPUBLIQUE DE CÔTE D'IVOIRE");
    assert.equal(next.motto, 'Union – Discipline – Travail');
    assert.equal(next.ministrySigle, 'MENA');
    assert.equal(next.prereglageNationalId, null, 'un préréglage de démonstration ne mémorise aucun identifiant');
    assert.equal(next.sceauUrl, base.sceauUrl);
    assert.equal(next.jurySignerName, 'X');
    assert.equal(ministryMark(next), '(MENA)');
  });

  it("reporte l'en-tête de l'établissement et détecte les changements", () => {
    const next = appliquerEnTeteAuxSettings(base, {
      prereglageNationalId: 7,
      republique: 'RÉPUBLIQUE DU BÉNIN',
      deviseNationale: 'Fraternité – Justice – Travail',
      ministere: 'MINISTÈRE DES ENSEIGNEMENTS SECONDAIRE',
      sigleMinistere: 'MESTFP',
      autoriteRegionale: 'Direction Départementale',
      piedDePage: null,
    });
    assert.equal(next.prereglageNationalId, 7);
    assert.equal(next.regionalAuthority, 'Direction Départementale');
    assert.equal(enTeteChanged(base, next), true);
    assert.equal(enTeteChanged(base, { ...base, logoUrl: 'x' }), false);
    assert.deepEqual(enTeteDepuisSettings(next), {
      prereglageNationalId: 7,
      republique: 'RÉPUBLIQUE DU BÉNIN',
      deviseNationale: 'Fraternité – Justice – Travail',
      ministere: 'MINISTÈRE DES ENSEIGNEMENTS SECONDAIRE',
      sigleMinistere: 'MESTFP',
      autoriteRegionale: 'Direction Départementale',
      piedDePage: null,
    });
    // Un en-tête vide côté serveur ne vide pas les paramètres locaux.
    const inchange = appliquerEnTeteAuxSettings(base, { prereglageNationalId: null, republique: null, deviseNationale: null, ministere: null, sigleMinistere: null, autoriteRegionale: null, piedDePage: null });
    assert.equal(inchange.countryName, base.countryName);
    assert.equal(ministryMark(inchange), '(MEPST)', 'sans sigle enregistré, le sigle est déduit du nom');
  });

  it('retrouve le préréglage sélectionné par identifiant puis par république', () => {
    const liste = PREREGLAGES_DEMONSTRATION.map((item, index) => ({ ...item, id: index + 10 }));
    assert.equal(prereglageCourant({ ...base, prereglageNationalId: 11 }, liste)?.code, 'CI');
    assert.equal(prereglageCourant(base, liste)?.code, 'TG');
    assert.equal(prereglageCourant({ ...base, countryName: 'RÉPUBLIQUE DU MALI' }, liste), null);
  });
});
