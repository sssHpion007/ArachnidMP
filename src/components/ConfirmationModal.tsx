import React, { useEffect, useState, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { AppLanguage } from '../i18n';
import { useModalAnimation } from '../utils/useModalAnimation';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  holdToConfirm?: boolean;
  holdDurationMs?: number;
  language?: AppLanguage;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  isDestructive = false,
  holdToConfirm = false,
  holdDurationMs = 1800,
  language = 'ru',
  onConfirm,
  onClose,
}) => {
  const effectiveConfirmLabel = confirmLabel || (language === 'ru' ? 'Подтвердить' : 'Confirm');
  const effectiveCancelLabel = cancelLabel || (language === 'ru' ? 'Отмена' : 'Cancel');

  const [holdProgress, setHoldProgress] = useState<number>(0);
  const [isHolding, setIsHolding] = useState<boolean>(false);

  const holdStartTimeRef = useRef<number | null>(null);
  const holdRafRef = useRef<number | null>(null);
  const isEnterHeldRef = useRef<boolean>(false);
  const isPointerHeldRef = useRef<boolean>(false);
  const hasTriggeredRef = useRef<boolean>(false);

  const stopHolding = (reset = true) => {
    if (holdRafRef.current) {
      cancelAnimationFrame(holdRafRef.current);
      holdRafRef.current = null;
    }
    holdStartTimeRef.current = null;
    setIsHolding(false);
    if (reset) {
      setHoldProgress(0);
    }
  };

  const startHolding = () => {
    if (holdStartTimeRef.current !== null || hasTriggeredRef.current) return;
    holdStartTimeRef.current = performance.now();
    setIsHolding(true);

    const step = (now: number) => {
      if (holdStartTimeRef.current === null) return;
      const elapsed = now - holdStartTimeRef.current;
      const progress = Math.min(1, elapsed / holdDurationMs);
      setHoldProgress(progress);

      if (progress >= 1) {
        hasTriggeredRef.current = true;
        stopHolding(false);
        onConfirm();
        onClose();
      } else {
        holdRafRef.current = requestAnimationFrame(step);
      }
    };
    holdRafRef.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    if (!isOpen) {
      stopHolding(true);
      isEnterHeldRef.current = false;
      isPointerHeldRef.current = false;
      hasTriggeredRef.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        stopHolding(true);
        onClose();
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (holdToConfirm) {
          if (!e.repeat && !isEnterHeldRef.current && !hasTriggeredRef.current) {
            isEnterHeldRef.current = true;
            startHolding();
          }
        } else {
          onConfirm();
          onClose();
        }
      }
    };

    const handleGlobalKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && holdToConfirm) {
        isEnterHeldRef.current = false;
        if (!isPointerHeldRef.current && !hasTriggeredRef.current) {
          stopHolding(true);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    window.addEventListener('keyup', handleGlobalKeyUp, true);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
      window.removeEventListener('keyup', handleGlobalKeyUp, true);
      stopHolding(true);
    };
  }, [isOpen, holdToConfirm, holdDurationMs, onConfirm, onClose]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!holdToConfirm || hasTriggeredRef.current) return;
    if (e.button !== 0) return;
    isPointerHeldRef.current = true;
    startHolding();
  };

  const handlePointerUp = () => {
    if (!holdToConfirm) return;
    isPointerHeldRef.current = false;
    if (!isEnterHeldRef.current && !hasTriggeredRef.current) {
      stopHolding(true);
    }
  };

  const handlePointerLeave = () => {
    if (!holdToConfirm) return;
    isPointerHeldRef.current = false;
    if (!isEnterHeldRef.current && !hasTriggeredRef.current) {
      stopHolding(true);
    }
  };

  const { isRendered, backdropClass, dialogClass } = useModalAnimation(isOpen, 200);

  if (!isRendered) return null;

  const progressPercent = Math.round(holdProgress * 100);

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
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm ${
                isDestructive
                  ? 'bg-red-500/15 text-red-500'
                  : 'bg-md3-primary/15 text-md3-primary'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-md3-on-surface leading-tight">
                {title}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container hover:text-md3-on-surface transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message */}
        <div className="p-6 text-sm text-md3-on-surface-variant leading-relaxed">
          {message}
        </div>

        {/* Hold-to-confirm hint if enabled */}
        {holdToConfirm && (
          <div className="px-6 pb-2 text-[12px] text-red-400 font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse inline-block" />
            <span>
              {language === 'ru'
                ? 'Для удаления зажмите кнопку или клавишу Enter'
                : 'Hold the button or Enter key to delete'}
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="p-4 pt-2 bg-md3-surface-container-high/30 border-t border-md3-outline-variant/15 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full text-xs font-semibold text-md3-on-surface-variant hover:bg-md3-surface-container-high transition-colors cursor-pointer"
          >
            {effectiveCancelLabel}
          </button>

          {holdToConfirm ? (
            <button
              type="button"
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerLeave}
              onPointerCancel={handlePointerLeave}
              className={`relative overflow-hidden px-5 py-2.5 rounded-full text-xs font-bold shadow-md transition-all cursor-pointer select-none touch-none ${
                isHolding ? 'scale-98 ring-2 ring-red-400' : 'hover:scale-102 active:scale-98'
              } ${
                isDestructive
                  ? 'bg-red-700/80 text-white'
                  : 'bg-md3-primary text-md3-on-primary'
              }`}
            >
              {/* Animated Progress Fill Layer */}
              <div
                className="absolute inset-0 bg-red-500 transition-[width] ease-linear pointer-events-none"
                style={{ width: `${progressPercent}%` }}
              />

              {/* Text content over the fill */}
              <span className="relative z-10 flex items-center gap-1.5 whitespace-nowrap">
                {isHolding ? (
                  <>
                    <span>{language === 'ru' ? 'Удерживайте...' : 'Holding...'}</span>
                    <span className="font-mono text-[11px] opacity-90">{progressPercent}%</span>
                  </>
                ) : (
                  <>
                    <span>{effectiveConfirmLabel}</span>
                    <span className="opacity-75 text-[10px] font-normal font-mono">(Enter)</span>
                  </>
                )}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`px-5 py-2.5 rounded-full text-xs font-bold shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer ${
                isDestructive
                  ? 'bg-red-600 hover:bg-red-500 text-white'
                  : 'bg-md3-primary text-md3-on-primary'
              }`}
            >
              {effectiveConfirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
