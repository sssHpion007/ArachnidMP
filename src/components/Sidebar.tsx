import React, { useState } from 'react';
import { 
  Music, 
  Disc, 
  Mic2, 
  Heart, 
  ListMusic, 
  Plus, 
  FolderPlus, 
  SlidersHorizontal, 
  Settings, 
  Radio,
  Layers,
  Sparkles
} from 'lucide-react';
import { Playlist, Track } from '../types/music';

interface SidebarProps {
  currentView: string;
  onSelectView: (view: string) => void;
  playlists: Playlist[];
  selectedPlaylistId: string | null;
  onSelectPlaylist: (id: string) => void;
  onCreatePlaylist: () => void;
  onDropTracksToPlaylist: (playlistId: string, trackIds: string[]) => void;
  onOpenEQ: () => void;
  onOpenSettings: () => void;
  currentTrack: Track | null;
  isPlaying: boolean;
  onOpenFiles: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  playlists,
  selectedPlaylistId,
  onSelectPlaylist,
  onCreatePlaylist,
  onDropTracksToPlaylist,
  onOpenEQ,
  onOpenSettings,
  currentTrack,
  isPlaying,
  onOpenFiles,
}) => {
  const [dragOverPlaylistId, setDragOverPlaylistId] = useState<string | null>(null);

  const mainNav = [
    { id: 'tracks', label: 'Все треки', icon: Music },
    { id: 'albums', label: 'Альбомы', icon: Disc },
    { id: 'artists', label: 'Артисты', icon: Mic2 },
    { id: 'favorites', label: 'Любимые', icon: Heart },
  ];

  const handleDragOver = (e: React.DragEvent, playlistId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverPlaylistId(playlistId);
  };

  const handleDragLeave = () => {
    setDragOverPlaylistId(null);
  };

  const handleDrop = (e: React.DragEvent, playlistId: string) => {
    e.preventDefault();
    setDragOverPlaylistId(null);
    try {
      const data = e.dataTransfer.getData('application/json');
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.trackIds && Array.isArray(parsed.trackIds)) {
          onDropTracksToPlaylist(playlistId, parsed.trackIds);
        }
      }
    } catch (err) {
      console.warn('Drop error on playlist:', err);
    }
  };

  return (
    <aside className="w-64 h-full shrink-0 flex flex-col bg-md3-surface-container-low border-r border-md3-outline-variant/30 select-none transition-colors duration-300">
      {/* Brand Header */}
      <div className="p-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-md3-primary flex items-center justify-center text-md3-on-primary shadow-md">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-wide text-md3-on-surface">Arachnid</h1>
            <span className="text-[11px] font-medium text-md3-primary tracking-wider uppercase flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> M3 MusicBee
            </span>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="px-3 py-3 space-y-1">
        <div className="text-[11px] font-bold uppercase tracking-wider text-md3-on-surface-variant/70 px-3 py-1">
          Библиотека
        </div>
        {mainNav.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id && !selectedPlaylistId;
          return (
            <button
              key={item.id}
              onClick={() => {
                onSelectPlaylist('');
                onSelectView(item.id);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-md3-primary-container text-md3-on-primary-container shadow-sm font-semibold'
                  : 'text-md3-on-surface-variant hover:bg-md3-surface-container hover:text-md3-on-surface'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-md3-primary' : 'opacity-70'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Playlists Section with Drag-and-drop support */}
      <div className="flex-1 flex flex-col min-h-0 px-3 py-2 border-t border-md3-outline-variant/20">
        <div className="flex items-center justify-between px-3 py-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-md3-on-surface-variant/70">
            Плейлисты
          </span>
          <button
            onClick={onCreatePlaylist}
            title="Создать новый плейлист"
            className="p-1 rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container hover:text-md3-primary transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
          {playlists.map((pl) => {
            const isSelected = selectedPlaylistId === pl.id;
            const isDragTarget = dragOverPlaylistId === pl.id;
            return (
              <div
                key={pl.id}
                onDragOver={(e) => handleDragOver(e, pl.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, pl.id)}
                onClick={() => onSelectPlaylist(pl.id)}
                className={`group flex items-center justify-between px-3.5 py-2 rounded-2xl text-sm cursor-pointer transition-all ${
                  isDragTarget
                    ? 'bg-md3-primary/20 border border-dashed border-md3-primary scale-[1.02]'
                    : isSelected
                    ? 'bg-md3-secondary-container text-md3-on-secondary-container font-semibold'
                    : 'text-md3-on-surface-variant hover:bg-md3-surface-container hover:text-md3-on-surface'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <ListMusic className="w-4 h-4 shrink-0 opacity-70" />
                  <span className="truncate">{pl.name}</span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-md3-surface-container-high/60 opacity-60">
                  {pl.trackIds.length}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Add Files & Tools */}
      <div className="p-3 border-t border-md3-outline-variant/30 space-y-1">
        <button
          onClick={onOpenFiles}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-md3-surface-container text-sm font-medium text-md3-primary hover:bg-md3-primary/10 transition-colors"
        >
          <FolderPlus className="w-4 h-4" />
          <span>Добавить файлы</span>
        </button>

        <div className="flex items-center gap-1 pt-1">
          <button
            onClick={onOpenEQ}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-medium text-md3-on-surface-variant hover:bg-md3-surface-container hover:text-md3-on-surface transition-colors"
            title="10-полосный эквалайзер"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Эквалайзер</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-medium text-md3-on-surface-variant hover:bg-md3-surface-container hover:text-md3-on-surface transition-colors"
            title="Настройки Material 3 и Discord RPC"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Настройки</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
