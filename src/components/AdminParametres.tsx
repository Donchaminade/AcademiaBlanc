import React, { useEffect, useRef, useState } from 'react';
import { apiDelete, apiGet, apiSend, getToken } from '../api/client';

interface Annee { id: number; libelle: string; courante: boolean; dateDebut?: string; dateFin?: string; }
interface Centre { id: number; nom: string; code: string; ville?: string; }
interface Session { id: number; nom: string; typeExamen: string; statut: string; serie?: string; anneeScolaireId: number; centreId: number; }
interface Matiere { id: number; nom: string; code: string; }
interface Professeur { id: number; nom: string; email?: string; }
interface Classe { id: number; nom: string; niveau: string; serie?: string; titulaireId?: number; anneeScolaireId: number; }
interface Affectation { id: number; professeurId: number; matiereId: number; classeId: number; }
interface Coefficient { id: number; matiereId: number; classeId?: number; serie?: string; valeur: number; }
interface Eleve { id: number; nomComplet: string; matricule: string; genre: string; classeId: number; sessionId?: number; numeroTable?: number; lieuNaissance?: string; }
interface Note { id: number; eleveId: number; matiereId: number; sessionId: number; valeur?: number; absent: boolean; }

const field = 'border border-[#eaedff] rounded px-2 py-1 text-[13px]';
const primary = 'px-3 py-1 rounded bg-[#00236f] text-white text-[12px] font-semibold';

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
  const [coefficients, setCoefficients] = useState<Coefficient[]>([]);
  const [eleves, setEleves] = useState<Eleve[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [annee, setAnnee] = useState('2025-2026');
  const [anneeEdit, setAnneeEdit] = useState<Annee | null>(null);
  const [centre, setCentre] = useState({ nom: '', code: '', ville: 'Lomé' });
  const [centreEdit, setCentreEdit] = useState<Centre | null>(null);
  const [session, setSession] = useState({ nom: '', typeExamen: 'BACCALAURÉAT II', statut: 'OUVERTE', serie: 'Série D', anneeScolaireId: '', centreId: '' });
  const [sessionEdit, setSessionEdit] = useState<Session | null>(null);
  const [matiere, setMatiere] = useState({ nom: '', code: '' });
  const [matiereEdit, setMatiereEdit] = useState<Matiere | null>(null);
  const [prof, setProf] = useState({ nom: '', email: '' });
  const [profEdit, setProfEdit] = useState<Professeur | null>(null);
  const [classe, setClasse] = useState({ nom: '', niveau: 'Terminale', serie: 'Série D', titulaireId: '', anneeScolaireId: '' });
  const [classeEdit, setClasseEdit] = useState<Classe | null>(null);
  const [affectation, setAffectation] = useState({ professeurId: '', matiereId: '', classeId: '' });
  const [affectationEdit, setAffectationEdit] = useState<Affectation | null>(null);
  const [coefficient, setCoefficient] = useState({ matiereId: '', classeId: '', serie: '', valeur: '2' });
  const [coefficientEdit, setCoefficientEdit] = useState<Coefficient | null>(null);
  const [eleve, setEleve] = useState({ nomComplet: '', matricule: '', genre: 'F', classeId: '', sessionId: '', numeroTable: '' });
  const [eleveEdit, setEleveEdit] = useState<Eleve | null>(null);
  const [note, setNote] = useState({ eleveId: '', matiereId: '', sessionId: '', valeur: '', absent: false });
  const [noteEdit, setNoteEdit] = useState<Note | null>(null);
  const [sessionNotes, setSessionNotes] = useState('');
  const sessionNotesRef = useRef('');

  const nom = (liste: { id: number; nom?: string; libelle?: string; nomComplet?: string }[], id?: number) =>
    liste.find((item) => item.id === id)?.nom
    || liste.find((item) => item.id === id)?.libelle
    || liste.find((item) => item.id === id)?.nomComplet
    || (id ? String(id) : '—');

  const load = async () => {
    if (!getToken()) return;
    const [a, c, s, m, p, k, af, coef, el] = await Promise.all([
      apiGet<Annee[]>('/api/annees-scolaires'),
      apiGet<Centre[]>('/api/centres'),
      apiGet<Session[]>('/api/sessions'),
      apiGet<Matiere[]>('/api/matieres'),
      apiGet<Professeur[]>('/api/professeurs'),
      apiGet<Classe[]>('/api/classes'),
      apiGet<Affectation[]>('/api/affectations'),
      apiGet<Coefficient[]>('/api/coefficients'),
      apiGet<Eleve[]>('/api/eleves'),
    ]);
    setAnnees(a);
    setCentres(c);
    setSessions(s);
    setMatieres(m);
    setProfs(p);
    setClasses(k);
    setAffectations(af);
    setCoefficients(coef);
    setEleves(el);
    const sessionId = sessionNotesRef.current || (s[0] ? String(s[0].id) : '');
    if (sessionId) {
      sessionNotesRef.current = sessionId;
      setSessionNotes(sessionId);
      setNotes(await apiGet<Note[]>(`/api/notes?sessionId=${sessionId}`));
    } else {
      setNotes([]);
    }
  };

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []);

  const run = async (action: () => Promise<void>, ok = 'Enregistré.') => {
    setError('');
    setInfo('');
    try {
      await action();
      await load();
      setInfo(ok);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de l’enregistrement.');
    }
  };

  const open = async <T,>(path: string, apply: (item: T) => void) => {
    setError('');
    try {
      apply(await apiGet<T>(path));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Détail introuvable.');
    }
  };

  const remove = (path: string, label: string, clear: () => void) => {
    if (!window.confirm(`Supprimer « ${label} » ? Cette action retire la fiche si aucun élément lié ne la retient.`)) return;
    clear();
    void run(() => apiDelete(path), 'Supprimé.');
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
        <ul className="text-[13px] space-y-1">
          {annees.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span>{item.libelle}{item.courante ? ' (courante)' : ''}</span>
              <span className="flex gap-3">
                <button type="button" className="font-semibold text-[#00236f]" onClick={() => void open<Annee>(`/api/annees-scolaires/${item.id}`, (detail) => { setAnneeEdit(detail); setAnnee(detail.libelle); })}>Détails</button>
                <button type="button" className="font-semibold text-[#ba1a1a]" onClick={() => remove(`/api/annees-scolaires/${item.id}`, item.libelle, () => setAnneeEdit(null))}>Supprimer</button>
              </span>
            </li>
          ))}
        </ul>
        {anneeEdit && <p className="text-[12px] text-[#444651]">Fiche n° {anneeEdit.id} — {anneeEdit.libelle} — courante : {anneeEdit.courante ? 'oui' : 'non'}</p>}
        <form className="flex gap-2" onSubmit={(e) => {
          e.preventDefault();
          const body = { libelle: annee.trim(), courante: anneeEdit?.courante ?? false };
          void run(() => anneeEdit
            ? apiSend(`/api/annees-scolaires/${anneeEdit.id}`, 'PUT', body).then(() => undefined)
            : apiSend('/api/annees-scolaires', 'POST', body).then(() => undefined));
        }}>
          <input required value={annee} onChange={(e) => setAnnee(e.target.value)} className={field} />
          <button type="submit" className={primary}>{anneeEdit ? 'Mettre à jour' : 'Créer'}</button>
          {anneeEdit && <button type="button" className="text-[12px]" onClick={() => setAnneeEdit(null)}>Nouvelle fiche</button>}
        </form>
      </section>

      <section className="bg-white border border-[#eaedff] rounded p-5 space-y-3">
        <h3 className="font-bold text-[#00236f]">Centres d'examen</h3>
        <ul className="text-[13px] space-y-1">
          {centres.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span>{item.code} — {item.nom}</span>
              <span className="flex gap-3">
                <button type="button" className="font-semibold text-[#00236f]" onClick={() => void open<Centre>(`/api/centres/${item.id}`, (detail) => { setCentreEdit(detail); setCentre({ nom: detail.nom, code: detail.code, ville: detail.ville || '' }); })}>Détails</button>
                <button type="button" className="font-semibold text-[#ba1a1a]" onClick={() => remove(`/api/centres/${item.id}`, item.nom, () => setCentreEdit(null))}>Supprimer</button>
              </span>
            </li>
          ))}
        </ul>
        {centreEdit && <p className="text-[12px] text-[#444651]">Fiche n° {centreEdit.id} — {centreEdit.code} — {centreEdit.nom} — {centreEdit.ville || 'ville non renseignée'}</p>}
        <form className="flex flex-wrap gap-2" onSubmit={(e) => {
          e.preventDefault();
          void run(() => centreEdit
            ? apiSend(`/api/centres/${centreEdit.id}`, 'PUT', centre).then(() => undefined)
            : apiSend('/api/centres', 'POST', centre).then(() => undefined));
        }}>
          <input required placeholder="Nom" value={centre.nom} onChange={(e) => setCentre({ ...centre, nom: e.target.value })} className={field} />
          <input required placeholder="Code" value={centre.code} onChange={(e) => setCentre({ ...centre, code: e.target.value })} className={field} />
          <input placeholder="Ville" value={centre.ville} onChange={(e) => setCentre({ ...centre, ville: e.target.value })} className={field} />
          <button type="submit" className={primary}>{centreEdit ? 'Mettre à jour' : 'Créer'}</button>
          {centreEdit && <button type="button" className="text-[12px]" onClick={() => setCentreEdit(null)}>Nouvelle fiche</button>}
        </form>
      </section>

      <section className="bg-white border border-[#eaedff] rounded p-5 space-y-3">
        <h3 className="font-bold text-[#00236f]">Sessions d'examen</h3>
        <ul className="text-[13px] space-y-1">
          {sessions.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span>{item.nom} — {item.statut}</span>
              <span className="flex gap-3">
                <button type="button" className="font-semibold text-[#00236f]" onClick={() => void open<Session>(`/api/sessions/${item.id}`, (detail) => {
                  setSessionEdit(detail);
                  setSession({ nom: detail.nom, typeExamen: detail.typeExamen, statut: detail.statut, serie: detail.serie || '', anneeScolaireId: String(detail.anneeScolaireId), centreId: String(detail.centreId) });
                })}>Détails</button>
                <button type="button" className="font-semibold text-[#ba1a1a]" onClick={() => remove(`/api/sessions/${item.id}`, item.nom, () => setSessionEdit(null))}>Supprimer</button>
              </span>
            </li>
          ))}
        </ul>
        {sessionEdit && <p className="text-[12px] text-[#444651]">Fiche n° {sessionEdit.id} — {sessionEdit.typeExamen} — année {nom(annees, sessionEdit.anneeScolaireId)} — centre {nom(centres, sessionEdit.centreId)}</p>}
        <form className="flex flex-wrap gap-2" onSubmit={(e) => {
          e.preventDefault();
          const anneeId = Number(session.anneeScolaireId || annees[0]?.id);
          const centreId = Number(session.centreId || centres[0]?.id);
          if (!anneeId || !centreId) { setError('Créez d’abord une année et un centre.'); return; }
          const body = { ...session, anneeScolaireId: anneeId, centreId };
          void run(() => sessionEdit
            ? apiSend(`/api/sessions/${sessionEdit.id}`, 'PUT', body).then(() => undefined)
            : apiSend('/api/sessions', 'POST', body).then(() => undefined));
        }}>
          <input required placeholder="Nom de session" value={session.nom} onChange={(e) => setSession({ ...session, nom: e.target.value })} className={field} />
          <select value={session.anneeScolaireId} onChange={(e) => setSession({ ...session, anneeScolaireId: e.target.value })} className={field}>
            <option value="">Année courante de la liste</option>
            {annees.map((item) => <option key={item.id} value={item.id}>{item.libelle}</option>)}
          </select>
          <select value={session.centreId} onChange={(e) => setSession({ ...session, centreId: e.target.value })} className={field}>
            <option value="">Premier centre de la liste</option>
            {centres.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}
          </select>
          <button type="submit" className={primary}>{sessionEdit ? 'Mettre à jour' : 'Créer la session'}</button>
          {sessionEdit && <button type="button" className="text-[12px]" onClick={() => setSessionEdit(null)}>Nouvelle fiche</button>}
        </form>
      </section>

      <section className="bg-white border border-[#eaedff] rounded p-5 space-y-3">
        <h3 className="font-bold text-[#00236f]">Matières et coefficients</h3>
        <ul className="text-[13px] space-y-1">
          {matieres.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span>{item.code} — {item.nom}</span>
              <span className="flex gap-3">
                <button type="button" className="font-semibold text-[#00236f]" onClick={() => void open<Matiere>(`/api/matieres/${item.id}`, (detail) => { setMatiereEdit(detail); setMatiere({ nom: detail.nom, code: detail.code }); })}>Détails</button>
                <button type="button" className="font-semibold text-[#ba1a1a]" onClick={() => remove(`/api/matieres/${item.id}`, item.nom, () => setMatiereEdit(null))}>Supprimer</button>
              </span>
            </li>
          ))}
        </ul>
        {matiereEdit && <p className="text-[12px] text-[#444651]">Fiche n° {matiereEdit.id} — code {matiereEdit.code} — {matiereEdit.nom}</p>}
        <form className="flex flex-wrap gap-2" onSubmit={(e) => {
          e.preventDefault();
          void run(() => matiereEdit
            ? apiSend(`/api/matieres/${matiereEdit.id}`, 'PUT', matiere).then(() => undefined)
            : apiSend('/api/matieres', 'POST', matiere).then(() => undefined));
        }}>
          <input required placeholder="Code" value={matiere.code} onChange={(e) => setMatiere({ ...matiere, code: e.target.value })} className={field} />
          <input required placeholder="Nom" value={matiere.nom} onChange={(e) => setMatiere({ ...matiere, nom: e.target.value })} className={field} />
          <button type="submit" className={primary}>{matiereEdit ? 'Mettre à jour' : 'Créer'}</button>
          {matiereEdit && <button type="button" className="text-[12px]" onClick={() => setMatiereEdit(null)}>Nouvelle fiche</button>}
        </form>
        <ul className="text-[13px] space-y-1">
          {coefficients.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span>{nom(matieres, item.matiereId)} — coef {item.valeur} — {item.classeId ? nom(classes, item.classeId) : 'toutes les classes'}</span>
              <span className="flex gap-3">
                <button type="button" className="font-semibold text-[#00236f]" onClick={() => void open<Coefficient>(`/api/coefficients/${item.id}`, (detail) => {
                  setCoefficientEdit(detail);
                  setCoefficient({ matiereId: String(detail.matiereId), classeId: detail.classeId ? String(detail.classeId) : '', serie: detail.serie || '', valeur: String(detail.valeur) });
                })}>Détails</button>
                <button type="button" className="font-semibold text-[#ba1a1a]" onClick={() => remove(`/api/coefficients/${item.id}`, `coefficient ${item.valeur}`, () => setCoefficientEdit(null))}>Supprimer</button>
              </span>
            </li>
          ))}
        </ul>
        {coefficientEdit && <p className="text-[12px] text-[#444651]">Fiche n° {coefficientEdit.id} — valeur {coefficientEdit.valeur} — série {coefficientEdit.serie || '—'}</p>}
        <form className="flex flex-wrap gap-2" onSubmit={(e) => {
          e.preventDefault();
          const valeur = Number(coefficient.valeur);
          if (!Number.isFinite(valeur) || valeur < 0.5 || valeur > 20) { setError('Le coefficient doit être compris entre 0,5 et 20.'); return; }
          const body = { matiereId: Number(coefficient.matiereId), classeId: coefficient.classeId ? Number(coefficient.classeId) : null, serie: coefficient.serie, valeur };
          void run(() => coefficientEdit
            ? apiSend(`/api/coefficients/${coefficientEdit.id}`, 'PUT', body).then(() => undefined)
            : apiSend('/api/coefficients', 'POST', body).then(() => undefined));
        }}>
          <select required value={coefficient.matiereId} onChange={(e) => setCoefficient({ ...coefficient, matiereId: e.target.value })} className={field}>
            <option value="">Matière</option>
            {matieres.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}
          </select>
          <select value={coefficient.classeId} onChange={(e) => setCoefficient({ ...coefficient, classeId: e.target.value })} className={field}>
            <option value="">Toutes les classes</option>
            {classes.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}
          </select>
          <input placeholder="Valeur" value={coefficient.valeur} onChange={(e) => setCoefficient({ ...coefficient, valeur: e.target.value })} className={field} />
          <button type="submit" className={primary}>{coefficientEdit ? 'Mettre à jour le coefficient' : 'Ajouter le coefficient'}</button>
        </form>
      </section>

      <section className="bg-white border border-[#eaedff] rounded p-5 space-y-3">
        <h3 className="font-bold text-[#00236f]">Enseignants, classes, titulaire et affectations</h3>
        <ul className="text-[13px] space-y-1">
          {profs.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span>{item.nom}</span>
              <span className="flex gap-3">
                <button type="button" className="font-semibold text-[#00236f]" onClick={() => void open<Professeur>(`/api/professeurs/${item.id}`, (detail) => { setProfEdit(detail); setProf({ nom: detail.nom, email: detail.email || '' }); })}>Détails</button>
                <button type="button" className="font-semibold text-[#ba1a1a]" onClick={() => remove(`/api/professeurs/${item.id}`, item.nom, () => setProfEdit(null))}>Supprimer</button>
              </span>
            </li>
          ))}
        </ul>
        {profEdit && <p className="text-[12px] text-[#444651]">Fiche n° {profEdit.id} — {profEdit.nom} — {profEdit.email || 'email non renseigné'}</p>}
        <form className="flex flex-wrap gap-2" onSubmit={(e) => {
          e.preventDefault();
          void run(() => profEdit
            ? apiSend(`/api/professeurs/${profEdit.id}`, 'PUT', prof).then(() => undefined)
            : apiSend('/api/professeurs', 'POST', prof).then(() => undefined));
        }}>
          <input required placeholder="Nom" value={prof.nom} onChange={(e) => setProf({ ...prof, nom: e.target.value })} className={field} />
          <input placeholder="Email" value={prof.email} onChange={(e) => setProf({ ...prof, email: e.target.value })} className={field} />
          <button type="submit" className={primary}>{profEdit ? 'Mettre à jour' : 'Ajouter l’enseignant'}</button>
          {profEdit && <button type="button" className="text-[12px]" onClick={() => setProfEdit(null)}>Nouvelle fiche</button>}
        </form>
        <ul className="text-[13px] space-y-1">
          {classes.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span>{item.nom} — titulaire {item.titulaireId ? nom(profs, item.titulaireId) : 'non désigné'}</span>
              <span className="flex gap-3">
                <button type="button" className="font-semibold text-[#00236f]" onClick={() => void open<Classe>(`/api/classes/${item.id}`, (detail) => {
                  setClasseEdit(detail);
                  setClasse({ nom: detail.nom, niveau: detail.niveau, serie: detail.serie || '', titulaireId: detail.titulaireId ? String(detail.titulaireId) : '', anneeScolaireId: String(detail.anneeScolaireId) });
                })}>Détails</button>
                <button type="button" className="font-semibold text-[#ba1a1a]" onClick={() => remove(`/api/classes/${item.id}`, item.nom, () => setClasseEdit(null))}>Supprimer</button>
              </span>
            </li>
          ))}
        </ul>
        {classeEdit && <p className="text-[12px] text-[#444651]">Fiche n° {classeEdit.id} — {classeEdit.niveau} — {classeEdit.serie || 'série non renseignée'} — année {nom(annees, classeEdit.anneeScolaireId)}</p>}
        <form className="flex flex-wrap gap-2" onSubmit={(e) => {
          e.preventDefault();
          const anneeId = Number(classe.anneeScolaireId || annees[0]?.id);
          if (!anneeId) { setError('Aucune année scolaire.'); return; }
          const body = { anneeScolaireId: anneeId, nom: classe.nom, niveau: classe.niveau, serie: classe.serie, titulaireId: classe.titulaireId ? Number(classe.titulaireId) : null };
          void run(() => classeEdit
            ? apiSend(`/api/classes/${classeEdit.id}`, 'PUT', body).then(() => undefined)
            : apiSend('/api/classes', 'POST', body).then(() => undefined));
        }}>
          <input required placeholder="Classe" value={classe.nom} onChange={(e) => setClasse({ ...classe, nom: e.target.value })} className={field} />
          <select value={classe.titulaireId} onChange={(e) => setClasse({ ...classe, titulaireId: e.target.value })} className={field}>
            <option value="">Sans titulaire</option>
            {profs.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}
          </select>
          <button type="submit" className={primary}>{classeEdit ? 'Mettre à jour la classe' : 'Créer la classe'}</button>
          {classeEdit && <button type="button" className="text-[12px]" onClick={() => setClasseEdit(null)}>Nouvelle fiche</button>}
        </form>
        <ul className="text-[13px] space-y-1">
          {affectations.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span>{nom(profs, item.professeurId)} · {nom(matieres, item.matiereId)} · {nom(classes, item.classeId)}</span>
              <span className="flex gap-3">
                <button type="button" className="font-semibold text-[#00236f]" onClick={() => void open<Affectation>(`/api/affectations/${item.id}`, (detail) => {
                  setAffectationEdit(detail);
                  setAffectation({ professeurId: String(detail.professeurId), matiereId: String(detail.matiereId), classeId: String(detail.classeId) });
                })}>Détails</button>
                <button type="button" className="font-semibold text-[#ba1a1a]" onClick={() => remove(`/api/affectations/${item.id}`, 'cette affectation', () => setAffectationEdit(null))}>Supprimer</button>
              </span>
            </li>
          ))}
        </ul>
        {affectationEdit && <p className="text-[12px] text-[#444651]">Fiche n° {affectationEdit.id} — enseignant {nom(profs, affectationEdit.professeurId)}, matière {nom(matieres, affectationEdit.matiereId)}, classe {nom(classes, affectationEdit.classeId)}</p>}
        <form className="flex flex-wrap gap-2" onSubmit={(e) => {
          e.preventDefault();
          const body = { professeurId: Number(affectation.professeurId), matiereId: Number(affectation.matiereId), classeId: Number(affectation.classeId) };
          void run(() => affectationEdit
            ? apiSend(`/api/affectations/${affectationEdit.id}`, 'PUT', body).then(() => undefined)
            : apiSend('/api/affectations', 'POST', body).then(() => undefined));
        }}>
          <select required value={affectation.professeurId} onChange={(e) => setAffectation({ ...affectation, professeurId: e.target.value })} className={field}>
            <option value="">Enseignant</option>
            {profs.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}
          </select>
          <select required value={affectation.matiereId} onChange={(e) => setAffectation({ ...affectation, matiereId: e.target.value })} className={field}>
            <option value="">Matière</option>
            {matieres.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}
          </select>
          <select required value={affectation.classeId} onChange={(e) => setAffectation({ ...affectation, classeId: e.target.value })} className={field}>
            <option value="">Classe</option>
            {classes.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}
          </select>
          <button type="submit" className={primary}>{affectationEdit ? 'Mettre à jour l’affectation' : 'Affecter'}</button>
        </form>
      </section>

      <section className="bg-white border border-[#eaedff] rounded p-5 space-y-3">
        <h3 className="font-bold text-[#00236f]">Élèves</h3>
        <ul className="text-[13px] space-y-1">
          {eleves.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span>{item.nomComplet} — {item.matricule} — {nom(classes, item.classeId)}</span>
              <span className="flex gap-3">
                <button type="button" className="font-semibold text-[#00236f]" onClick={() => void open<Eleve>(`/api/eleves/${item.id}`, (detail) => {
                  setEleveEdit(detail);
                  setEleve({ nomComplet: detail.nomComplet, matricule: detail.matricule, genre: detail.genre, classeId: String(detail.classeId), sessionId: detail.sessionId ? String(detail.sessionId) : '', numeroTable: detail.numeroTable ? String(detail.numeroTable) : '' });
                })}>Détails</button>
                <button type="button" className="font-semibold text-[#ba1a1a]" onClick={() => remove(`/api/eleves/${item.id}`, item.nomComplet, () => setEleveEdit(null))}>Supprimer</button>
              </span>
            </li>
          ))}
        </ul>
        {eleveEdit && <p className="text-[12px] text-[#444651]">Fiche n° {eleveEdit.id} — {eleveEdit.nomComplet} — {eleveEdit.genre} — table {eleveEdit.numeroTable ?? '—'} — {eleveEdit.lieuNaissance || 'lieu non renseigné'}</p>}
        <form className="flex flex-wrap gap-2" onSubmit={(e) => {
          e.preventDefault();
          if (eleve.genre !== 'M' && eleve.genre !== 'F') { setError('Le genre doit être M ou F.'); return; }
          const body = {
            nomComplet: eleve.nomComplet.trim(),
            matricule: eleve.matricule.trim(),
            genre: eleve.genre,
            classeId: Number(eleve.classeId),
            sessionId: eleve.sessionId ? Number(eleve.sessionId) : null,
            numeroTable: eleve.numeroTable ? Number(eleve.numeroTable) : null,
          };
          void run(() => eleveEdit
            ? apiSend(`/api/eleves/${eleveEdit.id}`, 'PUT', body).then(() => undefined)
            : apiSend('/api/eleves', 'POST', body).then(() => undefined));
        }}>
          <input required placeholder="Nom complet" value={eleve.nomComplet} onChange={(e) => setEleve({ ...eleve, nomComplet: e.target.value })} className={field} />
          <input required placeholder="Matricule" value={eleve.matricule} onChange={(e) => setEleve({ ...eleve, matricule: e.target.value })} className={field} />
          <select value={eleve.genre} onChange={(e) => setEleve({ ...eleve, genre: e.target.value })} className={field}>
            <option value="F">F</option>
            <option value="M">M</option>
          </select>
          <select required value={eleve.classeId} onChange={(e) => setEleve({ ...eleve, classeId: e.target.value })} className={field}>
            <option value="">Classe</option>
            {classes.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}
          </select>
          <select value={eleve.sessionId} onChange={(e) => setEleve({ ...eleve, sessionId: e.target.value })} className={field}>
            <option value="">Session</option>
            {sessions.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}
          </select>
          <button type="submit" className={primary}>{eleveEdit ? 'Mettre à jour l’élève' : 'Inscrire l’élève'}</button>
        </form>
      </section>

      <section className="bg-white border border-[#eaedff] rounded p-5 space-y-3">
        <h3 className="font-bold text-[#00236f]">Notes</h3>
        <label className="text-[13px] flex gap-2 items-center">
          Session affichée
          <select value={sessionNotes} onChange={(e) => { sessionNotesRef.current = e.target.value; setSessionNotes(e.target.value); void run(async () => { setNotes(await apiGet<Note[]>(`/api/notes?sessionId=${e.target.value}`)); }, 'Notes affichées.'); }} className={field}>
            {sessions.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}
          </select>
        </label>
        <ul className="text-[13px] space-y-1">
          {notes.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span>{nom(eleves, item.eleveId)} — {nom(matieres, item.matiereId)} — {item.absent ? 'absent' : item.valeur}</span>
              <span className="flex gap-3">
                <button type="button" className="font-semibold text-[#00236f]" onClick={() => void open<Note>(`/api/notes/${item.id}`, (detail) => {
                  setNoteEdit(detail);
                  setNote({ eleveId: String(detail.eleveId), matiereId: String(detail.matiereId), sessionId: String(detail.sessionId), valeur: detail.valeur == null ? '' : String(detail.valeur), absent: detail.absent });
                })}>Détails</button>
                <button type="button" className="font-semibold text-[#ba1a1a]" onClick={() => remove(`/api/notes/${item.id}`, 'cette note', () => setNoteEdit(null))}>Supprimer</button>
              </span>
            </li>
          ))}
        </ul>
        {noteEdit && <p className="text-[12px] text-[#444651]">Fiche n° {noteEdit.id} — élève {nom(eleves, noteEdit.eleveId)} — matière {nom(matieres, noteEdit.matiereId)} — {noteEdit.absent ? 'absent' : `${noteEdit.valeur}/20`}</p>}
        <form className="flex flex-wrap gap-2 items-center" onSubmit={(e) => {
          e.preventDefault();
          const valeur = note.absent ? null : Number(note.valeur);
          if (!note.absent && (valeur == null || !Number.isFinite(valeur) || valeur < 0 || valeur > 20)) { setError('La note doit être comprise entre 0 et 20, ou marquée absente.'); return; }
          const body = { eleveId: Number(note.eleveId), matiereId: Number(note.matiereId), sessionId: Number(note.sessionId), valeur, absent: note.absent };
          void run(() => noteEdit
            ? apiSend(`/api/notes/${noteEdit.id}`, 'PUT', body).then(() => undefined)
            : apiSend('/api/notes', 'POST', body).then(() => undefined));
        }}>
          <select required value={note.eleveId} onChange={(e) => setNote({ ...note, eleveId: e.target.value })} className={field}>
            <option value="">Élève</option>
            {eleves.map((item) => <option key={item.id} value={item.id}>{item.nomComplet}</option>)}
          </select>
          <select required value={note.matiereId} onChange={(e) => setNote({ ...note, matiereId: e.target.value })} className={field}>
            <option value="">Matière</option>
            {matieres.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}
          </select>
          <select required value={note.sessionId} onChange={(e) => setNote({ ...note, sessionId: e.target.value })} className={field}>
            <option value="">Session</option>
            {sessions.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}
          </select>
          <input placeholder="Note /20" value={note.valeur} onChange={(e) => setNote({ ...note, valeur: e.target.value })} className={field} disabled={note.absent} />
          <label className="text-[13px] flex gap-1 items-center"><input type="checkbox" checked={note.absent} onChange={(e) => setNote({ ...note, absent: e.target.checked })} /> Absent</label>
          <button type="submit" className={primary}>{noteEdit ? 'Mettre à jour la note' : 'Enregistrer la note'}</button>
        </form>
      </section>
    </div>
  );
};
