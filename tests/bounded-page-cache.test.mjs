import assert from 'node:assert/strict';
import { BoundedPageCache } from '../src/services/boundedPageCache.ts';

const PAGE_SIZE = 250;
const SYNTHETIC_LIBRARY_SIZE = 100_000;
const cache = new BoundedPageCache({ maxPages: 4 });
let loaderCalls = 0;

async function loadSyntheticPage(pageIndex) {
  loaderCalls += 1;
  const start = pageIndex * PAGE_SIZE;
  const end = Math.min(SYNTHETIC_LIBRARY_SIZE, start + PAGE_SIZE);
  return Array.from({ length: Math.max(0, end - start) }, (_, offset) => {
    const id = start + offset;
    return {
      id: `synthetic-${id}`,
      path: `Z:/synthetic-library/album-${Math.floor(id / 12)}/track-${id}.flac`,
      title: `Track ${String(id).padStart(6, '0')}`,
      artist: `Artist ${Math.floor(id / 100)}`,
      album: `Album ${Math.floor(id / 12)}`,
      duration: 180 + (id % 240),
      coverArt: null,
    };
  });
}

// Walk a 100k-row synthetic catalogue while retaining only four pages.
for (let pageIndex = 0; pageIndex < SYNTHETIC_LIBRARY_SIZE / PAGE_SIZE; pageIndex += 1) {
  const page = await cache.getOrLoad(pageIndex, () => loadSyntheticPage(pageIndex));
  assert.equal(page.length, PAGE_SIZE);
  assert.equal(cache.size <= 4, true);
}
assert.equal(cache.size, 4);
assert.deepEqual(cache.cachedPageIndices, [396, 397, 398, 399]);
const indexedWindow = cache.getIndexedRows(PAGE_SIZE);
assert.equal(indexedWindow.items.length, 4 * PAGE_SIZE);
assert.equal(indexedWindow.indices.length, indexedWindow.items.length);
assert.equal(indexedWindow.indices[0], 99_000);
assert.equal(indexedWindow.indices.at(-1), 99_999);
assert.equal(indexedWindow.items[0].id, 'synthetic-99000');
assert.equal(cache.get(399)?.[0]?.id, 'synthetic-99750');
cache.updateItems(row => row.id === 'synthetic-99999' ? { ...row, isMissing: true } : row);
assert.equal(cache.get(399)?.[249]?.isMissing, true);
assert.equal(cache.get(0), undefined);

// Cache hits do not reload, and the LRU page is the one evicted next.
const beforeHit = loaderCalls;
await cache.getOrLoad(399, () => loadSyntheticPage(399));
assert.equal(loaderCalls, beforeHit);
await cache.getOrLoad(400, () => loadSyntheticPage(400));
assert.deepEqual(cache.cachedPageIndices, [397, 398, 399, 400]);
assert.equal(cache.size, 4);

// Concurrent requests for the same uncached page share the underlying query.
cache.clear();
let releaseLoader;
let concurrentLoaderCalls = 0;
const loaderPromise = new Promise(resolve => { releaseLoader = resolve; });
const loader = () => {
  concurrentLoaderCalls += 1;
  return loaderPromise;
};
const firstRequest = cache.getOrLoad(7, loader);
const secondRequest = cache.getOrLoad(7, loader);
assert.equal(concurrentLoaderCalls, 1);
releaseLoader([{ id: 'shared-page-row' }]);
const [firstPage, secondPage] = await Promise.all([firstRequest, secondRequest]);
assert.equal(firstPage, secondPage);
assert.equal(cache.size, 1);

// Clearing for a new search/sort generation prevents an in-flight old result from being cached.
let releaseStaleLoader;
const stalePromise = new Promise(resolve => { releaseStaleLoader = resolve; });
const staleRequest = cache.getOrLoad(8, () => stalePromise);
cache.clear();
releaseStaleLoader([{ id: 'stale-result' }]);
await staleRequest;
assert.equal(cache.get(8), undefined);
assert.equal(cache.size, 0);

console.log('Bounded page cache tests passed with a generated 100k-row catalogue.');
