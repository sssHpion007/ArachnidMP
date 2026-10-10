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
import { AppLanguage } from '../i18n';

interface BatchTagEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTracks: Track[];
  language?: AppLanguage;
  onSaveTags: (updatedFields: {
    title?: string;
    artist?: string;
    album?: string;
    genre?: string;
    year?: number;
    trackNumber?: number;
    trackTotal?: number;
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

const getExtraFieldDefs = (lang: AppLanguage): ExtraFieldDef[] => [
  { key: 'lyricist', label: lang === 'ru' ? 'Автор текста' : 'Lyricist', icon: PenTool, placeholder: lang === 'ru' ? 'Автор слов / поэт...' : 'Lyricist / poet name...' },
  { key: 'composer', label: lang === 'ru' ? 'Композитор' : 'Composer', icon: Music, placeholder: lang === 'ru' ? 'Имя композитора...' : 'Composer name...' },
  { key: 'contentGroup', label: lang === 'ru' ? 'Группа / Коллектив' : 'Band / Ensemble', icon: Users, placeholder: lang === 'ru' ? 'Название группы, оркестра или ансамбля...' : 'Band, orchestra or ensemble name...' },
  { key: 'comment', label: lang === 'ru' ? 'Комментарий' : 'Comment', icon: MessageSquare, placeholder: lang === 'ru' ? 'Заметки, описание, источник...' : 'Notes, description, source...' },
  { key: 'conductor', label: lang === 'ru' ? 'Дирижер' : 'Conductor', icon: Radio, placeholder: lang === 'ru' ? 'Имя дирижера...' : 'Conductor name...' },
];

export const BatchTagEditorModal: React.FC<BatchTagEditorModalProps> = ({
  isOpen,
  onClose,
  selectedTracks,
  language = 'ru',
  onSaveTags,
}) => {
  const isSingle = selectedTracks.length === 1;
  const firstTrack = selectedTracks[0] || null;

  // Track initial common values across selected tracks
  const allSameArtist = !!firstTrack && selectedTracks.every(t => t.artist === firstTrack.artist);
  const allSameAlbum = !!firstTrack && selectedTracks.every(t => t.album === firstTrack.album);
  const allSameGenre = !!firstTrack && selectedTracks.every(t => t.genre === firstTrack.genre);
  const allSameYear = !!firstTrack && selectedTracks.every(t => t.year === firstTrack.year);
  const allSameTrackTotal = !!firstTrack && selectedTracks.every(t => t.trackTotal === firstTrack.trackTotal);
  const allSameCover = !!firstTrack && selectedTracks.every(t => t.coverArt === firstTrack.coverArt);

  // Top fields: Title, Artist, Album
  const [titleValue, setTitleValue] = useState('');
  const [applyTitle, setApplyTitle] = useState(false);

  const [artistValue, setArtistValue] = useState('');
  const [applyArtist, setApplyArtist] = useState(false);

  const [albumValue, setAlbumValue] = useState('');
  const [applyAlbum, setApplyAlbum] = useState(false);

  // Track Numbering (e.g. 1 of 10)
  const [trackNumValue, setTrackNumValue] = useState('');
  const [trackTotalValue, setTrackTotalValue] = useState('');
  const [applyTrackNum, setApplyTrackNum] = useState(false);

  // Genre & Year
  const [genreValue, setGenreValue] = useState('');
  const [applyGenre, setApplyGenre] = useState(false);

  const [yearValue, setYearValue] = useState('');
  const [applyYear, setApplyYear] = useState(false);

  // Cover art state
  const [coverArtPreview, setCoverArtPreview] = useState<string | null>(null);
  const [applyCover, setApplyCover] = useState(false);
  const [isDraggingOverCover, setIsDraggingOverCover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extra metadata fields
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

  const extraFieldDefs = getExtraFieldDefs(language);

  // Initialize form when opened or selection changes
  useEffect(() => {
    if (!isOpen || selectedTracks.length === 0) return;

    if (isSingle && firstTrack) {
      setTitleValue(firstTrack.title || '');
      setArtistValue(firstTrack.artist || '');
      setAlbumValue(firstTrack.album || '');
      setTrackNumValue(firstTrack.trackNumber ? String(firstTrack.trackNumber) : '');
      setTrackTotalValue(firstTrack.trackTotal ? String(firstTrack.trackTotal) : '');
      setGenreValue(firstTrack.genre || '');
      setYearValue(firstTrack.year ? String(firstTrack.year) : '');
      setCoverArtPreview(firstTrack.coverArt || null);

      const activeExtras = new Set<ExtraFieldKey>();
      const initialValues: Record<ExtraFieldKey, string> = {
        composer: firstTrack.composer || '',
        contentGroup: firstTrack.contentGroup || '',
        comment: firstTrack.comment || '',
        conductor: firstTrack.conductor || '',
        lyricist: firstTrack.lyricist || '',
      };

      if (firstTrack.composer) activeExtras.add('composer');
      if (firstTrack.contentGroup) activeExtras.add('contentGroup');
      if (firstTrack.comment) activeExtras.add('comment');
      if (firstTrack.conductor) activeExtras.add('conductor');
      if (firstTrack.lyricist || (firstTrack.lyrics && firstTrack.lyrics.trim().length > 0)) {
        activeExtras.add('lyricist');
      }

      setActiveExtraFields(activeExtras);
      setExtraFieldValues(initialValues);
      setApplyTitle(true);
      setApplyArtist(true);
      setApplyAlbum(true);
      setApplyTrackNum(true);
      setApplyGenre(true);
      setApplyYear(true);
      setApplyCover(false);
    } else {
      // Multi-track batch edit
      setTitleValue('');
      setApplyTitle(false);

      setArtistValue(allSameArtist && firstTrack ? firstTrack.artist : '');
      setApplyArtist(false);

      setAlbumValue(allSameAlbum && firstTrack ? firstTrack.album : '');
      setApplyAlbum(false);

      setTrackNumValue('');
      setTrackTotalValue(allSameTrackTotal && firstTrack?.trackTotal ? String(firstTrack.trackTotal) : '');
      setApplyTrackNum(false);

      setGenreValue(allSameGenre && firstTrack ? (firstTrack.genre || '') : '');
      setApplyGenre(false);

      setYearValue(allSameYear && firstTrack?.year ? String(firstTrack.year) : '');
      setApplyYear(false);

      setCoverArtPreview(allSameCover && firstTrack ? (firstTrack.coverArt || null) : null);
      setApplyCover(false);

      // Check common extra fields
      const activeExtras = new Set<ExtraFieldKey>();
      const initialValues: Record<ExtraFieldKey, string> = {
        composer: '',
        contentGroup: '',
        comment: '',
        conductor: '',
        lyricist: '',
      };

      const keys: ExtraFieldKey[] = ['composer', 'contentGroup', 'comment', 'conductor', 'lyricist'];
      for (const k of keys) {
        const firstVal = firstTrack ? (firstTrack[k] || '') : '';
        const allMatch = selectedTracks.every(t => (t[k] || '') === firstVal);
        if (firstVal && allMatch) {
          activeExtras.add(k);
          initialValues[k] = firstVal;
        }
      }

      setActiveExtraFields(activeExtras);
      setExtraFieldValues(initialValues);
      setApplyExtraFields({
        composer: false,
        contentGroup: false,
        comment: false,
        conductor: false,
        lyricist: false,
      });
    }
    setIsPlusMenuOpen(false);
  }, [isOpen, selectedTracks, isSingle]);

  // Handle outside click for Plus menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
        setIsPlusMenuOpen(false);
      }
    };
    if (isPlusMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPlusMenuOpen]);

  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert(language === 'ru' 
          ? 'Пожалуйста, выберите файл изображения (JPEG, PNG, WebP).' 
          : 'Please choose an image file (JPEG, PNG, WebP).'
        );
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setCoverArtPreview(reader.result as string);
        setApplyCover(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCoverDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOverCover(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        setCoverArtPreview(reader.result as string);
        setApplyCover(true);
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
      trackTotal?: number;
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
      if (trackTotalValue.trim()) {
        const tot = parseInt(trackTotalValue, 10);
        if (!isNaN(tot)) updates.trackTotal = tot;
      }
    } else {
      if (applyTitle && titleValue.trim()) updates.title = titleValue.trim();
      if (applyTrackNum) {
        if (trackNumValue.trim()) {
          const num = parseInt(trackNumValue, 10);
          if (!isNaN(num)) updates.trackNumber = num;
        }
        if (trackTotalValue.trim()) {
          const tot = parseInt(trackTotalValue, 10);
          if (!isNaN(tot)) updates.trackTotal = tot;
        }
      }
    }

    if (applyArtist || isSingle) updates.artist = artistValue.trim();
    if (applyAlbum || isSingle) updates.album = albumValue.trim();
    if (applyGenre || isSingle) updates.genre = genreValue.trim();
    if ((applyYear || isSingle) && yearValue) {
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
  }, [isOpen, applyArtist, applyAlbum, applyGenre, applyYear, applyCover, activeExtraFields, applyExtraFields, artistValue, albumValue, genreValue, yearValue, titleValue, trackNumValue, trackTotalValue, coverArtPreview, extraFieldValues, onClose]);

  if (!isOpen || selectedTracks.length === 0) return null;

  const availableExtraDefs = extraFieldDefs.filter(d => !activeExtraFields.has(d.key));

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150 select-none cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-md3-surface-container rounded-3xl shadow-2xl border border-md3-outline-variant/30 overflow-hidden flex flex-col max-h-[90vh] cursor-default"
      >
        {/* Header */}
        <div className="p-5 border-b border-md3-outline-variant/20 flex items-center justify-between bg-md3-surface-container-high/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-md3-primary/15 text-md3-primary flex items-center justify-center shadow-xs">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-md3-on-surface">
                {isSingle 
                  ? (language === 'ru' ? 'Редактор тегов' : 'Tag Editor') 
                  : (language === 'ru' ? 'Пакетная правка тегов' : 'Batch Tag Editor')}
              </h3>
              <p className="text-xs text-md3-on-surface-variant">
                {isSingle 
                  ? (firstTrack?.title ? `${firstTrack.artist} — ${firstTrack.title}` : (language === 'ru' ? 'Редактирование метаданных' : 'Editing metadata'))
                  : (language === 'ru' ? `Изменение тегов для ${selectedTracks.length} треков` : `Editing tags for ${selectedTracks.length} tracks`)
                }
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            title={language === 'ru' ? 'Закрыть [Esc]' : 'Close [Esc]'}
            className="p-1.5 rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container-highest hover:text-md3-on-surface transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Tracks Preview List (Batch mode only) */}
        {!isSingle && (
          <div className="px-5 py-2.5 bg-md3-surface-container-lowest/50 border-b border-md3-outline-variant/10 max-h-24 overflow-y-auto custom-scrollbar shrink-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-md3-on-surface-variant/70 mb-1">
              {language === 'ru' ? `Выбранные треки (${selectedTracks.length}):` : `Selected tracks (${selectedTracks.length}):`}
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
        <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1 min-h-0">
          
          {/* Main Top Card: Large Cover Preview on left, Title / Artist / Album on right */}
          <div className="p-4 rounded-3xl bg-md3-surface-container-low border border-md3-outline-variant/15 flex flex-col sm:flex-row gap-5 items-center sm:items-start">
            
            {/* Left: Large Cover Art Box */}
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
                title={language === 'ru' ? 'Нажмите или перетащите изображение для загрузки обложки' : 'Click or drop image to upload cover'}
                className={`relative w-40 h-40 rounded-3xl overflow-hidden border-2 cursor-pointer flex items-center justify-center transition-all group shadow-md ${
                  isDraggingOverCover
                    ? 'border-md3-primary bg-md3-primary/10 scale-102'
                    : 'border-md3-outline-variant/30 bg-md3-surface-container hover:border-md3-primary/70'
                }`}
              >
                {coverArtPreview ? (
                  <>
                    <img
                      src={coverArtPreview}
                      alt={language === 'ru' ? 'Обложка' : 'Cover'}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1.5 text-white text-xs font-semibold transition-opacity">
                      <Upload className="w-5 h-5" />
                      <span>{language === 'ru' ? 'Заменить' : 'Replace'}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-3 text-center text-md3-on-surface-variant/70 group-hover:text-md3-primary transition-colors">
                    <ImageIcon className="w-9 h-9 mb-1.5 stroke-1" />
                    <span className="text-xs font-medium leading-tight">
                      {language === 'ru' ? 'Загрузить обложку' : 'Upload Cover'}
                    </span>
                  </div>
                )}
              </div>

              {/* Cover Art Actions */}
              <div className="flex items-center gap-2 mt-0.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1 rounded-full bg-md3-surface-container-high hover:bg-md3-primary hover:text-md3-on-primary text-xs font-semibold text-md3-on-surface transition-all cursor-pointer shadow-xs"
                >
                  {language === 'ru' ? 'Обзор...' : 'Browse...'}
                </button>
                {coverArtPreview && (
                  <button
                    type="button"
                    onClick={handleRemoveCover}
                    title={language === 'ru' ? 'Удалить обложку' : 'Remove Cover'}
                    className="p-1.5 rounded-full text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {!isSingle && (
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-md3-on-surface cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={applyCover}
                    onChange={(e) => setApplyCover(e.target.checked)}
                    className="rounded text-md3-primary focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>{language === 'ru' ? 'Применить обложку' : 'Apply cover'}</span>
                </label>
              )}
            </div>

            {/* Right: Title, Artist, Album Fields (Right Next to Cover) */}
            <div className="flex-1 w-full space-y-3">
              
              {/* Title Field */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-md3-on-surface flex items-center gap-1.5 cursor-pointer">
                    {!isSingle && (
                      <input
                        type="checkbox"
                        checked={applyTitle}
                        onChange={(e) => setApplyTitle(e.target.checked)}
                        className="rounded text-md3-primary focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                      />
                    )}
                    <Music className="w-3.5 h-3.5 text-md3-primary" />
                    <span>{language === 'ru' ? 'Название трека (Title)' : 'Track Title'}</span>
                  </label>
                </div>
                <input
                  type="text"
                  disabled={!isSingle && !applyTitle}
                  value={titleValue}
                  onChange={(e) => {
                    setTitleValue(e.target.value);
                    if (!isSingle) setApplyTitle(true);
                  }}
                  placeholder={isSingle 
                    ? (language === 'ru' ? 'Название трека...' : 'Track title...') 
                    : (language === 'ru' ? 'Введите общее название для всех...' : 'Enter common title for all...')
                  }
                  className={`w-full px-3.5 py-1.5 rounded-xl text-xs border outline-none transition-all ${
                    isSingle || applyTitle
                      ? 'bg-md3-surface text-md3-on-surface border-md3-outline-variant/30 focus:border-md3-primary focus:ring-2 focus:ring-md3-primary/20'
                      : 'bg-md3-surface-container-high/40 text-md3-on-surface-variant/50 border-transparent cursor-not-allowed'
                  }`}
                />
              </div>

              {/* Artist Field */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-md3-on-surface flex items-center gap-1.5 cursor-pointer">
                    {!isSingle && (
                      <input
                        type="checkbox"
                        checked={applyArtist}
                        onChange={(e) => setApplyArtist(e.target.checked)}
                        className="rounded text-md3-primary focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                      />
                    )}
                    <User className="w-3.5 h-3.5 text-md3-primary" />
                    <span>{language === 'ru' ? 'Исполнитель (Artist)' : 'Artist'}</span>
                  </label>
                  {!isSingle && !allSameArtist && (
                    <span className="text-[10px] text-amber-400">
                      {language === 'ru' ? 'Различные значения' : 'Different values'}
                    </span>
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
                  placeholder={language === 'ru' ? 'Имя исполнителя...' : 'Artist name...'}
                  className={`w-full px-3.5 py-1.5 rounded-xl text-xs border outline-none transition-all ${
                    isSingle || applyArtist
                      ? 'bg-md3-surface text-md3-on-surface border-md3-outline-variant/30 focus:border-md3-primary focus:ring-2 focus:ring-md3-primary/20'
                      : 'bg-md3-surface-container-high/40 text-md3-on-surface-variant/50 border-transparent cursor-not-allowed'
                  }`}
                />
              </div>

              {/* Album Field */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-md3-on-surface flex items-center gap-1.5 cursor-pointer">
                    {!isSingle && (
                      <input
                        type="checkbox"
                        checked={applyAlbum}
                        onChange={(e) => setApplyAlbum(e.target.checked)}
                        className="rounded text-md3-primary focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                      />
                    )}
                    <Disc className="w-3.5 h-3.5 text-md3-primary" />
                    <span>{language === 'ru' ? 'Альбом (Album)' : 'Album'}</span>
                  </label>
                  {!isSingle && !allSameAlbum && (
                    <span className="text-[10px] text-amber-400">
                      {language === 'ru' ? 'Различные значения' : 'Different values'}
                    </span>
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
                  placeholder={language === 'ru' ? 'Название альбома...' : 'Album name...'}
                  className={`w-full px-3.5 py-1.5 rounded-xl text-xs border outline-none transition-all ${
                    isSingle || applyAlbum
                      ? 'bg-md3-surface text-md3-on-surface border-md3-outline-variant/30 focus:border-md3-primary focus:ring-2 focus:ring-md3-primary/20'
                      : 'bg-md3-surface-container-high/40 text-md3-on-surface-variant/50 border-transparent cursor-not-allowed'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Secondary Row: Track Number (1 of 10), Genre, Year */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-md3-surface-container-low/70 p-3.5 rounded-2xl border border-md3-outline-variant/15">
            
            {/* Track Numbering: "1 of 10" */}
            <div className="space-y-1 sm:col-span-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-md3-on-surface flex items-center gap-1.5 cursor-pointer">
                  {!isSingle && (
                    <input
                      type="checkbox"
                      checked={applyTrackNum}
                      onChange={(e) => setApplyTrackNum(e.target.checked)}
                      className="rounded text-md3-primary focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                    />
                  )}
                  <Hash className="w-3.5 h-3.5 text-md3-primary" />
                  <span>{language === 'ru' ? 'Номер дорожки' : 'Track Number'}</span>
                </label>
              </div>

              {/* 2 small fields: e.g. [ 1 ] of [ 10 ] */}
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  disabled={!isSingle && !applyTrackNum}
                  value={trackNumValue}
                  onChange={(e) => {
                    setTrackNumValue(e.target.value);
                    if (!isSingle) setApplyTrackNum(true);
                  }}
                  placeholder="№"
                  className={`w-16 px-2.5 py-1.5 rounded-xl text-xs text-center border outline-none transition-all ${
                    isSingle || applyTrackNum
                      ? 'bg-md3-surface text-md3-on-surface border-md3-outline-variant/30 focus:border-md3-primary'
                      : 'bg-md3-surface-container-high/40 text-md3-on-surface-variant/50 border-transparent cursor-not-allowed'
                  }`}
                />
                <span className="text-xs text-md3-on-surface-variant/80 font-medium">
                  {language === 'ru' ? 'из' : 'of'}
                </span>
                <input
                  type="number"
                  disabled={!isSingle && !applyTrackNum}
                  value={trackTotalValue}
                  onChange={(e) => {
                    setTrackTotalValue(e.target.value);
                    if (!isSingle) setApplyTrackNum(true);
                  }}
                  placeholder={language === 'ru' ? 'Всего' : 'Total'}
                  className={`w-16 px-2.5 py-1.5 rounded-xl text-xs text-center border outline-none transition-all ${
                    isSingle || applyTrackNum
                      ? 'bg-md3-surface text-md3-on-surface border-md3-outline-variant/30 focus:border-md3-primary'
                      : 'bg-md3-surface-container-high/40 text-md3-on-surface-variant/50 border-transparent cursor-not-allowed'
                  }`}
                />
              </div>
            </div>

            {/* Genre Field */}
            <div className="space-y-1 sm:col-span-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-md3-on-surface flex items-center gap-1.5 cursor-pointer">
                  {!isSingle && (
                    <input
                      type="checkbox"
                      checked={applyGenre}
                      onChange={(e) => setApplyGenre(e.target.checked)}
                      className="rounded text-md3-primary focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                    />
                  )}
                  <Tag className="w-3.5 h-3.5 text-md3-primary" />
                  <span>{language === 'ru' ? 'Жанр' : 'Genre'}</span>
                </label>
                {!isSingle && !allSameGenre && (
                  <span className="text-[10px] text-amber-400">
                    {language === 'ru' ? 'Разные' : 'Different'}
                  </span>
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
                placeholder="Rock, Pop, EDM..."
                className={`w-full px-3 py-1.5 rounded-xl text-xs border outline-none transition-all ${
                  isSingle || applyGenre
                    ? 'bg-md3-surface text-md3-on-surface border-md3-outline-variant/30 focus:border-md3-primary'
                    : 'bg-md3-surface-container-high/40 text-md3-on-surface-variant/50 border-transparent cursor-not-allowed'
                }`}
              />
            </div>

            {/* Year Field */}
            <div className="space-y-1 sm:col-span-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-md3-on-surface flex items-center gap-1.5 cursor-pointer">
                  {!isSingle && (
                    <input
                      type="checkbox"
                      checked={applyYear}
                      onChange={(e) => setApplyYear(e.target.checked)}
                      className="rounded text-md3-primary focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                    />
                  )}
                  <Calendar className="w-3.5 h-3.5 text-md3-primary" />
                  <span>{language === 'ru' ? 'Год' : 'Year'}</span>
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
                className={`w-full px-3 py-1.5 rounded-xl text-xs border outline-none transition-all ${
                  isSingle || applyYear
                    ? 'bg-md3-surface text-md3-on-surface border-md3-outline-variant/30 focus:border-md3-primary'
                    : 'bg-md3-surface-container-high/40 text-md3-on-surface-variant/50 border-transparent cursor-not-allowed'
                }`}
              />
            </div>
          </div>

          {/* Unusual / Additional Tags Section with Plus Button */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between border-b border-md3-outline-variant/15 pb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-md3-on-surface-variant/70">
                {language === 'ru' ? 'Дополнительные теги' : 'Additional Tags'} {activeExtraFields.size > 0 && `(${activeExtraFields.size})`}
              </span>

              {/* Plus Button with Dropdown */}
              <div className="relative" ref={plusMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsPlusMenuOpen(!isPlusMenuOpen)}
                  disabled={availableExtraDefs.length === 0}
                  title={language === 'ru' ? 'Добавить дополнительный тег (композитор, группа, комментарий и др.)' : 'Add extra tag (composer, band, comment, etc.)'}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-md3-primary/10 hover:bg-md3-primary/20 text-md3-primary border border-md3-primary/30 text-xs font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>{language === 'ru' ? 'Добавить поле' : 'Add Field'}</span>
                </button>

                {/* Dropdown Menu */}
                {isPlusMenuOpen && availableExtraDefs.length > 0 && (
                  <div className="absolute right-0 top-full mt-1.5 w-60 bg-md3-surface-container-highest rounded-2xl shadow-2xl border border-md3-outline-variant/30 py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-md3-on-surface-variant/70">
                      {language === 'ru' ? 'Выберите поле:' : 'Select field:'}
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
                {language === 'ru' ? (
                  <>
                    Нажмите кнопку <strong className="text-md3-primary font-semibold">+ Добавить поле</strong>, чтобы указать автора текста, композитора, группу, комментарий или дирижера.
                  </>
                ) : (
                  <>
                    Click the <strong className="text-md3-primary font-semibold">+ Add Field</strong> button to specify lyricist, composer, band, comment, or conductor.
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {Array.from(activeExtraFields).map(key => {
                  const def = extraFieldDefs.find(d => d.key === key);
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
                          title={language === 'ru' ? 'Удалить это поле' : 'Remove this field'}
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
            {language === 'ru' ? 'Ctrl+Enter для сохранения' : 'Ctrl+Enter to save'}
          </span>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-full text-xs font-semibold text-md3-on-surface-variant hover:bg-md3-surface-container transition-colors cursor-pointer"
            >
              {language === 'ru' ? 'Отмена' : 'Cancel'}
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2 rounded-full bg-md3-primary text-md3-on-primary text-xs font-bold hover:scale-[1.02] active:scale-95 shadow-md transition-all cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>
                {isSingle 
                  ? (language === 'ru' ? 'Сохранить изменения' : 'Save Changes') 
                  : (language === 'ru' ? `Применить к ${selectedTracks.length} трекам` : `Apply to ${selectedTracks.length} tracks`)}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
