import React, { useMemo, useEffect, useState, useRef } from 'react';
import { 
  Info, 
  X, 
  Disc3, 
  FolderOpen, 
  Clock, 
  HardDrive, 
  FileAudio, 
  Calendar, 
  PlayCircle, 
  Hash, 
  Tag, 
  Folder,
  Copy,
  Check,
  Users,
  Music,
  MessageSquare
} from 'lucide-react';
import { useModalAnimation } from '../utils/useModalAnimation';
import { Track } from '../types/music';
import { formatTime } from '../services/tagEditor';
import { isTauri, invoke } from '@tauri-apps/api/core';
import { AppLanguage } from '../i18n';

interface TrackDetailsModalProps {
  isOpen: boolean;
  track: Track | null;
  language?: AppLanguage;
  onClose: () => void;
}

export const TrackDetailsModal: React.FC<TrackDetailsModalProps> = ({
  isOpen,
  track: incomingTrack,
  language = 'ru',
  onClose,
}) => {
  const [copiedPath, setCopiedPath] = useState<boolean>(false);

  useEffect(() => {
    setCopiedPath(false);
  }, [incomingTrack?.id]);

  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [isOpen, onClose]);

  const cachedTrackRef = useRef<Track | null>(incomingTrack);
  if (incomingTrack) {
    cachedTrackRef.current = incomingTrack;
  }
  const activeTrack = incomingTrack || cachedTrackRef.current;

  const genresList = useMemo(() => {
    if (!activeTrack?.genre) return [];
    return activeTrack.genre
      .split(/[,/;\\]+/)
      .map((g) => g.trim())
      .filter((g) => g.length > 0);
  }, [activeTrack?.genre]);

  const { isRendered, backdropClass, dialogClass } = useModalAnimation(isOpen && !!activeTrack, 200);

  if (!isRendered || !activeTrack) return null;
  const track = activeTrack;

  const handleOpenLocation = async () => {
    if (activeTrack.path) {
      if (isTauri()) {
        try {
          await invoke('show_in_folder', { path: activeTrack.path });
          return;
        } catch (e) {
          console.warn('Failed to open location via Tauri:', e);
        }
      }
      handleCopyPath();
    }
  };

  const handleCopyPath = () => {
    if (activeTrack?.path) {
      navigator.clipboard.writeText(activeTrack.path);
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 2000);
    }
  };

  const formattedSize = activeTrack.fileSize 
    ? `${(activeTrack.fileSize / (1024 * 1024)).toFixed(2)} ${language === 'ru' ? 'МБ' : 'MB'}` 
    : '—';

  const formattedDate = activeTrack.dateAdded 
    ? new Date(activeTrack.dateAdded).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }) 
    : '—';

  return (
    <div
      onClick={onClose}
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md select-none cursor-pointer ${backdropClass}`}
    >
      <div
        className={`w-full max-w-xl bg-md3-surface-container rounded-3xl shadow-2xl border border-md3-outline-variant/20 overflow-hidden flex flex-col max-h-[90vh] cursor-default ${dialogClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 pb-4 border-b border-md3-outline-variant/15 flex items-center justify-between bg-md3-surface-container-high/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-md3-primary/15 text-md3-primary flex items-center justify-center shadow-sm">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-md3-on-surface leading-tight">
                {language === 'ru' ? 'Сведения о треке' : 'Track Details'}
              </h2>
              <p className="text-xs text-md3-on-surface-variant mt-0.5">
                {language === 'ru' ? 'Техническая информация и метаданные' : 'Technical information and metadata'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container hover:text-md3-on-surface transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-4">
          {/* Top Banner: Large Cover & Metadata Beside It */}
          <div className="flex flex-col sm:flex-row items-center sm:items-stretch gap-5 p-5 rounded-3xl bg-md3-surface-container-low border border-md3-outline-variant/15">
            {/* Large Cover Art */}
            <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-2xl overflow-hidden bg-md3-surface-container-high shadow-lg shrink-0 border border-md3-outline-variant/15 relative">
              {track.coverArt ? (
                <img src={track.coverArt} alt={track.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-md3-primary/10 text-md3-primary gap-2">
                  <Disc3 className="w-12 h-12" />
                  <span className="text-[11px] font-semibold opacity-70">
                    {language === 'ru' ? 'Нет обложки' : 'No Cover'}
                  </span>
                </div>
              )}
            </div>

            {/* Metadata Beside Cover */}
            <div className="min-w-0 flex-1 flex flex-col justify-center space-y-2 text-center sm:text-left">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-md3-primary/80">
                  {language === 'ru' ? 'Название' : 'Title'}
                </span>
                <h3 className="text-lg sm:text-xl font-black text-md3-on-surface line-clamp-2 leading-tight mt-0.5">
                  {track.title}
                </h3>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-md3-on-surface-variant/70">
                  {language === 'ru' ? 'Исполнитель' : 'Artist'}
                </span>
                <p className="text-sm sm:text-base font-bold text-md3-primary truncate mt-0.5">
                  {track.artist || (language === 'ru' ? 'Неизвестный исполнитель' : 'Unknown Artist')}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-md3-on-surface-variant/70">
                  {language === 'ru' ? 'Альбом' : 'Album'}
                </span>
                <p className="text-xs sm:text-sm text-md3-on-surface-variant truncate font-medium mt-0.5">
                  {track.album || (language === 'ru' ? 'Без альбома' : 'No Album')}
                </p>
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            {/* Format */}
            <div className="p-3 rounded-2xl bg-md3-surface-container-low border border-md3-outline-variant/10 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-md3-primary/10 text-md3-primary flex items-center justify-center shrink-0">
                <FileAudio className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-md3-on-surface-variant/70 block">
                  {language === 'ru' ? 'Формат файла' : 'File Format'}
                </span>
                <span className="font-bold text-md3-on-surface truncate font-mono">
                  {track.format || (language === 'ru' ? 'Аудио' : 'Audio')}
                </span>
              </div>
            </div>

            {/* Duration */}
            <div className="p-3 rounded-2xl bg-md3-surface-container-low border border-md3-outline-variant/10 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-md3-primary/10 text-md3-primary flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-md3-on-surface-variant/70 block">
                  {language === 'ru' ? 'Длительность' : 'Duration'}
                </span>
                <span className="font-bold text-md3-on-surface truncate font-mono">
                  {formatTime(track.duration)}
                </span>
              </div>
            </div>

            {/* File Size */}
            <div className="p-3 rounded-2xl bg-md3-surface-container-low border border-md3-outline-variant/10 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-md3-primary/10 text-md3-primary flex items-center justify-center shrink-0">
                <HardDrive className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-md3-on-surface-variant/70 block">
                  {language === 'ru' ? 'Размер файла' : 'File Size'}
                </span>
                <span className="font-bold text-md3-on-surface truncate font-mono">
                  {formattedSize}
                </span>
              </div>
            </div>

            {/* Release Date / Year */}
            <div className="p-3 rounded-2xl bg-md3-surface-container-low border border-md3-outline-variant/10 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-md3-primary/10 text-md3-primary flex items-center justify-center shrink-0">
                <Disc3 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-md3-on-surface-variant/70 block">
                  {language === 'ru' ? 'Дата выпуска' : 'Release Year'}
                </span>
                <span className="font-bold text-md3-on-surface truncate">
                  {track.year ? (language === 'ru' ? `${track.year} год` : `${track.year}`) : (language === 'ru' ? 'Не указана' : 'Not specified')}
                </span>
              </div>
            </div>

            {/* Track Number */}
            <div className="p-3 rounded-2xl bg-md3-surface-container-low border border-md3-outline-variant/10 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-md3-primary/10 text-md3-primary flex items-center justify-center shrink-0">
                <Hash className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-md3-on-surface-variant/70 block">
                  {language === 'ru' ? 'Номер дорожки' : 'Track Number'}
                </span>
                <span className="font-bold text-md3-on-surface truncate">
                  {track.trackNumber ? `#${track.trackNumber}` : '—'}
                </span>
              </div>
            </div>

            {/* Play Count */}
            <div className="p-3 rounded-2xl bg-md3-surface-container-low border border-md3-outline-variant/10 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-md3-primary/10 text-md3-primary flex items-center justify-center shrink-0">
                <PlayCircle className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-md3-on-surface-variant/70 block">
                  {language === 'ru' ? 'Воспроизведений' : 'Play Count'}
                </span>
                <span className="font-bold text-md3-on-surface truncate">
                  {track.playCount || 0}
                </span>
              </div>
            </div>

            {/* Date Added */}
            <div className="col-span-2 p-3 rounded-2xl bg-md3-surface-container-low border border-md3-outline-variant/10 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-md3-primary/10 text-md3-primary flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-md3-on-surface-variant/70 block">
                  {language === 'ru' ? 'Дата добавления' : 'Date Added'}
                </span>
                <span className="font-bold text-md3-on-surface truncate">
                  {formattedDate}
                </span>
              </div>
            </div>

            {/* Composer (if present) */}
            {track.composer && (
              <div className="col-span-2 sm:col-span-1 p-3 rounded-2xl bg-md3-surface-container-low border border-md3-outline-variant/10 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-md3-primary/10 text-md3-primary flex items-center justify-center shrink-0">
                  <Music className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] text-md3-on-surface-variant/70 block">
                    {language === 'ru' ? 'Композитор' : 'Composer'}
                  </span>
                  <span className="font-bold text-md3-on-surface truncate">
                    {track.composer}
                  </span>
                </div>
              </div>
            )}

            {/* Content Group / Band (if present) */}
            {track.contentGroup && (
              <div className="col-span-2 sm:col-span-1 p-3 rounded-2xl bg-md3-surface-container-low border border-md3-outline-variant/10 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-md3-primary/10 text-md3-primary flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] text-md3-on-surface-variant/70 block">
                    {language === 'ru' ? 'Группа / Коллектив' : 'Band / Ensemble'}
                  </span>
                  <span className="font-bold text-md3-on-surface truncate">
                    {track.contentGroup}
                  </span>
                </div>
              </div>
            )}

            {/* Comment (if present) */}
            {track.comment && (
              <div className="col-span-2 p-3 rounded-2xl bg-md3-surface-container-low border border-md3-outline-variant/10 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-md3-primary/10 text-md3-primary flex items-center justify-center shrink-0">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] text-md3-on-surface-variant/70 block">
                    {language === 'ru' ? 'Комментарий' : 'Comment'}
                  </span>
                  <span className="font-bold text-md3-on-surface line-clamp-2">
                    {track.comment}
                  </span>
                </div>
              </div>
            )}

            {/* Expandable Genres (Full width, tags) */}
            <div className="col-span-2 p-3.5 rounded-2xl bg-md3-surface-container-low border border-md3-outline-variant/10 space-y-2">
              <div className="flex items-center gap-2 text-[11px] text-md3-on-surface-variant/70">
                <Tag className="w-3.5 h-3.5 text-md3-primary" />
                <span className="font-semibold">
                  {language === 'ru' ? 'Жанры' : 'Genres'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {genresList.length > 0 ? (
                  genresList.map((g, i) => (
                    <span 
                      key={i} 
                      className="px-3 py-1 rounded-xl bg-md3-surface text-xs font-semibold text-md3-on-surface border border-md3-outline-variant/15 shadow-sm"
                    >
                      {g}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-md3-on-surface-variant/60 italic">
                    {language === 'ru' ? 'Жанр не указан' : 'No genre specified'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Disk Path with Open Location and Clickable Copy Row */}
          {track.path && (
            <div className="p-3.5 rounded-2xl bg-md3-surface-container-low border border-md3-outline-variant/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-md3-on-surface-variant select-none">
                  <Folder className="w-3.5 h-3.5 text-md3-primary" />
                  {language === 'ru' ? 'Путь к файлу на диске' : 'File path on disk'}
                </span>
                <button
                  onClick={handleOpenLocation}
                  title={language === 'ru' ? 'Открыть содержащую папку в проводнике' : 'Open containing folder in file explorer'}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-md3-surface-container hover:bg-md3-surface-container-high text-xs font-semibold text-md3-primary border border-md3-outline-variant/20 shadow-xs hover:scale-102 active:scale-95 transition-all cursor-pointer select-none"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>{language === 'ru' ? 'Открыть в папке' : 'Open in folder'}</span>
                </button>
              </div>

              {/* Clickable Path Row (acts 100% as a button, no blue selection, no redundant "Скопировать" text) */}
              <div
                onClick={handleCopyPath}
                title={copiedPath 
                  ? (language === 'ru' ? 'Путь скопирован!' : 'Path copied!') 
                  : (language === 'ru' ? 'Нажмите, чтобы скопировать путь' : 'Click to copy path')
                }
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCopyPath();
                  }
                }}
                className={`group relative flex items-center justify-between gap-3 p-3 rounded-xl bg-md3-surface border transition-all cursor-pointer select-none ${
                  copiedPath
                    ? 'border-emerald-500/40 bg-emerald-500/5 ring-1 ring-emerald-500/30'
                    : 'border-md3-outline-variant/15 hover:border-md3-primary/40 hover:bg-md3-surface-container/60'
                }`}
                style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
              >
                <p 
                  className="text-xs font-mono text-md3-on-surface break-all min-w-0 select-none group-hover:text-md3-primary transition-colors pointer-events-none"
                  style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                >
                  {track.path}
                </p>
                <div 
                  className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all select-none ${
                    copiedPath 
                      ? 'bg-emerald-500/15 text-emerald-500 font-semibold' 
                      : 'text-md3-on-surface-variant/40 group-hover:text-md3-primary'
                  }`}
                  style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                >
                  {copiedPath ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-500 stroke-[2.5]" />
                      <span className="text-[11px] font-bold">
                        {language === 'ru' ? 'Скопировано' : 'Copied'}
                      </span>
                    </>
                  ) : (
                    <Copy className="w-4 h-4 transition-transform group-hover:scale-110" />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
