import { DiscordPresenceInfo } from '../types/music';

class DiscordRpcService {
  private isConnected: boolean = false;
  private currentPresence: DiscordPresenceInfo | null = null;
  private listeners: ((info: DiscordPresenceInfo | null) => void)[] = [];

  constructor() {
    this.isConnected = true;
  }

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
    this.currentPresence = info;
    this.notify();

    // Check if running in Tauri 2 desktop app
    const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
    if (isTauri) {
      try {
        const tauriCore = (window as any).__TAURI__?.core || (window as any).__TAURI_INTERNALS__;
        if (tauriCore && tauriCore.invoke) {
          const startTimestamp = info.isPlaying ? Math.floor(Date.now() / 1000) - Math.floor(info.currentTime) : undefined;
          const endTimestamp = info.isPlaying && info.duration > 0 ? startTimestamp! + Math.floor(info.duration) : undefined;

          await tauriCore.invoke('update_discord_presence', {
            presence: {
              enabled: info.enabled,
              details: info.trackName || 'Arachnid Music Player',
              state: info.artist ? `by ${info.artist}` : 'Listening to music',
              large_image: 'arachnid_logo',
              large_text: info.album || 'Arachnid Player',
              start_timestamp: startTimestamp,
              end_timestamp: endTimestamp,
            }
          });
        }
      } catch (err) {
        console.warn('Tauri Discord RPC invoke error:', err);
      }
    }
  }

  public getPresence(): DiscordPresenceInfo | null {
    return this.currentPresence;
  }
}

export const discordRpc = new DiscordRpcService();
