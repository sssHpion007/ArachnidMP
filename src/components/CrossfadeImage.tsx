import React, { useEffect, useRef, useState } from 'react';

interface ImageLayer {
  src: string;
  opacity: 0 | 1;
}

interface CrossfadeImageProps {
  src: string | null | undefined;
  alt?: string;
  className?: string;
  fadeDurationMs?: number;
  preserveCurrentWhileSourceMissing?: boolean;
  onSourceLoad?: (src: string) => void;
  onSourceError?: (src: string) => void;
}

const loadedImageSources = new Map<string, true>();
const MAX_REMEMBERED_IMAGE_SOURCES = 512;

const rememberLoadedImage = (source: string) => {
  loadedImageSources.delete(source);
  loadedImageSources.set(source, true);
  if (loadedImageSources.size > MAX_REMEMBERED_IMAGE_SOURCES) {
    const oldestSource = loadedImageSources.keys().next().value;
    if (oldestSource !== undefined) loadedImageSources.delete(oldestSource);
  }
};

/** Keeps the previous cover visible until the next track's cover has loaded. */
export const CrossfadeImage: React.FC<CrossfadeImageProps> = ({
  src,
  alt = '',
  className = '',
  fadeDurationMs = 450,
  preserveCurrentWhileSourceMissing = false,
  onSourceLoad,
  onSourceError,
}) => {
  const [layers, setLayers] = useState<ImageLayer[]>(() => src
    ? [{ src, opacity: loadedImageSources.has(src) ? 1 : 0 }]
    : []);
  const latestSourceRef = useRef(src);
  const cleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  latestSourceRef.current = src;

  useEffect(() => {
    if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);
    cleanupTimerRef.current = null;

    if (!src && preserveCurrentWhileSourceMissing) return;

    setLayers(current => {
      const visibleLayer = current.reduce<ImageLayer | null>(
        (best, layer) => !best || layer.opacity > best.opacity ? layer : best,
        null,
      );
      if (visibleLayer?.src === src) return current;
      const next: ImageLayer[] = visibleLayer
        ? [{ src: visibleLayer.src, opacity: src ? 1 : 0 }]
        : [];
      if (src) next.push({ src, opacity: 0 });
      return next;
    });

    if (!src) {
      cleanupTimerRef.current = setTimeout(() => setLayers([]), fadeDurationMs);
    }
    return () => {
      if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    };
  }, [src, fadeDurationMs, preserveCurrentWhileSourceMissing]);

  useEffect(() => () => {
    if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);
  }, []);

  const handleLoad = (loadedSource: string) => {
    rememberLoadedImage(loadedSource);
    if (latestSourceRef.current !== loadedSource) return;
    onSourceLoad?.(loadedSource);
    setLayers(current => current.map(layer => ({
      ...layer,
      opacity: layer.src === loadedSource ? 1 : 0,
    })));
    if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);
    cleanupTimerRef.current = setTimeout(() => {
      setLayers(current => current.filter(layer => layer.src === loadedSource));
      cleanupTimerRef.current = null;
    }, fadeDurationMs);
  };

  return (
    <>
      {layers.map(layer => (
        <img
          key={layer.src}
          src={layer.src}
          alt={alt}
          draggable={false}
          decoding="async"
          className={className}
          onLoad={() => handleLoad(layer.src)}
          onError={() => {
            if (latestSourceRef.current !== layer.src) return;
            onSourceError?.(layer.src);
            setLayers(current => {
              const fallback = current.find(candidate => candidate.src !== layer.src);
              return fallback
                ? [{ ...fallback, opacity: 1 }]
                : current.filter(candidate => candidate.src !== layer.src);
            });
          }}
          style={{ opacity: layer.opacity, transition: `opacity ${fadeDurationMs}ms ease, transform 300ms ease` }}
        />
      ))}
    </>
  );
};
