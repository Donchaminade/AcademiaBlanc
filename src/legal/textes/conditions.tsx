import React from 'react';
import { PLATEFORME_CONTACT as C, CHEMINS_LEGAUX } from '../config';
import { Note, P, Ul } from '../../components/legal/PageLegale';
import type { SectionLegale } from '../../components/legal/PageLegale';

// Charte d'usage courte, distincte des CGU, destinée à tous les utilisateurs d'un établissement
// (responsable, administrateurs, secrétariat, enseignants). À FAIRE VALIDER PAR UN CONSEIL JURIDIQUE.

export const TITRE_CONDITIONS = 'Conditions d’utilisation';
export const CHAPEAU_CONDITIONS =
  `Charte d’usage du service ${C.nomService} : les règles simples que chaque utilisateur d’un établissement — responsable, administrateur, secrétariat, enseignant — s’engage à respecter pour protéger les élèves et la fiabilité des documents.`;
export const DESCRIPTION_CONDITIONS =
  'Conditions d’utilisation d’AcademiaBlanc : règles d’usage, comptes et permissions, interdictions, bonnes pratiques, signalement d’incident et sanctions.';

const Lien: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => (
  <a href={href} className="font-semibold text-[#0051d5] underline-offset-2 hover:underline">{children}</a>
);

export const SECTIONS_CONDITIONS: SectionLegale[] = [
  {
    id: 'portee',
    titre: 'À qui s’adresse cette charte',
    contenu: (
      <>
        <P>
          Cette charte s’applique à toute personne qui utilise {C.nomService} avec un compte créé par son établissement.
          Elle complète les <Lien href={CHEMINS_LEGAUX.cgu}>Conditions générales d’utilisation</Lien>, qui lient
          l’établissement à la plateforme, et la <Lien href={CHEMINS_LEGAUX.confidentialite}>Politique de confidentialité</Lien>,
          qui décrit la protection des données. En cas de doute, les CGU prévalent.
        </P>
        <P>
          Le responsable de l’établissement l’accepte à l’inscription et s’engage à la porter à la connaissance des
          utilisateurs qu’il crée.
        </P>
      </>
    ),
  },
  {
    id: 'regles-usage',
    titre: 'Règles d’usage du service',
    contenu: (
      <Ul>
        <li>Utiliser la plateforme <strong>uniquement</strong> pour organiser les évaluations de l’établissement et produire ses documents officiels.</li>
        <li>N’enregistrer que des élèves réellement inscrits et des informations exactes ; corriger une erreur dès qu’elle est constatée.</li>
        <li>Respecter la confidentialité des résultats : un relevé, un bulletin ou un procès-verbal ne se communique qu’aux personnes habilitées (élève concerné, parents, administration).</li>
        <li>Se déconnecter après usage sur un poste partagé ; ne jamais laisser une session ouverte sans surveillance.</li>
        <li>Garder un ton respectueux dans les appréciations et observations : elles figurent sur des documents remis aux familles.</li>
      </Ul>
    ),
  },
  {
    id: 'comptes',
    titre: 'Comptes et permissions internes',
    contenu: (
      <>
        <Ul>
          <li>Chaque personne dispose de <strong>son propre compte</strong>, à son nom et à son adresse email.</li>
          <li>Le responsable attribue à chacun le <strong>rôle</strong> et les <strong>droits</strong> strictement nécessaires à ses fonctions (administrateur, secrétariat, enseignant), et les ajuste quand les fonctions changent.</li>
          <li>Les enseignants saisissent les notes des classes et matières qui leur sont affectées ; la délibération et la signature des bulletins relèvent des personnes désignées par l’établissement.</li>
          <li>Un compte inutilisé ou celui d’une personne qui quitte l’établissement est <strong>désactivé sans délai</strong>.</li>
          <li>Le mot de passe est personnel, suffisamment long, et changé immédiatement s’il a pu être vu par quelqu’un d’autre.</li>
        </Ul>
      </>
    ),
  },
  {
    id: 'interdictions',
    titre: 'Interdictions',
    contenu: (
      <>
        <P>Il est interdit de :</P>
        <Ul>
          <li><strong>partager ses identifiants</strong> ou utiliser ceux d’un collègue, même temporairement ;</li>
          <li>procéder à une <strong>extraction massive</strong> des données (élèves, notes, documents) en dehors des exports prévus et des besoins de l’établissement, ou automatiser l’accès au service sans accord écrit de la plateforme ;</li>
          <li>faire un <strong>usage détourné des données des élèves</strong> : publication, vente, communication à des tiers non habilités, comparaison nominative hors cadre pédagogique, prospection ;</li>
          <li><strong>contourner le verrouillage</strong> d’un procès-verbal ou d’une session clôturée, ou modifier une note après délibération en dehors de la procédure de rectification décidée par le jury ;</li>
          <li>tenter d’accéder à l’espace d’un autre établissement, de tester la sécurité du service ou d’en perturber le fonctionnement ;</li>
          <li>saisir dans les champs libres des informations sensibles sans rapport avec l’évaluation (santé, religion, situation familiale…) ;</li>
          <li>utiliser les images de charte (logo, cachet, signatures) d’un établissement sans y être autorisé.</li>
        </Ul>
      </>
    ),
  },
  {
    id: 'bonnes-pratiques',
    titre: 'Bonnes pratiques',
    contenu: (
      <Ul>
        <li><strong>Vérifier les relevés et bulletins avant impression</strong> : identité et classe de l’élève, matières au programme, coefficients, absences, moyennes et rangs, décision et mention. L’impression groupée engage l’établissement.</li>
        <li>Clôturer la saisie puis <strong>verrouiller le procès-verbal</strong> avant la délibération ; ne le déverrouiller que sur décision du jury.</li>
        <li><strong>Mettre à jour les coordonnées</strong> de l’établissement (email de contact, téléphone, nom du chef d’établissement) depuis le profil : elles figurent sur les documents et servent aux notifications importantes.</li>
        <li>Archiver chaque session terminée pour conserver l’historique et repartir d’une base propre.</li>
        <li>Exporter régulièrement ses données et conserver une copie des documents signés.</li>
        <li>Lors d’un examen inter-établissements, vérifier l’établissement d’origine de chaque candidat avant de transmettre les résultats.</li>
      </Ul>
    ),
  },
  {
    id: 'signalement',
    titre: 'Signalement d’incident',
    contenu: (
      <>
        <P>
          Tout utilisateur qui constate ou soupçonne un incident — identifiants compromis, accès inhabituel, données
          d’un autre établissement visibles, résultats modifiés sans explication, perte d’un appareil connecté — le
          signale <strong>immédiatement</strong> au responsable de son établissement, qui prévient la plateforme à{' '}
          <Lien href={`mailto:${C.email}`}>{C.email}</Lien>.
        </P>
        <Note>
          En cas de doute sur un mot de passe, changez-le d’abord, signalez ensuite : chaque minute compte pour limiter
          l’exposition des données des élèves.
        </Note>
      </>
    ),
  },
  {
    id: 'sanctions',
    titre: 'Sanctions',
    contenu: (
      <>
        <P>
          Un manquement à cette charte peut entraîner, selon sa gravité : un rappel des règles, la restriction des
          droits de l’utilisateur par le responsable, la <strong>suspension</strong> de son compte, et, pour les
          manquements graves ou répétés imputables à l’établissement, la suspension puis la résiliation du compte de
          l’établissement dans les conditions prévues par les CGU.
        </P>
        <P>
          Les faits susceptibles de constituer une infraction (accès frauduleux, atteinte aux données personnelles)
          peuvent faire l’objet d’un signalement aux autorités compétentes.
        </P>
      </>
    ),
  },
  {
    id: 'contact',
    titre: 'Contact',
    contenu: (
      <Ul>
        <li>Questions sur l’usage du service : votre responsable d’établissement, puis <Lien href={`mailto:${C.email}`}>{C.email}</Lien>.</li>
        <li>{C.raisonSociale} — {C.adresse}</li>
      </Ul>
    ),
  },
];
