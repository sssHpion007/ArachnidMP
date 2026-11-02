import assert from 'node:assert/strict';
import { shouldShowPlaylistDetailCoverFallback } from '../src/utils/playlistDetailCover.ts';

assert.equal(shouldShowPlaylistDetailCoverFallback(undefined, true, false), false, 'do not flash the playlist icon while the next cover is resolving');
assert.equal(shouldShowPlaylistDetailCoverFallback('cover-a', true, true), false, 'keep a loaded cover while a replacement is resolving');
assert.equal(shouldShowPlaylistDetailCoverFallback('cover-b', false, true), false, 'do not show the icon during a cover transition');
assert.equal(shouldShowPlaylistDetailCoverFallback('cover-b', false, false, 'cover-b'), true, 'show the icon if the only resolved cover fails to load');
assert.equal(shouldShowPlaylistDetailCoverFallback('cover-b', false, true, 'cover-b'), false, 'keep the previous valid cover instead of flashing the icon on replacement failure');
assert.equal(shouldShowPlaylistDetailCoverFallback(null, false, false), true, 'show the icon once it is confirmed that no cover exists');

console.log('Playlist detail cover fallback tests passed.');
