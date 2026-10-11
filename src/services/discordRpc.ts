import { DiscordPresenceInfo } from '../types/music';

// Cache for resolved online album artwork URLs (so repeated searches and uploads are instant)
const coverArtCache = new Map<string, string>();

// Initialize cache from localStorage if available
try {
  const saved = localStorage.getItem('arachnid_cover_art_cache');
  if (saved) {
    const parsed = JSON.parse(saved);
    Object.entries(parsed).forEach(([k, v]) => {
      if (typeof v === 'string') coverArtCache.set(k, v);
    });
  }
} catch (_) {}

function saveCoverArtCache() {
  try {
    const obj: Record<string, string> = {};
    let count = 0;
    // Store up to 200 most recent items
    for (const [k, v] of coverArtCache.entries()) {
      if (count++ > 200) break;
      obj[k] = v;
    }
    localStorage.setItem('arachnid_cover_art_cache', JSON.stringify(obj));
  } catch (_) {}
}

const DEFAULT_LOGO_URL = 'https://raw.githubusercontent.com/sssHpion007/ArachnidMP/main/public/app-logo.png';
const PLAYING_ICON_URL = 'https://raw.githubusercontent.com/FozerG/WinYandexMusicRPC/main/assets/Playing.png';
const PAUSED_ICON_URL = 'https://raw.githubusercontent.com/FozerG/WinYandexMusicRPC/main/assets/Paused.png';

/**
 * Compresses and resizes a base64 image data URL to max 512x512 JPEG for fast, reliable upload
 */
function compressCoverForUpload(dataUrl: string, maxSize = 512): Promise<string> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        if (width <= 0 || height <= 0) {
          resolve(dataUrl);
          return;
        }
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
          return;
        }
        resolve(dataUrl);
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    } catch (_) {
      resolve(dataUrl);
    }
  });
}

/**
 * Uploads a local track's embedded cover art to Imgur anonymously and returns the direct i.imgur.com URL.
 * Uses DiscordBee's public Imgur client ID.
 */
async function uploadCoverToImgur(dataUrl: string): Promise<string | null> {
  try {
    const compressed = await compressCoverForUpload(dataUrl, 512);
    const base64Data = compressed.replace(/^data:image\/[a-z0-9\-+]+;base64,/, '');
    if (!base64Data || base64Data.length < 50) return null;

    const formData = new FormData();
    formData.append('image', base64Data);
    formData.append('type', 'base64');

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch('https://api.imgur.com/3/upload', {
      method: 'POST',
      headers: {
        'Authorization': 'Client-ID 09bef4c058080cd',
      },
      body: formData,
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const json = await res.json();
      if (json.data && json.data.link) {
        return json.data.link as string;
      }
    }
  } catch (err) {
    console.warn('[Discord RPC] Imgur upload error:', err);
  }
  return null;
}

/**
 * Resolves artwork URL for a track using iTunes and Deezer public APIs if no local cover is found.
 * Falls back to official Arachnid logo URL if not found or offline.
 */
export async function resolveCoverArtUrl(artist: string, title: string, album?: string): Promise<string> {
  const query = `${artist} ${title}`.trim() || album?.trim() || '';
  if (!query) {
    return DEFAULT_LOGO_URL;
  }

  const cacheKey = `online_${query.toLowerCase()}`;
  if (coverArtCache.has(cacheKey)) {
    return coverArtCache.get(cacheKey)!;
  }

  // 1. Try iTunes Search API
  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=1`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(itunesUrl, { signal: ctrl.signal });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results.length > 0 && data.results[0].artworkUrl100) {
        const cover = (data.results[0].artworkUrl100 as string).replace('100x100bb', '512x512bb');
        coverArtCache.set(cacheKey, cover);
        saveCoverArtCache();
        return cover;
      }
    }
  } catch (_) {
    // Continue to Deezer fallback
  }

  // 2. Try Deezer Search API fallback
  try {
    const deezerUrl = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=1`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(deezerUrl, { signal: ctrl.signal });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (data.data && data.data.length > 0 && data.data[0].album?.cover_big) {
        const cover = data.data[0].album.cover_big as string;
        coverArtCache.set(cacheKey, cover);
        saveCoverArtCache();
        return cover;
      }
    }
  } catch (_) {
    // Continue to fallback
  }

  // 3. Official fallback logo
  coverArtCache.set(cacheKey, DEFAULT_LOGO_URL);
  return DEFAULT_LOGO_URL;
}

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
          }
        });
      } catch (err) {
        console.warn('Tauri Discord RPC clear error:', err);
      }
      return;
    }

    // Resolve cover art URL:
    // Priority 1: Direct HTTP/HTTPS link on the track
    // Priority 2: Embedded track coverArt (base64) -> upload to Imgur and get real link!
    // Priority 3: Online iTunes / Deezer search (only if track had no embedded cover art)
    // Priority 4: Official Arachnid player logo
    let resolvedCover: string = DEFAULT_LOGO_URL;

    if (info.coverArt) {
      if (info.coverArt.startsWith('http://') || info.coverArt.startsWith('https://')) {
        resolvedCover = info.coverArt;
      } else if (info.coverArt.startsWith('data:image/')) {
        const coverKey = `emb_${info.trackName}_${info.artist}_${info.coverArt.length}`.toLowerCase();
        if (coverArtCache.has(coverKey)) {
          resolvedCover = coverArtCache.get(coverKey)!;
        } else {
          const imgurLink = await uploadCoverToImgur(info.coverArt);
          if (imgurLink) {
            resolvedCover = imgurLink;
            coverArtCache.set(coverKey, imgurLink);
            saveCoverArtCache();
          }
        }
      }
    }

    // If still fallback and track has no embedded cover, try online search
    if (resolvedCover === DEFAULT_LOGO_URL && (info.artist || info.trackName)) {
      resolvedCover = await resolveCoverArtUrl(info.artist, info.trackName, info.album);
    }

    // If another request came in while resolving cover art, ignore this stale one
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
    // statusMode === 'listening': status_display_type = 2
    // statusMode === 'listening_app': status_display_type = 0
    const statusMode = info.statusMode ?? 'listening_app';
    const statusDisplayType = statusMode === 'listening' ? 2 : 0;

    let clientId = info.customClientId?.trim();
    if (!clientId) {
      clientId = statusMode === 'listening' ? '1129859263741837373' : '1304561842858561637';
    }

    try {
      await tauriCore.invoke('update_discord_presence', {
        presence: {
          enabled: true,
          details: info.trackName || 'Arachnid Music Player',
          state: info.artist || 'Неизвестный исполнитель',
          large_image: resolvedCover,
          large_text: info.album || 'Arachnid Music Player',
          small_image: smallImage,
          small_text: smallText,
          start_timestamp: startTimestamp,
          end_timestamp: endTimestamp,
          status_display_type: statusDisplayType,
          client_id: clientId,
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
