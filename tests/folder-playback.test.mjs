import assert from 'node:assert/strict';
import { getFolderTrackIds } from '../src/services/folderPlayback.ts';

const root = { id: 'root', name: 'Root', createdAt: 1 };
const folders = [
  root,
  { id: 'nested', name: 'Nested', parentId: 'root', order: 20, createdAt: 2 },
  { id: 'deep', name: 'Deep', parentId: 'nested', order: 20, createdAt: 3 },
];
const playlists = [
  { id: 'later', name: 'Later', folderId: 'root', order: 30, trackIds: ['b', 'a'] },
  { id: 'first', name: 'First', folderId: 'root', order: 10, trackIds: ['a', 'shared'] },
  { id: 'nested-list', name: 'Nested list', folderId: 'nested', order: 10, trackIds: ['n', 'shared'] },
  { id: 'deep-list', name: 'Deep list', folderId: 'deep', order: 10, trackIds: ['d'] },
];

assert.deepEqual(
  getFolderTrackIds(root, folders, playlists),
  ['a', 'shared', 'n', 'd', 'b'],
  'folder playback follows displayed order, expands nested folders depth-first, and queues each track once',
);

assert.deepEqual(
  getFolderTrackIds(folders[1], folders, playlists),
  ['n', 'shared', 'd'],
  'playing a nested folder excludes tracks from its parent and siblings',
);

console.log('Folder playback order tests passed.');
