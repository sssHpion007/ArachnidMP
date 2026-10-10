import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Check, 
  Edit3, 
  Disc, 
  Music, 
  User, 
  Calendar, 
  Tag, 
  Hash, 
  Upload, 
  Trash2, 
  Image as ImageIcon, 
  Plus, 
  Users, 
  MessageSquare, 
  PenTool, 
  Radio
} from 'lucide-react';
import { Track } from '../types/music';

interface BatchTagEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTracks: Track[];
  onSaveTags: (updatedFields: {
    title?: string;
    artist?: string;
    album?: string;
    genre?: string;
    year?: number;
    trackNumber?: number;
    composer?: string;
    contentGroup?: string;
    comment?: string;
    conductor?: string;
    lyricist?: string;
    coverArt?: string | null;
  }) => void;
}

type ExtraFieldKey = 'composer' | 'contentGroup' | 'comment' | 'conductor' | 'lyricist';

interface ExtraFieldDef {
  key: ExtraFieldKey;
  label: string;
  icon: React.ElementType;
  placeholder: string;
}

const EXTRA_FIELD_DEFS: ExtraFieldDef[] = [
  { key: 'composer', label: 'Композитор', icon: Music, placeholder: 'Имя композитора...' },
  { key: 'contentGroup', label: 'Группа / Коллектив', icon: Users, placeholder: 'Название группы, оркестра или ансамбля...' },
  { key: 'comment', label: 'Комментарий', icon: MessageSquare, placeholder: 'Заметки, описание, источник...' },
  { key: 'conductor', label: 'Дирижер', icon: Radio, placeholder: 'Имя дирижера...' },
  { key: 'lyricist', label: 'Автор текста', icon: PenTool, placeholder: 'Автор слов / поэт...' },
];

export const BatchTagEditorModal: React.FC<BatchTagEditorModalProps> = ({
  isOpen,
  onClose,
  selectedTracks,
  onSaveTags,
}) => {
  const isSingle = selectedTracks.length === 1;
  const firstTrack = selectedTracks[0] || null;

  // Track initial common values across selected tracks
  const allSameArtist = !!firstTrack && selectedTracks.every(t => t.artist === firstTrack.artist);
  const allSameAlbum = !!firstTrack && selectedTracks.every(t => t.album === firstTrack.album);
  const allSameGenre = !!firstTrack && selectedTracks.every(t => t.genre === firstTrack.genre);
  const allSameYear = !!firstTrack && selectedTracks.every(t => t.year === firstTrack.year);
  const allSameCover = !!firstTrack && selectedTracks.every(t => t.coverArt === firstTrack.coverArt);

  // Single track fields
  const [titleValue, setTitleValue] = useState('');
  const [trackNumValue, setTrackNumValue] = useState('');

  // Primary batch / single fields
  const [applyArtist, setApplyArtist] = useState(false);
  const [artistValue, setArtistValue] = useState('');

  const [applyAlbum, setApplyAlbum] = useState(false);
  const [albumValue, setAlbumValue] = useState('');

  const [applyGenre, setApplyGenre] = useState(false);
  const [genreValue, setGenreValue] = useState('');

  const [applyYear, setApplyYear] = useState(false);
  const [yearValue, setYearValue] = useState('');

  // Cover art state
  const [applyCover, setApplyCover] = useState(false);
  const [coverArtPreview, setCoverArtPreview] = useState<string | null>(null);
  const [isDraggingOverCover, setIsDraggingOverCover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extra / unusual tags state
  const [activeExtraFields, setActiveExtraFields] = useState<Set<ExtraFieldKey>>(new Set());
  const [extraFieldValues, setExtraFieldValues] = useState<Record<ExtraFieldKey, string>>({
    composer: '',
    contentGroup: '',
    comment: '',
    conductor: '',
    lyricist: '',
  });
  const [applyExtraFields, setApplyExtraFields] = useState<Record<ExtraFieldKey, boolean>>({
    composer: false,
    contentGroup: false,
    comment: false,
    conductor: false,
    lyricist: false,
  });
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const plusMenuRef = useRef<HTMLDivElement>(null);

  // Reset and initialize when modal opens
  useEffect(() => {
    if (isOpen && firstTrack) {
      if (isSingle) {
        setTitleValue(firstTrack.title || '');
        setTrackNumValue(firstTrack.trackNumber ? firstTrack.trackNumber.toString() : '');
        setApplyArtist(true);
        setArtistValue(firstTrack.artist || '');
        setApplyAlbum(true);
        setAlbumValue(firstTrack.album || '');
        setApplyGenre(true);
        setGenreValue(firstTrack.genre || '');
        setApplyYear(true);
        setYearValue(firstTrack.year ? firstTrack.year.toString() : '');
        setCoverArtPreview(firstTrack.coverArt || null);
        setApplyCover(false);

        // Detect any existing extra tags in the track
        const existingExtras = new Set<ExtraFieldKey>();
        const newExtraVals: Record<ExtraFieldKey, string> = {
          composer: firstTrack.composer || '',
          contentGroup: firstTrack.contentGroup || '',
          comment: firstTrack.comment || '',
          conductor: firstTrack.conductor || '',
          lyricist: firstTrack.lyricist || '',
        };
        const newApplyExtras: Record<ExtraFieldKey, boolean> = {
          composer: true,
          contentGroup: true,
          comment: true,
          conductor: true,
          lyricist: true,
        };

        if (firstTrack.composer) existingExtras.add('composer');
        if (firstTrack.contentGroup) existingExtras.add('contentGroup');
        if (firstTrack.comment) existingExtras.add('comment');
        if (firstTrack.conductor) existingExtras.add('conductor');
        if (firstTrack.lyricist) existingExtras.add('lyricist');

        setActiveExtraFields(existingExtras);
        setExtraFieldValues(newExtraVals);
        setApplyExtraFields(newApplyExtras);
      } else {
        // Multi-track batch mode
        setTitleValue('');
        setTrackNumValue('');
        setApplyArtist(false);
        setArtistValue(allSameArtist ? firstTrack.artist : '');
        setApplyAlbum(false);
        setAlbumValue(allSameAlbum ? firstTrack.album : '');
        setApplyGenre(false);
        setGenreValue(allSameGenre ? (firstTrack.genre || '') : '');
        setApplyYear(false);
        setYearValue(allSameYear && firstTrack.year ? firstTrack.year.toString() : '');
        setCoverArtPreview(allSameCover ? (firstTrack.coverArt || null) : null);
        setApplyCover(false);

        // Check if all tracks share any extra tags
        const existingExtras = new Set<ExtraFieldKey>();
        const newExtraVals: Record<ExtraFieldKey, string> = {
          composer: '',
          contentGroup: '',
          comment: '',
          conductor: '',
          lyricist: '',
        };
        const newApplyExtras: Record<ExtraFieldKey, boolean> = {
          composer: false,
          contentGroup: false,
          comment: false,
          conductor: false,
          lyricist: false,
        };

        if (selectedTracks.every(t => t.composer && t.composer === firstTrack.composer)) {
          existingExtras.add('composer');
          newExtraVals.composer = firstTrack.composer || '';
        }
        if (selectedTracks.every(t => t.contentGroup && t.contentGroup === firstTrack.contentGroup)) {
          existingExtras.add('contentGroup');
          newExtraVals.contentGroup = firstTrack.contentGroup || '';
        }
        if (selectedTracks.every(t => t.comment && t.comment === firstTrack.comment)) {
          existingExtras.add('comment');
          newExtraVals.comment = firstTrack.comment || '';
        }

        setActiveExtraFields(existingExtras);
        setExtraFieldValues(newExtraVals);
        setApplyExtraFields(newApplyExtras);
      }
      setIsPlusMenuOpen(false);
    }
  }, [isOpen, firstTrack, isSingle, allSameArtist, allSameAlbum, allSameGenre, allSameYear, allSameCover]);

  // Close plus menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
        setIsPlusMenuOpen(false);
      }
    };
    if (isPlusMenuOpen) {
      window.addEventListener('mousedown', handleOutsideClick);
    }
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [isPlusMenuOpen]);

  // Handle Cover Art file selection
  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите файл изображения (JPEG, PNG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCoverArtPreview(reader.result);
        setApplyCover(true);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Handle drag and drop image directly onto cover preview box
  const handleCoverDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverCover(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setCoverArtPreview(reader.result);
          setApplyCover(true);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveCover = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCoverArtPreview(null);
    setApplyCover(true);
  };

  const handleAddExtraField = (key: ExtraFieldKey) => {
    setActiveExtraFields(prev => new Set([...prev, key]));
    setApplyExtraFields(prev => ({ ...prev, [key]: true }));
    setIsPlusMenuOpen(false);
  };

  const handleRemoveExtraField = (key: ExtraFieldKey) => {
    setActiveExtraFields(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    setExtraFieldValues(prev => ({ ...prev, [key]: '' }));
    setApplyExtraFields(prev => ({ ...prev, [key]: false }));
  };

  const handleSave = () => {
    const updates: {
      title?: string;
      artist?: string;
      album?: string;
      genre?: string;
      year?: number;
      trackNumber?: number;
      composer?: string;
      contentGroup?: string;
      comment?: string;
      conductor?: string;
      lyricist?: string;
      coverArt?: string | null;
    } = {};

    if (isSingle) {
      if (titleValue.trim()) updates.title = titleValue.trim();
      if (trackNumValue.trim()) {
        const num = parseInt(trackNumValue, 10);
        if (!isNaN(num)) updates.trackNumber = num;
      }
    }

    if (applyArtist) updates.artist = artistValue.trim();
    if (applyAlbum) updates.album = albumValue.trim();
    if (applyGenre) updates.genre = genreValue.trim();
    if (applyYear && yearValue) {
      const parsedYear = parseInt(yearValue, 10);
      if (!isNaN(parsedYear)) updates.year = parsedYear;
    }

    if (applyCover) {
      updates.coverArt = coverArtPreview;
    }

    // Extra fields
    for (const key of activeExtraFields) {
      if (applyExtraFields[key] || isSingle) {
        updates[key] = extraFieldValues[key].trim();
      }
    }

    onSaveTags(updates);
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        e.stopPropagation();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [isOpen, applyArtist, applyAlbum, applyGenre, applyYear, applyCover, activeExtraFields, applyExtraFields, artistValue, albumValue, genreValue, yearValue, titleValue, trackNumValue, coverArtPreview, extraFieldValues, onClose]);

  if (!isOpen || selectedTracks.length === 0) return null;

  const availableExtraDefs = EXTRA_FIELD_DEFS.filter(d => !activeExtraFields.has(d.key));

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150 select-none cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-md3-surface-container rounded-3xl shadow-2xl border border-md3-outline-variant/30 overflow-hidden flex flex-col max-h-[90vh] cursor-default"
      >
        {/* Header */}
        <div className="p-5 border-b border-md3-outline-variant/20 flex items-center justify-between bg-md3-surface-container-high/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-md3-primary/15 text-md3-primary flex items-center justify-center shadow-xs">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-md3-on-surface">
                {isSingle ? 'Редактор тегов' : 'Пакетная правка тегов'}
              </h3>
              <p className="text-xs text-md3-on-surface-variant">
                {isSingle 
                  ? (firstTrack?.title ? `${firstTrack.artist} — ${firstTrack.title}` : 'Редактирование метаданных')
                  : `Изменение тегов для ${selectedTracks.length} ${selectedTracks.length < 5 ? 'треков' : 'треков'}`
                }
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            title="Закрыть [Esc]"
            className="p-1.5 rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container-highest hover:text-md3-on-surface transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Tracks Preview List (Batch mode only) */}
        {!isSingle && (
          <div className="px-5 py-2.5 bg-md3-surface-container-lowest/50 border-b border-md3-outline-variant/10 max-h-24 overflow-y-auto custom-scrollbar shrink-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-md3-on-surface-variant/70 mb-1">
              Выбранные треки ({selectedTracks.length}):
            </div>
            <div className="space-y-1">
              {selectedTracks.map((t, idx) => (
                <div key={t.id} className="text-xs text-md3-on-surface flex items-center justify-between gap-2">
                  <span className="truncate font-medium">
                    {idx + 1}. {t.title} — {t.artist}
                  </span>
                  <span className="text-[11px] text-md3-on-surface-variant font-mono shrink-0">
                    {t.album}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Scrollable Form Area */}
        <div className="p-5 space-y-5 overflow-y-auto custom-scrollbar flex-1 min-h-0">
          
          {/* Top Section: Cover Art Uploader & Title/Track# (or Artist/Album) */}
          <div className="flex flex-col sm:flex-row gap-4 items-start bg-md3-surface-container-low/70 p-4 rounded-2xl border border-md3-outline-variant/15">
            {/* Cover Art Box */}
            <div className="shrink-0 flex flex-col items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={handleCoverFileChange}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingOverCover(true); }}
                onDragLeave={() => setIsDraggingOverCover(false)}
                onDrop={handleCoverDrop}
                title="Нажмите или перетащите изображение, чтобы загрузить обложку"
                className={`relative w-28 h-28 rounded-2xl overflow-hidden border-2 cursor-pointer flex items-center justify-center transition-all group shadow-sm ${
                  isDraggingOverCover
                    ? 'border-md3-primary bg-md3-primary/10 scale-105'
                    : 'border-md3-outline-variant/30 bg-md3-surface-container hover:border-md3-primary/60'
                }`}
              >
                {coverArtPreview ? (
                  <>
                    <img
                      src={coverArtPreview}
                      alt="Обложка"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 text-white text-[10px] font-semibold transition-opacity">
                      <Upload className="w-4 h-4" />
                      <span>Заменить</span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-2 text-center text-md3-on-surface-variant/70 group-hover:text-md3-primary transition-colors">
                    <ImageIcon className="w-7 h-7 mb-1 stroke-1" />
                    <span className="text-[10px] font-medium leading-tight">Загрузить обложку</span>
                  </div>
                )}
              </div>

              {/* Cover Art Controls */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 rounded-full bg-md3-surface-container-high hover:bg-md3-primary hover:text-md3-on-primary text-[11px] font-semibold text-md3-on-surface transition-all cursor-pointer"
                >
                  Обзор...
                </button>
                {coverArtPreview && (
                  <button
                    type="button"
                    onClick={handleRemoveCover}
                    title="Удалить обложку"
                    className="p-1 rounded-full text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {!isSingle && (
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-md3-on-surface cursor-pointer select-none mt-0.5">
                  <input
                    type="checkbox"
                    checked={applyCover}
                    onChange={(e) => setApplyCover(e.target.checked)}
                    className="rounded text-md3-primary focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>Применить обложку</span>
                </label>
              )}
            </div>

            {/* Quick Header Fields (Title & Track # in Single Mode, or info banner) */}
            <div className="flex-1 w-full space-y-3">
              {isSingle ? (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-md3-on-surface flex items-center gap-1.5">
                      <Music className="w-3.5 h-3.5 text-md3-primary" />
                      <span>Название трека (Title)</span>
                    </label>
                    <input
                      type="text"
                      value={titleValue}
                      onChange={(e) => setTitleValue(e.target.value)}
                      placeholder="Название трека..."
                      className="w-full px-3.5 py-1.5 rounded-xl text-xs bg-md3-surface text-md3-on-surface border border-md3-outline-variant/30 focus:border-md3-primary focus:ring-2 focus:ring-md3-primary/20 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-md3-on-surface flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-md3-primary" />
                      <span>Номер дорожки (Track #)</span>
                    </label>
                    <input
                      type="number"
                      value={trackNumValue}
                      onChange={(e) => setTrackNumValue(e.target.value)}
                      placeholder="1, 2, 3..."
                      className="w-full px-3.5 py-1.5 rounded-xl text-xs bg-md3-surface text-md3-on-surface border border-md3-outline-variant/30 focus:border-md3-primary focus:ring-2 focus:ring-md3-primary/20 outline-none transition-all"
                    />
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col justify-center text-xs text-md3-on-surface-variant space-y-1.5">
                  <span className="font-semibold text-md3-on-surface">Пакетное обновление обложки</span>
                  <p className="text-[11px] leading-relaxed opacity-80">
                    Загруженная обложка будет встроена непосредственно в метаданные ID3v2/FLAC/M4A всех выбранных файлов на диске.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Core Metadata Fields */}
          <div className="space-y-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-md3-on-surface-variant/70 border-b border-md3-outline-variant/15 pb-1">
              Основные сведения
            </div>

            {/* Artist Field */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-md3-on-surface flex items-center gap-2 cursor-pointer">
                  {!isSingle && (
                    <input
                      type="checkbox"
                      checked={applyArtist}
                      onChange={(e) => setApplyArtist(e.target.checked)}
                      className="rounded text-md3-primary focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                    />
                  )}
                  <User className="w-3.5 h-3.5 text-md3-primary" />
                  <span>Исполнитель (Artist)</span>
                </label>
                {!isSingle && !allSameArtist && (
                  <span className="text-[10px] text-amber-400">Различные значения</span>
                )}
              </div>
              <input
                type="text"
                disabled={!isSingle && !applyArtist}
                value={artistValue}
                onChange={(e) => {
                  setArtistValue(e.target.value);
                  if (!isSingle) setApplyArtist(true);
                }}
                placeholder="Имя исполнителя..."
                className={`w-full px-3.5 py-2 rounded-xl text-xs border outline-none transition-all ${
                  isSingle || applyArtist
                    ? 'bg-md3-surface text-md3-on-surface border-md3-outline-variant/40 focus:border-md3-primary focus:ring-2 focus:ring-md3-primary/20'
                    : 'bg-md3-surface-container-high/40 text-md3-on-surface-variant/50 border-transparent cursor-not-allowed'
                }`}
              />
            </div>

            {/* Album Field */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-md3-on-surface flex items-center gap-2 cursor-pointer">
                  {!isSingle && (
                    <input
                      type="checkbox"
                      checked={applyAlbum}
                      onChange={(e) => setApplyAlbum(e.target.checked)}
                      className="rounded text-md3-primary focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                    />
                  )}
                  <Disc className="w-3.5 h-3.5 text-md3-primary" />
                  <span>Альбом (Album)</span>
                </label>
                {!isSingle && !allSameAlbum && (
                  <span className="text-[10px] text-amber-400">Различные значения</span>
                )}
              </div>
              <input
                type="text"
                disabled={!isSingle && !applyAlbum}
                value={albumValue}
                onChange={(e) => {
                  setAlbumValue(e.target.value);
                  if (!isSingle) setApplyAlbum(true);
                }}
                placeholder="Название альбома..."
                className={`w-full px-3.5 py-2 rounded-xl text-xs border outline-none transition-all ${
                  isSingle || applyAlbum
                    ? 'bg-md3-surface text-md3-on-surface border-md3-outline-variant/40 focus:border-md3-primary focus:ring-2 focus:ring-md3-primary/20'
                    : 'bg-md3-surface-container-high/40 text-md3-on-surface-variant/50 border-transparent cursor-not-allowed'
                }`}
              />
            </div>

            {/* Genre & Year Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Genre Field */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-md3-on-surface flex items-center gap-2 cursor-pointer">
                    {!isSingle && (
                      <input
                        type="checkbox"
                        checked={applyGenre}
                        onChange={(e) => setApplyGenre(e.target.checked)}
                        className="rounded text-md3-primary focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                      />
                    )}
                    <Tag className="w-3.5 h-3.5 text-md3-primary" />
                    <span>Жанр (Genre)</span>
                  </label>
                  {!isSingle && !allSameGenre && (
                    <span className="text-[10px] text-amber-400">Разные</span>
                  )}
                </div>
                <input
                  type="text"
                  disabled={!isSingle && !applyGenre}
                  value={genreValue}
                  onChange={(e) => {
                    setGenreValue(e.target.value);
                    if (!isSingle) setApplyGenre(true);
                  }}
                  placeholder="Rock, Pop, Electronic..."
                  className={`w-full px-3.5 py-2 rounded-xl text-xs border outline-none transition-all ${
                    isSingle || applyGenre
                      ? 'bg-md3-surface text-md3-on-surface border-md3-outline-variant/40 focus:border-md3-primary focus:ring-2 focus:ring-md3-primary/20'
                      : 'bg-md3-surface-container-high/40 text-md3-on-surface-variant/50 border-transparent cursor-not-allowed'
                  }`}
                />
              </div>

              {/* Year Field */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-md3-on-surface flex items-center gap-2 cursor-pointer">
                    {!isSingle && (
                      <input
                        type="checkbox"
                        checked={applyYear}
                        onChange={(e) => setApplyYear(e.target.checked)}
                        className="rounded text-md3-primary focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                      />
                    )}
                    <Calendar className="w-3.5 h-3.5 text-md3-primary" />
                    <span>Год (Year)</span>
                  </label>
                </div>
                <input
                  type="number"
                  disabled={!isSingle && !applyYear}
                  value={yearValue}
                  onChange={(e) => {
                    setYearValue(e.target.value);
                    if (!isSingle) setApplyYear(true);
                  }}
                  placeholder="2026"
                  className={`w-full px-3.5 py-2 rounded-xl text-xs border outline-none transition-all ${
                    isSingle || applyYear
                      ? 'bg-md3-surface text-md3-on-surface border-md3-outline-variant/40 focus:border-md3-primary focus:ring-2 focus:ring-md3-primary/20'
                      : 'bg-md3-surface-container-high/40 text-md3-on-surface-variant/50 border-transparent cursor-not-allowed'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Unusual / Additional Tags Section with Plus Button */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between border-b border-md3-outline-variant/15 pb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-md3-on-surface-variant/70">
                Дополнительные теги {activeExtraFields.size > 0 && `(${activeExtraFields.size})`}
              </span>

              {/* Plus Button with Dropdown */}
              <div className="relative" ref={plusMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsPlusMenuOpen(!isPlusMenuOpen)}
                  disabled={availableExtraDefs.length === 0}
                  title="Добавить дополнительный тег (композитор, группа, комментарий и др.)"
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-md3-primary/10 hover:bg-md3-primary/20 text-md3-primary border border-md3-primary/30 text-xs font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Добавить поле</span>
                </button>

                {/* Dropdown Menu */}
                {isPlusMenuOpen && availableExtraDefs.length > 0 && (
                  <div className="absolute right-0 top-full mt-1.5 w-60 bg-md3-surface-container-highest rounded-2xl shadow-2xl border border-md3-outline-variant/30 py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-md3-on-surface-variant/70">
                      Выберите поле:
                    </div>
                    {availableExtraDefs.map(def => {
                      const Icon = def.icon;
                      return (
                        <button
                          key={def.key}
                          type="button"
                          onClick={() => handleAddExtraField(def.key)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-md3-on-surface hover:bg-md3-surface-container transition-colors text-left cursor-pointer"
                        >
                          <Icon className="w-4 h-4 text-md3-primary shrink-0" />
                          <span className="font-medium">{def.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Render Active Extra Fields */}
            {activeExtraFields.size === 0 ? (
              <div className="text-center py-4 px-3 rounded-2xl bg-md3-surface-container-low/50 border border-dashed border-md3-outline-variant/20 text-xs text-md3-on-surface-variant/70">
                Нажмите кнопку <strong className="text-md3-primary font-semibold">+ Добавить поле</strong>, чтобы указать композитора, группу, комментарий или дирижера.
              </div>
            ) : (
              <div className="space-y-3">
                {Array.from(activeExtraFields).map(key => {
                  const def = EXTRA_FIELD_DEFS.find(d => d.key === key);
                  if (!def) return null;
                  const Icon = def.icon;
                  const isChecked = applyExtraFields[key];

                  return (
                    <div key={key} className="space-y-1 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-md3-on-surface flex items-center gap-2 cursor-pointer">
                          {!isSingle && (
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => setApplyExtraFields(prev => ({ ...prev, [key]: e.target.checked }))}
                              className="rounded text-md3-primary focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                            />
                          )}
                          <Icon className="w-3.5 h-3.5 text-md3-primary" />
                          <span>{def.label}</span>
                        </label>

                        <button
                          type="button"
                          onClick={() => handleRemoveExtraField(key)}
                          title="Удалить это поле"
                          className="p-1 rounded-full text-md3-on-surface-variant hover:text-red-400 hover:bg-md3-surface-container-high transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <input
                        type="text"
                        disabled={!isSingle && !isChecked}
                        value={extraFieldValues[key]}
                        onChange={(e) => {
                          const val = e.target.value;
                          setExtraFieldValues(prev => ({ ...prev, [key]: val }));
                          if (!isSingle) setApplyExtraFields(prev => ({ ...prev, [key]: true }));
                        }}
                        placeholder={def.placeholder}
                        className={`w-full px-3.5 py-2 rounded-xl text-xs border outline-none transition-all ${
                          isSingle || isChecked
                            ? 'bg-md3-surface text-md3-on-surface border-md3-outline-variant/40 focus:border-md3-primary focus:ring-2 focus:ring-md3-primary/20'
                            : 'bg-md3-surface-container-high/40 text-md3-on-surface-variant/50 border-transparent cursor-not-allowed'
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-md3-surface-container-high/80 border-t border-md3-outline-variant/20 flex items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] text-md3-on-surface-variant hidden sm:inline">
            Ctrl+Enter для сохранения
          </span>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-full text-xs font-semibold text-md3-on-surface-variant hover:bg-md3-surface-container transition-colors cursor-pointer"
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2 rounded-full bg-md3-primary text-md3-on-primary text-xs font-bold hover:scale-[1.02] active:scale-95 shadow-md transition-all cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>{isSingle ? 'Сохранить изменения' : `Применить к ${selectedTracks.length} трекам`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
