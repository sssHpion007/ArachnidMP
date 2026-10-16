import React, { useState, useEffect, useRef } from 'react';
import { Edit3, X, Check, Folder, Image, LayoutGrid, Images } from 'lucide-react';
import { FolderCoverType } from '../types/music';
import { AppLanguage } from '../i18n';
import { useModalAnimation } from '../utils/useModalAnimation';

interface RenameItemModalProps {
  isOpen: boolean;
  type: 'playlist' | 'folder' | 'group';
  initialName: string;
  initialDescription?: string;
  initialCoverType?: FolderCoverType;
  language?: AppLanguage;
  onClose: () => void;
  onRename: (newName: string, newDescription?: string, newCoverType?: FolderCoverType) => void;
}

export const RenameItemModal: React.FC<RenameItemModalProps> = ({
  isOpen,
  type,
  initialName,
  initialDescription = '',
  initialCoverType,
  language = 'ru',
  onClose,
  onRename,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverType, setCoverType] = useState<FolderCoverType>(initialCoverType || (type === 'folder' ? 'icon' : 'first_playlist'));
  const inputRef = useRef<HTMLInputElement>(null);

  // Segmented control indicator state for Cover Display
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

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setDescription(initialDescription || '');
      setCoverType(initialCoverType || (type === 'folder' ? 'icon' : 'first_playlist'));
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, initialName, initialDescription, initialCoverType, type]);

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

  const typeLabels = {
    playlist: { 
      title: language === 'ru' ? 'Редактировать плейлист' : 'Edit Playlist', 
      desc: language === 'ru' ? 'Название, описание и отображение обложки' : 'Name, description and cover style' 
    },
    folder: { 
      title: language === 'ru' ? 'Редактировать папку' : 'Edit Folder', 
      desc: language === 'ru' ? 'Название и отображение обложки папки' : 'Name and cover display style' 
    },
    group: { 
      title: language === 'ru' ? 'Переименовать группу' : 'Rename Group', 
      desc: language === 'ru' ? 'Введите новое имя для группы' : 'Enter a new name for the group' 
    },
  };

  const currentLabel = typeLabels[type] || typeLabels.playlist;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) return;
    onRename(
      name.trim(), 
      type === 'playlist' ? description.trim() : undefined,
      type === 'playlist' || type === 'folder' ? coverType : undefined
    );
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md select-none cursor-pointer ${backdropClass}`}
    >
      <div
        className={`w-full max-w-md bg-md3-surface-container rounded-3xl shadow-2xl border border-md3-outline-variant/20 overflow-hidden flex flex-col cursor-default ${dialogClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 pb-4 border-b border-md3-outline-variant/15 flex items-center justify-between bg-md3-surface-container-high/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-md3-primary/15 text-md3-primary flex items-center justify-center shadow-sm">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-md3-on-surface leading-tight">
                {currentLabel.title}
              </h2>
              <p className="text-xs text-md3-on-surface-variant mt-0.5">
                {currentLabel.desc}
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
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-md3-on-surface-variant mb-1.5">
              {language === 'ru' ? 'Новое название' : 'New Name'} <span className="text-md3-error">*</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={language === 'ru' ? 'Название...' : 'Name...'}
              maxLength={60}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-md3-surface-container-highest border border-md3-outline-variant/30 text-md3-on-surface placeholder:text-md3-on-surface-variant/50 text-sm focus:outline-none focus:border-md3-primary transition-colors"
            />
          </div>

          {type === 'playlist' && (
            <div>
              <label className="block text-xs font-semibold text-md3-on-surface-variant mb-1.5">
                {language === 'ru' ? 'Описание (необязательно)' : 'Description (optional)'}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={language === 'ru' ? 'Добавьте описание плейлиста...' : 'Add playlist description...'}
                rows={3}
                maxLength={300}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-md3-surface-container-highest border border-md3-outline-variant/30 text-md3-on-surface placeholder:text-md3-on-surface-variant/50 text-sm focus:outline-none focus:border-md3-primary transition-colors resize-none"
              />
            </div>
          )}

          {/* Cover Display Style for Folders & Playlists */}
          {(type === 'playlist' || type === 'folder') && (
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

                {type === 'folder' && (
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
                )}

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
                  <span className="truncate">{type === 'folder' ? (language === 'ru' ? 'Первый' : 'First') : (language === 'ru' ? 'Первый трек' : 'First Track')}</span>
                </button>

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

              <p className="text-[11px] text-md3-on-surface-variant/80 mt-1.5 px-0.5">
                {coverType === 'icon' && (language === 'ru' ? 'Отображается цветная иконка папки.' : 'Displays the colored folder icon.')}
                {coverType === 'first_playlist' && (language === 'ru' ? (type === 'folder' ? 'Отображается обложка первого плейлиста в папке.' : 'Отображается обложка первого трека.') : (type === 'folder' ? 'Displays the cover of the first playlist.' : 'Displays first track cover.'))}
                {coverType === 'collage' && (language === 'ru' ? 'Отображается коллаж 2×2 из доступных обложек.' : 'Displays a 2×2 collage of covers.')}
                {coverType === 'cycle' && (language === 'ru' ? 'Обложки плавно сменяются каждые пару секунд.' : 'Covers smoothly cycle every couple seconds.')}
              </p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2.5 mt-2 pt-3 border-t border-md3-outline-variant/15">
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
              <span>{language === 'ru' ? 'Сохранить' : 'Save'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
