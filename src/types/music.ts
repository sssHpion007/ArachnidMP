import { AppLanguage } from '../i18n';

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
  trackTotal?: number;
  bitrate?: number;
  format?: string;
  fileSize?: number;
  dateAdded: number;
  playCount: number;
  isFavorite: boolean;
  lyrics?: string;
  isInstrumental?: boolean;
  localFile?: File;
  composer?: string;
  contentGroup?: string; // Группа / Коллектив
  comment?: string;
  conductor?: string;
  lyricist?: string;
  customTags?: Record<string, string>;
  isMissing?: boolean;
}

export type FolderCoverType = 'icon' | 'first_playlist' | 'collage';

export interface PlaylistFolder {
  id: string;
  name: string;
  parentId?: string | null; // For nested folders ("в папке папки")
  groupId?: string | null;  // For top-level group placement
  order?: number;
  color?: string;
  icon?: string; // Icon identifier (e.g. 'gamepad', 'headphones', 'music', 'flame')
  coverType?: FolderCoverType; // 'icon' (default) | 'first_playlist' | 'collage'
  createdAt: number;
}

export interface PlaylistGroup {
  id: string;
  name: string;
  color?: string; // Group accent color
  isIsolated?: boolean; // Isolated container: tracks in this group's playlists are hidden from All Tracks, Albums, Artists
  isCollapsed?: boolean; // "группа сворачивается разворачивается"
  order: number;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverArt?: string;
  trackIds: string[];
  isSystem?: boolean;
  icon?: string;
  folderId?: string | null; // Placed inside a folder ("в папке ... плейлисты")
  groupId?: string | null;  // Placed in a group ("из группы в группу")
  order?: number;
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
  coverArt?: string;
  showPlayIcon?: boolean;
  showPauseIcon?: boolean;
  statusMode?: 'listening' | 'listening_app';
  customClientId?: string;
  language?: AppLanguage;
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

export type FadeMode = 'off' | 'track_change_and_pause' | 'always';

