registerPlugin({
  onEnable(api) {
    api.log('Playback logger enabled');
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
    api.log('Playback logger disabled');
  }
});
