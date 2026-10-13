import React, { useEffect, useRef } from 'react';
import { Palette, X, RotateCcw, Check, SlidersHorizontal } from 'lucide-react';
import { CustomThemeInfo, ThemePaletteItem } from '../types/theme';
import { AppLanguage, getTranslations } from '../i18n';
import { useModalAnimation } from '../utils/useModalAnimation';

interface ThemePaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: CustomThemeInfo | null;
  paletteColors: Record<string, string>;
  onUpdateColor: (itemId: string, hex: string) => void;
  onResetAll: () => void;
  language: AppLanguage;
}

export const ThemePaletteModal: React.FC<ThemePaletteModalProps> = ({
  isOpen,
  onClose,
  theme,
  paletteColors,
  onUpdateColor,
  onResetAll,
  language,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const t = getTranslations(language);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const { isRendered, isVisible } = useModalAnimation(isOpen && !!theme, 200);

  if (!isRendered || !theme) return null;

  return (
    <div
      className={`fixed inset-0 z-[60] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 transition-opacity duration-200 ease-out select-none cursor-pointer ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      onClick={(e) => {
        if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className={`max-w-xl w-full max-h-[85vh] rounded-3xl bg-md3-surface border border-md3-outline-variant/30 shadow-2xl flex flex-col overflow-hidden cursor-default transition-all duration-200 ease-out ${
          isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-3'
        }`}
      >
        {/* Header */}
        <div className="p-5 border-b border-md3-outline-variant/15 flex items-center justify-between shrink-0 bg-md3-surface-container-low">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-md3-primary/15 text-md3-primary flex items-center justify-center shadow-xs">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-md3-on-surface">
                  {language === 'ru' ? 'Палитра элементов темы' : 'Theme Palette Customization'}
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-md3-primary/10 text-md3-primary font-semibold">
                  {theme.name}
                </span>
              </div>
              <p className="text-xs text-md3-on-surface-variant mt-0.5">
                {language === 'ru'
                  ? 'Настройте индивидуальные цвета элементов оформления интерфейса'
                  : 'Customize individual interface colors for this theme'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-md3-surface hover:bg-md3-surface-container-high text-md3-on-surface-variant hover:text-md3-on-surface flex items-center justify-center transition-colors cursor-pointer"
            title={language === 'ru' ? 'Закрыть' : 'Close'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content: List of customizable palette items */}
        <div className="p-5 overflow-y-auto space-y-3 custom-scrollbar flex-1">
          {theme.palette && theme.palette.length > 0 ? (
            theme.palette.map((item: ThemePaletteItem) => {
              const currentColor = (paletteColors[item.id] || item.default || '#ffffff').toLowerCase();
              const isDefault = currentColor === item.default.toLowerCase();

              return (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl bg-md3-surface-container-low border border-md3-outline-variant/20 flex items-center justify-between gap-4 hover:border-md3-outline-variant/40 transition-colors"
                >
                  {/* Left: Info */}
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-md3-on-surface">
                        {item.label}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-md3-surface text-md3-on-surface-variant/70 border border-md3-outline-variant/10">
                        {item.cssVar}
                      </span>
                    </div>
                    {item.description && (
                      <p className="text-[11px] text-md3-on-surface-variant">
                        {item.description}
                      </p>
                    )}
                  </div>

                  {/* Right: Color Controls */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    {/* Reset button for single color */}
                    {!isDefault && (
                      <button
                        tabIndex={-1}
                        onClick={() => onUpdateColor(item.id, item.default)}
                        className="w-7 h-7 rounded-xl bg-md3-surface hover:bg-md3-surface-container-high text-md3-on-surface-variant hover:text-md3-primary flex items-center justify-center transition-colors cursor-pointer border border-md3-outline-variant/20"
                        title={language === 'ru' ? 'Сбросить к исходному цвету темы' : 'Reset to theme default'}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* HEX string display / input */}
                    <div className="flex items-center bg-md3-surface rounded-xl border border-md3-outline-variant/25 px-2 py-1 text-xs font-mono font-semibold text-md3-on-surface">
                      {currentColor.toUpperCase()}
                    </div>

                    {/* Interactive color picker button */}
                    <label
                      className="relative w-8 h-8 rounded-xl shadow-sm border border-white/20 cursor-pointer overflow-hidden flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                      style={{ backgroundColor: currentColor }}
                      title={language === 'ru' ? 'Выбрать цвет' : 'Pick color'}
                    >
                      <input
                        type="color"
                        value={currentColor}
                        onChange={(e) => onUpdateColor(item.id, e.target.value)}
                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                      />
                    </label>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-xs text-md3-on-surface-variant">
              {language === 'ru'
                ? 'В манифесте theme.json этой темы не определены настраиваемые элементы палитры.'
                : 'No customizable palette items defined in theme.json for this theme.'}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-md3-outline-variant/15 flex items-center justify-between shrink-0 bg-md3-surface-container-low">
          <button
            onClick={onResetAll}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-md3-surface hover:bg-md3-surface-container-high text-xs font-semibold text-md3-on-surface-variant hover:text-md3-primary border border-md3-outline-variant/20 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{language === 'ru' ? 'Сбросить все цвета' : 'Reset All Colors'}</span>
          </button>

          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-md3-primary text-md3-on-primary text-xs font-bold shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{language === 'ru' ? 'Готово' : 'Done'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
