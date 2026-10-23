const normalizePath = (path: string): string => path.trim().replace(/\\/g, '/').toLowerCase().replace(/\/+$/, '');

const containsPath = (path: string, root: string): boolean =>
  path === root || path.startsWith(`${root}/`);

export interface LibraryScanPathPlan {
  roots: string[];
  uncoveredPlaylistPaths: string[];
  scanPaths: string[];
}

/** Keep file references out of directory scans when a configured root already covers them. */
export function buildLibraryScanPathPlan(scanRoots: string[], playlistPaths: string[]): LibraryScanPathPlan {
  const uniqueRoots = new Map<string, string>();
  for (const root of scanRoots) {
    const normalized = normalizePath(root);
    if (normalized && !uniqueRoots.has(normalized)) uniqueRoots.set(normalized, root);
  }
  const allRoots = [...uniqueRoots.entries()];
  const roots = allRoots
    .filter(([candidate]) => !allRoots.some(([parent]) => parent !== candidate && containsPath(candidate, parent)))
    .map(([, original]) => original);
  const normalizedRoots = roots.map(normalizePath);
  const uniquePlaylistPaths = new Map<string, string>();
  for (const path of playlistPaths) {
    const normalized = normalizePath(path);
    if (normalized && !uniquePlaylistPaths.has(normalized)) uniquePlaylistPaths.set(normalized, path);
  }
  const uncoveredPlaylistPaths = [...uniquePlaylistPaths.entries()]
    .filter(([path]) => !normalizedRoots.some(root => containsPath(path, root)))
    .map(([, original]) => original);

  return { roots, uncoveredPlaylistPaths, scanPaths: [...roots, ...uncoveredPlaylistPaths] };
}
