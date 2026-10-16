import React, { useEffect, useRef } from 'react';
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
  RotateCw
} from 'lucide-react';
import { Track, Playlist } from '../types/music';
import { AppLanguage } from '../i18n';

interface ContextMenuProps {
  x: number;
  y: number;
  track: Track;
  selectedTrackIds: Set<string>;
  playlists: Playlist[];
  language?: AppLanguage;
  onClose: () => void;
  onPlay: (track: Track) => void;
  onAddToQueue: (tracks: Track[]) => void;
  onPlayNext: (tracks: Track[]) => void;
  onOpenTagEditor: () => void;
  onToggleFavorite: (trackId: string) => void;
  onAddToPlaylist: (playlistId: string, trackIds: string[]) => void;
  onRemoveTracks: (trackIds: string[]) => void;
  onDeleteFromDisk?: (trackIds: string[]) => void;
  onOpenTrackDetails?: (track: Track) => void;
  onRelocateTrack?: (track: Track) => void;
  onReloadTracks?: (trackIds: string[]) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  track,
  selectedTrackIds,
  playlists,
  language = 'ru',
  onClose,
  onPlay,
  onAddToQueue,
  onPlayNext,
  onOpenTagEditor,
  onToggleFavorite,
  onAddToPlaylist,
  onRemoveTracks,
  onDeleteFromDisk,
  onOpenTrackDetails,
  onRelocateTrack,
  onReloadTracks,
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
        {targetIds.length > 1 
          ? (language === 'ru' ? `Выбрано: ${targetIds.length} треков` : `Selected: ${targetIds.length} tracks`)
          : track.title
        }
      </div>

      {/* Play Now */}
      <button
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
        onClick={() => {
          onAddToQueue([track]);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-md3-on-surface hover:bg-md3-surface-container transition-colors text-left cursor-pointer"
      >
        <ListPlus className="w-3.5 h-3.5 text-md3-primary" />
        <span>{language === 'ru' ? 'Добавить в очередь' : 'Add to Queue'}</span>
      </button>

      {/* Add to Playlist Submenu (excluding system favorites) */}
      {userPlaylists.length > 0 && (
        <div className="border-t border-md3-outline-variant/20 my-1 py-1">
          <div className="px-3 py-1 text-[10px] uppercase font-bold text-md3-on-surface-variant/60">
            {language === 'ru' ? 'Добавить в плейлист:' : 'Add to Playlist:'}
          </div>
          <div className="max-h-36 overflow-y-auto custom-scrollbar">
            {userPlaylists.map((pl) => (
              <button
                key={pl.id}
                onClick={() => {
                  onAddToPlaylist(pl.id, targetIds);
                  onClose();
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-md3-on-surface hover:bg-md3-surface-container text-left truncate cursor-pointer"
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
            className="w-full flex items-center gap-2.5 px-3 py-2 text-md3-on-surface hover:bg-md3-surface-container transition-colors text-left cursor-pointer"
          >
            <Info className="w-3.5 h-3.5 text-md3-primary" />
            <span>{language === 'ru' ? 'Сведения о треке' : 'Track Details'}</span>
          </button>
        )}

        {onReloadTracks && (
          <button
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
  );
};
