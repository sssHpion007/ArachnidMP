import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Track, Playlist, PlaylistFolder, PlaylistGroup, ThemeMode, FadeMode, FolderCoverType } from './types/music';
import { TitleBar } from './components/TitleBar';
import { TopBar, MainViewType } from './components/TopBar';
import { TrackTable } from './components/TrackTable';
import { NowPlayingBar } from './components/NowPlayingBar';
import { PlaylistsGridView } from './components/PlaylistsGridView';
import { AlbumsGridView } from './components/AlbumsGridView';
import { ArtistsGridView } from './components/ArtistsGridView';
import { GenresGridView } from './components/GenresGridView';
import { QueueDrawer } from './components/QueueDrawer';
import { BatchTagEditorModal } from './components/BatchTagEditorModal';
import { EqualizerModal } from './components/EqualizerModal';
import { SettingsModal, ColorSchemeMode } from './components/SettingsModal';
import { DragDropOverlay } from './components/DragDropOverlay';
import { ContextMenu } from './components/ContextMenu';
import { PlaylistContextMenu } from './components/PlaylistContextMenu';
import { FolderContextMenu } from './components/FolderContextMenu';
import { CreatePlaylistModal } from './components/CreatePlaylistModal';
import { CreateFolderModal } from './components/CreateFolderModal';
import { CreateGroupModal } from './components/CreateGroupModal';
import { RenamePlaylistModal } from './components/RenamePlaylistModal';
import { RenameItemModal } from './components/RenameItemModal';
import { ConfirmationModal } from './components/ConfirmationModal';
import { TrackDetailsModal } from './components/TrackDetailsModal';
import { LyricsModal } from './components/LyricsModal';
import { MissingTracksModal } from './components/MissingTracksModal';
import { audioEngine } from './services/audioEngine';
import { discordRpc } from './services/discordRpc';
import { parseAudioFile } from './services/tagEditor';
import { 
  DEFAULT_SEED_COLOR, 
  generateM3Palette, 
  generateCustomOrBuiltinPalette,
  applyM3ThemeToDOM, 
  extractDominantColor,
  getWindowsAccentColor,
  injectCustomThemeCss,
  applyCustomPaletteToDOM,
  applyCustomTogglesToDOM,
  clearCustomThemeClasses
} from './theme/material3';
import { CustomThemeInfo, ThemeContent } from './types/theme';
import { AppLanguage, detectSystemLanguage } from './i18n';
import { isNewerVersion, CURRENT_APP_VERSION } from './utils/version';
import { isTauri, convertFileSrc, invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { ArrowLeft, Play, Disc3, Mic2, Tag, Trash2, ListMusic } from 'lucide-react';

const INITIAL_PLAYLISTS: Playlist[] = [
  {
    id: 'pl_favorites',
    name: 'Избранное',
    description: 'Треки, отмеченные сердечком',
    trackIds: [],
    isSystem: true,
  },
];

const DEFAULT_VISIBLE_TABS: Record<MainViewType, boolean> = {
  tracks: true,
  playlists: true,
  albums: true,
  artists: true,
  favorites: true,
  genres: true,
};

interface StoredThemeCache {
  themeMode?: ThemeMode;
  colorSchemeMode?: ColorSchemeMode;
  seedColor?: string;
  secondarySeedColor?: string;
  appTheme?: string;
  language?: AppLanguage;
}

const getStoredThemeCache = (): StoredThemeCache => {
  try {
    const raw = localStorage.getItem('arachnid_theme_cache');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.appTheme === 'discord' || parsed.appTheme === 'telegram' || parsed.appTheme === 'cyberpunk') {
        parsed.appTheme = 'default';
      }
      return parsed;
    }
  } catch (_) {}
  return {};
};

const initialThemeCache = getStoredThemeCache();

export const normalizeTrackPath = (p?: string | null): string => {
  if (!p) return '';
  return p.trim().replace(/\\/g, '/').toLowerCase();
};

export const appendUniqueTracks = (existingList: Track[], incoming: Track[]): Track[] => {
  if (!incoming || incoming.length === 0) return existingList;
  const existingPaths = new Set(existingList.map(t => normalizeTrackPath(t.path)).filter(Boolean));
  const existingIds = new Set(existingList.map(t => t.id));
  const existingKeys = new Set(existingList.map(t => `${t.title.trim().toLowerCase()}|||${t.artist.trim().toLowerCase()}`));

  const toAppend: Track[] = [];
  for (const t of incoming) {
    const norm = normalizeTrackPath(t.path);
    const key = `${t.title.trim().toLowerCase()}|||${t.artist.trim().toLowerCase()}`;
    if (existingIds.has(t.id)) continue;
    if (norm && existingPaths.has(norm)) continue;
    if (key !== '|||' && key !== 'unknown|||unknown artist' && existingKeys.has(key)) continue;

    if (norm) existingPaths.add(norm);
    if (t.id) existingIds.add(t.id);
    if (key !== '|||' && key !== 'unknown|||unknown artist') existingKeys.add(key);
    toAppend.push(t);
  }
  if (toAppend.length === 0) return existingList;
  return [...existingList, ...toAppend];
};

export const App: React.FC = () => {
  // Library & Content State (No dummy stubs)
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>(INITIAL_PLAYLISTS);
  const [playlistFolders, setPlaylistFolders] = useState<PlaylistFolder[]>([]);
  const [playlistGroups, setPlaylistGroups] = useState<PlaylistGroup[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [detailNavDirection, setDetailNavDirection] = useState<'forward' | 'backward'>('forward');
  const [currentView, setCurrentView] = useState<MainViewType>('tracks');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('title');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Responsive layout state
  const [windowWidth, setWindowWidth] = useState<number>(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const isCompact = windowWidth < 780;

  // Multi-Selection State
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const lastSelectedIndexRef = useRef<number | null>(null);
  const selectedTrackIdsRef = useRef<Set<string>>(selectedTrackIds);
  useEffect(() => {
    selectedTrackIdsRef.current = selectedTrackIds;
  }, [selectedTrackIds]);
  useEffect(() => {
    lastSelectedIndexRef.current = lastSelectedIndex;
  }, [lastSelectedIndex]);

  const filteredTracksRef = useRef<Track[]>([]);

  // Player & Queue State
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const volumeRef = useRef<number>(0.85);
  const isMutedRef = useRef<boolean>(false);
  const lastNonZeroVolumeRef = useRef<number>(0.85);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('all');
  const [isShuffled, setIsShuffled] = useState<boolean>(false);
  const [queue, setQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState<number>(0);

  // Audio Fading Settings
  const [fadeMode, setFadeMode] = useState<FadeMode>('track_change_and_pause');
  const [fadeDuration, setFadeDuration] = useState<number>(2.0);

  // Theming & M3 State
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => initialThemeCache.themeMode || 'dark');
  const [colorSchemeMode, setColorSchemeMode] = useState<ColorSchemeMode>(() => initialThemeCache.colorSchemeMode || 'dynamic');
  const [seedColor, setSeedColor] = useState<string>(() => initialThemeCache.seedColor || DEFAULT_SEED_COLOR);
  const [secondarySeedColor, setSecondarySeedColor] = useState<string>(() => initialThemeCache.secondarySeedColor || '#f72585');
  const [appTheme, setAppTheme] = useState<string>(() => initialThemeCache.appTheme || 'default');
  const [customThemesList, setCustomThemesList] = useState<CustomThemeInfo[]>([]);
  const [themePaletteColors, setThemePaletteColors] = useState<Record<string, string>>(() => {
    if (initialThemeCache.appTheme?.startsWith('custom:')) {
      const tid = initialThemeCache.appTheme.replace('custom:', '');
      try {
        const raw = localStorage.getItem(`arachnid_theme_palette_${tid}`);
        return raw ? JSON.parse(raw) : {};
      } catch (_) {}
    }
    return {};
  });
  const [themeToggles, setThemeToggles] = useState<Record<string, boolean>>(() => {
    if (initialThemeCache.appTheme?.startsWith('custom:')) {
      const tid = initialThemeCache.appTheme.replace('custom:', '');
      try {
        const raw = localStorage.getItem(`arachnid_theme_toggles_${tid}`);
        return raw ? JSON.parse(raw) : {};
      } catch (_) {}
    }
    return {};
  });

  // Language & Localization (auto-detects system language on first launch)
  const [language, setLanguage] = useState<AppLanguage>(() => initialThemeCache.language || detectSystemLanguage());

  // Modals & Menus
  const [isEQOpen, setIsEQOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [hasUpdate, setHasUpdate] = useState<boolean>(false);
  const [cachedReleaseData, setCachedReleaseData] = useState<any>(null);
  const handleTrackEndedRef = useRef<() => void>(() => {});
  const [isBatchTagEditorOpen, setIsBatchTagEditorOpen] = useState<boolean>(false);
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState<boolean>(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState<boolean>(false);
  const [editingFolderTarget, setEditingFolderTarget] = useState<PlaylistFolder | null>(null);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState<boolean>(false);
  const [editingGroupTarget, setEditingGroupTarget] = useState<PlaylistGroup | null>(null);
  const [playlistCreationTarget, setPlaylistCreationTarget] = useState<{ folderId?: string | null; groupId?: string | null } | null>(null);
  const [folderCreationTarget, setFolderCreationTarget] = useState<{ parentId?: string | null; groupId?: string | null } | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<PlaylistFolder | null>(null);
  const [renameItemTarget, setRenameItemTarget] = useState<{
    isOpen: boolean;
    type: 'playlist' | 'folder' | 'group';
    item: any;
  } | null>(null);
  const [renamePlaylistTarget, setRenamePlaylistTarget] = useState<Playlist | null>(null);
  const [clearPlaylistTarget, setClearPlaylistTarget] = useState<Playlist | null>(null);
  const [deletePlaylistTarget, setDeletePlaylistTarget] = useState<Playlist | null>(null);
  const [deleteTracksTarget, setDeleteTracksTarget] = useState<string[] | null>(null);
  const [deleteFromDiskTarget, setDeleteFromDiskTarget] = useState<string[] | null>(null);
  const [trackDetailsTarget, setTrackDetailsTarget] = useState<Track | null>(null);
  const [isLyricsOpen, setIsLyricsOpen] = useState<boolean>(false);
  const [isQueueOpen, setIsQueueOpen] = useState<boolean>(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; track: Track } | null>(null);
  const [playlistContextMenu, setPlaylistContextMenu] = useState<{ x: number; y: number; playlist: Playlist } | null>(null);
  const [folderContextMenu, setFolderContextMenu] = useState<{ x: number; y: number; folder: PlaylistFolder } | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const [discordEnabled, setDiscordEnabled] = useState<boolean>(true);
  const [showDiscordButton, setShowDiscordButton] = useState<boolean>(true);
  const [discordShowPlayIcon, setDiscordShowPlayIcon] = useState<boolean>(true);
  const [discordShowPauseIcon, setDiscordShowPauseIcon] = useState<boolean>(true);
  const [discordStatusMode, setDiscordStatusMode] = useState<'listening' | 'listening_app'>('listening_app');
  const [discordCustomClientId, setDiscordCustomClientId] = useState<string>('');
  const [visibleTabs, setVisibleTabs] = useState<Record<MainViewType, boolean>>(DEFAULT_VISIBLE_TABS);
  const [watchedFolders, setWatchedFolders] = useState<string[]>([]);
  const [autoScanOnStartup, setAutoScanOnStartup] = useState<boolean>(true);
  const [isMissingTracksModalOpen, setIsMissingTracksModalOpen] = useState<boolean>(false);
  const [missingTracksForModal, setMissingTracksForModal] = useState<Track[]>([]);
  const hasCheckedMissingOnStartupRef = useRef<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef<number>(0);
  const isLoadedRef = useRef<boolean>(false);
  const selectedPlaylistIdRef = useRef<string | null>(null);
  const tracksRef = useRef<Track[]>(tracks);
  const currentTrackRef = useRef<Track | null>(currentTrack);
  const languageRef = useRef<AppLanguage>(language);
  const discordEnabledRef = useRef<boolean>(discordEnabled);
  const discordShowPlayIconRef = useRef<boolean>(discordShowPlayIcon);
  const discordShowPauseIconRef = useRef<boolean>(discordShowPauseIcon);
  const discordStatusModeRef = useRef<'listening' | 'listening_app'>(discordStatusMode);
  const discordCustomClientIdRef = useRef<string>(discordCustomClientId);
  const lastDiscordTrackIdRef = useRef<string | null>(null);
  const lastPrevPressRef = useRef<number>(0);
  const lastTabSwitchTimeRef = useRef<number>(0);
  const pendingSeekTimeRef = useRef<number | null>(null);
  const seekDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasPlayingBeforeArrowRef = useRef<boolean>(false);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    discordEnabledRef.current = discordEnabled;
    discordShowPlayIconRef.current = discordShowPlayIcon;
    discordShowPauseIconRef.current = discordShowPauseIcon;
    discordStatusModeRef.current = discordStatusMode;
    discordCustomClientIdRef.current = discordCustomClientId;
  }, [discordEnabled, discordShowPlayIcon, discordShowPauseIcon, discordStatusMode, discordCustomClientId]);

  useEffect(() => {
    selectedPlaylistIdRef.current = selectedPlaylistId;
  }, [selectedPlaylistId]);

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  // If active track is cleared or stopped, close lyrics modal so it doesn't pop up on next track
  useEffect(() => {
    if (!currentTrack && isLyricsOpen) {
      setIsLyricsOpen(false);
    }
  }, [currentTrack, isLyricsOpen]);

  const verifyTracksExistence = useCallback(async (tracksToCheck: Track[], isInitialStartup = false) => {
    if (!isTauri() || tracksToCheck.length === 0) return;
    const paths = tracksToCheck.map(t => t.path).filter((p): p is string => Boolean(p));
    if (paths.length === 0) return;
    try {
      const results = await invoke<Record<string, boolean>>('batch_check_files_exist', { paths });
      const missingList: Track[] = [];

      for (const t of tracksToCheck) {
        if (t.path && results[t.path] === false) {
          missingList.push({ ...t, isMissing: true });
        }
      }

      setTracks(prev => {
        let changed = false;
        const updated = prev.map(t => {
          if (t.path && results[t.path] !== undefined) {
            const missing = !results[t.path];
            if (t.isMissing !== missing) {
              changed = true;
              return { ...t, isMissing: missing };
            }
          }
          return t;
        });
        return changed ? updated : prev;
      });

      if (missingList.length > 0) {
        setMissingTracksForModal(missingList);
      }

      if (isInitialStartup && missingList.length > 0 && !hasCheckedMissingOnStartupRef.current) {
        hasCheckedMissingOnStartupRef.current = true;
        setMissingTracksForModal(missingList);
        setIsMissingTracksModalOpen(true);
      }
    } catch (e) {
      console.warn('Failed to verify tracks existence:', e);
    }
  }, []);

  // Load Portable Data on Startup (strictly from arachnid_data.json next to exe in Tauri)
  useEffect(() => {
    const loadData = async () => {
      try {
        let rawJson: string | null = null;
        if (isTauri()) {
          const res = await invoke<string | null>('load_portable_data');
          if (res) rawJson = res;
        } else {
          rawJson = localStorage.getItem('arachnid_portable_data');
        }

        if (rawJson) {
          const parsed = JSON.parse(rawJson);
          const validIdMap = new Map<string, string>();
          if (parsed.tracks && Array.isArray(parsed.tracks)) {
            // Deduplicate tracks from stored cache and build remapping
            const seenPaths = new Map<string, string>();
            const seenKeys = new Map<string, string>();
            const seenIds = new Set<string>();
            const cleanTracks: Track[] = [];

            for (const t of parsed.tracks) {
              const normPath = normalizeTrackPath(t.path);
              const key = `${(t.title || '').trim().toLowerCase()}|||${(t.artist || '').trim().toLowerCase()}`;

              if (normPath && seenPaths.has(normPath)) {
                validIdMap.set(t.id, seenPaths.get(normPath)!);
                continue;
              }
              if (key !== '|||' && key !== 'unknown|||unknown artist' && seenKeys.has(key)) {
                validIdMap.set(t.id, seenKeys.get(key)!);
                continue;
              }
              if (seenIds.has(t.id)) {
                continue;
              }

              if (normPath) seenPaths.set(normPath, t.id);
              if (key !== '|||' && key !== 'unknown|||unknown artist') seenKeys.set(key, t.id);
              seenIds.add(t.id);
              cleanTracks.push(t);
            }

            // Re-convert native paths and cover paths to fresh asset URLs
            const hydrated = cleanTracks.map((t: Track) => {
              let coverArt = t.coverArt;
              if (coverArt && !coverArt.startsWith('http') && !coverArt.startsWith('data:') && isTauri()) {
                coverArt = convertFileSrc(coverArt);
              }
              return {
                ...t,
                src: t.path && isTauri() ? convertFileSrc(t.path) : t.src,
                coverArt,
              };
            });
            setTracks(hydrated);
            tracksRef.current = hydrated;
            verifyTracksExistence(hydrated, true);

            // Auto-scan portable music/ folder and watchedFolders on startup if enabled
            if (isTauri() && parsed.autoScanOnStartup !== false) {
              setTimeout(async () => {
                try {
                  const portableMusicPath = await invoke<string>('get_portable_music_path');
                  const foldersToScan = [portableMusicPath, ...(parsed.watchedFolders || [])];
                  const raw = await invoke<any[]>('read_audio_files', { paths: foldersToScan });
                  if (raw && raw.length > 0) {
                    const currentTrackMap = new Map(tracksRef.current.map(t => [normalizeTrackPath(t.path), t]));
                    const currentPaths = new Set(tracksRef.current.map(t => normalizeTrackPath(t.path)).filter(Boolean));
                    const currentKeys = new Set(tracksRef.current.map(t => `${t.title.trim().toLowerCase()}|||${t.artist.trim().toLowerCase()}`));
                    const newFound: Track[] = [];
                    const updatedCoversMap = new Map<string, string>();

                    for (const m of raw) {
                      const normPath = normalizeTrackPath(m.path);
                      let coverArt = m.cover_art || undefined;
                      if (coverArt && !coverArt.startsWith('http') && !coverArt.startsWith('data:') && isTauri()) {
                        coverArt = convertFileSrc(coverArt);
                      }

                      const existingTrack = normPath ? currentTrackMap.get(normPath) : undefined;
                      if (existingTrack) {
                        if (!existingTrack.coverArt && coverArt) {
                          updatedCoversMap.set(existingTrack.id, coverArt);
                        }
                        continue;
                      }

                      const key = `${(m.title || '').trim().toLowerCase()}|||${(m.artist || '').trim().toLowerCase()}`;
                      if (key !== '|||' && key !== 'unknown|||unknown artist' && currentKeys.has(key)) {
                        continue;
                      }
                      if (normPath) currentPaths.add(normPath);
                      if (key !== '|||' && key !== 'unknown|||unknown artist') currentKeys.add(key);

                      const newT: Track = {
                        id: m.id || `track_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                        path: m.path,
                        title: m.title || 'Unknown',
                        artist: m.artist || 'Unknown Artist',
                        album: m.album || 'Unknown Album',
                        duration: m.duration_seconds || 0,
                        src: convertFileSrc(m.path),
                        coverArt,
                        genre: m.genre || undefined,
                        year: m.year || undefined,
                        trackNumber: m.track_number || undefined,
                        dateAdded: Date.now(),
                        playCount: 0,
                        isFavorite: false,
                      };
                      newFound.push(newT);
                    }
                    if (updatedCoversMap.size > 0 || newFound.length > 0) {
                      setTracks(prev => {
                        let updated = prev;
                        if (updatedCoversMap.size > 0) {
                          updated = updated.map(t => {
                            const newCover = updatedCoversMap.get(t.id);
                            return newCover ? { ...t, coverArt: newCover } : t;
                          });
                        }
                        if (newFound.length > 0) {
                          updated = appendUniqueTracks(updated, newFound);
                        }
                        return updated;
                      });
                    }
                  }
                } catch (e) {
                  console.warn('Startup library scan error:', e);
                }
              }, 600);
            }

            // Auto-refresh metadata in background only for tracks missing essential tags (Unknown title/artist or missing cover)
            if (isTauri()) {
              const pathsToRefresh = hydrated
                .filter(t => t.path && (!t.coverArt || t.title === 'Unknown' || t.artist === 'Unknown Artist'))
                .slice(0, 500)
                .map(t => t.path as string);
              if (pathsToRefresh.length > 0) {
                invoke<any[]>('read_audio_files', { paths: pathsToRefresh }).then(refreshed => {
                  if (refreshed && refreshed.length > 0) {
                    const refreshedMap = new Map<string, any>(refreshed.map(r => [normalizeTrackPath(r.path), r]));
                    setTracks(prev => prev.map(t => {
                      if (!t.path) return t;
                      const r = refreshedMap.get(normalizeTrackPath(t.path));
                      if (!r) return t;
                      let refreshedCover = r.cover_art;
                      if (refreshedCover && !refreshedCover.startsWith('http') && !refreshedCover.startsWith('data:') && isTauri()) {
                        refreshedCover = convertFileSrc(refreshedCover);
                      }
                      return {
                        ...t,
                        title: t.title === 'Unknown' || !t.title ? r.title : t.title,
                        artist: t.artist === 'Unknown Artist' || !t.artist ? r.artist : t.artist,
                        album: t.album === 'Unknown Album' || !t.album ? r.album : t.album,
                        coverArt: t.coverArt || refreshedCover || undefined,
                        lyrics: t.lyrics || r.lyrics || undefined,
                        genre: t.genre || r.genre || undefined,
                        year: t.year || r.year || undefined,
                        trackNumber: t.trackNumber || r.track_number || undefined,
                      };
                    }));
                  }
                }).catch(err => console.warn('Background tag refresh error:', err));
              }
            }
          }
          if (parsed.playlists && Array.isArray(parsed.playlists) && parsed.playlists.length > 0) {
            setPlaylists(parsed.playlists.map((p: Playlist) => {
              let coverArt = p.coverArt;
              if (coverArt && !coverArt.startsWith('http') && !coverArt.startsWith('data:') && isTauri()) {
                coverArt = convertFileSrc(coverArt);
              }
              const remapped = (p.trackIds || []).map(id => validIdMap.get(id) || id);
              const uniqueTrackIds = Array.from(new Set(remapped));
              if (p.id === 'pl_favorites') {
                return { ...p, name: 'Избранное', coverArt, trackIds: uniqueTrackIds };
              }
              return { ...p, coverArt, trackIds: uniqueTrackIds };
            }));
          }
          if (parsed.playlistFolders && Array.isArray(parsed.playlistFolders)) {
            setPlaylistFolders(parsed.playlistFolders);
          }
          if (parsed.playlistGroups && Array.isArray(parsed.playlistGroups)) {
            setPlaylistGroups(parsed.playlistGroups);
          }
          if (parsed.themeMode) setThemeMode(parsed.themeMode);
          if (parsed.seedColor) setSeedColor(parsed.seedColor);
          if (parsed.secondarySeedColor) setSecondarySeedColor(parsed.secondarySeedColor);
          if (parsed.appTheme) setAppTheme(parsed.appTheme);
          if (parsed.language) {
            setLanguage(parsed.language);
          } else {
            setLanguage(detectSystemLanguage());
          }
          if (typeof parsed.discordEnabled === 'boolean') setDiscordEnabled(parsed.discordEnabled);
          if (typeof parsed.showDiscordButton === 'boolean') setShowDiscordButton(parsed.showDiscordButton);
          if (typeof parsed.discordShowPlayIcon === 'boolean') setDiscordShowPlayIcon(parsed.discordShowPlayIcon);
          if (typeof parsed.discordShowPauseIcon === 'boolean') setDiscordShowPauseIcon(parsed.discordShowPauseIcon);
          if (parsed.discordStatusMode === 'listening' || parsed.discordStatusMode === 'listening_app') {
            setDiscordStatusMode(parsed.discordStatusMode);
          }
          if (typeof parsed.discordCustomClientId === 'string') setDiscordCustomClientId(parsed.discordCustomClientId);
          if (parsed.visibleTabs && typeof parsed.visibleTabs === 'object') {
            setVisibleTabs({ ...DEFAULT_VISIBLE_TABS, ...parsed.visibleTabs });
          }
          if (parsed.colorSchemeMode) {
            setColorSchemeMode(parsed.colorSchemeMode);
          } else if (typeof parsed.isDynamicColor === 'boolean') {
            setColorSchemeMode(parsed.isDynamicColor ? 'dynamic' : 'custom');
          }
          if (parsed.fadeMode) setFadeMode(parsed.fadeMode);
          if (typeof parsed.fadeDuration === 'number') setFadeDuration(parsed.fadeDuration);
          if (Array.isArray(parsed.watchedFolders)) setWatchedFolders(parsed.watchedFolders);
          if (typeof parsed.autoScanOnStartup === 'boolean') setAutoScanOnStartup(parsed.autoScanOnStartup);
        }
      } catch (err) {
        console.warn('Could not load portable data:', err);
      } finally {
        isLoadedRef.current = true;
      }
    };

    loadData();
  }, []);

  // Save Portable Data whenever library, playlists, or settings change
  useEffect(() => {
    if (!isLoadedRef.current) return;

    const dataToSave = {
      tracks,
      playlists,
      playlistFolders,
      playlistGroups,
      themeMode,
      seedColor,
      secondarySeedColor,
      appTheme,
      language,
      discordEnabled,
      showDiscordButton,
      discordShowPlayIcon,
      discordShowPauseIcon,
      discordStatusMode,
      discordCustomClientId,
      visibleTabs,
      colorSchemeMode,
      isDynamicColor: colorSchemeMode === 'dynamic',
      fadeMode,
      fadeDuration,
      watchedFolders,
      autoScanOnStartup,
    };

    const jsonString = JSON.stringify(dataToSave);

    try {
      localStorage.setItem('arachnid_theme_cache', JSON.stringify({
        themeMode,
        seedColor,
        secondarySeedColor,
        appTheme,
        language,
        colorSchemeMode,
      }));
    } catch (_) {}

    if (isTauri()) {
      invoke('save_portable_data', { data: jsonString }).catch((e) => {
        console.warn('Failed to save to portable folder:', e);
      });
    } else {
      localStorage.setItem('arachnid_portable_data', jsonString);
    }
  }, [tracks, playlists, playlistFolders, playlistGroups, themeMode, seedColor, secondarySeedColor, appTheme, language, discordEnabled, showDiscordButton, discordShowPlayIcon, discordShowPauseIcon, discordStatusMode, discordCustomClientId, visibleTabs, colorSchemeMode, fadeMode, fadeDuration, watchedFolders, autoScanOnStartup]);

  // Safety fallback: reveal window in case TitleBar unmounted or delayed
  useEffect(() => {
    if (isTauri()) {
      const timer = setTimeout(async () => {
        try {
          const win = getCurrentWebviewWindow();
          await win.show();
          await win.setFocus();
        } catch (_) {
          try {
            await invoke('show_window');
          } catch (_) {}
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, []);

  // Automated background memory optimization (trims cold working set pages in Windows)
  useEffect(() => {
    if (!isTauri()) return;
    const interval = setInterval(() => {
      invoke('trim_memory').catch(() => {});
    }, 60000);
    const handleBlur = () => {
      invoke('trim_memory').catch(() => {});
    };
    window.addEventListener('blur', handleBlur);
    return () => {
      clearInterval(interval);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Prevent default browser right-click menu
  useEffect(() => {
    const handleGlobalContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
        e.preventDefault();
      }
    };
    window.addEventListener('contextmenu', handleGlobalContextMenu);
    return () => window.removeEventListener('contextmenu', handleGlobalContextMenu);
  }, []);

  // Audio Engine callbacks (initialized once on mount)
  useEffect(() => {
    audioEngine.setCallbacks({
      onTimeUpdate: (time) => {
        if (!isNaN(time) && isFinite(time) && time >= 0) {
          setCurrentTime(time);
        }
      },
      onDuration: (dur) => {
        if (!isNaN(dur) && isFinite(dur) && dur > 0) {
          setDuration(dur);
        }
      },
      onEnded: () => handleTrackEndedRef.current(),
      onPlay: () => {
        setIsPlaying(true);
        const cur = currentTrackRef.current;
        if (discordEnabledRef.current && cur) {
          discordRpc.updatePresence({
            enabled: true,
            trackName: cur.title,
            artist: cur.artist,
            album: cur.album,
            duration: cur.duration || audioEngine.getDuration() || 0,
            currentTime: audioEngine.getCurrentTime() || 0,
            isPlaying: true,
            coverArt: cur.coverArt,
            showPlayIcon: discordShowPlayIconRef.current,
            showPauseIcon: discordShowPauseIconRef.current,
            statusMode: discordStatusModeRef.current,
            customClientId: discordCustomClientIdRef.current,
            language: languageRef.current,
          });
        }
      },
      onPause: () => {
        setIsPlaying(false);
        const cur = currentTrackRef.current;
        if (discordEnabledRef.current && cur) {
          discordRpc.updatePresence({
            enabled: true,
            trackName: cur.title,
            artist: cur.artist,
            album: cur.album,
            duration: cur.duration || audioEngine.getDuration() || 0,
            currentTime: audioEngine.getCurrentTime() || 0,
            isPlaying: false,
            coverArt: cur.coverArt,
            showPlayIcon: discordShowPlayIconRef.current,
            showPauseIcon: discordShowPauseIconRef.current,
            statusMode: discordStatusModeRef.current,
            customClientId: discordCustomClientIdRef.current,
            language: languageRef.current,
          });
        }
      },
      onLoopRepeat: () => {
        const cur = currentTrackRef.current;
        if (discordEnabledRef.current && cur) {
          discordRpc.updatePresence({
            enabled: true,
            trackName: cur.title,
            artist: cur.artist,
            album: cur.album,
            duration: cur.duration || audioEngine.getDuration() || 0,
            currentTime: 0,
            isPlaying: true,
            coverArt: cur.coverArt,
            showPlayIcon: discordShowPlayIconRef.current,
            showPauseIcon: discordShowPauseIconRef.current,
            statusMode: discordStatusModeRef.current,
            customClientId: discordCustomClientIdRef.current,
            language: languageRef.current,
          });
        }
      },
      onError: async (err) => {
        console.warn('AudioEngine playback error:', err);
        const cur = currentTrackRef.current;
        if (cur?.path && isTauri()) {
          try {
            const exists = await invoke<boolean>('check_file_exists', { path: cur.path });
            if (!exists) {
              setTracks(prev => prev.map(t => t.id === cur.id ? { ...t, isMissing: true } : t));
              setCurrentTrack(prev => prev && prev.id === cur.id ? { ...prev, isMissing: true } : prev);
            }
          } catch (_) {}
        }
      },
    });
  }, []);

  // Sync Audio Engine Volume only when volume actually changes
  useEffect(() => {
    audioEngine.setVolume(volume);
  }, [volume]);

  // Sync Audio Engine Fade Configuration
  useEffect(() => {
    audioEngine.setFadeConfig(fadeMode, fadeDuration);
  }, [fadeMode, fadeDuration]);

  // Sync Audio Engine Repeat Mode
  useEffect(() => {
    audioEngine.setRepeatMode(repeatMode);
  }, [repeatMode]);

  // Periodically verify tracks existence in background (not freezing UI on every tab change)
  useEffect(() => {
    if (tracksRef.current.length > 0) {
      verifyTracksExistence(tracksRef.current);
    }
    const timer = setInterval(() => {
      if (tracksRef.current.length > 0) {
        verifyTracksExistence(tracksRef.current);
      }
    }, 300000); // 5 minutes
    return () => clearInterval(timer);
  }, [verifyTracksExistence]);

  const refreshCustomThemes = async () => {
    if (isTauri()) {
      try {
        const list = await invoke<CustomThemeInfo[]>('list_custom_themes');
        setCustomThemesList(list || []);
        return list;
      } catch (e) {
        console.warn('Failed to load custom themes:', e);
      }
    }
    return [];
  };

  useEffect(() => {
    refreshCustomThemes();
  }, []);

  // Sync palette and toggles state when active custom theme changes
  useEffect(() => {
    if (appTheme.startsWith('custom:')) {
      const themeId = appTheme.replace('custom:', '');
      try {
        const rawPalette = localStorage.getItem(`arachnid_theme_palette_${themeId}`);
        setThemePaletteColors(rawPalette ? JSON.parse(rawPalette) : {});
      } catch (_) {
        setThemePaletteColors({});
      }
      try {
        const rawToggles = localStorage.getItem(`arachnid_theme_toggles_${themeId}`);
        setThemeToggles(rawToggles ? JSON.parse(rawToggles) : {});
      } catch (_) {
        setThemeToggles({});
      }
    }
  }, [appTheme]);

  const handleUpdateThemePaletteColor = (itemId: string, hex: string) => {
    if (!appTheme.startsWith('custom:')) return;
    const themeId = appTheme.replace('custom:', '');
    const updated = { ...themePaletteColors, [itemId]: hex };
    setThemePaletteColors(updated);
    localStorage.setItem(`arachnid_theme_palette_${themeId}`, JSON.stringify(updated));

    const activeTheme = customThemesList.find(t => t.id === themeId || t.css_filename === themeId);
    if (activeTheme?.palette) {
      applyCustomPaletteToDOM(activeTheme.palette, updated);
    }
  };

  const handleResetThemePalette = () => {
    if (!appTheme.startsWith('custom:')) return;
    const themeId = appTheme.replace('custom:', '');
    const activeTheme = customThemesList.find(t => t.id === themeId || t.css_filename === themeId);
    const resetColors: Record<string, string> = {};
    if (activeTheme?.palette) {
      for (const item of activeTheme.palette) {
        resetColors[item.id] = item.default;
      }
    }
    setThemePaletteColors(resetColors);
    localStorage.setItem(`arachnid_theme_palette_${themeId}`, JSON.stringify(resetColors));
    if (activeTheme?.palette) {
      applyCustomPaletteToDOM(activeTheme.palette, resetColors);
    }
  };

  const handleToggleThemeOption = (toggleId: string, val: boolean) => {
    if (!appTheme.startsWith('custom:')) return;
    const themeId = appTheme.replace('custom:', '');
    const updated = { ...themeToggles, [toggleId]: val };
    setThemeToggles(updated);
    localStorage.setItem(`arachnid_theme_toggles_${themeId}`, JSON.stringify(updated));

    const activeTheme = customThemesList.find(t => t.id === themeId || t.css_filename === themeId);
    if (activeTheme?.toggles) {
      applyCustomTogglesToDOM(activeTheme.toggles, updated);
    }
  };

  const handleDeleteCustomTheme = async (themeId: string) => {
    if (themeId === 'default') return;
    if (isTauri()) {
      try {
        await invoke('delete_custom_theme', { themeId });
        if (appTheme === `custom:${themeId}` || appTheme === `custom:folder:${themeId}` || appTheme === `custom:file:${themeId}`) {
          setAppTheme('default');
          injectCustomThemeCss(null);
        }
        await refreshCustomThemes();
      } catch (e) {
        console.warn('Failed to delete custom theme:', e);
      }
    }
  };

  // Dynamic M3 & Custom CSS Theme Palette
  useEffect(() => {
    const updateTheme = async () => {
      // Handle custom CSS themes loaded from themes/ folder
      if (appTheme.startsWith('custom:')) {
        const themeId = appTheme.replace('custom:', '');
        if (isTauri()) {
          try {
            const content = await invoke<ThemeContent>('read_custom_theme', { themeId });
            if (content && content.css) {
              let finalCss = content.css;
              if (content.base_path) {
                finalCss = finalCss.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (match, quote, urlPath) => {
                  const clean = urlPath.trim();
                  if (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('data:') || clean.startsWith('blob:') || clean.startsWith('#') || clean.startsWith('asset:')) {
                    return match;
                  }
                  const fullPath = `${content.base_path}/${clean.replace(/^\.?\//, '')}`;
                  return `url("${convertFileSrc(fullPath)}")`;
                });
              }
              injectCustomThemeCss(finalCss);
            }
          } catch (e) {
            console.warn('Failed to load custom theme CSS, falling back to default:', e);
            injectCustomThemeCss(null);
          }
        }

        // Apply custom theme palette and toggles if defined
        const activeTheme = customThemesList.find(t => t.id === themeId || t.css_filename === themeId);
        if (activeTheme?.palette && activeTheme.palette.length > 0) {
          applyCustomPaletteToDOM(activeTheme.palette, themePaletteColors);
        }
        if (activeTheme?.toggles && activeTheme.toggles.length > 0) {
          applyCustomTogglesToDOM(activeTheme.toggles, themeToggles);
        }
      } else {
        injectCustomThemeCss(null);

        // Clear any custom toggle classes
        const allKnownClasses = customThemesList.flatMap(t => (t.toggles || []).map(tg => tg.cssClass || '')).filter(Boolean);
        clearCustomThemeClasses(allKnownClasses);

        let activeColor = DEFAULT_SEED_COLOR;
        if (colorSchemeMode === 'dynamic') {
          if (currentTrack?.coverArt) {
            activeColor = await extractDominantColor(currentTrack.coverArt);
          } else {
            activeColor = await getWindowsAccentColor();
          }
        } else if (colorSchemeMode === 'system') {
          activeColor = await getWindowsAccentColor();
        } else if (colorSchemeMode === 'custom') {
          activeColor = seedColor;
        }

        const palette = generateCustomOrBuiltinPalette(appTheme, activeColor, secondarySeedColor, themeMode);
        applyM3ThemeToDOM(palette, themeMode);
      }
    };

    updateTheme();
  }, [currentTrack?.coverArt, colorSchemeMode, seedColor, secondarySeedColor, appTheme, themeMode, themePaletteColors, themeToggles, customThemesList]);

  // Discord Rich Presence update (triggers on track changes, play/pause, seek, or setting updates)
  useEffect(() => {
    if (currentTrack) {
      const isNewTrack = lastDiscordTrackIdRef.current !== currentTrack.id;
      lastDiscordTrackIdRef.current = currentTrack.id;
      const curTime = isNewTrack ? 0 : (audioEngine.getCurrentTime() || 0);

      discordRpc.updatePresence({
        enabled: discordEnabled,
        trackName: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.album,
        duration: currentTrack.duration || audioEngine.getDuration() || 0,
        currentTime: curTime,
        isPlaying: isPlaying,
        coverArt: currentTrack.coverArt,
        showPlayIcon: discordShowPlayIcon,
        showPauseIcon: discordShowPauseIcon,
        statusMode: discordStatusMode,
        customClientId: discordCustomClientId,
        language: language,
      });
    } else {
      lastDiscordTrackIdRef.current = null;
      discordRpc.updatePresence({
        enabled: false,
        trackName: '',
        artist: '',
        album: '',
        duration: 0,
        currentTime: 0,
        isPlaying: false,
        showPlayIcon: discordShowPlayIcon,
        showPauseIcon: discordShowPauseIcon,
        statusMode: discordStatusMode,
        customClientId: discordCustomClientId,
        language: language,
      });
    }
  }, [
    currentTrack?.id,
    currentTrack?.title,
    currentTrack?.artist,
    currentTrack?.album,
    isPlaying,
    discordEnabled,
    discordShowPlayIcon,
    discordShowPauseIcon,
    discordStatusMode,
    discordCustomClientId,
    language,
  ]);

  // Auto-update checker preferences
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('arachnid_auto_update_enabled');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [autoUpdateInterval, setAutoUpdateInterval] = useState<'startup' | '30m' | '1h'>(() => {
    try {
      const saved = localStorage.getItem('arachnid_auto_update_interval');
      if (saved === 'startup' || saved === '30m' || saved === '1h') return saved;
      return '1h';
    } catch {
      return '1h';
    }
  });

  const handleSetAutoUpdateEnabled = (enabled: boolean) => {
    setAutoUpdateEnabled(enabled);
    try {
      localStorage.setItem('arachnid_auto_update_enabled', String(enabled));
    } catch {}
  };

  const handleSetAutoUpdateInterval = (interval: 'startup' | '30m' | '1h') => {
    setAutoUpdateInterval(interval);
    try {
      localStorage.setItem('arachnid_auto_update_interval', interval);
    } catch {}
  };

  // Check for updates (startup & periodic based on user settings)
  useEffect(() => {
    if (!autoUpdateEnabled) return;

    const checkUpdates = async () => {
      try {
        const res = await fetch('https://api.github.com/repos/sssHpion007/ArachnidMP/releases/latest');
        if (res.ok) {
          const data = await res.json();
          const latestTag = data.tag_name || '';
          let currentVer = CURRENT_APP_VERSION;
          if (isTauri()) {
            try {
              const v = await invoke<string>('get_app_version');
              if (v) currentVer = v;
            } catch (_) {}
          }
          if (isNewerVersion(currentVer, latestTag)) {
            setHasUpdate(true);
            setCachedReleaseData(data);
          }
        }
      } catch (_) {}
    };

    const timer = setTimeout(checkUpdates, 2000);

    let intervalId: any = null;
    if (autoUpdateInterval === '30m') {
      intervalId = setInterval(checkUpdates, 30 * 60 * 1000);
    } else if (autoUpdateInterval === '1h') {
      intervalId = setInterval(checkUpdates, 60 * 60 * 1000);
    }

    return () => {
      clearTimeout(timer);
      if (intervalId) clearInterval(intervalId);
    };
  }, [autoUpdateEnabled, autoUpdateInterval]);

  // Native Tauri Desktop Drag-and-Drop
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    if (isTauri()) {
      try {
        const appWindow = getCurrentWebviewWindow();
        appWindow.onDragDropEvent((event) => {
          if ((window as any).__isInternalDragging) {
            setIsDraggingFile(false);
            return;
          }
          if (event.payload.type === 'over' || event.payload.type === 'enter') {
            setIsDraggingFile(true);
          } else if (event.payload.type === 'drop') {
            setIsDraggingFile(false);
            const paths = event.payload.paths;
            if (paths && paths.length > 0) {
              importTauriPaths(paths);
            }
          } else if (event.payload.type === 'leave') {
            setIsDraggingFile(false);
          }
        }).then((fn) => {
          unlisten = fn;
        });
      } catch (err) {
        console.warn('Tauri onDragDropEvent registration error:', err);
      }
    }

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Web Browser Drag and Drop fallback
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      if ((window as any).__isInternalDragging) {
        setIsDraggingFile(false);
        return;
      }
      dragCounterRef.current++;
      if (e.dataTransfer?.types && Array.from(e.dataTransfer.types).includes('Files')) {
        setIsDraggingFile(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      if ((window as any).__isInternalDragging) {
        setIsDraggingFile(false);
        dragCounterRef.current = 0;
        return;
      }
      dragCounterRef.current--;
      if (dragCounterRef.current <= 0) {
        setIsDraggingFile(false);
        dragCounterRef.current = 0;
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if ((window as any).__isInternalDragging) {
        setIsDraggingFile(false);
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'move';
        }
        return;
      }
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDrop = async (e: DragEvent) => {
      if ((window as any).__isInternalDragging) {
        setIsDraggingFile(false);
        dragCounterRef.current = 0;
        return;
      }
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDraggingFile(false);

      // In Tauri desktop, native onDragDropEvent already handles external file drops.
      // Running both causes duplicate processing, 2x track copies, and system stutter.
      if (isTauri()) {
        return;
      }

      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const droppedFiles = Array.from(e.dataTransfer.files);
        await importFiles(droppedFiles);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [tracks, queue]);

  // Set of group IDs that are configured as isolated containers
  const isolatedGroupIds = useMemo(() => {
    return new Set(playlistGroups.filter(g => g.isIsolated).map(g => g.id));
  }, [playlistGroups]);

  // Set of folder IDs that reside inside isolated groups (direct or nested)
  const isolatedFolderIds = useMemo(() => {
    if (isolatedGroupIds.size === 0) return new Set<string>();
    const set = new Set<string>();
    playlistFolders.forEach(f => {
      if (f.groupId && isolatedGroupIds.has(f.groupId)) {
        set.add(f.id);
      }
    });
    let changed = true;
    while (changed) {
      changed = false;
      playlistFolders.forEach(f => {
        if (!set.has(f.id) && f.parentId && set.has(f.parentId)) {
          set.add(f.id);
          changed = true;
        }
      });
    }
    return set;
  }, [playlistGroups, playlistFolders, isolatedGroupIds]);

  // Set of playlist IDs belonging to isolated groups
  const isolatedPlaylistIds = useMemo(() => {
    if (isolatedGroupIds.size === 0) return new Set<string>();
    const set = new Set<string>();
    playlists.forEach(p => {
      if (p.groupId && isolatedGroupIds.has(p.groupId)) {
        set.add(p.id);
      } else if (p.folderId && isolatedFolderIds.has(p.folderId)) {
        set.add(p.id);
      }
    });
    return set;
  }, [playlists, isolatedGroupIds, isolatedFolderIds]);

  // Track IDs that belong to isolated playlists
  const isolatedTrackIds = useMemo(() => {
    if (isolatedPlaylistIds.size === 0) return new Set<string>();
    const set = new Set<string>();
    playlists.forEach(p => {
      if (isolatedPlaylistIds.has(p.id)) {
        p.trackIds.forEach(id => set.add(id));
      }
    });
    return set;
  }, [playlists, isolatedPlaylistIds]);

  // Non-isolated tracks (for 'Все треки', 'Альбомы', 'Исполнители', 'Жанры')
  const nonIsolatedTracks = useMemo(() => {
    if (isolatedTrackIds.size === 0) return tracks;
    return tracks.filter(t => !isolatedTrackIds.has(t.id));
  }, [tracks, isolatedTrackIds]);

  // Filtered and Sorted Tracks
  const filteredTracks = useMemo(() => {
    let result = [...tracks];

    if (selectedPlaylistId) {
      const pl = playlists.find(p => p.id === selectedPlaylistId);
      if (pl) {
        const trackMap = new Map(tracks.map(t => [t.id, t]));
        result = pl.trackIds.map(id => trackMap.get(id)).filter((t): t is Track => Boolean(t));
      }
    } else {
      // For any view that is not a specific playlist (All Tracks, Albums, Artists, Genres):
      // Filter out isolated tracks!
      if (isolatedTrackIds.size > 0) {
        result = result.filter(t => !isolatedTrackIds.has(t.id));
      }

      if (selectedAlbum) {
        result = result.filter(t => (t.album ? t.album.trim() : 'Без альбома') === selectedAlbum);
      } else if (selectedArtist) {
        result = result.filter(t => (t.artist ? t.artist.trim() : 'Неизвестный исполнитель') === selectedArtist);
      } else if (selectedGenre) {
        result = result.filter(t => {
          if (!t.genre) return selectedGenre === 'Без жанра';
          const list = t.genre.split(/[,/;\\]+/).map(g => g.trim()).filter(Boolean);
          return list.length > 0 ? list.includes(selectedGenre) : selectedGenre === 'Без жанра';
        });
      } else if (currentView === 'favorites') {
        const plFav = playlists.find(p => p.id === 'pl_favorites');
        const trackMap = new Map(result.map(t => [t.id, t]));
        if (plFav && plFav.trackIds.length > 0) {
          const ordered = plFav.trackIds.map(id => trackMap.get(id)).filter((t): t is Track => Boolean(t && t.isFavorite));
          const orderedSet = new Set(ordered.map(t => t.id));
          const remaining = result.filter(t => t.isFavorite && !orderedSet.has(t.id));
          result = [...ordered, ...remaining];
        } else {
          result = result.filter(t => t.isFavorite);
        }
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q) ||
        (t.genre && t.genre.toLowerCase().includes(q))
      );
    }

    if (sortBy === 'custom') {
      if (sortOrder === 'desc') {
        result.reverse();
      }
    } else if (sortBy && sortBy !== 'index') {
      const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
      result.sort((a, b) => {
        let valA: any = a[sortBy as keyof Track] || '';
        let valB: any = b[sortBy as keyof Track] || '';
        if (typeof valA === 'string' && typeof valB === 'string') {
          const cmp = collator.compare(valA, valB);
          return sortOrder === 'asc' ? cmp : -cmp;
        }
        return sortOrder === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
      });
    }

    return result;
  }, [tracks, selectedPlaylistId, selectedAlbum, selectedArtist, selectedGenre, currentView, searchQuery, sortBy, sortOrder, playlists, isolatedTrackIds]);

  useEffect(() => {
    filteredTracksRef.current = filteredTracks;
  }, [filteredTracks]);

  // Information about current active detail view (if drilling into Album, Artist, Genre, or Playlist)
  const currentDetail = useMemo(() => {
    const formatDurationText = (sec: number) => {
      if (!sec || sec <= 0) return '';
      const hours = Math.floor(sec / 3600);
      const minutes = Math.floor((sec % 3600) / 60);
      const seconds = Math.floor(sec % 60);
      if (hours > 0) {
        return language === 'ru' ? `${hours} ч ${minutes} мин` : `${hours}h ${minutes}m`;
      }
      if (minutes > 0) {
        return language === 'ru' ? `${minutes} мин ${seconds} сек` : `${minutes}m ${seconds}s`;
      }
      return language === 'ru' ? `${seconds} сек` : `${seconds}s`;
    };

    if (selectedPlaylistId) {
      const pl = playlists.find(p => p.id === selectedPlaylistId);
      if (!pl) return null;
      const count = pl.trackIds.length;
      let firstCover: string | undefined = undefined;
      let totalDuration = 0;
      const trackMap = new Map(tracks.map(t => [t.id, t]));
      for (const tid of pl.trackIds) {
        const t = trackMap.get(tid);
        if (t) {
          if (!firstCover && t.coverArt) {
            firstCover = t.coverArt;
          }
          if (t.duration && !isNaN(t.duration)) {
            totalDuration += t.duration;
          }
        }
      }

      const countText = language === 'ru' 
        ? `${count} трек${count % 10 === 1 && count % 100 !== 11 ? '' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20) ? 'а' : 'ов'}`
        : `${count} ${count === 1 ? 'track' : 'tracks'}`;
      const durText = formatDurationText(totalDuration);
      const stats = durText ? `${countText} • ${durText}` : countText;

      return {
        type: 'playlist' as const,
        title: pl.name,
        subtitle: pl.description ? `${stats} — ${pl.description}` : stats,
        coverArt: firstCover,
        icon: <ListMusic className="w-8 h-8" />,
        playlist: pl,
      };
    }
    if (selectedAlbum) {
      const unknownAlbumLabel = language === 'ru' ? 'Без альбома' : 'No Album';
      const albumTracks = nonIsolatedTracks.filter(t => (t.album ? t.album.trim() : unknownAlbumLabel) === selectedAlbum);
      const firstCover = albumTracks.find(t => t.coverArt)?.coverArt;
      const artist = albumTracks[0]?.artist || (language === 'ru' ? 'Неизвестный исполнитель' : 'Unknown Artist');
      const totalDur = albumTracks.reduce((acc, t) => acc + (t.duration && !isNaN(t.duration) ? t.duration : 0), 0);
      const durText = formatDurationText(totalDur);
      return {
        type: 'album' as const,
        title: selectedAlbum,
        subtitle: `${artist} • ${albumTracks.length} ${language === 'ru' ? 'трек(ов)' : 'tracks'}${durText ? ` • ${durText}` : ''}`,
        coverArt: firstCover,
        icon: <Disc3 className="w-8 h-8" />,
      };
    }
    if (selectedArtist) {
      const unknownArtistLabel = language === 'ru' ? 'Неизвестный исполнитель' : 'Unknown Artist';
      const artistTracks = nonIsolatedTracks.filter(t => (t.artist ? t.artist.trim() : unknownArtistLabel) === selectedArtist);
      const firstCover = artistTracks.find(t => t.coverArt)?.coverArt;
      const totalDur = artistTracks.reduce((acc, t) => acc + (t.duration && !isNaN(t.duration) ? t.duration : 0), 0);
      const durText = formatDurationText(totalDur);
      return {
        type: 'artist' as const,
        title: selectedArtist,
        subtitle: `${artistTracks.length} ${language === 'ru' ? 'трек(ов)' : 'tracks'}${durText ? ` • ${durText}` : ''}`,
        coverArt: firstCover,
        icon: <Mic2 className="w-8 h-8" />,
      };
    }
    if (selectedGenre) {
      const unknownGenreLabel = language === 'ru' ? 'Без жанра' : 'No Genre';
      const genreTracks = nonIsolatedTracks.filter(t => {
        if (!t.genre) return selectedGenre === unknownGenreLabel;
        const list = t.genre.split(/[,/;\\]+/).map(g => g.trim()).filter(Boolean);
        return list.length > 0 ? list.includes(selectedGenre) : selectedGenre === unknownGenreLabel;
      });
      const firstCover = genreTracks.find(t => t.coverArt)?.coverArt;
      const totalDur = genreTracks.reduce((acc, t) => acc + (t.duration && !isNaN(t.duration) ? t.duration : 0), 0);
      const durText = formatDurationText(totalDur);
      return {
        type: 'genre' as const,
        title: selectedGenre,
        subtitle: `${genreTracks.length} ${language === 'ru' ? 'трек(ов)' : 'tracks'}${durText ? ` • ${durText}` : ''}`,
        coverArt: firstCover,
        icon: <Tag className="w-8 h-8" />,
      };
    }
    return null;
  }, [selectedPlaylistId, selectedAlbum, selectedArtist, selectedGenre, playlists, tracks, nonIsolatedTracks, language]);

  const searchPlaceholder = useMemo(() => {
    if (currentDetail) {
      return language === 'ru'
        ? `Поиск в «${currentDetail.title}»...`
        : `Search in "${currentDetail.title}"...`;
    }
    switch (currentView) {
      case 'playlists':
        return language === 'ru' ? 'Поиск по плейлистам и папкам...' : 'Search playlists and folders...';
      case 'albums':
        return language === 'ru' ? 'Поиск по альбомам...' : 'Search albums...';
      case 'artists':
        return language === 'ru' ? 'Поиск по исполнителям...' : 'Search artists...';
      case 'genres':
        return language === 'ru' ? 'Поиск по жанрам...' : 'Search genres...';
      case 'favorites':
        return language === 'ru' ? 'Поиск в избранном...' : 'Search favorites...';
      case 'tracks':
      default:
        return language === 'ru'
          ? `Поиск среди треков (${nonIsolatedTracks.length})...`
          : `Search all tracks (${nonIsolatedTracks.length})...`;
    }
  }, [currentDetail, currentView, nonIsolatedTracks.length, language]);

  const handleBackToGrid = () => {
    setDetailNavDirection('backward');
    selectedPlaylistIdRef.current = null;
    setSelectedPlaylistId(null);
    setSelectedAlbum(null);
    setSelectedArtist(null);
    setSelectedGenre(null);
    if (sortBy === 'custom') {
      setSortBy('title');
      setSortOrder('asc');
    }
  };

  const handleSelectView = (view: MainViewType) => {
    setCurrentView(view);
    handleBackToGrid();
  };

  // Prevent buttons from retaining focus on click so keyboard shortcuts never highlight or re-trigger them
  useEffect(() => {
    const handleGlobalMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('button')) {
        setTimeout(() => {
          if (document.activeElement && document.activeElement instanceof HTMLElement && document.activeElement.tagName === 'BUTTON') {
            document.activeElement.blur();
          }
        }, 0);
      }
    };
    window.addEventListener('mousedown', handleGlobalMouseDown, true);
    return () => window.removeEventListener('mousedown', handleGlobalMouseDown, true);
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Universal Search Hotkey: Ctrl + F (or Cmd + F)
      // Disables native browser search dialog and activates player search bar
      if ((e.code === 'KeyF' || e.key.toLowerCase() === 'f' || e.key.toLowerCase() === 'а') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        e.stopPropagation();
        const searchInput = document.querySelector('input[data-search-input="true"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      // Escape: Blur active search bar if focused
      if (e.key === 'Escape' || e.code === 'Escape') {
        const searchInput = document.querySelector('input[data-search-input="true"]') as HTMLInputElement;
        if (searchInput && document.activeElement === searchInput) {
          e.preventDefault();
          e.stopPropagation();
          searchInput.blur();
          return;
        }
      }

      // Settings Hotkey: Ctrl + , (or Cmd + , or Cyrillic Ctrl + б)
      if ((e.code === 'Comma' || e.key === ',' || e.key === '<' || e.key.toLowerCase() === 'б') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setIsSettingsOpen(prev => !prev);
        return;
      }

      // Equalizer Hotkey: Ctrl + E (or Cmd + E or Cyrillic Ctrl + у)
      if ((e.code === 'KeyE' || e.key.toLowerCase() === 'e' || e.key.toLowerCase() === 'у') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setIsEQOpen(prev => !prev);
        return;
      }

      // Fullscreen Hotkey: F11
      if (e.code === 'F11' || e.key === 'F11') {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen?.().catch(() => {});
        } else {
          document.exitFullscreen?.().catch(() => {});
        }
        return;
      }

      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      // Immediately clear button focus if any element was focused
      if (document.activeElement && document.activeElement instanceof HTMLElement && document.activeElement.tagName === 'BUTTON') {
        document.activeElement.blur();
      }

      if (e.code === 'Tab' || e.key === 'Tab') {
        e.preventDefault();
        const now = performance.now();
        // Cooldown applies strictly when holding down the key (auto-repeat)
        if (e.repeat && now - lastTabSwitchTimeRef.current < 500) {
          return;
        }
        lastTabSwitchTimeRef.current = now;

        if (document.activeElement && document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        const ALL_TABS: MainViewType[] = ['tracks', 'playlists', 'albums', 'artists', 'favorites', 'genres'];
        const activeTabs = ALL_TABS.filter(tabId => visibleTabs[tabId] ?? true);
        if (activeTabs.length > 0) {
          const currentIdx = activeTabs.indexOf(currentView);
          let nextIdx: number;
          if (e.shiftKey) {
            nextIdx = currentIdx <= 0 ? activeTabs.length - 1 : currentIdx - 1;
          } else {
            nextIdx = (currentIdx + 1) % activeTabs.length;
          }
          handleSelectView(activeTabs[nextIdx]);
        }
      } else if (e.code === 'Space' || e.code === 'MediaPlayPause' || e.key === 'MediaPlayPause') {
        e.preventDefault();
        handlePlayPause();
      } else if (e.code === 'MediaStop' || e.key === 'MediaStop') {
        e.preventDefault();
        if (isPlaying) {
          setIsPlaying(false);
          audioEngine.pause();
        }
      } else if (e.code === 'MediaTrackNext' || e.key === 'MediaTrackNext') {
        e.preventDefault();
        handleNext();
      } else if (e.code === 'MediaTrackPrevious' || e.key === 'MediaTrackPrevious') {
        e.preventDefault();
        handlePrev();
      } else if ((e.code === 'KeyQ' || e.key.toLowerCase() === 'q' || e.key.toLowerCase() === 'й') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setIsQueueOpen(prev => !prev);
      } else if ((e.code === 'KeyX' || e.key.toLowerCase() === 'x' || e.key.toLowerCase() === 'ч') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        handleClearQueue();
      } else if ((e.code === 'KeyD' || e.key.toLowerCase() === 'd' || e.key.toLowerCase() === 'в') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setDiscordEnabled(prev => !prev);
      } else if ((e.code === 'KeyR' || e.key.toLowerCase() === 'r' || e.key.toLowerCase() === 'к') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        handleToggleRepeat();
      } else if ((e.code === 'KeyT' || e.key.toLowerCase() === 't' || e.key.toLowerCase() === 'е' || e.code === 'KeyL' || e.key.toLowerCase() === 'l' || e.key.toLowerCase() === 'д') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (currentTrackRef.current) {
          setIsLyricsOpen(prev => !prev);
        }
      } else if ((e.code === 'KeyE' || e.key.toLowerCase() === 'e' || e.key.toLowerCase() === 'у') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setIsShuffled(prev => !prev);
      } else if ((e.code === 'KeyM' || e.key.toLowerCase() === 'm' || e.key.toLowerCase() === 'ь') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        handleToggleMute();
      // Volume Up / Down with Ctrl (Ctrl + ArrowUp / ArrowDown)
      } else if ((e.code === 'ArrowUp' || e.key === 'ArrowUp') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const next = Math.min(1, Math.round((volumeRef.current + 0.05) * 100) / 100);
        handleVolumeChange(next);
      } else if ((e.code === 'ArrowDown' || e.key === 'ArrowDown') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const next = Math.max(0, Math.round((volumeRef.current - 0.05) * 100) / 100);
        handleVolumeChange(next);
      // Plain Arrow Down / Up: Navigate through track list
      } else if ((e.code === 'ArrowDown' || e.key === 'ArrowDown') && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        const currentList = filteredTracksRef.current;
        if (currentList.length > 0) {
          e.preventDefault();
          let currIdx = -1;
          if (lastSelectedIndexRef.current !== null && lastSelectedIndexRef.current >= 0 && lastSelectedIndexRef.current < currentList.length) {
            currIdx = lastSelectedIndexRef.current;
          } else {
            const currentSelection = selectedTrackIdsRef.current;
            if (currentSelection.size > 0) {
              const selectedId = Array.from(currentSelection)[currentSelection.size - 1];
              currIdx = currentList.findIndex(t => t.id === selectedId);
            } else if (currentTrackRef.current) {
              currIdx = currentList.findIndex(t => t.id === currentTrackRef.current?.id);
            }
          }
          const nextIdx = currIdx === -1 ? 0 : Math.min(currentList.length - 1, currIdx + 1);
          const nextTrack = currentList[nextIdx];
          if (nextTrack) {
            const newSet = new Set([nextTrack.id]);
            selectedTrackIdsRef.current = newSet;
            lastSelectedIndexRef.current = nextIdx;
            setSelectedTrackIds(newSet);
            setLastSelectedIndex(nextIdx);
            requestAnimationFrame(() => {
              const el = document.querySelector(`[data-track-row-id="${nextTrack.id}"]`);
              el?.scrollIntoView({ block: 'nearest' });
            });
          }
        }
      } else if ((e.code === 'ArrowUp' || e.key === 'ArrowUp') && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        const currentList = filteredTracksRef.current;
        if (currentList.length > 0) {
          e.preventDefault();
          let currIdx = -1;
          if (lastSelectedIndexRef.current !== null && lastSelectedIndexRef.current >= 0 && lastSelectedIndexRef.current < currentList.length) {
            currIdx = lastSelectedIndexRef.current;
          } else {
            const currentSelection = selectedTrackIdsRef.current;
            if (currentSelection.size > 0) {
              const selectedId = Array.from(currentSelection)[0];
              currIdx = currentList.findIndex(t => t.id === selectedId);
            } else if (currentTrackRef.current) {
              currIdx = currentList.findIndex(t => t.id === currentTrackRef.current?.id);
            }
          }
          const prevIdx = currIdx === -1 ? 0 : Math.max(0, currIdx - 1);
          const prevTrack = currentList[prevIdx];
          if (prevTrack) {
            const newSet = new Set([prevTrack.id]);
            selectedTrackIdsRef.current = newSet;
            lastSelectedIndexRef.current = prevIdx;
            setSelectedTrackIds(newSet);
            setLastSelectedIndex(prevIdx);
            requestAnimationFrame(() => {
              const el = document.querySelector(`[data-track-row-id="${prevTrack.id}"]`);
              el?.scrollIntoView({ block: 'nearest' });
            });
          }
        }
      // Shift + Enter: Edit tags of selected track(s)
      } else if ((e.code === 'Enter' || e.key === 'Enter') && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const anyModalOpen = isSettingsOpen || isEQOpen || isLyricsOpen || isQueueOpen || isBatchTagEditorOpen ||
          isCreatePlaylistOpen || isCreateFolderOpen || isCreateGroupOpen || renameItemTarget ||
          renamePlaylistTarget || deleteFolderTarget || clearPlaylistTarget || deletePlaylistTarget ||
          deleteTracksTarget || deleteFromDiskTarget || trackDetailsTarget;
        if (!anyModalOpen) {
          const currentSelection = selectedTrackIdsRef.current;
          if (currentSelection.size > 0) {
            e.preventDefault();
            setIsBatchTagEditorOpen(true);
          } else if (currentTrack) {
            e.preventDefault();
            const newSet = new Set([currentTrack.id]);
            selectedTrackIdsRef.current = newSet;
            setSelectedTrackIds(newSet);
            setIsBatchTagEditorOpen(true);
          }
        }
      // Plain Enter: Play selected track
      } else if ((e.code === 'Enter' || e.key === 'Enter') && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const anyModalOpen = isSettingsOpen || isEQOpen || isLyricsOpen || isQueueOpen || isBatchTagEditorOpen ||
          isCreatePlaylistOpen || isCreateFolderOpen || isCreateGroupOpen || renameItemTarget ||
          renamePlaylistTarget || deleteFolderTarget || clearPlaylistTarget || deletePlaylistTarget ||
          deleteTracksTarget || deleteFromDiskTarget || trackDetailsTarget;
        if (!anyModalOpen) {
          const currentList = filteredTracksRef.current;
          const currentSelection = selectedTrackIdsRef.current;
          if (currentSelection.size > 0) {
            e.preventDefault();
            const firstId = Array.from(currentSelection)[0];
            const trackToPlay = currentList.find(t => t.id === firstId) || tracks.find(t => t.id === firstId);
            if (trackToPlay) {
              playTrackWithContext(trackToPlay, currentList);
            }
          } else if (currentList.length > 0) {
            e.preventDefault();
            playTrackWithContext(currentList[0], currentList);
          }
        }
      // Plain Arrow Left / Right: Rewind / Fast-forward by 5 seconds (silent while holding, seeks when stopped)
      } else if ((e.code === 'ArrowLeft' || e.key === 'ArrowLeft') && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        const dur = duration > 0 ? duration : audioEngine.getDuration();
        const baseTime = pendingSeekTimeRef.current !== null ? pendingSeekTimeRef.current : audioEngine.getCurrentTime();
        const nextTime = Math.max(0, Math.min(dur > 0 ? dur : Infinity, baseTime - 5));

        if (pendingSeekTimeRef.current === null && isPlaying) {
          audioEngine.scrubHold();
        }

        pendingSeekTimeRef.current = nextTime;
        setCurrentTime(nextTime);
        audioEngine.setScrubbing(true);

        if (seekDebounceTimerRef.current) {
          clearTimeout(seekDebounceTimerRef.current);
        }
        seekDebounceTimerRef.current = setTimeout(() => {
          const finalTime = pendingSeekTimeRef.current;
          pendingSeekTimeRef.current = null;
          if (finalTime !== null) {
            audioEngine.seek(finalTime);
          } else {
            audioEngine.scrubCancel();
          }
          audioEngine.setScrubbing(false);
        }, 220);
      } else if ((e.code === 'ArrowRight' || e.key === 'ArrowRight') && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        const dur = duration > 0 ? duration : audioEngine.getDuration();
        const baseTime = pendingSeekTimeRef.current !== null ? pendingSeekTimeRef.current : audioEngine.getCurrentTime();
        const nextTime = Math.max(0, Math.min(dur > 0 ? dur : Infinity, baseTime + 5));

        if (pendingSeekTimeRef.current === null && isPlaying) {
          audioEngine.scrubHold();
        }

        pendingSeekTimeRef.current = nextTime;
        setCurrentTime(nextTime);
        audioEngine.setScrubbing(true);

        if (seekDebounceTimerRef.current) {
          clearTimeout(seekDebounceTimerRef.current);
        }
        seekDebounceTimerRef.current = setTimeout(() => {
          const finalTime = pendingSeekTimeRef.current;
          pendingSeekTimeRef.current = null;
          if (finalTime !== null) {
            audioEngine.seek(finalTime);
          } else {
            audioEngine.scrubCancel();
          }
          audioEngine.setScrubbing(false);
        }, 220);
      // Ctrl + Arrow Left / Right: Previous / Next track
      } else if ((e.code === 'ArrowRight' || e.key === 'ArrowRight') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleNext();
      } else if ((e.code === 'ArrowLeft' || e.key === 'ArrowLeft') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handlePrev();
      } else if (e.code === 'KeyA' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setSelectedTrackIds(new Set(filteredTracks.map(t => t.id)));
      } else if (e.code === 'Delete' || e.key === 'Delete') {
        const anyModalOpen = isSettingsOpen || isEQOpen || isLyricsOpen || isQueueOpen || isBatchTagEditorOpen ||
          isCreatePlaylistOpen || isCreateFolderOpen || isCreateGroupOpen || renameItemTarget ||
          renamePlaylistTarget || deleteFolderTarget || clearPlaylistTarget || deletePlaylistTarget ||
          deleteTracksTarget || deleteFromDiskTarget || trackDetailsTarget;
        if (!anyModalOpen) {
          if (e.shiftKey) {
            e.preventDefault();
            const currentSelection = selectedTrackIdsRef.current;
            if (currentSelection.size > 0) {
              setDeleteFromDiskTarget(Array.from(currentSelection));
            } else if (currentTrackRef.current) {
              setDeleteFromDiskTarget([currentTrackRef.current.id]);
            }
          } else if (selectedTrackIds.size > 0) {
            e.preventDefault();
            handleRequestRemoveTracks(Array.from(selectedTrackIds));
          }
        }
      } else if (e.code === 'Escape') {
        if (deleteFromDiskTarget) {
          setDeleteFromDiskTarget(null);
          return;
        }
        if (deleteTracksTarget) {
          setDeleteTracksTarget(null);
          return;
        }
        if (trackDetailsTarget) {
          setTrackDetailsTarget(null);
          return;
        }
        if (isSettingsOpen) {
          setIsSettingsOpen(false);
          return;
        }
        if (isEQOpen) {
          setIsEQOpen(false);
          return;
        }
        if (isLyricsOpen) {
          setIsLyricsOpen(false);
          return;
        }
        if (isQueueOpen) {
          setIsQueueOpen(false);
          return;
        }
        if (isBatchTagEditorOpen) {
          setIsBatchTagEditorOpen(false);
          return;
        }
        if (isCreatePlaylistOpen) {
          setIsCreatePlaylistOpen(false);
          return;
        }
        if (isCreateFolderOpen) {
          setIsCreateFolderOpen(false);
          return;
        }
        if (isCreateGroupOpen) {
          setIsCreateGroupOpen(false);
          return;
        }
        if (renameItemTarget) {
          setRenameItemTarget(null);
          return;
        }
        if (renamePlaylistTarget) {
          setRenamePlaylistTarget(null);
          return;
        }
        if (deleteFolderTarget) {
          setDeleteFolderTarget(null);
          return;
        }
        if (clearPlaylistTarget) {
          setClearPlaylistTarget(null);
          return;
        }
        if (deletePlaylistTarget) {
          setDeletePlaylistTarget(null);
          return;
        }
        if (contextMenu || playlistContextMenu || folderContextMenu) {
          setContextMenu(null);
          setPlaylistContextMenu(null);
          setFolderContextMenu(null);
          return;
        }
        if (selectedTrackIds.size > 0) {
          setSelectedTrackIds(new Set());
          return;
        }
        if (currentDetail || selectedPlaylistId) {
          handleBackToGrid();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isPlaying,
    currentTrack,
    queue,
    queueIndex,
    filteredTracks,
    selectedTrackIds,
    repeatMode,
    isLyricsOpen,
    trackDetailsTarget,
    isSettingsOpen,
    isEQOpen,
    isQueueOpen,
    isBatchTagEditorOpen,
    isCreatePlaylistOpen,
    isCreateFolderOpen,
    isCreateGroupOpen,
    renameItemTarget,
    renamePlaylistTarget,
    deleteFolderTarget,
    clearPlaylistTarget,
    deletePlaylistTarget,
    deleteTracksTarget,
    deleteFromDiskTarget,
    contextMenu,
    playlistContextMenu,
    folderContextMenu,
    currentDetail,
    selectedPlaylistId,
    currentView,
    visibleTabs,
  ]);

  const pendingTauriPathsRef = useRef<Set<string>>(new Set());
  const importTauriTimerRef = useRef<any>(null);

  // Synchronous, robust track processor and playlist assigner
  const processImportedTracks = (newTracks: Track[]) => {
    if (!newTracks || newTracks.length === 0) return;

    const prevTracks = tracksRef.current;
    const existingPaths = new Set(prevTracks.map(t => normalizeTrackPath(t.path)).filter(Boolean));
    const existingKeys = new Set(prevTracks.map(t => `${t.title.trim().toLowerCase()}|||${t.artist.trim().toLowerCase()}`));

    const toAdd: Track[] = [];
    const plTargetIds: string[] = [];
    const updatedMap = new Map<string, Partial<Track>>();

    for (const nt of newTracks) {
      const pathKey = normalizeTrackPath(nt.path);
      const titleArtistKey = `${nt.title.trim().toLowerCase()}|||${nt.artist.trim().toLowerCase()}`;

      const isPathMatch = !!pathKey && existingPaths.has(pathKey);
      const isTitleArtistMatch = titleArtistKey !== '|||' && titleArtistKey !== 'unknown|||unknown artist' && existingKeys.has(titleArtistKey);

      if (isPathMatch || isTitleArtistMatch) {
        const existing = prevTracks.find(t => (isPathMatch && normalizeTrackPath(t.path) === pathKey) || (isTitleArtistMatch && `${t.title.trim().toLowerCase()}|||${t.artist.trim().toLowerCase()}` === titleArtistKey));
        if (existing) {
          plTargetIds.push(existing.id);
          // If the physical file path matches, the file might have been replaced on disk or re-imported.
          // Update the existing track's metadata with the fresh values from the new file!
          if (isPathMatch) {
            updatedMap.set(existing.id, {
              title: nt.title,
              artist: nt.artist,
              album: nt.album,
              duration: nt.duration || existing.duration,
              src: nt.src,
              coverArt: nt.coverArt !== undefined ? nt.coverArt : existing.coverArt,
              genre: nt.genre,
              year: nt.year,
              trackNumber: nt.trackNumber,
              trackTotal: nt.trackTotal,
              format: nt.format,
              fileSize: nt.fileSize,
              lyrics: nt.lyrics || undefined,
              composer: nt.composer,
              contentGroup: nt.contentGroup,
              comment: nt.comment,
              conductor: nt.conductor,
              lyricist: nt.lyricist,
            });
          }
        }
        continue;
      }

      if (pathKey) existingPaths.add(pathKey);
      if (titleArtistKey !== '|||' && titleArtistKey !== 'unknown|||unknown artist') existingKeys.add(titleArtistKey);
      if (currentView === 'favorites') {
        nt.isFavorite = true;
      }
      toAdd.push(nt);
      plTargetIds.push(nt.id);
    }

    if (updatedMap.size > 0) {
      setTracks(prev => prev.map(t => {
        const updates = updatedMap.get(t.id);
        return updates ? { ...t, ...updates } : t;
      }));
      setCurrentTrack(prev => {
        if (!prev) return prev;
        const updates = updatedMap.get(prev.id);
        return updates ? { ...prev, ...updates } : prev;
      });
      setQueue(prev => prev.map(t => {
        const updates = updatedMap.get(t.id);
        return updates ? { ...t, ...updates } : t;
      }));
    }

    if (toAdd.length > 0) {
      setTracks(prev => appendUniqueTracks(prev, toAdd));
      setQueue(prev => [...prev, ...toAdd]);
    }

    // If currently viewing a specific playlist, immediately add all tracks (new & existing) into it!
    const activePlId = selectedPlaylistIdRef.current || selectedPlaylistId;
    if (activePlId && plTargetIds.length > 0) {
      setPlaylists(prev => prev.map(p => {
        if (p.id === activePlId) {
          const set = new Set(p.trackIds);
          const tracksToAdd = plTargetIds.filter(id => !set.has(id));
          if (tracksToAdd.length === 0) return p;
          return { ...p, trackIds: [...p.trackIds, ...tracksToAdd] };
        }
        return p;
      }));
    } else if (currentView === 'favorites' && plTargetIds.length > 0) {
      setPlaylists(prev => prev.map(p => {
        if (p.id === 'pl_favorites') {
          const set = new Set(p.trackIds);
          const tracksToAdd = plTargetIds.filter(id => !set.has(id));
          if (tracksToAdd.length === 0) return p;
          return { ...p, trackIds: [...p.trackIds, ...tracksToAdd] };
        }
        return p;
      }));
    }

    if (!currentTrack || tracksRef.current.length === 0) {
      const first = toAdd[0] || newTracks[0];
      if (first) playTrackWithContext(first, newTracks);
    }
  };

  // Import native file paths in Tauri desktop with batching & debounce
  const importTauriPaths = (paths: string[]) => {
    if (!paths || paths.length === 0) return;
    for (const p of paths) {
      if (typeof p === 'string' && p.trim().length > 0) {
        pendingTauriPathsRef.current.add(p.trim());
      }
    }

    if (importTauriTimerRef.current) {
      clearTimeout(importTauriTimerRef.current);
    }

    importTauriTimerRef.current = setTimeout(async () => {
      const batchedPaths = Array.from(pendingTauriPathsRef.current);
      pendingTauriPathsRef.current.clear();
      if (batchedPaths.length === 0) return;

      const playlistPaths = batchedPaths.filter(p => /\.(m3u8|m3u)$/i.test(p));
      const audioPaths = batchedPaths.filter(p => !/\.(m3u8|m3u)$/i.test(p));

      // 1. Process dropped M3U / M3U8 playlists
      for (const plPath of playlistPaths) {
        try {
          const res = await invoke<{ name: string; paths: string[] }>('parse_m3u8_file', { path: plPath });
          if (res && res.paths.length > 0) {
            const raw = await invoke<any[]>('read_audio_files', { paths: res.paths });
            if (raw && raw.length > 0) {
              const newPlTracks: Track[] = raw.map(t => ({
                id: t.id,
                path: t.path,
                title: t.title,
                artist: t.artist,
                album: t.album,
                duration: t.duration_seconds || 0,
                src: convertFileSrc(t.path),
                coverArt: t.cover_art ? convertFileSrc(t.cover_art) : undefined,
                genre: t.genre || undefined,
                year: t.year || undefined,
                trackNumber: t.track_number || undefined,
                trackTotal: t.track_total || undefined,
                format: t.format,
                fileSize: t.file_size,
                lyrics: t.lyrics || undefined,
                composer: t.composer || undefined,
                contentGroup: t.content_group || undefined,
                comment: t.comment || undefined,
                conductor: t.conductor || undefined,
                lyricist: t.lyricist || undefined,
                dateAdded: Date.now(),
                playCount: 0,
                isFavorite: false,
              }));
              const existingMap = new Map(tracksRef.current.map(t => [normalizeTrackPath(t.path), t.id]));
              const plTrackIds: string[] = [];
              const tracksToAdd: Track[] = [];
              for (const pt of newPlTracks) {
                const norm = normalizeTrackPath(pt.path);
                if (norm && existingMap.has(norm)) {
                  plTrackIds.push(existingMap.get(norm)!);
                } else {
                  if (norm) existingMap.set(norm, pt.id);
                  tracksToAdd.push(pt);
                  plTrackIds.push(pt.id);
                }
              }
              if (tracksToAdd.length > 0) {
                setTracks(prev => appendUniqueTracks(prev, tracksToAdd));
              }
              const newPl: Playlist = {
                id: `pl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                name: res.name || 'Imported Playlist',
                trackIds: plTrackIds,
                isSystem: false,
                order: playlists.length,
              };
              setPlaylists(prev => [...prev, newPl]);
            }
          }
        } catch (e) {
          console.warn('Failed to parse dropped playlist:', e);
        }
      }

      if (audioPaths.length === 0) return;

      try {
        const rawTracks = await invoke<any[]>('read_audio_files', { paths: audioPaths });
        if (!rawTracks || rawTracks.length === 0) return;

        const newTracks: Track[] = rawTracks.map(t => {
          let coverArt = t.cover_art || undefined;
          if (coverArt && !coverArt.startsWith('http') && !coverArt.startsWith('data:') && isTauri()) {
            coverArt = convertFileSrc(coverArt);
          }
          return {
            id: t.id,
            path: t.path,
            title: t.title,
            artist: t.artist,
            album: t.album,
            duration: t.duration_seconds || 0,
            src: convertFileSrc(t.path),
            coverArt,
            genre: t.genre || undefined,
            year: t.year || undefined,
            trackNumber: t.track_number || undefined,
            trackTotal: t.track_total || undefined,
            format: t.format,
            fileSize: t.file_size,
            lyrics: t.lyrics || undefined,
            composer: t.composer || undefined,
            contentGroup: t.content_group || undefined,
            comment: t.comment || undefined,
            conductor: t.conductor || undefined,
            lyricist: t.lyricist || undefined,
            dateAdded: Date.now(),
            playCount: 0,
            isFavorite: false,
          };
        });

        processImportedTracks(newTracks);
      } catch (err) {
        console.warn('Error reading Tauri dropped files:', err);
      }
    }, 60);
  };

  // Process imported audio files from HTML5 input / drop
  const importFiles = async (files: File[]) => {
    const audioFiles = files.filter(f => 
      /\.(mp3|flac|wav|ogg|m4a|aac|opus|wma)$/i.test(f.name) || f.type.startsWith('audio/')
    );

    if (audioFiles.length === 0) return;

    if (isTauri()) {
      const nativePaths: string[] = audioFiles
        .map(f => (f as any).path)
        .filter((p): p is string => typeof p === 'string' && p.length > 0);
      if (nativePaths.length > 0) {
        await importTauriPaths(nativePaths);
        return;
      }
    }

    // Fallback in web mode: check if any image files were dropped alongside audio files
    const imageFiles = files.filter(f => 
      /\.(jpg|jpeg|png|webp)$/i.test(f.name) || f.type.startsWith('image/')
    );
    let fallbackCoverUrl: string | undefined;
    if (imageFiles.length > 0) {
      const preferred = imageFiles.find(img => 
        /^(cover|folder|front|album|soundtrack|ost)/i.test(img.name)
      ) || imageFiles[0];
      try {
        fallbackCoverUrl = URL.createObjectURL(preferred);
      } catch (_) {}
    }

    const newTracks: Track[] = [];
    for (const f of audioFiles) {
      try {
        const parsed = await parseAudioFile(f);
        if (!parsed.coverArt && fallbackCoverUrl) {
          parsed.coverArt = fallbackCoverUrl;
        }
        newTracks.push(parsed);
      } catch (err) {
        console.warn('Error reading file metadata:', err);
      }
    }

    if (newTracks.length > 0) {
      processImportedTracks(newTracks);
    }
  };

  const handleOpenFiles = async () => {
    if (isTauri()) {
      try {
        const rawTracks = await invoke<any[]>('open_file_dialog');
        if (rawTracks && rawTracks.length > 0) {
          const newTracks: Track[] = rawTracks.map(t => ({
            id: t.id,
            path: t.path,
            title: t.title,
            artist: t.artist,
            album: t.album,
            duration: t.duration_seconds || 0,
            src: convertFileSrc(t.path),
            coverArt: t.cover_art || undefined,
            genre: t.genre || undefined,
            year: t.year || undefined,
            trackNumber: t.track_number || undefined,
            format: t.format,
            fileSize: t.file_size,
            lyrics: t.lyrics || undefined,
            dateAdded: Date.now(),
            playCount: 0,
            isFavorite: false,
          }));

          processImportedTracks(newTracks);
        }
      } catch (err) {
        console.warn('Native open file dialog error:', err);
      }
      return; // Always return in Tauri, never fall through to browser input!
    }
    fileInputRef.current?.click();
  };

  const genres = useMemo(() => {
    const set = new Set<string>();
    tracks.forEach(t => {
      if (t.genre) set.add(t.genre);
    });
    return Array.from(set);
  }, [tracks]);

  const handleSelectTrack = (trackId: string, e: React.MouseEvent, index: number) => {
    if (e.shiftKey && lastSelectedIndexRef.current !== null) {
      const start = Math.min(lastSelectedIndexRef.current, index);
      const end = Math.max(lastSelectedIndexRef.current, index);
      const rangeIds = filteredTracks.slice(start, end + 1).map(t => t.id);
      const newSet = new Set(rangeIds);
      selectedTrackIdsRef.current = newSet;
      setSelectedTrackIds(newSet);
    } else if (e.ctrlKey || e.metaKey) {
      const updated = new Set(selectedTrackIdsRef.current);
      if (updated.has(trackId)) {
        updated.delete(trackId);
      } else {
        updated.add(trackId);
      }
      selectedTrackIdsRef.current = updated;
      setSelectedTrackIds(updated);
      lastSelectedIndexRef.current = index;
      setLastSelectedIndex(index);
    } else {
      const newSet = new Set([trackId]);
      selectedTrackIdsRef.current = newSet;
      setSelectedTrackIds(newSet);
      lastSelectedIndexRef.current = index;
      setLastSelectedIndex(index);
    }
  };

  const updateTrackRelocation = (trackId: string, newPath: string, newSrc: string, metadata?: any) => {
    const resolvedCover = metadata?.cover_art && isTauri()
      ? convertFileSrc(metadata.cover_art)
      : (metadata?.coverArt || undefined);

    setTracks(prev => prev.map(t => {
      if (t.id === trackId) {
        return {
          ...t,
          path: newPath,
          src: newSrc,
          isMissing: false,
          title: metadata?.title || t.title,
          artist: metadata?.artist || t.artist,
          album: metadata?.album || t.album,
          duration: metadata?.duration_seconds || metadata?.duration || t.duration,
          coverArt: resolvedCover || t.coverArt,
        };
      }
      return t;
    }));

    if (currentTrack && currentTrack.id === trackId) {
      const updatedCurr: Track = {
        ...currentTrack,
        path: newPath,
        src: newSrc,
        isMissing: false,
        title: metadata?.title || currentTrack.title,
        artist: metadata?.artist || currentTrack.artist,
        album: metadata?.album || currentTrack.album,
        duration: metadata?.duration_seconds || metadata?.duration || currentTrack.duration,
        coverArt: resolvedCover || currentTrack.coverArt,
      };
      setCurrentTrack(updatedCurr);
      audioEngine.playTrack(newSrc, true, true, updatedCurr.duration, newPath);
      setIsPlaying(true);
    }
  };

  const handleRelocateTrack = async (track: Track) => {
    let newPath: string | null = null;
    if (isTauri()) {
      try {
        const picked = await invoke<string | null>('pick_single_audio_file');
        if (picked) {
          newPath = picked;
        }
      } catch (err) {
        console.error('Failed to pick file:', err);
      }
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'audio/*';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const url = URL.createObjectURL(file);
          updateTrackRelocation(track.id, file.name, url);
        }
      };
      input.click();
      return;
    }

    if (newPath) {
      let meta: any = null;
      if (isTauri()) {
        try {
          const metaList = await invoke<any[]>('read_audio_files', { paths: [newPath] });
          if (metaList && metaList.length > 0) meta = metaList[0];
        } catch (_) {}
      }
      const newSrc = convertFileSrc(newPath);
      updateTrackRelocation(track.id, newPath, newSrc, meta);
    }
  };

  // Plays a specific track at an existing index in the queue without replacing the queue
  const playQueueIndex = async (index: number) => {
    if (index < 0 || index >= queue.length) return;
    const track = queue[index];
    if (track.isMissing) {
      handleRelocateTrack(track);
      return;
    }
    setQueueIndex(index);
    setCurrentTrack(track);
    setCurrentTime(0);
    setDuration(track.duration || 0);
    try {
      await audioEngine.playTrack(track.src, true, true, track.duration, track.path);
      setIsPlaying(true);
    } catch (e) {
      console.warn('Queue playback start error:', e);
      if (track.path && isTauri()) {
        const exists = await invoke<boolean>('check_file_exists', { path: track.path });
        if (!exists) {
          setTracks(prev => prev.map(t => t.id === track.id ? { ...t, isMissing: true } : t));
          setCurrentTrack(prev => prev && prev.id === track.id ? { ...prev, isMissing: true } : prev);
          handleRelocateTrack(track);
        }
      }
    }
  };

  // Starts playback of a track with context: populates the playback queue with all tracks from that view/playlist
  // in their exact displayed order, and sets the active queue index to the clicked track.
  const playTrackWithContext = async (track: Track, contextTracks?: Track[]) => {
    if (track.isMissing) {
      handleRelocateTrack(track);
      return;
    }

    const list = contextTracks && contextTracks.length > 0 ? contextTracks : [track];
    setQueue(list);
    const idx = list.findIndex(t => t.id === track.id);
    const targetIdx = idx !== -1 ? idx : 0;
    setQueueIndex(targetIdx);

    setCurrentTrack(track);
    setCurrentTime(0);
    setDuration(track.duration || 0);
    try {
      await audioEngine.playTrack(track.src, true, true, track.duration, track.path);
      setIsPlaying(true);
    } catch (e) {
      console.warn('Playback start error:', e);
      if (track.path && isTauri()) {
        const exists = await invoke<boolean>('check_file_exists', { path: track.path });
        if (!exists) {
          setTracks(prev => prev.map(t => t.id === track.id ? { ...t, isMissing: true } : t));
          setCurrentTrack(prev => prev && prev.id === track.id ? { ...prev, isMissing: true } : prev);
          handleRelocateTrack(track);
        }
      }
    }
  };

  const playTrack = async (track: Track) => {
    playTrackWithContext(track, filteredTracks.length > 0 ? filteredTracks : [track]);
  };

  const handleClearQueue = () => {
    setQueue([]);
    setQueueIndex(0);
    setCurrentTrack(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setIsLyricsOpen(false);
    audioEngine.stop();
  };

  const handlePlayPause = async () => {
    if (!currentTrack) {
      if (queue.length > 0) {
        const idx = (queueIndex >= 0 && queueIndex < queue.length) ? queueIndex : 0;
        playQueueIndex(idx);
        return;
      }
      if (filteredTracks.length > 0) {
        playTrackWithContext(filteredTracks[0], filteredTracks);
      }
      return;
    }
    if (isPlaying) {
      setIsPlaying(false);
      await audioEngine.pause();
    } else {
      setIsPlaying(true);
      await audioEngine.resume();
    }
  };

  const handleNext = () => {
    if (queue.length === 0) return;
    if (isShuffled) {
      const nextIdx = Math.floor(Math.random() * queue.length);
      playQueueIndex(nextIdx);
      return;
    }
    const nextIdx = (queueIndex + 1) % queue.length;
    playQueueIndex(nextIdx);
  };

  const handlePrev = (forcePrevious: boolean = false) => {
    if (queue.length === 0) return;

    const now = performance.now();
    const isDoublePress = (now - lastPrevPressRef.current) < 2500;
    lastPrevPressRef.current = now;

    // If played more than 4 seconds and this is a single press (and not explicitly forced via media button): restart from 0:00
    if (currentTime > 4 && !isDoublePress && !forcePrevious) {
      audioEngine.seek(0);
      setCurrentTime(0);
      return;
    }

    // Double press within 2.5s OR forcePrevious OR at track start (<= 4s): switch to previous track in queue
    const prevIdx = (queueIndex - 1 + queue.length) % queue.length;
    playQueueIndex(prevIdx);
  };

  const handleTrackEnded = () => {
    if (repeatMode === 'one') {
      const cur = currentTrackRef.current;
      if (discordEnabledRef.current && cur) {
        discordRpc.updatePresence({
          enabled: true,
          trackName: cur.title,
          artist: cur.artist,
          album: cur.album,
          duration: cur.duration || audioEngine.getDuration() || 0,
          currentTime: 0,
          isPlaying: true,
          coverArt: cur.coverArt,
          showPlayIcon: discordShowPlayIconRef.current,
          showPauseIcon: discordShowPauseIconRef.current,
          statusMode: discordStatusModeRef.current,
          customClientId: discordCustomClientIdRef.current,
        });
      }
      return;
    } else if (repeatMode === 'all') {
      handleNext();
    } else {
      if (queueIndex < queue.length - 1) {
        handleNext();
      } else {
        setIsPlaying(false);
      }
    }
  };
  handleTrackEndedRef.current = handleTrackEnded;

  const handleSeek = (time: number) => {
    if (seekDebounceTimerRef.current) {
      clearTimeout(seekDebounceTimerRef.current);
      seekDebounceTimerRef.current = null;
    }
    pendingSeekTimeRef.current = null;
    audioEngine.setScrubbing(false);
    setCurrentTime(time);
    audioEngine.seek(time);

    if (discordEnabled && currentTrack) {
      discordRpc.updatePresence({
        enabled: true,
        trackName: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.album,
        duration: currentTrack.duration || audioEngine.getDuration() || 0,
        currentTime: time,
        isPlaying: isPlaying,
        coverArt: currentTrack.coverArt,
        showPlayIcon: discordShowPlayIcon,
        showPauseIcon: discordShowPauseIcon,
        statusMode: discordStatusMode,
        customClientId: discordCustomClientId,
        language: language,
      });
    }
  };

  const handleVolumeChange = (vol: number) => {
    volumeRef.current = vol;
    setVolume(vol);
    if (vol > 0) {
      lastNonZeroVolumeRef.current = vol;
      isMutedRef.current = false;
      setIsMuted(false);
      audioEngine.setMuted(false);
      audioEngine.setVolume(vol);
    } else {
      isMutedRef.current = true;
      setIsMuted(true);
      audioEngine.setMuted(true);
    }
  };

  const handleToggleMute = () => {
    const currentlyMuted = isMutedRef.current || volumeRef.current === 0;
    if (currentlyMuted) {
      const restore = lastNonZeroVolumeRef.current > 0.05 ? lastNonZeroVolumeRef.current : 0.85;
      isMutedRef.current = false;
      volumeRef.current = restore;
      setIsMuted(false);
      setVolume(restore);
      audioEngine.setMuted(false);
      audioEngine.setVolume(restore);
    } else {
      if (volumeRef.current > 0) {
        lastNonZeroVolumeRef.current = volumeRef.current;
      }
      isMutedRef.current = true;
      setIsMuted(true);
      audioEngine.setMuted(true);
    }
  };

  const handleToggleShuffle = () => {
    setIsShuffled(!isShuffled);
  };

  // Persistent refs for MediaSession action handlers so they never get dropped or desynchronized
  const handlePlayPauseRef = useRef(handlePlayPause);
  handlePlayPauseRef.current = handlePlayPause;

  const handleNextRef = useRef(handleNext);
  handleNextRef.current = handleNext;

  const handlePrevRef = useRef(handlePrev);
  handlePrevRef.current = handlePrev;

  const handleSeekRef = useRef(handleSeek);
  handleSeekRef.current = handleSeek;

  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  // System Media Transport Controls (SMTC) & Bluetooth Headphone Media Buttons
  // Registered ONCE on mount so Windows SMTC never loses registration during playback state changes!
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.setActionHandler('play', () => {
        handlePlayPauseRef.current();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        handlePlayPauseRef.current();
      });
      navigator.mediaSession.setActionHandler('stop', () => {
        audioEngine.pause();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        handleNextRef.current();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        // Triple-click on bluetooth headphones sends previoustrack -> force switch to previous track!
        handlePrevRef.current(true);
      });
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const offset = details.seekOffset || 10;
        const cur = audioEngine.getCurrentTime();
        handleSeekRef.current(Math.max(0, cur - offset));
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const offset = details.seekOffset || 10;
        const cur = audioEngine.getCurrentTime();
        handleSeekRef.current(cur + offset);
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && !isNaN(details.seekTime)) {
          handleSeekRef.current(details.seekTime);
        }
      });
    } catch (e) {
      console.warn('MediaSession setActionHandler error:', e);
    }
  }, []);

  // Update MediaSession metadata and playbackState dynamically
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    if (currentTrack) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentTrack.title,
          artist: currentTrack.artist,
          album: currentTrack.album || '',
          artwork: currentTrack.coverArt
            ? [{ src: currentTrack.coverArt, sizes: '512x512', type: 'image/jpeg' }]
            : [],
        });
      } catch (_) {}
    } else {
      navigator.mediaSession.metadata = null;
    }

    navigator.mediaSession.playbackState = !currentTrack ? 'none' : (isPlaying ? 'playing' : 'paused');
  }, [currentTrack, isPlaying]);

  const handleToggleRepeat = () => {
    setRepeatMode(prev => {
      const next = prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off';
      audioEngine.setRepeatMode(next);
      return next;
    });
  };

  const handleToggleFavorite = (trackId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setTracks(prev => prev.map(t => {
      if (t.id === trackId) {
        const updated = { ...t, isFavorite: !t.isFavorite };
        setPlaylists(pls => pls.map(p => {
          if (p.id === 'pl_favorites') {
            return {
              ...p,
              trackIds: updated.isFavorite ? [...p.trackIds, trackId] : p.trackIds.filter(id => id !== trackId),
            };
          }
          return p;
        }));
        return updated;
      }
      return t;
    }));
  };

  const handleAddTracksToFavorites = (trackIds: string[]) => {
    if (!trackIds || trackIds.length === 0) return;
    const idSet = new Set(trackIds);
    setTracks(prev => prev.map(t => idSet.has(t.id) ? { ...t, isFavorite: true } : t));
    // Also sync with the system favorites playlist
    setPlaylists(prev => prev.map(p => {
      if (p.id === 'pl_favorites') {
        const unique = Array.from(new Set([...p.trackIds, ...trackIds]));
        return { ...p, trackIds: unique };
      }
      return p;
    }));
  };

  const handleToggleTabVisibility = (tabId: MainViewType) => {
    setVisibleTabs(prev => {
      const visibleCount = Object.values(prev).filter(Boolean).length;
      if (prev[tabId] && visibleCount <= 1) return prev;

      const next = { ...prev, [tabId]: !prev[tabId] };
      if (prev[tabId] && currentView === tabId) {
        const order: MainViewType[] = ['tracks', 'playlists', 'albums', 'artists', 'favorites', 'genres'];
        const firstAvailable = order.find(id => next[id]) || 'tracks';
        setCurrentView(firstAvailable);
        setSelectedPlaylistId(null);
        setSelectedAlbum(null);
        setSelectedArtist(null);
        setSelectedGenre(null);
      }
      return next;
    });
  };

  const handlePlaySelected = () => {
    const selected = tracks.filter(t => selectedTrackIds.has(t.id));
    if (selected.length > 0) {
      playTrackWithContext(selected[0], selected);
    }
  };

  const handleAddSelectedToQueue = () => {
    const selected = tracks.filter(t => selectedTrackIds.has(t.id));
    setQueue(prev => [...prev, ...selected]);
    setSelectedTrackIds(new Set());
  };

  const handleDropTracksToPlaylist = (playlistId: string, trackIds: string[]) => {
    setPlaylists(prev => prev.map(p => {
      if (p.id === playlistId) {
        const unique = Array.from(new Set([...p.trackIds, ...trackIds]));
        return { ...p, trackIds: unique };
      }
      return p;
    }));
  };

  const handleCreatePlaylist = (folderId?: string | null, groupId?: string | null) => {
    setPlaylistCreationTarget({ folderId, groupId });
    setIsCreatePlaylistOpen(true);
  };

  const handleCreatePlaylistSubmit = (name: string, description?: string) => {
    const newPl: Playlist = {
      id: `pl_${Date.now()}`,
      name: name.trim(),
      description: description?.trim() || undefined,
      trackIds: Array.from(selectedTrackIds),
      isSystem: false,
      folderId: playlistCreationTarget?.folderId || null,
      groupId: playlistCreationTarget?.groupId || null,
      order: playlists.length,
    };
    setPlaylists(prev => [...prev, newPl]);
    selectedPlaylistIdRef.current = newPl.id;
    setSelectedPlaylistId(newPl.id);
    setSortBy('custom');
    setSortOrder('asc');
    setPlaylistCreationTarget(null);
  };

  // Open native playlists directory in explorer
  const handleOpenPlaylistsFolder = () => {
    if (isTauri()) {
      invoke('open_app_folder', { subfolder: 'playlists' }).catch(err => {
        console.warn('Failed to open playlists folder:', err);
      });
    }
  };

  // Export a playlist to standard M3U8 file
  const handleExportPlaylistM3U8 = async (playlist: Playlist) => {
    const plTracks = playlist.trackIds
      .map(id => tracks.find(t => t.id === id))
      .filter((t): t is Track => !!t);

    if (isTauri()) {
      try {
        const exportTracks = plTracks.map(t => ({
          path: t.path || null,
          artist: t.artist || 'Unknown Artist',
          title: t.title || 'Unknown Title',
          duration: t.duration || 0,
        }));
        await invoke('export_playlist_to_m3u8', {
          playlistName: playlist.name,
          tracks: exportTracks,
        });
      } catch (err) {
        console.warn('Failed to export playlist:', err);
      }
    } else {
      // Browser fallback: download blob
      let content = `#EXTM3U\n#PLAYLIST:${playlist.name}\n`;
      for (const t of plTracks) {
        content += `#EXTINF:${Math.round(t.duration || 0)},${t.artist} - ${t.title}\n`;
        content += `${t.path || t.src || t.title}\n`;
      }
      const blob = new Blob([content], { type: 'audio/x-mpegurl;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${playlist.name}.m3u8`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Import a playlist from standard M3U / M3U8 file
  const handleImportM3U8 = async () => {
    if (isTauri()) {
      try {
        const res = await invoke<{ name: string; paths: string[] } | null>('import_playlist_from_m3u8');
        if (res && res.paths.length > 0) {
          const metaList = await invoke<any[]>('read_audio_files', { paths: res.paths });
          if (metaList && metaList.length > 0) {
            const addedTracks: Track[] = metaList.map(m => ({
              id: m.id || `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              path: m.path,
              title: m.title || 'Unknown',
              artist: m.artist || 'Unknown Artist',
              album: m.album || 'Unknown Album',
              duration: m.duration_seconds || 0,
              src: convertFileSrc(m.path),
              coverArt: m.cover_art ? convertFileSrc(m.cover_art) : undefined,
              genre: m.genre || undefined,
              year: m.year || undefined,
              trackNumber: m.track_number || undefined,
              dateAdded: Date.now(),
              playCount: 0,
              isFavorite: false,
            }));

            const existingMap = new Map<string, string>(tracks.map(t => [normalizeTrackPath(t.path), t.id]));
            const newTrackIds: string[] = [];
            const tracksToAppend: Track[] = [];

            for (const t of addedTracks) {
              const norm = normalizeTrackPath(t.path);
              if (norm && existingMap.has(norm)) {
                newTrackIds.push(existingMap.get(norm)!);
              } else {
                if (norm) existingMap.set(norm, t.id);
                tracksToAppend.push(t);
                newTrackIds.push(t.id);
              }
            }

            if (tracksToAppend.length > 0) {
              setTracks(prev => appendUniqueTracks(prev, tracksToAppend));
            }

            const newPl: Playlist = {
              id: `pl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              name: res.name || 'Imported Playlist',
              trackIds: newTrackIds,
              isSystem: false,
              order: playlists.length,
            };
            setPlaylists(prev => [...prev, newPl]);
          }
        }
      } catch (err) {
        console.warn('Failed to import playlist:', err);
      }
    } else {
      // Browser fallback: HTML file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.m3u8,.m3u';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const text = await file.text();
        const lines = text.split('\n');
        let plName = file.name.replace(/\.(m3u8|m3u)$/i, '');
        const trackTitles: string[] = [];
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('#PLAYLIST:')) {
            plName = trimmed.replace('#PLAYLIST:', '').trim();
          } else if (!trimmed.startsWith('#') && trimmed.length > 0) {
            trackTitles.push(trimmed);
          }
        }
        const matchedIds: string[] = [];
        for (const title of trackTitles) {
          const found = tracks.find(t => t.title.toLowerCase() === title.toLowerCase() || t.path?.toLowerCase().includes(title.toLowerCase()));
          if (found) matchedIds.push(found.id);
        }
        const newPl: Playlist = {
          id: `pl_${Date.now()}`,
          name: plName,
          trackIds: matchedIds,
          isSystem: false,
          order: playlists.length,
        };
        setPlaylists(prev => [...prev, newPl]);
      };
      input.click();
    }
  };

  // Library folders management
  const handleAddWatchedFolder = (folder: string) => {
    if (!folder || watchedFolders.includes(folder)) return;
    setWatchedFolders(prev => [...prev, folder]);
  };

  const handleRemoveWatchedFolder = (folder: string) => {
    setWatchedFolders(prev => prev.filter(f => f !== folder));
  };

  const handleToggleAutoScanOnStartup = () => {
    setAutoScanOnStartup(prev => !prev);
  };

  const handleScanLibrary = useCallback(async (): Promise<number> => {
    if (!isTauri()) return 0;
    try {
      const portableMusicPath = await invoke<string>('get_portable_music_path');
      const foldersToScan = [portableMusicPath, ...watchedFolders];
      const raw = await invoke<any[]>('read_audio_files', { paths: foldersToScan });
      if (!raw || raw.length === 0) return 0;

      const currentTrackMap = new Map(tracksRef.current.map(t => [normalizeTrackPath(t.path), t]));
      const currentPaths = new Set(tracksRef.current.map(t => normalizeTrackPath(t.path)).filter(Boolean));
      const currentKeys = new Set(tracksRef.current.map(t => `${t.title.trim().toLowerCase()}|||${t.artist.trim().toLowerCase()}`));
      const newFound: Track[] = [];
      const updatedCoversMap = new Map<string, string>();

      for (const m of raw) {
        const norm = normalizeTrackPath(m.path);
        let coverArt = m.cover_art || undefined;
        if (coverArt && !coverArt.startsWith('http') && !coverArt.startsWith('data:') && isTauri()) {
          coverArt = convertFileSrc(coverArt);
        }

        const existingTrack = norm ? currentTrackMap.get(norm) : undefined;
        if (existingTrack) {
          if (!existingTrack.coverArt && coverArt) {
            updatedCoversMap.set(existingTrack.id, coverArt);
          }
          continue;
        }

        const key = `${(m.title || '').trim().toLowerCase()}|||${(m.artist || '').trim().toLowerCase()}`;
        if (key !== '|||' && key !== 'unknown|||unknown artist' && currentKeys.has(key)) {
          continue;
        }

        if (norm) currentPaths.add(norm);
        if (key !== '|||' && key !== 'unknown|||unknown artist') currentKeys.add(key);

        const newT: Track = {
          id: m.id || `track_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          path: m.path,
          title: m.title || 'Unknown',
          artist: m.artist || 'Unknown Artist',
          album: m.album || 'Unknown Album',
          duration: m.duration_seconds || 0,
          src: convertFileSrc(m.path),
          coverArt,
          genre: m.genre || undefined,
          year: m.year || undefined,
          trackNumber: m.track_number || undefined,
          dateAdded: Date.now(),
          playCount: 0,
          isFavorite: false,
        };
        newFound.push(newT);
      }

      if (updatedCoversMap.size > 0 || newFound.length > 0) {
        setTracks(prev => {
          let updated = prev;
          if (updatedCoversMap.size > 0) {
            updated = updated.map(t => {
              const newCover = updatedCoversMap.get(t.id);
              return newCover ? { ...t, coverArt: newCover } : t;
            });
          }
          if (newFound.length > 0) {
            updated = appendUniqueTracks(updated, newFound);
          }
          return updated;
        });
      }

      return newFound.length + updatedCoversMap.size;
    } catch (err) {
      console.warn('Scan library error:', err);
      return 0;
    }
  }, [watchedFolders]);

  // Missing tracks relocation and cleanup
  const handleRelocateMissingInFolder = async (): Promise<{ total: number; found: number } | null> => {
    if (!isTauri() || missingTracksForModal.length === 0) return null;
    try {
      const folder = await invoke<string | null>('pick_folder_dialog');
      if (!folder) return null;

      const missingPaths = missingTracksForModal
        .map(t => t.path)
        .filter((p): p is string => Boolean(p));

      const relocatedMap = await invoke<Record<string, string>>('find_relocated_tracks_in_folder', {
        searchDir: folder,
        missingPaths,
      });

      if (!relocatedMap) return { total: missingPaths.length, found: 0 };

      const foundCount = Object.keys(relocatedMap).length;
      if (foundCount > 0) {
        // Read updated metadata including folder cover art for the relocated files
        const metaMap: Record<string, any> = {};
        try {
          const newPaths = Object.values(relocatedMap);
          const metaList = await invoke<any[]>('read_audio_files', { paths: newPaths });
          if (metaList && Array.isArray(metaList)) {
            for (const m of metaList) {
              if (m?.path) {
                metaMap[m.path.toLowerCase()] = m;
              }
            }
          }
        } catch (e) {
          console.warn('Failed to read metadata for relocated tracks:', e);
        }

        setTracks(prev => prev.map(t => {
          if (t.path && relocatedMap[t.path]) {
            const newPath = relocatedMap[t.path];
            const meta = metaMap[newPath.toLowerCase()];
            let newCover = t.coverArt;
            if (meta?.cover_art) {
              newCover = convertFileSrc(meta.cover_art);
            }
            return {
              ...t,
              path: newPath,
              src: convertFileSrc(newPath),
              coverArt: newCover,
              isMissing: false,
            };
          }
          return t;
        }));

        setCurrentTrack(prev => {
          if (prev && prev.path && relocatedMap[prev.path]) {
            const newPath = relocatedMap[prev.path];
            const meta = metaMap[newPath.toLowerCase()];
            let newCover = prev.coverArt;
            if (meta?.cover_art) {
              newCover = convertFileSrc(meta.cover_art);
            }
            return {
              ...prev,
              path: newPath,
              src: convertFileSrc(newPath),
              coverArt: newCover,
              isMissing: false,
            };
          }
          return prev;
        });

        setMissingTracksForModal(prev => {
          const remaining = prev.filter(t => !t.path || !relocatedMap[t.path]);
          if (remaining.length === 0) {
            setIsMissingTracksModalOpen(false);
          }
          return remaining;
        });
      }

      return { total: missingPaths.length, found: foundCount };
    } catch (err) {
      console.warn('Error during relocated folder search:', err);
      return null;
    }
  };

  const handleClearMissingTracks = () => {
    const missingIds = new Set(missingTracksForModal.map(t => t.id));
    setTracks(prev => prev.filter(t => !missingIds.has(t.id)));
    setPlaylists(prev => prev.map(p => ({
      ...p,
      trackIds: p.trackIds.filter(id => !missingIds.has(id)),
    })));
    setIsMissingTracksModalOpen(false);
    setMissingTracksForModal([]);
  };

  const handleSelectPlaylist = (id: string) => {
    setDetailNavDirection('forward');
    selectedPlaylistIdRef.current = id;
    setSelectedPlaylistId(id);
    setSortBy('custom');
    setSortOrder('asc');
  };

  const handleReorderPlaylistTracks = (reorderedTrackIds: string[]) => {
    if (!selectedPlaylistId) return;
    setPlaylists(prev => prev.map(p => {
      if (p.id === selectedPlaylistId) {
        return { ...p, trackIds: reorderedTrackIds };
      }
      return p;
    }));
    setSortBy('custom');
    setSortOrder('asc');
  };

  const handleReorderFavoriteTracks = (reorderedTrackIds: string[]) => {
    setPlaylists(prev => prev.map(p => {
      if (p.id === 'pl_favorites') {
        return { ...p, trackIds: reorderedTrackIds };
      }
      return p;
    }));
    setSortBy('custom');
    setSortOrder('asc');
  };

  const handleOpenCreateFolder = (parentId?: string | null, groupId?: string | null) => {
    setFolderCreationTarget({ parentId, groupId });
    setIsCreateFolderOpen(true);
  };

  const handleCreateFolderSubmit = (name: string, color?: string, icon?: string, coverType?: FolderCoverType) => {
    const newFolder: PlaylistFolder = {
      id: `fld_${Date.now()}`,
      name: name.trim(),
      parentId: folderCreationTarget?.parentId || null,
      groupId: folderCreationTarget?.groupId || null,
      color: color || undefined,
      icon: icon || undefined,
      coverType: coverType || 'icon',
      createdAt: Date.now(),
      order: playlistFolders.length,
    };
    setPlaylistFolders(prev => [...prev, newFolder]);
    setFolderCreationTarget(null);
  };

  const handleSaveEditFolder = (name: string, color?: string, icon?: string, coverType?: FolderCoverType) => {
    if (!editingFolderTarget) return;
    setPlaylistFolders(prev => prev.map(f => {
      if (f.id === editingFolderTarget.id) {
        return {
          ...f,
          name: name.trim(),
          color: color || undefined,
          icon: icon || undefined,
          coverType: coverType || 'icon',
        };
      }
      return f;
    }));
    setEditingFolderTarget(null);
  };

  const handleCreateGroupSubmit = (name: string, color?: string, isIsolated?: boolean) => {
    const newGroup: PlaylistGroup = {
      id: `grp_${Date.now()}`,
      name: name.trim(),
      order: playlistGroups.length,
      isCollapsed: false,
      color: color || undefined,
      isIsolated: !!isIsolated,
    };
    setPlaylistGroups(prev => [...prev, newGroup]);
    setIsCreateGroupOpen(false);
  };

  const handleSaveEditGroup = (name: string, color?: string, isIsolated?: boolean) => {
    if (!editingGroupTarget) return;
    setPlaylistGroups(prev => prev.map(g => {
      if (g.id === editingGroupTarget.id) {
        return {
          ...g,
          name: name.trim(),
          color: color || undefined,
          isIsolated: !!isIsolated,
        };
      }
      return g;
    }));
    setEditingGroupTarget(null);
    setIsCreateGroupOpen(false);
  };

  const handleToggleGroupCollapse = (groupId: string) => {
    setPlaylistGroups(prev => prev.map(g => g.id === groupId ? { ...g, isCollapsed: !g.isCollapsed } : g));
  };

  const handleMoveGroup = (groupId: string, direction: 'up' | 'down') => {
    setPlaylistGroups(prev => {
      const idx = prev.findIndex(g => g.id === groupId);
      if (idx === -1) return prev;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[targetIdx];
      next[targetIdx] = temp;
      return next.map((g, i) => ({ ...g, order: i }));
    });
  };

  const handleReorderGroups = (reorderedGroups: PlaylistGroup[]) => {
    setPlaylistGroups(reorderedGroups.map((g, i) => ({ ...g, order: i })));
  };

  const handleDeleteGroup = (groupId: string) => {
    setPlaylists(prev => prev.map(p => p.groupId === groupId ? { ...p, groupId: null } : p));
    setPlaylistFolders(prev => prev.map(f => f.groupId === groupId ? { ...f, groupId: null } : f));
    setPlaylistGroups(prev => prev.filter(g => g.id !== groupId));
  };

  const handleConfirmDeleteFolder = () => {
    if (!deleteFolderTarget) return;
    const fid = deleteFolderTarget.id;
    const parentId = deleteFolderTarget.parentId || null;
    setPlaylists(prev => prev.map(p => p.folderId === fid ? { ...p, folderId: parentId } : p));
    setPlaylistFolders(prev => prev
      .filter(f => f.id !== fid)
      .map(f => f.parentId === fid ? { ...f, parentId } : f)
    );
    setDeleteFolderTarget(null);
  };

  const handleMovePlaylistToFolder = (playlistId: string, folderId: string | null) => {
    setPlaylists(prev => prev.map(p => p.id === playlistId ? { ...p, folderId, groupId: null } : p));
  };

  const handleMovePlaylistToGroup = (playlistId: string, groupId: string | null) => {
    setPlaylists(prev => prev.map(p => p.id === playlistId ? { ...p, groupId, folderId: null } : p));
  };

  const handleMoveFolderToFolder = (folderId: string, targetParentId: string | null) => {
    const isDescendant = (parent: string, child: string): boolean => {
      if (parent === child) return true;
      const direct = playlistFolders.filter(f => f.parentId === child);
      return direct.some(d => isDescendant(parent, d.id));
    };
    if (targetParentId && isDescendant(targetParentId, folderId)) {
      return;
    }
    setPlaylistFolders(prev => prev.map(f => f.id === folderId ? { ...f, parentId: targetParentId, groupId: null } : f));
  };

  const handleMoveFolderToGroup = (folderId: string, groupId: string | null) => {
    setPlaylistFolders(prev => prev.map(f => f.id === folderId ? { ...f, groupId, parentId: null } : f));
  };

  const getFolderAllTracks = (folder: PlaylistFolder): Track[] => {
    const getSubfolderIds = (fid: string): string[] => {
      const directChildren = playlistFolders.filter(f => f.parentId === fid).map(f => f.id);
      let all = [fid];
      for (const childId of directChildren) {
        all = [...all, ...getSubfolderIds(childId)];
      }
      return all;
    };
    const targetFolderIds = new Set(getSubfolderIds(folder.id));
    const folderPlaylists = playlists.filter(p => p.folderId && targetFolderIds.has(p.folderId));
    const trackMap = new Map<string, Track>(tracks.map(t => [t.id, t]));
    const result: Track[] = [];
    const addedIds = new Set<string>();

    for (const pl of folderPlaylists) {
      for (const tid of pl.trackIds) {
        if (!addedIds.has(tid)) {
          addedIds.add(tid);
          const t = trackMap.get(tid);
          if (t) result.push(t);
        }
      }
    }
    return result;
  };

  const getOrderedPlaylistTracks = (playlist: Playlist): Track[] => {
    const trackMap = new Map<string, Track>(tracks.map(t => [t.id, t]));
    const result: Track[] = [];
    for (const id of playlist.trackIds) {
      const t = trackMap.get(id);
      if (t) result.push(t);
    }
    return result;
  };

  const handlePlayFolder = (folder: PlaylistFolder) => {
    const folderTracks = getFolderAllTracks(folder);
    if (folderTracks.length > 0) {
      playTrackWithContext(folderTracks[0], folderTracks);
    }
  };

  const handleAddFolderToQueue = (folder: PlaylistFolder) => {
    const folderTracks = getFolderAllTracks(folder);
    if (folderTracks.length > 0) {
      setQueue(prev => [...prev, ...folderTracks]);
    }
  };

  const handleRenameItem = (newName: string, newDescription?: string) => {
    if (!renameItemTarget) return;
    const { type, item } = renameItemTarget;
    if (type === 'playlist') {
      const descVal = newDescription !== undefined ? (newDescription.trim() || undefined) : undefined;
      setPlaylists(prev => prev.map(p => p.id === item.id ? { 
        ...p, 
        name: newName, 
        description: newDescription !== undefined ? descVal : p.description 
      } : p));
    } else if (type === 'folder') {
      setPlaylistFolders(prev => prev.map(f => f.id === item.id ? { ...f, name: newName } : f));
    } else if (type === 'group') {
      setPlaylistGroups(prev => prev.map(g => g.id === item.id ? { ...g, name: newName } : g));
    }
    setRenameItemTarget(null);
  };

  const handlePlayPlaylist = (playlist: Playlist) => {
    const plTracks = getOrderedPlaylistTracks(playlist);
    if (plTracks.length > 0) {
      playTrackWithContext(plTracks[0], plTracks);
    }
  };

  const handlePlayAlbum = (albumTracks: Track[]) => {
    if (albumTracks.length === 0) return;
    playTrackWithContext(albumTracks[0], albumTracks);
  };

  const handlePlayArtist = (artistTracks: Track[]) => {
    if (artistTracks.length === 0) return;
    playTrackWithContext(artistTracks[0], artistTracks);
  };

  const handlePlayGenre = (genreTracks: Track[]) => {
    if (genreTracks.length === 0) return;
    playTrackWithContext(genreTracks[0], genreTracks);
  };

  const handleAddPlaylistToQueue = (playlist: Playlist) => {
    const plTracks = getOrderedPlaylistTracks(playlist);
    setQueue(prev => [...prev, ...plTracks]);
  };

  const handleRenamePlaylist = (playlist: Playlist) => {
    setRenamePlaylistTarget(playlist);
  };

  const handleConfirmRenamePlaylist = (playlist: Playlist, newName: string) => {
    setPlaylists(prev => prev.map(p => p.id === playlist.id ? { ...p, name: newName } : p));
  };

  const handleClearPlaylist = (playlist: Playlist) => {
    setClearPlaylistTarget(playlist);
  };

  const handleConfirmClearPlaylist = () => {
    if (!clearPlaylistTarget) return;
    setPlaylists(prev => prev.map(p => p.id === clearPlaylistTarget.id ? { ...p, trackIds: [] } : p));
    setClearPlaylistTarget(null);
  };

  const handleDeletePlaylist = (playlist: Playlist) => {
    setDeletePlaylistTarget(playlist);
  };

  const handleConfirmDeletePlaylist = () => {
    if (!deletePlaylistTarget) return;
    setPlaylists(prev => prev.filter(p => p.id !== deletePlaylistTarget.id));
    if (selectedPlaylistId === deletePlaylistTarget.id) {
      setSelectedPlaylistId(null);
    }
    setDeletePlaylistTarget(null);
  };

  const handleSaveBatchTags = async (updates: {
    artist?: string;
    album?: string;
    genre?: string;
    year?: number;
    title?: string;
    trackNumber?: number;
    trackTotal?: number;
    composer?: string;
    contentGroup?: string;
    comment?: string;
    conductor?: string;
    lyricist?: string;
    coverArt?: string | null;
  }, targetTracks?: Track[]) => {
    const targetIds = new Set(targetTracks && targetTracks.length > 0 ? targetTracks.map(t => t.id) : Array.from(selectedTrackIds));

    setTracks(prev => prev.map(t => {
      if (targetIds.has(t.id)) {
        return {
          ...t,
          title: updates.title !== undefined ? updates.title : t.title,
          artist: updates.artist !== undefined ? updates.artist : t.artist,
          album: updates.album !== undefined ? updates.album : t.album,
          genre: updates.genre !== undefined ? updates.genre : t.genre,
          year: updates.year !== undefined ? updates.year : t.year,
          trackNumber: updates.trackNumber !== undefined ? updates.trackNumber : t.trackNumber,
          trackTotal: updates.trackTotal !== undefined ? updates.trackTotal : t.trackTotal,
          composer: updates.composer !== undefined ? updates.composer : t.composer,
          contentGroup: updates.contentGroup !== undefined ? updates.contentGroup : t.contentGroup,
          comment: updates.comment !== undefined ? updates.comment : t.comment,
          conductor: updates.conductor !== undefined ? updates.conductor : t.conductor,
          lyricist: updates.lyricist !== undefined ? updates.lyricist : t.lyricist,
          coverArt: updates.coverArt !== undefined ? (updates.coverArt || undefined) : t.coverArt,
        };
      }
      return t;
    }));

    if (currentTrack && targetIds.has(currentTrack.id)) {
      setCurrentTrack(prev => prev ? {
        ...prev,
        title: updates.title !== undefined ? updates.title : prev.title,
        artist: updates.artist !== undefined ? updates.artist : prev.artist,
        album: updates.album !== undefined ? updates.album : prev.album,
        genre: updates.genre !== undefined ? updates.genre : prev.genre,
        year: updates.year !== undefined ? updates.year : prev.year,
        trackNumber: updates.trackNumber !== undefined ? updates.trackNumber : prev.trackNumber,
        trackTotal: updates.trackTotal !== undefined ? updates.trackTotal : prev.trackTotal,
        composer: updates.composer !== undefined ? updates.composer : prev.composer,
        contentGroup: updates.contentGroup !== undefined ? updates.contentGroup : prev.contentGroup,
        comment: updates.comment !== undefined ? updates.comment : prev.comment,
        conductor: updates.conductor !== undefined ? updates.conductor : prev.conductor,
        lyricist: updates.lyricist !== undefined ? updates.lyricist : prev.lyricist,
        coverArt: updates.coverArt !== undefined ? (updates.coverArt || undefined) : prev.coverArt,
      } : null);
    }

    // Persist tags and cover art to audio files on disk if running in Tauri
    if (isTauri()) {
      const sourceTracks = targetTracks && targetTracks.length > 0
        ? targetTracks
        : tracks.filter(t => targetIds.has(t.id));
      const paths = sourceTracks.map(t => t.path).filter((p): p is string => Boolean(p));
      if (paths.length > 0) {
        try {
          await invoke('batch_save_track_file_tags', {
            paths,
            updates: {
              title: updates.title,
              artist: updates.artist,
              album: updates.album,
              genre: updates.genre,
              year: updates.year,
              track_number: updates.trackNumber,
              track_total: updates.trackTotal,
              composer: updates.composer,
              content_group: updates.contentGroup,
              comment: updates.comment,
              conductor: updates.conductor,
              lyricist: updates.lyricist,
              cover_art: updates.coverArt !== undefined ? (updates.coverArt || '') : undefined,
            }
          });
        } catch (e) {
          console.error('Failed to save tags to files:', e);
          alert(language === 'ru' ? `Ошибка сохранения тегов в файл: ${e}` : `Failed to save tags to file: ${e}`);
        }
      }
    }
  };

  const handleSaveLyrics = async (trackId: string, lyrics: string, isInstrumental: boolean, lyricist?: string) => {
    setTracks(prev => prev.map(t => {
      if (t.id === trackId) {
        return { 
          ...t, 
          lyrics, 
          isInstrumental,
          lyricist: lyricist !== undefined ? lyricist : t.lyricist
        };
      }
      return t;
    }));
    if (currentTrack?.id === trackId) {
      setCurrentTrack(prev => prev ? { 
        ...prev, 
        lyrics, 
        isInstrumental,
        lyricist: lyricist !== undefined ? lyricist : prev.lyricist
      } : null);
    }

    // Embed lyrics and lyricist directly into the audio file tags on disk!
    const targetTrack = tracksRef.current.find(t => t.id === trackId);
    if (isTauri() && targetTrack?.path) {
      try {
        await invoke('save_track_lyrics', { 
          path: targetTrack.path, 
          lyrics: isInstrumental ? '' : lyrics,
          lyricist: lyricist !== undefined ? lyricist : undefined
        });
      } catch (err) {
        console.warn('Failed to embed lyrics into audio file on disk:', err);
      }
    }
  };

  const handleReloadTracks = async (trackIds: string[]) => {
    if (!isTauri() || trackIds.length === 0) return;
    const targetTracks = tracksRef.current.filter(t => trackIds.includes(t.id) && t.path);
    if (targetTracks.length === 0) return;

    try {
      const paths = targetTracks.map(t => t.path as string);
      const reloaded = await invoke<any[]>('read_audio_files', { paths });
      if (reloaded && reloaded.length > 0) {
        const reloadedMap = new Map<string, any>(reloaded.map(r => [normalizeTrackPath(r.path), r]));

        setTracks(prev => prev.map(t => {
          if (!t.path) return t;
          const r = reloadedMap.get(normalizeTrackPath(t.path));
          if (!r) return t;
          let coverArt = r.cover_art;
          if (coverArt && !coverArt.startsWith('http') && !coverArt.startsWith('data:') && isTauri()) {
            coverArt = convertFileSrc(coverArt);
          }
          return {
            ...t,
            title: r.title,
            artist: r.artist,
            album: r.album,
            duration: r.duration_seconds || t.duration,
            coverArt: coverArt !== undefined ? coverArt : t.coverArt,
            genre: r.genre || undefined,
            year: r.year || undefined,
            trackNumber: r.track_number || undefined,
            trackTotal: r.track_total || undefined,
            lyrics: r.lyrics || undefined,
            composer: r.composer || undefined,
            contentGroup: r.content_group || undefined,
            comment: r.comment || undefined,
            conductor: r.conductor || undefined,
            lyricist: r.lyricist || undefined,
            format: r.format || t.format,
            fileSize: r.file_size || t.fileSize,
          };
        }));

        setCurrentTrack(prev => {
          if (!prev || !prev.path) return prev;
          const r = reloadedMap.get(normalizeTrackPath(prev.path));
          if (!r) return prev;
          let coverArt = r.cover_art;
          if (coverArt && !coverArt.startsWith('http') && !coverArt.startsWith('data:') && isTauri()) {
            coverArt = convertFileSrc(coverArt);
          }
          return {
            ...prev,
            title: r.title,
            artist: r.artist,
            album: r.album,
            duration: r.duration_seconds || prev.duration,
            coverArt: coverArt !== undefined ? coverArt : prev.coverArt,
            genre: r.genre || undefined,
            year: r.year || undefined,
            trackNumber: r.track_number || undefined,
            trackTotal: r.track_total || undefined,
            lyrics: r.lyrics || undefined,
            composer: r.composer || undefined,
            contentGroup: r.content_group || undefined,
            comment: r.comment || undefined,
            conductor: r.conductor || undefined,
            lyricist: r.lyricist || undefined,
            format: r.format || prev.format,
            fileSize: r.file_size || prev.fileSize,
          };
        });

        setQueue(prev => prev.map(t => {
          if (!t.path) return t;
          const r = reloadedMap.get(normalizeTrackPath(t.path));
          if (!r) return t;
          let coverArt = r.cover_art;
          if (coverArt && !coverArt.startsWith('http') && !coverArt.startsWith('data:') && isTauri()) {
            coverArt = convertFileSrc(coverArt);
          }
          return {
            ...t,
            title: r.title,
            artist: r.artist,
            album: r.album,
            duration: r.duration_seconds || t.duration,
            coverArt: coverArt !== undefined ? coverArt : t.coverArt,
            genre: r.genre || undefined,
            year: r.year || undefined,
            trackNumber: r.track_number || undefined,
            trackTotal: r.track_total || undefined,
            lyrics: r.lyrics || undefined,
            composer: r.composer || undefined,
            contentGroup: r.content_group || undefined,
            comment: r.comment || undefined,
            conductor: r.conductor || undefined,
            lyricist: r.lyricist || undefined,
            format: r.format || t.format,
            fileSize: r.file_size || t.fileSize,
          };
        }));
      }
    } catch (err) {
      console.warn('Failed to reload track metadata from disk:', err);
    }
  };

  const handleSortChange = (col: string) => {
    if (sortBy === col) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortOrder('asc');
    }
  };

  const handleRemoveTracks = (trackIds: string[]) => {
    const idSet = new Set(trackIds);
    if (selectedPlaylistId) {
      setPlaylists(prev => prev.map(p => {
        if (p.id === selectedPlaylistId) {
          return { ...p, trackIds: p.trackIds.filter(id => !idSet.has(id)) };
        }
        return p;
      }));
    } else {
      setTracks(prev => prev.filter(t => !idSet.has(t.id)));
      setQueue(prev => prev.filter(t => !idSet.has(t.id)));
      setPlaylists(prev => prev.map(p => ({
        ...p,
        trackIds: p.trackIds.filter(id => !idSet.has(id))
      })));
    }
    if (currentTrack && idSet.has(currentTrack.id)) {
      audioEngine.pause();
      setIsPlaying(false);
      setCurrentTrack(null);
    }
    setSelectedTrackIds(new Set());
  };

  const handleRequestRemoveTracks = (trackIds: string[]) => {
    if (trackIds.length === 0) return;
    setDeleteTracksTarget(trackIds);
  };

  const handleConfirmRemoveTracks = () => {
    if (!deleteTracksTarget || deleteTracksTarget.length === 0) return;
    handleRemoveTracks(deleteTracksTarget);
    setDeleteTracksTarget(null);
  };

  const handleRequestDeleteFromDisk = (trackIds: string[]) => {
    if (trackIds.length === 0) return;
    setDeleteFromDiskTarget(trackIds);
  };

  const handleConfirmDeleteFromDisk = async () => {
    if (!deleteFromDiskTarget || deleteFromDiskTarget.length === 0) return;
    const targetIds = deleteFromDiskTarget;
    setDeleteFromDiskTarget(null);

    const targetTracks = tracks.filter(t => targetIds.includes(t.id));
    const pathsToDelete = targetTracks.map(t => t.path).filter((p): p is string => Boolean(p));

    // If currently playing track is being deleted, stop playback immediately to free file locks
    if (currentTrack && targetIds.includes(currentTrack.id)) {
      audioEngine.stop();
      setCurrentTrack(null);
      setIsPlaying(false);
    }

    if (isTauri() && pathsToDelete.length > 0) {
      try {
        await invoke('delete_files_from_disk', { paths: pathsToDelete });
      } catch (err) {
        console.warn('Failed to delete files from disk:', err);
      }
    }

    // Remove from tracks (library)
    const idSet = new Set(targetIds);
    setTracks(prev => prev.filter(t => !idSet.has(t.id)));

    // Remove from all playlists
    setPlaylists(prev => prev.map(p => ({
      ...p,
      trackIds: p.trackIds.filter(id => !idSet.has(id)),
    })));

    // Remove from queue
    setQueue(prev => prev.filter(t => !idSet.has(t.id)));

    // Clear selection
    setSelectedTrackIds(prev => {
      const next = new Set(prev);
      for (const id of targetIds) {
        next.delete(id);
      }
      return next;
    });
  };

  const selectedTracksList = useMemo(() => {
    return tracks.filter(t => selectedTrackIds.has(t.id));
  }, [tracks, selectedTrackIds]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-md3-background text-md3-on-background select-none font-sans">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.flac,.wav,.ogg,.m4a,.aac,.opus,.wma"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            importFiles(Array.from(e.target.files));
          }
        }}
      />

      {/* Drag & Drop Visual Overlay */}
      <DragDropOverlay isDragging={isDraggingFile} language={language} />

      {/* Custom Window Title Bar (Frameless Desktop Window Controls) */}
      <TitleBar />

      {/* Top Header Bar with App Logo, Navigation Pills, Search & Quick Actions */}
      <TopBar
        currentView={currentView}
        onSelectView={handleSelectView}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        totalTracksCount={nonIsolatedTracks.length}
        searchPlaceholder={searchPlaceholder}
        onOpenFiles={handleOpenFiles}
        themeMode={themeMode}
        onToggleTheme={() => {
          if (themeMode === 'dark') setThemeMode('amoled');
          else if (themeMode === 'amoled') setThemeMode('light');
          else setThemeMode('dark');
        }}
        onOpenEQ={() => setIsEQOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        discordEnabled={discordEnabled}
        onToggleDiscord={() => setDiscordEnabled(!discordEnabled)}
        showDiscordButton={showDiscordButton}
        visibleTabs={visibleTabs}
        language={language}
        hasUpdate={hasUpdate}
      />

      {/* Main Content Area (Full width, No sidebar) */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-md3-surface overflow-hidden">
        {/* If a sub-view is active (Album, Artist, Genre, or Playlist) */}
        {currentDetail ? (
          <div key={`detail-${currentDetail.title}`} className={`flex-1 flex flex-col min-h-0 overflow-hidden ${detailNavDirection === 'forward' ? 'anim-view-slide-right' : ''}`}>
            {/* Header Banner */}
            <div className="px-4 sm:px-6 py-4 sm:py-5 bg-md3-surface-container-low border-b border-md3-outline-variant/15 flex items-center justify-between shrink-0 gap-3 select-none">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                {/* Dedicated Round Back Button */}
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleBackToGrid}
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-md3-surface hover:bg-md3-surface-container-high text-md3-primary border border-md3-outline-variant/20 flex items-center justify-center transition-all cursor-pointer outline-none focus:outline-none shrink-0 shadow-xs hover:scale-105 active:scale-95 group/back"
                  title={language === 'ru' ? 'Назад (нажмите для возврата) [Esc]' : 'Back (click to return) [Esc]'}
                >
                  <ArrowLeft className="w-5 h-5 text-md3-primary group-hover/back:-translate-x-0.5 transition-transform" />
                </button>

                {/* Cover art (clean presentation without back overlay) */}
                <div 
                  className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shadow-md shrink-0 border border-md3-outline-variant/20 select-none bg-md3-surface-container-high"
                >
                  <div className="w-full h-full bg-md3-primary/10 text-md3-primary flex items-center justify-center absolute inset-0 z-0">
                    {currentDetail.icon}
                  </div>
                  {currentDetail.coverArt && (
                    <img 
                      src={currentDetail.coverArt} 
                      alt={currentDetail.title} 
                      className="w-full h-full object-cover relative z-0" 
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="text-lg sm:text-xl md:text-2xl font-extrabold text-md3-on-surface truncate leading-tight">
                    {currentDetail.title}
                  </h2>
                  <p className="text-xs sm:text-sm text-md3-on-surface-variant font-medium mt-1 truncate">
                    {currentDetail.subtitle}
                  </p>
                </div>
              </div>

              {/* Action Buttons: Only Play All */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    if (filteredTracks.length > 0) {
                      playTrackWithContext(filteredTracks[0], filteredTracks);
                    }
                  }}
                  title={language === 'ru' ? 'Воспроизвести всё' : 'Play All'}
                  className={`flex items-center justify-center gap-1.5 ${
                    isCompact ? 'w-10 h-10 p-0 rounded-full' : 'px-4 py-2.5 rounded-full'
                  } bg-md3-primary text-md3-on-primary text-xs font-bold shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0`}
                >
                  <Play className="w-4.5 h-4.5 fill-current ml-0.5" />
                  {!isCompact && <span>{language === 'ru' ? 'Воспроизвести всё' : 'Play All'}</span>}
                </button>
              </div>
            </div>

            {/* Track Table */}
            <TrackTable
              tracks={filteredTracks}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              selectedTrackIds={selectedTrackIds}
              onSelectTrack={handleSelectTrack}
              onPlayTrack={(t) => playTrackWithContext(t, filteredTracks)}
              onTogglePlayPause={handlePlayPause}
              onToggleFavorite={handleToggleFavorite}
              onOpenContextMenu={(e, track) => {
                e.preventDefault();
                setContextMenu({ x: e.clientX, y: e.clientY, track });
              }}
              onOpenBatchTagEditor={() => setIsBatchTagEditorOpen(true)}
              onAddSelectedToQueue={handleAddSelectedToQueue}
              onPlaySelected={handlePlaySelected}
              onClearSelection={() => setSelectedTrackIds(new Set())}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={handleSortChange}
              onDropFiles={importFiles}
              onDropInternalTracks={selectedPlaylistId ? (tIds) => handleDropTracksToPlaylist(selectedPlaylistId, tIds) : undefined}
              onAddTracksToFavorites={handleAddTracksToFavorites}
              currentView={currentView}
              isReorderable={Boolean(selectedPlaylistId) && !searchQuery.trim()}
              onReorderTracks={selectedPlaylistId ? handleReorderPlaylistTracks : undefined}
              onRelocateTrack={handleRelocateTrack}
              language={language}
            />
          </div>
        ) : currentView === 'playlists' ? (
          <div key="playlists-grid-view" className={`flex-1 flex flex-col min-h-0 overflow-hidden ${detailNavDirection === 'backward' ? 'anim-view-slide-left' : ''}`}>
            <PlaylistsGridView
              playlists={playlists}
              folders={playlistFolders}
              groups={playlistGroups}
              tracks={tracks}
              searchQuery={searchQuery}
              language={language}
              onSelectPlaylist={handleSelectPlaylist}
              onCreatePlaylist={handleCreatePlaylist}
              onCreateFolder={handleOpenCreateFolder}
              onCreateGroup={() => {
                setEditingGroupTarget(null);
                setIsCreateGroupOpen(true);
              }}
              onImportM3U8={handleImportM3U8}
              onOpenPlaylistsFolder={isTauri() ? handleOpenPlaylistsFolder : undefined}
              onPlayPlaylist={handlePlayPlaylist}
              onPlayFolder={handlePlayFolder}
              onOpenPlaylistContextMenu={(e, pl) => {
                e.preventDefault();
                setPlaylistContextMenu({ x: e.clientX, y: e.clientY, playlist: pl });
              }}
              onOpenFolderContextMenu={(e, folder) => {
                e.preventDefault();
                setFolderContextMenu({ x: e.clientX, y: e.clientY, folder });
              }}
              onToggleGroupCollapse={handleToggleGroupCollapse}
              onMoveGroup={handleMoveGroup}
              onReorderGroups={handleReorderGroups}
              onRenameGroup={(grp) => {
                setEditingGroupTarget(grp);
                setIsCreateGroupOpen(true);
              }}
              onEditGroup={(grp) => {
                setEditingGroupTarget(grp);
                setIsCreateGroupOpen(true);
              }}
              onDeleteGroup={handleDeleteGroup}
              onMovePlaylistToFolder={handleMovePlaylistToFolder}
              onMovePlaylistToGroup={handleMovePlaylistToGroup}
              onMoveFolderToFolder={handleMoveFolderToFolder}
              onMoveFolderToGroup={handleMoveFolderToGroup}
              onReorderPlaylists={setPlaylists}
              onReorderFolders={setPlaylistFolders}
              onReorderItems={(newPlaylists, newFolders) => {
                setPlaylists(newPlaylists);
                setPlaylistFolders(newFolders);
              }}
              onEditFolder={(folder) => setEditingFolderTarget(folder)}
            />
          </div>
        ) : currentView === 'albums' ? (
          <AlbumsGridView
            tracks={nonIsolatedTracks}
            searchQuery={searchQuery}
            language={language}
            onSelectAlbum={(alb) => {
              setDetailNavDirection('forward');
              setSelectedAlbum(alb);
            }}
            onPlayAlbum={handlePlayAlbum}
          />
        ) : currentView === 'artists' ? (
          <ArtistsGridView
            tracks={nonIsolatedTracks}
            searchQuery={searchQuery}
            language={language}
            onSelectArtist={(art) => {
              setDetailNavDirection('forward');
              setSelectedArtist(art);
            }}
            onPlayArtist={handlePlayArtist}
          />
        ) : currentView === 'genres' ? (
          <GenresGridView
            tracks={nonIsolatedTracks}
            searchQuery={searchQuery}
            language={language}
            onSelectGenre={(gen) => {
              setDetailNavDirection('forward');
              setSelectedGenre(gen);
            }}
            onPlayGenre={handlePlayGenre}
          />
        ) : (
          /* 'tracks' and 'favorites' */
          <TrackTable
            tracks={filteredTracks}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            selectedTrackIds={selectedTrackIds}
            onSelectTrack={handleSelectTrack}
            onPlayTrack={(t) => playTrackWithContext(t, filteredTracks)}
            onTogglePlayPause={handlePlayPause}
            onToggleFavorite={handleToggleFavorite}
            onOpenContextMenu={(e, track) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY, track });
            }}
            onOpenBatchTagEditor={() => setIsBatchTagEditorOpen(true)}
            onAddSelectedToQueue={handleAddSelectedToQueue}
            onPlaySelected={handlePlaySelected}
            onClearSelection={() => setSelectedTrackIds(new Set())}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={handleSortChange}
            onDropFiles={importFiles}
            isReorderable={currentView === 'favorites' && !searchQuery.trim()}
            onReorderTracks={currentView === 'favorites' ? handleReorderFavoriteTracks : undefined}
            onRelocateTrack={handleRelocateTrack}
            language={language}
          />
        )}
      </main>

      {/* Now Playing Bottom Bar */}
      <NowPlayingBar
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        isMuted={isMuted}
        repeatMode={repeatMode}
        isShuffled={isShuffled}
        queueCount={queue.length}
        isQueueOpen={isQueueOpen}
        language={language}
        onPlayPause={handlePlayPause}
        onPrev={handlePrev}
        onNext={handleNext}
        onSeek={handleSeek}
        onVolumeChange={handleVolumeChange}
        onToggleMute={handleToggleMute}
        onToggleShuffle={handleToggleShuffle}
        onToggleRepeat={handleToggleRepeat}
        onToggleQueue={() => setIsQueueOpen(!isQueueOpen)}
        onToggleFavorite={handleToggleFavorite}
        onOpenFiles={handleOpenFiles}
        onOpenEQ={() => setIsEQOpen(true)}
        discordEnabled={discordEnabled}
        onToggleDiscord={() => setDiscordEnabled(!discordEnabled)}
        showDiscordButton={showDiscordButton}
        onOpenTrackDetails={(t) => setTrackDetailsTarget(t)}
        onOpenLyrics={() => {
          if (currentTrack) setIsLyricsOpen(true);
        }}
      />

      {/* Queue Drawer */}
      <QueueDrawer
        isOpen={isQueueOpen}
        onClose={() => setIsQueueOpen(false)}
        queue={queue}
        queueIndex={queueIndex}
        currentTrack={currentTrack}
        language={language}
        isCompact={windowWidth < 780}
        onPlayQueueTrack={(idx) => {
          playQueueIndex(idx);
        }}
        onRemoveFromQueue={(idx) => {
          const newQueue = queue.filter((_, i) => i !== idx);
          setQueue(newQueue);
          if (idx < queueIndex) {
            setQueueIndex(prev => Math.max(0, prev - 1));
          } else if (idx === queueIndex) {
            if (newQueue.length === 0) {
              handleClearQueue();
            } else {
              const nextIdx = Math.min(idx, newQueue.length - 1);
              playQueueIndex(nextIdx);
            }
          }
        }}
        onClearQueue={handleClearQueue}
        onShuffleQueue={() => {
          const shuffled = [...queue].sort(() => Math.random() - 0.5);
          setQueue(shuffled);
          if (currentTrack) {
            const newIdx = shuffled.findIndex(t => t.id === currentTrack.id);
            if (newIdx !== -1) setQueueIndex(newIdx);
          }
        }}
        onMoveQueueTrack={(from, to) => {
          setQueue(prev => {
            const copy = [...prev];
            const [moved] = copy.splice(from, 1);
            copy.splice(to, 0, moved);
            return copy;
          });
          if (queueIndex === from) {
            setQueueIndex(to);
          } else if (from < queueIndex && to >= queueIndex) {
            setQueueIndex(prev => prev - 1);
          } else if (from > queueIndex && to <= queueIndex) {
            setQueueIndex(prev => prev + 1);
          }
        }}
      />

      {/* Batch Tag Editor Modal */}
      <BatchTagEditorModal
        isOpen={isBatchTagEditorOpen}
        onClose={() => setIsBatchTagEditorOpen(false)}
        selectedTracks={selectedTracksList}
        language={language}
        onSaveTags={handleSaveBatchTags}
      />

      {/* 10-Band Equalizer Modal */}
      <EqualizerModal
        isOpen={isEQOpen}
        language={language}
        onClose={() => setIsEQOpen(false)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        themeMode={themeMode}
        onSetThemeMode={setThemeMode}
        colorSchemeMode={colorSchemeMode}
        onSetColorSchemeMode={setColorSchemeMode}
        seedColor={seedColor}
        onSetSeedColor={setSeedColor}
        appTheme={appTheme}
        onSetAppTheme={setAppTheme}
        secondarySeedColor={secondarySeedColor}
        onSetSecondarySeedColor={setSecondarySeedColor}
        language={language}
        onSetLanguage={setLanguage}
        discordEnabled={discordEnabled}
        onToggleDiscord={() => setDiscordEnabled(!discordEnabled)}
        showDiscordButton={showDiscordButton}
        onToggleShowDiscordButton={() => setShowDiscordButton(prev => !prev)}
        discordShowPlayIcon={discordShowPlayIcon}
        onToggleDiscordPlayIcon={() => setDiscordShowPlayIcon(prev => !prev)}
        discordShowPauseIcon={discordShowPauseIcon}
        onToggleDiscordPauseIcon={() => setDiscordShowPauseIcon(prev => !prev)}
        discordStatusMode={discordStatusMode}
        onSetDiscordStatusMode={setDiscordStatusMode}
        discordCustomClientId={discordCustomClientId}
        onSetDiscordCustomClientId={setDiscordCustomClientId}
        visibleTabs={visibleTabs}
        onToggleTabVisibility={handleToggleTabVisibility}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        fadeMode={fadeMode}
        onSetFadeMode={setFadeMode}
        fadeDuration={fadeDuration}
        onSetFadeDuration={setFadeDuration}
        hasUpdate={hasUpdate}
        cachedReleaseData={cachedReleaseData}
        onUpdateFound={() => setHasUpdate(true)}
        autoUpdateEnabled={autoUpdateEnabled}
        onSetAutoUpdateEnabled={handleSetAutoUpdateEnabled}
        autoUpdateInterval={autoUpdateInterval}
        onSetAutoUpdateInterval={handleSetAutoUpdateInterval}
        customThemesList={customThemesList}
        onRefreshCustomThemes={refreshCustomThemes}
        onDeleteCustomTheme={handleDeleteCustomTheme}
        themePaletteColors={themePaletteColors}
        onUpdateThemePaletteColor={handleUpdateThemePaletteColor}
        onResetThemePalette={handleResetThemePalette}
        themeToggles={themeToggles}
        onToggleThemeOption={handleToggleThemeOption}
        watchedFolders={watchedFolders}
        onAddWatchedFolder={handleAddWatchedFolder}
        onRemoveWatchedFolder={handleRemoveWatchedFolder}
        autoScanOnStartup={autoScanOnStartup}
        onToggleAutoScanOnStartup={handleToggleAutoScanOnStartup}
        onScanLibrary={handleScanLibrary}
        tracks={tracks}
        missingTracksCount={missingTracksForModal.length}
        onOpenMissingTracksModal={() => setIsMissingTracksModalOpen(true)}
      />

      {/* Track Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          track={contextMenu.track}
          selectedTrackIds={selectedTrackIds}
          playlists={playlists}
          language={language}
          onClose={() => setContextMenu(null)}
          onPlay={(t) => playTrackWithContext(t, filteredTracks)}
          onAddToQueue={(t) => setQueue(prev => [...prev, ...t])}
          onPlayNext={(t) => {
            setQueue(prev => {
              const copy = [...prev];
              copy.splice(queueIndex + 1, 0, ...t);
              return copy;
            });
          }}
          onOpenTagEditor={() => {
            if (!selectedTrackIds.has(contextMenu.track.id)) {
              setSelectedTrackIds(new Set([contextMenu.track.id]));
            }
            setIsBatchTagEditorOpen(true);
          }}
          onToggleFavorite={handleToggleFavorite}
          onAddToPlaylist={handleDropTracksToPlaylist}
          onRemoveTracks={handleRequestRemoveTracks}
          onDeleteFromDisk={handleRequestDeleteFromDisk}
          onOpenTrackDetails={(t) => setTrackDetailsTarget(t)}
          onRelocateTrack={handleRelocateTrack}
          onReloadTracks={handleReloadTracks}
        />
      )}

      {/* Playlist Context Menu */}
      {playlistContextMenu && (
        <PlaylistContextMenu
          x={playlistContextMenu.x}
          y={playlistContextMenu.y}
          playlist={playlistContextMenu.playlist}
          tracks={tracks}
          folders={playlistFolders}
          groups={playlistGroups}
          language={language}
          onClose={() => setPlaylistContextMenu(null)}
          onPlay={handlePlayPlaylist}
          onAddToQueue={handleAddPlaylistToQueue}
          onRename={(pl) => setRenameItemTarget({ isOpen: true, type: 'playlist', item: pl })}
          onClear={handleClearPlaylist}
          onDelete={handleDeletePlaylist}
          onExportM3U8={handleExportPlaylistM3U8}
          onMoveToFolder={handleMovePlaylistToFolder}
          onMoveToGroup={handleMovePlaylistToGroup}
        />
      )}

      {/* Folder Context Menu */}
      {folderContextMenu && (
        <FolderContextMenu
          x={folderContextMenu.x}
          y={folderContextMenu.y}
          folder={folderContextMenu.folder}
          groups={playlistGroups}
          language={language}
          onClose={() => setFolderContextMenu(null)}
          onOpen={() => {}}
          onPlayAll={handlePlayFolder}
          onAddToQueue={handleAddFolderToQueue}
          onRename={(f) => setRenameItemTarget({ isOpen: true, type: 'folder', item: f })}
          onEditFolder={(f) => setEditingFolderTarget(f)}
          onDelete={(f) => setDeleteFolderTarget(f)}
          onMoveToGroup={handleMoveFolderToGroup}
        />
      )}

      {/* Material 3 Create Playlist Modal */}
      <CreatePlaylistModal
        isOpen={isCreatePlaylistOpen}
        onClose={() => {
          setIsCreatePlaylistOpen(false);
          setPlaylistCreationTarget(null);
        }}
        onCreate={handleCreatePlaylistSubmit}
        folderName={playlistCreationTarget?.folderId ? playlistFolders.find(f => f.id === playlistCreationTarget.folderId)?.name : undefined}
        language={language}
      />

      {/* Material 3 Create / Edit Folder Modal */}
      <CreateFolderModal
        isOpen={isCreateFolderOpen || !!editingFolderTarget}
        language={language}
        onClose={() => {
          setIsCreateFolderOpen(false);
          setFolderCreationTarget(null);
          setEditingFolderTarget(null);
        }}
        onCreate={(name, color, icon, coverType) => {
          if (editingFolderTarget) {
            handleSaveEditFolder(name, color, icon, coverType);
          } else {
            handleCreateFolderSubmit(name, color, icon, coverType);
          }
        }}
        parentFolderName={folderCreationTarget?.parentId ? playlistFolders.find(f => f.id === folderCreationTarget.parentId)?.name : undefined}
        folderToEdit={editingFolderTarget}
      />

      {/* Material 3 Create / Edit Group Modal */}
      <CreateGroupModal
        isOpen={isCreateGroupOpen || !!editingGroupTarget}
        language={language}
        onClose={() => {
          setIsCreateGroupOpen(false);
          setEditingGroupTarget(null);
        }}
        onCreate={(name, color, isIsolated) => {
          if (editingGroupTarget) {
            handleSaveEditGroup(name, color, isIsolated);
          } else {
            handleCreateGroupSubmit(name, color, isIsolated);
          }
        }}
        groupToEdit={editingGroupTarget}
      />

      {/* Universal Rename Item Modal (Playlist, Folder, Group) */}
      <RenameItemModal
        isOpen={!!renameItemTarget?.isOpen}
        type={renameItemTarget?.type || 'playlist'}
        initialName={renameItemTarget?.item?.name || ''}
        initialDescription={renameItemTarget?.type === 'playlist' ? (renameItemTarget?.item as Playlist)?.description : undefined}
        language={language}
        onClose={() => setRenameItemTarget(null)}
        onRename={handleRenameItem}
      />

      {/* Delete Folder Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!deleteFolderTarget}
        title={language === 'ru' ? "Удалить папку" : "Delete Folder"}
        message={language === 'ru'
          ? "Вы уверены, что хотите удалить выбранную папку? Все вложенные плейлисты и треки сохранятся и будут перемещены наружу."
          : "Are you sure you want to delete this folder? All playlists and tracks inside will be preserved and moved outside."
        }
        confirmLabel={language === 'ru' ? "Удалить" : "Delete"}
        cancelLabel={language === 'ru' ? "Отмена" : "Cancel"}
        isDestructive={true}
        onConfirm={handleConfirmDeleteFolder}
        onClose={() => setDeleteFolderTarget(null)}
      />

      {/* Material 3 Clear Playlist Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!clearPlaylistTarget}
        title={language === 'ru' ? "Очистить плейлист" : "Clear Playlist"}
        message={language === 'ru'
          ? "Вы уверены, что хотите удалить все треки из этого плейлиста? Сами файлы останутся в вашей медиатеке."
          : "Are you sure you want to remove all tracks from this playlist? All audio files will remain in your library."
        }
        confirmLabel={language === 'ru' ? "Очистить" : "Clear"}
        cancelLabel={language === 'ru' ? "Отмена" : "Cancel"}
        isDestructive={true}
        onConfirm={handleConfirmClearPlaylist}
        onClose={() => setClearPlaylistTarget(null)}
      />

      {/* Material 3 Delete Playlist Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!deletePlaylistTarget}
        title={language === 'ru' ? "Удалить плейлист" : "Delete Playlist"}
        message={language === 'ru'
          ? "Вы уверены, что хотите безвозвратно удалить этот плейлист? Сами треки останутся в вашей библиотеке."
          : "Are you sure you want to delete this playlist? The audio files will remain in your library."
        }
        confirmLabel={language === 'ru' ? "Удалить" : "Delete"}
        cancelLabel={language === 'ru' ? "Отмена" : "Cancel"}
        isDestructive={true}
        onConfirm={handleConfirmDeletePlaylist}
        onClose={() => setDeletePlaylistTarget(null)}
      />

      {/* Material 3 Delete Tracks Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!deleteTracksTarget && deleteTracksTarget.length > 0}
        title={
          selectedPlaylistId
            ? (language === 'ru' ? "Удалить из плейлиста" : "Remove from Playlist")
            : (language === 'ru' ? "Удалить из медиатеки" : "Remove from Library")
        }
        message={
          selectedPlaylistId
            ? (language === 'ru'
                ? "Вы уверены, что хотите удалить выбранные композиции из этого плейлиста? Сами файлы останутся в вашей медиатеке."
                : "Are you sure you want to remove selected tracks from this playlist? The files will remain in your library."
              )
            : (language === 'ru'
                ? "Вы уверены, что хотите удалить выбранные композиции из медиатеки плеера?"
                : "Are you sure you want to remove selected tracks from the library?"
              )
        }
        confirmLabel={language === 'ru' ? "Удалить" : "Delete"}
        cancelLabel={language === 'ru' ? "Отмена" : "Cancel"}
        isDestructive={true}
        onConfirm={handleConfirmRemoveTracks}
        onClose={() => setDeleteTracksTarget(null)}
      />

      {/* Material 3 Delete Tracks From Disk Confirmation Modal (Hold To Confirm) */}
      <ConfirmationModal
        isOpen={!!deleteFromDiskTarget && deleteFromDiskTarget.length > 0}
        title={language === 'ru' ? "Удаление файлов с диска" : "Delete Files from Disk"}
        message={
          language === 'ru'
            ? "Вы уверены, что хотите безвозвратно удалить выбранные аудиофайлы с накопителя? Это действие нельзя отменить."
            : "Are you sure you want to permanently delete the selected audio files from disk? This action cannot be undone."
        }
        confirmLabel={language === 'ru' ? "Удалить с диска" : "Delete from disk"}
        cancelLabel={language === 'ru' ? "Отмена" : "Cancel"}
        isDestructive={true}
        holdToConfirm={true}
        holdDurationMs={1800}
        language={language}
        onConfirm={handleConfirmDeleteFromDisk}
        onClose={() => setDeleteFromDiskTarget(null)}
      />

      {/* Material 3 Track Details Modal */}
      <TrackDetailsModal
        isOpen={!!trackDetailsTarget}
        track={trackDetailsTarget}
        language={language}
        onClose={() => setTrackDetailsTarget(null)}
      />

      {/* Material 3 Synchronized Lyrics Modal */}
      <LyricsModal
        isOpen={isLyricsOpen}
        track={currentTrack}
        currentTime={currentTime}
        isPlaying={isPlaying}
        language={language}
        onSeek={handleSeek}
        onSaveLyrics={handleSaveLyrics}
        onReloadLyrics={(id) => handleReloadTracks([id])}
        onClose={() => setIsLyricsOpen(false)}
      />

      {/* Missing Tracks Auto-Detection & Relocation Modal */}
      <MissingTracksModal
        isOpen={isMissingTracksModalOpen}
        missingTracks={missingTracksForModal}
        language={language}
        onClose={() => setIsMissingTracksModalOpen(false)}
        onRelocateInFolder={handleRelocateMissingInFolder}
        onClearMissingTracks={handleClearMissingTracks}
        onContinueAsIs={() => setIsMissingTracksModalOpen(false)}
      />
    </div>
  );
};
