import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EllipsisVertical } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AppLanguage } from '../i18n';

export interface LyricsMenuAction {
  id: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void | Promise<void>;
  disabled?: boolean;
  dividerBefore?: boolean;
}

interface LyricsActionsMenuProps {
  actions: LyricsMenuAction[];
  language: AppLanguage;
  contextTargetRef: React.RefObject<HTMLElement>;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const MENU_WIDTH = 224;

export const LyricsActionsMenu: React.FC<LyricsActionsMenuProps> = ({
  actions,
  language,
  contextTargetRef,
  isOpen,
  onOpenChange,
}) => {
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  const openAt = (x: number, y: number) => {
    const estimatedHeight = actionsRef.current.length * 40 + 12;
    setPosition({
      left: Math.max(8, Math.min(x, window.innerWidth - MENU_WIDTH - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - estimatedHeight - 8)),
    });
    onOpenChange(true);
  };

  useEffect(() => {
    if (!isOpen) setPosition(null);
  }, [isOpen]);

  useEffect(() => {
    const target = contextTargetRef.current;
    if (!target) return;
    const handleContextMenu = (event: MouseEvent) => {
      const source = event.target;
      if (!(source instanceof Element)) return;
      if (source.closest('[data-lyrics-actions-menu], input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      openAt(event.clientX, event.clientY);
    };
    target.addEventListener('contextmenu', handleContextMenu);
    return () => target.removeEventListener('contextmenu', handleContextMenu);
  }, [contextTargetRef]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const source = event.target;
      if (!(source instanceof Node)) return;
      if (menuRef.current?.contains(source) || triggerRef.current?.contains(source)) return;
      onOpenChange(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat) return;
      onOpenChange(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, onOpenChange]);

  const toggleMenu = () => {
    if (isOpen) {
      onOpenChange(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) openAt(rect.right - MENU_WIDTH, rect.bottom + 6);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleMenu}
        aria-label={language === 'ru' ? 'Действия с текстом песни' : 'Lyrics actions'}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={language === 'ru' ? 'Действия с текстом песни' : 'Lyrics actions'}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-md3-on-surface-variant transition-colors hover:bg-md3-surface-container hover:text-md3-on-surface"
      >
        <EllipsisVertical className="h-4 w-4" />
      </button>
      {isOpen && position && createPortal(
        <div
          ref={menuRef}
          data-lyrics-actions-menu
          role="menu"
          aria-label={language === 'ru' ? 'Действия с текстом песни' : 'Lyrics actions'}
          className="fixed z-[80] min-w-56 overflow-hidden rounded-2xl border border-md3-outline-variant/25 bg-md3-surface-container-high/95 p-1.5 text-md3-on-surface shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100"
          style={{ left: position.left, top: position.top, width: MENU_WIDTH, maxHeight: 'min(420px, calc(100vh - 16px))', overflowY: 'auto' }}
        >
          {actions.map(action => {
            const Icon = action.icon;
            return (
              <React.Fragment key={action.id}>
                {action.dividerBefore && <div className="my-1.5 border-t border-md3-outline-variant/15" />}
                <button
                  type="button"
                  role="menuitem"
                  disabled={action.disabled}
                  onClick={() => {
                    void action.onSelect();
                    onOpenChange(false);
                  }}
                  className="flex min-h-9 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-md3-surface-container-highest disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Icon className="h-4 w-4 shrink-0 text-md3-primary" />
                  <span className="min-w-0 flex-1">{action.label}</span>
                </button>
              </React.Fragment>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
};
