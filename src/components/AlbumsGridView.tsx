import React, { useMemo, useState, useEffect, memo } from 'react';
import { Disc3, Play, Clock, Music2 } from 'lucide-react';
import { Track } from '../types/music';
import { formatTime } from '../services/tagEditor';
import { AppLanguage } from '../i18n';
import { CollectionGridLoading } from './CollectionGridLoading';

interface AlbumsGridViewProps {
  tracks: Track[];
  searchQuery?: string;
  language?: AppLanguage;
  onSelectAlbum: (albumName: string) => void;
  onPlayAlbum: (tracks: Track[]) => void;
}

interface AlbumData {
  name: string;
  artist: string;
  year?: number;
  coverArt?: string;
  tracks: Track[];
  totalDuration: number;
  searchStr: string;
}

// Keep a short-lived warm cache for quick tab switches, then release grouped Track
// references so inactive collection views do not pin an old library snapshot forever.
const COLLECTION_CACHE_TTL_MS = 60_000;
let cachedTracksRef: Track[] | null = null;
let cachedLangRef: string | null = null;
let cachedAlbums: AlbumData[] = [];
let cachedAlbumsTimer: ReturnType<typeof setTimeout> | null = null;

function clearCachedAlbums() {
  if (cachedAlbumsTimer) clearTimeout(cachedAlbumsTimer);
  cachedAlbumsTimer = null;
  cachedTracksRef = null;
  cachedLangRef = null;
  cachedAlbums = [];
}

function cacheAlbums(tracks: Track[], language: string, albums: AlbumData[]) {
  clearCachedAlbums();
  cachedTracksRef = tracks;
  cachedLangRef = language;
  cachedAlbums = albums;
  cachedAlbumsTimer = setTimeout(() => {
    if (cachedTracksRef === tracks && cachedLangRef === language) {
      cachedAlbumsTimer = null;
      cachedTracksRef = null;
      cachedLangRef = null;
      cachedAlbums = [];
    }
  }, COLLECTION_CACHE_TTL_MS);
}

// Memoized AlbumCard item component for zero-cost re-renders
const AlbumCard = memo<{
  album: AlbumData;
  index: number;
  language: AppLanguage;
  onSelectAlbum: (name: string) => void;
  onPlayAlbum: (tracks: Track[]) => void;
}>(({ album, index, language, onSelectAlbum, onPlayAlbum }) => {
  return (
    <div
      onClick={() => onSelectAlbum(album.name)}
      style={{ animationDelay: `${(index % 12) * 18}ms` }}
      className="group grid-card-optimized collection-card-enter flex flex-col p-3 rounded-3xl bg-md3-surface-container-low hover:bg-md3-surface-container transition-all duration-200 cursor-pointer border border-md3-outline-variant/15 hover:border-md3-primary/30 shadow-sm hover:shadow-md"
    >
      {/* Cover Container */}
      <div className="relative aspect-square rounded-2xl overflow-hidden bg-md3-surface-container-high shadow-md mb-3">
        {album.coverArt ? (
          <img
            src={album.coverArt}
            alt={album.name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 pointer-events-none"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-md3-primary/10 text-md3-primary">
            <Disc3 className="w-12 h-12" />
          </div>
        )}

        {/* Hover Play Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlayAlbum(album.tracks);
          }}
          title={language === 'ru' ? 'Воспроизвести альбом' : 'Play album'}
          className="absolute bottom-2.5 right-2.5 w-11 h-11 rounded-full bg-md3-primary text-md3-on-primary shadow-lg flex items-center justify-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer"
        >
          <Play className="w-5 h-5 fill-current ml-0.5" />
        </button>
      </div>

      {/* Info */}
      <div className="min-w-0 pointer-events-none">
        <h3 className="font-bold text-sm text-md3-on-surface truncate group-hover:text-md3-primary transition-colors">
          {album.name}
        </h3>
        <p className="text-xs text-md3-on-surface-variant truncate mt-0.5 font-medium">
          {album.artist}
        </p>
        <div className="flex items-center gap-2 mt-2 text-[11px] text-md3-on-surface-variant/70">
          <span className="flex items-center gap-1">
            <Music2 className="w-3 h-3" />
            {album.tracks.length}
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatTime(album.totalDuration)}
          </span>
          {album.year && (
            <>
              <span>•</span>
              <span>{album.year}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
});
AlbumCard.displayName = 'AlbumCard';

export const AlbumsGridView: React.FC<AlbumsGridViewProps> = ({
  tracks,
  searchQuery = '',
  language = 'ru',
  onSelectAlbum,
  onPlayAlbum,
}) => {
  const [albumCollection, setAlbumCollection] = useState(() => ({
    tracks,
    language,
    items: cachedTracksRef === tracks && cachedLangRef === language ? cachedAlbums : [],
    isLoading: cachedTracksRef !== tracks || cachedLangRef !== language,
  }));
  const isCurrentCollection = albumCollection.tracks === tracks && albumCollection.language === language;
  const allAlbums = isCurrentCollection ? albumCollection.items : [];
  const isIndexing = !isCurrentCollection || albumCollection.isLoading;

  // Build the index in short tasks so opening the tab can paint immediately.
  useEffect(() => {
    if (cachedTracksRef === tracks && cachedLangRef === language) {
      setAlbumCollection({ tracks, language, items: cachedAlbums, isLoading: false });
      return;
    }

    if (tracks.length === 0) {
      cacheAlbums(tracks, language, []);
      setAlbumCollection({ tracks, language, items: [], isLoading: false });
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;
    let trackIndex = 0;
    const map = new Map<string, AlbumData>();
    const noAlbumLabel = language === 'ru' ? 'Без альбома' : 'No Album';
    const unknownArtistLabel = language === 'ru' ? 'Неизвестный исполнитель' : 'Unknown Artist';

    const processChunk = () => {
      if (cancelled) return;
      const chunkStartedAt = performance.now();
      const chunkStartIndex = trackIndex;

      while (trackIndex < tracks.length && (trackIndex === chunkStartIndex || performance.now() - chunkStartedAt < 6)) {
        const t = tracks[trackIndex++];
        const albumKey = t.album ? t.album.trim() : noAlbumLabel;
        const dur = t.duration && !isNaN(t.duration) ? t.duration : 0;
        let existing = map.get(albumKey);

        if (!existing) {
          existing = {
            name: albumKey,
            artist: t.artist ? t.artist.trim() : unknownArtistLabel,
            year: t.year,
            coverArt: t.coverArt,
            tracks: [t],
            totalDuration: dur,
            searchStr: `${albumKey} ${t.artist || ''} ${t.year || ''} ${t.title || ''}`.toLowerCase(),
          };
          map.set(albumKey, existing);
        } else {
          existing.tracks.push(t);
          existing.totalDuration += dur;
          if (!existing.coverArt && t.coverArt) existing.coverArt = t.coverArt;
          if (!existing.year && t.year) existing.year = t.year;
          existing.searchStr += ` ${t.title?.toLowerCase() || ''}`;
        }
      }

      if (trackIndex < tracks.length) {
        timeoutId = setTimeout(processChunk, 0);
        return;
      }

      const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
      const result = Array.from(map.values()).sort((a, b) => collator.compare(a.name, b.name));

      cacheAlbums(tracks, language, result);
      setAlbumCollection({ tracks, language, items: result, isLoading: false });
    };

    setAlbumCollection({ tracks, language, items: [], isLoading: true });
    timeoutId = setTimeout(processChunk, 0);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [tracks, language]);

  // High-performance search filtering
  const albums = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return allAlbums;
    return allAlbums.filter((a) => a.searchStr.includes(q));
  }, [allAlbums, searchQuery]);

  // Progressive card rendering for instant initial paint & zero dropped frames
  const [renderedCount, setRenderedCount] = useState(24);

  useEffect(() => {
    setRenderedCount(24);
  }, [searchQuery]);

  useEffect(() => {
    if (renderedCount < albums.length) {
      const handle = requestAnimationFrame(() => {
        setRenderedCount((prev) => Math.min(prev + 24, albums.length));
      });
      return () => cancelAnimationFrame(handle);
    }
  }, [renderedCount, albums.length]);

  if (isIndexing) {
    return (
      <CollectionGridLoading
        title={language === 'ru' ? 'Альбомы' : 'Albums'}
        kind="albums"
        columnsClassName="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7"
        language={language}
      />
    );
  }

  if (allAlbums.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none text-md3-on-surface-variant">
        <div className="w-20 h-20 rounded-full bg-md3-surface-container-high flex items-center justify-center mb-4 text-md3-primary">
          <Disc3 className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-bold text-md3-on-surface mb-2">
          {language === 'ru' ? 'Альбомы не найдены' : 'No albums found'}
        </h2>
        <p className="text-sm max-w-md">
          {language === 'ru'
            ? 'Добавьте аудиотреки в библиотеку, чтобы увидеть сгруппированные альбомы.'
            : 'Add audio tracks to your library to see grouped albums.'}
        </p>
      </div>
    );
  }

  if (albums.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none text-md3-on-surface-variant">
        <div className="w-20 h-20 rounded-full bg-md3-surface-container-high flex items-center justify-center mb-4 text-md3-primary">
          <Disc3 className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-bold text-md3-on-surface mb-2">
          {language === 'ru' ? 'Ничего не найдено' : 'Nothing found'}
        </h2>
        <p className="text-sm max-w-md">
          {language === 'ru'
            ? `По запросу «${searchQuery}» альбомы не найдены.`
            : `No albums found for "${searchQuery}".`}
        </p>
      </div>
    );
  }

  const visibleAlbums = renderedCount >= albums.length ? albums : albums.slice(0, renderedCount);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 select-none">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-md3-on-surface">
            {language === 'ru' ? 'Альбомы' : 'Albums'}
          </h1>
          <p className="text-xs text-md3-on-surface-variant mt-0.5">
            {language === 'ru' ? `Всего альбомов: ${albums.length}` : `Total albums: ${albums.length}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-5">
        {visibleAlbums.map((album, index) => (
          <AlbumCard
            key={album.name}
            album={album}
            index={index}
            language={language}
            onSelectAlbum={onSelectAlbum}
            onPlayAlbum={onPlayAlbum}
          />
        ))}
      </div>
    </div>
  );
};
