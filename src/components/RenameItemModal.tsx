import React, { useState, useEffect, useRef } from 'react';
import { Edit3, X, Check } from 'lucide-react';
import { AppLanguage } from '../i18n';
import { useModalAnimation } from '../utils/useModalAnimation';

interface RenameItemModalProps {
  isOpen: boolean;
  type: 'playlist' | 'folder' | 'group';
  initialName: string;
  initialDescription?: string;
  language?: AppLanguage;
  onClose: () => void;
  onRename: (newName: string, newDescription?: string) => void;
}

export const RenameItemModal: React.FC<RenameItemModalProps> = ({
  isOpen,
  type,
  initialName,
  initialDescription = '',
  language = 'ru',
  onClose,
  onRename,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setDescription(initialDescription || '');
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, initialName, initialDescription]);

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

  const { isRendered, backdropClass, dialogClass } = useModalAnimation(isOpen, 200);

  if (!isRendered) return null;

  const typeLabels = {
    playlist: { 
      title: language === 'ru' ? 'Переименовать плейлист' : 'Rename Playlist', 
      desc: language === 'ru' ? 'Введите новое имя для плейлиста' : 'Enter a new name for the playlist' 
    },
    folder: { 
      title: language === 'ru' ? 'Переименовать папку' : 'Rename Folder', 
      desc: language === 'ru' ? 'Введите новое имя для папки' : 'Enter a new name for the folder' 
    },
    group: { 
      title: language === 'ru' ? 'Переименовать группу' : 'Rename Group', 
      desc: language === 'ru' ? 'Введите новое имя для группы' : 'Enter a new name for the group' 
    },
  };

  const currentLabel = typeLabels[type] || typeLabels.playlist;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) return;
    onRename(name.trim(), type === 'playlist' ? description.trim() : undefined);
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
                {currentLabel.title}
              </h2>
              <p className="text-xs text-md3-on-surface-variant mt-0.5">
                {currentLabel.desc}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-md3-on-surface-variant hover:text-md3-on-surface hover:bg-md3-surface-container-highest transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-md3-on-surface-variant mb-1.5">
              {language === 'ru' ? 'Новое название' : 'New Name'} <span className="text-md3-error">*</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={language === 'ru' ? 'Название...' : 'Name...'}
              maxLength={60}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-md3-surface-container-highest border border-md3-outline-variant/30 text-md3-on-surface placeholder:text-md3-on-surface-variant/50 text-sm focus:outline-none focus:border-md3-primary transition-colors"
            />
          </div>

          {type === 'playlist' && (
            <div>
              <label className="block text-xs font-semibold text-md3-on-surface-variant mb-1.5">
                {language === 'ru' ? 'Описание (необязательно)' : 'Description (optional)'}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={language === 'ru' ? 'Добавьте описание плейлиста...' : 'Add playlist description...'}
                rows={3}
                maxLength={300}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-md3-surface-container-highest border border-md3-outline-variant/30 text-md3-on-surface placeholder:text-md3-on-surface-variant/50 text-sm focus:outline-none focus:border-md3-primary transition-colors resize-none"
              />
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2.5 mt-2 pt-3 border-t border-md3-outline-variant/15">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-xs font-medium text-md3-on-surface-variant hover:text-md3-on-surface hover:bg-md3-surface-container-highest transition-colors cursor-pointer"
            >
              {language === 'ru' ? 'Отмена' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex items-center gap-2 px-5 py-2 rounded-full bg-md3-primary text-md3-on-primary text-xs font-semibold hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:pointer-events-none shadow-md transition-all cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{language === 'ru' ? 'Сохранить' : 'Save'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
