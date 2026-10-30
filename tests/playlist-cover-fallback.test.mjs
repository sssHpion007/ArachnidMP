import assert from 'node:assert/strict';
import { shouldShowPlaylistCoverFallback } from '../src/utils/playlistCoverFallback.ts';

assert.equal(shouldShowPlaylistCoverFallback('icon', ['cover.jpg'], new Set()), true);
assert.equal(shouldShowPlaylistCoverFallback('first_playlist', [], new Set()), true);
assert.equal(shouldShowPlaylistCoverFallback('first_playlist', ['cover.jpg'], new Set()), false);
assert.equal(shouldShowPlaylistCoverFallback('collage', ['one.jpg', 'two.jpg'], new Set(['one.jpg'])), false);
assert.equal(shouldShowPlaylistCoverFallback('collage', ['one.jpg', 'two.jpg'], new Set(['one.jpg', 'two.jpg'])), true);

console.log('Playlist cover fallback tests passed.');
