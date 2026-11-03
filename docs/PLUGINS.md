# ArachnidMP external plugins

External plugins live beside the portable executable in `plugins/<plugin-id>/`. Create the folder, copy in `manifest.json` and the JavaScript entry file, then open **Settings → Plugins → Refresh**. A plugin runs only after the user explicitly enables and trusts it. Changing either its manifest or entry file requires trust again.

The current plugin API is version 1. Plugins run in a Web Worker. They do not receive the app's Tauri IPC bridge, DOM, or filesystem API. JavaScript workers can still make network requests, so only enable code from a source you trust. The only host event currently available is playback metadata, and it is delivered only when `playback.read` is declared. File paths and cover image data are not sent.

## Package layout

```text
Arachnid-Portable.exe
plugins/
  example-plugin/
    manifest.json
    plugin.js
```

`manifest.json` example:

```json
{
  "id": "example-plugin",
  "name": "Example plugin",
  "version": "1.0.0",
  "description": "Logs the current track when playback changes.",
  "apiVersion": 1,
  "entry": "plugin.js",
  "permissions": ["playback.read"],
  "settings": [
    {
      "key": "prefix",
      "label": "Log prefix",
      "type": "text",
      "default": "Now playing",
      "options": []
    }
  ]
}
```

Supported setting types are `text`, `number`, `boolean`, and `select`. `select` settings require an `options` array of `{ "label": "...", "value": "..." }` objects. Plugin IDs must match the folder name and contain only ASCII letters, digits, hyphens, or underscores. The entry must be a `.js` file directly inside the plugin folder. The API version must be `1`.

`plugin.js` example:

```js
registerPlugin({
  onEnable(api) {
    api.log('Example plugin enabled');
  },

  onPlaybackChanged(playback, api) {
    if (!playback.track) return;
    const prefix = api.getSettings().prefix || 'Now playing';
    api.log(prefix + ': ' + playback.track.artist + ' — ' + playback.track.title);
  },

  onSettingsChanged(settings, api) {
    api.log('Settings changed', settings);
  },

  onDisable(api) {
    api.log('Example plugin disabled');
  }
});
```

The host API currently provides `api.apiVersion`, `api.getSettings()`, and `api.log(...values)`. Playback events contain `track` (`title`, `artist`, `album`, `duration`) or `null`, `isPlaying`, and `currentTime`. Playback updates are throttled and are not sent unless the manifest requests `playback.read`.

The built-in Discord RPC is shown in the same manager, but remains on the existing native integration path. Its existing behavior, preferences, quick toggles, and settings are intentionally preserved while the external plugin API matures.
