import type { MiniLyricsTrack } from '../components/MiniLyricsPane';
import type { AppLanguage } from '../i18n';

export const LYRICS_WINDOW_EVENTS = {
  ready: 'lyrics-window-ready',
  state: 'lyrics-window-state',
  progress: 'lyrics-window-progress',
  action: 'lyrics-window-action',
} as const;

export interface LyricsWindowPayload {
  track: MiniLyricsTrack | null;
  currentTime: number;
  isPlaying: boolean;
  language: AppLanguage;
  isMiniMode: boolean;
}

export interface LyricsWindowProgress {
  trackId: string | null;
  currentTime: number;
  isPlaying: boolean;
}

export type LyricsWindowAction =
  | { type: 'attach' }
  | { type: 'close' }
  | { type: 'seek'; time: number }
  | { type: 'save-lyrics'; trackId: string; lyrics: string; isInstrumental: boolean; lyricist?: string }
  | { type: 'reload-lyrics'; trackId: string }
  | {
      type: 'keyboard';
      key: string;
      code: string;
      shiftKey: boolean;
      ctrlKey: boolean;
      metaKey: boolean;
      altKey: boolean;
    };
