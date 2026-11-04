import React from 'react';

interface MaterialYouSwitchProps {
  checked: boolean;
  label: string;
  onClick: () => void;
  accent?: 'theme' | 'discord';
}

export const MaterialYouSwitch: React.FC<MaterialYouSwitchProps> = ({ checked, label, onClick, accent = 'theme' }) => {
  const activeTrackClass = accent === 'discord'
    ? 'border-[#5865F2]/30 bg-[#5865F2]'
    : 'border-md3-primary/20 bg-md3-primary';
  const activeThumbClass = accent === 'discord' ? 'bg-white' : 'bg-md3-on-primary';

  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      onClick={onClick}
      className={`relative inline-flex h-8 w-11 shrink-0 items-center rounded-[10px] border p-1 transition-colors duration-300 ease-[cubic-bezier(0.2,0,0,1)] active:scale-[0.98] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md3-primary/60 ${checked ? activeTrackClass : 'border-md3-outline-variant/35 bg-md3-surface-container-highest'}`}
    >
      <span className={`absolute left-1 top-1/2 h-5 w-5 -translate-y-1/2 rounded-[6px] shadow-sm transition-[transform,background-color] duration-300 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none ${checked ? `translate-x-4 ${activeThumbClass}` : 'translate-x-0 bg-md3-on-surface-variant'}`} />
    </button>
  );
};
