import React, { useMemo, useEffect, useState } from 'react';
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
import { Track } from '../types/music';
import { formatTime } from '../services/tagEditor';
import { isTauri, invoke } from '@tauri-apps/api/core';

interface TrackDetailsModalProps {
  isOpen: boolean;
  track: Track | null;
  onClose: () => void;
}

export const TrackDetailsModal: React.FC<TrackDetailsModalProps> = ({
  isOpen,
  track,
  onClose,
}) => {
  const [copiedPath, setCopiedPath] = useState<boolean>(false);

  useEffect(() => {
    setCopiedPath(false);
  }, [track?.id]);

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

  const genresList = useMemo(() => {
    if (!track?.genre) return [];
    return track.genre
      .split(/[,/;\\]+/)
      .map((g) => g.trim())
      .filter((g) => g.length > 0);
  }, [track?.genre]);

  if (!isOpen || !track) return null;

  const handleOpenLocation = async () => {
    if (track.path) {
      if (isTauri()) {
        try {
          await invoke('show_in_folder', { path: track.path });
          return;
        } catch (e) {
          console.warn('Failed to open location via Tauri:', e);
        }
      }
      handleCopyPath();
    }
  };

  const handleCopyPath = () => {
    if (track?.path) {
      navigator.clipboard.writeText(track.path);
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 2000);
    }
  };

  const formattedSize = track.fileSize 
    ? `${(track.fileSize / (1024 * 1024)).toFixed(2)} МБ` 
    : '—';

  const formattedDate = track.dateAdded 
    ? new Date(track.dateAdded).toLocaleDateString('ru-RU', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }) 
    : '—';

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150 select-none cursor-pointer"
    >
      <div
        className="w-full max-w-xl bg-md3-surface-container rounded-3xl shadow-2xl border border-md3-outline-variant/20 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 cursor-default"
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
                Сведения о треке
              </h2>
              <p className="text-xs text-md3-on-surface-variant mt-0.5">
                Техническая информация и метаданные
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
                  <span className="text-[11px] font-semibold opacity-70">Нет обложки</span>
                </div>
              )}
            </div>

            {/* Metadata Beside Cover */}
            <div className="min-w-0 flex-1 flex flex-col justify-center space-y-2 text-center sm:text-left">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-md3-primary/80">Название</span>
                <h3 className="text-lg sm:text-xl font-black text-md3-on-surface line-clamp-2 leading-tight mt-0.5">
                  {track.title}
                </h3>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-md3-on-surface-variant/70">Исполнитель</span>
                <p className="text-sm sm:text-base font-bold text-md3-primary truncate mt-0.5">
                  {track.artist || 'Неизвестный исполнитель'}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-md3-on-surface-variant/70">Альбом</span>
                <p className="text-xs sm:text-sm text-md3-on-surface-variant truncate font-medium mt-0.5">
                  {track.album || 'Без альбома'}
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
                <span className="text-[11px] text-md3-on-surface-variant/70 block">Формат файла</span>
                <span className="font-bold text-md3-on-surface truncate font-mono">
                  {track.format || 'Аудио'}
                </span>
              </div>
            </div>

            {/* Duration */}
            <div className="p-3 rounded-2xl bg-md3-surface-container-low border border-md3-outline-variant/10 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-md3-primary/10 text-md3-primary flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-md3-on-surface-variant/70 block">Длительность</span>
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
                <span className="text-[11px] text-md3-on-surface-variant/70 block">Размер файла</span>
                <span className="font-bold text-md3-on-surface truncate font-mono">
                  {formattedSize}
                </span>
              </div>
            </div>

            {/* Release Date / Year (placed where genre was) */}
            <div className="p-3 rounded-2xl bg-md3-surface-container-low border border-md3-outline-variant/10 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-md3-primary/10 text-md3-primary flex items-center justify-center shrink-0">
                <Disc3 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-md3-on-surface-variant/70 block">Дата выпуска</span>
                <span className="font-bold text-md3-on-surface truncate">
                  {track.year ? `${track.year} год` : 'Не указана'}
                </span>
              </div>
            </div>

            {/* Track Number */}
            <div className="p-3 rounded-2xl bg-md3-surface-container-low border border-md3-outline-variant/10 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-md3-primary/10 text-md3-primary flex items-center justify-center shrink-0">
                <Hash className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-md3-on-surface-variant/70 block">Номер дорожки</span>
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
                <span className="text-[11px] text-md3-on-surface-variant/70 block">Воспроизведений</span>
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
                <span className="text-[11px] text-md3-on-surface-variant/70 block">Дата добавления</span>
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
                  <span className="text-[11px] text-md3-on-surface-variant/70 block">Композитор</span>
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
                  <span className="text-[11px] text-md3-on-surface-variant/70 block">Группа / Коллектив</span>
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
                  <span className="text-[11px] text-md3-on-surface-variant/70 block">Комментарий</span>
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
                <span className="font-semibold">Жанры</span>
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
                    Жанр не указан
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
                  Путь к файлу на диске
                </span>
                <button
                  onClick={handleOpenLocation}
                  title="Открыть содержащую папку в проводнике"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-md3-surface-container hover:bg-md3-surface-container-high text-xs font-semibold text-md3-primary border border-md3-outline-variant/20 shadow-xs hover:scale-102 active:scale-95 transition-all cursor-pointer select-none"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Открыть в папке</span>
                </button>
              </div>

              {/* Clickable Path Row (acts 100% as a button, no blue selection, no redundant "Скопировать" text) */}
              <div
                onClick={handleCopyPath}
                title={copiedPath ? 'Путь скопирован!' : 'Нажмите, чтобы скопировать путь'}
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
                      <span className="text-[11px] font-bold">Скопировано</span>
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
