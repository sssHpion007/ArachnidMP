import React, { useState, useEffect, useCallback } from 'react';
import { isTauri, invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

export const TitleBar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);

  // Check window maximized state, reveal window cleanly and set up resize listener
  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void) | undefined;
    let isMounted = true;

    const initWindowState = async () => {
      try {
        const win = getCurrentWindow();
        const initialMax = await win.isMaximized();
        if (!initialMax) {
          try {
            await win.maximize();
          } catch (_) {}
        }
        if (isMounted) setIsMaximized(true);

        // Reveal window without white flash/box now that it is sized and rendered
        try {
          await win.show();
          await win.setFocus();
        } catch (_) {
          try {
            await invoke('show_window');
          } catch (_) {}
        }

        unlisten = await win.onResized(async () => {
          try {
            const max = await win.isMaximized();
            if (isMounted) setIsMaximized(max);
          } catch (_) {}
        });
      } catch (err) {
        try {
          const max = await invoke<boolean>('is_window_maximized');
          if (isMounted) setIsMaximized(max);
          await invoke('show_window');
        } catch (_) {}
      }
    };

    initWindowState();

    return () => {
      isMounted = false;
      if (unlisten) unlisten();
    };
  }, []);

  const handleMinimize = useCallback(async () => {
    if (!isTauri()) return;
    try {
      await getCurrentWindow().minimize();
    } catch (_) {
      try {
        await invoke('minimize_window');
      } catch (err) {
        console.error('Failed to minimize window:', err);
      }
    }
  }, []);

  const handleToggleMaximize = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const win = getCurrentWindow();
      await win.toggleMaximize();
      const max = await win.isMaximized();
      setIsMaximized(max);
    } catch (_) {
      try {
        const max = await invoke<boolean>('toggle_maximize_window');
        setIsMaximized(max);
      } catch (err) {
        console.error('Failed to toggle maximize window:', err);
      }
    }
  }, []);

  const handleClose = useCallback(async () => {
    if (!isTauri()) return;
    try {
      await invoke('close_window');
    } catch (_) {
      try {
        await getCurrentWindow().close();
      } catch (err) {
        console.error('Failed to close window:', err);
      }
    }
  }, []);

  return (
    <div
      onDoubleClick={handleToggleMaximize}
      className="h-7 w-full bg-md3-surface-container-low border-b border-md3-outline-variant/15 flex items-center justify-between select-none z-50 shrink-0 text-md3-on-surface-variant relative"
    >
      {/* Left: App Logo & Title (Draggable) */}
      <div
        data-tauri-drag-region
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        className="flex items-center gap-2 pl-3 h-full cursor-default select-none pointer-events-auto"
      >
        <img
          src="/app-logo.png"
          alt="Arachnid"
          className="w-4 h-4 rounded-md object-contain pointer-events-none shadow-xs"
        />
        <span className="text-[10px] font-bold tracking-wider text-md3-on-surface-variant/90 pointer-events-none">
          ARACHNID
        </span>
      </div>

      {/* Center Draggable Spacer */}
      <div
        data-tauri-drag-region
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        className="flex-1 h-full cursor-default"
      />

      {/* Right: Window Controls (Strictly NO-DRAG region to prevent mouse hit-test flicker) */}
      <div
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        className="flex items-center h-full shrink-0 select-none pointer-events-auto"
      >
        {/* Minimize Button */}
        <button
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleMinimize}
          title="Свернуть"
          aria-label="Свернуть"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          className="w-10 h-full flex items-center justify-center text-md3-on-surface-variant hover:bg-md3-primary/20 hover:text-md3-primary active:bg-md3-primary/30 cursor-pointer outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ring-0"
        >
          <svg className="w-2.5 h-2.5 pointer-events-none" viewBox="0 0 10 1" fill="currentColor">
            <rect width="10" height="1" rx="0.5" />
          </svg>
        </button>

        {/* Maximize / Restore Button */}
        <button
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleToggleMaximize}
          title={isMaximized ? 'Восстановить' : 'Развернуть'}
          aria-label={isMaximized ? 'Восстановить' : 'Развернуть'}
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          className="w-10 h-full flex items-center justify-center text-md3-on-surface-variant hover:bg-md3-primary/20 hover:text-md3-primary active:bg-md3-primary/30 cursor-pointer outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ring-0"
        >
          {isMaximized ? (
            /* Restore icon (overlapping squares) */
            <svg className="w-2.5 h-2.5 pointer-events-none" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M2.5 2V1.4C2.5 0.9 2.9 0.6 3.4 0.6H8.6C9.1 0.6 9.4 0.9 9.4 1.4V6.6C9.4 7.1 9.1 7.4 8.6 7.4H8" />
              <rect x="0.6" y="2.5" width="6.9" height="6.9" rx="1" />
            </svg>
          ) : (
            /* Maximize icon (single square) */
            <svg className="w-2.5 h-2.5 pointer-events-none" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
              <rect x="0.6" y="0.6" width="8.8" height="8.8" rx="1" />
            </svg>
          )}
        </button>

        {/* Close Button */}
        <button
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleClose}
          title="Закрыть"
          aria-label="Закрыть"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          className="w-11 h-full flex items-center justify-center text-md3-on-surface-variant hover:bg-md3-primary/20 hover:text-md3-primary active:bg-red-500 active:text-white cursor-pointer outline-none focus:outline-none focus-visible:outline-none focus:ring-0 ring-0"
        >
          <svg className="w-2.5 h-2.5 pointer-events-none" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
            <line x1="1" y1="1" x2="9" y2="9" />
            <line x1="9" y1="1" x2="1" y2="9" />
          </svg>
        </button>
      </div>
    </div>
  );
};
