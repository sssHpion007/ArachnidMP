import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from 'lucide-react';
import { AppLanguage } from '../i18n';
import { hexToHsv, hexToRgb, hsvToHex, normalizeHexColor, rgbToHex, HsvColor, RgbColor } from '../utils/hexColor';

interface PickerPosition {
  top: number;
  left: number;
}

type RgbChannel = keyof RgbColor;
type RgbDraft = Record<RgbChannel, string>;

interface HexColorInputProps {
  color: string;
  onChange: (color: string) => void;
  label: string;
  compact?: boolean;
  language?: AppLanguage;
}

const THEME_COLOR_TOKENS = [
  '--md-sys-color-primary-rgb',
  '--md-sys-color-on-primary-rgb',
  '--md-sys-color-primary-container-rgb',
  '--md-sys-color-on-primary-container-rgb',
  '--md-sys-color-surface-rgb',
  '--md-sys-color-on-surface-rgb',
  '--md-sys-color-surface-container-lowest-rgb',
  '--md-sys-color-surface-container-low-rgb',
  '--md-sys-color-surface-container-rgb',
  '--md-sys-color-surface-container-high-rgb',
  '--md-sys-color-surface-container-highest-rgb',
  '--md-sys-color-on-surface-variant-rgb',
  '--md-sys-color-outline-rgb',
  '--md-sys-color-outline-variant-rgb',
] as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const formatRgbDraft = (rgb: RgbColor): RgbDraft => ({
  r: String(rgb.r),
  g: String(rgb.g),
  b: String(rgb.b),
});

export const HexColorInput: React.FC<HexColorInputProps> = ({ color, onChange, label, compact = false, language = 'ru' }) => {
  const normalizedColor = normalizeHexColor(color) || '#ffffff';
  const [draft, setDraft] = useState(normalizedColor.toUpperCase());
  const [rgbDraft, setRgbDraft] = useState<RgbDraft>(() => formatRgbDraft(hexToRgb(normalizedColor)));
  const [hsv, setHsv] = useState<HsvColor>(() => hexToHsv(normalizedColor));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPosition, setPickerPosition] = useState<PickerPosition>({ top: 0, left: 0 });
  const pickerButtonRef = useRef<HTMLButtonElement>(null);
  const saturationValueRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(normalizedColor.toUpperCase());
    setRgbDraft(formatRgbDraft(hexToRgb(normalizedColor)));
    setHsv(hexToHsv(normalizedColor));
  }, [normalizedColor]);

  useEffect(() => {
    if (!pickerOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPickerOpen(false);
    };
    const closeOnViewportChange = () => setPickerOpen(false);
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', closeOnViewportChange);
    window.addEventListener('scroll', closeOnViewportChange, true);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', closeOnViewportChange);
      window.removeEventListener('scroll', closeOnViewportChange, true);
    };
  }, [pickerOpen]);

  const setFromHsv = (next: HsvColor) => {
    const safeNext = {
      h: ((next.h % 360) + 360) % 360,
      s: clamp(next.s, 0, 1),
      v: clamp(next.v, 0, 1),
    };
    const nextColor = hsvToHex(safeNext);
    setHsv(safeNext);
    setDraft(nextColor.toUpperCase());
    onChange(nextColor);
  };

  const commitDraft = () => {
    const nextColor = normalizeHexColor(draft);
    if (!nextColor) {
      setDraft(normalizedColor.toUpperCase());
      return;
    }
    setDraft(nextColor.toUpperCase());
    if (nextColor !== normalizedColor) onChange(nextColor);
  };

  const changeDraft = (nextDraft: string) => {
    setDraft(nextDraft);
    const digits = nextDraft.trim().replace(/^#/, '');
    if (digits.length !== 6) return;
    const nextColor = normalizeHexColor(nextDraft);
    if (nextColor) {
      setDraft(nextColor.toUpperCase());
      if (nextColor !== normalizedColor) onChange(nextColor);
    }
  };

  const commitRgbChannel = (channel: RgbChannel) => {
    const rawValue = rgbDraft[channel].trim();
    const parsedValue = Number(rawValue);
    if (!rawValue || !Number.isFinite(parsedValue)) {
      setRgbDraft(formatRgbDraft(hexToRgb(normalizedColor)));
      return;
    }
    const nextRgb: RgbColor = {
      ...hexToRgb(normalizedColor),
      [channel]: clamp(Math.round(parsedValue), 0, 255),
    };
    const nextColor = rgbToHex(nextRgb);
    setRgbDraft(formatRgbDraft(nextRgb));
    setDraft(nextColor.toUpperCase());
    if (nextColor !== normalizedColor) onChange(nextColor);
  };

  const openPicker = () => {
    const anchor = pickerButtonRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const panelWidth = 280;
    const panelHeight = 368;
    const left = clamp(rect.left, 12, Math.max(12, window.innerWidth - panelWidth - 12));
    const below = window.innerHeight - rect.bottom >= panelHeight + 12;
    const top = below
      ? rect.bottom + 8
      : clamp(rect.top - panelHeight - 8, 12, Math.max(12, window.innerHeight - panelHeight - 12));
    setPickerPosition({ top, left });
    setPickerOpen(true);
  };

  const updateSaturationValue = (event: React.PointerEvent<HTMLDivElement>) => {
    const element = saturationValueRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const saturation = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const value = 1 - clamp((event.clientY - rect.top) / rect.height, 0, 1);
    setFromHsv({ ...hsv, s: saturation, v: value });
  };

  const updateHue = (event: React.PointerEvent<HTMLDivElement>) => {
    const element = hueRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const hue = clamp((event.clientX - rect.left) / rect.width, 0, 1) * 360;
    setFromHsv({ ...hsv, h: hue });
  };

  const themeVariables = (): React.CSSProperties => {
    const anchor = pickerButtonRef.current;
    if (!anchor) return {};
    const computed = window.getComputedStyle(anchor);
    const variables: Record<string, string> = {};
    for (const token of THEME_COLOR_TOKENS) {
      const value = computed.getPropertyValue(token).trim();
      if (value) variables[token] = value;
    }
    return variables as React.CSSProperties;
  };

  const picker = pickerOpen && typeof document !== 'undefined' ? createPortal(
    <>
      <div
        className="fixed inset-0 z-[79]"
        onPointerDown={() => setPickerOpen(false)}
        aria-hidden="true"
      />
      <div
        ref={pickerRef}
        role="dialog"
        aria-label={label}
        className="fixed z-[80] w-[280px] select-none rounded-2xl border border-md3-outline-variant/30 bg-md3-surface-container-high/95 p-3.5 text-md3-on-surface shadow-2xl backdrop-blur-xl"
        style={{ top: pickerPosition.top, left: pickerPosition.left, ...themeVariables() }}
        onPointerDown={event => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="min-w-0">
            <div className="truncate text-xs font-bold text-md3-on-surface">{label}</div>
          </div>
          <button
            type="button"
            onClick={() => setPickerOpen(false)}
            className="ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-md3-on-surface-variant transition-colors hover:bg-md3-surface-container-highest hover:text-md3-on-surface"
            aria-label={language === 'ru' ? 'Закрыть выбор цвета' : 'Close color picker'}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div
          ref={saturationValueRef}
          role="slider"
          aria-label="Saturation and brightness"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(hsv.s * hsv.v * 100)}
          tabIndex={0}
          className="relative h-36 touch-none cursor-crosshair overflow-hidden rounded-xl border border-black/10"
          style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)` }}
          onPointerDown={event => {
            event.currentTarget.setPointerCapture(event.pointerId);
            updateSaturationValue(event);
          }}
          onPointerMove={event => {
            if (event.buttons === 1) updateSaturationValue(event);
          }}
          onKeyDown={event => {
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
            event.preventDefault();
            const step = event.shiftKey ? 0.1 : 0.02;
            setFromHsv({
              ...hsv,
              s: clamp(hsv.s + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0), 0, 1),
              v: clamp(hsv.v + (event.key === 'ArrowUp' ? step : event.key === 'ArrowDown' ? -step : 0), 0, 1),
            });
          }}
        >
          <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(to right, #fff, transparent)' }} />
          <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(to top, #000, transparent)' }} />
          <span
            className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_1px_5px_rgba(0,0,0,0.75)]"
            style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: hsvToHex(hsv) }}
          />
        </div>

        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold text-md3-on-surface-variant">
            <span>HUE</span>
            <span>{Math.round(hsv.h)}°</span>
          </div>
          <div
            ref={hueRef}
            role="slider"
            aria-label="Hue"
            aria-valuemin={0}
            aria-valuemax={360}
            aria-valuenow={Math.round(hsv.h)}
            tabIndex={0}
            className="relative h-3 touch-none cursor-pointer rounded-full border border-black/15"
            style={{ background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}
            onPointerDown={event => {
              event.currentTarget.setPointerCapture(event.pointerId);
              updateHue(event);
            }}
            onPointerMove={event => {
              if (event.buttons === 1) updateHue(event);
            }}
            onKeyDown={event => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
              event.preventDefault();
              setFromHsv({ ...hsv, h: hsv.h + (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 10 : 1) });
            }}
          >
            <span
              className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_1px_4px_rgba(0,0,0,0.7)]"
              style={{ left: `${(hsv.h / 360) * 100}%`, backgroundColor: hsvToHex({ h: hsv.h, s: 1, v: 1 }) }}
            />
          </div>
        </div>

        <div className="mt-3">
          <div className="grid grid-cols-3 gap-1.5">
            {(['r', 'g', 'b'] as const).map(channel => (
              <label key={channel} className="flex h-9 min-w-0 items-center gap-1.5 rounded-lg border border-md3-outline-variant/25 bg-md3-surface px-2 focus-within:border-md3-primary">
                <span className="text-[9px] font-bold uppercase text-md3-on-surface-variant/70">{channel}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={3}
                  value={rgbDraft[channel]}
                  onChange={event => setRgbDraft(current => ({ ...current, [channel]: event.target.value.replace(/\D/g, '').slice(0, 3) }))}
                  onBlur={() => commitRgbChannel(channel)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      event.currentTarget.blur();
                    } else if (event.key === 'Escape') {
                      setRgbDraft(formatRgbDraft(hexToRgb(normalizedColor)));
                      event.currentTarget.blur();
                    }
                  }}
                  aria-label={`${label} RGB ${channel.toUpperCase()}`}
                  className="w-full min-w-0 bg-transparent font-mono text-xs font-semibold text-md3-on-surface"
                />
              </label>
            ))}
          </div>
        </div>

        <div className="mt-2.5 flex items-center gap-2">
          <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border border-md3-outline-variant/25 bg-md3-surface px-2.5 focus-within:border-md3-primary">
            <span className="select-none text-[9px] font-bold tracking-wider text-md3-on-surface-variant/70">HEX</span>
            <input
              type="text"
              value={draft}
              onChange={event => changeDraft(event.target.value)}
              onBlur={commitDraft}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  event.currentTarget.blur();
                } else if (event.key === 'Escape') {
                  setDraft(normalizedColor.toUpperCase());
                  event.currentTarget.blur();
                }
              }}
              aria-label={`${label} HEX`}
              autoComplete="off"
              spellCheck={false}
              maxLength={7}
              placeholder="#8B5CF6"
              className="w-full min-w-0 bg-transparent font-mono text-xs font-bold uppercase tracking-wide text-md3-on-surface"
            />
          </label>
          <button
            type="button"
            onClick={() => setPickerOpen(false)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-md3-primary text-md3-on-primary shadow-sm transition-transform hover:scale-105"
            aria-label={language === 'ru' ? 'Применить цвет' : 'Apply selected color'}
            title={language === 'ru' ? 'Применить цвет' : 'Apply color'}
          >
            <Check className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>,
    document.body,
  ) : null;

  const sizeClass = compact ? 'h-8' : 'h-10';
  const swatchClass = compact ? 'h-8 w-8 rounded-lg' : 'h-10 w-10 rounded-xl';

  return (
    <div className="inline-flex shrink-0 items-center gap-2">
      <button
        ref={pickerButtonRef}
        type="button"
        onClick={() => pickerOpen ? setPickerOpen(false) : openPicker()}
        className={`relative flex ${swatchClass} cursor-pointer items-center justify-center overflow-hidden border border-md3-outline-variant/30 shadow-sm transition-transform hover:scale-105 active:scale-95`}
        style={{ backgroundColor: normalizedColor }}
        title={label}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={pickerOpen}
      >
        <span className="pointer-events-none h-3 w-3 rounded-full border border-white/50 bg-white/15 shadow-inner" />
      </button>

      <label className={`flex ${sizeClass} min-w-0 items-center gap-2 rounded-xl border border-md3-outline-variant/25 bg-md3-surface px-2.5 transition-colors focus-within:border-md3-primary focus-within:ring-2 focus-within:ring-md3-primary/15`}>
        <span className="select-none text-[9px] font-bold tracking-wider text-md3-on-surface-variant/70">HEX</span>
        <input
          type="text"
          value={draft}
          onChange={event => changeDraft(event.target.value)}
          onBlur={commitDraft}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            } else if (event.key === 'Escape') {
              setDraft(normalizedColor.toUpperCase());
              event.currentTarget.blur();
            }
          }}
          aria-label={`${label} HEX`}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={7}
          placeholder="#8B5CF6"
          className={`w-[5.5rem] bg-transparent font-mono font-semibold uppercase tracking-wide text-md3-on-surface outline-none ${compact ? 'text-[11px]' : 'text-xs'}`}
        />
      </label>

      {picker}
    </div>
  );
};

