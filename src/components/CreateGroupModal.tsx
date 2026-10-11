import React, { useState, useEffect, useRef } from 'react';
import { Layers, X, Check, Shield, ShieldAlert } from 'lucide-react';
import { PlaylistGroup } from '../types/music';
import { AppLanguage } from '../i18n';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, color?: string, isIsolated?: boolean) => void;
  groupToEdit?: PlaylistGroup | null;
  language?: AppLanguage;
}

const getGroupColors = (lang: AppLanguage) => [
  { id: 'default', label: lang === 'ru' ? 'По умолчанию' : 'Default', bg: 'bg-md3-primary', hex: '' },
  { id: 'amber', label: lang === 'ru' ? 'Янтарный' : 'Amber', bg: 'bg-amber-500', hex: '#f59e0b' },
  { id: 'emerald', label: lang === 'ru' ? 'Изумрудный' : 'Emerald', bg: 'bg-emerald-500', hex: '#10b981' },
  { id: 'indigo', label: lang === 'ru' ? 'Индиго' : 'Indigo', bg: 'bg-indigo-500', hex: '#6366f1' },
  { id: 'purple', label: lang === 'ru' ? 'Пурпурный' : 'Purple', bg: 'bg-purple-500', hex: '#a855f7' },
  { id: 'rose', label: lang === 'ru' ? 'Розовый' : 'Rose', bg: 'bg-rose-500', hex: '#f43f5e' },
  { id: 'cyan', label: lang === 'ru' ? 'Бирюзовый' : 'Cyan', bg: 'bg-cyan-500', hex: '#06b6d4' },
];

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  groupToEdit,
  language = 'ru',
}) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [isIsolated, setIsIsolated] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const groupColors = getGroupColors(language);

  useEffect(() => {
    if (isOpen) {
      if (groupToEdit) {
        setName(groupToEdit.name);
        setColor(groupToEdit.color || '');
        setIsIsolated(!!groupToEdit.isIsolated);
      } else {
        setName('');
        setColor('');
        setIsIsolated(false);
      }
      setTimeout(() => {
        inputRef.current?.focus();
        if (groupToEdit) inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, groupToEdit]);

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
    onCreate(name.trim(), color || undefined, isIsolated);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150 select-none cursor-pointer"
    >
      <div
        className="w-full max-w-md bg-md3-surface-container rounded-3xl shadow-2xl border border-md3-outline-variant/20 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 pb-4 border-b border-md3-outline-variant/15 flex items-center justify-between bg-md3-surface-container-high/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-md3-primary/15 text-md3-primary flex items-center justify-center shadow-sm">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-md3-on-surface leading-tight">
                {groupToEdit
                  ? (language === 'ru' ? 'Настройки группы' : 'Group Settings')
                  : (language === 'ru' ? 'Новая группа плейлистов' : 'New Playlist Group')}
              </h2>
              <p className="text-xs text-md3-on-surface-variant mt-0.5">
                {groupToEdit
                  ? (language === 'ru' ? 'Цвет, название и изоляция группы' : 'Color, title and group isolation')
                  : (language === 'ru' ? 'Группы объединяют папки и плейлисты' : 'Groups organize folders and playlists')}
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
              {language === 'ru' ? 'Название группы' : 'Group Name'} <span className="text-md3-error">*</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={language === 'ru' ? 'Например: Аудиокниги, Игры, Саундтреки...' : 'E.g.: Audiobooks, Gaming, Soundtracks...'}
              maxLength={60}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-md3-surface-container-highest border border-md3-outline-variant/30 text-md3-on-surface placeholder:text-md3-on-surface-variant/50 text-sm focus:outline-none focus:border-md3-primary transition-colors"
            />
          </div>

          {/* Color Accent Picker */}
          <div>
            <label className="block text-xs font-semibold text-md3-on-surface-variant mb-2">
              {language === 'ru' ? 'Цвет оформления группы' : 'Group Accent Color'}
            </label>
            <div className="flex items-center gap-2.5 flex-wrap">
              {groupColors.map((col) => (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => setColor(col.hex)}
                  title={col.label}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 cursor-pointer ${col.bg} ${
                    color === col.hex ? 'ring-2 ring-offset-2 ring-offset-md3-surface-container ring-md3-primary scale-110' : ''
                  }`}
                >
                  {color === col.hex && (
                    <Check className="w-3.5 h-3.5 text-white" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Isolated Container Toggle Card */}
          <div
            onClick={() => setIsIsolated(!isIsolated)}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
              isIsolated
                ? 'bg-amber-500/10 border-amber-500/40 shadow-xs'
                : 'bg-md3-surface-container-highest/60 border-md3-outline-variant/25 hover:bg-md3-surface-container-highest'
            }`}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                isIsolated ? 'bg-amber-500 text-white' : 'bg-md3-surface-container text-md3-on-surface-variant'
              }`}>
                {isIsolated ? <ShieldAlert className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-bold ${isIsolated ? 'text-amber-500' : 'text-md3-on-surface'}`}>
                    {language === 'ru' ? 'Изолированный контейнер' : 'Isolated Container'}
                  </span>
                  {isIsolated && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-500 font-bold">
                      {language === 'ru' ? 'Активен' : 'Active'}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-md3-on-surface-variant mt-0.5 leading-snug">
                  {language === 'ru'
                    ? 'Треки из плейлистов этой группы не отображаются в общем списке всех треков, альбомов и исполнителей.'
                    : 'Tracks in playlists of this group are hidden from all tracks, albums, and artists lists.'}
                </p>
              </div>
            </div>

            {/* Toggle switch */}
            <div className={`w-9 h-5 rounded-full p-0.5 transition-colors shrink-0 mt-1 ${
              isIsolated ? 'bg-amber-500' : 'bg-md3-surface-container-highest border border-md3-outline-variant/40'
            }`}>
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                isIsolated ? 'translate-x-4' : 'translate-x-0'
              }`} />
            </div>
          </div>

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
              <span>{groupToEdit ? (language === 'ru' ? 'Сохранить' : 'Save') : (language === 'ru' ? 'Создать группу' : 'Create Group')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
