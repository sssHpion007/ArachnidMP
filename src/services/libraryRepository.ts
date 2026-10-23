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

  async allSummaries(pageSize = MAX_PAGE_SIZE): Promise<TrackSummary[]> {
    const rows: TrackSummary[] = [];
    const total = await this.count();
    for (let offset = 0; offset < total; offset += pageSize) {
      const page = await this.page({ sortBy: 'title', descending: false, offset, limit: pageSize });
      if (page.items.length === 0) break;
      rows.push(...page.items);
    }
    return rows;
  },

  async details(trackId: string): Promise<TrackDetails | null> {
    return invoke<TrackDetails | null>('library_db_get_details', { trackId });
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
    return invoke<TrackSummary[]>('library_db_get_by_ids', { trackIds });
  },

  async upsertBatch(tracks: Track[]): Promise<number> {
    let upserted = 0;
    for (let start = 0; start < tracks.length; start += 128) {
      const batch = tracks.slice(start, start + 128).map(({ localFile: _localFile, ...track }) => track);
      upserted += await invoke<number>('library_db_upsert_batch', { tracks: batch });
    }
    return upserted;
  },

  async mergeDetails(trackIds: string[], details: Partial<TrackDetails>): Promise<void> {
    if (trackIds.length === 0 || Object.keys(details).length === 0) return;
    await invoke('library_db_merge_details', { trackIds, details });
  },

  async setFavorites(trackIds: string[], favorite: boolean): Promise<void> {
    if (trackIds.length === 0) return;
    await invoke('library_db_set_favorites', { trackIds, favorite });
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
