import React from 'react';
import { PLATEFORME_CONTACT as C, CHEMINS_LEGAUX } from '../config';
import { H3, Note, P, Ul } from '../../components/legal/PageLegale';
import type { SectionLegale } from '../../components/legal/PageLegale';

// Texte rédigé pour une plateforme SaaS de gestion d'examens blancs traitant des données d'élèves mineurs
// pour des établissements scolaires d'Afrique francophone (Togo, Côte d'Ivoire). Il ne constitue pas un
// avis juridique : À FAIRE VALIDER PAR UN CONSEIL JURIDIQUE avant publication, et compléter les
// coordonnées de l'éditeur dans src/legal/config.ts (raison sociale, adresse, juridiction).

export const TITRE_CGU = 'Conditions générales d’utilisation';
export const CHAPEAU_CGU =
  `Les présentes conditions générales encadrent l’accès au service ${C.nomService} et son utilisation par les établissements scolaires qui y créent un compte. Elles sont acceptées par le responsable de l’établissement lors de l’inscription.`;
export const DESCRIPTION_CGU =
  'Conditions générales d’utilisation d’AcademiaBlanc : inscription, abonnement, obligations de l’établissement et de la plateforme, données des élèves, résiliation et litiges.';

export const SECTIONS_CGU: SectionLegale[] = [
  {
    id: 'objet',
    titre: 'Objet',
    contenu: (
      <>
        <P>
          {C.nomService} (ci-après « la Plateforme ») est un service en ligne édité par {C.raisonSociale} (ci-après
          « l’Éditeur »). Il permet à un établissement scolaire d’organiser ses examens blancs et compositions :
          enregistrement des candidats, saisie des notes, calcul des moyennes et des rangs, délibération, édition des
          relevés, bulletins, listes de candidats et procès-verbaux, seul ou en commun avec d’autres établissements.
        </P>
        <P>
          Les présentes conditions générales d’utilisation (« CGU ») définissent les droits et obligations de l’Éditeur
          et de l’Établissement. Elles forment un ensemble avec les{' '}
          <a href={CHEMINS_LEGAUX.conditions} className="font-semibold text-[#0051d5] underline-offset-2 hover:underline">Conditions d’utilisation</a>{' '}
          (charte d’usage) et la{' '}
          <a href={CHEMINS_LEGAUX.confidentialite} className="font-semibold text-[#0051d5] underline-offset-2 hover:underline">Politique de confidentialité</a>.
          En cas de contradiction, les CGU prévalent sur la charte d’usage ; la Politique de confidentialité prévaut
          pour tout ce qui concerne les données à caractère personnel.
        </P>
      </>
    ),
  },
  {
    id: 'definitions',
    titre: 'Définitions',
    contenu: (
      <Ul>
        <li><strong>Plateforme</strong> : le service {C.nomService}, son application web, son interface de programmation et ses serveurs.</li>
        <li><strong>Éditeur</strong> : {C.raisonSociale}, qui exploite la Plateforme.</li>
        <li><strong>Établissement</strong> : l’école, le collège, le lycée ou le complexe scolaire, public ou privé, titulaire d’un compte sur la Plateforme et représenté par son responsable.</li>
        <li><strong>Responsable d’établissement</strong> : la personne physique (directeur, proviseur, fondateur ou mandataire) qui crée le compte de l’Établissement, accepte les présentes CGU en son nom et détient le rôle de propriétaire du compte.</li>
        <li><strong>Utilisateur</strong> : toute personne disposant d’identifiants pour accéder à l’espace de l’Établissement (responsable, administrateur, secrétariat, enseignant).</li>
        <li><strong>Données élèves</strong> : les informations relatives aux élèves et candidats enregistrées par l’Établissement : identité, date et lieu de naissance, genre, classe, matricule, numéro de table, notes, moyennes, rangs, appréciations et décisions du jury.</li>
        <li><strong>Espace</strong> : l’ensemble des données d’un Établissement, cloisonné des autres Établissements.</li>
        <li><strong>Documents légaux</strong> : les présentes CGU, les Conditions d’utilisation et la Politique de confidentialité, identifiées par une version datée.</li>
      </Ul>
    ),
  },
  {
    id: 'inscription',
    titre: 'Inscription et compte',
    contenu: (
      <>
        <H3>Création du compte</H3>
        <P>
          Le compte de l’Établissement est créé par son responsable, qui déclare disposer du pouvoir d’engager
          l’Établissement. L’inscription requiert l’acceptation expresse des Documents légaux ; la date, l’heure (UTC),
          la version acceptée et des éléments techniques de connexion sont conservés à titre de preuve.
        </P>
        <H3>Exactitude des informations</H3>
        <P>
          L’Établissement s’engage à fournir des informations exactes et à jour (dénomination, localisation, nom du
          responsable, coordonnées de contact) et à les corriger depuis son profil dès qu’elles changent. L’Éditeur
          peut demander un justificatif d’existence de l’Établissement et suspendre un compte dont les informations
          se révèlent manifestement fausses.
        </P>
        <H3>Identifiants et comptes des utilisateurs</H3>
        <P>
          Les identifiants sont personnels et confidentiels. Le responsable crée les comptes des autres utilisateurs
          et leur attribue des droits adaptés à leurs fonctions ; il désactive sans délai les comptes des personnes
          qui quittent l’Établissement. Toute action réalisée depuis un compte est réputée effectuée par son
          titulaire. L’Établissement informe l’Éditeur de toute utilisation non autorisée dont il a connaissance.
        </P>
      </>
    ),
  },
  {
    id: 'abonnement',
    titre: 'Abonnement et paiement',
    contenu: (
      <>
        <P>
          L’accès à la Plateforme est proposé sous forme d’abonnement, selon des forfaits mensuels ou annuels dont les
          caractéristiques et les tarifs en vigueur sont présentés sur le site ou communiqués à l’Établissement avant
          toute souscription. Les présentes CGU ne fixent aucun montant : les tarifs peuvent évoluer, sans effet sur
          la période déjà réglée.
        </P>
        <Ul>
          <li><strong>Période d’essai</strong> : lorsqu’elle est proposée, elle donne accès au service pour une durée limitée, sans engagement. À son terme, l’accès passe en lecture seule tant qu’aucun forfait n’est activé.</li>
          <li><strong>Paiement</strong> : le règlement s’effectue par les moyens indiqués par l’Éditeur, notamment par paiement mobile (mobile money) ou virement. Il peut donner lieu à une activation manuelle du forfait par l’Éditeur après vérification du règlement, dans un délai raisonnable.</li>
          <li><strong>Renouvellement</strong> : le forfait court pour la durée souscrite. À son expiration et à défaut de renouvellement, l’Espace est suspendu en <strong>lecture seule</strong> : les données restent consultables et exportables, mais aucune saisie ni édition de nouveaux documents n’est possible jusqu’à régularisation.</li>
          <li><strong>Justificatifs</strong> : l’Éditeur fournit sur demande un reçu ou une facture pour chaque règlement.</li>
        </Ul>
        <Note>
          Un retard de paiement n’entraîne jamais la suppression immédiate des données : les règles de conservation et
          d’effacement après résiliation sont décrites à la section « Durée, résiliation et sort des données ».
        </Note>
      </>
    ),
  },
  {
    id: 'obligations-etablissement',
    titre: 'Obligations de l’établissement',
    contenu: (
      <>
        <P>
          L’Établissement est responsable du traitement des Données élèves qu’il enregistre sur la Plateforme. À ce
          titre, il s’engage à :
        </P>
        <Ul>
          <li>disposer d’une <strong>base légale</strong> pour traiter les données de ses élèves (mission d’enseignement et d’évaluation, obligation réglementaire, ou tout autre fondement reconnu par la loi applicable à l’Établissement) ;</li>
          <li><strong>informer les parents</strong> ou représentants légaux, ainsi que les élèves en âge de comprendre, de l’utilisation d’un service en ligne pour la gestion des évaluations, des catégories de données concernées et de leurs droits ;</li>
          <li>n’enregistrer que les données nécessaires aux finalités du service, et les tenir exactes ;</li>
          <li>utiliser la Plateforme conformément aux Documents légaux, aux lois applicables (notamment la législation sur la protection des données à caractère personnel en vigueur dans son pays) et aux règles de l’administration scolaire dont il relève ;</li>
          <li>répondre aux demandes d’exercice de droits des personnes concernées, avec l’aide de l’Éditeur lorsque c’est nécessaire ;</li>
          <li>vérifier les documents produits (relevés, bulletins, procès-verbaux) avant leur diffusion ou leur signature : la Plateforme est un outil d’aide, les décisions pédagogiques et administratives restent celles de l’Établissement.</li>
        </Ul>
      </>
    ),
  },
  {
    id: 'obligations-plateforme',
    titre: 'Obligations de la plateforme',
    contenu: (
      <>
        <P>L’Éditeur s’engage, dans le cadre d’une obligation de moyens, à :</P>
        <Ul>
          <li>assurer une <strong>disponibilité raisonnable</strong> du service, les interruptions pour maintenance planifiée étant, dans la mesure du possible, annoncées à l’avance et réalisées en dehors des périodes d’examens signalées par les Établissements ;</li>
          <li>réaliser des <strong>sauvegardes</strong> régulières des données et pouvoir restaurer le service en cas d’incident ;</li>
          <li>mettre en œuvre des mesures de <strong>sécurité</strong> adaptées : chiffrement des échanges, mots de passe hachés, cloisonnement strict des Espaces, journalisation des accès, décrites dans la Politique de confidentialité ;</li>
          <li>ne traiter les Données élèves que sur instruction de l’Établissement et pour fournir le service, sans jamais les exploiter à des fins commerciales ni les céder à des tiers ;</li>
          <li>informer l’Établissement, dans les meilleurs délais, de toute violation de données susceptible de concerner son Espace ;</li>
          <li>permettre à tout moment l’export des données de l’Établissement dans un format lisible.</li>
        </Ul>
      </>
    ),
  },
  {
    id: 'propriete-intellectuelle',
    titre: 'Propriété intellectuelle',
    contenu: (
      <>
        <P>
          La Plateforme, sa structure, son interface, ses textes, ses modèles de documents et son code sont la
          propriété de l’Éditeur ou de ses concédants et sont protégés par le droit de la propriété intellectuelle.
          L’abonnement confère à l’Établissement un droit d’utilisation personnel, non exclusif et non cessible, limité
          à la durée de l’abonnement et aux finalités du service.
        </P>
        <P>
          Les Données élèves, les logos, cachets, signatures et autres éléments de charte déposés par l’Établissement
          restent sa propriété exclusive. L’Établissement accorde à l’Éditeur le seul droit d’héberger, de reproduire
          et d’afficher ces éléments dans la mesure nécessaire à la fourniture du service.
        </P>
      </>
    ),
  },
  {
    id: 'responsabilite',
    titre: 'Responsabilité et limites',
    contenu: (
      <>
        <P>
          L’Éditeur ne saurait être tenu responsable des dommages résultant d’une utilisation non conforme de la
          Plateforme, d’une erreur de saisie, d’une négligence dans la garde des identifiants, d’une défaillance du
          réseau ou de l’équipement de l’Établissement, ni d’un cas de force majeure. Les moyennes, rangs, mentions et
          décisions calculés par la Plateforme sont des propositions fondées sur les paramètres choisis par
          l’Établissement, qui demeure seul responsable de leur vérification et de leur validation.
        </P>
        <P>
          Dans toute la mesure permise par la loi, la responsabilité de l’Éditeur, toutes causes confondues, est
          limitée aux dommages directs et plafonnée au montant des sommes effectivement versées par l’Établissement au
          titre des douze derniers mois d’abonnement. Rien dans les présentes n’exclut la responsabilité de l’Éditeur
          pour faute lourde ou intentionnelle.
        </P>
      </>
    ),
  },
  {
    id: 'duree-resiliation',
    titre: 'Durée, résiliation et sort des données',
    contenu: (
      <>
        <P>
          Les CGU s’appliquent dès la création du compte et pendant toute la durée de son existence. L’Établissement
          peut résilier son compte à tout moment depuis son profil ou en écrivant à l’Éditeur ; la résiliation prend
          effet à la fin de la période d’abonnement en cours, sans remboursement de la période entamée sauf disposition
          légale contraire.
        </P>
        <P>
          L’Éditeur peut suspendre puis résilier un compte en cas de manquement grave ou répété aux Documents légaux
          (notamment usage détourné des Données élèves, atteinte à la sécurité, impayé persistant après relance), après
          mise en demeure restée sans effet pendant quinze jours, sauf urgence justifiée par la sécurité des données.
        </P>
        <H3>Sort des données</H3>
        <Ul>
          <li>À la résiliation, l’Établissement dispose de <strong>90 jours</strong> pour <strong>exporter</strong> l’intégralité de ses données ; l’accès est maintenu en lecture seule pendant ce délai.</li>
          <li>À l’issue de ce délai, les données de l’Espace sont <strong>effacées</strong> des systèmes de production, puis des sauvegardes au fil de leur rotation, sauf obligation légale de conservation ou demande écrite de l’Établissement d’un effacement anticipé.</li>
          <li>Les preuves d’acceptation des Documents légaux et les données de facturation sont conservées le temps nécessaire à la défense des droits de l’Éditeur et au respect de ses obligations comptables.</li>
        </Ul>
      </>
    ),
  },
  {
    id: 'modifications',
    titre: 'Modifications des CGU',
    contenu: (
      <>
        <P>
          L’Éditeur peut faire évoluer les Documents légaux, notamment pour tenir compte d’une évolution du service,
          de la réglementation ou d’une décision d’une autorité de protection des données. Chaque version porte une
          date ; la version en vigueur et sa date de dernière mise à jour figurent en tête de chaque document.
        </P>
        <P>
          Toute modification substantielle est <strong>notifiée</strong> à l’Établissement, au moins par un message
          présenté à la connexion du responsable et des administrateurs. La poursuite de l’utilisation suppose
          l’<strong>acceptation</strong> de la nouvelle version, enregistrée avec sa date et son horodatage. Un
          Établissement qui refuse la nouvelle version peut résilier son compte dans les conditions ci-dessus et
          exporter ses données.
        </P>
      </>
    ),
  },
  {
    id: 'droit-applicable',
    titre: 'Droit applicable et règlement des litiges',
    contenu: (
      <>
        <P>
          Les présentes CGU sont régies par le {C.droitApplicable}. Les lois relatives à la protection des données à
          caractère personnel du pays de l’Établissement — notamment, au Togo, la loi n° 2019-014 du 29 octobre 2019
          relative à la protection des données à caractère personnel, et, en Côte d’Ivoire, la loi n° 2013-450 du
          19 juin 2013 — s’appliquent aux traitements qu’il met en œuvre, sans préjudice des dispositions impératives
          qui le protègent.
        </P>
        <P>
          En cas de différend, les parties recherchent d’abord une solution amiable : toute réclamation est adressée
          par écrit à l’Éditeur, qui y répond dans un délai de trente jours. À défaut d’accord, elles conviennent de
          recourir à une <strong>médiation</strong> avant toute action contentieuse. Si la médiation n’aboutit pas,
          le litige est porté devant les tribunaux compétents de <strong>{C.juridiction}</strong>, sauf règle
          impérative attribuant compétence à une autre juridiction, en particulier pour un Établissement situé dans un
          autre pays.
        </P>
      </>
    ),
  },
  {
    id: 'contact',
    titre: 'Contact',
    contenu: (
      <>
        <P>Pour toute question relative aux présentes CGU, à l’abonnement ou au compte de l’Établissement :</P>
        <Ul>
          <li>{C.raisonSociale}</li>
          <li>{C.adresse}</li>
          <li>Email : <a href={`mailto:${C.email}`} className="font-semibold text-[#0051d5] underline-offset-2 hover:underline">{C.email}</a></li>
        </Ul>
      </>
    ),
  },
];
