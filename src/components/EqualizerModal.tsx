import React, { useState, useEffect, useRef } from 'react';
import { X, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { EQ_FREQUENCIES, EQ_PRESETS, audioEngine } from '../services/audioEngine';
import { AppLanguage } from '../i18n';

interface EqualizerModalProps {
  isOpen: boolean;
  language?: AppLanguage;
  onClose: () => void;
}

// Custom hook to support smooth touch/mouse drag-to-scroll without visible scrollbars
const useDragScroll = () => {
  const ref = useRef<HTMLDivElement>(null);
  const isDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasMovedRef = useRef(false);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !ref.current) return;
    const target = e.target as HTMLElement;
    // Let range sliders handle their own input
    if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'range') {
      return;
    }
    isDownRef.current = true;
    hasMovedRef.current = false;
    startXRef.current = e.clientX;
    scrollLeftRef.current = ref.current.scrollLeft;
    try {
      ref.current.setPointerCapture(e.pointerId);
    } catch (_) {}
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDownRef.current || !ref.current) return;
    const dx = e.clientX - startXRef.current;
    if (Math.abs(dx) > 3) {
      hasMovedRef.current = true;
    }
    ref.current.scrollLeft = scrollLeftRef.current - dx;
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDownRef.current) return;
    isDownRef.current = false;
    try {
      ref.current?.releasePointerCapture(e.pointerId);
    } catch (_) {}
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    isDownRef.current = false;
    try {
      ref.current?.releasePointerCapture(e.pointerId);
    } catch (_) {}
  };

  const onClickCapture = (e: React.MouseEvent) => {
    // If the user was dragging to scroll, prevent triggering child clicks
    if (hasMovedRef.current) {
      e.stopPropagation();
      e.preventDefault();
      hasMovedRef.current = false;
    }
  };

  return {
    ref,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onClickCapture,
  };
};

export const EqualizerModal: React.FC<EqualizerModalProps> = ({ 
  isOpen, 
  language = 'ru',
  onClose 
}) => {
  const [eqValues, setEqValues] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const [activePreset, setActivePreset] = useState<string>('Flat');

  const presetDrag = useDragScroll();
  const bandsDrag = useDragScroll();

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

  if (!isOpen) return null;

  const handleBandChange = (index: number, val: number) => {
    const updated = [...eqValues];
    updated[index] = val;
    setActivePreset(language === 'ru' ? 'Пользовательский' : 'Custom');
    audioEngine.setEqGain(index, val);
  };

  const applyPreset = (name: string, values: number[]) => {
    setActivePreset(name);
    setEqValues([...values]);
    audioEngine.applyEqPreset(values);
  };

  const handleReset = () => {
    applyPreset('Flat', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-150 select-none cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-md3-surface-container rounded-3xl shadow-2xl border border-md3-outline-variant/30 overflow-hidden flex flex-col cursor-default"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-md3-outline-variant/20 flex items-center justify-between bg-md3-surface-container-high shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-md3-primary/10 text-md3-primary flex items-center justify-center shrink-0">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-md3-on-surface">
                {language === 'ru' ? '10-Полосный Эквалайзер' : '10-Band Equalizer'}
              </h3>
              <p className="text-[11px] sm:text-xs text-md3-on-surface-variant truncate">
                {language === 'ru' 
                  ? 'Точная настройка звучания под вашу акустику' 
                  : 'Fine-tune sound for your speakers or headphones'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            title={language === 'ru' ? 'Закрыть [Esc]' : 'Close [Esc]'}
            className="p-1.5 rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container hover:text-md3-on-surface cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preset Chips: drag-to-scroll, hidden scrollbars */}
        <div 
          ref={presetDrag.ref}
          onPointerDown={presetDrag.onPointerDown}
          onPointerMove={presetDrag.onPointerMove}
          onPointerUp={presetDrag.onPointerUp}
          onPointerCancel={presetDrag.onPointerCancel}
          onClickCapture={presetDrag.onClickCapture}
          className="px-4 sm:px-6 py-2.5 sm:py-3 border-b border-md3-outline-variant/10 flex items-center gap-2 overflow-x-auto no-scrollbar cursor-grab active:cursor-grabbing select-none"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <span className="text-xs font-semibold text-md3-on-surface-variant/70 uppercase mr-1 shrink-0">
            {language === 'ru' ? 'Пресеты:' : 'Presets:'}
          </span>
          {EQ_PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => applyPreset(p.name, p.values)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer shrink-0 ${
                activePreset === p.name
                  ? 'bg-md3-primary text-md3-on-primary font-semibold shadow-sm'
                  : 'bg-md3-surface-container-high text-md3-on-surface-variant hover:bg-md3-surface-container-highest'
              }`}
            >
              {p.name}
            </button>
          ))}
          <button
            onClick={handleReset}
            title={language === 'ru' ? 'Сбросить в 0 dB' : 'Reset to 0 dB'}
            className="ml-auto p-1.5 rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container-high hover:text-md3-on-surface transition-colors cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 10 Band Sliders: drag-to-scroll horizontally on narrow screens, hidden scrollbars */}
        <div 
          ref={bandsDrag.ref}
          onPointerDown={bandsDrag.onPointerDown}
          onPointerMove={bandsDrag.onPointerMove}
          onPointerUp={bandsDrag.onPointerUp}
          onPointerCancel={bandsDrag.onPointerCancel}
          onClickCapture={bandsDrag.onClickCapture}
          className="p-4 sm:p-6 overflow-x-auto no-scrollbar cursor-grab active:cursor-grabbing select-none"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <div className="min-w-[480px]">
            <div className="grid grid-cols-10 gap-2 h-60 items-center justify-items-center">
              {EQ_FREQUENCIES.map((freq, idx) => {
                const val = eqValues[idx];
                const label = freq >= 1000 ? `${freq / 1000}k` : `${freq}`;
                return (
                  <div key={freq} className="flex flex-col items-center h-full justify-between py-1">
                    <span className="text-[10px] font-mono font-medium text-md3-on-surface-variant">
                      {val > 0 ? `+${val}` : val} dB
                    </span>
                    
                    <div className="relative flex-1 flex items-center my-2">
                      <input
                        type="range"
                        min="-12"
                        max="12"
                        step="0.5"
                        value={val}
                        onChange={(e) => handleBandChange(idx, parseFloat(e.target.value))}
                        className="w-32 h-1.5 accent-md3-primary -rotate-90 cursor-pointer bg-md3-surface-container-highest rounded-lg"
                      />
                    </div>

                    <span className="text-xs font-mono font-bold text-md3-on-surface">
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between items-center text-[11px] text-md3-on-surface-variant/60 pt-4 border-t border-md3-outline-variant/10 px-2 font-mono">
              <span>{language === 'ru' ? 'Низкие (Bass)' : 'Bass'}</span>
              <span>{language === 'ru' ? 'Средние (Mids)' : 'Mids'}</span>
              <span>{language === 'ru' ? 'Высокие (Treble)' : 'Treble'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
