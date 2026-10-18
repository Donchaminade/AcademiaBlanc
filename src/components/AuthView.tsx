import React, { useState } from 'react';
import { SchoolAccount } from '../types';
import { getRegisteredSchools, createSchoolAccount } from '../data/schoolsData';
import { login as apiLogin, setSession, signup as apiSignup } from '../api/client';
import { isPlausibleEmail } from '../utils/safeUrl';

interface AuthViewProps {
  currentSchool: SchoolAccount;
  onSelectSchool: (schoolId: string) => void;
  onAccountCreated: (newSchool: SchoolAccount) => void;
  onApiReady?: () => void;
  onClose?: () => void;
  /** Rendu dans une modale : pas de fond plein écran ni de padding externe. */
  embedded?: boolean;
}

export const AuthView: React.FC<AuthViewProps> = ({
  currentSchool,
  onSelectSchool,
  onAccountCreated,
  onApiReady,
  onClose,
  embedded = false,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [schools, setSchools] = useState<SchoolAccount[]>(getRegisteredSchools());

  // Registration form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    city: 'Lomé',
    region: 'Maritime (Grand Lomé)',
    type: 'Lycée Public d\'Enseignement Général',
    principalName: '',
    email: '',
    phone: '+228 ',
    password: '',
    confirmPassword: '',
    initialWithSampleStudents: false,
  });

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [regError, setRegError] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');

    if (!formData.name.trim()) {
      setRegError('Le nom officiel de l\'établissement est obligatoire.');
      return;
    }
    if (!formData.principalName.trim()) {
      setRegError('Le nom du Proviseur ou Chef d\'établissement est obligatoire.');
      return;
    }
    if (!isPlausibleEmail(formData.email)) {
      setRegError('Indiquez une adresse email valide.');
      return;
    }
    if (formData.password.trim().length < 6) {
      setRegError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setRegError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    try {
      const session = await apiSignup({
        nom: formData.name.trim(),
        ville: formData.city.trim(),
        email: formData.email.trim(),
        motDePasse: formData.password,
        nomResponsable: formData.principalName.trim(),
        telephone: formData.phone.trim(),
        region: formData.region.trim(),
        typeEtablissement: formData.type.trim(),
      });
      setSession(session);
      const newSchool = createSchoolAccount({
        name: formData.name.trim(),
        code: formData.code.trim(),
        city: formData.city.trim(),
        region: formData.region.trim(),
        type: formData.type.trim(),
        principalName: formData.principalName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        password: formData.password,
        initialWithSampleStudents: false,
      });

      setSchools(getRegisteredSchools());
      onAccountCreated(newSchool);
      onApiReady?.();
    } catch (error) {
      setRegError(error instanceof Error ? error.message : 'Une erreur est survenue lors de la création du compte.');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const email = loginEmail.trim().toLowerCase();
    if (!isPlausibleEmail(email) || !loginPassword) {
      setLoginError('Email et mot de passe sont obligatoires.');
      return;
    }

    try {
      const session = await apiLogin(email, loginPassword);
      setSession(session);
      onApiReady?.();
      const found = schools.find((s) => s.email.toLowerCase() === session.email.toLowerCase());
      if (found) {
        onSelectSchool(found.id);
        return;
      }
      if (onClose) onClose();
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Connexion impossible.');
    }
  };

  const handleQuickSwitch = (schoolId: string) => {
    onSelectSchool(schoolId);
  };

  const labelBase = 'block text-[11px] font-bold uppercase tracking-wider text-[#444651] mb-1';
  const labelStrong = 'block text-[11px] font-bold uppercase tracking-wider text-[#00236f] mb-1';
  const inputBase =
    'w-full bg-[#f2f3ff] text-[12px] px-3 py-2 rounded-lg border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5] focus:ring-2 focus:ring-[#0051d5]/20';

  const panel = (
    <div className="w-full max-w-4xl bg-white rounded-xl shadow-lg border border-[#eaedff] overflow-hidden flex flex-col max-h-[90vh]">
      {/* En-tête */}
      <div className="shrink-0 bg-gradient-to-r from-[#00236f] via-[#1e3a8a] to-[#0051d5] text-white px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 shrink-0 rounded-lg bg-white/10 flex items-center justify-center border border-white/20">
            <span className="material-symbols-outlined text-2xl text-white">account_balance</span>
          </div>
          <div className="min-w-0">
            <span className="block text-[10px] font-bold tracking-widest uppercase text-white/80">
              🇹🇬 République Togolaise • MEPST
            </span>
            <h1 className="text-[17px] sm:text-lg font-bold tracking-tight leading-tight truncate">
              Portail Établissements &amp; Gestion des Bulletins
            </h1>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[12px] font-semibold transition-all border border-white/20"
          >
            Fermer
          </button>
        )}
      </div>

      {/* Établissement actif */}
      <div className="shrink-0 bg-[#f2f3ff] px-4 sm:px-5 py-2 border-b border-[#eaedff] flex items-center gap-2 text-[12px] min-w-0">
        <span className="material-symbols-outlined text-[#0051d5] text-base">verified_user</span>
        <span className="text-[#444651] whitespace-nowrap">Établissement actif :</span>
        <span className="font-bold text-[#00236f] bg-white px-2 py-0.5 rounded border border-[#eaedff] truncate">
          {currentSchool.name} ({currentSchool.city})
        </span>
      </div>

      {/* Onglets */}
      <div className="shrink-0 flex border-b border-[#eaedff] bg-[#faf8ff]">
        <button
          type="button"
          onClick={() => setMode('register')}
          className={`flex-1 py-2.5 px-4 font-bold text-[13px] flex items-center justify-center gap-2 border-b-2 transition-all ${
            mode === 'register'
              ? 'border-[#0051d5] text-[#0051d5] bg-white'
              : 'border-transparent text-[#444651] hover:text-[#131b2e]'
          }`}
        >
          <span className="material-symbols-outlined text-lg">domain_add</span>
          <span>Créer un compte</span>
        </button>
        <button
          type="button"
          onClick={() => setMode('login')}
          className={`flex-1 py-2.5 px-4 font-bold text-[13px] flex items-center justify-center gap-2 border-b-2 transition-all ${
            mode === 'login'
              ? 'border-[#0051d5] text-[#0051d5] bg-white'
              : 'border-transparent text-[#444651] hover:text-[#131b2e]'
          }`}
        >
          <span className="material-symbols-outlined text-lg">login</span>
          <span>Se connecter ({schools.length})</span>
        </button>
      </div>

      {/* Corps (défile en interne si trop haut) */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5">
        {mode === 'register' ? (
          <form onSubmit={handleRegister} className="space-y-3">
            {regError && (
              <div className="p-2.5 rounded-lg bg-red-50 text-red-700 text-[12px] font-semibold border border-red-200 flex items-center gap-2">
                <span className="material-symbols-outlined text-base">error</span>
                <span>{regError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Nom de l'établissement */}
              <div className="sm:col-span-2">
                <label className={labelStrong}>
                  Nom de l'établissement <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-2 text-[#0051d5] text-lg">
                    apartment
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="Ex : Lycée de Baguida"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={`${inputBase} pl-10 text-[13px] font-semibold text-[#131b2e]`}
                  />
                </div>
              </div>

              {/* Code */}
              <div>
                <label className={labelBase}>Code</label>
                <input
                  type="text"
                  placeholder="Ex : LBAG-03 (optionnel)"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className={`${inputBase} font-mono`}
                />
              </div>

              {/* Ville */}
              <div>
                <label className={labelBase}>
                  Ville <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className={`${inputBase} font-medium`}
                >
                  <option value="Lomé">Lomé (Grand Lomé)</option>
                  <option value="Kara">Kara</option>
                  <option value="Sokodé">Sokodé</option>
                  <option value="Atakpamé">Atakpamé</option>
                  <option value="Kpalimé">Kpalimé</option>
                  <option value="Dapaong">Dapaong</option>
                  <option value="Tsévié">Tsévié</option>
                  <option value="Aného">Aného</option>
                </select>
              </div>

              {/* Type d'établissement */}
              <div>
                <label className={labelBase}>Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className={`${inputBase} font-medium`}
                >
                  <option value="Lycée Public d'Enseignement Général">Lycée Public d'Enseignement Général</option>
                  <option value="Lycée d'Enseignement Technique & Professionnel">Lycée d'Enseignement Technique &amp; Professionnel</option>
                  <option value="Collège / Lycée Privé Laïc">Collège / Lycée Privé Laïc</option>
                  <option value="Établissement Confessionnel (Protestant / Catholique / Islamique)">Établissement Confessionnel</option>
                  <option value="Complexe Scolaire International">Complexe Scolaire International</option>
                </select>
              </div>

              {/* Proviseur */}
              <div>
                <label className={labelStrong}>
                  Proviseur <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex : M. Kodjo ADJOLOU"
                  value={formData.principalName}
                  onChange={(e) => setFormData({ ...formData, principalName: e.target.value })}
                  className={`${inputBase} font-semibold text-[#131b2e]`}
                />
              </div>

              {/* Email */}
              <div>
                <label className={labelBase}>
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="secretariat@lycee.tg"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={inputBase}
                />
              </div>

              {/* Téléphone */}
              <div>
                <label className={labelBase}>Téléphone</label>
                <input
                  type="text"
                  placeholder="+228 90 00 00 00"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className={inputBase}
                />
              </div>

              {/* Mot de passe */}
              <div>
                <label className={labelBase}>Mot de passe</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={inputBase}
                />
              </div>

              {/* Confirmation */}
              <div>
                <label className={labelBase}>Confirmation</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className={inputBase}
                />
              </div>

              {/* Données initiales */}
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2.5 cursor-pointer bg-[#f2f3ff] px-3 py-2 rounded-lg border border-[#eaedff]">
                  <input
                    type="checkbox"
                    checked={formData.initialWithSampleStudents}
                    onChange={(e) => setFormData({ ...formData, initialWithSampleStudents: e.target.checked })}
                    className="w-4 h-4 text-[#0051d5] rounded focus:ring-0 cursor-pointer"
                  />
                  <span className="text-[12px] font-bold text-[#00236f]">
                    Pré-charger 4 candidats modèles (Série D)
                  </span>
                </label>
              </div>
            </div>

            <div className="pt-1 flex justify-end">
              <button
                type="submit"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#00236f] text-white text-[13px] font-bold hover:bg-[#1e3a8a] transition-all shadow-md active:scale-95"
              >
                <span className="material-symbols-outlined text-lg">check_circle</span>
                <span>Créer le compte</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            {loginError && (
              <div className="p-2.5 rounded-lg bg-red-50 text-red-700 text-[12px] font-semibold border border-red-200 flex items-center gap-2">
                <span className="material-symbols-outlined text-base">error</span>
                <span>{loginError}</span>
              </div>
            )}

            {/* Changement rapide d'établissement */}
            <div>
              <span className={`${labelStrong} mb-2`}>
                Établissements enregistrés ({schools.length})
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {schools.map((school) => {
                  const isCurrent = school.id === currentSchool.id;
                  return (
                    <div
                      key={school.id}
                      onClick={() => handleQuickSwitch(school.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                        isCurrent
                          ? 'bg-[#eaedff] border-[#0051d5] ring-2 ring-[#0051d5]/40 shadow-sm'
                          : 'bg-white border-[#eaedff] hover:border-[#0051d5] hover:shadow-xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white text-[#0051d5] border border-[#eaedff] inline-block mb-1">
                            {school.code || 'CODE'}
                          </span>
                          <h4 className="text-[13px] font-bold text-[#00236f] truncate">
                            {school.name}
                          </h4>
                          <p className="text-[11px] text-[#444651] truncate">
                            {school.city} • {school.region}
                          </p>
                        </div>
                        {isCurrent && (
                          <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold bg-[#0051d5] text-white px-2 py-0.5 rounded-full">
                            <span className="material-symbols-outlined text-xs">check</span>
                            <span>Actif</span>
                          </span>
                        )}
                      </div>

                      <div className="mt-2 pt-2 border-t border-[#eaedff] flex items-center justify-between text-[11px]">
                        <span className="text-[#444651] truncate max-w-[170px]">
                          {school.principalName}
                        </span>
                        <span className="text-[#0051d5] font-semibold whitespace-nowrap">
                          {school.candidates?.length || 0} candidats
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Connexion par email */}
            <form onSubmit={handleLogin} className="space-y-3 pt-3 border-t border-[#eaedff]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelBase}>Email</label>
                  <input
                    type="text"
                    placeholder="direction@lycee-tokoin.tg"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className={inputBase}
                  />
                </div>

                <div>
                  <label className={labelBase}>Mot de passe</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className={inputBase}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#00236f] text-white text-[13px] font-bold hover:bg-[#1e3a8a] transition-all shadow-md"
                >
                  <span className="material-symbols-outlined text-base">login</span>
                  <span>Se connecter</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Pied de page */}
      <div className="shrink-0 bg-[#faf8ff] px-4 py-2 text-center border-t border-[#eaedff] text-[11px] text-[#444651]">
        AcademiaBlanc • République Togolaise • MEPST
      </div>
    </div>
  );

  if (embedded) return panel;

  return (
    <div className="min-h-screen bg-[#faf8ff] p-3 sm:p-6 flex justify-center items-center">
      {panel}
    </div>
  );
};
