import { DiscordPresenceInfo } from '../types/music';

const DEFAULT_LOGO_URL = 'https://raw.githubusercontent.com/sssHpion007/ArachnidMP/main/public/app-logo.png';
const PLAYING_ICON_URL = 'https://raw.githubusercontent.com/FozerG/WinYandexMusicRPC/main/assets/Playing.png';
const PAUSED_ICON_URL = 'https://raw.githubusercontent.com/FozerG/WinYandexMusicRPC/main/assets/Paused.png';

class DiscordRpcService {
  private currentPresence: DiscordPresenceInfo | null = null;
  private listeners: ((info: DiscordPresenceInfo | null) => void)[] = [];
  private activeRequestId: number = 0;

  public subscribe(listener: (info: DiscordPresenceInfo | null) => void) {
    this.listeners.push(listener);
    listener(this.currentPresence);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l(this.currentPresence));
  }

  public async updatePresence(info: DiscordPresenceInfo): Promise<void> {
    const requestId = ++this.activeRequestId;
    this.currentPresence = info;
    this.notify();

    // Check if running in Tauri 2 desktop app
    const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
    if (!isTauri) return;

    const tauriCore = (window as any).__TAURI__?.core || (window as any).__TAURI_INTERNALS__;
    if (!tauriCore || !tauriCore.invoke) return;

    if (!info.enabled) {
      try {
        await tauriCore.invoke('update_discord_presence', {
          presence: {
            enabled: false,
            details: '',
            state: '',
            large_image: null,
            large_text: null,
            small_image: null,
            small_text: null,
            start_timestamp: null,
            end_timestamp: null,
            status_display_type: null,
            client_id: null,
            status_mode: null,
          }
        });
      } catch (err) {
        console.warn('Tauri Discord RPC clear error:', err);
      }
      return;
    }

    if (requestId !== this.activeRequestId) return;

    // Small badges (Play and Pause icons)
    const showPlay = info.showPlayIcon ?? true;
    const showPause = info.showPauseIcon ?? true;
    let smallImage: string | null = null;
    let smallText: string | null = null;

    if (info.isPlaying) {
      if (showPlay) {
        smallImage = PLAYING_ICON_URL;
        smallText = 'Воспроизведение';
      }
    } else {
      if (showPause) {
        smallImage = PAUSED_ICON_URL;
        smallText = 'Пауза';
      }
    }

    // Timestamps: for interactive timeline progress bar, BOTH start and end are sent when playing.
    // When paused, both start and end MUST be null so Discord removes timestamps completely!
    let startTimestamp: number | null = null;
    let endTimestamp: number | null = null;
    if (info.isPlaying) {
      const now = Math.floor(Date.now() / 1000);
      const pos = Math.max(0, Math.floor(info.currentTime || 0));
      startTimestamp = now - pos;
      if (info.duration > 0) {
        endTimestamp = startTimestamp + Math.floor(info.duration);
      }
    }

    // Status display format:
    // status_display_type: 2 (Details) ensures the track title is displayed under the user's nickname in the Discord member list
    const statusMode = info.statusMode ?? 'listening_app';
    const statusDisplayType = 2;

    let clientId = info.customClientId?.trim();
    if (!clientId) {
      clientId = statusMode === 'listening' ? '1129859263741837373' : '1304561842858561637';
    }

    // Cover art: pass the exact embedded cover art from the audio file (data:image/... or http)
    // The native Rust backend uploads it natively without CORS to uguu.se / imgur and caches it!
    const coverArt = info.coverArt && info.coverArt.trim().length > 0 ? info.coverArt.trim() : DEFAULT_LOGO_URL;

    try {
      await tauriCore.invoke('update_discord_presence', {
        presence: {
          enabled: true,
          details: info.trackName || 'Arachnid Music Player',
          state: info.artist || 'Неизвестный исполнитель',
          large_image: coverArt,
          large_text: info.album || 'Arachnid Music Player',
          small_image: smallImage,
          small_text: smallText,
          start_timestamp: startTimestamp,
          end_timestamp: endTimestamp,
          status_display_type: statusDisplayType,
          client_id: clientId,
          status_mode: statusMode,
        }
      });
    } catch (err) {
      console.warn('Tauri Discord RPC invoke error:', err);
    }
  }

  public getPresence(): DiscordPresenceInfo | null {
    return this.currentPresence;
  }
}

export const discordRpc = new DiscordRpcService();
