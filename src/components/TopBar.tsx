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
}) => {
  const [windowWidth, setWindowWidth] = useState<number>(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const allNavTabs = [
    { id: 'tracks' as const, label: 'Все треки', icon: Music },
    { id: 'playlists' as const, label: 'Плейлисты', icon: ListMusic },
    { id: 'albums' as const, label: 'Альбомы', icon: Disc },
    { id: 'artists' as const, label: 'Исполнители', icon: Mic2 },
    { id: 'favorites' as const, label: 'Избранное', icon: Heart },
    { id: 'genres' as const, label: 'Жанры', icon: Tag },
  ];

  const navTabs = allNavTabs.filter(tab => (visibleTabs ? visibleTabs[tab.id] ?? true : true));

  // Instantly collapse to miniature (icon-only) as soon as tabs might crowd controls
  const isCompact = windowWidth < 1320 || (navTabs.length * 105 + 460 > windowWidth);
  const isSuperCompact = windowWidth < 850;
  const isUltraCompact = windowWidth < 650;

  return (
    <header data-tauri-drag-region className="relative h-16 px-3 sm:px-6 shrink-0 flex items-center justify-between gap-2 sm:gap-4 bg-md3-surface-container-low border-b border-md3-outline-variant/15 select-none transition-colors duration-300">
      {/* Left: Search Bar (Flexible width, never forces overflow) */}
      <div className="z-10 shrink-0 w-28 sm:w-40 md:w-52 lg:w-60 transition-all">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-2.5 sm:pl-3 flex items-center pointer-events-none text-md3-on-surface-variant">
            <Search className="w-3.5 h-3.5" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder || (isSuperCompact ? 'Поиск...' : `Поиск (${totalTracksCount})...`)}
            className="w-full pl-7 sm:pl-8 pr-6 sm:pr-7 py-1.5 rounded-full bg-md3-surface-container text-xs text-md3-on-surface placeholder-md3-on-surface-variant/50 border border-transparent focus:border-md3-primary focus:bg-md3-surface-container-high outline-none transition-all truncate"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 right-0 pr-2 sm:pr-2.5 flex items-center text-md3-on-surface-variant hover:text-md3-on-surface cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Center: Navigation Tabs (Pills) - ALWAYS EXACT MATHEMATICAL CENTER */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-0 pointer-events-none flex justify-center">
        <nav className="pointer-events-auto flex items-center gap-1 p-1 bg-md3-surface-container rounded-full border border-md3-outline-variant/15 overflow-hidden shadow-xs">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentView === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => onSelectView(tab.id)}
                title={tab.label}
                className={`flex items-center gap-1.5 ${
                  isUltraCompact ? 'px-2 py-1' : isCompact ? 'px-2.5 py-1.5' : 'px-3.5 py-1.5'
                } rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer ${
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

      {/* Right Controls: Unified pill frame, compact and responsive */}
      <div className="z-10 shrink-0 flex items-center justify-end ml-auto">
        <div className="flex items-center gap-1 p-1 bg-md3-surface-container rounded-full border border-md3-outline-variant/15">
          {/* Add Files Button */}
          <button
            onClick={onOpenFiles}
            title="Добавить аудиофайлы с диска"
            className={`flex items-center gap-1.5 ${
              isCompact ? 'p-1.5' : 'px-3.5 py-1.5'
            } rounded-full bg-md3-primary text-md3-on-primary text-xs font-semibold shadow-sm hover:scale-[1.02] active:scale-95 transition-all cursor-pointer shrink-0`}
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span className={isCompact ? 'hidden' : 'inline'}>Добавить файлы</span>
          </button>

          {/* Discord RPC switch (optional via settings) */}
          {showDiscordButton && (
            <button
              onClick={onToggleDiscord}
              title={`Discord RPC: ${discordEnabled ? 'Включен [D]' : 'Выключен [D]'} (кликните или нажмите D для переключения)`}
              className={`flex items-center gap-1.5 ${
                isCompact ? 'px-2 py-1.5' : 'px-3 py-1.5'
              } rounded-full text-xs font-semibold transition-all cursor-pointer ${
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
            onClick={onToggleTheme}
            title={`Тема: ${themeMode === 'dark' ? 'Темная' : themeMode === 'amoled' ? 'AMOLED' : 'Светлая'}`}
            className="p-1.5 rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container-high hover:text-md3-on-surface transition-colors cursor-pointer"
          >
            {themeMode === 'light' ? (
              <Sun className="w-4 h-4 text-amber-500" />
            ) : (
              <Moon className="w-4 h-4 text-md3-primary" />
            )}
          </button>

          {/* EQ Modal button */}
          <button
            onClick={onOpenEQ}
            title="Эквалайзер"
            className="p-1.5 rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container-high hover:text-md3-on-surface transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          {/* Settings button */}
          <button
            onClick={onOpenSettings}
            title="Настройки"
            className="p-1.5 rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container-high hover:text-md3-on-surface transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

