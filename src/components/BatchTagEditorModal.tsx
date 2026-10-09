import React, { useState } from 'react';
import { X, Check, Edit3, Disc, Music, User, Calendar, Tag, Layers } from 'lucide-react';
import { Track } from '../types/music';

interface BatchTagEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTracks: Track[];
  onSaveTags: (updatedFields: {
    artist?: string;
    album?: string;
    genre?: string;
    year?: number;
  }) => void;
}

export const BatchTagEditorModal: React.FC<BatchTagEditorModalProps> = ({
  isOpen,
  onClose,
  selectedTracks,
  onSaveTags,
}) => {
  if (!isOpen || selectedTracks.length === 0) return null;

  // Initial detection: if all tracks share the same artist/album/genre, prefill them
  const firstTrack = selectedTracks[0];
  const allSameArtist = selectedTracks.every(t => t.artist === firstTrack.artist);
  const allSameAlbum = selectedTracks.every(t => t.album === firstTrack.album);
  const allSameGenre = selectedTracks.every(t => t.genre === firstTrack.genre);
  const allSameYear = selectedTracks.every(t => t.year === firstTrack.year);

  const [applyArtist, setApplyArtist] = useState(false);
  const [artistValue, setArtistValue] = useState(allSameArtist ? firstTrack.artist : '');

  const [applyAlbum, setApplyAlbum] = useState(false);
  const [albumValue, setAlbumValue] = useState(allSameAlbum ? firstTrack.album : '');

  const [applyGenre, setApplyGenre] = useState(false);
  const [genreValue, setGenreValue] = useState(allSameGenre ? (firstTrack.genre || '') : '');

  const [applyYear, setApplyYear] = useState(false);
  const [yearValue, setYearValue] = useState(allSameYear && firstTrack.year ? firstTrack.year.toString() : '');

  const handleSave = () => {
    const updates: {
      artist?: string;
      album?: string;
      genre?: string;
      year?: number;
    } = {};

    if (applyArtist) updates.artist = artistValue.trim();
    if (applyAlbum) updates.album = albumValue.trim();
    if (applyGenre) updates.genre = genreValue.trim();
    if (applyYear && yearValue) updates.year = parseInt(yearValue, 10);

    onSaveTags(updates);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-lg bg-md3-surface-container rounded-3xl shadow-2xl border border-md3-outline-variant/30 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-md3-outline-variant/20 flex items-center justify-between bg-md3-surface-container-high">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-md3-primary/10 text-md3-primary flex items-center justify-center">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-md3-on-surface">
                Пакетный редактор тегов (MusicBee)
              </h3>
              <p className="text-xs text-md3-on-surface-variant">
                Изменение тегов для {selectedTracks.length} {selectedTracks.length === 1 ? 'трека' : 'треков'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container hover:text-md3-on-surface"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Tracks Preview List */}
        <div className="px-5 py-3 bg-md3-surface-container-lowest/50 border-b border-md3-outline-variant/10 max-h-28 overflow-y-auto custom-scrollbar">
          <div className="text-[11px] font-bold uppercase tracking-wider text-md3-on-surface-variant/70 mb-1.5">
            Выбранные файлы:
          </div>
          <div className="space-y-1">
            {selectedTracks.map((t, idx) => (
              <div key={t.id} className="text-xs text-md3-on-surface flex items-center justify-between">
                <span className="truncate pr-2 font-medium">
                  {idx + 1}. {t.title} — {t.artist}
                </span>
                <span className="text-[11px] text-md3-on-surface-variant font-mono shrink-0">
                  {t.album}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Form Fields with Enable Checkboxes */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Artist Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-md3-on-surface flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyArtist}
                  onChange={(e) => setApplyArtist(e.target.checked)}
                  className="rounded text-md3-primary focus:ring-0 w-4 h-4 cursor-pointer"
                />
                <User className="w-3.5 h-3.5 text-md3-primary" />
                <span>Исполнитель (Artist)</span>
              </label>
              {!allSameArtist && (
                <span className="text-[10px] text-amber-400">Различные значения</span>
              )}
            </div>
            <input
              type="text"
              disabled={!applyArtist}
              value={artistValue}
              onChange={(e) => setArtistValue(e.target.value)}
              placeholder="Введите нового исполнителя"
              className={`w-full px-3.5 py-2 rounded-xl text-sm border outline-none transition-all ${
                applyArtist
                  ? 'bg-md3-surface text-md3-on-surface border-md3-primary focus:ring-2 focus:ring-md3-primary/20'
                  : 'bg-md3-surface-container-high/50 text-md3-on-surface-variant/50 border-transparent cursor-not-allowed'
              }`}
            />
          </div>

          {/* Album Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-md3-on-surface flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyAlbum}
                  onChange={(e) => setApplyAlbum(e.target.checked)}
                  className="rounded text-md3-primary focus:ring-0 w-4 h-4 cursor-pointer"
                />
                <Disc className="w-3.5 h-3.5 text-md3-primary" />
                <span>Альбом (Album)</span>
              </label>
              {!allSameAlbum && (
                <span className="text-[10px] text-amber-400">Различные значения</span>
              )}
            </div>
            <input
              type="text"
              disabled={!applyAlbum}
              value={albumValue}
              onChange={(e) => setAlbumValue(e.target.value)}
              placeholder="Введите название альбома"
              className={`w-full px-3.5 py-2 rounded-xl text-sm border outline-none transition-all ${
                applyAlbum
                  ? 'bg-md3-surface text-md3-on-surface border-md3-primary focus:ring-2 focus:ring-md3-primary/20'
                  : 'bg-md3-surface-container-high/50 text-md3-on-surface-variant/50 border-transparent cursor-not-allowed'
              }`}
            />
          </div>

          {/* Genre Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-md3-on-surface flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyGenre}
                  onChange={(e) => setApplyGenre(e.target.checked)}
                  className="rounded text-md3-primary focus:ring-0 w-4 h-4 cursor-pointer"
                />
                <Tag className="w-3.5 h-3.5 text-md3-primary" />
                <span>Жанр (Genre)</span>
              </label>
              {!allSameGenre && (
                <span className="text-[10px] text-amber-400">Различные значения</span>
              )}
            </div>
            <input
              type="text"
              disabled={!applyGenre}
              value={genreValue}
              onChange={(e) => setGenreValue(e.target.value)}
              placeholder="Synthwave, Electronic, Ambient, Lo-Fi..."
              className={`w-full px-3.5 py-2 rounded-xl text-sm border outline-none transition-all ${
                applyGenre
                  ? 'bg-md3-surface text-md3-on-surface border-md3-primary focus:ring-2 focus:ring-md3-primary/20'
                  : 'bg-md3-surface-container-high/50 text-md3-on-surface-variant/50 border-transparent cursor-not-allowed'
              }`}
            />
          </div>

          {/* Year Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-md3-on-surface flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyYear}
                  onChange={(e) => setApplyYear(e.target.checked)}
                  className="rounded text-md3-primary focus:ring-0 w-4 h-4 cursor-pointer"
                />
                <Calendar className="w-3.5 h-3.5 text-md3-primary" />
                <span>Год (Year)</span>
              </label>
            </div>
            <input
              type="number"
              disabled={!applyYear}
              value={yearValue}
              onChange={(e) => setYearValue(e.target.value)}
              placeholder="2026"
              className={`w-full px-3.5 py-2 rounded-xl text-sm border outline-none transition-all ${
                applyYear
                  ? 'bg-md3-surface text-md3-on-surface border-md3-primary focus:ring-2 focus:ring-md3-primary/20'
                  : 'bg-md3-surface-container-high/50 text-md3-on-surface-variant/50 border-transparent cursor-not-allowed'
              }`}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-md3-surface-container-high border-t border-md3-outline-variant/20 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full text-sm font-semibold text-md3-on-surface-variant hover:bg-md3-surface-container transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={!applyArtist && !applyAlbum && !applyGenre && !applyYear}
            className="flex items-center gap-2 px-5 py-2 rounded-full bg-md3-primary text-md3-on-primary text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed shadow-md transition-all"
          >
            <Check className="w-4 h-4" />
            <span>Применить к {selectedTracks.length} трекам</span>
          </button>
        </div>
      </div>
    </div>
  );
};
