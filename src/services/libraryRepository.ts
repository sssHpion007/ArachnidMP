import { invoke } from '@tauri-apps/api/core';
import { Track, TrackDetails, TrackPage, TrackSummary } from '../types/music';
import type { LibraryCollectionGroup, LibraryCollectionKind } from './libraryCollectionIndex';

export interface PlaylistCoverQuery {
  playlistId: string;
  trackIds: string[];
  limit: number;
}

export interface PlaylistCoverResult {
  playlistId: string;
  covers: string[];
}

export interface LibraryPageQuery {
  search?: string;
  sortBy: string;
  descending: boolean;
  offset: number;
  limit: number;
  filterKind?: 'album' | 'artist' | 'genre';
  filterValue?: string;
  favoriteOnly?: boolean;
  excludedIds?: string[];
  includeTotal?: boolean;
}

const MAX_PAGE_SIZE = 500;
const MAX_DELETE_BATCH_SIZE = 500;

export interface DeleteTrackFailure {
  trackId: string;
  reason: string;
}

export interface DeleteTracksFromDiskResult {
  deletedTrackIds: string[];
  alreadyMissingTrackIds: string[];
  failures: DeleteTrackFailure[];
}

/** Typed boundary for native catalog access. Keep calls bounded; never request the whole DB by default. */
export const libraryRepository = {
  async count(search?: string): Promise<number> {
    return invoke<number>('library_db_get_count', { search: search?.trim() || null });
  },

  async orderedIds(sortBy: string, descending: boolean, favoriteOnly = false, search?: string): Promise<string[]> {
    return invoke<string[]>('library_db_get_ordered_ids', {
      search: search?.trim() || null,
      sortBy: sortBy || 'title',
      descending,
      favoriteOnly,
    });
  },

  async orderedSubsetIds(
    trackIds: string[],
    search: string,
    sortBy: string,
    descending: boolean,
  ): Promise<string[]> {
    return invoke<string[]>('library_db_order_subset_ids', {
      trackIds,
      search: search.trim() || null,
      sortBy: sortBy || 'custom',
      descending,
    });
  },

  async page(query: LibraryPageQuery): Promise<TrackPage> {
    const limit = Math.max(1, Math.min(MAX_PAGE_SIZE, Math.trunc(query.limit)));
    const offset = Math.max(0, Math.trunc(query.offset));
    return invoke<TrackPage>('library_db_get_page', {
      search: query.search?.trim() || null,
      sortBy: query.sortBy || 'title',
      descending: query.descending,
      offset,
      limit,
      filterKind: query.filterKind || null,
      filterValue: query.filterValue ?? null,
      favoriteOnly: query.favoriteOnly ?? false,
      excludedIds: query.excludedIds ?? [],
      includeTotal: query.includeTotal ?? true,
    });
  },

  async collectionGroups(
    kind: LibraryCollectionKind,
    language: string,
    search?: string,
    excludedIds: string[] = [],
    includeTrackIds = true,
  ): Promise<LibraryCollectionGroup[]> {
    return invoke<LibraryCollectionGroup[]>('library_db_get_collection_groups', {
      kind,
      language,
      search: search?.trim() || null,
      excludedIds,
      includeTrackIds,
    });
  },

  async details(trackId: string): Promise<TrackDetails | null> {
    return invoke<TrackDetails | null>('library_db_get_details', { trackId });
  },

  async existingPathIds(paths: string[]): Promise<string[]> {
    const ids: string[] = [];
    for (let start = 0; start < paths.length; start += 500) {
      ids.push(...await invoke<string[]>('library_db_get_path_ids', { paths: paths.slice(start, start + 500) }));
    }
    return ids;
  },

  async byPaths(paths: string[]): Promise<TrackSummary[]> {
    const rows: TrackSummary[] = [];
    for (let start = 0; start < paths.length; start += 500) {
      rows.push(...await invoke<TrackSummary[]>('library_db_get_by_paths', { paths: paths.slice(start, start + 500) }));
    }
    return rows;
  },

  async byIds(trackIds: string[]): Promise<TrackSummary[]> {
    if (trackIds.length === 0) return [];
    const rows: TrackSummary[] = [];
    for (let start = 0; start < trackIds.length; start += 500) {
      rows.push(...await invoke<TrackSummary[]>('library_db_get_by_ids', { trackIds: trackIds.slice(start, start + 500) }));
    }
    return rows;
  },

  async byIdsPage(trackIds: string[], offset: number, limit = 500): Promise<TrackSummary[]> {
    const selectedIds = trackIds.slice(offset, offset + Math.min(500, limit));
    return this.byIds(selectedIds);
  },

  async playlistCovers(playlists: PlaylistCoverQuery[]): Promise<PlaylistCoverResult[]> {
    return invoke<PlaylistCoverResult[]>('library_db_get_playlist_covers', { playlists });
  },

  async upsertBatch(tracks: Track[]): Promise<number> {
    let upserted = 0;
    for (let start = 0; start < tracks.length; start += 128) {
      const batch = tracks.slice(start, start + 128).map(({ localFile: _localFile, ...track }) => track);
      upserted += await invoke<number>('library_db_upsert_batch', { tracks: batch });
    }
    return upserted;
  },

  async mergeSummary(
    trackIds: string[],
    patch: Omit<Partial<TrackSummary>, 'genre' | 'coverArt'> & { genre?: string | null; coverArt?: string | null },
  ): Promise<void> {
    if (trackIds.length === 0 || Object.keys(patch).length === 0) return;
    for (let start = 0; start < trackIds.length; start += 500) {
      await invoke('library_db_merge_summary', {
        trackIds: trackIds.slice(start, start + 500),
        patch,
      });
    }
  },

  async mergeDetails(trackIds: string[], details: Partial<TrackDetails>): Promise<void> {
    if (Object.keys(details).length === 0) return;
    for (let start = 0; start < trackIds.length; start += 500) {
      await invoke('library_db_merge_details', { trackIds: trackIds.slice(start, start + 500), details });
    }
  },

  async setFavorites(trackIds: string[], favorite: boolean): Promise<void> {
    for (let start = 0; start < trackIds.length; start += 500) {
      await invoke('library_db_set_favorites', { trackIds: trackIds.slice(start, start + 500), favorite });
    }
  },

  async setMissing(trackIds: string[], missing: boolean): Promise<void> {
    for (let start = 0; start < trackIds.length; start += 500) {
      await invoke('library_db_set_missing', { trackIds: trackIds.slice(start, start + 500), missing });
    }
  },

  async deleteFilesFromDisk(trackIds: string[]): Promise<DeleteTracksFromDiskResult> {
    const uniqueIds = [...new Set(trackIds)];
    const result: DeleteTracksFromDiskResult = {
      deletedTrackIds: [],
      alreadyMissingTrackIds: [],
      failures: [],
    };

    for (let start = 0; start < uniqueIds.length; start += MAX_DELETE_BATCH_SIZE) {
      const batch = uniqueIds.slice(start, start + MAX_DELETE_BATCH_SIZE);
      try {
        const batchResult = await invoke<DeleteTracksFromDiskResult>('delete_files_from_disk', {
          trackIds: batch,
        });
        result.deletedTrackIds.push(...batchResult.deletedTrackIds);
        result.alreadyMissingTrackIds.push(...batchResult.alreadyMissingTrackIds);
        result.failures.push(...batchResult.failures);
      } catch (error) {
        result.failures.push(...batch.map(trackId => ({ trackId, reason: String(error) })));
      }
    }

    return result;
  },

  async delete(trackIds: string[]): Promise<void> {
    for (let start = 0; start < trackIds.length; start += 500) {
      await invoke('library_db_delete_ids', { trackIds: trackIds.slice(start, start + 500) });
    }
  },
};

/** Hydrate a lightweight row only when it becomes the active playback/detail record. */
export async function hydrateTrackDetails(summary: TrackSummary): Promise<Track> {
  const details = await libraryRepository.details(summary.id);
  return details ? { ...summary, ...details } : summary;
}
