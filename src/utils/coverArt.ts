const CACHED_COVER_URL = /^(https?:\/\/cover\.localhost|cover:\/\/localhost)\/([a-f0-9]{64})(?:\/(?:original|\d+))?$/i;

/** Select a pre-generated, bounded-size SQLite variant when the URL belongs to the cover cache. */
export function isCachedCoverUrl(cover: string | null | undefined): boolean {
  return !!cover && CACHED_COVER_URL.test(cover);
}

export function coverVariantUrl(cover: string | null | undefined, maxSize: 96 | 256): string | undefined {
  if (!cover) return undefined;
  const match = cover.match(CACHED_COVER_URL);
  return match ? `${match[1]}/${match[2]}/${maxSize}` : cover;
}
