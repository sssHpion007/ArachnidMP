import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Play, 
  ListMusic, 
  FolderPlus, 
  Layers, 
  ChevronRight, 
  ChevronDown, 
  ArrowLeft, 
  Edit3, 
  Trash2, 
  FolderOpen,
  Palette
} from 'lucide-react';
import { Playlist, PlaylistFolder, PlaylistGroup, Track } from '../types/music';
import { formatTime } from '../services/tagEditor';
import { getFolderIconComponent } from '../theme/folderIcons';

interface PlaylistsGridViewProps {
  playlists: Playlist[];
  folders: PlaylistFolder[];
  groups: PlaylistGroup[];
  tracks: Track[];
  onSelectPlaylist: (id: string) => void;
  onCreatePlaylist: (folderId?: string | null, groupId?: string | null) => void;
  onCreateFolder: (parentId?: string | null, groupId?: string | null) => void;
  onCreateGroup: () => void;
  onPlayPlaylist: (playlist: Playlist) => void;
  onPlayFolder: (folder: PlaylistFolder) => void;
  onOpenPlaylistContextMenu: (e: React.MouseEvent, playlist: Playlist) => void;
  onOpenFolderContextMenu: (e: React.MouseEvent, folder: PlaylistFolder) => void;
  onToggleGroupCollapse: (groupId: string) => void;
  onRenameGroup: (group: PlaylistGroup) => void;
  onDeleteGroup: (groupId: string) => void;
  onMovePlaylistToFolder: (playlistId: string, folderId: string | null) => void;
  onMovePlaylistToGroup: (playlistId: string, groupId: string | null) => void;
  onMoveFolderToFolder: (folderId: string, targetParentId: string | null) => void;
  onMoveFolderToGroup: (folderId: string, groupId: string | null) => void;
  onReorderPlaylists: (reorderedPlaylists: Playlist[]) => void;
  onReorderFolders?: (reorderedFolders: PlaylistFolder[]) => void;
  onEditFolder?: (folder: PlaylistFolder) => void;
}

interface DragItemData {
  type: 'playlist' | 'folder';
  id: string;
}

export const PlaylistsGridView: React.FC<PlaylistsGridViewProps> = ({
  playlists,
  folders,
  groups,
  tracks,
  onSelectPlaylist,
  onCreatePlaylist,
  onCreateFolder,
  onCreateGroup,
  onPlayPlaylist,
  onPlayFolder,
  onOpenPlaylistContextMenu,
  onOpenFolderContextMenu,
  onToggleGroupCollapse,
  onRenameGroup,
  onDeleteGroup,
  onMovePlaylistToFolder,
  onMovePlaylistToGroup,
  onMoveFolderToFolder,
  onMoveFolderToGroup,
  onReorderPlaylists,
  onReorderFolders,
  onEditFolder,
}) => {
  // Navigation state: current folder view (null = root)
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  // Drag and Drop state
  const [draggingItem, setDraggingItem] = useState<DragItemData | null>(null);
  const [hoveredFolderId, setHoveredFolderId] = useState<string | null>(null);
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  const [hoveredCrumbId, setHoveredCrumbId] = useState<string | null | 'root'>(null);
  const [dropTargetPlaylist, setDropTargetPlaylist] = useState<{ id: string; position: 'before' | 'after' } | null>(null);

  // Current folder object (if inside a folder)
  const currentFolder = useMemo(() => {
    if (!currentFolderId) return null;
    return folders.find((f) => f.id === currentFolderId) || null;
  }, [currentFolderId, folders]);

  // Breadcrumbs path
  const breadcrumbs = useMemo(() => {
    const crumbs: PlaylistFolder[] = [];
    let currId = currentFolderId;
    while (currId) {
      const f = folders.find((item) => item.id === currId);
      if (!f) break;
      crumbs.unshift(f);
      currId = f.parentId || null;
    }
    return crumbs;
  }, [currentFolderId, folders]);

  // Helpers to get cover art and duration
  const getPlaylistCover = (playlist: Playlist): string | null => {
    for (const id of playlist.trackIds) {
      const t = tracks.find((tr) => tr.id === id);
      if (t && t.coverArt) return t.coverArt;
    }
    return null;
  };

  const getPlaylistDuration = (playlist: Playlist): number => {
    let total = 0;
    for (const id of playlist.trackIds) {
      const t = tracks.find((tr) => tr.id === id);
      if (t) total += t.duration || 0;
    }
    return total;
  };

  // Helper to count tracks and playlists in a folder recursively
  const getFolderStats = (folderId: string) => {
    const subfolders = folders.filter((f) => f.parentId === folderId);
    const folderPlaylists = playlists.filter((p) => p.folderId === folderId);
    let totalTracks = 0;
    for (const pl of folderPlaylists) {
      totalTracks += pl.trackIds.length;
    }
    for (const sf of subfolders) {
      const sfStats = getFolderStats(sf.id);
      totalTracks += sfStats.totalTracks;
    }
    return {
      subfoldersCount: subfolders.length,
      playlistsCount: folderPlaylists.length,
      totalTracks,
    };
  };

  // ---------------- Drag & Drop Handlers ----------------

  const handleDragStart = (e: React.DragEvent, item: DragItemData) => {
    (window as any).__isInternalDragging = true;
    setDraggingItem(item);
    e.dataTransfer.setData('application/json', JSON.stringify(item));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    (window as any).__isInternalDragging = false;
    setDraggingItem(null);
    setHoveredFolderId(null);
    setHoveredGroupId(null);
    setHoveredCrumbId(null);
    setDropTargetPlaylist(null);
  };

  // Drop on a Folder card
  const handleDropOnFolder = (e: React.DragEvent, targetFolder: PlaylistFolder) => {
    e.preventDefault();
    e.stopPropagation();
    setHoveredFolderId(null);

    if (!draggingItem) return;
    if (draggingItem.type === 'playlist') {
      onMovePlaylistToFolder(draggingItem.id, targetFolder.id);
    } else if (draggingItem.type === 'folder') {
      if (draggingItem.id !== targetFolder.id) {
        onMoveFolderToFolder(draggingItem.id, targetFolder.id);
      }
    }
    handleDragEnd();
  };

  // Drop on a Group section
  const handleDropOnGroup = (e: React.DragEvent, targetGroupId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    setHoveredGroupId(null);

    if (!draggingItem) return;
    if (draggingItem.type === 'playlist') {
      onMovePlaylistToGroup(draggingItem.id, targetGroupId);
    } else if (draggingItem.type === 'folder') {
      onMoveFolderToGroup(draggingItem.id, targetGroupId);
    }
    handleDragEnd();
  };

  // Drop on a Breadcrumb
  const handleDropOnBreadcrumb = (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    setHoveredCrumbId(null);

    if (!draggingItem) return;
    if (draggingItem.type === 'playlist') {
      onMovePlaylistToFolder(draggingItem.id, targetFolderId);
    } else if (draggingItem.type === 'folder') {
      if (draggingItem.id !== targetFolderId) {
        onMoveFolderToFolder(draggingItem.id, targetFolderId);
      }
    }
    handleDragEnd();
  };

  // Reorder playlists inside grid (before / after target card)
  const handleDropOnPlaylist = (e: React.DragEvent, targetPlaylist: Playlist) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggingItem || draggingItem.type !== 'playlist' || draggingItem.id === targetPlaylist.id) {
      setDropTargetPlaylist(null);
      handleDragEnd();
      return;
    }

    const pos = dropTargetPlaylist?.position || 'after';
    setDropTargetPlaylist(null);

    const nextPlaylists = [...playlists];
    const fromIndex = nextPlaylists.findIndex((p) => p.id === draggingItem.id);
    if (fromIndex === -1) {
      handleDragEnd();
      return;
    }

    const [draggedPl] = nextPlaylists.splice(fromIndex, 1);

    // Apply target's folderId and groupId to the moved playlist
    const updatedPl: Playlist = {
      ...draggedPl,
      folderId: targetPlaylist.folderId || null,
      groupId: targetPlaylist.folderId ? null : (targetPlaylist.groupId || null),
    };

    let toIndex = nextPlaylists.findIndex((p) => p.id === targetPlaylist.id);
    if (toIndex !== -1) {
      if (pos === 'after') {
        toIndex += 1;
      }
      nextPlaylists.splice(toIndex, 0, updatedPl);
      onReorderPlaylists(nextPlaylists);
    }

    handleDragEnd();
  };

  // Render a Single Folder Card
  const renderFolderCard = (folder: PlaylistFolder) => {
    const stats = getFolderStats(folder.id);
    const isHovered = hoveredFolderId === folder.id;
    const isSelfDragging = draggingItem?.type === 'folder' && draggingItem?.id === folder.id;
    const IconComponent = getFolderIconComponent(folder.icon);

    return (
      <div
        key={folder.id}
        draggable
        onDragStart={(e) => handleDragStart(e, { type: 'folder', id: folder.id })}
        onDragEnd={handleDragEnd}
        onDragOver={(e) => {
          e.preventDefault();
          if (draggingItem && draggingItem.id !== folder.id) {
            setHoveredFolderId(folder.id);
          }
        }}
        onDragLeave={(e) => {
          // Only clear if actually leaving the card container
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setHoveredFolderId(null);
          }
        }}
        onDrop={(e) => handleDropOnFolder(e, folder)}
        onClick={() => setCurrentFolderId(folder.id)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpenFolderContextMenu(e, folder);
        }}
        className={`group relative flex flex-col p-4 rounded-3xl transition-all duration-200 cursor-pointer select-none border ${
          isHovered
            ? 'ring-2 ring-md3-primary scale-[1.02] bg-md3-primary/10 border-md3-primary shadow-xl'
            : 'bg-md3-surface-container-low hover:bg-md3-surface-container border-md3-outline-variant/15 hover:border-md3-primary/30 shadow-sm hover:shadow-md'
        } ${isSelfDragging ? 'opacity-40 scale-95' : ''}`}
      >
        {/* Visual Folder Icon & Preview */}
        <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-md3-surface-container-highest flex flex-col items-center justify-center mb-3 shadow-inner pointer-events-none">
          <div 
            className="w-16 h-16 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 shadow-sm"
            style={{ backgroundColor: folder.color ? `${folder.color}25` : undefined }}
          >
            <IconComponent 
              className="w-9 h-9 transition-colors" 
              style={{ color: folder.color || 'var(--md3-primary)' }}
            />
          </div>

          {/* Quick Play Folder Button */}
          {stats.totalTracks > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlayFolder(folder);
              }}
              title="Воспроизвести всю папку"
              className="pointer-events-auto absolute bottom-2.5 right-2.5 w-11 h-11 rounded-full bg-md3-primary text-md3-on-primary flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 transition-all duration-200"
            >
              <Play className="w-5 h-5 fill-current ml-0.5" />
            </button>
          )}

          {isHovered && (
            <div className="absolute inset-0 bg-md3-primary/20 backdrop-blur-xs flex items-center justify-center">
              <span className="px-2.5 py-1 rounded-full bg-md3-primary text-md3-on-primary text-[10px] font-bold shadow-md">
                Переместить в папку
              </span>
            </div>
          )}
        </div>

        {/* Folder Info */}
        <div className="min-w-0 pointer-events-none">
          <div className="flex items-center gap-1.5">
            <h3 className="font-bold text-sm text-md3-on-surface truncate group-hover:text-md3-primary transition-colors">
              {folder.name}
            </h3>
          </div>
          <p className="text-xs text-md3-on-surface-variant/80 truncate mt-0.5 font-medium">
            {stats.playlistsCount} {stats.playlistsCount === 1 ? 'плейлист' : stats.playlistsCount < 5 ? 'плейлиста' : 'плейлистов'}
            {stats.subfoldersCount > 0 && ` • ${stats.subfoldersCount} папок`}
          </p>
        </div>
      </div>
    );
  };

  // Render a Single Playlist Card
  const renderPlaylistCard = (playlist: Playlist) => {
    const cover = getPlaylistCover(playlist);
    const totalDuration = getPlaylistDuration(playlist);
    const isTarget = dropTargetPlaylist?.id === playlist.id;
    const isSelfDragging = draggingItem?.type === 'playlist' && draggingItem?.id === playlist.id;

    return (
      <div
        key={playlist.id}
        draggable
        onDragStart={(e) => handleDragStart(e, { type: 'playlist', id: playlist.id })}
        onDragEnd={handleDragEnd}
        onDragOver={(e) => {
          e.preventDefault();
          if (draggingItem && draggingItem.type === 'playlist' && draggingItem.id !== playlist.id) {
            const rect = e.currentTarget.getBoundingClientRect();
            const midX = rect.left + rect.width / 2;
            const pos = e.clientX < midX ? 'before' : 'after';
            setDropTargetPlaylist({ id: playlist.id, position: pos });
          }
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            if (dropTargetPlaylist?.id === playlist.id) {
              setDropTargetPlaylist(null);
            }
          }
        }}
        onDrop={(e) => handleDropOnPlaylist(e, playlist)}
        onClick={() => onSelectPlaylist(playlist.id)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpenPlaylistContextMenu(e, playlist);
        }}
        className={`group relative flex flex-col p-3 rounded-3xl transition-all duration-150 cursor-pointer select-none border ${
          isTarget
            ? 'ring-2 ring-md3-primary scale-[1.02] bg-md3-surface-container border-md3-primary shadow-lg'
            : 'bg-md3-surface-container-low hover:bg-md3-surface-container border-md3-outline-variant/15 hover:border-md3-primary/30 shadow-sm hover:shadow-md'
        } ${isSelfDragging ? 'opacity-35 scale-95' : ''}`}
      >
        {/* Visual Insertion Indicator Bars */}
        {isTarget && dropTargetPlaylist.position === 'before' && (
          <div className="absolute -left-2 top-2 bottom-2 w-1.5 bg-md3-primary rounded-full shadow-lg shadow-md3-primary/60 animate-pulse z-30" />
        )}
        {isTarget && dropTargetPlaylist.position === 'after' && (
          <div className="absolute -right-2 top-2 bottom-2 w-1.5 bg-md3-primary rounded-full shadow-lg shadow-md3-primary/60 animate-pulse z-30" />
        )}

        {/* Cover Art Container */}
        <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-md3-surface-container-highest mb-3 shadow-inner pointer-events-none">
          {cover ? (
            <img
              src={cover}
              alt={playlist.name}
              draggable={false}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 pointer-events-none"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-md3-primary/50 bg-md3-primary/5">
              <ListMusic className="w-12 h-12" />
            </div>
          )}

          {/* Floating Play Button on Hover */}
          {playlist.trackIds.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlayPlaylist(playlist);
              }}
              title="Воспроизвести плейлист"
              className="pointer-events-auto absolute bottom-2.5 right-2.5 w-11 h-11 rounded-full bg-md3-primary text-md3-on-primary flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 transition-all duration-200"
            >
              <Play className="w-5 h-5 fill-current ml-0.5" />
            </button>
          )}

          {/* System Badge */}
          {playlist.isSystem && (
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-[10px] font-semibold text-white/90 backdrop-blur-xs">
              Системный
            </span>
          )}
        </div>

        {/* Title & Stats */}
        <div className="min-w-0 pointer-events-none">
          <h3 className="font-bold text-sm text-md3-on-surface truncate group-hover:text-md3-primary transition-colors">
            {playlist.name}
          </h3>
          <p className="text-xs text-md3-on-surface-variant/80 truncate mt-0.5 font-medium">
            {playlist.trackIds.length} {playlist.trackIds.length === 1 ? 'трек' : 'треков'}
            {totalDuration > 0 && ` • ${formatTime(totalDuration)}`}
          </p>
        </div>
      </div>
    );
  };

  // ---------------- VIEW INSIDE A FOLDER ----------------
  if (currentFolderId && currentFolder) {
    const subfoldersInside = folders.filter((f) => f.parentId === currentFolderId);
    const playlistsInside = playlists.filter((p) => p.folderId === currentFolderId);
    const totalItems = subfoldersInside.length + playlistsInside.length;
    const CurrentFolderIcon = getFolderIconComponent(currentFolder.icon);

    return (
      <div className="flex-1 flex flex-col h-full min-h-0 bg-md3-surface p-6 overflow-y-auto custom-scrollbar select-none">
        {/* Folder Header & Breadcrumbs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-md3-outline-variant/15">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentFolderId(currentFolder.parentId || null)}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-md3-surface-container hover:bg-md3-surface-container-high text-md3-on-surface transition-colors shadow-xs"
              title="Назад"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div>
              {/* Breadcrumb row */}
              <div className="flex items-center gap-1.5 text-xs text-md3-on-surface-variant flex-wrap mb-1">
                <button
                  onClick={() => setCurrentFolderId(null)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setHoveredCrumbId('root');
                  }}
                  onDragLeave={() => setHoveredCrumbId(null)}
                  onDrop={(e) => handleDropOnBreadcrumb(e, null)}
                  className={`hover:text-md3-primary transition-colors px-1.5 py-0.5 rounded-md ${
                    hoveredCrumbId === 'root' ? 'bg-md3-primary/20 text-md3-primary font-bold' : ''
                  }`}
                >
                  Все плейлисты
                </button>

                {breadcrumbs.map((crumb, idx) => {
                  const isLast = idx === breadcrumbs.length - 1;
                  return (
                    <React.Fragment key={crumb.id}>
                      <ChevronRight className="w-3.5 h-3.5 opacity-40 flex-shrink-0" />
                      <button
                        disabled={isLast}
                        onClick={() => setCurrentFolderId(crumb.id)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (!isLast) setHoveredCrumbId(crumb.id);
                        }}
                        onDragLeave={() => setHoveredCrumbId(null)}
                        onDrop={(e) => {
                          if (!isLast) handleDropOnBreadcrumb(e, crumb.id);
                        }}
                        className={`truncate max-w-[140px] px-1.5 py-0.5 rounded-md ${
                          isLast
                            ? 'font-bold text-md3-on-surface'
                            : 'hover:text-md3-primary transition-colors'
                        } ${hoveredCrumbId === crumb.id ? 'bg-md3-primary/20 text-md3-primary font-bold' : ''}`}
                      >
                        {crumb.name}
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <CurrentFolderIcon 
                  className="w-5 h-5 text-md3-primary flex-shrink-0"
                  style={{ color: currentFolder.color || undefined }}
                />
                <h2 className="text-xl font-bold text-md3-on-surface truncate">
                  {currentFolder.name}
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-md3-surface-container-high text-md3-on-surface-variant font-medium">
                  {totalItems} {totalItems === 1 ? 'элемент' : totalItems < 5 ? 'элемента' : 'элементов'}
                </span>
                {onEditFolder && (
                  <button
                    onClick={() => onEditFolder(currentFolder)}
                    title="Настроить значок и цвет"
                    className="p-1.5 rounded-full text-md3-on-surface-variant hover:text-md3-primary hover:bg-md3-surface-container-high transition-colors"
                  >
                    <Palette className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons inside folder */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => onCreateFolder(currentFolder.id, currentFolder.groupId)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-md3-surface-container-high text-md3-on-surface text-xs font-semibold hover:bg-md3-surface-container-highest shadow-xs transition-all"
            >
              <FolderPlus className="w-4 h-4 text-md3-primary" />
              <span>Новая подпапка</span>
            </button>
            <button
              onClick={() => onCreatePlaylist(currentFolder.id, currentFolder.groupId)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-md3-primary text-md3-on-primary text-xs font-semibold hover:opacity-90 shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Новый плейлист</span>
            </button>
          </div>
        </div>

        {/* Empty state or items grid */}
        {totalItems === 0 ? (
          <div 
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              if (draggingItem) {
                if (draggingItem.type === 'playlist') {
                  onMovePlaylistToFolder(draggingItem.id, currentFolder.id);
                } else if (draggingItem.type === 'folder' && draggingItem.id !== currentFolder.id) {
                  onMoveFolderToFolder(draggingItem.id, currentFolder.id);
                }
                handleDragEnd();
              }
            }}
            className="flex-1 flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-md3-outline-variant/30 rounded-3xl"
          >
            <CurrentFolderIcon className="w-14 h-14 text-md3-on-surface-variant/30 mb-3" />
            <h3 className="text-base font-bold text-md3-on-surface mb-1">
              В этой папке пока пусто
            </h3>
            <p className="text-xs text-md3-on-surface-variant max-w-sm mb-5">
              Создайте плейлист, добавьте подпапку или перетащите сюда плейлисты из других мест.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => onCreateFolder(currentFolder.id, currentFolder.groupId)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-md3-surface-container-high text-md3-on-surface text-xs font-semibold hover:bg-md3-surface-container-highest transition-colors"
              >
                <FolderPlus className="w-4 h-4 text-md3-primary" />
                <span>Создать подпапку</span>
              </button>
              <button
                onClick={() => onCreatePlaylist(currentFolder.id, currentFolder.groupId)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-md3-primary text-md3-on-primary text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" />
                <span>Создать плейлист</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {subfoldersInside.map(renderFolderCard)}
            {playlistsInside.map(renderPlaylistCard)}
          </div>
        )}
      </div>
    );
  }

  // ---------------- ROOT VIEW (WITH GROUPS & FOLDERS) ----------------
  const rootFolders = folders.filter((f) => !f.parentId);
  const rootPlaylists = playlists.filter((p) => !p.folderId);

  const ungroupedFolders = rootFolders.filter((f) => !f.groupId);
  const ungroupedPlaylists = rootPlaylists.filter((p) => !p.groupId);
  const hasGroups = groups.length > 0;

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-md3-surface p-6 overflow-y-auto custom-scrollbar select-none">
      {/* Top Bar with Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-md3-outline-variant/15">
        <div>
          <h2 className="text-xl font-bold text-md3-on-surface">Мои Плейлисты</h2>
          <p className="text-xs text-md3-on-surface-variant mt-0.5">
            {playlists.length} {playlists.length === 1 ? 'плейлист' : playlists.length < 5 ? 'плейлиста' : 'плейлистов'}
            {folders.length > 0 && ` • ${folders.length} ${folders.length === 1 ? 'папка' : 'папок'}`}
            {groups.length > 0 && ` • ${groups.length} ${groups.length === 1 ? 'группа' : 'групп'}`}
          </p>
        </div>

        {/* Global Toolbar Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onCreateGroup}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-md3-surface-container-high text-md3-on-surface text-xs font-semibold hover:bg-md3-surface-container-highest shadow-xs transition-all"
            title="Создать группу плейлистов"
          >
            <Layers className="w-4 h-4 text-md3-primary" />
            <span>Новая группа</span>
          </button>

          <button
            onClick={() => onCreateFolder(null, null)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-md3-surface-container-high text-md3-on-surface text-xs font-semibold hover:bg-md3-surface-container-highest shadow-xs transition-all"
            title="Создать папку"
          >
            <FolderPlus className="w-4 h-4 text-md3-primary" />
            <span>Новая папка</span>
          </button>

          <button
            onClick={() => onCreatePlaylist(null, null)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-md3-primary text-md3-on-primary text-xs font-semibold hover:opacity-90 shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Новый плейлист</span>
          </button>
        </div>
      </div>

      {/* GROUPS LIST */}
      {hasGroups && (
        <div className="flex flex-col gap-6 mb-8">
          {groups.map((group) => {
            const groupFolders = rootFolders.filter((f) => f.groupId === group.id);
            const groupPlaylists = rootPlaylists.filter((p) => p.groupId === group.id);
            const totalGroupItems = groupFolders.length + groupPlaylists.length;
            const isCollapsed = !!group.isCollapsed;
            const isGroupHovered = hoveredGroupId === group.id;

            return (
              <div
                key={group.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setHoveredGroupId(group.id);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setHoveredGroupId(null);
                  }
                }}
                onDrop={(e) => handleDropOnGroup(e, group.id)}
                className={`rounded-3xl border transition-all duration-200 overflow-hidden ${
                  isGroupHovered
                    ? 'ring-2 ring-md3-primary border-md3-primary bg-md3-primary/5 shadow-md'
                    : 'border-md3-outline-variant/20 bg-md3-surface-container-lowest/50'
                }`}
              >
                {/* Group Header (Collapsible) */}
                <div
                  onClick={() => onToggleGroupCollapse(group.id)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-md3-surface-container/60 hover:bg-md3-surface-container cursor-pointer transition-colors border-b border-md3-outline-variant/10"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      className="p-1 rounded-full text-md3-on-surface-variant hover:text-md3-on-surface transition-transform"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                    <Layers className="w-4 h-4 text-md3-primary flex-shrink-0" />
                    <h3 className="font-bold text-sm text-md3-on-surface truncate">
                      {group.name}
                    </h3>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-md3-surface-container-highest text-md3-on-surface-variant font-medium">
                      {totalGroupItems}
                    </span>
                  </div>

                  {/* Group Quick Actions */}
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onCreatePlaylist(null, group.id)}
                      title="Добавить плейлист в эту группу"
                      className="p-1.5 rounded-full text-md3-on-surface-variant hover:text-md3-primary hover:bg-md3-surface-container-highest transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onCreateFolder(null, group.id)}
                      title="Добавить папку в эту группу"
                      className="p-1.5 rounded-full text-md3-on-surface-variant hover:text-md3-primary hover:bg-md3-surface-container-highest transition-colors"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onRenameGroup(group)}
                      title="Переименовать группу"
                      className="p-1.5 rounded-full text-md3-on-surface-variant hover:text-md3-primary hover:bg-md3-surface-container-highest transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteGroup(group.id)}
                      title="Удалить группу (элементы сохранятся)"
                      className="p-1.5 rounded-full text-md3-on-surface-variant hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Group Content Grid */}
                {!isCollapsed && (
                  <div className="p-4">
                    {totalGroupItems === 0 ? (
                      <div className="py-6 text-center text-xs text-md3-on-surface-variant/60 border border-dashed border-md3-outline-variant/20 rounded-2xl">
                        Перетащите сюда плейлисты или папки, либо нажмите «+» для создания.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {groupFolders.map(renderFolderCard)}
                        {groupPlaylists.map(renderPlaylistCard)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* UNGROUPED ITEMS (or ALL items if no groups exist) */}
      {(ungroupedFolders.length > 0 || ungroupedPlaylists.length > 0 || !hasGroups) && (
        <div
          onDragOver={(e) => {
            if (hasGroups) {
              e.preventDefault();
              setHoveredGroupId('ungrouped');
            }
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setHoveredGroupId(null);
            }
          }}
          onDrop={(e) => {
            if (hasGroups) handleDropOnGroup(e, null);
          }}
          className={`flex-1 flex flex-col ${
            hoveredGroupId === 'ungrouped'
              ? 'ring-2 ring-md3-primary rounded-3xl p-3 bg-md3-primary/5'
              : ''
          }`}
        >
          {hasGroups && (
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-md3-on-surface-variant/70">
                Общие плейлисты и папки
              </h3>
              <span className="text-[11px] px-2 py-0.2 rounded-full bg-md3-surface-container-high text-md3-on-surface-variant font-medium">
                {ungroupedFolders.length + ungroupedPlaylists.length}
              </span>
            </div>
          )}

          {ungroupedFolders.length === 0 && ungroupedPlaylists.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-md3-outline-variant/20 rounded-3xl">
              <ListMusic className="w-12 h-12 text-md3-on-surface-variant/30 mx-auto mb-3" />
              <p className="text-sm font-semibold text-md3-on-surface mb-1">
                Плейлистов пока нет
              </p>
              <p className="text-xs text-md3-on-surface-variant mb-4">
                Создайте первый плейлист или папку для вашей медиатеки
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => onCreateFolder(null, null)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-md3-surface-container-high text-md3-on-surface text-xs font-semibold hover:bg-md3-surface-container-highest"
                >
                  <FolderPlus className="w-4 h-4 text-md3-primary" />
                  <span>Папка</span>
                </button>
                <button
                  onClick={() => onCreatePlaylist(null, null)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-md3-primary text-md3-on-primary text-xs font-semibold hover:opacity-90"
                >
                  <Plus className="w-4 h-4" />
                  <span>Плейлист</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {ungroupedFolders.map(renderFolderCard)}
              {ungroupedPlaylists.map(renderPlaylistCard)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
