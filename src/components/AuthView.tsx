import React, { useState } from 'react';
import { SchoolAccount } from '../types';
import { getRegisteredSchools, createSchoolAccount } from '../data/schoolsData';

interface AuthViewProps {
  currentSchool: SchoolAccount;
  onSelectSchool: (schoolId: string) => void;
  onAccountCreated: (newSchool: SchoolAccount) => void;
  onClose?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({
  currentSchool,
  onSelectSchool,
  onAccountCreated,
  onClose,
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
    initialWithSampleStudents: true,
  });

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [regError, setRegError] = useState('');

  const handleRegister = (e: React.FormEvent) => {
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
    if (!formData.email.trim()) {
      setRegError('L\'adresse email officielle est requise.');
      return;
    }
    if (formData.password && formData.password !== formData.confirmPassword) {
      setRegError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    try {
      const newSchool = createSchoolAccount({
        name: formData.name.trim(),
        code: formData.code.trim(),
        city: formData.city.trim(),
        region: formData.region.trim(),
        type: formData.type.trim(),
        principalName: formData.principalName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        password: formData.password || 'password123',
        initialWithSampleStudents: formData.initialWithSampleStudents,
      });

      setSchools(getRegisteredSchools());
      onAccountCreated(newSchool);
    } catch {
      setRegError('Une erreur est survenue lors de la création du compte.');
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const found = schools.find(
      s => s.email.toLowerCase() === loginEmail.toLowerCase().trim() ||
           s.name.toLowerCase().includes(loginEmail.toLowerCase().trim())
    );

    if (!found) {
      setLoginError('Aucun établissement trouvé avec cet email ou ce nom.');
      return;
    }

    onSelectSchool(found.id);
  };

  const handleQuickSwitch = (schoolId: string) => {
    onSelectSchool(schoolId);
  };

  return (
    <div className="min-h-screen bg-[#faf8ff] p-4 sm:p-8 flex flex-col justify-center items-center">
      <div className="max-w-4xl w-full bg-white rounded-xl shadow-lg border border-[#eaedff] overflow-hidden">
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-[#00236f] via-[#1e3a8a] to-[#0051d5] text-white p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-md">
              <span className="material-symbols-outlined text-4xl text-white">account_balance</span>
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-[11px] font-bold tracking-widest uppercase mb-1">
                <span>🇹🇬 République Togolaise • MEPST</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight">
                Portail Établissements &amp; Gestion des Bulletins
              </h1>
              <p className="text-[13px] text-white/80 mt-0.5">
                Chaque établissement dispose de son propre compte étanche et sécurisé pour gérer ses élèves et bulletins.
              </p>
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[12px] font-semibold transition-all border border-white/20"
            >
              Fermer &amp; Continuer
            </button>
          )}
        </div>

        {/* Current Session Indicator */}
        <div className="bg-[#f2f3ff] px-6 py-3 border-b border-[#eaedff] flex flex-wrap items-center justify-between gap-3 text-[12px]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#0051d5] text-lg">verified_user</span>
            <span className="text-[#444651]">Établissement actuellement actif :</span>
            <span className="font-bold text-[#00236f] bg-white px-2.5 py-1 rounded border border-[#eaedff]">
              🏫 {currentSchool.name} ({currentSchool.city})
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-[#0051d5] font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Cloisonnement &amp; Sécurité des données 100% garantis</span>
          </div>
        </div>

        {/* Mode Navigation Tabs */}
        <div className="flex border-b border-[#eaedff] bg-[#faf8ff]">
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`flex-1 py-3.5 px-6 font-bold text-[13px] flex items-center justify-center gap-2 border-b-2 transition-all ${
              mode === 'register'
                ? 'border-[#0051d5] text-[#0051d5] bg-white'
                : 'border-transparent text-[#444651] hover:text-[#131b2e]'
            }`}
          >
            <span className="material-symbols-outlined text-lg">domain_add</span>
            <span>Créer un Compte Établissement (Nouvel Établissement)</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`flex-1 py-3.5 px-6 font-bold text-[13px] flex items-center justify-center gap-2 border-b-2 transition-all ${
              mode === 'login'
                ? 'border-[#0051d5] text-[#0051d5] bg-white'
                : 'border-transparent text-[#444651] hover:text-[#131b2e]'
            }`}
          >
            <span className="material-symbols-outlined text-lg">login</span>
            <span>Se Connecter / Changer d'Établissement ({schools.length})</span>
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:p-8">
          {mode === 'register' ? (
            <div>
              <div className="mb-6 bg-[#eaedff]/60 p-4 rounded-lg border border-[#dce1ff]">
                <h3 className="text-[14px] font-bold text-[#00236f] flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg text-[#0051d5]">shield</span>
                  Création de Compte Souverain pour votre Lycée / Collège
                </h3>
                <p className="text-[12px] text-[#444651] mt-1 leading-relaxed">
                  Remplissez ce formulaire pour créer l'espace officiel de votre établissement. Vos élèves, notes, délibérations et bulletins seront strictement isolés et inaccessibles par les autres lycées.
                </p>
              </div>

              {regError && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-[12px] font-semibold border border-red-200 flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">error</span>
                  <span>{regError}</span>
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Nom de l'établissement */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#00236f] mb-1">
                      Nom Officiel de l'Établissement <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#0051d5] text-lg">
                        apartment
                      </span>
                      <input
                        type="text"
                        required
                        placeholder="Ex : Lycée de Baguida, Collège Saint-Joseph, Lycée Moderne de Kara"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-[#f2f3ff] text-[13px] pl-10 pr-3 py-2.5 rounded-lg border border-[#eaedff] font-semibold text-[#131b2e] outline-none focus:bg-white focus:border-[#0051d5] focus:ring-2 focus:ring-[#0051d5]/20"
                      />
                    </div>
                    <span className="text-[11px] text-[#444651] mt-1 block">
                      Ce nom sera automatiquement imprimé en haut de tous les bulletins de notes et sur les procès-verbaux officiels.
                    </span>
                  </div>

                  {/* Code Établissement */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#444651] mb-1">
                      Code / Identifiant d'Immatriculation
                    </label>
                    <input
                      type="text"
                      placeholder="Ex : LBAG-LOMÉ-03 (Auto-généré si vide)"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      className="w-full bg-[#f2f3ff] text-[12px] px-3 py-2.5 rounded-lg border border-[#eaedff] font-mono outline-none focus:bg-white focus:border-[#0051d5]"
                    />
                  </div>

                  {/* Ville */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#444651] mb-1">
                      Ville / Localité <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full bg-[#f2f3ff] text-[12px] px-3 py-2.5 rounded-lg border border-[#eaedff] font-medium outline-none focus:bg-white focus:border-[#0051d5]"
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
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#444651] mb-1">
                      Type d'Établissement
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full bg-[#f2f3ff] text-[12px] px-3 py-2.5 rounded-lg border border-[#eaedff] font-medium outline-none focus:bg-white focus:border-[#0051d5]"
                    >
                      <option value="Lycée Public d'Enseignement Général">Lycée Public d'Enseignement Général</option>
                      <option value="Lycée d'Enseignement Technique & Professionnel">Lycée d'Enseignement Technique &amp; Professionnel</option>
                      <option value="Collège / Lycée Privé Laïc">Collège / Lycée Privé Laïc</option>
                      <option value="Établissement Confessionnel (Protestant / Catholique / Islamique)">Établissement Confessionnel</option>
                      <option value="Complexe Scolaire International">Complexe Scolaire International</option>
                    </select>
                  </div>

                  {/* Proviseur / Chef d'établissement */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#00236f] mb-1">
                      Nom du Proviseur / Signataire Officiel <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex : M. le Proviseur Kodjo ADJOLOU"
                      value={formData.principalName}
                      onChange={(e) => setFormData({ ...formData, principalName: e.target.value })}
                      className="w-full bg-[#f2f3ff] text-[12px] px-3 py-2.5 rounded-lg border border-[#eaedff] font-semibold text-[#131b2e] outline-none focus:bg-white focus:border-[#0051d5]"
                    />
                  </div>

                  {/* Email officiel */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#444651] mb-1">
                      Email Professionnel du Secrétariat <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="Ex : secretariat@lycee-baguida.tg"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-[#f2f3ff] text-[12px] px-3 py-2.5 rounded-lg border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5]"
                    />
                  </div>

                  {/* Téléphone */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#444651] mb-1">
                      Téléphone de Contact
                    </label>
                    <input
                      type="text"
                      placeholder="+228 90 00 00 00"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-[#f2f3ff] text-[12px] px-3 py-2.5 rounded-lg border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5]"
                    />
                  </div>

                  {/* Mot de passe */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#444651] mb-1">
                      Mot de Passe d'Accès Sécurisé
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full bg-[#f2f3ff] text-[12px] px-3 py-2.5 rounded-lg border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5]"
                    />
                  </div>

                  {/* Confirmation mot de passe */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#444651] mb-1">
                      Confirmer le Mot de Passe
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      className="w-full bg-[#f2f3ff] text-[12px] px-3 py-2.5 rounded-lg border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5]"
                    />
                  </div>

                  {/* Choix des données initiales */}
                  <div className="sm:col-span-2 bg-[#f2f3ff] p-3.5 rounded-lg border border-[#eaedff]">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.initialWithSampleStudents}
                        onChange={(e) => setFormData({ ...formData, initialWithSampleStudents: e.target.checked })}
                        className="w-4 h-4 text-[#0051d5] rounded focus:ring-0 cursor-pointer"
                      />
                      <div>
                        <span className="text-[12px] font-bold text-[#00236f] block">
                          Pré-charger un échantillon de 4 candidats modèles (Série D)
                        </span>
                        <span className="text-[11px] text-[#444651]">
                          Idéal pour prévisualiser instantanément les calculs et bulletins officiels avec les tables 101 à 104. Décochez pour démarrer avec un registre vide.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-[11px] text-[#444651]">
                    <span className="material-symbols-outlined text-base text-emerald-600">lock</span>
                    <span>Isolation totale : les autres écoles ne verront pas vos données.</span>
                  </div>

                  <button
                    type="submit"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[#00236f] text-white text-[13px] font-bold hover:bg-[#1e3a8a] transition-all shadow-md active:scale-95"
                  >
                    <span className="material-symbols-outlined text-lg">check_circle</span>
                    <span>Créer le Compte &amp; Accéder à mon Espace</span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div>
              <div className="mb-6 bg-[#eaedff]/60 p-4 rounded-lg border border-[#dce1ff]">
                <h3 className="text-[14px] font-bold text-[#00236f] flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg text-[#0051d5]">login</span>
                  Connexion à l'Espace de votre Établissement
                </h3>
                <p className="text-[12px] text-[#444651] mt-1">
                  Sélectionnez un établissement enregistré ou connectez-vous avec vos identifiants pour accéder à vos candidats et bulletins.
                </p>
              </div>

              {loginError && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-[12px] font-semibold border border-red-200 flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">error</span>
                  <span>{loginError}</span>
                </div>
              )}

              {/* Quick Switch Cards */}
              <div className="mb-6">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-[#00236f] mb-3">
                  Établissements Enregistrés sur cette plateforme ({schools.length}) :
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {schools.map((school) => {
                    const isCurrent = school.id === currentSchool.id;
                    return (
                      <div
                        key={school.id}
                        onClick={() => handleQuickSwitch(school.id)}
                        className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                          isCurrent
                            ? 'bg-[#eaedff] border-[#0051d5] ring-2 ring-[#0051d5]/40 shadow-sm'
                            : 'bg-white border-[#eaedff] hover:border-[#0051d5] hover:shadow-xs'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white text-[#0051d5] border border-[#eaedff] inline-block mb-1">
                              {school.code || 'CODE ÉTABLISSEMENT'}
                            </span>
                            <h4 className="text-[14px] font-bold text-[#00236f]">
                              {school.name}
                            </h4>
                            <p className="text-[11px] text-[#444651]">
                              {school.city} • {school.region}
                            </p>
                          </div>
                          {isCurrent && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-[#0051d5] text-white px-2 py-0.5 rounded-full">
                              <span className="material-symbols-outlined text-xs">check</span>
                              <span>Actif</span>
                            </span>
                          )}
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-[#eaedff] flex items-center justify-between text-[11px]">
                          <span className="text-[#444651] truncate max-w-[170px]">
                            {school.principalName}
                          </span>
                          <span className="text-[#0051d5] font-semibold">
                            {school.candidates?.length || 0} candidats
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Standard Login by Email */}
              <form onSubmit={handleLogin} className="space-y-4 pt-4 border-t border-[#eaedff]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#444651] mb-1">
                      Email ou Nom de l'établissement
                    </label>
                    <input
                      type="text"
                      placeholder="direction@lycee-tokoin.tg"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full bg-[#f2f3ff] text-[12px] px-3 py-2.5 rounded-lg border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#444651] mb-1">
                      Mot de Passe
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full bg-[#f2f3ff] text-[12px] px-3 py-2.5 rounded-lg border border-[#eaedff] outline-none focus:bg-white focus:border-[#0051d5]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#00236f] text-white text-[13px] font-bold hover:bg-[#1e3a8a] transition-all shadow-md"
                  >
                    <span className="material-symbols-outlined text-base">login</span>
                    <span>Se Connecter à cet Établissement</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer Security Note */}
        <div className="bg-[#faf8ff] p-4 text-center border-t border-[#eaedff] text-[11px] text-[#444651]">
          <span>
            Plateforme Nationale AcademiaBlanc • République Togolaise • Ministère des Enseignements Primaire, Secondaire et Technique
          </span>
        </div>
      </div>
    </div>
  );
};
