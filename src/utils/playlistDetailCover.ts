export const shouldShowPlaylistDetailCoverFallback = (
  coverSource: string | null | undefined,
  isResolutionPending: boolean,
  hasLoadedCover: boolean,
  failedSource?: string | null,
): boolean => {
  if (isResolutionPending) return false;
  if (!coverSource) return true;
  return !hasLoadedCover && failedSource === coverSource;
};
