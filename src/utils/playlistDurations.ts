export type PlaylistDurationMap = Readonly<Record<string, number>>;

/** Keep the existing map identity unless a playlist's calculated duration actually changed. */
export const arePlaylistDurationMapsEqual = (
  current: PlaylistDurationMap,
  next: PlaylistDurationMap,
): boolean => {
  const currentIds = Object.keys(current);
  const nextIds = Object.keys(next);
  return currentIds.length === nextIds.length
    && nextIds.every(id => {
      const currentDuration = current[id];
      const nextDuration = next[id];
      return currentDuration === nextDuration
        || (Number.isFinite(currentDuration) && Number.isFinite(nextDuration)
          && Math.abs(currentDuration - nextDuration) < 0.001);
    });
};
