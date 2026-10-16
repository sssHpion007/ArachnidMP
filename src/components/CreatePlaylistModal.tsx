import React, { useState, useEffect, useRef } from 'react';
import { ListMusic, X, Check, Image, LayoutGrid, Images } from 'lucide-react';
import { FolderCoverType } from '../types/music';
import { AppLanguage } from '../i18n';
import { useModalAnimation } from '../utils/useModalAnimation';

interface CreatePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, description?: string, coverType?: FolderCoverType) => void;
  folderName?: string;
  language?: AppLanguage;
}

export const CreatePlaylistModal: React.FC<CreatePlaylistModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  folderName,
  language = 'ru',
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverType, setCoverType] = useState<FolderCoverType>('first_playlist');
  const inputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setCoverType('first_playlist');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

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
    onCreate(name.trim(), description.trim() || undefined, coverType);
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
              <ListMusic className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-md3-on-surface leading-tight">
                {language === 'ru' ? 'Новый плейлист' : 'New Playlist'}
              </h2>
              <p className="text-xs text-md3-on-surface-variant mt-0.5 truncate max-w-[240px]">
                {folderName 
                  ? (language === 'ru' ? `Внутри папки «${folderName}»` : `Inside folder "${folderName}"`)
                  : (language === 'ru' ? 'Создайте подборку для избранных треков' : 'Create a collection for your favorite tracks')
                }
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
              className="w-full px-4 py-2.5 rounded-2xl bg-md3-surface text-sm text-md3-on-surface placeholder-md3-on-surface-variant/40 border border-md3-outline-variant/20 focus:border-md3-primary outline-none transition-all shadow-inner"
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
              className="w-full px-4 py-2.5 rounded-2xl bg-md3-surface text-sm text-md3-on-surface placeholder-md3-on-surface-variant/40 border border-md3-outline-variant/20 focus:border-md3-primary outline-none transition-all resize-none shadow-inner"
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
                className={`relative z-10 flex-1 py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 text-xs transition-colors duration-200 cursor-pointer outline-none focus:outline-none ${
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
                className={`relative z-10 flex-1 py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 text-xs transition-colors duration-200 cursor-pointer outline-none focus:outline-none ${
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
              {coverType === 'first_playlist' && (language === 'ru' ? 'Отображается обложка первого трека плейлиста.' : 'Displays the artwork of the first track.')}
              {coverType === 'collage' && (language === 'ru' ? 'Отображается коллаж 2×2 из обложек треков.' : 'Displays a 2×2 collage of track artworks.')}
              {coverType === 'cycle' && (language === 'ru' ? 'Обложки треков плавно сменяются каждые пару секунд.' : 'Track covers smoothly cycle every couple seconds.')}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
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
              <span>{language === 'ru' ? 'Создать' : 'Create'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
