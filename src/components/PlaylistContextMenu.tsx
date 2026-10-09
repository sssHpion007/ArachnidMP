import React, { useEffect, useRef } from 'react';
import { Play, ListPlus, Edit3, Trash2, ListX } from 'lucide-react';
import { Playlist } from '../types/music';

interface PlaylistContextMenuProps {
  x: number;
  y: number;
  playlist: Playlist;
  onClose: () => void;
  onPlay: (playlist: Playlist) => void;
  onAddToQueue: (playlist: Playlist) => void;
  onRename: (playlist: Playlist) => void;
  onClear: (playlist: Playlist) => void;
  onDelete: (playlist: Playlist) => void;
}

export const PlaylistContextMenu: React.FC<PlaylistContextMenuProps> = ({
  x,
  y,
  playlist,
  onClose,
  onPlay,
  onAddToQueue,
  onRename,
  onClear,
  onDelete,
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

  const menuWidth = 200;
  const menuHeight = 220;
  const posX = Math.min(x, window.innerWidth - menuWidth - 16);
  const posY = Math.min(y, window.innerHeight - menuHeight - 16);

  return (
    <div
      ref={menuRef}
      style={{ left: `${posX}px`, top: `${posY}px` }}
      className="fixed z-50 w-52 bg-md3-surface-container-highest rounded-2xl shadow-2xl border border-md3-outline-variant/40 py-1.5 text-xs select-none animate-in fade-in zoom-in-95 duration-100"
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
