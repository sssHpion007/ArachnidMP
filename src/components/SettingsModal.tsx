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
  ChevronDown,
  Globe,
  FolderOpen,
  RefreshCw,
  Layers,
  FileCode,
  Radio,
  Download,
  CheckCircle2,
  AlertCircle,
  ExternalLink
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
  
  // Accordion (шторка) open/closed states
  const [isThemeCurtainOpen, setIsThemeCurtainOpen] = useState<boolean>(false);
  const [isLangCurtainOpen, setIsLangCurtainOpen] = useState<boolean>(false);

  // App version & Update checker state
  const [appVersion, setAppVersion] = useState<string>('0.3.51');
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'upToDate' | 'available' | 'downloading' | 'installing' | 'error'>('idle');
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadStats, setDownloadStats] = useState<{ received: string; total: string }>({ received: '0', total: '0' });
  const [installError, setInstallError] = useState<string | null>(null);
  const [latestRelease, setLatestRelease] = useState<{
    tagName: string;
    name: string;
    body: string;
    publishedAt?: string;
    htmlUrl: string;
    downloadUrl?: string;
    assetUrl?: string;
    assetName?: string;
  } | null>(null);

  const t = getTranslations(language);

  const isNewerVersion = (current: string, latest: string): boolean => {
    const c = current.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
    const l = latest.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(c.length, l.length); i++) {
      const cv = c[i] || 0;
      const lv = l[i] || 0;
      if (lv > cv) return true;
      if (lv < cv) return false;
    }
    return false;
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleCheckUpdates = async () => {
    setUpdateStatus('checking');
    setInstallError(null);
    try {
      let res: Response;
      try {
        res = await fetch('https://api.github.com/repos/sssHpion007/arachnid/releases/latest', {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': 'token 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',
          },
        });
      } catch (_) {
        res = await fetch('https://api.github.com/repos/sssHpion007/arachnid/releases/latest');
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      const tagName = data.tag_name || '';
      const cleanCurrent = appVersion.replace(/^v/, '');
      const cleanLatest = tagName.replace(/^v/, '');

      const assets = Array.isArray(data.assets) ? data.assets : [];
      const exeAsset = assets.find((a: any) => a.name?.toLowerCase().endsWith('.exe')) || assets[0];

      setLatestRelease({
        tagName,
        name: data.name || tagName,
        body: data.body || '',
        publishedAt: data.published_at,
        htmlUrl: data.html_url || `https://github.com/sssHpion007/arachnid/releases/tag/${tagName}`,
        downloadUrl: exeAsset?.browser_download_url || data.html_url,
        assetUrl: exeAsset?.url || exeAsset?.browser_download_url,
        assetName: exeAsset?.name || 'Arachnid-Portable.exe',
      });

      if (isNewerVersion(cleanCurrent, cleanLatest)) {
        setUpdateStatus('available');
      } else {
        setUpdateStatus('upToDate');
      }
    } catch (err: any) {
      console.warn('Update check failed:', err);
      setInstallError(err?.message || null);
      setUpdateStatus('error');
    }
  };

  const handleInstallUpdate = async () => {
    if (!latestRelease?.assetUrl) {
      if (latestRelease?.downloadUrl) {
        handleDownloadUpdate(latestRelease.downloadUrl);
      }
      return;
    }

    setUpdateStatus('downloading');
    setDownloadProgress(0);
    setInstallError(null);

    try {
      let dlRes: Response;
      try {
        dlRes = await fetch(latestRelease.assetUrl, {
          headers: {
            'Authorization': 'token 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',
            'Accept': 'application/octet-stream',
          },
        });
      } catch (_) {
        dlRes = await fetch(latestRelease.assetUrl, {
          headers: {
            'Accept': 'application/octet-stream',
          },
        });
      }

      if (!dlRes.ok) {
        throw new Error(`HTTP ${dlRes.status}`);
      }

      const contentLength = Number(dlRes.headers.get('content-length')) || 11607040;
      const reader = dlRes.body?.getReader();

      let chunks: Uint8Array[] = [];

      if (!reader) {
        const blob = await dlRes.blob();
        setUpdateStatus('installing');
        const b64 = await blobToBase64(blob);
        if (isTauri()) {
          await invoke('apply_in_place_update', { base64Data: b64 });
        }
        return;
      }

      let receivedLength = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          receivedLength += value.length;
          const pct = Math.min(100, Math.round((receivedLength / contentLength) * 100));
          setDownloadProgress(pct);
          setDownloadStats({
            received: (receivedLength / (1024 * 1024)).toFixed(1),
            total: (contentLength / (1024 * 1024)).toFixed(1),
          });
        }
      }

      setUpdateStatus('installing');

      const blob = new Blob(chunks as any[], { type: 'application/octet-stream' });
      const b64 = await blobToBase64(blob);

      if (isTauri()) {
        await invoke('apply_in_place_update', { base64Data: b64 });
      } else {
        // Fallback for browser testing
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = latestRelease.assetName || 'Arachnid-Portable.exe';
        a.click();
        URL.revokeObjectURL(url);
        setUpdateStatus('upToDate');
      }
    } catch (err: any) {
      console.error('Install update failed:', err);
      setInstallError(err?.message || 'Download error');
      setUpdateStatus('error');
    }
  };

  const handleDownloadUpdate = async (url: string) => {
    if (isTauri()) {
      try {
        await invoke('open_url', { url });
        return;
      } catch (_) {}
    }
    window.open(url, '_blank');
  };

  // Fetch Tauri app version if available
  useEffect(() => {
    if (isTauri()) {
      invoke<string>('get_app_version').then(v => {
        if (v) setAppVersion(v);
      }).catch(() => {});
    }
  }, []);

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

  // Helper to get active theme display label
  const getActiveThemeLabel = () => {
    if (appTheme === 'default') return t.settings.themeStandard;
    if (appTheme === 'discord') return t.settings.themeDiscord;
    if (appTheme === 'telegram') return t.settings.themeTelegram;
    if (appTheme === 'cyberpunk') return t.settings.themeCyberpunk;
    if (appTheme.startsWith('custom:')) {
      const filename = appTheme.replace('custom:', '');
      const found = customThemesList.find(c => c.filename === filename);
      return found ? found.name : filename;
    }
    return t.settings.themeStandard;
  };

  const getActiveThemeBadge = () => {
    if (appTheme === 'default') return 'Material 3';
    if (appTheme === 'discord') return 'Discord';
    if (appTheme === 'telegram') return 'Telegram';
    if (appTheme === 'cyberpunk') return 'Duotone';
    return '.css';
  };

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
                title={t.settings.back}
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
          /* Keyboard Shortcuts View (100% Fully Localized) */
          <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
            {/* Playback & Volume */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-md3-primary flex items-center gap-2">
                <Music className="w-4 h-4" />
                <span>{t.shortcuts.playbackAndSound}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">{t.shortcuts.space}</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    {t.shortcuts.spaceKey}
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">{t.shortcuts.nextTrack}</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    Ctrl + →
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">{t.shortcuts.prevTrack}</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    Ctrl + ←
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">{t.shortcuts.seek}</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    ← / →
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">{t.shortcuts.volumeAdj}</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    Ctrl + ↑ / ↓
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">{t.shortcuts.trackNav}</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    ↑ / ↓
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">{t.shortcuts.playSelected}</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    Enter
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">{t.shortcuts.editTags}</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    Shift + Enter
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">{t.shortcuts.mute}</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    M
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">{t.shortcuts.shuffle}</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    E
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">{t.shortcuts.repeat}</span>
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
                <span>{t.shortcuts.navigationAndPanels}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">{t.shortcuts.search}</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    F / Ctrl + F
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">{t.shortcuts.queue}</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    Q
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">{t.shortcuts.lyrics}</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    L
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">{t.shortcuts.discord}</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    D
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">{t.shortcuts.settings}</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    Ctrl + ,
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">{t.shortcuts.fullscreen}</span>
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

              {/* Theme Style Selector (ШТОРКА ТЕМЫ ОФОРМЛЕНИЯ) */}
              <div className="space-y-2 pt-1">
                <div className="text-xs font-semibold text-md3-on-surface flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-md3-primary" />
                  <span>{t.settings.themeStyle}</span>
                </div>

                {/* Шторка trigger card */}
                <div className="rounded-2xl border border-md3-outline-variant/20 bg-md3-surface overflow-hidden transition-all shadow-xs">
                  <button
                    onClick={() => setIsThemeCurtainOpen(!isThemeCurtainOpen)}
                    className="w-full p-3.5 flex items-center justify-between text-left cursor-pointer hover:bg-md3-surface-container-high/60 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-md3-primary/15 text-md3-primary flex items-center justify-center shrink-0">
                        <Palette className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-md3-on-surface truncate">
                            {getActiveThemeLabel()}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-md3-primary/15 text-md3-primary font-mono shrink-0">
                            {getActiveThemeBadge()}
                          </span>
                        </div>
                        <span className="text-[11px] text-md3-on-surface-variant truncate block">
                          {appTheme === 'default' ? t.settings.themeStandardDesc : t.settings.themeCurtainSelect}
                        </span>
                      </div>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-md3-on-surface-variant transition-transform duration-200 shrink-0 ml-2 ${isThemeCurtainOpen ? 'rotate-180 text-md3-primary' : ''}`} />
                  </button>

                  {/* Раскрывающаяся шторка с плавной прокруткой */}
                  {isThemeCurtainOpen && (
                    <div className="border-t border-md3-outline-variant/20 p-2.5 bg-md3-surface-container-low/70 space-y-3 animate-in fade-in duration-200">
                      
                      {/* Секция: Встроенные темы */}
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-md3-primary px-1">
                          {t.settings.builtinThemes}
                        </div>
                        <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                          
                          {/* 1. Material 3 (Standard) */}
                          <button
                            onClick={() => {
                              onSetAppTheme('default');
                              setIsThemeCurtainOpen(false);
                            }}
                            className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer text-left ${
                              appTheme === 'default'
                                ? 'border-md3-primary bg-md3-primary/10 text-md3-primary font-bold shadow-xs'
                                : 'border-md3-outline-variant/20 bg-md3-surface hover:bg-md3-surface-container-high'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-3.5 h-3.5 rounded-full bg-[#8b5cf6] shrink-0" />
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-md3-on-surface truncate">{t.settings.themeStandard}</div>
                                <div className="text-[10px] text-md3-on-surface-variant truncate">{t.settings.themeStandardDesc}</div>
                              </div>
                            </div>
                            {appTheme === 'default' && <Check className="w-4 h-4 text-md3-primary shrink-0" />}
                          </button>

                          {/* 2. Discord */}
                          <button
                            onClick={() => {
                              onSetAppTheme('discord');
                              setIsThemeCurtainOpen(false);
                            }}
                            className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer text-left ${
                              appTheme === 'discord'
                                ? 'border-[#5865f2] bg-[#5865f2]/10 text-[#5865f2] font-bold shadow-xs'
                                : 'border-md3-outline-variant/20 bg-md3-surface hover:bg-md3-surface-container-high'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-3.5 h-3.5 rounded-full bg-[#5865f2] shrink-0" />
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-md3-on-surface truncate">{t.settings.themeDiscord}</div>
                                <div className="text-[10px] text-md3-on-surface-variant truncate">{t.settings.themeDiscordDesc}</div>
                              </div>
                            </div>
                            {appTheme === 'discord' && <Check className="w-4 h-4 text-[#5865f2] shrink-0" />}
                          </button>

                          {/* 3. Telegram */}
                          <button
                            onClick={() => {
                              onSetAppTheme('telegram');
                              setIsThemeCurtainOpen(false);
                            }}
                            className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer text-left ${
                              appTheme === 'telegram'
                                ? 'border-[#5288c1] bg-[#5288c1]/10 text-[#5288c1] font-bold shadow-xs'
                                : 'border-md3-outline-variant/20 bg-md3-surface hover:bg-md3-surface-container-high'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-3.5 h-3.5 rounded-full bg-[#5288c1] shrink-0" />
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-md3-on-surface truncate">{t.settings.themeTelegram}</div>
                                <div className="text-[10px] text-md3-on-surface-variant truncate">{t.settings.themeTelegramDesc}</div>
                              </div>
                            </div>
                            {appTheme === 'telegram' && <Check className="w-4 h-4 text-[#5288c1] shrink-0" />}
                          </button>

                          {/* 4. Cyberpunk Duotone (2 цвета) */}
                          <button
                            onClick={() => {
                              onSetAppTheme('cyberpunk');
                              setIsThemeCurtainOpen(false);
                            }}
                            className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer text-left ${
                              appTheme === 'cyberpunk'
                                ? 'border-[#00f5d4] bg-[#00f5d4]/10 text-[#00f5d4] font-bold shadow-xs'
                                : 'border-md3-outline-variant/20 bg-md3-surface hover:bg-md3-surface-container-high'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="flex items-center -space-x-1.5 shrink-0">
                                <div className="w-3.5 h-3.5 rounded-full bg-[#00f5d4]" />
                                <div className="w-3.5 h-3.5 rounded-full bg-[#f72585]" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-md3-on-surface truncate">{t.settings.themeCyberpunk}</div>
                                <div className="text-[10px] text-md3-on-surface-variant truncate">{t.settings.themeCyberpunkDesc}</div>
                              </div>
                            </div>
                            {appTheme === 'cyberpunk' && <Check className="w-4 h-4 text-[#00f5d4] shrink-0" />}
                          </button>

                          {/* Секция: Пользовательские темы из themes/ */}
                          <div className="pt-2">
                            <div className="flex items-center justify-between px-1 pb-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-md3-primary">
                                {t.settings.customThemes}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  refreshCustomThemes();
                                }}
                                title={t.settings.reloadThemes}
                                className="p-1 rounded text-md3-on-surface-variant hover:text-md3-primary cursor-pointer"
                              >
                                <RefreshCw className="w-3 h-3" />
                              </button>
                            </div>

                            {customThemesList.length > 0 ? (
                              customThemesList.map((ct) => (
                                <button
                                  key={ct.filename}
                                  onClick={() => {
                                    onSetAppTheme(`custom:${ct.filename}`);
                                    setIsThemeCurtainOpen(false);
                                  }}
                                  className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer text-left mb-1.5 ${
                                    appTheme === `custom:${ct.filename}`
                                      ? 'border-md3-primary bg-md3-primary/10 text-md3-primary font-bold shadow-xs'
                                      : 'border-md3-outline-variant/20 bg-md3-surface hover:bg-md3-surface-container-high'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <FileCode className="w-3.5 h-3.5 text-md3-primary shrink-0" />
                                    <div className="min-w-0">
                                      <div className="text-xs font-semibold text-md3-on-surface truncate">{ct.name}</div>
                                      <div className="text-[10px] text-md3-on-surface-variant font-mono truncate">{ct.filename}</div>
                                    </div>
                                  </div>
                                  {appTheme === `custom:${ct.filename}` && <Check className="w-4 h-4 text-md3-primary shrink-0" />}
                                </button>
                              ))
                            ) : (
                              <div className="p-2.5 rounded-xl bg-md3-surface text-center text-[11px] text-md3-on-surface-variant">
                                {t.settings.noCustomThemes}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              </div>

              {/* Dynamic Color Controls Depending on Selected Theme */}
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
                          title={t.settings.paletteCustom}
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
                    {t.settings.pickDiscordColor}
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
                      title={t.settings.paletteCustom}
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
                    {t.settings.pickTelegramColor}
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
                      title={t.settings.paletteCustom}
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
                    {t.settings.duotonePresets}
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
                    <div className="font-semibold text-md3-on-surface">{t.settings.customCssActive}</div>
                    <div className="text-[11px]">{t.settings.customCssFile} {appTheme.replace('custom:', '')}</div>
                  </div>
                  <button
                    onClick={refreshCustomThemes}
                    className="px-3 py-1.5 rounded-xl bg-md3-primary/10 text-md3-primary hover:bg-md3-primary/20 text-xs font-semibold cursor-pointer"
                  >
                    {t.settings.refreshStyles}
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
                <div className="text-xs text-md3-on-surface-variant font-mono">
                  {fadeMode === 'off' ? t.settings.crossfadeOff : `${fadeDuration.toFixed(1)}s`}
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
                  <span className="text-xs">{t.settings.crossfadeOff}</span>
                  <span className="text-[10px] opacity-70">{t.settings.crossfadeOffDesc}</span>
                </button>

                <button
                  onClick={() => onSetFadeMode('track_change_and_pause')}
                  className={`p-3 rounded-2xl border flex flex-col items-start gap-1 transition-all text-left cursor-pointer ${
                    fadeMode === 'track_change_and_pause'
                      ? 'border-md3-primary bg-md3-primary/10 text-md3-primary font-bold shadow-xs'
                      : 'border-md3-outline-variant/20 bg-md3-surface text-md3-on-surface-variant hover:bg-md3-surface-container-high'
                  }`}
                >
                  <span className="text-xs">{t.settings.crossfadeChangePause}</span>
                  <span className="text-[10px] opacity-70">{t.settings.crossfadeChangePauseDesc}</span>
                </button>

                <button
                  onClick={() => onSetFadeMode('always')}
                  className={`p-3 rounded-2xl border flex flex-col items-start gap-1 transition-all text-left cursor-pointer ${
                    fadeMode === 'always'
                      ? 'border-md3-primary bg-md3-primary/10 text-md3-primary font-bold shadow-xs'
                      : 'border-md3-outline-variant/20 bg-md3-surface text-md3-on-surface-variant hover:bg-md3-surface-container-high'
                  }`}
                >
                  <span className="text-xs">{t.settings.crossfadeAlways}</span>
                  <span className="text-[10px] opacity-70">{t.settings.crossfadeAlwaysDesc}</span>
                </button>
              </div>

              {/* Fade Duration Slider */}
              {fadeMode !== 'off' && (
                <div className="p-3.5 rounded-2xl bg-md3-surface border border-md3-outline-variant/20 space-y-2 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-md3-on-surface-variant flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-md3-primary" />
                      {t.settings.fadeDuration}
                    </span>
                    <span className="font-bold text-md3-primary font-mono">{fadeDuration.toFixed(1)}s</span>
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
                {t.settings.navigationTabsDesc}
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
                  {discordEnabled ? t.settings.discordEnabled : t.settings.discordDisabled}
                </div>
              </div>

              {/* Master Discord Toggle */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-md3-surface-container-low border border-md3-outline-variant/15">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-md3-on-surface">
                    {t.settings.discordToggle}
                  </div>
                  <div className="text-[11px] text-md3-on-surface-variant">
                    {t.settings.discordToggleDesc}
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
                  <span>{t.settings.discordPreview}</span>
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
                      {isPlaying ? `${formatTime(currentTime)} (${t.settings.playing})` : t.settings.paused}
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
                    {t.settings.discordTopBarDesc}
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

            {/* 5. Section: Language (ШТОРКА ЯЗЫКА ИНТЕРФЕЙСА) - Перед горячими клавишами */}
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
                {t.settings.languageDesc}
              </p>

              {/* Шторка trigger card */}
              <div className="rounded-2xl border border-md3-outline-variant/20 bg-md3-surface overflow-hidden transition-all shadow-xs">
                <button
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setIsLangCurtainOpen(!isLangCurtainOpen)}
                  className="w-full p-3.5 flex items-center justify-between text-left cursor-pointer hover:bg-md3-surface-container-high/60 transition-colors outline-none focus:outline-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-md3-primary/10 text-md3-primary flex items-center justify-center shrink-0">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-md3-on-surface">
                        {language === 'ru' ? 'Русский' : 'English'}
                      </div>
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-md3-on-surface-variant transition-transform duration-200 shrink-0 ${isLangCurtainOpen ? 'rotate-180 text-md3-primary' : ''}`} />
                </button>

                {/* Раскрывающаяся шторка с плавной прокруткой */}
                {isLangCurtainOpen && (
                  <div className="border-t border-md3-outline-variant/20 p-2.5 bg-md3-surface-container-low/70 space-y-2 animate-in fade-in duration-200">
                    <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                      
                      {/* Русский */}
                      <button
                        tabIndex={-1}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          onSetLanguage('ru');
                          setIsLangCurtainOpen(false);
                        }}
                        className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer text-left outline-none focus:outline-none ${
                          language === 'ru'
                            ? 'border-md3-primary bg-md3-primary/10 text-md3-primary font-bold shadow-xs'
                            : 'border-md3-outline-variant/20 bg-md3-surface hover:bg-md3-surface-container-high'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-bold text-md3-on-surface">Русский</span>
                        </div>
                        {language === 'ru' && <Check className="w-4 h-4 text-md3-primary shrink-0" />}
                      </button>

                      {/* English */}
                      <button
                        tabIndex={-1}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          onSetLanguage('en');
                          setIsLangCurtainOpen(false);
                        }}
                        className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer text-left outline-none focus:outline-none ${
                          language === 'en'
                            ? 'border-md3-primary bg-md3-primary/10 text-md3-primary font-bold shadow-xs'
                            : 'border-md3-outline-variant/20 bg-md3-surface hover:bg-md3-surface-container-high'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-bold text-md3-on-surface">English</span>
                        </div>
                        {language === 'en' && <Check className="w-4 h-4 text-md3-primary shrink-0" />}
                      </button>

                    </div>
                  </div>
                )}
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

            {/* 7. About Application & Updates Card */}
            <div className="pt-2">
              <div className="p-4 rounded-3xl bg-md3-surface-container-low border border-md3-outline-variant/20 flex flex-col gap-3.5">
                <div className="flex items-center gap-4">
                  <img
                    src="/app-logo.png"
                    alt="Arachnid Logo"
                    className="w-12 h-12 rounded-2xl object-contain drop-shadow-md shrink-0"
                  />
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-md3-on-surface">{t.settings.about}</span>
                      <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-md3-primary/10 text-md3-primary">
                        v{appVersion}
                      </span>
                    </div>
                    <p className="text-xs text-md3-on-surface-variant">
                      {t.settings.aboutDesc}
                    </p>
                  </div>
                </div>

                {/* Updates Checker Row */}
                <div className="pt-2.5 border-t border-md3-outline-variant/15 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-md3-on-surface flex items-center gap-2">
                      <RefreshCw className={`w-3.5 h-3.5 text-md3-primary ${updateStatus === 'checking' ? 'animate-spin' : ''}`} />
                      <span>{t.settings.updates}</span>
                    </div>

                    <button
                      tabIndex={-1}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={handleCheckUpdates}
                      disabled={updateStatus === 'checking'}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-md3-primary text-md3-on-primary text-xs font-semibold shadow-xs hover:scale-102 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all cursor-pointer outline-none focus:outline-none"
                    >
                      <RefreshCw className={`w-3 h-3 ${updateStatus === 'checking' ? 'animate-spin' : ''}`} />
                      <span>{updateStatus === 'checking' ? t.settings.checkingUpdates : t.settings.checkUpdates}</span>
                    </button>
                  </div>

                  {/* Status: Up to date */}
                  {updateStatus === 'upToDate' && (
                    <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{t.settings.latestVersionInstalled} (v{appVersion})</span>
                    </div>
                  )}

                  {/* Status: Error */}
                  {updateStatus === 'error' && (
                    <div className="flex items-center justify-between p-2.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs animate-in fade-in">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{installError || t.settings.failedCheckUpdates}</span>
                      </div>
                      <button
                        tabIndex={-1}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={handleCheckUpdates}
                        className="text-[11px] underline font-bold cursor-pointer hover:text-red-300"
                      >
                        {t.settings.retryCheck}
                      </button>
                    </div>
                  )}

                  {/* Status: Downloading */}
                  {updateStatus === 'downloading' && (
                    <div className="p-3.5 rounded-2xl bg-md3-primary/10 border border-md3-primary/30 space-y-2.5 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between text-xs font-semibold text-md3-primary">
                        <div className="flex items-center gap-2">
                          <Download className="w-4 h-4 animate-bounce" />
                          <span>{t.settings.downloadingUpdate}</span>
                        </div>
                        <span className="font-mono text-[11px]">
                          {downloadProgress}% {downloadStats.total !== '0' ? `(${downloadStats.received} / ${downloadStats.total} MB)` : ''}
                        </span>
                      </div>
                      <div className="w-full bg-md3-surface-container-high rounded-full h-2.5 overflow-hidden p-0.5">
                        <div
                          className="bg-md3-primary h-full rounded-full transition-all duration-150"
                          style={{ width: `${Math.max(4, downloadProgress)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Status: Installing */}
                  {updateStatus === 'installing' && (
                    <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-semibold animate-in fade-in">
                      <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                      <span>{t.settings.installingUpdate}</span>
                    </div>
                  )}

                  {/* Status: Update Available */}
                  {updateStatus === 'available' && latestRelease && (
                    <div className="p-3.5 rounded-2xl bg-md3-primary/10 border border-md3-primary/30 space-y-2.5 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-xs font-bold text-md3-primary">
                            {t.settings.updateAvailable}: {latestRelease.tagName}
                          </span>
                        </div>
                        {latestRelease.publishedAt && (
                          <span className="text-[10px] text-md3-on-surface-variant font-mono">
                            {new Date(latestRelease.publishedAt).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US')}
                          </span>
                        )}
                      </div>

                      {latestRelease.body && (
                        <div className="text-[11px] text-md3-on-surface-variant max-h-24 overflow-y-auto custom-scrollbar whitespace-pre-wrap bg-md3-surface/60 p-2.5 rounded-xl border border-md3-outline-variant/15">
                          {latestRelease.body}
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        {/* 1. In-place auto update & restart button */}
                        <button
                          tabIndex={-1}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={handleInstallUpdate}
                          className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md hover:scale-102 active:scale-95 transition-all cursor-pointer outline-none focus:outline-none"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{t.settings.installUpdate}</span>
                        </button>

                        {/* 2. Direct browser link to download exe if needed */}
                        {latestRelease.downloadUrl && (
                          <button
                            tabIndex={-1}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleDownloadUpdate(latestRelease.downloadUrl!)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-md3-surface-container hover:bg-md3-surface-container-high text-md3-on-surface text-xs font-medium border border-md3-outline-variant/20 transition-all cursor-pointer outline-none focus:outline-none"
                            title={t.settings.downloadAsset}
                          >
                            <Download className="w-3.5 h-3.5 text-md3-primary" />
                            <span>{t.settings.downloadAsset}</span>
                          </button>
                        )}

                        {/* 3. GitHub Release page link */}
                        <button
                          tabIndex={-1}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleDownloadUpdate(latestRelease.htmlUrl)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-md3-surface-container hover:bg-md3-surface-container-high text-md3-on-surface text-xs font-medium border border-md3-outline-variant/20 transition-all cursor-pointer outline-none focus:outline-none"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-md3-primary" />
                          <span>GitHub</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};
