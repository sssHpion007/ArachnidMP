import React, { useMemo } from 'react';
import { Disc3, Play, Clock, Music2 } from 'lucide-react';
import { Track } from '../types/music';
import { formatTime } from '../services/tagEditor';

interface AlbumsGridViewProps {
  tracks: Track[];
  searchQuery?: string;
  onSelectAlbum: (albumName: string) => void;
  onPlayAlbum: (tracks: Track[]) => void;
}

export const AlbumsGridView: React.FC<AlbumsGridViewProps> = ({
  tracks,
  searchQuery = '',
  onSelectAlbum,
  onPlayAlbum,
}) => {
  const allAlbums = useMemo(() => {
    const map = new Map<string, { name: string; artist: string; year?: number; coverArt?: string; tracks: Track[] }>();

    for (const t of tracks) {
      const albumKey = t.album ? t.album.trim() : 'Без альбома';
      if (!map.has(albumKey)) {
        map.set(albumKey, {
          name: albumKey,
          artist: t.artist || 'Неизвестный исполнитель',
          year: t.year,
          coverArt: t.coverArt,
          tracks: [t],
        });
      } else {
        const item = map.get(albumKey)!;
        item.tracks.push(t);
        if (!item.coverArt && t.coverArt) item.coverArt = t.coverArt;
        if (!item.year && t.year) item.year = t.year;
      }
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [tracks]);

  const albums = useMemo(() => {
    if (!searchQuery.trim()) return allAlbums;
    const q = searchQuery.toLowerCase().trim();
    return allAlbums.filter((a) =>
      a.name.toLowerCase().includes(q) ||
      a.artist.toLowerCase().includes(q) ||
      (a.year && a.year.toString().includes(q)) ||
      a.tracks.some((t) => t.title.toLowerCase().includes(q))
    );
  }, [allAlbums, searchQuery]);

  if (allAlbums.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none text-md3-on-surface-variant">
        <div className="w-20 h-20 rounded-full bg-md3-surface-container-high flex items-center justify-center mb-4 text-md3-primary">
          <Disc3 className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-bold text-md3-on-surface mb-2">Альбомы не найдены</h2>
        <p className="text-sm max-w-md">Добавьте аудиотреки в библиотеку, чтобы увидеть сгруппированные альбомы.</p>
      </div>
    );
  }

  if (albums.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none text-md3-on-surface-variant">
        <div className="w-20 h-20 rounded-full bg-md3-surface-container-high flex items-center justify-center mb-4 text-md3-primary">
          <Disc3 className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-bold text-md3-on-surface mb-2">Ничего не найдено</h2>
        <p className="text-sm max-w-md">По запросу «{searchQuery}» альбомы не найдены.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 select-none">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-md3-on-surface">Альбомы</h1>
          <p className="text-xs text-md3-on-surface-variant mt-0.5">
            Всего альбомов: {albums.length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-5">
        {albums.map((album) => {
          const totalDuration = album.tracks.reduce((acc, t) => acc + (t.duration || 0), 0);
          return (
            <div
              key={album.name}
              onClick={() => onSelectAlbum(album.name)}
              className="group flex flex-col p-3 rounded-3xl bg-md3-surface-container-low hover:bg-md3-surface-container transition-all duration-200 cursor-pointer border border-md3-outline-variant/15 hover:border-md3-primary/30 shadow-sm hover:shadow-md"
            >
              {/* Cover Container */}
              <div className="relative aspect-square rounded-2xl overflow-hidden bg-md3-surface-container-high shadow-md mb-3">
                {album.coverArt ? (
                  <img
                    src={album.coverArt}
                    alt={album.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
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
                  title="Воспроизвести альбом"
                  className="absolute bottom-2.5 right-2.5 w-11 h-11 rounded-full bg-md3-primary text-md3-on-primary shadow-lg flex items-center justify-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 hover:scale-110 active:scale-95"
                >
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                </button>
              </div>

              {/* Info */}
              <div className="min-w-0">
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
                    {formatTime(totalDuration)}
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
        })}
      </div>
    </div>
  );
};
