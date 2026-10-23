import React, { useMemo, useRef, memo } from 'react';
import { Mic2, Play, Music2, Disc } from 'lucide-react';
import { Track } from '../types/music';
import { AppLanguage } from '../i18n';
import { CollectionGridLoading } from './CollectionGridLoading';
import { VirtualizedCollectionGrid } from './VirtualizedCollectionGrid';
import { useLibraryCollectionGroups } from '../hooks/useLibraryCollectionGroups';
import { matchesLibraryCollectionSearch, type LibraryCollectionGroup } from '../services/libraryCollectionIndex';

interface ArtistsGridViewProps {
  tracks: Track[];
  searchQuery?: string;
  language?: AppLanguage;
  onSelectArtist: (artistName: string) => void;
  onPlayArtist: (tracks: Track[]) => void;
  databaseGroups?: LibraryCollectionGroup[];
  onPlayArtistByIds?: (trackIds: string[]) => void;
}

type ArtistData = LibraryCollectionGroup;

// Memoized ArtistCard item component for zero-cost re-renders
const ArtistCard = memo<{
  artist: ArtistData;
  index: number;
  language: AppLanguage;
  onSelectArtist: (name: string) => void;
  onPlayArtist: (trackIds: string[]) => void;
}>(({ artist, index, language, onSelectArtist, onPlayArtist }) => {
  return (
    <div
      onClick={() => onSelectArtist(artist.name)}
      style={{ animationDelay: `${(index % 12) * 18}ms` }}
      className="group grid-card-optimized collection-card-enter flex flex-col items-center text-center p-4 rounded-3xl bg-md3-surface-container-low hover:bg-md3-surface-container transition-all duration-200 cursor-pointer border border-md3-outline-variant/15 hover:border-md3-primary/30 shadow-sm hover:shadow-md"
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
            onPlayArtist(artist.trackIds);
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
          {artist.trackIds.length} {language === 'ru' ? (artist.trackIds.length % 10 === 1 && artist.trackIds.length % 100 !== 11 ? 'трек' : artist.trackIds.length % 10 < 5 && artist.trackIds.length % 10 > 1 && (artist.trackIds.length % 100 < 10 || artist.trackIds.length % 100 >= 20) ? 'трека' : 'треков') : (artist.trackIds.length === 1 ? 'track' : 'tracks')}
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
  databaseGroups,
  onPlayArtistByIds,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { groups: indexedArtists, isLoading: isIndexingLibrary } = useLibraryCollectionGroups(tracks, 'artists', language, !databaseGroups);
  const allArtists = databaseGroups ?? indexedArtists;
  const isIndexing = !databaseGroups && isIndexingLibrary;
  const hasSearch = Boolean(searchQuery.trim());
  const tracksByIdForSearch = useMemo(
    () => hasSearch ? new Map(tracks.map(track => [track.id, track])) : null,
    [tracks, hasSearch],
  );

  // Search only resolves track metadata while a query is active; the shared cache
  // itself contains compact IDs and never duplicates full Track records.
  const artists = useMemo(() => {
    if (databaseGroups) return allArtists;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return allArtists;
    return allArtists.filter(artist => matchesLibraryCollectionSearch('artists', artist, q, tracksByIdForSearch!));
  }, [allArtists, searchQuery, tracksByIdForSearch, databaseGroups]);

  const playArtistByIds = (trackIds: string[]) => {
    if (onPlayArtistByIds) {
      onPlayArtistByIds(trackIds);
      return;
    }
    const tracksById = new Map(tracks.map(track => [track.id, track]));
    onPlayArtist(trackIds.map(id => tracksById.get(id)).filter((track): track is Track => !!track));
  };

  if (isIndexing) {
    return (
      <CollectionGridLoading
        title={language === 'ru' ? 'Исполнители' : 'Artists'}
        kind="artists"
        columnsClassName="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7"
        language={language}
      />
    );
  }

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

  return (
    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scrollbar p-6 select-none">
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

      <VirtualizedCollectionGrid
        items={artists}
        scrollContainerRef={scrollContainerRef}
        resetKey={searchQuery}
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-5"
        renderItem={(artist, index) => (
          <ArtistCard
            artist={artist}
            index={index}
            language={language}
            onSelectArtist={onSelectArtist}
            onPlayArtist={playArtistByIds}
          />
        )}
      />
    </div>
  );
};
