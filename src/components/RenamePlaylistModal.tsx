import React, { useState, useEffect, useRef } from 'react';
import { Edit3, X, Check } from 'lucide-react';
import { Playlist } from '../types/music';
import { useModalAnimation } from '../utils/useModalAnimation';

interface RenamePlaylistModalProps {
  isOpen: boolean;
  playlist: Playlist | null;
  onClose: () => void;
  onRename: (playlist: Playlist, newName: string, newDescription?: string) => void;
}

export const RenamePlaylistModal: React.FC<RenamePlaylistModalProps> = ({
  isOpen,
  playlist,
  onClose,
  onRename,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && playlist) {
      setName(playlist.name);
      setDescription(playlist.description || '');
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, playlist]);

  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [isOpen, onClose]);

  const cachedPlaylistRef = useRef<Playlist | null>(playlist);
  if (playlist) {
    cachedPlaylistRef.current = playlist;
  }
  const activePlaylist = playlist || cachedPlaylistRef.current;

  const { isRendered, backdropClass, dialogClass } = useModalAnimation(isOpen && !!activePlaylist, 200);

  if (!isRendered || !activePlaylist) return null;
  const currentPlaylist = activePlaylist;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) return;
    onRename(currentPlaylist, name.trim(), description.trim() || undefined);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md select-none cursor-pointer ${backdropClass}`}
    >
      <div
        className={`w-full max-w-md bg-md3-surface-container rounded-3xl shadow-2xl border border-md3-outline-variant/20 overflow-hidden flex flex-col cursor-default ${dialogClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 pb-4 border-b border-md3-outline-variant/15 flex items-center justify-between bg-md3-surface-container-high/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-md3-primary/15 text-md3-primary flex items-center justify-center shadow-sm">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-md3-on-surface leading-tight">
                Переименовать плейлист
              </h2>
              <p className="text-xs text-md3-on-surface-variant mt-0.5">
                Введите новое имя для подборки
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-md3-on-surface-variant hover:bg-md3-surface-container hover:text-md3-on-surface transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-md3-on-surface-variant mb-1.5">
              Название <span className="text-red-400">*</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Введите название..."
              className="w-full px-4 py-2.5 rounded-2xl bg-md3-surface text-sm text-md3-on-surface placeholder-md3-on-surface-variant/40 border border-md3-outline-variant/20 focus:border-md3-primary outline-none transition-all shadow-inner"
              maxLength={60}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-md3-on-surface-variant mb-1.5">
              Описание (необязательно)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Добавьте описание плейлиста..."
              rows={3}
              maxLength={300}
              className="w-full px-4 py-2.5 rounded-2xl bg-md3-surface text-sm text-md3-on-surface placeholder-md3-on-surface-variant/40 border border-md3-outline-variant/20 focus:border-md3-primary outline-none transition-all shadow-inner resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-xs font-semibold text-md3-on-surface-variant hover:bg-md3-surface-container-high transition-colors cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-md3-primary text-md3-on-primary text-xs font-bold shadow-md hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Сохранить</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
