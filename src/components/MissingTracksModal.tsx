import React, { useState, useRef, useEffect } from 'react';
import { 
  AlertTriangle, 
  FolderSearch, 
  Trash2, 
  ChevronRight, 
  ChevronDown, 
  X, 
  FileAudio,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { Track } from '../types/music';
import { AppLanguage, getTranslations } from '../i18n';
import { useModalAnimation } from '../utils/useModalAnimation';

interface MissingTracksModalProps {
  isOpen: boolean;
  missingTracks: Track[];
  language?: AppLanguage;
  onClose: () => void;
  onRelocateInFolder: () => Promise<{ total: number; found: number } | null>;
  onClearMissingTracks: () => void;
  onContinueAsIs: () => void;
}

export const MissingTracksModal: React.FC<MissingTracksModalProps> = ({
  isOpen,
  missingTracks,
  language = 'ru',
  onClose,
  onRelocateInFolder,
  onClearMissingTracks,
  onContinueAsIs,
}) => {
  const t = getTranslations(language);
  const [isListExpanded, setIsListExpanded] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResult, setSearchResult] = useState<{ total: number; found: number } | null>(null);

  const cachedTracksRef = useRef<Track[]>(missingTracks);
  if (missingTracks.length > 0) {
    cachedTracksRef.current = missingTracks;
  }
  const displayTracks = missingTracks.length > 0 ? missingTracks : cachedTracksRef.current;

  const { isRendered, backdropClass, dialogClass } = useModalAnimation(isOpen && displayTracks.length > 0, 200);

  useEffect(() => {
    if (isOpen) {
      setSearchResult(null);
      setIsSearching(false);
      setIsListExpanded(false);
    }
  }, [isOpen]);

  if (!isRendered || displayTracks.length === 0) return null;

  const handleStartFolderSearch = async () => {
    setIsSearching(true);
    setSearchResult(null);
    try {
      const res = await onRelocateInFolder();
      if (res) {
        setSearchResult(res);
        if (res.found === res.total) {
          setTimeout(() => {
            onClose();
          }, 1500);
        }
      }
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[70] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 select-none cursor-pointer ${backdropClass}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onContinueAsIs();
        }
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`max-w-lg w-full max-h-[85vh] rounded-3xl bg-md3-surface border border-md3-outline-variant/30 shadow-2xl flex flex-col overflow-hidden cursor-default ${dialogClass}`}
      >
        {/* Header */}
        <div className="p-6 pb-4 border-b border-md3-outline-variant/15 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-sm">
              <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="font-bold text-base text-md3-on-surface">
                {t.missingTracks.title}
              </h3>
              <p className="text-xs text-amber-500 font-semibold mt-0.5">
                {t.missingTracks.missingCount}: {displayTracks.length}
              </p>
            </div>
          </div>

          <button
            onClick={onContinueAsIs}
            className="w-8 h-8 rounded-full flex items-center justify-center text-md3-on-surface-variant hover:text-md3-on-surface hover:bg-md3-surface-container transition-colors cursor-pointer"
            title={t.missingTracks.continueAsIs}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          <p className="text-xs text-md3-on-surface-variant leading-relaxed">
            {t.missingTracks.desc}
          </p>

          {/* Search Result Banner if any */}
          {searchResult && (
            <div className="p-3.5 rounded-2xl bg-md3-primary/10 border border-md3-primary/25 flex items-center gap-3 text-xs text-md3-on-surface">
              <CheckCircle2 className="w-5 h-5 text-md3-primary shrink-0" />
              <div>
                <span className="font-bold text-md3-primary">
                  {t.missingTracks.foundAndRelocated}: {searchResult.found} / {searchResult.total}
                </span>
                {searchResult.found < searchResult.total && (
                  <p className="text-[11px] text-md3-on-surface-variant mt-0.5">
                    {language === 'ru' 
                      ? 'Оставшиеся файлы можно указать вручную или очистить.' 
                      : 'Remaining tracks can be located manually or cleared.'}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Collapsible List of Missing Tracks */}
          <div className="rounded-2xl bg-md3-surface-container border border-md3-outline-variant/15 overflow-hidden">
            <button
              onClick={() => setIsListExpanded(!isListExpanded)}
              className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-md3-on-surface hover:bg-md3-surface-container-high transition-colors cursor-pointer"
            >
              <span>
                {isListExpanded ? t.missingTracks.hideList : t.missingTracks.showList} ({displayTracks.length})
              </span>
              {isListExpanded ? (
                <ChevronDown className="w-4 h-4 text-md3-on-surface-variant" />
              ) : (
                <ChevronRight className="w-4 h-4 text-md3-on-surface-variant" />
              )}
            </button>

            {isListExpanded && (
              <div className="max-h-48 overflow-y-auto custom-scrollbar border-t border-md3-outline-variant/10 divide-y divide-md3-outline-variant/10">
                {displayTracks.map((tr) => (
                  <div key={tr.id} className="px-4 py-2 text-xs flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-md3-on-surface truncate">
                        {tr.artist} — {tr.title}
                      </div>
                      <div className="text-[10px] text-md3-on-surface-variant/70 truncate font-mono">
                        {tr.path || '—'}
                      </div>
                    </div>
                    <FileAudio className="w-3.5 h-3.5 text-md3-on-surface-variant/40 shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-md3-surface-container-high border-t border-md3-outline-variant/15 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <button
            onClick={onClearMissingTracks}
            disabled={isSearching}
            className="w-full sm:w-auto px-4 py-2.5 rounded-full text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            <span>{t.missingTracks.clearFromLibrary}</span>
          </button>

          <div className="w-full sm:w-auto flex items-center gap-2">
            <button
              onClick={onContinueAsIs}
              disabled={isSearching}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-full text-xs font-semibold text-md3-on-surface-variant hover:text-md3-on-surface hover:bg-md3-surface-container transition-colors cursor-pointer disabled:opacity-50"
            >
              {t.missingTracks.continueAsIs}
            </button>

            <button
              onClick={handleStartFolderSearch}
              disabled={isSearching}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-full text-xs font-bold bg-md3-primary text-md3-on-primary hover:opacity-90 shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t.missingTracks.searchingInFolder}</span>
                </>
              ) : (
                <>
                  <FolderSearch className="w-4 h-4" />
                  <span>{t.missingTracks.findInFolder}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
