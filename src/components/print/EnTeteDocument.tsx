import React from 'react';
import { composerEnTeteDocument, dateEditionDocument, type SourcesEnTeteDocument } from '../../utils/documentPaysage';

export interface MetaDocument {
  label: string;
  value: React.ReactNode;
}

interface EnTeteDocumentProps extends SourcesEnTeteDocument {
  /** Colonne de droite : date d'édition (ajoutée automatiquement), effectif, classe ou filtre… */
  meta?: MetaDocument[];
}

/**
 * Bandeau commun des documents imprimés en paysage (styles `.document-paysage-*` dans `index.css`) :
 * logo + nom + devise à gauche, république / ministère / titre au centre, repères d'édition à droite,
 * filet doré en dessous. En inter-établissements : ni logo ni devise, « CENTRE D'EXAMEN : … ».
 */
export const EnTeteDocument: React.FC<EnTeteDocumentProps> = ({ meta = [], ...sources }) => {
  const entete = composerEnTeteDocument(sources);
  const lignesMeta: MetaDocument[] = [{ label: 'Édité le', value: dateEditionDocument() }, ...meta];

  return (
    <header className="document-paysage-entete" data-testid="entete-document">
      <div className="document-paysage-etab">
        {entete.logoUrl && (
          <img src={entete.logoUrl} alt="" className="document-paysage-logo" data-testid="entete-document-logo" />
        )}
        <div className="document-paysage-etab-texte">
          {entete.nomEtablissement && <div className="document-paysage-etab-nom">{entete.nomEtablissement}</div>}
          {entete.devise && <div className="document-paysage-etab-devise">{entete.devise}</div>}
        </div>
      </div>

      <div className="document-paysage-centre">
        {entete.republique && (
          <div className="document-paysage-republique">
            {entete.republique}
            {entete.deviseNationale && <span className="document-paysage-devise-nationale"> — {entete.deviseNationale}</span>}
          </div>
        )}
        {entete.ministere && (
          <div className="document-paysage-ministere">
            {entete.ministere}
            {entete.sigleMinistere && <span> {entete.sigleMinistere}</span>}
          </div>
        )}
        {entete.autoriteRegionale && <div className="document-paysage-ministere">{entete.autoriteRegionale}</div>}
        <h1 className="document-paysage-titre">{entete.titre}</h1>
        {(entete.sousTitre || entete.anneeScolaire) && (
          <div className="document-paysage-sous-titre">
            {entete.sousTitre}
            {entete.sousTitre && entete.anneeScolaire && <span className="document-paysage-sep"> • </span>}
            {entete.anneeScolaire && <span>Année scolaire {entete.anneeScolaire}</span>}
          </div>
        )}
      </div>

      <dl className="document-paysage-meta">
        {lignesMeta.map((ligne) => (
          <div key={ligne.label} className="document-paysage-meta-ligne">
            <dt>{ligne.label}</dt>
            <dd>{ligne.value}</dd>
          </div>
        ))}
      </dl>
    </header>
  );
};

interface PiedDocumentProps {
  /** Nombre de colonnes du tableau (le pied occupe toute la largeur). */
  colonnes: number;
  /** Texte du pied : « NOM • Document » (`composerEnTeteDocument().piedDePage`). */
  texte: string;
  complement?: string;
}

/**
 * Pied de page discret, placé dans le `tfoot` du tableau principal : Chrome le répète en bas de chaque page
 * imprimée (`display: table-footer-group`), sans compteur de page (les boîtes de marge `@page` ne sont pas prises en charge).
 */
export const PiedDocument: React.FC<PiedDocumentProps> = ({ colonnes, texte, complement }) => (
  <tfoot className="document-paysage-pied">
    <tr>
      <td colSpan={colonnes}>
        <span>{texte}</span>
        {complement && <span className="document-paysage-pied-complement">{complement}</span>}
      </td>
    </tr>
  </tfoot>
);

/** Texte du pied de page pour un document donné (même composition que l'en-tête). */
export function piedDeDocument(sources: SourcesEnTeteDocument): string {
  return composerEnTeteDocument(sources).piedDePage;
}
