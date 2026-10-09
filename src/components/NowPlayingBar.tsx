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
  Disc3
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
  onOpenEQ?: () => void;
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
}) => {
  const [hoverSeekTime, setHoverSeekTime] = useState<number | null>(null);
  const [hoverSeekPos, setHoverSeekPos] = useState<number>(0);
  const [showRemainingTime, setShowRemainingTime] = useState<boolean>(false);
  const [visBars, setVisBars] = useState<number[]>([20, 40, 60, 80, 50, 30, 70, 25]);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);

  // Animated visualizer loop
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
            heights.push(Math.max(15, Math.min(100, Math.round((val / 255) * 100))));
          }
          setVisBars(heights);
        }
      } else {
        setVisBars([15, 15, 15, 15, 15, 15, 15, 15]);
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
    <footer className="h-22 w-full shrink-0 bg-md3-surface-container-high/95 backdrop-blur-xl border-t border-md3-outline-variant/15 px-6 flex items-center justify-between select-none relative z-30 transition-colors duration-300">
      {/* Top Embedded Timeline Scrubber */}
      <div 
        ref={progressBarRef}
        onMouseMove={handleProgressBarMouseMove}
        onMouseLeave={() => setHoverSeekTime(null)}
        onClick={handleProgressBarClick}
        className="absolute -top-1 left-0 right-0 h-2 hover:h-3 group cursor-pointer bg-md3-surface-container-highest/60 transition-all duration-200"
      >
        {/* Progress fill */}
        <div 
          className="h-full bg-md3-primary relative transition-all duration-75"
          style={{ width: `${progressPercent}%` }}
        >
          {/* Glowing Scrubber Thumb */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3.5 h-3.5 rounded-full bg-md3-primary shadow-lg ring-2 ring-md3-on-primary opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Hover preview tooltip */}
        {hoverSeekTime !== null && (
          <div 
            className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded-lg bg-md3-surface-container-highest text-md3-on-surface text-[11px] font-mono shadow-xl border border-md3-outline-variant/20 pointer-events-none"
            style={{ left: `${hoverSeekPos}px` }}
          >
            {formatTime(hoverSeekTime)}
          </div>
        )}
      </div>

      {/* Left: Cover Art & Track Metadata */}
      <div className="flex items-center gap-3.5 w-1/4 min-w-[240px]">
        {/* Cover Art with subtle glow */}
        <div className="w-13 h-13 rounded-2xl overflow-hidden shrink-0 bg-md3-surface-container shadow-md border border-md3-outline-variant/15 relative group">
          {currentTrack?.coverArt ? (
            <img 
              src={currentTrack.coverArt} 
              alt={currentTrack.title} 
              className={`w-full h-full object-cover transition-transform duration-300 ${isPlaying ? 'scale-105' : ''}`} 
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-md3-primary/10 text-md3-primary">
              <Disc3 className={`w-7 h-7 ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
            </div>
          )}
        </div>

        {/* Title & Artist */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-md3-on-surface truncate">
              {currentTrack ? currentTrack.title : 'Ничего не играет'}
            </p>
            {currentTrack?.format && (
              <span className="px-1.5 py-0.2 rounded-md bg-md3-surface-container text-[10px] font-mono font-semibold text-md3-on-surface-variant/80 border border-md3-outline-variant/15 shrink-0">
                {currentTrack.format}
              </span>
            )}
          </div>
          <p className="text-xs text-md3-on-surface-variant truncate font-medium mt-0.5">
            {currentTrack ? (
              <>
                <span>{currentTrack.artist}</span>
                {currentTrack.album && <span className="opacity-60"> — {currentTrack.album}</span>}
              </>
            ) : (
              'Выберите трек из библиотеки'
            )}
          </p>
        </div>

        {/* Favorite Heart Button */}
        {currentTrack && (
          <button
            onClick={(e) => onToggleFavorite(currentTrack.id, e)}
            title={currentTrack.isFavorite ? 'Удалить из любимых' : 'Добавить в любимые'}
            className="p-2 rounded-full text-md3-on-surface-variant hover:text-red-500 transition-colors cursor-pointer"
          >
            <Heart className={`w-4 h-4 transition-transform active:scale-125 ${currentTrack.isFavorite ? 'fill-red-500 text-red-500 scale-110' : 'opacity-40 hover:opacity-100'}`} />
          </button>
        )}
      </div>

      {/* Center: Playback Controls & Timeline */}
      <div className="flex flex-col items-center justify-center gap-1.5 w-2/4 max-w-md">
        {/* Main Controls Row */}
        <div className="flex items-center gap-3">
          {/* Shuffle */}
          <button
            onClick={onToggleShuffle}
            title={isShuffled ? 'Случайный порядок включен' : 'Перемешать треки'}
            className={`p-2 rounded-full transition-colors relative cursor-pointer ${
              isShuffled ? 'text-md3-primary bg-md3-primary/10' : 'text-md3-on-surface-variant hover:text-md3-on-surface'
            }`}
          >
            <Shuffle className="w-4 h-4" />
            {isShuffled && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-md3-primary" />}
          </button>

          {/* Previous */}
          <button
            onClick={onPrev}
            title="Предыдущий трек (Ctrl + Стрелка влево)"
            className="p-2 rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container hover:text-md3-on-surface transition-colors cursor-pointer"
          >
            <SkipBack className="w-4 h-4 fill-current" />
          </button>

          {/* Play / Pause FAB */}
          <button
            onClick={onPlayPause}
            title={isPlaying ? 'Пауза (Пробел)' : 'Воспроизведение (Пробел)'}
            className="w-11 h-11 rounded-full bg-md3-primary text-md3-on-primary flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-transform duration-150 cursor-pointer"
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
            title="Следующий трек (Ctrl + Стрелка вправо)"
            className="p-2 rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container hover:text-md3-on-surface transition-colors cursor-pointer"
          >
            <SkipForward className="w-4 h-4 fill-current" />
          </button>

          {/* Repeat */}
          <button
            onClick={onToggleRepeat}
            title={`Повтор: ${repeatMode === 'off' ? 'Откл' : repeatMode === 'all' ? 'Все' : 'Один'}`}
            className={`p-2 rounded-full transition-colors relative cursor-pointer ${
              repeatMode !== 'off' ? 'text-md3-primary bg-md3-primary/10' : 'text-md3-on-surface-variant hover:text-md3-on-surface'
            }`}
          >
            {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
            {repeatMode !== 'off' && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-md3-primary" />}
          </button>
        </div>

        {/* Embedded Time Numbers */}
        <div className="flex items-center gap-2 text-[11px] font-mono text-md3-on-surface-variant/80">
          <span>{formatTime(currentTime)}</span>
          <span className="opacity-40">/</span>
          <span 
            onClick={() => setShowRemainingTime(!showRemainingTime)}
            className="cursor-pointer hover:text-md3-on-surface transition-colors"
            title="Кликните для переключения оставшегося времени"
          >
            {showRemainingTime ? `-${formatTime(Math.max(0, duration - currentTime))}` : formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Right: Visualizer, Volume, Queue */}
      <div className="flex items-center justify-end gap-3 w-1/4 min-w-[240px]">
        {/* Animated Spectrum Visualizer */}
        <div 
          className="hidden md:flex items-end gap-1 h-5 px-2 py-0.5 pointer-events-none"
          title="Спектр воспроизведения"
        >
          {visBars.map((height, i) => (
            <span
              key={i}
              className="w-1 rounded-full bg-md3-primary/80 transition-all duration-75"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>

        {/* Volume controls with smooth slider */}
        <div className="flex items-center gap-1.5 group">
          <button
            onClick={onToggleMute}
            title={isMuted ? 'Включить звук' : 'Выключить звук'}
            className="p-1.5 rounded-full text-md3-on-surface-variant hover:text-md3-on-surface transition-colors cursor-pointer"
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

        {/* Queue Drawer Button */}
        <button
          onClick={onToggleQueue}
          title="Очередь воспроизведения"
          className={`relative p-2.5 rounded-full transition-colors cursor-pointer ${
            isQueueOpen
              ? 'bg-md3-primary text-md3-on-primary'
              : 'text-md3-on-surface-variant hover:bg-md3-surface-container hover:text-md3-on-surface'
          }`}
        >
          <ListMusic className="w-4 h-4" />
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
