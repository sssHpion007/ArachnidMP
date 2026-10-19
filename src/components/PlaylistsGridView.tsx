import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Plus, 
  Play, 
  ListMusic, 
  FolderPlus, 
  Layers, 
  ChevronRight, 
  ChevronDown, 
  ArrowLeft, 
  ArrowUp,
  ArrowDown,
  Edit3, 
  Trash2, 
  FolderOpen,
  Palette,
  GripVertical,
  ShieldAlert,
  FileUp
} from 'lucide-react';
import { Playlist, PlaylistFolder, PlaylistGroup, Track, FolderCoverType } from '../types/music';
import { formatTime } from '../services/tagEditor';
import { getFolderIconComponent, getFolderColorHex, getThemedPlayIconColor } from '../theme/folderIcons';
import { AppLanguage } from '../i18n';

interface PlaylistsGridViewProps {
  playlists: Playlist[];
  folders: PlaylistFolder[];
  groups: PlaylistGroup[];
  tracks: Track[];
  searchQuery?: string;
  language?: AppLanguage;
  onSelectPlaylist: (id: string) => void;
  onCreatePlaylist: (folderId?: string | null, groupId?: string | null) => void;
  onCreateFolder: (parentId?: string | null, groupId?: string | null) => void;
  onCreateGroup: () => void;
  onImportM3U8?: () => void;
  onOpenPlaylistsFolder?: () => void;
  onPlayPlaylist: (playlist: Playlist) => void;
  onPlayFolder: (folder: PlaylistFolder) => void;
  onOpenPlaylistContextMenu: (e: React.MouseEvent, playlist: Playlist) => void;
  onOpenFolderContextMenu: (e: React.MouseEvent, folder: PlaylistFolder) => void;
  onToggleGroupCollapse: (groupId: string) => void;
  onRenameGroup: (group: PlaylistGroup) => void;
  onEditGroup?: (group: PlaylistGroup) => void;
  onDeleteGroup: (groupId: string) => void;
  onMoveGroup?: (groupId: string, direction: 'up' | 'down') => void;
  onReorderGroups?: (reorderedGroups: PlaylistGroup[]) => void;
  onMovePlaylistToFolder: (playlistId: string, folderId: string | null) => void;
  onMovePlaylistToGroup: (playlistId: string, groupId: string | null) => void;
  onMoveFolderToFolder: (folderId: string, targetParentId: string | null) => void;
  onMoveFolderToGroup: (folderId: string, groupId: string | null) => void;
  onReorderPlaylists: (reorderedPlaylists: Playlist[]) => void;
  onReorderFolders?: (reorderedFolders: PlaylistFolder[]) => void;
  onReorderItems?: (reorderedPlaylists: Playlist[], reorderedFolders: PlaylistFolder[]) => void;
  onEditFolder?: (folder: PlaylistFolder) => void;
  isDarkTheme?: boolean;
}

interface DragState {
  type: 'playlist' | 'folder' | 'group';
  id: string;
  name: string;
  cover?: string | null;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  isDragging: boolean;
}

interface GridItem {
  id: string;
  type: 'folder' | 'playlist';
  order: number;
  item: PlaylistFolder | Playlist;
}

const getContainerItems = (
  containerFolders: PlaylistFolder[],
  containerPlaylists: Playlist[],
  allFolders: PlaylistFolder[],
  allPlaylists: Playlist[]
): GridItem[] => {
  const items: GridItem[] = [
    ...containerFolders.map((f) => ({
      id: f.id,
      type: 'folder' as const,
      order: f.order !== undefined ? f.order : (allFolders.indexOf(f) * 10),
      item: f,
    })),
    ...containerPlaylists.map((p) => ({
      id: p.id,
      type: 'playlist' as const,
      order: p.order !== undefined ? p.order : ((allFolders.length + allPlaylists.indexOf(p)) * 10),
      item: p,
    })),
  ];
  return items.sort((a, b) => a.order - b.order);
};

const getFolderColorRgba = (color: string | undefined, alpha: number): string => {
  if (!color || color === 'default') {
    return `rgb(var(--md-sys-color-primary-rgb) / ${alpha})`;
  }
  if (color.startsWith('#')) {
    let c = color.slice(1);
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
  }
  return color;
};

interface FolderCardItemProps {
  folder: PlaylistFolder;
  covers?: string[];
  stats: { playlistsCount: number; subfoldersCount: number; totalTracks: number; totalDuration: number };
  isDropTarget: boolean;
  dropPosition?: 'before' | 'after' | null;
  isSelfDragging: boolean;
  language?: AppLanguage;
  onPointerDown: (e: React.PointerEvent) => void;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onPlayFolder: (folder: PlaylistFolder) => void;
  isDarkTheme?: boolean;
}

const FolderCardItem: React.FC<FolderCardItemProps> = ({
  folder,
  covers,
  stats,
  isDropTarget,
  dropPosition,
  isSelfDragging,
  language = 'ru',
  onPointerDown,
  onClick,
  onContextMenu,
  onPlayFolder,
  isDarkTheme = true,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [cycleIndex, setCycleIndex] = useState(0);
  const coversRef = useRef(covers || []);
  coversRef.current = covers || [];

  const IconComponent = getFolderIconComponent(folder.icon);

  const baseColor = getFolderColorHex(folder.color);
  // Play icon shade absorbs the folder color hue and follows the theme direction
  const playIconColor = getThemedPlayIconColor(folder.color, isDarkTheme);
  const coverType = folder.coverType || 'icon';
  const hasImages = covers && covers.length > 0 && coverType !== 'icon';

  // Slideshow interval for cycling folder covers with independent stagger and period
  useEffect(() => {
    if (coverType !== 'cycle' || !covers || covers.length <= 1) return;

    let hash = 0;
    for (let i = 0; i < folder.id.length; i++) {
      hash = (hash * 31 + folder.id.charCodeAt(i)) >>> 0;
    }
    const initialDelay = 400 + (hash % 2600);
    const intervalPeriod = 3200 + ((hash >> 2) % 1800);

    let intervalId: any = null;
    const timeoutId = setTimeout(() => {
      setCycleIndex((prev) => {
        const len = coversRef.current.length;
        return len > 0 ? (prev + 1) % len : 0;
      });
      intervalId = setInterval(() => {
        setCycleIndex((prev) => {
          const len = coversRef.current.length;
          return len > 0 ? (prev + 1) % len : 0;
        });
      }, intervalPeriod);
    }, initialDelay);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [coverType, covers?.length, folder.id]);

  // Dynamic card background on hover
  const bgCard = isDropTarget
    ? getFolderColorRgba(folder.color, 0.22)
    : isHovered
    ? getFolderColorRgba(folder.color, 0.12)
    : undefined;

  // Dynamic card border: highlighted with folder color
  const borderCard = isDropTarget
    ? baseColor
    : isHovered
    ? getFolderColorRgba(folder.color, 0.8)
    : getFolderColorRgba(folder.color, 0.24);

  // Colored soft glow shadow on hover
  const shadowCard = isHovered && !isSelfDragging
    ? `0 12px 28px -6px ${getFolderColorRgba(folder.color, 0.32)}`
    : undefined;

  // Fully colored background for the folder preview container
  const previewBg = isHovered
    ? `linear-gradient(145deg, ${getFolderColorRgba(folder.color, 0.36)}, ${getFolderColorRgba(folder.color, 0.22)})`
    : `linear-gradient(145deg, ${getFolderColorRgba(folder.color, 0.22)}, ${getFolderColorRgba(folder.color, 0.12)})`;

  // content-visibility paint containment clips the edge divider, so it is disabled on drop targets.
  return (
    <div
      data-folder-id={folder.id}
      onPointerDown={onPointerDown}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        backgroundColor: bgCard,
        borderColor: borderCard,
        boxShadow: shadowCard,
      }}
      className={`group ${dropPosition ? '' : 'grid-card-optimized'} relative flex flex-col p-3 rounded-3xl transition-all duration-150 cursor-pointer select-none border touch-none ${
        !folder.color
          ? isHovered
            ? 'bg-md3-surface-container border-md3-primary/40 shadow-md'
            : isDropTarget
            ? 'bg-md3-surface-container border-md3-primary ring-2 ring-md3-primary shadow-lg'
            : 'bg-md3-surface-container-low hover:bg-md3-surface-container border-md3-outline-variant/15 hover:border-md3-primary/40 shadow-sm hover:shadow-md'
          : !isHovered && !isDropTarget
          ? 'bg-md3-surface-container-low hover:bg-md3-surface-container shadow-sm hover:shadow-md'
          : ''
      } ${isDropTarget ? 'ring-2 ring-md3-primary scale-[1.02] shadow-lg' : ''} ${
        isSelfDragging ? 'opacity-30' : ''
      }`}
    >
      {/* Visual Insertion Indicator Bars */}
      {dropPosition === 'before' && (
        <div className="pointer-events-none absolute -left-2 top-2 bottom-2 z-30 w-1.5 rounded-full bg-md3-primary shadow-lg shadow-md3-primary/60 animate-pulse" />
      )}
      {dropPosition === 'after' && (
        <div className="pointer-events-none absolute -right-2 top-2 bottom-2 z-30 w-1.5 rounded-full bg-md3-primary shadow-lg shadow-md3-primary/60 animate-pulse" />
      )}

      {/* Visual Folder Icon / Playlist Cover / Collage Preview */}
      <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-md3-surface-container-highest mb-3 shadow-inner pointer-events-none transition-all duration-300 border border-md3-outline-variant/20">
        {hasImages ? (
          coverType === 'cycle' && covers.length > 1 ? (
            <div className="relative w-full h-full">
              {covers.map((src, idx) => (
                <img
                  key={src + idx}
                  src={src}
                  alt=""
                  draggable={false}
                  loading="lazy"
                  decoding="async"
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 pointer-events-none ${
                    idx === cycleIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
                  }`}
                />
              ))}
            </div>
          ) : coverType === 'first_playlist' || covers.length === 1 ? (
            <img
              src={covers[0]}
              alt={folder.name}
              draggable={false}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 pointer-events-none"
            />
          ) : covers.length === 2 ? (
            <div className="w-full h-full grid grid-cols-2 grid-rows-1 transition-transform duration-300 group-hover:scale-105 pointer-events-none">
              <img src={covers[0]} alt="" draggable={false} loading="lazy" decoding="async" className="w-full h-full object-cover" />
              <img src={covers[1]} alt="" draggable={false} loading="lazy" decoding="async" className="w-full h-full object-cover" />
            </div>
          ) : covers.length === 3 ? (
            <div className="w-full h-full grid grid-cols-2 grid-rows-2 transition-transform duration-300 group-hover:scale-105 pointer-events-none">
              <img src={covers[0]} alt="" draggable={false} loading="lazy" decoding="async" className="w-full h-full object-cover row-span-2" />
              <img src={covers[1]} alt="" draggable={false} loading="lazy" decoding="async" className="w-full h-full object-cover" />
              <img src={covers[2]} alt="" draggable={false} loading="lazy" decoding="async" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-full h-full grid grid-cols-2 grid-rows-2 transition-transform duration-300 group-hover:scale-105 pointer-events-none">
              <img src={covers[0]} alt="" draggable={false} loading="lazy" decoding="async" className="w-full h-full object-cover" />
              <img src={covers[1]} alt="" draggable={false} loading="lazy" decoding="async" className="w-full h-full object-cover" />
              <img src={covers[2]} alt="" draggable={false} loading="lazy" decoding="async" className="w-full h-full object-cover" />
              <img src={covers[3]} alt="" draggable={false} loading="lazy" decoding="async" className="w-full h-full object-cover" />
            </div>
          )
        ) : (
          <div 
            className="w-full h-full flex items-center justify-center relative transition-transform duration-300 group-hover:scale-105 pointer-events-none"
            style={{ background: previewBg }}
          >
            <IconComponent 
              className="w-12 h-12 transition-transform duration-300 group-hover:scale-110 drop-shadow-sm" 
              style={{ color: baseColor }}
            />
          </div>
        )}

        {/* Folder icon in top-left corner */}
        {hasImages && folder.icon && folder.icon !== 'none' && (
          <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-black/60 text-white/95 backdrop-blur-xs flex items-center justify-center shadow-xs z-20 pointer-events-none">
            <IconComponent className="w-3.5 h-3.5" />
          </div>
        )}

        {/* Floating Quick Play Folder Button (matches playlist card) */}
        {stats.totalTracks > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlayFolder(folder);
            }}
            title={language === 'ru' ? "Воспроизвести всю папку" : "Play entire folder"}
            style={{
              backgroundColor: baseColor,
              ...(playIconColor ? { color: playIconColor } : {}),
            }}
            className="pointer-events-auto absolute bottom-2.5 right-2.5 w-11 h-11 rounded-full text-md3-on-primary flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 transition-all duration-200 z-20 cursor-pointer"
          >
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </button>
        )}

        {isDropTarget && (
          <div 
            className="absolute inset-0 backdrop-blur-xs flex items-center justify-center z-25"
            style={{ backgroundColor: getFolderColorRgba(folder.color, 0.3) }}
          >
            <span 
              className="px-2.5 py-1 rounded-full text-md3-on-primary text-[10px] font-bold shadow-md"
              style={{ backgroundColor: baseColor }}
            >
              {language === 'ru' ? 'Переместить в папку' : 'Move to folder'}
            </span>
          </div>
        )}
      </div>

      {/* Title & Stats (matches playlist card) */}
      <div className="min-w-0 pointer-events-none">
        <h3 
          className="font-bold text-sm text-md3-on-surface truncate group-hover:text-md3-primary transition-colors"
          style={isHovered ? { color: baseColor } : undefined}
        >
          {folder.name}
        </h3>
        <p className="text-xs text-md3-on-surface-variant/80 truncate mt-0.5 font-medium">
          {stats.totalTracks} {language === 'ru' ? (stats.totalTracks === 1 ? 'трек' : stats.totalTracks < 5 && stats.totalTracks > 1 ? 'трека' : 'треков') : (stats.totalTracks === 1 ? 'track' : 'tracks')}
          {stats.totalDuration > 0 && ` • ${formatTime(stats.totalDuration)}`}
        </p>
      </div>
    </div>
  );
};

interface PlaylistCardItemProps {
  playlist: Playlist;
  cover: string | null;
  covers: string[];
  totalDuration: number;
  isTarget: boolean;
  dropPosition?: 'before' | 'after' | null;
  isSelfDragging: boolean;
  language?: AppLanguage;
  onPointerDown: (e: React.PointerEvent) => void;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onPlayPlaylist: (playlist: Playlist) => void;
  isDarkTheme?: boolean;
}

const PlaylistCardItem: React.FC<PlaylistCardItemProps> = ({
  playlist,
  cover,
  covers,
  totalDuration,
  isTarget,
  dropPosition,
  isSelfDragging,
  language = 'ru',
  onPointerDown,
  onClick,
  onContextMenu,
  onPlayPlaylist,
  isDarkTheme = true,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [cycleIndex, setCycleIndex] = useState(0);
  const coversRef = useRef(covers || []);
  coversRef.current = covers || [];

  const IconComponent = getFolderIconComponent(playlist.icon);
  const baseColor = getFolderColorHex(playlist.color);
  // Play icon shade absorbs the playlist color hue and follows the theme direction
  const playIconColor = getThemedPlayIconColor(playlist.color, isDarkTheme);
  const coverType: FolderCoverType = (playlist.coverType as FolderCoverType) || 'first_playlist';
  const hasMultipleCovers = covers && covers.length > 1;
  const hasImages = (cover || (covers && covers.length > 0)) && coverType !== 'icon';

  // Slideshow interval for cycling playlist covers with independent stagger and period
  useEffect(() => {
    if (coverType !== 'cycle' || !hasMultipleCovers || covers.length <= 1) return;

    let hash = 0;
    for (let i = 0; i < playlist.id.length; i++) {
      hash = (hash * 31 + playlist.id.charCodeAt(i)) >>> 0;
    }
    const initialDelay = 400 + (hash % 2600);
    const intervalPeriod = 3200 + ((hash >> 2) % 1800);

    let intervalId: any = null;
    const timeoutId = setTimeout(() => {
      setCycleIndex((prev) => {
        const len = coversRef.current.length;
        return len > 0 ? (prev + 1) % len : 0;
      });
      intervalId = setInterval(() => {
        setCycleIndex((prev) => {
          const len = coversRef.current.length;
          return len > 0 ? (prev + 1) % len : 0;
        });
      }, intervalPeriod);
    }, initialDelay);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [coverType, hasMultipleCovers, covers?.length, playlist.id]);

  // Drop target uses a tonal surface and primary outline, matching the original
  // card-edge insertion treatment without any pulsing animation.
  const bgCard = isTarget
    ? playlist.color ? getFolderColorRgba(playlist.color, 0.22) : undefined
    : isHovered
    ? playlist.color ? getFolderColorRgba(playlist.color, 0.12) : undefined
    : undefined;

  const borderCard = isTarget
    ? (playlist.color ? baseColor : 'rgb(var(--md-sys-color-primary-rgb))')
    : playlist.color
    ? (isHovered ? getFolderColorRgba(playlist.color, 0.8) : getFolderColorRgba(playlist.color, 0.24))
    : (isHovered ? 'rgb(var(--md-sys-color-primary-rgb) / 0.45)' : undefined);

  // Colored soft glow shadow on hover
  const shadowCard = isHovered && !isSelfDragging && playlist.color
    ? `0 12px 28px -6px ${getFolderColorRgba(playlist.color, 0.32)}`
    : undefined;

  // Fully colored background for the playlist preview container (when icon coverType or empty)
  const previewBg = isHovered && playlist.color
    ? `linear-gradient(145deg, ${getFolderColorRgba(playlist.color, 0.36)}, ${getFolderColorRgba(playlist.color, 0.22)})`
    : playlist.color
    ? `linear-gradient(145deg, ${getFolderColorRgba(playlist.color, 0.22)}, ${getFolderColorRgba(playlist.color, 0.12)})`
    : undefined;

  // content-visibility paint containment clips the edge divider, so it is disabled on drop targets.
  return (
    <div
      data-playlist-id={playlist.id}
      onPointerDown={onPointerDown}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        backgroundColor: bgCard,
        borderColor: borderCard,
        boxShadow: shadowCard,
      }}
      className={`group ${dropPosition ? '' : 'grid-card-optimized'} relative flex flex-col p-3 rounded-3xl transition-all duration-150 cursor-pointer select-none border touch-none ${
        !playlist.color
          ? isHovered
            ? 'bg-md3-surface-container border-md3-primary/40 shadow-md'
            : isTarget
            ? 'bg-md3-surface-container border-md3-primary ring-2 ring-md3-primary shadow-lg'
            : 'bg-md3-surface-container-low hover:bg-md3-surface-container border-md3-outline-variant/15 hover:border-md3-primary/40 shadow-sm hover:shadow-md'
          : !isHovered && !isTarget
          ? 'bg-md3-surface-container-low hover:bg-md3-surface-container shadow-sm hover:shadow-md'
          : ''
      } ${isTarget ? 'ring-2 ring-md3-primary scale-[1.02] shadow-lg' : ''} ${
        isSelfDragging ? 'opacity-30' : ''
      }`}
    >
      {/* Visual Insertion Indicator Bars */}
      {dropPosition === 'before' && (
        <div className="pointer-events-none absolute -left-2 top-2 bottom-2 z-30 w-1.5 rounded-full bg-md3-primary shadow-lg shadow-md3-primary/60 animate-pulse" />
      )}
      {dropPosition === 'after' && (
        <div className="pointer-events-none absolute -right-2 top-2 bottom-2 z-30 w-1.5 rounded-full bg-md3-primary shadow-lg shadow-md3-primary/60 animate-pulse" />
      )}

      {/* Cover Art Container */}
      <div 
        className="relative aspect-square w-full rounded-2xl overflow-hidden bg-md3-surface-container-highest mb-3 shadow-inner pointer-events-none transition-all duration-300 border border-md3-outline-variant/20"
        style={previewBg && !hasImages ? { background: previewBg } : undefined}
      >
        {hasImages ? (
          coverType === 'cycle' && hasMultipleCovers ? (
            <div className="relative w-full h-full z-[1]">
              {covers.map((c, idx) => (
                <img
                  key={c + idx}
                  src={c}
                  alt=""
                  draggable={false}
                  loading="lazy"
                  decoding="async"
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 pointer-events-none ${
                    idx === cycleIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
                  }`}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ))}
            </div>
          ) : coverType === 'collage' && hasMultipleCovers ? (
            covers.length === 2 ? (
              <div className="w-full h-full grid grid-cols-2 grid-rows-1 transition-transform duration-300 group-hover:scale-105 pointer-events-none relative z-[1]">
                <img src={covers[0]} alt="" draggable={false} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                <img src={covers[1]} alt="" draggable={false} loading="lazy" decoding="async" className="w-full h-full object-cover" />
              </div>
            ) : covers.length === 3 ? (
              <div className="w-full h-full grid grid-cols-2 grid-rows-2 transition-transform duration-300 group-hover:scale-105 pointer-events-none relative z-[1]">
                <img src={covers[0]} alt="" draggable={false} loading="lazy" decoding="async" className="w-full h-full object-cover row-span-2" />
                <img src={covers[1]} alt="" draggable={false} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                <img src={covers[2]} alt="" draggable={false} loading="lazy" decoding="async" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-full h-full grid grid-cols-2 grid-rows-2 transition-transform duration-300 group-hover:scale-105 pointer-events-none relative z-[1]">
                <img src={covers[0]} alt="" draggable={false} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                <img src={covers[1]} alt="" draggable={false} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                <img src={covers[2]} alt="" draggable={false} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                <img src={covers[3]} alt="" draggable={false} loading="lazy" decoding="async" className="w-full h-full object-cover" />
              </div>
            )
          ) : cover ? (
            <img
              src={cover}
              alt={playlist.name}
              draggable={false}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 pointer-events-none relative z-[1]"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : null
        ) : (
          <div className="w-full h-full flex items-center justify-center pointer-events-none transition-transform duration-300 group-hover:scale-105">
            <IconComponent 
              className="w-16 h-16 drop-shadow-md transition-all duration-300"
              style={{ color: baseColor || 'rgb(var(--md-sys-color-primary-rgb))' }}
            />
          </div>
        )}

        {/* Floating Play Button on Hover */}
        {playlist.trackIds.length > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlayPlaylist(playlist);
            }}
            title={language === 'ru' ? "Воспроизвести плейлист" : "Play playlist"}
            style={{
              backgroundColor: baseColor,
              ...(playIconColor ? { color: playIconColor } : {}),
            }}
            className="pointer-events-auto absolute bottom-2.5 right-2.5 w-11 h-11 rounded-full text-md3-on-primary flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 transition-all duration-200 z-20 cursor-pointer"
          >
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </button>
        )}

        {/* Small playlist icon badge in top-left when images are shown and icon is custom */}
        {hasImages && playlist.icon && playlist.icon !== 'none' && playlist.icon !== 'list' && (
          <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-black/60 text-white/95 backdrop-blur-xs flex items-center justify-center shadow-xs z-20 pointer-events-none">
            <IconComponent className="w-3.5 h-3.5" />
          </div>
        )}

        {/* System Badge */}
        {playlist.isSystem && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-[10px] font-semibold text-white/90 backdrop-blur-xs z-20">
            {language === 'ru' ? 'Системный' : 'System'}
          </span>
        )}
      </div>

      {/* Title & Stats */}
      <div className="min-w-0 pointer-events-none">
        <h3 
          className="font-bold text-sm text-md3-on-surface truncate transition-colors"
          style={isHovered && baseColor ? { color: baseColor } : undefined}
        >
          {playlist.name}
        </h3>
        <p className="text-xs text-md3-on-surface-variant/80 truncate mt-0.5 font-medium">
          {playlist.trackIds.length} {language === 'ru' ? (playlist.trackIds.length === 1 ? 'трек' : playlist.trackIds.length < 5 && playlist.trackIds.length > 1 ? 'трека' : 'треков') : (playlist.trackIds.length === 1 ? 'track' : 'tracks')}
          {totalDuration > 0 && ` • ${formatTime(totalDuration)}`}
        </p>
      </div>
    </div>
  );
};

export const PlaylistsGridView: React.FC<PlaylistsGridViewProps> = ({
  playlists,
  folders,
  groups,
  tracks,
  searchQuery = '',
  language = 'ru',
  onSelectPlaylist,
  onCreatePlaylist,
  onCreateFolder,
  onCreateGroup,
  onImportM3U8,
  onOpenPlaylistsFolder,
  onPlayPlaylist,
  onPlayFolder,
  onOpenPlaylistContextMenu,
  onOpenFolderContextMenu,
  onToggleGroupCollapse,
  onRenameGroup,
  onEditGroup,
  onDeleteGroup,
  onMoveGroup,
  onReorderGroups,
  onMovePlaylistToFolder,
  onMovePlaylistToGroup,
  onMoveFolderToFolder,
  onMoveFolderToGroup,
  onReorderPlaylists,
  onReorderFolders,
  onReorderItems,
  onEditFolder,
  isDarkTheme = true,
}) => {
  // Navigation state: current folder view (null = root)
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderNavDirection, setFolderNavDirection] = useState<'forward' | 'backward'>('forward');

  const handleOpenFolder = (folderId: string) => {
    setFolderNavDirection('forward');
    setCurrentFolderId(folderId);
  };

  const handleGoBackFolder = (targetFolderId: string | null) => {
    setFolderNavDirection('backward');
    setCurrentFolderId(targetFolderId);
  };

  // Pointer-based Drag State (100% bypasses Windows OS DnD bugs and 🚫 cursor)
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragStateRef = useRef<DragState | null>(null);

  // Hover target states for visual feedback
  const [hoveredFolderId, setHoveredFolderId] = useState<string | null>(null);
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  const [hoveredCrumbId, setHoveredCrumbId] = useState<string | null | 'root'>(null);
  const [dropTargetItem, setDropTargetItem] = useState<{ id: string; type: 'playlist' | 'folder'; position: 'before' | 'after' } | null>(null);
  const [dropTargetGroup, setDropTargetGroup] = useState<{ id: string; position: 'before' | 'after' } | null>(null);

  // Sync ref with state
  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  // Current folder object (if inside a folder)
  const currentFolder = useMemo(() => {
    if (!currentFolderId) return null;
    return folders.find((f) => f.id === currentFolderId) || null;
  }, [currentFolderId, folders]);

  // Keyboard shortcut: Escape to return to parent folder or root
  useEffect(() => {
    if (!currentFolderId) return;

    const handleFolderKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        e.stopPropagation();
        handleGoBackFolder(currentFolder?.parentId || null);
      }
    };

    window.addEventListener('keydown', handleFolderKeyDown);
    return () => window.removeEventListener('keydown', handleFolderKeyDown);
  }, [currentFolderId, currentFolder]);

  // Breadcrumbs path
  const breadcrumbs = useMemo(() => {
    const crumbs: PlaylistFolder[] = [];
    let currId = currentFolderId;
    while (currId) {
      const f = folders.find((item) => item.id === currId);
      if (!f) break;
      crumbs.unshift(f);
      currId = f.parentId || null;
    }
    return crumbs;
  }, [currentFolderId, folders]);

  // Fast O(1) track lookup map to prevent massive loops on large libraries
  const trackMap = useMemo(() => new Map(tracks.map((t) => [t.id, t])), [tracks]);

  // Helpers to get cover art and duration
  const getPlaylistCover = (playlist: Playlist): string | null => {
    for (const id of playlist.trackIds) {
      const t = trackMap.get(id);
      if (t && t.coverArt) return t.coverArt;
    }
    return null;
  };

  const getPlaylistCovers = (playlist: Playlist): string[] => {
    const covers: string[] = [];
    for (const id of playlist.trackIds) {
      const t = trackMap.get(id);
      if (t && t.coverArt && !covers.includes(t.coverArt)) {
        covers.push(t.coverArt);
        if (covers.length >= 8) break;
      }
    }
    return covers;
  };

  const getPlaylistDuration = (playlist: Playlist): number => {
    let total = 0;
    for (const id of playlist.trackIds) {
      const t = trackMap.get(id);
      if (t && t.duration && !isNaN(t.duration)) total += t.duration;
    }
    return total;
  };

  const getFolderStats = (folderId: string) => {
    const subfolders = folders.filter((f) => f.parentId === folderId);
    const folderPlaylists = playlists.filter((p) => p.folderId === folderId);
    let totalTracks = 0;
    let totalDuration = 0;
    for (const pl of folderPlaylists) {
      totalTracks += pl.trackIds.length;
      totalDuration += getPlaylistDuration(pl);
    }
    for (const sf of subfolders) {
      const sfStats = getFolderStats(sf.id);
      totalTracks += sfStats.totalTracks;
      totalDuration += sfStats.totalDuration;
    }
    return {
      subfoldersCount: subfolders.length,
      playlistsCount: folderPlaylists.length,
      totalTracks,
      totalDuration,
    };
  };

  const getFolderCovers = (folderId: string): string[] => {
    const getSubfolderIds = (fid: string): string[] => {
      const directChildren = folders.filter((f) => f.parentId === fid).map((f) => f.id);
      let all = [fid];
      for (const childId of directChildren) {
        all = [...all, ...getSubfolderIds(childId)];
      }
      return all;
    };

    const targetFolderIds = new Set(getSubfolderIds(folderId));
    const folderPlaylists = playlists.filter((p) => p.folderId && targetFolderIds.has(p.folderId));

    const covers: string[] = [];
    // 1. Primary: first cover of each playlist in the folder
    for (const pl of folderPlaylists) {
      const c = getPlaylistCover(pl);
      if (c && !covers.includes(c)) {
        covers.push(c);
        if (covers.length >= 8) break;
      }
    }

    // 2. Secondary: supplement from tracks if fewer than 8 distinct covers
    if (covers.length < 8) {
      for (const pl of folderPlaylists) {
        for (const tid of pl.trackIds) {
          const t = trackMap.get(tid);
          if (t && t.coverArt && !covers.includes(t.coverArt)) {
            covers.push(t.coverArt);
            if (covers.length >= 8) break;
          }
        }
        if (covers.length >= 8) break;
      }
    }

    return covers;
  };

  const handleReorderItem = (
    draggedId: string,
    draggedType: 'playlist' | 'folder',
    targetId: string,
    targetType: 'playlist' | 'folder',
    position: 'before' | 'after'
  ) => {
    // 1. Identify target's container
    let destFolderId: string | null = null;
    let destGroupId: string | null = null;

    if (targetType === 'playlist') {
      const targetPl = playlists.find((p) => p.id === targetId);
      if (!targetPl) return;
      destFolderId = targetPl.folderId || null;
      destGroupId = targetPl.folderId ? null : (targetPl.groupId || null);
    } else {
      const targetFolder = folders.find((f) => f.id === targetId);
      if (!targetFolder) return;
      destFolderId = targetFolder.parentId || null;
      destGroupId = targetFolder.parentId ? null : (targetFolder.groupId || null);
    }

    // 2. Get all items in destination container
    const containerFolders = folders.filter(
      (f) => (f.parentId || null) === destFolderId && (destFolderId ? true : (f.groupId || null) === destGroupId)
    );
    const containerPlaylists = playlists.filter(
      (p) => (p.folderId || null) === destFolderId && (destFolderId ? true : (p.groupId || null) === destGroupId)
    );

    // Current sorted list of items in destination
    let items = getContainerItems(containerFolders, containerPlaylists, folders, playlists);

    // Remove dragged item if already in this container
    const existingIndex = items.findIndex((i) => i.id === draggedId);
    let draggedEntry: GridItem | null = null;
    if (existingIndex !== -1) {
      draggedEntry = items.splice(existingIndex, 1)[0];
    } else {
      if (draggedType === 'playlist') {
        const pl = playlists.find((p) => p.id === draggedId);
        if (pl) draggedEntry = { id: pl.id, type: 'playlist', order: 0, item: pl };
      } else {
        const f = folders.find((f) => f.id === draggedId);
        if (f) draggedEntry = { id: f.id, type: 'folder', order: 0, item: f };
      }
    }

    if (!draggedEntry) return;

    // Find target index in items
    let targetIndex = items.findIndex((i) => i.id === targetId);
    if (targetIndex === -1) targetIndex = items.length;
    if (position === 'after') {
      targetIndex += 1;
    }

    items.splice(targetIndex, 0, draggedEntry);

    // Assign sequential order
    const nextPlaylists = [...playlists];
    const nextFolders = [...folders];

    items.forEach((entry, idx) => {
      const newOrder = idx * 10;
      if (entry.type === 'playlist') {
        const plIdx = nextPlaylists.findIndex((p) => p.id === entry.id);
        if (plIdx !== -1) {
          nextPlaylists[plIdx] = {
            ...nextPlaylists[plIdx],
            order: newOrder,
            folderId: destFolderId,
            groupId: destFolderId ? null : destGroupId,
          };
        }
      } else {
        const fIdx = nextFolders.findIndex((f) => f.id === entry.id);
        if (fIdx !== -1) {
          nextFolders[fIdx] = {
            ...nextFolders[fIdx],
            order: newOrder,
            parentId: destFolderId,
            groupId: destFolderId ? null : destGroupId,
          };
        }
      }
    });

    if (onReorderItems) {
      onReorderItems(nextPlaylists, nextFolders);
    } else {
      onReorderPlaylists(nextPlaylists);
      onReorderFolders?.(nextFolders);
    }
  };

  // ---------------- POINTER DRAG & DROP ENGINE ----------------

  const handlePointerDown = (
    e: React.PointerEvent,
    item: { type: 'playlist' | 'folder' | 'group'; id: string; name: string; cover?: string | null }
  ) => {
    // Only drag with left mouse button / primary touch
    if (e.button !== 0) return;

    const initialDrag: DragState = {
      type: item.type,
      id: item.id,
      name: item.name,
      cover: item.cover,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      isDragging: false,
    };

    setDragState(initialDrag);
    dragStateRef.current = initialDrag;
  };

  // Global PointerMove and PointerUp listeners during active drag
  useEffect(() => {
    if (!dragState) return;

    const handleWindowPointerMove = (e: PointerEvent) => {
      const current = dragStateRef.current;
      if (!current) return;

      const deltaX = Math.abs(e.clientX - current.startX);
      const deltaY = Math.abs(e.clientY - current.startY);
      const isDraggingNow = current.isDragging || deltaX > 5 || deltaY > 5;

      const updated: DragState = {
        ...current,
        currentX: e.clientX,
        currentY: e.clientY,
        isDragging: isDraggingNow,
      };

      setDragState(updated);
      dragStateRef.current = updated;

      if (!isDraggingNow) return;

      // Mark global internal dragging so file overlays never pop up
      (window as any).__isInternalDragging = true;
      document.body.style.cursor = 'grabbing';

      // Detect hover target under cursor
      const target = document.elementFromPoint(e.clientX, e.clientY);
      if (!target) {
        setHoveredFolderId(null);
        setHoveredGroupId(null);
        setHoveredCrumbId(null);
        setDropTargetItem(null);
        setDropTargetGroup(null);
        return;
      }

      // Check Breadcrumb target
      const crumbEl = target.closest('[data-crumb-id]');
      if (crumbEl) {
        const crumbId = crumbEl.getAttribute('data-crumb-id') as string;
        setHoveredCrumbId(crumbId === 'root' ? 'root' : crumbId);
        setHoveredFolderId(null);
        setDropTargetItem(null);
        setHoveredGroupId(null);
        return;
      } else {
        setHoveredCrumbId(null);
      }

      // Check Folder Card target
      const folderEl = target.closest('[data-folder-id]');
      if (folderEl) {
        const folderId = folderEl.getAttribute('data-folder-id');
        if (folderId && folderId !== current.id) {
          const rect = folderEl.getBoundingClientRect();
          const relX = (e.clientX - rect.left) / rect.width;
          if (relX < 0.25) {
            setDropTargetItem({ id: folderId, type: 'folder', position: 'before' });
            setHoveredFolderId(null);
          } else if (relX > 0.75) {
            setDropTargetItem({ id: folderId, type: 'folder', position: 'after' });
            setHoveredFolderId(null);
          } else {
            setDropTargetItem(null);
            setHoveredFolderId(folderId);
          }
          setHoveredGroupId(null);
          return;
        }
      }
      setHoveredFolderId(null);

      // Check Playlist Card target (for playlist and folder reordering)
      if (current.type === 'playlist' || current.type === 'folder') {
        const playlistEl = target.closest('[data-playlist-id]');
        if (playlistEl) {
          const playlistId = playlistEl.getAttribute('data-playlist-id');
          if (playlistId && playlistId !== current.id) {
            const rect = playlistEl.getBoundingClientRect();
            const pos = e.clientX < rect.left + rect.width / 2 ? 'before' : 'after';
            setDropTargetItem({ id: playlistId, type: 'playlist', position: pos });
            setHoveredGroupId(null);
            return;
          }
        }
      }
      setDropTargetItem(null);

      // Check Group Header target (for group reordering)
      if (current.type === 'group') {
        const groupHeaderEl = target.closest('[data-group-header-id]');
        if (groupHeaderEl) {
          const grpId = groupHeaderEl.getAttribute('data-group-header-id');
          if (grpId && grpId !== current.id) {
            const rect = groupHeaderEl.getBoundingClientRect();
            const pos = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
            setDropTargetGroup({ id: grpId, position: pos });
            return;
          }
        }
      }
      setDropTargetGroup(null);

      // Check Group Container target (for moving playlist/folder into group)
      const groupEl = target.closest('[data-group-id]');
      if (groupEl) {
        const grpId = groupEl.getAttribute('data-group-id');
        if (grpId) {
          setHoveredGroupId(grpId);
          return;
        }
      }
      setHoveredGroupId(null);
    };

    const handleWindowPointerUp = (e: PointerEvent) => {
      const current = dragStateRef.current;
      document.body.style.cursor = '';
      (window as any).__isInternalDragging = false;

      if (!current || !current.isDragging) {
        setDragState(null);
        dragStateRef.current = null;
        return;
      }

      const target = document.elementFromPoint(e.clientX, e.clientY);
      if (target) {
        // 1. Drop on Breadcrumb
        const crumbEl = target.closest('[data-crumb-id]');
        if (crumbEl) {
          const crumbId = crumbEl.getAttribute('data-crumb-id');
          const destFolderId = crumbId === 'root' ? null : crumbId;
          if (current.type === 'playlist') {
            onMovePlaylistToFolder(current.id, destFolderId);
          } else if (current.type === 'folder' && current.id !== destFolderId) {
            onMoveFolderToFolder(current.id, destFolderId);
          }
          cleanupDrag();
          return;
        }

        // Resolve item drops from the pointer-up coordinates instead of the
        // asynchronously updated hover state. This keeps reordering reliable
        // when the pointer is released before the last hover-state render lands.
        if (current.type === 'playlist' || current.type === 'folder') {
          const folderEl = target.closest('[data-folder-id]');
          const targetFolderId = folderEl?.getAttribute('data-folder-id');
          if (folderEl && targetFolderId && targetFolderId !== current.id) {
            const rect = folderEl.getBoundingClientRect();
            const relX = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0.5;
            if (relX < 0.25 || relX > 0.75) {
              handleReorderItem(
                current.id,
                current.type,
                targetFolderId,
                'folder',
                relX < 0.25 ? 'before' : 'after'
              );
            } else if (current.type === 'playlist') {
              onMovePlaylistToFolder(current.id, targetFolderId);
            } else {
              onMoveFolderToFolder(current.id, targetFolderId);
            }
            cleanupDrag();
            return;
          }

          const playlistEl = target.closest('[data-playlist-id]');
          const targetPlaylistId = playlistEl?.getAttribute('data-playlist-id');
          if (playlistEl && targetPlaylistId && targetPlaylistId !== current.id) {
            const rect = playlistEl.getBoundingClientRect();
            const position = e.clientX < rect.left + rect.width / 2 ? 'before' : 'after';
            handleReorderItem(current.id, current.type, targetPlaylistId, 'playlist', position);
            cleanupDrag();
            return;
          }
        }

        // 4. Drop on Group Header (Reorder groups)
        if (current.type === 'group' && onReorderGroups) {
          const groupHeaderEl = target.closest('[data-group-header-id]');
          if (groupHeaderEl) {
            const targetGroupId = groupHeaderEl.getAttribute('data-group-header-id');
            if (targetGroupId && targetGroupId !== current.id) {
              const rect = groupHeaderEl.getBoundingClientRect();
              const isBefore = e.clientY < rect.top + rect.height / 2;

              const nextGroups = [...groups];
              const fromIndex = nextGroups.findIndex((g) => g.id === current.id);
              if (fromIndex !== -1) {
                const [removedGroup] = nextGroups.splice(fromIndex, 1);
                let toIndex = nextGroups.findIndex((g) => g.id === targetGroupId);
                if (toIndex !== -1) {
                  if (!isBefore) toIndex += 1;
                  nextGroups.splice(toIndex, 0, removedGroup);
                  onReorderGroups(nextGroups);
                }
              }
              cleanupDrag();
              return;
            }
          }
        }

        // 5. Drop on Group section (Move playlist/folder into group)
        const groupEl = target.closest('[data-group-id]');
        if (groupEl) {
          const targetGroupId = groupEl.getAttribute('data-group-id');
          const finalGroupId = targetGroupId === 'ungrouped' ? null : targetGroupId;
          if (current.type === 'playlist') {
            onMovePlaylistToGroup(current.id, finalGroupId);
          } else if (current.type === 'folder') {
            onMoveFolderToGroup(current.id, finalGroupId);
          }
          cleanupDrag();
          return;
        }
      }

      cleanupDrag();
    };

    const cleanupDrag = () => {
      setDragState(null);
      dragStateRef.current = null;
      setHoveredFolderId(null);
      setHoveredGroupId(null);
      setHoveredCrumbId(null);
      setDropTargetItem(null);
      setDropTargetGroup(null);
      document.body.style.cursor = '';
      (window as any).__isInternalDragging = false;
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', cleanupDrag);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', cleanupDrag);
    };
  }, [dragState, playlists, groups, folders, onMovePlaylistToFolder, onMovePlaylistToGroup, onMoveFolderToFolder, onMoveFolderToGroup, onReorderPlaylists, onReorderFolders, onReorderItems, onReorderGroups]);

  // Render a Single Folder Card
  const renderFolderCard = (folder: PlaylistFolder) => {
    const stats = getFolderStats(folder.id);
    const covers = getFolderCovers(folder.id);
    const dropPosition = dropTargetItem?.id === folder.id && dropTargetItem?.type === 'folder' ? dropTargetItem.position : null;
    const isDropTarget = hoveredFolderId === folder.id;
    const isSelfDragging = dragState?.type === 'folder' && dragState?.id === folder.id && dragState.isDragging;

    return (
      <FolderCardItem
        key={folder.id}
        folder={folder}
        covers={covers}
        stats={stats}
        language={language}
        isDropTarget={isDropTarget}
        dropPosition={dropPosition}
        isSelfDragging={isSelfDragging}
        onPointerDown={(e) => {
          handlePointerDown(e, {
            type: 'folder',
            id: folder.id,
            name: folder.name,
            cover: covers.length > 0 ? covers[0] : null,
          });
        }}
        onClick={() => {
          if (!dragState?.isDragging) {
            handleOpenFolder(folder.id);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpenFolderContextMenu(e, folder);
        }}
        onPlayFolder={onPlayFolder}
        isDarkTheme={isDarkTheme}
      />
    );
  };

  // Render a Single Playlist Card
  const renderPlaylistCard = (playlist: Playlist) => {
    const cover = getPlaylistCover(playlist);
    const covers = getPlaylistCovers(playlist);
    const totalDuration = getPlaylistDuration(playlist);
    const isSelfDragging = dragState?.type === 'playlist' && dragState?.id === playlist.id && dragState.isDragging;
    const isTarget = dropTargetItem?.id === playlist.id && dropTargetItem?.type === 'playlist';
    const dropPosition = isTarget ? dropTargetItem?.position : null;

    return (
      <PlaylistCardItem
        key={playlist.id}
        playlist={playlist}
        cover={cover}
        covers={covers}
        totalDuration={totalDuration}
        isTarget={isTarget}
        dropPosition={dropPosition}
        isSelfDragging={isSelfDragging}
        language={language}
        onPointerDown={(e) => {
          handlePointerDown(e, {
            type: 'playlist',
            id: playlist.id,
            name: playlist.name,
            cover,
          });
        }}
        onClick={() => {
          if (!dragState?.isDragging) {
            onSelectPlaylist(playlist.id);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpenPlaylistContextMenu(e, playlist);
        }}
        onPlayPlaylist={onPlayPlaylist}
        isDarkTheme={isDarkTheme}
      />
    );
  };

  // Search filtering logic
  const isSearchActive = Boolean(searchQuery && searchQuery.trim());
  const normalizedQuery = searchQuery.toLowerCase().trim();

  const searchFilteredPlaylists = useMemo(() => {
    if (!isSearchActive) return [];
    return playlists.filter((pl) => {
      if (pl.name.toLowerCase().includes(normalizedQuery)) return true;
      if (pl.description && pl.description.toLowerCase().includes(normalizedQuery)) return true;
      return pl.trackIds.some((id) => {
        const t = trackMap.get(id);
        if (!t) return false;
        return (
          t.title.toLowerCase().includes(normalizedQuery) ||
          t.artist.toLowerCase().includes(normalizedQuery) ||
          (t.album && t.album.toLowerCase().includes(normalizedQuery))
        );
      });
    });
  }, [isSearchActive, normalizedQuery, playlists, trackMap]);

  const searchFilteredFolders = useMemo(() => {
    if (!isSearchActive) return [];
    return folders.filter((f) => f.name.toLowerCase().includes(normalizedQuery));
  }, [isSearchActive, normalizedQuery, folders]);

  // If search query is active, display filtered results across playlists & folders
  if (isSearchActive) {
    const hasResults = searchFilteredFolders.length > 0 || searchFilteredPlaylists.length > 0;

    return (
      <div className="flex-1 flex flex-col h-full min-h-0 bg-md3-surface p-6 overflow-y-auto custom-scrollbar select-none">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-md3-outline-variant/15">
          <div>
            <h2 className="text-xl font-bold text-md3-on-surface">
              {language === 'ru' ? 'Поиск в плейлистах' : 'Search Playlists'}
            </h2>
            <p className="text-xs text-md3-on-surface-variant mt-0.5">
              {language === 'ru'
                ? `По запросу «${searchQuery}»: найдено ${searchFilteredPlaylists.length} ${searchFilteredPlaylists.length === 1 ? 'плейлист' : 'плейлистов'}`
                : `For "${searchQuery}": found ${searchFilteredPlaylists.length} ${searchFilteredPlaylists.length === 1 ? 'playlist' : 'playlists'}`
              }
              {searchFilteredFolders.length > 0 && (language === 'ru'
                ? ` и ${searchFilteredFolders.length} папок`
                : ` and ${searchFilteredFolders.length} folders`
              )}
            </p>
          </div>
        </div>

        {!hasResults ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-md3-on-surface-variant">
            <div className="w-16 h-16 rounded-full bg-md3-surface-container-high flex items-center justify-center mb-3 text-md3-primary">
              <ListMusic className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-md3-on-surface mb-1">Ничего не найдено</h3>
            <p className="text-xs max-w-sm">
              По запросу «{searchQuery}» плейлисты и папки не найдены.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {searchFilteredFolders.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-md3-on-surface-variant mb-4 flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-md3-primary" />
                  Папки ({searchFilteredFolders.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {searchFilteredFolders.map(renderFolderCard)}
                </div>
              </div>
            )}

            {searchFilteredPlaylists.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-md3-on-surface-variant mb-4 flex items-center gap-2">
                  <ListMusic className="w-4 h-4 text-md3-primary" />
                  Плейлисты ({searchFilteredPlaylists.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {searchFilteredPlaylists.map(renderPlaylistCard)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ---------------- VIEW INSIDE A FOLDER ----------------
  if (currentFolderId && currentFolder) {
    const subfoldersInside = folders.filter((f) => f.parentId === currentFolderId);
    const playlistsInside = playlists.filter((p) => p.folderId === currentFolderId);
    const totalItems = subfoldersInside.length + playlistsInside.length;
    const CurrentFolderIcon = getFolderIconComponent(currentFolder.icon);

    return (
      <div key={`folder-view-${currentFolderId}`} className={`flex-1 flex flex-col h-full min-h-0 bg-md3-surface p-6 overflow-y-auto custom-scrollbar select-none ${folderNavDirection === 'forward' ? 'anim-view-slide-right' : 'anim-view-slide-left'}`}>
        {/* Floating Drag Ghost element */}
        {dragState && dragState.isDragging && (
          <div
            style={{
              left: `${dragState.currentX + 12}px`,
              top: `${dragState.currentY + 12}px`,
            }}
            className="fixed pointer-events-none z-50 flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-md3-surface-container-highest/95 backdrop-blur-md border border-md3-primary shadow-2xl text-xs font-bold text-md3-on-surface scale-105 rotate-2"
          >
            {dragState.cover ? (
              <img src={dragState.cover} alt="" className="w-6 h-6 rounded-lg object-cover" />
            ) : (
              <ListMusic className="w-5 h-5 text-md3-primary" />
            )}
            <span className="truncate max-w-[160px]">{dragState.name}</span>
          </div>
        )}

        {/* Folder Header & Breadcrumbs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-md3-outline-variant/15">
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleGoBackFolder(currentFolder.parentId || null)}
              className="w-10 h-10 rounded-2xl flex items-center justify-center bg-md3-surface hover:bg-md3-surface-container-high text-md3-primary border border-md3-outline-variant/20 transition-all shadow-xs cursor-pointer hover:scale-105 active:scale-95"
              title={language === 'ru' ? 'Назад' : 'Back'}
            >
              <ArrowLeft className="w-5 h-5 text-md3-primary" />
            </button>

            <div>
              {/* Breadcrumb row */}
              <div className="flex items-center gap-1.5 text-xs text-md3-on-surface-variant flex-wrap mb-1">
                <button
                  data-crumb-id="root"
                  onClick={() => handleGoBackFolder(null)}
                  className={`hover:text-md3-primary transition-colors px-1.5 py-0.5 rounded-md ${
                    hoveredCrumbId === 'root' ? 'bg-md3-primary/20 text-md3-primary font-bold ring-1 ring-md3-primary' : ''
                  }`}
                >
                  {language === 'ru' ? 'Все плейлисты' : 'All Playlists'}
                </button>

                {breadcrumbs.map((crumb, idx) => {
                  const isLast = idx === breadcrumbs.length - 1;
                  return (
                    <React.Fragment key={crumb.id}>
                      <ChevronRight className="w-3.5 h-3.5 opacity-40 flex-shrink-0" />
                      <button
                        data-crumb-id={crumb.id}
                        disabled={isLast}
                        onClick={() => handleGoBackFolder(crumb.id)}
                        className={`truncate max-w-[140px] px-1.5 py-0.5 rounded-md ${
                          isLast
                            ? 'font-bold text-md3-on-surface'
                            : 'hover:text-md3-primary transition-colors'
                        } ${hoveredCrumbId === crumb.id ? 'bg-md3-primary/20 text-md3-primary font-bold ring-1 ring-md3-primary' : ''}`}
                      >
                        {crumb.name}
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <CurrentFolderIcon 
                  className="w-5 h-5 text-md3-primary flex-shrink-0"
                  style={{ color: currentFolder.color || undefined }}
                />
                <h2 className="text-xl font-bold text-md3-on-surface truncate">
                  {currentFolder.name}
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-md3-surface-container-high text-md3-on-surface-variant font-medium">
                  {totalItems} {totalItems === 1 ? 'элемент' : totalItems < 5 ? 'элемента' : 'элементов'}
                </span>
                {onEditFolder && (
                  <button
                    onClick={() => onEditFolder(currentFolder)}
                    title="Настроить значок и цвет"
                    className="p-1.5 rounded-full text-md3-on-surface-variant hover:text-md3-primary hover:bg-md3-surface-container-high transition-colors"
                  >
                    <Palette className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons inside folder */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
            <button
              onClick={() => onCreateFolder(currentFolder.id, currentFolder.groupId)}
              className="flex items-center justify-center gap-1.5 w-9 h-9 sm:w-auto sm:h-auto sm:px-3.5 sm:py-2 rounded-full bg-md3-surface-container-high text-md3-on-surface text-xs font-semibold hover:bg-md3-surface-container-highest shadow-xs transition-all cursor-pointer"
              title={language === 'ru' ? "Создать подпапку" : "Create subfolder"}
            >
              <FolderPlus className="w-4 h-4 text-md3-primary" />
              <span className="hidden sm:inline">{language === 'ru' ? 'Новая подпапка' : 'New Subfolder'}</span>
            </button>
            <button
              onClick={() => onCreatePlaylist(currentFolder.id, currentFolder.groupId)}
              className="flex items-center justify-center gap-1.5 w-9 h-9 sm:w-auto sm:h-auto sm:px-4 sm:py-2 rounded-full bg-md3-primary text-md3-on-primary text-xs font-semibold hover:opacity-90 shadow-md transition-all cursor-pointer"
              title={language === 'ru' ? "Создать плейлист" : "Create playlist"}
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{language === 'ru' ? 'Новый плейлист' : 'New Playlist'}</span>
            </button>
          </div>
        </div>

        {/* Empty state or items grid */}
        {totalItems === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-md3-outline-variant/30 rounded-3xl">
            <CurrentFolderIcon className="w-14 h-14 text-md3-on-surface-variant/30 mb-3" />
            <h3 className="text-base font-bold text-md3-on-surface mb-1">
              В этой папке пока пусто
            </h3>
            <p className="text-xs text-md3-on-surface-variant max-w-sm mb-5">
              Создайте плейлист, добавьте подпапку или перетащите сюда плейлисты из других мест.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => onCreateFolder(currentFolder.id, currentFolder.groupId)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-md3-surface-container-high text-md3-on-surface text-xs font-semibold hover:bg-md3-surface-container-highest transition-colors"
              >
                <FolderPlus className="w-4 h-4 text-md3-primary" />
                <span>Создать подпапку</span>
              </button>
              <button
                onClick={() => onCreatePlaylist(currentFolder.id, currentFolder.groupId)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-md3-primary text-md3-on-primary text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" />
                <span>Создать плейлист</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {getContainerItems(subfoldersInside, playlistsInside, folders, playlists).map(ci =>
              ci.type === 'folder'
                ? renderFolderCard(ci.item as PlaylistFolder)
                : renderPlaylistCard(ci.item as Playlist)
            )}
          </div>
        )}
      </div>
    );
  }

  // ---------------- ROOT VIEW (WITH GROUPS & FOLDERS) ----------------
  const rootFolders = folders.filter((f) => !f.parentId);
  const rootPlaylists = playlists.filter((p) => !p.folderId);

  const ungroupedFolders = rootFolders.filter((f) => !f.groupId);
  const ungroupedPlaylists = rootPlaylists.filter((p) => !p.groupId);
  const hasGroups = groups.length > 0;

  return (
    <div key="playlists-root-view" className={`flex-1 flex flex-col h-full min-h-0 bg-md3-surface p-6 overflow-y-auto custom-scrollbar select-none ${folderNavDirection === 'backward' ? 'anim-view-slide-left' : ''}`}>
      {/* Floating Drag Ghost element */}
      {dragState && dragState.isDragging && (
        <div
          style={{
            left: `${dragState.currentX + 12}px`,
            top: `${dragState.currentY + 12}px`,
          }}
          className="fixed pointer-events-none z-50 flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-md3-surface-container-highest/95 backdrop-blur-md border border-md3-primary shadow-2xl text-xs font-bold text-md3-on-surface scale-105 rotate-2"
        >
          {dragState.cover ? (
            <img src={dragState.cover} alt="" className="w-6 h-6 rounded-lg object-cover" />
          ) : (
            <ListMusic className="w-5 h-5 text-md3-primary" />
          )}
          <span className="truncate max-w-[160px]">{dragState.name}</span>
        </div>
      )}

      {/* Top Bar with Actions */}
      <div className="flex items-center justify-between gap-3 mb-6 pb-4 border-b border-md3-outline-variant/15">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold text-md3-on-surface truncate">
            {language === 'ru' ? 'Плейлисты' : 'Playlists'}
          </h2>
          <p className="text-xs text-md3-on-surface-variant mt-0.5 truncate">
            {playlists.length} {language === 'ru'
              ? (playlists.length === 1 ? 'плейлист' : playlists.length < 5 ? 'плейлиста' : 'плейлистов')
              : (playlists.length === 1 ? 'playlist' : 'playlists')
            }
            {folders.length > 0 && (language === 'ru'
              ? ` • ${folders.length} ${folders.length === 1 ? 'папка' : 'папок'}`
              : ` • ${folders.length} ${folders.length === 1 ? 'folder' : 'folders'}`
            )}
            {groups.length > 0 && (language === 'ru'
              ? ` • ${groups.length} ${groups.length === 1 ? 'группа' : 'групп'}`
              : ` • ${groups.length} ${groups.length === 1 ? 'group' : 'groups'}`
            )}
          </p>
        </div>

        {/* Global Toolbar Buttons */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-auto">
          {/* File & Storage Operations (Disk Location & Import) */}
          {(onOpenPlaylistsFolder || onImportM3U8) && (
            <div className="flex items-center gap-1 p-1 rounded-full bg-md3-surface-container/70 border border-md3-outline-variant/20 shadow-xs">
              {onOpenPlaylistsFolder && (
                <button
                  onClick={onOpenPlaylistsFolder}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-md3-on-surface-variant hover:text-md3-on-surface hover:bg-md3-surface-container-high text-xs font-semibold transition-all cursor-pointer"
                  title={language === 'ru' ? "Открыть расположение плейлистов на диске" : "Open playlists location on disk"}
                >
                  <FolderOpen className="w-3.5 h-3.5 text-md3-primary" />
                  <span className="hidden sm:inline">{language === 'ru' ? 'Положение на диске' : 'Disk Location'}</span>
                </button>
              )}

              {onImportM3U8 && (
                <button
                  onClick={onImportM3U8}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-md3-on-surface-variant hover:text-md3-on-surface hover:bg-md3-surface-container-high text-xs font-semibold transition-all cursor-pointer"
                  title={language === 'ru' ? "Импортировать плейлист (.m3u, .m3u8)" : "Import playlist (.m3u, .m3u8)"}
                >
                  <FileUp className="w-3.5 h-3.5 text-md3-primary" />
                  <span className="hidden sm:inline">{language === 'ru' ? 'Импорт' : 'Import'}</span>
                </button>
              )}
            </div>
          )}

          {/* Visual Divider between File Operations and Creation Actions */}
          {(onOpenPlaylistsFolder || onImportM3U8) && (
            <div className="h-5 w-px bg-md3-outline-variant/30 hidden sm:block" />
          )}

          {/* Creation Actions Group (Group, Folder, Playlist) */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={onCreateGroup}
              className="flex items-center justify-center gap-1.5 w-9 h-9 sm:w-auto sm:h-auto sm:px-3.5 sm:py-2 rounded-full bg-md3-surface-container-high text-md3-on-surface text-xs font-semibold hover:bg-md3-surface-container-highest shadow-xs transition-all cursor-pointer"
              title={language === 'ru' ? "Создать группу плейлистов" : "Create playlist group"}
            >
              <Layers className="w-4 h-4 text-md3-primary" />
              <span className="hidden sm:inline">{language === 'ru' ? 'Новая группа' : 'New Group'}</span>
            </button>

            <button
              onClick={() => onCreateFolder(null, null)}
              className="flex items-center justify-center gap-1.5 w-9 h-9 sm:w-auto sm:h-auto sm:px-3.5 sm:py-2 rounded-full bg-md3-surface-container-high text-md3-on-surface text-xs font-semibold hover:bg-md3-surface-container-highest shadow-xs transition-all cursor-pointer"
              title={language === 'ru' ? "Создать папку" : "Create folder"}
            >
              <FolderPlus className="w-4 h-4 text-md3-primary" />
              <span className="hidden sm:inline">{language === 'ru' ? 'Новая папка' : 'New Folder'}</span>
            </button>

            <button
              onClick={() => onCreatePlaylist(null, null)}
              className="flex items-center justify-center gap-1.5 w-9 h-9 sm:w-auto sm:h-auto sm:px-4 sm:py-2 rounded-full bg-md3-primary text-md3-on-primary text-xs font-semibold hover:opacity-90 shadow-md transition-all cursor-pointer"
              title={language === 'ru' ? "Создать плейлист" : "Create playlist"}
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{language === 'ru' ? 'Новый плейлист' : 'New Playlist'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* GROUPS LIST */}
      {hasGroups && (
        <div className="flex flex-col gap-6 mb-8">
          {groups.map((group, groupIndex) => {
            const groupFolders = rootFolders.filter((f) => f.groupId === group.id);
            const groupPlaylists = rootPlaylists.filter((p) => p.groupId === group.id);
            const totalGroupItems = groupFolders.length + groupPlaylists.length;
            const isCollapsed = !!group.isCollapsed;
            const isGroupHovered = hoveredGroupId === group.id;
            const isTargetGroup = dropTargetGroup?.id === group.id;

            const groupColor = group.color ? getFolderColorHex(group.color) : undefined;
            const groupHeaderBg = group.color ? getFolderColorRgba(group.color, 0.14) : undefined;
            const groupBorderColor = group.color ? getFolderColorRgba(group.color, 0.35) : undefined;

            return (
              <div
                key={group.id}
                data-group-id={group.id}
                style={groupBorderColor ? { borderColor: groupBorderColor } : undefined}
                className={`relative rounded-3xl border transition-all duration-150 overflow-hidden ${
                  isGroupHovered || isTargetGroup
                    ? 'ring-2 ring-md3-primary border-md3-primary bg-md3-primary/5 shadow-md'
                    : 'border-md3-outline-variant/20 bg-md3-surface-container-lowest/50'
                }`}
              >
                {/* Visual indicator for group reordering */}
                {isTargetGroup && dropTargetGroup.position === 'before' && (
                  <div className="absolute top-0 left-4 right-4 h-1 bg-md3-primary rounded-full z-30 shadow-md" />
                )}
                {isTargetGroup && dropTargetGroup.position === 'after' && (
                  <div className="absolute bottom-0 left-4 right-4 h-1 bg-md3-primary rounded-full z-30 shadow-md" />
                )}

                {/* Group Header (Collapsible & Draggable via pointer) */}
                <div
                  data-group-header-id={group.id}
                  onPointerDown={(e) => {
                    handlePointerDown(e, {
                      type: 'group',
                      id: group.id,
                      name: group.name,
                    });
                  }}
                  onClick={() => {
                    if (!dragState?.isDragging) {
                      onToggleGroupCollapse(group.id);
                    }
                  }}
                  style={groupHeaderBg ? { backgroundColor: groupHeaderBg } : undefined}
                  className="w-full flex items-center justify-between px-4 py-3 bg-md3-surface-container/60 hover:bg-md3-surface-container cursor-pointer transition-colors touch-none"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pointer-events-none">
                    <button
                      type="button"
                      className="p-1 rounded-full text-md3-on-surface-variant hover:text-md3-on-surface transition-transform pointer-events-auto"
                    >
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                          isCollapsed ? '-rotate-90 text-md3-on-surface-variant' : 'rotate-0 text-md3-primary'
                        }`}
                      />
                    </button>
                    <GripVertical className="w-3.5 h-3.5 text-md3-on-surface-variant/40" />
                    <Layers
                      className="w-4 h-4 flex-shrink-0"
                      style={{ color: groupColor || 'var(--md-sys-color-primary)' }}
                    />
                    <h3
                      className="font-bold text-sm text-md3-on-surface truncate"
                      style={groupColor ? { color: groupColor } : undefined}
                    >
                      {group.name}
                    </h3>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-md3-surface-container-highest text-md3-on-surface-variant font-medium">
                      {totalGroupItems}
                    </span>
                    {group.isIsolated && (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30 font-medium flex items-center gap-1 shrink-0"
                        title={language === 'ru' ? 'Изолированный контейнер: треки скрыты из общего списка библиотеки' : 'Isolated container: tracks are hidden from global library'}
                      >
                        <ShieldAlert className="w-3 h-3" />
                        <span>{language === 'ru' ? 'Изолированная' : 'Isolated'}</span>
                      </span>
                    )}
                  </div>

                  {/* Group Quick Actions (Reorder Up/Down, Add, Edit, Delete) */}
                  <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                    {/* Up / Down Move Buttons */}
                    {onMoveGroup && (
                      <div className="flex items-center bg-md3-surface-container-highest/60 rounded-full p-0.5 mr-1 border border-md3-outline-variant/20">
                        <button
                          disabled={groupIndex === 0}
                          onClick={() => onMoveGroup(group.id, 'up')}
                          title="Переместить группу выше"
                          className="p-1 rounded-full text-md3-on-surface-variant hover:text-md3-primary disabled:opacity-25 disabled:pointer-events-none transition-colors"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          disabled={groupIndex === groups.length - 1}
                          onClick={() => onMoveGroup(group.id, 'down')}
                          title="Переместить группу ниже"
                          className="p-1 rounded-full text-md3-on-surface-variant hover:text-md3-primary disabled:opacity-25 disabled:pointer-events-none transition-colors"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() => onCreatePlaylist(null, group.id)}
                      title="Добавить плейлист в эту группу"
                      className="p-1.5 rounded-full text-md3-on-surface-variant hover:text-md3-primary hover:bg-md3-surface-container-highest transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onCreateFolder(null, group.id)}
                      title="Добавить папку в эту группу"
                      className="p-1.5 rounded-full text-md3-on-surface-variant hover:text-md3-primary hover:bg-md3-surface-container-highest transition-colors"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onEditGroup ? onEditGroup(group) : onRenameGroup(group)}
                      title={language === 'ru' ? 'Настройки группы (цвет, изоляция, название)' : 'Group settings (color, isolation, name)'}
                      className="p-1.5 rounded-full text-md3-on-surface-variant hover:text-md3-primary hover:bg-md3-surface-container-highest transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteGroup(group.id)}
                      title="Удалить группу (элементы сохранятся)"
                      className="p-1.5 rounded-full text-md3-on-surface-variant hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Animated Collapsible Group Content Grid */}
                <div
                  className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                    isCollapsed
                      ? 'grid-rows-[0fr] opacity-0 pointer-events-none'
                      : 'grid-rows-[1fr] opacity-100'
                  }`}
                >
                  <div className="overflow-hidden border-t border-md3-outline-variant/15">
                    <div className="p-4">
                      {totalGroupItems === 0 ? (
                        <div className="py-6 text-center text-xs text-md3-on-surface-variant/60 border border-dashed border-md3-outline-variant/20 rounded-2xl">
                          {language === 'ru'
                            ? 'Перетащите сюда плейлисты или папки, либо нажмите «+» для создания.'
                            : 'Drag playlists or folders here, or click "+" to create.'}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                          {getContainerItems(groupFolders, groupPlaylists, folders, playlists).map(ci =>
                            ci.type === 'folder'
                              ? renderFolderCard(ci.item as PlaylistFolder)
                              : renderPlaylistCard(ci.item as Playlist)
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* UNGROUPED ITEMS (or ALL items if no groups exist) */}
      {(ungroupedFolders.length > 0 || ungroupedPlaylists.length > 0 || !hasGroups) && (
        <div
          data-group-id="ungrouped"
          className={`flex-1 flex flex-col ${
            hoveredGroupId === 'ungrouped'
              ? 'ring-2 ring-md3-primary rounded-3xl p-3 bg-md3-primary/5'
              : ''
          }`}
        >
          {hasGroups && (
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-md3-on-surface-variant/70">
                {language === 'ru' ? 'Общие плейлисты и папки' : 'General Playlists and Folders'}
              </h3>
              <span className="text-[11px] px-2 py-0.2 rounded-full bg-md3-surface-container-high text-md3-on-surface-variant font-medium">
                {ungroupedFolders.length + ungroupedPlaylists.length}
              </span>
            </div>
          )}

          {ungroupedFolders.length === 0 && ungroupedPlaylists.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-md3-outline-variant/20 rounded-3xl">
              <ListMusic className="w-12 h-12 text-md3-on-surface-variant/30 mx-auto mb-3" />
              <p className="text-sm font-semibold text-md3-on-surface mb-1">
                Плейлистов пока нет
              </p>
              <p className="text-xs text-md3-on-surface-variant mb-4">
                Создайте первый плейлист или папку для вашей медиатеки
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => onCreateFolder(null, null)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-md3-surface-container-high text-md3-on-surface text-xs font-semibold hover:bg-md3-surface-container-highest"
                >
                  <FolderPlus className="w-4 h-4 text-md3-primary" />
                  <span>Папка</span>
                </button>
                <button
                  onClick={() => onCreatePlaylist(null, null)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-md3-primary text-md3-on-primary text-xs font-semibold hover:opacity-90"
                >
                  <Plus className="w-4 h-4" />
                  <span>Плейлист</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {getContainerItems(ungroupedFolders, ungroupedPlaylists, folders, playlists).map(ci =>
                ci.type === 'folder'
                  ? renderFolderCard(ci.item as PlaylistFolder)
                  : renderPlaylistCard(ci.item as Playlist)
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
