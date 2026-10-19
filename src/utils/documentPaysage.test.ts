import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { composerEnTeteDocument, dateEditionDocument } from './documentPaysage';

const settings = {
  institutionName: 'CS Harmonia',
  institutionMotto: 'Travail – Discipline – Réussite',
  logoUrl: 'data:image/png;base64,AAAA',
  countryName: 'République Togolaise',
  motto: 'Travail – Liberté – Patrie',
  ministryName: "Ministère des Enseignements Primaire, Secondaire et Technique",
  ministrySigle: '',
  regionalAuthority: 'Direction Régionale de l’Éducation — Golfe-Lomé',
  academicYear: '2026-2027',
};

describe('composerEnTeteDocument', () => {
  it('reprend logo, nom, devise, république et ministère de l’établissement en session interne', () => {
    const entete = composerEnTeteDocument({
      titre: 'Liste des candidats',
      settings,
      typeExamen: 'BEPC blanc',
      sessionNom: 'Examen blanc',
    });
    assert.equal(entete.logoUrl, settings.logoUrl);
    assert.equal(entete.nomEtablissement, 'CS HARMONIA');
    assert.equal(entete.devise, 'Travail – Discipline – Réussite');
    assert.equal(entete.republique, 'RÉPUBLIQUE TOGOLAISE');
    assert.equal(entete.deviseNationale, 'Travail – Liberté – Patrie');
    assert.equal(entete.ministere, settings.ministryName.toLocaleUpperCase('fr-FR'));
    assert.equal(entete.sigleMinistere, '(MEPST)');
    assert.equal(entete.autoriteRegionale, settings.regionalAuthority);
    assert.equal(entete.titre, 'Liste des candidats');
    assert.equal(entete.sousTitre, 'BEPC BLANC — EXAMEN BLANC');
    assert.equal(entete.anneeScolaire, '2026-2027');
    assert.equal(entete.piedDePage, 'CS HARMONIA • Liste des candidats');
  });

  it('en inter-établissements : ni logo ni devise, « CENTRE D’EXAMEN : … » et pied au nom du centre', () => {
    const entete = composerEnTeteDocument({
      titre: "Feuille d'émargement",
      settings,
      sessionInter: true,
      centreExamen: 'Lycée Moderne de Tokoin',
      typeExamen: 'BAC II blanc',
      sessionNom: 'Session de mars',
      anneeScolaire: '2025-2026',
    });
    assert.equal(entete.logoUrl, null);
    assert.equal(entete.devise, '');
    assert.equal(entete.nomEtablissement, "CENTRE D'EXAMEN : LYCÉE MODERNE DE TOKOIN");
    assert.equal(entete.anneeScolaire, '2025-2026');
    assert.equal(entete.piedDePage, "LYCÉE MODERNE DE TOKOIN • Feuille d'émargement");
  });

  it('sans centre saisi, l’établissement lui-même est le centre d’examen', () => {
    const entete = composerEnTeteDocument({ titre: 'Liste des candidats', settings, sessionInter: true });
    assert.equal(entete.nomEtablissement, "CENTRE D'EXAMEN : CS HARMONIA");
  });

  it('omet simplement les champs vides (sigle explicite prioritaire, aucun texte inventé)', () => {
    const entete = composerEnTeteDocument({
      titre: 'Bilan des sessions d’examen',
      settings: { ...settings, logoUrl: '', institutionMotto: '', regionalAuthority: '', ministrySigle: 'MENA', academicYear: '' },
    });
    assert.equal(entete.logoUrl, null);
    assert.equal(entete.devise, '');
    assert.equal(entete.autoriteRegionale, '');
    assert.equal(entete.sigleMinistere, '(MENA)');
    assert.equal(entete.sousTitre, '');
    assert.equal(entete.anneeScolaire, '');
  });

  it('sans ministère, aucun sigle n’est déduit', () => {
    const entete = composerEnTeteDocument({ titre: 'X', settings: { ...settings, ministryName: '' } });
    assert.equal(entete.ministere, '');
    assert.equal(entete.sigleMinistere, '');
  });
});

describe('dateEditionDocument', () => {
  it('écrit la date en toutes lettres en français', () => {
    assert.equal(dateEditionDocument(new Date(2026, 9, 19)), '19 octobre 2026');
  });
});
