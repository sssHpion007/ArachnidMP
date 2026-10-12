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
  Mic2,
  SlidersHorizontal,
  FolderPlus
} from 'lucide-react';
import { Track } from '../types/music';
import { formatTime } from '../services/tagEditor';
import { audioEngine } from '../services/audioEngine';
import { AppLanguage, getTranslations } from '../i18n';

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
  language?: AppLanguage;
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
  onOpenFiles?: () => void;
  onOpenEQ?: () => void;
  onOpenTrackDetails?: (track: Track) => void;
  onOpenLyrics?: () => void;
  discordEnabled?: boolean;
  onToggleDiscord?: () => void;
  showDiscordButton?: boolean;
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
  language = 'ru',
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
  onOpenFiles,
  onOpenEQ,
  onOpenTrackDetails,
  onOpenLyrics,
  discordEnabled = true,
  onToggleDiscord,
  showDiscordButton = true,
}) => {
  const t = getTranslations(language);
  const [windowWidth, setWindowWidth] = useState<number>(window.innerWidth);
  const [hoverSeekTime, setHoverSeekTime] = useState<number | null>(null);
  const [hoverSeekPos, setHoverSeekPos] = useState<number>(0);
  const [visBars, setVisBars] = useState<number[]>([20, 40, 60, 80, 50, 30, 70, 25]);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [scrubPosition, setScrubPosition] = useState<number | null>(null);
  const isScrubbingRef = useRef<boolean>(false);
  const isPointerDownRef = useRef<boolean>(false);
  const startPointerXRef = useRef<number>(0);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const [isCompactVolHovered, setIsCompactVolHovered] = useState<boolean>(false);
  const volHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleVolMouseEnter = () => {
    if (volHoverTimeoutRef.current) {
      clearTimeout(volHoverTimeoutRef.current);
      volHoverTimeoutRef.current = null;
    }
    setIsCompactVolHovered(true);
  };

  const handleVolMouseLeave = () => {
    if (volHoverTimeoutRef.current) {
      clearTimeout(volHoverTimeoutRef.current);
    }
    volHoverTimeoutRef.current = setTimeout(() => {
      setIsCompactVolHovered(false);
    }, 200);
  };

  const handleVolumeWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const step = 0.05;
    const delta = e.deltaY < 0 ? step : -step;
    const currentVol = isMuted ? 0 : volume;
    const newVol = Math.max(0, Math.min(1, Math.round((currentVol + delta) * 100) / 100));
    if (isMuted && delta > 0) {
      onToggleMute();
    }
    onVolumeChange(newVol);
  };

  useEffect(() => {
    return () => {
      if (volHoverTimeoutRef.current) {
        clearTimeout(volHoverTimeoutRef.current);
      }
    };
  }, []);

  const handleCompactVolumeStepClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const currentPct = isMuted ? 0 : Math.round(volume * 100);
    let nextPct: number;
    if (currentPct >= 95) {
      nextPct = 0;
    } else if (currentPct < 20) {
      nextPct = 25;
    } else if (currentPct < 45) {
      nextPct = 50;
    } else if (currentPct < 70) {
      nextPct = 75;
    } else {
      nextPct = 100;
    }
    if (isMuted && nextPct > 0) {
      onToggleMute();
    }
    onVolumeChange(nextPct / 100);
  };

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

    isPointerDownRef.current = true;
    startPointerXRef.current = e.clientX;
    isScrubbingRef.current = false;

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

    if (isPointerDownRef.current) {
      if (!isScrubbingRef.current && Math.abs(e.clientX - startPointerXRef.current) > 3) {
        isScrubbingRef.current = true;
        setIsScrubbing(true);
        audioEngine.setScrubbing(true);
      }
      if (isScrubbingRef.current) {
        setScrubPosition(targetTime);
      }
    }
  };

  const handleProgressBarPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch (_) {}

    const wasScrubbing = isScrubbingRef.current;
    isScrubbingRef.current = false;
    setIsScrubbing(false);

    if (progressBarRef.current && safeDuration > 0) {
      const rect = progressBarRef.current.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const targetTime = pos * safeDuration;
      setScrubPosition(null);
      if (wasScrubbing) {
        audioEngine.setScrubbing(false);
      }
      onSeek(targetTime);
    } else {
      setScrubPosition(null);
      if (wasScrubbing) {
        audioEngine.setScrubbing(false);
      }
    }
  };

  const handleProgressBarPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch (_) {}
    const wasScrubbing = isScrubbingRef.current;
    isScrubbingRef.current = false;
    setIsScrubbing(false);
    setScrubPosition(null);
    if (wasScrubbing) {
      audioEngine.setScrubbing(false);
    }
  };

  const isNarrow = windowWidth < 780;

  // Render narrow / compact smartphone layout (< 780px)
  if (isNarrow) {
    return (
      <footer className="relative min-h-[196px] w-full shrink-0 bg-md3-surface-container-high/95 backdrop-blur-xl border-t border-md3-outline-variant/15 px-3.5 py-3.5 flex flex-col justify-between select-none z-30 transition-colors duration-300 gap-2">
        
        {/* Android-style Floating Action Button (Add Files) above now playing bar on the right */}
        {!isQueueOpen && onOpenFiles && (
          <button
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onOpenFiles}
            title={language === 'ru' ? 'Добавить файлы' : 'Add Files'}
            style={{ width: '56px', height: '56px', minWidth: '56px', minHeight: '56px', maxWidth: '56px', maxHeight: '56px' }}
            className="absolute -top-[70px] right-5 sm:right-6 w-14 h-14 min-w-[56px] min-h-[56px] max-w-[56px] max-h-[56px] rounded-2xl bg-md3-primary text-md3-on-primary shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer z-30 border border-white/15 shrink-0"
          >
            <FolderPlus className="w-6 h-6 stroke-[2.2]" />
          </button>
        )}

        {/* Tier 1: Track Cover, Title/Artist/Album, and Quick Actions (Heart + Queue) */}
        <div className="w-full flex items-center justify-between gap-2.5">
          <div 
            onClick={() => currentTrack && onOpenTrackDetails && onOpenTrackDetails(currentTrack)}
            title={currentTrack ? (language === 'ru' ? 'Нажмите, чтобы открыть сведения о треке' : 'Click to open track details') : undefined}
            className={`flex items-center gap-2.5 min-w-0 flex-1 ${currentTrack ? 'cursor-pointer group' : ''}`}
          >
            <div className="w-12 h-12 min-w-[48px] min-h-[48px] max-w-[48px] max-h-[48px] rounded-xl overflow-hidden shrink-0 bg-md3-surface-container shadow-sm border border-md3-outline-variant/15 relative">
              {currentTrack?.coverArt ? (
                <img 
                  src={currentTrack.coverArt} 
                  alt={currentTrack.title} 
                  className={`w-full h-full max-w-full max-h-full object-cover transition-transform duration-300 ${isPlaying ? 'scale-105' : ''}`} 
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-md3-primary/10 text-md3-primary">
                  <Disc3 className={`w-6 h-6 ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-md3-on-surface truncate group-hover:text-md3-primary transition-colors leading-tight">
                {currentTrack ? currentTrack.title : (language === 'ru' ? 'Ничего не играет' : 'Nothing playing')}
              </p>
              <p className="text-[11px] text-md3-on-surface-variant truncate font-medium mt-0.5 leading-tight">
                {currentTrack ? (
                  <>
                    <span>{currentTrack.artist}</span>
                    {currentTrack.album && <span className="opacity-60"> — {currentTrack.album}</span>}
                  </>
                ) : (
                  language === 'ru' ? 'Выберите трек' : 'Select a track'
                )}
              </p>
            </div>
          </div>

          {/* Quick Actions on the right: Favorite Heart + Queue Drawer Button */}
          <div className="flex items-center gap-1 shrink-0">
            {currentTrack && (
              <button
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(currentTrack.id, e);
                }}
                title={currentTrack.isFavorite ? t.controls.removeFromFavorites : t.controls.addToFavorites}
                className="p-2 rounded-full text-md3-on-surface-variant hover:text-red-500 transition-colors cursor-pointer"
              >
                <Heart className={`w-5 h-5 transition-transform active:scale-125 ${currentTrack.isFavorite ? 'fill-red-500 text-red-500' : 'opacity-60'}`} />
              </button>
            )}

            <button
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={onToggleQueue}
              title={t.controls.queue}
              className={`relative p-2 rounded-full transition-all cursor-pointer ${
                isQueueOpen 
                  ? 'bg-md3-primary text-md3-on-primary shadow-xs' 
                  : 'text-md3-on-surface-variant hover:text-md3-on-surface hover:bg-md3-surface-container-high'
              }`}
            >
              <ListMusic className="w-5 h-5" />
              {queueCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-md3-tertiary text-md3-on-tertiary shadow-sm">
                  {queueCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Tier 2: Timeline Scrubber across full width */}
        <div className="w-full flex items-center gap-2 px-0.5">
          <span className="text-[10px] font-mono text-md3-on-surface-variant/80 shrink-0 w-8 text-right">
            {formatTime(effectiveDisplayTime)}
          </span>

          <div 
            ref={progressBarRef}
            onPointerDown={handleProgressBarPointerDown}
            onPointerMove={handleProgressBarPointerMove}
            onPointerUp={handleProgressBarPointerUp}
            onPointerCancel={handleProgressBarPointerCancel}
            className="flex-1 h-2 rounded-full bg-md3-surface-container-highest cursor-pointer relative touch-none"
          >
            <div 
              className="h-full bg-md3-primary rounded-full relative"
              style={{ width: `${progressPercent}%`, maxWidth: '100%' }}
            >
              <div className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3.5 h-3.5 rounded-full bg-md3-primary shadow-md ring-2 ring-md3-on-primary ${isScrubbing ? 'scale-125' : ''}`} />
            </div>
          </div>

          <span className="text-[10px] font-mono text-md3-on-surface-variant/80 shrink-0 w-8 text-left">
            -{formatTime(remainingTime)}
          </span>
        </div>

        {/* Tier 3: Controls row with enlarged buttons, Left = Equalizer & Discord, Right = Volume & Lyrics, Center = Playback */}
        <div className="w-full flex items-center justify-between px-0.5">
          {/* Left: Equalizer & Discord */}
          <div className="flex items-center gap-1.5 shrink-0">
            {onOpenEQ && (
              <button
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={onOpenEQ}
                title={t.controls.equalizer}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-md3-surface-container border border-md3-outline-variant/15 text-md3-on-surface-variant hover:text-md3-on-surface hover:bg-md3-surface-container-high transition-colors cursor-pointer shadow-xs"
              >
                <SlidersHorizontal className="w-4.5 h-4.5" />
              </button>
            )}
            {showDiscordButton && onToggleDiscord && (
              <button
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={onToggleDiscord}
                title={language === 'ru'
                  ? `Discord RPC: ${discordEnabled ? 'Включен [D]' : 'Выключен [D]'} (кликните для переключения)`
                  : `Discord RPC: ${discordEnabled ? 'Enabled [D]' : 'Disabled [D]'} (click to toggle)`
                }
                className={`w-10 h-10 flex items-center justify-center rounded-full transition-all cursor-pointer shadow-xs border ${
                  discordEnabled
                    ? 'bg-[#5865F2]/20 border-[#5865F2]/40 text-[#5865F2] font-bold shadow-sm'
                    : 'bg-md3-surface-container border-md3-outline-variant/15 text-md3-on-surface-variant hover:text-md3-on-surface hover:bg-md3-surface-container-high'
                }`}
              >
                <span className={`w-3 h-3 rounded-full shrink-0 ${discordEnabled ? 'bg-[#5865F2] animate-pulse' : 'bg-gray-400'}`} />
              </button>
            )}
          </div>

          {/* Center: Enlarged Playback Controls (Mathematically centered) */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <button
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={onToggleShuffle}
              title={isShuffled ? `${t.controls.shuffleOn}` : `${t.controls.shuffleOff}`}
              className={`w-9 h-9 flex items-center justify-center rounded-full relative cursor-pointer ${
                isShuffled ? 'text-md3-primary bg-md3-primary/10' : 'text-md3-on-surface-variant hover:text-md3-on-surface'
              }`}
            >
              <Shuffle className="w-4.5 h-4.5" />
              {isShuffled && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-md3-primary" />}
            </button>

            <button
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={onPrev}
              title={language === 'ru' ? 'Предыдущий трек' : 'Previous Track'}
              className="w-10 h-10 flex items-center justify-center rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container hover:text-md3-on-surface cursor-pointer"
            >
              <SkipBack className="w-5 h-5 fill-current" />
            </button>

            {/* Enlarged Primary Play/Pause button */}
            <button
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={onPlayPause}
              title={isPlaying ? `${t.controls.pause}` : `${t.controls.play}`}
              className="w-12 h-12 rounded-full bg-md3-primary text-md3-on-primary flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform cursor-pointer"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 fill-current" />
              ) : (
                <Play className="w-6 h-6 fill-current ml-0.5" />
              )}
            </button>

            <button
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={onNext}
              title={language === 'ru' ? 'Следующий трек' : 'Next Track'}
              className="w-10 h-10 flex items-center justify-center rounded-full text-md3-on-surface-variant hover:text-md3-on-surface hover:bg-md3-surface-container cursor-pointer"
            >
              <SkipForward className="w-5 h-5 fill-current" />
            </button>

            <button
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={onToggleRepeat}
              title={`${t.controls.repeatPrefix}: ${repeatMode}`}
              className={`w-9 h-9 flex items-center justify-center rounded-full relative cursor-pointer ${
                repeatMode !== 'off' ? 'text-md3-primary bg-md3-primary/10' : 'text-md3-on-surface-variant hover:text-md3-on-surface'
              }`}
            >
              {repeatMode === 'one' ? <Repeat1 className="w-4.5 h-4.5" /> : <Repeat className="w-4.5 h-4.5" />}
              {repeatMode !== 'off' && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-md3-primary" />}
            </button>
          </div>

          {/* Right: Lyrics Button & Volume Button with Popover */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Volume Button with hover vertical slider */}
            <div 
              className="relative flex items-center justify-center"
              onMouseEnter={handleVolMouseEnter}
              onMouseLeave={handleVolMouseLeave}
              onWheel={handleVolumeWheel}
            >
              <button
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleCompactVolumeStepClick}
                onWheel={handleVolumeWheel}
                title={`${t.controls.volume}: ${Math.round((isMuted ? 0 : volume) * 100)}% (клик: +25%, колёсико: громкость)`}
                className={`w-10 h-10 flex items-center justify-center rounded-full bg-md3-surface-container border border-md3-outline-variant/15 transition-all cursor-pointer shadow-xs ${
                  isMuted || volume === 0 
                    ? 'text-red-400 bg-red-500/10 border-red-500/20' 
                    : 'text-md3-on-surface-variant hover:text-md3-on-surface hover:bg-md3-surface-container-high'
                }`}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4.5 h-4.5 text-red-400" />
                ) : volume < 0.5 ? (
                  <Volume1 className="w-4.5 h-4.5" />
                ) : (
                  <Volume2 className="w-4.5 h-4.5" />
                )}
              </button>

              {/* Floating Vertical Volume Slider Popup on Hover strictly centered above button */}
              {isCompactVolHovered && (
                <div 
                  className="absolute bottom-full left-1/2 -translate-x-1/2 pb-2 z-50 select-none animate-in fade-in zoom-in-95 duration-150"
                  onMouseEnter={handleVolMouseEnter}
                  onMouseLeave={handleVolMouseLeave}
                  onWheel={handleVolumeWheel}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex flex-col items-center p-3 bg-md3-surface-container-high/95 backdrop-blur-xl border border-md3-outline-variant/30 rounded-2xl shadow-2xl min-w-[56px]">
                    <span className="text-[11px] font-mono font-bold text-md3-primary mb-2 select-none">
                      {Math.round((isMuted ? 0 : volume) * 100)}%
                    </span>
                    <div className="h-28 flex items-center justify-center py-1">
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        tabIndex={-1}
                        value={isMuted ? 0 : volume}
                        onChange={(e) => {
                          if (isMuted) onToggleMute();
                          onVolumeChange(parseFloat(e.target.value));
                        }}
                        onInput={(e) => {
                          if (isMuted) onToggleMute();
                          onVolumeChange(parseFloat((e.target as HTMLInputElement).value));
                        }}
                        title={`${t.controls.volume}: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
                        style={{ writingMode: 'vertical-lr', direction: 'rtl', height: '100px', width: '20px' }}
                        className="accent-md3-primary cursor-pointer outline-none"
                      />
                    </div>
                    <button
                      tabIndex={-1}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={onToggleMute}
                      title={isMuted ? t.controls.unmute : t.controls.mute}
                      className="mt-2 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-md3-surface-container text-md3-on-surface-variant hover:text-md3-on-surface hover:bg-md3-surface-container-highest transition-colors cursor-pointer"
                    >
                      {isMuted ? 'Muted' : 'Mute'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={onOpenLyrics}
              disabled={!currentTrack}
              title={t.controls.lyrics}
              className={`w-10 h-10 flex items-center justify-center rounded-full transition-all cursor-pointer shadow-xs ${
                !currentTrack
                  ? 'text-md3-on-surface-variant/30 cursor-not-allowed opacity-40 bg-md3-surface-container/50'
                  : currentTrack.lyrics && currentTrack.lyrics.trim().length > 0
                  ? 'text-md3-primary bg-md3-primary/15 hover:bg-md3-primary/25 font-bold'
                  : 'bg-md3-surface-container border border-md3-outline-variant/15 text-md3-on-surface-variant hover:text-md3-on-surface hover:bg-md3-surface-container-high'
              }`}
            >
              <Mic2 className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </footer>
    );
  }

  // Desktop 3-column Layout (>= 780px)
  return (
    <footer className="relative h-24 max-h-24 w-full shrink-0 bg-md3-surface-container-high/95 backdrop-blur-xl border-t border-md3-outline-variant/15 px-4 sm:px-6 flex items-center justify-between select-none z-30 transition-colors duration-300">
      {/* Left: Cover Art & Track Metadata (Clickable to open Track Details) */}
      <div 
        onClick={() => currentTrack && onOpenTrackDetails && onOpenTrackDetails(currentTrack)}
        title={currentTrack ? (language === 'ru' ? 'Нажмите, чтобы открыть сведения о треке' : 'Click to open track details') : undefined}
        className={`z-20 relative flex items-center gap-3 max-w-[210px] md:max-w-[250px] lg:max-w-[300px] xl:max-w-[360px] shrink-0 select-none ${currentTrack ? 'cursor-pointer group' : ''}`}
      >
        {/* Cover Art with subtle glow - strictly constrained to 56x56 */}
        <div className="relative group/cover shrink-0">
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

          {/* Compact Heart badge directly on cover when space is constrained (< 1150px) to prevent collision with controls */}
          {currentTrack && windowWidth < 1150 && (
            <button
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(currentTrack.id, e);
              }}
              title={currentTrack.isFavorite ? t.controls.removeFromFavorites : t.controls.addToFavorites}
              className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center transition-all shadow-md cursor-pointer z-10 ${
                currentTrack.isFavorite 
                  ? 'bg-md3-surface-container-high border border-red-500/40 text-red-500' 
                  : 'bg-md3-surface-container-high/90 border border-md3-outline-variant/40 text-md3-on-surface-variant hover:text-red-500 hover:scale-110'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 transition-transform active:scale-125 ${currentTrack.isFavorite ? 'fill-red-500 text-red-500 scale-105' : 'opacity-70'}`} />
            </button>
          )}
        </div>

        {/* Title & Artist (Album hidden before xl/1150px to prevent crowding with center controls) */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-md3-on-surface truncate group-hover:text-md3-primary transition-colors">
            {currentTrack ? currentTrack.title : (language === 'ru' ? 'Ничего не играет' : 'Nothing playing')}
          </p>
          <p className="text-xs text-md3-on-surface-variant truncate font-medium mt-0.5">
            {currentTrack ? (
              <>
                <span>{currentTrack.artist}</span>
                {currentTrack.album && windowWidth >= 1150 && (
                  <span className="opacity-60"> — {currentTrack.album}</span>
                )}
              </>
            ) : (
              language === 'ru' ? 'Выберите трек из библиотеки' : 'Select a track from library'
            )}
          </p>
        </div>

        {/* Favorite Heart Button: rendered beside text only on wide screens (>= 1150px) */}
        {currentTrack && windowWidth >= 1150 && (
          <button
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(currentTrack.id, e);
            }}
            title={currentTrack.isFavorite ? t.controls.removeFromFavorites : t.controls.addToFavorites}
            className="p-2 rounded-full text-md3-on-surface-variant hover:text-red-500 transition-colors cursor-pointer shrink-0 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ring-0"
          >
            <Heart className={`w-4 h-4 transition-transform active:scale-125 ${currentTrack.isFavorite ? 'fill-red-500 text-red-500 scale-110' : 'opacity-40 hover:opacity-100'}`} />
          </button>
        )}
      </div>

      {/* Center: Playback Controls & Timeline - ALWAYS EXACT MATHEMATICAL CENTER */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-full max-w-[380px] sm:max-w-[440px] md:max-w-lg lg:max-w-xl px-2 pointer-events-none flex flex-col items-center justify-center">
        <div className="pointer-events-auto flex flex-col items-center justify-center w-full">
          {/* Main Controls Row */}
          <div className="flex items-center gap-3 sm:gap-4 mb-1.5">
            {/* Shuffle */}
            <button
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={onToggleShuffle}
              title={isShuffled ? `${t.controls.shuffleOn} [E]` : `${t.controls.shuffleOff} [E]`}
              className={`p-2 rounded-full transition-colors relative cursor-pointer outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ring-0 ${
                isShuffled ? 'text-md3-primary bg-md3-primary/10' : 'text-md3-on-surface-variant hover:text-md3-on-surface'
              }`}
            >
              <Shuffle className="w-4 h-4" />
              {isShuffled && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-md3-primary" />}
            </button>

            {/* Previous */}
            <button
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={onPrev}
              title={language === 'ru' ? 'Предыдущий трек (Ctrl + ←)' : 'Previous Track (Ctrl + ←)'}
              className="p-2 rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container hover:text-md3-on-surface transition-colors cursor-pointer outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ring-0"
            >
              <SkipBack className="w-4 h-4 fill-current" />
            </button>

            {/* Play / Pause Primary Button */}
            <button
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={onPlayPause}
              title={isPlaying ? `${t.controls.pause} (Space)` : `${t.controls.play} (Space)`}
              className="w-10 h-10 rounded-full bg-md3-primary text-md3-on-primary flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-transform duration-150 cursor-pointer outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ring-0"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            {/* Next */}
            <button
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={onNext}
              title={language === 'ru' ? 'Следующий трек (Ctrl + →)' : 'Next Track (Ctrl + →)'}
              className="p-2 rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container hover:text-md3-on-surface transition-colors cursor-pointer outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ring-0"
            >
              <SkipForward className="w-4 h-4 fill-current" />
            </button>

            {/* Repeat */}
            <button
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={onToggleRepeat}
              title={`${t.controls.repeatPrefix} [R]: ${repeatMode === 'off' ? t.controls.repeatOff : repeatMode === 'all' ? t.controls.repeatAll : t.controls.repeatOne}`}
              className={`p-2 rounded-full transition-colors relative cursor-pointer outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ring-0 ${
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
              onMouseLeave={() => { if (!isScrubbingRef.current && !isPointerDownRef.current) setHoverSeekTime(null); }}
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
      </div>

      {/* Right: Visualizer, Volume, Panels Pill (Lyrics + Queue) */}
      <div className="z-20 relative flex items-center justify-end gap-2 sm:gap-3 shrink-0 ml-auto">
        {/* Animated Spectrum Visualizer */}
        <div 
          className="hidden xl:flex items-end gap-1 h-5 px-1 py-0.5 pointer-events-none opacity-80 shrink-0"
          title={t.controls.spectrum}
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
        <div 
          onWheel={handleVolumeWheel}
          className="flex items-center gap-1.5 group shrink-0"
        >
          <button
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onToggleMute}
            title={isMuted ? t.controls.unmute : `${t.controls.volume}: ${Math.round(volume * 100)}% [↑/↓]`}
            className="p-1.5 rounded-full text-md3-on-surface-variant hover:text-md3-on-surface transition-colors cursor-pointer outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ring-0"
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
            tabIndex={-1}
            value={isMuted ? 0 : volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            onInput={(e) => onVolumeChange(parseFloat((e.target as HTMLInputElement).value))}
            title={`${t.controls.volume}: ${Math.round((isMuted ? 0 : volume) * 100)}% [↑/↓]`}
            className="w-16 sm:w-20 lg:w-24 accent-md3-primary h-1.5 rounded-full bg-md3-surface-container-highest cursor-pointer outline-none focus:outline-none focus-visible:outline-none"
          />
        </div>

        {/* Secondary Panels Pill Frame: Lyrics & Queue (Moved to the end, after volume) */}
        <div className="flex items-center gap-1 p-1 bg-md3-surface-container rounded-full border border-md3-outline-variant/15 shadow-xs shrink-0">
          {/* Lyrics Button [L] */}
          <button
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onOpenLyrics}
            disabled={!currentTrack}
            title={
              !currentTrack
                ? `${t.controls.lyrics} [L]`
                : currentTrack.lyrics && currentTrack.lyrics.trim().length > 0
                ? `${t.controls.lyrics} [L]`
                : currentTrack.isInstrumental
                ? (language === 'ru' ? 'Инструментальная композиция [L]' : 'Instrumental track [L]')
                : (language === 'ru' ? 'Текст песни [L] (нажмите, чтобы добавить)' : 'Lyrics [L] (click to add)')
            }
            className={`relative p-2 rounded-full transition-all outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ring-0 ${
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
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onToggleQueue}
            title={`${t.controls.queue} [Q]`}
            className={`relative p-2 rounded-full transition-all cursor-pointer outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ring-0 ${
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
      </div>
    </footer>
  );
};
