import * as mm from 'music-metadata-browser';
import { Track } from '../types/music';

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
    localFile: file,
  };
}

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function formatFileSize(bytes?: number): string {
  if (!bytes) return '--';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}
