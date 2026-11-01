import React, { useEffect, useRef } from 'react';
import { Palette, X, RotateCcw, Check, SlidersHorizontal } from 'lucide-react';
import { CustomThemeInfo, ThemePaletteItem } from '../types/theme';
import { AppLanguage, getTranslations } from '../i18n';
import { useModalAnimation } from '../utils/useModalAnimation';
import { hexToRgbString } from '../theme/material3';
import { normalizeHexColor } from '../utils/hexColor';
import { HexColorInput } from './HexColorInput';

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
      if (e.key === 'Escape' && e.target instanceof Element && e.target.closest('[data-hex-color-picker]')) return;
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const cachedThemeRef = useRef<CustomThemeInfo | null>(theme);
  if (theme) {
    cachedThemeRef.current = theme;
  }
  const activeTheme = theme || cachedThemeRef.current;

  const { isRendered, backdropClass, dialogClass } = useModalAnimation(isOpen && !!activeTheme, 200);

  if (!isRendered || !activeTheme) return null;
  const themeData = activeTheme;
  const themePaletteVariables = {} as React.CSSProperties;
  const themePaletteVariableMap = themePaletteVariables as Record<string, string>;
  for (const item of themeData.palette || []) {
    if (!item.cssVar.startsWith('--md-sys-color-')) continue;
    const color = normalizeHexColor(paletteColors[item.id] || item.default);
    if (!color) continue;
    themePaletteVariableMap[item.cssVar] = color;
    if (!item.cssVar.endsWith('-rgb')) {
      themePaletteVariableMap[`${item.cssVar}-rgb`] = hexToRgbString(color);
    }
  }

  return (
    <div
      className={`fixed inset-0 z-[60] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 select-none cursor-default ${backdropClass}`}
      onClick={(e) => {
        if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        style={themePaletteVariables}
        className={`max-w-2xl w-full max-h-[88vh] rounded-3xl bg-md3-surface border border-md3-outline-variant/30 shadow-2xl flex flex-col overflow-hidden cursor-default ${dialogClass}`}
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
                  {themeData.name}
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

        <div className="mx-5 mt-4 flex items-center justify-between gap-4 rounded-2xl border border-md3-outline-variant/20 bg-md3-surface-container-low px-4 py-3">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-md3-primary">
              {language === 'ru' ? 'Предпросмотр палитры' : 'Palette preview'}
            </div>
            <p className="mt-1 text-[11px] text-md3-on-surface-variant">
              {language === 'ru' ? 'Вставьте HEX-код — цвет применится сразу.' : 'Paste a HEX value; the color applies immediately.'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {themeData.palette.slice(0, 6).map(item => {
              const color = (paletteColors[item.id] || item.default || '#ffffff').toLowerCase();
              return (
                <span
                  key={item.id}
                  className="h-7 w-7 rounded-lg border border-white/15 shadow-sm"
                  style={{ backgroundColor: color }}
                  title={`${item.label}: ${color.toUpperCase()}`}
                />
              );
            })}
          </div>
        </div>

        {/* Content: List of customizable palette items */}
        <div className="space-y-3 overflow-y-auto p-5 custom-scrollbar flex-1">
          {theme.palette && theme.palette.length > 0 ? (
            theme.palette.map((item: ThemePaletteItem) => {
              const currentColor = (paletteColors[item.id] || item.default || '#ffffff').toLowerCase();
              const isDefault = currentColor === item.default.toLowerCase();

              return (
                <div
                  key={item.id}
                  className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] items-center gap-3.5 rounded-2xl border border-l-4 border-md3-outline-variant/20 bg-md3-surface-container-low p-3.5 transition-colors hover:border-md3-outline-variant/40"
                  style={{ borderLeftColor: currentColor }}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="h-10 w-10 shrink-0 rounded-xl border border-white/15 shadow-inner"
                      style={{ backgroundColor: currentColor }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-md3-on-surface">{item.label}</span>
                        <code className="max-w-full truncate rounded-md border border-md3-outline-variant/10 bg-md3-surface px-1.5 py-0.5 font-mono text-[10px] text-md3-on-surface-variant/70">
                          {item.cssVar}
                        </code>
                      </div>
                      {item.description && (
                        <p className="text-[11px] text-md3-on-surface-variant">{item.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                    <HexColorInput
                      color={currentColor}
                      onChange={hex => onUpdateColor(item.id, hex)}
                      label={language === 'ru' ? `Цвет: ${item.label}` : `${item.label} color`}
                      showHexInput={false}
                      language={language}
                    />
                    {!isDefault && (
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => onUpdateColor(item.id, item.default)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-md3-outline-variant/20 bg-md3-surface text-md3-on-surface-variant transition-colors hover:bg-md3-surface-container-high hover:text-md3-primary cursor-pointer"
                        title={language === 'ru' ? 'Сбросить к исходному цвету темы' : 'Reset to theme default'}
                        aria-label={language === 'ru' ? `Сбросить цвет: ${item.label}` : `Reset ${item.label} color`}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    )}
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
