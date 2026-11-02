import React from 'react';
import { Library } from 'lucide-react';
import type { AppLanguage } from '../i18n';

interface MiniPanelLibraryButtonProps {
  language: AppLanguage;
  isActive: boolean;
  onClick: () => void;
  className?: string;
}

export const MiniPanelLibraryButton: React.FC<MiniPanelLibraryButtonProps> = ({
  language,
  isActive,
  onClick,
  className = '',
}) => {
  const label = language === 'ru' ? 'Библиотека' : 'Library';

  return (
    <button
      type="button"
      onClick={onClick}
      title={language === 'ru' ? 'Открыть библиотеку' : 'Open library'}
      aria-label={label}
      aria-pressed={isActive}
      className={`${className} flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-semibold transition-colors ${
        isActive
          ? 'bg-md3-primary/15 text-md3-primary hover:bg-md3-primary/20'
          : 'text-md3-on-surface-variant hover:bg-md3-surface-container-high hover:text-md3-on-surface'
      }`}
    >
      <Library size={14} />
      <span>{label}</span>
    </button>
  );
};
