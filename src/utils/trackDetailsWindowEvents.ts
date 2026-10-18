import type { Track } from '../types/music';
import type { AppLanguage } from '../i18n';

export const TRACK_DETAILS_WINDOW_EVENTS = {
  ready: 'track-details-window-ready',
  state: 'track-details-window-state',
  action: 'track-details-window-action',
} as const;

export interface TrackDetailsWindowPayload {
  track: Track | null;
  language: AppLanguage;
}

export type TrackDetailsWindowAction = { type: 'close' };
