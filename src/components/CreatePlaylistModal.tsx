import React, { useState, useEffect, useRef } from 'react';
import { ListMusic, X, Check, Image, LayoutGrid, Images, Folder, Sparkles, Pipette } from 'lucide-react';
import { FolderCoverType, Playlist } from '../types/music';
import { FOLDER_ICONS, FolderIconOption } from '../theme/folderIcons';
import { extractDominantColor } from '../theme/material3';
import { AppLanguage } from '../i18n';
import { useModalAnimation } from '../utils/useModalAnimation';

interface CreatePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, description?: string, coverType?: FolderCoverType, color?: string, icon?: string) => void;
  folderName?: string;
  playlistToEdit?: Playlist | null;
  initialCoverArt?: string | null;
  language?: AppLanguage;
}

const getPlaylistColors = (lang: AppLanguage) => [
  { id: 'default', label: lang === 'ru' ? 'По умолчанию' : 'Default', bg: 'bg-md3-primary', hex: '' },
  { id: 'amber', label: lang === 'ru' ? 'Янтарный' : 'Amber', bg: 'bg-amber-500', hex: '#f59e0b' },
  { id: 'emerald', label: lang === 'ru' ? 'Изумрудный' : 'Emerald', bg: 'bg-emerald-500', hex: '#10b981' },
  { id: 'indigo', label: lang === 'ru' ? 'Индиго' : 'Indigo', bg: 'bg-indigo-500', hex: '#6366f1' },
  { id: 'purple', label: lang === 'ru' ? 'Пурпурный' : 'Purple', bg: 'bg-purple-500', hex: '#a855f7' },
  { id: 'rose', label: lang === 'ru' ? 'Розовый' : 'Rose', bg: 'bg-rose-500', hex: '#f43f5e' },
  { id: 'cyan', label: lang === 'ru' ? 'Бирюзовый' : 'Cyan', bg: 'bg-cyan-500', hex: '#06b6d4' },
];

export const CreatePlaylistModal: React.FC<CreatePlaylistModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  folderName,
  playlistToEdit,
  initialCoverArt,
  language = 'ru',
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverType, setCoverType] = useState<FolderCoverType>('first_playlist');
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('list');
  const [extractedCoverColor, setExtractedCoverColor] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  // Segmented control indicator state for Playlist Cover Display
  const coverTypeContainerRef = useRef<HTMLDivElement>(null);
  const coverTypeRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const [coverTypeIndicatorStyle, setCoverTypeIndicatorStyle] = useState<{ left: number; width: number; height: number; opacity: number }>({
    left: 0,
    width: 0,
    height: 0,
    opacity: 0,
  });

  const updateCoverTypeIndicator = () => {
    const el = coverTypeRefs.current[coverType];
    const container = coverTypeContainerRef.current;
    if (el && container) {
      setCoverTypeIndicatorStyle({
        left: el.offsetLeft,
        width: el.offsetWidth,
        height: el.offsetHeight,
        opacity: 1,
      });
    }
  };

  useEffect(() => {
    updateCoverTypeIndicator();
    const t = setTimeout(updateCoverTypeIndicator, 40);
    return () => clearTimeout(t);
  }, [coverType, isOpen]);

  useEffect(() => {
    if (!coverTypeContainerRef.current) return;
    const ro = new ResizeObserver(() => updateCoverTypeIndicator());
    ro.observe(coverTypeContainerRef.current);
    return () => ro.disconnect();
  }, []);

  // Extract vibrant dominant color from cover art when provided
  useEffect(() => {
    if (initialCoverArt && isOpen) {
      extractDominantColor(initialCoverArt).then((hex) => {
        if (hex) {
          setExtractedCoverColor(hex);
        }
      });
    } else {
      setExtractedCoverColor(null);
    }
  }, [initialCoverArt, isOpen]);

  useEffect(() => {
    if (isOpen) {
      if (playlistToEdit) {
        setName(playlistToEdit.name);
        setDescription(playlistToEdit.description || '');
        setCoverType(playlistToEdit.coverType || 'first_playlist');
        setSelectedColor(playlistToEdit.color || '');
        setSelectedIcon(playlistToEdit.icon || 'list');
      } else {
        setName('');
        setDescription('');
        setCoverType('first_playlist');
        setSelectedColor('');
        setSelectedIcon('list');
      }
      setTimeout(() => {
        inputRef.current?.focus();
        if (playlistToEdit) inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, playlistToEdit]);

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

  const playlistColors = getPlaylistColors(language);

  const { isRendered, backdropClass, dialogClass } = useModalAnimation(isOpen, 200);

  if (!isRendered) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) return;
    onCreate(
      name.trim(),
      description.trim() || undefined,
      coverType,
      selectedColor || undefined,
      selectedIcon || undefined
    );
    onClose();
  };

  return (
    <div 
      onClick={onClose}
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md select-none cursor-pointer ${backdropClass}`}
    >
      <div 
        className={`w-full max-w-lg bg-md3-surface-container rounded-3xl shadow-2xl border border-md3-outline-variant/20 overflow-hidden flex flex-col max-h-[90vh] cursor-default ${dialogClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 pb-4 border-b border-md3-outline-variant/15 flex items-center justify-between bg-md3-surface-container-high/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-md3-primary/15 text-md3-primary flex items-center justify-center shadow-sm">
              <ListMusic className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-md3-on-surface leading-tight">
                {playlistToEdit 
                  ? (language === 'ru' ? 'Настройки плейлиста' : 'Playlist Settings')
                  : (language === 'ru' ? 'Новый плейлист' : 'New Playlist')}
              </h2>
              <p className="text-xs text-md3-on-surface-variant mt-0.5 truncate max-w-[280px]">
                {playlistToEdit
                  ? (language === 'ru' ? 'Измените имя, обложку, значок и цвет' : 'Change playlist name, cover style, icon and color')
                  : folderName 
                  ? (language === 'ru' ? `Внутри папки «${folderName}»` : `Inside folder "${folderName}"`)
                  : (language === 'ru' ? 'Создайте подборку для избранных треков' : 'Create a collection for your favorite tracks')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-md3-on-surface-variant hover:text-md3-on-surface hover:bg-md3-surface-container-highest transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
          <div>
            <label className="block text-xs font-semibold text-md3-on-surface-variant mb-1.5">
              {language === 'ru' ? 'Название плейлиста' : 'Playlist Name'} <span className="text-red-400">*</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={language === 'ru' ? "Например: Любимый Рок, Вечерний чилл..." : "For example: Favorite Rock, Chillout..."}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-md3-surface text-sm text-md3-on-surface placeholder-md3-on-surface-variant/40 border border-md3-outline-variant/20 focus:border-md3-primary outline-none transition-all shadow-inner"
              maxLength={60}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-md3-on-surface-variant mb-1.5">
              {language === 'ru' ? 'Описание (необязательно)' : 'Description (optional)'}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={language === 'ru' ? "Коротко о настроении или содержании плейлиста..." : "Short note about mood or tracks..."}
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-md3-surface text-sm text-md3-on-surface placeholder-md3-on-surface-variant/40 border border-md3-outline-variant/20 focus:border-md3-primary outline-none transition-all resize-none shadow-inner"
              maxLength={150}
            />
          </div>

          {/* Playlist Cover Display Style - Unified Segmented Control */}
          <div>
            <label className="block text-xs font-semibold text-md3-on-surface-variant mb-1.5">
              {language === 'ru' ? 'Отображение обложки' : 'Cover Display'}
            </label>
            <div
              ref={coverTypeContainerRef}
              className="relative p-1 bg-md3-surface rounded-2xl border border-md3-outline-variant/20 shadow-xs flex items-center select-none overflow-hidden"
            >
              {/* Smooth sliding glow pill indicator */}
              <div
                className="absolute rounded-xl bg-md3-primary shadow-sm pointer-events-none transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] z-0"
                style={{
                  left: `${coverTypeIndicatorStyle.left}px`,
                  width: `${coverTypeIndicatorStyle.width}px`,
                  height: `${coverTypeIndicatorStyle.height}px`,
                  opacity: coverTypeIndicatorStyle.opacity,
                  boxShadow: '0 0 16px rgba(var(--md-sys-color-primary-rgb, 168 121 255), 0.45), 0 2px 6px rgba(0,0,0,0.2)',
                }}
              />

              {/* 1. First Track Cover */}
              <button
                ref={(el) => { coverTypeRefs.current['first_playlist'] = el; }}
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setCoverType('first_playlist')}
                className={`relative z-10 flex-1 py-2 px-1.5 rounded-xl flex items-center justify-center gap-1.5 text-xs transition-colors duration-200 cursor-pointer outline-none focus:outline-none ${
                  coverType === 'first_playlist'
                    ? 'text-md3-on-primary font-bold'
                    : 'text-md3-on-surface-variant hover:text-md3-on-surface font-medium'
                }`}
              >
                <Image className="w-4 h-4 shrink-0" />
                <span className="truncate">{language === 'ru' ? 'Первый трек' : 'First Track'}</span>
              </button>

              {/* 2. Collage 2x2 */}
              <button
                ref={(el) => { coverTypeRefs.current['collage'] = el; }}
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setCoverType('collage')}
                className={`relative z-10 flex-1 py-2 px-1.5 rounded-xl flex items-center justify-center gap-1.5 text-xs transition-colors duration-200 cursor-pointer outline-none focus:outline-none ${
                  coverType === 'collage'
                    ? 'text-md3-on-primary font-bold'
                    : 'text-md3-on-surface-variant hover:text-md3-on-surface font-medium'
                }`}
              >
                <LayoutGrid className="w-4 h-4 shrink-0" />
                <span className="truncate">{language === 'ru' ? 'Коллаж' : 'Collage'}</span>
              </button>

              {/* 3. Slideshow / Cycle */}
              <button
                ref={(el) => { coverTypeRefs.current['cycle'] = el; }}
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setCoverType('cycle')}
                className={`relative z-10 flex-1 py-2 px-1.5 rounded-xl flex items-center justify-center gap-1.5 text-xs transition-colors duration-200 cursor-pointer outline-none focus:outline-none ${
                  coverType === 'cycle'
                    ? 'text-md3-on-primary font-bold'
                    : 'text-md3-on-surface-variant hover:text-md3-on-surface font-medium'
                }`}
              >
                <Images className="w-4 h-4 shrink-0" />
                <span className="truncate">{language === 'ru' ? 'Слайд-шоу' : 'Slideshow'}</span>
              </button>

              {/* 4. Icon */}
              <button
                ref={(el) => { coverTypeRefs.current['icon'] = el; }}
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setCoverType('icon')}
                className={`relative z-10 flex-1 py-2 px-1.5 rounded-xl flex items-center justify-center gap-1.5 text-xs transition-colors duration-200 cursor-pointer outline-none focus:outline-none ${
                  coverType === 'icon'
                    ? 'text-md3-on-primary font-bold'
                    : 'text-md3-on-surface-variant hover:text-md3-on-surface font-medium'
                }`}
              >
                <Folder className="w-4 h-4 shrink-0" />
                <span className="truncate">{language === 'ru' ? 'Иконка' : 'Icon'}</span>
              </button>
            </div>

            <p className="text-[11px] text-md3-on-surface-variant/80 mt-1.5 px-0.5">
              {coverType === 'first_playlist' && (language === 'ru' ? 'Отображается обложка первого трека плейлиста.' : 'Displays the artwork of the first track.')}
              {coverType === 'collage' && (language === 'ru' ? 'Отображается коллаж 2×2 из обложек треков.' : 'Displays a 2×2 collage of track artworks.')}
              {coverType === 'cycle' && (language === 'ru' ? 'Обложки треков плавно сменяются с независимым интервалом.' : 'Track covers smoothly cycle at independent intervals.')}
              {coverType === 'icon' && (language === 'ru' ? 'Отображается выбранная цветная иконка плейлиста.' : 'Displays the chosen colored playlist icon.')}
            </p>
          </div>

          {/* Playlist Icon Picker */}
          <div>
            <label className="block text-xs font-semibold text-md3-on-surface-variant mb-2">
              {coverType === 'icon' 
                ? (language === 'ru' ? 'Иконка плейлиста' : 'Playlist Icon') 
                : (language === 'ru' ? 'Иконка (значок и резервный вид)' : 'Icon (badge and fallback)')}
            </label>
            <div className="grid grid-cols-6 sm:grid-cols-9 gap-2 bg-md3-surface-container-highest/60 p-3 rounded-2xl border border-md3-outline-variant/20">
              {FOLDER_ICONS.map((opt: FolderIconOption) => {
                const IconComp = opt.icon;
                const isSelected = selectedIcon === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedIcon(opt.id)}
                    title={opt.label}
                    className={`w-10 h-10 flex items-center justify-center rounded-2xl transition-all mx-auto cursor-pointer ${
                      isSelected
                        ? 'bg-md3-primary text-md3-on-primary shadow-md scale-110 ring-2 ring-offset-2 ring-offset-md3-surface-container ring-md3-primary'
                        : 'text-md3-on-surface-variant hover:text-md3-on-surface hover:bg-md3-surface-container hover:scale-105'
                    }`}
                  >
                    <IconComp className="w-5 h-5" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Playlist Color Accent & Cover Color Extraction */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="block text-xs font-semibold text-md3-on-surface-variant">
                {language === 'ru' ? 'Цветовой акцент' : 'Color Accent'}
              </label>

              {/* Extract from Cover Art Button */}
              {extractedCoverColor && (
                <button
                  type="button"
                  onClick={() => setSelectedColor(extractedCoverColor)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-md3-surface border border-md3-outline-variant/30 hover:border-md3-primary/60 text-md3-on-surface transition-all cursor-pointer shadow-xs"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full ring-1 ring-black/20"
                    style={{ backgroundColor: extractedCoverColor }}
                  />
                  <Sparkles className="w-3 h-3 text-md3-primary" />
                  <span>{language === 'ru' ? 'Цвет по обложке' : 'From Cover'}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {playlistColors.map((col) => (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => setSelectedColor(col.hex)}
                  title={col.label}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 cursor-pointer ${col.bg} ${
                    selectedColor === col.hex ? 'ring-2 ring-offset-2 ring-offset-md3-surface-container ring-md3-primary scale-110' : ''
                  }`}
                >
                  {selectedColor === col.hex && (
                    <Check className="w-3.5 h-3.5 text-white" />
                  )}
                </button>
              ))}

              {/* Extracted Cover Color Swatch */}
              {extractedCoverColor && (
                <button
                  type="button"
                  onClick={() => setSelectedColor(extractedCoverColor)}
                  title={language === 'ru' ? `Из обложки (${extractedCoverColor})` : `From Cover (${extractedCoverColor})`}
                  style={{ backgroundColor: extractedCoverColor }}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 cursor-pointer shadow-sm relative ${
                    selectedColor === extractedCoverColor ? 'ring-2 ring-offset-2 ring-offset-md3-surface-container ring-md3-primary scale-110' : ''
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-white drop-shadow-md" />
                </button>
              )}

              {/* Custom Color Pipette Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => colorInputRef.current?.click()}
                  title={language === 'ru' ? 'Выбрать свой цвет' : 'Custom Color'}
                  className="w-7 h-7 rounded-full flex items-center justify-center bg-md3-surface-container-highest border border-md3-outline-variant/40 text-md3-on-surface-variant hover:text-md3-on-surface transition-transform hover:scale-110 cursor-pointer"
                >
                  <Pipette className="w-3.5 h-3.5" />
                </button>
                <input
                  ref={colorInputRef}
                  type="color"
                  value={selectedColor && selectedColor.startsWith('#') ? selectedColor : '#a855f7'}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className="sr-only"
                />
              </div>

              {selectedColor && !playlistColors.some(c => c.hex === selectedColor) && selectedColor !== extractedCoverColor && (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center ring-2 ring-offset-2 ring-offset-md3-surface-container ring-md3-primary scale-110 shadow-sm"
                  style={{ backgroundColor: selectedColor }}
                >
                  <Check className="w-3.5 h-3.5 text-white" />
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 mt-2 pt-3 border-t border-md3-outline-variant/15 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-xs font-semibold text-md3-on-surface-variant hover:bg-md3-surface-container-high transition-colors cursor-pointer"
            >
              {language === 'ru' ? 'Отмена' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-md3-primary text-md3-on-primary text-xs font-bold shadow-md hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{playlistToEdit ? (language === 'ru' ? 'Сохранить' : 'Save') : (language === 'ru' ? 'Создать' : 'Create')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
