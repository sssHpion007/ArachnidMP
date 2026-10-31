import assert from 'node:assert/strict';
import { arePlaylistDurationMapsEqual } from '../src/utils/playlistDurations.ts';

assert.equal(arePlaylistDurationMapsEqual({ a: 120, b: 45 }, { b: 45, a: 120 }), true, 'key order does not count as a duration change');
assert.equal(arePlaylistDurationMapsEqual({ a: 120 }, { a: 120 }), true, 'unchanged duration preserves the cached value');
assert.equal(arePlaylistDurationMapsEqual({ a: 120 }, { a: 120.0000001 }), true, 'floating-point summation noise does not invalidate the value');
assert.equal(arePlaylistDurationMapsEqual({ a: 120 }, { a: 121 }), false, 'a changed total duration should be applied');
assert.equal(arePlaylistDurationMapsEqual({ a: 120 }, { a: 120, b: 45 }), false, 'adding a playlist changes the duration map');
assert.equal(arePlaylistDurationMapsEqual({ a: 120, b: 45 }, { a: 120 }), false, 'removing a playlist changes the duration map');

console.log('Playlist duration stability tests passed.');
