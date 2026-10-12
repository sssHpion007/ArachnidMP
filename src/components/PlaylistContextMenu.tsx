import React, { useEffect, useRef } from 'react';
import { Play, ListPlus, Edit3, Trash2, ListX, Folder, FolderSymlink, Layers } from 'lucide-react';
import { Playlist, PlaylistFolder, PlaylistGroup, Track } from '../types/music';
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
  onClear: (playlist: Playlist) => void;
  onDelete: (playlist: Playlist) => void;
  onMoveToFolder?: (playlistId: string, folderId: string | null) => void;
  onMoveToGroup?: (playlistId: string, groupId: string | null) => void;
}

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
  onClear,
  onDelete,
  onMoveToFolder,
  onMoveToGroup,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

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

      {/* Folders Submenu / Move to Folder */}
      {!playlist.isSystem && onMoveToFolder && (
        <div className="border-t border-md3-outline-variant/20 my-1 py-1">
          <div className="px-3 py-1 text-[10px] uppercase font-bold text-md3-on-surface-variant/60 flex items-center gap-1.5">
            <Folder className="w-3 h-3" />
            <span>{language === 'ru' ? 'Папка:' : 'Folder:'}</span>
          </div>
          {playlist.folderId && (
            <button
              onClick={() => {
                onMoveToFolder(playlist.id, null);
                onClose();
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-amber-400 hover:bg-md3-surface-container text-left truncate cursor-pointer"
            >
              <FolderSymlink className="w-3.5 h-3.5" />
              <span>{language === 'ru' ? 'Извлечь в корень' : 'Extract to root'}</span>
            </button>
          )}
          {folders.map((f) => (
            <button
              key={f.id}
              onClick={() => {
                onMoveToFolder(playlist.id, f.id);
                onClose();
              }}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-left truncate hover:bg-md3-surface-container cursor-pointer ${
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
            <span>{language === 'ru' ? 'Группа:' : 'Group:'}</span>
          </div>
          {playlist.groupId && (
            <button
              onClick={() => {
                onMoveToGroup(playlist.id, null);
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
                onMoveToGroup(playlist.id, grp.id);
                onClose();
              }}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-left truncate hover:bg-md3-surface-container cursor-pointer ${
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
  );
};
