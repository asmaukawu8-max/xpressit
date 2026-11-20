import React from 'react';
import { ScreenRoute } from '../types';

interface BottomNavProps {
  route: ScreenRoute;
  onNavigate: (route: ScreenRoute) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ route, onNavigate }) => {
  const showBottomBar = route === 'feed' || route === 'settings';

  if (!showBottomBar) return null;

  return (
    <nav
      aria-label="Primary navigation"
      className="lg:hidden fixed bottom-0 inset-x-0 z-50 pb-safe bg-surface-container-lowest/90 backdrop-blur-xl rounded-t-[24px] shadow-[0_-4px_24px_rgba(15,23,42,0.06)]"
    >
      <div className="relative flex justify-around items-center h-20 px-4 max-w-xl mx-auto">
        <button
          type="button"
          aria-current={route === 'feed' ? 'page' : undefined}
          onClick={() => onNavigate('feed')}
          className={`flex flex-col items-center justify-center gap-1 min-w-[56px] min-h-[48px] transition-all cursor-pointer ${
            route === 'feed'
              ? 'text-primary font-semibold'
              : 'text-on-surface-variant hover:text-primary'
          }`}
        >
          <span
            className={`material-symbols-outlined text-[24px] ${
              route === 'feed' ? 'material-symbols-filled' : ''
            }`}
          >
            home
          </span>
          <span className="text-[12px] leading-[16px] tracking-[0.02em] font-semibold">
            Home
          </span>
        </button>

        <div className="relative -top-5 flex items-center justify-center">
          <button
            type="button"
            aria-label="Create Confession"
            onClick={() => onNavigate('create-text')}
            className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-tr from-primary to-primary-container text-on-primary shadow-[0_8px_20px_-2px_rgba(79,70,229,0.38)] active:scale-95 transition-transform cursor-pointer"
          >
            <span className="material-symbols-outlined text-[28px]">add</span>
          </button>
        </div>

        <button
          type="button"
          aria-current={route === 'settings' ? 'page' : undefined}
          onClick={() => onNavigate('settings')}
          className={`flex flex-col items-center justify-center gap-1 min-w-[56px] min-h-[48px] transition-all cursor-pointer ${
            route === 'settings'
              ? 'text-primary font-semibold'
              : 'text-on-surface-variant hover:text-primary'
          }`}
        >
          <span
            className={`material-symbols-outlined text-[24px] ${
              route === 'settings' ? 'material-symbols-filled' : ''
            }`}
          >
            tune
          </span>
          <span className="text-[12px] leading-[16px] tracking-[0.02em] font-semibold">
            Settings
          </span>
        </button>
      </div>
    </nav>
  );
};
