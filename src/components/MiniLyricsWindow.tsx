import React, { useEffect, useRef, useState } from 'react';
import { MiniLyricsPane, MiniLyricsTrack } from './MiniLyricsPane';
import { AppLanguage } from '../i18n';

interface LyricsWindowState {
  track: MiniLyricsTrack | null;
  currentTime: number;
  isPlaying: boolean;
  language: AppLanguage;
}

const CHANNEL_NAME = 'arachnid-mini-player-lyrics';

export const MiniLyricsWindow: React.FC = () => {
  const [state, setState] = useState<LyricsWindowState>({
    track: null,
    currentTime: 0,
    isPlaying: false,
    language: 'ru',
  });
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;
    channel.onmessage = event => {
      if (event.data?.type === 'state') {
        setState(event.data.payload as LyricsWindowState);
      }
    };
    channel.postMessage({ type: 'lyrics-window-ready' });
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, []);

  const attach = () => channelRef.current?.postMessage({ type: 'attach-lyrics' });
  const close = () => channelRef.current?.postMessage({ type: 'close-lyrics' });
  const seek = (time: number) => channelRef.current?.postMessage({ type: 'seek-lyrics', time });

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-md3-background text-md3-on-background font-sans">
      <MiniLyricsPane
        track={state.track}
        currentTime={state.currentTime}
        language={state.language}
        detached
        onAttach={attach}
        onClose={close}
        onSeek={seek}
      />
    </div>
  );
};
