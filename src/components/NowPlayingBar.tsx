import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Shuffle, 
  Repeat, 
  Repeat1, 
  Volume2, 
  VolumeX, 
  Volume1,
  Heart, 
  ListMusic, 
  SlidersHorizontal,
  Maximize2,
  Disc3,
  Activity
} from 'lucide-react';
import { Track } from '../types/music';
import { formatTime } from '../services/tagEditor';
import { audioEngine } from '../services/audioEngine';

interface NowPlayingBarProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  repeatMode: 'off' | 'all' | 'one';
  isShuffled: boolean;
  queueCount: number;
  isQueueOpen: boolean;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  onToggleQueue: () => void;
  onToggleFavorite: (trackId: string, e: React.MouseEvent) => void;
  onOpenEQ: () => void;
}

export const NowPlayingBar: React.FC<NowPlayingBarProps> = ({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  repeatMode,
  isShuffled,
  queueCount,
  isQueueOpen,
  onPlayPause,
  onPrev,
  onNext,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleShuffle,
  onToggleRepeat,
  onToggleQueue,
  onToggleFavorite,
  onOpenEQ,
}) => {
  const [hoverSeekTime, setHoverSeekTime] = useState<number | null>(null);
  const [hoverSeekPos, setHoverSeekPos] = useState<number>(0);
  const [showRemainingTime, setShowRemainingTime] = useState<boolean>(false);
  const [visBars, setVisBars] = useState<number[]>([15, 30, 45, 60, 40, 25, 50, 20]);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);

  // Visualizer loop
  useEffect(() => {
    let active = true;
    const updateVis = () => {
      if (isPlaying) {
        const data = audioEngine.getVisualizerData();
        if (data && data.length >= 8) {
          const step = Math.floor(data.length / 8);
          const heights = [];
          for (let i = 0; i < 8; i++) {
            const val = data[i * step] || 0;
            heights.push(Math.max(10, Math.min(100, Math.round((val / 255) * 100))));
          }
          setVisBars(heights);
        }
      } else {
        setVisBars([10, 10, 10, 10, 10, 10, 10, 10]);
      }
      if (active) {
        animFrameRef.current = requestAnimationFrame(updateVis);
      }
    };

    animFrameRef.current = requestAnimationFrame(updateVis);
    return () => {
      active = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying]);

  const handleProgressBarMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || duration <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverSeekPos(e.clientX - rect.left);
    setHoverSeekTime(pos * duration);
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || duration <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(pos * duration);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <footer className="h-24 w-full shrink-0 bg-md3-surface-container-high border-t border-md3-outline-variant/30 px-6 flex items-center justify-between select-none relative z-30 transition-colors duration-300">
      {/* Top Floating Mini Progress Scrubber across entire width */}
      <div 
        ref={progressBarRef}
        onMouseMove={handleProgressBarMouseMove}
        onMouseLeave={() => setHoverSeekTime(null)}
        onClick={handleProgressBarClick}
        className="absolute top-0 left-0 right-0 h-1.5 hover:h-3 group cursor-pointer bg-md3-surface-container-highest transition-all duration-200"
      >
        {/* Progress fill */}
        <div 
          className="h-full bg-md3-primary relative transition-all duration-75"
          style={{ width: `${progressPercent}%` }}
        >
          {/* Scrubber thumb */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3.5 h-3.5 rounded-full bg-md3-primary shadow-md opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Hover preview tooltip */}
        {hoverSeekTime !== null && (
          <div 
            className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded-md bg-md3-surface-container-highest text-md3-on-surface text-[11px] font-mono shadow-lg border border-md3-outline-variant/40 pointer-events-none"
            style={{ left: `${hoverSeekPos}px` }}
          >
            {formatTime(hoverSeekTime)}
          </div>
        )}
      </div>

      {/* Left: Track Details & Album Art */}
      <div className="flex items-center gap-4 w-1/4 min-w-[220px]">
        <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 bg-md3-surface-container-highest shadow-md relative group">
          {currentTrack?.coverArt ? (
            <img 
              src={currentTrack.coverArt} 
              alt={currentTrack.title} 
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" 
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-md3-primary/10 text-md3-primary">
              <Disc3 className="w-7 h-7" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-md3-on-surface truncate">
            {currentTrack ? currentTrack.title : 'Ничего не играет'}
          </p>
          <p className="text-xs text-md3-on-surface-variant truncate font-medium mt-0.5">
            {currentTrack ? currentTrack.artist : 'Выберите трек для воспроизведения'}
          </p>
        </div>

        {currentTrack && (
          <button
            onClick={(e) => onToggleFavorite(currentTrack.id, e)}
            className="p-2 rounded-full text-md3-on-surface-variant hover:text-red-500 transition-colors"
          >
            <Heart className={`w-5 h-5 ${currentTrack.isFavorite ? 'fill-red-500 text-red-500' : 'opacity-40 hover:opacity-100'}`} />
          </button>
        )}
      </div>

      {/* Center: Playback Controls */}
      <div className="flex flex-col items-center justify-center gap-1.5 w-2/4 max-w-lg">
        <div className="flex items-center gap-3">
          {/* Shuffle */}
          <button
            onClick={onToggleShuffle}
            title={isShuffled ? 'Случайный порядок включен' : 'Перемешать'}
            className={`p-2 rounded-full transition-colors relative ${
              isShuffled ? 'text-md3-primary bg-md3-primary/10' : 'text-md3-on-surface-variant hover:text-md3-on-surface'
            }`}
          >
            <Shuffle className="w-4 h-4" />
            {isShuffled && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-md3-primary" />}
          </button>

          {/* Previous */}
          <button
            onClick={onPrev}
            title="Предыдущий трек"
            className="p-2 rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container hover:text-md3-on-surface transition-colors"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          {/* Play / Pause FAB Button */}
          <button
            onClick={onPlayPause}
            title={isPlaying ? 'Пауза (Пробел)' : 'Воспроизведение (Пробел)'}
            className="w-12 h-12 rounded-full bg-md3-primary text-md3-on-primary flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform duration-150"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>

          {/* Next */}
          <button
            onClick={onNext}
            title="Следующий трек"
            className="p-2 rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container hover:text-md3-on-surface transition-colors"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>

          {/* Repeat */}
          <button
            onClick={onToggleRepeat}
            title={`Повтор: ${repeatMode === 'off' ? 'Откл' : repeatMode === 'all' ? 'Все' : 'Один'}`}
            className={`p-2 rounded-full transition-colors relative ${
              repeatMode !== 'off' ? 'text-md3-primary bg-md3-primary/10' : 'text-md3-on-surface-variant hover:text-md3-on-surface'
            }`}
          >
            {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
            {repeatMode !== 'off' && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-md3-primary" />}
          </button>
        </div>

        {/* Time display */}
        <div className="flex items-center gap-2 text-xs font-mono text-md3-on-surface-variant">
          <span>{formatTime(currentTime)}</span>
          <span>/</span>
          <span 
            onClick={() => setShowRemainingTime(!showRemainingTime)}
            className="cursor-pointer hover:text-md3-on-surface"
            title="Кликните для переключения оставшегося времени"
          >
            {showRemainingTime ? `-${formatTime(Math.max(0, duration - currentTime))}` : formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Right: Visualizer, Volume, Queue */}
      <div className="flex items-center justify-end gap-3 w-1/4 min-w-[220px]">
        {/* Animated Mini Spectrum Visualizer */}
        <div 
          onClick={onOpenEQ}
          title="Открыть эквалайзер"
          className="hidden md:flex items-end gap-0.5 h-6 px-2 py-1 rounded-lg hover:bg-md3-surface-container cursor-pointer transition-colors"
        >
          {visBars.map((height, i) => (
            <span
              key={i}
              className="w-1 rounded-full bg-md3-primary transition-all duration-75"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>

        {/* Volume controls */}
        <div className="flex items-center gap-2 group">
          <button
            onClick={onToggleMute}
            className="p-1.5 rounded-full text-md3-on-surface-variant hover:text-md3-on-surface transition-colors"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-red-400" />
            ) : volume < 0.5 ? (
              <Volume1 className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>

          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="w-20 accent-md3-primary h-1.5 rounded-full bg-md3-surface-container-highest cursor-pointer"
          />
        </div>

        {/* Queue Drawer Toggle */}
        <button
          onClick={onToggleQueue}
          title="Очередь воспроизведения"
          className={`relative p-2.5 rounded-full transition-colors ${
            isQueueOpen
              ? 'bg-md3-primary text-md3-on-primary'
              : 'text-md3-on-surface-variant hover:bg-md3-surface-container hover:text-md3-on-surface'
          }`}
        >
          <ListMusic className="w-5 h-5" />
          {queueCount > 0 && (
            <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-md3-tertiary text-md3-on-tertiary shadow-sm">
              {queueCount}
            </span>
          )}
        </button>
      </div>
    </footer>
  );
};
