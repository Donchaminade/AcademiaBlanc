import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  TITRE_CHEF_NEUTRE,
  TITRE_DIRECTEUR,
  TITRE_PROVISEUR,
  categorieEtablissement,
  sansArticle,
  titreChefDepuisSettings,
  titreChefEtablissement,
} from './titreChef';

describe('titreChefEtablissement', () => {
  it('une classe de collège (3e) est dirigée par un Directeur', () => {
    assert.equal(titreChefEtablissement({ niveau: '3e' }), TITRE_DIRECTEUR);
    assert.equal(titreChefEtablissement({ niveau: 'Troisième' }), TITRE_DIRECTEUR);
    assert.equal(titreChefEtablissement({ niveau: '6e' }), TITRE_DIRECTEUR);
  });

  it('une classe de lycée (Tle D) est dirigée par un Proviseur', () => {
    assert.equal(titreChefEtablissement({ niveau: 'Tle' }), TITRE_PROVISEUR);
    assert.equal(titreChefEtablissement({ niveau: 'Terminale' }), TITRE_PROVISEUR);
    assert.equal(titreChefEtablissement({ niveau: '2nde' }), TITRE_PROVISEUR);
  });

  it('la surcharge du profil prime sur tout le reste', () => {
    assert.equal(titreChefEtablissement({ niveau: '3e', surcharge: 'La Directrice' }), 'La Directrice');
    assert.equal(titreChefEtablissement({ niveau: 'Tle', typeEtablissement: 'Lycée', surcharge: '  Le Principal ' }), 'Le Principal');
    assert.equal(titreChefEtablissement({ niveau: '3e', surcharge: '   ' }), TITRE_DIRECTEUR, 'une surcharge blanche vaut automatique');
  });

  it('un établissement de type collège n’affiche jamais Proviseur, un lycée jamais Directeur', () => {
    assert.equal(titreChefEtablissement({ niveau: 'Tle', typeEtablissement: 'Collège d’enseignement général' }), TITRE_DIRECTEUR);
    assert.equal(titreChefEtablissement({ niveau: '3e', typeEtablissement: 'Lycée public' }), TITRE_PROVISEUR);
    assert.equal(titreChefEtablissement({ niveaux: ['3e', 'Tle'], typeEtablissement: 'CEG de Kara' }), TITRE_DIRECTEUR,
      'session mixte dans un collège : Directeur');
    assert.equal(titreChefEtablissement({ niveaux: ['3e', 'Tle'], typeEtablissement: 'Lycée moderne' }), TITRE_PROVISEUR);
  });

  it('un complexe scolaire suit le niveau de la classe', () => {
    assert.equal(titreChefEtablissement({ niveau: '4e', typeEtablissement: 'Complexe scolaire privé' }), TITRE_DIRECTEUR);
    assert.equal(titreChefEtablissement({ niveau: '1ère', typeEtablissement: 'Complexe scolaire privé' }), TITRE_PROVISEUR);
    assert.equal(titreChefEtablissement({ niveau: 'Tle', typeEtablissement: 'Collège-Lycée Saint-Joseph' }), TITRE_PROVISEUR);
  });

  it('une session homogène donne le titre de son cycle, une session mixte retombe sur l’établissement', () => {
    assert.equal(titreChefEtablissement({ niveaux: ['3e', '4e', '', undefined] }), TITRE_DIRECTEUR);
    assert.equal(titreChefEtablissement({ niveaux: ['Tle', '1ère'] }), TITRE_PROVISEUR);
    assert.equal(titreChefEtablissement({ niveaux: ['3e', 'Tle'], typeEtablissement: 'Complexe scolaire' }), TITRE_CHEF_NEUTRE);
    assert.equal(titreChefEtablissement({ niveaux: ['3e', 'Tle'], nomEtablissement: 'Collège Protestant de Lomé' }), TITRE_DIRECTEUR,
      'sans type, le nom de l’établissement tranche');
    assert.equal(titreChefEtablissement({ niveaux: ['3e', 'Tle'], nomEtablissement: 'Lycée Moderne de Tokoin' }), TITRE_PROVISEUR);
  });

  it('sans aucune information, le titre reste neutre', () => {
    assert.equal(titreChefEtablissement(), TITRE_CHEF_NEUTRE);
    assert.equal(titreChefEtablissement({ niveaux: [], typeEtablissement: 'Établissement confessionnel', nomEtablissement: 'AcademiaBlanc' }), TITRE_CHEF_NEUTRE);
  });
});

describe('categorieEtablissement', () => {
  it('lit collège, CEG, lycée et complexe dans un texte libre, accents et casse compris', () => {
    assert.equal(categorieEtablissement('COLLEGE PROTESTANT'), 'COLLEGE');
    assert.equal(categorieEtablissement('CEG Agoè-Nyivé'), 'COLLEGE');
    assert.equal(categorieEtablissement('Lycée public d’enseignement général'), 'LYCEE');
    assert.equal(categorieEtablissement('Complexe scolaire Les Lauriers'), 'MIXTE');
    assert.equal(categorieEtablissement('Groupe scolaire'), 'MIXTE');
    assert.equal(categorieEtablissement('Collège et Lycée Moderne'), 'MIXTE');
    assert.equal(categorieEtablissement('Établissement confessionnel'), null);
    assert.equal(categorieEtablissement(''), null);
    assert.equal(categorieEtablissement(null), null);
  });
});

describe('titreChefDepuisSettings', () => {
  const settings = { jurySignerTitle: '', typeEtablissement: '', institutionName: 'AcademiaBlanc' };

  it('déduit le titre des candidats concernés', () => {
    assert.equal(titreChefDepuisSettings(settings, [{ niveau: '3e' }]), TITRE_DIRECTEUR);
    assert.equal(titreChefDepuisSettings(settings, [{ niveau: 'Tle' }]), TITRE_PROVISEUR);
    assert.equal(titreChefDepuisSettings({ ...settings, typeEtablissement: 'Collège privé' }, [{ niveau: 'Tle' }]), TITRE_DIRECTEUR);
    assert.equal(titreChefDepuisSettings({ ...settings, jurySignerTitle: 'La Proviseure' }, [{ niveau: '3e' }]), 'La Proviseure');
  });
});

describe('sansArticle', () => {
  it('retire l’article du titre', () => {
    assert.equal(sansArticle('Le Directeur'), 'Directeur');
    assert.equal(sansArticle('La Directrice'), 'Directrice');
    assert.equal(sansArticle("L'Administrateur"), 'Administrateur');
    assert.equal(sansArticle('Proviseur'), 'Proviseur');
  });
});
