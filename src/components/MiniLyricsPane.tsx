import React, { useEffect, useMemo, useRef } from 'react';
import { Pin, PinOff } from 'lucide-react';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { AppLanguage } from '../i18n';

export interface MiniLyricsTrack {
  title: string;
  artist: string;
  lyrics?: string;
  isInstrumental?: boolean;
  lyricist?: string;
}

interface MiniLyricsPaneProps {
  track: MiniLyricsTrack | null;
  currentTime: number;
  language: AppLanguage;
  detached?: boolean;
  onDetach?: () => void;
  onAttach?: () => void;
  onClose?: () => void;
  onSeek?: (time: number) => void;
}

interface LyricLine {
  time: number;
  text: string;
}

const parseLyrics = (lyrics: string): LyricLine[] => {
  const timeRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
  const lines: LyricLine[] = [];

  for (const rawLine of lyrics.split('\n')) {
    const raw = rawLine.trim();
    if (!raw) continue;
    timeRegex.lastIndex = 0;
    const timestamps: number[] = [];
    let match: RegExpExecArray | null;
    let lastIndex = 0;
    while ((match = timeRegex.exec(raw)) !== null) {
      const fraction = match[3] ? Number(match[3].padEnd(3, '0')) / 1000 : 0;
      timestamps.push(Number(match[1]) * 60 + Number(match[2]) + fraction);
      lastIndex = timeRegex.lastIndex;
    }
    if (timestamps.length) {
      const lyricText = raw.slice(lastIndex).trim();
      timestamps.forEach(time => lines.push({ time, text: lyricText }));
    } else {
      lines.push({ time: -1, text: raw });
    }
  }

  return lines.sort((a, b) => a.time - b.time);
};

export const MiniLyricsPane: React.FC<MiniLyricsPaneProps> = ({
  track,
  currentTime,
  language,
  detached = false,
  onDetach,
  onAttach,
  onClose,
  onSeek,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLButtonElement>(null);
  const handleHeaderMouseDown = (event: React.MouseEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button') || !isTauri()) return;
    void getCurrentWindow().startDragging().catch(error => {
      console.warn('Unable to drag the lyrics window:', error);
    });
  };
  const lyrics = track?.lyrics?.trim() || '';
  const lines = useMemo(() => parseLyrics(lyrics), [lyrics]);
  const isSynced = lines.some(line => line.time >= 0);
  const activeLineIndex = useMemo(() => {
    if (!isSynced || lines.length === 0) return -1;
    let index = -1;
    for (let i = 0; i < lines.length; i += 1) {
      if (lines[i].time >= 0 && lines[i].time <= currentTime) index = i;
      else if (lines[i].time > currentTime) break;
    }
    return index;
  }, [currentTime, isSynced, lines]);

  useEffect(() => {
    const container = scrollRef.current;
    const activeLine = activeLineRef.current;
    if (!isSynced || !container || !activeLine) return;
    const containerRect = container.getBoundingClientRect();
    const lineRect = activeLine.getBoundingClientRect();
    const centeredScrollTop = container.scrollTop + lineRect.top - containerRect.top
      - (container.clientHeight - activeLine.offsetHeight) / 2;
    container.scrollTo({ top: Math.max(0, centeredScrollTop), behavior: 'smooth' });
  }, [activeLineIndex, isSynced]);

  return (
    <aside className={`flex min-h-0 flex-col bg-md3-surface-container-low ${detached ? 'h-screen w-screen' : 'h-full w-[300px] shrink-0 border-l border-md3-outline-variant/20'}`}>
      <header
        data-tauri-drag-region
        onMouseDown={handleHeaderMouseDown}
        className="flex h-11 shrink-0 items-center gap-2 border-b border-md3-outline-variant/15 px-3"
      >
        <div data-tauri-drag-region className="flex h-full min-w-0 flex-1 flex-col justify-center">
          <div className="text-xs font-bold text-md3-on-surface">{language === 'ru' ? 'Текст песни' : 'Lyrics'}</div>
          {track && <div className="truncate text-[10px] text-md3-on-surface-variant">{track.title} · {track.artist}</div>}
        </div>
        <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties} className="flex shrink-0 items-center gap-1">
          {detached ? (
            onAttach && (
              <button
                type="button"
                onClick={onAttach}
                aria-label={language === 'ru' ? 'Прикрепить к мини-плееру' : 'Attach to mini player'}
                title={language === 'ru' ? 'Прикрепить к мини-плееру' : 'Attach to mini player'}
                className="rounded-lg p-1.5 text-md3-primary hover:bg-md3-primary/10"
              >
                <Pin size={15} />
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={onDetach}
              aria-label={language === 'ru' ? 'Открепить от мини-плеера' : 'Detach from mini player'}
              title={language === 'ru' ? 'Открепить от мини-плеера' : 'Detach from mini player'}
              className="rounded-lg p-1.5 text-md3-primary hover:bg-md3-primary/10"
            >
              <PinOff size={15} />
            </button>
          )}
          <button type="button" onClick={onClose} aria-label={detached ? (language === 'ru' ? 'Закрыть' : 'Close') : (language === 'ru' ? 'Скрыть текст' : 'Hide lyrics')} className="rounded-lg p-1.5 text-md3-on-surface-variant hover:bg-md3-surface-container-high">
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 custom-scrollbar">
        {!track ? (
          <p className="pt-12 text-center text-sm text-md3-on-surface-variant">{language === 'ru' ? 'Включите трек, чтобы увидеть текст' : 'Start a track to view lyrics'}</p>
        ) : track.isInstrumental ? (
          <p className="pt-12 text-center text-sm text-md3-on-surface-variant">{language === 'ru' ? 'Инструментальная композиция' : 'Instrumental track'}</p>
        ) : !lyrics ? (
          <p className="pt-12 text-center text-sm text-md3-on-surface-variant">{language === 'ru' ? 'Текст песни не добавлен' : 'No lyrics available'}</p>
        ) : (
          <div className="mx-auto max-w-lg">
            {track.lyricist && <p className="mb-5 text-center text-xs text-md3-on-surface-variant">{language === 'ru' ? 'Слова' : 'Lyrics'}: {track.lyricist}</p>}
            {isSynced ? (
              <div className="space-y-3 py-5 text-center">
                {lines.map((line, index) => {
                  const isActive = index === activeLineIndex;
                  const isPast = activeLineIndex !== -1 && index < activeLineIndex;
                  return (
                    <button
                      key={`${line.time}-${index}`}
                      ref={isActive ? activeLineRef : undefined}
                      type="button"
                      disabled={line.time < 0 || !onSeek}
                      onClick={() => line.time >= 0 && onSeek?.(line.time)}
                      className={`w-full rounded-2xl px-3 py-2 text-sm font-medium leading-relaxed transition-colors duration-300 disabled:cursor-default ${
                        isActive
                          ? 'bg-md3-primary/10 text-md3-primary'
                          : isPast
                            ? 'text-md3-on-surface-variant/50'
                            : 'text-md3-on-surface-variant/70'
                      }`}
                    >
                      {line.text || '♪'}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="py-4 text-center text-sm font-medium leading-relaxed text-md3-on-surface whitespace-pre-wrap">
                {lyrics}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
