import assert from 'node:assert/strict';
import {
  getTrackTableRangeForViewport,
  preserveTrackTableScrollAfterDelete,
  TRACK_TABLE_OVERSCAN,
} from '../src/utils/trackTableScroll.ts';

assert.equal(TRACK_TABLE_OVERSCAN, 12);
assert.equal(preserveTrackTableScrollAfterDelete(1003, 50, [2, 18, 20, 24]), 903);
assert.equal(preserveTrackTableScrollAfterDelete(503, 50, [8, 9]), 403);
assert.equal(preserveTrackTableScrollAfterDelete(503, 50, [10, 11]), 503);
assert.equal(preserveTrackTableScrollAfterDelete(20, 50, [0]), 20);
assert.equal(preserveTrackTableScrollAfterDelete(100, 0, [0]), 100);
assert.deepEqual(getTrackTableRangeForViewport(1000, 500, 50), { start: 8, end: 42 });

console.log('Track table scroll preservation tests passed.');
