import React from 'react';
import { AlertTriangle, Music2 } from 'lucide-react';
import type { Track } from '../types/music';
import type { AppLanguage } from '../i18n';
import { coverVariantUrl } from '../utils/coverArt';
import { formatTime } from '../services/tagEditor';

interface MiniTrackRowProps {
  track: Track;
  active?: boolean;
  selected?: boolean;
  language: AppLanguage;
  index?: number;
  totalCount?: number;
  style?: React.CSSProperties;
  onClick: () => void;
}

export const MiniTrackRow: React.FC<MiniTrackRowProps> = ({
  track,
  active = false,
  selected = false,
  language,
  index,
  totalCount,
  style,
  onClick,
}) => (
  <button
    type="button"
    role={index !== undefined ? 'listitem' : undefined}
    aria-posinset={index !== undefined ? index + 1 : undefined}
    aria-setsize={totalCount}
    style={style}
    aria-current={active ? 'true' : undefined}
    aria-selected={selected ? true : undefined}
    onClick={onClick}
    className={`group flex w-full min-w-0 items-center gap-2.5 rounded-2xl p-2 text-left transition-[background-color,color,box-shadow] duration-150 ease-out ${
      selected && active
        ? 'bg-md3-primary-container font-semibold text-md3-on-primary-container shadow-sm ring-2 ring-inset ring-md3-primary/70'
        : selected
          ? 'bg-md3-primary/10 ring-1 ring-inset ring-md3-primary/50 text-md3-on-surface'
          : active
            ? 'bg-md3-primary-container font-semibold text-md3-on-primary-container shadow-sm'
            : 'text-md3-on-surface hover:bg-md3-surface-container-high'
    }`}
  >
    <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-md3-surface-container-highest shadow-sm">
      {track.coverArt ? (
        <img src={coverVariantUrl(track.coverArt, 96)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-md3-primary/10 text-md3-primary/70"><Music2 size={16} /></span>
      )}
    </span>
    <span className="min-w-0 flex-1">
      <span className={`flex items-center gap-1.5 truncate text-[11px] font-bold ${track.isMissing ? 'text-amber-500 dark:text-amber-400' : active ? 'text-md3-on-primary-container' : ''}`}>
        <span className="truncate">{track.title}</span>
        {track.isMissing && <span title={language === 'ru' ? 'Файл не найден' : 'File not found'}><AlertTriangle size={12} className="shrink-0" /></span>}
      </span>
      <span className="block truncate text-[10px] text-md3-on-surface-variant">{track.artist}</span>
    </span>
    <span className="shrink-0 text-[10px] tabular-nums text-md3-on-surface-variant">{formatTime(track.duration)}</span>
  </button>
);
