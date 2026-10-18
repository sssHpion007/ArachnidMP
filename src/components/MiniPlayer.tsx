import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  Disc3,
  Heart,
  Mic2,
  Library,
  ListMusic,
  MessageCircle,
  Music2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SlidersHorizontal,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { Playlist, Track } from '../types/music';
import { AppLanguage } from '../i18n';
import { formatTime } from '../services/tagEditor';
import { MiniLyricsPane, MiniLyricsTrack } from './MiniLyricsPane';

type LyricsMode = 'closed' | 'attached' | 'detached';
type BottomPanel = 'queue' | 'library' | null;

interface MiniPlayerProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  repeatMode: 'off' | 'all' | 'one';
  isShuffled: boolean;
  queue: Track[];
  queueIndex: number;
  tracks: Track[];
  playlists: Playlist[];
  language: AppLanguage;
  lyricsMode: LyricsMode;
  discordEnabled: boolean;
  showDiscordButton: boolean;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  onPlayQueueTrack: (index: number) => void;
  onPlayTrack: (track: Track, context: Track[]) => void;
  onClearQueue: () => void;
  onToggleLyrics: () => void;
  onToggleDiscord: () => void;
  onOpenEQ: () => void;
  onToggleFavorite: (trackId: string, event: React.MouseEvent) => void;
  onOpenTrackDetails: (track: Track) => void;
  onDetachLyrics: () => void;
  onAttachLyrics: () => void;
  onCloseLyrics: () => void;
}

const text = (language: AppLanguage, ru: string, en: string) => language === 'ru' ? ru : en;

export const MiniPlayer: React.FC<MiniPlayerProps> = ({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  repeatMode,
  isShuffled,
  queue,
  queueIndex,
  tracks,
  playlists,
  language,
  lyricsMode,
  discordEnabled,
  showDiscordButton,
  onPlayPause,
  onPrev,
  onNext,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleShuffle,
  onToggleRepeat,
  onPlayQueueTrack,
  onPlayTrack,
  onClearQueue,
  onToggleLyrics,
  onToggleDiscord,
  onOpenEQ,
  onToggleFavorite,
  onOpenTrackDetails,
  onDetachLyrics,
  onAttachLyrics,
  onCloseLyrics,
}) => {
  const [bottomPanel, setBottomPanel] = useState<BottomPanel>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [isCompactVolHovered, setIsCompactVolHovered] = useState(false);
  const volHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueActiveItemRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (bottomPanel === 'queue') {
      requestAnimationFrame(() => queueActiveItemRef.current?.scrollIntoView({ block: 'nearest' }));
    }
  }, [bottomPanel]);
  const safeDuration = duration > 0 ? duration : (currentTrack?.duration || 0);
  const safeTime = Math.max(0, Math.min(safeDuration || 0, currentTime));
  const currentPlaylist = playlists.find(playlist => playlist.id === selectedPlaylistId) || null;
  const libraryTracks = useMemo(() => {
    if (!currentPlaylist) return tracks;
    const byId = new Map(tracks.map(track => [track.id, track]));
    return currentPlaylist.trackIds.map(id => byId.get(id)).filter((track): track is Track => !!track);
  }, [currentPlaylist, tracks]);
  const lyricsTrack: MiniLyricsTrack | null = currentTrack ? {
    title: currentTrack.title,
    artist: currentTrack.artist,
    lyrics: currentTrack.lyrics,
    isInstrumental: currentTrack.isInstrumental,
    lyricist: currentTrack.lyricist,
  } : null;

  const togglePanel = (panel: Exclude<BottomPanel, null>) => {
    setBottomPanel(current => current === panel ? null : panel);
  };

  const handleVolumeMouseEnter = () => {
    if (volHoverTimeoutRef.current) clearTimeout(volHoverTimeoutRef.current);
    setIsCompactVolHovered(true);
  };

  const handleVolumeMouseLeave = () => {
    if (volHoverTimeoutRef.current) clearTimeout(volHoverTimeoutRef.current);
    volHoverTimeoutRef.current = setTimeout(() => setIsCompactVolHovered(false), 200);
  };

  const handleVolumeWheel = (event: React.WheelEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const step = 0.05;
    const delta = event.deltaY < 0 ? step : -step;
    const currentVolume = isMuted ? 0 : volume;
    const nextVolume = Math.max(0, Math.min(1, Math.round((currentVolume + delta) * 100) / 100));
    if (isMuted && delta > 0) onToggleMute();
    onVolumeChange(nextVolume);
  };

  const handleVolumeStepClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const currentPercent = isMuted ? 0 : Math.round(volume * 100);
    const nextPercent = currentPercent >= 95 ? 0 : currentPercent < 20 ? 25 : currentPercent < 45 ? 50 : currentPercent < 70 ? 75 : 100;
    if (isMuted && nextPercent > 0) onToggleMute();
    onVolumeChange(nextPercent / 100);
  };

  useEffect(() => () => {
    if (volHoverTimeoutRef.current) clearTimeout(volHoverTimeoutRef.current);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 bg-md3-background text-md3-on-background">
      <section className="relative flex h-full w-[380px] shrink-0 flex-col overflow-hidden border-r border-md3-outline-variant/15 bg-md3-surface">
        <div className="flex min-h-0 flex-1 flex-col items-center gap-3 px-5 pb-3 pt-4">
          <button
            type="button"
            onClick={() => currentTrack && onOpenTrackDetails(currentTrack)}
            disabled={!currentTrack}
            title={currentTrack ? text(language, 'Открыть сведения о треке', 'Open track details') : undefined}
            className="flex aspect-square w-full max-h-[min(48vh,320px)] items-center justify-center overflow-hidden rounded-[24px] bg-md3-surface-container-high shadow-xl disabled:cursor-default"
          >
            {currentTrack?.coverArt ? (
              <img src={currentTrack.coverArt} alt={currentTrack.title} className="h-full w-full object-cover" />
            ) : (
              <Disc3 className="h-24 w-24 text-md3-primary/40" strokeWidth={1.25} />
            )}
          </button>

          <div className="relative w-full min-w-0 px-8">
            <button
              type="button"
              onClick={() => currentTrack && onOpenTrackDetails(currentTrack)}
              disabled={!currentTrack}
              className="block w-full truncate text-center disabled:cursor-default"
              title={currentTrack ? text(language, 'Открыть сведения о треке', 'Open track details') : undefined}
            >
              <span className="block truncate text-base font-bold text-md3-on-surface">
                {currentTrack?.title || text(language, 'Ничего не играет', 'Nothing playing')}
              </span>
              <span className="mt-0.5 block truncate text-sm text-md3-on-surface-variant">
                {currentTrack?.artist || text(language, 'Выберите трек', 'Choose a track')}
              </span>
            </button>
            {currentTrack && (
              <button
                type="button"
                onClick={event => onToggleFavorite(currentTrack.id, event)}
                title={currentTrack.isFavorite ? text(language, 'Убрать из избранного', 'Remove from favorites') : text(language, 'Добавить в избранное', 'Add to favorites')}
                aria-label={currentTrack.isFavorite ? text(language, 'Убрать из избранного', 'Remove from favorites') : text(language, 'Добавить в избранное', 'Add to favorites')}
                aria-pressed={currentTrack.isFavorite}
                className={`absolute right-0 top-1/2 -translate-y-1/2 rounded-full p-2 transition-colors ${currentTrack.isFavorite ? 'text-red-500' : 'text-md3-on-surface-variant hover:text-red-500'}`}
              >
                <Heart size={18} className={currentTrack.isFavorite ? 'fill-current' : ''} />
              </button>
            )}
          </div>

          <div className="w-full space-y-1">
            <input
              aria-label={text(language, 'Позиция трека', 'Track position')}
              type="range"
              min={0}
              max={safeDuration || 1}
              step={0.1}
              value={safeTime}
              disabled={!currentTrack}
              onChange={event => onSeek(Number(event.target.value))}
              className="h-1.5 w-full cursor-pointer accent-md3-primary disabled:cursor-default"
            />
            <div className="flex justify-between font-mono text-[10px] text-md3-on-surface-variant">
              <span>{formatTime(safeTime)}</span>
              <span>{formatTime(safeDuration)}</span>
            </div>
          </div>

          <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center">
            <div className="flex min-w-0 items-center justify-start gap-0.5">
              <button type="button" onClick={onOpenEQ} title={text(language, 'Эквалайзер', 'Equalizer')} aria-label={text(language, 'Эквалайзер', 'Equalizer')} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-md3-outline-variant/15 bg-md3-surface-container text-md3-on-surface-variant shadow-xs hover:bg-md3-surface-container-high hover:text-md3-on-surface">
                <SlidersHorizontal size={14} />
              </button>
              {showDiscordButton && (
                <button
                  type="button"
                  onClick={onToggleDiscord}
                  title={language === 'ru' ? `Discord RPC: ${discordEnabled ? 'включен' : 'выключен'} — переключить` : `Discord RPC: ${discordEnabled ? 'enabled' : 'disabled'} — toggle`}
                  aria-label={language === 'ru' ? 'Переключить Discord RPC' : 'Toggle Discord RPC'}
                  aria-pressed={discordEnabled}
                  className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border shadow-xs transition-colors ${discordEnabled ? 'border-[#5865F2]/40 bg-[#5865F2]/20 text-[#7289da]' : 'border-md3-outline-variant/15 bg-md3-surface-container text-md3-on-surface-variant hover:bg-md3-surface-container-high'}`}
                >
                  <MessageCircle size={14} />
                  <span className={`absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full ${discordEnabled ? 'animate-pulse bg-[#5865F2]' : 'bg-gray-400'}`} />
                </button>
              )}
            </div>

            <div className="flex items-center justify-center gap-0.5">
              <button type="button" onClick={onToggleShuffle} title={isShuffled ? text(language, 'Перемешивание включено', 'Shuffle on') : text(language, 'Перемешивание выключено', 'Shuffle off')} aria-pressed={isShuffled} className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${isShuffled ? 'bg-md3-primary/10 text-md3-primary' : 'text-md3-on-surface-variant hover:bg-md3-surface-container-high hover:text-md3-on-surface'}`}>
                <Shuffle size={14} />
              </button>
              <button type="button" onClick={onPrev} title={text(language, 'Предыдущий трек', 'Previous track')} aria-label={text(language, 'Предыдущий трек', 'Previous track')} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-md3-on-surface hover:bg-md3-surface-container-high">
                <SkipBack size={17} />
              </button>
              <button type="button" onClick={onPlayPause} disabled={!currentTrack} title={isPlaying ? text(language, 'Пауза', 'Pause') : text(language, 'Воспроизвести', 'Play')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-md3-primary text-md3-on-primary shadow-lg transition-transform hover:scale-105 active:scale-95 disabled:opacity-40">
                {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
              </button>
              <button type="button" onClick={onNext} title={text(language, 'Следующий трек', 'Next track')} aria-label={text(language, 'Следующий трек', 'Next track')} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-md3-on-surface hover:bg-md3-surface-container-high">
                <SkipForward size={17} />
              </button>
              <button type="button" onClick={onToggleRepeat} title={`${text(language, 'Повтор', 'Repeat')}: ${repeatMode}`} aria-pressed={repeatMode !== 'off'} className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${repeatMode !== 'off' ? 'bg-md3-primary/10 text-md3-primary' : 'text-md3-on-surface-variant hover:bg-md3-surface-container-high hover:text-md3-on-surface'}`}>
                {repeatMode === 'one' ? <Repeat1 size={14} /> : <Repeat size={14} />}
              </button>
            </div>

            <div className="flex min-w-0 items-center justify-end gap-0.5">
              <div
                className="relative flex shrink-0 items-center justify-center"
                onMouseEnter={handleVolumeMouseEnter}
                onMouseLeave={handleVolumeMouseLeave}
                onWheel={handleVolumeWheel}
              >
                <button
                  type="button"
                  onClick={handleVolumeStepClick}
                  title={text(language, 'Громкость: нажмите для переключения уровня, наведите для точной настройки', 'Volume: click to cycle levels, hover for fine control')}
                  aria-label={text(language, 'Громкость', 'Volume')}
                  className={`flex h-7 w-7 items-center justify-center rounded-full border shadow-xs transition-all ${
                    isMuted || volume === 0
                      ? 'border-red-500/20 bg-red-500/10 text-red-400'
                      : 'border-md3-outline-variant/15 bg-md3-surface-container text-md3-on-surface-variant hover:bg-md3-surface-container-high hover:text-md3-on-surface'
                  }`}
                >
                  {isMuted || volume === 0 ? <VolumeX size={14} /> : volume < 0.5 ? <Volume1 size={14} /> : <Volume2 size={14} />}
                </button>
                {isCompactVolHovered && (
                  <div
                    className="absolute bottom-full left-1/2 z-50 -translate-x-1/2 pb-2 animate-in fade-in zoom-in-95 duration-150"
                    onMouseEnter={handleVolumeMouseEnter}
                    onMouseLeave={handleVolumeMouseLeave}
                    onClick={event => event.stopPropagation()}
                  >
                    <div className="flex min-w-[56px] flex-col items-center rounded-2xl border border-md3-outline-variant/30 bg-md3-surface-container-high/95 p-3 shadow-2xl backdrop-blur-xl">
                      <span className="mb-2 select-none font-mono text-[11px] font-bold text-md3-primary">{Math.round((isMuted ? 0 : volume) * 100)}%</span>
                      <div className="flex h-28 items-center justify-center py-1">
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          aria-label={text(language, 'Точная настройка громкости', 'Fine volume control')}
                          value={isMuted ? 0 : volume}
                          onChange={event => {
                            if (isMuted) onToggleMute();
                            onVolumeChange(Number(event.target.value));
                          }}
                          style={{ writingMode: 'vertical-lr', direction: 'rtl', height: '100px', width: '20px' }}
                          className="cursor-pointer accent-md3-primary outline-none"
                        />
                      </div>
                      <button type="button" onClick={onToggleMute} className="mt-2 rounded-full bg-md3-surface-container px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-md3-on-surface-variant transition-colors hover:bg-md3-surface-container-highest hover:text-md3-on-surface">
                        {isMuted || volume === 0 ? text(language, 'Включить', 'Unmute') : text(language, 'Без звука', 'Mute')}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={onToggleLyrics}
                disabled={!currentTrack}
                title={!currentTrack ? text(language, 'Текст песни', 'Lyrics') : currentTrack.lyrics?.trim() ? text(language, 'Открыть текст песни', 'Open lyrics') : text(language, 'Текст не добавлен', 'No lyrics added')}
                aria-label={text(language, 'Текст песни', 'Lyrics')}
                className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                  lyricsMode !== 'closed' || currentTrack?.lyrics?.trim()
                    ? 'bg-md3-primary/15 text-md3-primary hover:bg-md3-primary/25'
                    : 'border border-md3-outline-variant/15 bg-md3-surface-container text-md3-on-surface-variant hover:bg-md3-surface-container-high hover:text-md3-on-surface'
                }`}
              >
                <Mic2 size={14} />
                {!!currentTrack?.lyrics?.trim() && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-md3-primary" />}
              </button>

            </div>
          </div>

          <button
            type="button"
            onClick={() => togglePanel('queue')}
            aria-expanded={bottomPanel !== null}
            className={`flex h-8 w-full items-center justify-between rounded-full border px-4 text-xs transition-colors ${
              bottomPanel === 'queue'
                ? 'border-md3-primary/30 bg-md3-primary/10 text-md3-primary'
                : 'border-md3-outline-variant/20 bg-md3-surface-container-low text-md3-on-surface-variant hover:bg-md3-surface-container-high hover:text-md3-on-surface'
            }`}
          >
            <span className="flex items-center gap-2"><ListMusic size={14} />{text(language, 'Очередь', 'Queue')}<span className="rounded-full bg-md3-surface-container-high px-1.5 py-0.5 text-[9px]">{queue.length}</span></span>
            <ChevronDown size={15} className={`transition-transform ${bottomPanel === 'queue' ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {bottomPanel && (
          <div className="absolute inset-x-0 bottom-0 z-20 flex max-h-[62%] min-h-[220px] flex-col overflow-hidden rounded-t-2xl border-t border-md3-outline-variant/25 bg-md3-surface-container shadow-[0_-16px_45px_rgba(0,0,0,0.35)] anim-mini-panel-in">
            {bottomPanel === 'queue' ? (
              <>
                <header className="flex h-11 shrink-0 items-center gap-2 border-b border-md3-outline-variant/15 px-4">
                  <ListMusic size={16} className="text-md3-primary" />
                  <strong className="flex-1 text-xs">{text(language, 'Очередь воспроизведения', 'Play queue')} · {queue.length}</strong>
                  <button type="button" onClick={() => setBottomPanel('library')} className="rounded-lg px-2 py-1 text-[10px] text-md3-primary hover:bg-md3-primary/10">{text(language, 'Библиотека', 'Library')}</button>
                  <button type="button" onClick={onClearQueue} disabled={queue.length === 0} className="rounded-lg px-2 py-1 text-[10px] text-md3-on-surface-variant hover:bg-md3-surface-container-high disabled:opacity-30">{text(language, 'Очистить', 'Clear')}</button>
                  <button type="button" onClick={() => setBottomPanel(null)} aria-label={text(language, 'Закрыть', 'Close')} className="rounded-lg p-1.5 text-md3-on-surface-variant hover:bg-md3-surface-container-high"><X size={15} /></button>
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar p-2">
                  {queue.map((track, index) => (
                    <button key={`${track.id}-${index}`} ref={index === queueIndex ? queueActiveItemRef : undefined} type="button" onClick={() => onPlayQueueTrack(index)} className={`flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left ${index === queueIndex ? 'bg-md3-primary/12 text-md3-primary' : 'text-md3-on-surface hover:bg-md3-surface-container-high'}`}>
                      {track.coverArt ? <img src={track.coverArt} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" /> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-md3-surface-container-high"><Music2 size={15} /></span>}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium">{track.title}</span>
                        <span className="block truncate text-[10px] text-md3-on-surface-variant">{track.artist}</span>
                      </span>
                      <span className="text-[10px] tabular-nums text-md3-on-surface-variant">{formatTime(track.duration)}</span>
                    </button>
                  ))}
                  {queue.length === 0 && <p className="p-6 text-center text-xs text-md3-on-surface-variant">{text(language, 'Очередь пуста', 'Queue is empty')}</p>}
                </div>
              </>
            ) : (
              <>
                <header className="flex h-11 shrink-0 items-center gap-2 border-b border-md3-outline-variant/15 px-3">
                  <Library size={16} className="text-md3-primary" />
                  <strong className="min-w-0 flex-1 truncate text-xs">{currentPlaylist?.name || text(language, 'Библиотека', 'Library')}</strong>
                  <button type="button" onClick={() => setSelectedPlaylistId(null)} className={`rounded-lg px-2 py-1 text-[10px] ${!currentPlaylist ? 'bg-md3-primary/15 text-md3-primary' : 'text-md3-on-surface-variant hover:bg-md3-surface-container-high'}`}>{text(language, 'Все треки', 'All tracks')}</button>
                  <button type="button" onClick={() => setBottomPanel(null)} aria-label={text(language, 'Закрыть', 'Close')} className="rounded-lg p-1.5 text-md3-on-surface-variant hover:bg-md3-surface-container-high"><X size={15} /></button>
                </header>
                <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-md3-outline-variant/10 px-2 py-2 custom-scrollbar">
                  {playlists.map(playlist => (
                    <button key={playlist.id} type="button" onClick={() => setSelectedPlaylistId(playlist.id)} className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] ${selectedPlaylistId === playlist.id ? 'bg-md3-primary text-md3-on-primary' : 'bg-md3-surface-container-high text-md3-on-surface-variant hover:text-md3-on-surface'}`}>
                      {playlist.name}
                    </button>
                  ))}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar p-2">
                  {libraryTracks.map(track => (
                    <button key={track.id} type="button" onClick={() => onPlayTrack(track, libraryTracks)} className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-md3-on-surface hover:bg-md3-surface-container-high">
                      {track.coverArt ? <img src={track.coverArt} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" /> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-md3-surface-container-high"><Music2 size={15} /></span>}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium">{track.title}</span>
                        <span className="block truncate text-[10px] text-md3-on-surface-variant">{track.artist}</span>
                      </span>
                      <span className="text-[10px] tabular-nums text-md3-on-surface-variant">{formatTime(track.duration)}</span>
                    </button>
                  ))}
                  {libraryTracks.length === 0 && <p className="p-6 text-center text-xs text-md3-on-surface-variant">{text(language, 'В этом списке нет треков', 'No tracks in this list')}</p>}
                </div>
              </>
            )}
          </div>
        )}
      </section>

      {lyricsMode === 'attached' && (
        <MiniLyricsPane
          track={lyricsTrack}
          currentTime={currentTime}
          language={language}
          onDetach={onDetachLyrics}
          onClose={onCloseLyrics}
        />
      )}
    </div>
  );
};
