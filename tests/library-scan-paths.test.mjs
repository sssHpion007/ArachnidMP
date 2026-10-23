import assert from 'node:assert/strict';
import { buildLibraryScanPathPlan } from '../src/services/libraryScanPaths.ts';

const plan = buildLibraryScanPathPlan(
  ['/Music', '/music/Collections/Live', 'D:\\Audio', 'd:/audio/Live'],
  [
    '/music/Album/one.mp3',
    'C:\\External\\two.mp3',
    'c:/external/TWO.mp3',
    'D:\\Audio\\Live\\three.flac',
  ],
);

assert.deepEqual(plan.roots, ['/Music', 'D:\\Audio']);
assert.deepEqual(plan.uncoveredPlaylistPaths, ['C:\\External\\two.mp3']);
assert.deepEqual(plan.scanPaths, ['/Music', 'D:\\Audio', 'C:\\External\\two.mp3']);
console.log('Library scan path tests passed.');
