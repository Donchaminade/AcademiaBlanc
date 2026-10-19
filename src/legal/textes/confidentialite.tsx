import React from 'react';
import { PLATEFORME_CONTACT as C, CHEMINS_LEGAUX } from '../config';
import { H3, Note, P, Ul } from '../../components/legal/PageLegale';
import type { SectionLegale } from '../../components/legal/PageLegale';

// Politique rédigée pour un sous-traitant SaaS hébergeant des données d'élèves mineurs pour des établissements
// du Togo et de Côte d'Ivoire (loi togolaise n° 2019-014 / IPDCP, loi ivoirienne n° 2013-450 / ARTCI, principes
// du RGPD à titre de bonnes pratiques). Pas un avis juridique : À FAIRE VALIDER PAR UN CONSEIL JURIDIQUE,
// notamment les durées de conservation, les transferts hors du pays et les coordonnées (src/legal/config.ts).

export const TITRE_CONFIDENTIALITE = 'Politique de confidentialité';
export const CHAPEAU_CONFIDENTIALITE =
  `Cette politique décrit les données à caractère personnel traitées par ${C.nomService}, pourquoi et combien de temps elles le sont, qui y accède, comment elles sont protégées et quels droits les personnes concernées — notamment les élèves et leurs parents — peuvent exercer.`;
export const DESCRIPTION_CONFIDENTIALITE =
  'Politique de confidentialité d’AcademiaBlanc : données des élèves et des établissements, finalités, durées de conservation, hébergement, sécurité, droits d’accès, de rectification et d’effacement.';

const Lien: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => (
  <a href={href} className="font-semibold text-[#0051d5] underline-offset-2 hover:underline">{children}</a>
);

export const SECTIONS_CONFIDENTIALITE: SectionLegale[] = [
  {
    id: 'roles',
    titre: 'Responsable de traitement et sous-traitant',
    contenu: (
      <>
        <P>
          Pour les <strong>données des élèves</strong> et des utilisateurs qu’il enregistre, l’<strong>Établissement</strong> est{' '}
          <strong>responsable de traitement</strong> : il décide des finalités (organiser ses évaluations) et des moyens
          (utiliser {C.nomService}). Il est tenu des obligations d’information des personnes et de réponse à leurs demandes.
        </P>
        <P>
          {C.raisonSociale} (« la Plateforme » ou « l’Éditeur ») agit comme <strong>sous-traitant</strong> : elle héberge
          et traite ces données uniquement sur instruction de l’Établissement, pour fournir le service, et s’interdit
          toute autre utilisation.
        </P>
        <P>
          La Plateforme est en revanche <strong>responsable de traitement</strong> pour les données nécessaires à la
          gestion de la relation avec l’Établissement : comptes des responsables, preuves d’acceptation des conditions,
          abonnement et facturation, journaux techniques de sécurité.
        </P>
      </>
    ),
  },
  {
    id: 'donnees',
    titre: 'Données collectées',
    contenu: (
      <>
        <H3>Comptes et utilisateurs</H3>
        <Ul>
          <li>nom, adresse email, rôle et droits dans l’Établissement, mot de passe (stocké uniquement sous forme hachée) ;</li>
          <li>preuve d’acceptation des documents légaux : version acceptée, date et heure (UTC), adresse IP et agent utilisateur du navigateur.</li>
        </Ul>
        <H3>Établissements</H3>
        <Ul>
          <li>dénomination, type, code, ville, région, adresse, téléphone, email de contact, nom et titre du chef d’établissement, devise ;</li>
          <li>images de charte : logo, sceau ou cachet, signatures numérisées ;</li>
          <li>paramètres pédagogiques : années scolaires, classes, séries, matières, coefficients, sessions, centres d’examen, enseignants et affectations.</li>
        </Ul>
        <H3>Élèves et candidats</H3>
        <Ul>
          <li>identité : nom et prénoms, matricule, numéro de table ;</li>
          <li>date et lieu de naissance, genre ;</li>
          <li>classe, série, établissement d’origine (examens inter-établissements) ;</li>
          <li>notes, absences, moyennes, rangs, mentions, appréciations des enseignants, observations et décisions du jury, signatures des bulletins.</li>
        </Ul>
        <H3>Journaux techniques</H3>
        <Ul>
          <li>horodatage des connexions et des actions sensibles, adresse IP, type de navigateur, erreurs applicatives — conservés pour la sécurité et le diagnostic.</li>
        </Ul>
        <Note>
          La Plateforme ne collecte ni photo d’élève, ni information de santé, ni donnée relative à la religion ou à
          l’origine ethnique, et ne demande aucune information qui ne serait pas nécessaire au service. L’Établissement
          s’engage à ne pas en saisir dans les champs libres (appréciations, observations).
        </Note>
      </>
    ),
  },
  {
    id: 'finalites',
    titre: 'Finalités',
    contenu: (
      <Ul>
        <li>organiser les examens blancs et compositions : enregistrement des candidats, saisie des notes, calcul des moyennes, rangs et décisions, délibération ;</li>
        <li>produire les documents de l’Établissement : relevés, bulletins, listes de candidats, feuilles d’émargement, procès-verbaux, bilans d’archives ;</li>
        <li>permettre les examens inter-établissements : classement commun au centre d’examen et transmission des résultats à l’établissement d’origine ;</li>
        <li>gérer les comptes, les droits des utilisateurs et la sécurité des accès ;</li>
        <li>gérer la relation contractuelle : inscription, acceptation des conditions, abonnement, facturation, assistance ;</li>
        <li>assurer la sécurité, la continuité et l’amélioration technique du service (statistiques d’usage agrégées, sans profilage individuel).</li>
      </Ul>
    ),
  },
  {
    id: 'bases-legales',
    titre: 'Bases légales',
    contenu: (
      <>
        <P>
          Les traitements mis en œuvre par l’Établissement sur les données des élèves reposent sur sa mission
          d’enseignement et d’évaluation et sur les obligations réglementaires qui en découlent, telles que définies par
          la législation de son pays. Il lui appartient d’en vérifier le fondement précis et d’en informer les familles.
        </P>
        <P>Les traitements mis en œuvre par la Plateforme pour son propre compte reposent sur :</P>
        <Ul>
          <li>l’<strong>exécution du contrat</strong> (gestion des comptes, abonnement, assistance) ;</li>
          <li>le respect d’<strong>obligations légales</strong> (comptabilité, conservation des preuves d’acceptation) ;</li>
          <li>son <strong>intérêt légitime</strong> à sécuriser le service et à prévenir les abus (journaux techniques), mis en balance avec les droits des personnes.</li>
        </Ul>
        <P>
          La Plateforme se réfère à la loi togolaise n° 2019-014 relative à la protection des données à caractère
          personnel et à son autorité, l’Instance de protection des données à caractère personnel (IPDCP) ; à la loi
          ivoirienne n° 2013-450 et à l’Autorité de régulation des télécommunications/TIC de Côte d’Ivoire (ARTCI) ;
          et, à titre de bonnes pratiques, aux principes du Règlement général sur la protection des données de l’Union
          européenne (minimisation, limitation des durées, sécurité, transparence).
        </P>
      </>
    ),
  },
  {
    id: 'conservation',
    titre: 'Durées de conservation',
    contenu: (
      <Ul>
        <li><strong>Données des élèves et documents</strong> : pendant la durée de l’abonnement de l’Établissement, qui peut à tout moment supprimer un élève, une session ou archiver une année. Les archives restent consultables tant que le compte existe.</li>
        <li><strong>Après résiliation</strong> : accès en lecture seule et export possibles pendant <strong>90 jours</strong>, puis effacement des systèmes de production et, au fil de leur rotation, des sauvegardes (au plus quelques semaines supplémentaires).</li>
        <li><strong>Comptes des utilisateurs</strong> : jusqu’à leur désactivation par l’Établissement, puis effacement avec l’Espace.</li>
        <li><strong>Preuves d’acceptation des conditions</strong> et <strong>données de facturation</strong> : durée de la relation puis délai de prescription applicable (au plus dix ans pour les pièces comptables).</li>
        <li><strong>Journaux techniques</strong> : douze mois au plus, sauf incident de sécurité en cours d’analyse.</li>
      </Ul>
    ),
  },
  {
    id: 'destinataires',
    titre: 'Destinataires et hébergement',
    contenu: (
      <>
        <P>
          Les données d’un Établissement ne sont accessibles qu’à ses propres utilisateurs, selon les droits que son
          responsable leur attribue. Le personnel de la Plateforme n’y accède qu’en cas de nécessité technique
          (assistance demandée par l’Établissement, résolution d’incident), de façon tracée. Les comptes
          d’administration de la plateforme voient la liste des Établissements et leurs informations de contact, non
          leurs données pédagogiques.
        </P>
        <P>
          Les données sont hébergées sur des <strong>serveurs cloud</strong> fournis par des prestataires
          d’hébergement professionnels, susceptibles d’être <strong>situés hors du pays de l’Établissement</strong>.
          Ces prestataires agissent en qualité de sous-traitants ultérieurs, liés par des <strong>garanties
          contractuelles</strong> de confidentialité et de sécurité ; ils n’ont aucun droit d’utiliser les données
          pour leur propre compte. La liste des prestataires et des pays d’hébergement est communiquée sur demande
          à l’adresse de contact ci-dessous. Lorsque la loi applicable à l’Établissement l’exige, celui-ci procède
          aux déclarations ou demandes d’autorisation de transfert nécessaires, avec l’aide de la Plateforme.
        </P>
        <P>
          Aucune donnée n’est vendue, louée ni transmise à des tiers à des fins publicitaires. Une communication à une
          autorité ne peut intervenir que sur réquisition légale, l’Établissement en étant informé sauf interdiction.
        </P>
      </>
    ),
  },
  {
    id: 'transferts-etablissements',
    titre: 'Transferts entre établissements',
    contenu: (
      <>
        <P>
          Lors d’un examen blanc inter-établissements, l’établissement hôte (centre d’examen) enregistre des candidats
          venus d’autres établissements. Les résultats de ces candidats ne sont transmis à leur établissement
          d’origine qu’à l’<strong>initiative du centre d’examen</strong>, au moyen d’un <strong>code de transfert</strong>{' '}
          communiqué par ce dernier, et uniquement pour les élèves rattachés à l’établissement destinataire.
        </P>
        <P>
          Aucun Établissement ne peut consulter l’Espace d’un autre ni rechercher un élève en dehors de son propre
          Espace. Les relevés remis par le centre d’examen aux établissements d’origine sont neutres (sans logo ni
          signature de l’hôte) et ne contiennent que les résultats du candidat concerné et du classement du centre.
        </P>
      </>
    ),
  },
  {
    id: 'securite',
    titre: 'Sécurité',
    contenu: (
      <Ul>
        <li><strong>Chiffrement en transit</strong> : toutes les communications entre le navigateur et les serveurs sont chiffrées (HTTPS/TLS).</li>
        <li><strong>Mots de passe hachés</strong> : les mots de passe sont stockés sous forme de condensats salés (bcrypt) et ne sont jamais lisibles, même par la Plateforme.</li>
        <li><strong>Cloisonnement par établissement</strong> : chaque requête est rattachée à l’Établissement du compte connecté ; une donnée d’un autre Établissement est introuvable, et non simplement masquée.</li>
        <li><strong>Droits fins</strong> : le responsable attribue à chaque utilisateur des droits par ressource et par action (voir, créer, modifier, supprimer, imprimer) ; les enseignants ne saisissent que les notes de leurs classes.</li>
        <li><strong>Journalisation</strong> : connexions et actions sensibles sont horodatées pour détecter et analyser les incidents.</li>
        <li><strong>Sauvegardes</strong> régulières et procédures de restauration ; mises à jour de sécurité des composants.</li>
        <li><strong>Sessions</strong> : jetons d’accès à durée limitée, invalidés à la déconnexion ; aucune donnée d’élève n’est conservée dans un cache du navigateur après déconnexion.</li>
      </Ul>
    ),
  },
  {
    id: 'droits',
    titre: 'Droits des personnes',
    contenu: (
      <>
        <P>
          Toute personne concernée — élève, parent ou représentant légal, utilisateur d’un Établissement — dispose,
          dans les conditions prévues par la loi applicable, des droits suivants :
        </P>
        <Ul>
          <li><strong>accès</strong> : obtenir la confirmation que des données la concernant sont traitées et en recevoir une copie ;</li>
          <li><strong>rectification</strong> : faire corriger des données inexactes ou incomplètes (identité, date de naissance, classe…) ;</li>
          <li><strong>effacement</strong> : obtenir la suppression de ses données lorsque leur conservation n’est plus nécessaire ou n’est plus fondée, sous réserve des obligations d’archivage de l’Établissement ;</li>
          <li><strong>opposition</strong> : s’opposer, pour des raisons tenant à sa situation particulière, à un traitement fondé sur l’intérêt légitime ;</li>
          <li><strong>limitation</strong> du traitement pendant la vérification d’une contestation ;</li>
          <li><strong>portabilité</strong> : recevoir les données fournies dans un format structuré et couramment utilisé.</li>
        </Ul>
        <H3>Comment les exercer</H3>
        <P>
          Pour les données des élèves, la demande est adressée en priorité à l’<strong>Établissement</strong>, qui en
          est responsable et dispose des outils pour y répondre (modification ou suppression d’un élève, export). Elle
          peut aussi être adressée à la Plateforme à <Lien href={`mailto:${C.emailDonnees}`}>{C.emailDonnees}</Lien>,
          qui la transmet à l’Établissement concerné et l’assiste. Une réponse est apportée dans un délai de{' '}
          <strong>30 jours</strong> à compter de la réception d’une demande complète ; ce délai peut être prolongé une
          fois en cas de complexité, la personne en étant informée.
        </P>
        <P>
          Toute personne peut également saisir l’autorité de protection des données de son pays (au Togo, l’IPDCP ;
          en Côte d’Ivoire, l’ARTCI).
        </P>
      </>
    ),
  },
  {
    id: 'mineurs',
    titre: 'Mineurs',
    contenu: (
      <>
        <P>
          Les élèves dont les données sont traitées sont pour la plupart <strong>mineurs</strong>. Ils ne créent
          pas de compte et n’accèdent pas à la Plateforme : leurs données sont saisies et consultées par le personnel
          de l’Établissement. L’Établissement s’engage à informer les parents ou représentants légaux et à recueillir,
          lorsque la loi l’exige, leur autorisation.
        </P>
        <P>
          La Plateforme applique à ces données un niveau de protection renforcé : aucune exploitation à des fins
          commerciales ou publicitaires, aucun profilage, aucune communication à des tiers en dehors des cas décrits
          dans la présente politique, et effacement à l’issue des durées indiquées.
        </P>
      </>
    ),
  },
  {
    id: 'cookies',
    titre: 'Cookies et stockage local',
    contenu: (
      <>
        <P>La Plateforme n’utilise <strong>aucun traceur publicitaire</strong> ni outil de mesure d’audience tiers. Le navigateur conserve uniquement :</P>
        <Ul>
          <li>le <strong>jeton de session</strong> et les informations du compte connecté (stockage de session, supprimé à la fermeture de l’onglet ou à la déconnexion) ;</li>
          <li>des <strong>préférences d’affichage</strong> (mode hors ligne, verrou du procès-verbal, dernière vue) ;</li>
          <li>le <strong>cache hors ligne</strong> de l’application elle-même (fichiers de l’interface) pour fonctionner avec une connexion instable ; les réponses contenant des données d’élèves ne sont jamais mises en cache par le service worker.</li>
        </Ul>
        <P>Ces éléments sont strictement nécessaires au fonctionnement du service et ne requièrent pas de consentement. Ils peuvent être effacés depuis les réglages du navigateur.</P>
      </>
    ),
  },
  {
    id: 'violation',
    titre: 'Notification de violation de données',
    contenu: (
      <P>
        En cas de violation de données à caractère personnel (accès non autorisé, perte, altération ou divulgation),
        la Plateforme en informe l’Établissement concerné <strong>dans les meilleurs délais</strong> après en avoir
        pris connaissance, en précisant la nature de la violation, les données et personnes probablement concernées,
        les conséquences probables et les mesures prises. Elle l’assiste pour la notification à l’autorité compétente
        et, si nécessaire, aux personnes concernées, dans les délais prévus par la loi applicable à l’Établissement.
      </P>
    ),
  },
  {
    id: 'modifications',
    titre: 'Modifications de la politique',
    contenu: (
      <P>
        La présente politique peut être mise à jour pour refléter une évolution du service, des prestataires ou de la
        réglementation. Chaque version est datée ; les modifications substantielles sont notifiées au responsable de
        l’Établissement à sa connexion et soumises à son acceptation. L’historique des versions acceptées est
        consultable depuis le profil de l’Établissement.
      </P>
    ),
  },
  {
    id: 'contact',
    titre: 'Contact et référent données',
    contenu: (
      <>
        <P>Pour toute question relative à cette politique ou pour exercer vos droits auprès de la Plateforme :</P>
        <Ul>
          <li>Référent protection des données : <Lien href={`mailto:${C.emailDonnees}`}>{C.emailDonnees}</Lien></li>
          <li>{C.raisonSociale}</li>
          <li>{C.adresse}</li>
        </Ul>
        <P>
          Voir aussi les <Lien href={CHEMINS_LEGAUX.cgu}>Conditions générales d’utilisation</Lien> et les{' '}
          <Lien href={CHEMINS_LEGAUX.conditions}>Conditions d’utilisation</Lien>.
        </P>
      </>
    ),
  },
];
