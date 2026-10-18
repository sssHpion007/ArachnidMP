import React from 'react';
import { 
  Folder, 
  Gamepad2, 
  Headphones, 
  Music, 
  Heart, 
  Flame, 
  Sparkles, 
  Disc3, 
  Radio, 
  Film, 
  Coffee, 
  Zap, 
  Star, 
  Smile, 
  Car, 
  Moon, 
  BookOpen, 
  Trophy,
  Skull,
  Bug,
  Cat,
  Crown,
  Sword,
  CloudLightning,
  Dumbbell
} from 'lucide-react';

export interface FolderIconOption {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}

const HornedDemon: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) =>
  React.createElement(
    'svg',
    {
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className,
      style,
      'aria-hidden': true,
    },
    React.createElement('path', { d: 'M8.2 8.2C5.8 7.1 4.1 5 3.6 2.5c2.8.5 5.2 2.2 6.5 4.8' }),
    React.createElement('path', { d: 'M15.8 8.2c2.4-1.1 4.1-3.2 4.6-5.7-2.8.5-5.2 2.2-6.5 4.8' }),
    React.createElement('path', { d: 'M5 12.2c0-3.5 3-5.8 7-5.8s7 2.3 7 5.8v3c0 4.1-2.8 6.3-7 6.3s-7-2.2-7-6.3v-3Z' }),
    React.createElement('path', { d: 'm8 14 2.5-1v2.2L8 14Zm8 0-2.5-1v2.2L16 14Z' }),
    React.createElement('path', { d: 'M9 18c1.7 1 4.3 1 6 0m-4.5.5v1m3-1v1' })
  );

export const FOLDER_ICONS: FolderIconOption[] = [
  { id: 'folder', label: 'Папка', icon: Folder },
  { id: 'gamepad', label: 'Игры / OST', icon: Gamepad2 },
  { id: 'headphones', label: 'Наушники', icon: Headphones },
  { id: 'music', label: 'Музыка', icon: Music },
  { id: 'heart', label: 'Избранное', icon: Heart },
  { id: 'flame', label: 'Огонь / Хиты', icon: Flame },
  { id: 'sparkles', label: 'Вайб / Магия', icon: Sparkles },
  { id: 'disc', label: 'Винил / Альбомы', icon: Disc3 },
  { id: 'film', label: 'Кино / OST', icon: Film },
  { id: 'radio', label: 'Радио / Шоу', icon: Radio },
  { id: 'coffee', label: 'Чилл / Лаундж', icon: Coffee },
  { id: 'zap', label: 'Драйв / Энергия', icon: Zap },
  { id: 'star', label: 'Топ / Звёзды', icon: Star },
  { id: 'car', label: 'В дорогу / Авто', icon: Car },
  { id: 'moon', label: 'Ночь / Сон', icon: Moon },
  { id: 'book', label: 'Учёба / Фокус', icon: BookOpen },
  { id: 'trophy', label: 'Награды / Топ', icon: Trophy },
  { id: 'smile', label: 'Позитив', icon: Smile },
  { id: 'ghost', label: 'Демон', icon: HornedDemon },
  { id: 'skull', label: 'Хоррор / Метал', icon: Skull },
  { id: 'bug', label: 'Насекомые / Пауки', icon: Bug },
  { id: 'cat', label: 'Кошки', icon: Cat },
  { id: 'crown', label: 'Королевское / Топ', icon: Crown },
  { id: 'sword', label: 'Игры / Битвы', icon: Sword },
  { id: 'storm', label: 'Шторм / Электроника', icon: CloudLightning },
  { id: 'fitness', label: 'Тренировки / Спорт', icon: Dumbbell },
];

export const getFolderIconComponent = (iconId?: string) => {
  const found = FOLDER_ICONS.find((i) => i.id === iconId);
  return found ? found.icon : Folder;
};

export const getFolderColorHex = (color: string | undefined): string => {
  if (!color || color === 'default') {
    return 'rgb(var(--md-sys-color-primary-rgb))';
  }
  return color;
};

/**
 * Returns a play-icon color for a button filled with the given custom color.
 * The icon absorbs the playlist/folder color hue and follows the theme
 * direction: a darkened shade in dark themes, a lightened shade in light
 * themes. Falls back to plain black/white when the shaded variant does not
 * reach sufficient contrast (3:1) against the button background.
 * Returns undefined when no custom color is set, so the themed
 * `text-md3-on-primary` class applies instead.
 */
export const getThemedPlayIconColor = (
  color: string | undefined,
  isDarkTheme: boolean
): string | undefined => {
  if (!color || color === 'default' || !color.startsWith('#')) {
    return undefined;
  }
  let c = color.slice(1);
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const num = parseInt(c, 16);
  if (Number.isNaN(num)) return undefined;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;

  const mix = (target: number): [number, number, number] => [
    Math.round(r + (target - r) * 0.65),
    Math.round(g + (target - g) * 0.65),
    Math.round(b + (target - b) * 0.65),
  ];
  // Theme direction: dark themes take a darkened shade, light themes a lightened one
  const [sr, sg, sb] = isDarkTheme ? mix(0) : mix(255);

  const toLinear = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const relLum = (rr: number, gg: number, bb: number) =>
    0.2126 * toLinear(rr) + 0.7152 * toLinear(gg) + 0.0722 * toLinear(bb);

  const lBg = relLum(r, g, b);
  const lIcon = relLum(sr, sg, sb);
  const contrast = (Math.max(lBg, lIcon) + 0.05) / (Math.min(lBg, lIcon) + 0.05);

  const hex = (v: number) => v.toString(16).padStart(2, '0');
  const shadedColor = `#${hex(sr)}${hex(sg)}${hex(sb)}`;
  if (contrast >= 3.0) {
    return shadedColor;
  }

  // If even the theme-direction endpoint (black in dark mode, white in light
  // mode) cannot meet 3:1, no icon in that direction can. Preserve the tinted
  // shade rather than switching to the opposite, visually jarring color.
  const endpointLuminance = isDarkTheme ? relLum(0, 0, 0) : relLum(255, 255, 255);
  const endpointContrast =
    (Math.max(lBg, endpointLuminance) + 0.05) /
    (Math.min(lBg, endpointLuminance) + 0.05);
  if (endpointContrast < 3.0) {
    return shadedColor;
  }

  // Fallback: maximum-contrast plain black/white when it can meet the target.
  const perceptual = 0.299 * r + 0.587 * g + 0.114 * b;
  return perceptual > 150 ? '#000000' : '#ffffff';
};
