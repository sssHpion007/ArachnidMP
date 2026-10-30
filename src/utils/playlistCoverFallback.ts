export const shouldShowPlaylistCoverFallback = (
  coverType: string,
  imageSources: readonly string[],
  failedSources: ReadonlySet<string>,
): boolean => coverType === 'icon'
  || imageSources.length === 0
  || imageSources.every(source => failedSources.has(source));
