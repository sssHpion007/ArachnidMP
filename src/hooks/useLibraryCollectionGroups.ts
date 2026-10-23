import { useEffect, useState } from 'react';
import type { AppLanguage } from '../i18n';
import type { Track } from '../types/music';
import {
  acquireLibraryCollectionGroups,
  peekLibraryCollectionGroups,
  type LibraryCollectionGroup,
  type LibraryCollectionKind,
} from '../services/libraryCollectionIndex';

interface CollectionSnapshot {
  tracks: Track[];
  kind: LibraryCollectionKind;
  language: AppLanguage;
  groups: LibraryCollectionGroup[];
  isLoading: boolean;
}

/** Shares one lazy-built collection index between the full and mini player. */
export function useLibraryCollectionGroups(
  tracks: Track[],
  kind: LibraryCollectionKind,
  language: AppLanguage,
  enabled = true,
): { groups: LibraryCollectionGroup[]; isLoading: boolean } {
  const [snapshot, setSnapshot] = useState<CollectionSnapshot | null>(null);
  const cachedGroups = enabled ? peekLibraryCollectionGroups(tracks, kind, language) : null;
  const matchesSnapshot = snapshot?.tracks === tracks
    && snapshot.kind === kind
    && snapshot.language === language;

  const groups = !enabled
    ? []
    : matchesSnapshot
      ? snapshot.groups
      : cachedGroups || [];
  const isLoading = enabled && (
    matchesSnapshot ? snapshot.isLoading : cachedGroups === null
  );

  useEffect(() => {
    if (!enabled) {
      setSnapshot(null);
      return;
    }

    let active = true;
    const subscription = acquireLibraryCollectionGroups(tracks, kind, language);
    setSnapshot({
      tracks,
      kind,
      language,
      groups: subscription.groups || [],
      isLoading: subscription.groups === null,
    });

    subscription.promise.then(result => {
      if (active) {
        setSnapshot({ tracks, kind, language, groups: result, isLoading: false });
      }
    }).catch(() => {
      if (active) {
        setSnapshot({ tracks, kind, language, groups: [], isLoading: false });
      }
    });

    return () => {
      active = false;
      subscription.release();
    };
  }, [tracks, kind, language, enabled]);

  return { groups, isLoading };
}
