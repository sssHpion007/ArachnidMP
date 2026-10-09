import React, { useEffect, useRef } from 'react';
import { Play, ListPlus, Edit3, Trash2, ListX, Folder, FolderSymlink, Layers } from 'lucide-react';
import { Playlist, PlaylistFolder, PlaylistGroup } from '../types/music';

interface PlaylistContextMenuProps {
  x: number;
  y: number;
  playlist: Playlist;
  folders?: PlaylistFolder[];
  groups?: PlaylistGroup[];
  onClose: () => void;
  onPlay: (playlist: Playlist) => void;
  onAddToQueue: (playlist: Playlist) => void;
  onRename: (playlist: Playlist) => void;
  onClear: (playlist: Playlist) => void;
  onDelete: (playlist: Playlist) => void;
  onMoveToFolder?: (playlistId: string, folderId: string | null) => void;
  onMoveToGroup?: (playlistId: string, groupId: string | null) => void;
}

export const PlaylistContextMenu: React.FC<PlaylistContextMenuProps> = ({
  x,
  y,
  playlist,
  folders = [],
  groups = [],
  onClose,
  onPlay,
  onAddToQueue,
  onRename,
  onClear,
  onDelete,
  onMoveToFolder,
  onMoveToGroup,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

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

  const menuWidth = 220;
  const menuHeight = 320;
  const posX = Math.min(x, window.innerWidth - menuWidth - 16);
  const posY = Math.min(y, window.innerHeight - menuHeight - 16);

  return (
    <div
      ref={menuRef}
      style={{ left: `${posX}px`, top: `${posY}px` }}
      className="fixed z-50 w-56 bg-md3-surface-container-highest rounded-2xl shadow-2xl border border-md3-outline-variant/40 py-1.5 text-xs select-none animate-in fade-in zoom-in-95 duration-100 max-h-[85vh] overflow-y-auto custom-scrollbar"
    >
      <div className="px-3 py-1.5 text-[11px] font-bold text-md3-on-surface-variant/80 border-b border-md3-outline-variant/20 truncate">
        {playlist.name} ({playlist.trackIds.length} треков)
      </div>

      <button
        onClick={() => {
          onPlay(playlist);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-md3-on-surface hover:bg-md3-primary hover:text-md3-on-primary transition-colors text-left"
      >
        <Play className="w-3.5 h-3.5 fill-current" />
        <span>Воспроизвести</span>
      </button>

      <button
        onClick={() => {
          onAddToQueue(playlist);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-md3-on-surface hover:bg-md3-surface-container transition-colors text-left"
      >
        <ListPlus className="w-3.5 h-3.5 text-md3-primary" />
        <span>Добавить в очередь</span>
      </button>

      {!playlist.isSystem && (
        <button
          onClick={() => {
            onRename(playlist);
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-md3-on-surface hover:bg-md3-surface-container transition-colors text-left"
        >
          <Edit3 className="w-3.5 h-3.5 text-md3-primary" />
          <span>Переименовать</span>
        </button>
      )}

      {/* Folders Submenu / Move to Folder */}
      {!playlist.isSystem && onMoveToFolder && (
        <div className="border-t border-md3-outline-variant/20 my-1 py-1">
          <div className="px-3 py-1 text-[10px] uppercase font-bold text-md3-on-surface-variant/60 flex items-center gap-1.5">
            <Folder className="w-3 h-3" />
            <span>Папка:</span>
          </div>
          {playlist.folderId && (
            <button
              onClick={() => {
                onMoveToFolder(playlist.id, null);
                onClose();
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-amber-400 hover:bg-md3-surface-container text-left truncate"
            >
              <FolderSymlink className="w-3.5 h-3.5" />
              <span>Извлечь в корень</span>
            </button>
          )}
          {folders.map((f) => (
            <button
              key={f.id}
              onClick={() => {
                onMoveToFolder(playlist.id, f.id);
                onClose();
              }}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-left truncate hover:bg-md3-surface-container ${
                playlist.folderId === f.id ? 'text-md3-primary font-bold' : 'text-md3-on-surface'
              }`}
            >
              <span className="truncate">{f.name}</span>
              {playlist.folderId === f.id && <span className="text-[10px]">✓</span>}
            </button>
          ))}
        </div>
      )}

      {/* Groups Submenu / Move to Group */}
      {!playlist.isSystem && onMoveToGroup && groups.length > 0 && (
        <div className="border-t border-md3-outline-variant/20 my-1 py-1">
          <div className="px-3 py-1 text-[10px] uppercase font-bold text-md3-on-surface-variant/60 flex items-center gap-1.5">
            <Layers className="w-3 h-3" />
            <span>Группа:</span>
          </div>
          {playlist.groupId && (
            <button
              onClick={() => {
                onMoveToGroup(playlist.id, null);
                onClose();
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-md3-on-surface-variant hover:bg-md3-surface-container text-left italic truncate"
            >
              <span>(Без группы)</span>
            </button>
          )}
          {groups.map((grp) => (
            <button
              key={grp.id}
              onClick={() => {
                onMoveToGroup(playlist.id, grp.id);
                onClose();
              }}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-left truncate hover:bg-md3-surface-container ${
                playlist.groupId === grp.id ? 'text-md3-primary font-bold' : 'text-md3-on-surface'
              }`}
            >
              <span className="truncate">{grp.name}</span>
              {playlist.groupId === grp.id && <span className="text-[10px]">✓</span>}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => {
          onClear(playlist);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-md3-on-surface hover:bg-md3-surface-container transition-colors text-left"
      >
        <ListX className="w-3.5 h-3.5 text-amber-400" />
        <span>Очистить список</span>
      </button>

      {!playlist.isSystem && (
        <div className="border-t border-md3-outline-variant/20 my-1 pt-1">
          <button
            onClick={() => {
              onDelete(playlist);
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-red-400 hover:bg-red-500/10 transition-colors text-left"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Удалить плейлист</span>
          </button>
        </div>
      )}
    </div>
  );
};
