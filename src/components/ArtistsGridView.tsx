import React, { useMemo } from 'react';
import { Mic2, Play, Music2, Disc } from 'lucide-react';
import { Track } from '../types/music';
import { AppLanguage } from '../i18n';

interface ArtistsGridViewProps {
  tracks: Track[];
  searchQuery?: string;
  language?: AppLanguage;
  onSelectArtist: (artistName: string) => void;
  onPlayArtist: (tracks: Track[]) => void;
}

export const ArtistsGridView: React.FC<ArtistsGridViewProps> = ({
  tracks,
  searchQuery = '',
  language = 'ru',
  onSelectArtist,
  onPlayArtist,
}) => {
  const allArtists = useMemo(() => {
    const map = new Map<string, { name: string; coverArt?: string; tracks: Track[]; albumsCount: number }>();

    for (const t of tracks) {
      const artistKey = t.artist ? t.artist.trim() : 'Неизвестный исполнитель';
      if (!map.has(artistKey)) {
        map.set(artistKey, {
          name: artistKey,
          coverArt: t.coverArt,
          tracks: [t],
          albumsCount: 0,
        });
      } else {
        const item = map.get(artistKey)!;
        item.tracks.push(t);
        if (!item.coverArt && t.coverArt) item.coverArt = t.coverArt;
      }
    }

    // Compute distinct album count per artist
    for (const item of map.values()) {
      const albumSet = new Set(item.tracks.map((t) => t.album || 'Unknown'));
      item.albumsCount = albumSet.size;
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [tracks]);

  const artists = useMemo(() => {
    if (!searchQuery.trim()) return allArtists;
    const q = searchQuery.toLowerCase().trim();
    return allArtists.filter((a) =>
      a.name.toLowerCase().includes(q) ||
      a.tracks.some((t) =>
        t.title.toLowerCase().includes(q) ||
        (t.album && t.album.toLowerCase().includes(q))
      )
    );
  }, [allArtists, searchQuery]);

  if (allArtists.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none text-md3-on-surface-variant">
        <div className="w-20 h-20 rounded-full bg-md3-surface-container-high flex items-center justify-center mb-4 text-md3-primary">
          <Mic2 className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-bold text-md3-on-surface mb-2">Исполнители не найдены</h2>
        <p className="text-sm max-w-md">Добавьте аудиотреки в библиотеку, чтобы увидеть исполнителей.</p>
      </div>
    );
  }

  if (artists.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none text-md3-on-surface-variant">
        <div className="w-20 h-20 rounded-full bg-md3-surface-container-high flex items-center justify-center mb-4 text-md3-primary">
          <Mic2 className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-bold text-md3-on-surface mb-2">
          {language === 'ru' ? 'Исполнители не найдены' : 'No artists found'}
        </h2>
        <p className="text-sm max-w-md">
          {language === 'ru'
            ? 'Добавьте аудиотреки в библиотеку, чтобы увидеть исполнителей.'
            : 'Add audio tracks to your library to see artists.'}
        </p>
      </div>
    );
  }

  if (artists.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none text-md3-on-surface-variant">
        <div className="w-20 h-20 rounded-full bg-md3-surface-container-high flex items-center justify-center mb-4 text-md3-primary">
          <Mic2 className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-bold text-md3-on-surface mb-2">
          {language === 'ru' ? 'Ничего не найдено' : 'Nothing found'}
        </h2>
        <p className="text-sm max-w-md">
          {language === 'ru'
            ? `По запросу «${searchQuery}» исполнители не найдены.`
            : `No artists found for "${searchQuery}".`}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 select-none">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-md3-on-surface">
            {language === 'ru' ? 'Исполнители' : 'Artists'}
          </h1>
          <p className="text-xs text-md3-on-surface-variant mt-0.5">
            {language === 'ru' ? `Всего исполнителей: ${artists.length}` : `Total artists: ${artists.length}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-5">
        {artists.map((artist) => (
          <div
            key={artist.name}
            onClick={() => onSelectArtist(artist.name)}
            className="group flex flex-col items-center text-center p-4 rounded-3xl bg-md3-surface-container-low hover:bg-md3-surface-container transition-all duration-200 cursor-pointer border border-md3-outline-variant/15 hover:border-md3-primary/30 shadow-sm hover:shadow-md"
          >
            {/* Circle Avatar Container */}
            <div className="relative w-32 h-32 rounded-full overflow-hidden bg-md3-surface-container-high shadow-md mb-3 group-hover:shadow-lg transition-shadow">
              {artist.coverArt ? (
                <img
                  src={artist.coverArt}
                  alt={artist.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-md3-primary/10 text-md3-primary">
                  <Mic2 className="w-12 h-12" />
                </div>
              )}

              {/* Hover Play Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPlayArtist(artist.tracks);
                }}
                title={`Воспроизвести все треки ${artist.name}`}
                className="absolute inset-0 m-auto w-11 h-11 rounded-full bg-md3-primary text-md3-on-primary shadow-lg flex items-center justify-center opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 hover:scale-110 active:scale-95"
              >
                <Play className="w-5 h-5 fill-current ml-0.5" />
              </button>
            </div>

            {/* Info */}
            <h3 className="font-bold text-sm text-md3-on-surface truncate w-full group-hover:text-md3-primary transition-colors">
              {artist.name}
            </h3>

            <div className="flex items-center justify-center gap-2 mt-1.5 text-[11px] text-md3-on-surface-variant/70">
              <span className="flex items-center gap-1">
                <Music2 className="w-3 h-3" />
                {artist.tracks.length} трек{artist.tracks.length % 10 === 1 && artist.tracks.length % 100 !== 11 ? '' : 'ов'}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Disc className="w-3 h-3" />
                {artist.albumsCount} альб.
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
