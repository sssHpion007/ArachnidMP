import type { Playlist, PlaylistFolder } from '../types/music';

/**
 * Return a folder's unique track IDs in the same depth-first order as its
 * displayed children, expanding nested folders where they appear.
 */
export function getFolderTrackIds(
  rootFolder: PlaylistFolder,
  folders: PlaylistFolder[],
  playlists: Playlist[],
): string[] {
  const result: string[] = [];
  const seenTrackIds = new Set<string>();
  const visitedFolderIds = new Set<string>();

  const visitFolder = (folderId: string) => {
    if (visitedFolderIds.has(folderId)) return;
    visitedFolderIds.add(folderId);

    const entries = [
      ...folders.flatMap((folder, index) => folder.parentId === folderId ? [{
        type: 'folder' as const,
        item: folder,
        order: folder.order ?? index * 10,
        sequence: index,
      }] : []),
      ...playlists.flatMap((playlist, index) => playlist.folderId === folderId ? [{
        type: 'playlist' as const,
        item: playlist,
        order: playlist.order ?? (folders.length + index) * 10,
        sequence: folders.length + index,
      }] : []),
    ].sort((left, right) => left.order - right.order || left.sequence - right.sequence);

    for (const entry of entries) {
      if (entry.type === 'folder') {
        visitFolder(entry.item.id);
        continue;
      }
      for (const trackId of entry.item.trackIds) {
        if (seenTrackIds.has(trackId)) continue;
        seenTrackIds.add(trackId);
        result.push(trackId);
      }
    }
  };

  visitFolder(rootFolder.id);
  return result;
}
