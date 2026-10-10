import { colord, extend } from 'colord';
import harmoniesPlugin from 'colord/plugins/harmonies';
import a11yPlugin from 'colord/plugins/a11y';
import { M3ThemeColors, ThemeMode } from '../types/music';
import { isTauri, invoke } from '@tauri-apps/api/core';

extend([harmoniesPlugin, a11yPlugin]);

// Default Arachnid Brand Color (Material 3 Deep Violet)
export const DEFAULT_SEED_COLOR = '#8b5cf6';

/**
 * Reads the user's actual Windows accent color from the OS (via Tauri registry command, with CSS fallback)
 */
export async function getWindowsAccentColor(): Promise<string> {
  if (isTauri()) {
    try {
      const color = await invoke<string>('get_system_accent_color');
      if (color && color.startsWith('#') && color.length === 7) {
        return color;
      }
    } catch (e) {
      console.warn('Failed to get system accent color from Tauri:', e);
    }
  }

  // Web browser fallback: CSS AccentColor keyword
  try {
    const el = document.createElement('div');
    el.style.display = 'none';
    el.style.color = 'AccentColor';
    document.body.appendChild(el);
    const computed = window.getComputedStyle(el).color;
    document.body.removeChild(el);

    if (computed && computed.startsWith('rgb')) {
      const match = computed.match(/\d+/g);
      if (match && match.length >= 3) {
        const r = parseInt(match[0], 10).toString(16).padStart(2, '0');
        const g = parseInt(match[1], 10).toString(16).padStart(2, '0');
        const b = parseInt(match[2], 10).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
      }
    }
  } catch (_) {}

  return '#0078d4'; // Standard Windows Blue default
}

export function generateM3Palette(seedHex: string, mode: ThemeMode = 'dark'): M3ThemeColors {
  const seed = colord(seedHex).isValid() ? colord(seedHex) : colord(DEFAULT_SEED_COLOR);
  const { h, s } = seed.toHsl();
  const isLight = mode === 'light';
  const isAmoled = mode === 'amoled';

  // Hue-anchored tone generator
  // Ensures consistent, beautiful Material Design 3 tokens
  const primarySat = Math.max(50, Math.min(85, s));
  const secondaryHue = (h + 15) % 360;
  const tertiaryHue = (h + 60) % 360;

  let primary: string;
  let onPrimary: string;
  let primaryContainer: string;
  let onPrimaryContainer: string;

  let secondary: string;
  let onSecondary: string;
  let secondaryContainer: string;
  let onSecondaryContainer: string;

  let tertiary: string;
  let onTertiary: string;
  let tertiaryContainer: string;
  let onTertiaryContainer: string;

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

  if (isLight) {
    primary = colord({ h, s: primarySat, l: 40 }).toHex();
    onPrimary = '#ffffff';
    primaryContainer = colord({ h, s: Math.min(50, primarySat), l: 90 }).toHex();
    onPrimaryContainer = colord({ h, s: primarySat, l: 15 }).toHex();

    secondary = colord({ h: secondaryHue, s: 35, l: 45 }).toHex();
    onSecondary = '#ffffff';
    secondaryContainer = colord({ h: secondaryHue, s: 35, l: 90 }).toHex();
    onSecondaryContainer = colord({ h: secondaryHue, s: 45, l: 15 }).toHex();

    tertiary = colord({ h: tertiaryHue, s: 40, l: 45 }).toHex();
    onTertiary = '#ffffff';
    tertiaryContainer = colord({ h: tertiaryHue, s: 40, l: 92 }).toHex();
    onTertiaryContainer = colord({ h: tertiaryHue, s: 50, l: 15 }).toHex();

    background = colord({ h, s: 12, l: 98 }).toHex();
    surface = colord({ h, s: 12, l: 98 }).toHex();
    surfaceContainerLowest = '#ffffff';
    surfaceContainerLow = colord({ h, s: 12, l: 95 }).toHex();
    surfaceContainer = colord({ h, s: 12, l: 92 }).toHex();
    surfaceContainerHigh = colord({ h, s: 12, l: 88 }).toHex();
    surfaceContainerHighest = colord({ h, s: 12, l: 85 }).toHex();
    onBackground = '#1d1b20';
    onSurface = '#1d1b20';
    surfaceVariant = colord({ h, s: 15, l: 90 }).toHex();
    onSurfaceVariant = '#49454f';
    outline = '#79747e';
    outlineVariant = '#cac4d0';
  } else if (isAmoled) {
    // Pure OLED black background
    primary = colord({ h, s: primarySat, l: 75 }).toHex();
    onPrimary = colord({ h, s: 40, l: 15 }).toHex();
    primaryContainer = colord({ h, s: 50, l: 25 }).toHex();
    onPrimaryContainer = colord({ h, s: 30, l: 90 }).toHex();

    secondary = colord({ h: secondaryHue, s: 35, l: 75 }).toHex();
    onSecondary = colord({ h: secondaryHue, s: 40, l: 15 }).toHex();
    secondaryContainer = colord({ h: secondaryHue, s: 35, l: 25 }).toHex();
    onSecondaryContainer = colord({ h: secondaryHue, s: 30, l: 90 }).toHex();

    tertiary = colord({ h: tertiaryHue, s: 45, l: 75 }).toHex();
    onTertiary = colord({ h: tertiaryHue, s: 45, l: 15 }).toHex();
    tertiaryContainer = colord({ h: tertiaryHue, s: 45, l: 25 }).toHex();
    onTertiaryContainer = colord({ h: tertiaryHue, s: 30, l: 90 }).toHex();

    background = '#000000';
    surface = '#000000';
    surfaceContainerLowest = '#000000';
    surfaceContainerLow = '#09090b';
    surfaceContainer = '#121215';
    surfaceContainerHigh = '#1a1a1f';
    surfaceContainerHighest = '#24242a';
    onBackground = '#e6e1e5';
    onSurface = '#e6e1e5';
    surfaceVariant = '#35353d';
    onSurfaceVariant = '#c4c6d0';
    outline = '#8e9099';
    outlineVariant = '#44474f';
  } else {
    // Standard Material 3 Dark Mode (Soft tinted dark tones, NOT pitch black)
    primary = colord({ h, s: primarySat, l: 76 }).toHex();
    onPrimary = colord({ h, s: 50, l: 18 }).toHex();
    primaryContainer = colord({ h, s: 48, l: 30 }).toHex();
    onPrimaryContainer = colord({ h, s: 35, l: 90 }).toHex();

    secondary = colord({ h: secondaryHue, s: 35, l: 75 }).toHex();
    onSecondary = colord({ h: secondaryHue, s: 35, l: 18 }).toHex();
    secondaryContainer = colord({ h: secondaryHue, s: 30, l: 30 }).toHex();
    onSecondaryContainer = colord({ h: secondaryHue, s: 25, l: 88 }).toHex();

    tertiary = colord({ h: tertiaryHue, s: 45, l: 75 }).toHex();
    onTertiary = colord({ h: tertiaryHue, s: 45, l: 18 }).toHex();
    tertiaryContainer = colord({ h: tertiaryHue, s: 40, l: 30 }).toHex();
    onTertiaryContainer = colord({ h: tertiaryHue, s: 30, l: 90 }).toHex();

    // Tinted neutral dark surfaces
    background = colord({ h, s: 10, l: 9 }).toHex();             // ~ #161519
    surface = colord({ h, s: 10, l: 10 }).toHex();                // ~ #18171b
    surfaceContainerLowest = colord({ h, s: 10, l: 7 }).toHex();  // ~ #121115
    surfaceContainerLow = colord({ h, s: 10, l: 12 }).toHex();    // ~ #1e1d22
    surfaceContainer = colord({ h, s: 10, l: 15 }).toHex();       // ~ #25242a
    surfaceContainerHigh = colord({ h, s: 10, l: 19 }).toHex();   // ~ #2f2e35
    surfaceContainerHighest = colord({ h, s: 10, l: 24 }).toHex();// ~ #3b3a42
    onBackground = '#e6e1e5';
    onSurface = '#e6e1e5';
    surfaceVariant = colord({ h, s: 12, l: 28 }).toHex();
    onSurfaceVariant = '#cac4d0';
    outline = '#938f99';
    outlineVariant = colord({ h, s: 10, l: 24 }).toHex();
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

function hexToRgbString(hex: string): string {
  const c = colord(hex);
  if (!c.isValid()) return '128 128 128';
  const { r, g, b } = c.toRgb();
  return `${r} ${g} ${b}`;
}

export function applyM3ThemeToDOM(colors: M3ThemeColors, mode: ThemeMode) {
  const root = document.documentElement;

  if (mode === 'light') {
    root.classList.remove('dark');
  } else {
    root.classList.add('dark');
  }

  const mapping: Record<string, string> = {
    'primary': colors.primary,
    'on-primary': colors.onPrimary,
    'primary-container': colors.primaryContainer,
    'on-primary-container': colors.onPrimaryContainer,
    'secondary': colors.secondary,
    'on-secondary': colors.onSecondary,
    'secondary-container': colors.secondaryContainer,
    'on-secondary-container': colors.onSecondaryContainer,
    'tertiary': colors.tertiary,
    'on-tertiary': colors.onTertiary,
    'tertiary-container': colors.tertiaryContainer,
    'on-tertiary-container': colors.onTertiaryContainer,
    'background': colors.background,
    'on-background': colors.onBackground,
    'surface': colors.surface,
    'on-surface': colors.onSurface,
    'surface-variant': colors.surfaceVariant,
    'on-surface-variant': colors.onSurfaceVariant,
    'surface-container-lowest': colors.surfaceContainerLowest,
    'surface-container-low': colors.surfaceContainerLow,
    'surface-container': colors.surfaceContainer,
    'surface-container-high': colors.surfaceContainerHigh,
    'surface-container-highest': colors.surfaceContainerHighest,
    'outline': colors.outline,
    'outline-variant': colors.outlineVariant,
  };

  for (const [key, hex] of Object.entries(mapping)) {
    root.style.setProperty(`--md-sys-color-${key}`, hex);
    root.style.setProperty(`--md-sys-color-${key}-rgb`, hexToRgbString(hex));
  }
}

export async function extractDominantColor(imageSrc: string): Promise<string> {
  return new Promise((resolve) => {
    if (!imageSrc) {
      resolve(DEFAULT_SEED_COLOR);
      return;
    }

    const img = new Image();
    if (imageSrc.startsWith('http://') || imageSrc.startsWith('https://')) {
      img.crossOrigin = 'Anonymous';
    }
    img.src = imageSrc;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(DEFAULT_SEED_COLOR);
          return;
        }

        const size = 16;
        canvas.width = size;
        canvas.height = size;
        ctx.drawImage(img, 0, 0, size, size);

        const data = ctx.getImageData(0, 0, size, size).data;
        let r = 0, g = 0, b = 0, count = 0;
        let bestR = 139, bestG = 92, bestB = 246;
        let maxSaturation = -1;

        for (let i = 0; i < data.length; i += 4) {
          const cr = data[i];
          const cg = data[i + 1];
          const cb = data[i + 2];
          const ca = data[i + 3];

          if (ca < 128) continue;

          const max = Math.max(cr, cg, cb);
          const min = Math.min(cr, cg, cb);
          const delta = max - min;
          const lum = (max + min) / 510;

          if (lum > 0.92 || lum < 0.08) continue;

          const sat = max === 0 ? 0 : delta / max;

          if (sat > maxSaturation) {
            maxSaturation = sat;
            bestR = cr;
            bestG = cg;
            bestB = cb;
          }

          r += cr;
          g += cg;
          b += cb;
          count++;
        }

        if (maxSaturation > 0.2) {
          resolve(colord({ r: bestR, g: bestG, b: bestB }).toHex());
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
