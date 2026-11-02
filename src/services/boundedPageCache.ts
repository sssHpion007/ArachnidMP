export interface BoundedPageCacheOptions {
  /** Maximum number of complete pages retained at one time. */
  maxPages: number;
}

/**
 * Small LRU cache for paged data. Scope one instance to one query/filter generation;
 * call clear() when the query changes. Concurrent requests for the same page share work.
 */
export class BoundedPageCache<T> {
  private readonly pages = new Map<number, readonly T[]>();
  private readonly pending = new Map<number, Promise<readonly T[]>>();
  private readonly options: BoundedPageCacheOptions;
  private generation = 0;

  constructor(options: BoundedPageCacheOptions) {
    if (!Number.isInteger(options.maxPages) || options.maxPages < 1) {
      throw new Error('maxPages must be a positive integer');
    }
    this.options = options;
  }

  get size(): number {
    return this.pages.size;
  }

  get cachedPageIndices(): number[] {
    return [...this.pages.keys()];
  }

  get(pageIndex: number): readonly T[] | undefined {
    const page = this.pages.get(pageIndex);
    if (!page) return undefined;

    // Map insertion order is the LRU order, oldest to newest.
    this.pages.delete(pageIndex);
    this.pages.set(pageIndex, page);
    return page;
  }

  getIndexedRows(pageSize: number): { items: T[]; indices: number[] } {
    if (!Number.isInteger(pageSize) || pageSize < 1) {
      throw new Error('pageSize must be a positive integer');
    }
    const items: T[] = [];
    const indices: number[] = [];
    const pageIndices = this.cachedPageIndices.sort((left, right) => left - right);
    for (const pageIndex of pageIndices) {
      const page = this.get(pageIndex) ?? [];
      page.forEach((item, rowIndex) => {
        items.push(item);
        indices.push(pageIndex * pageSize + rowIndex);
      });
    }
    return { items, indices };
  }

  set(pageIndex: number, items: readonly T[]): readonly T[] {
    this.assertPageIndex(pageIndex);
    const page = items.slice();
    this.pages.delete(pageIndex);
    this.pages.set(pageIndex, page);
    this.evictOldestPages();
    return page;
  }

  updateItems(update: (item: T) => T): void {
    for (const [pageIndex, page] of this.pages) {
      this.pages.set(pageIndex, page.map(update));
    }
  }

  async getOrLoad(pageIndex: number, loader: () => Promise<readonly T[]>): Promise<readonly T[]> {
    this.assertPageIndex(pageIndex);
    const cached = this.get(pageIndex);
    if (cached) return cached;

    const pending = this.pending.get(pageIndex);
    if (pending) return pending;

    const generation = this.generation;
    const request = loader().then(items => {
      // A response from a prior search/sort generation must not repopulate the cache.
      if (generation === this.generation) return this.set(pageIndex, items);
      return items.slice();
    }).finally(() => {
      if (this.pending.get(pageIndex) === request) this.pending.delete(pageIndex);
    });
    this.pending.set(pageIndex, request);
    return request;
  }

  clear(): void {
    this.generation += 1;
    this.pages.clear();
    this.pending.clear();
  }

  private evictOldestPages(): void {
    while (this.pages.size > this.options.maxPages) {
      const oldestPageIndex = this.pages.keys().next().value as number | undefined;
      if (oldestPageIndex === undefined) return;
      this.pages.delete(oldestPageIndex);
    }
  }

  private assertPageIndex(pageIndex: number): void {
    if (!Number.isInteger(pageIndex) || pageIndex < 0) {
      throw new Error('pageIndex must be a non-negative integer');
    }
  }
}
