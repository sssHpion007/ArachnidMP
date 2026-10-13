import React, { useEffect } from 'react';
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
  language = 'ru',
  onConfirm,
  onClose,
}) => {
  const effectiveConfirmLabel = confirmLabel || (language === 'ru' ? 'Подтвердить' : 'Confirm');
  const effectiveCancelLabel = cancelLabel || (language === 'ru' ? 'Отмена' : 'Cancel');

  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        onConfirm();
        onClose();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [isOpen, onClose, onConfirm]);

  const { isRendered, backdropClass, dialogClass } = useModalAnimation(isOpen, 200);

  if (!isRendered) return null;

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

        {/* Action Buttons */}
        <div className="p-4 pt-2 bg-md3-surface-container-high/30 border-t border-md3-outline-variant/15 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full text-xs font-semibold text-md3-on-surface-variant hover:bg-md3-surface-container-high transition-colors cursor-pointer"
          >
            {effectiveCancelLabel}
          </button>
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
        </div>
      </div>
    </div>
  );
};
