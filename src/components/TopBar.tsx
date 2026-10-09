import React from 'react';
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
  onOpenFiles: () => void;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
  onOpenEQ: () => void;
  onOpenSettings: () => void;
  discordEnabled: boolean;
  onToggleDiscord: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentView,
  onSelectView,
  searchQuery,
  onSearchChange,
  totalTracksCount,
  onOpenFiles,
  themeMode,
  onToggleTheme,
  onOpenEQ,
  onOpenSettings,
  discordEnabled,
  onToggleDiscord,
}) => {
  const navTabs = [
    { id: 'tracks' as const, label: 'Все треки', icon: Music },
    { id: 'playlists' as const, label: 'Плейлисты', icon: ListMusic },
    { id: 'albums' as const, label: 'Альбомы', icon: Disc },
    { id: 'artists' as const, label: 'Артисты', icon: Mic2 },
    { id: 'favorites' as const, label: 'Любимые', icon: Heart },
    { id: 'genres' as const, label: 'Жанры', icon: Tag },
  ];

  return (
    <header className="h-16 px-6 shrink-0 flex items-center justify-between gap-4 bg-md3-surface-container-low border-b border-md3-outline-variant/15 select-none transition-colors duration-300">
      {/* Left: App Logo & Add Files & Search */}
      <div className="flex items-center gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2 pr-2">
          <div className="w-9 h-9 rounded-2xl bg-md3-primary/15 flex items-center justify-center text-md3-primary shadow-sm border border-md3-primary/20">
            <span className="text-lg leading-none">🕷️</span>
          </div>
          <span className="font-extrabold text-base tracking-tight text-md3-on-surface hidden sm:inline">
            Arachnid
          </span>
        </div>

        {/* Add Files Button */}
        <button
          onClick={onOpenFiles}
          title="Добавить аудиофайлы с диска"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-md3-primary text-md3-on-primary text-xs font-semibold shadow-sm hover:scale-[1.02] active:scale-95 transition-all cursor-pointer shrink-0"
        >
          <FolderPlus className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Добавить файлы</span>
        </button>

        {/* Search Bar */}
        <div className="relative w-44 sm:w-56 md:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-md3-on-surface-variant">
            <Search className="w-3.5 h-3.5" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={`Поиск (${totalTracksCount})...`}
            className="w-full pl-8 pr-7 py-1.5 rounded-full bg-md3-surface-container text-xs text-md3-on-surface placeholder-md3-on-surface-variant/50 border border-transparent focus:border-md3-primary focus:bg-md3-surface-container-high outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-md3-on-surface-variant hover:text-md3-on-surface"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Center: Navigation Tabs (Pills) */}
      <nav className="flex items-center gap-1 p-1 bg-md3-surface-container rounded-full border border-md3-outline-variant/15 overflow-x-auto custom-scrollbar">
        {navTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentView === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectView(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-md3-primary text-md3-on-primary font-bold shadow-sm'
                  : 'text-md3-on-surface-variant hover:text-md3-on-surface hover:bg-md3-surface-container-high'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'stroke-[2.5]' : ''}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Right Controls: Discord RPC, Theme, EQ, Settings */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Discord RPC switch */}
        <button
          onClick={onToggleDiscord}
          title={discordEnabled ? 'Discord RPC активен (кликните для отключения)' : 'Discord RPC отключен (кликните для включения)'}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
            discordEnabled
              ? 'bg-[#5865F2]/15 border-[#5865F2]/30 text-[#5865F2] hover:bg-[#5865F2]/25'
              : 'bg-md3-surface-container border-md3-outline-variant/20 text-md3-on-surface-variant/50 hover:bg-md3-surface-container-high'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${discordEnabled ? 'bg-[#5865F2] animate-pulse' : 'bg-gray-500'}`} />
          <span className="hidden xl:inline">Discord:</span>
          <span>{discordEnabled ? 'Вкл' : 'Выкл'}</span>
        </button>

        {/* Theme mode toggle */}
        <button
          onClick={onToggleTheme}
          title={`Тема: ${themeMode === 'dark' ? 'Темная' : themeMode === 'amoled' ? 'AMOLED' : 'Светлая'}`}
          className="p-2 rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container hover:text-md3-on-surface transition-colors cursor-pointer"
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
          className="p-2 rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container hover:text-md3-on-surface transition-colors cursor-pointer"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          title="Настройки"
          className="p-2 rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container hover:text-md3-on-surface transition-colors cursor-pointer"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
