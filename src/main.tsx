import React, { lazy, Suspense, useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { invoke, isTauri } from '@tauri-apps/api/core';
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

const LyricsWindowRoute = lazy(() => import('./components/LyricsWindow').then(module => ({ default: module.LyricsWindow })));
const PlayerRoute = lazy(() => import('./App').then(module => ({ default: module.App })));

const StartupRouter: React.FC = () => {
  const requestedLyricsWindow = new URLSearchParams(window.location.search).get('lyricsWindow') === '1'
    || new URLSearchParams(window.location.search).get('miniLyrics') === '1';
  const [route, setRoute] = useState<'pending' | 'lyrics' | 'player'>(requestedLyricsWindow ? 'lyrics' : 'pending');

  useEffect(() => {
    if (requestedLyricsWindow) return;
    if (!isTauri()) {
      setRoute('player');
      return;
    }
    void invoke<boolean>('is_lyrics_child').then(isChild => {
      setRoute(isChild ? 'lyrics' : 'player');
    }).catch(() => setRoute('player'));
  }, [requestedLyricsWindow]);

  if (route === 'pending') return null;
  if (route === 'lyrics') return <LyricsWindowRoute crossProcess={isTauri()} />;
  return <PlayerRoute />;
};

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Suspense fallback={null}>
        <StartupRouter />
      </Suspense>
    </ErrorBoundary>
  </React.StrictMode>
);
