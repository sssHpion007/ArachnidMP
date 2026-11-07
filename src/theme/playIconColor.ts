import { colord } from 'colord';

/**
 * Derives a play glyph color from a custom card color while following the
 * interface theme. Dark and AMOLED themes use a hue-preserving darker tint;
 * light themes use a lighter tint. The transformation is continuous for all
 * input colors, so it never jumps to neutral black or white at a contrast
 * threshold.
 */
export const getThemedPlayIconColor = (
  color: string | undefined,
  isDarkTheme: boolean
): string | undefined => {
  if (!color || color === 'default' || !color.startsWith('#')) {
    return undefined;
  }

  const source = colord(color);
  if (!source.isValid()) return undefined;

  const { h, s, l } = source.toHsl();
  const shadedLightness = isDarkTheme
    ? l * 0.35
    : l + (100 - l) * 0.65;

  return colord({ h, s, l: shadedLightness }).toHex();
};
