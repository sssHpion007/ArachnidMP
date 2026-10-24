import assert from 'node:assert/strict';
import {
  acquireLibraryCollectionGroups,
  matchesLibraryCollectionSearch,
} from '../src/services/libraryCollectionIndex.ts';

const tracks = [
  {
    id: 'a1', title: 'First Song', artist: 'Artist A', album: 'Album A', duration: 100,
    src: 'a1.mp3', coverArt: 'cover-a', genre: 'Rock, Jazz', year: 2020,
    dateAdded: 1, playCount: 0, isFavorite: false,
  },
  {
    id: 'a2', title: 'Second Song', artist: 'Artist A', album: 'Album A', duration: 200,
    src: 'a2.mp3', coverArt: undefined, genre: 'Rock / Rock', year: 2021,
    dateAdded: 2, playCount: 0, isFavorite: false,
  },
  {
    id: 'b1', title: 'Third Song', artist: 'Artist B', album: 'Album B', duration: 0,
    src: 'b1.mp3', coverArt: 'cover-b', genre: '', year: undefined,
    dateAdded: 3, playCount: 0, isFavorite: false,
  },
];

// Two player modes requesting the same library/category must join one build.
const fullAlbums = acquireLibraryCollectionGroups(tracks, 'albums', 'en');
const miniAlbums = acquireLibraryCollectionGroups(tracks, 'albums', 'en');
assert.equal(fullAlbums.promise, miniAlbums.promise, 'full and mini modes share the in-flight album index');
const albums = await fullAlbums.promise;
assert.deepEqual(albums.map(group => [group.name, group.trackIds, group.totalDuration]), [
  ['Album A', ['a1', 'a2'], 300],
  ['Album B', ['b1'], 0],
]);
assert.equal(albums[0].coverArt, 'cover-a');
assert.equal(albums[0].artist, 'Artist A');
assert.equal(albums[0].year, 2020);
assert.equal('tracks' in albums[0], false, 'the shared index stores IDs, not duplicate Track objects');

const artists = await acquireLibraryCollectionGroups(tracks, 'artists', 'ru').promise;
assert.deepEqual(artists.map(group => [group.name, group.trackIds, group.albumsCount]), [
  ['Artist A', ['a1', 'a2'], 1],
  ['Artist B', ['b1'], 1],
]);

const genres = await acquireLibraryCollectionGroups(tracks, 'genres', 'en').promise;
assert.deepEqual(genres.map(group => [group.name, group.trackIds]), [
  ['Rock', ['a1', 'a2']],
  ['Jazz', ['a1']],
  ['No Genre', ['b1']],
]);

const tracksById = new Map(tracks.map(track => [track.id, track]));
assert.equal(matchesLibraryCollectionSearch('albums', albums[0], 'artist a 2020 first song second song', tracksById), true);
assert.equal(matchesLibraryCollectionSearch('artists', artists[0], 'artist a first song album a second song', tracksById), true);
assert.equal(matchesLibraryCollectionSearch('genres', genres[0], 'rock first song artist a album a second song artist a', tracksById), true);

const cancelTracks = tracks.slice();
const abandonedBuild = acquireLibraryCollectionGroups(cancelTracks, 'artists', 'en');
abandonedBuild.release();
await assert.rejects(abandonedBuild.promise, /cancelled/);
const replacementBuild = acquireLibraryCollectionGroups(cancelTracks, 'artists', 'en');
assert.deepEqual((await replacementBuild.promise).map(group => group.name), ['Artist A', 'Artist B']);

console.log('Shared library collection index tests passed.');
