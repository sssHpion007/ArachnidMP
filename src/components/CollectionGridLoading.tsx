import React from 'react';
import { AppLanguage } from '../i18n';

type CollectionKind = 'artists' | 'albums' | 'genres';

interface CollectionGridLoadingProps {
  title: string;
  kind: CollectionKind;
  columnsClassName: string;
  language: AppLanguage;
}

export const CollectionGridLoading: React.FC<CollectionGridLoadingProps> = ({
  title,
  kind,
  columnsClassName,
  language,
}) => (
  <div className="flex-1 overflow-y-auto custom-scrollbar p-6 select-none">
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-md3-on-surface">{title}</h1>
        <p className="text-xs text-md3-on-surface-variant mt-0.5">
          {language === 'ru' ? 'Подготавливаем коллекцию…' : 'Preparing your collection…'}
        </p>
      </div>
      <div className="w-5 h-5 rounded-full border-2 border-md3-primary/25 border-t-md3-primary animate-spin" aria-hidden="true" />
    </div>

    <div className={`grid ${columnsClassName} gap-5`} aria-busy="true" aria-label={title}>
      {Array.from({ length: 12 }, (_, index) => (
        <div
          key={index}
          className={`rounded-3xl border border-md3-outline-variant/10 bg-md3-surface-container-low p-4 animate-pulse ${
            kind === 'genres' ? 'aspect-[4/3] flex flex-col justify-between' : ''
          }`}
        >
          {kind !== 'genres' && (
            <div className={`bg-md3-surface-container-high ${kind === 'artists' ? 'w-32 h-32 rounded-full mx-auto mb-3' : 'aspect-square rounded-2xl mb-3'}`} />
          )}
          <div className={kind === 'artists' ? 'text-center space-y-2' : 'space-y-2'}>
            <div className={`h-3 rounded-full bg-md3-surface-container-high ${index % 3 === 0 ? 'w-4/5' : 'w-3/5'} ${kind === 'artists' ? 'mx-auto' : ''}`} />
            <div className={`h-2.5 rounded-full bg-md3-surface-container-high/70 w-2/5 ${kind === 'artists' ? 'mx-auto' : ''}`} />
          </div>
        </div>
      ))}
    </div>
  </div>
);
