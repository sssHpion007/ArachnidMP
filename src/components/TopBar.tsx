import React from 'react';
import { Search, X, SlidersHorizontal, Settings, Sun, Moon, Sparkles } from 'lucide-react';
import { ThemeMode } from '../types/music';

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeGenre: string | null;
  onSelectGenre: (genre: string | null) => void;
  genres: string[];
  themeMode: ThemeMode;
  onToggleTheme: () => void;
  onOpenEQ: () => void;
  onOpenSettings: () => void;
  discordEnabled: boolean;
  totalTracksCount: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  searchQuery,
  onSearchChange,
  activeGenre,
  onSelectGenre,
  genres,
  themeMode,
  onToggleTheme,
  onOpenEQ,
  onOpenSettings,
  discordEnabled,
  totalTracksCount,
}) => {
  return (
    <header className="h-16 px-6 flex items-center justify-between gap-4 bg-md3-surface border-b border-md3-outline-variant/20 transition-colors duration-300">
      {/* Search Bar - Material 3 Pill */}
      <div className="relative w-80 max-w-sm">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-md3-on-surface-variant">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={`Поиск среди ${totalTracksCount} треков, артистов...`}
          className="w-full pl-10 pr-9 py-2 rounded-full bg-md3-surface-container text-sm text-md3-on-surface placeholder-md3-on-surface-variant/50 border border-transparent focus:border-md3-primary focus:bg-md3-surface-container-high outline-none transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-md3-on-surface-variant hover:text-md3-on-surface"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter Chips */}
      <div className="hidden lg:flex items-center gap-1.5 overflow-x-auto py-1">
        <button
          onClick={() => onSelectGenre(null)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
            activeGenre === null
              ? 'bg-md3-secondary-container text-md3-on-secondary-container shadow-sm font-semibold'
              : 'bg-md3-surface-container text-md3-on-surface-variant hover:bg-md3-surface-container-high'
          }`}
        >
          Все жанры
        </button>
        {genres.map((g) => (
          <button
            key={g}
            onClick={() => onSelectGenre(activeGenre === g ? null : g)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              activeGenre === g
                ? 'bg-md3-secondary-container text-md3-on-secondary-container shadow-sm font-semibold'
                : 'bg-md3-surface-container text-md3-on-surface-variant hover:bg-md3-surface-container-high'
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        {/* Discord RPC Status Pill */}
        <button
          onClick={onOpenSettings}
          title={discordEnabled ? 'Discord RPC активен' : 'Discord RPC отключён'}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
            discordEnabled
              ? 'bg-[#5865F2]/10 border-[#5865F2]/30 text-[#5865F2] hover:bg-[#5865F2]/20'
              : 'bg-md3-surface-container border-md3-outline-variant/30 text-md3-on-surface-variant/60'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${discordEnabled ? 'bg-[#5865F2] animate-pulse' : 'bg-gray-500'}`} />
          <span className="font-semibold">Discord RPC</span>
        </button>

        {/* Theme mode toggle */}
        <button
          onClick={onToggleTheme}
          title={`Тема: ${themeMode === 'dark' ? 'Темная' : themeMode === 'amoled' ? 'AMOLED' : 'Светлая'}`}
          className="p-2 rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container hover:text-md3-on-surface transition-colors"
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
          className="p-2 rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container hover:text-md3-on-surface transition-colors"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          title="Настройки"
          className="p-2 rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container hover:text-md3-on-surface transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
