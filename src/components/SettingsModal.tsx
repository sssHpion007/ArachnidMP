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
  ChevronRight
} from 'lucide-react';
import { ThemeMode, Track, FadeMode } from '../types/music';
import { MainViewType } from './TopBar';
import { formatTime } from '../services/tagEditor';

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

const PRESET_COLORS = [
  { name: 'Deep Violet', color: '#8b5cf6' },
  { name: 'Emerald', color: '#10b981' },
  { name: 'Electric Blue', color: '#0ea5e9' },
  { name: 'Sunset Amber', color: '#f59e0b' },
  { name: 'Rose Petal', color: '#f43f5e' },
  { name: 'Cyberpunk Pink', color: '#d946ef' },
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
  const [currentView, setCurrentView] = useState<'settings' | 'shortcuts'>('settings');

  // Reset view to 'settings' whenever opened
  useEffect(() => {
    if (isOpen) {
      setCurrentView('settings');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (currentView === 'shortcuts') {
          setCurrentView('settings');
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [isOpen, currentView, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150 select-none cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-md3-surface-container rounded-3xl shadow-2xl border border-md3-outline-variant/30 overflow-hidden flex flex-col max-h-[90vh] cursor-default"
      >
        {/* Header */}
        <div className="p-5 border-b border-md3-outline-variant/20 flex items-center justify-between bg-md3-surface-container-high">
          <div className="flex items-center gap-3">
            {currentView === 'shortcuts' ? (
              <button
                onClick={() => setCurrentView('settings')}
                title="Назад к настройкам"
                className="w-10 h-10 rounded-2xl bg-md3-surface-container hover:bg-md3-surface-container-highest text-md3-on-surface flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
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
                {currentView === 'shortcuts' ? 'Горячие клавиши' : 'Настройки'}
              </h3>
              <p className="text-xs text-md3-on-surface-variant">
                {currentView === 'shortcuts'
                  ? 'Клавиатурные комбинации для управления плеером'
                  : 'Внешний вид, затухание, вкладки и Discord RPC'}
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
                  <span className="text-md3-on-surface-variant">Старт / Пауза</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    Пробел
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
                  <span className="text-md3-on-surface-variant">Громкость (±5%)</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    ↑ / ↓
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">Без звука (Mute)</span>
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
            <div className="space-y-3 pt-4 border-t border-md3-outline-variant/20">
              <div className="text-xs font-bold uppercase tracking-wider text-md3-primary flex items-center gap-2">
                <LayoutGrid className="w-4 h-4" />
                <span>Интерфейс и навигация</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">Следующая вкладка</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    Tab
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">Текст песни</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    T
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">Очередь воспроизведения</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    Q
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">Очистить очередь и стоп</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    X
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">Discord RPC переключатель</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    D
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">Закрыть окно / Отмена</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    Esc
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
              <div className="flex items-center gap-2 text-sm font-bold text-md3-on-surface">
                <Sparkles className="w-4 h-4 text-md3-primary" />
                <span>Внешний вид</span>
              </div>

              {/* Theme Mode Buttons */}
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
                  <span className="text-xs">Dark (Тёмная)</span>
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
                  <span className="text-xs">AMOLED (OLED)</span>
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
                  <span className="text-xs">Light (Светлая)</span>
                </button>
              </div>

              {/* Color Palette Mode (Динамическая, Система, Пользовательская) */}
              <div className="space-y-2.5">
                <div className="text-xs font-semibold text-md3-on-surface">Цветовая палитра</div>
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
                    <span className="text-xs">Динамическая</span>
                    <span className="text-[10px] opacity-70">Из обложки трека</span>
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
                    <span className="text-xs">Система</span>
                    <span className="text-[10px] opacity-70">Акцент Windows</span>
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
                    <span className="text-xs">Пользовательская</span>
                    <span className="text-[10px] opacity-70">Свой цвет</span>
                  </button>
                </div>

                {/* Custom Palette Presets & Color Picker (Shown when "Пользовательская" is active) */}
                {colorSchemeMode === 'custom' && (
                  <div className="p-3.5 rounded-2xl bg-md3-surface border border-md3-outline-variant/20 space-y-2.5 animate-in fade-in duration-200">
                    <div className="text-xs font-medium text-md3-on-surface-variant">
                      Выберите постоянный акцентный цвет:
                    </div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {PRESET_COLORS.map((p) => (
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
            </div>

            {/* 2. Section: Track Fading (Затухание трека) */}
            <div className="space-y-3 pt-4 border-t border-md3-outline-variant/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-md3-on-surface">
                  <Volume2 className="w-4 h-4 text-md3-primary" />
                  <span>Затухание трека</span>
                </div>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-md3-primary/10 text-md3-primary font-medium">
                  {fadeMode === 'off' ? 'Отключено' : `${fadeDuration.toFixed(1)} сек`}
                </span>
              </div>

              {/* Compact Mode Selector */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => onSetFadeMode('off')}
                  className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer ${
                    fadeMode === 'off'
                      ? 'border-md3-primary bg-md3-primary/10 text-md3-primary font-bold shadow-xs'
                      : 'border-md3-outline-variant/20 bg-md3-surface text-md3-on-surface-variant hover:bg-md3-surface-container-high'
                  }`}
                >
                  <div className="text-xs">Отключено</div>
                  <div className="text-[10px] opacity-70">Без затухания</div>
                </button>

                <button
                  onClick={() => onSetFadeMode('track_change_and_pause')}
                  className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer ${
                    fadeMode === 'track_change_and_pause'
                      ? 'border-md3-primary bg-md3-primary/10 text-md3-primary font-bold shadow-xs'
                      : 'border-md3-outline-variant/20 bg-md3-surface text-md3-on-surface-variant hover:bg-md3-surface-container-high'
                  }`}
                >
                  <div className="text-xs">При смене треков</div>
                  <div className="text-[10px] opacity-70">Пауза и смена</div>
                </button>

                <button
                  onClick={() => onSetFadeMode('always')}
                  className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer ${
                    fadeMode === 'always'
                      ? 'border-md3-primary bg-md3-primary/10 text-md3-primary font-bold shadow-xs'
                      : 'border-md3-outline-variant/20 bg-md3-surface text-md3-on-surface-variant hover:bg-md3-surface-container-high'
                  }`}
                >
                  <div className="text-xs">Всегда</div>
                  <div className="text-[10px] opacity-70">Включая повтор</div>
                </button>
              </div>

              {/* Compact Duration Row */}
              {fadeMode !== 'off' && (
                <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-md3-surface border border-md3-outline-variant/20 animate-in fade-in duration-150">
                  <div className="flex items-center gap-2 text-xs font-semibold text-md3-on-surface shrink-0">
                    <Clock className="w-3.5 h-3.5 text-md3-primary" />
                    <span>Длительность:</span>
                    <span className="font-mono text-md3-primary font-bold">{fadeDuration.toFixed(1)} с</span>
                  </div>
                  <div className="flex items-center gap-2 flex-1 max-w-xs justify-end">
                    <input
                      type="range"
                      min="0.5"
                      max="4.0"
                      step="0.5"
                      value={fadeDuration}
                      onChange={(e) => onSetFadeDuration(parseFloat(e.target.value))}
                      className="w-24 sm:w-32 accent-md3-primary cursor-pointer h-1.5"
                    />
                    <div className="flex items-center gap-1">
                      {[1, 2, 3].map((s) => (
                        <button
                          key={s}
                          onClick={() => onSetFadeDuration(s)}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors cursor-pointer ${
                            fadeDuration === s
                              ? 'bg-md3-primary text-md3-on-primary'
                              : 'bg-md3-surface-container-high text-md3-on-surface-variant hover:text-md3-on-surface'
                          }`}
                        >
                          {s}с
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Section: Top Bar Tabs Visibility (Swapped into Discord's previous place) */}
            <div className="space-y-3 pt-4 border-t border-md3-outline-variant/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-md3-on-surface">
                  <LayoutGrid className="w-4 h-4 text-md3-primary" />
                  <span>Вкладки верхней панели</span>
                </div>
                <span className="text-[11px] text-md3-on-surface-variant">
                  Настройте отображение нужных разделов
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'tracks' as const, label: 'Все треки', icon: Music },
                  { id: 'playlists' as const, label: 'Плейлисты', icon: ListMusic },
                  { id: 'albums' as const, label: 'Альбомы', icon: Disc },
                  { id: 'artists' as const, label: 'Исполнители', icon: Mic2 },
                  { id: 'favorites' as const, label: 'Избранное', icon: Heart },
                  { id: 'genres' as const, label: 'Жанры', icon: Tag },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isChecked = visibleTabs[tab.id] ?? true;
                  return (
                    <div
                      key={tab.id}
                      onClick={() => onToggleTabVisibility(tab.id)}
                      className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                        isChecked
                          ? 'bg-md3-surface-container border-md3-primary/30 text-md3-on-surface shadow-xs'
                          : 'bg-md3-surface-container-low/50 border-md3-outline-variant/15 text-md3-on-surface-variant/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className={`w-4 h-4 ${isChecked ? 'text-md3-primary' : 'text-md3-on-surface-variant/50'}`} />
                        <span className="text-xs font-semibold truncate">{tab.label}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => onToggleTabVisibility(tab.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 rounded accent-md3-primary cursor-pointer shrink-0"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4. Section: Discord Rich Presence (RPC) (Moved to tabs' previous place) */}
            <div className="space-y-3 pt-4 border-t border-md3-outline-variant/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-md3-on-surface">
                  <div className="w-5 h-5 rounded-full bg-[#5865F2] flex items-center justify-center text-white text-[10px] font-bold">
                    🎮
                  </div>
                  <span>Discord Rich Presence (RPC)</span>
                </div>
                <input
                  type="checkbox"
                  checked={discordEnabled}
                  onChange={onToggleDiscord}
                  className="w-5 h-5 rounded accent-[#5865F2] cursor-pointer"
                />
              </div>

              {/* Discord Activity Live Card Preview */}
              <div className="p-3.5 rounded-2xl bg-[#2b2d31] text-white shadow-md border border-white/5 space-y-2.5">
                <div className="text-[10px] uppercase tracking-wider font-bold text-[#b5bac1]">
                  Предпросмотр профиля в Discord
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-[#1e1f22] shrink-0 border border-white/10 shadow-inner">
                    {currentTrack?.coverArt ? (
                      <img src={currentTrack.coverArt} alt="Cover" className="w-full h-full object-cover" />
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
                    Кнопка в верхней панели
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

            {/* 5. Button to Open Keyboard Shortcuts Menu */}
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
                      Горячие клавиши
                    </div>
                    <div className="text-[11px] text-md3-on-surface-variant">
                      Список клавиатурных комбинаций для быстрого управления
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-md3-on-surface-variant group-hover:text-md3-primary group-hover:translate-x-0.5 transition-all" />
              </button>
            </div>

            {/* 6. Restrained About Section */}
            <div className="p-4 rounded-2xl bg-md3-surface-container-low border border-md3-outline-variant/15 text-xs text-md3-on-surface-variant space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-md3-on-surface text-xs">Arachnid Music Player</span>
                <span className="text-[11px] font-mono opacity-70">v0.3.38</span>
              </div>
              <p className="text-[11px] leading-relaxed text-md3-on-surface-variant/90">
                Лёгкий и быстрый аудиоплеер для Windows с поддержкой gapless-воспроизведения, встроенным редактором тегов, текстами песен и интерфейсом Material Design 3.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
