import React, { useEffect, useState, useRef } from 'react';
import { X, Trash2, Shuffle, Music, Play, ArrowUp, ArrowDown, GripVertical, AlertTriangle } from 'lucide-react';
import { Track } from '../types/music';
import { formatTime } from '../services/tagEditor';
import { AppLanguage } from '../i18n';
import { useDrawerAnimation } from '../utils/useModalAnimation';

interface QueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  queue: Track[];
  queueIndex: number;
  currentTrack: Track | null;
  language?: AppLanguage;
  isCompact?: boolean;
  onPlayQueueTrack: (index: number) => void;
  onRemoveFromQueue: (index: number) => void;
  onClearQueue: () => void;
  onShuffleQueue: () => void;
  onMoveQueueTrack: (fromIndex: number, toIndex: number) => void;
}

export const QueueDrawer: React.FC<QueueDrawerProps> = ({
  isOpen,
  onClose,
  queue,
  queueIndex,
  currentTrack,
  language = 'ru',
  isCompact,
  onPlayQueueTrack,
  onRemoveFromQueue,
  onClearQueue,
  onShuffleQueue,
  onMoveQueueTrack,
}) => {
  const [internalIsCompact, setInternalIsCompact] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 780 : false
  );

  useEffect(() => {
    const handleResize = () => {
      setInternalIsCompact(window.innerWidth < 780);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const compactMode = isCompact !== undefined ? isCompact : internalIsCompact;
  const [dragState, setDragState] = useState<{
    index: number;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    isDragging: boolean;
  } | null>(null);
  const dragStateRef = useRef<typeof dragState>(null);
  const [dropTarget, setDropTarget] = useState<{ index: number; position: 'above' | 'below' } | null>(null);
  const dropTargetRef = useRef<typeof dropTarget>(null);
  const hasDraggedRef = useRef<boolean>(false);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const currentTrackRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  useEffect(() => {
    dropTargetRef.current = dropTarget;
  }, [dropTarget]);

  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [isOpen, onClose]);

  const handlePointerDown = (e: React.PointerEvent, index: number) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) return;

    const initial = {
      index,
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
      const isDraggingNow = current.isDragging || deltaX > 4 || deltaY > 4;

      if (isDraggingNow) {
        hasDraggedRef.current = true;
        (window as any).__isInternalDragging = true;
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
      }

      const updated = {
        ...current,
        currentX: e.clientX,
        currentY: e.clientY,
        isDragging: isDraggingNow,
      };
      setDragState(updated);
      dragStateRef.current = updated;

      if (!isDraggingNow) return;

      // Auto-scroll list if dragging near edges
      if (listContainerRef.current) {
        const rect = listContainerRef.current.getBoundingClientRect();
        const threshold = 40;
        if (e.clientY < rect.top + threshold && listContainerRef.current.scrollTop > 0) {
          listContainerRef.current.scrollTop -= 8;
        } else if (e.clientY > rect.bottom - threshold && listContainerRef.current.scrollTop < listContainerRef.current.scrollHeight - listContainerRef.current.clientHeight) {
          listContainerRef.current.scrollTop += 8;
        }
      }

      // Find drop target row under pointer
      const element = document.elementFromPoint(e.clientX, e.clientY);
      const rowEl = element?.closest('[data-queue-row-index]');
      if (rowEl) {
        const targetIdxStr = rowEl.getAttribute('data-queue-row-index');
        const targetIndex = targetIdxStr !== null ? parseInt(targetIdxStr, 10) : -1;
        if (targetIndex !== -1 && targetIndex !== current.index) {
          const rect = rowEl.getBoundingClientRect();
          const position = e.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
          const newDrop = { index: targetIndex, position: position as 'above' | 'below' };
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

      if (!current || !current.isDragging || !drop) {
        cleanup();
        return;
      }

      const fromIndex = current.index;
      let targetIndex = drop.index;
      if (drop.position === 'below') {
        targetIndex = fromIndex < drop.index ? drop.index : drop.index + 1;
      } else {
        targetIndex = fromIndex < drop.index ? drop.index - 1 : drop.index;
      }

      const finalTarget = Math.max(0, Math.min(queue.length - 1, targetIndex));
      if (fromIndex !== finalTarget) {
        onMoveQueueTrack(fromIndex, finalTarget);
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
  }, [dragState, queue.length, onMoveQueueTrack]);

  const { isRendered, drawerClass } = useDrawerAnimation(isOpen, 180);

  useEffect(() => {
    if (!isOpen || !isRendered || queue.length === 0) return;

    const frameId = requestAnimationFrame(() => {
      const container = listContainerRef.current;
      const currentRow = currentTrackRowRef.current;
      if (!container || !currentRow) return;

      const containerRect = container.getBoundingClientRect();
      const rowRect = currentRow.getBoundingClientRect();
      const rowTop = rowRect.top - containerRect.top + container.scrollTop;
      const centeredScrollTop = rowTop - (container.clientHeight - currentRow.offsetHeight) / 2;
      container.scrollTo({ top: Math.max(0, centeredScrollTop), behavior: 'auto' });
    });

    return () => cancelAnimationFrame(frameId);
  }, [isOpen, isRendered, queue.length, queueIndex, currentTrack?.id]);

  if (!isRendered) return null;

  return (
    <aside 
      style={{ bottom: compactMode ? '196px' : '96px' }}
      className={`fixed top-7 right-0 w-full sm:w-80 lg:w-96 bg-md3-surface-container shadow-2xl border-l border-md3-outline-variant/30 z-40 flex flex-col select-none ${drawerClass}`}
    >
      {/* Header */}
      <div className="p-4 border-b border-md3-outline-variant/20 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-base text-md3-on-surface">
            {language === 'ru' ? 'Очередь' : 'Queue'}
          </h2>
          <p className="text-xs text-md3-on-surface-variant">
            {queue.length} {language === 'ru' 
              ? (queue.length === 1 ? 'трек' : queue.length < 5 ? 'трека' : 'треков')
              : (queue.length === 1 ? 'track' : 'tracks')
            }
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onShuffleQueue}
            title={language === 'ru' ? 'Перемешать очередь' : 'Shuffle Queue'}
            className="p-1.5 rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container-high hover:text-md3-on-surface cursor-pointer"
          >
            <Shuffle className="w-4 h-4" />
          </button>
          <button
            onClick={onClearQueue}
            title={language === 'ru' ? 'Очистить очередь [X]' : 'Clear Queue [X]'}
            className="p-1.5 rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container-high hover:text-red-400 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            title={language === 'ru' ? 'Закрыть очередь [Q / Esc]' : 'Close Queue [Q / Esc]'}
            className="p-1.5 rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container-high hover:text-md3-on-surface cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Queue items list */}
      <div ref={listContainerRef} className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {queue.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center text-md3-on-surface-variant text-sm p-4">
            <Music className="w-8 h-8 opacity-40 mb-2" />
            <span>{language === 'ru' ? 'Очередь воспроизведения пуста' : 'Playback queue is empty'}</span>
          </div>
        ) : (
          queue.map((track, idx) => {
            const isCurrent = idx === queueIndex;
            const isBeingDragged = dragState?.isDragging && dragState.index === idx;
            const isDropAbove = dropTarget?.index === idx && dropTarget.position === 'above';
            const isDropBelow = dropTarget?.index === idx && dropTarget.position === 'below';

            return (
              <div
                key={`${track.id}-${idx}`}
                ref={isCurrent ? currentTrackRowRef : undefined}
                data-queue-row-index={idx}
                onPointerDown={(e) => handlePointerDown(e, idx)}
                className={`relative group flex items-center justify-between p-2 rounded-2xl transition-all select-none ${
                  isBeingDragged
                    ? 'opacity-30 bg-md3-primary/10 border-dashed border border-md3-primary/40'
                    : isCurrent
                    ? 'bg-md3-primary-container text-md3-on-primary-container font-semibold shadow-sm'
                    : 'hover:bg-md3-surface-container-high text-md3-on-surface'
                }`}
              >
                {/* Drop Indicator Lines */}
                {isDropAbove && (
                  <div className="absolute top-0 left-2 right-2 h-0.5 bg-md3-primary rounded-full z-20 pointer-events-none shadow-[0_0_8px_rgba(var(--primary-rgb),0.8)] flex items-center justify-between">
                    <div className="w-1.5 h-1.5 rounded-full bg-md3-primary -ml-1 ring-2 ring-md3-surface-container" />
                    <div className="w-1.5 h-1.5 rounded-full bg-md3-primary -mr-1 ring-2 ring-md3-surface-container" />
                  </div>
                )}
                {isDropBelow && (
                  <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-md3-primary rounded-full z-20 pointer-events-none shadow-[0_0_8px_rgba(var(--primary-rgb),0.8)] flex items-center justify-between">
                    <div className="w-1.5 h-1.5 rounded-full bg-md3-primary -ml-1 ring-2 ring-md3-surface-container" />
                    <div className="w-1.5 h-1.5 rounded-full bg-md3-primary -mr-1 ring-2 ring-md3-surface-container" />
                  </div>
                )}

                {/* Drag handle */}
                <div 
                  className="cursor-grab active:cursor-grabbing text-md3-on-surface-variant/40 hover:text-md3-on-surface-variant p-1 mr-1 shrink-0 rounded transition-colors"
                  title="Перетащите для изменения порядка"
                >
                  <GripVertical className="w-3.5 h-3.5" />
                </div>

                <div 
                  onClick={() => {
                    if (hasDraggedRef.current) return;
                    onPlayQueueTrack(idx);
                  }}
                  className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer pr-2"
                >
                  <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-md3-surface-container-highest shadow-sm relative">
                    {track.coverArt ? (
                      <img src={track.coverArt} alt={track.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-md3-primary/60 bg-md3-primary/10">
                        <Music className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className={`text-xs font-bold truncate ${
                        track.isMissing 
                          ? 'text-amber-500/90 dark:text-amber-400/90' 
                          : isCurrent 
                          ? 'text-md3-on-primary-container' 
                          : 'text-md3-on-surface'
                      }`}>
                        {track.title}
                      </p>
                      {track.isMissing && (
                        <span title="Файл не найден">
                          <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-md3-on-surface-variant truncate">
                      {track.artist}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {idx > 0 && (
                    <button
                      onClick={() => onMoveQueueTrack(idx, idx - 1)}
                      className="p-1 rounded-full text-md3-on-surface-variant hover:text-md3-on-surface cursor-pointer"
                      title="Переместить выше"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {idx < queue.length - 1 && (
                    <button
                      onClick={() => onMoveQueueTrack(idx, idx + 1)}
                      className="p-1 rounded-full text-md3-on-surface-variant hover:text-md3-on-surface cursor-pointer"
                      title="Переместить ниже"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => onRemoveFromQueue(idx)}
                    className="p-1 rounded-full text-md3-on-surface-variant hover:text-red-400 cursor-pointer"
                    title="Удалить из очереди"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Drag Preview */}
      {dragState?.isDragging && queue[dragState.index] && (
        <div
          style={{
            position: 'fixed',
            left: `${dragState.currentX + 12}px`,
            top: `${dragState.currentY + 12}px`,
            pointerEvents: 'none',
            zIndex: 9999,
          }}
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-md3-surface-container-highest/95 backdrop-blur-md border border-md3-primary/40 shadow-2xl text-xs font-semibold text-md3-on-surface max-w-[240px] ring-1 ring-black/10 animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="w-6 h-6 rounded-lg overflow-hidden shrink-0 bg-md3-surface-container-high flex items-center justify-center">
            {queue[dragState.index].coverArt ? (
              <img src={queue[dragState.index].coverArt} alt="" className="w-full h-full object-cover" />
            ) : (
              <Music className="w-3.5 h-3.5 text-md3-primary" />
            )}
          </div>
          <span className="truncate">{queue[dragState.index].title}</span>
        </div>
      )}
    </aside>
  );
};
