import type { AppLanguage } from '../i18n';
import type { Track } from '../types/music';

export type LibraryCollectionKind = 'albums' | 'artists' | 'genres';

/**
 * A compact, shared collection index. It intentionally stores track IDs rather
 * than Track objects so the cache does not keep old library snapshots alive.
 */
export interface LibraryCollectionGroup {
  name: string;
  trackIds: string[];
  trackCount?: number;
  coverArt?: string;
  totalDuration: number;
  artist?: string;
  year?: number;
  albumsCount?: number;
}

interface CollectionCacheEntry {
  groups: LibraryCollectionGroup[] | null;
  promise: Promise<LibraryCollectionGroup[]>;
  resolve: (groups: LibraryCollectionGroup[]) => void;
  reject: (error: unknown) => void;
  consumers: number;
  expiryTimer: ReturnType<typeof setTimeout> | null;
}

const CACHE_IDLE_TTL_MS = 60_000;
const CHUNK_BUDGET_MS = 6;
const cacheByTrackArray = new WeakMap<Track[], Map<string, CollectionCacheEntry>>();

function cacheKey(kind: LibraryCollectionKind, language: AppLanguage): string {
  return `${kind}:${language}`;
}

function getEntryMap(tracks: Track[], create: boolean): Map<string, CollectionCacheEntry> | undefined {
  let entries = cacheByTrackArray.get(tracks);
  if (!entries && create) {
    entries = new Map();
    cacheByTrackArray.set(tracks, entries);
  }
  return entries;
}

function removeEntry(tracks: Track[], key: string, entry: CollectionCacheEntry): void {
  const entries = getEntryMap(tracks, false);
  if (entries?.get(key) !== entry) return;
  if (entry.expiryTimer) clearTimeout(entry.expiryTimer);
  entry.expiryTimer = null;
  entries.delete(key);
  if (entries.size === 0) cacheByTrackArray.delete(tracks);
}

function scheduleExpiry(tracks: Track[], key: string, entry: CollectionCacheEntry): void {
  if (entry.expiryTimer) clearTimeout(entry.expiryTimer);
  entry.expiryTimer = setTimeout(
    createExpiryCallback(new WeakRef(tracks), key, entry),
    CACHE_IDLE_TTL_MS,
  );
}

function createExpiryCallback(
  tracksRef: WeakRef<Track[]>,
  key: string,
  entry: CollectionCacheEntry,
): () => void {
  return () => {
    entry.expiryTimer = null;
    const tracks = tracksRef.deref();
    if (tracks && entry.consumers === 0) removeEntry(tracks, key, entry);
  };
}

function getOrCreateEntry(
  tracks: Track[],
  kind: LibraryCollectionKind,
  language: AppLanguage,
): { key: string; entry: CollectionCacheEntry } {
  const key = cacheKey(kind, language);
  const entries = getEntryMap(tracks, true)!;
  const existing = entries.get(key);
  if (existing) return { key, entry: existing };

  let resolve!: (groups: LibraryCollectionGroup[]) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<LibraryCollectionGroup[]>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  const entry: CollectionCacheEntry = {
    groups: null,
    promise,
    resolve,
    reject,
    consumers: 0,
    expiryTimer: null,
  };
  entries.set(key, entry);
  void buildGroupsInChunks(
    tracks,
    kind,
    language,
    () => getEntryMap(tracks, false)?.get(key) === entry && entry.consumers > 0,
  ).then(groups => {
    if (getEntryMap(tracks, false)?.get(key) !== entry) return;
    entry.groups = groups;
    entry.resolve(groups);
    if (entry.consumers === 0) scheduleExpiry(tracks, key, entry);
  }).catch(error => {
    removeEntry(tracks, key, entry);
    entry.reject(error);
  });
  return { key, entry };
}

/** Returns completed data without starting work. Useful for synchronous render reads. */
export function peekLibraryCollectionGroups(
  tracks: Track[],
  kind: LibraryCollectionKind,
  language: AppLanguage,
): LibraryCollectionGroup[] | null {
  const key = cacheKey(kind, language);
  const entry = getEntryMap(tracks, false)?.get(key);
  return entry?.groups ?? null;
}

/**
 * Acquires a shared, on-demand index. Concurrent consumers (full and mini
 * player) share one build. The last consumer starts a bounded warm-cache period.
 */
export function matchesLibraryCollectionSearch(
  kind: LibraryCollectionKind,
  group: LibraryCollectionGroup,
  normalizedQuery: string,
  tracksById: ReadonlyMap<string, Track>,
): boolean {
  const firstTrack = tracksById.get(group.trackIds[0]);
  const fields = [group.name];

  if (kind === 'albums') {
    fields.push(firstTrack?.artist || '', String(firstTrack?.year || ''), firstTrack?.title || '');
    for (let index = 1; index < group.trackIds.length; index++) {
      fields.push(tracksById.get(group.trackIds[index])?.title?.toLowerCase() || '');
    }
  } else if (kind === 'artists') {
    fields.push(firstTrack?.title || '', firstTrack?.album || '');
    for (let index = 1; index < group.trackIds.length; index++) {
      fields.push(tracksById.get(group.trackIds[index])?.title?.toLowerCase() || '');
    }
  } else {
    fields.push(firstTrack?.title || '', firstTrack?.artist || '', firstTrack?.album || '');
    for (let index = 1; index < group.trackIds.length; index++) {
      const track = tracksById.get(group.trackIds[index]);
      fields.push(track?.title?.toLowerCase() || '', track?.artist?.toLowerCase() || '');
    }
  }

  return fields.join(' ').toLowerCase().includes(normalizedQuery);
}

export function acquireLibraryCollectionGroups(
  tracks: Track[],
  kind: LibraryCollectionKind,
  language: AppLanguage,
): {
  groups: LibraryCollectionGroup[] | null;
  promise: Promise<LibraryCollectionGroup[]>;
  release: () => void;
} {
  const { key, entry } = getOrCreateEntry(tracks, kind, language);
  if (entry.expiryTimer) {
    clearTimeout(entry.expiryTimer);
    entry.expiryTimer = null;
  }
  entry.consumers += 1;

  let released = false;
  return {
    groups: entry.groups,
    promise: entry.promise,
    release: () => {
      if (released) return;
      released = true;
      entry.consumers = Math.max(0, entry.consumers - 1);
      if (entry.consumers === 0) {
        if (entry.groups) scheduleExpiry(tracks, key, entry);
        else removeEntry(tracks, key, entry);
      }
    },
  };
}

function buildGroupsInChunks(
  tracks: Track[],
  kind: LibraryCollectionKind,
  language: AppLanguage,
  shouldContinue: () => boolean,
): Promise<LibraryCollectionGroup[]> {
  return new Promise((resolve, reject) => {
    try {
      const groups = new Map<string, LibraryCollectionGroup>();
      const artistAlbumSets = kind === 'artists' ? new Map<string, Set<string>>() : null;
      const genreTrackIds = kind === 'genres' ? new Map<string, Set<string>>() : null;
      const noAlbumLabel = language === 'ru' ? 'Без альбома' : 'No Album';
      const unknownArtistLabel = language === 'ru' ? 'Неизвестный исполнитель' : 'Unknown Artist';
      const noGenreLabel = language === 'ru' ? 'Без жанра' : 'No Genre';
      let index = 0;

      const processChunk = () => {
        if (!shouldContinue()) {
          reject(new Error('Library collection index build cancelled: no active consumers.'));
          return;
        }

        const startedAt = performance.now();
        const chunkStartIndex = index;
        while (index < tracks.length && (index === chunkStartIndex || performance.now() - startedAt < CHUNK_BUDGET_MS)) {
          const track = tracks[index++];
          const duration = track.duration && !Number.isNaN(track.duration) ? track.duration : 0;

          if (kind === 'albums') {
            const name = track.album?.trim() || noAlbumLabel;
            let group = groups.get(name);
            if (!group) {
              group = {
                name,
                trackIds: [],
                coverArt: track.coverArt,
                totalDuration: 0,
                artist: track.artist ? track.artist.trim() : unknownArtistLabel,
                year: track.year,
              };
              groups.set(name, group);
            }
            group.trackIds.push(track.id);
            group.totalDuration += duration;
            if (!group.coverArt && track.coverArt) group.coverArt = track.coverArt;
            if (!group.year && track.year) group.year = track.year;
            continue;
          }

          if (kind === 'artists') {
            const name = track.artist?.trim() || unknownArtistLabel;
            let group = groups.get(name);
            if (!group) {
              group = {
                name,
                trackIds: [],
                coverArt: track.coverArt,
                totalDuration: 0,
                albumsCount: 0,
              };
              groups.set(name, group);
              artistAlbumSets!.set(name, new Set());
            }
            group.trackIds.push(track.id);
            group.totalDuration += duration;
            if (!group.coverArt && track.coverArt) group.coverArt = track.coverArt;
            const albumKey = track.album || 'Unknown';
            const knownAlbums = artistAlbumSets!.get(name)!;
            knownAlbums.add(albumKey);
            group.albumsCount = knownAlbums.size;
            continue;
          }

          const rawGenres = track.genre
            ? track.genre.split(/[,/;\\]+/).map(genre => genre.trim()).filter(Boolean)
            : [];
          const names = rawGenres.length > 0 ? Array.from(new Set(rawGenres)) : [noGenreLabel];
          for (const name of names) {
            let group = groups.get(name);
            if (!group) {
              group = { name, trackIds: [], coverArt: track.coverArt, totalDuration: 0 };
              groups.set(name, group);
              genreTrackIds!.set(name, new Set());
            }
            const seenIds = genreTrackIds!.get(name)!;
            if (!seenIds.has(track.id)) {
              seenIds.add(track.id);
              group.trackIds.push(track.id);
              group.totalDuration += duration;
            }
            if (!group.coverArt && track.coverArt) group.coverArt = track.coverArt;
          }
        }

        if (index < tracks.length) {
          setTimeout(processChunk, 0);
          return;
        }

        const result = Array.from(groups.values());
        if (kind === 'genres') {
          result.sort((a, b) => b.trackIds.length - a.trackIds.length);
        } else {
          const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
          result.sort((a, b) => collator.compare(a.name, b.name));
        }
        resolve(result);
      };

      setTimeout(processChunk, 0);
    } catch (error) {
      reject(error);
    }
  });
}
