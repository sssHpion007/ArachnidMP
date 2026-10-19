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
