export type AppLanguage = 'ru' | 'en';

export interface Translations {
  nav: {
    tracks: string;
    playlists: string;
    albums: string;
    artists: string;
    favorites: string;
    genres: string;
  };
  controls: {
    play: string;
    pause: string;
    next: string;
    prev: string;
    queue: string;
    lyrics: string;
    volume: string;
    repeatOff: string;
    repeatAll: string;
    repeatOne: string;
    shuffle: string;
    search: string;
  };
  settings: {
    title: string;
    subtitle: string;
    appearance: string;
    themeMode: string;
    dark: string;
    amoled: string;
    light: string;
    themeStyle: string;
    themeStandard: string;
    themeStandardDesc: string;
    themeDiscord: string;
    themeDiscordDesc: string;
    themeTelegram: string;
    themeTelegramDesc: string;
    themeCyberpunk: string;
    themeCyberpunkDesc: string;
    customThemes: string;
    openThemesFolder: string;
    reloadThemes: string;
    noCustomThemes: string;
    colorPalette: string;
    paletteDynamic: string;
    paletteDynamicDesc: string;
    paletteSystem: string;
    paletteSystemDesc: string;
    paletteCustom: string;
    paletteCustomDesc: string;
    pickAccentColor: string;
    primaryAccent: string;
    secondaryAccent: string;
    crossfade: string;
    crossfadeDesc: string;
    navigationTabs: string;
    discordRpc: string;
    discordToggle: string;
    discordTopBar: string;
    language: string;
    languageDesc: string;
    openLocalesFolder: string;
    shortcuts: string;
    shortcutsDesc: string;
    about: string;
  };
  shortcuts: {
    space: string;
    ctrlArrows: string;
    arrowsNav: string;
    enterPlay: string;
    shiftEnterEdit: string;
    keyF: string;
    keyM: string;
    keyQ: string;
    keyL: string;
    keyD: string;
    keyComma: string;
  };
}

export const RU_TRANSLATIONS: Translations = {
  nav: {
    tracks: 'Все треки',
    playlists: 'Плейлисты',
    albums: 'Альбомы',
    artists: 'Исполнители',
    favorites: 'Избранное',
    genres: 'Жанры',
  },
  controls: {
    play: 'Воспроизвести',
    pause: 'Пауза',
    next: 'Следующий трек',
    prev: 'Предыдущий трек',
    queue: 'Очередь',
    lyrics: 'Текст песни',
    volume: 'Громкость',
    repeatOff: 'Повтор выключен',
    repeatAll: 'Повторять все',
    repeatOne: 'Повторять один трек (без паузы)',
    shuffle: 'Случайный порядок',
    search: 'Поиск по трекам, альбомам, исполнителям...',
  },
  settings: {
    title: 'Настройки',
    subtitle: 'Внешний вид, затухание, язык и Discord RPC',
    appearance: 'Внешний вид',
    themeMode: 'Режим темы',
    dark: 'Тёмная',
    amoled: 'AMOLED',
    light: 'Светлая',
    themeStyle: 'Стиль оформления',
    themeStandard: 'Material Design 3 (Стандартная)',
    themeStandardDesc: 'Фирменный адаптивный дизайн Arachnid',
    themeDiscord: 'Discord',
    themeDiscordDesc: 'Тёмная гамма в стиле Discord с Blurple акцентом',
    themeTelegram: 'Telegram',
    themeTelegramDesc: 'Классический ночной интерфейс Telegram',
    themeCyberpunk: 'Cyberpunk Duotone',
    themeCyberpunkDesc: 'Стильный неоновый градиент из двух цветов',
    customThemes: 'Пользовательские темы (.css)',
    openThemesFolder: 'Открыть папку с темами',
    reloadThemes: 'Обновить список тем',
    noCustomThemes: 'В папке themes/ пока нет .css файлов',
    colorPalette: 'Цветовая палитра',
    paletteDynamic: 'Динамическая',
    paletteDynamicDesc: 'Из обложки трека',
    paletteSystem: 'Система',
    paletteSystemDesc: 'Акцент Windows',
    paletteCustom: 'Пользовательская',
    paletteCustomDesc: 'Свой цвет',
    pickAccentColor: 'Выберите постоянный акцентный цвет:',
    primaryAccent: 'Основной цвет (Primary):',
    secondaryAccent: 'Второй цвет (Secondary):',
    crossfade: 'Плавное затухание (Fade)',
    crossfadeDesc: 'Сглаживание переходов между треками и при паузе',
    navigationTabs: 'Отображение вкладок',
    discordRpc: 'Интеграция с Discord',
    discordToggle: 'Включить отображение активности в Discord',
    discordTopBar: 'Кнопка в верхней панели',
    language: 'Язык интерфейса',
    languageDesc: 'Язык отображения элементов управления и настроек',
    openLocalesFolder: 'Открыть папку локализации',
    shortcuts: 'Горячие клавиши',
    shortcutsDesc: 'Список клавиатурных комбинаций для быстрого управления',
    about: 'О программе',
  },
  shortcuts: {
    space: 'Воспроизведение / Пауза',
    ctrlArrows: 'Регулировка громкости',
    arrowsNav: 'Перемещение выделения по списку треков',
    enterPlay: 'Воспроизвести выбранный трек',
    shiftEnterEdit: 'Редактировать теги выбранного трека',
    keyF: 'Фокус на поле поиска',
    keyM: 'Включить / отключить звук',
    keyQ: 'Открыть / закрыть панель очереди',
    keyL: 'Открыть / закрыть текст песни',
    keyD: 'Переключить статус Discord RPC',
    keyComma: 'Открыть настройки',
  },
};

export const EN_TRANSLATIONS: Translations = {
  nav: {
    tracks: 'All Tracks',
    playlists: 'Playlists',
    albums: 'Albums',
    artists: 'Artists',
    favorites: 'Favorites',
    genres: 'Genres',
  },
  controls: {
    play: 'Play',
    pause: 'Pause',
    next: 'Next Track',
    prev: 'Previous Track',
    queue: 'Queue',
    lyrics: 'Lyrics',
    volume: 'Volume',
    repeatOff: 'Repeat Off',
    repeatAll: 'Repeat All',
    repeatOne: 'Repeat One (Gapless loop)',
    shuffle: 'Shuffle',
    search: 'Search tracks, albums, artists...',
  },
  settings: {
    title: 'Settings',
    subtitle: 'Appearance, crossfade, language, and Discord RPC',
    appearance: 'Appearance',
    themeMode: 'Theme Mode',
    dark: 'Dark',
    amoled: 'AMOLED',
    light: 'Light',
    themeStyle: 'Theme Style',
    themeStandard: 'Material Design 3 (Standard)',
    themeStandardDesc: 'Default adaptive Arachnid experience',
    themeDiscord: 'Discord',
    themeDiscordDesc: 'Discord dark theme with Blurple accent',
    themeTelegram: 'Telegram',
    themeTelegramDesc: 'Classic Telegram night interface',
    themeCyberpunk: 'Cyberpunk Duotone',
    themeCyberpunkDesc: 'Vibrant two-tone neon gradient style',
    customThemes: 'Custom Themes (.css)',
    openThemesFolder: 'Open Themes Folder',
    reloadThemes: 'Reload themes list',
    noCustomThemes: 'No .css files found in themes/ folder yet',
    colorPalette: 'Color Palette',
    paletteDynamic: 'Dynamic',
    paletteDynamicDesc: 'From album artwork',
    paletteSystem: 'System',
    paletteSystemDesc: 'Windows accent',
    paletteCustom: 'Custom',
    paletteCustomDesc: 'Custom color',
    pickAccentColor: 'Choose accent color:',
    primaryAccent: 'Primary color:',
    secondaryAccent: 'Secondary color:',
    crossfade: 'Audio Crossfade',
    crossfadeDesc: 'Smooth volume fading between tracks and on pause',
    navigationTabs: 'Navigation Tabs',
    discordRpc: 'Discord Integration',
    discordToggle: 'Enable Discord Rich Presence',
    discordTopBar: 'Top Bar Discord Button',
    language: 'Interface Language',
    languageDesc: 'Display language for interface and settings',
    openLocalesFolder: 'Open Locales Folder',
    shortcuts: 'Keyboard Shortcuts',
    shortcutsDesc: 'List of shortcuts for fast player navigation',
    about: 'About Arachnid',
  },
  shortcuts: {
    space: 'Play / Pause',
    ctrlArrows: 'Volume Up / Down',
    arrowsNav: 'Move selection up / down in tracklist',
    enterPlay: 'Play selected track',
    shiftEnterEdit: 'Edit tags for selected track',
    keyF: 'Focus search bar',
    keyM: 'Mute / Unmute',
    keyQ: 'Open / Close Queue',
    keyL: 'Open / Close Lyrics',
    keyD: 'Toggle Discord RPC',
    keyComma: 'Open Settings',
  },
};

/**
 * Detects system language on first launch:
 * If Windows/browser locale starts with 'ru', 'be', 'uk', 'kk', defaults to 'ru', otherwise 'en'
 */
export function detectSystemLanguage(): AppLanguage {
  if (typeof navigator !== 'undefined' && navigator.language) {
    const lang = navigator.language.toLowerCase();
    if (lang.startsWith('ru') || lang.startsWith('be') || lang.startsWith('uk') || lang.startsWith('kk')) {
      return 'ru';
    }
  }
  return 'en';
}

export function getTranslations(lang: AppLanguage): Translations {
  return lang === 'ru' ? RU_TRANSLATIONS : EN_TRANSLATIONS;
}
