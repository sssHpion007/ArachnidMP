import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  X, 
  SlidersHorizontal, 
  Settings, 
  FolderPlus,
  Music,
  ListMusic,
  Disc,
  Mic2,
  Heart,
  Tag,
  ArrowLeft
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
  themeMode?: ThemeMode;
  onToggleTheme?: () => void;
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
  const [isSearchExpanded, setIsSearchExpanded] = useState<boolean>(false);
  const desktopSearchInputRef = useRef<HTMLInputElement>(null);
  const compactSearchInputRef = useRef<HTMLInputElement>(null);

  // Tab indicator refs and state for smooth sliding glow animation
  const navContainerRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number; height: number; opacity: number }>({
    left: 0,
    width: 0,
    height: 0,
    opacity: 0,
  });

  const t = getTranslations(language);

  // Resize handler with automatic deactivation of compact search overlay when expanding window
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setWindowWidth(width);
      if (width >= 780) {
        setIsSearchExpanded(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Global Ctrl + F listener to open search
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.code === 'KeyF' || e.key === 'f' || e.key === 'F' || e.key === 'а' || e.key === 'А') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (windowWidth < 780) {
          setIsSearchExpanded(true);
          setTimeout(() => {
            compactSearchInputRef.current?.focus();
            compactSearchInputRef.current?.select();
          }, 50);
        } else {
          desktopSearchInputRef.current?.focus();
          desktopSearchInputRef.current?.select();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [windowWidth]);

  useEffect(() => {
    if (isSearchExpanded) {
      setTimeout(() => {
        compactSearchInputRef.current?.focus();
      }, 50);
    }
  }, [isSearchExpanded]);

  const allNavTabs = [
    { id: 'tracks' as const, label: t.nav.tracks, icon: Music },
    { id: 'playlists' as const, label: t.nav.playlists, icon: ListMusic },
    { id: 'albums' as const, label: t.nav.albums, icon: Disc },
    { id: 'artists' as const, label: t.nav.artists, icon: Mic2 },
    { id: 'favorites' as const, label: t.nav.favorites, icon: Heart },
    { id: 'genres' as const, label: t.nav.genres, icon: Tag },
  ];

  const navTabs = allNavTabs.filter(tab => (visibleTabs ? visibleTabs[tab.id] ?? true : true));

  // Breakpoints: narrow transformation starts at 780px to prevent crowding with side buttons
  const isNarrow = windowWidth < 780;
  const isCompact = windowWidth < 1200 || (navTabs.length * 110 + 520 > windowWidth);
  const isSuperCompact = windowWidth < 880;

  // Smooth sliding glow pill positioning
  const updateIndicator = () => {
    const el = tabRefs.current[currentView];
    if (el) {
      setIndicatorStyle({
        left: el.offsetLeft,
        width: el.offsetWidth,
        height: el.offsetHeight,
        opacity: 1,
      });
    }
  };

  useEffect(() => {
    updateIndicator();
    const timer = setTimeout(updateIndicator, 40);
    return () => clearTimeout(timer);
  }, [currentView, isCompact, isNarrow, navTabs.length, windowWidth]);

  useEffect(() => {
    if (navContainerRef.current && window.ResizeObserver) {
      const ro = new ResizeObserver(() => updateIndicator());
      ro.observe(navContainerRef.current);
      return () => ro.disconnect();
    }
  }, []);

  return (
    <header data-tauri-drag-region className="relative h-16 px-3 sm:px-6 shrink-0 flex items-center justify-between gap-2 sm:gap-4 bg-md3-surface-container-low border-b border-md3-outline-variant/15 select-none transition-colors duration-300">
      
      {/* NARROW SCREEN EXPANDED SEARCH OVERLAY WITH PERFECT SYMMETRICAL PADDING */}
      {isNarrow && isSearchExpanded && (
        <div className="absolute inset-0 z-50 flex items-center px-3 gap-2 bg-md3-surface-container-low border-b border-md3-outline-variant/15 animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Back button (Left) */}
          <button
            onClick={() => setIsSearchExpanded(false)}
            title={language === 'ru' ? 'Назад / Закрыть поиск (Esc)' : 'Back / Close search (Esc)'}
            className="w-10 h-10 flex items-center justify-center rounded-full text-md3-on-surface hover:bg-md3-surface-container transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          {/* Symmetrical Search Pill */}
          <div className="relative flex-1 h-10 flex items-center p-1 px-3.5 bg-md3-surface-container rounded-full border border-md3-primary/60 shadow-sm overflow-hidden">
            <Search className="w-4 h-4 text-md3-primary mr-2 shrink-0" />
            <input
              ref={compactSearchInputRef}
              data-search-input="true"
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsSearchExpanded(false);
                }
              }}
              placeholder={searchPlaceholder || (language === 'ru' ? `Поиск по ${totalTracksCount} трекам...` : `Search ${totalTracksCount} tracks...`)}
              className="w-full h-full bg-transparent text-xs text-md3-on-surface placeholder-md3-on-surface-variant/50 border-0 outline-none focus:outline-none ring-0 focus:ring-0 truncate pr-6 select-text"
            />
            {searchQuery && (
              <button
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 flex items-center justify-center text-md3-on-surface-variant hover:text-md3-on-surface cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Symmetrical Right Spacer: Matches the Left Arrow button 1:1 for perfect visual balance */}
          <div className="w-10 h-10 shrink-0 pointer-events-none" />
        </div>
      )}

      {/* LEFT AREA: Search */}
      {isNarrow ? (
        /* Mobile Search Button */
        <div className="z-10 shrink-0 flex items-center">
          <button
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setIsSearchExpanded(true)}
            title={language === 'ru' ? 'Поиск (Ctrl + F)' : 'Search (Ctrl + F)'}
            className={`w-10 h-10 flex items-center justify-center rounded-full bg-md3-surface-container border border-md3-outline-variant/15 text-md3-on-surface hover:bg-md3-surface-container-high transition-colors cursor-pointer shrink-0 relative shadow-xs ${
              searchQuery ? 'text-md3-primary ring-1 ring-md3-primary/60 bg-md3-primary/10' : ''
            }`}
          >
            <Search className="w-4 h-4" />
            {searchQuery && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-md3-primary" />
            )}
          </button>
        </div>
      ) : (
        /* Desktop Search Bar Pill Frame */
        <div className="z-10 shrink-0 w-32 sm:w-40 md:w-52 lg:w-64 transition-all flex items-center">
          <div className="relative w-full h-10 flex items-center p-1 px-3 bg-md3-surface-container rounded-full border border-md3-outline-variant/15 shadow-xs focus-within:border-md3-primary/60 focus-within:bg-md3-surface-container-high overflow-hidden transition-colors">
            <div className="flex items-center pointer-events-none text-md3-on-surface-variant shrink-0 mr-2">
              <Search className="w-3.5 h-3.5" />
            </div>
            <input
              ref={desktopSearchInputRef}
              data-search-input="true"
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  e.stopPropagation();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder={searchPlaceholder || (isSuperCompact ? (language === 'ru' ? 'Поиск (Ctrl+F)...' : 'Search (Ctrl+F)...') : `${language === 'ru' ? 'Поиск' : 'Search'} (${totalTracksCount})...`)}
              className="w-full h-full bg-transparent text-xs text-md3-on-surface placeholder-md3-on-surface-variant/50 border-0 outline-none focus:outline-none ring-0 focus:ring-0 truncate pr-5 select-text"
              style={{ outline: 'none', boxShadow: 'none' }}
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
      )}

      {/* CENTER: Navigation Tabs (Pills) - ALWAYS EXACT MATHEMATICAL CENTER WITH SLIDING GLOW PILL */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-0 pointer-events-none flex justify-center items-center">
        <nav 
          ref={navContainerRef}
          className={`relative pointer-events-auto h-10 flex items-center gap-1 p-1 bg-md3-surface-container rounded-full border border-md3-outline-variant/15 shadow-xs max-w-full select-none ${
            isNarrow ? 'overflow-x-auto no-scrollbar' : 'overflow-hidden'
          }`}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {/* Smooth sliding glow pill indicator */}
          <div
            className="absolute rounded-full bg-md3-primary shadow-sm pointer-events-none transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] z-0"
            style={{
              left: `${indicatorStyle.left}px`,
              width: `${indicatorStyle.width}px`,
              height: `${indicatorStyle.height}px`,
              opacity: indicatorStyle.opacity,
              boxShadow: '0 0 16px rgba(var(--md-sys-color-primary-rgb, 168 121 255), 0.45), 0 2px 6px rgba(0,0,0,0.2)',
            }}
          />

          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentView === tab.id;

            return (
              <button
                key={tab.id}
                ref={(el) => { tabRefs.current[tab.id] = el; }}
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const el = tabRefs.current[tab.id];
                  if (el) {
                    setIndicatorStyle({
                      left: el.offsetLeft,
                      width: el.offsetWidth,
                      height: el.offsetHeight,
                      opacity: 1,
                    });
                  }
                  onSelectView(tab.id);
                }}
                title={tab.label}
                className={`relative z-10 flex items-center gap-1.5 h-full ${
                  isNarrow ? 'px-2.5 py-1' : isCompact ? 'px-2.5 py-1' : 'px-3.5 py-1'
                } rounded-full text-xs font-medium transition-colors duration-200 shrink-0 cursor-pointer outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ring-0 ${
                  isActive
                    ? 'text-md3-on-primary font-bold'
                    : 'text-md3-on-surface-variant hover:text-md3-on-surface hover:bg-md3-surface-container-high/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 transition-transform ${isActive ? 'stroke-[2.5] scale-105' : ''}`} />
                <span className={isCompact || isNarrow ? 'hidden' : 'inline'}>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* RIGHT CONTROLS: In narrow mode, EQ and Add Files are in bottom bar, so top has only Settings */}
      <div className="z-10 shrink-0 flex items-center justify-end ml-auto">
        {isNarrow ? (
          /* Single Settings button matching left Search button 1:1 in size and position */
          <button
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onOpenSettings}
            title={hasUpdate ? `${t.controls.settings} (${language === 'ru' ? 'Доступно обновление!' : 'Update available!'})` : t.controls.settings}
            className={`w-10 h-10 flex items-center justify-center rounded-full bg-md3-surface-container border border-md3-outline-variant/15 transition-all cursor-pointer relative shadow-xs ${
              hasUpdate
                ? 'text-emerald-400 bg-emerald-500/20 ring-2 ring-emerald-500/40 animate-pulse'
                : 'text-md3-on-surface-variant hover:text-md3-on-surface hover:bg-md3-surface-container-high'
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
        ) : (
          /* Desktop Pill Frame: Add files, Discord, EQ, Settings */
          <div className="h-10 flex items-center gap-1 p-1 bg-md3-surface-container rounded-full border border-md3-outline-variant/15 shadow-xs">
            {/* Add Files Button */}
            <button
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={onOpenFiles}
              title={t.controls.openFiles}
              className={`flex items-center gap-1.5 h-full ${
                isCompact ? 'w-8 px-0 justify-center' : 'px-3.5'
              } rounded-full bg-md3-primary text-md3-on-primary text-xs font-semibold shadow-sm hover:scale-[1.02] active:scale-95 transition-all cursor-pointer shrink-0 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ring-0`}
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span className={isCompact ? 'hidden' : 'inline'}>
                {language === 'ru' ? 'Добавить файлы' : 'Add Files'}
              </span>
            </button>

            {/* Discord RPC switch */}
            {showDiscordButton && windowWidth >= 1000 && (
              <button
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={onToggleDiscord}
                title={language === 'ru'
                  ? `Discord RPC: ${discordEnabled ? 'Включен [D]' : 'Выключен [D]'} (кликните или нажмите D для переключения)`
                  : `Discord RPC: ${discordEnabled ? 'Enabled [D]' : 'Disabled [D]'} (click or press D)`
                }
                className={`flex items-center gap-1.5 h-full px-2.5 rounded-full text-xs font-semibold transition-all cursor-pointer outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ring-0 ${
                  discordEnabled
                    ? 'bg-[#5865F2]/20 text-[#5865F2] font-bold shadow-sm'
                    : 'text-md3-on-surface-variant hover:text-md3-on-surface hover:bg-md3-surface-container-high'
                }`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${discordEnabled ? 'bg-[#5865F2] animate-pulse' : 'bg-gray-400'}`} />
                <span className="hidden xl:inline">
                  Discord
                </span>
              </button>
            )}

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
        )}
      </div>
    </header>
  );
};
