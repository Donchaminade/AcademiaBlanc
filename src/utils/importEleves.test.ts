import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filtrerRoster } from '../api/workspace';
import { messageResultatImport, parseLignesImport } from './importEleves';

const LISTE_3E = `ADOUGBA Komlan Bruno;M;05/10/2010;LOME
ATTIKOUFIO Estelle;F;09/05/2012;Lomé
AWESSO Adeline Essorezime;F;03/03/2012;TSEVIE
BAH-TRAORE Hikmat;F;12/06/2012;Lomé
BATOKI Essodolom Majoie;M;31/12/2012;TOKOIN
KARMA Biguediname Simonne;M;03/06/2011;KARA
KEZIE Essossohim Pascal;M;23/03/2010;Lomé
KOUASSI Iman Natacha;F;03/08/2013;HAHO
MIZOU Kinangba Roland;M;31/12/2014;TSEVIE
TCHALLA Emmanuella;F;31/12/2012;Dzové
WOBOTI Nadjat;M;07/11/2012;Lomé`;

describe('parseLignesImport', () => {
  it('transforme la liste de 3e en 11 lignes prêtes pour POST /api/eleves/import', () => {
    const { lignes, erreur } = parseLignesImport(LISTE_3E);
    assert.equal(erreur, undefined);
    assert.equal(lignes.length, 11);
    assert.deepEqual(lignes[0], { nomComplet: 'ADOUGBA Komlan Bruno', genre: 'M', dateNaissance: '05/10/2010', lieuNaissance: 'LOME' });
    assert.deepEqual(lignes[9], { nomComplet: 'TCHALLA Emmanuella', genre: 'F', dateNaissance: '31/12/2012', lieuNaissance: 'Dzové' });
    assert.equal(lignes.filter((l) => l.genre === 'F').length, 5);
  });

  it('ignore les lignes vides, normalise le genre et accepte date et lieu absents', () => {
    const { lignes, erreur } = parseLignesImport('\n  KOFFI Ama ; f \r\n\nAYI Koku;M;;\n');
    assert.equal(erreur, undefined);
    assert.deepEqual(lignes, [
      { nomComplet: 'KOFFI Ama', genre: 'F', dateNaissance: undefined, lieuNaissance: undefined },
      { nomComplet: 'AYI Koku', genre: 'M', dateNaissance: undefined, lieuNaissance: undefined },
    ]);
  });

  it('accepte une liste collée depuis un tableur (tabulations) ou séparée par des virgules', () => {
    assert.deepEqual(parseLignesImport('KOFFI Ama\tF\t01/01/2010\tLomé').lignes[0],
      { nomComplet: 'KOFFI Ama', genre: 'F', dateNaissance: '01/01/2010', lieuNaissance: 'Lomé' });
    assert.deepEqual(parseLignesImport('KOFFI Ama, F, 01/01/2010, Lomé').lignes[0],
      { nomComplet: 'KOFFI Ama', genre: 'F', dateNaissance: '01/01/2010', lieuNaissance: 'Lomé' });
  });

  it('lit la 5e colonne « Établissement d’origine » (session inter-établissements) quand elle est présente', () => {
    const { lignes, erreur } = parseLignesImport('KOFFI Ama;F;01/01/2010;Lomé;CEG Agoè-Nyivé\nAYI Koku;M;;;\nDOE Jane\tF\t\t\tCollège Saint-Joseph');
    assert.equal(erreur, undefined);
    assert.deepEqual(lignes, [
      { nomComplet: 'KOFFI Ama', genre: 'F', dateNaissance: '01/01/2010', lieuNaissance: 'Lomé', etablissementOrigine: 'CEG Agoè-Nyivé' },
      { nomComplet: 'AYI Koku', genre: 'M', dateNaissance: undefined, lieuNaissance: undefined },
      { nomComplet: 'DOE Jane', genre: 'F', dateNaissance: undefined, lieuNaissance: undefined, etablissementOrigine: 'Collège Saint-Joseph' },
    ]);
  });

  it('signale la ligne fautive : genre invalide, nom vide, texte vide', () => {
    assert.match(parseLignesImport('KOFFI Ama;X').erreur ?? '', /Ligne 1 \(KOFFI Ama\) : le genre doit être M ou F/);
    assert.match(parseLignesImport('KOFFI Ama;F\n;M').erreur ?? '', /Ligne 2 : le nom est vide/);
    assert.match(parseLignesImport('   \n').erreur ?? '', /Collez au moins une ligne/);
  });
});

describe('messageResultatImport', () => {
  it('annonce le nombre d’élèves enregistrés en base et les ignorés', () => {
    assert.equal(
      messageResultatImport({ crees: 11, ignores: 0, total: 11, classesCreees: ['3e'], lignesIgnorees: [] }),
      '11 élèves enregistrés dans la base de l’établissement, 0 ignoré. Classe créée : 3e.',
    );
    assert.equal(
      messageResultatImport({ crees: 1, ignores: 2, total: 3, classesCreees: [], lignesIgnorees: [] }),
      '1 élève enregistré dans la base de l’établissement, 2 ignorés.',
    );
  });
});

describe('filtrerRoster', () => {
  const eleves = [
    { id: 1, sessionId: null },
    { id: 2, sessionId: 10 },
    { id: 3, sessionId: 20 },
    { id: 4 },
  ];

  it('garde les élèves de la session active et ceux sans session', () => {
    assert.deepEqual(filtrerRoster(eleves, 10).map((e) => e.id), [1, 2, 4]);
  });

  it('ne cache aucun élève enregistré sans session active ou avec « toutes les sessions »', () => {
    assert.deepEqual(filtrerRoster(eleves, null).map((e) => e.id), [1, 2, 3, 4]);
    assert.deepEqual(filtrerRoster(eleves, 10, { toutesSessions: true }).map((e) => e.id), [1, 2, 3, 4]);
  });
});
