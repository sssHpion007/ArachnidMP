import { invoke, isTauri } from '@tauri-apps/api/core';

export type PluginSettingType = 'text' | 'number' | 'boolean' | 'select';

export interface PluginSettingOption {
  label: string;
  value: string | number | boolean;
}

export interface ExternalPluginSetting {
  key: string;
  label: string;
  type: PluginSettingType;
  default: string | number | boolean | null;
  options: PluginSettingOption[];
}

export interface ExternalPluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  apiVersion: number;
  entry: string;
  fingerprint: string;
  permissions: string[];
  settings: ExternalPluginSetting[];
}

export interface PluginPreference {
  enabled: boolean;
  trustedFingerprint: string | null;
  settings: Record<string, unknown>;
}

export interface PluginPreferencesFile {
  plugins: Record<string, PluginPreference>;
}

export interface PluginPlaybackSnapshot {
  track: {
    title: string;
    artist: string;
    album: string;
    duration: number;
    coverArt?: string;
  } | null;
  isPlaying: boolean;
  currentTime: number;
}

export type PluginRuntimeState = 'stopped' | 'starting' | 'running' | 'error';
export interface PluginRuntimeEvent {
  pluginId: string;
  state: PluginRuntimeState;
  message?: string;
}

const EMPTY_PREFERENCES: PluginPreferencesFile = { plugins: {} };

export const listExternalPlugins = async (): Promise<ExternalPluginManifest[]> => {
  if (!isTauri()) return [];
  return invoke<ExternalPluginManifest[]>('list_external_plugins');
};

export const loadPluginPreferences = async (): Promise<PluginPreferencesFile> => {
  if (!isTauri()) return { ...EMPTY_PREFERENCES };
  const saved = await invoke<PluginPreferencesFile>('load_plugin_preferences');
  return saved && typeof saved.plugins === 'object' && saved.plugins !== null
    ? saved
    : { ...EMPTY_PREFERENCES };
};

export const savePluginPreferences = async (preferences: PluginPreferencesFile): Promise<void> => {
  if (!isTauri()) return;
  await invoke('save_plugin_preferences', { preferences });
};

export const openPluginsFolder = async (): Promise<void> => {
  if (!isTauri()) throw new Error('The plugins folder is available in the desktop app.');
  await invoke('open_plugins_folder');
};

const workerBootstrap = String.raw`
let plugin = null;
let settings = {};
let api = null;
const send = (type, payload = {}) => self.postMessage({ type, ...payload });
const safeError = error => error instanceof Error ? error.message : String(error);
self.registerPlugin = candidate => {
  if (!candidate || typeof candidate !== 'object') throw new Error('registerPlugin expects an object');
  plugin = candidate;
};
const callHook = async (name, ...args) => {
  if (typeof plugin?.[name] !== 'function') return;
  try {
    await plugin[name](...args, api);
  } catch (error) {
    send('error', { message: name + ': ' + safeError(error) });
  }
};
self.onmessage = async event => {
  const message = event.data || {};
  if (message.type === 'init') {
    settings = message.settings && typeof message.settings === 'object' ? message.settings : {};
    api = Object.freeze({
      apiVersion: 1,
      getSettings: () => ({ ...settings }),
      log: (...values) => send('log', { message: values.map(value => String(value)).join(' ') }),
    });
    try {
      const sourceUrl = URL.createObjectURL(new Blob([message.source || ''], { type: 'text/javascript' }));
      try { importScripts(sourceUrl); } finally { URL.revokeObjectURL(sourceUrl); }
      if (!plugin) throw new Error('Plugin entry did not call registerPlugin(...)');
      if (typeof plugin.onEnable === 'function') await plugin.onEnable(api);
      send('ready');
    } catch (error) {
      send('error', { message: safeError(error) });
    }
    return;
  }
  if (message.type === 'playback') {
    await callHook('onPlaybackChanged', message.snapshot);
    return;
  }
  if (message.type === 'settings') {
    settings = message.settings && typeof message.settings === 'object' ? message.settings : {};
    await callHook('onSettingsChanged', { ...settings });
    return;
  }
  if (message.type === 'dispose') {
    await callHook('onDisable');
    send('disabled');
    self.close();
  }
};
`;

class ExternalPluginRuntime {
  private workers = new Map<string, { worker: Worker; manifest: ExternalPluginManifest; workerUrl: string | null }>();
  private listeners = new Set<(event: PluginRuntimeEvent) => void>();
  private playbackSnapshot: PluginPlaybackSnapshot = { track: null, isPlaying: false, currentTime: 0 };
  private lastPlaybackDispatchKey = '';
  private lastPlaybackDispatchAt = 0;

  subscribe(listener: (event: PluginRuntimeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(event: PluginRuntimeEvent) {
    this.listeners.forEach(listener => listener(event));
  }

  async start(manifest: ExternalPluginManifest, settings: Record<string, unknown>): Promise<void> {
    await this.stop(manifest.id);
    if (!isTauri()) throw new Error('External plugins can only run in the desktop app.');
    this.notify({ pluginId: manifest.id, state: 'starting' });
    let workerUrl: string | null = null;
    try {
      const source = await invoke<string>('read_external_plugin_source', {
        pluginId: manifest.id,
        expectedFingerprint: manifest.fingerprint,
      });
      workerUrl = URL.createObjectURL(new Blob([workerBootstrap], { type: 'text/javascript' }));
      const worker = new Worker(workerUrl, { name: `Arachnid plugin: ${manifest.id}` });
      const instance = { worker, manifest, workerUrl };
      this.workers.set(manifest.id, instance);
      workerUrl = null;
      const releaseWorkerUrl = () => {
        if (instance.workerUrl) {
          URL.revokeObjectURL(instance.workerUrl);
          instance.workerUrl = null;
        }
      };
      worker.onmessage = event => {
        const message = event.data as { type?: string; message?: string };
        if (message.type === 'ready') {
          releaseWorkerUrl();
          this.notify({ pluginId: manifest.id, state: 'running' });
          if (manifest.permissions.includes('playback.read')) {
            worker.postMessage({ type: 'playback', snapshot: this.playbackSnapshot });
          }
        } else if (message.type === 'error') {
          releaseWorkerUrl();
          this.notify({ pluginId: manifest.id, state: 'error', message: message.message || 'Plugin error' });
        } else if (message.type === 'log') {
          console.info(`[Arachnid plugin: ${manifest.id}]`, message.message || '');
          this.notify({ pluginId: manifest.id, state: 'running', message: message.message || '' });
        } else if (message.type === 'disabled') {
          this.notify({ pluginId: manifest.id, state: 'stopped' });
        }
      };
      worker.onerror = event => {
        releaseWorkerUrl();
        this.notify({ pluginId: manifest.id, state: 'error', message: event.message || 'Plugin worker failed' });
      };
      worker.postMessage({ type: 'init', source, settings });
    } catch (error) {
      if (workerUrl) URL.revokeObjectURL(workerUrl);
      const message = error instanceof Error ? error.message : String(error);
      this.notify({ pluginId: manifest.id, state: 'error', message });
      throw error;
    }
  }

  async stop(pluginId: string): Promise<void> {
    const instance = this.workers.get(pluginId);
    if (!instance) {
      this.notify({ pluginId, state: 'stopped' });
      return;
    }
    this.workers.delete(pluginId);
    await new Promise<void>(resolve => {
      const cleanup = () => {
        if (instance.workerUrl) {
          URL.revokeObjectURL(instance.workerUrl);
          instance.workerUrl = null;
        }
        instance.worker.terminate();
        resolve();
      };
      const timeout = window.setTimeout(cleanup, 300);
      instance.worker.addEventListener('message', event => {
        if ((event.data as { type?: string }).type !== 'disabled') return;
        window.clearTimeout(timeout);
        cleanup();
      });
      instance.worker.postMessage({ type: 'dispose' });
    });
    this.notify({ pluginId, state: 'stopped' });
  }

  updatePlayback(snapshot: PluginPlaybackSnapshot) {
    this.playbackSnapshot = snapshot;
    const track = snapshot.track;
    const dispatchKey = JSON.stringify([
      track?.title ?? '',
      track?.artist ?? '',
      track?.album ?? '',
      track?.duration ?? 0,
      snapshot.isPlaying,
    ]);
    const now = Date.now();
    if (dispatchKey === this.lastPlaybackDispatchKey && now - this.lastPlaybackDispatchAt < 5000) return;
    this.lastPlaybackDispatchKey = dispatchKey;
    this.lastPlaybackDispatchAt = now;
    this.workers.forEach(({ worker, manifest }) => {
      if (manifest.permissions.includes('playback.read')) {
        worker.postMessage({ type: 'playback', snapshot });
      }
    });
  }

  updateSettings(pluginId: string, settings: Record<string, unknown>) {
    this.workers.get(pluginId)?.worker.postMessage({ type: 'settings', settings });
  }

  async stopAll() {
    await Promise.all(Array.from(this.workers.keys()).map(pluginId => this.stop(pluginId)));
  }
}

export const externalPluginRuntime = new ExternalPluginRuntime();
