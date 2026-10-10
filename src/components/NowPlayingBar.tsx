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
  Disc3,
  Mic2
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
  onOpenTrackDetails?: (track: Track) => void;
  onOpenLyrics?: () => void;
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
  onOpenTrackDetails,
  onOpenLyrics,
}) => {
  const [hoverSeekTime, setHoverSeekTime] = useState<number | null>(null);
  const [hoverSeekPos, setHoverSeekPos] = useState<number>(0);
  const [visBars, setVisBars] = useState<number[]>([20, 40, 60, 80, 50, 30, 70, 25]);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [scrubPosition, setScrubPosition] = useState<number | null>(null);
  const isScrubbingRef = useRef<boolean>(false);
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

  const safeDuration = (duration > 0 && isFinite(duration) && !isNaN(duration)) ? duration : (currentTrack?.duration || 0);
  const safeCurrentTime = Math.max(0, Math.min(safeDuration > 0 ? safeDuration : Infinity, currentTime || 0));
  const effectiveDisplayTime = isScrubbing && scrubPosition !== null ? scrubPosition : safeCurrentTime;
  const progressPercent = safeDuration > 0 ? Math.min(100, Math.max(0, (effectiveDisplayTime / safeDuration) * 100)) : 0;
  const remainingTime = Math.max(0, safeDuration - effectiveDisplayTime);

  const handleProgressBarPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || safeDuration <= 0) return;
    try {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch (_) {}
    isScrubbingRef.current = true;
    setIsScrubbing(true);
    audioEngine.setScrubbing(true);

    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetTime = pos * safeDuration;
    setScrubPosition(targetTime);
    setHoverSeekPos(e.clientX - rect.left);
    setHoverSeekTime(targetTime);
  };

  const handleProgressBarPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || safeDuration <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetTime = pos * safeDuration;
    setHoverSeekPos(e.clientX - rect.left);
    setHoverSeekTime(targetTime);

    if (isScrubbingRef.current) {
      setScrubPosition(targetTime);
    }
  };

  const handleProgressBarPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbingRef.current) return;
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch (_) {}

    isScrubbingRef.current = false;
    setIsScrubbing(false);

    if (progressBarRef.current && safeDuration > 0) {
      const rect = progressBarRef.current.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const targetTime = pos * safeDuration;
      setScrubPosition(null);
      audioEngine.setScrubbing(false);
      onSeek(targetTime);
    } else {
      setScrubPosition(null);
      audioEngine.setScrubbing(false);
    }
  };

  const handleProgressBarPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbingRef.current) return;
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch (_) {}
    isScrubbingRef.current = false;
    setIsScrubbing(false);
    setScrubPosition(null);
    audioEngine.setScrubbing(false);
  };

  return (
    <footer className="h-24 max-h-24 w-full shrink-0 bg-md3-surface-container-high/95 backdrop-blur-xl border-t border-md3-outline-variant/15 px-6 flex items-center justify-between select-none relative z-30 transition-colors duration-300">
      {/* Left: Cover Art & Track Metadata (Clickable to open Track Details) */}
      <div 
        onClick={() => currentTrack && onOpenTrackDetails && onOpenTrackDetails(currentTrack)}
        title={currentTrack ? 'Нажмите, чтобы открыть сведения о треке' : undefined}
        className={`flex items-center gap-3.5 w-1/4 min-w-[240px] max-w-xs shrink-0 select-none ${currentTrack ? 'cursor-pointer group' : ''}`}
      >
        {/* Cover Art with subtle glow - strictly constrained to 56x56 */}
        <div 
          style={{ width: '56px', height: '56px', minWidth: '56px', minHeight: '56px', maxWidth: '56px', maxHeight: '56px' }}
          className="w-14 h-14 min-w-[56px] min-h-[56px] max-w-[56px] max-h-[56px] rounded-2xl overflow-hidden shrink-0 bg-md3-surface-container shadow-md border border-md3-outline-variant/15 relative"
        >
          {currentTrack?.coverArt ? (
            <img 
              src={currentTrack.coverArt} 
              alt={currentTrack.title} 
              className={`w-full h-full max-w-full max-h-full object-cover transition-transform duration-300 ${isPlaying ? 'scale-105' : ''} group-hover:scale-110`} 
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-md3-primary/10 text-md3-primary">
              <Disc3 className={`w-7 h-7 ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
            </div>
          )}
        </div>

        {/* Title & Artist */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-md3-on-surface truncate group-hover:text-md3-primary transition-colors">
            {currentTrack ? currentTrack.title : 'Ничего не играет'}
          </p>
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
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(currentTrack.id, e);
            }}
            title={currentTrack.isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'}
            className="p-2 rounded-full text-md3-on-surface-variant hover:text-red-500 transition-colors cursor-pointer shrink-0"
          >
            <Heart className={`w-4 h-4 transition-transform active:scale-125 ${currentTrack.isFavorite ? 'fill-red-500 text-red-500 scale-110' : 'opacity-40 hover:opacity-100'}`} />
          </button>
        )}
      </div>

      {/* Center: Playback Controls & Timeline (Dedicated row for buttons + dedicated row for scrubber) */}
      <div className="flex flex-col items-center justify-center w-2/4 max-w-xl px-4">
        {/* Main Controls Row */}
        <div className="flex items-center gap-4 mb-1.5">
          {/* Shuffle */}
          <button
            onClick={onToggleShuffle}
            title={isShuffled ? 'Случайный порядок включен [E]' : 'Перемешать треки [E]'}
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

          {/* Play / Pause Primary Button */}
          <button
            onClick={onPlayPause}
            title={isPlaying ? 'Пауза (Пробел)' : 'Воспроизведение (Пробел)'}
            className="w-10 h-10 rounded-full bg-md3-primary text-md3-on-primary flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-transform duration-150 cursor-pointer"
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
            title={`Повтор [R]: ${repeatMode === 'off' ? 'Откл' : repeatMode === 'all' ? 'Все' : 'Один'}`}
            className={`p-2 rounded-full transition-colors relative cursor-pointer ${
              repeatMode !== 'off' ? 'text-md3-primary bg-md3-primary/10' : 'text-md3-on-surface-variant hover:text-md3-on-surface'
            }`}
          >
            {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
            {repeatMode !== 'off' && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-md3-primary" />}
          </button>
        </div>

        {/* Timeline Row: time progress scrubber */}
        <div className="w-full flex items-center gap-2">
          {/* Current Time (Left) */}
          <span className="text-[11px] font-mono text-md3-on-surface-variant/80 shrink-0 w-11 text-right">
            {formatTime(effectiveDisplayTime)}
          </span>

          {/* Timeline Scrubber Bar (Middle) */}
          <div 
            ref={progressBarRef}
            onPointerDown={handleProgressBarPointerDown}
            onPointerMove={handleProgressBarPointerMove}
            onPointerUp={handleProgressBarPointerUp}
            onPointerCancel={handleProgressBarPointerCancel}
            onMouseLeave={() => { if (!isScrubbingRef.current) setHoverSeekTime(null); }}
            title="Перемотка [← / → на 5 сек]"
            className={`flex-1 ${isScrubbing ? 'h-2.5' : 'h-1.5 hover:h-2.5'} rounded-full bg-md3-surface-container-highest cursor-pointer transition-all duration-150 relative group touch-none`}
          >
            {/* Progress Fill */}
            <div 
              className="h-full bg-md3-primary rounded-full relative"
              style={{ width: `${progressPercent}%`, maxWidth: '100%' }}
            >
              {/* Scrubber Thumb */}
              <div className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 rounded-full bg-md3-primary shadow-md ring-2 ring-md3-on-primary ${isScrubbing ? 'opacity-100 scale-125' : 'opacity-0 group-hover:opacity-100'} transition-all`} />
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

          {/* Remaining Negative Time (Right) */}
          <span className="text-[11px] font-mono text-md3-on-surface-variant/80 shrink-0 w-12 text-left">
            -{formatTime(remainingTime)}
          </span>
        </div>
      </div>

      {/* Right: Visualizer, Panels Pill (Lyrics + Queue), Volume */}
      <div className="flex items-center justify-end gap-3 w-1/4 min-w-[260px] max-w-xs shrink-0">
        {/* Animated Spectrum Visualizer */}
        <div 
          className="hidden xl:flex items-end gap-1 h-5 px-1 py-0.5 pointer-events-none opacity-80 shrink-0"
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

        {/* Secondary Panels Pill Frame: Lyrics & Queue (Unified Material You capsule) */}
        <div className="flex items-center gap-1 p-1 bg-md3-surface-container rounded-full border border-md3-outline-variant/15 shadow-xs shrink-0">
          {/* Lyrics Button [T] - Always rendered to prevent layout shift */}
          <button
            onClick={onOpenLyrics}
            disabled={!currentTrack}
            title={
              !currentTrack
                ? 'Текст песни [T]'
                : currentTrack.lyrics && currentTrack.lyrics.trim().length > 0
                ? 'Текст песни [T] (доступен)'
                : currentTrack.isInstrumental
                ? 'Инструментальная композиция (без слов) [T]'
                : 'Текст песни [T] (нажмите, чтобы добавить)'
            }
            className={`relative p-2 rounded-full transition-all ${
              !currentTrack
                ? 'text-md3-on-surface-variant/30 cursor-not-allowed opacity-40'
                : currentTrack.lyrics && currentTrack.lyrics.trim().length > 0
                ? 'text-md3-primary bg-md3-primary/15 hover:bg-md3-primary/25 font-bold shadow-xs cursor-pointer'
                : 'text-md3-on-surface-variant hover:text-md3-on-surface hover:bg-md3-surface-container-high cursor-pointer'
            }`}
          >
            <Mic2 className="w-4 h-4" />
            {currentTrack?.lyrics && currentTrack.lyrics.trim().length > 0 && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-md3-primary shadow-xs" />
            )}
          </button>

          {/* Queue Drawer Button [Q] */}
          <button
            onClick={onToggleQueue}
            title="Очередь воспроизведения [Q]"
            className={`relative p-2 rounded-full transition-all cursor-pointer ${
              isQueueOpen
                ? 'bg-md3-primary text-md3-on-primary shadow-xs'
                : 'text-md3-on-surface-variant hover:text-md3-on-surface hover:bg-md3-surface-container-high'
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

        {/* Volume controls with smooth slider */}
        <div className="flex items-center gap-1.5 group shrink-0">
          <button
            onClick={onToggleMute}
            title={isMuted ? 'Включить звук' : `Громкость: ${Math.round(volume * 100)}% [↑/↓]`}
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
            title={`Громкость: ${Math.round(volume * 100)}% [↑/↓]`}
            className="w-20 lg:w-24 accent-md3-primary h-1.5 rounded-full bg-md3-surface-container-highest cursor-pointer"
          />
        </div>
      </div>
    </footer>
  );
};
