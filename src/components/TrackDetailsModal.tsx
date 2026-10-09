import React, { useState } from 'react';
import { 
  Info, 
  X, 
  Disc3, 
  Copy, 
  Check, 
  Clock, 
  HardDrive, 
  FileAudio, 
  Calendar, 
  PlayCircle, 
  Hash, 
  Tag, 
  Folder
} from 'lucide-react';
import { Track } from '../types/music';
import { formatTime } from '../services/tagEditor';

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
  const [copiedPath, setCopiedPath] = useState(false);

  if (!isOpen || !track) return null;

  const handleCopyPath = () => {
    if (track.path) {
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
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150 select-none"
    >
      <div
        className="w-full max-w-lg bg-md3-surface-container rounded-3xl shadow-2xl border border-md3-outline-variant/20 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
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
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-5">
          {/* Top Banner: Cover & Titles */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-md3-surface-container-low border border-md3-outline-variant/15">
            <div className="w-24 h-24 rounded-2xl overflow-hidden bg-md3-surface-container-high shadow-md shrink-0 border border-md3-outline-variant/15 relative">
              {track.coverArt ? (
                <img src={track.coverArt} alt={track.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-md3-primary/10 text-md3-primary">
                  <Disc3 className="w-10 h-10" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="text-base font-extrabold text-md3-on-surface truncate">
                {track.title}
              </h3>
              <p className="text-sm font-semibold text-md3-primary truncate mt-0.5">
                {track.artist}
              </p>
              <p className="text-xs text-md3-on-surface-variant truncate mt-1">
                {track.album || 'Без альбома'} {track.year ? `(${track.year})` : ''}
              </p>
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

            {/* Genre */}
            <div className="p-3 rounded-2xl bg-md3-surface-container-low border border-md3-outline-variant/10 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-md3-primary/10 text-md3-primary flex items-center justify-center shrink-0">
                <Tag className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-md3-on-surface-variant/70 block">Жанр</span>
                <span className="font-bold text-md3-on-surface truncate">
                  {track.genre || 'Не указан'}
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
          </div>

          {/* Disk Path */}
          {track.path && (
            <div className="p-3.5 rounded-2xl bg-md3-surface-container-low border border-md3-outline-variant/10 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-md3-on-surface-variant/70">
                <span className="flex items-center gap-1.5 font-semibold">
                  <Folder className="w-3.5 h-3.5" />
                  Путь к файлу на диске
                </span>
                <button
                  onClick={handleCopyPath}
                  className="flex items-center gap-1 text-xs text-md3-primary hover:underline cursor-pointer"
                >
                  {copiedPath ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Скопировано!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Копировать</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs font-mono text-md3-on-surface break-all select-all p-2 rounded-xl bg-md3-surface border border-md3-outline-variant/10">
                {track.path}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-md3-surface-container-high/30 border-t border-md3-outline-variant/15 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-full bg-md3-primary text-md3-on-primary text-xs font-bold shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
