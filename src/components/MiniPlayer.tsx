import React, { useEffect, useMemo, useRef, useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  ChevronDown,
  ChevronLeft,
  AlertTriangle,
  Disc3,
  Heart,
  Info,
  Layers,
  Mic2,
  Library,
  ListMusic,
  Music2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SlidersHorizontal,
  Trash2,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { Playlist, PlaylistFolder, PlaylistGroup, Track } from '../types/music';
import { getFolderColorHex, getFolderIconComponent } from '../theme/folderIcons';
import { AppLanguage } from '../i18n';
import { formatTime } from '../services/tagEditor';
import { MiniLyricsPane, MiniLyricsTrack } from './MiniLyricsPane';

type LyricsMode = 'closed' | 'attached' | 'detached';
type BottomPanel = 'queue' | 'library' | null;
type LibraryTab = 'tracks' | 'playlists' | 'albums' | 'artists' | 'favorites' | 'genres';
type LibraryCollectionType = 'albums' | 'artists' | 'genres';
interface MiniLibraryCollection { name: string; tracks: Track[]; coverArt?: string; }
type MiniPlaylistEntry =
  | { type: 'folder'; item: PlaylistFolder; order: number }
  | { type: 'playlist'; item: Playlist; order: number };

const groupTracks = (tracks: Track[], getNames: (track: Track) => string | string[] | undefined) => {
  const groups = new Map<string, Track[]>();
  tracks.forEach(track => {
    const names = getNames(track);
    (Array.isArray(names) ? names : [names]).forEach(value => {
      const name = value?.trim();
      if (!name) return;
      const group = groups.get(name);
      if (group) group.push(track);
      else groups.set(name, [track]);
    });
  });
  return [...groups.entries()].map(([name, groupedTracks]): MiniLibraryCollection => ({
    name,
    tracks: groupedTracks,
    coverArt: groupedTracks.find(track => track.coverArt)?.coverArt,
  })).sort((a, b) => a.name.localeCompare(b.name));
};

interface MiniTrackRowProps {
  track: Track;
  active?: boolean;
  selected?: boolean;
  language: AppLanguage;
  buttonRef?: React.Ref<HTMLButtonElement>;
  onClick: () => void;
}

const MiniTrackRow: React.FC<MiniTrackRowProps> = ({ track, active = false, selected = false, language, buttonRef, onClick }) => (
  <button
    ref={buttonRef}
    type="button"
    aria-current={active ? 'true' : undefined}
    aria-selected={selected ? true : undefined}
    onClick={onClick}
    className={`group flex w-full min-w-0 items-center gap-2.5 rounded-2xl p-2 text-left transition-colors ${
      active
        ? 'bg-md3-primary-container font-semibold text-md3-on-primary-container shadow-sm'
        : selected
          ? 'bg-md3-primary/10 ring-1 ring-inset ring-md3-primary/50 text-md3-on-surface'
          : 'text-md3-on-surface hover:bg-md3-surface-container-high'
    }`}
  >
    <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-md3-surface-container-highest shadow-sm">
      {track.coverArt ? (
        <img src={track.coverArt} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-md3-primary/10 text-md3-primary/70"><Music2 size={16} /></span>
      )}
    </span>
    <span className="min-w-0 flex-1">
      <span className={`flex items-center gap-1.5 truncate text-[11px] font-bold ${track.isMissing ? 'text-amber-500 dark:text-amber-400' : ''}`}>
        <span className="truncate">{track.title}</span>
        {track.isMissing && <span title={text(language, 'Файл не найден', 'File not found')}><AlertTriangle size={12} className="shrink-0" /></span>}
      </span>
      <span className="block truncate text-[10px] text-md3-on-surface-variant">{track.artist}</span>
    </span>
    <span className="shrink-0 text-[10px] tabular-nums text-md3-on-surface-variant">{formatTime(track.duration)}</span>
  </button>
);

interface MiniLibraryCardProps {
  title: string;
  subtitle: string;
  onClick: () => void;
  coverArt?: string;
  icon: React.ReactNode;
  accentColor?: string;
}

const MiniLibraryCard: React.FC<MiniLibraryCardProps> = ({ title, subtitle, onClick, coverArt, icon, accentColor }) => (
  <button
    type="button"
    onClick={onClick}
    className="group relative aspect-[1.18] min-w-0 overflow-hidden rounded-xl border border-md3-outline-variant/15 bg-md3-surface-container-high text-left transition-transform hover:scale-[1.02]"
    style={accentColor ? { borderColor: accentColor } : undefined}
  >
    {coverArt ? (
      <img src={coverArt} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105" />
    ) : (
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-md3-primary/20 to-md3-surface-container-high text-md3-primary/70">
        {icon}
      </div>
    )}
    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
    <span className="absolute inset-x-2 bottom-2 min-w-0 text-white">
      <span className="block truncate text-[11px] font-semibold">{title}</span>
      <span className="block truncate text-[9px] text-white/75">{subtitle}</span>
    </span>
  </button>
);

interface MiniPlayerProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  repeatMode: 'off' | 'all' | 'one';
  isShuffled: boolean;
  queue: Track[];
  queueIndex: number;
  tracks: Track[];
  playlists: Playlist[];
  playlistFolders: PlaylistFolder[];
  playlistGroups: PlaylistGroup[];
  language: AppLanguage;
  lyricsMode: LyricsMode;
  discordEnabled: boolean;
  showDiscordButton: boolean;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  onPlayQueueTrack: (index: number) => void;
  onPlayTrack: (track: Track, context: Track[]) => void;
  onClearQueue: () => void;
  onToggleLyrics: () => void;
  onToggleDiscord: () => void;
  onOpenEQ: () => void;
  onToggleFavorite: (trackId: string, event: React.MouseEvent) => void;
  onOpenTrackDetails: (track: Track) => void;
  onDetachLyrics: () => void;
  onAttachLyrics: () => void;
  onCloseLyrics: () => void;
}

const text = (language: AppLanguage, ru: string, en: string) => language === 'ru' ? ru : en;
const queueTrackCount = (count: number, language: AppLanguage) => {
  if (language !== 'ru') return `${count} ${count === 1 ? 'track' : 'tracks'}`;
  const lastTwoDigits = count % 100;
  const lastDigit = count % 10;
  const noun = lastTwoDigits >= 11 && lastTwoDigits <= 14 ? 'треков'
    : lastDigit === 1 ? 'трек'
      : lastDigit >= 2 && lastDigit <= 4 ? 'трека' : 'треков';
  return `${count} ${noun}`;
};

export const MiniPlayer: React.FC<MiniPlayerProps> = ({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  repeatMode,
  isShuffled,
  queue,
  queueIndex,
  tracks,
  playlists,
  playlistFolders,
  playlistGroups,
  language,
  lyricsMode,
  discordEnabled,
  showDiscordButton,
  onPlayPause,
  onPrev,
  onNext,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleShuffle,
  onToggleRepeat,
  onPlayQueueTrack,
  onPlayTrack,
  onClearQueue,
  onToggleLyrics,
  onToggleDiscord,
  onOpenEQ,
  onToggleFavorite,
  onOpenTrackDetails,
  onDetachLyrics,
  onAttachLyrics,
  onCloseLyrics,
}) => {
  const [bottomPanel, setBottomPanel] = useState<BottomPanel>(null);
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('tracks');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [selectedPlaylistFolderId, setSelectedPlaylistFolderId] = useState<string | null>(null);
  const [selectedPlaylistGroupId, setSelectedPlaylistGroupId] = useState<string | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<{ type: LibraryCollectionType; name: string } | null>(null);
  const [isCompactVolHovered, setIsCompactVolHovered] = useState(false);
  const [queueSelectedIndex, setQueueSelectedIndex] = useState(queueIndex);
  const volHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueSelectedItemRef = useRef<HTMLButtonElement>(null);

  const openLibraryPanel = () => {
    setLibraryTab('tracks');
    setSelectedPlaylistId(null);
    setSelectedPlaylistFolderId(null);
    setSelectedPlaylistGroupId(null);
    setSelectedCollection(null);
    setBottomPanel('library');
  };

  useEffect(() => {
    const handleMiniPlayerKeyboard = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditing = Boolean(target?.closest('input, textarea, select, [contenteditable="true"]'));

      if (event.key === 'Escape' || event.code === 'Escape') {
        if (bottomPanel) {
          event.preventDefault();
          event.stopPropagation();
          setBottomPanel(null);
        }
        return;
      }

      if (isEditing) return;

      if (event.key === 'Tab' || event.code === 'Tab') {
        event.preventDefault();
        event.stopPropagation();
        openLibraryPanel();
        return;
      }

      if ((event.code === 'KeyQ' || event.key.toLowerCase() === 'q' || event.key.toLowerCase() === 'й')
        && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        event.stopPropagation();
        if (bottomPanel !== 'queue') {
          setQueueSelectedIndex(queue.length > 0 ? Math.max(0, Math.min(queueIndex, queue.length - 1)) : 0);
          setBottomPanel('queue');
        } else {
          setBottomPanel(null);
        }
        return;
      }

      if (bottomPanel !== 'queue') return;
      if ((event.key === 'ArrowDown' || event.code === 'ArrowDown' || event.key === 'ArrowUp' || event.code === 'ArrowUp')
        && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
        if (queue.length === 0) return;
        event.preventDefault();
        event.stopPropagation();
        const direction = event.key === 'ArrowDown' || event.code === 'ArrowDown' ? 1 : -1;
        setQueueSelectedIndex(current => Math.max(0, Math.min(queue.length - 1, current + direction)));
        return;
      }

      if ((event.key === 'Enter' || event.code === 'Enter') && queue.length > 0) {
        event.preventDefault();
        event.stopPropagation();
        onPlayQueueTrack(Math.max(0, Math.min(queue.length - 1, queueSelectedIndex)));
      }
    };
    window.addEventListener('keydown', handleMiniPlayerKeyboard, true);
    return () => window.removeEventListener('keydown', handleMiniPlayerKeyboard, true);
  }, [bottomPanel, onPlayQueueTrack, queue.length, queueIndex, queueSelectedIndex]);

  useEffect(() => {
    setQueueSelectedIndex(queue.length > 0 ? Math.max(0, Math.min(queueIndex, queue.length - 1)) : 0);
  }, [queueIndex, queue.length]);

  useEffect(() => {
    if (bottomPanel === 'queue') {
      requestAnimationFrame(() => queueSelectedItemRef.current?.scrollIntoView({ block: 'nearest' }));
    }
  }, [bottomPanel, queueSelectedIndex, queue.length]);
  const safeDuration = duration > 0 ? duration : (currentTrack?.duration || 0);
  const safeTime = Math.max(0, Math.min(safeDuration || 0, currentTime));
  const currentPlaylist = playlists.find(playlist => playlist.id === selectedPlaylistId) || null;
  const selectedPlaylistFolder = playlistFolders.find(folder => folder.id === selectedPlaylistFolderId) || null;
  const selectedPlaylistGroup = playlistGroups.find(group => group.id === selectedPlaylistGroupId) || null;
  const playlistFoldersInView = playlistFolders
    .filter(folder => selectedPlaylistFolder
      ? folder.parentId === selectedPlaylistFolder.id
      : selectedPlaylistGroup
        ? !folder.parentId && folder.groupId === selectedPlaylistGroup.id
        : !folder.parentId && !folder.groupId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const playlistsInView = playlists
    .filter(playlist => selectedPlaylistFolder
      ? playlist.folderId === selectedPlaylistFolder.id
      : selectedPlaylistGroup
        ? !playlist.folderId && playlist.groupId === selectedPlaylistGroup.id
        : !playlist.folderId && !playlist.groupId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const playlistEntriesInView: MiniPlaylistEntry[] = [
    ...playlistFoldersInView.map(folder => ({
      type: 'folder' as const,
      item: folder,
      order: folder.order ?? playlistFolders.indexOf(folder) * 10,
    })),
    ...playlistsInView.map(playlist => ({
      type: 'playlist' as const,
      item: playlist,
      order: playlist.order ?? (playlistFolders.length + playlists.indexOf(playlist)) * 10,
    })),
  ].sort((a, b) => a.order - b.order);
  const albums = useMemo(() => groupTracks(tracks, track => track.album?.trim() || text(language, 'Без альбома', 'No Album')), [language, tracks]);
  const artists = useMemo(() => groupTracks(tracks, track => track.artist?.trim() || text(language, 'Неизвестный исполнитель', 'Unknown Artist')), [language, tracks]);
  const genres = useMemo(() => groupTracks(tracks, track => {
    const values = track.genre?.split(/[,/;\\]+/).map(genre => genre.trim()).filter(Boolean);
    return values?.length ? [...new Set(values)] : text(language, 'Без жанра', 'No Genre');
  }), [language, tracks]);
  const selectedCollectionGroup = selectedCollection
    ? (selectedCollection.type === 'albums' ? albums : selectedCollection.type === 'artists' ? artists : genres)
      .find(group => group.name === selectedCollection.name) || null
    : null;
  const libraryTracks = useMemo(() => {
    if (currentPlaylist) {
      const byId = new Map(tracks.map(track => [track.id, track]));
      return currentPlaylist.trackIds.map(id => byId.get(id)).filter((track): track is Track => !!track);
    }
    if (selectedCollection) return selectedCollectionGroup?.tracks || [];
    if (libraryTab === 'favorites') return tracks.filter(track => track.isFavorite);
    if (libraryTab === 'tracks') return tracks;
    return [];
  }, [currentPlaylist, libraryTab, selectedCollection, selectedCollectionGroup, tracks]);
  const visibleCollections = libraryTab === 'albums' ? albums : libraryTab === 'artists' ? artists : genres;
  const lyricsTrack: MiniLyricsTrack | null = currentTrack ? {
    title: currentTrack.title,
    artist: currentTrack.artist,
    lyrics: currentTrack.lyrics,
    isInstrumental: currentTrack.isInstrumental,
    lyricist: currentTrack.lyricist,
  } : null;

  const togglePanel = (panel: Exclude<BottomPanel, null>) => {
    if (bottomPanel === panel) {
      setBottomPanel(null);
      return;
    }
    if (panel === 'queue') {
      setQueueSelectedIndex(queue.length > 0 ? Math.max(0, Math.min(queueIndex, queue.length - 1)) : 0);
    }
    setBottomPanel(panel);
  };

  const handleVolumeMouseEnter = () => {
    if (volHoverTimeoutRef.current) clearTimeout(volHoverTimeoutRef.current);
    setIsCompactVolHovered(true);
  };

  const handleVolumeMouseLeave = () => {
    if (volHoverTimeoutRef.current) clearTimeout(volHoverTimeoutRef.current);
    volHoverTimeoutRef.current = setTimeout(() => setIsCompactVolHovered(false), 200);
  };

  const handleVolumeWheel = (event: React.WheelEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const step = 0.05;
    const delta = event.deltaY < 0 ? step : -step;
    const currentVolume = isMuted ? 0 : volume;
    const nextVolume = Math.max(0, Math.min(1, Math.round((currentVolume + delta) * 100) / 100));
    if (isMuted && delta > 0) onToggleMute();
    onVolumeChange(nextVolume);
  };

  const handleCoverMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !isTauri()) return;
    void getCurrentWindow().startDragging().catch(error => {
      console.warn('Unable to drag the mini-player window:', error);
    });
  };

  const handleVolumeStepClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const currentPercent = isMuted ? 0 : Math.round(volume * 100);
    const nextPercent = currentPercent >= 95 ? 0 : currentPercent < 20 ? 25 : currentPercent < 45 ? 50 : currentPercent < 70 ? 75 : 100;
    if (isMuted && nextPercent > 0) onToggleMute();
    onVolumeChange(nextPercent / 100);
  };

  useEffect(() => () => {
    if (volHoverTimeoutRef.current) clearTimeout(volHoverTimeoutRef.current);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 bg-md3-background text-md3-on-background">
      <section className="relative flex h-full w-[320px] shrink-0 flex-col overflow-hidden border-r border-md3-outline-variant/15 bg-md3-surface">
        <div className="flex min-h-0 flex-1 flex-col items-center gap-3 px-5 pb-3 pt-4">
          <div
            data-tauri-drag-region
            onMouseDown={handleCoverMouseDown}
            onDragStart={event => event.preventDefault()}
            aria-label={text(language, 'Перетащить окно мини-плеера', 'Drag the mini-player window')}
            className="mx-auto flex aspect-square w-full max-w-[280px] shrink-0 items-center justify-center overflow-hidden rounded-[24px] bg-md3-surface-container-high shadow-xl"
          >
            {currentTrack?.coverArt ? (
              <img src={currentTrack.coverArt} alt={currentTrack.title} draggable={false} className="h-full w-full select-none object-cover" />
            ) : (
              <Disc3 className="h-24 w-24 text-md3-primary/40" strokeWidth={1.25} />
            )}
          </div>

          <div className="flex w-full min-w-0 items-center gap-1">
            {currentTrack && (
              <button
                type="button"
                onClick={() => onOpenTrackDetails(currentTrack)}
                title={text(language, 'Сведения о треке', 'Track details')}
                aria-label={text(language, 'Сведения о треке', 'Track details')}
                className="shrink-0 rounded-full p-2 text-md3-on-surface-variant transition-colors hover:bg-md3-surface-container-high hover:text-md3-primary"
              >
                <Info size={17} />
              </button>
            )}
            <button
              type="button"
              onClick={() => currentTrack && onOpenTrackDetails(currentTrack)}
              disabled={!currentTrack}
              className="min-w-0 flex-1 truncate text-center disabled:cursor-default"
              title={currentTrack ? text(language, 'Открыть сведения о треке', 'Open track details') : undefined}
            >
              <span className="block truncate text-base font-bold text-md3-on-surface">
                {currentTrack?.title || text(language, 'Ничего не играет', 'Nothing playing')}
              </span>
              <span className="mt-0.5 block truncate text-sm text-md3-on-surface-variant">
                {currentTrack?.artist || text(language, 'Выберите трек', 'Choose a track')}
              </span>
            </button>
            {currentTrack && (
              <button
                type="button"
                onClick={event => onToggleFavorite(currentTrack.id, event)}
                title={currentTrack.isFavorite ? text(language, 'Убрать из избранного', 'Remove from favorites') : text(language, 'Добавить в избранное', 'Add to favorites')}
                aria-label={currentTrack.isFavorite ? text(language, 'Убрать из избранного', 'Remove from favorites') : text(language, 'Добавить в избранное', 'Add to favorites')}
                aria-pressed={currentTrack.isFavorite}
                className={`shrink-0 rounded-full p-2 transition-colors ${currentTrack.isFavorite ? 'text-red-500' : 'text-md3-on-surface-variant hover:text-red-500'}`}
              >
                <Heart size={18} className={currentTrack.isFavorite ? 'fill-current' : ''} />
              </button>
            )}
          </div>

          <div className="w-full space-y-1">
            <input
              aria-label={text(language, 'Позиция трека', 'Track position')}
              type="range"
              min={0}
              max={safeDuration || 1}
              step={0.1}
              value={safeTime}
              disabled={!currentTrack}
              onChange={event => onSeek(Number(event.target.value))}
              className="mini-player-timeline h-2.5 w-full cursor-pointer disabled:cursor-default"
              style={{ '--progress': `${safeDuration > 0 ? (safeTime / safeDuration) * 100 : 0}%` } as React.CSSProperties}
            />
            <div className="flex justify-between font-mono text-[10px] text-md3-on-surface-variant">
              <span>{formatTime(safeTime)}</span>
              <span>{formatTime(safeDuration)}</span>
            </div>
          </div>

          <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center">
            <div className="flex min-w-0 items-center justify-start gap-0.5">
              <button type="button" onClick={onOpenEQ} title={text(language, 'Эквалайзер', 'Equalizer')} aria-label={text(language, 'Эквалайзер', 'Equalizer')} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-md3-outline-variant/15 bg-md3-surface-container text-md3-on-surface-variant shadow-xs hover:bg-md3-surface-container-high hover:text-md3-on-surface">
                <SlidersHorizontal size={14} />
              </button>
              {showDiscordButton && (
                <button
                  type="button"
                  onClick={onToggleDiscord}
                  title={language === 'ru' ? `Discord RPC: ${discordEnabled ? 'включен' : 'выключен'} — переключить` : `Discord RPC: ${discordEnabled ? 'enabled' : 'disabled'} — toggle`}
                  aria-label={language === 'ru' ? 'Переключить Discord RPC' : 'Toggle Discord RPC'}
                  aria-pressed={discordEnabled}
                  className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border shadow-xs transition-colors ${discordEnabled ? 'border-[#5865F2]/40 bg-[#5865F2]/20 text-[#7289da]' : 'border-md3-outline-variant/15 bg-md3-surface-container text-md3-on-surface-variant hover:bg-md3-surface-container-high'}`}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${discordEnabled ? 'animate-pulse bg-[#5865F2]' : 'bg-gray-400'}`} />
                </button>
              )}
            </div>

            <div className="flex items-center justify-center gap-0.5">
              <button type="button" onClick={onToggleShuffle} title={isShuffled ? text(language, 'Перемешивание включено', 'Shuffle on') : text(language, 'Перемешивание выключено', 'Shuffle off')} aria-pressed={isShuffled} className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${isShuffled ? 'bg-md3-primary/10 text-md3-primary' : 'text-md3-on-surface-variant hover:bg-md3-surface-container-high hover:text-md3-on-surface'}`}>
                <Shuffle size={14} />
              </button>
              <button type="button" onClick={onPrev} title={text(language, 'Предыдущий трек', 'Previous track')} aria-label={text(language, 'Предыдущий трек', 'Previous track')} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-md3-on-surface hover:bg-md3-surface-container-high">
                <SkipBack size={17} />
              </button>
              <button type="button" onClick={onPlayPause} disabled={!currentTrack} title={isPlaying ? text(language, 'Пауза', 'Pause') : text(language, 'Воспроизвести', 'Play')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-md3-primary text-md3-on-primary shadow-lg transition-transform hover:scale-105 active:scale-95 disabled:opacity-40">
                {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
              </button>
              <button type="button" onClick={onNext} title={text(language, 'Следующий трек', 'Next track')} aria-label={text(language, 'Следующий трек', 'Next track')} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-md3-on-surface hover:bg-md3-surface-container-high">
                <SkipForward size={17} />
              </button>
              <button type="button" onClick={onToggleRepeat} title={`${text(language, 'Повтор', 'Repeat')}: ${repeatMode}`} aria-pressed={repeatMode !== 'off'} className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${repeatMode !== 'off' ? 'bg-md3-primary/10 text-md3-primary' : 'text-md3-on-surface-variant hover:bg-md3-surface-container-high hover:text-md3-on-surface'}`}>
                {repeatMode === 'one' ? <Repeat1 size={14} /> : <Repeat size={14} />}
              </button>
            </div>

            <div className="flex min-w-0 items-center justify-end gap-0.5">
              <div
                className="relative flex shrink-0 items-center justify-center"
                onMouseEnter={handleVolumeMouseEnter}
                onMouseLeave={handleVolumeMouseLeave}
                onWheel={handleVolumeWheel}
              >
                <button
                  type="button"
                  onClick={handleVolumeStepClick}
                  title={text(language, 'Громкость: нажмите для переключения уровня, наведите для точной настройки', 'Volume: click to cycle levels, hover for fine control')}
                  aria-label={text(language, 'Громкость', 'Volume')}
                  className={`flex h-7 w-7 items-center justify-center rounded-full border shadow-xs transition-all ${
                    isMuted || volume === 0
                      ? 'border-red-500/20 bg-red-500/10 text-red-400'
                      : 'border-md3-outline-variant/15 bg-md3-surface-container text-md3-on-surface-variant hover:bg-md3-surface-container-high hover:text-md3-on-surface'
                  }`}
                >
                  {isMuted || volume === 0 ? <VolumeX size={14} /> : volume < 0.5 ? <Volume1 size={14} /> : <Volume2 size={14} />}
                </button>
                {isCompactVolHovered && (
                  <div
                    className="absolute bottom-full left-1/2 z-50 -translate-x-1/2 pb-2 animate-in fade-in zoom-in-95 duration-150"
                    onMouseEnter={handleVolumeMouseEnter}
                    onMouseLeave={handleVolumeMouseLeave}
                    onClick={event => event.stopPropagation()}
                  >
                    <div className="flex min-w-[56px] flex-col items-center rounded-2xl border border-md3-outline-variant/30 bg-md3-surface-container-high/95 p-3 shadow-2xl backdrop-blur-xl">
                      <span className="mb-2 select-none font-mono text-[11px] font-bold text-md3-primary">{Math.round((isMuted ? 0 : volume) * 100)}%</span>
                      <div className="flex h-28 items-center justify-center py-1">
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          aria-label={text(language, 'Точная настройка громкости', 'Fine volume control')}
                          value={isMuted ? 0 : volume}
                          onChange={event => {
                            if (isMuted) onToggleMute();
                            onVolumeChange(Number(event.target.value));
                          }}
                          style={{ writingMode: 'vertical-lr', direction: 'rtl', height: '100px', width: '20px' }}
                          className="cursor-pointer accent-md3-primary outline-none"
                        />
                      </div>
                      <button type="button" onClick={onToggleMute} className="mt-2 rounded-full bg-md3-surface-container px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-md3-on-surface-variant transition-colors hover:bg-md3-surface-container-highest hover:text-md3-on-surface">
                        {isMuted || volume === 0 ? text(language, 'Включить', 'Unmute') : text(language, 'Без звука', 'Mute')}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={onToggleLyrics}
                disabled={!currentTrack}
                title={!currentTrack ? text(language, 'Текст песни', 'Lyrics') : currentTrack.lyrics?.trim() ? text(language, 'Открыть текст песни', 'Open lyrics') : text(language, 'Текст не добавлен', 'No lyrics added')}
                aria-label={text(language, 'Текст песни', 'Lyrics')}
                className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                  lyricsMode !== 'closed' || currentTrack?.lyrics?.trim()
                    ? 'bg-md3-primary/15 text-md3-primary hover:bg-md3-primary/25'
                    : 'border border-md3-outline-variant/15 bg-md3-surface-container text-md3-on-surface-variant hover:bg-md3-surface-container-high hover:text-md3-on-surface'
                }`}
              >
                <Mic2 size={14} />
                {!!currentTrack?.lyrics?.trim() && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-md3-primary" />}
              </button>

            </div>
          </div>

          <button
            type="button"
            onClick={() => togglePanel('queue')}
            aria-expanded={bottomPanel !== null}
            className={`my-auto flex h-8 w-full items-center justify-between rounded-full border px-4 text-xs transition-colors ${
              bottomPanel === 'queue'
                ? 'border-md3-primary/30 bg-md3-primary/10 text-md3-primary'
                : 'border-md3-outline-variant/20 bg-md3-surface-container-low text-md3-on-surface-variant hover:bg-md3-surface-container-high hover:text-md3-on-surface'
            }`}
          >
            <span className="flex items-center gap-2"><ListMusic size={14} />{text(language, 'Очередь', 'Queue')}<span className="rounded-full bg-md3-surface-container-high px-1.5 py-0.5 text-[9px]">{queue.length}</span></span>
            <ChevronDown size={15} className={`transition-transform ${bottomPanel === 'queue' ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {bottomPanel && (
          <div className={`absolute inset-x-0 bottom-0 z-20 flex min-h-[220px] flex-col overflow-hidden rounded-t-2xl border-t border-md3-outline-variant/25 bg-md3-surface-container shadow-[0_-16px_45px_rgba(0,0,0,0.35)] anim-mini-panel-in ${bottomPanel === 'queue' ? 'h-[62%]' : 'max-h-[62%]'}`}>
            {bottomPanel === 'queue' ? (
              <>
                <header className="flex h-12 shrink-0 items-center gap-1.5 border-b border-md3-outline-variant/15 px-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-md3-primary/10 text-md3-primary"><ListMusic size={15} /></span>
                  <button type="button" onClick={openLibraryPanel} className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-md3-primary hover:bg-md3-primary/10">
                    <Library size={13} />{text(language, 'Библиотека', 'Library')}
                  </button>
                  <span className="min-w-0 flex-1" />
                  <span className="shrink-0 rounded-full bg-md3-surface-container-high px-2 py-1 text-[9px] font-semibold tabular-nums text-md3-on-surface-variant">{queueTrackCount(queue.length, language)}</span>
                  <button
                    type="button"
                    onClick={onClearQueue}
                    disabled={queue.length === 0}
                    title={text(language, 'Очистить очередь', 'Clear queue')}
                    aria-label={text(language, 'Очистить очередь', 'Clear queue')}
                    className="rounded-lg p-1.5 text-md3-on-surface-variant hover:bg-md3-surface-container-high disabled:opacity-30"
                  >
                    <Trash2 size={15} />
                  </button>
                  <button type="button" onClick={() => setBottomPanel(null)} aria-label={text(language, 'Закрыть', 'Close')} className="rounded-lg p-1.5 text-md3-on-surface-variant hover:bg-md3-surface-container-high"><X size={15} /></button>
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar p-2">
                  {queue.map((track, index) => (
                    <MiniTrackRow
                      key={`${track.id}-${index}`}
                      track={track}
                      active={index === queueIndex}
                      selected={index === queueSelectedIndex}
                      language={language}
                      buttonRef={index === queueSelectedIndex ? queueSelectedItemRef : undefined}
                      onClick={() => onPlayQueueTrack(index)}
                    />
                  ))}
                  {queue.length === 0 && <p className="p-6 text-center text-xs text-md3-on-surface-variant">{text(language, 'Очередь пуста', 'Queue is empty')}</p>}
                </div>
              </>
            ) : (
              <>
                <header className="flex h-11 shrink-0 items-center gap-1.5 border-b border-md3-outline-variant/15 px-2">
                  {(currentPlaylist || selectedCollection || selectedPlaylistFolder || selectedPlaylistGroup) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (currentPlaylist) setSelectedPlaylistId(null);
                        else if (selectedCollection) setSelectedCollection(null);
                        else if (selectedPlaylistFolder) setSelectedPlaylistFolderId(selectedPlaylistFolder.parentId || null);
                        else if (selectedPlaylistGroup) setSelectedPlaylistGroupId(null);
                      }}
                      aria-label={text(language, 'Назад', 'Go back')}
                      className="rounded-lg p-1.5 text-md3-on-surface-variant hover:bg-md3-surface-container-high"
                    ><ChevronLeft size={16} /></button>
                  )}
                  <Library size={15} className="shrink-0 text-md3-primary" />
                  <strong className="min-w-0 flex-1 truncate text-[11px]">
                    {currentPlaylist?.name || selectedCollectionGroup?.name || selectedPlaylistFolder?.name || selectedPlaylistGroup?.name || text(language, 'Библиотека', 'Library')}
                  </strong>
                  <button type="button" onClick={() => togglePanel('queue')} title={text(language, 'Очередь', 'Queue')} className="rounded-lg p-1.5 text-md3-on-surface-variant hover:bg-md3-surface-container-high"><ListMusic size={15} /></button>
                  <button type="button" onClick={() => setBottomPanel(null)} aria-label={text(language, 'Закрыть', 'Close')} className="rounded-lg p-1.5 text-md3-on-surface-variant hover:bg-md3-surface-container-high"><X size={15} /></button>
                </header>
                <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-md3-outline-variant/10 px-2 py-1.5 custom-scrollbar">
                  {(['tracks', 'playlists', 'albums', 'artists', 'favorites', 'genres'] as LibraryTab[]).map(tab => {
                    const label = tab === 'tracks' ? text(language, 'Треки', 'Tracks')
                      : tab === 'playlists' ? text(language, 'Плейлисты', 'Playlists')
                        : tab === 'albums' ? text(language, 'Альбомы', 'Albums')
                          : tab === 'artists' ? text(language, 'Артисты', 'Artists')
                            : tab === 'favorites' ? text(language, 'Избранное', 'Favorites')
                              : text(language, 'Жанры', 'Genres');
                    const active = (currentPlaylist || selectedCollection) ? tab === libraryTab : libraryTab === tab;
                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => { setLibraryTab(tab); setSelectedPlaylistId(null); setSelectedPlaylistFolderId(null); setSelectedPlaylistGroupId(null); setSelectedCollection(null); }}
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] transition-colors ${active ? 'bg-md3-primary text-md3-on-primary' : 'bg-md3-surface-container-high text-md3-on-surface-variant hover:text-md3-on-surface'}`}
                      >{label}</button>
                    );
                  })}
                </nav>
                <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar p-2">
                  {libraryTab === 'playlists' && !currentPlaylist && !selectedCollection && (
                    <div className="space-y-3">
                      {!selectedPlaylistFolder && !selectedPlaylistGroup && playlistGroups.length > 0 && (
                        <section className="space-y-1.5">
                          <h3 className="px-1 text-[9px] font-bold uppercase tracking-wider text-md3-on-surface-variant/75">
                            {text(language, 'Группы', 'Groups')}
                          </h3>
                          <div className="grid grid-cols-2 gap-2">
                            {playlistGroups.map(group => {
                              const itemCount = playlistFolders.filter(folder => !folder.parentId && folder.groupId === group.id).length
                                + playlists.filter(playlist => !playlist.folderId && playlist.groupId === group.id).length;
                              const color = group.color ? getFolderColorHex(group.color) : undefined;
                              return (
                                <MiniLibraryCard
                                  key={group.id}
                                  title={group.name}
                                  subtitle={`${itemCount} ${text(language, 'элементов', 'items')}${group.isIsolated ? ` · ${text(language, 'изолированная', 'isolated')}` : ''}`}
                                  icon={<Layers size={28} />}
                                  accentColor={color}
                                  onClick={() => {
                                    setSelectedPlaylistGroupId(group.id);
                                    setSelectedPlaylistFolderId(null);
                                    setSelectedPlaylistId(null);
                                  }}
                                />
                              );
                            })}
                          </div>
                        </section>
                      )}

                      {playlistEntriesInView.length > 0 && (
                        <section className="space-y-1.5">
                          {(playlistGroups.length > 0 || selectedPlaylistFolder || selectedPlaylistGroup) && (
                            <h3 className="px-1 text-[9px] font-bold uppercase tracking-wider text-md3-on-surface-variant/75">
                              {text(language, 'Папки и плейлисты', 'Folders and playlists')}
                            </h3>
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            {playlistEntriesInView.map(entry => {
                              if (entry.type === 'folder') {
                                const folder = entry.item;
                                const FolderIcon = getFolderIconComponent(folder.icon);
                                const folderPlaylists = playlists.filter(playlist => playlist.folderId === folder.id);
                                const folderSubfolders = playlistFolders.filter(child => child.parentId === folder.id);
                                const cover = folderPlaylists.find(playlist => playlist.coverArt)?.coverArt
                                  || tracks.find(track => folderPlaylists.some(playlist => playlist.trackIds.includes(track.id)) && track.coverArt)?.coverArt;
                                return (
                                  <MiniLibraryCard
                                    key={`folder-${folder.id}`}
                                    title={folder.name}
                                    subtitle={`${folderPlaylists.length + folderSubfolders.length} ${text(language, 'элементов', 'items')}`}
                                    coverArt={folder.coverType && folder.coverType !== 'icon' ? cover : undefined}
                                    icon={<FolderIcon size={28} />}
                                    accentColor={folder.color ? getFolderColorHex(folder.color) : undefined}
                                    onClick={() => {
                                      setSelectedPlaylistFolderId(folder.id);
                                      setSelectedPlaylistId(null);
                                    }}
                                  />
                                );
                              }
                              const playlist = entry.item;
                              const cover = playlist.coverArt || tracks.find(track => playlist.trackIds.includes(track.id) && track.coverArt)?.coverArt;
                              const PlaylistIcon = playlist.icon ? getFolderIconComponent(playlist.icon) : ListMusic;
                              return (
                                <MiniLibraryCard
                                  key={`playlist-${playlist.id}`}
                                  title={playlist.name}
                                  subtitle={`${playlist.trackIds.length} ${text(language, 'треков', 'tracks')}`}
                                  coverArt={cover}
                                  icon={<PlaylistIcon size={28} />}
                                  accentColor={playlist.color ? getFolderColorHex(playlist.color) : undefined}
                                  onClick={() => setSelectedPlaylistId(playlist.id)}
                                />
                              );
                            })}
                          </div>
                        </section>
                      )}

                      {playlistEntriesInView.length === 0
                        && ((selectedPlaylistFolder || selectedPlaylistGroup) || playlistGroups.length === 0) && (
                        <p className="p-6 text-center text-xs text-md3-on-surface-variant">
                          {text(language, 'Плейлистов и папок пока нет', 'No playlists or folders yet')}
                        </p>
                      )}
                    </div>
                  )}
                  {(['albums', 'artists', 'genres'] as LibraryTab[]).includes(libraryTab) && !selectedCollection && (
                    visibleCollections.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {visibleCollections.map(group => (
                          <button
                            key={group.name}
                            type="button"
                            onClick={() => setSelectedCollection({ type: libraryTab as LibraryCollectionType, name: group.name })}
                            className="group relative aspect-[1.18] min-w-0 overflow-hidden rounded-xl bg-md3-surface-container-high text-left"
                          >
                            {group.coverArt ? <img src={group.coverArt} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-md3-primary/20 to-md3-surface-container-high"><Disc3 size={28} className="text-md3-primary/65" /></div>}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                            <span className="absolute inset-x-2 bottom-2 min-w-0 text-white">
                              <span className="block truncate text-[11px] font-semibold">{group.name}</span>
                              <span className="block truncate text-[9px] text-white/75">{group.tracks.length} {text(language, 'треков', 'tracks')}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : <p className="p-6 text-center text-xs text-md3-on-surface-variant">{text(language, 'Ничего не найдено', 'Nothing here yet')}</p>
                  )}
                  {(libraryTab === 'tracks' || libraryTab === 'favorites' || currentPlaylist || selectedCollection) && (
                    <>
                      {libraryTracks.map(track => (
                        <MiniTrackRow
                          key={track.id}
                          track={track}
                          active={track.id === currentTrack?.id}
                          language={language}
                          onClick={() => onPlayTrack(track, libraryTracks)}
                        />
                      ))}
                      {libraryTracks.length === 0 && <p className="p-6 text-center text-xs text-md3-on-surface-variant">{text(language, libraryTab === 'favorites' ? 'В избранном пока нет треков' : 'В этом списке нет треков', libraryTab === 'favorites' ? 'No favorite tracks yet' : 'No tracks in this list')}</p>}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </section>

      {lyricsMode === 'attached' && (
        <MiniLyricsPane
          track={lyricsTrack}
          currentTime={currentTime}
          language={language}
          attachedToMiniPlayer
          onDetach={onDetachLyrics}
          onClose={onCloseLyrics}
          onSeek={onSeek}
        />
      )}
    </div>
  );
};
