import React, { useState } from 'react';
import { X, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { EQ_FREQUENCIES, EQ_PRESETS, audioEngine } from '../services/audioEngine';

interface EqualizerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EqualizerModal: React.FC<EqualizerModalProps> = ({ isOpen, onClose }) => {
  const [eqValues, setEqValues] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const [activePreset, setActivePreset] = useState<string>('Flat');

  if (!isOpen) return null;

  const handleBandChange = (index: number, val: number) => {
    const updated = [...eqValues];
    updated[index] = val;
    setEqValues(updated);
    setActivePreset('Пользовательский');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-2xl bg-md3-surface-container rounded-3xl shadow-2xl border border-md3-outline-variant/30 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-md3-outline-variant/20 flex items-center justify-between bg-md3-surface-container-high">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-md3-primary/10 text-md3-primary flex items-center justify-center">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-md3-on-surface">10-Полосный Эквалайзер</h3>
              <p className="text-xs text-md3-on-surface-variant">Точная настройка звучания под вашу акустику</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container hover:text-md3-on-surface"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preset Chips */}
        <div className="px-6 py-3 border-b border-md3-outline-variant/10 flex items-center gap-2 overflow-x-auto custom-scrollbar">
          <span className="text-xs font-semibold text-md3-on-surface-variant/70 uppercase mr-1">Пресеты:</span>
          {EQ_PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => applyPreset(p.name, p.values)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
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
            title="Сбросить в 0 dB"
            className="ml-auto p-1.5 rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container-high hover:text-md3-on-surface transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 10 Band Sliders */}
        <div className="p-6">
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
            <span>Низкие (Bass)</span>
            <span>Средние (Mids)</span>
            <span>Высокие (Treble)</span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-md3-surface-container-high border-t border-md3-outline-variant/20 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-full bg-md3-primary text-md3-on-primary text-sm font-semibold hover:opacity-90 shadow-md transition-all"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
};
