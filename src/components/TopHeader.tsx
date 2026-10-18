import React, { useState } from 'react';
import { ViewMode } from '../types';

interface TopHeaderProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  isOfflineMode: boolean;
  onOpenSearch: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentView,
  onViewChange,
  isOfflineMode,
  onOpenSearch,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      title: 'Clôture du Centre 03 validée',
      time: 'Il y a 10 min',
      unread: true,
      desc: 'Le procès-verbal des séries C & D a été scellé par Dr. Traoré.'
    },
    {
      id: 2,
      title: 'Émargement SVT complet',
      time: 'Il y a 45 min',
      unread: true,
      desc: '138 copies saisies et vérifiées par Dr. Ouedraogo.'
    },
    {
      id: 3,
      title: 'Synchronisation IndexedDB',
      time: 'Il y a 2h',
      unread: false,
      desc: 'Toutes les délibérations sont stockées hors-ligne avec succès.'
    }
  ]);

  const unreadCount = notifications.filter(n => n.unread).length;

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  };

  return (
    <header className="fixed top-0 left-80 right-0 h-16 bg-[#ffffff]/95 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-40 flex items-center justify-between px-6 border-b border-[#eaedff]">
      <div className="flex items-center gap-3">
        <span className="text-[11px] px-2.5 py-1 rounded bg-[#e2e7ff] text-[#00236f] uppercase tracking-wider font-bold">
          République Togolaise • MEPST
        </span>
        <span className="inline-flex items-center gap-1 text-[12px] text-[#0051d5] font-medium">
          <span className="material-symbols-outlined text-sm">
            {isOfflineMode ? 'wifi_off' : 'wifi'}
          </span>
          {isOfflineMode ? 'Mode Hors-Ligne Prêt' : 'Serveur National Synchronisé'}
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* Horizontal Navigation for Fast Switching */}
        <nav className="hidden md:flex items-center gap-3 lg:gap-4 text-[13px] font-medium">
          <button
            type="button"
            onClick={() => onViewChange('dashboard')}
            className={`transition-colors py-1 px-2.5 rounded ${
              currentView === 'dashboard'
                ? 'bg-[#eaedff] text-[#131b2e] font-semibold'
                : 'text-[#444651] hover:text-[#131b2e]'
            }`}
          >
            Vue Générale
          </button>
          <button
            type="button"
            onClick={() => onViewChange('students')}
            className={`transition-colors py-1 px-2.5 rounded ${
              currentView === 'students'
                ? 'bg-[#eaedff] text-[#131b2e] font-semibold'
                : 'text-[#444651] hover:text-[#131b2e]'
            }`}
          >
            Candidats
          </button>
          <button
            type="button"
            onClick={() => onViewChange('grading')}
            className={`transition-colors py-1 px-2.5 rounded ${
              currentView === 'grading'
                ? 'bg-[#eaedff] text-[#131b2e] font-semibold'
                : 'text-[#444651] hover:text-[#131b2e]'
            }`}
          >
            Émargement
          </button>
          <button
            type="button"
            onClick={() => onViewChange('bulletin')}
            className={`transition-colors py-1 px-2.5 rounded ${
              currentView === 'bulletin'
                ? 'bg-[#eaedff] text-[#131b2e] font-semibold'
                : 'text-[#444651] hover:text-[#131b2e]'
            }`}
          >
            Tirages
          </button>
          <button
            type="button"
            onClick={() => onViewChange('records')}
            className={`transition-colors py-1 px-2.5 rounded ${
              currentView === 'records'
                ? 'bg-[#eaedff] text-[#131b2e] font-semibold'
                : 'text-[#444651] hover:text-[#131b2e]'
            }`}
          >
            Certifications
          </button>
          <button
            type="button"
            onClick={() => onViewChange('settings')}
            className={`transition-colors py-1 px-2.5 rounded flex items-center gap-1 ${
              currentView === 'settings'
                ? 'bg-[#eaedff] text-[#0051d5] font-semibold'
                : 'text-[#444651] hover:text-[#131b2e]'
            }`}
            title="Personnalisation du logo et paramètres"
          >
            <span className="material-symbols-outlined text-base">tune</span>
            <span>Logo</span>
          </button>
        </nav>

        {/* Action Controls: Search & Notifications */}
        <div className="flex items-center gap-2 relative">
          <button
            type="button"
            onClick={onOpenSearch}
            className="p-2 rounded hover:bg-[#e2e7ff] text-[#444651] hover:text-[#131b2e] transition-colors"
            title="Recherche rapide de candidat (Ctrl+K)"
          >
            <span className="material-symbols-outlined text-lg">search</span>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 rounded hover:bg-[#e2e7ff] text-[#444651] hover:text-[#131b2e] transition-colors relative"
              title="Notifications officielles"
            >
              <span className="material-symbols-outlined text-lg">notifications</span>
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#0051d5]"></span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-[#eaedff] p-3 z-50 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between pb-2 border-b border-[#eaedff]">
                  <span className="text-[12px] font-bold text-[#131b2e] uppercase tracking-wide">
                    Notifications DEXCO ({unreadCount})
                  </span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="text-[11px] text-[#0051d5] hover:underline"
                    >
                      Tout marquer lu
                    </button>
                  )}
                </div>
                <div className="divide-y divide-[#eaedff] max-h-64 overflow-y-auto mt-1">
                  {notifications.map((item) => (
                    <div key={item.id} className="py-2 px-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-semibold text-[#131b2e]">
                          {item.title}
                        </span>
                        <span className="text-[10px] text-[#444651]">{item.time}</span>
                      </div>
                      <p className="text-[11px] text-[#444651] mt-0.5 leading-snug">
                        {item.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <img
          alt="Profile"
          onClick={() => onViewChange('settings')}
          className="w-8 h-8 rounded-full object-cover ring-2 ring-[#0051d5]/20 cursor-pointer hover:ring-[#0051d5] transition-all"
          title="Paramètres de session du Jury"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuBfMWADhnssFAqE2_oiXq8p3ziGlR17RS02-06FWHwjbMygfyusLAV36M1EG2uCbGXuWNCGEPd8C6nGTKb3fW-U8Apqss4V5P64HFdCLMzMEmlqzvmXBzNqlVL54U47x1K1ehLyuJf1wQeV4My4oFYO9TadSpl9izIImu_z6xQGAPGbIf5QnrjI9WiRC-uaJpFrn5VzJZH7kRYei1Q2hQ3VyeGg-M-Q6lxyewt1Xt3LK6L-OucXQU9hew"
        />
      </div>
    </header>
  );
};
