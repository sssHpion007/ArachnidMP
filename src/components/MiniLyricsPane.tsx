import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Edit3, FileText, Music2, PenTool, Pin, PinOff, RotateCw, Save } from 'lucide-react';
import { LyricsActionsMenu, type LyricsMenuAction } from './LyricsActionsMenu';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { AppLanguage } from '../i18n';

export interface MiniLyricsTrack {
  id?: string;
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
  attachedToMiniPlayer?: boolean;
  onDetach?: () => void;
  onAttach?: () => void;
  onClose?: () => void;
  onSeek?: (time: number) => void;
  onSaveLyrics?: (trackId: string, lyrics: string, isInstrumental: boolean, lyricist?: string) => void;
  onReloadLyrics?: (trackId: string) => Promise<void> | void;
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
  attachedToMiniPlayer = false,
  onDetach,
  onAttach,
  onClose,
  onSeek,
  onSaveLyrics,
  onReloadLyrics,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLButtonElement>(null);
  const contextTargetRef = useRef<HTMLElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedLyrics, setEditedLyrics] = useState(track?.lyrics || '');
  const [editedLyricist, setEditedLyricist] = useState(track?.lyricist || '');
  const [isInstrumental, setIsInstrumental] = useState(!!track?.isInstrumental);
  const [copiedLyrics, setCopiedLyrics] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
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
    setEditedLyrics(track?.lyrics || '');
    setEditedLyricist(track?.lyricist || '');
    setIsInstrumental(!!track?.isInstrumental);
    setIsEditing(false);
    setCopiedLyrics(false);
    setIsActionsMenuOpen(false);
  }, [track?.id, track?.lyrics, track?.lyricist, track?.isInstrumental]);

  useEffect(() => {
    const container = scrollRef.current;
    const activeLine = activeLineRef.current;
    if (isEditing || !isSynced || !container || !activeLine) return;
    const containerRect = container.getBoundingClientRect();
    const lineRect = activeLine.getBoundingClientRect();
    const centeredScrollTop = container.scrollTop + lineRect.top - containerRect.top
      - (container.clientHeight - activeLine.offsetHeight) / 2;
    container.scrollTo({ top: Math.max(0, centeredScrollTop), behavior: 'smooth' });
  }, [activeLineIndex, isSynced, isEditing]);

  const hasLyricsText = !!lyrics && !isInstrumental && !track?.isInstrumental;
  const instrumentalState = isInstrumental || !!track?.isInstrumental;
  const handleCopyLyrics = async () => {
    if (!lyrics) return;
    const cleanText = lyrics
      .split('\n')
      .map(line => line.replace(/\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/g, '').trim())
      .filter(Boolean)
      .join('\n');
    try {
      await navigator.clipboard.writeText(cleanText || lyrics);
      setCopiedLyrics(true);
      setTimeout(() => setCopiedLyrics(false), 2000);
    } catch (error) {
      console.warn('Unable to copy lyrics:', error);
    }
  };
  const handleSave = () => {
    if (!track?.id || !onSaveLyrics) return;
    onSaveLyrics(track.id, editedLyrics.trim(), isInstrumental, editedLyricist.trim());
    setIsEditing(false);
  };
  const handleToggleInstrumental = () => {
    if (!track?.id || !onSaveLyrics) return;
    const nextValue = !instrumentalState;
    const nextLyrics = nextValue ? '' : editedLyrics.trim();
    setIsInstrumental(nextValue);
    setEditedLyrics(nextLyrics);
    onSaveLyrics(track.id, nextLyrics, nextValue, editedLyricist.trim());
  };
  const lyricsActions: LyricsMenuAction[] = [
    ...(onReloadLyrics && track?.id ? [{
      id: 'reload',
      label: isReloading
        ? (language === 'ru' ? 'Перечитываю…' : 'Reloading…')
        : (language === 'ru' ? 'Перечитать из файла' : 'Reload from file'),
      icon: RotateCw,
      disabled: isReloading,
      onSelect: async () => {
        setIsReloading(true);
        try {
          await onReloadLyrics(track.id!);
        } finally {
          setTimeout(() => setIsReloading(false), 600);
        }
      },
    }] : []),
    ...(hasLyricsText ? [{
      id: 'copy',
      label: copiedLyrics
        ? (language === 'ru' ? 'Скопировано' : 'Copied')
        : (language === 'ru' ? 'Скопировать текст' : 'Copy lyrics'),
      icon: copiedLyrics ? Check : Copy,
      onSelect: handleCopyLyrics,
    }] : []),
    {
      id: 'edit',
      label: isEditing
        ? (language === 'ru' ? 'Вернуться к тексту' : 'View lyrics')
        : (language === 'ru' ? 'Редактировать текст' : 'Edit lyrics'),
      icon: isEditing ? FileText : Edit3,
      disabled: !onSaveLyrics || !track?.id,
      onSelect: () => setIsEditing(value => !value),
      dividerBefore: !!onReloadLyrics || hasLyricsText,
    },
    {
      id: 'instrumental',
      label: instrumentalState
        ? (language === 'ru' ? 'Снять отметку «Инструментал»' : 'Unmark as instrumental')
        : (language === 'ru' ? 'Отметить как инструментал' : 'Mark as instrumental'),
      icon: Music2,
      disabled: !onSaveLyrics || !track?.id,
      onSelect: handleToggleInstrumental,
      dividerBefore: true,
    },
  ];

  return (
    <aside ref={contextTargetRef} className={`flex min-h-0 flex-col bg-md3-surface-container-low ${
      detached
        ? 'h-full w-full'
        : attachedToMiniPlayer
          ? '-mt-4 h-[calc(100%+1rem)] w-[300px] shrink-0 border-l border-md3-outline-variant/20'
          : 'h-full w-[300px] shrink-0 border-l border-md3-outline-variant/20'
    }`}>
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
          <LyricsActionsMenu
            actions={lyricsActions}
            language={language}
            contextTargetRef={contextTargetRef}
            isOpen={isActionsMenuOpen}
            onOpenChange={setIsActionsMenuOpen}
          />
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
        {isEditing ? (
          <div className="flex min-h-full flex-col gap-3">
            <label className="flex items-center gap-2 rounded-xl border border-md3-outline-variant/15 bg-md3-surface-container p-2 text-xs">
              <PenTool size={14} className="shrink-0 text-md3-primary" />
              <span className="shrink-0 font-semibold">{language === 'ru' ? 'Автор текста' : 'Lyricist'}</span>
              <input
                value={editedLyricist}
                onChange={event => setEditedLyricist(event.target.value)}
                placeholder={language === 'ru' ? 'Имя автора' : 'Lyricist name'}
                className="min-w-0 flex-1 rounded-lg bg-md3-surface-container-high px-2 py-1 text-xs text-md3-on-surface"
              />
            </label>
            <textarea
              value={editedLyrics}
              onChange={event => setEditedLyrics(event.target.value)}
              placeholder={language === 'ru' ? 'Введите текст песни…' : 'Enter lyrics…'}
              className="min-h-[180px] flex-1 resize-none rounded-xl border border-md3-outline-variant/20 bg-md3-surface-container p-3 text-sm leading-relaxed text-md3-on-surface outline-none focus:border-md3-primary"
            />
            <label className="flex items-center gap-2 text-xs text-md3-on-surface-variant">
              <input
                type="checkbox"
                checked={isInstrumental}
                onChange={event => setIsInstrumental(event.target.checked)}
                className="h-4 w-4 accent-md3-primary"
              />
              {language === 'ru' ? 'Инструментальная композиция' : 'Instrumental track'}
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setIsEditing(false)} className="rounded-full px-3 py-2 text-xs text-md3-on-surface-variant hover:bg-md3-surface-container-high">
                {language === 'ru' ? 'Отмена' : 'Cancel'}
              </button>
              <button type="button" onClick={handleSave} className="flex items-center gap-1.5 rounded-full bg-md3-primary px-4 py-2 text-xs font-semibold text-md3-on-primary">
                <Save size={13} />{language === 'ru' ? 'Сохранить' : 'Save'}
              </button>
            </div>
          </div>
        ) : !track ? (
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
