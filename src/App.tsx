import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Track, Playlist, PlaylistFolder, PlaylistGroup, ThemeMode, FadeMode } from './types/music';
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
  injectCustomThemeCss
} from './theme/material3';
import { AppLanguage, detectSystemLanguage } from './i18n';
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
  const [currentView, setCurrentView] = useState<MainViewType>('tracks');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('title');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Multi-Selection State
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const selectedTrackIdsRef = useRef<Set<string>>(selectedTrackIds);
  useEffect(() => {
    selectedTrackIdsRef.current = selectedTrackIds;
  }, [selectedTrackIds]);

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
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  const [colorSchemeMode, setColorSchemeMode] = useState<ColorSchemeMode>('dynamic');
  const [seedColor, setSeedColor] = useState<string>(DEFAULT_SEED_COLOR);
  const [secondarySeedColor, setSecondarySeedColor] = useState<string>('#f72585');
  const [appTheme, setAppTheme] = useState<string>('default');

  // Language & Localization (auto-detects system language on first launch)
  const [language, setLanguage] = useState<AppLanguage>(() => detectSystemLanguage());

  // Modals & Menus
  const [isEQOpen, setIsEQOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isBatchTagEditorOpen, setIsBatchTagEditorOpen] = useState<boolean>(false);
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState<boolean>(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState<boolean>(false);
  const [editingFolderTarget, setEditingFolderTarget] = useState<PlaylistFolder | null>(null);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState<boolean>(false);
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
  const [trackDetailsTarget, setTrackDetailsTarget] = useState<Track | null>(null);
  const [isLyricsOpen, setIsLyricsOpen] = useState<boolean>(false);
  const [isQueueOpen, setIsQueueOpen] = useState<boolean>(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; track: Track } | null>(null);
  const [playlistContextMenu, setPlaylistContextMenu] = useState<{ x: number; y: number; playlist: Playlist } | null>(null);
  const [folderContextMenu, setFolderContextMenu] = useState<{ x: number; y: number; folder: PlaylistFolder } | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const [discordEnabled, setDiscordEnabled] = useState<boolean>(true);
  const [showDiscordButton, setShowDiscordButton] = useState<boolean>(true);
  const [visibleTabs, setVisibleTabs] = useState<Record<MainViewType, boolean>>(DEFAULT_VISIBLE_TABS);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef<number>(0);
  const isLoadedRef = useRef<boolean>(false);
  const selectedPlaylistIdRef = useRef<string | null>(null);
  const tracksRef = useRef<Track[]>(tracks);
  const lastPrevPressRef = useRef<number>(0);
  const pendingSeekTimeRef = useRef<number | null>(null);
  const seekDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    selectedPlaylistIdRef.current = selectedPlaylistId;
  }, [selectedPlaylistId]);

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

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
          if (parsed.tracks && Array.isArray(parsed.tracks)) {
            // Re-convert native paths to fresh asset URLs
            const hydrated = parsed.tracks.map((t: Track) => {
              if (t.path && isTauri()) {
                return { ...t, src: convertFileSrc(t.path) };
              }
              return t;
            });
            setTracks(hydrated);

            // Auto-refresh metadata in background for existing tracks missing cover, artist, or lyrics
            if (isTauri()) {
              const pathsToRefresh = hydrated
                .filter(t => t.path && (!t.coverArt || t.artist === 'Unknown Artist' || !t.lyrics))
                .map(t => t.path as string);
              if (pathsToRefresh.length > 0) {
                invoke<any[]>('read_audio_files', { paths: pathsToRefresh }).then(refreshed => {
                  if (refreshed && refreshed.length > 0) {
                    const refreshedMap = new Map<string, any>(refreshed.map(r => [r.path.toLowerCase(), r]));
                    setTracks(prev => prev.map(t => {
                      if (!t.path) return t;
                      const r = refreshedMap.get(t.path.toLowerCase());
                      if (!r) return t;
                      return {
                        ...t,
                        title: t.title === 'Unknown' || !t.title ? r.title : t.title,
                        artist: t.artist === 'Unknown Artist' || !t.artist ? r.artist : t.artist,
                        album: t.album === 'Unknown Album' || !t.album ? r.album : t.album,
                        coverArt: t.coverArt || r.cover_art || undefined,
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
              if (p.id === 'pl_favorites') {
                return { ...p, name: 'Избранное' };
              }
              return p;
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
      visibleTabs,
      colorSchemeMode,
      isDynamicColor: colorSchemeMode === 'dynamic',
      fadeMode,
      fadeDuration,
    };

    const jsonString = JSON.stringify(dataToSave);

    if (isTauri()) {
      invoke('save_portable_data', { data: jsonString }).catch((e) => {
        console.warn('Failed to save to portable folder:', e);
      });
    } else {
      localStorage.setItem('arachnid_portable_data', jsonString);
    }
  }, [tracks, playlists, playlistFolders, playlistGroups, themeMode, seedColor, secondarySeedColor, appTheme, language, discordEnabled, showDiscordButton, visibleTabs, colorSchemeMode, fadeMode, fadeDuration]);

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

  // Audio Engine callbacks
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
      onEnded: () => handleTrackEnded(),
      onPlay: () => setIsPlaying(true),
      onPause: () => setIsPlaying(false),
    });
    audioEngine.setVolume(volume);
  }, [queue, queueIndex, repeatMode]);

  // Sync Audio Engine Fade Configuration
  useEffect(() => {
    audioEngine.setFadeConfig(fadeMode, fadeDuration);
  }, [fadeMode, fadeDuration]);

  // Sync Audio Engine Repeat Mode
  useEffect(() => {
    audioEngine.setRepeatMode(repeatMode);
  }, [repeatMode]);

  // Dynamic M3 & Custom CSS Theme Palette
  useEffect(() => {
    const updateTheme = async () => {
      // Handle custom CSS themes loaded from themes/ folder
      if (appTheme.startsWith('custom:')) {
        const filename = appTheme.replace('custom:', '');
        if (isTauri()) {
          try {
            const css = await invoke<string>('read_custom_theme', { filename });
            injectCustomThemeCss(css);
          } catch (e) {
            console.warn('Failed to load custom theme CSS, falling back to default:', e);
            injectCustomThemeCss(null);
          }
        }
      } else {
        injectCustomThemeCss(null);
      }

      let activeColor = DEFAULT_SEED_COLOR;
      if (appTheme === 'default') {
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
      } else {
        activeColor = seedColor;
      }

      const palette = generateCustomOrBuiltinPalette(appTheme, activeColor, secondarySeedColor, themeMode);
      applyM3ThemeToDOM(palette, themeMode);
    };

    updateTheme();
  }, [currentTrack?.coverArt, colorSchemeMode, seedColor, secondarySeedColor, appTheme, themeMode]);

  // Discord Rich Presence update (only triggers when track changes or play/pause/enabled toggles, NEVER on timeupdate)
  useEffect(() => {
    if (currentTrack) {
      discordRpc.updatePresence({
        enabled: discordEnabled,
        trackName: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.album,
        duration: currentTrack.duration || 0,
        currentTime: 0,
        isPlaying: isPlaying,
      });
    } else {
      discordRpc.updatePresence({
        enabled: false,
        trackName: '',
        artist: '',
        album: '',
        duration: 0,
        currentTime: 0,
        isPlaying: false,
      });
    }
  }, [currentTrack?.id, isPlaying, discordEnabled]);

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
  }, [tracks]);

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

  // Filtered and Sorted Tracks
  // Filtered and Sorted Tracks
  const filteredTracks = useMemo(() => {
    let result = [...tracks];

    if (selectedPlaylistId) {
      const pl = playlists.find(p => p.id === selectedPlaylistId);
      if (pl) {
        const trackMap = new Map(tracks.map(t => [t.id, t]));
        result = pl.trackIds.map(id => trackMap.get(id)).filter((t): t is Track => Boolean(t));
      }
    } else if (selectedAlbum) {
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
      const trackMap = new Map(tracks.map(t => [t.id, t]));
      if (plFav && plFav.trackIds.length > 0) {
        const ordered = plFav.trackIds.map(id => trackMap.get(id)).filter((t): t is Track => Boolean(t && t.isFavorite));
        const orderedSet = new Set(ordered.map(t => t.id));
        const remaining = tracks.filter(t => t.isFavorite && !orderedSet.has(t.id));
        result = [...ordered, ...remaining];
      } else {
        result = result.filter(t => t.isFavorite);
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
      result.sort((a, b) => {
        let valA: any = a[sortBy as keyof Track] || '';
        let valB: any = b[sortBy as keyof Track] || '';
        if (typeof valA === 'string') {
          const cmp = valA.localeCompare(valB);
          return sortOrder === 'asc' ? cmp : -cmp;
        }
        return sortOrder === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
      });
    }

    return result;
  }, [tracks, selectedPlaylistId, selectedAlbum, selectedArtist, selectedGenre, currentView, searchQuery, sortBy, sortOrder, playlists]);

  useEffect(() => {
    filteredTracksRef.current = filteredTracks;
  }, [filteredTracks]);

  // Information about current active detail view (if drilling into Album, Artist, Genre, or Playlist)
  const currentDetail = useMemo(() => {
    if (selectedPlaylistId) {
      const pl = playlists.find(p => p.id === selectedPlaylistId);
      if (!pl) return null;
      const count = pl.trackIds.length;
      return {
        type: 'playlist' as const,
        title: pl.name,
        subtitle: pl.description || (language === 'ru' 
          ? `${count} трек${count % 10 === 1 && count % 100 !== 11 ? '' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20) ? 'а' : 'ов'}`
          : `${count} ${count === 1 ? 'track' : 'tracks'}`
        ),
        icon: <ListMusic className="w-6 h-6" />,
        playlist: pl,
      };
    }
    if (selectedAlbum) {
      const unknownAlbumLabel = language === 'ru' ? 'Без альбома' : 'No Album';
      const albumTracks = tracks.filter(t => (t.album ? t.album.trim() : unknownAlbumLabel) === selectedAlbum);
      const firstCover = albumTracks.find(t => t.coverArt)?.coverArt;
      const artist = albumTracks[0]?.artist || (language === 'ru' ? 'Неизвестный исполнитель' : 'Unknown Artist');
      return {
        type: 'album' as const,
        title: selectedAlbum,
        subtitle: `${artist} • ${albumTracks.length} ${language === 'ru' ? 'трек(ов)' : 'tracks'}`,
        coverArt: firstCover,
        icon: <Disc3 className="w-6 h-6" />,
      };
    }
    if (selectedArtist) {
      const unknownArtistLabel = language === 'ru' ? 'Неизвестный исполнитель' : 'Unknown Artist';
      const artistTracks = tracks.filter(t => (t.artist ? t.artist.trim() : unknownArtistLabel) === selectedArtist);
      const firstCover = artistTracks.find(t => t.coverArt)?.coverArt;
      return {
        type: 'artist' as const,
        title: selectedArtist,
        subtitle: `${artistTracks.length} ${language === 'ru' ? 'трек(ов)' : 'tracks'}`,
        coverArt: firstCover,
        icon: <Mic2 className="w-6 h-6" />,
      };
    }
    if (selectedGenre) {
      const unknownGenreLabel = language === 'ru' ? 'Без жанра' : 'No Genre';
      const genreTracks = tracks.filter(t => {
        if (!t.genre) return selectedGenre === unknownGenreLabel;
        const list = t.genre.split(/[,/;\\]+/).map(g => g.trim()).filter(Boolean);
        return list.length > 0 ? list.includes(selectedGenre) : selectedGenre === unknownGenreLabel;
      });
      return {
        type: 'genre' as const,
        title: selectedGenre,
        subtitle: `${genreTracks.length} ${language === 'ru' ? 'трек(ов)' : 'tracks'}`,
        icon: <Tag className="w-6 h-6" />,
      };
    }
    return null;
  }, [selectedPlaylistId, selectedAlbum, selectedArtist, selectedGenre, playlists, tracks, language]);

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
          ? `Поиск среди треков (${tracks.length})...`
          : `Search all tracks (${tracks.length})...`;
    }
  }, [currentDetail, currentView, tracks.length, language]);

  const handleBackToGrid = () => {
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

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      if (e.code === 'Tab' || e.key === 'Tab') {
        e.preventDefault();
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
      } else if ((e.code === 'KeyT' || e.key.toLowerCase() === 't' || e.key.toLowerCase() === 'е') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setIsLyricsOpen(prev => !prev);
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
          const currentSelection = selectedTrackIdsRef.current;
          let nextIdx = 0;
          if (currentSelection.size > 0) {
            const selectedArray = Array.from(currentSelection);
            const lastSelectedId = selectedArray[selectedArray.length - 1];
            const currIdx = currentList.findIndex(t => t.id === lastSelectedId);
            if (currIdx !== -1) {
              nextIdx = Math.min(currentList.length - 1, currIdx + 1);
            }
          } else if (currentTrack) {
            const currIdx = currentList.findIndex(t => t.id === currentTrack.id);
            if (currIdx !== -1) {
              nextIdx = Math.min(currentList.length - 1, currIdx + 1);
            }
          }
          const nextTrack = currentList[nextIdx];
          if (nextTrack) {
            const newSet = new Set([nextTrack.id]);
            selectedTrackIdsRef.current = newSet;
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
          const currentSelection = selectedTrackIdsRef.current;
          let prevIdx = 0;
          if (currentSelection.size > 0) {
            const selectedArray = Array.from(currentSelection);
            const firstSelectedId = selectedArray[0];
            const currIdx = currentList.findIndex(t => t.id === firstSelectedId);
            if (currIdx !== -1) {
              prevIdx = Math.max(0, currIdx - 1);
            }
          } else if (currentTrack) {
            const currIdx = currentList.findIndex(t => t.id === currentTrack.id);
            if (currIdx !== -1) {
              prevIdx = Math.max(0, currIdx - 1);
            }
          }
          const prevTrack = currentList[prevIdx];
          if (prevTrack) {
            const newSet = new Set([prevTrack.id]);
            selectedTrackIdsRef.current = newSet;
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
          deleteTracksTarget || trackDetailsTarget;
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
          deleteTracksTarget || trackDetailsTarget;
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
          }
          audioEngine.setScrubbing(false);
        }, 160);
      } else if ((e.code === 'ArrowRight' || e.key === 'ArrowRight') && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        const dur = duration > 0 ? duration : audioEngine.getDuration();
        const baseTime = pendingSeekTimeRef.current !== null ? pendingSeekTimeRef.current : audioEngine.getCurrentTime();
        const nextTime = Math.max(0, Math.min(dur > 0 ? dur : Infinity, baseTime + 5));

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
          }
          audioEngine.setScrubbing(false);
        }, 160);
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
      } else if (e.code === 'Delete' && selectedTrackIds.size > 0) {
        e.preventDefault();
        handleRequestRemoveTracks(Array.from(selectedTrackIds));
      } else if (e.code === 'Escape') {
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
        setSelectedTrackIds(new Set());
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
    contextMenu,
    playlistContextMenu,
    folderContextMenu,
    currentView,
    visibleTabs,
  ]);

  // Synchronous, robust track processor and playlist assigner
  const processImportedTracks = (newTracks: Track[]) => {
    if (newTracks.length === 0) return;

    // Use tracksRef.current synchronously!
    const existingMap = new Map<string, Track>();
    tracksRef.current.forEach(t => {
      if (t.path) existingMap.set(t.path.toLowerCase(), t);
      existingMap.set(`${t.title.toLowerCase()}|||${t.artist.toLowerCase()}`, t);
    });

    const uniqueToAdd: Track[] = [];
    const plTrackIds: string[] = [];

    for (const nt of newTracks) {
      const byPath = nt.path ? existingMap.get(nt.path.toLowerCase()) : null;
      const byTitle = existingMap.get(`${nt.title.toLowerCase()}|||${nt.artist.toLowerCase()}`);
      const existing = byPath || byTitle;

      if (existing) {
        plTrackIds.push(existing.id);
      } else {
        uniqueToAdd.push(nt);
        plTrackIds.push(nt.id);
        // Also register in existingMap so siblings in the same batch don't duplicate
        if (nt.path) existingMap.set(nt.path.toLowerCase(), nt);
        existingMap.set(`${nt.title.toLowerCase()}|||${nt.artist.toLowerCase()}`, nt);
      }
    }

    if (uniqueToAdd.length > 0) {
      if (currentView === 'favorites') {
        uniqueToAdd.forEach(t => t.isFavorite = true);
      }
      setTracks(prev => [...prev, ...uniqueToAdd]);
      setQueue(prev => [...prev, ...uniqueToAdd]);
    }

    // If currently viewing a specific playlist, immediately add all tracks (new & existing) into it!
    const activePlId = selectedPlaylistIdRef.current;
    if (activePlId && plTrackIds.length > 0) {
      setPlaylists(prev => prev.map(p => {
        if (p.id === activePlId) {
          const set = new Set(p.trackIds);
          const toAdd = plTrackIds.filter(id => !set.has(id));
          return { ...p, trackIds: [...p.trackIds, ...toAdd] };
        }
        return p;
      }));
    }

    if (!currentTrack || tracksRef.current.length === 0) {
      const first = uniqueToAdd[0] || newTracks[0];
      if (first) playTrackWithContext(first, newTracks);
    }
  };

  // Import native file paths in Tauri desktop
  const importTauriPaths = async (paths: string[]) => {
    try {
      const rawTracks = await invoke<any[]>('read_audio_files', { paths });
      if (!rawTracks || rawTracks.length === 0) return;

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

      processImportedTracks(newTracks);
    } catch (err) {
      console.warn('Error reading Tauri dropped files:', err);
    }
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

    const newTracks: Track[] = [];
    for (const f of audioFiles) {
      try {
        const parsed = await parseAudioFile(f);
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
    if (e.shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
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
      setLastSelectedIndex(index);
    } else {
      const newSet = new Set([trackId]);
      selectedTrackIdsRef.current = newSet;
      setSelectedTrackIds(newSet);
      setLastSelectedIndex(index);
    }
  };

  // Plays a specific track at an existing index in the queue without replacing the queue
  const playQueueIndex = async (index: number) => {
    if (index < 0 || index >= queue.length) return;
    const track = queue[index];
    setQueueIndex(index);
    setCurrentTrack(track);
    setDuration(track.duration || 0);
    await audioEngine.playTrack(track.src, true, true, track.duration, track.path);
    setIsPlaying(true);
  };

  // Starts playback of a track with context: populates the playback queue with all tracks from that view/playlist
  // in their exact displayed order, and sets the active queue index to the clicked track.
  const playTrackWithContext = async (track: Track, contextTracks?: Track[]) => {
    const list = contextTracks && contextTracks.length > 0 ? contextTracks : [track];
    setQueue(list);
    const idx = list.findIndex(t => t.id === track.id);
    const targetIdx = idx !== -1 ? idx : 0;
    setQueueIndex(targetIdx);

    setCurrentTrack(track);
    setDuration(track.duration || 0);
    await audioEngine.playTrack(track.src, true, true, track.duration, track.path);
    setIsPlaying(true);
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
      // Handled internally by audioEngine with crackle-free micro-ramp
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

  const handleSeek = (time: number) => {
    if (seekDebounceTimerRef.current) {
      clearTimeout(seekDebounceTimerRef.current);
      seekDebounceTimerRef.current = null;
    }
    pendingSeekTimeRef.current = null;
    audioEngine.setScrubbing(false);
    setCurrentTime(time);
    audioEngine.seek(time);
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
    setSelectedPlaylistId(newPl.id);
    setSortBy('custom');
    setSortOrder('asc');
    setPlaylistCreationTarget(null);
  };

  const handleSelectPlaylist = (id: string) => {
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

  const handleCreateFolderSubmit = (name: string, color?: string, icon?: string) => {
    const newFolder: PlaylistFolder = {
      id: `fld_${Date.now()}`,
      name: name.trim(),
      parentId: folderCreationTarget?.parentId || null,
      groupId: folderCreationTarget?.groupId || null,
      color: color || undefined,
      icon: icon || undefined,
      createdAt: Date.now(),
      order: playlistFolders.length,
    };
    setPlaylistFolders(prev => [...prev, newFolder]);
    setFolderCreationTarget(null);
  };

  const handleSaveEditFolder = (name: string, color?: string, icon?: string) => {
    if (!editingFolderTarget) return;
    setPlaylistFolders(prev => prev.map(f => {
      if (f.id === editingFolderTarget.id) {
        return {
          ...f,
          name: name.trim(),
          color: color || undefined,
          icon: icon || undefined,
        };
      }
      return f;
    }));
    setEditingFolderTarget(null);
  };

  const handleCreateGroupSubmit = (name: string) => {
    const newGroup: PlaylistGroup = {
      id: `grp_${Date.now()}`,
      name: name.trim(),
      order: playlistGroups.length,
      isCollapsed: false,
    };
    setPlaylistGroups(prev => [...prev, newGroup]);
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

  const handleRenameItem = (newName: string) => {
    if (!renameItemTarget) return;
    const { type, item } = renameItemTarget;
    if (type === 'playlist') {
      setPlaylists(prev => prev.map(p => p.id === item.id ? { ...p, name: newName } : p));
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
  }) => {
    setTracks(prev => prev.map(t => {
      if (selectedTrackIds.has(t.id)) {
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

    if (currentTrack && selectedTrackIds.has(currentTrack.id)) {
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
      const selectedTracks = tracks.filter(t => selectedTrackIds.has(t.id) && t.path);
      const paths = selectedTracks.map(t => t.path as string);
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
        totalTracksCount={tracks.length}
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
      />

      {/* Main Content Area (Full width, No sidebar) */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-md3-surface overflow-hidden">
        {/* If a sub-view is active (Album, Artist, Genre, or Playlist) */}
        {currentDetail ? (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Header Banner */}
            <div className="px-6 py-3.5 bg-md3-surface-container-low border-b border-md3-outline-variant/15 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4 min-w-0">
                <button
                  onClick={handleBackToGrid}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-md3-surface-container hover:bg-md3-surface-container-high text-xs font-semibold text-md3-on-surface transition-all cursor-pointer shrink-0 border border-md3-outline-variant/15 hover:scale-105 active:scale-95"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{language === 'ru' ? 'Назад' : 'Back'}</span>
                </button>

                <div className="flex items-center gap-3.5 min-w-0">
                  {currentDetail.coverArt ? (
                    <img 
                      src={currentDetail.coverArt} 
                      alt={currentDetail.title} 
                      className="w-12 h-12 rounded-2xl object-cover shadow-md shrink-0 border border-md3-outline-variant/15" 
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-md3-primary/10 text-md3-primary flex items-center justify-center shadow-inner shrink-0">
                      {currentDetail.icon}
                    </div>
                  )}

                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-md3-on-surface truncate leading-tight">
                      {currentDetail.title}
                    </h2>
                    <p className="text-xs text-md3-on-surface-variant font-medium mt-0.5 truncate">
                      {currentDetail.subtitle}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    if (filteredTracks.length > 0) {
                      playTrackWithContext(filteredTracks[0], filteredTracks);
                    }
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-md3-primary text-md3-on-primary text-xs font-bold shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                  <span>{language === 'ru' ? 'Воспроизвести всё' : 'Play All'}</span>
                </button>

                {currentDetail.type === 'playlist' && !currentDetail.playlist.isSystem && (
                  <button
                    onClick={() => handleDeletePlaylist(currentDetail.playlist)}
                    title={language === 'ru' ? "Удалить плейлист" : "Delete playlist"}
                    className="p-2 rounded-full text-md3-on-surface-variant hover:text-red-500 hover:bg-md3-surface-container transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
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
              language={language}
            />
          </div>
        ) : currentView === 'playlists' ? (
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
            onCreateGroup={() => setIsCreateGroupOpen(true)}
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
            onRenameGroup={(grp) => setRenameItemTarget({ isOpen: true, type: 'group', item: grp })}
            onDeleteGroup={handleDeleteGroup}
            onMovePlaylistToFolder={handleMovePlaylistToFolder}
            onMovePlaylistToGroup={handleMovePlaylistToGroup}
            onMoveFolderToFolder={handleMoveFolderToFolder}
            onMoveFolderToGroup={handleMoveFolderToGroup}
            onReorderPlaylists={setPlaylists}
            onEditFolder={(folder) => setEditingFolderTarget(folder)}
          />
        ) : currentView === 'albums' ? (
          <AlbumsGridView
            tracks={tracks}
            searchQuery={searchQuery}
            language={language}
            onSelectAlbum={(alb) => setSelectedAlbum(alb)}
            onPlayAlbum={handlePlayAlbum}
          />
        ) : currentView === 'artists' ? (
          <ArtistsGridView
            tracks={tracks}
            searchQuery={searchQuery}
            language={language}
            onSelectArtist={(art) => setSelectedArtist(art)}
            onPlayArtist={handlePlayArtist}
          />
        ) : currentView === 'genres' ? (
          <GenresGridView
            tracks={tracks}
            searchQuery={searchQuery}
            language={language}
            onSelectGenre={(gen) => setSelectedGenre(gen)}
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
        onOpenTrackDetails={(t) => setTrackDetailsTarget(t)}
        onOpenLyrics={() => setIsLyricsOpen(true)}
      />

      {/* Queue Drawer */}
      <QueueDrawer
        isOpen={isQueueOpen}
        onClose={() => setIsQueueOpen(false)}
        queue={queue}
        queueIndex={queueIndex}
        currentTrack={currentTrack}
        language={language}
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
        visibleTabs={visibleTabs}
        onToggleTabVisibility={handleToggleTabVisibility}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        fadeMode={fadeMode}
        onSetFadeMode={setFadeMode}
        fadeDuration={fadeDuration}
        onSetFadeDuration={setFadeDuration}
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
          onOpenTrackDetails={(t) => setTrackDetailsTarget(t)}
        />
      )}

      {/* Playlist Context Menu */}
      {playlistContextMenu && (
        <PlaylistContextMenu
          x={playlistContextMenu.x}
          y={playlistContextMenu.y}
          playlist={playlistContextMenu.playlist}
          folders={playlistFolders}
          groups={playlistGroups}
          language={language}
          onClose={() => setPlaylistContextMenu(null)}
          onPlay={handlePlayPlaylist}
          onAddToQueue={handleAddPlaylistToQueue}
          onRename={(pl) => setRenameItemTarget({ isOpen: true, type: 'playlist', item: pl })}
          onClear={handleClearPlaylist}
          onDelete={handleDeletePlaylist}
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
        onCreate={(name, color, icon) => {
          if (editingFolderTarget) {
            handleSaveEditFolder(name, color, icon);
          } else {
            handleCreateFolderSubmit(name, color, icon);
          }
        }}
        parentFolderName={folderCreationTarget?.parentId ? playlistFolders.find(f => f.id === folderCreationTarget.parentId)?.name : undefined}
        folderToEdit={editingFolderTarget}
      />

      {/* Material 3 Create Group Modal */}
      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        language={language}
        onClose={() => setIsCreateGroupOpen(false)}
        onCreate={handleCreateGroupSubmit}
      />

      {/* Universal Rename Item Modal (Playlist, Folder, Group) */}
      <RenameItemModal
        isOpen={!!renameItemTarget?.isOpen}
        type={renameItemTarget?.type || 'playlist'}
        initialName={renameItemTarget?.item?.name || ''}
        language={language}
        onClose={() => setRenameItemTarget(null)}
        onRename={handleRenameItem}
      />

      {/* Delete Folder Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!deleteFolderTarget}
        title={language === 'ru' ? "Удалить папку" : "Delete Folder"}
        message={language === 'ru'
          ? `Вы уверены, что хотите удалить папку «${deleteFolderTarget?.name}»? Все плейлисты и треки внутри сохранятся и будут перемещены наружу.`
          : `Are you sure you want to delete the folder "${deleteFolderTarget?.name}"? All playlists and tracks inside will be preserved and moved outside.`
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
          ? `Вы уверены, что хотите удалить все треки из плейлиста «${clearPlaylistTarget?.name}»? Все композиции останутся в вашей медиатеке.`
          : `Are you sure you want to remove all tracks from the playlist "${clearPlaylistTarget?.name}"? All files will remain in your library.`
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
          ? `Вы уверены, что хотите безвозвратно удалить плейлист «${deletePlaylistTarget?.name}»? Сами треки останутся в вашей библиотеке.`
          : `Are you sure you want to delete the playlist "${deletePlaylistTarget?.name}"? The audio files will remain in your library.`
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
                ? `Вы уверены, что хотите удалить выбранные треки (${deleteTracksTarget?.length || 0} шт.) из этого плейлиста? Сами файлы останутся в вашей медиатеке.`
                : `Are you sure you want to remove selected tracks (${deleteTracksTarget?.length || 0}) from this playlist? The files will remain in your library.`
              )
            : (language === 'ru'
                ? `Вы уверены, что хотите удалить выбранные треки (${deleteTracksTarget?.length || 0} шт.) из медиатеки плеера?`
                : `Are you sure you want to remove selected tracks (${deleteTracksTarget?.length || 0}) from the library?`
              )
        }
        confirmLabel={language === 'ru' ? "Удалить" : "Delete"}
        cancelLabel={language === 'ru' ? "Отмена" : "Cancel"}
        isDestructive={true}
        onConfirm={handleConfirmRemoveTracks}
        onClose={() => setDeleteTracksTarget(null)}
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
        onClose={() => setIsLyricsOpen(false)}
      />
    </div>
  );
};
