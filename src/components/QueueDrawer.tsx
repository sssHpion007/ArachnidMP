import React, { useEffect } from 'react';
import { X, Trash2, Shuffle, Music, Play, ArrowUp, ArrowDown } from 'lucide-react';
import { Track } from '../types/music';
import { formatTime } from '../services/tagEditor';

interface QueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  queue: Track[];
  queueIndex: number;
  currentTrack: Track | null;
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
  onPlayQueueTrack,
  onRemoveFromQueue,
  onClearQueue,
  onShuffleQueue,
  onMoveQueueTrack,
}) => {
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

  if (!isOpen) return null;

  return (
    <aside className="fixed top-0 right-0 bottom-24 w-80 lg:w-96 bg-md3-surface-container shadow-2xl border-l border-md3-outline-variant/30 z-40 flex flex-col animate-in slide-in-from-right duration-200 select-none">
      {/* Header */}
      <div className="p-4 border-b border-md3-outline-variant/20 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-base text-md3-on-surface">Очередь</h2>
          <p className="text-xs text-md3-on-surface-variant">
            {queue.length} {queue.length === 1 ? 'трек' : queue.length < 5 ? 'трека' : 'треков'}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onShuffleQueue}
            title="Перемешать очередь"
            className="p-1.5 rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container-high hover:text-md3-on-surface"
          >
            <Shuffle className="w-4 h-4" />
          </button>
          <button
            onClick={onClearQueue}
            title="Очистить очередь"
            className="p-1.5 rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container-high hover:text-red-400"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container-high hover:text-md3-on-surface"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Queue items list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {queue.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center text-md3-on-surface-variant text-sm p-4">
            <Music className="w-8 h-8 opacity-40 mb-2" />
            <span>Очередь воспроизведения пуста</span>
          </div>
        ) : (
          queue.map((track, idx) => {
            const isCurrent = idx === queueIndex;
            return (
              <div
                key={`${track.id}-${idx}`}
                className={`group flex items-center justify-between p-2 rounded-2xl transition-all ${
                  isCurrent
                    ? 'bg-md3-primary-container text-md3-on-primary-container font-semibold shadow-sm'
                    : 'hover:bg-md3-surface-container-high text-md3-on-surface'
                }`}
              >
                <div 
                  onClick={() => onPlayQueueTrack(idx)}
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
                    <p className={`text-xs font-bold truncate ${isCurrent ? 'text-md3-on-primary-container' : 'text-md3-on-surface'}`}>
                      {track.title}
                    </p>
                    <p className="text-[11px] text-md3-on-surface-variant truncate">
                      {track.artist}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {idx > 0 && (
                    <button
                      onClick={() => onMoveQueueTrack(idx, idx - 1)}
                      className="p-1 rounded-full text-md3-on-surface-variant hover:text-md3-on-surface"
                      title="Переместить выше"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {idx < queue.length - 1 && (
                    <button
                      onClick={() => onMoveQueueTrack(idx, idx + 1)}
                      className="p-1 rounded-full text-md3-on-surface-variant hover:text-md3-on-surface"
                      title="Переместить ниже"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => onRemoveFromQueue(idx)}
                    className="p-1 rounded-full text-md3-on-surface-variant hover:text-red-400"
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
    </aside>
  );
};
