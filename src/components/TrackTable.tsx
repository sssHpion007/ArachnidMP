import React, { useState } from 'react';
import { 
  Play, 
  Pause, 
  Heart, 
  Clock, 
  MoreVertical, 
  Edit3, 
  ListPlus, 
  Trash2, 
  Music,
  ArrowUpDown,
  CheckSquare,
  Disc3,
  GripVertical
} from 'lucide-react';
import { Track } from '../types/music';
import { formatTime } from '../services/tagEditor';

interface TrackTableProps {
  tracks: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  selectedTrackIds: Set<string>;
  onSelectTrack: (trackId: string, e: React.MouseEvent, index: number) => void;
  onPlayTrack: (track: Track) => void;
  onToggleFavorite: (trackId: string, e: React.MouseEvent) => void;
  onOpenContextMenu: (e: React.MouseEvent, track: Track) => void;
  onOpenBatchTagEditor: () => void;
  onAddSelectedToQueue: () => void;
  onPlaySelected: () => void;
  onClearSelection: () => void;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSortChange: (column: string) => void;
  onDropFiles: (files: File[]) => void;
  onDropInternalTracks?: (trackIds: string[]) => void;
}

export const TrackTable: React.FC<TrackTableProps> = ({
  tracks,
  currentTrack,
  isPlaying,
  selectedTrackIds,
  onSelectTrack,
  onPlayTrack,
  onToggleFavorite,
  onOpenContextMenu,
  onOpenBatchTagEditor,
  onAddSelectedToQueue,
  onPlaySelected,
  onClearSelection,
  sortBy,
  sortOrder,
  onSortChange,
  onDropFiles,
  onDropInternalTracks,
}) => {
  const [hoveredTrackId, setHoveredTrackId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, track: Track) => {
    let idsToDrag: string[] = [];
    if (selectedTrackIds.has(track.id)) {
      idsToDrag = Array.from(selectedTrackIds);
    } else {
      idsToDrag = [track.id];
    }
    e.dataTransfer.setData('application/json', JSON.stringify({ trackIds: idsToDrag }));
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleTableDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleTableDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onDropFiles(Array.from(e.dataTransfer.files));
      return;
    }
    try {
      const data = e.dataTransfer?.getData('application/json');
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.trackIds && Array.isArray(parsed.trackIds) && onDropInternalTracks) {
          onDropInternalTracks(parsed.trackIds);
        }
      }
    } catch (_) {}
  };

  const selectedCount = selectedTrackIds.size;

  return (
    <div 
      onDragOver={handleTableDragOver}
      onDrop={handleTableDrop}
      className="flex-1 flex flex-col h-full min-h-0 bg-md3-surface select-none relative"
    >
      {/* Table Header */}
      <div className="grid grid-cols-[48px_minmax(200px,2fr)_minmax(140px,1.5fr)_minmax(140px,1.5fr)_90px_70px_48px] items-center px-4 py-2.5 text-xs font-semibold text-md3-on-surface-variant/70 border-b border-md3-outline-variant/20 tracking-wider uppercase">
        <div className="text-center">#</div>
        <div 
          onClick={() => onSortChange('title')} 
          className="flex items-center gap-1 cursor-pointer hover:text-md3-primary"
        >
          <span>Название</span>
          {sortBy === 'title' && <ArrowUpDown className="w-3 h-3 text-md3-primary" />}
        </div>
        <div 
          onClick={() => onSortChange('artist')} 
          className="flex items-center gap-1 cursor-pointer hover:text-md3-primary"
        >
          <span>Артист</span>
          {sortBy === 'artist' && <ArrowUpDown className="w-3 h-3 text-md3-primary" />}
        </div>
        <div 
          onClick={() => onSortChange('album')} 
          className="flex items-center gap-1 cursor-pointer hover:text-md3-primary"
        >
          <span>Альбом</span>
          {sortBy === 'album' && <ArrowUpDown className="w-3 h-3 text-md3-primary" />}
        </div>
        <div 
          onClick={() => onSortChange('genre')} 
          className="flex items-center gap-1 cursor-pointer hover:text-md3-primary"
        >
          <span>Жанр</span>
          {sortBy === 'genre' && <ArrowUpDown className="w-3 h-3 text-md3-primary" />}
        </div>
        <div 
          onClick={() => onSortChange('duration')} 
          className="flex items-center justify-end gap-1 cursor-pointer hover:text-md3-primary pr-2"
        >
          <Clock className="w-3.5 h-3.5" />
          {sortBy === 'duration' && <ArrowUpDown className="w-3 h-3 text-md3-primary" />}
        </div>
        <div className="text-center"></div>
      </div>

      {/* Tracks List */}
      <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-md3-outline-variant/10 custom-scrollbar">
        {tracks.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-8 text-md3-on-surface-variant">
            <div className="w-16 h-16 rounded-3xl bg-md3-surface-container-high flex items-center justify-center text-md3-primary mb-4">
              <Music className="w-8 h-8 opacity-60" />
            </div>
            <p className="text-base font-semibold text-md3-on-surface mb-1">Здесь пока пусто</p>
            <p className="text-sm max-w-sm text-md3-on-surface-variant/80">
              Перетащите аудиофайлы (MP3, FLAC, WAV, OGG) прямо в это окно или нажмите «Добавить файлы» в верхней панели!
            </p>
          </div>
        ) : (
          tracks.map((track, idx) => {
            const isSelected = selectedTrackIds.has(track.id);
            const isCurrent = currentTrack?.id === track.id;
            const isHovered = hoveredTrackId === track.id;

            return (
              <div
                key={track.id}
                draggable
                onDragStart={(e) => handleDragStart(e, track)}
                onMouseEnter={() => setHoveredTrackId(track.id)}
                onMouseLeave={() => setHoveredTrackId(null)}
                onClick={(e) => onSelectTrack(track.id, e, idx)}
                onDoubleClick={() => onPlayTrack(track)}
                onContextMenu={(e) => onOpenContextMenu(e, track)}
                className={`grid grid-cols-[48px_minmax(200px,2fr)_minmax(140px,1.5fr)_minmax(140px,1.5fr)_90px_70px_48px] items-center px-4 py-2 cursor-pointer transition-colors duration-150 ${
                  isSelected
                    ? 'bg-md3-primary-container/40 text-md3-on-surface'
                    : isCurrent
                    ? 'bg-md3-surface-container-high text-md3-primary'
                    : 'hover:bg-md3-surface-container/60 text-md3-on-surface'
                }`}
              >
                {/* Index / Play Button */}
                <div className="flex items-center justify-center">
                  {isHovered || isSelected ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlayTrack(track);
                      }}
                      className="w-7 h-7 rounded-full bg-md3-primary text-md3-on-primary flex items-center justify-center shadow-sm hover:scale-110 transition-transform"
                    >
                      {isCurrent && isPlaying ? (
                        <Pause className="w-3.5 h-3.5 fill-current" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      )}
                    </button>
                  ) : isCurrent ? (
                    <div className="flex items-center gap-0.5 h-3.5">
                      <span className="w-1 bg-md3-primary rounded-full animate-bounce [animation-delay:0ms] h-full" />
                      <span className="w-1 bg-md3-primary rounded-full animate-bounce [animation-delay:150ms] h-2/3" />
                      <span className="w-1 bg-md3-primary rounded-full animate-bounce [animation-delay:300ms] h-full" />
                    </div>
                  ) : (
                    <span className="text-xs font-mono text-md3-on-surface-variant/60">{idx + 1}</span>
                  )}
                </div>

                {/* Title + Cover */}
                <div className="flex items-center gap-3 min-w-0 pr-3">
                  <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 bg-md3-surface-container-highest shadow-sm relative group">
                    {track.coverArt ? (
                      <img src={track.coverArt} alt={track.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-md3-primary/60 bg-md3-primary/10">
                        <Disc3 className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold truncate ${isCurrent ? 'text-md3-primary' : 'text-md3-on-surface'}`}>
                      {track.title}
                    </p>
                    <p className="text-xs text-md3-on-surface-variant/70 truncate md:hidden">
                      {track.artist}
                    </p>
                  </div>
                </div>

                {/* Artist */}
                <div className="text-xs text-md3-on-surface-variant font-medium truncate pr-3">
                  {track.artist}
                </div>

                {/* Album */}
                <div className="text-xs text-md3-on-surface-variant/80 truncate pr-3">
                  {track.album}
                </div>

                {/* Genre */}
                <div className="text-xs text-md3-on-surface-variant/70 truncate pr-2">
                  {track.genre || '—'}
                </div>

                {/* Duration */}
                <div className="text-xs font-mono text-md3-on-surface-variant/80 text-right pr-2">
                  {formatTime(track.duration)}
                </div>

                {/* Favorite & More */}
                <div className="flex items-center justify-center gap-1">
                  <button
                    onClick={(e) => onToggleFavorite(track.id, e)}
                    className="p-1 rounded-full text-md3-on-surface-variant hover:text-red-500 transition-colors"
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        track.isFavorite ? 'fill-red-500 text-red-500' : 'opacity-40 hover:opacity-100'
                      }`}
                    />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Material 3 Multi-Selection Action Bar (like MusicBee batch operations) */}
      {selectedCount > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2.5 rounded-full bg-md3-surface-container-highest/95 backdrop-blur-md shadow-2xl border border-md3-outline-variant/40 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center gap-2 pr-3 border-r border-md3-outline-variant/40 text-xs font-bold text-md3-on-surface">
            <CheckSquare className="w-4 h-4 text-md3-primary" />
            <span>Выбрано: {selectedCount}</span>
          </div>

          <button
            onClick={onPlaySelected}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-md3-primary text-md3-on-primary text-xs font-semibold hover:opacity-90 shadow-sm"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Воспроизвести</span>
          </button>

          <button
            onClick={onAddSelectedToQueue}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-md3-surface-container text-md3-on-surface text-xs font-semibold hover:bg-md3-surface-container-high"
          >
            <ListPlus className="w-3.5 h-3.5" />
            <span>В очередь</span>
          </button>

          <button
            onClick={onOpenBatchTagEditor}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-md3-secondary-container text-md3-on-secondary-container text-xs font-semibold hover:opacity-90"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Редактировать теги</span>
          </button>

          <button
            onClick={onClearSelection}
            className="p-1.5 rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container hover:text-md3-on-surface"
            title="Снять выделение"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
