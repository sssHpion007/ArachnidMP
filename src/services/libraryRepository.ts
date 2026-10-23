import { invoke } from '@tauri-apps/api/core';
import { Track, TrackDetails, TrackPage, TrackSummary } from '../types/music';

export interface LibraryPageQuery {
  search?: string;
  sortBy: string;
  descending: boolean;
  offset: number;
  limit: number;
}

const MAX_PAGE_SIZE = 500;

export interface LegacyTrackReference {
  id: string;
  path: string;
  isFavorite?: boolean;
  playCount?: number;
  dateAdded?: number;
}

/** Typed boundary for native catalog access. Keep calls bounded; never request the whole DB by default. */
export const libraryRepository = {
  async count(search?: string): Promise<number> {
    return invoke<number>('library_db_get_count', { search: search?.trim() || null });
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
    });
  },

  async details(trackId: string): Promise<TrackDetails | null> {
    return invoke<TrackDetails | null>('library_db_get_details', { trackId });
  },

  async byIds(trackIds: string[]): Promise<TrackSummary[]> {
    if (trackIds.length === 0) return [];
    return invoke<TrackSummary[]>('library_db_get_by_ids', { trackIds });
  },

  async seedLegacyTrackMap(tracks: LegacyTrackReference[]): Promise<number> {
    if (tracks.length === 0) return 0;
    return invoke<number>('library_db_seed_legacy_track_map', { tracks });
  },

  async upsertBatch(tracks: Track[] | TrackSummary[]): Promise<number> {
    if (tracks.length === 0) return 0;
    return invoke<number>('library_db_upsert_batch', { tracks });
  },

  async setFavorites(trackIds: string[], favorite: boolean): Promise<void> {
    if (trackIds.length === 0) return;
    await invoke('library_db_set_favorites', { trackIds, favorite });
  },

  async delete(trackIds: string[]): Promise<void> {
    if (trackIds.length === 0) return;
    await invoke('library_db_delete_ids', { trackIds });
  },
};

/** Hydrate a lightweight row only when it becomes the active playback/detail record. */
export async function hydrateTrackDetails(summary: TrackSummary): Promise<Track> {
  const details = await libraryRepository.details(summary.id);
  return details ? { ...summary, ...details } : summary;
}
