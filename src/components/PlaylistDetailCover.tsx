import React, { useEffect, useState } from 'react';
import { CrossfadeImage } from './CrossfadeImage';
import { shouldShowPlaylistDetailCoverFallback } from '../utils/playlistDetailCover';
import { coverVariantUrl } from '../utils/coverArt';

interface PlaylistDetailCoverProps {
  coverArt?: string | null;
  isResolutionPending?: boolean;
  title: string;
  icon: React.ReactNode;
  className?: string;
}

/** Keeps the current playlist artwork visible while its next cover is being resolved. */
export const PlaylistDetailCover: React.FC<PlaylistDetailCoverProps> = ({
  coverArt,
  isResolutionPending = false,
  title,
  icon,
  className = '',
}) => {
  const [hasLoadedCover, setHasLoadedCover] = useState(false);
  const [failedSource, setFailedSource] = useState<string | null>(null);

  useEffect(() => {
    if (!isResolutionPending && !coverArt) setHasLoadedCover(false);
  }, [coverArt, isResolutionPending]);

  const showFallback = shouldShowPlaylistDetailCoverFallback(
    coverArt,
    isResolutionPending,
    hasLoadedCover,
    failedSource,
  );

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {showFallback && (
        <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center bg-md3-primary/10 text-md3-primary">
          {icon}
        </div>
      )}
      <CrossfadeImage
        src={coverVariantUrl(coverArt, 96) || null}
        alt={title}
        className="pointer-events-none absolute inset-0 z-[1] h-full w-full object-cover"
        preserveCurrentWhileSourceMissing={isResolutionPending}
        onSourceLoad={() => {
          setHasLoadedCover(true);
          setFailedSource(null);
        }}
        onSourceError={() => setFailedSource(coverArt || null)}
      />
    </div>
  );
};
