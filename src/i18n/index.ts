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
    mute: string;
    unmute: string;
    repeatOff: string;
    repeatAll: string;
    repeatOne: string;
    repeatPrefix: string;
    shuffleOn: string;
    shuffleOff: string;
    search: string;
    searchShort: string;
    openFiles: string;
    equalizer: string;
    settings: string;
    discordToggle: string;
    clearQueue: string;
    emptyQueue: string;
    addToFavorites: string;
    removeFromFavorites: string;
    trackDetails: string;
    spectrum: string;
    seek: string;
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
    themeCurtainSelect: string;
    builtinThemes: string;
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
    pickDiscordColor: string;
    pickTelegramColor: string;
    duotonePresets: string;
    primaryAccent: string;
    secondaryAccent: string;
    customCssActive: string;
    customCssFile: string;
    refreshStyles: string;
    crossfade: string;
    crossfadeOff: string;
    crossfadeOffDesc: string;
    crossfadeChangePause: string;
    crossfadeChangePauseDesc: string;
    crossfadeAlways: string;
    crossfadeAlwaysDesc: string;
    fadeDuration: string;
    navigationTabs: string;
    navigationTabsDesc: string;
    discordRpc: string;
    discordEnabled: string;
    discordDisabled: string;
    discordToggle: string;
    discordToggleDesc: string;
    discordPreview: string;
    discordTopBar: string;
    discordTopBarDesc: string;
    playing: string;
    paused: string;
    language: string;
    languageCurtainSelect: string;
    languageDesc: string;
    openLocalesFolder: string;
    shortcuts: string;
    shortcutsDesc: string;
    about: string;
    aboutDesc: string;
    done: string;
    back: string;
    updates: string;
    checkUpdates: string;
    checkingUpdates: string;
    latestVersionInstalled: string;
    updateAvailable: string;
    downloadUpdate: string;
    downloadAsset: string;
    installUpdate: string;
    installingUpdate: string;
    downloadingUpdate: string;
    failedCheckUpdates: string;
    retryCheck: string;
    releaseNotes: string;
    autoUpdateSettings: string;
    autoUpdateCheck: string;
    autoUpdateEnabled: string;
    autoUpdateDisabled: string;
    autoUpdateInterval: string;
    intervalStartup: string;
    interval30m: string;
    interval1h: string;
  };
  shortcuts: {
    playbackAndSound: string;
    navigationAndPanels: string;
    space: string;
    spaceKey: string;
    nextTrack: string;
    prevTrack: string;
    seek: string;
    volumeAdj: string;
    trackNav: string;
    playSelected: string;
    editTags: string;
    mute: string;
    shuffle: string;
    repeat: string;
    search: string;
    queue: string;
    lyrics: string;
    discord: string;
    settings: string;
    fullscreen: string;
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
    queue: 'Очередь воспроизведения',
    lyrics: 'Текст песни',
    volume: 'Громкость',
    mute: 'Отключить звук',
    unmute: 'Включить звук',
    repeatOff: 'Откл',
    repeatAll: 'Все',
    repeatOne: 'Один',
    repeatPrefix: 'Зацикливание',
    shuffleOn: 'Случайный порядок включен',
    shuffleOff: 'Случайный порядок выключен',
    search: 'Поиск по трекам, альбомам, исполнителям...',
    searchShort: 'Поиск...',
    openFiles: 'Открыть аудиофайлы или папки',
    equalizer: 'Эквалайзер',
    settings: 'Настройки',
    discordToggle: 'Discord',
    clearQueue: 'Очистить очередь',
    emptyQueue: 'Очередь воспроизведения пуста',
    addToFavorites: 'Добавить в избранное',
    removeFromFavorites: 'Удалить из избранного',
    trackDetails: 'Сведения о треке',
    spectrum: 'Спектр воспроизведения',
    seek: 'Перемотка (±5 сек)',
  },
  settings: {
    title: 'Настройки',
    subtitle: 'Внешний вид, функции, язык',
    appearance: 'Внешний вид',
    themeMode: 'Режим темы',
    dark: 'Тёмная',
    amoled: 'AMOLED',
    light: 'Светлая',
    themeStyle: 'Стиль оформления (CSS темы)',
    themeCurtainSelect: 'Выберите тему оформления...',
    builtinThemes: 'Встроенные темы',
    themeStandard: 'Material Design 3 (Вшитая)',
    themeStandardDesc: 'Стандартная адаптивная палитра Material Design',
    themeDiscord: 'Discord',
    themeDiscordDesc: 'Тёмная эстетика Discord с акцентами',
    themeTelegram: 'Telegram',
    themeTelegramDesc: 'Ночная сине-графитовая тема',
    themeCyberpunk: 'Cyberpunk Duotone (2 цвета)',
    themeCyberpunkDesc: 'Неоновый двухцветный дуэт',
    customThemes: 'Пользовательские темы (.css)',
    openThemesFolder: 'Открыть папку с темами',
    reloadThemes: 'Обновить список',
    noCustomThemes: 'В папке themes/ пока нет .css файлов',
    colorPalette: 'Цветовая палитра',
    paletteDynamic: 'Динамическая',
    paletteDynamicDesc: 'Из обложки трека',
    paletteSystem: 'Система',
    paletteSystemDesc: 'Акцент Windows',
    paletteCustom: 'Пользовательская',
    paletteCustomDesc: 'Свой цвет',
    pickAccentColor: 'Выберите постоянный акцентный цвет:',
    pickDiscordColor: 'Выберите акцентный цвет Discord:',
    pickTelegramColor: 'Выберите акцентный цвет Telegram:',
    duotonePresets: 'Пресеты двух цветов:',
    primaryAccent: 'Основной цвет (Primary):',
    secondaryAccent: 'Второй цвет (Secondary):',
    customCssActive: 'Пользовательский CSS',
    customCssFile: 'Файл:',
    refreshStyles: 'Обновить стили',
    crossfade: 'Плавное затухание (Fade)',
    crossfadeOff: 'Выключено',
    crossfadeOffDesc: 'Без затухания',
    crossfadeChangePause: 'Смена и пауза',
    crossfadeChangePauseDesc: 'Мягкие переходы',
    crossfadeAlways: 'Всегда',
    crossfadeAlwaysDesc: 'Включая зацикливание',
    fadeDuration: 'Длительность затухания',
    navigationTabs: 'Отображение вкладок',
    navigationTabsDesc: 'Включите или отключите разделы в верхней навигационной панели:',
    discordRpc: 'Интеграция с Discord',
    discordEnabled: 'Включено',
    discordDisabled: 'Выключено',
    discordToggle: 'Включить отображение активности в Discord',
    discordToggleDesc: 'Транслировать текущий трек, обложку и статус воспроизведения в Discord',
    discordPreview: 'Предпросмотр профиля Discord',
    discordTopBar: 'Кнопка в верхней панели',
    discordTopBarDesc: 'Отображать быстрый переключатель Discord в правом углу (горячая клавиша: D)',
    playing: 'Играет',
    paused: 'Пауза',
    language: 'Язык интерфейса',
    languageCurtainSelect: 'Выберите язык интерфейса...',
    languageDesc: 'Язык отображения элементов управления и настроек (определяется автоматически)',
    openLocalesFolder: 'Открыть папку локализации',
    shortcuts: 'Горячие клавиши',
    shortcutsDesc: 'Список клавиатурных комбинаций для быстрого управления',
    about: 'О программе',
    aboutDesc: 'Модульный аудиоплеер с поддержкой gapless loop, Discord RPC и тем оформления',
    done: 'Готово',
    back: 'Назад к настройкам',
    updates: 'Обновления',
    checkUpdates: 'Проверить обновления',
    checkingUpdates: 'Проверка обновлений...',
    latestVersionInstalled: 'У вас установлена актуальная версия',
    updateAvailable: 'Доступна новая версия',
    downloadUpdate: 'Скачать обновление',
    downloadAsset: 'Скачать файл (.exe)',
    installUpdate: 'Установить и перезапустить',
    installingUpdate: 'Установка обновления и перезапуск...',
    downloadingUpdate: 'Загрузка обновления...',
    failedCheckUpdates: 'Не удалось проверить обновления',
    retryCheck: 'Повторить попытку',
    releaseNotes: 'Что нового',
    autoUpdateSettings: 'Настройка обновлений',
    autoUpdateCheck: 'Автопроверка обновлений',
    autoUpdateEnabled: 'Включено',
    autoUpdateDisabled: 'Выключено',
    autoUpdateInterval: 'Частота проверки:',
    intervalStartup: 'При запуске',
    interval30m: '30 минут',
    interval1h: '1 час',
  },
  shortcuts: {
    playbackAndSound: 'Воспроизведение и звук',
    navigationAndPanels: 'Навигация и панели',
    space: 'Старт / Пауза',
    spaceKey: 'Пробел',
    nextTrack: 'Следующий трек',
    prevTrack: 'Предыдущий трек',
    seek: 'Перемотка (±5 сек)',
    volumeAdj: 'Громкость (±5%)',
    trackNav: 'Навигация по трекам',
    playSelected: 'Воспроизвести выбранный',
    editTags: 'Редактировать теги',
    mute: 'Без звука (Mute)',
    shuffle: 'Случайный порядок',
    repeat: 'Режим зацикливания',
    search: 'Фокус на поле поиска',
    queue: 'Открыть / закрыть панель очереди',
    lyrics: 'Открыть / закрыть текст песни',
    discord: 'Переключить статус Discord RPC',
    settings: 'Открыть настройки',
    fullscreen: 'Полноэкранный режим',
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
    queue: 'Playback Queue',
    lyrics: 'Lyrics',
    volume: 'Volume',
    mute: 'Mute',
    unmute: 'Unmute',
    repeatOff: 'Off',
    repeatAll: 'All',
    repeatOne: 'One',
    repeatPrefix: 'Repeat',
    shuffleOn: 'Shuffle is on',
    shuffleOff: 'Shuffle is off',
    search: 'Search tracks, albums, artists...',
    searchShort: 'Search...',
    openFiles: 'Open audio files or folders',
    equalizer: 'Equalizer',
    settings: 'Settings',
    discordToggle: 'Discord',
    clearQueue: 'Clear Queue',
    emptyQueue: 'Playback queue is empty',
    addToFavorites: 'Add to Favorites',
    removeFromFavorites: 'Remove from Favorites',
    trackDetails: 'Track Details',
    spectrum: 'Audio Spectrum',
    seek: 'Seek (±5 sec)',
  },
  settings: {
    title: 'Settings',
    subtitle: 'Appearance, features, language',
    appearance: 'Appearance',
    themeMode: 'Theme Mode',
    dark: 'Dark',
    amoled: 'AMOLED',
    light: 'Light',
    themeStyle: 'Theme Style (CSS Themes)',
    themeCurtainSelect: 'Select a theme style...',
    builtinThemes: 'Built-in Themes',
    themeStandard: 'Material Design 3 (Built-in)',
    themeStandardDesc: 'Standard Material Design adaptive palette',
    themeDiscord: 'Discord',
    themeDiscordDesc: 'Discord dark aesthetic with color accents',
    themeTelegram: 'Telegram',
    themeTelegramDesc: 'Night blue & graphite theme',
    themeCyberpunk: 'Cyberpunk Duotone (2 colors)',
    themeCyberpunkDesc: 'Vibrant two-tone neon duet',
    customThemes: 'Custom Themes (.css)',
    openThemesFolder: 'Open Themes Folder',
    reloadThemes: 'Refresh List',
    noCustomThemes: 'No .css files found in themes/ folder yet',
    colorPalette: 'Color Palette',
    paletteDynamic: 'Dynamic',
    paletteDynamicDesc: 'From album artwork',
    paletteSystem: 'System',
    paletteSystemDesc: 'Windows accent',
    paletteCustom: 'Custom',
    paletteCustomDesc: 'Custom color',
    pickAccentColor: 'Choose constant accent color:',
    pickDiscordColor: 'Choose Discord accent color:',
    pickTelegramColor: 'Choose Telegram accent color:',
    duotonePresets: 'Two-tone presets:',
    primaryAccent: 'Primary Color:',
    secondaryAccent: 'Secondary Color:',
    customCssActive: 'Custom CSS Theme',
    customCssFile: 'File:',
    refreshStyles: 'Refresh Styles',
    crossfade: 'Audio Crossfade',
    crossfadeOff: 'Off',
    crossfadeOffDesc: 'No crossfade',
    crossfadeChangePause: 'Change & Pause',
    crossfadeChangePauseDesc: 'Smooth transitions',
    crossfadeAlways: 'Always',
    crossfadeAlwaysDesc: 'Including track loop',
    fadeDuration: 'Fade Duration',
    navigationTabs: 'Navigation Tabs',
    navigationTabsDesc: 'Show or hide sections in the top navigation bar:',
    discordRpc: 'Discord Integration',
    discordEnabled: 'Enabled',
    discordDisabled: 'Disabled',
    discordToggle: 'Enable Discord Rich Presence',
    discordToggleDesc: 'Broadcast current track, cover artwork, and status to Discord',
    discordPreview: 'Discord Profile Preview',
    discordTopBar: 'Top Bar Quick Button',
    discordTopBarDesc: 'Show quick Discord toggle button in top right corner (hotkey: D)',
    playing: 'Playing',
    paused: 'Paused',
    language: 'Interface Language',
    languageCurtainSelect: 'Select interface language...',
    languageDesc: 'Application interface display language (automatically detected on first launch)',
    openLocalesFolder: 'Open Locales Folder',
    shortcuts: 'Keyboard Shortcuts',
    shortcutsDesc: 'List of keyboard shortcuts for quick player control',
    about: 'About Arachnid',
    aboutDesc: 'Modular audio player with gapless looping, Discord RPC, and customizable themes',
    done: 'Done',
    back: 'Back to settings',
    updates: 'Updates',
    checkUpdates: 'Check for Updates',
    checkingUpdates: 'Checking for updates...',
    latestVersionInstalled: 'You have the latest version installed',
    updateAvailable: 'New version available',
    downloadUpdate: 'Download Update',
    downloadAsset: 'Download file (.exe)',
    installUpdate: 'Install & Restart',
    installingUpdate: 'Installing update & restarting...',
    downloadingUpdate: 'Downloading update...',
    failedCheckUpdates: 'Failed to check for updates',
    retryCheck: 'Retry',
    releaseNotes: 'Release notes',
    autoUpdateSettings: 'Update Settings',
    autoUpdateCheck: 'Automatic update check',
    autoUpdateEnabled: 'Enabled',
    autoUpdateDisabled: 'Disabled',
    autoUpdateInterval: 'Check frequency:',
    intervalStartup: 'At startup',
    interval30m: '30 minutes',
    interval1h: '1 hour',
  },
  shortcuts: {
    playbackAndSound: 'Playback and Sound',
    navigationAndPanels: 'Navigation and Panels',
    space: 'Play / Pause',
    spaceKey: 'Space',
    nextTrack: 'Next Track',
    prevTrack: 'Previous Track',
    seek: 'Seek (±5 sec)',
    volumeAdj: 'Volume (±5%)',
    trackNav: 'Navigate Tracks',
    playSelected: 'Play Selected Track',
    editTags: 'Edit Tags',
    mute: 'Mute / Unmute',
    shuffle: 'Shuffle Mode',
    repeat: 'Repeat Mode',
    search: 'Focus Search Bar',
    queue: 'Open / Close Queue Panel',
    lyrics: 'Open / Close Lyrics Panel',
    discord: 'Toggle Discord RPC Status',
    settings: 'Open Settings',
    fullscreen: 'Fullscreen Mode',
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
