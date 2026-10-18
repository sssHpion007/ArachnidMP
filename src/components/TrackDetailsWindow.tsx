import React, { useEffect, useState } from 'react';
import { emitTo, listen } from '@tauri-apps/api/event';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { TrackDetailsModal } from './TrackDetailsModal';
import { TRACK_DETAILS_WINDOW_EVENTS } from '../utils/trackDetailsWindowEvents';
import type { TrackDetailsWindowPayload } from '../utils/trackDetailsWindowEvents';

const EMPTY_STATE: TrackDetailsWindowPayload = { track: null, language: 'ru' };

export const TrackDetailsWindow: React.FC = () => {
  const [state, setState] = useState<TrackDetailsWindowPayload>(EMPTY_STATE);

  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlistenState: (() => void) | undefined;
    let unlistenClose: (() => void) | undefined;
    let readyTimer: ReturnType<typeof setInterval> | undefined;
    let hasReceivedState = false;
    const announceReady = () => {
      void emitTo('main', TRACK_DETAILS_WINDOW_EVENTS.ready).catch(error => {
        console.warn('Unable to request track details from the player:', error);
      });
    };

    void listen<TrackDetailsWindowPayload>(TRACK_DETAILS_WINDOW_EVENTS.state, event => {
      hasReceivedState = true;
      if (readyTimer) clearInterval(readyTimer);
      setState(event.payload);
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
    }).catch(error => console.error('Unable to listen for track details state:', error));

    // The main player owns the window lifecycle and clears its state on close.
    void getCurrentWebviewWindow().onCloseRequested(event => {
      event.preventDefault();
      void emitTo('main', TRACK_DETAILS_WINDOW_EVENTS.action, { type: 'close' }).catch(error => {
        console.warn('Unable to close track details window:', error);
      });
    }).then(unlisten => {
      if (disposed) unlisten();
      else unlistenClose = unlisten;
    }).catch(error => console.warn('Unable to handle track details window close:', error));

    return () => {
      disposed = true;
      if (readyTimer) clearInterval(readyTimer);
      unlistenState?.();
      unlistenClose?.();
    };
  }, []);

  const closeDetails = () => {
    void emitTo('main', TRACK_DETAILS_WINDOW_EVENTS.action, { type: 'close' }).catch(error => {
      console.warn('Unable to close track details window:', error);
    });
  };

  if (!state.track) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-md3-surface text-sm text-md3-on-surface-variant" role="status">
        {state.language === 'ru' ? 'Подключение к плееру…' : 'Connecting to the player…'}
      </div>
    );
  }

  return (
    <TrackDetailsModal
      isOpen
      track={state.track}
      language={state.language}
      onClose={closeDetails}
    />
  );
};
