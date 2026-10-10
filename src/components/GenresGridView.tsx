import React, { useMemo } from 'react';
import { Tag, Play, Music2, Clock, Disc3 } from 'lucide-react';
import { Track } from '../types/music';
import { formatTime } from '../services/tagEditor';

interface GenresGridViewProps {
  tracks: Track[];
  searchQuery?: string;
  onSelectGenre: (genreName: string) => void;
  onPlayGenre: (tracks: Track[]) => void;
}

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

export const GenresGridView: React.FC<GenresGridViewProps> = ({
  tracks,
  searchQuery = '',
  onSelectGenre,
  onPlayGenre,
}) => {
  const allGenres = useMemo(() => {
    const map = new Map<string, { name: string; tracks: Track[]; coverArt?: string }>();

    for (const t of tracks) {
      const genreList = t.genre
        ? t.genre.split(/[,/;\\]+/).map((g) => g.trim()).filter(Boolean)
        : ['Без жанра'];

      const effectiveGenres = genreList.length > 0 ? genreList : ['Без жанра'];

      for (const g of effectiveGenres) {
        if (!map.has(g)) {
          map.set(g, {
            name: g,
            tracks: [t],
            coverArt: t.coverArt,
          });
        } else {
          const item = map.get(g)!;
          if (!item.tracks.some((existing) => existing.id === t.id)) {
            item.tracks.push(t);
          }
          if (!item.coverArt && t.coverArt) item.coverArt = t.coverArt;
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => b.tracks.length - a.tracks.length);
  }, [tracks]);

  const genres = useMemo(() => {
    if (!searchQuery.trim()) return allGenres;
    const q = searchQuery.toLowerCase().trim();
    return allGenres.filter((g) =>
      g.name.toLowerCase().includes(q) ||
      g.tracks.some((t) => 
        t.title.toLowerCase().includes(q) || 
        t.artist.toLowerCase().includes(q) ||
        (t.album && t.album.toLowerCase().includes(q))
      )
    );
  }, [allGenres, searchQuery]);

  if (allGenres.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none text-md3-on-surface-variant">
        <div className="w-20 h-20 rounded-full bg-md3-surface-container-high flex items-center justify-center mb-4 text-md3-primary">
          <Tag className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-bold text-md3-on-surface mb-2">Жанры не найдены</h2>
        <p className="text-sm max-w-md">Добавьте аудиотреки с тегами жанров в библиотеку.</p>
      </div>
    );
  }

  if (genres.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none text-md3-on-surface-variant">
        <div className="w-20 h-20 rounded-full bg-md3-surface-container-high flex items-center justify-center mb-4 text-md3-primary">
          <Tag className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-bold text-md3-on-surface mb-2">Ничего не найдено</h2>
        <p className="text-sm max-w-md">По запросу «{searchQuery}» жанры не найдены.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 select-none">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-md3-on-surface">Жанры</h1>
          <p className="text-xs text-md3-on-surface-variant mt-0.5">
            Всего жанров: {genres.length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
        {genres.map((genre, idx) => {
          const totalDuration = genre.tracks.reduce((acc, t) => acc + (t.duration || 0), 0);
          const gradient = GENRE_GRADIENTS[idx % GENRE_GRADIENTS.length];

          return (
            <div
              key={genre.name}
              onClick={() => onSelectGenre(genre.name)}
              className="group relative overflow-hidden rounded-3xl p-5 bg-md3-surface-container-low hover:bg-md3-surface-container transition-all duration-200 cursor-pointer border border-md3-outline-variant/15 hover:border-md3-primary/30 shadow-sm hover:shadow-md flex flex-col justify-between aspect-[4/3]"
            >
              {/* Subtle background gradient overlay */}
              <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-50 group-hover:opacity-75 transition-opacity pointer-events-none`} />

              {/* Top: Icon & Play Button */}
              <div className="relative z-10 flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-md3-surface-container-high/80 backdrop-blur-sm flex items-center justify-center text-md3-primary shadow-sm">
                  <Tag className="w-5 h-5" />
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlayGenre(genre.tracks);
                  }}
                  title={`Воспроизвести жанр ${genre.name}`}
                  className="w-10 h-10 rounded-full bg-md3-primary text-md3-on-primary shadow-lg flex items-center justify-center opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 hover:scale-110 active:scale-95"
                >
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </button>
              </div>

              {/* Bottom: Info */}
              <div className="relative z-10 min-w-0 mt-4">
                <h3 className="font-bold text-base text-md3-on-surface truncate group-hover:text-md3-primary transition-colors">
                  {genre.name}
                </h3>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-md3-on-surface-variant/80">
                  <span className="flex items-center gap-1">
                    <Music2 className="w-3 h-3" />
                    {genre.tracks.length}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(totalDuration)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
