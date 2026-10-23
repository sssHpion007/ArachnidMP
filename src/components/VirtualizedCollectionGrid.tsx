import React, { useEffect, useState } from 'react';

interface GridLayout {
  columns: number;
  columnGap: number;
  rowGap: number;
  rowHeight: number;
  gridOffsetTop: number;
}

interface VirtualizedCollectionGridProps<T> {
  items: T[];
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  resetKey: string;
  className: string;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscanRows?: number;
}

const INITIAL_RENDER_COUNT = 24;

export function VirtualizedCollectionGrid<T>({
  items,
  scrollContainerRef,
  resetKey,
  className,
  renderItem,
  overscanRows = 2,
}: VirtualizedCollectionGridProps<T>) {
  const [layout, setLayout] = useState<GridLayout | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const gridRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLayout(null);
    setScrollTop(0);
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [resetKey, items.length, scrollContainerRef]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    const grid = gridRef.current;
    if (!container || !grid) return;

    const measure = () => {
      setScrollTop(container.scrollTop);
      setViewportHeight(container.clientHeight);
      const style = window.getComputedStyle(grid);
      const columns = Math.max(1, style.gridTemplateColumns.split(/\s+/).filter(Boolean).length);
      const firstRowItems = Array.from(grid.children).slice(0, columns) as HTMLElement[];
      const rowHeight = firstRowItems.reduce((height, item) => Math.max(height, item.getBoundingClientRect().height), 0);
      if (rowHeight <= 0) return;

      const nextLayout: GridLayout = {
        columns,
        columnGap: Number.parseFloat(style.columnGap) || 0,
        rowGap: Number.parseFloat(style.rowGap) || 0,
        rowHeight,
        gridOffsetTop: grid.getBoundingClientRect().top - container.getBoundingClientRect().top
          + container.scrollTop - container.clientTop,
      };
      setLayout(current => current
        && current.columns === nextLayout.columns
        && Math.abs(current.columnGap - nextLayout.columnGap) < 0.5
        && Math.abs(current.rowGap - nextLayout.rowGap) < 0.5
        && Math.abs(current.rowHeight - nextLayout.rowHeight) < 1
        && Math.abs(current.gridOffsetTop - nextLayout.gridOffsetTop) < 1
        ? current
        : nextLayout);
    };

    const onScroll = () => setScrollTop(container.scrollTop);
    container.addEventListener('scroll', onScroll, { passive: true });
    measure();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => {
        container.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', measure);
      };
    }

    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(grid);
    return () => {
      container.removeEventListener('scroll', onScroll);
      observer.disconnect();
    };
  }, [items.length, scrollContainerRef, layout === null]);

  const columns = layout?.columns ?? 1;
  const rowCount = Math.ceil(items.length / columns);
  const rowStride = layout ? layout.rowHeight + layout.rowGap : 0;
  const localScrollTop = layout ? Math.max(0, scrollTop - layout.gridOffsetTop) : 0;
  const firstRow = layout
    ? Math.max(0, Math.floor(localScrollTop / rowStride) - overscanRows)
    : 0;
  const lastRow = layout
    ? Math.min(rowCount, Math.ceil((localScrollTop + viewportHeight) / rowStride) + overscanRows)
    : Math.ceil(Math.min(items.length, INITIAL_RENDER_COUNT) / columns);
  const totalHeight = layout && rowCount > 0
    ? rowCount * rowStride - layout.rowGap
    : 0;
  const visibleRows = Array.from({ length: Math.max(0, lastRow - firstRow) }, (_, offset) => firstRow + offset);

  return (
    <div
      ref={gridRef}
      className={className}
      style={layout ? { position: 'relative', height: totalHeight } : undefined}
    >
      {layout ? visibleRows.map(rowIndex => (
        <div
          key={rowIndex}
          className="absolute inset-x-0 grid items-stretch"
          style={{
            top: rowIndex * rowStride,
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            columnGap: layout.columnGap,
            rowGap: 0,
          }}
        >
          {items.slice(rowIndex * columns, (rowIndex + 1) * columns).map((item, columnIndex) => {
            const index = rowIndex * columns + columnIndex;
            return <div key={index} className="min-w-0">{renderItem(item, index)}</div>;
          })}
        </div>
      )) : items.slice(0, INITIAL_RENDER_COUNT).map((item, index) => (
        <div key={index} className="min-w-0">{renderItem(item, index)}</div>
      ))}
    </div>
  );
}
