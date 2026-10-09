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
  Trophy 
} from 'lucide-react';

export interface FolderIconOption {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}

export const FOLDER_ICONS: FolderIconOption[] = [
  { id: 'folder', label: 'Папка', icon: Folder },
  { id: 'gamepad', label: 'Игры / OST', icon: Gamepad2 },
  { id: 'headphones', label: 'Наушники', icon: Headphones },
  { id: 'music', label: 'Музыка', icon: Music },
  { id: 'heart', label: 'Любимое', icon: Heart },
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
];

export const getFolderIconComponent = (iconId?: string) => {
  const found = FOLDER_ICONS.find((i) => i.id === iconId);
  return found ? found.icon : Folder;
};
