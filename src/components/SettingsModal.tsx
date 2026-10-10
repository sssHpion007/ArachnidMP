import React, { useState, useEffect } from 'react';
import { 
  X, 
  Settings, 
  Sparkles, 
  Palette,
  Monitor,
  Check, 
  Moon, 
  Sun,
  Volume2,
  Clock,
  LayoutGrid,
  Music,
  ListMusic,
  Disc,
  Mic2,
  Heart,
  Tag,
  Keyboard,
  ArrowLeft,
  ChevronRight,
  Globe,
  FolderOpen,
  RefreshCw,
  Layers,
  FileCode
} from 'lucide-react';
import { ThemeMode, Track, FadeMode } from '../types/music';
import { MainViewType } from './TopBar';
import { formatTime } from '../services/tagEditor';
import { AppLanguage, getTranslations } from '../i18n';
import { isTauri, invoke } from '@tauri-apps/api/core';

export type ColorSchemeMode = 'dynamic' | 'system' | 'custom';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  themeMode: ThemeMode;
  onSetThemeMode: (mode: ThemeMode) => void;
  colorSchemeMode: ColorSchemeMode;
  onSetColorSchemeMode: (mode: ColorSchemeMode) => void;
  seedColor: string;
  onSetSeedColor: (color: string) => void;
  appTheme: string;
  onSetAppTheme: (theme: string) => void;
  secondarySeedColor: string;
  onSetSecondarySeedColor: (color: string) => void;
  language: AppLanguage;
  onSetLanguage: (lang: AppLanguage) => void;
  discordEnabled: boolean;
  onToggleDiscord: () => void;
  showDiscordButton: boolean;
  onToggleShowDiscordButton: () => void;
  visibleTabs: Record<MainViewType, boolean>;
  onToggleTabVisibility: (tab: MainViewType) => void;
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  fadeMode: FadeMode;
  onSetFadeMode: (mode: FadeMode) => void;
  fadeDuration: number;
  onSetFadeDuration: (dur: number) => void;
}

const STANDARD_PRESETS = [
  { name: 'Deep Violet', color: '#8b5cf6' },
  { name: 'Emerald', color: '#10b981' },
  { name: 'Electric Blue', color: '#0ea5e9' },
  { name: 'Sunset Amber', color: '#f59e0b' },
  { name: 'Rose Petal', color: '#f43f5e' },
  { name: 'Cyberpunk Pink', color: '#d946ef' },
];

const DISCORD_PRESETS = [
  { name: 'Blurple', color: '#5865F2' },
  { name: 'Emerald', color: '#57F287' },
  { name: 'Fuchsia', color: '#EB459E' },
  { name: 'Sunset Coral', color: '#ED4245' },
  { name: 'Solar Gold', color: '#FEE75C' },
  { name: 'Classic Dark', color: '#313338' },
];

const TELEGRAM_PRESETS = [
  { name: 'Telegram Blue', color: '#5288c1' },
  { name: 'Deep Cyan', color: '#2f6ea5' },
  { name: 'Emerald', color: '#4fae84' },
  { name: 'Amber', color: '#e5803a' },
  { name: 'Amethyst', color: '#8e7cf8' },
  { name: 'Graphite Steel', color: '#242f3d' },
];

const CYBERPUNK_PAIRS = [
  { name: 'Neon Cyan & Magenta', primary: '#00f5d4', secondary: '#f72585' },
  { name: 'Electric Lime & Orange', primary: '#10b981', secondary: '#f97316' },
  { name: 'Tokyo Purple & Aqua', primary: '#a855f7', secondary: '#38bdf8' },
  { name: 'Solar Gold & Indigo', primary: '#ffd166', secondary: '#7209b7' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  themeMode,
  onSetThemeMode,
  colorSchemeMode,
  onSetColorSchemeMode,
  seedColor,
  onSetSeedColor,
  appTheme,
  onSetAppTheme,
  secondarySeedColor,
  onSetSecondarySeedColor,
  language,
  onSetLanguage,
  discordEnabled,
  onToggleDiscord,
  showDiscordButton,
  onToggleShowDiscordButton,
  visibleTabs,
  onToggleTabVisibility,
  currentTrack,
  isPlaying,
  currentTime,
  fadeMode,
  onSetFadeMode,
  fadeDuration,
  onSetFadeDuration,
}) => {
  const [currentView, setCurrentView] = useState<'main' | 'shortcuts'>('main');
  const [customThemesList, setCustomThemesList] = useState<Array<{ name: string; filename: string }>>([]);

  const t = getTranslations(language);

  // Load custom themes from themes/ folder
  const refreshCustomThemes = async () => {
    if (isTauri()) {
      try {
        const list = await invoke<Array<{ name: string; filename: string }>>('list_custom_themes');
        setCustomThemesList(list || []);
      } catch (e) {
        console.warn('Failed to load custom themes:', e);
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      setCurrentView('main');
      refreshCustomThemes();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOpenThemesFolder = () => {
    if (isTauri()) {
      invoke('open_app_folder', { subfolder: 'themes' }).catch(console.warn);
    }
  };

  const handleOpenLocalesFolder = () => {
    if (isTauri()) {
      invoke('open_app_folder', { subfolder: 'locales' }).catch(console.warn);
    }
  };

  const navTabConfigs = [
    { id: 'tracks' as MainViewType, label: t.nav.tracks, icon: Music },
    { id: 'playlists' as MainViewType, label: t.nav.playlists, icon: ListMusic },
    { id: 'albums' as MainViewType, label: t.nav.albums, icon: Disc },
    { id: 'artists' as MainViewType, label: t.nav.artists, icon: Mic2 },
    { id: 'favorites' as MainViewType, label: t.nav.favorites, icon: Heart },
    { id: 'genres' as MainViewType, label: t.nav.genres, icon: Tag },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-xl bg-md3-surface-container rounded-3xl border border-md3-outline-variant/30 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-md3-on-surface"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-md3-outline-variant/20 bg-md3-surface/50">
          <div className="flex items-center gap-3">
            {currentView === 'shortcuts' ? (
              <button
                onClick={() => setCurrentView('main')}
                className="w-10 h-10 rounded-2xl bg-md3-primary/10 hover:bg-md3-primary/20 text-md3-primary flex items-center justify-center transition-all cursor-pointer"
                title="Назад к настройкам"
              >
                <ArrowLeft className="w-5 h-5 text-md3-primary" />
              </button>
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-md3-primary/10 text-md3-primary flex items-center justify-center">
                <Settings className="w-5 h-5" />
              </div>
            )}
            <div>
              <h3 className="font-bold text-base text-md3-on-surface">
                {currentView === 'shortcuts' ? t.settings.shortcuts : t.settings.title}
              </h3>
              <p className="text-xs text-md3-on-surface-variant">
                {currentView === 'shortcuts'
                  ? t.settings.shortcutsDesc
                  : t.settings.subtitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container hover:text-md3-on-surface cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {currentView === 'shortcuts' ? (
          /* Keyboard Shortcuts View */
          <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
            {/* Playback & Volume */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-md3-primary flex items-center gap-2">
                <Music className="w-4 h-4" />
                <span>Воспроизведение и звук</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">{t.shortcuts.space}</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    Space
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">Следующий трек</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    Ctrl + →
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">Предыдущий трек</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    Ctrl + ←
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">Перемотка (±5 сек)</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    ← / →
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">{t.shortcuts.ctrlArrows}</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    Ctrl + ↑ / ↓
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">{t.shortcuts.arrowsNav}</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    ↑ / ↓
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">{t.shortcuts.enterPlay}</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    Enter
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">{t.shortcuts.shiftEnterEdit}</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    Shift + Enter
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">{t.shortcuts.keyM}</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    M
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">Случайный порядок</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    E
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">Режим зацикливания</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    R
                  </kbd>
                </div>
              </div>
            </div>

            {/* Navigation & Panels */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-md3-primary flex items-center gap-2">
                <LayoutGrid className="w-4 h-4" />
                <span>Навигация и панели</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">{t.shortcuts.keyF}</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    F / Ctrl + F
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">{t.shortcuts.keyQ}</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    Q
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">{t.shortcuts.keyL}</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    L
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">{t.shortcuts.keyD}</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    D
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">{t.shortcuts.keyComma}</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    Ctrl + ,
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">Полноэкранный режим</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    F11
                  </kbd>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Main Settings View */
          <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
            
            {/* 1. Section: Appearance (Внешний вид) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-md3-on-surface">
                  <Palette className="w-4 h-4 text-md3-primary" />
                  <span>{t.settings.appearance}</span>
                </div>
                <button
                  onClick={handleOpenThemesFolder}
                  title={t.settings.openThemesFolder}
                  className="text-[11px] flex items-center gap-1.5 text-md3-primary hover:underline cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>{t.settings.openThemesFolder}</span>
                </button>
              </div>

              {/* Theme Mode Buttons (Dark / AMOLED / Light) */}
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => onSetThemeMode('dark')}
                  className={`p-3 rounded-2xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                    themeMode === 'dark'
                      ? 'border-md3-primary bg-md3-primary/10 text-md3-primary font-semibold shadow-xs'
                      : 'border-md3-outline-variant/30 bg-md3-surface text-md3-on-surface-variant hover:bg-md3-surface-container-high'
                  }`}
                >
                  <Moon className="w-5 h-5" />
                  <span className="text-xs">{t.settings.dark}</span>
                </button>

                <button
                  onClick={() => onSetThemeMode('amoled')}
                  className={`p-3 rounded-2xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                    themeMode === 'amoled'
                      ? 'border-md3-primary bg-md3-primary/10 text-md3-primary font-semibold shadow-xs'
                      : 'border-md3-outline-variant/30 bg-md3-surface text-md3-on-surface-variant hover:bg-md3-surface-container-high'
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-black border border-white/40 flex items-center justify-center text-[10px] text-white font-bold">
                    ●
                  </div>
                  <span className="text-xs">{t.settings.amoled}</span>
                </button>

                <button
                  onClick={() => onSetThemeMode('light')}
                  className={`p-3 rounded-2xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                    themeMode === 'light'
                      ? 'border-md3-primary bg-md3-primary/10 text-md3-primary font-semibold shadow-xs'
                      : 'border-md3-outline-variant/30 bg-md3-surface text-md3-on-surface-variant hover:bg-md3-surface-container-high'
                  }`}
                >
                  <Sun className="w-5 h-5 text-amber-500" />
                  <span className="text-xs">{t.settings.light}</span>
                </button>
              </div>

              {/* Theme Style Selector (CSS Темы) */}
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-md3-on-surface flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-md3-primary" />
                    <span>{t.settings.themeStyle}</span>
                  </div>
                  <button 
                    onClick={refreshCustomThemes}
                    title={t.settings.reloadThemes}
                    className="p-1 rounded-lg text-md3-on-surface-variant hover:text-md3-primary hover:bg-md3-surface-container-high transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {/* Built-in Standard Theme (Cannot be deleted) */}
                  <button
                    onClick={() => onSetAppTheme('default')}
                    className={`p-3 rounded-2xl border flex flex-col items-start gap-1 transition-all cursor-pointer text-left ${
                      appTheme === 'default'
                        ? 'border-md3-primary bg-md3-primary/10 text-md3-primary shadow-xs'
                        : 'border-md3-outline-variant/20 bg-md3-surface text-md3-on-surface-variant hover:bg-md3-surface-container-high'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold text-md3-on-surface">Material 3 (Вшитая)</span>
                      {appTheme === 'default' && <Check className="w-3.5 h-3.5 text-md3-primary" />}
                    </div>
                    <span className="text-[10px] opacity-70">Стандартная палитра Material Design</span>
                  </button>

                  {/* Built-in Discord Theme */}
                  <button
                    onClick={() => onSetAppTheme('discord')}
                    className={`p-3 rounded-2xl border flex flex-col items-start gap-1 transition-all cursor-pointer text-left ${
                      appTheme === 'discord'
                        ? 'border-[#5865f2] bg-[#5865f2]/10 text-[#5865f2] shadow-xs'
                        : 'border-md3-outline-variant/20 bg-md3-surface text-md3-on-surface-variant hover:bg-md3-surface-container-high'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold text-md3-on-surface">Discord</span>
                      {appTheme === 'discord' && <Check className="w-3.5 h-3.5 text-[#5865f2]" />}
                    </div>
                    <span className="text-[10px] opacity-70">Тёмная эстетика Discord с акцентами</span>
                  </button>

                  {/* Built-in Telegram Theme */}
                  <button
                    onClick={() => onSetAppTheme('telegram')}
                    className={`p-3 rounded-2xl border flex flex-col items-start gap-1 transition-all cursor-pointer text-left ${
                      appTheme === 'telegram'
                        ? 'border-[#5288c1] bg-[#5288c1]/10 text-[#5288c1] shadow-xs'
                        : 'border-md3-outline-variant/20 bg-md3-surface text-md3-on-surface-variant hover:bg-md3-surface-container-high'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold text-md3-on-surface">Telegram</span>
                      {appTheme === 'telegram' && <Check className="w-3.5 h-3.5 text-[#5288c1]" />}
                    </div>
                    <span className="text-[10px] opacity-70">Ночная сине-графитовая тема</span>
                  </button>

                  {/* Built-in Cyberpunk Duotone Theme */}
                  <button
                    onClick={() => onSetAppTheme('cyberpunk')}
                    className={`p-3 rounded-2xl border flex flex-col items-start gap-1 transition-all cursor-pointer text-left ${
                      appTheme === 'cyberpunk'
                        ? 'border-[#00f5d4] bg-[#00f5d4]/10 text-[#00f5d4] shadow-xs'
                        : 'border-md3-outline-variant/20 bg-md3-surface text-md3-on-surface-variant hover:bg-md3-surface-container-high'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold text-md3-on-surface">Cyberpunk (2 цвета)</span>
                      {appTheme === 'cyberpunk' && <Check className="w-3.5 h-3.5 text-[#00f5d4]" />}
                    </div>
                    <span className="text-[10px] opacity-70">Неоновый двухцветный дуэт</span>
                  </button>
                </div>

                {/* Custom CSS files from themes/ folder */}
                {customThemesList.length > 0 && (
                  <div className="pt-1.5 space-y-1.5">
                    <div className="text-[11px] font-semibold text-md3-on-surface-variant flex items-center gap-1.5">
                      <FileCode className="w-3.5 h-3.5 text-md3-primary" />
                      <span>{t.settings.customThemes} (папка themes/)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {customThemesList.map((ct) => (
                        <button
                          key={ct.filename}
                          onClick={() => onSetAppTheme(`custom:${ct.filename}`)}
                          className={`p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer text-left ${
                            appTheme === `custom:${ct.filename}`
                              ? 'border-md3-primary bg-md3-primary/10 text-md3-primary font-bold shadow-xs'
                              : 'border-md3-outline-variant/20 bg-md3-surface text-md3-on-surface-variant hover:bg-md3-surface-container-high'
                          }`}
                        >
                          <span className="text-xs truncate">{ct.name}</span>
                          {appTheme === `custom:${ct.filename}` && <Check className="w-3.5 h-3.5 text-md3-primary shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Dynamic Color Controls Depending on Theme Style */}
              {appTheme === 'default' && (
                <div className="space-y-2.5 pt-2 border-t border-md3-outline-variant/15 animate-in fade-in duration-200">
                  <div className="text-xs font-semibold text-md3-on-surface">{t.settings.colorPalette}</div>
                  <div className="grid grid-cols-3 gap-2.5">
                    <button
                      onClick={() => onSetColorSchemeMode('dynamic')}
                      className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition-all text-center cursor-pointer ${
                        colorSchemeMode === 'dynamic'
                          ? 'border-md3-primary bg-md3-primary/10 text-md3-primary font-bold shadow-xs'
                          : 'border-md3-outline-variant/20 bg-md3-surface text-md3-on-surface-variant hover:bg-md3-surface-container-high'
                      }`}
                    >
                      <Sparkles className="w-4 h-4" />
                      <span className="text-xs">{t.settings.paletteDynamic}</span>
                      <span className="text-[10px] opacity-70">{t.settings.paletteDynamicDesc}</span>
                    </button>

                    <button
                      onClick={() => onSetColorSchemeMode('system')}
                      className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition-all text-center cursor-pointer ${
                        colorSchemeMode === 'system'
                          ? 'border-md3-primary bg-md3-primary/10 text-md3-primary font-bold shadow-xs'
                          : 'border-md3-outline-variant/20 bg-md3-surface text-md3-on-surface-variant hover:bg-md3-surface-container-high'
                      }`}
                    >
                      <Monitor className="w-4 h-4" />
                      <span className="text-xs">{t.settings.paletteSystem}</span>
                      <span className="text-[10px] opacity-70">{t.settings.paletteSystemDesc}</span>
                    </button>

                    <button
                      onClick={() => onSetColorSchemeMode('custom')}
                      className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition-all text-center cursor-pointer ${
                        colorSchemeMode === 'custom'
                          ? 'border-md3-primary bg-md3-primary/10 text-md3-primary font-bold shadow-xs'
                          : 'border-md3-outline-variant/20 bg-md3-surface text-md3-on-surface-variant hover:bg-md3-surface-container-high'
                      }`}
                    >
                      <Palette className="w-4 h-4" />
                      <span className="text-xs">{t.settings.paletteCustom}</span>
                      <span className="text-[10px] opacity-70">{t.settings.paletteCustomDesc}</span>
                    </button>
                  </div>

                  {/* Standard Custom Palette Presets */}
                  {colorSchemeMode === 'custom' && (
                    <div className="p-3.5 rounded-2xl bg-md3-surface border border-md3-outline-variant/20 space-y-2.5 animate-in fade-in duration-200">
                      <div className="text-xs font-medium text-md3-on-surface-variant">
                        {t.settings.pickAccentColor}
                      </div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        {STANDARD_PRESETS.map((p) => (
                          <button
                            key={p.color}
                            onClick={() => onSetSeedColor(p.color)}
                            style={{ backgroundColor: p.color }}
                            title={p.name}
                            className="w-8 h-8 rounded-full flex items-center justify-center shadow-md hover:scale-110 active:scale-95 transition-transform cursor-pointer"
                          >
                            {seedColor.toLowerCase() === p.color.toLowerCase() && (
                              <Check className="w-4 h-4 text-white drop-shadow" />
                            )}
                          </button>
                        ))}
                        <label
                          className="relative w-8 h-8 rounded-full shadow-md hover:scale-110 active:scale-95 transition-transform cursor-pointer flex items-center justify-center border-2 border-white/40 overflow-hidden"
                          style={{ backgroundColor: seedColor }}
                          title="Выбрать свой цвет"
                        >
                          <input
                            type="color"
                            value={seedColor}
                            onChange={(e) => onSetSeedColor(e.target.value)}
                            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Discord Accent Presets */}
              {appTheme === 'discord' && (
                <div className="p-3.5 rounded-2xl bg-md3-surface border border-md3-outline-variant/20 space-y-2.5 animate-in fade-in duration-200">
                  <div className="text-xs font-medium text-md3-on-surface-variant">
                    Выберите акцентный цвет Discord:
                  </div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {DISCORD_PRESETS.map((p) => (
                      <button
                        key={p.color}
                        onClick={() => onSetSeedColor(p.color)}
                        style={{ backgroundColor: p.color }}
                        title={p.name}
                        className="w-8 h-8 rounded-full flex items-center justify-center shadow-md hover:scale-110 active:scale-95 transition-transform cursor-pointer"
                      >
                        {seedColor.toLowerCase() === p.color.toLowerCase() && (
                          <Check className="w-4 h-4 text-white drop-shadow" />
                        )}
                      </button>
                    ))}
                    <label
                      className="relative w-8 h-8 rounded-full shadow-md hover:scale-110 active:scale-95 transition-transform cursor-pointer flex items-center justify-center border-2 border-white/40 overflow-hidden"
                      style={{ backgroundColor: seedColor }}
                      title="Выбрать свой цвет"
                    >
                      <input
                        type="color"
                        value={seedColor}
                        onChange={(e) => onSetSeedColor(e.target.value)}
                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Telegram Accent Presets */}
              {appTheme === 'telegram' && (
                <div className="p-3.5 rounded-2xl bg-md3-surface border border-md3-outline-variant/20 space-y-2.5 animate-in fade-in duration-200">
                  <div className="text-xs font-medium text-md3-on-surface-variant">
                    Выберите акцентный цвет Telegram:
                  </div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {TELEGRAM_PRESETS.map((p) => (
                      <button
                        key={p.color}
                        onClick={() => onSetSeedColor(p.color)}
                        style={{ backgroundColor: p.color }}
                        title={p.name}
                        className="w-8 h-8 rounded-full flex items-center justify-center shadow-md hover:scale-110 active:scale-95 transition-transform cursor-pointer"
                      >
                        {seedColor.toLowerCase() === p.color.toLowerCase() && (
                          <Check className="w-4 h-4 text-white drop-shadow" />
                        )}
                      </button>
                    ))}
                    <label
                      className="relative w-8 h-8 rounded-full shadow-md hover:scale-110 active:scale-95 transition-transform cursor-pointer flex items-center justify-center border-2 border-white/40 overflow-hidden"
                      style={{ backgroundColor: seedColor }}
                      title="Выбрать свой цвет"
                    >
                      <input
                        type="color"
                        value={seedColor}
                        onChange={(e) => onSetSeedColor(e.target.value)}
                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Cyberpunk Duotone (2 Colors) Presets & Pickers */}
              {appTheme === 'cyberpunk' && (
                <div className="p-3.5 rounded-2xl bg-md3-surface border border-md3-outline-variant/20 space-y-3.5 animate-in fade-in duration-200">
                  <div className="text-xs font-medium text-md3-on-surface-variant">
                    Пресеты двух цветов:
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {CYBERPUNK_PAIRS.map((pair) => (
                      <button
                        key={pair.name}
                        onClick={() => {
                          onSetSeedColor(pair.primary);
                          onSetSecondarySeedColor(pair.secondary);
                        }}
                        className={`p-2 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                          seedColor.toLowerCase() === pair.primary.toLowerCase() &&
                          secondarySeedColor.toLowerCase() === pair.secondary.toLowerCase()
                            ? 'border-md3-primary bg-md3-primary/10 shadow-xs'
                            : 'border-md3-outline-variant/20 hover:bg-md3-surface-container-high'
                        }`}
                      >
                        <span className="text-[11px] font-medium text-md3-on-surface truncate">{pair.name}</span>
                        <div className="flex items-center -space-x-1.5 shrink-0">
                          <div className="w-4 h-4 rounded-full border border-black/30" style={{ backgroundColor: pair.primary }} />
                          <div className="w-4 h-4 rounded-full border border-black/30" style={{ backgroundColor: pair.secondary }} />
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Individual Pickers for Primary & Secondary */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="flex items-center justify-between p-2 rounded-xl bg-md3-surface-container-low border border-md3-outline-variant/20">
                      <span className="text-[11px] text-md3-on-surface-variant">{t.settings.primaryAccent}</span>
                      <label 
                        className="relative w-6 h-6 rounded-full shadow-xs cursor-pointer border border-white/30 overflow-hidden" 
                        style={{ backgroundColor: seedColor }}
                      >
                        <input
                          type="color"
                          value={seedColor}
                          onChange={(e) => onSetSeedColor(e.target.value)}
                          className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                        />
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-xl bg-md3-surface-container-low border border-md3-outline-variant/20">
                      <span className="text-[11px] text-md3-on-surface-variant">{t.settings.secondaryAccent}</span>
                      <label 
                        className="relative w-6 h-6 rounded-full shadow-xs cursor-pointer border border-white/30 overflow-hidden" 
                        style={{ backgroundColor: secondarySeedColor }}
                      >
                        <input
                          type="color"
                          value={secondarySeedColor}
                          onChange={(e) => onSetSecondarySeedColor(e.target.value)}
                          className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Custom CSS Theme Notice */}
              {appTheme.startsWith('custom:') && (
                <div className="p-3.5 rounded-2xl bg-md3-surface border border-md3-outline-variant/20 text-xs text-md3-on-surface-variant flex items-center justify-between animate-in fade-in duration-200">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-md3-on-surface">Пользовательский CSS</div>
                    <div className="text-[11px]">Файл: {appTheme.replace('custom:', '')}</div>
                  </div>
                  <button
                    onClick={refreshCustomThemes}
                    className="px-3 py-1.5 rounded-xl bg-md3-primary/10 text-md3-primary hover:bg-md3-primary/20 text-xs font-semibold cursor-pointer"
                  >
                    Обновить стили
                  </button>
                </div>
              )}
            </div>

            {/* 2. Section: Track Fading (Затухание трека) */}
            <div className="space-y-3 pt-4 border-t border-md3-outline-variant/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-md3-on-surface">
                  <Volume2 className="w-4 h-4 text-md3-primary" />
                  <span>{t.settings.crossfade}</span>
                </div>
                <div className="text-xs text-md3-on-surface-variant">
                  {fadeMode === 'off' ? 'Выключено' : `${fadeDuration.toFixed(1)} сек`}
                </div>
              </div>

              {/* Fade Modes */}
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  onClick={() => onSetFadeMode('off')}
                  className={`p-3 rounded-2xl border flex flex-col items-start gap-1 transition-all text-left cursor-pointer ${
                    fadeMode === 'off'
                      ? 'border-md3-primary bg-md3-primary/10 text-md3-primary font-bold shadow-xs'
                      : 'border-md3-outline-variant/20 bg-md3-surface text-md3-on-surface-variant hover:bg-md3-surface-container-high'
                  }`}
                >
                  <span className="text-xs">Выключено</span>
                  <span className="text-[10px] opacity-70">Без затухания</span>
                </button>

                <button
                  onClick={() => onSetFadeMode('track_change_and_pause')}
                  className={`p-3 rounded-2xl border flex flex-col items-start gap-1 transition-all text-left cursor-pointer ${
                    fadeMode === 'track_change_and_pause'
                      ? 'border-md3-primary bg-md3-primary/10 text-md3-primary font-bold shadow-xs'
                      : 'border-md3-outline-variant/20 bg-md3-surface text-md3-on-surface-variant hover:bg-md3-surface-container-high'
                  }`}
                >
                  <span className="text-xs">Смена и пауза</span>
                  <span className="text-[10px] opacity-70">Мягкие переходы</span>
                </button>

                <button
                  onClick={() => onSetFadeMode('always')}
                  className={`p-3 rounded-2xl border flex flex-col items-start gap-1 transition-all text-left cursor-pointer ${
                    fadeMode === 'always'
                      ? 'border-md3-primary bg-md3-primary/10 text-md3-primary font-bold shadow-xs'
                      : 'border-md3-outline-variant/20 bg-md3-surface text-md3-on-surface-variant hover:bg-md3-surface-container-high'
                  }`}
                >
                  <span className="text-xs">Всегда</span>
                  <span className="text-[10px] opacity-70">Включая зацикливание</span>
                </button>
              </div>

              {/* Fade Duration Slider */}
              {fadeMode !== 'off' && (
                <div className="p-3.5 rounded-2xl bg-md3-surface border border-md3-outline-variant/20 space-y-2 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-md3-on-surface-variant flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-md3-primary" />
                      Длительность затухания
                    </span>
                    <span className="font-bold text-md3-primary font-mono">{fadeDuration.toFixed(1)} с</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="6.0"
                    step="0.5"
                    value={fadeDuration}
                    onChange={(e) => onSetFadeDuration(parseFloat(e.target.value))}
                    className="w-full accent-md3-primary h-1.5 bg-md3-surface-container-high rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-md3-on-surface-variant/60 font-mono">
                    <span>0.5s</span>
                    <span>2.0s</span>
                    <span>4.0s</span>
                    <span>6.0s</span>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Section: Navigation Tabs Visibility */}
            <div className="space-y-3 pt-4 border-t border-md3-outline-variant/20">
              <div className="flex items-center gap-2 text-sm font-bold text-md3-on-surface">
                <LayoutGrid className="w-4 h-4 text-md3-primary" />
                <span>{t.settings.navigationTabs}</span>
              </div>
              <p className="text-xs text-md3-on-surface-variant">
                Включите или отключите разделы в верхней навигационной панели:
              </p>
              <div className="grid grid-cols-2 gap-2">
                {navTabConfigs.map((tab) => {
                  const Icon = tab.icon;
                  const isVisible = visibleTabs[tab.id] ?? true;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => onToggleTabVisibility(tab.id)}
                      className={`p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                        isVisible
                          ? 'border-md3-primary/40 bg-md3-primary/10 text-md3-on-surface font-medium'
                          : 'border-md3-outline-variant/20 bg-md3-surface/40 text-md3-on-surface-variant/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${isVisible ? 'text-md3-primary' : 'opacity-40'}`} />
                        <span className="text-xs">{tab.label}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={isVisible}
                        onChange={() => {}}
                        className="w-4 h-4 rounded accent-md3-primary pointer-events-none"
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Section: Discord RPC Integration */}
            <div className="space-y-3 pt-4 border-t border-md3-outline-variant/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-md3-on-surface">
                  <div className="w-4 h-4 flex items-center justify-center font-black text-[11px] text-[#5865F2]">
                    ●
                  </div>
                  <span>{t.settings.discordRpc}</span>
                </div>
                <div className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                  discordEnabled 
                    ? 'bg-[#5865F2]/15 text-[#5865F2] border border-[#5865F2]/30' 
                    : 'bg-md3-surface-container-high text-md3-on-surface-variant'
                }`}>
                  {discordEnabled ? 'Включено' : 'Выключено'}
                </div>
              </div>

              {/* Master Discord Toggle */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-md3-surface-container-low border border-md3-outline-variant/15">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-md3-on-surface">
                    {t.settings.discordToggle}
                  </div>
                  <div className="text-[11px] text-md3-on-surface-variant">
                    Транслировать текущий трек, обложку и статус воспроизведения в Discord
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={discordEnabled}
                  onChange={onToggleDiscord}
                  className="w-4 h-4 rounded accent-md3-primary cursor-pointer"
                />
              </div>

              {/* Live Preview Card */}
              <div className="p-3.5 rounded-2xl bg-[#2b2d31] border border-white/10 space-y-2">
                <div className="text-[11px] font-bold text-[#949ba4] uppercase tracking-wider flex items-center gap-1.5">
                  <span>Предпросмотр профиля Discord</span>
                </div>

                <div className="flex items-center gap-3 p-2 rounded-xl bg-[#1e1f22]">
                  <div className="relative w-12 h-12 rounded-xl bg-[#313338] overflow-hidden flex-shrink-0 border border-white/5">
                    {currentTrack && currentTrack.coverArt ? (
                      <img
                        src={currentTrack.coverArt}
                        alt="Discord Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#5865F2] font-black text-lg">
                        A
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#5865F2] border-2 border-[#2b2d31] flex items-center justify-center text-[9px]">
                      🎵
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="font-bold text-xs text-white truncate">
                      Arachnid Music Player
                    </div>
                    <div className="text-xs text-[#dbdee1] truncate font-medium">
                      {currentTrack ? currentTrack.title : 'Neon Horizon'}
                    </div>
                    <div className="text-[11px] text-[#949ba4] truncate">
                      by {currentTrack ? currentTrack.artist : 'Synthwave Sunset'}
                    </div>
                    <div className="text-[10px] text-[#949ba4] font-mono">
                      {isPlaying ? `${formatTime(currentTime)} прошло (Играет)` : 'Пауза'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Show Discord Quick Switch in TopBar toggle */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-md3-surface-container-low border border-md3-outline-variant/15">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-md3-on-surface">
                    {t.settings.discordTopBar}
                  </div>
                  <div className="text-[11px] text-md3-on-surface-variant">
                    Отображать быстрый переключатель Discord в правом углу (горячая клавиша: D)
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={showDiscordButton}
                  onChange={onToggleShowDiscordButton}
                  className="w-4 h-4 rounded accent-md3-primary cursor-pointer"
                />
              </div>
            </div>

            {/* 5. Section: Language (Язык интерфейса) - Перед горячими клавишами */}
            <div className="space-y-3 pt-4 border-t border-md3-outline-variant/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-md3-on-surface">
                  <Globe className="w-4 h-4 text-md3-primary" />
                  <span>{t.settings.language}</span>
                </div>
                <button
                  onClick={handleOpenLocalesFolder}
                  title={t.settings.openLocalesFolder}
                  className="text-[11px] flex items-center gap-1.5 text-md3-primary hover:underline cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>{t.settings.openLocalesFolder}</span>
                </button>
              </div>
              <p className="text-xs text-md3-on-surface-variant">
                {t.settings.languageDesc} (определяется автоматически по языку системы при первом запуске)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => onSetLanguage('ru')}
                  className={`p-3 rounded-2xl border flex items-center gap-3 transition-all cursor-pointer ${
                    language === 'ru'
                      ? 'border-md3-primary bg-md3-primary/10 text-md3-primary font-bold shadow-xs'
                      : 'border-md3-outline-variant/20 bg-md3-surface text-md3-on-surface-variant hover:bg-md3-surface-container-high'
                  }`}
                >
                  <span className="text-2xl">🇷🇺</span>
                  <div className="text-left">
                    <div className="text-xs font-bold text-md3-on-surface">Русский</div>
                    <div className="text-[10px] opacity-70">По умолчанию для RU/CIS</div>
                  </div>
                </button>
                <button
                  onClick={() => onSetLanguage('en')}
                  className={`p-3 rounded-2xl border flex items-center gap-3 transition-all cursor-pointer ${
                    language === 'en'
                      ? 'border-md3-primary bg-md3-primary/10 text-md3-primary font-bold shadow-xs'
                      : 'border-md3-outline-variant/20 bg-md3-surface text-md3-on-surface-variant hover:bg-md3-surface-container-high'
                  }`}
                >
                  <span className="text-2xl">🇬🇧</span>
                  <div className="text-left">
                    <div className="text-xs font-bold text-md3-on-surface">English</div>
                    <div className="text-[10px] opacity-70">International</div>
                  </div>
                </button>
              </div>
            </div>

            {/* 6. Button to Open Keyboard Shortcuts Menu */}
            <div className="pt-2">
              <button
                onClick={() => setCurrentView('shortcuts')}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-md3-surface-container-high/60 hover:bg-md3-surface-container-high border border-md3-outline-variant/20 hover:border-md3-primary/40 transition-all cursor-pointer group shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-md3-primary/10 text-md3-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Keyboard className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-bold text-md3-on-surface group-hover:text-md3-primary transition-colors">
                      {t.settings.shortcuts}
                    </div>
                    <div className="text-[11px] text-md3-on-surface-variant">
                      {t.settings.shortcutsDesc}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-md3-on-surface-variant group-hover:text-md3-primary group-hover:translate-x-0.5 transition-all" />
              </button>
            </div>

            {/* 7. About Application Card */}
            <div className="pt-2">
              <div className="p-4 rounded-2xl bg-md3-surface-container-low border border-md3-outline-variant/20 flex items-center gap-4">
                <img
                  src="/app-logo.png"
                  alt="Arachnid Logo"
                  className="w-12 h-12 rounded-xl object-contain drop-shadow-md"
                />
                <div className="space-y-0.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-md3-on-surface">Arachnid Music Player</span>
                    <span className="text-[11px] font-mono opacity-70">v0.3.43</span>
                  </div>
                  <p className="text-xs text-md3-on-surface-variant">
                    Модульный аудиоплеер с поддержкой gapless loop, Discord RPC и тем оформления
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end p-4 border-t border-md3-outline-variant/20 bg-md3-surface/50">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-md3-primary text-md3-on-primary font-semibold text-xs shadow-md hover:opacity-90 active:scale-98 transition-all cursor-pointer"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
};
