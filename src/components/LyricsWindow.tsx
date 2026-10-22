import React, { useEffect, useRef, useState } from 'react';
import { emitTo, listen } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { isTauri } from '@tauri-apps/api/core';
import { MiniLyricsPane } from './MiniLyricsPane';
import { LYRICS_WINDOW_EVENTS } from '../utils/lyricsWindowEvents';
import type { LyricsWindowAction, LyricsWindowPayload } from '../utils/lyricsWindowEvents';

const CHANNEL_NAME = 'arachnid-mini-player-lyrics';
const EMPTY_STATE: LyricsWindowPayload = {
  track: null,
  currentTime: 0,
  isPlaying: false,
  language: 'ru',
  isMiniMode: false,
};

export const LyricsWindow: React.FC = () => {
  const [state, setState] = useState<LyricsWindowPayload>(EMPTY_STATE);
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (isTauri()) {
      let disposed = false;
      let unlistenState: (() => void) | undefined;
      let unlistenClose: (() => void) | undefined;
      let readyTimer: ReturnType<typeof setInterval> | undefined;
      let hasReceivedState = false;
      const lyricsWindow = getCurrentWebviewWindow();

      const announceReady = () => {
        void emitTo('main', LYRICS_WINDOW_EVENTS.ready).catch(error => {
          console.warn('Unable to request lyrics state from the player:', error);
        });
      };

      void listen<LyricsWindowPayload>(LYRICS_WINDOW_EVENTS.state, event => {
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
        // The player and lyrics companion start independently; retry until the
        // parent's first state snapshot arrives.
        readyTimer = setInterval(() => {
          if (hasReceivedState) {
            if (readyTimer) clearInterval(readyTimer);
            return;
          }
          announceReady();
        }, 500);
      }).catch(error => console.error('Unable to listen for lyrics state:', error));

      void lyricsWindow.onCloseRequested(event => {
        event.preventDefault();
        void emitTo('main', LYRICS_WINDOW_EVENTS.action, { type: 'close' } satisfies LyricsWindowAction);
      }).then(unlisten => {
        if (disposed) unlisten();
        else unlistenClose = unlisten;
      }).catch(error => console.warn('Unable to handle lyrics window close:', error));

      return () => {
        disposed = true;
        if (readyTimer) clearInterval(readyTimer);
        unlistenState?.();
        unlistenClose?.();
      };
    }

    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;
    let hasReceivedState = false;
    const sendReady = () => channel.postMessage({ type: 'lyrics-window-ready' });
    channel.onmessage = event => {
      if (event.data?.type === 'state') {
        hasReceivedState = true;
        setState(event.data.payload as LyricsWindowPayload);
      }
    };
    sendReady();
    const readyTimer = setInterval(() => {
      if (hasReceivedState) clearInterval(readyTimer);
      else sendReady();
    }, 500);
    return () => {
      clearInterval(readyTimer);
      channel.close();
      channelRef.current = null;
    };
  }, []);

  const sendAction = React.useCallback((action: LyricsWindowAction) => {
    if (isTauri()) {
      void emitTo('main', LYRICS_WINDOW_EVENTS.action, action).catch(error => {
        console.warn('Unable to send lyrics window action:', error);
      });
    } else {
      channelRef.current?.postMessage({
        type: action.type === 'attach'
          ? 'attach-lyrics'
          : action.type === 'seek'
            ? 'seek-lyrics'
            : action.type === 'keyboard'
              ? 'lyrics-keyboard'
              : action.type === 'save-lyrics'
                ? 'save-lyrics'
                : action.type === 'reload-lyrics'
                  ? 'reload-lyrics'
                  : 'close-lyrics',
        ...(action.type === 'seek' ? { time: action.time } : {}),
        ...(action.type === 'save-lyrics' ? {
          trackId: action.trackId,
          lyrics: action.lyrics,
          isInstrumental: action.isInstrumental,
          lyricist: action.lyricist,
        } : {}),
        ...(action.type === 'reload-lyrics' ? { trackId: action.trackId } : {}),
        ...(action.type === 'keyboard' ? {
          key: action.key,
          code: action.code,
          shiftKey: action.shiftKey,
          ctrlKey: action.ctrlKey,
          metaKey: action.metaKey,
          altKey: action.altKey,
        } : {}),
      });
    }
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('button, input, textarea, select, [contenteditable="true"]')) return;

      if (event.code === 'Escape' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        if (!event.repeat) sendAction({ type: 'close' });
        return;
      }

      const supportedCodes = new Set([
        'Space', 'MediaPlayPause', 'MediaStop', 'MediaTrackNext', 'MediaTrackPrevious',
        'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyF', 'KeyQ', 'KeyX',
        'KeyD', 'KeyR', 'KeyT', 'KeyL', 'KeyE', 'KeyM', 'Comma', 'Tab', 'Delete',
      ]);
      if (!supportedCodes.has(event.code) || event.isComposing) return;

      event.preventDefault();
      if (event.repeat) return;
      sendAction({
        type: 'keyboard',
        key: event.key,
        code: event.code,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
      });
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [sendAction]);

  const attach = () => sendAction({ type: 'attach' });
  const close = () => sendAction({ type: 'close' });
  const seek = (time: number) => sendAction({ type: 'seek', time });

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-md3-background text-md3-on-background font-sans">
      <MiniLyricsPane
        track={state.track}
        currentTime={state.currentTime}
        language={state.language}
        detached
        onAttach={state.isMiniMode ? attach : undefined}
        onClose={close}
        onSeek={seek}
        onSaveLyrics={(trackId, lyrics, isInstrumental, lyricist) => sendAction({ type: 'save-lyrics', trackId, lyrics, isInstrumental, lyricist })}
        onReloadLyrics={trackId => sendAction({ type: 'reload-lyrics', trackId })}
      />
    </div>
  );
};
