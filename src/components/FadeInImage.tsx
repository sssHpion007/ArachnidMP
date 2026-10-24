import React, { useState } from 'react';

type FadeInImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  /** Whether this image should currently be visible (useful for cycling covers). */
  isVisible?: boolean;
  /** Fade duration in milliseconds. */
  fadeDurationMs?: number;
};

/** Keep the cover placeholder visible until the image has decoded and is ready to paint. */
export const FadeInImage: React.FC<FadeInImageProps> = ({
  src,
  isVisible = true,
  fadeDurationMs = 450,
  className,
  style,
  onLoad,
  ...imageProps
}) => {
  const [loadedSource, setLoadedSource] = useState<string | undefined>();
  const isLoaded = Boolean(src) && loadedSource === src;

  return (
    <img
      {...imageProps}
      src={src}
      className={className}
      onLoad={event => {
        setLoadedSource(src);
        onLoad?.(event);
      }}
      style={{
        ...style,
        opacity: isLoaded && isVisible ? (style?.opacity ?? 1) : 0,
        transition: `opacity ${fadeDurationMs}ms ease, transform 300ms ease`,
      }}
    />
  );
};
