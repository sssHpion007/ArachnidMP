export interface Track {
  id: string;
  path?: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // in seconds
  src: string;
  coverArt?: string;
  genre?: string;
  year?: number;
  trackNumber?: number;
  bitrate?: number;
  format?: string;
  fileSize?: number;
  dateAdded: number;
  playCount: number;
  isFavorite: boolean;
  lyrics?: string;
  isInstrumental?: boolean;
  localFile?: File;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverArt?: string;
  trackIds: string[];
  isSystem?: boolean;
  icon?: string;
}

export interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  repeatMode: 'off' | 'all' | 'one';
  isShuffled: boolean;
  queue: Track[];
  queueIndex: number;
  history: Track[];
}

export interface DiscordPresenceInfo {
  enabled: boolean;
  trackName: string;
  artist: string;
  album: string;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
}

export interface EQPreset {
  name: string;
  values: number[]; // 10 bands (-12dB to +12dB)
}

export interface M3ThemeColors {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  background: string;
  onBackground: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  outline: string;
  outlineVariant: string;
}

export type ThemeMode = 'dark' | 'amoled' | 'light';
