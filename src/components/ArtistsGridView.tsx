import React, { useMemo, useState, useEffect, memo } from 'react';
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

interface ArtistData {
  name: string;
  coverArt?: string;
  tracks: Track[];
  albumSet: Set<string>;
  albumsCount: number;
  searchStr: string;
}

// Module-level memoization cache to prevent expensive re-grouping when switching tabs
let cachedTracksRef: Track[] | null = null;
let cachedLangRef: string | null = null;
let cachedArtists: ArtistData[] = [];

// Memoized ArtistCard item component for zero-cost re-renders
const ArtistCard = memo<{
  artist: ArtistData;
  language: AppLanguage;
  onSelectArtist: (name: string) => void;
  onPlayArtist: (tracks: Track[]) => void;
}>(({ artist, language, onSelectArtist, onPlayArtist }) => {
  return (
    <div
      onClick={() => onSelectArtist(artist.name)}
      className="group grid-card-optimized flex flex-col items-center text-center p-4 rounded-3xl bg-md3-surface-container-low hover:bg-md3-surface-container transition-all duration-200 cursor-pointer border border-md3-outline-variant/15 hover:border-md3-primary/30 shadow-sm hover:shadow-md"
    >
      {/* Circle Avatar Container */}
      <div className="relative w-32 h-32 rounded-full overflow-hidden bg-md3-surface-container-high shadow-md mb-3 group-hover:shadow-lg transition-shadow">
        {artist.coverArt ? (
          <img
            src={artist.coverArt}
            alt={artist.name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 pointer-events-none"
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
          title={language === 'ru' ? `Воспроизвести все треки ${artist.name}` : `Play all tracks by ${artist.name}`}
          className="absolute inset-0 m-auto w-11 h-11 rounded-full bg-md3-primary text-md3-on-primary shadow-lg flex items-center justify-center opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer"
        >
          <Play className="w-5 h-5 fill-current ml-0.5" />
        </button>
      </div>

      {/* Info */}
      <h3 className="font-bold text-sm text-md3-on-surface truncate w-full group-hover:text-md3-primary transition-colors pointer-events-none">
        {artist.name}
      </h3>

      <div className="flex items-center justify-center gap-2 mt-1.5 text-[11px] text-md3-on-surface-variant/70 pointer-events-none">
        <span className="flex items-center gap-1">
          <Music2 className="w-3 h-3" />
          {artist.tracks.length} {language === 'ru' ? (artist.tracks.length % 10 === 1 && artist.tracks.length % 100 !== 11 ? 'трек' : artist.tracks.length % 10 < 5 && artist.tracks.length % 10 > 1 && (artist.tracks.length % 100 < 10 || artist.tracks.length % 100 >= 20) ? 'трека' : 'треков') : (artist.tracks.length === 1 ? 'track' : 'tracks')}
        </span>
        <span>•</span>
        <span className="flex items-center gap-1">
          <Disc className="w-3 h-3" />
          {artist.albumsCount} {language === 'ru' ? 'альб.' : 'alb.'}
        </span>
      </div>
    </div>
  );
});
ArtistCard.displayName = 'ArtistCard';

export const ArtistsGridView: React.FC<ArtistsGridViewProps> = ({
  tracks,
  searchQuery = '',
  language = 'ru',
  onSelectArtist,
  onPlayArtist,
}) => {
  // Precompute grouped artists in a single pass with module-level cache
  const allArtists = useMemo(() => {
    if (cachedTracksRef === tracks && cachedLangRef === language && cachedArtists.length > 0) {
      return cachedArtists;
    }

    const map = new Map<string, ArtistData>();
    const unknownArtistLabel = language === 'ru' ? 'Неизвестный исполнитель' : 'Unknown Artist';

    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      const artistKey = t.artist ? t.artist.trim() : unknownArtistLabel;
      let item = map.get(artistKey);
      if (!item) {
        const albumSet = new Set<string>();
        albumSet.add(t.album || 'Unknown');
        item = {
          name: artistKey,
          coverArt: t.coverArt,
          tracks: [t],
          albumSet,
          albumsCount: 1,
          searchStr: `${artistKey} ${t.title || ''} ${t.album || ''}`.toLowerCase(),
        };
        map.set(artistKey, item);
      } else {
        item.tracks.push(t);
        item.albumSet.add(t.album || 'Unknown');
        if (!item.coverArt && t.coverArt) item.coverArt = t.coverArt;
        item.searchStr += ` ${t.title?.toLowerCase() || ''}`;
      }
    }

    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    const list = Array.from(map.values());
    for (let i = 0; i < list.length; i++) {
      list[i].albumsCount = list[i].albumSet.size;
    }
    const result = list.sort((a, b) => collator.compare(a.name, b.name));

    cachedTracksRef = tracks;
    cachedLangRef = language;
    cachedArtists = result;
    return result;
  }, [tracks, language]);

  // High-performance search filtering
  const artists = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return allArtists;
    return allArtists.filter((a) => a.searchStr.includes(q));
  }, [allArtists, searchQuery]);

  // Progressive card rendering for instant initial paint & zero dropped frames
  const [renderedCount, setRenderedCount] = useState(48);

  useEffect(() => {
    setRenderedCount(48);
  }, [searchQuery]);

  useEffect(() => {
    if (renderedCount < artists.length) {
      const handle = requestAnimationFrame(() => {
        setRenderedCount((prev) => Math.min(prev + 48, artists.length));
      });
      return () => cancelAnimationFrame(handle);
    }
  }, [renderedCount, artists.length]);

  if (allArtists.length === 0) {
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

  const visibleArtists = renderedCount >= artists.length ? artists : artists.slice(0, renderedCount);

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
        {visibleArtists.map((artist) => (
          <ArtistCard
            key={artist.name}
            artist={artist}
            language={language}
            onSelectArtist={onSelectArtist}
            onPlayArtist={onPlayArtist}
          />
        ))}
      </div>
    </div>
  );
};
