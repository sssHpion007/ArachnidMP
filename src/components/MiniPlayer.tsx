import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
} from 'lucide-react';
import { Playlist, PlaylistFolder, PlaylistGroup, Track } from '../types/music';
import { getFolderColorHex, getFolderIconComponent } from '../theme/folderIcons';
import { AppLanguage } from '../i18n';
import { formatTime } from '../services/tagEditor';
import { MiniLyricsPane, MiniLyricsTrack } from './MiniLyricsPane';
import { useLibraryCollectionGroups } from '../hooks/useLibraryCollectionGroups';
import type { LibraryCollectionGroup } from '../services/libraryCollectionIndex';
import { coverVariantUrl } from '../utils/coverArt';
import { VirtualizedCollectionGrid } from './VirtualizedCollectionGrid';
import { FadeInImage } from './FadeInImage';
import { CrossfadeImage } from './CrossfadeImage';
import { getFolderTrackIds } from '../services/folderPlayback';
import { logger } from '../services/logger';

type LyricsMode = 'closed' | 'attached' | 'detached';
type BottomPanel = 'queue' | 'library' | null;
type LibraryTab = 'tracks' | 'playlists' | 'albums' | 'artists' | 'favorites' | 'genres';
type LibraryCollectionType = 'albums' | 'artists' | 'genres';
type MiniPlaylistEntry =
  | { type: 'folder'; item: PlaylistFolder; order: number }
  | { type: 'playlist'; item: Playlist; order: number };

const MINI_TRACK_ROW_HEIGHT = 56;
const MINI_TRACK_OVERSCAN = 6;

type FixedRowRange<T> = { items: T[]; startIndex: number; totalHeight: number };

const getFixedRowRange = <T,>(items: T[], scrollTop: number, viewportHeight: number): FixedRowRange<T> => {
  const startIndex = Math.max(0, Math.floor(scrollTop / MINI_TRACK_ROW_HEIGHT) - MINI_TRACK_OVERSCAN);
  const endIndex = Math.min(
    items.length,
    Math.ceil((scrollTop + viewportHeight) / MINI_TRACK_ROW_HEIGHT) + MINI_TRACK_OVERSCAN,
  );
  return {
    items: items.slice(startIndex, endIndex),
    startIndex,
    totalHeight: items.length * MINI_TRACK_ROW_HEIGHT,
  };
};

const scrollFixedRowIntoView = (
  container: HTMLDivElement | null,
  index: number,
  align: 'nearest' | 'center' = 'nearest',
  behavior: ScrollBehavior = 'auto',
) => {
  if (!container || index < 0) return;
  const rowTop = index * MINI_TRACK_ROW_HEIGHT;
  const rowBottom = rowTop + MINI_TRACK_ROW_HEIGHT;
  let targetTop = container.scrollTop;
  if (align === 'center') {
    targetTop = rowTop - (container.clientHeight - MINI_TRACK_ROW_HEIGHT) / 2;
  } else if (rowTop < container.scrollTop) {
    targetTop = rowTop;
  } else if (rowBottom > container.scrollTop + container.clientHeight) {
    targetTop = rowBottom - container.clientHeight;
  }
  const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
  container.scrollTo({ top: Math.max(0, Math.min(maxScrollTop, targetTop)), behavior });
};

interface MiniTrackRowProps {
  track: Track;
  active?: boolean;
  selected?: boolean;
  language: AppLanguage;
  index?: number;
  totalCount?: number;
  style?: React.CSSProperties;
  onClick: () => void;
}

const MiniTrackRow: React.FC<MiniTrackRowProps> = ({ track, active = false, selected = false, language, index, totalCount, style, onClick }) => (
  <button
    type="button"
    role={index !== undefined ? 'listitem' : undefined}
    aria-posinset={index !== undefined ? index + 1 : undefined}
    aria-setsize={totalCount}
    style={style}
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
        <img src={coverVariantUrl(track.coverArt, 96)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
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
  onPlay?: () => void;
  playLabel?: string;
  onResolveCover?: () => Promise<string | null>;
}

const MiniLibraryCard: React.FC<MiniLibraryCardProps> = ({
  title,
  subtitle,
  onClick,
  coverArt,
  icon,
  accentColor,
  onPlay,
  playLabel,
  onResolveCover,
}) => {
  const [resolvedCover, setResolvedCover] = useState<string | null>(null);
  useEffect(() => {
    if (coverArt || !onResolveCover) {
      setResolvedCover(null);
      return;
    }
    let active = true;
    void onResolveCover().then(cover => {
      if (active) setResolvedCover(cover);
    }).catch(() => {});
    return () => { active = false; };
  }, [coverArt, onResolveCover]);
  const displayedCover = coverArt || resolvedCover;

  return (
  <div
    className="group relative aspect-square min-w-0 overflow-hidden rounded-xl border border-md3-outline-variant/15 bg-md3-surface-container-high transition-transform hover:scale-[1.02]"
    style={accentColor ? { borderColor: accentColor } : undefined}
  >
    {displayedCover ? (
      <FadeInImage src={coverVariantUrl(displayedCover, 256)} alt="" loading="lazy" decoding="async" className="pointer-events-none absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105" />
    ) : (
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-gradient-to-br from-md3-primary/20 to-md3-surface-container-high text-md3-primary/70">
        {icon}
      </div>
    )}
    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
    <button
      type="button"
      onClick={onClick}
      className="absolute inset-0 z-10 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-md3-primary"
    >
      <span className={`absolute bottom-2 left-2 min-w-0 text-white ${onPlay ? 'right-11' : 'right-2'}`}>
        <span className="block truncate text-[11px] font-semibold">{title}</span>
        <span className="block truncate text-[9px] text-white/75">{subtitle}</span>
      </span>
    </button>
    {onPlay && (
      <button
        type="button"
        onClick={event => {
          event.stopPropagation();
          onPlay();
        }}
        aria-label={playLabel}
        title={playLabel}
        className="absolute bottom-2 right-2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-md3-primary text-md3-on-primary shadow-lg transition-transform hover:scale-110 active:scale-95 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
      >
        <Play size={14} className="ml-0.5 fill-current" />
      </button>
    )}
  </div>
  );
};

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
  visibleTracks: Track[];
  playlists: Playlist[];
  playlistFolders: PlaylistFolder[];
  playlistGroups: PlaylistGroup[];
  language: AppLanguage;
  isLibraryDataLoading?: boolean;
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
  onPlayTrack: (track: Track, context: Track[], playlistId?: string) => void;
  onPlayPlaylist: (playlist: Playlist) => void;
  onPlayFolder: (folder: PlaylistFolder) => void;
  onResolveTracksByIds: (trackIds: string[]) => Promise<Track[]>;
  onLoadMiniCollectionGroups?: (kind: LibraryCollectionType) => Promise<LibraryCollectionGroup[]>;
  onLoadMiniCollectionTrackPage?: (
    kind: LibraryCollectionType,
    name: string,
    offset: number,
    limit: number,
  ) => Promise<{ items: Track[]; total: number }>;
  onLoadMiniLibraryTrackPage?: (
    favoriteOnly: boolean,
    offset: number,
    limit: number,
  ) => Promise<{ items: Track[]; total: number }>;
  onPlayMiniCollectionTrack?: (track: Track, kind: LibraryCollectionType, name: string) => void;
  onClearQueue: () => void;
  onToggleLyrics: () => void;
  onToggleDiscord: () => void;
  onOpenEQ: () => void;
  onToggleFavorite: (trackId: string, event: React.MouseEvent) => void;
  onOpenTrackDetails: (track: Track) => void;
  onDetachLyrics: () => void;
  onAttachLyrics: () => void;
  onCloseLyrics: () => void;
  onSaveLyrics?: (trackId: string, lyrics: string, isInstrumental: boolean, lyricist?: string) => void;
  onReloadLyrics?: (trackId: string) => Promise<void> | void;
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
  visibleTracks,
  playlists,
  playlistFolders,
  playlistGroups,
  language,
  isLibraryDataLoading = false,
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
  onPlayPlaylist,
  onPlayFolder,
  onResolveTracksByIds,
  onLoadMiniCollectionGroups,
  onLoadMiniCollectionTrackPage,
  onLoadMiniLibraryTrackPage,
  onPlayMiniCollectionTrack,
  onClearQueue,
  onToggleLyrics,
  onToggleDiscord,
  onOpenEQ,
  onToggleFavorite,
  onOpenTrackDetails,
  onDetachLyrics,
  onAttachLyrics,
  onCloseLyrics,
  onSaveLyrics,
  onReloadLyrics,
}) => {
  const [bottomPanel, setBottomPanel] = useState<BottomPanel>(null);
  const [renderedPanel, setRenderedPanel] = useState<Exclude<BottomPanel, null>>('library');
  const [isPanelContentRendered, setIsPanelContentRendered] = useState(false);
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('tracks');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [selectedPlaylistFolderId, setSelectedPlaylistFolderId] = useState<string | null>(null);
  const [selectedPlaylistGroupId, setSelectedPlaylistGroupId] = useState<string | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<{ type: LibraryCollectionType; name: string } | null>(null);
  const [resolvedPlaylistTracks, setResolvedPlaylistTracks] = useState<{ playlistId: string; ids: string[]; tracks: Track[] } | null>(null);
  const [nativeCollectionSnapshot, setNativeCollectionSnapshot] = useState<{
    key: string;
    groups: LibraryCollectionGroup[];
    isLoading: boolean;
    error: boolean;
  } | null>(null);
  const [collectionTrackPage, setCollectionTrackPage] = useState<{
    key: string;
    items: Track[];
    total: number;
    isLoading: boolean;
    error?: boolean;
  } | null>(null);
  const [miniLibraryTrackPage, setMiniLibraryTrackPage] = useState<{
    key: 'tracks' | 'favorites';
    items: Track[];
    total: number;
    isLoading: boolean;
    error?: boolean;
  } | null>(null);
  const collectionPageRequestRef = useRef<{ key: string; offset: number } | null>(null);
  const activeCollectionPageKeyRef = useRef<string | null>(null);
  const miniLibraryPageRequestRef = useRef<{ key: 'tracks' | 'favorites'; offset: number; generation: number } | null>(null);
  const activeMiniLibraryPageKeyRef = useRef<'tracks' | 'favorites' | null>(null);
  const miniLibraryPageGenerationRef = useRef(0);
  const currentPlaylist = playlists.find(playlist => playlist.id === selectedPlaylistId) || null;
  const [isCompactVolHovered, setIsCompactVolHovered] = useState(false);
  const [queueSelectedIndex, setQueueSelectedIndex] = useState(queueIndex);
  const [libraryTrackSelectedIndex, setLibraryTrackSelectedIndex] = useState(0);
  const [libraryTabIndicator, setLibraryTabIndicator] = useState({ left: 0, top: 0, width: 0, height: 0, opacity: 0 });
  const [queueScrollTop, setQueueScrollTop] = useState(0);
  const [queueViewportHeight, setQueueViewportHeight] = useState(0);
  const [libraryScrollTop, setLibraryScrollTop] = useState(0);
  const [libraryViewportHeight, setLibraryViewportHeight] = useState(0);
  const lastTabSwitchTimeRef = useRef<number>(0);
  const volHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueListRef = useRef<HTMLDivElement>(null);
  const queuePendingScrollIndexRef = useRef<number | null>(null);
  const libraryListRef = useRef<HTMLDivElement>(null);
  const libraryTracksRef = useRef<Track[]>([]);
  const libraryPendingScrollIndexRef = useRef<number | null>(null);
  const libraryTabsNavRef = useRef<HTMLElement>(null);
  const libraryTabsDragRef = useRef<{ pointerId: number; startX: number; startScrollLeft: number; moved: boolean } | null>(null);
  const libraryTabsPreviousCursorRef = useRef<string | null>(null);
  const suppressLibraryTabClickRef = useRef(false);
  const suppressLibraryTabClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const libraryTabRefs = useRef<Record<LibraryTab, HTMLButtonElement | null>>({
    tracks: null,
    playlists: null,
    albums: null,
    artists: null,
    favorites: null,
    genres: null,
  });

  const setMiniPanel = (panel: BottomPanel) => {
    if (panel !== null) {
      setRenderedPanel(panel);
      setIsPanelContentRendered(true);
      if (panel === 'queue') setQueueScrollTop(0);
      if (panel === 'library') setLibraryScrollTop(0);
    }
    setBottomPanel(panel);
  };

  const openLibraryPanel = () => {
    setLibraryTab('tracks');
    setSelectedPlaylistId(null);
    setSelectedPlaylistFolderId(null);
    setSelectedPlaylistGroupId(null);
    setSelectedCollection(null);
    setMiniPanel('library');
  };

  useEffect(() => {
    const finishDrag = (pointerId?: number) => {
      const drag = libraryTabsDragRef.current;
      if (!drag || (pointerId !== undefined && drag.pointerId !== pointerId)) return;
      libraryTabsDragRef.current = null;
      const nav = libraryTabsNavRef.current;
      nav?.classList.remove('cursor-grabbing');
      nav?.classList.add('cursor-grab');
      if (libraryTabsPreviousCursorRef.current !== null) {
        document.body.style.cursor = libraryTabsPreviousCursorRef.current;
        libraryTabsPreviousCursorRef.current = null;
      }
      if (drag.moved) {
        suppressLibraryTabClickRef.current = true;
        if (suppressLibraryTabClickTimerRef.current) clearTimeout(suppressLibraryTabClickTimerRef.current);
        suppressLibraryTabClickTimerRef.current = setTimeout(() => {
          suppressLibraryTabClickRef.current = false;
          suppressLibraryTabClickTimerRef.current = null;
        }, 0);
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      const drag = libraryTabsDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const deltaX = event.clientX - drag.startX;
      if (!drag.moved && Math.abs(deltaX) > 4) {
        drag.moved = true;
        const nav = libraryTabsNavRef.current;
        nav?.classList.remove('cursor-grab');
        nav?.classList.add('cursor-grabbing');
        libraryTabsPreviousCursorRef.current = document.body.style.cursor;
        document.body.style.cursor = 'grabbing';
      }
      if (drag.moved) {
        event.preventDefault();
        const nav = libraryTabsNavRef.current;
        if (nav) nav.scrollLeft = drag.startScrollLeft - deltaX;
      }
    };

    const handlePointerEnd = (event: PointerEvent) => finishDrag(event.pointerId);
    const handleWindowBlur = () => finishDrag();
    document.addEventListener('pointermove', handlePointerMove, { passive: false });
    document.addEventListener('pointerup', handlePointerEnd);
    document.addEventListener('pointercancel', handlePointerEnd);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      finishDrag();
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerEnd);
      document.removeEventListener('pointercancel', handlePointerEnd);
      window.removeEventListener('blur', handleWindowBlur);
      if (suppressLibraryTabClickTimerRef.current) clearTimeout(suppressLibraryTabClickTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const handleMiniPlayerKeyboard = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditing = Boolean(target?.closest('input, textarea, select, [contenteditable="true"]'));

      if (event.key === 'Escape' || event.code === 'Escape') {
        if (bottomPanel) {
          event.preventDefault();
          event.stopPropagation();
          if (!event.repeat) setMiniPanel(null);
        }
        return;
      }

      if (isEditing) return;

      if (event.key === 'Tab' || event.code === 'Tab') {
        event.preventDefault();
        event.stopPropagation();
        const now = performance.now();
        // Match regular-player Tab: throttle only OS-generated key repeats, never separate key presses.
        if (event.repeat && now - lastTabSwitchTimeRef.current < 500) return;
        lastTabSwitchTimeRef.current = now;
        if (bottomPanel !== 'library') {
          openLibraryPanel();
          return;
        }

        const tabs: LibraryTab[] = ['tracks', 'playlists', 'albums', 'artists', 'favorites', 'genres'];
        const currentIndex = tabs.indexOf(libraryTab);
        const nextIndex = event.shiftKey
          ? (currentIndex <= 0 ? tabs.length - 1 : currentIndex - 1)
          : (currentIndex + 1) % tabs.length;
        setLibraryTab(tabs[nextIndex]);
        setSelectedPlaylistId(null);
        setSelectedPlaylistFolderId(null);
        setSelectedPlaylistGroupId(null);
        setSelectedCollection(null);
        return;
      }

      if ((event.code === 'KeyQ' || event.key.toLowerCase() === 'q' || event.key.toLowerCase() === 'й')
        && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        event.stopPropagation();
        if (event.repeat) return;
        if (bottomPanel !== 'queue') {
          setQueueSelectedIndex(queue.length > 0 ? Math.max(0, Math.min(queueIndex, queue.length - 1)) : 0);
          setMiniPanel('queue');
        } else {
          setMiniPanel(null);
        }
        return;
      }

      const isArrowDown = event.key === 'ArrowDown' || event.code === 'ArrowDown';
      const isArrowUp = event.key === 'ArrowUp' || event.code === 'ArrowUp';
      if (bottomPanel === 'library' && (isArrowDown || isArrowUp)
        && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
        const listTracks = libraryTracksRef.current;
        if (listTracks.length === 0) return;
        event.preventDefault();
        event.stopPropagation();
        const direction = isArrowDown ? 1 : -1;
        setLibraryTrackSelectedIndex(current => {
          const next = Math.max(0, Math.min(listTracks.length - 1, current + direction));
          if (next !== current) libraryPendingScrollIndexRef.current = next;
          return next;
        });
        return;
      }

      if (bottomPanel === 'library' && (event.key === 'Enter' || event.code === 'Enter')) {
        const listTracks = libraryTracksRef.current;
        if (listTracks.length === 0) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.repeat) return;
        const selectedIndex = Math.max(0, Math.min(listTracks.length - 1, libraryTrackSelectedIndex));
        onPlayTrack(listTracks[selectedIndex], listTracks, currentPlaylist?.id);
        return;
      }

      if (bottomPanel !== 'queue') return;
      if ((event.key === 'ArrowDown' || event.code === 'ArrowDown' || event.key === 'ArrowUp' || event.code === 'ArrowUp')
        && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
        if (queue.length === 0) return;
        event.preventDefault();
        event.stopPropagation();
        const direction = event.key === 'ArrowDown' || event.code === 'ArrowDown' ? 1 : -1;
        setQueueSelectedIndex(current => {
          const next = Math.max(0, Math.min(queue.length - 1, current + direction));
          if (next !== current) queuePendingScrollIndexRef.current = next;
          return next;
        });
        return;
      }

      if ((event.key === 'Enter' || event.code === 'Enter') && queue.length > 0) {
        event.preventDefault();
        event.stopPropagation();
        if (event.repeat) return;
        onPlayQueueTrack(Math.max(0, Math.min(queue.length - 1, queueSelectedIndex)));
      }
    };
    window.addEventListener('keydown', handleMiniPlayerKeyboard, true);
    return () => window.removeEventListener('keydown', handleMiniPlayerKeyboard, true);
  }, [bottomPanel, libraryTab, libraryTrackSelectedIndex, currentPlaylist?.id, onPlayQueueTrack, onPlayTrack, queue.length, queueIndex, queueSelectedIndex]);

  useEffect(() => {
    setQueueSelectedIndex(current => queue.length > 0 ? Math.max(0, Math.min(current, queue.length - 1)) : 0);
  }, [queue.length]);

  useEffect(() => {
    const list = queueListRef.current;
    if (!isPanelContentRendered || renderedPanel !== 'queue' || !list) return;
    const measure = () => setQueueViewportHeight(list.clientHeight);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [isPanelContentRendered, renderedPanel]);

  useEffect(() => {
    if (bottomPanel !== 'queue') {
      queuePendingScrollIndexRef.current = null;
      return;
    }
    const frame = requestAnimationFrame(() => {
      scrollFixedRowIntoView(queueListRef.current, queueIndex, 'center');
    });
    return () => cancelAnimationFrame(frame);
  }, [bottomPanel]);

  useEffect(() => {
    if (bottomPanel !== 'queue' || queuePendingScrollIndexRef.current !== queueSelectedIndex) return;
    queuePendingScrollIndexRef.current = null;
    const frame = requestAnimationFrame(() => {
      scrollFixedRowIntoView(queueListRef.current, queueSelectedIndex, 'nearest', 'smooth');
    });
    return () => cancelAnimationFrame(frame);
  }, [bottomPanel, queueSelectedIndex, queue.length]);

  useEffect(() => {
    if (bottomPanel !== 'library') return;
    const nav = libraryTabsNavRef.current;
    const activeTab = libraryTabRefs.current[libraryTab];
    if (!nav || !activeTab) return;

    const updateIndicator = () => {
      const tab = libraryTabRefs.current[libraryTab];
      if (!tab) return;
      setLibraryTabIndicator({
        left: tab.offsetLeft,
        top: tab.offsetTop,
        width: tab.offsetWidth,
        height: tab.offsetHeight,
        opacity: 1,
      });
    };

    const ensureTabVisible = () => {
      const tab = libraryTabRefs.current[libraryTab];
      if (!tab) return;
      const navRect = nav.getBoundingClientRect();
      const tabRect = tab.getBoundingClientRect();
      const visibleLeft = navRect.left + nav.clientLeft;
      const visibleRight = visibleLeft + nav.clientWidth;
      if (tabRect.left < visibleLeft) {
        nav.scrollBy({ left: tabRect.left - visibleLeft, behavior: 'smooth' });
      } else if (tabRect.right > visibleRight) {
        nav.scrollBy({ left: tabRect.right - visibleRight, behavior: 'smooth' });
      }
    };

    const frame = requestAnimationFrame(() => {
      updateIndicator();
      ensureTabVisible();
    });
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateIndicator) : null;
    resizeObserver?.observe(nav);
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
    };
  }, [bottomPanel, libraryTab]);

  const safeDuration = duration > 0 ? duration : (currentTrack?.duration || 0);
  const safeTime = Math.max(0, Math.min(safeDuration || 0, currentTime));
  useEffect(() => {
    if (!isTauri() || !currentPlaylist) {
      setResolvedPlaylistTracks(null);
      return;
    }
    const cached = resolvedPlaylistTracks;
    if (cached?.playlistId === currentPlaylist.id && cached.ids.length === currentPlaylist.trackIds.length
      && cached.ids.every((id, index) => id === currentPlaylist.trackIds[index])) return;
    let active = true;
    const trackIds = [...currentPlaylist.trackIds];
    void onResolveTracksByIds(trackIds).then(rows => {
      if (active) setResolvedPlaylistTracks({ playlistId: currentPlaylist.id, ids: trackIds, tracks: rows });
    }).catch(() => {});
    return () => { active = false; };
  }, [currentPlaylist?.id, currentPlaylist?.trackIds, onResolveTracksByIds, resolvedPlaylistTracks]);

  const resolvePlaylistCover = useCallback(async (playlistId: string): Promise<string | null> => {
    const playlist = playlists.find(item => item.id === playlistId);
    if (!playlist) return null;
    if (playlist.coverArt) return playlist.coverArt;
    if (!isTauri()) return getPlaylistTrackList(playlist).find(track => track.coverArt)?.coverArt || null;
    const localTrack = getPlaylistTrackList(playlist).find(track => track.coverArt);
    if (localTrack?.coverArt) return localTrack.coverArt;
    // Resolve small ordered batches until a real artwork row is found. Cards are
    // virtualized, so this work only happens for playlists currently on screen.
    const coverSearchLimit = Math.min(playlist.trackIds.length, 1000);
    for (let offset = 0; offset < coverSearchLimit; offset += 100) {
      const rows = await onResolveTracksByIds(playlist.trackIds.slice(offset, offset + 100));
      const cover = rows.find(track => track.coverArt)?.coverArt;
      if (cover) return cover;
    }
    return null;
  }, [playlists, tracks, onResolveTracksByIds]);
  const resolveFolderCover = useCallback(async (folderId: string): Promise<string | null> => {
    const folder = playlistFolders.find(item => item.id === folderId);
    if (!folder || folder.coverType === 'icon') return null;
    const trackIds = getFolderTrackIds(folder, playlistFolders, playlists);
    const localCover = getFolderTrackList(folder).find(track => track.coverArt)?.coverArt;
    if (localCover || !isTauri()) return localCover || null;
    const coverSearchLimit = Math.min(trackIds.length, 1000);
    for (let offset = 0; offset < coverSearchLimit; offset += 100) {
      const rows = await onResolveTracksByIds(trackIds.slice(offset, offset + 100));
      const cover = rows.find(track => track.coverArt)?.coverArt;
      if (cover) return cover;
    }
    return null;
  }, [playlistFolders, playlists, tracks, onResolveTracksByIds]);
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
  const getPlaylistTrackList = (playlist: Playlist) => {
    const trackMap = new Map(tracks.map(track => [track.id, track]));
    return playlist.trackIds.map(id => trackMap.get(id)).filter((track): track is Track => !!track);
  };

  const getFolderTrackList = (
    folder: PlaylistFolder,
    trackIds = getFolderTrackIds(folder, playlistFolders, playlists),
  ) => {
    const trackMap = new Map(tracks.map(track => [track.id, track]));
    return trackIds
      .map(id => trackMap.get(id))
      .filter((track): track is Track => Boolean(track));
  };

  const playTrackList = (trackList: Track[], playlistId?: string) => {
    if (trackList.length > 0) onPlayTrack(trackList[0], trackList, playlistId);
  };

  const isCollectionTab = libraryTab === 'albums' || libraryTab === 'artists' || libraryTab === 'genres';
  const activeCollectionType: LibraryCollectionType = selectedCollection?.type
    || (libraryTab === 'artists' ? 'artists' : libraryTab === 'genres' ? 'genres' : 'albums');
  const shouldLoadCollection = bottomPanel === 'library' && isPanelContentRendered && isCollectionTab;
  const nativeCollectionKey = `${activeCollectionType}:${language}`;
  const useNativeCollectionSource = Boolean(onLoadMiniCollectionGroups);
  // Build a lightweight index from the already-loaded page while the full
  // SQLite query runs. This keeps mini-player collection tabs usable if the
  // native request is slow or fails; a successful native result replaces it.
  const localCollectionResult = useLibraryCollectionGroups(
    visibleTracks,
    activeCollectionType,
    language,
    shouldLoadCollection,
  );

  useEffect(() => {
    if (!shouldLoadCollection || !onLoadMiniCollectionGroups) return;
    let active = true;
    setNativeCollectionSnapshot({ key: nativeCollectionKey, groups: [], isLoading: true, error: false });
    logger.info('MINI_COLLECTION', `groups request started: kind=${activeCollectionType}, language=${language}`);
    void onLoadMiniCollectionGroups(activeCollectionType).then(groups => {
      const groupedTracks = groups.reduce((total, group) => total + (group.trackCount ?? group.trackIds.length), 0);
      logger.info('MINI_COLLECTION', `groups request completed: kind=${activeCollectionType}, groups=${groups.length}, groupedTracks=${groupedTracks}`);
      if (active) setNativeCollectionSnapshot({ key: nativeCollectionKey, groups, isLoading: false, error: false });
    }).catch(error => {
      logger.error('MINI_COLLECTION', `groups request failed: kind=${activeCollectionType}, error=${String(error)}`);
      console.warn(`Mini-player failed to load ${activeCollectionType} from the library database:`, error);
      if (active) setNativeCollectionSnapshot({ key: nativeCollectionKey, groups: [], isLoading: false, error: true });
    });
    return () => { active = false; };
  }, [shouldLoadCollection, onLoadMiniCollectionGroups, nativeCollectionKey, activeCollectionType]);

  const nativeCollectionRequest = nativeCollectionSnapshot?.key === nativeCollectionKey
    ? nativeCollectionSnapshot
    : null;
  const hasNativeCollections = Boolean(nativeCollectionRequest && !nativeCollectionRequest.isLoading
    && !nativeCollectionRequest.error && nativeCollectionRequest.groups.length > 0);
  const indexedCollections = useNativeCollectionSource && hasNativeCollections
    ? nativeCollectionRequest!.groups
    : localCollectionResult.groups;
  const isCollectionsLoading = shouldLoadCollection
    && indexedCollections.length === 0
    && (isLibraryDataLoading
      || localCollectionResult.isLoading
      || (useNativeCollectionSource && (!nativeCollectionRequest || nativeCollectionRequest.isLoading)));
  const isCollectionsError = useNativeCollectionSource
    && Boolean(nativeCollectionRequest?.error)
    && indexedCollections.length === 0;
  const isLocalCollectionsFallback = useNativeCollectionSource
    && indexedCollections.length > 0
    && !hasNativeCollections;
  const visibleCollections = useMemo(
    () => [...indexedCollections].sort((a, b) => a.name.localeCompare(b.name)),
    [indexedCollections],
  );

  useEffect(() => {
    if (!shouldLoadCollection || !isCollectionTab || selectedCollection) return;
    const frame = requestAnimationFrame(() => {
      const list = libraryListRef.current;
      const grid = list?.firstElementChild as HTMLElement | null;
      const renderedCards = list?.querySelectorAll('button').length ?? 0;
      logger.info('MINI_COLLECTION', `view rendered: kind=${activeCollectionType}, groups=${visibleCollections.length}, loading=${isCollectionsLoading}, error=${isCollectionsError}, cards=${renderedCards}, list=${Math.round(list?.clientWidth ?? 0)}x${Math.round(list?.clientHeight ?? 0)}, scrollHeight=${list?.scrollHeight ?? 0}, grid=${Math.round(grid?.clientWidth ?? 0)}x${Math.round(grid?.clientHeight ?? 0)}`);
    });
    return () => cancelAnimationFrame(frame);
  }, [shouldLoadCollection, isCollectionTab, selectedCollection, activeCollectionType, visibleCollections.length, isCollectionsLoading, isCollectionsError]);

  const selectedCollectionGroup = selectedCollection
    ? (() => {
      const indexedGroup = indexedCollections.find(group => group.name === selectedCollection.name);
      const localGroup = localCollectionResult.groups.find(group => group.name === selectedCollection.name);
      if (!indexedGroup) return localGroup || null;
      // Native group summaries omit IDs to keep the payload small. Keep the
      // local page's IDs available as a fallback if paged track loading fails.
      return indexedGroup.trackIds.length > 0 || !localGroup
        ? indexedGroup
        : { ...indexedGroup, trackIds: localGroup.trackIds };
    })()
    : null;
  const selectedCollectionTracks = useMemo(() => {
    if (!selectedCollectionGroup) return [];
    const tracksById = new Map(tracks.map(track => [track.id, track]));
    return selectedCollectionGroup.trackIds
      .map(id => tracksById.get(id))
      .filter((track): track is Track => !!track);
  }, [selectedCollectionGroup, tracks]);
  const selectedCollectionPageKey = selectedCollection ? `${selectedCollection.type}:${selectedCollection.name}` : null;

  useEffect(() => {
    if (!selectedCollection || !onLoadMiniCollectionTrackPage) {
      activeCollectionPageKeyRef.current = null;
      setCollectionTrackPage(null);
      return;
    }

    const key = `${selectedCollection.type}:${selectedCollection.name}`;
    let active = true;
    activeCollectionPageKeyRef.current = key;
    collectionPageRequestRef.current = null;
    setCollectionTrackPage({
      key,
      items: [],
      total: selectedCollectionGroup?.trackCount ?? selectedCollectionGroup?.trackIds.length ?? 0,
      isLoading: true,
    });
    logger.info('MINI_COLLECTION', `tracks request started: kind=${selectedCollection.type}, offset=0, limit=100`);
    void onLoadMiniCollectionTrackPage(selectedCollection.type, selectedCollection.name, 0, 100).then(page => {
      logger.info('MINI_COLLECTION', `tracks request completed: kind=${selectedCollection.type}, offset=0, returned=${page.items.length}, total=${page.total}`);
      if (active && activeCollectionPageKeyRef.current === key) {
        setCollectionTrackPage({ key, items: page.items, total: page.total, isLoading: false, error: false });
      }
    }).catch(error => {
      logger.error('MINI_COLLECTION', `tracks request failed: kind=${selectedCollection.type}, error=${String(error)}`);
      console.warn(`Mini-player failed to load tracks for ${selectedCollection.name}:`, error);
      if (active && activeCollectionPageKeyRef.current === key) {
        setCollectionTrackPage(previous => previous?.key === key
          ? { ...previous, isLoading: false, error: true }
          : previous);
      }
    });
    return () => {
      active = false;
      if (activeCollectionPageKeyRef.current === key) activeCollectionPageKeyRef.current = null;
    };
  }, [selectedCollection?.type, selectedCollection?.name, onLoadMiniCollectionTrackPage]);

  const loadMoreCollectionTracks = useCallback(async () => {
    if (!selectedCollection || !onLoadMiniCollectionTrackPage || !selectedCollectionPageKey) return;
    const key = selectedCollectionPageKey;
    const current = collectionTrackPage?.key === key ? collectionTrackPage : null;
    if (!current || current.isLoading || current.items.length >= current.total) return;
    const offset = current.items.length;
    if (collectionPageRequestRef.current?.key === key && collectionPageRequestRef.current.offset === offset) return;
    collectionPageRequestRef.current = { key, offset };
    setCollectionTrackPage(previous => previous?.key === key ? { ...previous, isLoading: true } : previous);
    try {
      const page = await onLoadMiniCollectionTrackPage(selectedCollection.type, selectedCollection.name, offset, 100);
      if (activeCollectionPageKeyRef.current !== key) return;
      setCollectionTrackPage(previous => {
        if (previous?.key !== key) return previous;
        const knownIds = new Set(previous.items.map(track => track.id));
        return {
          key,
          items: [...previous.items, ...page.items.filter(track => !knownIds.has(track.id))],
          total: page.total,
          isLoading: false,
        };
      });
    } catch (error) {
      console.warn(`Mini-player failed to load the next page for ${selectedCollection.name}:`, error);
      setCollectionTrackPage(previous => previous?.key === key ? { ...previous, isLoading: false } : previous);
    } finally {
      if (collectionPageRequestRef.current?.key === key && collectionPageRequestRef.current.offset === offset) {
        collectionPageRequestRef.current = null;
      }
    }
  }, [selectedCollection, selectedCollectionPageKey, collectionTrackPage, onLoadMiniCollectionTrackPage]);

  const miniLibraryTrackTab = libraryTab === 'tracks' || libraryTab === 'favorites' ? libraryTab : null;
  const shouldLoadMiniLibraryTracks = bottomPanel === 'library'
    && isPanelContentRendered
    && !currentPlaylist
    && !selectedCollection
    && miniLibraryTrackTab !== null
    && Boolean(onLoadMiniLibraryTrackPage);

  useEffect(() => {
    if (!shouldLoadMiniLibraryTracks || !miniLibraryTrackTab || !onLoadMiniLibraryTrackPage) {
      miniLibraryPageGenerationRef.current += 1;
      activeMiniLibraryPageKeyRef.current = null;
      miniLibraryPageRequestRef.current = null;
      setMiniLibraryTrackPage(null);
      return;
    }

    const key = miniLibraryTrackTab;
    const generation = ++miniLibraryPageGenerationRef.current;
    let active = true;
    activeMiniLibraryPageKeyRef.current = key;
    miniLibraryPageRequestRef.current = null;
    setMiniLibraryTrackPage({ key, items: [], total: 0, isLoading: true, error: false });
    void onLoadMiniLibraryTrackPage(key === 'favorites', 0, 100).then(page => {
      if (active && miniLibraryPageGenerationRef.current === generation && activeMiniLibraryPageKeyRef.current === key) {
        setMiniLibraryTrackPage({ key, items: page.items, total: page.total, isLoading: false, error: false });
      }
    }).catch(error => {
      console.warn(`Mini-player failed to load ${key} from the library database:`, error);
      if (active && miniLibraryPageGenerationRef.current === generation && activeMiniLibraryPageKeyRef.current === key) {
        setMiniLibraryTrackPage({ key, items: [], total: 0, isLoading: false, error: true });
      }
    });
    return () => {
      active = false;
      if (miniLibraryPageGenerationRef.current === generation) miniLibraryPageGenerationRef.current += 1;
      if (activeMiniLibraryPageKeyRef.current === key) activeMiniLibraryPageKeyRef.current = null;
    };
  }, [shouldLoadMiniLibraryTracks, miniLibraryTrackTab, onLoadMiniLibraryTrackPage]);

  const loadMoreMiniLibraryTracks = useCallback(async () => {
    if (!miniLibraryTrackTab || !onLoadMiniLibraryTrackPage) return;
    const key = miniLibraryTrackTab;
    const generation = miniLibraryPageGenerationRef.current;
    const current = miniLibraryTrackPage?.key === key ? miniLibraryTrackPage : null;
    if (!current || current.isLoading || current.items.length >= current.total) return;
    const offset = current.items.length;
    if (miniLibraryPageRequestRef.current?.key === key
      && miniLibraryPageRequestRef.current.offset === offset
      && miniLibraryPageRequestRef.current.generation === generation) return;
    miniLibraryPageRequestRef.current = { key, offset, generation };
    setMiniLibraryTrackPage(previous => previous?.key === key ? { ...previous, isLoading: true } : previous);
    try {
      const page = await onLoadMiniLibraryTrackPage(key === 'favorites', offset, 100);
      if (miniLibraryPageGenerationRef.current !== generation || activeMiniLibraryPageKeyRef.current !== key) return;
      setMiniLibraryTrackPage(previous => {
        if (previous?.key !== key) return previous;
        const knownIds = new Set(previous.items.map(track => track.id));
        return {
          key,
          items: [...previous.items, ...page.items.filter(track => !knownIds.has(track.id))],
          total: page.total,
          isLoading: false,
          error: false,
        };
      });
    } catch (error) {
      console.warn(`Mini-player failed to load the next ${key} page:`, error);
      if (miniLibraryPageGenerationRef.current === generation && activeMiniLibraryPageKeyRef.current === key) {
        setMiniLibraryTrackPage(previous => previous?.key === key ? { ...previous, isLoading: false } : previous);
      }
    } finally {
      if (miniLibraryPageRequestRef.current?.key === key
        && miniLibraryPageRequestRef.current.offset === offset
        && miniLibraryPageRequestRef.current.generation === generation) {
        miniLibraryPageRequestRef.current = null;
      }
    }
  }, [miniLibraryTrackTab, miniLibraryTrackPage, onLoadMiniLibraryTrackPage]);

  const libraryTracks = useMemo(() => {
    if (currentPlaylist) {
      const resolved = resolvedPlaylistTracks;
      if (resolved?.playlistId === currentPlaylist.id && resolved.ids.length === currentPlaylist.trackIds.length
        && resolved.ids.every((id, index) => id === currentPlaylist.trackIds[index])) return resolved.tracks;
      const byId = new Map(tracks.map(track => [track.id, track]));
      return currentPlaylist.trackIds.map(id => byId.get(id)).filter((track): track is Track => !!track);
    }
    if (selectedCollection) {
      if (!onLoadMiniCollectionTrackPage) return selectedCollectionTracks;
      if (collectionTrackPage?.key !== selectedCollectionPageKey) return [];
      return collectionTrackPage.error && collectionTrackPage.items.length === 0
        ? selectedCollectionTracks
        : collectionTrackPage.items;
    }
    if ((libraryTab === 'favorites' || libraryTab === 'tracks') && onLoadMiniLibraryTrackPage) {
      return miniLibraryTrackPage?.key === libraryTab ? miniLibraryTrackPage.items : [];
    }
    if (libraryTab === 'favorites') return visibleTracks.filter(track => track.isFavorite);
    if (libraryTab === 'tracks') return visibleTracks;
    return [];
  }, [currentPlaylist, libraryTab, resolvedPlaylistTracks, selectedCollection, selectedCollectionTracks, collectionTrackPage, selectedCollectionPageKey, onLoadMiniCollectionTrackPage, onLoadMiniLibraryTrackPage, miniLibraryTrackPage, tracks, visibleTracks]);
  libraryTracksRef.current = libraryTracks;
  const visibleQueueRows = getFixedRowRange(queue, queueScrollTop, queueViewportHeight);
  const visibleLibraryRows = getFixedRowRange(libraryTracks, libraryScrollTop, libraryViewportHeight);

  useEffect(() => {
    const currentTrackIndex = currentTrack ? libraryTracks.findIndex(track => track.id === currentTrack.id) : -1;
    setLibraryTrackSelectedIndex(currentTrackIndex >= 0 ? currentTrackIndex : 0);
  }, [currentPlaylist?.id, selectedCollection?.name, libraryTab, libraryTracks, currentTrack?.id]);

  useEffect(() => {
    const list = libraryListRef.current;
    if (!isPanelContentRendered || renderedPanel !== 'library' || !list) return;
    const measure = () => setLibraryViewportHeight(list.clientHeight);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [isPanelContentRendered, renderedPanel]);

  useEffect(() => {
    if (bottomPanel !== 'library') {
      libraryPendingScrollIndexRef.current = null;
      return;
    }
    libraryPendingScrollIndexRef.current = null;
    const frame = requestAnimationFrame(() => {
      setLibraryScrollTop(0);
      libraryListRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    });
    return () => cancelAnimationFrame(frame);
  }, [bottomPanel]);

  useEffect(() => {
    if (bottomPanel !== 'library' || libraryPendingScrollIndexRef.current !== libraryTrackSelectedIndex) return;
    libraryPendingScrollIndexRef.current = null;
    const frame = requestAnimationFrame(() => {
      scrollFixedRowIntoView(libraryListRef.current, libraryTrackSelectedIndex, 'nearest', 'smooth');
    });
    return () => cancelAnimationFrame(frame);
  }, [bottomPanel, libraryTrackSelectedIndex, libraryTracks.length]);

  const lyricsTrack: MiniLyricsTrack | null = currentTrack ? {
    id: currentTrack.id,
    title: currentTrack.title,
    artist: currentTrack.artist,
    lyrics: currentTrack.lyrics,
    isInstrumental: currentTrack.isInstrumental,
    lyricist: currentTrack.lyricist,
  } : null;

  const togglePanel = (panel: Exclude<BottomPanel, null>) => {
    if (bottomPanel === panel) {
      setMiniPanel(null);
      return;
    }
    if (panel === 'queue') {
      setQueueSelectedIndex(queue.length > 0 ? Math.max(0, Math.min(queueIndex, queue.length - 1)) : 0);
    }
    setMiniPanel(panel);
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
    if (event.button !== 0 || bottomPanel !== null || !isTauri()) return;
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
            data-tauri-drag-region={bottomPanel ? undefined : ''}
            onMouseDown={handleCoverMouseDown}
            onClick={() => { if (bottomPanel) setMiniPanel(null); }}
            onDragStart={event => event.preventDefault()}
            aria-label={bottomPanel
              ? text(language, 'Нажмите, чтобы закрыть панель', 'Click to close the panel')
              : text(language, 'Перетащить окно мини-плеера', 'Drag the mini-player window')}
            title={bottomPanel ? text(language, 'Нажмите, чтобы закрыть панель', 'Click to close the panel') : undefined}
            className={`relative mx-auto flex aspect-square w-full max-w-[280px] shrink-0 items-center justify-center overflow-hidden rounded-[24px] bg-md3-surface-container-high shadow-xl ${bottomPanel ? 'cursor-pointer' : ''}`}
          >
            <Disc3 className="h-24 w-24 text-md3-primary/40" strokeWidth={1.25} />
            <CrossfadeImage
              src={coverVariantUrl(currentTrack?.coverArt, 256)}
              alt={currentTrack?.title || ''}
              className="absolute inset-0 h-full w-full select-none object-cover"
            />
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

        <div
          {...(!bottomPanel ? ({ inert: '' } as unknown as React.HTMLAttributes<HTMLDivElement>) : {})}
          aria-hidden={!bottomPanel}
          onTransitionEnd={event => {
            if (event.target === event.currentTarget && !bottomPanel && event.propertyName === 'transform') {
              setIsPanelContentRendered(false);
            }
          }}
          className={`mini-panel-surface absolute inset-x-0 bottom-0 z-20 flex h-[62%] min-h-[220px] flex-col overflow-hidden rounded-t-2xl border-t border-md3-outline-variant/25 bg-md3-surface-container shadow-[0_-16px_45px_rgba(0,0,0,0.35)] ${bottomPanel ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}
        >
          {isPanelContentRendered && (
            renderedPanel === 'queue' ? (
              <>
                <header className="flex h-12 shrink-0 items-center gap-1.5 border-b border-md3-outline-variant/15 px-3">
                  <button
                    type="button"
                    onClick={openLibraryPanel}
                    title={text(language, 'Открыть библиотеку', 'Open library')}
                    className="flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-semibold text-md3-primary hover:bg-md3-primary/10"
                  >
                    <Library size={14} />
                    <span>{text(language, 'Библиотека', 'Library')}</span>
                  </button>
                  <span className="min-w-0 flex-1" />
                  <span className="flex h-6 min-w-[58px] shrink-0 items-center justify-center rounded-full bg-md3-surface-container-high px-2 text-[9px] font-semibold tabular-nums text-md3-on-surface-variant">{queueTrackCount(queue.length, language)}</span>
                  <button
                    type="button"
                    onClick={onClearQueue}
                    disabled={queue.length === 0}
                    title={text(language, 'Очистить очередь', 'Clear queue')}
                    aria-label={text(language, 'Очистить очередь', 'Clear queue')}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container-high disabled:opacity-30"
                  >
                    <Trash2 size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePanel('queue')}
                    title={text(language, 'Очередь', 'Queue')}
                    aria-label={text(language, bottomPanel === 'queue' ? 'Закрыть очередь' : 'Открыть очередь', bottomPanel === 'queue' ? 'Close queue' : 'Open queue')}
                    aria-pressed={bottomPanel === 'queue'}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-md3-primary/10 text-md3-primary hover:bg-md3-primary/20"
                  >
                    <ListMusic size={15} />
                  </button>
                </header>
                <div
                  ref={queueListRef}
                  onScroll={event => setQueueScrollTop(event.currentTarget.scrollTop)}
                  className="min-h-0 flex-1 overflow-y-auto custom-scrollbar p-2"
                >
                  {queue.length > 0 ? (
                    <div role="list" style={{ position: 'relative', height: visibleQueueRows.totalHeight }}>
                      {visibleQueueRows.items.map((track, offset) => {
                        const index = visibleQueueRows.startIndex + offset;
                        return (
                          <MiniTrackRow
                            key={`${track.id}-${index}`}
                            track={track}
                            active={index === queueIndex}
                            selected={index === queueSelectedIndex}
                            language={language}
                            index={index}
                            totalCount={queue.length}
                            style={{ position: 'absolute', top: index * MINI_TRACK_ROW_HEIGHT, left: 0, right: 0, height: MINI_TRACK_ROW_HEIGHT }}
                            onClick={() => onPlayQueueTrack(index)}
                          />
                        );
                      })}
                    </div>
                  ) : <p className="p-6 text-center text-xs text-md3-on-surface-variant">{text(language, 'Очередь пуста', 'Queue is empty')}</p>}
                </div>
              </>
            ) : (
              <>
                <header className="flex h-12 shrink-0 items-center gap-1.5 border-b border-md3-outline-variant/15 px-3">
                  <button
                    type="button"
                    onClick={openLibraryPanel}
                    title={text(language, 'Открыть библиотеку', 'Open library')}
                    className="flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-semibold text-md3-primary hover:bg-md3-primary/10"
                  >
                    <Library size={14} />
                    <span>{text(language, 'Библиотека', 'Library')}</span>
                  </button>
                  {(currentPlaylist || selectedCollection || selectedPlaylistFolder || selectedPlaylistGroup) && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          if (currentPlaylist) setSelectedPlaylistId(null);
                          else if (selectedCollection) setSelectedCollection(null);
                          else if (selectedPlaylistFolder) setSelectedPlaylistFolderId(selectedPlaylistFolder.parentId || null);
                          else if (selectedPlaylistGroup) setSelectedPlaylistGroupId(null);
                        }}
                        aria-label={text(language, 'Назад', 'Go back')}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container-high"
                      ><ChevronLeft size={16} /></button>
                      <strong className="min-w-0 flex-1 truncate text-[11px]">
                        {currentPlaylist?.name || selectedCollectionGroup?.name || selectedPlaylistFolder?.name || selectedPlaylistGroup?.name}
                      </strong>
                    </>
                  )}
                  <span className="min-w-0 flex-1" />
                  <span className="flex h-6 min-w-[58px] shrink-0 items-center justify-center rounded-full bg-md3-surface-container-high px-2 text-[9px] font-semibold tabular-nums text-md3-on-surface-variant">{queueTrackCount(queue.length, language)}</span>
                  <button
                    type="button"
                    onClick={onClearQueue}
                    disabled={queue.length === 0}
                    title={text(language, 'Очистить очередь', 'Clear queue')}
                    aria-label={text(language, 'Очистить очередь', 'Clear queue')}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container-high disabled:opacity-30"
                  >
                    <Trash2 size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePanel('queue')}
                    title={text(language, 'Очередь', 'Queue')}
                    aria-label={text(language, 'Открыть очередь', 'Open queue')}
                    aria-pressed={false}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container-high"
                  >
                    <ListMusic size={15} />
                  </button>
                </header>
                <nav
                  ref={libraryTabsNavRef}
                  onPointerDown={event => {
                    if (event.pointerType !== 'mouse' || event.button !== 0) return;
                    libraryTabsDragRef.current = {
                      pointerId: event.pointerId,
                      startX: event.clientX,
                      startScrollLeft: event.currentTarget.scrollLeft,
                      moved: false,
                    };
                  }}
                  onClickCapture={event => {
                    if (!suppressLibraryTabClickRef.current) return;
                    event.preventDefault();
                    event.stopPropagation();
                    suppressLibraryTabClickRef.current = false;
                    if (suppressLibraryTabClickTimerRef.current) {
                      clearTimeout(suppressLibraryTabClickTimerRef.current);
                      suppressLibraryTabClickTimerRef.current = null;
                    }
                  }}
                  onWheel={event => {
                    const nav = event.currentTarget;
                    const maxScrollLeft = nav.scrollWidth - nav.clientWidth;
                    if (maxScrollLeft <= 0) return;
                    const delta = event.deltaX !== 0 ? event.deltaX : event.deltaY;
                    if (delta === 0) return;
                    const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? nav.clientWidth : 1;
                    event.preventDefault();
                    nav.scrollLeft = Math.max(0, Math.min(maxScrollLeft, nav.scrollLeft + delta * scale));
                  }}
                  className="relative flex shrink-0 cursor-grab items-center gap-1 overflow-x-auto no-scrollbar select-none rounded-full border border-md3-outline-variant/15 bg-md3-surface-container p-1"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute z-0 rounded-full bg-md3-primary transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
                    style={{
                      left: libraryTabIndicator.left,
                      top: libraryTabIndicator.top,
                      width: libraryTabIndicator.width,
                      height: libraryTabIndicator.height,
                      opacity: libraryTabIndicator.opacity,
                      boxShadow: '0 0 16px rgba(var(--md-sys-color-primary-rgb, 168 121 255), 0.45), 0 2px 6px rgba(0,0,0,0.2)',
                    }}
                  />
                  {(['tracks', 'playlists', 'albums', 'artists', 'favorites', 'genres'] as LibraryTab[]).map(tab => {
                    const label = tab === 'tracks' ? text(language, 'Треки', 'Tracks')
                      : tab === 'playlists' ? text(language, 'Плейлисты', 'Playlists')
                        : tab === 'albums' ? text(language, 'Альбомы', 'Albums')
                          : tab === 'artists' ? text(language, 'Артисты', 'Artists')
                            : tab === 'favorites' ? text(language, 'Избранное', 'Favorites')
                              : text(language, 'Жанры', 'Genres');
                    const active = libraryTab === tab;
                    return (
                      <button
                        key={tab}
                        ref={node => { libraryTabRefs.current[tab] = node; }}
                        type="button"
                        onClick={() => {
                          logger.info('MINI_COLLECTION', `tab selected: tab=${tab}, panel=${bottomPanel ?? 'closed'}`);
                          setLibraryTab(tab);
                          setSelectedPlaylistId(null);
                          setSelectedPlaylistFolderId(null);
                          setSelectedPlaylistGroupId(null);
                          setSelectedCollection(null);
                        }}
                        aria-current={active ? 'page' : undefined}
                        className={`relative z-10 shrink-0 rounded-full px-2.5 py-1 text-[9px] transition-colors duration-200 ${active ? 'font-semibold text-md3-on-primary' : 'text-md3-on-surface-variant hover:bg-md3-surface-container-high/60 hover:text-md3-on-surface'}`}
                      >{label}</button>
                    );
                  })}
                </nav>
                <div
                  ref={libraryListRef}
                  onScroll={event => {
                    const container = event.currentTarget;
                    setLibraryScrollTop(container.scrollTop);
                    if (container.scrollHeight - (container.scrollTop + container.clientHeight) < 800) {
                      if (selectedCollection && onLoadMiniCollectionTrackPage) {
                        void loadMoreCollectionTracks();
                      } else if (!currentPlaylist && !selectedCollection && onLoadMiniLibraryTrackPage
                        && (libraryTab === 'tracks' || libraryTab === 'favorites')) {
                        void loadMoreMiniLibraryTracks();
                      }
                    }
                  }}
                  className="min-h-0 flex-1 overflow-y-auto custom-scrollbar p-2"
                >
                  {libraryTab === 'playlists' && !currentPlaylist && !selectedCollection && (
                    <div className="space-y-3">
                      {!selectedPlaylistFolder && !selectedPlaylistGroup && playlistGroups.length > 0 && (
                        <section className="space-y-1.5">
                          <h3 className="px-1 text-[9px] font-bold uppercase tracking-wider text-md3-on-surface-variant/75">
                            {text(language, 'Группы', 'Groups')}
                          </h3>
                          <VirtualizedCollectionGrid
                            items={playlistGroups}
                            scrollContainerRef={libraryListRef}
                            resetKey={`playlists:${selectedPlaylistFolderId ?? ''}:${selectedPlaylistGroupId ?? ''}`}
                            className="grid grid-cols-2 gap-2"
                            renderItem={group => {
                              const itemCount = playlistFolders.filter(folder => !folder.parentId && folder.groupId === group.id).length
                                + playlists.filter(playlist => !playlist.folderId && playlist.groupId === group.id).length;
                              const color = group.color ? getFolderColorHex(group.color) : undefined;
                              return (
                                <MiniLibraryCard
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
                            }}
                          />
                        </section>
                      )}

                      {playlistEntriesInView.length > 0 && (
                        <section className="space-y-1.5">
                          {(playlistGroups.length > 0 || selectedPlaylistFolder || selectedPlaylistGroup) && (
                            <h3 className="px-1 text-[9px] font-bold uppercase tracking-wider text-md3-on-surface-variant/75">
                              {text(language, 'Папки и плейлисты', 'Folders and playlists')}
                            </h3>
                          )}
                          <VirtualizedCollectionGrid
                            items={playlistEntriesInView}
                            scrollContainerRef={libraryListRef}
                            resetKey={`playlists:${selectedPlaylistFolderId ?? ''}:${selectedPlaylistGroupId ?? ''}`}
                            className="grid grid-cols-2 gap-2"
                            renderItem={entry => {
                              if (entry.type === 'folder') {
                                const folder = entry.item;
                                const FolderIcon = getFolderIconComponent(folder.icon);
                                const folderPlaylists = playlists.filter(playlist => playlist.folderId === folder.id);
                                const folderSubfolders = playlistFolders.filter(child => child.parentId === folder.id);
                                const folderTrackIds = getFolderTrackIds(folder, playlistFolders, playlists);
                                const folderTracks = getFolderTrackList(folder, folderTrackIds);
                                const cover = folderPlaylists.find(playlist => playlist.coverArt)?.coverArt
                                  || folderTracks.find(track => track.coverArt)?.coverArt;
                                return (
                                  <MiniLibraryCard
                                    title={folder.name}
                                    subtitle={`${folderPlaylists.length + folderSubfolders.length} ${text(language, 'элементов', 'items')}`}
                                    coverArt={folder.coverType && folder.coverType !== 'icon' ? cover : undefined}
                                    onResolveCover={folder.coverType && folder.coverType !== 'icon' ? () => resolveFolderCover(folder.id) : undefined}
                                    icon={<FolderIcon size={28} />}
                                    accentColor={folder.color ? getFolderColorHex(folder.color) : undefined}
                                    onClick={() => {
                                      setSelectedPlaylistFolderId(folder.id);
                                      setSelectedPlaylistId(null);
                                    }}
                                    onPlay={folderTrackIds.length > 0 ? () => onPlayFolder(folder) : undefined}
                                    playLabel={text(language, 'Воспроизвести всё', 'Play all')}
                                  />
                                );
                              }
                              const playlist = entry.item;
                              const cover = playlist.coverArt || tracks.find(track => playlist.trackIds.includes(track.id) && track.coverArt)?.coverArt;
                              const PlaylistIcon = playlist.icon ? getFolderIconComponent(playlist.icon) : ListMusic;
                              return (
                                <MiniLibraryCard
                                  title={playlist.name}
                                  subtitle={`${playlist.trackIds.length} ${text(language, 'треков', 'tracks')}`}
                                  coverArt={cover}
                                  icon={<PlaylistIcon size={28} />}
                                  accentColor={playlist.color ? getFolderColorHex(playlist.color) : undefined}
                                  onClick={() => setSelectedPlaylistId(playlist.id)}
                                  onPlay={playlist.trackIds.length > 0 ? () => onPlayPlaylist(playlist) : undefined}
                                  onResolveCover={() => resolvePlaylistCover(playlist.id)}
                                  playLabel={text(language, 'Воспроизвести всё', 'Play all')}
                                />
                              );
                            }}
                          />
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
                    isCollectionsLoading ? null : isCollectionsError ? (
                      <p className="p-6 text-center text-xs text-md3-on-surface-variant">{text(language, 'Не удалось загрузить медиатеку', 'Unable to load the library')}</p>
                    ) : visibleCollections.length > 0 ? (
                      <>
                        {isLocalCollectionsFallback && (
                          <p role="status" className="mb-2 rounded-lg bg-md3-surface-container-high px-2 py-1.5 text-[10px] text-md3-on-surface-variant">
                            {nativeCollectionRequest?.isLoading || !nativeCollectionRequest
                              ? text(language, 'Показана загруженная часть медиатеки; загружаю полный список…', 'Showing loaded library items while the full list loads…')
                              : nativeCollectionRequest.error
                                ? text(language, 'Не удалось загрузить полный список; показана загруженная часть медиатеки.', 'Unable to load the full list; showing loaded library items.')
                                : text(language, 'Полный список пуст; показана загруженная часть медиатеки.', 'The full list is empty; showing loaded library items.')}
                          </p>
                        )}
                        <VirtualizedCollectionGrid
                          items={visibleCollections}
                          scrollContainerRef={libraryListRef}
                          resetKey={`collections:${libraryTab}:${selectedCollection?.name ?? ''}`}
                          className="grid grid-cols-2 gap-2"
                          renderItem={group => (
                            <button
                              type="button"
                              onClick={() => setSelectedCollection({ type: libraryTab as LibraryCollectionType, name: group.name })}
                              className="group relative aspect-[1.18] w-full min-w-0 overflow-hidden rounded-xl bg-md3-surface-container-high text-left"
                            >
                              {group.coverArt ? <img src={coverVariantUrl(group.coverArt, 96)} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-md3-primary/20 to-md3-surface-container-high"><Disc3 size={28} className="text-md3-primary/65" /></div>}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                              <span className="absolute inset-x-2 bottom-2 min-w-0 text-white">
                                <span className="block truncate text-[11px] font-semibold">{group.name}</span>
                                <span className="block truncate text-[9px] text-white/75">{group.trackCount ?? group.trackIds.length} {text(language, 'треков', 'tracks')}</span>
                              </span>
                            </button>
                          )}
                        />
                      </>
                    ) : <p className="p-6 text-center text-xs text-md3-on-surface-variant">{text(language, 'Ничего не найдено', 'Nothing here yet')}</p>
                  )}
                  {(libraryTab === 'tracks' || libraryTab === 'favorites' || currentPlaylist || selectedCollection) && (
                    libraryTracks.length > 0 ? (
                      <div role="list" style={{ position: 'relative', height: visibleLibraryRows.totalHeight }}>
                        {visibleLibraryRows.items.map((track, offset) => {
                          const index = visibleLibraryRows.startIndex + offset;
                          return (
                            <MiniTrackRow
                              key={track.id}
                              track={track}
                              active={track.id === currentTrack?.id}
                              selected={index === libraryTrackSelectedIndex}
                              language={language}
                              index={index}
                              totalCount={libraryTracks.length}
                              style={{ position: 'absolute', top: index * MINI_TRACK_ROW_HEIGHT, left: 0, right: 0, height: MINI_TRACK_ROW_HEIGHT }}
                              onClick={() => {
                                setLibraryTrackSelectedIndex(index);
                                if (selectedCollection && onPlayMiniCollectionTrack) {
                                  onPlayMiniCollectionTrack(track, selectedCollection.type, selectedCollection.name);
                                } else {
                                  onPlayTrack(track, libraryTracks, currentPlaylist?.id);
                                }
                              }}
                            />
                          );
                        })}
                      </div>
                    ) : selectedCollection && onLoadMiniCollectionTrackPage
                      && (!collectionTrackPage || collectionTrackPage.key !== selectedCollectionPageKey || collectionTrackPage.isLoading) ? (
                      null
                    ) : selectedCollection && collectionTrackPage?.key === selectedCollectionPageKey && collectionTrackPage.error ? (
                      <p role="alert" className="p-6 text-center text-xs text-md3-on-surface-variant">{text(language, 'Не удалось загрузить треки коллекции', 'Unable to load collection tracks')}</p>
                    ) : shouldLoadMiniLibraryTracks && (!miniLibraryTrackPage || miniLibraryTrackPage.key !== miniLibraryTrackTab || miniLibraryTrackPage.isLoading) ? (
                      null
                    ) : shouldLoadMiniLibraryTracks && miniLibraryTrackPage?.key === miniLibraryTrackTab && miniLibraryTrackPage.error ? (
                      <p role="alert" className="p-6 text-center text-xs text-md3-on-surface-variant">{text(language, 'Не удалось загрузить треки медиатеки', 'Unable to load library tracks')}</p>
                    ) : isLibraryDataLoading && (libraryTab === 'tracks' || libraryTab === 'favorites') ? (
                      null
                    ) : <p className="p-6 text-center text-xs text-md3-on-surface-variant">{text(language, libraryTab === 'favorites' ? 'В избранном пока нет треков' : 'В этом списке нет треков', libraryTab === 'favorites' ? 'No favorite tracks yet' : 'No tracks in this list')}</p>
                  )}
                </div>
              </>
            )
          )}
        </div>
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
          onSaveLyrics={onSaveLyrics}
          onReloadLyrics={onReloadLyrics}
        />
      )}
    </div>
  );
};
