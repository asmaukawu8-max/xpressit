import React from 'react';
import { ScreenRoute } from '../types';

interface DesktopNavRailProps {
  route: ScreenRoute;
  username: string;
  bookmarkedCount: number;
  onNavigate: (route: ScreenRoute) => void;
}

export const DesktopNavRail: React.FC<DesktopNavRailProps> = ({
  route,
  username,
  bookmarkedCount,
  onNavigate,
}) => {
  const navItems: {
    id: ScreenRoute;
    label: string;
    icon: string;
    activeMatch: ScreenRoute[];
  }[] = [
    {
      id: 'feed',
      label: 'Home Feed',
      icon: 'home',
      activeMatch: ['feed', 'detail'],
    },
    {
      id: 'create-text',
      label: 'Write Story',
      icon: 'edit_note',
      activeMatch: ['create-text'],
    },
    {
      id: 'create-voice',
      label: 'Voice Studio',
      icon: 'mic',
      activeMatch: ['create-voice'],
    },
    {
      id: 'settings',
      label: 'Settings & Privacy',
      icon: 'tune',
      activeMatch: ['settings'],
    },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-60 shrink-0 sticky top-24 self-start gap-4">
      <div className="bg-surface-container-lowest rounded-2xl p-3 shadow-[0_2px_12px_rgba(15,23,42,0.04)] flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = item.activeMatch.includes(route);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-primary-fixed text-primary'
                  : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
              }`}
            >
              <span
                className={`material-symbols-outlined text-[21px] ${
                  isActive ? 'material-symbols-filled' : ''
                }`}
              >
                {item.icon}
              </span>
              <span className="whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}

        <div className="pt-2 mt-2 border-t border-outline-variant/30">
          <button
            type="button"
            onClick={() => onNavigate('create-text')}
            className="w-full py-3 px-4 rounded-full bg-gradient-to-tr from-primary to-primary-container text-on-primary text-sm font-semibold shadow-md shadow-primary/25 hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            <span>New Confession</span>
          </button>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">masks</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-on-surface truncate">
              @{username}
            </p>
            <p className="text-[11px] text-on-surface-variant">
              Pseudonymous Account
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-on-surface-variant pt-2 border-t border-outline-variant/30">
          <span>Saved locally</span>
          <span className="font-semibold text-on-surface tabular-nums">
            {bookmarkedCount}
          </span>
        </div>
      </div>
    </aside>
  );
};
