import React, { useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { AlertTriangle, Check, FolderOpen, Puzzle, RefreshCw, Settings, Shield } from 'lucide-react';
import {
  ExternalPluginManifest,
  PluginPreferencesFile,
  PluginRuntimeEvent,
} from '../services/pluginManager';
import { AppLanguage } from '../i18n';

interface PluginManagerViewProps {
  language: AppLanguage;
  externalPlugins: ExternalPluginManifest[];
  preferences: PluginPreferencesFile;
  runtimeStates: Record<string, PluginRuntimeEvent>;
  loading: boolean;
  error: string | null;
  discordEnabled: boolean;
  onToggleDiscord: () => void;
  onOpenDiscordSettings: () => void;
  onToggleExternalPlugin: (plugin: ExternalPluginManifest, enabled: boolean) => Promise<void>;
  onUpdatePluginSettings: (pluginId: string, settings: Record<string, unknown>) => void;
  onRefresh: () => void;
  onOpenFolder: () => void;
}

const text = (language: AppLanguage, ru: string, en: string) => language === 'ru' ? ru : en;

const getRuntimeLabel = (language: AppLanguage, event?: PluginRuntimeEvent) => {
  if (!event || event.state === 'stopped') return text(language, 'Отключён', 'Stopped');
  if (event.state === 'starting') return text(language, 'Запуск…', 'Starting…');
  if (event.state === 'running') return text(language, 'Работает', 'Running');
  return event.message || text(language, 'Ошибка плагина', 'Plugin error');
};

export const PluginManagerView: React.FC<PluginManagerViewProps> = ({
  language,
  externalPlugins,
  preferences,
  runtimeStates,
  loading,
  error,
  discordEnabled,
  onToggleDiscord,
  onOpenDiscordSettings,
  onToggleExternalPlugin,
  onUpdatePluginSettings,
  onRefresh,
  onOpenFolder,
}) => {
  const [expandedPluginId, setExpandedPluginId] = useState<string | null>(null);
  const [pendingEnable, setPendingEnable] = useState<ExternalPluginManifest | null>(null);
  const [enabling, setEnabling] = useState(false);
  const desktopAppAvailable = isTauri();
  const enabledText = text(language, 'Включён', 'Enabled');
  const disabledText = text(language, 'Отключён', 'Disabled');

  const confirmEnable = async () => {
    if (!pendingEnable) return;
    setEnabling(true);
    try {
      await onToggleExternalPlugin(pendingEnable, true);
      setPendingEnable(null);
    } finally {
      setEnabling(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5 anim-view-slide-right">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-md3-outline-variant/20 bg-md3-surface-container-low p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-bold text-md3-on-surface">
            <Puzzle className="h-4 w-4 text-md3-primary" />
            {text(language, 'Менеджер плагинов', 'Plugin manager')}
          </div>
          <p className="mt-1 text-xs text-md3-on-surface-variant">
            {text(language, 'Сторонние плагины: папка plugins рядом с Arachnid-Portable.exe.', 'Third-party plugins: the plugins folder next to Arachnid-Portable.exe.')}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={onRefresh} disabled={loading} title={text(language, 'Пересканировать папку', 'Rescan plugins folder')} className="flex h-9 items-center gap-2 rounded-full border border-md3-outline-variant/20 bg-md3-surface-container px-3 text-xs font-semibold text-md3-on-surface-variant hover:text-md3-on-surface disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {text(language, 'Обновить', 'Refresh')}
          </button>
          <button type="button" onClick={onOpenFolder} disabled={!desktopAppAvailable} className="flex h-9 items-center gap-2 rounded-full bg-md3-primary/10 px-3 text-xs font-semibold text-md3-primary hover:bg-md3-primary/15 disabled:cursor-not-allowed disabled:opacity-40">
            <FolderOpen className="h-3.5 w-3.5" />
            {text(language, 'Открыть папку', 'Open folder')}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3.5 py-3 text-xs leading-relaxed text-md3-on-surface-variant">
        <span className="font-bold text-amber-500">{text(language, 'Безопасность: ', 'Security: ')}</span>
        {text(language, 'включайте только плагины из источников, которым доверяете. Код плагина может выполнять сетевые запросы. Плеер не передаёт ему доступ к файловой системе или командам Tauri.', 'only enable plugins from sources you trust. Plugin code can make network requests. The player does not give it direct filesystem or Tauri-command access.')}
      </div>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">{error}</div>}

      <section className="space-y-3">
        <h4 className="px-1 text-xs font-bold uppercase tracking-wider text-md3-on-surface-variant">
          {text(language, 'Установленные плагины', 'Installed plugins')}
        </h4>

        <article className="rounded-2xl border border-md3-outline-variant/20 bg-md3-surface-container-low p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#5865F2]/15 text-[#7289da]">
              <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.078.078 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" /></svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-md3-on-surface">Discord RPC</span>
                <span className="rounded-full bg-md3-primary/10 px-2 py-0.5 text-[10px] font-semibold text-md3-primary">{text(language, 'Встроенный', 'Built-in')}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${discordEnabled ? 'bg-[#5865F2]/15 text-[#7289da]' : 'bg-md3-surface-container-high text-md3-on-surface-variant'}`}>{discordEnabled ? enabledText : disabledText}</span>
              </div>
              <p className="mt-1 text-xs text-md3-on-surface-variant">{text(language, 'Публикует текущий трек и состояние воспроизведения в Discord. Использует встроенную нативную интеграцию.', 'Shares the current track and playback state with Discord using the existing native integration.')}</p>
            </div>
            <button type="button" role="switch" aria-label={text(language, 'Включить Discord RPC', 'Enable Discord RPC')} aria-checked={discordEnabled} onClick={onToggleDiscord} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${discordEnabled ? 'bg-[#5865F2]' : 'bg-md3-surface-container-highest'}`}>
              <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${discordEnabled ? 'left-6' : 'left-1'}`} />
            </button>
            <button type="button" onClick={onOpenDiscordSettings} title={text(language, 'Настройки Discord RPC', 'Discord RPC settings')} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container-high hover:text-md3-on-surface"><Settings className="h-4 w-4" /></button>
          </div>
        </article>

        {externalPlugins.map(plugin => {
          const preference = preferences.plugins[plugin.id] ?? { enabled: false, trustedFingerprint: null, settings: {} };
          const runtime = runtimeStates[plugin.id];
          const isExpanded = expandedPluginId === plugin.id;
          const hasSettings = plugin.settings.length > 0;
          return (
            <article key={plugin.id} className="rounded-2xl border border-md3-outline-variant/20 bg-md3-surface-container-low p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-md3-primary/10 text-md3-primary"><Puzzle className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-md3-on-surface">{plugin.name}</span>
                    <span className="rounded-full bg-md3-surface-container-high px-2 py-0.5 text-[10px] text-md3-on-surface-variant">v{plugin.version}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${preference.enabled && preference.trustedFingerprint === plugin.fingerprint ? 'bg-emerald-500/10 text-emerald-400' : 'bg-md3-surface-container-high text-md3-on-surface-variant'}`}>
                      {preference.enabled && preference.trustedFingerprint === plugin.fingerprint ? getRuntimeLabel(language, runtime) : disabledText}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-md3-on-surface-variant">{plugin.description || text(language, 'Нет описания.', 'No description.')}</p>
                  <p className="mt-1 text-[10px] text-md3-on-surface-variant/70">ID: <code>{plugin.id}</code> · API {plugin.apiVersion}</p>
                </div>
                <button type="button" role="switch" aria-label={`${text(language, 'Включить плагин', 'Enable plugin')}: ${plugin.name}`} aria-checked={preference.enabled && preference.trustedFingerprint === plugin.fingerprint} onClick={() => {
                  const isEnabled = preference.enabled && preference.trustedFingerprint === plugin.fingerprint;
                  if (isEnabled) void onToggleExternalPlugin(plugin, false);
                  else setPendingEnable(plugin);
                }} className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors ${preference.enabled && preference.trustedFingerprint === plugin.fingerprint ? 'bg-md3-primary' : 'bg-md3-surface-container-highest'}`}>
                  <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${preference.enabled && preference.trustedFingerprint === plugin.fingerprint ? 'left-6' : 'left-1'}`} />
                </button>
                <button type="button" onClick={() => setExpandedPluginId(isExpanded ? null : plugin.id)} title={text(language, 'Настройки плагина', 'Plugin settings')} aria-label={text(language, `Настройки: ${plugin.name}`, `Settings: ${plugin.name}`)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container-high hover:text-md3-on-surface">
                  <Settings className="h-4 w-4" />
                </button>
              </div>
              {runtime?.state === 'error' && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-[11px] text-red-400">{runtime.message}</p>}
              {runtime?.state === 'running' && runtime.message && <p className="mt-3 truncate rounded-lg bg-md3-surface-container px-3 py-2 text-[11px] text-md3-on-surface-variant" title={runtime.message}>{text(language, 'Вывод плагина: ', 'Plugin output: ')}{runtime.message}</p>}
              {plugin.permissions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {plugin.permissions.map(permission => <span key={permission} className="rounded-full border border-md3-outline-variant/20 px-2 py-0.5 text-[10px] text-md3-on-surface-variant">{permission}</span>)}
                </div>
              )}
              {isExpanded && hasSettings && (
                <div className="mt-4 space-y-3 border-t border-md3-outline-variant/15 pt-4">
                  {plugin.settings.map(field => {
                    const value = preference.settings[field.key] ?? field.default ?? '';
                    const update = (nextValue: unknown) => onUpdatePluginSettings(plugin.id, { ...preference.settings, [field.key]: nextValue });
                    return (
                      <label key={field.key} className="flex items-center justify-between gap-4 text-xs text-md3-on-surface-variant">
                        <span className="min-w-0 flex-1">{field.label}</span>
                        {field.type === 'boolean' ? (
                          <input type="checkbox" checked={Boolean(value)} onChange={event => update(event.target.checked)} className="h-4 w-4 accent-md3-primary" />
                        ) : field.type === 'select' ? (
                          <select value={String(value)} onChange={event => {
                            const option = field.options.find(item => String(item.value) === event.target.value);
                            update(option?.value ?? event.target.value);
                          }} className="max-w-[55%] rounded-lg border border-md3-outline-variant/25 bg-md3-surface-container px-2 py-1 text-xs text-md3-on-surface">
                            {field.options.map((option, index) => <option key={`${field.key}-${index}`} value={String(option.value)}>{option.label}</option>)}
                          </select>
                        ) : (
                          <input type={field.type === 'number' ? 'number' : 'text'} value={String(value)} onChange={event => update(field.type === 'number' ? Number(event.target.value) : event.target.value)} className="max-w-[55%] rounded-lg border border-md3-outline-variant/25 bg-md3-surface-container px-2 py-1 text-xs text-md3-on-surface" />
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
              {isExpanded && !hasSettings && (
                <p className="mt-4 border-t border-md3-outline-variant/15 pt-4 text-xs text-md3-on-surface-variant">
                  {text(language, 'Этот плагин не объявил пользовательские настройки.', 'This plugin does not declare any user-configurable settings.')}
                </p>
              )}
            </article>
          );
        })}

        {!loading && externalPlugins.length === 0 && (
          <div className="rounded-2xl border border-dashed border-md3-outline-variant/25 p-5 text-center text-xs text-md3-on-surface-variant">
            {text(language, 'Пока нет сторонних плагинов. Скопируйте папку плагина в папку plugins и нажмите «Обновить».', 'No third-party plugins found. Copy a plugin folder into plugins and select Refresh.')}
          </div>
        )}
      </section>

      {pendingEnable && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onMouseDown={event => { if (event.target === event.currentTarget) setPendingEnable(null); }}>
          <div className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-md3-surface-container p-5 shadow-2xl">
            <div className="flex items-center gap-2 text-sm font-bold text-md3-on-surface"><AlertTriangle className="h-4 w-4 text-amber-500" />{text(language, 'Включить сторонний плагин?', 'Enable third-party plugin?')}</div>
            <p className="mt-3 text-xs leading-relaxed text-md3-on-surface-variant">
              {text(language, `«${pendingEnable.name}» — сторонний JavaScript-код. Он будет выполняться в изолированном Worker и сможет использовать сетевые запросы. Включайте его, только если доверяете источнику.`, `“${pendingEnable.name}” is third-party JavaScript. It runs in an isolated Worker and can make network requests. Enable it only if you trust its source.`)}
            </p>
            {pendingEnable.permissions.includes('playback.read') && <p className="mt-2 text-xs text-md3-on-surface-variant">{text(language, 'Плагин будет получать названия текущего трека и состояние воспроизведения.', 'The plugin will receive current track metadata and playback state.')}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPendingEnable(null)} className="rounded-full px-4 py-2 text-xs font-semibold text-md3-on-surface-variant hover:bg-md3-surface-container-high">{text(language, 'Отмена', 'Cancel')}</button>
              <button type="button" disabled={enabling} onClick={() => void confirmEnable()} className="flex items-center gap-2 rounded-full bg-md3-primary px-4 py-2 text-xs font-semibold text-md3-on-primary disabled:opacity-50"><Check className="h-3.5 w-3.5" />{text(language, 'Доверять и включить', 'Trust and enable')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
