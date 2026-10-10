import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Mic2, 
  X, 
  Edit3, 
  Check, 
  Music2, 
  Sparkles, 
  Save, 
  FileText,
  Clock,
  Copy,
  PenTool
} from 'lucide-react';
import { Track } from '../types/music';

interface LyricsModalProps {
  isOpen: boolean;
  track: Track | null;
  currentTime: number;
  isPlaying: boolean;
  onSeek?: (time: number) => void;
  onSaveLyrics: (trackId: string, lyrics: string, isInstrumental: boolean, lyricist?: string) => void;
  onClose: () => void;
}

interface ParsedLine {
  time: number;
  text: string;
}

export const LyricsModal: React.FC<LyricsModalProps> = ({
  isOpen,
  track,
  currentTime,
  isPlaying,
  onSeek,
  onSaveLyrics,
  onClose,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [editedLyricist, setEditedLyricist] = useState('');
  const [isInstrumental, setIsInstrumental] = useState(false);
  const [copiedLyrics, setCopiedLyrics] = useState(false);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (track) {
      setEditedText(track.lyrics || '');
      setEditedLyricist(track.lyricist || '');
      setIsInstrumental(!!track.isInstrumental);
      setIsEditing(false);
      setCopiedLyrics(false);
    }
  }, [track, isOpen]);

  // Parse LRC formatted lyrics if timestamps exist: [mm:ss.xx] or [mm:ss]
  const { isSynced, lines } = useMemo(() => {
    if (!track?.lyrics || track.isInstrumental) {
      return { isSynced: false, lines: [] };
    }

    const rawLines = track.lyrics.split('\n');
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
  }, [track?.lyrics, track?.isInstrumental]);

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
        if (isEditing) {
          setIsEditing(false);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [isOpen, isEditing, onClose]);

  if (!isOpen || !track) return null;

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

  const handleCopyLyrics = () => {
    if (!track.lyrics) return;

    // If lyrics are in LRC format, strip timestamp tags for clean readable text
    const cleanText = track.lyrics
      .split('\n')
      .map(line => line.replace(/\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/g, '').trim())
      .filter(line => line.length > 0)
      .join('\n');

    navigator.clipboard.writeText(cleanText || track.lyrics);
    setCopiedLyrics(true);
    setTimeout(() => setCopiedLyrics(false), 2000);
  };

  const hasLyricsText = !!track.lyrics && track.lyrics.trim().length > 0 && !track.isInstrumental;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150 select-none cursor-pointer"
    >
      <div
        className="w-full max-w-2xl bg-md3-surface-container rounded-3xl shadow-2xl border border-md3-outline-variant/20 overflow-hidden flex flex-col h-[85vh] max-h-[720px] animate-in zoom-in-95 duration-200 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 pb-4 border-b border-md3-outline-variant/15 flex items-center justify-between bg-md3-surface-container-high/50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-md3-primary/15 text-md3-primary flex items-center justify-center shadow-sm shrink-0">
              <Mic2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-md3-on-surface leading-tight truncate">
                {track.title}
              </h2>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-md3-on-surface-variant truncate font-medium">
                <span className="truncate">{track.artist}</span>
                {track.lyricist && (
                  <span className="text-[11px] text-md3-primary/90 font-semibold bg-md3-primary/10 px-2 py-0.5 rounded-full shrink-0">
                    Слова: {track.lyricist}
                  </span>
                )}
                {isSynced && (
                  <span className="text-[11px] opacity-75 shrink-0">
                    • Синхронизированный (LRC)
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Small Copy Lyrics Button (if lyrics exist) */}
            {hasLyricsText && (
              <button
                onClick={handleCopyLyrics}
                title={copiedLyrics ? 'Текст скопирован!' : 'Скопировать текст песни'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-md3-surface-container text-md3-on-surface hover:bg-md3-surface-container-high border border-md3-outline-variant/20 transition-all cursor-pointer hover:scale-102 active:scale-95"
              >
                {copiedLyrics ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-500 font-bold">Скопировано</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-md3-primary" />
                    <span>Копировать</span>
                  </>
                )}
              </button>
            )}

            {/* Edit / View Toggle */}
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                isEditing
                  ? 'bg-md3-primary text-md3-on-primary shadow-sm'
                  : 'bg-md3-surface-container text-md3-on-surface hover:bg-md3-surface-container-high border border-md3-outline-variant/20'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEditing ? 'Просмотр' : 'Редактировать'}</span>
            </button>

            <button
              onClick={onClose}
              title="Закрыть [Esc]"
              className="p-2 rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container hover:text-md3-on-surface transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
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
                <span>Редактирование текста песни (поддерживается стандартный LRC с метками времени [mm:ss.xx])</span>
              </div>

              {/* Author / Lyricist Field */}
              <div className="flex items-center gap-2 p-2 rounded-2xl bg-md3-surface-container-low border border-md3-outline-variant/15">
                <PenTool className="w-4 h-4 text-md3-primary ml-1.5 shrink-0" />
                <span className="text-xs font-semibold text-md3-on-surface shrink-0">Автор текста:</span>
                <input
                  type="text"
                  value={editedLyricist}
                  onChange={(e) => setEditedLyricist(e.target.value)}
                  placeholder="Имя автора текста / поэта..."
                  className="flex-1 px-3 py-1 rounded-xl text-xs bg-md3-surface text-md3-on-surface border border-md3-outline-variant/20 focus:border-md3-primary outline-none transition-all"
                />
              </div>

              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                placeholder="Вставьте или введите текст песни сюда..."
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
                  <span>Инструментальная композиция (без слов)</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 rounded-full text-xs font-semibold text-md3-on-surface-variant hover:bg-md3-surface-container-high transition-colors cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-md3-primary text-md3-on-primary text-xs font-bold shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Сохранить</span>
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
                Инструментальный трек
              </h3>
              <p className="text-xs text-md3-on-surface-variant max-w-sm mb-4">
                Эта композиция отмечена как трек без слов.
              </p>
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-md3-surface-container-high hover:bg-md3-primary hover:text-md3-on-primary text-xs font-semibold text-md3-on-surface transition-all cursor-pointer border border-md3-outline-variant/20"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Добавить слова к треку</span>
              </button>
            </div>
          ) : !track.lyrics || track.lyrics.trim().length === 0 ? (
            /* Empty State */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-md3-on-surface-variant">
              <div className="w-20 h-20 rounded-full bg-md3-surface-container-high flex items-center justify-center text-md3-primary mb-4 shadow-sm">
                <FileText className="w-10 h-10 opacity-60" />
              </div>
              <h3 className="text-lg font-bold text-md3-on-surface mb-1">
                Текст песни пока отсутствует
              </h3>
              <p className="text-xs text-md3-on-surface-variant max-w-sm mb-5">
                Вы можете добавить текст песни вручную или пометить композицию как инструментал.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-md3-primary text-md3-on-primary text-xs font-bold shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Добавить текст</span>
                </button>
                <button
                  onClick={handleMarkInstrumental}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-md3-surface-container text-xs font-semibold text-md3-on-surface hover:bg-md3-surface-container-high border border-md3-outline-variant/20 transition-all cursor-pointer"
                >
                  <span>Без слов</span>
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
