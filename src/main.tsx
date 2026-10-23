import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { ErrorBoundary } from './components/ErrorBoundary';
import { generateCustomOrBuiltinPalette, applyM3ThemeToDOM, DEFAULT_SEED_COLOR } from './theme/material3';
import './index.css';

// Prevent browser-style search, fullscreen, and reload shortcuts from leaking through the WebView.
window.addEventListener('keydown', (event) => {
  const browserReload = event.code === 'F5' || event.key === 'F5'
    || ((event.ctrlKey || event.metaKey) && !event.altKey && event.code === 'KeyR');
  const browserSearchOrFullscreen = event.code === 'F3' || event.key === 'F3'
    || event.code === 'F11' || event.key === 'F11';
  const browserFocusOrCaret = event.code === 'F6' || event.key === 'F6'
    || event.code === 'F7' || event.key === 'F7';
  if (browserReload || browserSearchOrFullscreen || browserFocusOrCaret) {
    event.preventDefault();
    event.stopPropagation();
  }
}, true);

// Immediately apply cached theme before React mounts to eliminate any initial color flash
try {
  const raw = localStorage.getItem('arachnid_theme_cache');
  if (raw) {
    const cache = JSON.parse(raw);
    const palette = generateCustomOrBuiltinPalette(
      cache.appTheme || 'default',
      cache.seedColor || DEFAULT_SEED_COLOR,
      cache.secondarySeedColor || '#f72585',
      cache.themeMode || 'dark'
    );
    applyM3ThemeToDOM(palette, cache.themeMode || 'dark');
  }
} catch (_) {}

// Sample the JavaScript heap independently in every WebView (main, lyrics, details, EQ).
// This Chromium API is optional; native per-process diagnostics remain available when absent.
if (isTauri()) {
  const rendererPerformance = performance as Performance & {
    memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
  };
  let renderer = document.title || 'webview';
  try { renderer = getCurrentWebviewWindow().label; } catch {}
  const megabytes = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);
  let unavailableWasReported = false;
  const sample = () => {
    // Re-read the optional API for every sample; retaining its initial object can
    // freeze the diagnostic values for the entire lifetime of the WebView.
    const memory = rendererPerformance.memory;
    if (!memory) {
      if (!unavailableWasReported) {
        unavailableWasReported = true;
        void invoke('client_log', {
          level: 'INFO',
          tag: 'MEMORY_JS_HEAP',
          message: `renderer=${renderer} performance.memory is unavailable in this WebView2 runtime.`,
        }).catch(() => {});
      }
      return;
    }
    void invoke('client_log', {
      level: 'INFO',
      tag: 'MEMORY_JS_HEAP',
      message: `renderer=${renderer} used_js_heap_mb=${megabytes(memory.usedJSHeapSize)} total_js_heap_mb=${megabytes(memory.totalJSHeapSize)} js_heap_limit_mb=${megabytes(memory.jsHeapSizeLimit)}`,
    }).catch(() => {});
  };
  sample();
  window.setInterval(sample, 30_000);
}

const searchParams = new URLSearchParams(window.location.search);
const isLyricsWindow = searchParams.get('lyricsWindow') === '1'
  || searchParams.get('miniLyrics') === '1';
const isTrackDetailsWindow = searchParams.get('trackDetailsWindow') === '1';
const isEqualizerWindow = searchParams.get('equalizerWindow') === '1';
const RoutedApp = isLyricsWindow
  ? lazy(() => import('./components/LyricsWindow').then(module => ({ default: module.LyricsWindow })))
  : isTrackDetailsWindow
    ? lazy(() => import('./components/TrackDetailsWindow').then(module => ({ default: module.TrackDetailsWindow })))
    : isEqualizerWindow
      ? lazy(() => import('./components/EqualizerWindow').then(module => ({ default: module.EqualizerWindow })))
      : lazy(() => import('./App').then(module => ({ default: module.App })));

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Suspense fallback={null}>
        <RoutedApp />
      </Suspense>
    </ErrorBoundary>
  </React.StrictMode>
);
