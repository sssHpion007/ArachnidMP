import React, { useState, useEffect, useRef } from 'react';
import { FolderPlus, X, Check } from 'lucide-react';
import { FOLDER_ICONS, FolderIconOption } from '../theme/folderIcons';
import { PlaylistFolder } from '../types/music';

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, color?: string, icon?: string) => void;
  parentFolderName?: string;
  folderToEdit?: PlaylistFolder | null;
}

const FOLDER_COLORS = [
  { id: 'default', label: 'По умолчанию', bg: 'bg-md3-primary', hex: '' },
  { id: 'amber', label: 'Янтарный', bg: 'bg-amber-500', hex: '#f59e0b' },
  { id: 'emerald', label: 'Изумрудный', bg: 'bg-emerald-500', hex: '#10b981' },
  { id: 'indigo', label: 'Индиго', bg: 'bg-indigo-500', hex: '#6366f1' },
  { id: 'purple', label: 'Пурпурный', bg: 'bg-purple-500', hex: '#a855f7' },
  { id: 'rose', label: 'Розовый', bg: 'bg-rose-500', hex: '#f43f5e' },
  { id: 'cyan', label: 'Бирюзовый', bg: 'bg-cyan-500', hex: '#06b6d4' },
];

export const CreateFolderModal: React.FC<CreateFolderModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  parentFolderName,
  folderToEdit,
}) => {
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('folder');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (folderToEdit) {
        setName(folderToEdit.name);
        setSelectedColor(folderToEdit.color || '');
        setSelectedIcon(folderToEdit.icon || 'folder');
      } else {
        setName('');
        setSelectedColor('');
        setSelectedIcon('folder');
      }
      setTimeout(() => {
        inputRef.current?.focus();
        if (folderToEdit) inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, folderToEdit]);

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

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), selectedColor || undefined, selectedIcon || undefined);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150 select-none cursor-pointer"
    >
      <div
        className="w-full max-w-lg bg-md3-surface-container rounded-3xl shadow-2xl border border-md3-outline-variant/20 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 max-h-[90vh] cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 pb-4 border-b border-md3-outline-variant/15 flex items-center justify-between bg-md3-surface-container-high/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-md3-primary/15 text-md3-primary flex items-center justify-center shadow-sm">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-md3-on-surface leading-tight">
                {folderToEdit ? 'Настройки папки' : parentFolderName ? 'Новая подпапка' : 'Новая папка'}
              </h2>
              <p className="text-xs text-md3-on-surface-variant mt-0.5 truncate max-w-[280px]">
                {folderToEdit ? 'Измените имя, значок и цвет папки' : parentFolderName ? `Внутри «${parentFolderName}»` : 'Организуйте плейлисты по категориям'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-md3-on-surface-variant hover:text-md3-on-surface hover:bg-md3-surface-container-highest transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
          <div>
            <label className="block text-xs font-semibold text-md3-on-surface-variant mb-1.5">
              Название папки <span className="text-md3-error">*</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Саундтреки из игр, Рок, Для работы..."
              maxLength={60}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-md3-surface-container-highest border border-md3-outline-variant/30 text-md3-on-surface placeholder:text-md3-on-surface-variant/50 text-sm focus:outline-none focus:border-md3-primary transition-colors"
            />
          </div>

          {/* Folder Icon Picker */}
          <div>
            <label className="block text-xs font-semibold text-md3-on-surface-variant mb-2">
              Иконка папки
            </label>
            <div className="grid grid-cols-6 sm:grid-cols-9 gap-2 bg-md3-surface-container-highest/60 p-3 rounded-2xl border border-md3-outline-variant/20">
              {FOLDER_ICONS.map((opt: FolderIconOption) => {
                const IconComp = opt.icon;
                const isSelected = selectedIcon === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedIcon(opt.id)}
                    title={opt.label}
                    className={`w-10 h-10 flex items-center justify-center rounded-2xl transition-all mx-auto ${
                      isSelected
                        ? 'bg-md3-primary text-md3-on-primary shadow-md scale-110 ring-2 ring-offset-2 ring-offset-md3-surface-container ring-md3-primary'
                        : 'text-md3-on-surface-variant hover:text-md3-on-surface hover:bg-md3-surface-container hover:scale-105'
                    }`}
                  >
                    <IconComp className="w-5 h-5" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Folder Color Accent */}
          <div>
            <label className="block text-xs font-semibold text-md3-on-surface-variant mb-2">
              Цветовой акцент
            </label>
            <div className="flex items-center gap-2.5 flex-wrap">
              {FOLDER_COLORS.map((col) => (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => setSelectedColor(col.hex)}
                  title={col.label}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 ${col.bg} ${
                    selectedColor === col.hex ? 'ring-2 ring-offset-2 ring-offset-md3-surface-container ring-md3-primary scale-110' : ''
                  }`}
                >
                  {selectedColor === col.hex && (
                    <Check className="w-3.5 h-3.5 text-white" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2.5 mt-2 pt-3 border-t border-md3-outline-variant/15 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-xs font-medium text-md3-on-surface-variant hover:text-md3-on-surface hover:bg-md3-surface-container-highest transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex items-center gap-2 px-5 py-2 rounded-full bg-md3-primary text-md3-on-primary text-xs font-semibold hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:pointer-events-none shadow-md transition-all"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{folderToEdit ? 'Сохранить' : 'Создать'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
