import React, { useMemo, useEffect } from 'react';
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
  Folder
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
      navigator.clipboard.writeText(track.path);
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

  const genresList = useMemo(() => {
    if (!track.genre) return [];
    return track.genre
      .split(/[,/;\\]+/)
      .map((g) => g.trim())
      .filter((g) => g.length > 0);
  }, [track.genre]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150 select-none cursor-pointer"
    >
      <div
        className="w-full max-w-lg bg-md3-surface-container rounded-3xl shadow-2xl border border-md3-outline-variant/20 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 cursor-default"
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

          {/* Disk Path with Open Location Button */}
          {track.path && (
            <div className="p-3.5 rounded-2xl bg-md3-surface-container-low border border-md3-outline-variant/10 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-md3-on-surface-variant/70">
                <span className="flex items-center gap-1.5 font-semibold">
                  <Folder className="w-3.5 h-3.5" />
                  Путь к файлу на диске
                </span>
                <button
                  onClick={handleOpenLocation}
                  title="Открыть папку с файлом в Проводнике Windows"
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-md3-primary/10 hover:bg-md3-primary/20 text-xs font-semibold text-md3-primary transition-all cursor-pointer hover:scale-105 active:scale-95"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Открыть папку</span>
                </button>
              </div>
              <p className="text-xs font-mono text-md3-on-surface break-all select-all p-2 rounded-xl bg-md3-surface border border-md3-outline-variant/10">
                {track.path}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
