import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GripVertical, ListMusic, Music2 } from 'lucide-react';
import { PlaylistDetailCover } from '../components/PlaylistDetailCover';
import '../index.css';

type DemoTrack = { id: string; title: string; artist: string; color: string | null };

const initialTracks: DemoTrack[] = [
  { id: 'amber', title: 'Amber Skies', artist: 'Demo Ensemble', color: '#d97706' },
  { id: 'blue', title: 'Blue Hour', artist: 'Demo Ensemble', color: '#2563eb' },
  { id: 'mint', title: 'Mint Condition', artist: 'Demo Ensemble', color: '#059669' },
  { id: 'violet', title: 'Violet Echo', artist: 'Demo Ensemble', color: '#7c3aed' },
  { id: 'rose', title: 'Rose Avenue', artist: 'Demo Ensemble', color: '#e11d48' },
  { id: 'none', title: 'Quiet Interlude (no cover)', artist: 'Demo Ensemble', color: null },
];

const svgCover = (color: string, label: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320"><rect width="320" height="320" fill="${color}"/><circle cx="250" cy="70" r="115" fill="white" fill-opacity=".13"/><circle cx="70" cy="270" r="130" fill="black" fill-opacity=".11"/><text x="24" y="276" fill="white" font-family="Arial,sans-serif" font-size="26" font-weight="700">${label}</text></svg>`)}`;

const coverForTrack = (track: DemoTrack | undefined) => track?.color ? svgCover(track.color, track.title) : null;

const PlaylistCoverDragDemo: React.FC = () => {
  const [tracks, setTracks] = useState(initialTracks);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [isResolvingCover, setIsResolvingCover] = useState(false);
  const [lastAction, setLastAction] = useState('Перетащите трек вверх или вниз. Обложка плейлиста берётся из первого трека.');
  const firstTrack = tracks[0];
  const nextCover = isResolvingCover ? undefined : coverForTrack(firstTrack);

  const moveTrack = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    const sourceTrack = tracks.find(track => track.id === draggedId);
    const targetTrack = tracks.find(track => track.id === targetId);
    if (!sourceTrack || !targetTrack) return;
    const oldCover = coverForTrack(firstTrack);
    const reordered = [...tracks];
    const sourceIndex = reordered.findIndex(track => track.id === draggedId);
    const targetIndex = reordered.findIndex(track => track.id === targetId);
    reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, sourceTrack);
    setTracks(reordered);

    const newCover = coverForTrack(reordered[0]);
    if (oldCover === newCover) {
      setLastAction('Первый трек и обложка не изменились — карточка остаётся неподвижной.');
      return;
    }

    setIsResolvingCover(true);
    setLastAction(newCover
      ? 'Порядок изменён: старая обложка остаётся на месте, затем новая плавно проявляется.'
      : 'У первого трека нет обложки: значок плейлиста появится после завершения определения обложки.');
    window.setTimeout(() => setIsResolvingCover(false), 420);
  };

  return (
    <main className="demo-page">
      <header className="demo-heading">
        <div>
          <div className="demo-eyebrow">ИНТЕРАКТИВНОЕ ПРЕВЬЮ</div>
          <h1>Обложка плейлиста при перетаскивании треков</h1>
          <p>Это та же карточка обложки, что используется в заголовке списка треков.</p>
        </div>
        <span className="demo-live"><span /> LIVE</span>
      </header>

      <section className="demo-layout">
        <article className="demo-playlist-card">
          <PlaylistDetailCover
            className="demo-cover"
            coverArt={nextCover}
            isResolutionPending={isResolvingCover}
            title="Демонстрационный плейлист"
            icon={<ListMusic size={46} strokeWidth={1.6} />}
          />
          <div className="demo-playlist-info">
            <span className="demo-eyebrow">ПЛЕЙЛИСТ</span>
            <h2>Цветовые обложки</h2>
            <span>{tracks.length} треков · обложка первого трека</span>
          </div>
        </article>

        <section className="demo-track-panel">
          <div className="demo-list-heading">
            <div><span className="demo-eyebrow">СПИСОК ТРЕКОВ</span><h2>Перетаскивайте строки</h2></div>
            <span className="demo-hint">↕ порядок меняет обложку</span>
          </div>
          <ol className="demo-track-list">
            {tracks.map((track, index) => (
              <li
                key={track.id}
                draggable
                onDragStart={event => {
                  setDraggedId(track.id);
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', track.id);
                }}
                onDragOver={event => event.preventDefault()}
                onDrop={event => {
                  event.preventDefault();
                  moveTrack(track.id);
                  setDraggedId(null);
                }}
                onDragEnd={() => setDraggedId(null)}
                className={`demo-track ${draggedId === track.id ? 'is-dragged' : ''} ${index === 0 ? 'is-first' : ''}`}
              >
                <GripVertical size={18} className="demo-grip" />
                <span className="demo-track-art" style={{ background: track.color || 'rgba(255,255,255,.08)' }}>
                  {track.color ? <Music2 size={17} /> : <ListMusic size={17} />}
                </span>
                <span className="demo-track-copy"><b>{track.title}</b><small>{track.artist}</small></span>
                {index === 0 && <span className="demo-first-badge">ОБЛОЖКА</span>}
              </li>
            ))}
          </ol>
          <div className="demo-status" aria-live="polite">{lastAction}</div>
        </section>
      </section>

      <footer className="demo-note">Однотонные SVG-обложки встроены в демо. Ничего не скачивается и не меняет библиотеку.</footer>
    </main>
  );
};

createRoot(document.getElementById('root')!).render(<PlaylistCoverDragDemo />);
