import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeCandidateStats } from '../data/mockData';
import { Candidate, Subject } from '../types';
import {
  csvListeCandidats,
  estSessionInter,
  etablissementOrigineAffiche,
  groupeDeClassement,
  libelleModeSession,
  libelleNiveauSerie,
  ligneCentreExamen,
  totauxParEtablissement,
  trierCandidatsListe,
  trierPalmares,
} from './sessionMode';

const candidat = (
  id: string,
  nom: string,
  classe: { id: string; nom: string; niveau: string; serie?: string },
  origine: string,
  notes: Record<string, number> = {},
): Candidate => ({
  id,
  tableNumber: Number(id),
  matricule: `M-${id}`,
  fullName: nom,
  dob: '01/01/2010',
  birthPlace: 'Lomé',
  originSchool: origine,
  gender: 'M',
  serie: classe.serie ? `Série ${classe.serie}` : '',
  niveau: classe.niveau,
  classeNom: classe.nom,
  classeId: classe.id,
  examCenter: '',
  examCenterName: '',
  parentPhone: '',
  parentEmail: '',
  grades: Object.fromEntries(Object.entries(notes).map(([k, v]) => [k, { score: v, appreciation: '' }])),
  generalObservation: '',
});

const troisiemeA = { id: '1', nom: '3e A', niveau: '3e' };
const troisiemeB = { id: '2', nom: '3e B', niveau: '3e' };
const tleD = { id: '3', nom: 'Tle D', niveau: 'Tle', serie: 'D' };
const tleA4 = { id: '4', nom: 'Tle A4', niveau: 'Tle', serie: 'A4' };

const subjects: Subject[] = [
  { id: 'math', name: 'Mathématiques', teacher: '', coef: 1 },
];

const ama = candidat('1', 'AKAKPO Ama', troisiemeA, 'CEG Agoè-Nyivé', { math: 12 });
const kossi = candidat('2', 'MENSAH Kossi', troisiemeB, 'Collège Protestant de Lomé', { math: 16 });
const afi = candidat('3', 'DOSSOU Afi', troisiemeB, '', { math: 8 });
const yao = candidat('4', 'ABALO Yao', tleD, 'Lycée de Kégué', { math: 15 });
const essi = candidat('5', 'ADJO Essi', tleA4, '', { math: 9 });
const tous = [ama, kossi, afi, yao, essi];

describe('mode de session', () => {
  it('reconnaît le mode inter-établissements et ses libellés', () => {
    assert.equal(estSessionInter('INTER_ETABLISSEMENTS'), true);
    assert.equal(estSessionInter('INTERNE'), false);
    assert.equal(estSessionInter(undefined), false);
    assert.equal(libelleModeSession('INTER_ETABLISSEMENTS'), 'Inter-établissements');
    assert.equal(libelleModeSession(null), 'Interne');
  });

  it("compose la ligne du centre d'examen et l'établissement d'origine affiché", () => {
    assert.equal(ligneCentreExamen('  Lycée Moderne   de Tokoin '), "CENTRE D'EXAMEN : LYCÉE MODERNE DE TOKOIN");
    assert.equal(ligneCentreExamen(''), '');
    assert.equal(etablissementOrigineAffiche(ama, 'Lycée Hôte'), 'CEG Agoè-Nyivé');
    assert.equal(etablissementOrigineAffiche(afi, 'Lycée Hôte'), 'Lycée Hôte', 'élève du centre : origine = centre');
  });

  it('libelle le niveau / la série : 3e au collège, Tle D au lycée', () => {
    assert.equal(libelleNiveauSerie(ama), '3e');
    assert.equal(libelleNiveauSerie(yao), 'Tle D');
    assert.equal(libelleNiveauSerie(candidat('9', 'X', { id: '9', nom: 'Troisième', niveau: 'Troisième', serie: 'D' }, '')), '3e');
  });
});

describe('classement inter-établissements', () => {
  it('regroupe les candidats par niveau / série, toutes classes confondues', () => {
    assert.deepEqual(groupeDeClassement(ama, tous, true).map((c) => c.id), ['1', '2', '3']);
    assert.deepEqual(groupeDeClassement(yao, tous, true).map((c) => c.id), ['4']);
    assert.deepEqual(groupeDeClassement(ama, tous, false).map((c) => c.id), ['1', '2', '3', '4', '5']);
  });

  it('calcule le rang de session par niveau en inter, sur toute la session en interne', () => {
    const inter = computeCandidateStats(ama, subjects, tous, { inter: true });
    assert.equal(inter.rank, 2, 'Kossi 16 (3e B) devance Ama 12 (3e A) : les classes sont confondues');
    assert.equal(inter.totalCandidates, 3);
    assert.equal(inter.classHighestAverage, 16);
    assert.equal(inter.classLowestAverage, 8);
    assert.equal(computeCandidateStats(essi, subjects, tous, { inter: true }).rank, 1, 'seule Tle A4 de la session');

    const interne = computeCandidateStats(ama, subjects, tous);
    assert.equal(interne.rank, 3, 'interne : Kossi 16, Yao 15, Ama 12 sur toute la session');
    assert.equal(interne.totalCandidates, 5);
    assert.equal(interne.classHighestAverage, 12, 'interne : extrêmes de la seule 3e A');
  });

  it('trie le palmarès inter par niveau / série puis moyenne, et le palmarès interne par moyenne seule', () => {
    const stats = Object.fromEntries(tous.map((c) => [c.id, computeCandidateStats(c, subjects, tous, { inter: true })]));
    assert.deepEqual(trierPalmares(tous, stats, true).map((c) => c.fullName),
      ['MENSAH Kossi', 'AKAKPO Ama', 'DOSSOU Afi', 'ADJO Essi', 'ABALO Yao']);
    assert.deepEqual(trierPalmares(tous, stats, false).map((c) => c.fullName),
      ['MENSAH Kossi', 'ABALO Yao', 'AKAKPO Ama', 'ADJO Essi', 'DOSSOU Afi']);
  });

  it("totalise effectif, admis et taux par établissement d'origine", () => {
    const stats = Object.fromEntries(tous.map((c) => [c.id, computeCandidateStats(c, subjects, tous, { inter: true })]));
    const totaux = totauxParEtablissement(tous, stats, 'Lycée Hôte');
    assert.deepEqual(totaux.map((t) => [t.etablissement, t.effectif, t.admis, t.taux]), [
      ['CEG Agoè-Nyivé', 1, 1, 100],
      ['Collège Protestant de Lomé', 1, 1, 100],
      ['Lycée de Kégué', 1, 1, 100],
      ['Lycée Hôte', 2, 0, 0],
    ]);
  });
});

describe('liste des candidats', () => {
  it('trie par classe puis nom et prénoms', () => {
    assert.deepEqual(trierCandidatsListe(tous).map((c) => c.fullName),
      ['AKAKPO Ama', 'DOSSOU Afi', 'MENSAH Kossi', 'ADJO Essi', 'ABALO Yao']);
  });

  it('exporte un CSV dans le même ordre, avec origine et classe', () => {
    const lignes = csvListeCandidats([kossi, ama], 'Lycée Hôte').split('\n');
    assert.equal(lignes[0].replace('\uFEFF', ''), "N° table;Nom et prénoms;Genre;Date de naissance;Lieu de naissance;Classe / série;Établissement d'origine;Matricule");
    assert.equal(lignes[1], '"1";"AKAKPO Ama";"M";"01/01/2010";"Lomé";"3e";"CEG Agoè-Nyivé";"M-1"');
    assert.equal(lignes[2], '"2";"MENSAH Kossi";"M";"01/01/2010";"Lomé";"3e";"Collège Protestant de Lomé";"M-2"');
  });
});
