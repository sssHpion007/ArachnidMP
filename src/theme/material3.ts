import { colord, extend } from 'colord';
import harmoniesPlugin from 'colord/plugins/harmonies';
import a11yPlugin from 'colord/plugins/a11y';
import { M3ThemeColors, ThemeMode } from '../types/music';

extend([harmoniesPlugin, a11yPlugin]);

// Default Arachnid Brand Color (Material 3 Deep Violet)
export const DEFAULT_SEED_COLOR = '#8b5cf6';

export function generateM3Palette(seedHex: string, mode: ThemeMode = 'dark'): M3ThemeColors {
  const seed = colord(seedHex).isValid() ? colord(seedHex) : colord(DEFAULT_SEED_COLOR);
  const isLight = mode === 'light';
  const isAmoled = mode === 'amoled';

  // Primary
  const primary = isLight ? seed.darken(0.15).toHex() : seed.lighten(0.15).toHex();
  const onPrimary = isLight ? '#ffffff' : '#000000';
  const primaryContainer = isLight ? seed.lighten(0.35).toHex() : seed.darken(0.35).toHex();
  const onPrimaryContainer = isLight ? seed.darken(0.3).toHex() : seed.lighten(0.35).toHex();

  // Secondary (slightly desaturated analogue)
  const secondaryBase = seed.rotate(20).desaturate(0.2);
  const secondary = isLight ? secondaryBase.darken(0.15).toHex() : secondaryBase.lighten(0.1).toHex();
  const onSecondary = isLight ? '#ffffff' : '#000000';
  const secondaryContainer = isLight ? secondaryBase.lighten(0.35).toHex() : secondaryBase.darken(0.38).toHex();
  const onSecondaryContainer = isLight ? secondaryBase.darken(0.3).toHex() : secondaryBase.lighten(0.3).toHex();

  // Tertiary (complementary accent)
  const tertiaryBase = seed.rotate(60).saturate(0.1);
  const tertiary = isLight ? tertiaryBase.darken(0.15).toHex() : tertiaryBase.lighten(0.15).toHex();
  const onTertiary = isLight ? '#ffffff' : '#000000';
  const tertiaryContainer = isLight ? tertiaryBase.lighten(0.35).toHex() : tertiaryBase.darken(0.35).toHex();
  const onTertiaryContainer = isLight ? tertiaryBase.darken(0.3).toHex() : tertiaryBase.lighten(0.35).toHex();

  // Surfaces & Backgrounds
  let background: string;
  let surface: string;
  let surfaceContainerLowest: string;
  let surfaceContainerLow: string;
  let surfaceContainer: string;
  let surfaceContainerHigh: string;
  let surfaceContainerHighest: string;
  let onBackground: string;
  let onSurface: string;
  let surfaceVariant: string;
  let onSurfaceVariant: string;
  let outline: string;
  let outlineVariant: string;

  if (isAmoled) {
    background = '#000000';
    surface = '#000000';
    surfaceContainerLowest = '#000000';
    surfaceContainerLow = '#0a0a0c';
    surfaceContainer = '#111215';
    surfaceContainerHigh = '#18191d';
    surfaceContainerHighest = '#222328';
    onBackground = '#e3e2e6';
    onSurface = '#e3e2e6';
    surfaceVariant = '#44474f';
    onSurfaceVariant = '#c4c6d0';
    outline = '#8e9099';
    outlineVariant = '#44474f';
  } else if (isLight) {
    background = '#fdf8fd';
    surface = '#fdf8fd';
    surfaceContainerLowest = '#ffffff';
    surfaceContainerLow = '#f7f2fa';
    surfaceContainer = '#f3edf7';
    surfaceContainerHigh = '#ece6f0';
    surfaceContainerHighest = '#e6e0ea';
    onBackground = '#1d1b20';
    onSurface = '#1d1b20';
    surfaceVariant = '#e7e0ec';
    onSurfaceVariant = '#49454f';
    outline = '#79747e';
    outlineVariant = '#cac4d0';
  } else {
    // Standard M3 Dark Mode
    const neutral = seed.desaturate(0.85);
    background = neutral.darken(0.55).toHex();
    surface = neutral.darken(0.55).toHex();
    surfaceContainerLowest = neutral.darken(0.58).toHex();
    surfaceContainerLow = neutral.darken(0.52).toHex();
    surfaceContainer = neutral.darken(0.48).toHex();
    surfaceContainerHigh = neutral.darken(0.44).toHex();
    surfaceContainerHighest = neutral.darken(0.40).toHex();
    onBackground = '#e6e1e5';
    onSurface = '#e6e1e5';
    surfaceVariant = neutral.darken(0.32).toHex();
    onSurfaceVariant = '#cac4d0';
    outline = '#938f99';
    outlineVariant = '#49454f';
  }

  return {
    primary,
    onPrimary,
    primaryContainer,
    onPrimaryContainer,
    secondary,
    onSecondary,
    secondaryContainer,
    onSecondaryContainer,
    tertiary,
    onTertiary,
    tertiaryContainer,
    onTertiaryContainer,
    background,
    onBackground,
    surface,
    onSurface,
    surfaceVariant,
    onSurfaceVariant,
    surfaceContainerLowest,
    surfaceContainerLow,
    surfaceContainer,
    surfaceContainerHigh,
    surfaceContainerHighest,
    outline,
    outlineVariant,
  };
}

export function applyM3ThemeToDOM(colors: M3ThemeColors, mode: ThemeMode) {
  const root = document.documentElement;

  // Set dark/light class
  if (mode === 'light') {
    root.classList.remove('dark');
  } else {
    root.classList.add('dark');
  }

  root.style.setProperty('--md-sys-color-primary', colors.primary);
  root.style.setProperty('--md-sys-color-on-primary', colors.onPrimary);
  root.style.setProperty('--md-sys-color-primary-container', colors.primaryContainer);
  root.style.setProperty('--md-sys-color-on-primary-container', colors.onPrimaryContainer);
  root.style.setProperty('--md-sys-color-secondary', colors.secondary);
  root.style.setProperty('--md-sys-color-on-secondary', colors.onSecondary);
  root.style.setProperty('--md-sys-color-secondary-container', colors.secondaryContainer);
  root.style.setProperty('--md-sys-color-on-secondary-container', colors.onSecondaryContainer);
  root.style.setProperty('--md-sys-color-tertiary', colors.tertiary);
  root.style.setProperty('--md-sys-color-on-tertiary', colors.onTertiary);
  root.style.setProperty('--md-sys-color-tertiary-container', colors.tertiaryContainer);
  root.style.setProperty('--md-sys-color-on-tertiary-container', colors.onTertiaryContainer);
  root.style.setProperty('--md-sys-color-background', colors.background);
  root.style.setProperty('--md-sys-color-on-background', colors.onBackground);
  root.style.setProperty('--md-sys-color-surface', colors.surface);
  root.style.setProperty('--md-sys-color-on-surface', colors.onSurface);
  root.style.setProperty('--md-sys-color-surface-variant', colors.surfaceVariant);
  root.style.setProperty('--md-sys-color-on-surface-variant', colors.onSurfaceVariant);
  root.style.setProperty('--md-sys-color-surface-container-lowest', colors.surfaceContainerLowest);
  root.style.setProperty('--md-sys-color-surface-container-low', colors.surfaceContainerLow);
  root.style.setProperty('--md-sys-color-surface-container', colors.surfaceContainer);
  root.style.setProperty('--md-sys-color-surface-container-high', colors.surfaceContainerHigh);
  root.style.setProperty('--md-sys-color-surface-container-highest', colors.surfaceContainerHighest);
  root.style.setProperty('--md-sys-color-outline', colors.outline);
  root.style.setProperty('--md-sys-color-outline-variant', colors.outlineVariant);
}

/**
 * Extracts vibrant dominant color from an image URL or Blob using Canvas
 */
export async function extractDominantColor(imageSrc: string): Promise<string> {
  return new Promise((resolve) => {
    if (!imageSrc) {
      resolve(DEFAULT_SEED_COLOR);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageSrc;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(DEFAULT_SEED_COLOR);
          return;
        }

        const size = 64;
        canvas.width = size;
        canvas.height = size;
        ctx.drawImage(img, 0, 0, size, size);

        const data = ctx.getImageData(0, 0, size, size).data;
        let r = 0, g = 0, b = 0, count = 0;
        let bestColor = DEFAULT_SEED_COLOR;
        let maxSaturation = -1;

        for (let i = 0; i < data.length; i += 16) {
          const cr = data[i];
          const cg = data[i + 1];
          const cb = data[i + 2];
          const ca = data[i + 3];

          if (ca < 128) continue; // skip transparent

          // Exclude extreme whites/blacks from primary dominance
          const luminance = (cr * 0.299 + cg * 0.587 + cb * 0.114) / 255;
          if (luminance > 0.92 || luminance < 0.08) continue;

          const color = colord({ r: cr, g: cg, b: cb });
          const sat = color.toHsl().s;

          if (sat > maxSaturation) {
            maxSaturation = sat;
            bestColor = color.toHex();
          }

          r += cr;
          g += cg;
          b += cb;
          count++;
        }

        if (maxSaturation > 20) {
          resolve(bestColor);
        } else if (count > 0) {
          resolve(colord({ r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) }).toHex());
        } else {
          resolve(DEFAULT_SEED_COLOR);
        }
      } catch (e) {
        console.warn('Could not extract color from image:', e);
        resolve(DEFAULT_SEED_COLOR);
      }
    };

    img.onerror = () => {
      resolve(DEFAULT_SEED_COLOR);
    };
  });
}
