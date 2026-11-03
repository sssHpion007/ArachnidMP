import assert from 'node:assert/strict';
import { BoundedIndexedCache } from '../src/services/boundedIndexedCache.ts';

const LIBRARY_SIZE = 100_000;
const WINDOW_SIZE = 38;
const cache = new BoundedIndexedCache({ maxItems: 64 });
const requestedRanges = [];

async function loadSyntheticRange(offset, limit) {
  requestedRanges.push({ offset, limit });
  const end = Math.min(LIBRARY_SIZE, offset + limit);
  return Array.from({ length: Math.max(0, end - offset) }, (_, index) => ({
    id: `synthetic-${offset + index}`,
    title: `Track ${String(offset + index).padStart(6, '0')}`,
  }));
}

// A large virtual catalogue fetches only the requested viewport plus its overscan.
await cache.loadRange(0, WINDOW_SIZE, loadSyntheticRange);
assert.deepEqual(requestedRanges, [{ offset: 0, limit: WINDOW_SIZE }]);
assert.equal(cache.size, WINDOW_SIZE);
let window = cache.getIndexedRows(0, WINDOW_SIZE);
assert.equal(window.items.length, WINDOW_SIZE);
assert.equal(window.indices[0], 0);
assert.equal(window.indices.at(-1), WINDOW_SIZE - 1);
assert.equal(window.items.at(-1).id, `synthetic-${WINDOW_SIZE - 1}`);

// Scrolling by one row requests only the newly exposed row, not another DB page.
await cache.loadRange(1, WINDOW_SIZE + 1, loadSyntheticRange);
assert.deepEqual(requestedRanges.at(-1), { offset: WINDOW_SIZE, limit: 1 });
window = cache.getIndexedRows(1, WINDOW_SIZE + 1);
assert.equal(window.items.length, WINDOW_SIZE);
assert.equal(window.indices[0], 1);
assert.equal(window.indices.at(-1), WINDOW_SIZE);
assert.equal(cache.size, WINDOW_SIZE + 1);

// Large jumps fetch exactly the new requested window and stay within the row cap.
await cache.loadRange(50_000, 50_000 + WINDOW_SIZE, loadSyntheticRange);
assert.deepEqual(requestedRanges.at(-1), { offset: 50_000, limit: WINDOW_SIZE });
assert.equal(cache.size <= 64, true);
window = cache.getIndexedRows(50_000, 50_000 + WINDOW_SIZE);
assert.equal(window.items.length, WINDOW_SIZE);
assert.equal(window.indices[0], 50_000);
assert.equal(window.indices.at(-1), 50_000 + WINDOW_SIZE - 1);
cache.retainRange(50_000, 50_000 + WINDOW_SIZE);
assert.equal(cache.size, WINDOW_SIZE);
assert.equal(cache.cachedIndices[0], 50_000);
assert.equal(cache.cachedIndices.at(-1), 50_000 + WINDOW_SIZE - 1);

// Overlapping concurrent windows share rows already being loaded.
cache.clear();
let releaseFirst;
const firstLoader = new Promise(resolve => { releaseFirst = resolve; });
const concurrentRanges = [];
const first = cache.loadRange(100, 110, async (offset, limit) => {
  concurrentRanges.push({ offset, limit });
  return firstLoader;
});
const second = cache.loadRange(105, 115, async (offset, limit) => {
  concurrentRanges.push({ offset, limit });
  return Array.from({ length: limit }, (_, index) => ({ id: `row-${offset + index}` }));
});
await Promise.resolve();
assert.deepEqual(concurrentRanges, [{ offset: 100, limit: 10 }, { offset: 110, limit: 5 }]);
releaseFirst(Array.from({ length: 10 }, (_, index) => ({ id: `row-${100 + index}` })));
await Promise.all([first, second]);
assert.equal(cache.getIndexedRows(100, 115).items.length, 15);

// Clearing on a new query invalidates outstanding responses.
let releaseStale;
const staleLoader = new Promise(resolve => { releaseStale = resolve; });
const staleRequest = cache.loadRange(200, 205, () => staleLoader);
await Promise.resolve();
cache.clear();
releaseStale(Array.from({ length: 5 }, (_, index) => ({ id: `stale-${index}` })));
await staleRequest;
assert.equal(cache.size, 0);

console.log('Bounded indexed cache tests passed with a generated 100k-row catalogue.');
