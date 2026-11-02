export const shouldShowPlaylistCoverFallback = (
  coverType: string,
  imageSources: readonly string[],
  failedSources: ReadonlySet<string>,
  isCoverResolutionPending = false,
): boolean => {
  if (coverType !== 'icon' && isCoverResolutionPending) return false;
  return coverType === 'icon'
    || imageSources.length === 0
    || imageSources.every(source => failedSources.has(source));
};
