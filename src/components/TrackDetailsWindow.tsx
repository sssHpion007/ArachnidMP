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
    void listen<TrackDetailsWindowPayload>(TRACK_DETAILS_WINDOW_EVENTS.state, event => {
      setState(event.payload);
    }).then(unlisten => {
      if (disposed) {
        unlisten();
        return;
      }
      unlistenState = unlisten;
      void emitTo('main', TRACK_DETAILS_WINDOW_EVENTS.ready).catch(error => {
        console.warn('Unable to request track details from the player:', error);
      });
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
      unlistenState?.();
      unlistenClose?.();
    };
  }, []);

  const closeDetails = () => {
    void emitTo('main', TRACK_DETAILS_WINDOW_EVENTS.action, { type: 'close' }).catch(error => {
      console.warn('Unable to close track details window:', error);
    });
  };

  return (
    <TrackDetailsModal
      isOpen={!!state.track}
      track={state.track}
      language={state.language}
      onClose={closeDetails}
    />
  );
};
