import React, { useState, useEffect } from 'react';
import { 
  Search, 
  X, 
  SlidersHorizontal, 
  Settings, 
  Sun, 
  Moon, 
  FolderPlus,
  Music,
  ListMusic,
  Disc,
  Mic2,
  Heart,
  Tag
} from 'lucide-react';
import { ThemeMode } from '../types/music';
import { AppLanguage, getTranslations } from '../i18n';

export type MainViewType = 'tracks' | 'playlists' | 'albums' | 'artists' | 'favorites' | 'genres';

interface TopBarProps {
  currentView: MainViewType;
  onSelectView: (view: MainViewType) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  totalTracksCount: number;
  searchPlaceholder?: string;
  onOpenFiles: () => void;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
  onOpenEQ: () => void;
  onOpenSettings: () => void;
  discordEnabled: boolean;
  onToggleDiscord: () => void;
  showDiscordButton?: boolean;
  visibleTabs?: Record<MainViewType, boolean>;
  language?: AppLanguage;
  hasUpdate?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentView,
  onSelectView,
  searchQuery,
  onSearchChange,
  totalTracksCount,
  searchPlaceholder,
  onOpenFiles,
  themeMode,
  onToggleTheme,
  onOpenEQ,
  onOpenSettings,
  discordEnabled,
  onToggleDiscord,
  showDiscordButton = true,
  visibleTabs,
  language = 'ru',
  hasUpdate = false,
}) => {
  const [windowWidth, setWindowWidth] = useState<number>(window.innerWidth);

  const t = getTranslations(language);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const allNavTabs = [
    { id: 'tracks' as const, label: t.nav.tracks, icon: Music },
    { id: 'playlists' as const, label: t.nav.playlists, icon: ListMusic },
    { id: 'albums' as const, label: t.nav.albums, icon: Disc },
    { id: 'artists' as const, label: t.nav.artists, icon: Mic2 },
    { id: 'favorites' as const, label: t.nav.favorites, icon: Heart },
    { id: 'genres' as const, label: t.nav.genres, icon: Tag },
  ];

  const navTabs = allNavTabs.filter(tab => (visibleTabs ? visibleTabs[tab.id] ?? true : true));

  // Instantly collapse to miniature (icon-only) as soon as tabs might crowd controls
  const isCompact = windowWidth < 1320 || (navTabs.length * 105 + 460 > windowWidth);
  const isSuperCompact = windowWidth < 850;
  const isUltraCompact = windowWidth < 650;

  return (
    <header data-tauri-drag-region className="relative h-16 px-3 sm:px-6 shrink-0 flex items-center justify-between gap-2 sm:gap-4 bg-md3-surface-container-low border-b border-md3-outline-variant/15 select-none transition-colors duration-300">
      {/* Left: Search Bar Pill Frame (Identical thickness and height to other frames) */}
      <div className="z-10 shrink-0 w-32 sm:w-44 md:w-56 lg:w-64 transition-all flex items-center">
        <div className="relative w-full h-10 flex items-center p-1 px-3 bg-md3-surface-container rounded-full border border-md3-outline-variant/15 shadow-xs focus-within:border-md3-primary/60 focus-within:bg-md3-surface-container-high transition-all">
          <div className="flex items-center pointer-events-none text-md3-on-surface-variant shrink-0 mr-2">
            <Search className="w-3.5 h-3.5" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder || (isSuperCompact ? (language === 'ru' ? 'Поиск...' : 'Search...') : `${language === 'ru' ? 'Поиск' : 'Search'} (${totalTracksCount})...`)}
            className="w-full h-full bg-transparent text-xs text-md3-on-surface placeholder-md3-on-surface-variant/50 border-none outline-none transition-all truncate pr-5"
          />
          {searchQuery && (
            <button
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 flex items-center justify-center text-md3-on-surface-variant hover:text-md3-on-surface cursor-pointer outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Center: Navigation Tabs (Pills) - ALWAYS EXACT MATHEMATICAL CENTER */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-0 pointer-events-none flex justify-center items-center">
        <nav className="pointer-events-auto h-10 flex items-center gap-1 p-1 bg-md3-surface-container rounded-full border border-md3-outline-variant/15 overflow-hidden shadow-xs">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentView === tab.id;

            return (
              <button
                key={tab.id}
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSelectView(tab.id)}
                title={tab.label}
                className={`flex items-center gap-1.5 h-full ${
                  isUltraCompact ? 'px-2 py-1' : isCompact ? 'px-2.5 py-1' : 'px-3.5 py-1'
                } rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ring-0 ${
                  isActive
                    ? 'bg-md3-primary text-md3-on-primary font-bold shadow-sm'
                    : 'text-md3-on-surface-variant hover:text-md3-on-surface hover:bg-md3-surface-container-high'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'stroke-[2.5]' : ''}`} />
                <span className={isCompact ? 'hidden' : 'inline'}>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Right Controls: Unified pill frame, exact same height (h-10) and padding (p-1) */}
      <div className="z-10 shrink-0 flex items-center justify-end ml-auto">
        <div className="h-10 flex items-center gap-1 p-1 bg-md3-surface-container rounded-full border border-md3-outline-variant/15 shadow-xs">
          {/* Add Files Button */}
          <button
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onOpenFiles}
            title={t.controls.openFiles}
            className={`flex items-center gap-1.5 h-full ${
              isCompact ? 'px-2.5' : 'px-3.5'
            } rounded-full bg-md3-primary text-md3-on-primary text-xs font-semibold shadow-sm hover:scale-[1.02] active:scale-95 transition-all cursor-pointer shrink-0 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ring-0`}
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span className={isCompact ? 'hidden' : 'inline'}>
              {language === 'ru' ? 'Добавить файлы' : 'Add Files'}
            </span>
          </button>

          {/* Discord RPC switch (optional via settings) */}
          {showDiscordButton && (
            <button
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={onToggleDiscord}
              title={language === 'ru'
                ? `Discord RPC: ${discordEnabled ? 'Включен [D]' : 'Выключен [D]'} (кликните или нажмите D для переключения)`
                : `Discord RPC: ${discordEnabled ? 'Enabled [D]' : 'Disabled [D]'} (click or press D)`
              }
              className={`flex items-center gap-1.5 h-full ${
                isCompact ? 'px-2.5' : 'px-3'
              } rounded-full text-xs font-semibold transition-all cursor-pointer outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ring-0 ${
                discordEnabled
                  ? 'bg-[#5865F2]/20 text-[#5865F2] font-bold shadow-sm'
                  : 'text-md3-on-surface-variant hover:text-md3-on-surface hover:bg-md3-surface-container-high'
              }`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${discordEnabled ? 'bg-[#5865F2] animate-pulse' : 'bg-gray-400'}`} />
              <span className={isCompact ? 'hidden' : 'inline'}>
                Discord
              </span>
            </button>
          )}

          {/* Theme mode toggle */}
          <button
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onToggleTheme}
            title={language === 'ru'
              ? `Тема: ${themeMode === 'dark' ? 'Темная' : themeMode === 'amoled' ? 'AMOLED' : 'Светлая'}`
              : `Theme: ${themeMode === 'dark' ? 'Dark' : themeMode === 'amoled' ? 'AMOLED' : 'Light'}`
            }
            className="w-8 h-8 flex items-center justify-center rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container-high hover:text-md3-on-surface transition-colors cursor-pointer outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ring-0"
          >
            {themeMode === 'light' ? (
              <Sun className="w-4 h-4 text-amber-500" />
            ) : (
              <Moon className="w-4 h-4 text-md3-primary" />
            )}
          </button>

          {/* EQ Modal button */}
          <button
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onOpenEQ}
            title={t.controls.equalizer}
            className="w-8 h-8 flex items-center justify-center rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container-high hover:text-md3-on-surface transition-colors cursor-pointer outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ring-0"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          {/* Settings button */}
          <button
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onOpenSettings}
            title={hasUpdate ? `${t.controls.settings} (${language === 'ru' ? 'Доступно обновление!' : 'Update available!'})` : t.controls.settings}
            className={`w-8 h-8 flex items-center justify-center rounded-full transition-all cursor-pointer outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ring-0 relative ${
              hasUpdate
                ? 'text-emerald-400 bg-emerald-500/20 hover:bg-emerald-500/30 ring-2 ring-emerald-500/40 animate-pulse shadow-sm'
                : 'text-md3-on-surface-variant hover:bg-md3-surface-container-high hover:text-md3-on-surface'
            }`}
          >
            <Settings className={`w-4 h-4 ${hasUpdate ? 'text-emerald-400' : ''}`} />
            {hasUpdate && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
