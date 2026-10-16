import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { Play, ListPlus, Edit3, Trash2, FolderOpen, Layers, Palette } from 'lucide-react';
import { PlaylistFolder, PlaylistGroup } from '../types/music';
import { AppLanguage } from '../i18n';

interface FolderContextMenuProps {
  x: number;
  y: number;
  folder: PlaylistFolder;
  groups: PlaylistGroup[];
  language?: AppLanguage;
  onClose: () => void;
  onOpen: (folder: PlaylistFolder) => void;
  onPlayAll: (folder: PlaylistFolder) => void;
  onAddToQueue: (folder: PlaylistFolder) => void;
  onRename: (folder: PlaylistFolder) => void;
  onEditFolder?: (folder: PlaylistFolder) => void;
  onDelete: (folder: PlaylistFolder) => void;
  onMoveToGroup: (folderId: string, groupId: string | null) => void;
}

export const FolderContextMenu: React.FC<FolderContextMenuProps> = ({
  x,
  y,
  folder,
  groups,
  language = 'ru',
  onClose,
  onOpen,
  onPlayAll,
  onAddToQueue,
  onRename,
  onEditFolder,
  onDelete,
  onMoveToGroup,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: y, left: x });

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
      if (upwardTop >= margin) {
        top = upwardTop;
      } else {
        top = Math.max(margin, winH - rect.height - margin);
      }
    }

    setPos({ top, left });
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      style={{ left: `${pos.left}px`, top: `${pos.top}px` }}
      className="fixed z-50 w-56 bg-md3-surface-container-highest rounded-2xl shadow-2xl border border-md3-outline-variant/40 py-1.5 text-xs select-none animate-in fade-in zoom-in-95 duration-100 max-h-[calc(100vh-24px)] overflow-y-auto custom-scrollbar"
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

      {groups.length > 0 && (
        <div className="border-t border-md3-outline-variant/20 my-1 py-1">
          <div className="px-3 py-1 text-[10px] uppercase font-bold text-md3-on-surface-variant/60 flex items-center gap-1.5">
            <Layers className="w-3 h-3" />
            <span>{language === 'ru' ? 'Группа:' : 'Group:'}</span>
          </div>
          {folder.groupId && (
            <button
              onClick={() => {
                onMoveToGroup(folder.id, null);
                onClose();
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-md3-on-surface-variant hover:bg-md3-surface-container text-left italic truncate cursor-pointer"
            >
              <span>{language === 'ru' ? '(Без группы)' : '(No Group)'}</span>
            </button>
          )}
          {groups.map((grp) => (
            <button
              key={grp.id}
              onClick={() => {
                onMoveToGroup(folder.id, grp.id);
                onClose();
              }}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-left truncate hover:bg-md3-surface-container cursor-pointer ${
                folder.groupId === grp.id ? 'text-md3-primary font-bold' : 'text-md3-on-surface'
              }`}
            >
              <span className="truncate">{grp.name}</span>
              {folder.groupId === grp.id && <span className="text-[10px]">✓</span>}
            </button>
          ))}
        </div>
      )}

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
  );
};
