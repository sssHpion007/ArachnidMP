import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Track, Playlist, ThemeMode } from './types/music';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { TrackTable } from './components/TrackTable';
import { NowPlayingBar } from './components/NowPlayingBar';
import { QueueDrawer } from './components/QueueDrawer';
import { BatchTagEditorModal } from './components/BatchTagEditorModal';
import { EqualizerModal } from './components/EqualizerModal';
import { SettingsModal } from './components/SettingsModal';
import { DragDropOverlay } from './components/DragDropOverlay';
import { ContextMenu } from './components/ContextMenu';
import { PlaylistContextMenu } from './components/PlaylistContextMenu';
import { PlaylistsGridView } from './components/PlaylistsGridView';
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
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<string>('tracks');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
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

  // Theming & M3 State
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  const [isDynamicColor, setIsDynamicColor] = useState<boolean>(true);
  const [seedColor, setSeedColor] = useState<string>(DEFAULT_SEED_COLOR);

  // Modals & Menus
  const [isEQOpen, setIsEQOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isBatchTagEditorOpen, setIsBatchTagEditorOpen] = useState<boolean>(false);
  const [isQueueOpen, setIsQueueOpen] = useState<boolean>(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; track: Track } | null>(null);
  const [playlistContextMenu, setPlaylistContextMenu] = useState<{ x: number; y: number; playlist: Playlist } | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const [discordEnabled, setDiscordEnabled] = useState<boolean>(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef<number>(0);
  const isLoadedRef = useRef<boolean>(false);

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
          }
          if (parsed.playlists && Array.isArray(parsed.playlists) && parsed.playlists.length > 0) {
            setPlaylists(parsed.playlists);
          }
          if (parsed.themeMode) setThemeMode(parsed.themeMode);
          if (parsed.seedColor) setSeedColor(parsed.seedColor);
          if (typeof parsed.discordEnabled === 'boolean') setDiscordEnabled(parsed.discordEnabled);
          if (typeof parsed.isDynamicColor === 'boolean') setIsDynamicColor(parsed.isDynamicColor);
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
      themeMode,
      seedColor,
      discordEnabled,
      isDynamicColor,
    };

    const jsonString = JSON.stringify(dataToSave);

    if (isTauri()) {
      invoke('save_portable_data', { data: jsonString }).catch((e) => {
        console.warn('Failed to save to portable folder:', e);
      });
    } else {
      localStorage.setItem('arachnid_portable_data', jsonString);
    }
  }, [tracks, playlists, themeMode, seedColor, discordEnabled, isDynamicColor]);

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
      dragCounterRef.current++;
      if (e.dataTransfer?.types?.includes('Files')) {
        setIsDraggingFile(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current--;
      if (dragCounterRef.current <= 0) {
        setIsDraggingFile(false);
        dragCounterRef.current = 0;
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDrop = async (e: DragEvent) => {
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
  const filteredTracks = useMemo(() => {
    let result = [...tracks];

    if (selectedPlaylistId) {
      const pl = playlists.find(p => p.id === selectedPlaylistId);
      if (pl) {
        const idSet = new Set(pl.trackIds);
        result = result.filter(t => idSet.has(t.id));
      }
    } else if (currentView === 'favorites') {
      result = result.filter(t => t.isFavorite);
    }

    if (activeGenre) {
      result = result.filter(t => t.genre?.toLowerCase().includes(activeGenre.toLowerCase()));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      let valA: any = a[sortBy as keyof Track] || '';
      let valB: any = b[sortBy as keyof Track] || '';
      if (typeof valA === 'string') {
        const cmp = valA.localeCompare(valB);
        return sortOrder === 'asc' ? cmp : -cmp;
      }
      return sortOrder === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });

    return result;
  }, [tracks, selectedPlaylistId, currentView, activeGenre, searchQuery, sortBy, sortOrder, playlists]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        handlePlayPause();
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
  }, [isPlaying, currentTrack, queue, queueIndex, filteredTracks]);

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
        dateAdded: Date.now(),
        playCount: 0,
        isFavorite: false,
      }));

      // Deduplicate: avoid adding identical paths or titles
      setTracks(prev => {
        const existingKeys = new Set(prev.map(t => t.path || `${t.title}-${t.artist}`));
        const unique = newTracks.filter(t => !existingKeys.has(t.path || `${t.title}-${t.artist}`));
        return [...prev, ...unique];
      });

      setQueue(prev => {
        const existingKeys = new Set(prev.map(t => t.path || `${t.title}-${t.artist}`));
        const unique = newTracks.filter(t => !existingKeys.has(t.path || `${t.title}-${t.artist}`));
        return [...prev, ...unique];
      });

      if (!currentTrack || tracks.length === 0) {
        playTrack(newTracks[0]);
      }
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
      setTracks((prev) => {
        const existingKeys = new Set(prev.map(t => `${t.title}-${t.artist}-${t.fileSize}`));
        const unique = newTracks.filter(t => !existingKeys.has(`${t.title}-${t.artist}-${t.fileSize}`));
        return [...prev, ...unique];
      });
      setQueue((prev) => {
        const existingKeys = new Set(prev.map(t => `${t.title}-${t.artist}-${t.fileSize}`));
        const unique = newTracks.filter(t => !existingKeys.has(`${t.title}-${t.artist}-${t.fileSize}`));
        return [...prev, ...unique];
      });
      if (!currentTrack || tracks.length === 0) {
        playTrack(newTracks[0]);
      }
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
            dateAdded: Date.now(),
            playCount: 0,
            isFavorite: false,
          }));

          setTracks(prev => {
            const existingKeys = new Set(prev.map(tr => tr.path || `${tr.title}-${tr.artist}`));
            const unique = newTracks.filter(tr => !existingKeys.has(tr.path || `${tr.title}-${tr.artist}`));
            return [...prev, ...unique];
          });
          setQueue(prev => {
            const existingKeys = new Set(prev.map(tr => tr.path || `${tr.title}-${tr.artist}`));
            const unique = newTracks.filter(tr => !existingKeys.has(tr.path || `${tr.title}-${tr.artist}`));
            return [...prev, ...unique];
          });
          if (!currentTrack || tracks.length === 0) {
            playTrack(newTracks[0]);
          }
          return;
        }
      } catch (err) {
        console.warn('Native open file dialog error, fallback to HTML:', err);
      }
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
      audioEngine.pause();
      setIsPlaying(false);
    } else {
      await audioEngine.resume();
      setIsPlaying(true);
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
    if (repeatMode === 'off') setRepeatMode('all');
    else if (repeatMode === 'all') setRepeatMode('one');
    else setRepeatMode('off');
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

  const handleCreatePlaylist = () => {
    const name = prompt('Введите название нового плейлиста:', `Плейлист #${playlists.length + 1}`);
    if (name && name.trim()) {
      const newPl: Playlist = {
        id: `pl_${Date.now()}`,
        name: name.trim(),
        trackIds: Array.from(selectedTrackIds),
        isSystem: false,
      };
      setPlaylists(prev => [...prev, newPl]);
      setSelectedPlaylistId(newPl.id);
    }
  };

  const handlePlayPlaylist = (playlist: Playlist) => {
    const plTracks = tracks.filter(t => playlist.trackIds.includes(t.id));
    if (plTracks.length > 0) {
      setQueue(plTracks);
      setQueueIndex(0);
      playTrack(plTracks[0]);
    }
  };

  const handleAddPlaylistToQueue = (playlist: Playlist) => {
    const plTracks = tracks.filter(t => playlist.trackIds.includes(t.id));
    setQueue(prev => [...prev, ...plTracks]);
  };

  const handleRenamePlaylist = (playlist: Playlist) => {
    const newName = prompt('Новое название плейлиста:', playlist.name);
    if (newName && newName.trim()) {
      setPlaylists(prev => prev.map(p => p.id === playlist.id ? { ...p, name: newName.trim() } : p));
    }
  };

  const handleClearPlaylist = (playlist: Playlist) => {
    if (confirm(`Очистить все треки из плейлиста "${playlist.name}"?`)) {
      setPlaylists(prev => prev.map(p => p.id === playlist.id ? { ...p, trackIds: [] } : p));
    }
  };

  const handleDeletePlaylist = (playlist: Playlist) => {
    if (confirm(`Удалить плейлист "${playlist.name}"?`)) {
      setPlaylists(prev => prev.filter(p => p.id !== playlist.id));
      if (selectedPlaylistId === playlist.id) {
        setSelectedPlaylistId(null);
      }
    }
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

      {/* Main Layout: Sidebar + Content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          currentView={currentView}
          onSelectView={(v) => {
            setCurrentView(v);
            setSelectedPlaylistId(null);
          }}
          playlists={playlists}
          selectedPlaylistId={selectedPlaylistId}
          onSelectPlaylist={(id) => setSelectedPlaylistId(id)}
          onCreatePlaylist={handleCreatePlaylist}
          onDropTracksToPlaylist={handleDropTracksToPlaylist}
          onOpenPlaylistContextMenu={(e, pl) => {
            e.preventDefault();
            setPlaylistContextMenu({ x: e.clientX, y: e.clientY, playlist: pl });
          }}
          onOpenEQ={() => setIsEQOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          onOpenFiles={handleOpenFiles}
        />

        {/* Center Main View */}
        <main className="flex-1 flex flex-col min-w-0 h-full bg-md3-surface">
          {/* Top Bar with Search & Quick Filters */}
          <TopBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            activeGenre={activeGenre}
            onSelectGenre={setActiveGenre}
            genres={genres}
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
            totalTracksCount={filteredTracks.length}
          />

          {/* Main View: Grid of Playlists or Track Table */}
          {currentView === 'playlists_grid' && !selectedPlaylistId ? (
            <PlaylistsGridView
              playlists={playlists}
              tracks={tracks}
              onSelectPlaylist={(id) => setSelectedPlaylistId(id)}
              onCreatePlaylist={handleCreatePlaylist}
              onPlayPlaylist={handlePlayPlaylist}
              onOpenContextMenu={(e, pl) => {
                e.preventDefault();
                setPlaylistContextMenu({ x: e.clientX, y: e.clientY, playlist: pl });
              }}
            />
          ) : (
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
      </div>

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
        onOpenEQ={() => setIsEQOpen(true)}
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
        />
      )}

      {/* Playlist Context Menu */}
      {playlistContextMenu && (
        <PlaylistContextMenu
          x={playlistContextMenu.x}
          y={playlistContextMenu.y}
          playlist={playlistContextMenu.playlist}
          onClose={() => setPlaylistContextMenu(null)}
          onPlay={handlePlayPlaylist}
          onAddToQueue={handleAddPlaylistToQueue}
          onRename={handleRenamePlaylist}
          onClear={handleClearPlaylist}
          onDelete={handleDeletePlaylist}
        />
      )}
    </div>
  );
};
