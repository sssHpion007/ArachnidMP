import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  Heart, 
  Clock, 
  Edit3, 
  ListPlus, 
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
  isReorderable?: boolean;
  onReorderTracks?: (reorderedTrackIds: string[]) => void;
}

interface TrackDragState {
  trackId: string;
  title: string;
  artist: string;
  cover?: string | null;
  count: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  isDragging: boolean;
}

interface DropTargetState {
  trackId: string;
  position: 'above' | 'below';
  index: number;
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
  isReorderable = false,
  onReorderTracks,
}) => {
  const [hoveredTrackId, setHoveredTrackId] = useState<string | null>(null);

  // Pointer-based Drag & Drop Engine for Smooth Track Reordering
  const [dragState, setDragState] = useState<TrackDragState | null>(null);
  const dragStateRef = useRef<TrackDragState | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTargetState | null>(null);
  const dropTargetRef = useRef<DropTargetState | null>(null);
  const hasDraggedRef = useRef<boolean>(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent, track: Track, index: number) => {
    if (!isReorderable || !onReorderTracks) return;
    if (e.button !== 0) return;

    // Don't start drag if clicking interactive controls
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('a')) {
      return;
    }

    const isSelected = selectedTrackIds.has(track.id);
    const count = isSelected ? Math.max(1, selectedTrackIds.size) : 1;

    const initial: TrackDragState = {
      trackId: track.id,
      title: track.title,
      artist: track.artist,
      cover: track.coverArt,
      count,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      isDragging: false,
    };

    setDragState(initial);
    dragStateRef.current = initial;
    hasDraggedRef.current = false;
  };

  useEffect(() => {
    if (!dragState) return;

    const handlePointerMove = (e: PointerEvent) => {
      const current = dragStateRef.current;
      if (!current) return;

      const deltaX = Math.abs(e.clientX - current.startX);
      const deltaY = Math.abs(e.clientY - current.startY);
      const isDraggingNow = current.isDragging || deltaX > 5 || deltaY > 5;

      if (isDraggingNow) {
        hasDraggedRef.current = true;
        (window as any).__isInternalDragging = true;
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
      }

      const updated: TrackDragState = {
        ...current,
        currentX: e.clientX,
        currentY: e.clientY,
        isDragging: isDraggingNow,
      };
      setDragState(updated);
      dragStateRef.current = updated;

      if (!isDraggingNow) return;

      // Auto-scroll list if dragging near edges
      if (scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        const rect = container.getBoundingClientRect();
        const edgeThreshold = 50;
        if (e.clientY < rect.top + edgeThreshold && container.scrollTop > 0) {
          const factor = (rect.top + edgeThreshold - e.clientY) / edgeThreshold;
          container.scrollTop -= Math.max(2, Math.min(20, factor * 20));
        } else if (e.clientY > rect.bottom - edgeThreshold && container.scrollTop < container.scrollHeight - container.clientHeight) {
          const factor = (e.clientY - (rect.bottom - edgeThreshold)) / edgeThreshold;
          container.scrollTop += Math.max(2, Math.min(20, factor * 20));
        }
      }

      // Find row under cursor
      const element = document.elementFromPoint(e.clientX, e.clientY);
      const rowEl = element?.closest('[data-track-row-id]');
      if (rowEl) {
        const targetId = rowEl.getAttribute('data-track-row-id');
        const targetIdxStr = rowEl.getAttribute('data-track-row-index');
        const targetIndex = targetIdxStr ? parseInt(targetIdxStr, 10) : -1;
        if (targetId && targetIndex !== -1) {
          const rect = rowEl.getBoundingClientRect();
          const position = e.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
          const newDrop: DropTargetState = { trackId: targetId, position, index: targetIndex };
          setDropTarget(newDrop);
          dropTargetRef.current = newDrop;
          return;
        }
      }
      setDropTarget(null);
      dropTargetRef.current = null;
    };

    const handlePointerUp = () => {
      const current = dragStateRef.current;
      const drop = dropTargetRef.current;

      const cleanup = () => {
        setDragState(null);
        dragStateRef.current = null;
        setDropTarget(null);
        dropTargetRef.current = null;
        (window as any).__isInternalDragging = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        setTimeout(() => {
          hasDraggedRef.current = false;
        }, 80);
      };

      if (!current || !current.isDragging || !drop || !onReorderTracks) {
        cleanup();
        return;
      }

      const draggedTrackId = current.trackId;
      let idsToMove: string[] = [];
      if (selectedTrackIds.has(draggedTrackId)) {
        idsToMove = tracks.filter(t => selectedTrackIds.has(t.id)).map(t => t.id);
      } else {
        idsToMove = [draggedTrackId];
      }

      if (idsToMove.includes(drop.trackId)) {
        cleanup();
        return;
      }

      const currentIds = tracks.map(t => t.id);
      const remaining = currentIds.filter(id => !idsToMove.includes(id));
      let targetIdx = remaining.indexOf(drop.trackId);
      if (targetIdx !== -1) {
        if (drop.position === 'below') {
          targetIdx += 1;
        }
        remaining.splice(targetIdx, 0, ...idsToMove);
        onReorderTracks(remaining);
      }

      cleanup();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [dragState, tracks, selectedTrackIds, onReorderTracks]);

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
  const gridCols = isReorderable
    ? 'grid-cols-[56px_minmax(200px,2fr)_minmax(140px,1.5fr)_minmax(140px,1.5fr)_90px_70px_48px]'
    : 'grid-cols-[48px_minmax(200px,2fr)_minmax(140px,1.5fr)_minmax(140px,1.5fr)_90px_70px_48px]';

  return (
    <div 
      onDragOver={handleTableDragOver}
      onDrop={handleTableDrop}
      className="flex-1 flex flex-col h-full min-h-0 bg-md3-surface select-none relative"
    >
      {/* Table Header */}
      <div className={`grid ${gridCols} items-center px-4 py-2.5 text-xs font-semibold text-md3-on-surface-variant/70 border-b border-md3-outline-variant/20 tracking-wider uppercase`}>
        <div 
          onClick={() => onSortChange(isReorderable ? 'custom' : 'title')}
          className="flex items-center justify-center gap-1 cursor-pointer hover:text-md3-primary"
          title={isReorderable ? "Порядок в плейлисте (нажмите для сброса сортировки)" : "Номер"}
        >
          {isReorderable && <GripVertical className="w-3.5 h-3.5 opacity-50" />}
          <span>#</span>
          {sortBy === 'custom' && <ArrowUpDown className="w-3 h-3 text-md3-primary" />}
        </div>
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
          <span>Исполнитель</span>
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
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto min-h-0 divide-y divide-md3-outline-variant/10 custom-scrollbar"
      >
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
            const isDropAbove = dropTarget?.trackId === track.id && dropTarget.position === 'above';
            const isDropBelow = dropTarget?.trackId === track.id && dropTarget.position === 'below';
            const isBeingDragged = dragState?.isDragging && (
              selectedTrackIds.has(dragState.trackId) 
                ? selectedTrackIds.has(track.id) 
                : dragState.trackId === track.id
            );

            return (
              <div
                key={track.id}
                data-track-row-id={track.id}
                data-track-row-index={idx}
                onPointerDown={(e) => handlePointerDown(e, track, idx)}
                onMouseEnter={() => setHoveredTrackId(track.id)}
                onMouseLeave={() => setHoveredTrackId(null)}
                onClick={(e) => {
                  if (hasDraggedRef.current) return;
                  onSelectTrack(track.id, e, idx);
                }}
                onDoubleClick={() => {
                  if (hasDraggedRef.current) return;
                  onPlayTrack(track);
                }}
                onContextMenu={(e) => onOpenContextMenu(e, track)}
                className={`relative grid ${gridCols} items-center px-4 py-2 cursor-pointer transition-colors duration-150 ${
                  isBeingDragged
                    ? 'opacity-30 bg-md3-primary-container/20 border-dashed border border-md3-primary/30'
                    : isSelected
                    ? 'bg-md3-primary-container/40 text-md3-on-surface'
                    : isCurrent
                    ? 'bg-md3-surface-container-high text-md3-primary'
                    : 'hover:bg-md3-surface-container/60 text-md3-on-surface'
                }`}
              >
                {/* Drop insertion line indicators */}
                {isDropAbove && (
                  <div className="absolute top-0 left-2 right-2 h-0.5 bg-md3-primary rounded-full z-20 pointer-events-none shadow-[0_0_8px_rgba(var(--primary-rgb),0.8)] flex items-center justify-between">
                    <div className="w-2 h-2 rounded-full bg-md3-primary -ml-1 ring-2 ring-md3-surface" />
                    <div className="w-2 h-2 rounded-full bg-md3-primary -mr-1 ring-2 ring-md3-surface" />
                  </div>
                )}
                {isDropBelow && (
                  <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-md3-primary rounded-full z-20 pointer-events-none shadow-[0_0_8px_rgba(var(--primary-rgb),0.8)] flex items-center justify-between">
                    <div className="w-2 h-2 rounded-full bg-md3-primary -ml-1 ring-2 ring-md3-surface" />
                    <div className="w-2 h-2 rounded-full bg-md3-primary -mr-1 ring-2 ring-md3-surface" />
                  </div>
                )}

                {/* Index / Grip / Play Button */}
                <div className="flex items-center justify-center gap-1">
                  {isReorderable && (
                    <div
                      className="text-md3-on-surface-variant/40 hover:text-md3-primary p-0.5 cursor-grab active:cursor-grabbing transition-colors shrink-0"
                      title="Зажмите и перетащите для изменения порядка треков"
                    >
                      <GripVertical className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div className="w-7 h-7 flex items-center justify-center shrink-0">
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

      {/* Floating Drag Ghost Badge */}
      {dragState && dragState.isDragging && (
        <div
          style={{
            position: 'fixed',
            left: dragState.currentX + 16,
            top: dragState.currentY + 16,
            pointerEvents: 'none',
            zIndex: 9999,
          }}
          className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-md3-surface-container-highest/95 backdrop-blur-md border border-md3-primary/40 shadow-2xl text-xs font-semibold text-md3-on-surface max-w-xs animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/10"
        >
          <div className="w-8 h-8 rounded-xl overflow-hidden shrink-0 bg-md3-surface-container-high flex items-center justify-center shadow-inner">
            {dragState.cover ? (
              <img src={dragState.cover} alt="" className="w-full h-full object-cover" />
            ) : (
              <Music className="w-4 h-4 text-md3-primary" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-md3-on-surface">{dragState.title}</p>
            <p className="truncate text-[11px] text-md3-on-surface-variant font-medium">
              {dragState.count > 1 ? `Перемещение ${dragState.count} треков` : dragState.artist}
            </p>
          </div>
        </div>
      )}

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
