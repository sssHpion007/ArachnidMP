import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from './components/ErrorBoundary';
import { generateCustomOrBuiltinPalette, applyM3ThemeToDOM, DEFAULT_SEED_COLOR } from './theme/material3';
import './index.css';

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

const isLyricsWindow = new URLSearchParams(window.location.search).get('lyricsWindow') === '1'
  || new URLSearchParams(window.location.search).get('miniLyrics') === '1';
const RoutedApp = isLyricsWindow
  ? lazy(() => import('./components/LyricsWindow').then(module => ({ default: module.LyricsWindow })))
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
