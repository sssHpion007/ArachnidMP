import React from 'react';
import { Plus, Play, ListMusic, Music, MoreVertical } from 'lucide-react';
import { Playlist, Track } from '../types/music';
import { formatTime } from '../services/tagEditor';

interface PlaylistsGridViewProps {
  playlists: Playlist[];
  tracks: Track[];
  onSelectPlaylist: (id: string) => void;
  onCreatePlaylist: () => void;
  onPlayPlaylist: (playlist: Playlist) => void;
  onOpenContextMenu: (e: React.MouseEvent, playlist: Playlist) => void;
}

export const PlaylistsGridView: React.FC<PlaylistsGridViewProps> = ({
  playlists,
  tracks,
  onSelectPlaylist,
  onCreatePlaylist,
  onPlayPlaylist,
  onOpenContextMenu,
}) => {
  // Helper to find cover art for playlist from first track with cover
  const getPlaylistCover = (playlist: Playlist): string | null => {
    for (const id of playlist.trackIds) {
      const t = tracks.find((tr) => tr.id === id);
      if (t && t.coverArt) return t.coverArt;
    }
    return null;
  };

  // Helper to calculate total duration of a playlist
  const getPlaylistDuration = (playlist: Playlist): number => {
    let total = 0;
    for (const id of playlist.trackIds) {
      const t = tracks.find((tr) => tr.id === id);
      if (t) total += t.duration || 0;
    }
    return total;
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-md3-surface p-6 overflow-y-auto custom-scrollbar select-none">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-md3-on-surface">Мои Плейлисты</h2>
          <p className="text-xs text-md3-on-surface-variant mt-0.5">
            {playlists.length} {playlists.length === 1 ? 'плейлист' : playlists.length < 5 ? 'плейлиста' : 'плейлистов'}
          </p>
        </div>

        <button
          onClick={onCreatePlaylist}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-md3-primary text-md3-on-primary text-xs font-semibold hover:opacity-90 shadow-md transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Новый плейлист</span>
        </button>
      </div>

      {/* Grid of Playlist Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {/* Existing Playlists */}
        {playlists.map((pl) => {
          const cover = getPlaylistCover(pl);
          const totalDuration = getPlaylistDuration(pl);

          return (
            <div
              key={pl.id}
              onClick={() => onSelectPlaylist(pl.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onOpenContextMenu(e, pl);
              }}
              className="group flex flex-col p-3 rounded-3xl bg-md3-surface-container-low hover:bg-md3-surface-container transition-all duration-200 cursor-pointer border border-md3-outline-variant/15 hover:border-md3-primary/30 shadow-sm hover:shadow-md"
            >
              {/* Cover Art Container */}
              <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-md3-surface-container-highest mb-3 shadow-inner">
                {cover ? (
                  <img
                    src={cover}
                    alt={pl.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-md3-primary/50 bg-md3-primary/5">
                    <ListMusic className="w-12 h-12" />
                  </div>
                )}

                {/* Floating Play Button on Hover */}
                {pl.trackIds.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlayPlaylist(pl);
                    }}
                    title="Воспроизвести плейлист"
                    className="absolute bottom-2.5 right-2.5 w-11 h-11 rounded-full bg-md3-primary text-md3-on-primary flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 transition-all duration-200"
                  >
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </button>
                )}
              </div>

              {/* Title & Stats */}
              <div className="min-w-0">
                <h3 className="font-bold text-sm text-md3-on-surface truncate group-hover:text-md3-primary transition-colors">
                  {pl.name}
                </h3>
                <p className="text-xs text-md3-on-surface-variant/80 truncate mt-0.5 font-medium">
                  {pl.trackIds.length} {pl.trackIds.length === 1 ? 'трек' : 'треков'}
                  {totalDuration > 0 && ` • ${formatTime(totalDuration)}`}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
