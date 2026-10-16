import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Play, 
  ListPlus, 
  CornerDownRight, 
  Edit3, 
  Heart, 
  FolderPlus, 
  Trash,
  Trash2,
  Info,
  FolderSearch,
  RotateCw,
  ChevronRight,
  Plus,
  Folder,
  Layers,
  ListMusic
} from 'lucide-react';
import { Track, Playlist, PlaylistFolder, PlaylistGroup } from '../types/music';
import { AppLanguage } from '../i18n';

interface ContextMenuProps {
  x: number;
  y: number;
  track: Track;
  selectedTrackIds: Set<string>;
  playlists: Playlist[];
  folders?: PlaylistFolder[];
  groups?: PlaylistGroup[];
  language?: AppLanguage;
  onClose: () => void;
  onPlay: (track: Track) => void;
  onAddToQueue: (tracks: Track[]) => void;
  onPlayNext: (tracks: Track[]) => void;
  onOpenTagEditor: () => void;
  onToggleFavorite: (trackId: string) => void;
  onAddToPlaylist: (playlistId: string, trackIds: string[]) => void;
  onCreatePlaylistWithTracks?: (trackIds: string[]) => void;
  onRemoveTracks: (trackIds: string[]) => void;
  onDeleteFromDisk?: (trackIds: string[]) => void;
  onOpenTrackDetails?: (track: Track) => void;
  onRelocateTrack?: (track: Track) => void;
  onReloadTracks?: (trackIds: string[]) => void;
}

// ---------------------------------------------------------------------------
// Reusable Flyout Menu Container with Screen-Boundary Aware Positioning
// Rendered via Portal with an invisible hover bridge to prevent lost hover
// ---------------------------------------------------------------------------
interface FlyoutMenuProps {
  anchorEl: HTMLElement | null;
  isOpen: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  children: React.ReactNode;
  width?: number;
}

const FlyoutMenu: React.FC<FlyoutMenuProps> = ({
  anchorEl,
  isOpen,
  onMouseEnter,
  onMouseLeave,
  children,
  width = 230,
}) => {
  const flyoutRef = useRef<HTMLDivElement>(null);
  const [isFlippedLeft, setIsFlippedLeft] = useState(false);

  // Initialize position directly next to anchorEl instead of (0, 0)
  const calcInitialPos = () => {
    if (!anchorEl) return { top: 0, left: 0, flipped: false };
    const anchorRect = anchorEl.getBoundingClientRect();
    const margin = 8;
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const estimatedHeight = 220;

    let left = anchorRect.right - 2;
    let flipped = false;
    if (left + width > winW - margin) {
      left = anchorRect.left - width + 2;
      flipped = true;
    }
    if (left < margin) left = margin;

    let top = anchorRect.top - 4;
    if (top + estimatedHeight > winH - margin) {
      top = Math.max(margin, winH - estimatedHeight - margin);
    }
    if (top < margin) top = margin;

    return { top, left, flipped };
  };

  const [pos, setPos] = useState(calcInitialPos);
  const [isPositioned, setIsPositioned] = useState(false);

  useLayoutEffect(() => {
    if (!isOpen || !anchorEl || !flyoutRef.current) return;
    const anchorRect = anchorEl.getBoundingClientRect();
    const flyoutRect = flyoutRef.current.getBoundingClientRect();
    const margin = 8;
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    let left = anchorRect.right - 2;
    let flipped = false;
    if (left + flyoutRect.width > winW - margin) {
      left = anchorRect.left - flyoutRect.width + 2;
      flipped = true;
    }
    if (left < margin) left = margin;
    if (left + flyoutRect.width > winW - margin) {
      left = Math.max(margin, winW - flyoutRect.width - margin);
    }

    let top = anchorRect.top - 4;
    if (top + flyoutRect.height > winH - margin) {
      top = Math.max(margin, winH - flyoutRect.height - margin);
    }
    if (top < margin) top = margin;

    setIsFlippedLeft(flipped);
    setPos({ top, left, flipped });
    setIsPositioned(true);
  }, [isOpen, anchorEl]);

  if (!isOpen || !anchorEl) return null;

  return createPortal(
    <div
      ref={flyoutRef}
      style={{ 
        left: `${pos.left}px`, 
        top: `${pos.top}px`, 
        width: `${width}px`,
        opacity: isPositioned ? 1 : 0,
        pointerEvents: isPositioned ? 'auto' : 'none',
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`fixed z-[60] bg-md3-surface-container-highest rounded-2xl shadow-2xl border border-md3-outline-variant/40 py-1.5 text-xs select-none max-h-[min(380px,calc(100vh-24px))] overflow-y-auto custom-scrollbar ${
        isPositioned ? 'animate-in fade-in zoom-in-95 duration-100' : ''
      }`}
    >
      {/* Invisible hover bridge to eliminate gap between anchor button and flyout menu */}
      <div 
        className="absolute top-0 bottom-0 pointer-events-auto"
        style={isFlippedLeft ? { right: '-12px', width: '14px' } : { left: '-12px', width: '14px' }}
      />
      {children}
    </div>,
    document.body
  );
};

// ---------------------------------------------------------------------------
// Recursive Folder Flyout Submenu
// ---------------------------------------------------------------------------
interface FolderFlyoutProps {
  folder: PlaylistFolder;
  anchorEl: HTMLElement | null;
  isOpen: boolean;
  folders: PlaylistFolder[];
  playlists: Playlist[];
  targetIds: string[];
  language: AppLanguage;
  onAddToPlaylist: (playlistId: string, trackIds: string[]) => void;
  onClose: () => void;
  onParentMouseEnter?: () => void;
  onParentMouseLeave?: () => void;
}

const FolderFlyout: React.FC<FolderFlyoutProps> = ({
  folder,
  anchorEl,
  isOpen,
  folders,
  playlists,
  targetIds,
  language,
  onAddToPlaylist,
  onClose,
  onParentMouseEnter,
  onParentMouseLeave,
}) => {
  const [activeSubfolderId, setActiveSubfolderId] = useState<string | null>(null);
  const subfolderRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const timerRef = useRef<any>(null);

  const subfolders = folders.filter((f) => f.parentId === folder.id);
  const folderPlaylists = playlists.filter((p) => p.folderId === folder.id && !p.isSystem);

  const handleSubfolderEnter = (id: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setActiveSubfolderId(id);
    }, 80);
    onParentMouseEnter?.();
  };

  const handleLeafEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setActiveSubfolderId(null);
    }, 200);
    onParentMouseEnter?.();
  };

  const handleContainerLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setActiveSubfolderId(null);
    }, 260);
    onParentMouseLeave?.();
  };

  const handleContainerEnter = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    onParentMouseEnter?.();
  };

  const isEmpty = subfolders.length === 0 && folderPlaylists.length === 0;

  return (
    <FlyoutMenu
      anchorEl={anchorEl}
      isOpen={isOpen}
      onMouseEnter={handleContainerEnter}
      onMouseLeave={handleContainerLeave}
    >
      {isEmpty && (
        <div className="px-3.5 py-2 text-md3-on-surface-variant/60 italic text-center">
          {language === 'ru' ? 'Папка пуста' : 'Folder is empty'}
        </div>
      )}

      {/* Subfolders */}
      {subfolders.map((sf) => (
        <React.Fragment key={sf.id}>
          <button
            ref={(el) => { subfolderRefs.current[sf.id] = el; }}
            onMouseEnter={() => handleSubfolderEnter(sf.id)}
            className={`w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors cursor-pointer ${
              activeSubfolderId === sf.id 
                ? 'bg-md3-surface-container text-md3-primary font-semibold' 
                : 'text-md3-on-surface hover:bg-md3-surface-container'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Folder 
                className="w-3.5 h-3.5 shrink-0" 
                style={{ color: sf.color && sf.color !== 'default' ? sf.color : undefined }} 
              />
              <span className="truncate">{sf.name}</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 opacity-60 shrink-0 ml-1.5" />
          </button>

          {activeSubfolderId === sf.id && subfolderRefs.current[sf.id] && (
            <FolderFlyout
              folder={sf}
              anchorEl={subfolderRefs.current[sf.id]}
              isOpen={true}
              folders={folders}
              playlists={playlists}
              targetIds={targetIds}
              language={language}
              onAddToPlaylist={onAddToPlaylist}
              onClose={onClose}
              onParentMouseEnter={handleContainerEnter}
              onParentMouseLeave={handleContainerLeave}
            />
          )}
        </React.Fragment>
      ))}

      {/* Playlists in Folder */}
      {folderPlaylists.map((pl) => (
        <button
          key={pl.id}
          onMouseEnter={handleLeafEnter}
          onClick={() => {
            onAddToPlaylist(pl.id, targetIds);
            onClose();
          }}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-md3-on-surface hover:bg-md3-surface-container transition-colors text-left truncate cursor-pointer"
        >
          <ListMusic className="w-3.5 h-3.5 text-md3-primary/80 shrink-0" />
          <span className="truncate">{pl.name}</span>
        </button>
      ))}
    </FlyoutMenu>
  );
};

// ---------------------------------------------------------------------------
// Group Flyout Submenu
// ---------------------------------------------------------------------------
interface GroupFlyoutProps {
  group: PlaylistGroup;
  anchorEl: HTMLElement | null;
  isOpen: boolean;
  folders: PlaylistFolder[];
  playlists: Playlist[];
  targetIds: string[];
  language: AppLanguage;
  onAddToPlaylist: (playlistId: string, trackIds: string[]) => void;
  onClose: () => void;
  onParentMouseEnter?: () => void;
  onParentMouseLeave?: () => void;
}

const GroupFlyout: React.FC<GroupFlyoutProps> = ({
  group,
  anchorEl,
  isOpen,
  folders,
  playlists,
  targetIds,
  language,
  onAddToPlaylist,
  onClose,
  onParentMouseEnter,
  onParentMouseLeave,
}) => {
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const folderRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const timerRef = useRef<any>(null);

  const groupFolders = folders.filter((f) => f.groupId === group.id && !f.parentId);
  const groupPlaylists = playlists.filter((p) => p.groupId === group.id && !p.folderId && !p.isSystem);

  const handleFolderEnter = (id: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setActiveFolderId(id);
    }, 80);
    onParentMouseEnter?.();
  };

  const handleLeafEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setActiveFolderId(null);
    }, 200);
    onParentMouseEnter?.();
  };

  const handleContainerLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setActiveFolderId(null);
    }, 260);
    onParentMouseLeave?.();
  };

  const handleContainerEnter = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    onParentMouseEnter?.();
  };

  const isEmpty = groupFolders.length === 0 && groupPlaylists.length === 0;

  return (
    <FlyoutMenu
      anchorEl={anchorEl}
      isOpen={isOpen}
      onMouseEnter={handleContainerEnter}
      onMouseLeave={handleContainerLeave}
    >
      {isEmpty && (
        <div className="px-3.5 py-2 text-md3-on-surface-variant/60 italic text-center">
          {language === 'ru' ? 'Группа пуста' : 'Group is empty'}
        </div>
      )}

      {/* Folders in this Group */}
      {groupFolders.map((fld) => (
        <React.Fragment key={fld.id}>
          <button
            ref={(el) => { folderRefs.current[fld.id] = el; }}
            onMouseEnter={() => handleFolderEnter(fld.id)}
            className={`w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors cursor-pointer ${
              activeFolderId === fld.id 
                ? 'bg-md3-surface-container text-md3-primary font-semibold' 
                : 'text-md3-on-surface hover:bg-md3-surface-container'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Folder 
                className="w-3.5 h-3.5 shrink-0" 
                style={{ color: fld.color && fld.color !== 'default' ? fld.color : undefined }} 
              />
              <span className="truncate">{fld.name}</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 opacity-60 shrink-0 ml-1.5" />
          </button>

          {activeFolderId === fld.id && folderRefs.current[fld.id] && (
            <FolderFlyout
              folder={fld}
              anchorEl={folderRefs.current[fld.id]}
              isOpen={true}
              folders={folders}
              playlists={playlists}
              targetIds={targetIds}
              language={language}
              onAddToPlaylist={onAddToPlaylist}
              onClose={onClose}
              onParentMouseEnter={handleContainerEnter}
              onParentMouseLeave={handleContainerLeave}
            />
          )}
        </React.Fragment>
      ))}

      {/* Direct Playlists in this Group */}
      {groupPlaylists.map((pl) => (
        <button
          key={pl.id}
          onMouseEnter={handleLeafEnter}
          onClick={() => {
            onAddToPlaylist(pl.id, targetIds);
            onClose();
          }}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-md3-on-surface hover:bg-md3-surface-container transition-colors text-left truncate cursor-pointer"
        >
          <ListMusic className="w-3.5 h-3.5 text-md3-primary/80 shrink-0" />
          <span className="truncate">{pl.name}</span>
        </button>
      ))}
    </FlyoutMenu>
  );
};

// ---------------------------------------------------------------------------
// Main Track Context Menu
// ---------------------------------------------------------------------------
export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  track,
  selectedTrackIds,
  playlists,
  folders = [],
  groups = [],
  language = 'ru',
  onClose,
  onPlay,
  onAddToQueue,
  onPlayNext,
  onOpenTagEditor,
  onToggleFavorite,
  onAddToPlaylist,
  onCreatePlaylistWithTracks,
  onRemoveTracks,
  onDeleteFromDisk,
  onOpenTrackDetails,
  onRelocateTrack,
  onReloadTracks,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const addToPlaylistBtnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: y, left: x });

  // Cascading Add to Playlist state
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const groupRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const rootFolderRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  
  // Safe grace timers for smooth mouse travel
  const addMenuCloseTimerRef = useRef<any>(null);
  const subMenuTimerRef = useRef<any>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Viewport-aware layout positioning: flip up / left if near screen borders
  useLayoutEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const margin = 12;
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    let left = x;
    let top = y;

    // Horizontal check
    if (left + rect.width > winW - margin) {
      const leftward = left - rect.width;
      left = leftward >= margin ? leftward : Math.max(margin, winW - rect.width - margin);
    }

    // Vertical check: flip upward if overflowing below
    if (top + rect.height > winH - margin) {
      const upwardTop = top - rect.height;
      if (upwardTop >= margin) {
        top = upwardTop;
      } else {
        top = Math.max(margin, winH - rect.height - margin);
      }
    }

    setPos({ top, left });
  }, [x, y]);

  const targetIds = selectedTrackIds.has(track.id)
    ? Array.from(selectedTrackIds)
    : [track.id];

  const userPlaylists = playlists.filter((p) => !p.isSystem && p.id !== 'pl_favorites');
  const rootFolders = folders.filter((f) => !f.groupId && !f.parentId);
  const rootPlaylists = userPlaylists.filter((p) => !p.groupId && !p.folderId);

  // Safe hover handlers for "Добавить в плейлист"
  const handleAddToPlaylistEnter = () => {
    if (addMenuCloseTimerRef.current) {
      clearTimeout(addMenuCloseTimerRef.current);
      addMenuCloseTimerRef.current = null;
    }
    setIsAddMenuOpen(true);
  };

  const handleAddToPlaylistLeave = () => {
    if (addMenuCloseTimerRef.current) clearTimeout(addMenuCloseTimerRef.current);
    addMenuCloseTimerRef.current = setTimeout(() => {
      setIsAddMenuOpen(false);
      setActiveGroupId(null);
      setActiveFolderId(null);
    }, 280);
  };

  const handleAddMenuContainerEnter = () => {
    if (addMenuCloseTimerRef.current) {
      clearTimeout(addMenuCloseTimerRef.current);
      addMenuCloseTimerRef.current = null;
    }
  };

  // Graceful hover handler for parent menu buttons:
  // Delays closing the submenu by 280ms so diagonal mouse travel into the flyout is never interrupted
  const handleParentLeafItemEnter = () => {
    if (addMenuCloseTimerRef.current) clearTimeout(addMenuCloseTimerRef.current);
    addMenuCloseTimerRef.current = setTimeout(() => {
      setIsAddMenuOpen(false);
      setActiveGroupId(null);
      setActiveFolderId(null);
    }, 280);
  };

  // Sub-items inside Add to Playlist menu
  const handleGroupEnter = (id: string) => {
    if (subMenuTimerRef.current) clearTimeout(subMenuTimerRef.current);
    subMenuTimerRef.current = setTimeout(() => {
      setActiveFolderId(null);
      setActiveGroupId(id);
    }, 80);
    handleAddMenuContainerEnter();
  };

  const handleRootFolderEnter = (id: string) => {
    if (subMenuTimerRef.current) clearTimeout(subMenuTimerRef.current);
    subMenuTimerRef.current = setTimeout(() => {
      setActiveGroupId(null);
      setActiveFolderId(id);
    }, 80);
    handleAddMenuContainerEnter();
  };

  const handleAddMenuLeafEnter = () => {
    if (subMenuTimerRef.current) clearTimeout(subMenuTimerRef.current);
    subMenuTimerRef.current = setTimeout(() => {
      setActiveGroupId(null);
      setActiveFolderId(null);
    }, 200);
    handleAddMenuContainerEnter();
  };

  return (
    <>
      <div
        ref={menuRef}
        style={{ left: `${pos.left}px`, top: `${pos.top}px` }}
        className="fixed z-50 w-56 bg-md3-surface-container-highest rounded-2xl shadow-2xl border border-md3-outline-variant/40 py-1.5 text-xs select-none animate-in fade-in zoom-in-95 duration-100 max-h-[calc(100vh-24px)] overflow-y-auto custom-scrollbar"
      >
        <div className="px-3 py-1.5 text-[11px] font-bold text-md3-on-surface-variant/80 border-b border-md3-outline-variant/20 truncate">
          {targetIds.length > 1 
            ? (language === 'ru' ? `Выбрано: ${targetIds.length} треков` : `Selected: ${targetIds.length} tracks`)
            : track.title
          }
        </div>

        {/* Play Now */}
        <button
          onMouseEnter={handleParentLeafItemEnter}
          onClick={() => {
            onPlay(track);
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-md3-on-surface hover:bg-md3-primary hover:text-md3-on-primary transition-colors text-left cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{language === 'ru' ? 'Воспроизвести сейчас' : 'Play Now'}</span>
        </button>

        {/* Play Next */}
        <button
          onMouseEnter={handleParentLeafItemEnter}
          onClick={() => {
            onPlayNext([track]);
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-md3-on-surface hover:bg-md3-surface-container transition-colors text-left cursor-pointer"
        >
          <CornerDownRight className="w-3.5 h-3.5 text-md3-primary" />
          <span>{language === 'ru' ? 'Слушать следующим' : 'Play Next'}</span>
        </button>

        {/* Add to Queue */}
        <button
          onMouseEnter={handleParentLeafItemEnter}
          onClick={() => {
            onAddToQueue([track]);
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-md3-on-surface hover:bg-md3-surface-container transition-colors text-left cursor-pointer"
        >
          <ListPlus className="w-3.5 h-3.5 text-md3-primary" />
          <span>{language === 'ru' ? 'Добавить в очередь' : 'Add to Queue'}</span>
        </button>

        {/* Add to Playlist Cascading Trigger */}
        <button
          ref={addToPlaylistBtnRef}
          onMouseEnter={handleAddToPlaylistEnter}
          onMouseLeave={handleAddToPlaylistLeave}
          className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors cursor-pointer ${
            isAddMenuOpen
              ? 'bg-md3-surface-container text-md3-primary font-semibold'
              : 'text-md3-on-surface hover:bg-md3-surface-container'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <FolderPlus className="w-3.5 h-3.5 text-md3-primary shrink-0" />
            <span className="truncate">{language === 'ru' ? 'Добавить в плейлист' : 'Add to Playlist'}</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 opacity-60 shrink-0 ml-1.5" />
        </button>

        {/* Batch Tag Editor & Details */}
        <div className="border-t border-md3-outline-variant/20 my-1 pt-1">
          {onOpenTrackDetails && (
            <button
              onMouseEnter={handleParentLeafItemEnter}
              onClick={() => {
                onOpenTrackDetails(track);
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-md3-on-surface hover:bg-md3-surface-container transition-colors text-left cursor-pointer"
            >
              <Info className="w-3.5 h-3.5 text-md3-primary" />
              <span>{language === 'ru' ? 'Сведения о треке' : 'Track Details'}</span>
            </button>
          )}

          {onReloadTracks && (
            <button
              onMouseEnter={handleParentLeafItemEnter}
              onClick={() => {
                onReloadTracks(targetIds);
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-md3-on-surface hover:bg-md3-surface-container transition-colors text-left cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5 text-md3-primary" />
              <span>
                {language === 'ru' 
                  ? (targetIds.length > 1 ? `Перечитать файлы (${targetIds.length})` : 'Перечитать из файла')
                  : (targetIds.length > 1 ? `Reload from files (${targetIds.length})` : 'Reload from file')
              }
              </span>
            </button>
          )}

          <button
            onMouseEnter={handleParentLeafItemEnter}
            onClick={() => {
              onOpenTagEditor();
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-md3-on-surface hover:bg-md3-surface-container transition-colors text-left font-medium text-md3-primary cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>
              {selectedTrackIds.size > 1 
                ? (language === 'ru' ? `Пакетная правка тегов (${selectedTrackIds.size})` : `Batch Edit Tags (${selectedTrackIds.size})`)
                : (language === 'ru' ? 'Редактировать теги' : 'Edit Tags')
              }
            </span>
          </button>

          {/* Favorite */}
          <button
            onMouseEnter={handleParentLeafItemEnter}
            onClick={() => {
              onToggleFavorite(track.id);
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-md3-on-surface hover:bg-md3-surface-container transition-colors text-left cursor-pointer"
          >
            <Heart className={`w-3.5 h-3.5 ${track.isFavorite ? 'fill-red-500 text-red-500' : 'text-md3-on-surface-variant'}`} />
            <span>
              {track.isFavorite 
                ? (language === 'ru' ? 'Удалить из избранного' : 'Remove from Favorites')
                : (language === 'ru' ? 'В избранное' : 'Add to Favorites')
              }
            </span>
          </button>

          {/* Relocate Track (Указать путь к файлу вручную) */}
          {onRelocateTrack && (
            <button
              onMouseEnter={handleParentLeafItemEnter}
              onClick={() => {
                onRelocateTrack(track);
                onClose();
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-left cursor-pointer transition-colors ${
                track.isMissing 
                  ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 font-semibold' 
                  : 'text-md3-on-surface hover:bg-md3-surface-container'
              }`}
            >
              <FolderSearch className="w-3.5 h-3.5 shrink-0" />
              <span>
                {language === 'ru' ? 'Указать путь к файлу...' : 'Relocate track file...'}
              </span>
            </button>
          )}

          {/* Remove from playlist / library */}
          <button
            onMouseEnter={handleParentLeafItemEnter}
            onClick={() => {
              onRemoveTracks(targetIds);
              onClose();
            }}
            className="w-full flex items-center justify-between px-3 py-2 text-md3-on-surface hover:bg-md3-surface-container transition-colors text-left cursor-pointer group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Trash2 className="w-3.5 h-3.5 text-md3-on-surface-variant" />
              <span className="truncate">
                {language === 'ru' 
                  ? `Удалить трек${targetIds.length > 1 ? 'и' : ''}`
                  : `Remove track${targetIds.length > 1 ? 's' : ''}`
                }
              </span>
            </div>
            <span className="text-[10px] text-md3-on-surface-variant/60 font-mono tracking-tight shrink-0 ml-2">
              Del
            </span>
          </button>

          {/* Delete from Disk */}
          {onDeleteFromDisk && (
            <button
              onMouseEnter={handleParentLeafItemEnter}
              onClick={() => {
                onDeleteFromDisk(targetIds);
                onClose();
              }}
              className="w-full flex items-center justify-between px-3 py-2 text-red-500 hover:bg-red-500/10 transition-colors text-left cursor-pointer group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Trash className="w-3.5 h-3.5 text-red-500" />
                <span className="truncate font-medium">
                  {language === 'ru' 
                    ? 'Удалить с диска...' 
                    : 'Delete from disk...'
                  }
                </span>
              </div>
              <span className="text-[10px] text-red-400/80 font-mono tracking-tight shrink-0 ml-2">
                Shift+Del
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Cascading Submenu: "Добавить в плейлист" */}
      <FlyoutMenu
        anchorEl={addToPlaylistBtnRef.current}
        isOpen={isAddMenuOpen}
        onMouseEnter={handleAddMenuContainerEnter}
        onMouseLeave={handleAddToPlaylistLeave}
        width={230}
      >
        {/* Quick New Playlist Action */}
        {onCreatePlaylistWithTracks && (
          <button
            onMouseEnter={handleAddMenuLeafEnter}
            onClick={() => {
              onCreatePlaylistWithTracks(targetIds);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-md3-primary font-semibold hover:bg-md3-surface-container text-left transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{language === 'ru' ? 'Новый плейлист...' : 'New Playlist...'}</span>
          </button>
        )}

        <div className="border-t border-md3-outline-variant/20 my-1" />

        {/* Groups */}
        {groups.map((grp) => (
          <React.Fragment key={grp.id}>
            <button
              ref={(el) => { groupRefs.current[grp.id] = el; }}
              onMouseEnter={() => handleGroupEnter(grp.id)}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors cursor-pointer ${
                activeGroupId === grp.id 
                  ? 'bg-md3-surface-container text-md3-primary font-semibold' 
                  : 'text-md3-on-surface hover:bg-md3-surface-container'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Layers 
                  className="w-3.5 h-3.5 shrink-0" 
                  style={{ color: grp.color || undefined }} 
                />
                <span className="truncate">{grp.name}</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-60 shrink-0 ml-1.5" />
            </button>

            {activeGroupId === grp.id && groupRefs.current[grp.id] && (
              <GroupFlyout
                group={grp}
                anchorEl={groupRefs.current[grp.id]}
                isOpen={true}
                folders={folders}
                playlists={userPlaylists}
                targetIds={targetIds}
                language={language}
                onAddToPlaylist={onAddToPlaylist}
                onClose={onClose}
                onParentMouseEnter={handleAddMenuContainerEnter}
                onParentMouseLeave={handleAddToPlaylistLeave}
              />
            )}
          </React.Fragment>
        ))}

        {/* Root Folders */}
        {rootFolders.map((fld) => (
          <React.Fragment key={fld.id}>
            <button
              ref={(el) => { rootFolderRefs.current[fld.id] = el; }}
              onMouseEnter={() => handleRootFolderEnter(fld.id)}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors cursor-pointer ${
                activeFolderId === fld.id 
                  ? 'bg-md3-surface-container text-md3-primary font-semibold' 
                  : 'text-md3-on-surface hover:bg-md3-surface-container'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Folder 
                  className="w-3.5 h-3.5 shrink-0" 
                  style={{ color: fld.color && fld.color !== 'default' ? fld.color : undefined }} 
                />
                <span className="truncate">{fld.name}</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-60 shrink-0 ml-1.5" />
            </button>

            {activeFolderId === fld.id && rootFolderRefs.current[fld.id] && (
              <FolderFlyout
                folder={fld}
                anchorEl={rootFolderRefs.current[fld.id]}
                isOpen={true}
                folders={folders}
                playlists={userPlaylists}
                targetIds={targetIds}
                language={language}
                onAddToPlaylist={onAddToPlaylist}
                onClose={onClose}
                onParentMouseEnter={handleAddMenuContainerEnter}
                onParentMouseLeave={handleAddToPlaylistLeave}
              />
            )}
          </React.Fragment>
        ))}

        {/* Root Playlists */}
        {rootPlaylists.map((pl) => (
          <button
            key={pl.id}
            onMouseEnter={handleAddMenuLeafEnter}
            onClick={() => {
              onAddToPlaylist(pl.id, targetIds);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-md3-on-surface hover:bg-md3-surface-container transition-colors text-left truncate cursor-pointer"
          >
            <ListMusic className="w-3.5 h-3.5 text-md3-primary/80 shrink-0" />
            <span className="truncate">{pl.name}</span>
          </button>
        ))}

        {groups.length === 0 && rootFolders.length === 0 && rootPlaylists.length === 0 && (
          <div className="px-3.5 py-2 text-md3-on-surface-variant/60 italic text-center">
            {language === 'ru' ? 'Нет других плейлистов' : 'No playlists'}
          </div>
        )}
      </FlyoutMenu>
    </>
  );
};
