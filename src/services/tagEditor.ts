import * as mm from 'music-metadata-browser';
import { Track } from '../types/music';
import { isTauri, invoke } from '@tauri-apps/api/core';

export const getAudioFormatFromPath = (path?: string): string | undefined => {
  if (!path) return undefined;
  const cleanPath = path.split(/[?#]/, 1)[0];
  const extension = cleanPath.match(/\.([a-z0-9]{1,8})$/i)?.[1];
  return extension?.toUpperCase();
};

export async function parseAudioFile(file: File): Promise<Track> {
  const fileUrl = URL.createObjectURL(file);
  let title = file.name.replace(/\.[^/.]+$/, '');
  let artist = 'Unknown Artist';
  let album = 'Unknown Album';
  let duration = 0;
  let coverArt: string | undefined = undefined;
  let genre: string | undefined = undefined;
  let year: number | undefined = undefined;
  let trackNumber: number | undefined = undefined;
  let bitrate: number | undefined = undefined;
  let lyrics: string | undefined = undefined;

  try {
    const metadata = await mm.parseBlob(file);
    if (metadata.common.title) title = metadata.common.title;
    if (metadata.common.artist) artist = metadata.common.artist;
    if (metadata.common.album) album = metadata.common.album;
    if (metadata.format.duration) duration = metadata.format.duration;
    if (metadata.common.genre && metadata.common.genre.length > 0) {
      genre = metadata.common.genre.join(', ');
    }
    if (metadata.common.year) year = metadata.common.year;
    if (metadata.common.track && metadata.common.track.no) {
      trackNumber = metadata.common.track.no;
    }
    if (metadata.format.bitrate) {
      bitrate = Math.round(metadata.format.bitrate / 1000);
    }
    if (metadata.common.lyrics && metadata.common.lyrics.length > 0) {
      const lyrItem: any = metadata.common.lyrics[0];
      lyrics = typeof lyrItem === 'string' ? lyrItem : lyrItem?.text;
    }

    // Extract cover image if present as persistent Data URI
    if (metadata.common.picture && metadata.common.picture.length > 0) {
      const pic = metadata.common.picture[0];
      try {
        let mime = pic.format || 'image/jpeg';
        if (!mime.includes('/')) {
          mime = `image/${mime}`;
        }
        const bytes = new Uint8Array(pic.data);
        let binary = '';
        const len = bytes.byteLength;
        const chunkSize = 8192;
        for (let i = 0; i < len; i += chunkSize) {
          const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
          binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
        }
        const b64 = btoa(binary);
        coverArt = `data:${mime};base64,${b64}`;
      } catch (err) {
        console.warn('Failed to convert album picture to Data URI:', err);
      }
    }
  } catch (err) {
    console.warn(`Could not parse ID3 metadata for ${file.name}, using defaults:`, err);
  }

  // If duration wasn't parsed from tags, get it from Audio element
  if (!duration || duration === 0) {
    try {
      duration = await new Promise<number>((resolve) => {
        const tempAudio = new Audio();
        tempAudio.src = fileUrl;
        tempAudio.onloadedmetadata = () => resolve(tempAudio.duration || 0);
        tempAudio.onerror = () => resolve(0);
      });
    } catch {
      duration = 0;
    }
  }

  const format = file.name.split('.').pop()?.toUpperCase() || 'AUDIO';

  return {
    id: `track_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    title,
    artist,
    album,
    duration,
    src: fileUrl,
    coverArt,
    genre,
    year,
    trackNumber,
    bitrate,
    format,
    fileSize: file.size,
    dateAdded: Date.now(),
    playCount: 0,
    isFavorite: false,
    lyrics: lyrics || undefined,
    localFile: file,
  };
}

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const totalSecs = Math.floor(seconds);
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  if (hours > 0) {
    return `${hours}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function formatFileSize(bytes?: number): string {
  if (!bytes) return '--';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

export async function downloadCoverImage(coverUrl: string, defaultName?: string): Promise<boolean> {
  if (!coverUrl) return false;

  let finalDataUrl = coverUrl;
  if (coverUrl.startsWith('blob:') || coverUrl.startsWith('http')) {
    try {
      const resp = await fetch(coverUrl);
      const blob = await resp.blob();
      finalDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn('Failed to convert cover URL to data URL:', e);
    }
  }

  const cleanName = defaultName
    ? defaultName.replace(/[\\/:*?"<>|]/g, '_').trim()
    : 'cover';

  if (isTauri() && finalDataUrl.startsWith('data:')) {
    try {
      const savedPath = await invoke<string | null>('save_cover_image', {
        dataUrl: finalDataUrl,
        defaultFilename: cleanName,
      });
      if (savedPath) {
        return true;
      }
      return false;
    } catch (e) {
      console.warn('Native save_cover_image failed, falling back to browser download:', e);
    }
  }

  // Web fallback: <a download>
  let ext = 'jpg';
  if (finalDataUrl.startsWith('data:image/png')) ext = 'png';
  else if (finalDataUrl.startsWith('data:image/webp')) ext = 'webp';
  else if (finalDataUrl.startsWith('data:image/gif')) ext = 'gif';

  const link = document.createElement('a');
  link.href = finalDataUrl;
  link.download = `${cleanName}.${ext}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return true;
}
