import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { Play, ListPlus, Edit3, Trash2, FolderOpen, Layers, Palette, FolderSymlink, ChevronRight, Folder, Check } from 'lucide-react';
import { PlaylistFolder, PlaylistGroup } from '../types/music';
import { AppLanguage } from '../i18n';
import { getFolderIconComponent } from '../theme/folderIcons';
import { FlyoutMenu, SubfolderMoveFlyout } from './PlaylistContextMenu';

interface FolderContextMenuProps {
  x: number;
  y: number;
  folder: PlaylistFolder;
  folders: PlaylistFolder[];
  groups: PlaylistGroup[];
  language?: AppLanguage;
  onClose: () => void;
  onOpen: (folder: PlaylistFolder) => void;
  onPlayAll: (folder: PlaylistFolder) => void;
  onAddToQueue: (folder: PlaylistFolder) => void;
  onRename: (folder: PlaylistFolder) => void;
  onEditFolder?: (folder: PlaylistFolder) => void;
  onDelete: (folder: PlaylistFolder) => void;
  onMoveToFolder: (folderId: string, parentFolderId: string | null) => void;
  onMoveToGroup: (folderId: string, groupId: string | null) => void;
}

const getInitialMenuPosition = (x: number, y: number, menuWidth = 224, estimatedHeight = 280) => {
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

export const FolderContextMenu: React.FC<FolderContextMenuProps> = ({
  x,
  y,
  folder,
  folders,
  groups,
  language = 'ru',
  onClose,
  onOpen,
  onPlayAll,
  onAddToQueue,
  onRename,
  onEditFolder,
  onDelete,
  onMoveToFolder,
  onMoveToGroup,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const moveToBtnRef = useRef<HTMLButtonElement>(null);
  const folderBtnRefs = useRef<Record<string, HTMLElement | null>>({});
  const moveMenuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isMoveMenuOpen, setIsMoveMenuOpen] = useState(false);
  const [activeFolderFlyoutId, setActiveFolderFlyoutId] = useState<string | null>(null);
  const [pos, setPos] = useState(() => getInitialMenuPosition(x, y, 224, 320));

  const movableFolders = (() => {
    const excludedIds = new Set([folder.id]);
    let foundDescendant = true;
    while (foundDescendant) {
      foundDescendant = false;
      for (const candidate of folders) {
        if (candidate.parentId && excludedIds.has(candidate.parentId) && !excludedIds.has(candidate.id)) {
          excludedIds.add(candidate.id);
          foundDescendant = true;
        }
      }
    }
    return folders.filter((candidate) => !excludedIds.has(candidate.id));
  })();

  const handleMoveMenuEnter = () => {
    if (moveMenuTimerRef.current) clearTimeout(moveMenuTimerRef.current);
    moveMenuTimerRef.current = setTimeout(() => setIsMoveMenuOpen(true), 40);
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
    moveMenuTimerRef.current = setTimeout(() => setActiveFolderFlyoutId(folderId), 40);
  };

  const handleLeafItemEnter = () => {
    if (moveMenuTimerRef.current) clearTimeout(moveMenuTimerRef.current);
    moveMenuTimerRef.current = setTimeout(() => setActiveFolderFlyoutId(null), 60);
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

    // Horizontal check: flip or clamp if overflowing right edge
    if (left + rect.width > winW - margin) {
      const leftward = left - rect.width;
      left = leftward >= margin ? leftward : Math.max(margin, winW - rect.width - margin);
    }

    // Vertical check: flip upward or clamp if overflowing bottom edge
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

  const rootFolders = movableFolders.filter((candidate) => !candidate.parentId);

  return (
    <>
      <div
      ref={menuRef}
      style={{ left: `${pos.left}px`, top: `${pos.top}px` }}
      className="fixed z-50 w-56 bg-md3-surface-container-highest rounded-2xl shadow-2xl border border-md3-outline-variant/40 py-1.5 text-xs select-none max-h-[calc(100vh-24px)] overflow-y-auto custom-scrollbar anim-menu-fade"
    >
      <div className="px-3 py-1.5 text-[11px] font-bold text-md3-on-surface-variant/80 border-b border-md3-outline-variant/20 truncate">
        {language === 'ru' ? 'Папка:' : 'Folder:'} {folder.name}
      </div>

      <button
        onClick={() => {
          onOpen(folder);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-md3-on-surface hover:bg-md3-primary hover:text-md3-on-primary transition-colors text-left font-medium cursor-pointer"
      >
        <FolderOpen className="w-3.5 h-3.5" />
        <span>{language === 'ru' ? 'Открыть папку' : 'Open Folder'}</span>
      </button>

      <button
        onClick={() => {
          onPlayAll(folder);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-md3-on-surface hover:bg-md3-surface-container transition-colors text-left cursor-pointer"
      >
        <Play className="w-3.5 h-3.5 fill-current" />
        <span>{language === 'ru' ? 'Воспроизвести всё' : 'Play All'}</span>
      </button>

      <button
        onClick={() => {
          onAddToQueue(folder);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-md3-on-surface hover:bg-md3-surface-container transition-colors text-left cursor-pointer"
      >
        <ListPlus className="w-3.5 h-3.5 text-md3-primary" />
        <span>{language === 'ru' ? 'Добавить всё в очередь' : 'Add All to Queue'}</span>
      </button>

      <button
        onClick={() => {
          onRename(folder);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-md3-on-surface hover:bg-md3-surface-container transition-colors text-left cursor-pointer"
      >
        <Edit3 className="w-3.5 h-3.5 text-md3-primary" />
        <span>{language === 'ru' ? 'Переименовать' : 'Rename'}</span>
      </button>

      {onEditFolder && (
        <button
          onClick={() => {
            onEditFolder(folder);
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-md3-on-surface hover:bg-md3-surface-container transition-colors text-left cursor-pointer"
        >
          <Palette className="w-3.5 h-3.5 text-md3-primary" />
          <span>{language === 'ru' ? 'Оформление папки...' : 'Folder Appearance...'}</span>
        </button>
      )}

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

      <div className="border-t border-md3-outline-variant/20 my-1 pt-1">
        <button
          onClick={() => {
            onDelete(folder);
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-red-400 hover:bg-red-500/10 transition-colors text-left cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{language === 'ru' ? 'Удалить папку' : 'Delete Folder'}</span>
        </button>
      </div>
      </div>

      {isMoveMenuOpen && moveToBtnRef.current && (
        <FlyoutMenu
          anchorEl={moveToBtnRef.current}
          onMouseEnter={handleMoveMenuContainerEnter}
          onMouseLeave={handleMoveMenuLeave}
          width={230}
        >
          <div>
            <div className="px-3 py-1 text-[10px] uppercase font-bold text-md3-on-surface-variant/60 flex items-center gap-1.5">
              <Folder className="w-3 h-3 text-md3-primary" />
              <span>{language === 'ru' ? 'Папка' : 'Folder'}</span>
            </div>

            <button
              onMouseEnter={handleLeafItemEnter}
              onClick={() => {
                onMoveToFolder(folder.id, null);
                onClose();
              }}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-left truncate transition-colors cursor-pointer hover:bg-md3-surface-container ${
                !folder.parentId ? 'text-md3-primary font-bold' : 'text-md3-on-surface'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <FolderSymlink className="w-3.5 h-3.5 text-md3-primary/70 shrink-0" />
                <span className="truncate">{language === 'ru' ? 'Корень (без папки)' : 'Root (no folder)'}</span>
              </div>
              {!folder.parentId && <Check className="w-3.5 h-3.5 text-md3-primary shrink-0 ml-1" />}
            </button>

            {rootFolders.map((rootFolder) => {
              const hasSubfolders = movableFolders.some((candidate) => candidate.parentId === rootFolder.id);
              const FolderIcon = getFolderIconComponent(rootFolder.icon);
              const isCurrent = folder.parentId === rootFolder.id;

              return (
                <React.Fragment key={rootFolder.id}>
                  <button
                    ref={(element) => { folderBtnRefs.current[rootFolder.id] = element; }}
                    onMouseEnter={() => handleFolderItemEnter(rootFolder.id)}
                    onClick={() => {
                      onMoveToFolder(folder.id, rootFolder.id);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-left truncate transition-colors cursor-pointer ${
                      activeFolderFlyoutId === rootFolder.id
                        ? 'bg-md3-surface-container text-md3-primary font-semibold'
                        : isCurrent
                        ? 'text-md3-primary font-semibold hover:bg-md3-surface-container'
                        : 'text-md3-on-surface hover:bg-md3-surface-container'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FolderIcon
                        className="w-3.5 h-3.5 shrink-0"
                        style={{ color: rootFolder.color && rootFolder.color !== 'default' ? rootFolder.color : undefined }}
                      />
                      <span className="truncate">{rootFolder.name}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-1">
                      {isCurrent && <Check className="w-3.5 h-3.5 text-md3-primary" />}
                      {hasSubfolders && <ChevronRight className="w-3 h-3 text-md3-on-surface-variant/60" />}
                    </div>
                  </button>

                  {hasSubfolders && activeFolderFlyoutId === rootFolder.id && folderBtnRefs.current[rootFolder.id] && (
                    <SubfolderMoveFlyout
                      folder={rootFolder}
                      anchorEl={folderBtnRefs.current[rootFolder.id]!}
                      folders={movableFolders}
                      currentFolderId={folder.parentId}
                      language={language}
                      onMoveToFolder={(parentId) => {
                        onMoveToFolder(folder.id, parentId);
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

          {groups.length > 0 && (
            <div className="border-t border-md3-outline-variant/20 mt-1.5 pt-1">
              <div className="px-3 py-1 text-[10px] uppercase font-bold text-md3-on-surface-variant/60 flex items-center gap-1.5">
                <Layers className="w-3 h-3 text-md3-primary" />
                <span>{language === 'ru' ? 'Группа' : 'Group'}</span>
              </div>

              <button
                onMouseEnter={handleLeafItemEnter}
                onClick={() => {
                  onMoveToGroup(folder.id, null);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-left italic truncate transition-colors cursor-pointer hover:bg-md3-surface-container ${
                  !folder.groupId ? 'text-md3-primary font-bold' : 'text-md3-on-surface-variant'
                }`}
              >
                <span className="truncate">{language === 'ru' ? '(Без группы)' : '(No Group)'}</span>
                {!folder.groupId && <Check className="w-3.5 h-3.5 text-md3-primary shrink-0 ml-1" />}
              </button>

              {groups.map((group) => {
                const isCurrent = folder.groupId === group.id;
                return (
                  <button
                    key={group.id}
                    onMouseEnter={handleLeafItemEnter}
                    onClick={() => {
                      onMoveToGroup(folder.id, group.id);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-left truncate transition-colors cursor-pointer hover:bg-md3-surface-container ${
                      isCurrent ? 'text-md3-primary font-bold' : 'text-md3-on-surface'
                    }`}
                  >
                    <span className="truncate">{group.name}</span>
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
