import React, { useEffect, useState } from 'react';
import { apiGet, isPlatformOwner } from '../api/client';

interface EtablissementSurveillance {
  id: number;
  nom: string;
  code: string;
  ville: string;
  region?: string | null;
  typeEtablissement?: string | null;
  email: string;
  telephone?: string | null;
  nomResponsable: string;
  utilisateurs: number;
  classes: number;
  eleves: number;
  professeurs: number;
  sessions: number;
  notes: number;
}

const format = (value: number) => new Intl.NumberFormat('fr-FR').format(value);

export const PlateformeView: React.FC = () => {
  const [etablissements, setEtablissements] = useState<EtablissementSurveillance[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const allowed = isPlatformOwner();

  useEffect(() => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    apiGet<EtablissementSurveillance[]>('/api/plateforme/etablissements')
      .then(setEtablissements)
      .catch((err: Error) => setError(err.message || 'Impossible de charger les établissements.'))
      .finally(() => setLoading(false));
  }, [allowed]);

  if (!allowed) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="bg-white border border-[#eaedff] rounded p-6 text-[13px] text-[#444651]">
          Cet écran est réservé au propriétaire du logiciel. Le compte d’un établissement n’y a pas accès.
        </div>
      </div>
    );
  }

  const totaux = etablissements.reduce(
    (acc, item) => ({
      utilisateurs: acc.utilisateurs + item.utilisateurs,
      classes: acc.classes + item.classes,
      eleves: acc.eleves + item.eleves,
      professeurs: acc.professeurs + item.professeurs,
      sessions: acc.sessions + item.sessions,
      notes: acc.notes + item.notes,
    }),
    { utilisateurs: 0, classes: 0, eleves: 0, professeurs: 0, sessions: 0, notes: 0 },
  );

  const cartes = [
    { label: 'Établissements', value: etablissements.length, icon: 'domain' },
    { label: 'Utilisateurs', value: totaux.utilisateurs, icon: 'badge' },
    { label: 'Classes', value: totaux.classes, icon: 'school' },
    { label: 'Élèves', value: totaux.eleves, icon: 'group' },
    { label: 'Enseignants', value: totaux.professeurs, icon: 'co_present' },
    { label: 'Sessions', value: totaux.sessions, icon: 'event_note' },
    { label: 'Notes', value: totaux.notes, icon: 'edit_note' },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="bg-white rounded p-6 shadow-sm border border-[#eaedff]">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#0051d5] bg-[#eaedff] px-2.5 py-1 rounded">
          Propriétaire du logiciel
        </span>
        <h2 className="text-[22px] font-bold text-[#00236f] mt-1.5">
          Surveillance des établissements
        </h2>
        <p className="text-[13px] text-[#444651] mt-0.5 max-w-3xl">
          Vue de suivi de l’ensemble des établissements inscrits. Lecture seule : aucun compte n’est modifié, supprimé ou ouvert depuis cet écran.
          Ce n’est pas l’administration d’un établissement.
        </p>
      </div>

      {loading && (
        <div className="bg-white border border-[#eaedff] rounded p-6 text-[13px] text-[#444651]">
          Chargement des établissements…
        </div>
      )}

      {!loading && error && (
        <div className="bg-white border border-[#eaedff] rounded p-6 text-[13px] text-[#ba1a1a]">
          {error}
        </div>
      )}

      {!loading && !error && etablissements.length === 0 && (
        <div className="bg-white border border-dashed border-[#dce1ff] rounded p-10 text-center space-y-2">
          <span className="material-symbols-outlined text-4xl text-[#0051d5]">domain_disabled</span>
          <h3 className="text-[16px] font-bold text-[#00236f]">Aucun établissement enregistré</h3>
          <p className="text-[13px] text-[#444651]">
            Les établissements apparaîtront ici dès qu’un compte aura été créé.
          </p>
        </div>
      )}

      {!loading && !error && etablissements.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
            {cartes.map((carte) => (
              <div key={carte.label} className="bg-white border border-[#eaedff] rounded p-4 shadow-xs">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#444651]">
                  <span className="material-symbols-outlined text-base text-[#0051d5]">{carte.icon}</span>
                  <span>{carte.label}</span>
                </div>
                <p className="mt-2 text-[22px] font-bold text-[#00236f] leading-none">{format(carte.value)}</p>
              </div>
            ))}
          </div>

          <div className="bg-white border border-[#eaedff] rounded shadow-xs overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-[13px]">
              <thead className="bg-[#f2f3ff] text-[11px] uppercase tracking-wider text-[#444651]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Établissement</th>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold text-right">Utilisateurs</th>
                  <th className="px-4 py-3 font-semibold text-right">Classes</th>
                  <th className="px-4 py-3 font-semibold text-right">Élèves</th>
                  <th className="px-4 py-3 font-semibold text-right">Enseignants</th>
                  <th className="px-4 py-3 font-semibold text-right">Sessions</th>
                  <th className="px-4 py-3 font-semibold text-right">Notes</th>
                </tr>
              </thead>
              <tbody>
                {etablissements.map((item) => (
                  <tr key={item.id} className="border-t border-[#eaedff] align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#00236f]">{item.nom}</p>
                      <p className="text-[12px] text-[#444651]">
                        {item.ville}{item.region ? ` · ${item.region}` : ''}
                      </p>
                      <p className="text-[11px] text-[#444651]">{item.code}{item.typeEtablissement ? ` · ${item.typeEtablissement}` : ''}</p>
                    </td>
                    <td className="px-4 py-3 text-[#131b2e]">
                      <p className="font-medium">{item.nomResponsable}</p>
                      <p className="text-[12px] text-[#444651]">{item.email}</p>
                      <p className="text-[12px] text-[#444651]">{item.telephone || '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[#131b2e]">{format(item.utilisateurs)}</td>
                    <td className="px-4 py-3 text-right">{format(item.classes)}</td>
                    <td className="px-4 py-3 text-right">{format(item.eleves)}</td>
                    <td className="px-4 py-3 text-right">{format(item.professeurs)}</td>
                    <td className="px-4 py-3 text-right">{format(item.sessions)}</td>
                    <td className="px-4 py-3 text-right">{format(item.notes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
