import type { AppLanguage } from '../i18n';

export const EQUALIZER_WINDOW_EVENTS = {
  ready: 'equalizer-window-ready',
  state: 'equalizer-window-state',
  action: 'equalizer-window-action',
} as const;

export interface EqualizerWindowPayload {
  language: AppLanguage;
}

export type EqualizerWindowAction = { type: 'close' };
