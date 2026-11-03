export interface HsvColor {
  h: number;
  s: number;
  v: number;
}

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export const normalizeHexColor = (value: string): string | null => {
  const hex = value.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return `#${hex.split('').map(channel => channel + channel).join('').toLowerCase()}`;
  }
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return `#${hex.toLowerCase()}`;
  }
  return null;
};

export const hexToRgb = (value: string): RgbColor => {
  const hex = normalizeHexColor(value) || '#ffffff';
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
};

export const rgbToHex = ({ r, g, b }: RgbColor): string => {
  const channelToHex = (channel: number) => clampChannel(channel).toString(16).padStart(2, '0');
  return `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`;
};

const clampChannel = (channel: number): number => Math.min(255, Math.max(0, Math.round(channel)));

export const hexToHsv = (value: string): HsvColor => {
  const hex = normalizeHexColor(value) || '#ffffff';
  const red = parseInt(hex.slice(1, 3), 16) / 255;
  const green = parseInt(hex.slice(3, 5), 16) / 255;
  const blue = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  let hue = 0;
  if (delta !== 0) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }

  return {
    h: (hue + 360) % 360,
    s: max === 0 ? 0 : delta / max,
    v: max,
  };
};

export const hsvToHex = ({ h, s, v }: HsvColor): string => {
  const hue = ((h % 360) + 360) % 360;
  const saturation = Math.min(1, Math.max(0, s));
  const value = Math.min(1, Math.max(0, v));
  const chroma = value * saturation;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = value - chroma;

  let rgb: [number, number, number];
  if (hue < 60) rgb = [chroma, x, 0];
  else if (hue < 120) rgb = [x, chroma, 0];
  else if (hue < 180) rgb = [0, chroma, x];
  else if (hue < 240) rgb = [0, x, chroma];
  else if (hue < 300) rgb = [x, 0, chroma];
  else rgb = [chroma, 0, x];

  return `#${rgb.map(channel => Math.round((channel + match) * 255).toString(16).padStart(2, '0')).join('')}`;
};
