import React, { useEffect, useState } from 'react';
import { apiGet, apiSend, getToken } from '../api/client';

interface Annee { id: number; libelle: string; courante: boolean; }
interface Centre { id: number; nom: string; code: string; ville?: string; }
interface Session { id: number; nom: string; typeExamen: string; statut: string; anneeScolaireId: number; centreId: number; }
interface Matiere { id: number; nom: string; code: string; }
interface Professeur { id: number; nom: string; email?: string; }
interface Classe { id: number; nom: string; niveau: string; serie?: string; titulaireId?: number; anneeScolaireId: number; }
interface Affectation { id: number; professeurId: number; matiereId: number; classeId: number; }

export const AdminParametres: React.FC = () => {
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [annees, setAnnees] = useState<Annee[]>([]);
  const [centres, setCentres] = useState<Centre[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [matieres, setMatieres] = useState<Matiere[]>([]);
  const [profs, setProfs] = useState<Professeur[]>([]);
  const [classes, setClasses] = useState<Classe[]>([]);
  const [affectations, setAffectations] = useState<Affectation[]>([]);
  const [affectation, setAffectation] = useState({ professeurId: '', matiereId: '', classeId: '' });
  const [annee, setAnnee] = useState('2025-2026');
  const [centre, setCentre] = useState({ nom: '', code: '', ville: 'Lomé' });
  const [session, setSession] = useState({ nom: '', typeExamen: 'BACCALAURÉAT II', statut: 'OUVERTE' });
  const [matiere, setMatiere] = useState({ nom: '', code: '' });
  const [prof, setProf] = useState({ nom: '', email: '' });
  const [classe, setClasse] = useState({ nom: '', niveau: 'Terminale', serie: 'Série D', titulaireId: '' });

  const load = async () => {
    if (!getToken()) return;
    const [a, c, s, m, p, k, af] = await Promise.all([
      apiGet<Annee[]>('/api/annees-scolaires'),
      apiGet<Centre[]>('/api/centres'),
      apiGet<Session[]>('/api/sessions'),
      apiGet<Matiere[]>('/api/matieres'),
      apiGet<Professeur[]>('/api/professeurs'),
      apiGet<Classe[]>('/api/classes'),
      apiGet<Affectation[]>('/api/affectations'),
    ]);
    setAnnees(a);
    setCentres(c);
    setSessions(s);
    setMatieres(m);
    setProfs(p);
    setClasses(k);
    setAffectations(af);
  };

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []);

  const run = async (action: () => Promise<void>) => {
    setError('');
    setInfo('');
    try {
      await action();
      await load();
      setInfo('Enregistré.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de l’enregistrement.');
    }
  };

  if (!getToken()) {
    return (
      <div className="bg-white border border-[#eaedff] rounded p-6 text-[13px] text-[#444651]">
        Connectez l’établissement via « Compte établissement » pour gérer les années, centres, sessions, matières et enseignants sur l’API.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-[13px] text-[#ba1a1a]">{error}</p>}
      {info && <p className="text-[13px] text-[#0051d5]">{info}</p>}

      <section className="bg-white border border-[#eaedff] rounded p-5 space-y-3">
        <h3 className="font-bold text-[#00236f]">Années scolaires</h3>
        <ul className="text-[13px]">{annees.map((item) => <li key={item.id}>{item.libelle}{item.courante ? ' (courante)' : ''}</li>)}</ul>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void run(() => apiSend('/api/annees-scolaires', 'POST', { libelle: annee, courante: false }).then(() => undefined)); }}>
          <input value={annee} onChange={(e) => setAnnee(e.target.value)} className="border border-[#eaedff] rounded px-2 py-1 text-[13px]" />
          <button type="submit" className="px-3 py-1 rounded bg-[#00236f] text-white text-[12px] font-semibold">Créer</button>
        </form>
      </section>

      <section className="bg-white border border-[#eaedff] rounded p-5 space-y-3">
        <h3 className="font-bold text-[#00236f]">Centres d'examen</h3>
        <ul className="text-[13px]">{centres.map((item) => <li key={item.id}>{item.code} — {item.nom}</li>)}</ul>
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); void run(() => apiSend('/api/centres', 'POST', centre).then(() => undefined)); }}>
          <input placeholder="Nom" value={centre.nom} onChange={(e) => setCentre({ ...centre, nom: e.target.value })} className="border border-[#eaedff] rounded px-2 py-1 text-[13px]" />
          <input placeholder="Code" value={centre.code} onChange={(e) => setCentre({ ...centre, code: e.target.value })} className="border border-[#eaedff] rounded px-2 py-1 text-[13px]" />
          <input placeholder="Ville" value={centre.ville} onChange={(e) => setCentre({ ...centre, ville: e.target.value })} className="border border-[#eaedff] rounded px-2 py-1 text-[13px]" />
          <button type="submit" className="px-3 py-1 rounded bg-[#00236f] text-white text-[12px] font-semibold">Créer</button>
        </form>
      </section>

      <section className="bg-white border border-[#eaedff] rounded p-5 space-y-3">
        <h3 className="font-bold text-[#00236f]">Sessions d'examen</h3>
        <ul className="text-[13px]">{sessions.map((item) => <li key={item.id}>{item.nom} — {item.statut}</li>)}</ul>
        <form className="flex flex-wrap gap-2" onSubmit={(e) => {
          e.preventDefault();
          if (!annees[0] || !centres[0]) { setError('Créez d’abord une année et un centre.'); return; }
          void run(() => apiSend('/api/sessions', 'POST', { ...session, anneeScolaireId: annees[0].id, centreId: centres[0].id }).then(() => undefined));
        }}>
          <input placeholder="Nom de session" value={session.nom} onChange={(e) => setSession({ ...session, nom: e.target.value })} className="border border-[#eaedff] rounded px-2 py-1 text-[13px]" />
          <button type="submit" className="px-3 py-1 rounded bg-[#00236f] text-white text-[12px] font-semibold">Créer sur l’année et le centre courants</button>
        </form>
      </section>

      <section className="bg-white border border-[#eaedff] rounded p-5 space-y-3">
        <h3 className="font-bold text-[#00236f]">Matières</h3>
        <ul className="text-[13px]">{matieres.map((item) => <li key={item.id}>{item.code} — {item.nom}</li>)}</ul>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void run(() => apiSend('/api/matieres', 'POST', matiere).then(() => undefined)); }}>
          <input placeholder="Code" value={matiere.code} onChange={(e) => setMatiere({ ...matiere, code: e.target.value })} className="border border-[#eaedff] rounded px-2 py-1 text-[13px]" />
          <input placeholder="Nom" value={matiere.nom} onChange={(e) => setMatiere({ ...matiere, nom: e.target.value })} className="border border-[#eaedff] rounded px-2 py-1 text-[13px]" />
          <button type="submit" className="px-3 py-1 rounded bg-[#00236f] text-white text-[12px] font-semibold">Créer</button>
        </form>
      </section>

      <section className="bg-white border border-[#eaedff] rounded p-5 space-y-3">
        <h3 className="font-bold text-[#00236f]">Enseignants, classes et titulaire</h3>
        <ul className="text-[13px]">{profs.map((item) => <li key={item.id}>{item.nom}</li>)}</ul>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void run(() => apiSend('/api/professeurs', 'POST', prof).then(() => undefined)); }}>
          <input placeholder="Nom" value={prof.nom} onChange={(e) => setProf({ ...prof, nom: e.target.value })} className="border border-[#eaedff] rounded px-2 py-1 text-[13px]" />
          <input placeholder="Email" value={prof.email} onChange={(e) => setProf({ ...prof, email: e.target.value })} className="border border-[#eaedff] rounded px-2 py-1 text-[13px]" />
          <button type="submit" className="px-3 py-1 rounded bg-[#00236f] text-white text-[12px] font-semibold">Ajouter l’enseignant</button>
        </form>
        <ul className="text-[13px]">{classes.map((item) => <li key={item.id}>{item.nom} — titulaire {item.titulaireId ?? 'non désigné'}</li>)}</ul>
        <form className="flex flex-wrap gap-2" onSubmit={(e) => {
          e.preventDefault();
          if (!annees[0]) { setError('Aucune année scolaire.'); return; }
          void run(() => apiSend('/api/classes', 'POST', {
            anneeScolaireId: annees[0].id,
            nom: classe.nom,
            niveau: classe.niveau,
            serie: classe.serie,
            titulaireId: classe.titulaireId ? Number(classe.titulaireId) : null,
          }).then(() => undefined));
        }}>
          <input placeholder="Classe" value={classe.nom} onChange={(e) => setClasse({ ...classe, nom: e.target.value })} className="border border-[#eaedff] rounded px-2 py-1 text-[13px]" />
          <select value={classe.titulaireId} onChange={(e) => setClasse({ ...classe, titulaireId: e.target.value })} className="border border-[#eaedff] rounded px-2 py-1 text-[13px]">
            <option value="">Sans titulaire</option>
            {profs.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}
          </select>
          <button type="submit" className="px-3 py-1 rounded bg-[#00236f] text-white text-[12px] font-semibold">Créer la classe</button>
        </form>
        <ul className="text-[13px]">{affectations.map((item) => <li key={item.id}>Enseignant {item.professeurId} · matière {item.matiereId} · classe {item.classeId}</li>)}</ul>
        <form className="flex flex-wrap gap-2" onSubmit={(e) => {
          e.preventDefault();
          void run(() => apiSend('/api/affectations', 'POST', {
            professeurId: Number(affectation.professeurId),
            matiereId: Number(affectation.matiereId),
            classeId: Number(affectation.classeId),
          }).then(() => undefined));
        }}>
          <select value={affectation.professeurId} onChange={(e) => setAffectation({ ...affectation, professeurId: e.target.value })} className="border border-[#eaedff] rounded px-2 py-1 text-[13px]">
            <option value="">Enseignant</option>
            {profs.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}
          </select>
          <select value={affectation.matiereId} onChange={(e) => setAffectation({ ...affectation, matiereId: e.target.value })} className="border border-[#eaedff] rounded px-2 py-1 text-[13px]">
            <option value="">Matière</option>
            {matieres.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}
          </select>
          <select value={affectation.classeId} onChange={(e) => setAffectation({ ...affectation, classeId: e.target.value })} className="border border-[#eaedff] rounded px-2 py-1 text-[13px]">
            <option value="">Classe</option>
            {classes.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}
          </select>
          <button type="submit" className="px-3 py-1 rounded bg-[#00236f] text-white text-[12px] font-semibold">Affecter</button>
        </form>
      </section>
    </div>
  );
};
