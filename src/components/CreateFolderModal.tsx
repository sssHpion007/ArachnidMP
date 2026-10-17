import React, { useState, useEffect, useRef } from 'react';
import { FolderPlus, X, Check, Folder, Image, LayoutGrid, Images, Sparkles, Pipette, Ban } from 'lucide-react';
import { FOLDER_ICONS, FolderIconOption } from '../theme/folderIcons';
import { PlaylistFolder, FolderCoverType } from '../types/music';
import { extractDominantColor } from '../theme/material3';
import { AppLanguage } from '../i18n';
import { useModalAnimation } from '../utils/useModalAnimation';

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, color?: string, icon?: string, coverType?: FolderCoverType) => void;
  parentFolderName?: string;
  folderToEdit?: PlaylistFolder | null;
  initialCoverArt?: string | null;
  language?: AppLanguage;
}

const getFolderColors = (lang: AppLanguage) => [
  { id: 'default', label: lang === 'ru' ? 'По умолчанию' : 'Default', bg: 'bg-md3-primary', hex: '' },
  { id: 'amber', label: lang === 'ru' ? 'Янтарный' : 'Amber', bg: 'bg-amber-500', hex: '#f59e0b' },
  { id: 'emerald', label: lang === 'ru' ? 'Изумрудный' : 'Emerald', bg: 'bg-emerald-500', hex: '#10b981' },
  { id: 'indigo', label: lang === 'ru' ? 'Индиго' : 'Indigo', bg: 'bg-indigo-500', hex: '#6366f1' },
  { id: 'purple', label: lang === 'ru' ? 'Пурпурный' : 'Purple', bg: 'bg-purple-500', hex: '#a855f7' },
  { id: 'rose', label: lang === 'ru' ? 'Розовый' : 'Rose', bg: 'bg-rose-500', hex: '#f43f5e' },
  { id: 'cyan', label: lang === 'ru' ? 'Бирюзовый' : 'Cyan', bg: 'bg-cyan-500', hex: '#06b6d4' },
];

export const CreateFolderModal: React.FC<CreateFolderModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  parentFolderName,
  folderToEdit,
  initialCoverArt,
  language = 'ru',
}) => {
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('');
  const [coverType, setCoverType] = useState<FolderCoverType>('icon');
  const [extractedCoverColor, setExtractedCoverColor] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  // Segmented control indicator state for Folder Cover Display
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

  const folderColors = getFolderColors(language);

  useEffect(() => {
    if (isOpen) {
      if (folderToEdit) {
        setName(folderToEdit.name);
        setSelectedColor(folderToEdit.color || '');
        setSelectedIcon(folderToEdit.icon || '');
        setCoverType(folderToEdit.coverType || 'icon');
      } else {
        setName('');
        setSelectedColor('');
        setSelectedIcon('');
        setCoverType('icon');
      }
      setTimeout(() => {
        inputRef.current?.focus();
        if (folderToEdit) inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, folderToEdit]);

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

  const { isRendered, backdropClass, dialogClass } = useModalAnimation(isOpen, 200);

  if (!isRendered) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) return;
    onCreate(
      name.trim(),
      selectedColor || undefined,
      (selectedIcon && selectedIcon !== 'none' ? selectedIcon : undefined),
      coverType
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
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-md3-on-surface leading-tight">
                {folderToEdit 
                  ? (language === 'ru' ? 'Настройки папки' : 'Folder Settings') 
                  : parentFolderName 
                  ? (language === 'ru' ? 'Новая подпапка' : 'New Subfolder') 
                  : (language === 'ru' ? 'Новая папка' : 'New Folder')}
              </h2>
              <p className="text-xs text-md3-on-surface-variant mt-0.5 truncate max-w-[280px]">
                {folderToEdit 
                  ? (language === 'ru' ? 'Измените имя, обложку, значок и цвет' : 'Change folder name, cover style, icon and color') 
                  : parentFolderName 
                  ? (language === 'ru' ? `Внутри «${parentFolderName}»` : `Inside "${parentFolderName}"`) 
                  : (language === 'ru' ? 'Организуйте плейлисты по категориям' : 'Organize playlists into categories')}
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
              {language === 'ru' ? 'Название папки' : 'Folder Name'} <span className="text-md3-error">*</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={language === 'ru' ? 'Например: Саундтреки из игр, Рок, Для работы...' : 'E.g.: Game Soundtracks, Rock, Work Focus...'}
              maxLength={60}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-md3-surface-container-highest border border-md3-outline-variant/30 text-md3-on-surface placeholder:text-md3-on-surface-variant/50 text-sm focus:outline-none focus:border-md3-primary transition-colors"
            />
          </div>

          {/* Folder Cover Display Style - Unified Segmented Control with Sliding Glow Pill */}
          <div>
            <label className="block text-xs font-semibold text-md3-on-surface-variant mb-1.5">
              {language === 'ru' ? 'Отображение обложки' : 'Folder Cover Display'}
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

              {/* 1. Icon */}
              <button
                ref={(el) => { coverTypeRefs.current['icon'] = el; }}
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setCoverType('icon')}
                className={`relative z-10 flex-1 py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 text-xs transition-colors duration-200 cursor-pointer outline-none focus:outline-none ${
                  coverType === 'icon'
                    ? 'text-md3-on-primary font-bold'
                    : 'text-md3-on-surface-variant hover:text-md3-on-surface font-medium'
                }`}
              >
                <Folder className="w-4 h-4 shrink-0" />
                <span className="truncate">{language === 'ru' ? 'Иконка' : 'Icon'}</span>
              </button>

              {/* 2. First Playlist */}
              <button
                ref={(el) => { coverTypeRefs.current['first_playlist'] = el; }}
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setCoverType('first_playlist')}
                className={`relative z-10 flex-1 py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 text-xs transition-colors duration-200 cursor-pointer outline-none focus:outline-none ${
                  coverType === 'first_playlist'
                    ? 'text-md3-on-primary font-bold'
                    : 'text-md3-on-surface-variant hover:text-md3-on-surface font-medium'
                }`}
              >
                <Image className="w-4 h-4 shrink-0" />
                <span className="truncate">{language === 'ru' ? 'Первый' : 'First'}</span>
              </button>

              {/* 3. Collage 2x2 */}
              <button
                ref={(el) => { coverTypeRefs.current['collage'] = el; }}
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setCoverType('collage')}
                className={`relative z-10 flex-1 py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 text-xs transition-colors duration-200 cursor-pointer outline-none focus:outline-none ${
                  coverType === 'collage'
                    ? 'text-md3-on-primary font-bold'
                    : 'text-md3-on-surface-variant hover:text-md3-on-surface font-medium'
                }`}
              >
                <LayoutGrid className="w-4 h-4 shrink-0" />
                <span className="truncate">{language === 'ru' ? 'Коллаж' : 'Collage'}</span>
              </button>

              {/* 4. Slideshow / Cycle */}
              <button
                ref={(el) => { coverTypeRefs.current['cycle'] = el; }}
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setCoverType('cycle')}
                className={`relative z-10 flex-1 py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 text-xs transition-colors duration-200 cursor-pointer outline-none focus:outline-none ${
                  coverType === 'cycle'
                    ? 'text-md3-on-primary font-bold'
                    : 'text-md3-on-surface-variant hover:text-md3-on-surface font-medium'
                }`}
              >
                <Images className="w-4 h-4 shrink-0" />
                <span className="truncate">{language === 'ru' ? 'Слайд-шоу' : 'Slideshow'}</span>
              </button>
            </div>

            {/* Hint text */}
            <p className="text-[11px] text-md3-on-surface-variant/80 mt-1.5 px-0.5">
              {coverType === 'icon' && (language === 'ru' ? 'Отображается цветная иконка папки.' : 'Displays the colored folder icon.')}
              {coverType === 'first_playlist' && (language === 'ru' ? 'Отображается обложка первого плейлиста в папке (или иконка, если папка пуста).' : 'Displays the cover of the first playlist in the folder.')}
              {coverType === 'collage' && (language === 'ru' ? 'Отображается коллаж 2×2 из обложек плейлистов папки.' : 'Displays a 2×2 collage of the folder playlist covers.')}
              {coverType === 'cycle' && (language === 'ru' ? 'Обложки плейлистов папки плавно сменяются каждые пару секунд.' : 'Folder playlist covers smoothly cycle every couple seconds.')}
            </p>
          </div>

          {/* Folder Icon Picker */}
          <div>
            <label className="block text-xs font-semibold text-md3-on-surface-variant mb-2">
              {coverType === 'icon' 
                ? (language === 'ru' ? 'Иконка папки' : 'Folder Icon') 
                : (language === 'ru' ? 'Иконка (резервная для пустой папки)' : 'Fallback Icon (if empty)')}
            </label>
            <div className="grid grid-cols-6 sm:grid-cols-9 gap-2 bg-md3-surface-container-highest/60 p-3 rounded-2xl border border-md3-outline-variant/20">
              {/* Option: No Icon */}
              <button
                type="button"
                onClick={() => setSelectedIcon('')}
                title={language === 'ru' ? 'Без иконки' : 'No icon'}
                className={`w-10 h-10 flex items-center justify-center rounded-2xl transition-all mx-auto cursor-pointer ${
                  !selectedIcon || selectedIcon === 'none'
                    ? 'bg-md3-primary text-md3-on-primary shadow-md scale-110 ring-2 ring-offset-2 ring-offset-md3-surface-container ring-md3-primary'
                    : 'text-md3-on-surface-variant/60 hover:text-md3-on-surface hover:bg-md3-surface-container hover:scale-105 border border-dashed border-md3-outline-variant/40'
                }`}
              >
                <Ban className="w-4 h-4" />
              </button>

              {FOLDER_ICONS.map((opt: FolderIconOption) => {
                const IconComp = opt.icon;
                const isSelected = selectedIcon === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedIcon(prev => prev === opt.id ? '' : opt.id)}
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

          {/* Folder Color Accent */}
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
              {folderColors.map((col) => (
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

              {selectedColor && !folderColors.some(c => c.hex === selectedColor) && selectedColor !== extractedCoverColor && (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center ring-2 ring-offset-2 ring-offset-md3-surface-container ring-md3-primary scale-110 shadow-sm"
                  style={{ backgroundColor: selectedColor }}
                >
                  <Check className="w-3.5 h-3.5 text-white" />
                </div>
              )}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2.5 mt-2 pt-3 border-t border-md3-outline-variant/15 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-xs font-medium text-md3-on-surface-variant hover:text-md3-on-surface hover:bg-md3-surface-container-highest transition-colors cursor-pointer"
            >
              {language === 'ru' ? 'Отмена' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex items-center gap-2 px-5 py-2 rounded-full bg-md3-primary text-md3-on-primary text-xs font-semibold hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:pointer-events-none shadow-md transition-all cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{folderToEdit ? (language === 'ru' ? 'Сохранить' : 'Save') : (language === 'ru' ? 'Создать' : 'Create')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
