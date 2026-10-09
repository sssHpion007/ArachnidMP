import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Track, Playlist, PlaylistFolder, PlaylistGroup, ThemeMode, FadeMode } from './types/music';
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
import { SettingsModal } from './components/SettingsModal';
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
  applyM3ThemeToDOM, 
  extractDominantColor 
} from './theme/material3';
import { isTauri, convertFileSrc, invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { ArrowLeft, Play, Disc3, Mic2, Tag, Trash2, ListMusic } from 'lucide-react';

const INITIAL_PLAYLISTS: Playlist[] = [
  {
    id: 'pl_favorites',
    name: 'Любимые треки',
    description: 'Треки, отмеченные сердечком',
    trackIds: [],
    isSystem: true,
  },
];

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

  // Player & Queue State
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('all');
  const [isShuffled, setIsShuffled] = useState<boolean>(false);
  const [queue, setQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState<number>(0);

  // Audio Fading Settings
  const [fadeMode, setFadeMode] = useState<FadeMode>('track_change_and_pause');
  const [fadeDuration, setFadeDuration] = useState<number>(2.0);

  // Theming & M3 State
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  const [isDynamicColor, setIsDynamicColor] = useState<boolean>(true);
  const [seedColor, setSeedColor] = useState<string>(DEFAULT_SEED_COLOR);

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
  const [trackDetailsTarget, setTrackDetailsTarget] = useState<Track | null>(null);
  const [isLyricsOpen, setIsLyricsOpen] = useState<boolean>(false);
  const [isQueueOpen, setIsQueueOpen] = useState<boolean>(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; track: Track } | null>(null);
  const [playlistContextMenu, setPlaylistContextMenu] = useState<{ x: number; y: number; playlist: Playlist } | null>(null);
  const [folderContextMenu, setFolderContextMenu] = useState<{ x: number; y: number; folder: PlaylistFolder } | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const [discordEnabled, setDiscordEnabled] = useState<boolean>(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef<number>(0);
  const isLoadedRef = useRef<boolean>(false);
  const selectedPlaylistIdRef = useRef<string | null>(null);
  const tracksRef = useRef<Track[]>(tracks);

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
            setPlaylists(parsed.playlists);
          }
          if (parsed.playlistFolders && Array.isArray(parsed.playlistFolders)) {
            setPlaylistFolders(parsed.playlistFolders);
          }
          if (parsed.playlistGroups && Array.isArray(parsed.playlistGroups)) {
            setPlaylistGroups(parsed.playlistGroups);
          }
          if (parsed.themeMode) setThemeMode(parsed.themeMode);
          if (parsed.seedColor) setSeedColor(parsed.seedColor);
          if (typeof parsed.discordEnabled === 'boolean') setDiscordEnabled(parsed.discordEnabled);
          if (typeof parsed.isDynamicColor === 'boolean') setIsDynamicColor(parsed.isDynamicColor);
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
      discordEnabled,
      isDynamicColor,
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
  }, [tracks, playlists, playlistFolders, playlistGroups, themeMode, seedColor, discordEnabled, isDynamicColor, fadeMode, fadeDuration]);

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
      onTimeUpdate: (time) => setCurrentTime(time),
      onDuration: (dur) => setDuration(dur),
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

  // Dynamic M3 Theme Palette
  useEffect(() => {
    const updateTheme = async () => {
      let activeColor = seedColor;
      if (isDynamicColor && currentTrack?.coverArt) {
        activeColor = await extractDominantColor(currentTrack.coverArt);
      }
      const palette = generateM3Palette(activeColor, themeMode);
      applyM3ThemeToDOM(palette, themeMode);
    };

    updateTheme();
  }, [currentTrack?.coverArt, isDynamicColor, seedColor, themeMode]);

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
      result = result.filter(t => (t.genre ? t.genre.trim() : 'Без жанра') === selectedGenre);
    } else if (currentView === 'favorites') {
      result = result.filter(t => t.isFavorite);
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

  // Information about current active detail view (if drilling into Album, Artist, Genre, or Playlist)
  const currentDetail = useMemo(() => {
    if (selectedPlaylistId) {
      const pl = playlists.find(p => p.id === selectedPlaylistId);
      if (!pl) return null;
      const count = pl.trackIds.length;
      return {
        type: 'playlist' as const,
        title: pl.name,
        subtitle: pl.description || `${count} трек${count % 10 === 1 && count % 100 !== 11 ? '' : 'ов'}`,
        icon: <ListMusic className="w-6 h-6" />,
        playlist: pl,
      };
    }
    if (selectedAlbum) {
      const albumTracks = tracks.filter(t => (t.album ? t.album.trim() : 'Без альбома') === selectedAlbum);
      const firstCover = albumTracks.find(t => t.coverArt)?.coverArt;
      const artist = albumTracks[0]?.artist || 'Неизвестный исполнитель';
      return {
        type: 'album' as const,
        title: selectedAlbum,
        subtitle: `${artist} • ${albumTracks.length} трек(ов)`,
        coverArt: firstCover,
        icon: <Disc3 className="w-6 h-6" />,
      };
    }
    if (selectedArtist) {
      const artistTracks = tracks.filter(t => (t.artist ? t.artist.trim() : 'Неизвестный исполнитель') === selectedArtist);
      const firstCover = artistTracks.find(t => t.coverArt)?.coverArt;
      return {
        type: 'artist' as const,
        title: selectedArtist,
        subtitle: `${artistTracks.length} трек(ов)`,
        coverArt: firstCover,
        icon: <Mic2 className="w-6 h-6" />,
      };
    }
    if (selectedGenre) {
      const genreTracks = tracks.filter(t => (t.genre ? t.genre.trim() : 'Без жанра') === selectedGenre);
      return {
        type: 'genre' as const,
        title: selectedGenre,
        subtitle: `${genreTracks.length} трек(ов)`,
        icon: <Tag className="w-6 h-6" />,
      };
    }
    return null;
  }, [selectedPlaylistId, selectedAlbum, selectedArtist, selectedGenre, playlists, tracks]);

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
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        handlePlayPause();
      } else if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        handleToggleRepeat();
      } else if (e.code === 'ArrowRight' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleNext();
      } else if (e.code === 'ArrowLeft' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handlePrev();
      } else if (e.code === 'KeyA' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setSelectedTrackIds(new Set(filteredTracks.map(t => t.id)));
      } else if (e.code === 'Escape') {
        setSelectedTrackIds(new Set());
        setContextMenu(null);
        setPlaylistContextMenu(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, currentTrack, queue, queueIndex, filteredTracks, repeatMode]);

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
      if (first) playTrack(first);
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
        format: t.format,
        fileSize: t.file_size,
        lyrics: t.lyrics || undefined,
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
      setSelectedTrackIds(new Set(rangeIds));
    } else if (e.ctrlKey || e.metaKey) {
      const updated = new Set(selectedTrackIds);
      if (updated.has(trackId)) {
        updated.delete(trackId);
      } else {
        updated.add(trackId);
      }
      setSelectedTrackIds(updated);
      setLastSelectedIndex(index);
    } else {
      setSelectedTrackIds(new Set([trackId]));
      setLastSelectedIndex(index);
    }
  };

  const playTrack = async (track: Track) => {
    setCurrentTrack(track);
    setDuration(track.duration || 0);
    const qIdx = queue.findIndex(t => t.id === track.id);
    if (qIdx !== -1) {
      setQueueIndex(qIdx);
    } else {
      setQueue(prev => [...prev, track]);
      setQueueIndex(queue.length);
    }
    await audioEngine.playTrack(track.src, true);
    setIsPlaying(true);
  };

  const handlePlayPause = async () => {
    if (!currentTrack) {
      if (filteredTracks.length > 0) {
        playTrack(filteredTracks[0]);
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
      setQueueIndex(nextIdx);
      playTrack(queue[nextIdx]);
      return;
    }
    const nextIdx = (queueIndex + 1) % queue.length;
    setQueueIndex(nextIdx);
    playTrack(queue[nextIdx]);
  };

  const handlePrev = () => {
    if (currentTime > 3) {
      audioEngine.seek(0);
      setCurrentTime(0);
      return;
    }
    if (queue.length === 0) return;
    const prevIdx = (queueIndex - 1 + queue.length) % queue.length;
    setQueueIndex(prevIdx);
    playTrack(queue[prevIdx]);
  };

  const handleTrackEnded = () => {
    if (repeatMode === 'one') {
      audioEngine.seek(0);
      audioEngine.resume();
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
    setCurrentTime(time);
    audioEngine.seek(time);
  };

  const handleVolumeChange = (vol: number) => {
    setVolume(vol);
    setIsMuted(false);
    audioEngine.setVolume(vol);
  };

  const handleToggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      audioEngine.setVolume(volume);
    } else {
      setIsMuted(true);
      audioEngine.setVolume(0);
    }
  };

  const handleToggleShuffle = () => {
    setIsShuffled(!isShuffled);
  };

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

  const handlePlaySelected = () => {
    const selected = tracks.filter(t => selectedTrackIds.has(t.id));
    if (selected.length > 0) {
      setQueue(selected);
      setQueueIndex(0);
      playTrack(selected[0]);
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
    const trackIdsSet = new Set<string>();
    for (const pl of folderPlaylists) {
      for (const tid of pl.trackIds) {
        trackIdsSet.add(tid);
      }
    }
    return tracks.filter(t => trackIdsSet.has(t.id));
  };

  const handlePlayFolder = (folder: PlaylistFolder) => {
    const folderTracks = getFolderAllTracks(folder);
    if (folderTracks.length > 0) {
      setQueue(folderTracks);
      setQueueIndex(0);
      playTrack(folderTracks[0]);
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
    const plTracks = tracks.filter(t => playlist.trackIds.includes(t.id));
    if (plTracks.length > 0) {
      setQueue(plTracks);
      setQueueIndex(0);
      playTrack(plTracks[0]);
    }
  };

  const handlePlayAlbum = (albumTracks: Track[]) => {
    if (albumTracks.length === 0) return;
    setQueue(albumTracks);
    setQueueIndex(0);
    playTrack(albumTracks[0]);
  };

  const handlePlayArtist = (artistTracks: Track[]) => {
    if (artistTracks.length === 0) return;
    setQueue(artistTracks);
    setQueueIndex(0);
    playTrack(artistTracks[0]);
  };

  const handlePlayGenre = (genreTracks: Track[]) => {
    if (genreTracks.length === 0) return;
    setQueue(genreTracks);
    setQueueIndex(0);
    playTrack(genreTracks[0]);
  };

  const handleAddPlaylistToQueue = (playlist: Playlist) => {
    const plTracks = tracks.filter(t => playlist.trackIds.includes(t.id));
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

  const handleSaveBatchTags = (updates: {
    artist?: string;
    album?: string;
    genre?: string;
    year?: number;
  }) => {
    setTracks(prev => prev.map(t => {
      if (selectedTrackIds.has(t.id)) {
        return {
          ...t,
          artist: updates.artist !== undefined ? updates.artist : t.artist,
          album: updates.album !== undefined ? updates.album : t.album,
          genre: updates.genre !== undefined ? updates.genre : t.genre,
          year: updates.year !== undefined ? updates.year : t.year,
        };
      }
      return t;
    }));
    if (currentTrack && selectedTrackIds.has(currentTrack.id)) {
      setCurrentTrack(prev => prev ? {
        ...prev,
        artist: updates.artist !== undefined ? updates.artist : prev.artist,
        album: updates.album !== undefined ? updates.album : prev.album,
        genre: updates.genre !== undefined ? updates.genre : prev.genre,
        year: updates.year !== undefined ? updates.year : prev.year,
      } : null);
    }
  };

  const handleSaveLyrics = async (trackId: string, lyrics: string, isInstrumental: boolean) => {
    setTracks(prev => prev.map(t => {
      if (t.id === trackId) {
        return { ...t, lyrics, isInstrumental };
      }
      return t;
    }));
    if (currentTrack?.id === trackId) {
      setCurrentTrack(prev => prev ? { ...prev, lyrics, isInstrumental } : null);
    }

    // Embed lyrics directly into the audio file tags on disk!
    const targetTrack = tracksRef.current.find(t => t.id === trackId);
    if (isTauri() && targetTrack?.path) {
      try {
        await invoke('save_track_lyrics', { 
          path: targetTrack.path, 
          lyrics: isInstrumental ? '' : lyrics 
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
      <DragDropOverlay isDragging={isDraggingFile} />

      {/* Top Header Bar with App Logo, Navigation Pills, Search & Quick Actions */}
      <TopBar
        currentView={currentView}
        onSelectView={handleSelectView}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        totalTracksCount={tracks.length}
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
                  <span>Назад</span>
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
                      setQueue(filteredTracks);
                      setQueueIndex(0);
                      playTrack(filteredTracks[0]);
                    }
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-md3-primary text-md3-on-primary text-xs font-bold shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                  <span>Воспроизвести всё</span>
                </button>

                {currentDetail.type === 'playlist' && !currentDetail.playlist.isSystem && (
                  <button
                    onClick={() => handleDeletePlaylist(currentDetail.playlist)}
                    title="Удалить плейлист"
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
              onPlayTrack={playTrack}
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
              isReorderable={Boolean(selectedPlaylistId) && !searchQuery.trim()}
              onReorderTracks={selectedPlaylistId ? handleReorderPlaylistTracks : undefined}
            />
          </div>
        ) : currentView === 'playlists' ? (
          <PlaylistsGridView
            playlists={playlists}
            folders={playlistFolders}
            groups={playlistGroups}
            tracks={tracks}
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
            onSelectAlbum={(alb) => setSelectedAlbum(alb)}
            onPlayAlbum={handlePlayAlbum}
          />
        ) : currentView === 'artists' ? (
          <ArtistsGridView
            tracks={tracks}
            onSelectArtist={(art) => setSelectedArtist(art)}
            onPlayArtist={handlePlayArtist}
          />
        ) : currentView === 'genres' ? (
          <GenresGridView
            tracks={tracks}
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
            onPlayTrack={playTrack}
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
        onPlayQueueTrack={(idx) => {
          setQueueIndex(idx);
          playTrack(queue[idx]);
        }}
        onRemoveFromQueue={(idx) => {
          setQueue(prev => prev.filter((_, i) => i !== idx));
        }}
        onClearQueue={() => setQueue([])}
        onShuffleQueue={() => {
          const shuffled = [...queue].sort(() => Math.random() - 0.5);
          setQueue(shuffled);
        }}
        onMoveQueueTrack={(from, to) => {
          setQueue(prev => {
            const copy = [...prev];
            const [moved] = copy.splice(from, 1);
            copy.splice(to, 0, moved);
            return copy;
          });
        }}
      />

      {/* Batch Tag Editor Modal */}
      <BatchTagEditorModal
        isOpen={isBatchTagEditorOpen}
        onClose={() => setIsBatchTagEditorOpen(false)}
        selectedTracks={selectedTracksList}
        onSaveTags={handleSaveBatchTags}
      />

      {/* 10-Band Equalizer Modal */}
      <EqualizerModal
        isOpen={isEQOpen}
        onClose={() => setIsEQOpen(false)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        themeMode={themeMode}
        onSetThemeMode={setThemeMode}
        isDynamicColor={isDynamicColor}
        onToggleDynamicColor={() => setIsDynamicColor(!isDynamicColor)}
        seedColor={seedColor}
        onSetSeedColor={setSeedColor}
        discordEnabled={discordEnabled}
        onToggleDiscord={() => setDiscordEnabled(!discordEnabled)}
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
          onClose={() => setContextMenu(null)}
          onPlay={playTrack}
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
          onRemoveTracks={handleRemoveTracks}
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
      />

      {/* Material 3 Create / Edit Folder Modal */}
      <CreateFolderModal
        isOpen={isCreateFolderOpen || !!editingFolderTarget}
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
        onClose={() => setIsCreateGroupOpen(false)}
        onCreate={handleCreateGroupSubmit}
      />

      {/* Universal Rename Item Modal (Playlist, Folder, Group) */}
      <RenameItemModal
        isOpen={!!renameItemTarget?.isOpen}
        type={renameItemTarget?.type || 'playlist'}
        initialName={renameItemTarget?.item?.name || ''}
        onClose={() => setRenameItemTarget(null)}
        onRename={handleRenameItem}
      />

      {/* Delete Folder Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!deleteFolderTarget}
        title="Удалить папку"
        message={`Вы уверены, что хотите удалить папку «${deleteFolderTarget?.name}»? Все плейлисты и треки внутри сохранятся и будут перемещены наружу.`}
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        isDestructive={true}
        onConfirm={handleConfirmDeleteFolder}
        onClose={() => setDeleteFolderTarget(null)}
      />

      {/* Material 3 Clear Playlist Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!clearPlaylistTarget}
        title="Очистить плейлист"
        message={`Вы уверены, что хотите удалить все треки из плейлиста «${clearPlaylistTarget?.name}»? Все композиции останутся в вашей медиатеке.`}
        confirmLabel="Очистить"
        cancelLabel="Отмена"
        isDestructive={true}
        onConfirm={handleConfirmClearPlaylist}
        onClose={() => setClearPlaylistTarget(null)}
      />

      {/* Material 3 Delete Playlist Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!deletePlaylistTarget}
        title="Удалить плейлист"
        message={`Вы уверены, что хотите безвозвратно удалить плейлист «${deletePlaylistTarget?.name}»? Сами треки останутся в вашей библиотеке.`}
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        isDestructive={true}
        onConfirm={handleConfirmDeletePlaylist}
        onClose={() => setDeletePlaylistTarget(null)}
      />

      {/* Material 3 Track Details Modal */}
      <TrackDetailsModal
        isOpen={!!trackDetailsTarget}
        track={trackDetailsTarget}
        onClose={() => setTrackDetailsTarget(null)}
      />

      {/* Material 3 Synchronized Lyrics Modal */}
      <LyricsModal
        isOpen={isLyricsOpen}
        track={currentTrack}
        currentTime={currentTime}
        isPlaying={isPlaying}
        onSeek={handleSeek}
        onSaveLyrics={handleSaveLyrics}
        onClose={() => setIsLyricsOpen(false)}
      />
    </div>
  );
};
