import React, { useEffect, useState } from 'react';
import { emitTo, listen } from '@tauri-apps/api/event';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { EqualizerModal } from './EqualizerModal';
import { EQUALIZER_WINDOW_EVENTS } from '../utils/equalizerWindowEvents';
import type { EqualizerWindowAction, EqualizerWindowPayload } from '../utils/equalizerWindowEvents';
import type { AppLanguage } from '../i18n';

const getCachedLanguage = (): AppLanguage => {
  try {
    const raw = localStorage.getItem('arachnid_theme_cache');
    const language = raw ? JSON.parse(raw)?.language : undefined;
    return language === 'en' ? 'en' : 'ru';
  } catch (_) {
    return 'ru';
  }
};

export const EqualizerWindow: React.FC = () => {
  const [language, setLanguage] = useState<AppLanguage>(getCachedLanguage);

  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlistenState: (() => void) | undefined;
    let unlistenClose: (() => void) | undefined;
    let readyTimer: ReturnType<typeof setInterval> | undefined;
    let hasReceivedState = false;

    const announceReady = () => {
      void emitTo('main', EQUALIZER_WINDOW_EVENTS.ready).catch(error => {
        console.warn('Unable to request equalizer state from the player:', error);
      });
    };

    void listen<EqualizerWindowPayload>(EQUALIZER_WINDOW_EVENTS.state, event => {
      hasReceivedState = true;
      if (readyTimer) clearInterval(readyTimer);
      setLanguage(event.payload.language);
    }).then(unlisten => {
      if (disposed) {
        unlisten();
        return;
      }
      unlistenState = unlisten;
      announceReady();
      readyTimer = setInterval(() => {
        if (hasReceivedState) {
          if (readyTimer) clearInterval(readyTimer);
          return;
        }
        announceReady();
      }, 500);
    }).catch(error => console.error('Unable to listen for equalizer state:', error));

    void getCurrentWebviewWindow().onCloseRequested(event => {
      event.preventDefault();
      void emitTo('main', EQUALIZER_WINDOW_EVENTS.action, { type: 'close' } satisfies EqualizerWindowAction).catch(error => {
        console.warn('Unable to close equalizer window:', error);
      });
    }).then(unlisten => {
      if (disposed) unlisten();
      else unlistenClose = unlisten;
    }).catch(error => console.warn('Unable to handle equalizer window close:', error));

    return () => {
      disposed = true;
      if (readyTimer) clearInterval(readyTimer);
      unlistenState?.();
      unlistenClose?.();
    };
  }, []);

  const closeWindow = () => {
    if (!isTauri()) {
      window.close();
      return;
    }
    void emitTo('main', EQUALIZER_WINDOW_EVENTS.action, { type: 'close' } satisfies EqualizerWindowAction).catch(error => {
      console.warn('Unable to close equalizer window:', error);
    });
  };

  return <EqualizerModal isOpen language={language} onClose={closeWindow} standaloneWindow />;
};
