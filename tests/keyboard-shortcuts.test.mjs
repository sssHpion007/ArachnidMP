import assert from 'node:assert/strict';
import {
  DEFAULT_KEYBOARD_SHORTCUTS,
  formatShortcut,
  getShortcutSignature,
  matchesShortcut,
  normalizeKeyboardShortcuts,
} from '../src/services/keyboardShortcuts.ts';

assert.equal(DEFAULT_KEYBOARD_SHORTCUTS.playPause.code, 'Space');
assert.equal(formatShortcut(DEFAULT_KEYBOARD_SHORTCUTS.search, 'ru'), 'Ctrl / ⌘ + F');
assert.equal(formatShortcut(DEFAULT_KEYBOARD_SHORTCUTS.lyricsWindow, 'en'), 'Shift + T');

const ctrlArrowRight = DEFAULT_KEYBOARD_SHORTCUTS.nextTrack;
assert.equal(matchesShortcut({ code: 'ArrowRight', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false }, ctrlArrowRight), true);
assert.equal(matchesShortcut({ code: 'ArrowRight', ctrlKey: false, metaKey: true, altKey: false, shiftKey: false }, ctrlArrowRight), true);
assert.equal(matchesShortcut({ code: 'ArrowRight', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false }, ctrlArrowRight), false);
assert.equal(matchesShortcut({ code: 'ArrowRight', ctrlKey: true, metaKey: false, altKey: false, shiftKey: true }, ctrlArrowRight), false);

const restored = normalizeKeyboardShortcuts({
  mute: { code: 'KeyZ', ctrl: true, alt: false, shift: false },
  lyrics: { code: 'Escape', ctrl: false },
});
assert.deepEqual(restored.mute, { code: 'KeyZ', ctrl: true, alt: false, shift: false });
assert.deepEqual(restored.lyrics, DEFAULT_KEYBOARD_SHORTCUTS.lyrics);
assert.deepEqual(restored.shuffle, DEFAULT_KEYBOARD_SHORTCUTS.shuffle);
assert.notEqual(getShortcutSignature(restored.mute), getShortcutSignature(DEFAULT_KEYBOARD_SHORTCUTS.mute));

console.log('Keyboard shortcut mapping tests passed.');
