import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Play, 
  ListPlus, 
  Edit3, 
  Trash2, 
  ListX, 
  Folder, 
  FolderSymlink, 
  Layers, 
  Download, 
  Palette, 
  ChevronRight, 
  Check 
} from 'lucide-react';
import { Playlist, PlaylistFolder, PlaylistGroup, Track } from '../types/music';
import { getFolderIconComponent } from '../theme/folderIcons';
import { AppLanguage } from '../i18n';

interface PlaylistContextMenuProps {
  x: number;
  y: number;
  playlist: Playlist;
  tracks?: Track[];
  folders?: PlaylistFolder[];
  groups?: PlaylistGroup[];
  language?: AppLanguage;
  onClose: () => void;
  onPlay: (playlist: Playlist) => void;
  onAddToQueue: (playlist: Playlist) => void;
  onRename: (playlist: Playlist) => void;
  onEditPlaylist?: (playlist: Playlist) => void;
  onClear: (playlist: Playlist) => void;
  onDelete: (playlist: Playlist) => void;
  onExportM3U8?: (playlist: Playlist) => void;
  onMoveToFolder?: (playlistId: string, folderId: string | null) => void;
  onMoveToGroup?: (playlistId: string, groupId: string | null) => void;
}

// ---------------------------------------------------------------------------
// Position calculators
// ---------------------------------------------------------------------------
const getInitialMenuPosition = (x: number, y: number, menuWidth = 224, estimatedHeight = 320) => {
  const margin = 12;
  const winW = typeof window !== 'undefined' ? window.innerWidth : 1000;
  const winH = typeof window !== 'undefined' ? window.innerHeight : 800;

  let left = x;
  if (left + menuWidth > winW - margin) {
    const leftward = left - menuWidth;
    left = leftward >= margin ? leftward : Math.max(margin, winW - menuWidth - margin);
  }
  if (left < margin) left = margin;

  let top = y;
  if (top + estimatedHeight > winH - margin) {
    const upward = top - estimatedHeight;
    top = upward >= margin ? upward : Math.max(margin, winH - estimatedHeight - margin);
  }
  if (top < margin) top = margin;

  return { top, left };
};

const calcFlyoutPosition = (anchor: HTMLElement, menuWidth: number, estimatedHeight: number) => {
  const anchorRect = anchor.getBoundingClientRect();
  const margin = 8;
  const winW = typeof window !== 'undefined' ? window.innerWidth : 1000;
  const winH = typeof window !== 'undefined' ? window.innerHeight : 800;

  let left = anchorRect.right - 2;
  let flipped = false;
  if (left + menuWidth > winW - margin) {
    left = anchorRect.left - menuWidth + 2;
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

// ---------------------------------------------------------------------------
// Reusable Flyout Menu Container
// Rendered via Portal with synchronous initial positioning and hover bridge
// ---------------------------------------------------------------------------
interface FlyoutMenuProps {
  anchorEl: HTMLElement;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  children: React.ReactNode;
  width?: number;
}

const FlyoutMenu: React.FC<FlyoutMenuProps> = ({
  anchorEl,
  onMouseEnter,
  onMouseLeave,
  children,
  width = 230,
}) => {
  const flyoutRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(() => calcFlyoutPosition(anchorEl, width, 260));

  useLayoutEffect(() => {
    if (!anchorEl || !flyoutRef.current) return;
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

    setPos((prev) => {
      if (Math.abs(prev.top - top) < 2 && Math.abs(prev.left - left) < 2 && prev.flipped === flipped) return prev;
      return { top, left, flipped };
    });
  }, [anchorEl, width]);

  return createPortal(
    <div
      ref={flyoutRef}
      style={{ 
        left: `${pos.left}px`, 
        top: `${pos.top}px`, 
        width: `${width}px`,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="fixed z-[60] bg-md3-surface-container-highest rounded-2xl shadow-2xl border border-md3-outline-variant/40 py-1.5 text-xs select-none max-h-[min(380px,calc(100vh-24px))] overflow-y-auto custom-scrollbar anim-menu-fade"
    >
      {/* Invisible hover bridge between anchor button and flyout menu */}
      <div 
        className="absolute top-0 bottom-0 pointer-events-auto"
        style={pos.flipped ? { right: '-12px', width: '14px' } : { left: '-12px', width: '14px' }}
      />
      {children}
    </div>,
    document.body
  );
};

// ---------------------------------------------------------------------------
// Subfolder Move Flyout
// ---------------------------------------------------------------------------
interface SubfolderMoveFlyoutProps {
  folder: PlaylistFolder;
  anchorEl: HTMLElement;
  folders: PlaylistFolder[];
  currentFolderId?: string | null;
  language: AppLanguage;
  onMoveToFolder: (folderId: string) => void;
  onParentMouseEnter?: () => void;
  onParentMouseLeave?: () => void;
}

const SubfolderMoveFlyout: React.FC<SubfolderMoveFlyoutProps> = ({
  folder,
  anchorEl,
  folders,
  currentFolderId,
  language,
  onMoveToFolder,
  onParentMouseEnter,
  onParentMouseLeave,
}) => {
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const childRefs = useRef<{ [key: string]: HTMLElement | null }>({});
  const timerRef = useRef<any>(null);

  const directSubfolders = folders.filter((f) => f.parentId === folder.id);

  const handleSubfolderEnter = (childId: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setActiveChildId(childId);
    }, 40);
  };

  const handleContainerLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setActiveChildId(null);
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

  return (
    <FlyoutMenu
      anchorEl={anchorEl}
      onMouseEnter={handleContainerEnter}
      onMouseLeave={handleContainerLeave}
    >
      {/* 1. Option to select this parent folder directly */}
      <button
        onClick={() => onMoveToFolder(folder.id)}
        className={`w-full flex items-center justify-between px-3 py-1.5 text-left border-b border-md3-outline-variant/15 font-semibold transition-colors cursor-pointer ${
          currentFolderId === folder.id ? 'text-md3-primary' : 'text-md3-on-surface hover:bg-md3-surface-container'
        }`}
      >
        <span className="truncate">{language === 'ru' ? `Поместить в «${folder.name}»` : `Place in "${folder.name}"`}</span>
        {currentFolderId === folder.id && <Check className="w-3.5 h-3.5 text-md3-primary shrink-0 ml-1" />}
      </button>

      {/* 2. Direct Subfolders */}
      {directSubfolders.map((sf) => {
        const hasDeeper = folders.some((f) => f.parentId === sf.id);
        const FolderIcon = getFolderIconComponent(sf.icon);
        const isCurrent = currentFolderId === sf.id;

        return (
          <React.Fragment key={sf.id}>
            <button
              ref={(el) => { childRefs.current[sf.id] = el; }}
              onMouseEnter={() => handleSubfolderEnter(sf.id)}
              onClick={() => {
                onMoveToFolder(sf.id);
              }}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors cursor-pointer ${
                activeChildId === sf.id 
                  ? 'bg-md3-surface-container text-md3-primary font-semibold' 
                  : isCurrent 
                  ? 'text-md3-primary font-semibold hover:bg-md3-surface-container' 
                  : 'text-md3-on-surface hover:bg-md3-surface-container'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <FolderIcon 
                  className="w-3.5 h-3.5 shrink-0" 
                  style={{ color: sf.color && sf.color !== 'default' ? sf.color : undefined }}
                />
                <span className="truncate">{sf.name}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-1">
                {isCurrent && <Check className="w-3.5 h-3.5 text-md3-primary" />}
                {hasDeeper && <ChevronRight className="w-3 h-3 text-md3-on-surface-variant/60" />}
              </div>
            </button>

            {hasDeeper && activeChildId === sf.id && childRefs.current[sf.id] && (
              <SubfolderMoveFlyout
                folder={sf}
                anchorEl={childRefs.current[sf.id]!}
                folders={folders}
                currentFolderId={currentFolderId}
                language={language}
                onMoveToFolder={onMoveToFolder}
                onParentMouseEnter={handleContainerEnter}
                onParentMouseLeave={handleContainerLeave}
              />
            )}
          </React.Fragment>
        );
      })}
    </FlyoutMenu>
  );
};

// ---------------------------------------------------------------------------
// Main Playlist Context Menu Component
// ---------------------------------------------------------------------------
export const PlaylistContextMenu: React.FC<PlaylistContextMenuProps> = ({
  x,
  y,
  playlist,
  tracks = [],
  folders = [],
  groups = [],
  language = 'ru',
  onClose,
  onPlay,
  onAddToQueue,
  onRename,
  onEditPlaylist,
  onClear,
  onDelete,
  onExportM3U8,
  onMoveToFolder,
  onMoveToGroup,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const moveToBtnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState(() => getInitialMenuPosition(x, y, 224, 320));

  // Cascading "Перенести в..." flyout menu state
  const [isMoveMenuOpen, setIsMoveMenuOpen] = useState(false);
  const [activeFolderFlyoutId, setActiveFolderFlyoutId] = useState<string | null>(null);
  const folderBtnRefs = useRef<{ [key: string]: HTMLElement | null }>({});
  const moveMenuTimerRef = useRef<any>(null);

  const totalDuration = React.useMemo(() => {
    let sum = 0;
    const trackMap = new Map(tracks.map(t => [t.id, t]));
    for (const tid of playlist.trackIds) {
      const t = trackMap.get(tid);
      if (t && t.duration && !isNaN(t.duration)) {
        sum += t.duration;
      }
    }
    return sum;
  }, [playlist.trackIds, tracks]);

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
      if (moveMenuTimerRef.current) clearTimeout(moveMenuTimerRef.current);
    };
  }, [onClose]);

  useLayoutEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const margin = 12;
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    let left = x;
    let top = y;

    if (left + rect.width > winW - margin) {
      const leftward = left - rect.width;
      left = leftward >= margin ? leftward : Math.max(margin, winW - rect.width - margin);
    }
    if (top + rect.height > winH - margin) {
      const upwardTop = top - rect.height;
      top = upwardTop >= margin ? upwardTop : Math.max(margin, winH - rect.height - margin);
    }
    if (top < margin) top = margin;

    setPos((prev) => {
      if (Math.abs(prev.top - top) < 2 && Math.abs(prev.left - left) < 2) return prev;
      return { top, left };
    });
  }, [x, y]);

  // Hover handlers with grace timer for cascading "Перенести в..."
  const handleMoveMenuEnter = () => {
    if (moveMenuTimerRef.current) clearTimeout(moveMenuTimerRef.current);
    moveMenuTimerRef.current = setTimeout(() => {
      setIsMoveMenuOpen(true);
    }, 40);
  };

  const handleMoveMenuLeave = () => {
    if (moveMenuTimerRef.current) clearTimeout(moveMenuTimerRef.current);
    moveMenuTimerRef.current = setTimeout(() => {
      setIsMoveMenuOpen(false);
      setActiveFolderFlyoutId(null);
    }, 260);
  };

  const handleMoveMenuContainerEnter = () => {
    if (moveMenuTimerRef.current) {
      clearTimeout(moveMenuTimerRef.current);
      moveMenuTimerRef.current = null;
    }
  };

  const handleFolderItemEnter = (folderId: string) => {
    if (moveMenuTimerRef.current) clearTimeout(moveMenuTimerRef.current);
    moveMenuTimerRef.current = setTimeout(() => {
      setActiveFolderFlyoutId(folderId);
    }, 40);
  };

  const handleLeafItemEnter = () => {
    if (moveMenuTimerRef.current) clearTimeout(moveMenuTimerRef.current);
    moveMenuTimerRef.current = setTimeout(() => {
      setActiveFolderFlyoutId(null);
    }, 60);
  };

  const rootFolders = folders.filter((f) => !f.parentId);

  return (
    <>
      <div
        ref={menuRef}
        style={{ left: `${pos.left}px`, top: `${pos.top}px` }}
        className="fixed z-50 w-56 bg-md3-surface-container-highest rounded-2xl shadow-2xl border border-md3-outline-variant/40 py-1.5 text-xs select-none max-h-[calc(100vh-24px)] overflow-y-auto custom-scrollbar anim-menu-fade"
      >
        <div className="px-3.5 py-2 border-b border-md3-outline-variant/20">
          <div className="font-bold text-xs text-md3-on-surface truncate">
            {playlist.name}
          </div>
          <div className="text-[11px] text-md3-on-surface-variant/80 font-medium mt-0.5 truncate">
            {playlist.trackIds.length} {language === 'ru' 
              ? (playlist.trackIds.length === 1 ? 'трек' : playlist.trackIds.length < 5 ? 'трека' : 'треков')
              : (playlist.trackIds.length === 1 ? 'track' : 'tracks')
            }
            {totalDuration > 0 && ` • ${formatDurationText(totalDuration)}`}
          </div>
        </div>

        <button
          onClick={() => {
            onPlay(playlist);
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-md3-on-surface hover:bg-md3-primary hover:text-md3-on-primary transition-colors text-left cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{language === 'ru' ? 'Воспроизвести' : 'Play'}</span>
        </button>

        <button
          onClick={() => {
            onAddToQueue(playlist);
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-md3-on-surface hover:bg-md3-surface-container transition-colors text-left cursor-pointer"
        >
          <ListPlus className="w-3.5 h-3.5 text-md3-primary" />
          <span>{language === 'ru' ? 'Добавить в очередь' : 'Add to Queue'}</span>
        </button>

        {!playlist.isSystem && (
          <button
            onClick={() => {
              onRename(playlist);
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-md3-on-surface hover:bg-md3-surface-container transition-colors text-left cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 text-md3-primary" />
            <span>{language === 'ru' ? 'Переименовать' : 'Rename'}</span>
          </button>
        )}

        {!playlist.isSystem && onEditPlaylist && (
          <button
            onClick={() => {
              onEditPlaylist(playlist);
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-md3-on-surface hover:bg-md3-surface-container transition-colors text-left cursor-pointer"
          >
            <Palette className="w-3.5 h-3.5 text-md3-primary" />
            <span>{language === 'ru' ? 'Оформление плейлиста...' : 'Playlist Appearance...'}</span>
          </button>
        )}

        {/* Cascading "Перенести в..." submenu trigger */}
        {!playlist.isSystem && (onMoveToFolder || onMoveToGroup) && (
          <div className="border-t border-md3-outline-variant/20 my-1 py-0.5">
            <button
              ref={moveToBtnRef}
              onMouseEnter={handleMoveMenuEnter}
              onMouseLeave={handleMoveMenuLeave}
              className={`w-full flex items-center justify-between px-3 py-2 text-md3-on-surface hover:bg-md3-surface-container transition-colors text-left cursor-pointer ${
                isMoveMenuOpen ? 'bg-md3-surface-container text-md3-primary font-semibold' : ''
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FolderSymlink className="w-3.5 h-3.5 text-md3-primary" />
                <span>{language === 'ru' ? 'Перенести в...' : 'Move to...'}</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-md3-on-surface-variant/60" />
            </button>
          </div>
        )}

        {onExportM3U8 && (
          <button
            onClick={() => {
              onExportM3U8(playlist);
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-md3-on-surface hover:bg-md3-surface-container transition-colors text-left cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-md3-primary" />
            <span>{language === 'ru' ? 'Экспорт в M3U8...' : 'Export to M3U8...'}</span>
          </button>
        )}

        <button
          onClick={() => {
            onClear(playlist);
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-md3-on-surface hover:bg-md3-surface-container transition-colors text-left cursor-pointer"
        >
          <ListX className="w-3.5 h-3.5 text-amber-400" />
          <span>{language === 'ru' ? 'Очистить список' : 'Clear List'}</span>
        </button>

        {!playlist.isSystem && (
          <div className="border-t border-md3-outline-variant/20 my-1 pt-1">
            <button
              onClick={() => {
                onDelete(playlist);
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-red-400 hover:bg-red-500/10 transition-colors text-left cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{language === 'ru' ? 'Удалить плейлист' : 'Delete Playlist'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Cascading "Перенести в..." Flyout Submenu */}
      {isMoveMenuOpen && moveToBtnRef.current && (
        <FlyoutMenu
          anchorEl={moveToBtnRef.current}
          onMouseEnter={handleMoveMenuContainerEnter}
          onMouseLeave={handleMoveMenuLeave}
          width={230}
        >
          {/* SECTION 1: FOLDERS */}
          {onMoveToFolder && (
            <div>
              <div className="px-3 py-1 text-[10px] uppercase font-bold text-md3-on-surface-variant/60 flex items-center gap-1.5">
                <Folder className="w-3 h-3 text-md3-primary" />
                <span>{language === 'ru' ? 'Папка' : 'Folder'}</span>
              </div>

              {/* Option: Root (No Folder) */}
              <button
                onMouseEnter={handleLeafItemEnter}
                onClick={() => {
                  onMoveToFolder(playlist.id, null);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-left truncate transition-colors cursor-pointer hover:bg-md3-surface-container ${
                  !playlist.folderId ? 'text-md3-primary font-bold' : 'text-md3-on-surface'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FolderSymlink className="w-3.5 h-3.5 text-md3-primary/70 shrink-0" />
                  <span className="truncate">{language === 'ru' ? 'Корень (без папки)' : 'Root (no folder)'}</span>
                </div>
                {!playlist.folderId && <Check className="w-3.5 h-3.5 text-md3-primary shrink-0 ml-1" />}
              </button>

              {/* Folders List with Subfolder cascading support */}
              {rootFolders.map((fld) => {
                const hasSub = folders.some((f) => f.parentId === fld.id);
                const FolderIcon = getFolderIconComponent(fld.icon);
                const isCurrent = playlist.folderId === fld.id;

                return (
                  <React.Fragment key={fld.id}>
                    <button
                      ref={(el) => { folderBtnRefs.current[fld.id] = el; }}
                      onMouseEnter={() => handleFolderItemEnter(fld.id)}
                      onClick={() => {
                        onMoveToFolder(playlist.id, fld.id);
                        onClose();
                      }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-left truncate transition-colors cursor-pointer ${
                        activeFolderFlyoutId === fld.id 
                          ? 'bg-md3-surface-container text-md3-primary font-semibold' 
                          : isCurrent 
                          ? 'text-md3-primary font-semibold hover:bg-md3-surface-container' 
                          : 'text-md3-on-surface hover:bg-md3-surface-container'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FolderIcon 
                          className="w-3.5 h-3.5 shrink-0" 
                          style={{ color: fld.color && fld.color !== 'default' ? fld.color : undefined }}
                        />
                        <span className="truncate">{fld.name}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        {isCurrent && <Check className="w-3.5 h-3.5 text-md3-primary" />}
                        {hasSub && <ChevronRight className="w-3 h-3 text-md3-on-surface-variant/60" />}
                      </div>
                    </button>

                    {/* Recursive subfolders flyout */}
                    {hasSub && activeFolderFlyoutId === fld.id && folderBtnRefs.current[fld.id] && (
                      <SubfolderMoveFlyout
                        folder={fld}
                        anchorEl={folderBtnRefs.current[fld.id]!}
                        folders={folders}
                        currentFolderId={playlist.folderId}
                        language={language}
                        onMoveToFolder={(fid) => {
                          onMoveToFolder(playlist.id, fid);
                          onClose();
                        }}
                        onParentMouseEnter={handleMoveMenuContainerEnter}
                        onParentMouseLeave={handleMoveMenuLeave}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          )}

          {/* SECTION 2: GROUPS */}
          {onMoveToGroup && groups.length > 0 && (
            <div className="border-t border-md3-outline-variant/20 mt-1.5 pt-1">
              <div className="px-3 py-1 text-[10px] uppercase font-bold text-md3-on-surface-variant/60 flex items-center gap-1.5">
                <Layers className="w-3 h-3 text-md3-primary" />
                <span>{language === 'ru' ? 'Группа' : 'Group'}</span>
              </div>

              {/* Option: No Group */}
              <button
                onMouseEnter={handleLeafItemEnter}
                onClick={() => {
                  onMoveToGroup(playlist.id, null);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-left italic truncate transition-colors cursor-pointer hover:bg-md3-surface-container ${
                  !playlist.groupId ? 'text-md3-primary font-bold' : 'text-md3-on-surface-variant'
                }`}
              >
                <span className="truncate">{language === 'ru' ? '(Без группы)' : '(No Group)'}</span>
                {!playlist.groupId && <Check className="w-3.5 h-3.5 text-md3-primary shrink-0 ml-1" />}
              </button>

              {/* Groups List */}
              {groups.map((grp) => {
                const isCurrent = playlist.groupId === grp.id;
                return (
                  <button
                    key={grp.id}
                    onMouseEnter={handleLeafItemEnter}
                    onClick={() => {
                      onMoveToGroup(playlist.id, grp.id);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-left truncate transition-colors cursor-pointer hover:bg-md3-surface-container ${
                      isCurrent ? 'text-md3-primary font-bold' : 'text-md3-on-surface'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {grp.color && (
                        <span 
                          className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-black/20" 
                          style={{ backgroundColor: grp.color.startsWith('#') ? grp.color : undefined }}
                        />
                      )}
                      <span className="truncate">{grp.name}</span>
                    </div>
                    {isCurrent && <Check className="w-3.5 h-3.5 text-md3-primary shrink-0 ml-1" />}
                  </button>
                );
              })}
            </div>
          )}
        </FlyoutMenu>
      )}
    </>
  );
};
