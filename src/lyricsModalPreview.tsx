import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { MiniPlayer } from './components/MiniPlayer';
import { LyricsModal } from './components/LyricsModal';
import type { Playlist, Track } from './types/music';
import './index.css';

const previewTracks: Track[] = [
  {
    id: 'preview-track-1', title: 'Северный ветер', artist: 'Александра Миронова', album: 'Тихие истории',
    duration: 218, src: '', dateAdded: 1, playCount: 12, isFavorite: true, lyricist: 'Александра Миронова',
    lyrics: '[00:00.00]Сквозь ночной туман мерцает свет\n[00:06.20]Город засыпает до рассвета\n[00:12.10]И уносит ветер наши дни\n[00:18.40]Туда, где мы однажды были одни',
  },
  {
    id: 'preview-track-2', title: 'Город после дождя', artist: 'Марк Левин', album: 'Ночные окна',
    duration: 194, src: '', dateAdded: 2, playCount: 6, isFavorite: false,
    lyrics: '[00:00.00]Мокрый свет на мостовой\n[00:08.00]Город дышит тишиной',
  },
  {
    id: 'preview-track-3', title: 'Тёплый июль', artist: 'Полина Соколова', album: 'Тихие истории',
    duration: 241, src: '', dateAdded: 3, playCount: 21, isFavorite: true,
    lyrics: 'Лето остаётся с нами.\nВ каждом окне горит огонёк.',
  },
  {
    id: 'preview-track-4', title: 'Последний трамвай', artist: 'Марк Левин', album: 'Ночные окна',
    duration: 207, src: '', dateAdded: 4, playCount: 3, isFavorite: false,
  },
  {
    id: 'preview-track-5', title: 'Море внутри', artist: 'Александра Миронова', album: 'Тихие истории',
    duration: 226, src: '', dateAdded: 5, playCount: 9, isFavorite: false,
  },
  {
    id: 'preview-track-6', title: 'Письма домой', artist: 'Илья Ветров', album: 'Дальняя дорога',
    duration: 183, src: '', dateAdded: 6, playCount: 4, isFavorite: true,
  },
];

const previewPlaylists: Playlist[] = [
  { id: 'preview-playlist-1', name: 'Вечерний маршрут', trackIds: ['preview-track-1', 'preview-track-2', 'preview-track-3'], order: 0 },
  { id: 'preview-playlist-2', name: 'Избранное для дороги', trackIds: ['preview-track-3', 'preview-track-5', 'preview-track-6'], order: 1 },
  { id: 'preview-playlist-3', name: 'Спокойный вечер', trackIds: ['preview-track-1', 'preview-track-5'], order: 2 },
];

const PreviewPage: React.FC = () => {
  const [tracks, setTracks] = useState(previewTracks);
  const [currentTrackId, setCurrentTrackId] = useState(previewTracks[0].id);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLyricsOpen, setIsLyricsOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(14);
  const currentTrack = tracks.find(track => track.id === currentTrackId) ?? null;
  const trackById = useMemo(() => new Map(tracks.map(track => [track.id, track])), [tracks]);

  const playTrack = (track: Track) => {
    setCurrentTrackId(track.id);
    setCurrentTime(0);
    setIsPlaying(true);
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-md3-background text-md3-on-background">
      <MiniPlayer
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={currentTrack?.duration ?? 0}
        volume={0.65}
        isMuted={false}
        repeatMode="off"
        isShuffled={false}
        queue={tracks.slice(0, 4)}
        queueIndex={Math.max(0, tracks.findIndex(track => track.id === currentTrackId))}
        tracks={tracks}
        visibleTracks={tracks}
        playlists={previewPlaylists}
        playlistFolders={[]}
        playlistGroups={[]}
        language="ru"
        isLibraryDataLoading={false}
        lyricsMode="closed"
        discordEnabled={false}
        showDiscordButton={false}
        onPlayPause={() => setIsPlaying(value => !value)}
        onPrev={() => playTrack(tracks[Math.max(0, tracks.findIndex(track => track.id === currentTrackId) - 1)])}
        onNext={() => playTrack(tracks[(tracks.findIndex(track => track.id === currentTrackId) + 1) % tracks.length])}
        onSeek={setCurrentTime}
        onVolumeChange={() => {}}
        onToggleMute={() => {}}
        onToggleShuffle={() => {}}
        onToggleRepeat={() => {}}
        onPlayQueueTrack={index => { if (tracks[index]) playTrack(tracks[index]); }}
        onPlayTrack={track => playTrack(track)}
        onPlayPlaylist={playlist => {
          const firstTrack = playlist.trackIds.map(id => trackById.get(id)).find((track): track is Track => Boolean(track));
          if (firstTrack) playTrack(firstTrack);
        }}
        onPlayFolder={() => {}}
        onResolveTracksByIds={async ids => ids.map(id => trackById.get(id)).filter((track): track is Track => Boolean(track))}
        onClearQueue={() => {}}
        onToggleLyrics={() => setIsLyricsOpen(true)}
        onToggleDiscord={() => {}}
        onOpenEQ={() => {}}
        onToggleFavorite={trackId => setTracks(previous => previous.map(track => track.id === trackId ? { ...track, isFavorite: !track.isFavorite } : track))}
        onOpenTrackDetails={() => {}}
        onDetachLyrics={() => {}}
        onAttachLyrics={() => setIsLyricsOpen(true)}
        onCloseLyrics={() => setIsLyricsOpen(false)}
        onSaveLyrics={(trackId, lyrics, isInstrumental, lyricist) => {
          setTracks(previous => previous.map(track => track.id === trackId
            ? { ...track, lyrics, isInstrumental, lyricist }
            : track));
        }}
      />
      <LyricsModal
        isOpen={isLyricsOpen}
        track={currentTrack}
        currentTime={currentTime}
        isPlaying={isPlaying}
        language="ru"
        onSeek={setCurrentTime}
        onSaveLyrics={(trackId, lyrics, isInstrumental, lyricist) => {
          setTracks(previous => previous.map(track => track.id === trackId
            ? { ...track, lyrics, isInstrumental, lyricist }
            : track));
        }}
        onClose={() => setIsLyricsOpen(false)}
      />
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PreviewPage />
  </React.StrictMode>,
);
