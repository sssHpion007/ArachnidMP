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
  Clock
} from 'lucide-react';
import { Track } from '../types/music';

interface LyricsModalProps {
  isOpen: boolean;
  track: Track | null;
  currentTime: number;
  isPlaying: boolean;
  onSeek?: (time: number) => void;
  onSaveLyrics: (trackId: string, lyrics: string, isInstrumental: boolean) => void;
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
  const [isInstrumental, setIsInstrumental] = useState(false);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (track) {
      setEditedText(track.lyrics || '');
      setIsInstrumental(!!track.isInstrumental);
      setIsEditing(false);
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

  if (!isOpen || !track) return null;

  const handleSave = () => {
    onSaveLyrics(track.id, editedText.trim(), isInstrumental);
    setIsEditing(false);
  };

  const handleMarkInstrumental = () => {
    setIsInstrumental(true);
    setEditedText('');
    onSaveLyrics(track.id, '', true);
    setIsEditing(false);
  };

  return (
    <div
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150 select-none"
    >
      <div
        className="w-full max-w-2xl bg-md3-surface-container rounded-3xl shadow-2xl border border-md3-outline-variant/20 overflow-hidden flex flex-col h-[85vh] max-h-[720px] animate-in zoom-in-95 duration-200"
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
              <p className="text-xs text-md3-on-surface-variant mt-0.5 truncate font-medium">
                {track.artist} {isSynced ? '• Синхронизированный текст (LRC)' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
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
              className="p-2 rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container hover:text-md3-on-surface transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto custom-scrollbar p-6 relative flex flex-col"
        >
          {isEditing ? (
            /* Edit Mode */
            <div className="flex-1 flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-md3-on-surface-variant">
                  Текст песни (поддерживается как обычный текст, так и формат LRC с таймкодами [01:23.45]):
                </label>
                <button
                  type="button"
                  onClick={handleMarkInstrumental}
                  className="text-xs text-md3-primary hover:underline cursor-pointer"
                >
                  Пометить как «Без слов»
                </button>
              </div>

              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                placeholder="Вставьте или введите текст песни сюда..."
                className="flex-1 w-full p-4 rounded-2xl bg-md3-surface text-sm text-md3-on-surface placeholder-md3-on-surface-variant/40 border border-md3-outline-variant/20 focus:border-md3-primary outline-none transition-all resize-none font-sans leading-relaxed custom-scrollbar shadow-inner"
              />

              <div className="flex items-center justify-between pt-2">
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
