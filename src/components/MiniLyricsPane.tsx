import React, { useEffect, useMemo, useRef } from 'react';
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
}

interface LyricLine {
  time: number | null;
  text: string;
}

const parseLyrics = (lyrics: string): LyricLine[] => {
  const timeRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
  const lines: LyricLine[] = [];

  for (const rawLine of lyrics.split('\n')) {
    const raw = rawLine.trim();
    if (!raw) continue;
    const timestamps: number[] = [];
    let match: RegExpExecArray | null;
    let lastIndex = 0;
    while ((match = timeRegex.exec(raw)) !== null) {
      const fraction = match[3] ? Number(match[3].padEnd(3, '0')) / 1000 : 0;
      timestamps.push(Number(match[1]) * 60 + Number(match[2]) + fraction);
      lastIndex = timeRegex.lastIndex;
    }
    const text = timestamps.length ? raw.slice(lastIndex).trim() : raw;
    if (!text) continue;
    if (timestamps.length) timestamps.forEach(time => lines.push({ time, text }));
    else lines.push({ time: null, text });
  }

  return lines.sort((a, b) => (a.time ?? Number.POSITIVE_INFINITY) - (b.time ?? Number.POSITIVE_INFINITY));
};

export const MiniLyricsPane: React.FC<MiniLyricsPaneProps> = ({
  track,
  currentTime,
  language,
  detached = false,
  onDetach,
  onAttach,
  onClose,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLParagraphElement>(null);
  const lyrics = track?.lyrics?.trim() || '';
  const lines = useMemo(() => parseLyrics(lyrics), [lyrics]);
  const isSynced = lines.some(line => line.time !== null);
  const activeLineIndex = useMemo(() => {
    if (!isSynced) return -1;
    let index = -1;
    lines.forEach((line, i) => {
      if (line.time !== null && line.time <= currentTime) index = i;
    });
    return index;
  }, [currentTime, isSynced, lines]);

  useEffect(() => {
    activeLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeLineIndex]);

  return (
    <aside className={`flex min-h-0 flex-col bg-md3-surface-container-low ${detached ? 'h-screen w-screen' : 'h-full w-[300px] shrink-0 border-l border-md3-outline-variant/20'}`}>
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-md3-outline-variant/15 px-3">
        <div data-tauri-drag-region className="flex h-full min-w-0 flex-1 flex-col justify-center">
          <div className="text-xs font-bold text-md3-on-surface">{language === 'ru' ? 'Текст песни' : 'Lyrics'}</div>
          {track && <div className="truncate text-[10px] text-md3-on-surface-variant">{track.title} · {track.artist}</div>}
        </div>
        <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties} className="flex shrink-0 items-center gap-1">
          {detached ? (
            <button type="button" onClick={onAttach} className="rounded-lg px-2 py-1 text-[10px] text-md3-primary hover:bg-md3-primary/10">
              {language === 'ru' ? 'Прикрепить' : 'Attach'}
            </button>
          ) : (
            <button type="button" onClick={onDetach} className="rounded-lg px-2 py-1 text-[10px] text-md3-primary hover:bg-md3-primary/10">
              {language === 'ru' ? 'Отсоединить' : 'Detach'}
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
          <div className="space-y-2">
            {track.lyricist && <p className="mb-5 text-xs text-md3-on-surface-variant">{language === 'ru' ? 'Слова' : 'Lyrics'}: {track.lyricist}</p>}
            {lines.map((line, index) => (
              <p
                key={`${line.time ?? 'plain'}-${index}`}
                ref={index === activeLineIndex ? activeLineRef : undefined}
                className={`whitespace-pre-wrap break-words text-sm leading-relaxed transition-colors ${
                  index === activeLineIndex ? 'font-semibold text-md3-primary' : 'text-md3-on-surface-variant'
                }`}
              >
                {line.text}
              </p>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};
