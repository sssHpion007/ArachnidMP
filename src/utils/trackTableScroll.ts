export const TRACK_TABLE_OVERSCAN = 12;

/** Keep the first surviving visible row at the same screen position after rows are removed. */
export const preserveTrackTableScrollAfterDelete = (
  scrollTop: number,
  rowHeight: number,
  deletedTrackIndices: number[],
): number => {
  const safeScrollTop = Number.isFinite(scrollTop) ? Math.max(0, scrollTop) : 0;
  if (!Number.isFinite(rowHeight) || rowHeight <= 0 || deletedTrackIndices.length === 0) return safeScrollTop;

  const firstVisibleIndex = Math.floor(safeScrollTop / rowHeight);
  const removedAboveViewport = new Set(
    deletedTrackIndices.filter(index => Number.isInteger(index) && index >= 0 && index < firstVisibleIndex),
  ).size;
  return Math.max(0, safeScrollTop - removedAboveViewport * rowHeight);
};

export const getTrackTableRangeForViewport = (
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  overscan = TRACK_TABLE_OVERSCAN,
): { start: number; end: number } => {
  const safeScrollTop = Number.isFinite(scrollTop) ? Math.max(0, scrollTop) : 0;
  const safeViewportHeight = Number.isFinite(viewportHeight) ? Math.max(0, viewportHeight) : 0;
  const safeRowHeight = Number.isFinite(rowHeight) && rowHeight > 0 ? rowHeight : 54;
  const safeOverscan = Number.isFinite(overscan) ? Math.max(0, Math.trunc(overscan)) : TRACK_TABLE_OVERSCAN;

  return {
    start: Math.max(0, Math.floor(safeScrollTop / safeRowHeight) - safeOverscan),
    end: Math.ceil((safeScrollTop + safeViewportHeight) / safeRowHeight) + safeOverscan,
  };
};
