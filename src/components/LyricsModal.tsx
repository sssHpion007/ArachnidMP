import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Mic2, 
  X, 
  Edit3, 
  Check, 
  Music2, 
  Save, 
  FileText,
  Copy,
  ExternalLink,
  PenTool,
  RotateCw
} from 'lucide-react';
import { Track } from '../types/music';
import { AppLanguage } from '../i18n';
import { useModalAnimation } from '../utils/useModalAnimation';
import { LyricsActionsMenu, type LyricsMenuAction } from './LyricsActionsMenu';

interface LyricsModalProps {
  isOpen: boolean;
  track: Track | null;
  currentTime: number;
  isPlaying: boolean;
  language?: AppLanguage;
  onSeek?: (time: number) => void;
  onSaveLyrics: (trackId: string, lyrics: string, isInstrumental: boolean, lyricist?: string) => void;
  onReloadLyrics?: (trackId: string) => Promise<void> | void;
  onDetach?: () => void;
  onClose: () => void;
}

interface ParsedLine {
  time: number;
  text: string;
}

export const LyricsModal: React.FC<LyricsModalProps> = ({
  isOpen,
  track: incomingTrack,
  currentTime,
  isPlaying,
  language = 'ru',
  onSeek,
  onSaveLyrics,
  onReloadLyrics,
  onDetach,
  onClose,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [editedLyricist, setEditedLyricist] = useState('');
  const [isInstrumental, setIsInstrumental] = useState(false);
  const [copiedLyrics, setCopiedLyrics] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const contextTargetRef = useRef<HTMLDivElement>(null);

  const cachedTrackRef = useRef<Track | null>(incomingTrack);
  if (incomingTrack) {
    cachedTrackRef.current = incomingTrack;
  }
  const activeTrack = incomingTrack || cachedTrackRef.current;

  useEffect(() => {
    if (activeTrack) {
      setEditedText(activeTrack.lyrics || '');
      setEditedLyricist(activeTrack.lyricist || '');
      setIsInstrumental(!!activeTrack.isInstrumental);
      setIsEditing(false);
      setCopiedLyrics(false);
      setIsActionsMenuOpen(false);
    }
  }, [activeTrack?.id, activeTrack?.lyrics, activeTrack?.lyricist, activeTrack?.isInstrumental, isOpen]);

  // Parse LRC formatted lyrics if timestamps exist: [mm:ss.xx] or [mm:ss]
  const { isSynced, lines } = useMemo(() => {
    if (!activeTrack?.lyrics || activeTrack.isInstrumental) {
      return { isSynced: false, lines: [] };
    }

    const rawLines = activeTrack.lyrics.split('\n');
    const parsed: ParsedLine[] = [];
    const timeRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
    let hasTimestamps = false;

    for (const raw of rawLines) {
      const trimmed = raw.trim();
      if (!trimmed) continue;

      let match;
      const times: number[] = [];
      let lastIndex = 0;

      while ((match = timeRegex.exec(trimmed)) !== null) {
        hasTimestamps = true;
        const mins = parseInt(match[1], 10);
        const secs = parseInt(match[2], 10);
        const ms = match[3] ? parseInt(match[3].padEnd(3, '0'), 10) : 0;
        times.push(mins * 60 + secs + ms / 1000);
        lastIndex = timeRegex.lastIndex;
      }

      const text = trimmed.substring(lastIndex).trim();
      if (times.length > 0) {
        for (const t of times) {
          parsed.push({ time: t, text });
        }
      } else {
        // Line without timestamp in a synced file
        parsed.push({ time: -1, text: trimmed });
      }
    }

    parsed.sort((a, b) => a.time - b.time);
    return { isSynced: hasTimestamps, lines: parsed };
  }, [activeTrack?.lyrics, activeTrack?.isInstrumental]);

  // Find active line index based on currentTime
  const activeLineIndex = useMemo(() => {
    if (!isSynced || lines.length === 0) return -1;
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time !== -1 && lines[i].time <= currentTime) {
        idx = i;
      } else if (lines[i].time > currentTime) {
        break;
      }
    }
    return idx;
  }, [isSynced, lines, currentTime]);

  // Auto-scroll to active line
  useEffect(() => {
    if (isSynced && !isEditing && activeLineRef.current && scrollContainerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeLineIndex, isSynced, isEditing]);

  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (isActionsMenuOpen) {
          setIsActionsMenuOpen(false);
        } else if (isEditing) {
          setIsEditing(false);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [isOpen, isEditing, isActionsMenuOpen, onClose]);

  const { isRendered, backdropClass, dialogClass } = useModalAnimation(isOpen && !!activeTrack, 200);

  if (!isRendered || !activeTrack) return null;
  const track = activeTrack;

  const handleSave = () => {
    onSaveLyrics(track.id, editedText.trim(), isInstrumental, editedLyricist.trim());
    setIsEditing(false);
  };

  const handleMarkInstrumental = () => {
    setIsInstrumental(true);
    setEditedText('');
    onSaveLyrics(track.id, '', true, editedLyricist.trim());
    setIsEditing(false);
  };

  const handleCopyLyrics = async () => {
    if (!track.lyrics) return;
    const cleanText = track.lyrics
      .split('\n')
      .map(line => line.replace(/\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/g, '').trim())
      .filter(line => line.length > 0)
      .join('\n');
    try {
      await navigator.clipboard.writeText(cleanText || track.lyrics);
      setCopiedLyrics(true);
      setTimeout(() => setCopiedLyrics(false), 2000);
    } catch (error) {
      console.warn('Unable to copy lyrics:', error);
    }
  };

  const hasLyricsText = !!track.lyrics && track.lyrics.trim().length > 0 && !track.isInstrumental;
  const currentInstrumentalState = isInstrumental || !!track.isInstrumental;
  const toggleInstrumentalState = () => {
    if (currentInstrumentalState) {
      setIsInstrumental(false);
      onSaveLyrics(track.id, editedText.trim(), false, editedLyricist.trim());
    } else {
      handleMarkInstrumental();
    }
  };
  const lyricsActions: LyricsMenuAction[] = [
    ...(onReloadLyrics ? [{
      id: 'reload',
      label: isReloading
        ? (language === 'ru' ? 'Перечитываю…' : 'Reloading…')
        : (language === 'ru' ? 'Перечитать из файла' : 'Reload from file'),
      icon: RotateCw,
      disabled: isReloading,
      onSelect: async () => {
        setIsReloading(true);
        try {
          await onReloadLyrics(track.id);
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
      onSelect: () => setIsEditing(value => !value),
      dividerBefore: !!onReloadLyrics || hasLyricsText,
    },
    {
      id: 'instrumental',
      label: currentInstrumentalState
        ? (language === 'ru' ? 'Снять отметку «Инструментал»' : 'Unmark as instrumental')
        : (language === 'ru' ? 'Отметить как инструментал' : 'Mark as instrumental'),
      icon: Music2,
      onSelect: toggleInstrumentalState,
      dividerBefore: true,
    },
  ];

  return (
    <div
      onClick={onClose}
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md select-none cursor-pointer ${backdropClass}`}
    >
      <div
        ref={contextTargetRef}
        className={`lyrics-modal-container w-full max-w-2xl bg-md3-surface-container rounded-3xl shadow-2xl border border-md3-outline-variant/20 overflow-hidden flex flex-col h-[85vh] max-h-[720px] cursor-default ${dialogClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header actions stay compact; the complete action list is available via the menu or right-click. */}
        <div className="shrink-0 border-b border-md3-outline-variant/15 bg-md3-surface-container-high/50">
          <div className="flex items-start gap-3 px-4 pt-4">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-md3-primary/15 text-md3-primary shadow-sm">
              <Mic2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-bold leading-tight text-md3-on-surface" title={track.title}>
                {track.title}
              </h2>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-md3-on-surface-variant">
                <span className="min-w-0 max-w-full truncate" title={track.artist}>{track.artist}</span>
                {track.lyricist && (
                  <span className="shrink-0 rounded-full bg-md3-primary/10 px-2 py-0.5 text-[11px] font-semibold text-md3-primary/90">
                    {language === 'ru' ? `Слова: ${track.lyricist}` : `Lyrics: ${track.lyricist}`}
                  </span>
                )}
                {isSynced && (
                  <span className="shrink-0 text-[11px] opacity-75">
                    {language === 'ru' ? 'Синхронизированный текст · LRC' : 'Synchronized lyrics · LRC'}
                  </span>
                )}
              </div>
            </div>
            <div className="-mr-1 -mt-1 flex shrink-0 items-center gap-0.5">
              <LyricsActionsMenu
                actions={lyricsActions}
                language={language}
                contextTargetRef={contextTargetRef}
                isOpen={isActionsMenuOpen}
                onOpenChange={setIsActionsMenuOpen}
              />
              {onDetach && (
                <button
                  type="button"
                  onClick={onDetach}
                  aria-label={language === 'ru' ? 'Открыть в плавающем окне' : 'Open in a floating window'}
                  title={language === 'ru' ? 'Открыть в плавающем окне [Shift+T]' : 'Open in a floating window [Shift+T]'}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-md3-primary transition-colors hover:bg-md3-primary/10"
                >
                  <ExternalLink className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label={language === 'ru' ? 'Закрыть' : 'Close'}
                title={language === 'ru' ? 'Закрыть [Esc]' : 'Close [Esc]'}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-md3-on-surface-variant transition-colors hover:bg-md3-surface-container hover:text-md3-on-surface"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-6 custom-scrollbar relative"
        >
          {isEditing ? (
            /* Edit Mode */
            <div className="flex flex-col h-full space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-xs text-md3-on-surface-variant">
                <span>
                  {language === 'ru' 
                    ? 'Редактирование текста песни (поддерживается стандартный LRC с метками времени [mm:ss.xx])' 
                    : 'Editing lyrics (standard LRC timestamp tags [mm:ss.xx] supported)'}
                </span>
              </div>

              {/* Author / Lyricist Field */}
              <div className="flex items-center gap-2 p-2 rounded-2xl bg-md3-surface-container-low border border-md3-outline-variant/15">
                <PenTool className="w-4 h-4 text-md3-primary ml-1.5 shrink-0" />
                <span className="text-xs font-semibold text-md3-on-surface shrink-0">
                  {language === 'ru' ? 'Автор текста:' : 'Lyricist:'}
                </span>
                <input
                  type="text"
                  value={editedLyricist}
                  onChange={(e) => setEditedLyricist(e.target.value)}
                  placeholder={language === 'ru' ? 'Имя автора текста / поэта...' : 'Lyricist / poet name...'}
                  className="flex-1 px-3 py-1 rounded-xl text-xs bg-md3-surface text-md3-on-surface border border-md3-outline-variant/20 focus:border-md3-primary outline-none transition-all"
                />
              </div>

              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                placeholder={language === 'ru' ? 'Вставьте или введите текст песни сюда...' : 'Paste or type lyrics here...'}
                className="flex-1 w-full p-4 rounded-2xl bg-md3-surface text-sm text-md3-on-surface placeholder-md3-on-surface-variant/40 border border-md3-outline-variant/20 focus:border-md3-primary outline-none transition-all resize-none font-sans leading-relaxed custom-scrollbar shadow-inner min-h-[220px]"
              />

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-md3-on-surface-variant">
                  <input
                    type="checkbox"
                    checked={isInstrumental}
                    onChange={(e) => setIsInstrumental(e.target.checked)}
                    className="w-4 h-4 accent-md3-primary rounded cursor-pointer"
                  />
                  <span>
                    {language === 'ru' ? 'Инструментальная композиция (без слов)' : 'Instrumental track (no lyrics)'}
                  </span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 rounded-full text-xs font-semibold text-md3-on-surface-variant hover:bg-md3-surface-container-high transition-colors cursor-pointer"
                  >
                    {language === 'ru' ? 'Отмена' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-md3-primary text-md3-on-primary text-xs font-bold shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{language === 'ru' ? 'Сохранить' : 'Save'}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : isInstrumental || track.isInstrumental ? (
            /* Instrumental State */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-md3-on-surface-variant">
              <div className="w-20 h-20 rounded-full bg-md3-surface-container-high flex items-center justify-center text-md3-primary mb-4 shadow-sm">
                <Music2 className="w-10 h-10 animate-pulse" />
              </div>
              <h3 className="text-lg font-bold text-md3-on-surface mb-1">
                {language === 'ru' ? 'Инструментальный трек' : 'Instrumental Track'}
              </h3>
              <p className="text-xs text-md3-on-surface-variant max-w-sm mb-4">
                {language === 'ru' ? 'Эта композиция отмечена как трек без слов.' : 'This track is marked as instrumental.'}
              </p>
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-md3-surface-container-high hover:bg-md3-primary hover:text-md3-on-primary text-xs font-semibold text-md3-on-surface transition-all cursor-pointer border border-md3-outline-variant/20"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{language === 'ru' ? 'Добавить слова к треку' : 'Add lyrics to track'}</span>
              </button>
            </div>
          ) : !track.lyrics || track.lyrics.trim().length === 0 ? (
            /* Empty State */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-md3-on-surface-variant">
              <div className="w-20 h-20 rounded-full bg-md3-surface-container-high flex items-center justify-center text-md3-primary mb-4 shadow-sm">
                <FileText className="w-10 h-10 opacity-60" />
              </div>
              <h3 className="text-lg font-bold text-md3-on-surface mb-1">
                {language === 'ru' ? 'Текст песни пока отсутствует' : 'No lyrics available yet'}
              </h3>
              <p className="text-xs text-md3-on-surface-variant max-w-sm mb-5">
                {language === 'ru' 
                  ? 'Вы можете добавить текст песни вручную или пометить композицию как инструментал.' 
                  : 'You can add lyrics manually or mark this track as instrumental.'}
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-md3-primary text-md3-on-primary text-xs font-bold shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{language === 'ru' ? 'Добавить текст' : 'Add Lyrics'}</span>
                </button>
                <button
                  onClick={handleMarkInstrumental}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-md3-surface-container text-xs font-semibold text-md3-on-surface hover:bg-md3-surface-container-high border border-md3-outline-variant/20 transition-all cursor-pointer"
                >
                  <span>{language === 'ru' ? 'Без слов' : 'Instrumental'}</span>
                </button>
              </div>
            </div>
          ) : isSynced ? (
            /* Synchronized Lyrics (LRC) */
            <div className="space-y-4 py-8 text-center">
              {lines.map((line, idx) => {
                const isActive = idx === activeLineIndex;
                const isPast = activeLineIndex !== -1 && idx < activeLineIndex;

                return (
                  <div
                    key={idx}
                    ref={isActive ? activeLineRef : undefined}
                    onClick={() => {
                      if (line.time >= 0 && onSeek) {
                        onSeek(line.time);
                      }
                    }}
                    className={`py-2 px-4 rounded-2xl transition-all duration-300 cursor-pointer select-none ${
                      isActive
                        ? 'text-lg md:text-xl font-extrabold text-md3-primary scale-105 bg-md3-primary/10 shadow-sm'
                        : isPast
                        ? 'text-sm md:text-base font-medium text-md3-on-surface-variant/50 hover:text-md3-on-surface'
                        : 'text-sm md:text-base font-medium text-md3-on-surface-variant/70 hover:text-md3-on-surface'
                    }`}
                  >
                    {line.text || '♪'}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Plain Unsynchronized Lyrics */
            <div className="py-4 text-center max-w-lg mx-auto">
              <div className="text-sm md:text-base leading-relaxed text-md3-on-surface whitespace-pre-wrap font-medium">
                {track.lyrics}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
