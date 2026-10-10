import React, { useEffect } from 'react';
import { 
  X, 
  Palette, 
  Sparkles, 
  Info, 
  Check, 
  Moon, 
  Sun,
  Volume2,
  Clock,
  Repeat,
  LayoutGrid,
  Music,
  ListMusic,
  Disc,
  Mic2,
  Heart,
  Tag
} from 'lucide-react';
import { ThemeMode, Track, FadeMode } from '../types/music';
import { MainViewType } from './TopBar';
import { formatTime } from '../services/tagEditor';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  themeMode: ThemeMode;
  onSetThemeMode: (mode: ThemeMode) => void;
  isDynamicColor: boolean;
  onToggleDynamicColor: () => void;
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
  isDynamicColor,
  onToggleDynamicColor,
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
  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [isOpen, onClose]);

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
            <div className="w-10 h-10 rounded-2xl bg-md3-primary/10 text-md3-primary flex items-center justify-center">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-md3-on-surface">Настройки Arachnid</h3>
              <p className="text-xs text-md3-on-surface-variant">Material You 3, затухание, Discord RPC и поведение</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container hover:text-md3-on-surface"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
          {/* Section: Material You 3 Theming */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-md3-on-surface">
              <Sparkles className="w-4 h-4 text-md3-primary" />
              <span>Material You 3 & Темизация</span>
            </div>

            {/* Theme Mode Buttons */}
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => onSetThemeMode('dark')}
                className={`p-3 rounded-2xl border flex flex-col items-center gap-2 transition-all ${
                  themeMode === 'dark'
                    ? 'border-md3-primary bg-md3-primary/10 text-md3-primary font-semibold'
                    : 'border-md3-outline-variant/30 bg-md3-surface text-md3-on-surface-variant hover:bg-md3-surface-container-high'
                }`}
              >
                <Moon className="w-5 h-5" />
                <span className="text-xs">Dark (Тёмная)</span>
              </button>

              <button
                onClick={() => onSetThemeMode('amoled')}
                className={`p-3 rounded-2xl border flex flex-col items-center gap-2 transition-all ${
                  themeMode === 'amoled'
                    ? 'border-md3-primary bg-md3-primary/10 text-md3-primary font-semibold'
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
                className={`p-3 rounded-2xl border flex flex-col items-center gap-2 transition-all ${
                  themeMode === 'light'
                    ? 'border-md3-primary bg-md3-primary/10 text-md3-primary font-semibold'
                    : 'border-md3-outline-variant/30 bg-md3-surface text-md3-on-surface-variant hover:bg-md3-surface-container-high'
                }`}
              >
                <Sun className="w-5 h-5 text-amber-500" />
                <span className="text-xs">Light (Светлая)</span>
              </button>
            </div>

            {/* Dynamic Album Palette Switch */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-md3-surface border border-md3-outline-variant/20">
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-md3-on-surface">Динамические цвета из обложки</div>
                <div className="text-[11px] text-md3-on-surface-variant">
                  Автоматически адаптировать акценты плеера под текущий трек
                </div>
              </div>
              <input
                type="checkbox"
                checked={isDynamicColor}
                onChange={onToggleDynamicColor}
                className="w-5 h-5 rounded accent-md3-primary cursor-pointer"
              />
            </div>

            {/* Custom Seed Color Palette */}
            {!isDynamicColor && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-md3-on-surface-variant">
                  Постоянный акцентный цвет:
                </div>
                <div className="flex items-center gap-2.5">
                  {PRESET_COLORS.map((p) => (
                    <button
                      key={p.color}
                      onClick={() => onSetSeedColor(p.color)}
                      style={{ backgroundColor: p.color }}
                      className="w-8 h-8 rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform"
                    >
                      {seedColor === p.color && <Check className="w-4 h-4 text-white drop-shadow" />}
                    </button>
                  ))}
                  <input
                    type="color"
                    value={seedColor}
                    onChange={(e) => onSetSeedColor(e.target.value)}
                    className="w-8 h-8 rounded-full cursor-pointer bg-transparent border-0 p-0"
                    title="Выбрать свой цвет"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section: Track Fading Settings */}
          <div className="space-y-4 pt-4 border-t border-md3-outline-variant/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-md3-on-surface">
                <Volume2 className="w-4 h-4 text-md3-primary" />
                <span>Затухание трека (Fading)</span>
              </div>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-md3-primary/10 text-md3-primary font-medium">
                {fadeMode === 'off' ? 'Отключено' : `${fadeDuration.toFixed(1)} сек`}
              </span>
            </div>

            <div className="space-y-2">
              {/* Option 1: Off */}
              <div
                onClick={() => onSetFadeMode('off')}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                  fadeMode === 'off'
                    ? 'border-md3-primary bg-md3-primary/10 text-md3-on-surface'
                    : 'border-md3-outline-variant/20 bg-md3-surface hover:bg-md3-surface-container-high/60 text-md3-on-surface-variant'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                  fadeMode === 'off' ? 'border-md3-primary' : 'border-md3-outline-variant'
                }`}>
                  {fadeMode === 'off' && <div className="w-2 h-2 rounded-full bg-md3-primary" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`text-xs font-bold ${fadeMode === 'off' ? 'text-md3-primary' : 'text-md3-on-surface'}`}>
                    1. Отключено
                  </div>
                  <div className="text-[11px] text-md3-on-surface-variant/80 mt-0.5">
                    Мгновенное переключение между треками без плавного затухания.
                  </div>
                </div>
              </div>

              {/* Option 2: Track change and pause/start */}
              <div
                onClick={() => onSetFadeMode('track_change_and_pause')}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                  fadeMode === 'track_change_and_pause'
                    ? 'border-md3-primary bg-md3-primary/10 text-md3-on-surface'
                    : 'border-md3-outline-variant/20 bg-md3-surface hover:bg-md3-surface-container-high/60 text-md3-on-surface-variant'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                  fadeMode === 'track_change_and_pause' ? 'border-md3-primary' : 'border-md3-outline-variant'
                }`}>
                  {fadeMode === 'track_change_and_pause' && <div className="w-2 h-2 rounded-full bg-md3-primary" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`text-xs font-bold ${fadeMode === 'track_change_and_pause' ? 'text-md3-primary' : 'text-md3-on-surface'}`}>
                    2. Только при переключении между разными треками и паузе/старте
                  </div>
                  <div className="text-[11px] text-md3-on-surface-variant/80 mt-0.5">
                    Плавное затухание при паузе/старте и смене треков. При зацикливании одного трека (повтор 1) воспроизведение продолжается <b>беспрерывно и бесшовно</b> без заиканий.
                  </div>
                </div>
              </div>

              {/* Option 3: Always (even when repeating the same track) */}
              <div
                onClick={() => onSetFadeMode('always')}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                  fadeMode === 'always'
                    ? 'border-md3-primary bg-md3-primary/10 text-md3-on-surface'
                    : 'border-md3-outline-variant/20 bg-md3-surface hover:bg-md3-surface-container-high/60 text-md3-on-surface-variant'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                  fadeMode === 'always' ? 'border-md3-primary' : 'border-md3-outline-variant'
                }`}>
                  {fadeMode === 'always' && <div className="w-2 h-2 rounded-full bg-md3-primary" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`text-xs font-bold ${fadeMode === 'always' ? 'text-md3-primary' : 'text-md3-on-surface'}`}>
                    3. Даже когда повторяется один и тот же трек (Во всех случаях)
                  </div>
                  <div className="text-[11px] text-md3-on-surface-variant/80 mt-0.5">
                    Затухание срабатывает во всех ситуациях, включая конец трека при включенном повторе одного трека.
                  </div>
                </div>
              </div>
            </div>

            {/* Fade Duration Slider (visible when fade is enabled) */}
            {fadeMode !== 'off' && (
              <div className="p-4 rounded-2xl bg-md3-surface border border-md3-outline-variant/20 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-md3-on-surface">
                    <Clock className="w-3.5 h-3.5 text-md3-primary" />
                    <span>Длительность затухания</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-md3-primary">
                    {fadeDuration.toFixed(1)} сек
                  </span>
                </div>

                <input
                  type="range"
                  min="0.5"
                  max="5.0"
                  step="0.5"
                  value={fadeDuration}
                  onChange={(e) => onSetFadeDuration(parseFloat(e.target.value))}
                  className="w-full accent-md3-primary cursor-pointer"
                />

                <div className="flex items-center justify-between gap-2 pt-1">
                  {[1.0, 1.5, 2.0, 3.0, 4.0].map((dur) => (
                    <button
                      key={dur}
                      onClick={() => onSetFadeDuration(dur)}
                      className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-medium transition-colors ${
                        fadeDuration === dur
                          ? 'bg-md3-primary text-md3-on-primary font-bold shadow-sm'
                          : 'bg-md3-surface-container-high text-md3-on-surface-variant hover:text-md3-on-surface'
                      }`}
                    >
                      {dur.toFixed(1)}с
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section: Discord Rich Presence */}
          <div className="space-y-4 pt-4 border-t border-md3-outline-variant/20">
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
            <div className="p-4 rounded-2xl bg-[#2b2d31] text-white shadow-lg border border-white/5 space-y-3">
              <div className="text-[11px] uppercase tracking-wider font-bold text-[#b5bac1]">
                Предпросмотр профиля в Discord
              </div>
              <div className="flex items-center gap-3.5">
                {/* Large Image */}
                <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-[#1e1f22] shrink-0 border border-white/10 shadow-md">
                  {currentTrack?.coverArt ? (
                    <img src={currentTrack.coverArt} alt="Cover" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#5865F2] font-black text-xl">
                      A
                    </div>
                  )}
                  {/* Small Image Badge */}
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#5865F2] border-2 border-[#2b2d31] flex items-center justify-center text-[10px]">
                    🎵
                  </div>
                </div>

                {/* Details */}
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="font-bold text-sm text-white truncate">
                    Arachnid Music Player
                  </div>
                  <div className="text-xs text-[#dbdee1] truncate font-medium">
                    {currentTrack ? currentTrack.title : 'Neon Horizon'}
                  </div>
                  <div className="text-xs text-[#949ba4] truncate">
                    by {currentTrack ? currentTrack.artist : 'Synthwave Sunset'}
                  </div>
                  <div className="text-[11px] text-[#949ba4] font-mono">
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
                  Отображать быстрый переключатель Discord в правом верхнем углу (активность также можно переключать клавишей D)
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

          {/* Section: Top Bar Tabs Visibility */}
          <div className="space-y-4 pt-4 border-t border-md3-outline-variant/20">
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
                        ? 'bg-md3-surface-container border-md3-primary/30 text-md3-on-surface'
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

          {/* About Section */}
          <div className="p-4 rounded-2xl bg-md3-surface-container-high/60 border border-md3-outline-variant/20 flex items-start gap-3 text-xs text-md3-on-surface-variant">
            <Info className="w-5 h-5 text-md3-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-md3-on-surface">Arachnid Music Player</p>
              <p>
                Построен на базе <b>Tauri 2.0 (Rust)</b> + <b>React & TypeScript</b>. Объединяет эстетику
                Google Material You 3 и продвинутый функционал MusicBee: плавное затухание, бесшовное зацикливание,
                пакетный редактор тегов, десктопный Drag-and-Drop, работу с плейлистами и нативный Discord RPC.
              </p>
              <p className="text-[11px] opacity-75">
                Горячие клавиши: <b>Пробел</b> — пауза/старт, <b>Tab</b> — переключение вкладок, <b>Q</b> — очередь, <b>X</b> — очистить очередь, <b>D</b> — активность Discord, <b>R</b> — режим повтора, <b>E</b> — перемешивание, <b>T</b> — текст песни, <b>Ctrl + Стрелки</b> — следующий/предыдущий трек.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
