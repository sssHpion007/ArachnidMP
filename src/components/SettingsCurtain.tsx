import React from 'react';
import { useCurtainAnimation } from '../utils/useModalAnimation';

type SettingsCurtainProps = {
  open: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
  role?: React.AriaRole;
  showBackdrop?: boolean;
  positionClassName?: string;
};

type SettingsCurtainListProps = {
  children: React.ReactNode;
};

/** Shared animated surface for settings dropdown curtains. */
export const SettingsCurtain: React.FC<SettingsCurtainProps> = ({
  open,
  onClose,
  children,
  ariaLabel,
  role,
  showBackdrop = false,
  positionClassName = 'absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[70]',
}) => {
  const { isRendered, curtainClass } = useCurtainAnimation(open, 160);
  if (!isRendered) return null;

  return (
    <>
      {showBackdrop && (
        <div
          aria-hidden="true"
          className={`fixed inset-0 z-40 ${open ? '' : 'pointer-events-none'}`}
          onClick={open ? onClose : undefined}
        />
      )}
      <div
        role={role}
        aria-label={ariaLabel}
        aria-hidden={!open}
        className={`${positionClassName} rounded-2xl border border-md3-outline-variant/30 bg-md3-surface-container-high/95 p-2.5 shadow-2xl backdrop-blur-xl origin-top ${curtainClass} ${open ? '' : 'pointer-events-none'}`}
      >
        {children}
      </div>
    </>
  );
};

/** Shared scroll area and spacing for options inside a settings curtain. */
export const SettingsCurtainList: React.FC<SettingsCurtainListProps> = ({ children }) => (
  <div className="md3-scrollbar max-h-60 overflow-y-auto space-y-1.5 pr-1">
    {children}
  </div>
);
