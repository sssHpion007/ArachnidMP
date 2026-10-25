export interface BoundedIndexedCacheOptions {
  /** Maximum number of indexed rows retained at one time. */
  maxItems: number;
}

/**
 * LRU cache for rows addressed by their absolute position in a query result.
 * Range loads are exact, overlapping in-flight rows are shared, and clear()
 * prevents results from an older query generation from repopulating the cache.
 */
export class BoundedIndexedCache<T> {
  private readonly items = new Map<number, T>();
  private readonly pending = new Map<number, Promise<void>>();
  private readonly options: BoundedIndexedCacheOptions;
  private generation = 0;

  constructor(options: BoundedIndexedCacheOptions) {
    if (!Number.isInteger(options.maxItems) || options.maxItems < 1) {
      throw new Error('maxItems must be a positive integer');
    }
    this.options = options;
  }

  get size(): number {
    return this.items.size;
  }

  get cachedIndices(): number[] {
    return [...this.items.keys()].sort((left, right) => left - right);
  }

  get(index: number): T | undefined {
    const item = this.items.get(index);
    if (item === undefined) return undefined;

    // Map insertion order is the LRU order, oldest to newest.
    this.items.delete(index);
    this.items.set(index, item);
    return item;
  }

  getIndexedRows(startIndex: number, endIndex: number): { items: T[]; indices: number[] } {
    this.assertRange(startIndex, endIndex);
    const items: T[] = [];
    const indices: number[] = [];
    for (let index = startIndex; index < endIndex; index += 1) {
      const item = this.get(index);
      if (item === undefined) continue;
      items.push(item);
      indices.push(index);
    }
    return { items, indices };
  }

  async loadRange(
    startIndex: number,
    endIndex: number,
    loader: (offset: number, limit: number) => Promise<readonly T[]>,
  ): Promise<void> {
    this.assertRange(startIndex, endIndex);
    if (startIndex === endIndex) return;

    const generation = this.generation;
    const requests = new Set<Promise<void>>();
    let missingStart: number | null = null;

    const loadMissingRun = (runStart: number, runEnd: number) => {
      const request = Promise.resolve()
        .then(() => loader(runStart, runEnd - runStart))
        .then(rows => {
          if (generation !== this.generation) return;
          rows.forEach((row, offset) => this.set(runStart + offset, row));
        })
        .finally(() => {
          for (let index = runStart; index < runEnd; index += 1) {
            if (this.pending.get(index) === request) this.pending.delete(index);
          }
        });

      for (let index = runStart; index < runEnd; index += 1) {
        this.pending.set(index, request);
      }
      requests.add(request);
    };

    for (let index = startIndex; index <= endIndex; index += 1) {
      const isEnd = index === endIndex;
      const isCached = !isEnd && this.items.has(index);
      const inFlight = !isEnd && this.pending.get(index);
      if (!isEnd && !isCached && !inFlight) {
        if (missingStart === null) missingStart = index;
        continue;
      }

      if (missingStart !== null) {
        loadMissingRun(missingStart, index);
        missingStart = null;
      }
      if (inFlight) requests.add(inFlight);
      if (isCached) this.get(index);
    }

    await Promise.all(requests);
  }

  retainRange(startIndex: number, endIndex: number): void {
    this.assertRange(startIndex, endIndex);
    for (const index of this.items.keys()) {
      if (index < startIndex || index >= endIndex) this.items.delete(index);
    }
  }

  updateItems(update: (item: T) => T): void {
    for (const [index, item] of this.items) {
      this.items.set(index, update(item));
    }
  }

  clear(): void {
    this.generation += 1;
    this.items.clear();
    this.pending.clear();
  }

  private set(index: number, item: T): void {
    this.items.delete(index);
    this.items.set(index, item);
    while (this.items.size > this.options.maxItems) {
      const oldestIndex = this.items.keys().next().value as number | undefined;
      if (oldestIndex === undefined) return;
      this.items.delete(oldestIndex);
    }
  }

  private assertRange(startIndex: number, endIndex: number): void {
    if (!Number.isInteger(startIndex) || startIndex < 0) {
      throw new Error('startIndex must be a non-negative integer');
    }
    if (!Number.isInteger(endIndex) || endIndex < startIndex) {
      throw new Error('endIndex must be an integer greater than or equal to startIndex');
    }
  }
}
