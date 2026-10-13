import React, { useState, useEffect, useRef } from 'react';
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
  Folder,
  Trash2,
  Sliders,
  SlidersHorizontal,
  Radio,
  Download,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  FileText,
  Calendar
} from 'lucide-react';
import { marked } from 'marked';
import { ThemeMode, Track, FadeMode } from '../types/music';
import { CustomThemeInfo } from '../types/theme';
import { ThemePaletteModal } from './ThemePaletteModal';
import { ConfirmationModal } from './ConfirmationModal';
import { MainViewType } from './TopBar';
import { formatTime } from '../services/tagEditor';
import { AppLanguage, getTranslations } from '../i18n';
import { isTauri, invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export type ColorSchemeMode = 'dynamic' | 'system' | 'custom';

import { CURRENT_APP_VERSION } from '../utils/version';
import { useModalAnimation, useCurtainAnimation } from '../utils/useModalAnimation';

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
  discordShowPlayIcon: boolean;
  onToggleDiscordPlayIcon: () => void;
  discordShowPauseIcon: boolean;
  onToggleDiscordPauseIcon: () => void;
  discordStatusMode: 'listening' | 'listening_app';
  onSetDiscordStatusMode: (mode: 'listening' | 'listening_app') => void;
  discordCustomClientId: string;
  onSetDiscordCustomClientId: (id: string) => void;
  visibleTabs: Record<MainViewType, boolean>;
  onToggleTabVisibility: (tab: MainViewType) => void;
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  fadeMode: FadeMode;
  onSetFadeMode: (mode: FadeMode) => void;
  fadeDuration: number;
  onSetFadeDuration: (dur: number) => void;
  hasUpdate?: boolean;
  onUpdateFound?: () => void;
  autoUpdateEnabled?: boolean;
  onSetAutoUpdateEnabled?: (enabled: boolean) => void;
  autoUpdateInterval?: 'startup' | '30m' | '1h';
  onSetAutoUpdateInterval?: (interval: 'startup' | '30m' | '1h') => void;
  customThemesList: CustomThemeInfo[];
  onRefreshCustomThemes: () => Promise<any>;
  onDeleteCustomTheme: (themeId: string) => Promise<void>;
  themePaletteColors: Record<string, string>;
  onUpdateThemePaletteColor: (itemId: string, hex: string) => void;
  onResetThemePalette: () => void;
  themeToggles: Record<string, boolean>;
  onToggleThemeOption: (toggleId: string, val: boolean) => void;
}

const STANDARD_PRESETS = [
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
  discordShowPlayIcon,
  onToggleDiscordPlayIcon,
  discordShowPauseIcon,
  onToggleDiscordPauseIcon,
  discordStatusMode,
  onSetDiscordStatusMode,
  discordCustomClientId,
  onSetDiscordCustomClientId,
  visibleTabs,
  onToggleTabVisibility,
  currentTrack,
  isPlaying,
  currentTime,
  fadeMode,
  onSetFadeMode,
  fadeDuration,
  onSetFadeDuration,
  hasUpdate = false,
  onUpdateFound,
  autoUpdateEnabled = true,
  onSetAutoUpdateEnabled,
  autoUpdateInterval = '1h',
  onSetAutoUpdateInterval,
  customThemesList,
  onRefreshCustomThemes,
  onDeleteCustomTheme,
  themePaletteColors,
  onUpdateThemePaletteColor,
  onResetThemePalette,
  themeToggles,
  onToggleThemeOption,
}) => {
  const [currentView, setCurrentView] = useState<'main' | 'shortcuts' | 'release_notes' | 'discord' | 'logs'>('main');
  const [navDirection, setNavDirection] = useState<'forward' | 'backward'>('forward');
  const [isPaletteModalOpen, setIsPaletteModalOpen] = useState<boolean>(false);
  const [themeToDelete, setThemeToDelete] = useState<CustomThemeInfo | null>(null);
  const updateSectionRef = useRef<HTMLDivElement>(null);
  const updateCardRef = useRef<HTMLDivElement>(null);
  const releaseNotesContainerRef = useRef<HTMLDivElement>(null);
  const mainSettingsContainerRef = useRef<HTMLDivElement>(null);
  const mainScrollTopRef = useRef<number>(0);

  const { isRendered, backdropClass, dialogClass } = useModalAnimation(isOpen, 200);

  // Accordion (шторка) open/closed states with animated hooks
  const [isThemeCurtainOpen, setIsThemeCurtainOpen] = useState<boolean>(false);
  const [isLangCurtainOpen, setIsLangCurtainOpen] = useState<boolean>(false);
  const [isUpdateSettingsOpen, setIsUpdateSettingsOpen] = useState<boolean>(false);
  const [updateViewDirection, setUpdateViewDirection] = useState<'forward' | 'backward'>('forward');

  const { isRendered: isThemeCurtainRendered, curtainClass: themeCurtainClass } = useCurtainAnimation(isThemeCurtainOpen, 160);
  const { isRendered: isLangCurtainRendered, curtainClass: langCurtainClass } = useCurtainAnimation(isLangCurtainOpen, 160);

  // Theme Mode segmented control indicator
  const themeModeContainerRef = useRef<HTMLDivElement>(null);
  const themeModeRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const [themeModeIndicatorStyle, setThemeModeIndicatorStyle] = useState<{ left: number; width: number; height: number; opacity: number }>({
    left: 0,
    width: 0,
    height: 0,
    opacity: 0,
  });

  const updateThemeModeIndicator = () => {
    const el = themeModeRefs.current[themeMode];
    if (el) {
      setThemeModeIndicatorStyle({
        left: el.offsetLeft,
        width: el.offsetWidth,
        height: el.offsetHeight,
        opacity: 1,
      });
    }
  };

  useEffect(() => {
    updateThemeModeIndicator();
    const timer = setTimeout(updateThemeModeIndicator, 40);
    return () => clearTimeout(timer);
  }, [themeMode, currentView, isOpen]);

  useEffect(() => {
    if (themeModeContainerRef.current && window.ResizeObserver) {
      const ro = new ResizeObserver(() => updateThemeModeIndicator());
      ro.observe(themeModeContainerRef.current);
      return () => ro.disconnect();
    }
  }, []);

  // Real-time Logs state
  const [logs, setLogs] = useState<string[]>([]);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const logsScrollRef = useRef<HTMLDivElement>(null);

  const handleOpenUpdateSettings = () => {
    setUpdateViewDirection('forward');
    setIsUpdateSettingsOpen(true);
  };

  const handleCloseUpdateSettings = () => {
    setUpdateViewDirection('backward');
    setIsUpdateSettingsOpen(false);
  };

  // App version & Update checker state
  const [appVersion, setAppVersion] = useState<string>(CURRENT_APP_VERSION);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'upToDate' | 'available' | 'downloading' | 'installing' | 'error'>('idle');
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadStats, setDownloadStats] = useState<{ received: string; total: string }>({ received: '0.0', total: '0.0' });
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

  useEffect(() => {
    if (currentView === 'release_notes') {
      releaseNotesContainerRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    } else if (currentView === 'main') {
      if (mainSettingsContainerRef.current && mainScrollTopRef.current > 0) {
        mainSettingsContainerRef.current.scrollTo({ top: mainScrollTopRef.current, behavior: 'instant' });
      }
    }
  }, [currentView, latestRelease]);

  // Real-time logs subscriber and initial fetch
  useEffect(() => {
    if (currentView !== 'logs') return;

    if (isTauri()) {
      invoke<string[]>('get_recent_logs')
        .then((lines) => {
          if (Array.isArray(lines)) {
            setLogs(lines);
          }
        })
        .catch(() => {});

      let unlistenFn: (() => void) | undefined;
      listen<{ line: string }>('log://new-entry', (event) => {
        if (event.payload?.line) {
          setLogs((prev) => [...prev.slice(-499), event.payload.line]);
        }
      })
        .then((unlisten) => {
          unlistenFn = unlisten;
        })
        .catch(() => {});

      return () => {
        unlistenFn?.();
      };
    }
  }, [currentView]);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (currentView === 'logs' && autoScroll && logsScrollRef.current) {
      logsScrollRef.current.scrollTop = logsScrollRef.current.scrollHeight;
    }
  }, [logs, currentView, autoScroll]);

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
      const res = await fetch('https://api.github.com/repos/sssHpion007/ArachnidMP/releases/latest');

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
        htmlUrl: data.html_url || `https://github.com/sssHpion007/ArachnidMP/releases/tag/${tagName}`,
        downloadUrl: exeAsset?.browser_download_url || data.html_url,
        assetUrl: exeAsset?.browser_download_url || exeAsset?.url,
        assetName: exeAsset?.name || 'Arachnid-Portable.exe',
      });

      if (isNewerVersion(cleanCurrent, cleanLatest)) {
        setUpdateStatus('available');
        onUpdateFound?.();
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
    const downloadTarget = latestRelease?.downloadUrl || latestRelease?.assetUrl;
    if (!downloadTarget) {
      if (latestRelease?.htmlUrl) {
        handleDownloadUpdate(latestRelease.htmlUrl);
      }
      return;
    }

    setUpdateStatus('downloading');
    setDownloadProgress(0);
    setDownloadStats({ received: '0.0', total: '0.0' });
    setInstallError(null);

    try {
      if (isTauri()) {
        const unlisten = await listen<any>('update-progress', (event) => {
          const payload = event.payload;
          if (payload) {
            setDownloadProgress(payload.percent || 0);
            if (payload.downloaded && payload.total) {
              setDownloadStats({
                received: (payload.downloaded / (1024 * 1024)).toFixed(1),
                total: (payload.total / (1024 * 1024)).toFixed(1),
              });
            }
          }
        });

        try {
          await invoke('download_and_install_update', { url: downloadTarget });
          setUpdateStatus('installing');
        } finally {
          unlisten();
        }
      } else {
        // Fallback for browser preview mode
        window.open(downloadTarget, '_blank');
        setUpdateStatus('upToDate');
      }
    } catch (err: any) {
      console.error('Install update failed:', err);
      setInstallError(err?.message || String(err));
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

  const handleClose = () => {
    setCurrentView('main');
    setIsThemeCurtainOpen(false);
    setIsLangCurtainOpen(false);
    setIsUpdateSettingsOpen(false);
    onClose();
  };

  const handleOpenReleaseNotes = async () => {
    if (mainSettingsContainerRef.current) {
      mainScrollTopRef.current = mainSettingsContainerRef.current.scrollTop;
    }
    if (!latestRelease) {
      handleCheckUpdates();
    }
    setNavDirection('forward');
    setCurrentView('release_notes');
  };

  const handleOpenShortcuts = () => {
    if (mainSettingsContainerRef.current) {
      mainScrollTopRef.current = mainSettingsContainerRef.current.scrollTop;
    }
    setNavDirection('forward');
    setCurrentView('shortcuts');
  };

  const handleOpenLogs = () => {
    if (mainSettingsContainerRef.current) {
      mainScrollTopRef.current = mainSettingsContainerRef.current.scrollTop;
    }
    setNavDirection('forward');
    setCurrentView('logs');
  };

  const handleSaveLogsSnapshot = async () => {
    if (!isTauri()) return;
    try {
      const filename = await invoke<string>('save_logs_snapshot');
      setSaveStatus(filename);
      setTimeout(() => setSaveStatus(null), 4000);
    } catch (err) {
      console.error('Failed to save logs snapshot:', err);
    }
  };

  const handleOpenLogsFolder = async () => {
    if (!isTauri()) return;
    try {
      await invoke('open_logs_folder');
    } catch (err) {
      console.error('Failed to open logs folder:', err);
    }
  };

  const handleBackToMain = () => {
    setNavDirection('backward');
    setCurrentView('main');
    setTimeout(() => {
      if (mainSettingsContainerRef.current && mainScrollTopRef.current > 0) {
        mainSettingsContainerRef.current.scrollTop = mainScrollTopRef.current;
      }
    }, 10);
  };

  const renderFormattedLogLine = (line: string) => {
    const match = line.match(/^(\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?\])\s*(\[[A-Z]+\])\s*(\[[A-Z0-9_-]+\])\s*(.*)$/);
    if (!match) {
      return <span className="text-zinc-300 font-mono text-[11px]">{line}</span>;
    }
    const [, timestamp, level, tag, message] = match;
    const levelText = level.replace(/[\[\]]/g, '');

    let levelColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (levelText === 'ERROR') {
      levelColor = 'text-red-400 bg-red-500/15 border-red-500/30 font-bold';
    } else if (levelText === 'WARN') {
      levelColor = 'text-amber-400 bg-amber-500/15 border-amber-500/30 font-bold';
    } else if (levelText === 'AUDIO') {
      levelColor = 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30 font-bold';
    }

    const isAudioOrSeek = tag.includes('SEEK') || tag.includes('TIMELINE') || tag.includes('PLAYER') || tag.includes('AUDIO');

    return (
      <div className="flex items-start gap-2 py-0.5 hover:bg-white/5 rounded px-1 transition-colors leading-relaxed">
        <span className="text-zinc-500 shrink-0 select-none text-[10px] font-mono">{timestamp}</span>
        <span className={`px-1.5 py-0.2 rounded text-[10px] border shrink-0 font-mono ${levelColor}`}>
          {levelText}
        </span>
        <span className={`text-[10px] font-bold shrink-0 font-mono ${isAudioOrSeek ? 'text-amber-300' : 'text-zinc-400'}`}>
          {tag}
        </span>
        <span className="text-zinc-200 flex-1 break-all font-mono text-[11px]">
          {message}
        </span>
      </div>
    );
  };

  const handleMarkdownClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest('a');
    if (target && target.href) {
      e.preventDefault();
      handleDownloadUpdate(target.href);
    }
  };

  const scrollToUpdateSection = () => {
    if (currentView !== 'main') {
      setCurrentView('main');
    }
    setTimeout(() => {
      updateSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  };

  // Fetch Tauri app version if available
  useEffect(() => {
    if (isTauri()) {
      invoke<string>('get_app_version').then(v => {
        if (v) setAppVersion(v);
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setCurrentView('main');
      setIsUpdateSettingsOpen(false);
      setIsThemeCurtainOpen(false);
      setIsLangCurtainOpen(false);
      onRefreshCustomThemes();
    } else {
      setCurrentView('main');
      setIsThemeCurtainOpen(false);
      setIsLangCurtainOpen(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (updateStatus !== 'idle' && updateStatus !== 'checking' && updateCardRef.current && mainSettingsContainerRef.current) {
      const timer = setTimeout(() => {
        updateCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [updateStatus]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isThemeCurtainOpen) {
          setIsThemeCurtainOpen(false);
          return;
        }
        if (isLangCurtainOpen) {
          setIsLangCurtainOpen(false);
          return;
        }
        if (currentView !== 'main') {
          handleBackToMain();
          return;
        }
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, currentView, isThemeCurtainOpen, isLangCurtainOpen]);

  if (!isRendered) return null;

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

  // Helper to get active theme object
  const activeCustomTheme = (() => {
    if (!appTheme.startsWith('custom:')) return null;
    const themeId = appTheme.replace('custom:', '');
    return customThemesList.find(c => c.id === themeId || c.id === `folder:${themeId}` || c.id === `file:${themeId}` || c.css_filename === themeId) || null;
  })();

  // Helper to get active theme display label
  const getActiveThemeLabel = () => {
    if (appTheme === 'default') return t.settings.themeStandard;
    if (activeCustomTheme) return activeCustomTheme.name;
    if (appTheme.startsWith('custom:')) {
      return appTheme.replace('custom:', '').replace(/^folder:|^file:/, '');
    }
    return t.settings.themeStandard;
  };

  const getActiveThemeBadge = () => {
    if (appTheme === 'default') return t.settings.defaultBadge;
    if (activeCustomTheme?.author) return activeCustomTheme.author;
    if (activeCustomTheme?.is_folder) return language === 'ru' ? 'Папка' : 'Folder';
    return 'CSS';
  };

  return (
    <div 
      onClick={handleClose}
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none cursor-pointer ${backdropClass}`}
    >
      <div 
        className={`w-full max-w-xl bg-md3-surface-container rounded-3xl border border-md3-outline-variant/30 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-md3-on-surface cursor-default ${dialogClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-md3-outline-variant/20 bg-md3-surface/50">
          <div className="flex items-center gap-3">
            {currentView !== 'main' ? (
              <button
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleBackToMain}
                className="w-10 h-10 rounded-2xl bg-md3-primary/10 hover:bg-md3-primary/20 text-md3-primary flex items-center justify-center transition-all cursor-pointer outline-none focus:outline-none"
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
                {currentView === 'shortcuts'
                  ? t.settings.shortcuts
                  : currentView === 'release_notes'
                  ? t.settings.releaseNotes
                  : currentView === 'discord'
                  ? t.settings.discordRpc
                  : currentView === 'logs'
                  ? t.settings.logs
                  : t.settings.title}
              </h3>
              <p className="text-xs text-md3-on-surface-variant">
                {currentView === 'shortcuts'
                  ? t.settings.shortcutsDesc
                  : currentView === 'release_notes'
                  ? (latestRelease?.tagName ? `${latestRelease.name || latestRelease.tagName}` : (language === 'ru' ? 'Что нового в обновлении' : "What's new in update"))
                  : currentView === 'discord'
                  ? t.settings.discordSettingsDesc
                  : currentView === 'logs'
                  ? t.settings.logsDesc
                  : t.settings.subtitle}
              </p>
            </div>
          </div>

          {/* Right side: Update button (if update is available) + Close button */}
          <div className="flex items-center gap-3.5 shrink-0">
            {currentView === 'main' && (updateStatus === 'available' || hasUpdate) && (
              <button
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={scrollToUpdateSection}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-bold border border-emerald-500/40 animate-pulse hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-sm outline-none focus:outline-none"
                title={t.settings.updateAvailable}
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-spin-slow shrink-0" />
                <span>{language === 'ru' ? 'Обновление' : 'Update'}</span>
              </button>
            )}

            <button
              onClick={handleClose}
              className="p-1.5 rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container hover:text-md3-on-surface cursor-pointer outline-none focus:outline-none"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        {currentView === 'shortcuts' ? (
          /* Keyboard Shortcuts View (100% Fully Localized) */
          <div key="view-shortcuts" className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1 anim-view-slide-right">
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

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">{language === 'ru' ? '10-полосный эквалайзер' : '10-Band Equalizer'}</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    Ctrl + E
                  </kbd>
                </div>
              </div>
            </div>

            {/* Library & Track Management */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-md3-primary flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4" />
                <span>{t.shortcuts.libraryAndManagement}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
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
                  <span className="text-md3-on-surface-variant">{t.shortcuts.selectAll}</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    Ctrl + A
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">{t.shortcuts.deleteTracks}</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    Delete
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
                  <span className="text-md3-on-surface-variant">{t.shortcuts.switchTabs}</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    Tab / Shift + Tab
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">{t.shortcuts.search}</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    Ctrl + F
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">{t.shortcuts.dismiss}</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    Escape
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">{t.shortcuts.queue}</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    Q
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">{t.shortcuts.clearQueue}</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    X
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-md3-surface border border-md3-outline-variant/15">
                  <span className="text-md3-on-surface-variant">{t.shortcuts.lyrics}</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-md3-surface-container-high border border-md3-outline-variant/30 font-mono text-[11px] font-bold text-md3-primary shadow-xs">
                    T / L
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
        ) : currentView === 'discord' ? (
          /* Dedicated Discord Integration Settings View */
          <div key="view-discord" className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1 anim-view-slide-right">
            {/* 1. Master Discord Toggle Card */}
            <div className="p-4 rounded-3xl bg-md3-surface-container-low border border-md3-outline-variant/20 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#5865F2]/15 text-[#5865F2] flex items-center justify-center">
                    <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.078.078 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-md3-on-surface">
                      {t.settings.discordToggle}
                    </div>
                    <div className="text-xs text-md3-on-surface-variant">
                      {t.settings.discordToggleDesc}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                    discordEnabled
                      ? 'bg-[#5865F2]/15 text-[#5865F2] border border-[#5865F2]/30'
                      : 'bg-md3-surface-container-high text-md3-on-surface-variant'
                  }`}>
                    {discordEnabled ? t.settings.discordEnabled : t.settings.discordDisabled}
                  </span>
                  <input
                    type="checkbox"
                    checked={discordEnabled}
                    onChange={onToggleDiscord}
                    className="w-5 h-5 rounded accent-md3-primary cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* 2. Status Display Format Selection ("Слушает" vs "Слушает ArachnidMP") */}
            <div className="p-4 rounded-3xl bg-md3-surface-container-low border border-md3-outline-variant/20 space-y-3">
              <div>
                <div className="text-sm font-bold text-md3-on-surface">
                  {t.settings.discordStatusMode}
                </div>
                <div className="text-xs text-md3-on-surface-variant">
                  {t.settings.discordStatusModeDesc}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Option 1: "Слушает" */}
                <button
                  type="button"
                  onClick={() => onSetDiscordStatusMode('listening')}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                    discordStatusMode === 'listening'
                      ? 'bg-md3-primary/10 border-md3-primary ring-1 ring-md3-primary shadow-xs'
                      : 'bg-md3-surface border-md3-outline-variant/20 hover:border-md3-outline-variant/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-md3-on-surface">
                      {t.settings.discordStatusListening}
                    </span>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      discordStatusMode === 'listening'
                        ? 'border-md3-primary bg-md3-primary text-md3-on-primary'
                        : 'border-md3-outline-variant'
                    }`}>
                      {discordStatusMode === 'listening' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </div>
                  <p className="text-[11px] text-md3-on-surface-variant leading-relaxed">
                    {language === 'ru'
                      ? 'Минималистичный статус без названия программы. В списке профилей отображается только слово «Слушает».'
                      : 'Minimalist status without application name. Friends see only “Listening to” in member list.'}
                  </p>
                </button>

                {/* Option 2: "Слушает ArachnidMP" */}
                <button
                  type="button"
                  onClick={() => onSetDiscordStatusMode('listening_app')}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                    discordStatusMode === 'listening_app'
                      ? 'bg-md3-primary/10 border-md3-primary ring-1 ring-md3-primary shadow-xs'
                      : 'bg-md3-surface border-md3-outline-variant/20 hover:border-md3-outline-variant/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-md3-on-surface">
                      {t.settings.discordStatusListeningApp}
                    </span>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      discordStatusMode === 'listening_app'
                        ? 'border-md3-primary bg-md3-primary text-md3-on-primary'
                        : 'border-md3-outline-variant'
                    }`}>
                      {discordStatusMode === 'listening_app' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </div>
                  <p className="text-[11px] text-md3-on-surface-variant leading-relaxed">
                    {language === 'ru'
                      ? 'Фирменный статус с указанием плеера: «Слушает ArachnidMP». Подчеркивает воспроизведение в плеере.'
                      : 'Branded status showing player name: “Listening to ArachnidMP”. Emphasizes playback in player.'}
                  </p>
                </button>
              </div>
            </div>

            {/* 3. Playback State Icons (2 separate checkboxes: Play and Pause) */}
            <div className="p-4 rounded-3xl bg-md3-surface-container-low border border-md3-outline-variant/20 space-y-3">
              <div>
                <div className="text-sm font-bold text-md3-on-surface">
                  {t.settings.discordIcons}
                </div>
                <div className="text-xs text-md3-on-surface-variant">
                  {t.settings.discordIconsDesc}
                </div>
              </div>

              <div className="space-y-2 pt-1">
                {/* Checkbox 1: Play Icon */}
                <label className="flex items-center justify-between p-3 rounded-2xl bg-md3-surface border border-md3-outline-variant/15 hover:border-md3-outline-variant/30 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                      <img
                        src="https://raw.githubusercontent.com/FozerG/WinYandexMusicRPC/main/assets/Playing.png"
                        alt="Play"
                        className="w-4 h-4 object-contain"
                      />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-md3-on-surface">
                        {t.settings.discordShowPlayIcon}
                      </div>
                      <div className="text-[11px] text-md3-on-surface-variant">
                        {t.settings.discordShowPlayIconDesc}
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={discordShowPlayIcon}
                    onChange={onToggleDiscordPlayIcon}
                    className="w-4 h-4 rounded accent-md3-primary cursor-pointer ml-3 shrink-0"
                  />
                </label>

                {/* Checkbox 2: Pause Icon */}
                <label className="flex items-center justify-between p-3 rounded-2xl bg-md3-surface border border-md3-outline-variant/15 hover:border-md3-outline-variant/30 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <img
                        src="https://raw.githubusercontent.com/FozerG/WinYandexMusicRPC/main/assets/Paused.png"
                        alt="Pause"
                        className="w-4 h-4 object-contain"
                      />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-md3-on-surface">
                        {t.settings.discordShowPauseIcon}
                      </div>
                      <div className="text-[11px] text-md3-on-surface-variant">
                        {t.settings.discordShowPauseIconDesc}
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={discordShowPauseIcon}
                    onChange={onToggleDiscordPauseIcon}
                    className="w-4 h-4 rounded accent-md3-primary cursor-pointer ml-3 shrink-0"
                  />
                </label>
              </div>
            </div>

            {/* 4. Live Discord Mockup Profile Card */}
            <div className="p-4 rounded-3xl bg-[#2b2d31] border border-white/10 space-y-3 shadow-lg">
              <div className="text-[11px] font-bold text-[#949ba4] uppercase tracking-wider flex items-center justify-between">
                <span>{t.settings.discordPreview}</span>
                <span className="text-[10px] text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  {isPlaying ? 'Online' : 'Idle'}
                </span>
              </div>

              {/* Discord Activity Box */}
              <div className="p-3.5 rounded-2xl bg-[#1e1f22] border border-white/5 space-y-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#949ba4]">
                  {discordStatusMode === 'listening'
                    ? (language === 'ru' ? 'Слушает' : 'Listening to')
                    : (language === 'ru' ? 'Слушает ArachnidMP' : 'Listening to ArachnidMP')}
                </div>

                <div className="flex items-start gap-3.5">
                  {/* Large Album Art with Small Play/Pause Badge */}
                  <div className="relative w-16 h-16 rounded-xl bg-[#313338] overflow-hidden shrink-0 border border-white/5 shadow-md">
                    {currentTrack && currentTrack.coverArt ? (
                      <img
                        src={currentTrack.coverArt}
                        alt="Artwork"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#5865F2]/20 to-[#5865F2]/40 text-[#5865F2] font-black text-xl">
                        A
                      </div>
                    )}

                    {/* Small Play/Pause Badge */}
                    {isPlaying && discordShowPlayIcon && (
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#1e1f22] border-2 border-[#1e1f22] flex items-center justify-center shadow-md">
                        <img
                          src="https://raw.githubusercontent.com/FozerG/WinYandexMusicRPC/main/assets/Playing.png"
                          alt="Playing"
                          className="w-full h-full object-contain rounded-full"
                        />
                      </div>
                    )}
                    {!isPlaying && discordShowPauseIcon && (
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#1e1f22] border-2 border-[#1e1f22] flex items-center justify-center shadow-md">
                        <img
                          src="https://raw.githubusercontent.com/FozerG/WinYandexMusicRPC/main/assets/Paused.png"
                          alt="Paused"
                          className="w-full h-full object-contain rounded-full"
                        />
                      </div>
                    )}
                  </div>

                  {/* Metadata and Real Timeline Progress Bar */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="font-bold text-xs text-white truncate">
                      {currentTrack ? currentTrack.title : 'Bohemian Rhapsody'}
                    </div>
                    <div className="text-[11px] text-[#dbdee1] truncate font-medium">
                      by {currentTrack ? currentTrack.artist : 'Queen'}
                    </div>
                    <div className="text-[11px] text-[#949ba4] truncate">
                      on {currentTrack ? currentTrack.album : 'A Night at the Opera'}
                    </div>

                    {/* Real Timeline Progress Bar */}
                    <div className="space-y-1 pt-1.5">
                      <div className="w-full bg-[#4e5058] h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-white h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${
                              currentTrack && currentTrack.duration
                                ? Math.min(100, Math.max(0, (currentTime / currentTrack.duration) * 100))
                                : isPlaying ? 45 : 0
                            }%`
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-[#949ba4] font-mono">
                        <span>{formatTime(currentTime)}</span>
                        <span>{currentTrack && currentTrack.duration ? formatTime(currentTrack.duration) : '5:55'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Additional Settings: TopBar Switch & Custom Client ID */}
            <div className="p-4 rounded-3xl bg-md3-surface-container-low border border-md3-outline-variant/20 space-y-3">
              {/* Show Discord Quick Switch in TopBar */}
              <label className="flex items-center justify-between p-3 rounded-2xl bg-md3-surface border border-md3-outline-variant/15 hover:border-md3-outline-variant/30 transition-colors cursor-pointer">
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
                  className="w-4 h-4 rounded accent-md3-primary cursor-pointer ml-3 shrink-0"
                />
              </label>

              {/* Custom Client ID Input (Optional) */}
              <div className="p-3 rounded-2xl bg-md3-surface border border-md3-outline-variant/15 space-y-1.5">
                <div className="text-xs font-semibold text-md3-on-surface">
                  {t.settings.discordCustomClientId}
                </div>
                <div className="text-[11px] text-md3-on-surface-variant">
                  {t.settings.discordCustomClientIdDesc}
                </div>
                <input
                  type="text"
                  value={discordCustomClientId}
                  onChange={(e) => onSetDiscordCustomClientId(e.target.value)}
                  placeholder="1304561842858561637"
                  className="w-full px-3 py-2 rounded-xl bg-md3-surface-container-high border border-md3-outline-variant/30 text-xs font-mono text-md3-on-surface focus:outline-none focus:border-md3-primary transition-colors mt-1"
                />
              </div>
            </div>
          </div>
        ) : currentView === 'release_notes' ? (
          /* Formatted Markdown Release Notes View */
          <div key="view-release-notes" ref={releaseNotesContainerRef} className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1 anim-view-slide-right">
            {latestRelease ? (
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* Meta Header Card */}
                <div className="p-4 rounded-2xl bg-md3-surface-container-low border border-md3-outline-variant/20 flex items-center justify-between flex-wrap gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-md3-on-surface">
                        {latestRelease.name || `Arachnid ${latestRelease.tagName}`}
                      </span>
                      <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-md3-primary/15 text-md3-primary border border-md3-primary/30">
                        {latestRelease.tagName}
                      </span>
                    </div>
                    {latestRelease.publishedAt && (
                      <div className="text-[11px] text-md3-on-surface-variant flex items-center gap-1.5 font-mono">
                        <Calendar className="w-3.5 h-3.5 text-md3-primary" />
                        <span>
                          {new Date(latestRelease.publishedAt).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {updateStatus === 'available' && (
                      <button
                        tabIndex={-1}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={handleInstallUpdate}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm hover:scale-102 active:scale-95 transition-all cursor-pointer outline-none focus:outline-none"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{t.settings.installUpdate}</span>
                      </button>
                    )}
                    <button
                      tabIndex={-1}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleDownloadUpdate(latestRelease.htmlUrl)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-md3-surface hover:bg-md3-surface-container-high text-md3-on-surface text-xs font-medium border border-md3-outline-variant/20 transition-all cursor-pointer outline-none focus:outline-none"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-md3-primary" />
                      <span>GitHub</span>
                    </button>
                  </div>
                </div>

                {/* Formatted Markdown Body Card */}
                <div className="p-5 rounded-2xl bg-md3-surface border border-md3-outline-variant/15 shadow-xs">
                  <div
                    className="markdown-body"
                    onClick={handleMarkdownClick}
                    dangerouslySetInnerHTML={{
                      __html: marked.parse(latestRelease.body || '', { async: false }) as string,
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="text-center py-16 space-y-3">
                <FileText className="w-8 h-8 text-md3-on-surface-variant/40 mx-auto" />
                <p className="text-xs text-md3-on-surface-variant">
                  {updateStatus === 'checking'
                    ? t.settings.checkingUpdates
                    : (language === 'ru' ? 'Загрузка списка изменений...' : 'Loading release notes...')}
                </p>
              </div>
            )}
          </div>
        ) : currentView === 'logs' ? (
          /* Real-Time Logs View */
          <div key="view-logs" className="p-6 space-y-4 flex flex-col flex-1 overflow-hidden anim-view-slide-right">
            {/* Action Bar: Save button and Folder button */}
            <div className="flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                {/* 1. Кнопка "Сохранить" */}
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleSaveLogsSnapshot}
                  className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-md3-primary text-md3-on-primary hover:bg-md3-primary/90 text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 outline-none focus:outline-none"
                  title={language === 'ru' ? 'Сохранить лог в файл с текущей датой и временем' : 'Save logs snapshot with current timestamp'}
                >
                  <Download className="w-4 h-4 shrink-0" />
                  <span>{t.settings.saveLogs}</span>
                </button>

                {/* 2. Кнопка "Папка" */}
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleOpenLogsFolder}
                  className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-md3-surface-container-high hover:bg-md3-surface-container-highest text-md3-on-surface border border-md3-outline-variant/30 text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 outline-none focus:outline-none"
                  title={language === 'ru' ? 'Открыть папку логов (config/logs)' : 'Open logs folder (config/logs)'}
                >
                  <FolderOpen className="w-4 h-4 text-md3-primary shrink-0" />
                  <span>{t.settings.logsFolder}</span>
                </button>
              </div>

              {/* Status and Tools on the right */}
              <div className="flex items-center gap-2">
                {saveStatus && (
                  <span className="text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-xl animate-in fade-in flex items-center gap-1.5 shadow-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate max-w-[200px]">{saveStatus}</span>
                  </span>
                )}

                {/* Auto-scroll Toggle */}
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setAutoScroll((v) => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer outline-none focus:outline-none ${
                    autoScroll
                      ? 'bg-md3-primary/10 border-md3-primary/30 text-md3-primary font-semibold'
                      : 'bg-md3-surface border-md3-outline-variant/20 text-md3-on-surface-variant'
                  }`}
                  title={language === 'ru' ? 'Автоматическая прокрутка к последней записи' : 'Auto-scroll to latest log'}
                >
                  <div className={`w-2 h-2 rounded-full ${autoScroll ? 'bg-emerald-400 animate-pulse' : 'bg-md3-outline-variant'}`} />
                  <span>{t.settings.autoScroll}</span>
                </button>

                {/* Clear console view button */}
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setLogs([])}
                  className="p-2 rounded-xl bg-md3-surface hover:bg-md3-surface-container-high text-md3-on-surface-variant hover:text-red-400 border border-md3-outline-variant/20 transition-all cursor-pointer outline-none focus:outline-none"
                  title={language === 'ru' ? 'Очистить экран' : 'Clear screen'}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Real-time Console Log Area */}
            <div
              ref={logsScrollRef}
              className="flex-1 bg-black/60 rounded-3xl border border-md3-outline-variant/25 p-4 font-mono text-[11px] leading-relaxed overflow-y-auto custom-scrollbar select-text text-zinc-300 min-h-[380px] max-h-[58vh] shadow-inner"
            >
              {logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-500 italic gap-2 py-16">
                  <FileText className="w-8 h-8 text-zinc-600 animate-pulse" />
                  <span>{language === 'ru' ? 'Ожидание событий... Воспроизведите трек или переместите таймлайн.' : 'Waiting for events... Play a track or seek on the timeline.'}</span>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {logs.map((line, idx) => (
                    <div key={idx} className="break-all whitespace-pre-wrap">
                      {renderFormattedLogLine(line)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Main Settings View */
          <div key="view-main-settings" ref={mainSettingsContainerRef} className={`p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1 ${navDirection === 'backward' ? 'anim-view-slide-left' : ''}`}>
            
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

              {/* Theme Style Selector (ШТОРКА ТЕМЫ ОФОРМЛЕНИЯ) */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-md3-on-surface flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-md3-primary" />
                  <span>{t.settings.themeStyle}</span>
                </div>

                {/* Шторка trigger card */}
                <div className="relative z-30">
                  <div className="rounded-2xl border border-md3-outline-variant/20 bg-md3-surface shadow-xs">
                    <button
                      type="button"
                      onClick={() => setIsThemeCurtainOpen(!isThemeCurtainOpen)}
                      className="w-full p-3.5 flex items-center justify-between text-left cursor-pointer hover:bg-md3-surface-container-high/60 transition-colors rounded-2xl"
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
                            {getActiveThemeBadge() && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-md3-primary/15 text-md3-primary font-medium shrink-0">
                                {getActiveThemeBadge()}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-md3-on-surface-variant truncate block">
                            {appTheme === 'default' ? t.settings.themeStandardDesc : (activeCustomTheme?.description || t.settings.themeCurtainSelect)}
                          </span>
                        </div>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-md3-on-surface-variant transition-transform duration-200 shrink-0 ml-2 ${isThemeCurtainOpen ? 'rotate-180 text-md3-primary' : ''}`} />
                    </button>
                  </div>

                  {/* Раскрывающаяся шторка со списком тем: Material You первая, далее темы по алфавиту без разделения */}
                  {isThemeCurtainRendered && (
                    <>
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setIsThemeCurtainOpen(false)} 
                      />
                      <div className={`absolute left-0 right-0 top-full mt-2 z-50 p-2.5 rounded-2xl bg-md3-surface-container-high/95 backdrop-blur-xl border border-md3-outline-variant/30 shadow-2xl space-y-2 origin-top ${themeCurtainClass}`}>
                        <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                          {/* 1. Material You (По умолчанию) - ВСЕГДА ПЕРВАЯ, НЕУДАЛЯЕМАЯ */}
                          <button
                            type="button"
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
                              <div className="w-3.5 h-3.5 rounded-full bg-[#8b5cf6] shrink-0 shadow-xs" />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-md3-on-surface truncate">
                                    {t.settings.themeStandard}
                                  </span>
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-md3-primary/15 text-md3-primary font-medium shrink-0">
                                    {t.settings.defaultBadge}
                                  </span>
                                </div>
                                <div className="text-[10px] text-md3-on-surface-variant truncate">
                                  {t.settings.themeStandardDesc}
                                </div>
                              </div>
                            </div>
                            {appTheme === 'default' && <Check className="w-4 h-4 text-md3-primary shrink-0" />}
                          </button>

                          {/* 2. Пользовательские темы из themes/ (в алфавитном порядке) */}
                          {customThemesList.map((ct) => {
                            const isActive = appTheme === `custom:${ct.id}` || appTheme === `custom:${ct.css_filename}`;
                            return (
                              <div
                                key={ct.id}
                                onClick={() => {
                                  onSetAppTheme(`custom:${ct.id}`);
                                  setIsThemeCurtainOpen(false);
                                }}
                                className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer text-left ${
                                  isActive
                                    ? 'border-md3-primary bg-md3-primary/10 text-md3-primary font-bold shadow-xs'
                                    : 'border-md3-outline-variant/20 bg-md3-surface hover:bg-md3-surface-container-high'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                                  {ct.is_folder ? (
                                    <Folder className="w-3.5 h-3.5 text-md3-primary shrink-0" />
                                  ) : (
                                    <FileCode className="w-3.5 h-3.5 text-md3-primary shrink-0" />
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-semibold text-md3-on-surface truncate">
                                        {ct.name}
                                      </span>
                                      {ct.author && (
                                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-md3-surface-container-high text-md3-on-surface-variant font-mono">
                                          {ct.author}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-md3-on-surface-variant truncate">
                                      {ct.description}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  {isActive && <Check className="w-4 h-4 text-md3-primary mr-1 shrink-0" />}
                                  <button
                                    tabIndex={-1}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setThemeToDelete(ct);
                                    }}
                                    className="p-1 rounded-lg text-md3-on-surface-variant hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                    title={t.settings.themeDelete}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Нижняя панель шторки: Открыть папку + Обновить */}
                        <div className="pt-2 border-t border-md3-outline-variant/15 flex items-center justify-between px-1">
                          <button
                            type="button"
                            onClick={handleOpenThemesFolder}
                            className="flex items-center gap-1.5 text-[11px] font-medium text-md3-primary hover:underline cursor-pointer"
                          >
                            <FolderOpen className="w-3 h-3" />
                            <span>{t.settings.openThemesFolder}</span>
                          </button>

                          <button
                            type="button"
                            onClick={onRefreshCustomThemes}
                            className="flex items-center gap-1 text-[11px] font-medium text-md3-on-surface-variant hover:text-md3-primary cursor-pointer p-1 rounded hover:bg-md3-surface"
                            title={t.settings.reloadThemes}
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>{t.settings.reloadThemes}</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* СЕКЦИЯ НАСТРОЕК ВЫБРАННОЙ ТЕМЫ */}
              {appTheme === 'default' ? (
                /* НАСТРОЙКИ СТАНДАРТНОЙ ТЕМЫ: Режимы Dark / AMOLED / Light и палитра Material 3 */
                <div className="space-y-3.5 pt-2 border-t border-md3-outline-variant/15 animate-in fade-in duration-200">
                  <div className="text-xs font-semibold text-md3-on-surface">
                    {t.settings.standardThemeSettings}
                  </div>

                  {/* Theme Mode Segmented Control (Dark / AMOLED / Light) with sliding glowing pill */}
                  <div
                    ref={themeModeContainerRef}
                    className="relative p-1 bg-md3-surface rounded-2xl border border-md3-outline-variant/20 shadow-xs flex items-center select-none overflow-hidden"
                  >
                    {/* Smooth sliding glow pill indicator */}
                    <div
                      className="absolute rounded-xl bg-md3-primary shadow-sm pointer-events-none transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] z-0"
                      style={{
                        left: `${themeModeIndicatorStyle.left}px`,
                        width: `${themeModeIndicatorStyle.width}px`,
                        height: `${themeModeIndicatorStyle.height}px`,
                        opacity: themeModeIndicatorStyle.opacity,
                        boxShadow: '0 0 16px rgba(var(--md-sys-color-primary-rgb, 168 121 255), 0.45), 0 2px 6px rgba(0,0,0,0.2)',
                      }}
                    />

                    {/* Dark */}
                    <button
                      ref={(el) => { themeModeRefs.current['dark'] = el; }}
                      tabIndex={-1}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => onSetThemeMode('dark')}
                      className={`relative z-10 flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 text-xs transition-colors duration-200 cursor-pointer outline-none focus:outline-none ${
                        themeMode === 'dark'
                          ? 'text-md3-on-primary font-bold'
                          : 'text-md3-on-surface-variant hover:text-md3-on-surface font-medium'
                      }`}
                    >
                      <Moon className={`w-4 h-4 shrink-0 ${themeMode === 'dark' ? 'text-md3-on-primary' : ''}`} />
                      <span>{t.settings.dark}</span>
                    </button>

                    {/* AMOLED */}
                    <button
                      ref={(el) => { themeModeRefs.current['amoled'] = el; }}
                      tabIndex={-1}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => onSetThemeMode('amoled')}
                      className={`relative z-10 flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 text-xs transition-colors duration-200 cursor-pointer outline-none focus:outline-none ${
                        themeMode === 'amoled'
                          ? 'text-md3-on-primary font-bold'
                          : 'text-md3-on-surface-variant hover:text-md3-on-surface font-medium'
                      }`}
                    >
                      <div className={`w-3.5 h-3.5 rounded-full bg-black border flex items-center justify-center text-[7px] font-bold shrink-0 ${
                        themeMode === 'amoled' ? 'border-white/80 text-white' : 'border-white/40 text-white/80'
                      }`}>
                        ●
                      </div>
                      <span>{t.settings.amoled}</span>
                    </button>

                    {/* Light */}
                    <button
                      ref={(el) => { themeModeRefs.current['light'] = el; }}
                      tabIndex={-1}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => onSetThemeMode('light')}
                      className={`relative z-10 flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 text-xs transition-colors duration-200 cursor-pointer outline-none focus:outline-none ${
                        themeMode === 'light'
                          ? 'text-md3-on-primary font-bold'
                          : 'text-md3-on-surface-variant hover:text-md3-on-surface font-medium'
                      }`}
                    >
                      <Sun className={`w-4 h-4 shrink-0 ${themeMode === 'light' ? 'text-md3-on-primary' : 'text-amber-500'}`} />
                      <span>{t.settings.light}</span>
                    </button>
                  </div>

                  {/* Material 3 Color Palette */}
                  <div className="space-y-2.5 pt-1">
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
                </div>
              ) : (
                /* НАСТРОЙКИ ПОЛЬЗОВАТЕЛЬСКОЙ ТЕМЫ: Настройка палитры, опции темы, переключатели */
                <div className="space-y-3 pt-2 border-t border-md3-outline-variant/15 animate-in fade-in duration-200">
                  {/* Карточка информации о теме */}
                  <div className="p-4 rounded-2xl bg-md3-surface border border-md3-outline-variant/20 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-md3-primary/10 text-md3-primary flex items-center justify-center shrink-0">
                        {activeCustomTheme?.is_folder ? <Folder className="w-5 h-5" /> : <FileCode className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-md3-on-surface">
                            {activeCustomTheme?.name || appTheme.replace('custom:', '')}
                          </span>
                          {activeCustomTheme?.version && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-md3-primary/10 text-md3-primary">
                              v{activeCustomTheme.version}
                            </span>
                          )}
                          {activeCustomTheme?.author && (
                            <span className="text-[10px] text-md3-on-surface-variant font-medium">
                              ({t.settings.themeByAuthor}: {activeCustomTheme.author})
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-md3-on-surface-variant mt-0.5 line-clamp-2">
                          {activeCustomTheme?.description || t.settings.themeSingleCssNotice}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {activeCustomTheme?.is_folder && (
                        <button
                          onClick={() => {
                            if (isTauri()) {
                              invoke('open_app_folder', { subfolder: `themes/${activeCustomTheme.folder_name}` }).catch(console.warn);
                            }
                          }}
                          className="p-2 rounded-xl bg-md3-surface-container-high hover:bg-md3-primary/15 text-md3-primary transition-colors cursor-pointer"
                          title={t.settings.openThemeFolder}
                        >
                          <FolderOpen className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={onRefreshCustomThemes}
                        className="p-2 rounded-xl bg-md3-surface-container-high hover:bg-md3-surface-container-highest text-md3-on-surface-variant hover:text-md3-on-surface transition-colors cursor-pointer"
                        title={t.settings.reloadThemes}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Кнопка и блок настройки палитры (если палитра определена в теме) */}
                  {activeCustomTheme?.palette && activeCustomTheme.palette.length > 0 && (
                    <div className="p-4 rounded-2xl bg-md3-surface border border-md3-outline-variant/20 flex items-center justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Palette className="w-4 h-4 text-md3-primary" />
                          <span className="text-xs font-bold text-md3-on-surface">
                            {t.settings.themePaletteBtn}
                          </span>
                        </div>
                        <p className="text-[11px] text-md3-on-surface-variant">
                          {t.settings.themePaletteBtnDesc}
                        </p>
                        {/* Превью цветов палитры */}
                        <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                          {activeCustomTheme.palette.map((item) => {
                            const c = (themePaletteColors[item.id] || item.default).toLowerCase();
                            return (
                              <div
                                key={item.id}
                                className="w-4 h-4 rounded-full border border-black/20 shadow-xs"
                                style={{ backgroundColor: c }}
                                title={`${item.label}: ${c}`}
                              />
                            );
                          })}
                        </div>
                      </div>

                      <button
                        onClick={() => setIsPaletteModalOpen(true)}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-md3-primary text-md3-on-primary text-xs font-bold shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span>{t.settings.themePaletteBtn}</span>
                      </button>
                    </div>
                  )}

                  {/* Пользовательские переключатели темы (если определены в теме) */}
                  {activeCustomTheme?.toggles && activeCustomTheme.toggles.length > 0 && (
                    <div className="p-4 rounded-2xl bg-md3-surface border border-md3-outline-variant/20 space-y-3">
                      <div className="text-xs font-bold text-md3-on-surface flex items-center gap-2">
                        <Sliders className="w-3.5 h-3.5 text-md3-primary" />
                        <span>{t.settings.themeOptions}</span>
                      </div>
                      <div className="space-y-2">
                        {activeCustomTheme.toggles.map((toggle) => {
                          const isEnabled = themeToggles[toggle.id] ?? toggle.default;
                          return (
                            <div
                              key={toggle.id}
                              className="p-2.5 rounded-xl bg-md3-surface-container-low border border-md3-outline-variant/15 flex items-center justify-between gap-3"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-semibold text-md3-on-surface truncate">
                                  {toggle.label}
                                </div>
                                {toggle.description && (
                                  <div className="text-[10px] text-md3-on-surface-variant">
                                    {toggle.description}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => onToggleThemeOption(toggle.id, !isEnabled)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                                  isEnabled
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'bg-md3-surface-container-high text-md3-on-surface-variant hover:text-md3-on-surface'
                                }`}
                              >
                                {isEnabled ? (language === 'ru' ? 'Вкл' : 'On') : (language === 'ru' ? 'Выкл' : 'Off')}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Одиночный CSS файл: сообщение с кнопкой открытия папки */}
                  {(!activeCustomTheme?.palette || activeCustomTheme.palette.length === 0) &&
                    (!activeCustomTheme?.toggles || activeCustomTheme.toggles.length === 0) && (
                      <div className="p-3.5 rounded-2xl bg-md3-surface border border-md3-outline-variant/20 text-xs text-md3-on-surface-variant flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-md3-on-surface">{t.settings.customCssActive}</div>
                          <div className="text-[11px]">{t.settings.themeSingleCssNotice}</div>
                        </div>
                        <button
                          onClick={handleOpenThemesFolder}
                          className="px-3 py-1.5 rounded-xl bg-md3-primary/10 text-md3-primary hover:bg-md3-primary/20 text-xs font-semibold cursor-pointer"
                        >
                          {t.settings.openThemesFolder}
                        </button>
                      </div>
                    )}
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

            {/* Button to Open Discord Integration Settings */}
            <div className="pt-2">
              <button
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (mainSettingsContainerRef.current) {
                    mainScrollTopRef.current = mainSettingsContainerRef.current.scrollTop;
                  }
                  setCurrentView('discord');
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-md3-surface-container-high/60 hover:bg-md3-surface-container-high border border-md3-outline-variant/20 hover:border-[#5865F2]/40 transition-all cursor-pointer group shadow-xs outline-none focus:outline-none"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#5865F2]/10 text-[#5865F2] flex items-center justify-center group-hover:scale-105 transition-transform">
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.078.078 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-md3-on-surface group-hover:text-md3-primary transition-colors">
                        {t.settings.discordRpc}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        discordEnabled 
                          ? 'bg-[#5865F2]/15 text-[#5865F2] border border-[#5865F2]/30' 
                          : 'bg-md3-surface-container-high text-md3-on-surface-variant'
                      }`}>
                        {discordEnabled ? t.settings.discordEnabled : t.settings.discordDisabled}
                      </span>
                    </div>
                    <div className="text-[11px] text-md3-on-surface-variant">
                      {t.settings.discordSettingsDesc}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-md3-on-surface-variant group-hover:text-md3-primary group-hover:translate-x-0.5 transition-all" />
              </button>
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
              <div className="relative z-20">
                <div className="rounded-2xl border border-md3-outline-variant/20 bg-md3-surface shadow-xs">
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setIsLangCurtainOpen(!isLangCurtainOpen)}
                    className="w-full p-3.5 flex items-center justify-between text-left cursor-pointer hover:bg-md3-surface-container-high/60 transition-colors rounded-2xl outline-none focus:outline-none"
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
                </div>

                {/* Раскрывающаяся шторка поверх содержимого */}
                {isLangCurtainRendered && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsLangCurtainOpen(false)} />
                    <div className={`absolute left-0 right-0 top-full mt-2 z-50 p-2.5 rounded-2xl bg-md3-surface-container-high/95 backdrop-blur-xl border border-md3-outline-variant/30 shadow-2xl space-y-2 origin-top ${langCurtainClass}`}>
                      <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                        
                        {/* Русский */}
                        <button
                          type="button"
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
                          type="button"
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
                  </>
                )}
              </div>
            </div>

            {/* 6. Button to Open Keyboard Shortcuts Menu */}
            <div className="pt-2">
              <button
                onClick={handleOpenShortcuts}
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

            {/* 6b. Button to Open Application Logs Menu */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleOpenLogs}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-md3-surface-container-high/60 hover:bg-md3-surface-container-high border border-md3-outline-variant/20 hover:border-md3-primary/40 transition-all cursor-pointer group shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-md3-primary/10 text-md3-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-bold text-md3-on-surface group-hover:text-md3-primary transition-colors">
                      {t.settings.logs}
                    </div>
                    <div className="text-[11px] text-md3-on-surface-variant">
                      {t.settings.logsDesc}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-md3-on-surface-variant group-hover:text-md3-primary group-hover:translate-x-0.5 transition-all" />
              </button>
            </div>

            {/* 7. About Application & Updates Card */}
            <div ref={updateSectionRef} className="pt-2">
              <div 
                ref={updateCardRef}
                className="p-4 rounded-3xl bg-md3-surface-container-low border border-md3-outline-variant/20 flex flex-col gap-3.5 transition-all duration-300"
              >
                {isUpdateSettingsOpen ? (
                  /* Auto-Update Settings View inside this container */
                  <div key="auto-update-settings" className="flex flex-col gap-3.5 anim-view-slide-right">
                    {/* Top Row: Back button + Title on the left, Toggle on the right */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          tabIndex={-1}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={handleCloseUpdateSettings}
                          className="w-7 h-7 rounded-full bg-md3-surface hover:bg-md3-surface-container-high text-md3-primary border border-md3-outline-variant/20 flex items-center justify-center transition-all cursor-pointer outline-none focus:outline-none shrink-0"
                          title={language === 'ru' ? 'Назад' : 'Back'}
                        >
                          <ArrowLeft className="w-4 h-4" />
                        </button>
                        <span className="font-bold text-xs text-md3-on-surface truncate">{t.settings.autoUpdateCheck}</span>
                      </div>

                      {/* Enable / Disable Auto-check Toggle Buttons */}
                      <div className="flex items-center p-0.5 rounded-xl bg-md3-surface border border-md3-outline-variant/20 gap-1 shrink-0">
                        <button
                          tabIndex={-1}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => onSetAutoUpdateEnabled?.(true)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            autoUpdateEnabled
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-md3-on-surface-variant hover:text-md3-on-surface'
                          }`}
                        >
                          {t.settings.autoUpdateEnabled}
                        </button>
                        <button
                          tabIndex={-1}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => onSetAutoUpdateEnabled?.(false)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            !autoUpdateEnabled
                              ? 'bg-md3-surface-container-highest text-md3-on-surface shadow-xs'
                              : 'text-md3-on-surface-variant hover:text-md3-on-surface'
                          }`}
                        >
                          {t.settings.autoUpdateDisabled}
                        </button>
                      </div>
                    </div>

                    {/* Bottom Row: Frequency Slider */}
                    <div className={`pt-2.5 border-t border-md3-outline-variant/15 flex flex-col gap-2 transition-opacity ${!autoUpdateEnabled ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-md3-on-surface-variant font-medium">{t.settings.autoUpdateInterval}</span>
                        <span className="font-bold text-md3-primary">
                          {autoUpdateInterval === 'startup'
                            ? t.settings.intervalStartup
                            : autoUpdateInterval === '30m'
                            ? t.settings.interval30m
                            : t.settings.interval1h}
                        </span>
                      </div>

                      <div className="px-1 space-y-1">
                        <input
                          type="range"
                          min={0}
                          max={2}
                          step={1}
                          disabled={!autoUpdateEnabled}
                          value={autoUpdateInterval === 'startup' ? 0 : autoUpdateInterval === '30m' ? 1 : 2}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const map: Record<number, 'startup' | '30m' | '1h'> = {
                              0: 'startup',
                              1: '30m',
                              2: '1h',
                            };
                            onSetAutoUpdateInterval?.(map[val] || '1h');
                          }}
                          className="w-full h-1.5 bg-md3-surface-container-highest rounded-lg appearance-none cursor-pointer accent-md3-primary"
                        />
                        <div className="flex justify-between text-[10px] text-md3-on-surface-variant/70 font-medium select-none">
                          <span
                            className={`cursor-pointer ${autoUpdateInterval === 'startup' ? 'text-md3-primary font-bold' : ''}`}
                            onClick={() => autoUpdateEnabled && onSetAutoUpdateInterval?.('startup')}
                          >
                            {t.settings.intervalStartup}
                          </span>
                          <span
                            className={`cursor-pointer ${autoUpdateInterval === '30m' ? 'text-md3-primary font-bold' : ''}`}
                            onClick={() => autoUpdateEnabled && onSetAutoUpdateInterval?.('30m')}
                          >
                            {t.settings.interval30m}
                          </span>
                          <span
                            className={`cursor-pointer ${autoUpdateInterval === '1h' ? 'text-md3-primary font-bold' : ''}`}
                            onClick={() => autoUpdateEnabled && onSetAutoUpdateInterval?.('1h')}
                          >
                            {t.settings.interval1h}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Standard About Application & Updates View */
                  <div key="about-and-updates" className={`flex flex-col gap-3.5 ${updateViewDirection === 'backward' ? 'anim-view-slide-left' : ''}`}>
                    <div className="flex items-center gap-4">
                      <img
                        src="/app-logo.png"
                        alt="Arachnid Logo"
                        className="w-12 h-12 rounded-2xl object-contain drop-shadow-md shrink-0"
                      />
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-md3-on-surface">Arachnid Music Player</span>
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
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="text-xs font-semibold text-md3-on-surface flex items-center gap-2">
                          <RefreshCw className={`w-3.5 h-3.5 text-md3-primary ${updateStatus === 'checking' ? 'animate-spin' : ''}`} />
                          <span>{t.settings.updates}</span>
                        </div>

                        {/* Buttons: Check for updates + Release notes + Auto-update gear settings */}
                        <div className="flex items-center gap-2">
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

                          {/* Always-visible Release Notes Button (between check updates and auto-update settings) */}
                          <button
                            tabIndex={-1}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={handleOpenReleaseNotes}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-md3-surface hover:bg-md3-surface-container-high text-md3-on-surface text-xs font-medium border border-md3-outline-variant/20 hover:border-md3-primary/30 transition-all cursor-pointer shadow-xs outline-none focus:outline-none"
                            title={t.settings.releaseNotes}
                          >
                            <FileText className="w-3.5 h-3.5 text-md3-primary" />
                            <span>{t.settings.releaseNotes}</span>
                          </button>

                          {/* Auto-update Settings Gear Button */}
                          <button
                            tabIndex={-1}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={handleOpenUpdateSettings}
                            className="p-1.5 rounded-full bg-md3-surface hover:bg-md3-surface-container-high text-md3-on-surface-variant hover:text-md3-primary border border-md3-outline-variant/20 hover:border-md3-primary/30 transition-all cursor-pointer shadow-xs outline-none focus:outline-none"
                            title={t.settings.autoUpdateSettings}
                          >
                            <Settings className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Smooth animated height container for update status messages */}
                      <div 
                        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                          updateStatus !== 'idle' && updateStatus !== 'checking' 
                            ? 'grid-rows-[1fr] opacity-100' 
                            : 'grid-rows-[0fr] opacity-0'
                        }`}
                      >
                        <div className="overflow-hidden space-y-2.5">
                          {/* Status: Up to date (Clean notification without duplicate button) */}
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
                                  {downloadProgress}% {downloadStats.total !== '0' && downloadStats.total !== '0.0' ? `(${downloadStats.received} / ${downloadStats.total} MB)` : ''}
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

          </div>
        )}
      </div>

      {/* Theme Palette Modal */}
      <ThemePaletteModal
        isOpen={isPaletteModalOpen}
        onClose={() => setIsPaletteModalOpen(false)}
        theme={activeCustomTheme || null}
        paletteColors={themePaletteColors}
        onUpdateColor={onUpdateThemePaletteColor}
        onResetAll={onResetThemePalette}
        language={language}
      />

      {/* Theme Deletion Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!themeToDelete}
        title={t.settings.themeDelete}
        message={
          language === 'ru'
            ? 'Вы уверены, что хотите удалить эту тему? Файлы темы будут безвозвратно удалены из папки themes/.'
            : 'Are you sure you want to delete this theme? The theme files will be permanently deleted from the themes/ folder.'
        }
        confirmLabel={t.settings.themeDelete}
        cancelLabel={language === 'ru' ? 'Отмена' : 'Cancel'}
        isDestructive={true}
        language={language}
        onConfirm={async () => {
          if (themeToDelete) {
            await onDeleteCustomTheme(themeToDelete.id);
            setThemeToDelete(null);
          }
        }}
        onClose={() => setThemeToDelete(null)}
      />
    </div>
  );
};
