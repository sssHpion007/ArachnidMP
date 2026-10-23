import React, { useMemo, useState, useEffect, memo } from 'react';
import { Tag, Play, Music2, Clock } from 'lucide-react';
import { Track } from '../types/music';
import { formatTime } from '../services/tagEditor';
import { AppLanguage } from '../i18n';
import { CollectionGridLoading } from './CollectionGridLoading';
import { useLibraryCollectionGroups } from '../hooks/useLibraryCollectionGroups';
import { matchesLibraryCollectionSearch, type LibraryCollectionGroup } from '../services/libraryCollectionIndex';

interface GenresGridViewProps {
  tracks: Track[];
  searchQuery?: string;
  language?: AppLanguage;
  onSelectGenre: (genreName: string) => void;
  onPlayGenre: (tracks: Track[]) => void;
  databaseGroups?: LibraryCollectionGroup[];
  onPlayGenreByIds?: (trackIds: string[]) => void;
}

type GenreData = LibraryCollectionGroup;

const GENRE_GRADIENTS = [
  'from-violet-600/30 to-purple-800/40',
  'from-blue-600/30 to-indigo-800/40',
  'from-emerald-600/30 to-teal-800/40',
  'from-rose-600/30 to-pink-800/40',
  'from-amber-600/30 to-orange-800/40',
  'from-cyan-600/30 to-blue-800/40',
  'from-fuchsia-600/30 to-pink-800/40',
  'from-teal-600/30 to-emerald-800/40',
];

// Memoized GenreCard item component for zero-cost re-renders
const GenreCard = memo<{
  genre: GenreData;
  index: number;
  language: AppLanguage;
  onSelectGenre: (name: string) => void;
  onPlayGenre: (trackIds: string[]) => void;
}>(({ genre, index, language, onSelectGenre, onPlayGenre }) => {
  const gradient = GENRE_GRADIENTS[index % GENRE_GRADIENTS.length];

  return (
    <div
      onClick={() => onSelectGenre(genre.name)}
      style={{ animationDelay: `${(index % 12) * 18}ms` }}
      className="group grid-card-optimized collection-card-enter relative overflow-hidden rounded-3xl p-5 bg-md3-surface-container-low hover:bg-md3-surface-container transition-all duration-200 cursor-pointer border border-md3-outline-variant/15 hover:border-md3-primary/30 shadow-sm hover:shadow-md flex flex-col justify-between aspect-[4/3]"
    >
      {/* Subtle background gradient overlay */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-50 group-hover:opacity-75 transition-opacity pointer-events-none`} />

      {/* Top: Icon & Play Button */}
      <div className="relative z-10 flex items-center justify-between pointer-events-none">
        <div className="w-10 h-10 rounded-2xl bg-md3-surface-container-high/80 backdrop-blur-sm flex items-center justify-center text-md3-primary shadow-sm">
          <Tag className="w-5 h-5" />
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlayGenre(genre.trackIds);
          }}
          title={language === 'ru' ? `Воспроизвести жанр ${genre.name}` : `Play genre ${genre.name}`}
          className="pointer-events-auto w-10 h-10 rounded-full bg-md3-primary text-md3-on-primary shadow-lg flex items-center justify-center opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer"
        >
          <Play className="w-4 h-4 fill-current ml-0.5" />
        </button>
      </div>

      {/* Bottom: Info */}
      <div className="relative z-10 min-w-0 mt-4 pointer-events-none">
        <h3 className="font-bold text-base text-md3-on-surface truncate group-hover:text-md3-primary transition-colors">
          {genre.name}
        </h3>
        <div className="flex items-center gap-2 mt-1 text-[11px] text-md3-on-surface-variant/80">
          <span className="flex items-center gap-1">
            <Music2 className="w-3 h-3" />
            {genre.trackIds.length}
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatTime(genre.totalDuration)}
          </span>
        </div>
      </div>
    </div>
  );
});
GenreCard.displayName = 'GenreCard';

export const GenresGridView: React.FC<GenresGridViewProps> = ({
  tracks,
  searchQuery = '',
  language = 'ru',
  onSelectGenre,
  onPlayGenre,
  databaseGroups,
  onPlayGenreByIds,
}) => {
  const { groups: indexedGenres, isLoading: isIndexingLibrary } = useLibraryCollectionGroups(tracks, 'genres', language, !databaseGroups);
  const allGenres = databaseGroups ?? indexedGenres;
  const isIndexing = !databaseGroups && isIndexingLibrary;
  const hasSearch = Boolean(searchQuery.trim());
  const tracksByIdForSearch = useMemo(
    () => hasSearch ? new Map(tracks.map(track => [track.id, track])) : null,
    [tracks, hasSearch],
  );

  const genres = useMemo(() => {
    if (databaseGroups) return allGenres;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return allGenres;
    return allGenres.filter(genre => matchesLibraryCollectionSearch('genres', genre, q, tracksByIdForSearch!));
  }, [allGenres, searchQuery, tracksByIdForSearch, databaseGroups]);

  const playGenreByIds = (trackIds: string[]) => {
    if (onPlayGenreByIds) {
      onPlayGenreByIds(trackIds);
      return;
    }
    const tracksById = new Map(tracks.map(track => [track.id, track]));
    onPlayGenre(trackIds.map(id => tracksById.get(id)).filter((track): track is Track => !!track));
  };

  // Progressive card rendering for instant initial paint & zero dropped frames
  const [renderedCount, setRenderedCount] = useState(24);

  useEffect(() => {
    setRenderedCount(24);
  }, [searchQuery]);

  useEffect(() => {
    if (renderedCount < genres.length) {
      const handle = requestAnimationFrame(() => {
        setRenderedCount((prev) => Math.min(prev + 24, genres.length));
      });
      return () => cancelAnimationFrame(handle);
    }
  }, [renderedCount, genres.length]);

  if (isIndexing) {
    return (
      <CollectionGridLoading
        title={language === 'ru' ? 'Жанры' : 'Genres'}
        kind="genres"
        columnsClassName="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
        language={language}
      />
    );
  }

  if (allGenres.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none text-md3-on-surface-variant">
        <div className="w-20 h-20 rounded-full bg-md3-surface-container-high flex items-center justify-center mb-4 text-md3-primary">
          <Tag className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-bold text-md3-on-surface mb-2">
          {language === 'ru' ? 'Жанры не найдены' : 'No genres found'}
        </h2>
        <p className="text-sm max-w-md">
          {language === 'ru'
            ? 'Добавьте аудиотреки с тегами жанров в библиотеку.'
            : 'Add audio tracks with genre tags to your library.'}
        </p>
      </div>
    );
  }

  if (genres.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none text-md3-on-surface-variant">
        <div className="w-20 h-20 rounded-full bg-md3-surface-container-high flex items-center justify-center mb-4 text-md3-primary">
          <Tag className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-bold text-md3-on-surface mb-2">
          {language === 'ru' ? 'Ничего не найдено' : 'Nothing found'}
        </h2>
        <p className="text-sm max-w-md">
          {language === 'ru'
            ? `По запросу «${searchQuery}» жанры не найдены.`
            : `No genres found for "${searchQuery}".`}
        </p>
      </div>
    );
  }

  const visibleGenres = renderedCount >= genres.length ? genres : genres.slice(0, renderedCount);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 select-none">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-md3-on-surface">
            {language === 'ru' ? 'Жанры' : 'Genres'}
          </h1>
          <p className="text-xs text-md3-on-surface-variant mt-0.5">
            {language === 'ru' ? `Всего жанров: ${genres.length}` : `Total genres: ${genres.length}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
        {visibleGenres.map((genre, idx) => (
          <GenreCard
            key={genre.name}
            genre={genre}
            index={idx}
            language={language}
            onSelectGenre={onSelectGenre}
            onPlayGenre={playGenreByIds}
          />
        ))}
      </div>
    </div>
  );
};
