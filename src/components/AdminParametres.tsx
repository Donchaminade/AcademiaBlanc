import React, { useEffect, useRef, useState } from 'react';
import { apiDelete, apiGet, apiSend, getSession, getToken } from '../api/client';
import { Ressource, usePermissions } from '../api/permissions';
import { confirmDelete, showError, toastError, toastSuccess } from '../utils/alerts';
import { ImportElevesPanel } from './ImportElevesPanel';
import { UtilisateursSection } from './UtilisateursSection';
import { AdminSection } from '../types';

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

/** Ordre conseillé de saisie : chaque étape dépend des précédentes. */
export const ADMIN_STEPS: { section: AdminSection; label: string }[] = [
  { section: 'annees', label: 'Année scolaire' },
  { section: 'centres', label: 'Centre' },
  { section: 'sessions', label: 'Session' },
  { section: 'matieres', label: 'Matières & coefficients' },
  { section: 'enseignants', label: 'Enseignants' },
  { section: 'classes', label: 'Classes' },
  { section: 'affectations', label: 'Affectations' },
  { section: 'eleves', label: 'Élèves' },
  { section: 'notes', label: 'Notes' },
];

export const adminSectionAnchor = (section: AdminSection) => `admin-section-${section}`;

/** Onglets de l’écran : chaque onglet regroupe plusieurs sections fines. */
type AdminGroup = 'annees' | 'matieres' | 'enseignants' | 'eleves' | 'notes' | 'utilisateurs';

const GROUPS: { key: AdminGroup; label: string; icon: string; sections: AdminSection[] }[] = [
  { key: 'annees', label: 'Année & Sessions', icon: 'calendar_month', sections: ['annees', 'centres', 'sessions'] },
  { key: 'matieres', label: 'Matières & Coefficients', icon: 'menu_book', sections: ['matieres', 'coefficients'] },
  { key: 'enseignants', label: 'Enseignants & Classes', icon: 'groups', sections: ['enseignants', 'classes', 'affectations'] },
  { key: 'eleves', label: 'Élèves', icon: 'school', sections: ['eleves'] },
  { key: 'notes', label: 'Notes', icon: 'grading', sections: ['notes'] },
  { key: 'utilisateurs', label: 'Utilisateurs & droits', icon: 'manage_accounts', sections: ['utilisateurs'] },
];

/** Ressource de permission correspondant à chaque section. */
const RESSOURCE_DE: Record<AdminSection, Ressource> = {
  annees: 'ANNEES',
  centres: 'CENTRES',
  sessions: 'SESSIONS',
  matieres: 'MATIERES',
  coefficients: 'COEFFICIENTS',
  enseignants: 'ENSEIGNANTS',
  classes: 'CLASSES',
  affectations: 'AFFECTATIONS',
  eleves: 'ELEVES',
  notes: 'NOTES',
  utilisateurs: 'UTILISATEURS',
};

const groupOf = (section: AdminSection): AdminGroup =>
  GROUPS.find((g) => g.sections.includes(section))?.key ?? 'annees';

interface AdminParametresProps {
  /** Section à afficher et vers laquelle défiler à l’ouverture (ou quand elle change). */
  section?: AdminSection | null;
  /** Change à chaque demande de défilement, même vers la même section. */
  scrollKey?: number;
  /** Appelé après chaque création / modification / suppression réussie. */
  onDataChanged?: () => void;
}

const field = 'w-full bg-[#f2f3ff] text-[13px] py-2 px-3 rounded border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5] disabled:opacity-60 disabled:cursor-not-allowed';
const primary = 'inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 rounded bg-[#00236f] text-white text-[12px] font-bold hover:bg-[#1e3a8a] transition-colors shadow-xs';
const ghost = 'inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 rounded bg-[#f2f3ff] text-[#444651] text-[12px] font-semibold hover:bg-[#e2e7ff] transition-colors';

const EMPTY = {
  centre: { nom: '', code: '', ville: 'Lomé' },
  session: { nom: '', typeExamen: 'BACCALAURÉAT II', statut: 'OUVERTE', serie: 'Série D', anneeScolaireId: '', centreId: '' },
  matiere: { nom: '', code: '' },
  prof: { nom: '', email: '' },
  classe: { nom: '', niveau: 'Terminale', serie: 'Série D', titulaireId: '', anneeScolaireId: '' },
  affectation: { professeurId: '', matiereId: '', classeId: '' },
  coefficient: { matiereId: '', classeId: '', serie: '', valeur: '2' },
  eleve: { nomComplet: '', matricule: '', genre: 'F', classeId: '', sessionId: '', numeroTable: '' },
  note: { eleveId: '', matiereId: '', sessionId: '', valeur: '', absent: false },
};

/* ------------------------------------------------------------------ */
/* Briques d’interface                                                 */
/* ------------------------------------------------------------------ */

const SectionCard: React.FC<{ id: AdminSection; icon: string; title: string; description: string; count?: number; children: React.ReactNode }> = ({ id, icon, title, description, count, children }) => (
  <section id={adminSectionAnchor(id)} className="bg-white p-5 rounded border border-[#eaedff] shadow-xs space-y-4 scroll-mt-6">
    <header className="flex flex-wrap items-start justify-between gap-2 border-b border-[#eaedff] pb-3">
      <div className="flex items-start gap-3 min-w-0">
        <span className="shrink-0 w-9 h-9 rounded bg-[#eaedff] text-[#0051d5] flex items-center justify-center">
          <span className="material-symbols-outlined text-xl">{icon}</span>
        </span>
        <div className="min-w-0">
          <h3 className="text-[14px] font-bold text-[#00236f] uppercase tracking-wide">{title}</h3>
          <p className="text-[12px] text-[#444651] mt-0.5">{description}</p>
        </div>
      </div>
      {count !== undefined && (
        <span className="shrink-0 text-[11px] font-bold text-[#00236f] bg-[#f2f3ff] border border-[#eaedff] px-2.5 py-1 rounded-full">
          {count} {count > 1 ? 'fiches' : 'fiche'}
        </span>
      )}
    </header>
    {children}
  </section>
);

const Field: React.FC<{ label: string; className?: string; children: React.ReactNode }> = ({ label, className = '', children }) => (
  <label className={`flex flex-col gap-1 min-w-0 ${className}`}>
    <span className="text-[11px] font-bold uppercase tracking-wide text-[#444651]">{label}</span>
    {children}
  </label>
);

const FormActions: React.FC<{ editing: boolean; createLabel: string; updateLabel?: string; onCancel?: () => void }> = ({ editing, createLabel, updateLabel = 'Mettre à jour', onCancel }) => (
  <div className="col-span-full flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
    {editing && onCancel && (
      <button type="button" className={ghost} onClick={onCancel}>
        <span className="material-symbols-outlined text-base">add</span>
        Nouvelle fiche
      </button>
    )}
    <button type="submit" className={primary}>
      <span className="material-symbols-outlined text-base">{editing ? 'save' : 'add_circle'}</span>
      {editing ? updateLabel : createLabel}
    </button>
  </div>
);

const EditBanner: React.FC<{ id: number; summary: React.ReactNode }> = ({ id, summary }) => (
  <div className="flex flex-wrap items-center gap-2 rounded border border-[#dce1ff] bg-[#f2f3ff] px-3 py-2 text-[12px] text-[#00236f]">
    <span className="material-symbols-outlined text-base text-[#0051d5]">edit</span>
    <span><strong>Modification de la fiche n° {id}</strong> <span className="text-[#444651]">— {summary}</span></span>
  </div>
);

interface Column<T> { header: string; render: (row: T) => React.ReactNode; className?: string }

function DataTable<T extends { id: number }>({ columns, rows, emptyIcon, emptyText, editingId, onEdit, onDelete, canCreate = true, canEdit = true, canDelete = true }: {
  columns: Column<T>[];
  rows: T[];
  emptyIcon: string;
  emptyText: string;
  editingId?: number | null;
  onEdit: (row: T) => void;
  onDelete: (row: T) => void;
  /** Droits CREER / MODIFIER / SUPPRIMER de l’utilisateur : les boutons absents ne sont pas rendus. */
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 rounded border border-dashed border-[#dce1ff] bg-[#f2f3ff] px-4 py-6 text-center">
        <span className="material-symbols-outlined text-2xl text-[#757682]">{emptyIcon}</span>
        <p className="text-[13px] font-semibold text-[#444651]">{emptyText}</p>
        <p className="text-[11px] text-[#757682]">{canCreate ? 'Utilisez le formulaire ci-dessous pour ajouter une première fiche.' : 'Votre compte ne peut pas créer de fiche ici.'}</p>
      </div>
    );
  }
  const hasActions = canEdit || canDelete;
  return (
    <div className="overflow-x-auto rounded border border-[#eaedff]">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="bg-[#f2f3ff] text-left text-[11px] uppercase tracking-wide text-[#444651]">
            {columns.map((col) => <th key={col.header} className={`px-3 py-2 font-bold whitespace-nowrap ${col.className ?? ''}`}>{col.header}</th>)}
            {hasActions && <th className="px-3 py-2 font-bold text-right">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={`border-t border-[#eaedff] transition-colors ${editingId === row.id ? 'bg-[#eaedff]/60' : 'hover:bg-[#faf8ff]'}`}>
              {columns.map((col) => <td key={col.header} className={`px-3 py-2 text-[#131b2e] ${col.className ?? ''}`}>{col.render(row)}</td>)}
              {hasActions && (
                <td className="px-3 py-1.5 whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => onEdit(row)}
                        title="Modifier"
                        aria-label="Modifier"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[#00236f] hover:bg-[#eaedff] text-[12px] font-semibold transition-colors"
                      >
                        <span className="material-symbols-outlined text-base">edit</span>
                        <span className="hidden md:inline">Modifier</span>
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(row)}
                        title="Supprimer"
                        aria-label="Supprimer"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[#ba1a1a] hover:bg-[#ffdad6] text-[12px] font-semibold transition-colors"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                        <span className="hidden md:inline">Supprimer</span>
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const Badge: React.FC<{ tone?: 'blue' | 'green' | 'grey' | 'red'; children: React.ReactNode }> = ({ tone = 'grey', children }) => {
  const tones = {
    blue: 'bg-[#eaedff] text-[#00236f]',
    green: 'bg-[#dcfce7] text-[#166534]',
    grey: 'bg-[#f2f3ff] text-[#444651]',
    red: 'bg-[#ffdad6] text-[#ba1a1a]',
  };
  return <span className={`inline-flex items-center text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${tones[tone]}`}>{children}</span>;
};

/* ------------------------------------------------------------------ */
/* Écran d’administration                                              */
/* ------------------------------------------------------------------ */

const sectionFromHash = (): AdminSection | null => {
  const hash = typeof window !== 'undefined' ? window.location.hash.replace(/^#admin-/, '') : '';
  return ADMIN_STEPS.some((s) => s.section === hash) || hash === 'coefficients' || hash === 'utilisateurs' ? (hash as AdminSection) : null;
};

export const AdminParametres: React.FC<AdminParametresProps> = ({ section: requestedSection, scrollKey = 0, onDataChanged }) => {
  const { can, permissions: mesDroits } = usePermissions();
  /** Droits de l’utilisateur sur une section : pilotent formulaires et boutons (le serveur reste la référence). */
  const droits = (section: AdminSection) => {
    const r = RESSOURCE_DE[section];
    return { voir: can(r, 'VOIR'), creer: can(r, 'CREER'), modifier: can(r, 'MODIFIER'), supprimer: can(r, 'SUPPRIMER') };
  };
  /** Un onglet est visible si au moins une de ses sections est visible. */
  const groupeVisible = (g: AdminGroup) => GROUPS.find((item) => item.key === g)?.sections.some((sec) => droits(sec).voir) ?? false;
  const [group, setGroup] = useState<AdminGroup>(() => groupOf(requestedSection ?? sectionFromHash() ?? 'annees'));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
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
  const [centre, setCentre] = useState(EMPTY.centre);
  const [centreEdit, setCentreEdit] = useState<Centre | null>(null);
  const [session, setSession] = useState(EMPTY.session);
  const [sessionEdit, setSessionEdit] = useState<Session | null>(null);
  const [matiere, setMatiere] = useState(EMPTY.matiere);
  const [matiereEdit, setMatiereEdit] = useState<Matiere | null>(null);
  const [prof, setProf] = useState(EMPTY.prof);
  const [profEdit, setProfEdit] = useState<Professeur | null>(null);
  const [classe, setClasse] = useState(EMPTY.classe);
  const [classeEdit, setClasseEdit] = useState<Classe | null>(null);
  const [affectation, setAffectation] = useState(EMPTY.affectation);
  const [affectationEdit, setAffectationEdit] = useState<Affectation | null>(null);
  const [coefficient, setCoefficient] = useState(EMPTY.coefficient);
  const [coefficientEdit, setCoefficientEdit] = useState<Coefficient | null>(null);
  const [eleve, setEleve] = useState(EMPTY.eleve);
  const [eleveEdit, setEleveEdit] = useState<Eleve | null>(null);
  const [note, setNote] = useState(EMPTY.note);
  const [noteEdit, setNoteEdit] = useState<Note | null>(null);
  const [sessionNotes, setSessionNotes] = useState('');
  const sessionNotesRef = useRef('');

  const reset = {
    annee: () => { setAnneeEdit(null); setAnnee('2025-2026'); },
    centre: () => { setCentreEdit(null); setCentre(EMPTY.centre); },
    session: () => { setSessionEdit(null); setSession(EMPTY.session); },
    matiere: () => { setMatiereEdit(null); setMatiere(EMPTY.matiere); },
    coefficient: () => { setCoefficientEdit(null); setCoefficient(EMPTY.coefficient); },
    prof: () => { setProfEdit(null); setProf(EMPTY.prof); },
    classe: () => { setClasseEdit(null); setClasse(EMPTY.classe); },
    affectation: () => { setAffectationEdit(null); setAffectation(EMPTY.affectation); },
    eleve: () => { setEleveEdit(null); setEleve(EMPTY.eleve); },
    note: () => { setNoteEdit(null); setNote(EMPTY.note); },
  };

  const nom = (liste: { id: number; nom?: string; libelle?: string; nomComplet?: string }[], id?: number) =>
    liste.find((item) => item.id === id)?.nom
    || liste.find((item) => item.id === id)?.libelle
    || liste.find((item) => item.id === id)?.nomComplet
    || (id ? String(id) : '—');

  const load = async () => {
    if (!getToken()) return;
    // Seules les listes autorisées (droit VOIR) sont demandées : les autres restent vides au lieu de provoquer un 403.
    const si = <T,>(section: AdminSection, path: string): Promise<T[]> => (droits(section).voir ? apiGet<T[]>(path) : Promise.resolve([]));
    const [a, c, s, m, p, k, af, coef, el] = await Promise.all([
      si<Annee>('annees', '/api/annees-scolaires'),
      si<Centre>('centres', '/api/centres'),
      si<Session>('sessions', '/api/sessions'),
      si<Matiere>('matieres', '/api/matieres'),
      si<Professeur>('enseignants', '/api/professeurs'),
      si<Classe>('classes', '/api/classes'),
      si<Affectation>('affectations', '/api/affectations'),
      si<Coefficient>('coefficients', '/api/coefficients'),
      si<Eleve>('eleves', '/api/eleves'),
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
    if (sessionId && droits('notes').voir) {
      sessionNotesRef.current = sessionId;
      setSessionNotes(sessionId);
      setNotes(await apiGet<Note[]>(`/api/notes?sessionId=${sessionId}`));
    } else {
      setNotes([]);
    }
  };

  const reload = () => {
    setLoading(true);
    setLoadError('');
    load()
      .catch((err: Error) => setLoadError(err.message))
      .finally(() => setLoading(false));
  };

  // Recharge quand les droits changent (rafraîchissement de session après connexion).
  const cleDroits = mesDroits.join(',');
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleDroits]);

  useEffect(() => {
    if (scrollKey === 0 && !requestedSection) return;
    if (requestedSection) setGroup(groupOf(requestedSection));
    // Attendre le rendu de l’onglet (il dépend du token) avant de défiler.
    const timer = window.setTimeout(() => {
      const node = requestedSection ? document.getElementById(adminSectionAnchor(requestedSection)) : null;
      if (node) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [requestedSection, scrollKey]);

  const run = async (action: () => Promise<void>, ok = 'Enregistré.', afterSuccess?: () => void) => {
    try {
      await action();
      await load();
      afterSuccess?.();
      onDataChanged?.();
      toastSuccess(ok);
    } catch (err) {
      await showError('Échec de l’enregistrement', err instanceof Error ? err.message : 'Une erreur inattendue est survenue.');
    }
  };

  const open = async <T,>(path: string, apply: (item: T) => void) => {
    try {
      apply(await apiGet<T>(path));
    } catch (err) {
      await showError('Fiche introuvable', err instanceof Error ? err.message : 'Impossible de charger le détail.');
    }
  };

  const remove = async (path: string, label: string, clear: () => void) => {
    const ok = await confirmDelete(label, 'La fiche est retirée si aucun élément lié ne la retient.');
    if (!ok) return;
    clear();
    try {
      await apiDelete(path);
      await load();
      onDataChanged?.();
      toastSuccess(`« ${label} » supprimé.`);
    } catch (err) {
      await showError('Suppression impossible', err instanceof Error ? err.message : 'Une erreur inattendue est survenue.');
    }
  };

  if (!getToken()) {
    return (
      <div className="bg-white border border-[#eaedff] rounded p-6 flex flex-col sm:flex-row items-start gap-4 shadow-xs">
        <span className="shrink-0 w-10 h-10 rounded bg-[#eaedff] text-[#0051d5] flex items-center justify-center">
          <span className="material-symbols-outlined">lock</span>
        </span>
        <div>
          <h3 className="text-[14px] font-bold text-[#00236f]">Connexion requise</h3>
          <p className="text-[13px] text-[#444651] mt-1">
            Connectez l’établissement via « Compte établissement » pour gérer les années, centres, sessions, matières et enseignants sur l’API.
          </p>
        </div>
      </div>
    );
  }

  const etablissement = getSession()?.nomEtablissement;
  const counts: Record<AdminGroup, number> = {
    annees: annees.length + centres.length + sessions.length,
    matieres: matieres.length + coefficients.length,
    enseignants: profs.length + classes.length + affectations.length,
    eleves: eleves.length,
    notes: notes.length,
    utilisateurs: 0,
  };
  const groupesVisibles = GROUPS.filter((item) => groupeVisible(item.key));
  const groupeCourant: AdminGroup | null = groupeVisible(group) ? group : (groupesVisibles[0]?.key ?? null);

  return (
    <div className="space-y-5">
      {/* Bandeau */}
      <div className="bg-white rounded border border-[#eaedff] shadow-xs p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="shrink-0 w-10 h-10 rounded bg-[#00236f] text-white flex items-center justify-center">
            <span className="material-symbols-outlined">admin_panel_settings</span>
          </span>
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold text-[#00236f] truncate">Référentiel de l’établissement</h3>
            <p className="text-[12px] text-[#444651]">
              {etablissement ? <>Données API de <strong>{etablissement}</strong>.</> : 'Données synchronisées avec l’API.'} Les modifications sont enregistrées immédiatement.
            </p>
          </div>
        </div>
        <button type="button" onClick={reload} disabled={loading} className={ghost}>
          <span className={`material-symbols-outlined text-base ${loading ? 'animate-spin' : ''}`}>refresh</span>
          {loading ? 'Chargement…' : 'Actualiser'}
        </button>
      </div>

      {loadError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded border border-[#ffdad6] bg-[#fff5f4] px-4 py-3 text-[13px] text-[#ba1a1a]">
          <span className="inline-flex items-center gap-2">
            <span className="material-symbols-outlined text-base">error</span>
            {loadError}
          </span>
          <button type="button" onClick={reload} className="font-bold underline">Réessayer</button>
        </div>
      )}

      {/* Sous-navigation */}
      <nav aria-label="Sections d’administration" className="bg-white rounded border border-[#eaedff] shadow-xs p-1.5 flex gap-1 overflow-x-auto">
        {groupesVisibles.map((item) => {
          const active = groupeCourant === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setGroup(item.key)}
              aria-current={active ? 'page' : undefined}
              className={`inline-flex shrink-0 items-center gap-2 px-3.5 py-2 rounded text-[12px] font-bold whitespace-nowrap transition-colors ${
                active ? 'bg-[#00236f] text-white shadow-xs' : 'text-[#444651] hover:bg-[#f2f3ff] hover:text-[#00236f]'
              }`}
            >
              <span className="material-symbols-outlined text-base">{item.icon}</span>
              <span>{item.label}</span>
              {item.key !== 'utilisateurs' && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-[#eaedff] text-[#00236f]'}`}>{counts[item.key]}</span>
              )}
            </button>
          );
        })}
      </nav>

      {groupesVisibles.length === 0 && (
        <div className="bg-white border border-[#eaedff] rounded p-6 text-[13px] text-[#444651]">
          Votre compte ne détient aucun droit de consultation sur le référentiel. Rapprochez-vous du responsable de l’établissement.
        </div>
      )}

      {/* ---------------------------------------------------------- */}
      {groupeCourant === 'utilisateurs' && <UtilisateursSection mode="etablissement" onChanged={onDataChanged} />}

      {/* ---------------------------------------------------------- */}
      {groupeCourant === 'annees' && (
        <div className="space-y-5">
          {droits('annees').voir && (
          <SectionCard id="annees" icon="calendar_month" title="Années scolaires" description="Définissez les années académiques et l’année courante utilisée par défaut." count={annees.length}>
            <DataTable<Annee>
              rows={annees}
              editingId={anneeEdit?.id}
              canCreate={droits('annees').creer}
              canEdit={droits('annees').modifier}
              canDelete={droits('annees').supprimer}
              emptyIcon="event_busy"
              emptyText="Aucune année scolaire pour l’instant"
              columns={[
                { header: 'Libellé', render: (r) => <span className="font-semibold">{r.libelle}</span> },
                { header: 'Statut', render: (r) => r.courante ? <Badge tone="green">Courante</Badge> : <Badge>Archivée</Badge> },
              ]}
              onEdit={(r) => void open<Annee>(`/api/annees-scolaires/${r.id}`, (detail) => { setAnneeEdit(detail); setAnnee(detail.libelle); })}
              onDelete={(r) => void remove(`/api/annees-scolaires/${r.id}`, r.libelle, reset.annee)}
            />
            {anneeEdit && <EditBanner id={anneeEdit.id} summary={<>{anneeEdit.libelle} · courante : {anneeEdit.courante ? 'oui' : 'non'}</>} />}
            {(droits('annees').creer || (anneeEdit && droits('annees').modifier)) && (
            <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" onSubmit={(e) => {
              e.preventDefault();
              const body = { libelle: annee.trim(), courante: anneeEdit?.courante ?? false };
              void run(() => anneeEdit
                ? apiSend(`/api/annees-scolaires/${anneeEdit.id}`, 'PUT', body).then(() => undefined)
                : apiSend('/api/annees-scolaires', 'POST', body).then(() => undefined), anneeEdit ? 'Année scolaire mise à jour.' : 'Année scolaire créée.', reset.annee);
            }}>
              <Field label="Libellé de l’année">
                <input required placeholder="2025-2026" value={annee} onChange={(e) => setAnnee(e.target.value)} className={field} />
              </Field>
              <FormActions editing={!!anneeEdit} createLabel="Créer l’année" onCancel={reset.annee} />
            </form>
            )}
          </SectionCard>
          )}

          {droits('centres').voir && (
          <SectionCard id="centres" icon="location_city" title="Centres d’examen" description="Lieux de composition rattachés à l’établissement, identifiés par un code court." count={centres.length}>
            <DataTable<Centre>
              rows={centres}
              editingId={centreEdit?.id}
              canCreate={droits('centres').creer}
              canEdit={droits('centres').modifier}
              canDelete={droits('centres').supprimer}
              emptyIcon="domain_disabled"
              emptyText="Aucun centre d’examen pour l’instant"
              columns={[
                { header: 'Code', render: (r) => <Badge tone="blue">{r.code}</Badge>, className: 'w-24' },
                { header: 'Nom', render: (r) => <span className="font-semibold">{r.nom}</span> },
                { header: 'Ville', render: (r) => r.ville || <span className="text-[#757682]">—</span> },
              ]}
              onEdit={(r) => void open<Centre>(`/api/centres/${r.id}`, (detail) => { setCentreEdit(detail); setCentre({ nom: detail.nom, code: detail.code, ville: detail.ville || '' }); })}
              onDelete={(r) => void remove(`/api/centres/${r.id}`, r.nom, reset.centre)}
            />
            {centreEdit && <EditBanner id={centreEdit.id} summary={<>{centreEdit.code} · {centreEdit.nom} · {centreEdit.ville || 'ville non renseignée'}</>} />}
            {(droits('centres').creer || (centreEdit && droits('centres').modifier)) && (
            <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" onSubmit={(e) => {
              e.preventDefault();
              void run(() => centreEdit
                ? apiSend(`/api/centres/${centreEdit.id}`, 'PUT', centre).then(() => undefined)
                : apiSend('/api/centres', 'POST', centre).then(() => undefined), centreEdit ? 'Centre mis à jour.' : 'Centre créé.', reset.centre);
            }}>
              <Field label="Nom du centre" className="lg:col-span-2">
                <input required placeholder="CS Harmonia" value={centre.nom} onChange={(e) => setCentre({ ...centre, nom: e.target.value })} className={field} />
              </Field>
              <Field label="Code">
                <input required placeholder="CSH" value={centre.code} onChange={(e) => setCentre({ ...centre, code: e.target.value })} className={field} />
              </Field>
              <Field label="Ville">
                <input placeholder="Lomé" value={centre.ville} onChange={(e) => setCentre({ ...centre, ville: e.target.value })} className={field} />
              </Field>
              <FormActions editing={!!centreEdit} createLabel="Créer le centre" onCancel={reset.centre} />
            </form>
            )}
          </SectionCard>
          )}

          {droits('sessions').voir && (
          <SectionCard id="sessions" icon="event_note" title="Sessions d’examen" description="Une session relie un examen à une année scolaire et à un centre." count={sessions.length}>
            <DataTable<Session>
              rows={sessions}
              editingId={sessionEdit?.id}
              canCreate={droits('sessions').creer}
              canEdit={droits('sessions').modifier}
              canDelete={droits('sessions').supprimer}
              emptyIcon="event_busy"
              emptyText="Aucune session d’examen pour l’instant"
              columns={[
                { header: 'Session', render: (r) => <span className="font-semibold">{r.nom}</span> },
                { header: 'Examen', render: (r) => r.typeExamen },
                { header: 'Année', render: (r) => nom(annees, r.anneeScolaireId) },
                { header: 'Centre', render: (r) => nom(centres, r.centreId) },
                { header: 'Statut', render: (r) => <Badge tone={r.statut === 'OUVERTE' ? 'green' : 'grey'}>{r.statut}</Badge> },
              ]}
              onEdit={(r) => void open<Session>(`/api/sessions/${r.id}`, (detail) => {
                setSessionEdit(detail);
                setSession({ nom: detail.nom, typeExamen: detail.typeExamen, statut: detail.statut, serie: detail.serie || '', anneeScolaireId: String(detail.anneeScolaireId), centreId: String(detail.centreId) });
              })}
              onDelete={(r) => void remove(`/api/sessions/${r.id}`, r.nom, reset.session)}
            />
            {sessionEdit && <EditBanner id={sessionEdit.id} summary={<>{sessionEdit.typeExamen} · année {nom(annees, sessionEdit.anneeScolaireId)} · centre {nom(centres, sessionEdit.centreId)}</>} />}
            {(droits('sessions').creer || (sessionEdit && droits('sessions').modifier)) && (
            <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" onSubmit={(e) => {
              e.preventDefault();
              const anneeId = Number(session.anneeScolaireId || annees[0]?.id);
              const centreId = Number(session.centreId || centres[0]?.id);
              if (!anneeId || !centreId) { toastError('Créez d’abord une année et un centre.'); return; }
              const body = { ...session, anneeScolaireId: anneeId, centreId };
              void run(() => sessionEdit
                ? apiSend(`/api/sessions/${sessionEdit.id}`, 'PUT', body).then(() => undefined)
                : apiSend('/api/sessions', 'POST', body).then(() => undefined), sessionEdit ? 'Session mise à jour.' : 'Session créée.', reset.session);
            }}>
              <Field label="Nom de la session" className="lg:col-span-2">
                <input required placeholder="BEPC BLANC" value={session.nom} onChange={(e) => setSession({ ...session, nom: e.target.value })} className={field} />
              </Field>
              <Field label="Année scolaire">
                <select value={session.anneeScolaireId} onChange={(e) => setSession({ ...session, anneeScolaireId: e.target.value })} className={field}>
                  <option value="">Année courante de la liste</option>
                  {annees.map((item) => <option key={item.id} value={item.id}>{item.libelle}</option>)}
                </select>
              </Field>
              <Field label="Centre d’examen">
                <select value={session.centreId} onChange={(e) => setSession({ ...session, centreId: e.target.value })} className={field}>
                  <option value="">Premier centre de la liste</option>
                  {centres.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}
                </select>
              </Field>
              <FormActions editing={!!sessionEdit} createLabel="Créer la session" onCancel={reset.session} />
            </form>
            )}
          </SectionCard>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------- */}
      {groupeCourant === 'matieres' && (
        <div className="space-y-5">
          {droits('matieres').voir && (
          <SectionCard id="matieres" icon="menu_book" title="Matières" description="Catalogue des disciplines évaluées, avec un code court pour les bulletins." count={matieres.length}>
            <DataTable<Matiere>
              rows={matieres}
              editingId={matiereEdit?.id}
              canCreate={droits('matieres').creer}
              canEdit={droits('matieres').modifier}
              canDelete={droits('matieres').supprimer}
              emptyIcon="book_off"
              emptyText="Aucune matière pour l’instant"
              columns={[
                { header: 'Code', render: (r) => <Badge tone="blue">{r.code}</Badge>, className: 'w-24' },
                { header: 'Matière', render: (r) => <span className="font-semibold">{r.nom}</span> },
                { header: 'Coefficients', render: (r) => {
                  const n = coefficients.filter((c) => c.matiereId === r.id).length;
                  return n ? `${n} défini${n > 1 ? 's' : ''}` : <span className="text-[#757682]">—</span>;
                } },
              ]}
              onEdit={(r) => void open<Matiere>(`/api/matieres/${r.id}`, (detail) => { setMatiereEdit(detail); setMatiere({ nom: detail.nom, code: detail.code }); })}
              onDelete={(r) => void remove(`/api/matieres/${r.id}`, r.nom, reset.matiere)}
            />
            {matiereEdit && <EditBanner id={matiereEdit.id} summary={<>code {matiereEdit.code} · {matiereEdit.nom}</>} />}
            {(droits('matieres').creer || (matiereEdit && droits('matieres').modifier)) && (
            <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" onSubmit={(e) => {
              e.preventDefault();
              void run(() => matiereEdit
                ? apiSend(`/api/matieres/${matiereEdit.id}`, 'PUT', matiere).then(() => undefined)
                : apiSend('/api/matieres', 'POST', matiere).then(() => undefined), matiereEdit ? 'Matière mise à jour.' : 'Matière créée.', reset.matiere);
            }}>
              <Field label="Code">
                <input required placeholder="MATH" value={matiere.code} onChange={(e) => setMatiere({ ...matiere, code: e.target.value })} className={field} />
              </Field>
              <Field label="Nom de la matière" className="lg:col-span-3">
                <input required placeholder="Mathématiques" value={matiere.nom} onChange={(e) => setMatiere({ ...matiere, nom: e.target.value })} className={field} />
              </Field>
              <FormActions editing={!!matiereEdit} createLabel="Créer la matière" onCancel={reset.matiere} />
            </form>
            )}
          </SectionCard>
          )}

          {droits('coefficients').voir && (
          <SectionCard id="coefficients" icon="functions" title="Coefficients" description="Pondération d’une matière, pour toutes les classes ou pour une classe précise." count={coefficients.length}>
            <DataTable<Coefficient>
              rows={coefficients}
              editingId={coefficientEdit?.id}
              canCreate={droits('coefficients').creer}
              canEdit={droits('coefficients').modifier}
              canDelete={droits('coefficients').supprimer}
              emptyIcon="percent"
              emptyText="Aucun coefficient pour l’instant"
              columns={[
                { header: 'Matière', render: (r) => <span className="font-semibold">{nom(matieres, r.matiereId)}</span> },
                { header: 'Classe', render: (r) => r.classeId ? nom(classes, r.classeId) : <Badge>Toutes les classes</Badge> },
                { header: 'Série', render: (r) => r.serie || <span className="text-[#757682]">—</span> },
                { header: 'Coefficient', render: (r) => <span className="font-mono font-bold text-[#00236f]">{r.valeur}</span>, className: 'w-28' },
              ]}
              onEdit={(r) => void open<Coefficient>(`/api/coefficients/${r.id}`, (detail) => {
                setCoefficientEdit(detail);
                setCoefficient({ matiereId: String(detail.matiereId), classeId: detail.classeId ? String(detail.classeId) : '', serie: detail.serie || '', valeur: String(detail.valeur) });
              })}
              onDelete={(r) => void remove(`/api/coefficients/${r.id}`, `coefficient ${r.valeur} — ${nom(matieres, r.matiereId)}`, reset.coefficient)}
            />
            {coefficientEdit && <EditBanner id={coefficientEdit.id} summary={<>valeur {coefficientEdit.valeur} · série {coefficientEdit.serie || '—'}</>} />}
            {(droits('coefficients').creer || (coefficientEdit && droits('coefficients').modifier)) && (
            <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" onSubmit={(e) => {
              e.preventDefault();
              const valeur = Number(coefficient.valeur);
              if (!Number.isFinite(valeur) || valeur < 0.5 || valeur > 20) { toastError('Le coefficient doit être compris entre 0,5 et 20.'); return; }
              const body = { matiereId: Number(coefficient.matiereId), classeId: coefficient.classeId ? Number(coefficient.classeId) : null, serie: coefficient.serie, valeur };
              void run(() => coefficientEdit
                ? apiSend(`/api/coefficients/${coefficientEdit.id}`, 'PUT', body).then(() => undefined)
                : apiSend('/api/coefficients', 'POST', body).then(() => undefined), coefficientEdit ? 'Coefficient mis à jour.' : 'Coefficient ajouté.', reset.coefficient);
            }}>
              <Field label="Matière" className="lg:col-span-2">
                <select required value={coefficient.matiereId} onChange={(e) => setCoefficient({ ...coefficient, matiereId: e.target.value })} className={field}>
                  <option value="">Choisir une matière</option>
                  {matieres.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}
                </select>
              </Field>
              <Field label="Classe">
                <select value={coefficient.classeId} onChange={(e) => setCoefficient({ ...coefficient, classeId: e.target.value })} className={field}>
                  <option value="">Toutes les classes</option>
                  {classes.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}
                </select>
              </Field>
              <Field label="Valeur (0,5 à 20)">
                <input required inputMode="decimal" placeholder="2" value={coefficient.valeur} onChange={(e) => setCoefficient({ ...coefficient, valeur: e.target.value })} className={field} />
              </Field>
              <FormActions editing={!!coefficientEdit} createLabel="Ajouter le coefficient" updateLabel="Mettre à jour le coefficient" onCancel={reset.coefficient} />
            </form>
            )}
          </SectionCard>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------- */}
      {groupeCourant === 'enseignants' && (
        <div className="space-y-5">
          {droits('enseignants').voir && (
          <SectionCard id="enseignants" icon="person" title="Enseignants" description="Corps professoral de l’établissement, désignable comme titulaire d’une classe." count={profs.length}>
            <DataTable<Professeur>
              rows={profs}
              editingId={profEdit?.id}
              canCreate={droits('enseignants').creer}
              canEdit={droits('enseignants').modifier}
              canDelete={droits('enseignants').supprimer}
              emptyIcon="person_off"
              emptyText="Aucun enseignant pour l’instant"
              columns={[
                { header: 'Nom', render: (r) => <span className="font-semibold">{r.nom}</span> },
                { header: 'Email', render: (r) => r.email || <span className="text-[#757682]">non renseigné</span> },
                { header: 'Titulaire de', render: (r) => {
                  const list = classes.filter((c) => c.titulaireId === r.id).map((c) => c.nom);
                  return list.length ? list.join(', ') : <span className="text-[#757682]">—</span>;
                } },
              ]}
              onEdit={(r) => void open<Professeur>(`/api/professeurs/${r.id}`, (detail) => { setProfEdit(detail); setProf({ nom: detail.nom, email: detail.email || '' }); })}
              onDelete={(r) => void remove(`/api/professeurs/${r.id}`, r.nom, reset.prof)}
            />
            {profEdit && <EditBanner id={profEdit.id} summary={<>{profEdit.nom} · {profEdit.email || 'email non renseigné'}</>} />}
            {(droits('enseignants').creer || (profEdit && droits('enseignants').modifier)) && (
            <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" onSubmit={(e) => {
              e.preventDefault();
              void run(() => profEdit
                ? apiSend(`/api/professeurs/${profEdit.id}`, 'PUT', prof).then(() => undefined)
                : apiSend('/api/professeurs', 'POST', prof).then(() => undefined), profEdit ? 'Enseignant mis à jour.' : 'Enseignant ajouté.', reset.prof);
            }}>
              <Field label="Nom complet" className="lg:col-span-2">
                <input required placeholder="Nom Prénom" value={prof.nom} onChange={(e) => setProf({ ...prof, nom: e.target.value })} className={field} />
              </Field>
              <Field label="Email" className="lg:col-span-2">
                <input type="email" placeholder="prof@ecole.tg" value={prof.email} onChange={(e) => setProf({ ...prof, email: e.target.value })} className={field} />
              </Field>
              <FormActions editing={!!profEdit} createLabel="Ajouter l’enseignant" onCancel={reset.prof} />
            </form>
            )}
          </SectionCard>
          )}

          {droits('classes').voir && (
          <SectionCard id="classes" icon="meeting_room" title="Classes & titulaires" description="Classes de l’année scolaire et enseignant titulaire de chacune." count={classes.length}>
            <DataTable<Classe>
              rows={classes}
              editingId={classeEdit?.id}
              canCreate={droits('classes').creer}
              canEdit={droits('classes').modifier}
              canDelete={droits('classes').supprimer}
              emptyIcon="no_meeting_room"
              emptyText="Aucune classe pour l’instant"
              columns={[
                { header: 'Classe', render: (r) => <span className="font-semibold">{r.nom}</span> },
                { header: 'Niveau / série', render: (r) => <>{r.niveau}{r.serie ? ` · ${r.serie}` : ''}</> },
                { header: 'Titulaire', render: (r) => r.titulaireId ? nom(profs, r.titulaireId) : <span className="text-[#757682]">non désigné</span> },
                { header: 'Année', render: (r) => nom(annees, r.anneeScolaireId) },
              ]}
              onEdit={(r) => void open<Classe>(`/api/classes/${r.id}`, (detail) => {
                setClasseEdit(detail);
                setClasse({ nom: detail.nom, niveau: detail.niveau, serie: detail.serie || '', titulaireId: detail.titulaireId ? String(detail.titulaireId) : '', anneeScolaireId: String(detail.anneeScolaireId) });
              })}
              onDelete={(r) => void remove(`/api/classes/${r.id}`, r.nom, reset.classe)}
            />
            {classeEdit && <EditBanner id={classeEdit.id} summary={<>{classeEdit.niveau} · {classeEdit.serie || 'série non renseignée'} · année {nom(annees, classeEdit.anneeScolaireId)}</>} />}
            {(droits('classes').creer || (classeEdit && droits('classes').modifier)) && (
            <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" onSubmit={(e) => {
              e.preventDefault();
              const anneeId = Number(classe.anneeScolaireId || annees[0]?.id);
              if (!anneeId) { toastError('Créez d’abord une année scolaire.'); return; }
              const body = { anneeScolaireId: anneeId, nom: classe.nom, niveau: classe.niveau, serie: classe.serie, titulaireId: classe.titulaireId ? Number(classe.titulaireId) : null };
              void run(() => classeEdit
                ? apiSend(`/api/classes/${classeEdit.id}`, 'PUT', body).then(() => undefined)
                : apiSend('/api/classes', 'POST', body).then(() => undefined), classeEdit ? 'Classe mise à jour.' : 'Classe créée.', reset.classe);
            }}>
              <Field label="Nom de la classe" className="lg:col-span-2">
                <input required placeholder="Tle D1" value={classe.nom} onChange={(e) => setClasse({ ...classe, nom: e.target.value })} className={field} />
              </Field>
              <Field label="Titulaire" className="lg:col-span-2">
                <select value={classe.titulaireId} onChange={(e) => setClasse({ ...classe, titulaireId: e.target.value })} className={field}>
                  <option value="">Sans titulaire</option>
                  {profs.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}
                </select>
              </Field>
              <FormActions editing={!!classeEdit} createLabel="Créer la classe" updateLabel="Mettre à jour la classe" onCancel={reset.classe} />
            </form>
            )}
          </SectionCard>
          )}

          {droits('affectations').voir && (
          <SectionCard id="affectations" icon="assignment_ind" title="Affectations" description="Qui enseigne quelle matière dans quelle classe." count={affectations.length}>
            <DataTable<Affectation>
              rows={affectations}
              editingId={affectationEdit?.id}
              canCreate={droits('affectations').creer}
              canEdit={droits('affectations').modifier}
              canDelete={droits('affectations').supprimer}
              emptyIcon="assignment_late"
              emptyText="Aucune affectation pour l’instant"
              columns={[
                { header: 'Enseignant', render: (r) => <span className="font-semibold">{nom(profs, r.professeurId)}</span> },
                { header: 'Matière', render: (r) => nom(matieres, r.matiereId) },
                { header: 'Classe', render: (r) => nom(classes, r.classeId) },
              ]}
              onEdit={(r) => void open<Affectation>(`/api/affectations/${r.id}`, (detail) => {
                setAffectationEdit(detail);
                setAffectation({ professeurId: String(detail.professeurId), matiereId: String(detail.matiereId), classeId: String(detail.classeId) });
              })}
              onDelete={(r) => void remove(`/api/affectations/${r.id}`, `${nom(profs, r.professeurId)} · ${nom(matieres, r.matiereId)} · ${nom(classes, r.classeId)}`, reset.affectation)}
            />
            {affectationEdit && <EditBanner id={affectationEdit.id} summary={<>{nom(profs, affectationEdit.professeurId)} · {nom(matieres, affectationEdit.matiereId)} · {nom(classes, affectationEdit.classeId)}</>} />}
            {(droits('affectations').creer || (affectationEdit && droits('affectations').modifier)) && (
            <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" onSubmit={(e) => {
              e.preventDefault();
              const body = { professeurId: Number(affectation.professeurId), matiereId: Number(affectation.matiereId), classeId: Number(affectation.classeId) };
              void run(() => affectationEdit
                ? apiSend(`/api/affectations/${affectationEdit.id}`, 'PUT', body).then(() => undefined)
                : apiSend('/api/affectations', 'POST', body).then(() => undefined), affectationEdit ? 'Affectation mise à jour.' : 'Affectation enregistrée.', reset.affectation);
            }}>
              <Field label="Enseignant">
                <select required value={affectation.professeurId} onChange={(e) => setAffectation({ ...affectation, professeurId: e.target.value })} className={field}>
                  <option value="">Choisir un enseignant</option>
                  {profs.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}
                </select>
              </Field>
              <Field label="Matière">
                <select required value={affectation.matiereId} onChange={(e) => setAffectation({ ...affectation, matiereId: e.target.value })} className={field}>
                  <option value="">Choisir une matière</option>
                  {matieres.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}
                </select>
              </Field>
              <Field label="Classe">
                <select required value={affectation.classeId} onChange={(e) => setAffectation({ ...affectation, classeId: e.target.value })} className={field}>
                  <option value="">Choisir une classe</option>
                  {classes.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}
                </select>
              </Field>
              <FormActions editing={!!affectationEdit} createLabel="Affecter" updateLabel="Mettre à jour l’affectation" onCancel={reset.affectation} />
            </form>
            )}
          </SectionCard>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------- */}
      {groupeCourant === 'eleves' && (
        <SectionCard id="eleves" icon="school" title="Élèves" description="Inscriptions des candidats avec matricule, classe et session d’examen." count={eleves.length}>
          <DataTable<Eleve>
            rows={eleves}
            editingId={eleveEdit?.id}
            canCreate={droits('eleves').creer}
            canEdit={droits('eleves').modifier}
            canDelete={droits('eleves').supprimer}
            emptyIcon="person_search"
            emptyText="Aucun élève inscrit pour l’instant"
            columns={[
              { header: 'Nom complet', render: (r) => <span className="font-semibold">{r.nomComplet}</span> },
              { header: 'Matricule', render: (r) => <span className="font-mono text-[12px]">{r.matricule}</span> },
              { header: 'Genre', render: (r) => <Badge tone={r.genre === 'F' ? 'blue' : 'grey'}>{r.genre}</Badge>, className: 'w-20' },
              { header: 'Classe', render: (r) => nom(classes, r.classeId) },
              { header: 'Session', render: (r) => r.sessionId ? nom(sessions, r.sessionId) : <span className="text-[#757682]">—</span> },
              { header: 'Table', render: (r) => r.numeroTable ?? <span className="text-[#757682]">—</span>, className: 'w-20' },
            ]}
            onEdit={(r) => void open<Eleve>(`/api/eleves/${r.id}`, (detail) => {
              setEleveEdit(detail);
              setEleve({ nomComplet: detail.nomComplet, matricule: detail.matricule, genre: detail.genre, classeId: String(detail.classeId), sessionId: detail.sessionId ? String(detail.sessionId) : '', numeroTable: detail.numeroTable ? String(detail.numeroTable) : '' });
            })}
            onDelete={(r) => void remove(`/api/eleves/${r.id}`, r.nomComplet, reset.eleve)}
          />
          {eleveEdit && <EditBanner id={eleveEdit.id} summary={<>{eleveEdit.nomComplet} · {eleveEdit.genre} · table {eleveEdit.numeroTable ?? '—'} · {eleveEdit.lieuNaissance || 'lieu non renseigné'}</>} />}
          {(droits('eleves').creer || (eleveEdit && droits('eleves').modifier)) && (
          <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3" onSubmit={(e) => {
            e.preventDefault();
            if (eleve.genre !== 'M' && eleve.genre !== 'F') { toastError('Le genre doit être M ou F.'); return; }
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
              : apiSend('/api/eleves', 'POST', body).then(() => undefined), eleveEdit ? 'Élève mis à jour.' : 'Élève inscrit.', reset.eleve);
          }}>
            <Field label="Nom complet" className="lg:col-span-2">
              <input required placeholder="Nom Prénom" value={eleve.nomComplet} onChange={(e) => setEleve({ ...eleve, nomComplet: e.target.value })} className={field} />
            </Field>
            <Field label="Matricule">
              <input required placeholder="MAT-0001" value={eleve.matricule} onChange={(e) => setEleve({ ...eleve, matricule: e.target.value })} className={field} />
            </Field>
            <Field label="Genre">
              <select value={eleve.genre} onChange={(e) => setEleve({ ...eleve, genre: e.target.value })} className={field}>
                <option value="F">Féminin</option>
                <option value="M">Masculin</option>
              </select>
            </Field>
            <Field label="Classe">
              <select required value={eleve.classeId} onChange={(e) => setEleve({ ...eleve, classeId: e.target.value })} className={field}>
                <option value="">Choisir une classe</option>
                {classes.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}
              </select>
            </Field>
            <Field label="Session">
              <select value={eleve.sessionId} onChange={(e) => setEleve({ ...eleve, sessionId: e.target.value })} className={field}>
                <option value="">Aucune session</option>
                {sessions.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}
              </select>
            </Field>
            <FormActions editing={!!eleveEdit} createLabel="Inscrire l’élève" updateLabel="Mettre à jour l’élève" onCancel={reset.eleve} />
          </form>
          )}
          {droits('eleves').creer && (
          <ImportElevesPanel
            classes={classes}
            sessions={sessions}
            onImported={() => load()
              .then(() => onDataChanged?.())
              .catch((err: Error) => void showError('Rechargement des listes impossible', err.message))}
          />
          )}
        </SectionCard>
      )}

      {/* ---------------------------------------------------------- */}
      {groupeCourant === 'notes' && (
        <SectionCard id="notes" icon="grading" title="Notes" description="Notes sur 20 par élève, matière et session ; une absence remplace la note." count={notes.length}>
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 rounded border border-[#eaedff] bg-[#faf8ff] p-3">
            <Field label="Session affichée" className="sm:w-72">
              <select
                value={sessionNotes}
                onChange={(e) => {
                  const id = e.target.value;
                  sessionNotesRef.current = id;
                  setSessionNotes(id);
                  apiGet<Note[]>(`/api/notes?sessionId=${id}`)
                    .then(setNotes)
                    .catch((err: Error) => void showError('Chargement des notes impossible', err.message));
                }}
                className={field}
                disabled={sessions.length === 0}
              >
                {sessions.length === 0 && <option value="">Aucune session disponible</option>}
                {sessions.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}
              </select>
            </Field>
            <p className="text-[12px] text-[#444651] sm:pb-2">Les notes listées ci-dessous appartiennent à la session sélectionnée.</p>
          </div>
          <DataTable<Note>
            rows={notes}
            editingId={noteEdit?.id}
            canCreate={droits('notes').creer}
            canEdit={droits('notes').modifier}
            canDelete={droits('notes').supprimer}
            emptyIcon="rule"
            emptyText="Aucune note pour cette session"
            columns={[
              { header: 'Élève', render: (r) => <span className="font-semibold">{nom(eleves, r.eleveId)}</span> },
              { header: 'Matière', render: (r) => nom(matieres, r.matiereId) },
              { header: 'Session', render: (r) => nom(sessions, r.sessionId) },
              { header: 'Note', render: (r) => r.absent ? <Badge tone="red">Absent</Badge> : <span className="font-mono font-bold text-[#00236f]">{r.valeur} / 20</span>, className: 'w-28' },
            ]}
            onEdit={(r) => void open<Note>(`/api/notes/${r.id}`, (detail) => {
              setNoteEdit(detail);
              setNote({ eleveId: String(detail.eleveId), matiereId: String(detail.matiereId), sessionId: String(detail.sessionId), valeur: detail.valeur == null ? '' : String(detail.valeur), absent: detail.absent });
            })}
            onDelete={(r) => void remove(`/api/notes/${r.id}`, `note de ${nom(eleves, r.eleveId)} en ${nom(matieres, r.matiereId)}`, reset.note)}
          />
          {noteEdit && <EditBanner id={noteEdit.id} summary={<>{nom(eleves, noteEdit.eleveId)} · {nom(matieres, noteEdit.matiereId)} · {noteEdit.absent ? 'absent' : `${noteEdit.valeur}/20`}</>} />}
          {(droits('notes').creer || (noteEdit && droits('notes').modifier)) && (
          <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3" onSubmit={(e) => {
            e.preventDefault();
            const valeur = note.absent ? null : Number(note.valeur);
            if (!note.absent && (valeur == null || !Number.isFinite(valeur) || valeur < 0 || valeur > 20)) { toastError('La note doit être comprise entre 0 et 20, ou marquée absente.'); return; }
            const body = { eleveId: Number(note.eleveId), matiereId: Number(note.matiereId), sessionId: Number(note.sessionId), valeur, absent: note.absent };
            void run(() => noteEdit
              ? apiSend(`/api/notes/${noteEdit.id}`, 'PUT', body).then(() => undefined)
              : apiSend('/api/notes', 'POST', body).then(() => undefined), noteEdit ? 'Note mise à jour.' : 'Note enregistrée.', reset.note);
          }}>
            <Field label="Élève">
              <select required value={note.eleveId} onChange={(e) => setNote({ ...note, eleveId: e.target.value })} className={field}>
                <option value="">Choisir un élève</option>
                {eleves.map((item) => <option key={item.id} value={item.id}>{item.nomComplet}</option>)}
              </select>
            </Field>
            <Field label="Matière">
              <select required value={note.matiereId} onChange={(e) => setNote({ ...note, matiereId: e.target.value })} className={field}>
                <option value="">Choisir une matière</option>
                {matieres.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}
              </select>
            </Field>
            <Field label="Session">
              <select required value={note.sessionId} onChange={(e) => setNote({ ...note, sessionId: e.target.value })} className={field}>
                <option value="">Choisir une session</option>
                {sessions.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}
              </select>
            </Field>
            <Field label="Note / 20">
              <input inputMode="decimal" placeholder="12,5" value={note.valeur} onChange={(e) => setNote({ ...note, valeur: e.target.value })} className={field} disabled={note.absent} />
            </Field>
            <label className="flex items-center gap-2 text-[13px] text-[#131b2e] sm:pt-6 cursor-pointer select-none">
              <input type="checkbox" className="w-4 h-4 accent-[#00236f]" checked={note.absent} onChange={(e) => setNote({ ...note, absent: e.target.checked })} />
              <span className="font-semibold">Élève absent</span>
            </label>
            <FormActions editing={!!noteEdit} createLabel="Enregistrer la note" updateLabel="Mettre à jour la note" onCancel={reset.note} />
          </form>
          )}
        </SectionCard>
      )}
    </div>
  );
};
