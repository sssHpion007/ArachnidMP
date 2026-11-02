export interface ShortcutBinding {
  code: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
}

export const SHORTCUT_IDS = [
  'playPause', 'nextTrack', 'previousTrack', 'seekBackward', 'seekForward',
  'volumeUp', 'volumeDown', 'mute', 'shuffle', 'repeat', 'toggleQueue',
  'clearQueue', 'toggleDiscord', 'lyrics', 'lyricsWindow', 'miniPlayer',
  'search', 'settings', 'equalizer', 'selectAll', 'editTags', 'playSelected',
  'deleteSelected', 'deleteFromDisk',
] as const;

export type ShortcutId = typeof SHORTCUT_IDS[number];
export type KeyboardShortcuts = Record<ShortcutId, ShortcutBinding>;

const binding = (code: string, ctrl = false, shift = false): ShortcutBinding => ({
  code,
  ctrl,
  alt: false,
  shift,
});

export const DEFAULT_KEYBOARD_SHORTCUTS: KeyboardShortcuts = {
  playPause: binding('Space'),
  nextTrack: binding('ArrowRight', true),
  previousTrack: binding('ArrowLeft', true),
  seekBackward: binding('ArrowLeft'),
  seekForward: binding('ArrowRight'),
  volumeUp: binding('ArrowUp', true),
  volumeDown: binding('ArrowDown', true),
  mute: binding('KeyM'),
  shuffle: binding('KeyE'),
  repeat: binding('KeyR'),
  toggleQueue: binding('KeyQ'),
  clearQueue: binding('KeyX'),
  toggleDiscord: binding('KeyD'),
  lyrics: binding('KeyT'),
  lyricsWindow: binding('KeyT', false, true),
  miniPlayer: binding('KeyF'),
  search: binding('KeyF', true),
  settings: binding('Comma', true),
  equalizer: binding('KeyE', true),
  selectAll: binding('KeyA', true),
  editTags: binding('Enter', false, true),
  playSelected: binding('Enter'),
  deleteSelected: binding('Delete'),
  deleteFromDisk: binding('Delete', false, true),
};

export const normalizeKeyboardShortcuts = (value: unknown): KeyboardShortcuts => {
  const result = { ...DEFAULT_KEYBOARD_SHORTCUTS };
  if (!value || typeof value !== 'object') return result;
  const source = value as Record<string, unknown>;
  for (const id of SHORTCUT_IDS) {
    const candidate = source[id];
    if (!candidate || typeof candidate !== 'object') continue;
    const item = candidate as Partial<ShortcutBinding>;
    if (typeof item.code !== 'string' || !/^(Key[A-Z]|Digit[0-9]|Numpad[0-9]|Arrow(Up|Down|Left|Right)|Space|Enter|Delete|Comma|Period|Slash|Semicolon|Quote|BracketLeft|BracketRight|Backslash|Minus|Equal|Backquote|Home|End|PageUp|PageDown|Insert)$/.test(item.code)) continue;
    result[id] = {
      code: item.code,
      ctrl: item.ctrl === true,
      alt: item.alt === true,
      shift: item.shift === true,
    };
  }
  return result;
};

export const matchesShortcut = (event: Pick<KeyboardEvent, 'code' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'> & Partial<Pick<KeyboardEvent, 'key'>>, shortcut: ShortcutBinding): boolean => {
  const hasCtrlModifier = event.ctrlKey || event.metaKey;
  const expectedKey = shortcut.code.startsWith('Key') ? shortcut.code.slice(3).toLowerCase()
    : shortcut.code.startsWith('Digit') ? shortcut.code.slice(5)
      : shortcut.code === 'Comma' ? ','
        : shortcut.code === 'Period' ? '.'
          : shortcut.code === 'Slash' ? '/'
            : shortcut.code === 'Semicolon' ? ';'
              : shortcut.code === 'Quote' ? "'"
                : shortcut.code === 'BracketLeft' ? '['
                  : shortcut.code === 'BracketRight' ? ']'
                    : shortcut.code === 'Backslash' ? '\\'
                      : shortcut.code === 'Minus' ? '-'
                        : shortcut.code === 'Equal' ? '='
                          : shortcut.code === 'Backquote' ? '`'
                            : shortcut.code === 'Space' ? ' '
                              : null;
  const keyMatches = event.code === shortcut.code || (!!expectedKey && event.key?.toLowerCase() === expectedKey);
  return keyMatches &&
    hasCtrlModifier === shortcut.ctrl &&
    event.altKey === shortcut.alt &&
    event.shiftKey === shortcut.shift;
};

export const getShortcutSignature = (shortcut: ShortcutBinding): string =>
  `${shortcut.ctrl ? 'C' : ''}${shortcut.alt ? 'A' : ''}${shortcut.shift ? 'S' : ''}:${shortcut.code}`;

export const formatShortcut = (shortcut: ShortcutBinding, language: 'ru' | 'en'): string => {
  const parts: string[] = [];
  if (shortcut.ctrl) parts.push(language === 'ru' ? 'Ctrl / ⌘' : 'Ctrl / ⌘');
  if (shortcut.alt) parts.push('Alt');
  if (shortcut.shift) parts.push(language === 'ru' ? 'Shift' : 'Shift');
  const key = shortcut.code.startsWith('Key') ? shortcut.code.slice(3)
    : shortcut.code.startsWith('Digit') ? shortcut.code.slice(5)
      : shortcut.code === 'Space' ? (language === 'ru' ? 'Пробел' : 'Space')
        : shortcut.code === 'Comma' ? ','
          : shortcut.code === 'Period' ? '.'
            : shortcut.code === 'Slash' ? '/'
              : shortcut.code === 'Semicolon' ? ';'
                : shortcut.code === 'Quote' ? "'"
                  : shortcut.code === 'BracketLeft' ? '['
                    : shortcut.code === 'BracketRight' ? ']'
                      : shortcut.code === 'Backslash' ? '\\'
                        : shortcut.code === 'Minus' ? '-'
                          : shortcut.code === 'Equal' ? '='
                            : shortcut.code === 'Backquote' ? '`'
                              : shortcut.code.replace(/^Arrow/, '');
  parts.push(key);
  return parts.join(' + ');
};
