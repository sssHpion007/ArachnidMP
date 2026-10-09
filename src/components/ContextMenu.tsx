import React, { useEffect, useRef } from 'react';
import { 
  Play, 
  ListPlus, 
  CornerDownRight, 
  Edit3, 
  Heart, 
  FolderPlus, 
  Trash2,
  Share2,
  FileText,
  Info
} from 'lucide-react';
import { Track, Playlist } from '../types/music';

interface ContextMenuProps {
  x: number;
  y: number;
  track: Track;
  selectedTrackIds: Set<string>;
  playlists: Playlist[];
  onClose: () => void;
  onPlay: (track: Track) => void;
  onAddToQueue: (tracks: Track[]) => void;
  onPlayNext: (tracks: Track[]) => void;
  onOpenTagEditor: () => void;
  onToggleFavorite: (trackId: string) => void;
  onAddToPlaylist: (playlistId: string, trackIds: string[]) => void;
  onRemoveTracks: (trackIds: string[]) => void;
  onOpenTrackDetails?: (track: Track) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  track,
  selectedTrackIds,
  playlists,
  onClose,
  onPlay,
  onAddToQueue,
  onPlayNext,
  onOpenTagEditor,
  onToggleFavorite,
  onAddToPlaylist,
  onRemoveTracks,
  onOpenTrackDetails,
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

  // Adjust positioning to stay within window bounds
  const menuWidth = 220;
  const menuHeight = 280;
  const posX = Math.min(x, window.innerWidth - menuWidth - 16);
  const posY = Math.min(y, window.innerHeight - menuHeight - 16);

  const targetIds = selectedTrackIds.has(track.id)
    ? Array.from(selectedTrackIds)
    : [track.id];

  const userPlaylists = playlists.filter(p => !p.isSystem && p.id !== 'pl_favorites');

  return (
    <div
      ref={menuRef}
      style={{ left: `${posX}px`, top: `${posY}px` }}
      className="fixed z-50 w-56 bg-md3-surface-container-highest rounded-2xl shadow-2xl border border-md3-outline-variant/40 py-1.5 text-xs select-none animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="px-3 py-1.5 text-[11px] font-bold text-md3-on-surface-variant/80 border-b border-md3-outline-variant/20 truncate">
        {targetIds.length > 1 ? `Выбрано: ${targetIds.length} треков` : track.title}
      </div>

      {/* Play Now */}
      <button
        onClick={() => {
          onPlay(track);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-md3-on-surface hover:bg-md3-primary hover:text-md3-on-primary transition-colors text-left"
      >
        <Play className="w-3.5 h-3.5 fill-current" />
        <span>Воспроизвести сейчас</span>
      </button>

      {/* Play Next */}
      <button
        onClick={() => {
          onPlayNext([track]);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-md3-on-surface hover:bg-md3-surface-container transition-colors text-left"
      >
        <CornerDownRight className="w-3.5 h-3.5 text-md3-primary" />
        <span>Слушать следующим</span>
      </button>

      {/* Add to Queue */}
      <button
        onClick={() => {
          onAddToQueue([track]);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-md3-on-surface hover:bg-md3-surface-container transition-colors text-left"
      >
        <ListPlus className="w-3.5 h-3.5 text-md3-primary" />
        <span>Добавить в очередь</span>
      </button>

      {/* Add to Playlist Submenu (excluding system favorites) */}
      {userPlaylists.length > 0 && (
        <div className="border-t border-md3-outline-variant/20 my-1 py-1">
          <div className="px-3 py-1 text-[10px] uppercase font-bold text-md3-on-surface-variant/60">
            Добавить в плейлист:
          </div>
          <div className="max-h-36 overflow-y-auto custom-scrollbar">
            {userPlaylists.map((pl) => (
              <button
                key={pl.id}
                onClick={() => {
                  onAddToPlaylist(pl.id, targetIds);
                  onClose();
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-md3-on-surface hover:bg-md3-surface-container text-left truncate"
              >
                <FolderPlus className="w-3.5 h-3.5 opacity-60 flex-shrink-0" />
                <span className="truncate">{pl.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Batch Tag Editor & Details */}
      <div className="border-t border-md3-outline-variant/20 my-1 pt-1">
        {onOpenTrackDetails && (
          <button
            onClick={() => {
              onOpenTrackDetails(track);
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-md3-on-surface hover:bg-md3-surface-container transition-colors text-left"
          >
            <Info className="w-3.5 h-3.5 text-md3-primary" />
            <span>Сведения о треке</span>
          </button>
        )}

        <button
          onClick={() => {
            onOpenTagEditor();
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-md3-on-surface hover:bg-md3-surface-container transition-colors text-left font-medium text-md3-primary"
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>Пакетная правка тегов</span>
        </button>

        {/* Favorite */}
        <button
          onClick={() => {
            onToggleFavorite(track.id);
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-md3-on-surface hover:bg-md3-surface-container transition-colors text-left"
        >
          <Heart className={`w-3.5 h-3.5 ${track.isFavorite ? 'fill-red-500 text-red-500' : 'text-md3-on-surface-variant'}`} />
          <span>{track.isFavorite ? 'Удалить из избранного' : 'В избранное'}</span>
        </button>

        {/* Remove */}
        <button
          onClick={() => {
            onRemoveTracks(targetIds);
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-red-400 hover:bg-red-500/10 transition-colors text-left"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Удалить трек{targetIds.length > 1 ? 'и' : ''}</span>
        </button>
      </div>
    </div>
  );
};
