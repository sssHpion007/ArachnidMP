import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDown, ArrowUp, Check, ListMusic, Music2 } from 'lucide-react';
import { Track } from '../types/music';
import { TrackTable } from '../components/TrackTable';
import { QueueDrawer } from '../components/QueueDrawer';
import { MiniTrackRow } from '../components/MiniTrackRow';
import '../index.css';

type DemoView = 'tracks' | 'playlist' | 'queue' | 'mini';

const coverColors = [
  ['#56718e', '#1c293a'], ['#ba7556', '#49303d'], ['#6d7bba', '#272a52'], ['#568a7b', '#1d3938'],
  ['#c08454', '#493140'], ['#596b9d', '#25314f'], ['#8c6d9b', '#352c48'], ['#658c9e', '#263e4a'],
  ['#aa775e', '#473036'], ['#7281ad', '#292b4c'], ['#6d9273', '#273b32'], ['#bd805d', '#4d3333'],
];

const sampleTracks: Track[] = [
  ['01', 'Soft Focus', 'Mira Sol', 'Afterglow', 218],
  ['02', 'Blue Hour', 'Northbound', 'Night Drive', 194],
  ['03', 'Midnight Signals', 'Mira Sol', 'Afterglow', 236],
  ['04', 'Quiet Streets', 'The Paper Moons', 'Night Drive', 205],
  ['05', 'Window Lights', 'Northbound', 'Night Drive', 247],
  ['06', 'Slow Motion', 'Mira Sol', 'Afterglow', 183],
  ['07', 'Last Train Home', 'The Paper Moons', 'Night Drive', 221],
  ['08', 'Somewhere, Still', 'Northbound', 'Night Drive', 202],
  ['09', 'Open Water', 'Mira Sol', 'Afterglow', 229],
  ['10', 'Almost Morning', 'The Paper Moons', 'Night Drive', 211],
  ['11', 'Silver Lining', 'Northbound', 'Night Drive', 198],
  ['12', 'One More Light', 'Mira Sol', 'Afterglow', 243],
].map(([number, title, artist, album, duration], index) => {
  const [from, to] = coverColors[index % coverColors.length];
  const artwork = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="96" height="96" rx="16" fill="url(#g)"/><circle cx="72" cy="23" r="29" fill="white" fill-opacity=".12"/><path d="M0 74 Q35 48 96 70 V96 H0Z" fill="white" fill-opacity=".1"/><text x="48" y="58" text-anchor="middle" fill="white" fill-opacity=".85" font-family="sans-serif" font-size="26">${number}</text></svg>`;
  return {
    id: `selection-demo-${number}`,
    title: String(title),
    artist: String(artist),
    album: String(album),
    duration: Number(duration),
    src: '',
    coverArt: `data:image/svg+xml,${encodeURIComponent(artwork)}`,
    dateAdded: index,
    playCount: index * 2,
    isFavorite: index % 3 === 0,
    genre: index % 2 ? 'Ambient' : 'Indie',
  };
});

const playlistTracks = [sampleTracks[1], sampleTracks[2], sampleTracks[4], sampleTracks[6], sampleTracks[8], sampleTracks[9]];
const activeTrackId = sampleTracks[2].id;

const TrackSelectionDemo: React.FC = () => {
  const [view, setView] = useState<DemoView>('tracks');
  const [playingTrackId, setPlayingTrackId] = useState(activeTrackId);
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(() => new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [miniSelectedIndex, setMiniSelectedIndex] = useState<number | null>(null);
  const lastSelectedIndexRef = useRef<number | null>(null);
  const miniSelectedIndexRef = useRef<number | null>(null);
  const [queue, setQueue] = useState<Track[]>(sampleTracks.slice(0, 8));
  const [queueIndex, setQueueIndex] = useState(2);
  const tracks = view === 'playlist' ? playlistTracks : sampleTracks;
  const currentTrack = useMemo(() => sampleTracks.find(track => track.id === playingTrackId) ?? null, [playingTrackId]);

  useEffect(() => {
    setSelectedTrackIds(new Set());
    setLastSelectedIndex(null);
    lastSelectedIndexRef.current = null;
    setMiniSelectedIndex(null);
    miniSelectedIndexRef.current = null;
  }, [view]);

  useEffect(() => {
    if (view === 'queue') return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.key !== 'ArrowDown' && event.key !== 'ArrowUp')
        || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      event.preventDefault();
      if (view === 'mini') {
        const activeIndex = sampleTracks.findIndex(track => track.id === currentTrack?.id);
        const baseIndex = miniSelectedIndexRef.current ?? (activeIndex >= 0 ? activeIndex : direction > 0 ? -1 : sampleTracks.length);
        const nextIndex = Math.max(0, Math.min(sampleTracks.length - 1, baseIndex + direction));
        miniSelectedIndexRef.current = nextIndex;
        setMiniSelectedIndex(nextIndex);
        return;
      }
      if (tracks.length === 0) return;
      const currentIndex = lastSelectedIndexRef.current
        ?? tracks.findIndex(track => track.id === currentTrack?.id);
      const nextIndex = currentIndex < 0
        ? 0
        : Math.max(0, Math.min(tracks.length - 1, currentIndex + direction));
      const nextTrack = tracks[nextIndex];
      lastSelectedIndexRef.current = nextIndex;
      setSelectedTrackIds(new Set([nextTrack.id]));
      setLastSelectedIndex(nextIndex);
      requestAnimationFrame(() => {
        const container = document.querySelector('[data-track-table-scroll]') as HTMLDivElement | null;
        const row = (container?.querySelector(`[data-track-row-index="${nextIndex}"]`)
          || container?.querySelector('[data-track-row-index]')) as HTMLElement | null;
        if (container) {
          const rowHeight = Number.parseFloat(row?.style.height ?? '') || 54;
          const rowTop = nextIndex * rowHeight;
          const rowBottom = rowTop + rowHeight;
          const viewportTop = container.scrollTop;
          const viewportBottom = viewportTop + container.clientHeight;
          if (rowTop < viewportTop) container.scrollTop = rowTop;
          else if (rowBottom > viewportBottom) container.scrollTop = rowBottom - container.clientHeight;
        }
      });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, tracks, currentTrack?.id]);

  const handleSelectTrack = (trackId: string, event: React.MouseEvent, index: number) => {
    if (event.shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      setSelectedTrackIds(new Set(tracks.slice(start, end + 1).map(track => track.id)));
    } else if (event.ctrlKey || event.metaKey) {
      setSelectedTrackIds(current => {
        const next = new Set(current);
        if (next.has(trackId)) next.delete(trackId);
        else next.add(trackId);
        return next;
      });
      lastSelectedIndexRef.current = index;
      setLastSelectedIndex(index);
    } else {
      setSelectedTrackIds(new Set([trackId]));
      lastSelectedIndexRef.current = index;
      setLastSelectedIndex(index);
    }
  };

  const handlePlayQueueTrack = (index: number) => {
    const track = queue[index];
    if (!track) return;
    setQueueIndex(index);
    setPlayingTrackId(track.id);
  };

  const moveQueueTrack = (from: number, to: number) => {
    setQueue(current => {
      if (from < 0 || to < 0 || from >= current.length || to >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setQueueIndex(current => {
      if (current === from) return to;
      if (current > from && current <= to) return current - 1;
      if (current < from && current >= to) return current + 1;
      return current;
    });
  };

  const tabs: { id: DemoView; label: string }[] = [
    { id: 'tracks', label: 'Все треки' },
    { id: 'playlist', label: 'Плейлист' },
    { id: 'queue', label: 'Очередь' },
    { id: 'mini', label: 'Мини-плеер' },
  ];

  return (
    <main className="selection-demo">
      <header className="selection-demo-heading">
        <div>
          <span className="selection-demo-eyebrow">ИНТЕРАКТИВНОЕ ПРЕВЬЮ</span>
          <h1>Выделение в списках</h1>
          <p>Активный трек отмечен как воспроизводимый, но не считается выбранным. Нажмите и удерживайте ↑ / ↓: выбор плавно перемещается между строками.</p>
        </div>
        <span className="selection-demo-live"><i /> ЖИВОЕ ПРЕВЬЮ</span>
      </header>

      <nav className="selection-demo-tabs" aria-label="Примеры списков">
        {tabs.map(tab => (
          <button key={tab.id} type="button" className={view === tab.id ? 'is-active' : ''} onClick={() => setView(tab.id)}>
            {tab.id === 'queue' ? <ListMusic size={15} /> : tab.id === 'mini' ? <Music2 size={15} /> : null}{tab.label}
          </button>
        ))}
      </nav>

      <section className="selection-demo-controls">
        <div className="selection-demo-status">
          <span className="selection-demo-pulse" />
          <span><b>Сейчас играет</b><small>{currentTrack?.title} · {currentTrack?.artist}</small></span>
        </div>
        <div className="selection-demo-key-help">
          <button type="button" aria-label="Переместить выделение вверх" onMouseDown={event => event.preventDefault()} onClick={() => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))}><ArrowUp size={15} /></button>
          <button type="button" aria-label="Переместить выделение вниз" onMouseDown={event => event.preventDefault()} onClick={() => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))}><ArrowDown size={15} /></button>
          <span>или удерживайте стрелки на клавиатуре</span>
        </div>
      </section>

      <section className="selection-demo-card">
        <div className="selection-demo-card-head">
          <div><span className="selection-demo-section-label">{view === 'tracks' ? 'БИБЛИОТЕКА' : view === 'playlist' ? 'ПЛЕЙЛИСТ' : view === 'mini' ? 'МИНИ-ПЛЕЕР' : 'ОЧЕРЕДЬ'}</span>
            <h2>{view === 'tracks' ? 'Все треки' : view === 'playlist' ? 'Night Drive' : view === 'mini' ? 'Библиотека мини-плеера' : 'Очередь воспроизведения'}</h2></div>
          {(view === 'tracks' || view === 'playlist') && selectedTrackIds.size > 0 && <button type="button" className="selection-demo-clear" onClick={() => { setSelectedTrackIds(new Set()); setLastSelectedIndex(null); lastSelectedIndexRef.current = null; }}>Снять выделение</button>}
          {(view === 'tracks' || view === 'playlist') && selectedTrackIds.size === 0 && <span className="selection-demo-empty-selection"><Check size={13} /> Ничего не выбрано</span>}
          {view === 'mini' && <span className="selection-demo-empty-selection"><Check size={13} /> {miniSelectedIndex === null ? 'Ничего не выбрано' : `Строка ${miniSelectedIndex + 1}`}</span>}
        </div>

        {view === 'queue' ? (
          <div className="selection-demo-queue-note"><Music2 size={16} /> Активная композиция остаётся без рамки; выбор появляется при первом нажатии ↑ / ↓.</div>
        ) : view === 'mini' ? (
          <div className="selection-demo-mini-shell">
            <div className="selection-demo-mini-now-playing"><span className="selection-demo-pulse" /><span><b>{currentTrack?.title}</b><small>{currentTrack?.artist}</small></span><span className="selection-demo-mini-equalizer">▂ ▅ ▃</span></div>
            <div className="selection-demo-mini-list" role="list" aria-label="Библиотека мини-плеера">
              {sampleTracks.slice(0, 8).map((track, index) => (
                <MiniTrackRow
                  key={track.id}
                  track={track}
                  active={track.id === currentTrack?.id}
                  selected={index === miniSelectedIndex}
                  language="ru"
                  index={index}
                  totalCount={8}
                  onClick={() => { miniSelectedIndexRef.current = index; setMiniSelectedIndex(index); setPlayingTrackId(track.id); }}
                />
              ))}
            </div>
            <p className="selection-demo-mini-hint">Стрелки перемещают контур, активный трек отмечен только цветом названия.</p>
          </div>
        ) : (
          <div className="selection-demo-track-table">
            <TrackTable
              tracks={tracks}
              currentTrack={currentTrack}
              isPlaying
              selectedTrackIds={selectedTrackIds}
              onSelectTrack={handleSelectTrack}
              onPlayTrack={track => { setPlayingTrackId(track.id); setSelectedTrackIds(new Set([track.id])); }}
              onToggleFavorite={() => {}}
              onOpenContextMenu={() => {}}
              onOpenBatchTagEditor={() => {}}
              onAddSelectedToQueue={() => {}}
              onPlaySelected={() => {}}
              onClearSelection={() => { setSelectedTrackIds(new Set()); setLastSelectedIndex(null); lastSelectedIndexRef.current = null; }}
              sortBy="title"
              sortOrder="asc"
              onSortChange={() => {}}
              onDropFiles={() => {}}
              onAddTracksToFavorites={() => {}}
              currentView={view === 'playlist' ? 'playlist' : 'tracks'}
              language="ru"
            />
          </div>
        )}
      </section>

      <footer className="selection-demo-legend">
        <span><i className="legend-current" /> Активный трек — отдельная подсветка без рамки выбора</span>
        <span><i className="legend-selected" /> Выбор пользователя — появляется после стрелок или клика</span>
        <span className="selection-demo-tip">Для очереди нажмите ↑ / ↓, затем Enter — выбранная композиция включится.</span>
      </footer>

      <QueueDrawer
        isOpen={view === 'queue'}
        onClose={() => setView('tracks')}
        queue={queue}
        queueIndex={queueIndex}
        currentTrack={currentTrack}
        language="ru"
        isCompact={false}
        onPlayQueueTrack={handlePlayQueueTrack}
        onRemoveFromQueue={index => setQueue(current => current.filter((_, itemIndex) => itemIndex !== index))}
        onClearQueue={() => setQueue([])}
        onShuffleQueue={() => setQueue(current => [...current].reverse())}
        onMoveQueueTrack={moveQueueTrack}
      />
    </main>
  );
};

createRoot(document.getElementById('root')!).render(<TrackSelectionDemo />);
