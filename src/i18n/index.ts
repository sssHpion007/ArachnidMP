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
    themeStandard: string;
    themeStandardDesc: string;
    defaultBadge: string;
    standardThemeSettings: string;
    themePaletteBtn: string;
    themePaletteBtnDesc: string;
    themeOptions: string;
    themeFolder: string;
    themeDelete: string;
    themeDeleteConfirm: string;
    themeCannotDeleteDefault: string;
    themeByAuthor: string;
    themeSingleCssNotice: string;
    openThemeFolder: string;
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
    discordSettings: string;
    discordSettingsDesc: string;
    discordStatusMode: string;
    discordStatusModeDesc: string;
    discordStatusListening: string;
    discordStatusListeningApp: string;
    discordIcons: string;
    discordIconsDesc: string;
    discordShowPlayIcon: string;
    discordShowPlayIconDesc: string;
    discordShowPauseIcon: string;
    discordShowPauseIconDesc: string;
    discordTimelineTitle: string;
    discordTimelineInfo: string;
    discordCoverTitle: string;
    discordCoverInfo: string;
    discordCustomClientId: string;
    discordCustomClientIdDesc: string;
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
    logs: string;
    logsDesc: string;
    saveLogs: string;
    logsFolder: string;
    autoScroll: string;
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
    libraryFolders: string;
    libraryFoldersDesc: string;
    portableMusicFolder: string;
    portableMusicFolderDesc: string;
    portableBadge: string;
    watchedFolders: string;
    watchedFoldersDesc: string;
    addFolder: string;
    openInExplorer: string;
    removeFolder: string;
    scanLibraryNow: string;
    scanningLibrary: string;
    autoScanStartup: string;
    autoScanStartupDesc: string;
    tracksCount: string;
  };
  missingTracks: {
    title: string;
    desc: string;
    missingCount: string;
    showList: string;
    hideList: string;
    findInFolder: string;
    searchingInFolder: string;
    foundAndRelocated: string;
    clearFromLibrary: string;
    continueAsIs: string;
    confirmClearTitle: string;
    confirmClearDesc: string;
  };
  shortcuts: {
    playbackAndSound: string;
    libraryAndManagement: string;
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
    selectAll: string;
    deleteTracks: string;
    deleteTracksFromDisk: string;
    search: string;
    queue: string;
    clearQueue: string;
    lyrics: string;
    discord: string;
    settings: string;
    switchTabs: string;
    dismiss: string;
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
    themeStyle: 'Тема оформления',
    themeCurtainSelect: 'Выберите тему оформления...',
    themeStandard: 'Material You',
    themeStandardDesc: 'Адаптивная системная палитра',
    defaultBadge: 'По умолчанию',
    standardThemeSettings: 'Настройки темы',
    themePaletteBtn: 'Настройка палитры',
    themePaletteBtnDesc: 'Настройка индивидуальных цветов элементов интерфейса',
    themeOptions: 'Опции и переключатели темы',
    themeFolder: 'Папка темы',
    themeDelete: 'Удалить тему',
    themeDeleteConfirm: 'Вы действительно хотите удалить эту тему? Файлы будут удалены с диска.',
    themeCannotDeleteDefault: 'Стандартную тему нельзя удалить',
    themeByAuthor: 'Автор',
    themeSingleCssNotice: 'Тема загружена из одиночного файла CSS в папке themes/',
    openThemeFolder: 'Открыть папку этой темы',
    openThemesFolder: 'Открыть папку с темами',
    reloadThemes: 'Обновить список тем',
    noCustomThemes: 'В папке themes/ пока нет пользовательских тем',
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
    crossfade: 'Плавное затухание',
    crossfadeOff: 'Выключено',
    crossfadeOffDesc: 'Без затухания',
    crossfadeChangePause: 'Смена и пауза',
    crossfadeChangePauseDesc: 'Затухание при ручном переключении и паузе; очередь переключается без затухания',
    crossfadeAlways: 'Всегда',
    crossfadeAlwaysDesc: 'Затухание при переключении, паузе и повторе трека',
    fadeDuration: 'Длительность затухания',
    navigationTabs: 'Отображение вкладок',
    navigationTabsDesc: 'Включите или отключите разделы в верхней навигационной панели:',
    discordRpc: 'Интеграция с Discord',
    discordEnabled: 'Включено',
    discordDisabled: 'Выключено',
    discordToggle: 'Включить отображение активности в Discord',
    discordToggleDesc: 'Транслировать текущий трек, обложку и статус воспроизведения в Discord',
    discordSettings: 'Настройки Discord',
    discordSettingsDesc: 'Статус, значки воспроизведения, обложка и предпросмотр',
    discordStatusMode: 'Формат отображения статуса',
    discordStatusModeDesc: 'Выберите, как активность отображается в вашем профиле Discord',
    discordStatusListening: '«Слушает»',
    discordStatusListeningApp: '«Слушает ArachnidMP»',
    discordIcons: 'Значки состояния воспроизведения',
    discordIconsDesc: 'Отображение значка в углу обложки при воспроизведении и на паузе',
    discordShowPlayIcon: 'Показывать значок воспроизведения',
    discordShowPlayIconDesc: 'Отображать значок Play во время звучания трека',
    discordShowPauseIcon: 'Показывать значок паузы',
    discordShowPauseIconDesc: 'Отображать значок Pause при остановке на паузу',
    discordTimelineTitle: 'Интерактивная шкала прогресса',
    discordTimelineInfo: 'Discord рассчитывает таймлайн (прошло / осталось) и отображает шкалу времени от начала до конца трека',
    discordCoverTitle: 'Обложка высокого разрешения (HD)',
    discordCoverInfo: 'Автоматический поиск обложек через iTunes и Deezer с запасным логотипом плеера',
    discordCustomClientId: 'Пользовательский Client ID (опционально)',
    discordCustomClientIdDesc: 'Укажите собственный Application ID из Discord Developer Portal при необходимости',
    discordPreview: 'Предпросмотр профиля Discord',
    discordTopBar: 'Кнопка в верхней панели',
    discordTopBarDesc: 'Отображать быстрый переключатель Discord в правом углу (горячая клавиша: D)',
    playing: 'Играет',
    paused: 'Пауза',
    language: 'Язык интерфейса',
    languageCurtainSelect: 'Выберите язык интерфейса...',
    languageDesc: '',
    openLocalesFolder: 'Открыть папку локализации',
    shortcuts: 'Горячие клавиши',
    shortcutsDesc: 'Список клавиатурных комбинаций для быстрого управления',
    logs: 'Журнал событий',
    logsDesc: 'Просмотр событий, аудиотрассировки и статистики памяти в реальном времени',
    saveLogs: 'Сохранить',
    logsFolder: 'Папка',
    autoScroll: 'Автопрокрутка',
    about: 'О программе',
    aboutDesc: 'Музыкальный плеер с гибкими настройками, поддержкой тем CSS и Discord RPC.',
    done: 'Готово',
    back: 'Назад к настройкам',
    updates: 'Обновления',
    checkUpdates: 'Проверить обновления',
    checkingUpdates: 'Проверка обновлений...',
    latestVersionInstalled: 'У вас установлена актуальная версия',
    updateAvailable: 'Доступна новая версия',
    downloadUpdate: 'Скачать обновление',
    downloadAsset: 'Скачать файл (.exe)',
    installUpdate: 'Обновить и перезагрузить',
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
    libraryFolders: 'Папки медиатеки',
    libraryFoldersDesc: 'Управление отслеживаемыми папками и портативной директорией',
    portableMusicFolder: 'Портативная папка музыки (music/)',
    portableMusicFolderDesc: 'Главная папка рядом с программой. Содержимое всегда доступно при переносе на флешку или другой ПК.',
    portableBadge: 'Портативная',
    watchedFolders: 'Отслеживаемые папки',
    watchedFoldersDesc: 'Внешние папки на компьютере, которые плеер сканирует и добавляет в медиатеку',
    addFolder: 'Добавить папку',
    openInExplorer: 'Открыть в Проводнике',
    removeFolder: 'Удалить из отслеживаемых',
    scanLibraryNow: 'Сканировать медиатеку',
    scanningLibrary: 'Сканирование медиатеки...',
    autoScanStartup: 'Сканировать медиатеку при запуске',
    autoScanStartupDesc: 'Автоматически находить новые файлы в папке music/ и отслеживаемых папках',
    tracksCount: 'треков',
  },
  missingTracks: {
    title: 'Часть треков не найдена',
    desc: 'Файлы были перемещены, удалены или буква диска изменилась.',
    missingCount: 'Недоступно треков',
    showList: 'Показать список',
    hideList: 'Скрыть список',
    findInFolder: 'Найти в папке...',
    searchingInFolder: 'Поиск файлов в папке...',
    foundAndRelocated: 'Найдено и восстановлено',
    clearFromLibrary: 'Очистить из списка',
    continueAsIs: 'Продолжить как есть',
    confirmClearTitle: 'Удалить отсутствующие треки?',
    confirmClearDesc: 'Эти треки будут удалены из медиатеки и плейлистов.',
  },
  shortcuts: {
    playbackAndSound: 'Воспроизведение и звук',
    libraryAndManagement: 'Медиатека и треки',
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
    selectAll: 'Выделить все треки в списке',
    deleteTracks: 'Удалить выбранные треки',
    deleteTracksFromDisk: 'Удалить выбранные файлы с диска',
    search: 'Фокус на поле поиска',
    queue: 'Открыть / закрыть очередь',
    clearQueue: 'Очистить очередь воспроизведения',
    lyrics: 'Открыть / закрыть текст песни',
    discord: 'Переключить статус Discord RPC',
    settings: 'Открыть настройки',
    switchTabs: 'Переключение вкладок навигации',
    dismiss: 'Закрыть окно / Сбросить выбор / Отмена',
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
    themeStyle: 'Theme',
    themeCurtainSelect: 'Select a theme...',
    themeStandard: 'Material You',
    themeStandardDesc: 'Adaptive system palette',
    defaultBadge: 'Default',
    standardThemeSettings: 'Theme Settings',
    themePaletteBtn: 'Palette Settings',
    themePaletteBtnDesc: 'Customize individual interface element colors',
    themeOptions: 'Theme Options & Toggles',
    themeFolder: 'Theme Folder',
    themeDelete: 'Delete Theme',
    themeDeleteConfirm: 'Are you sure you want to delete this theme? Files will be removed from disk.',
    themeCannotDeleteDefault: 'Default theme cannot be deleted',
    themeByAuthor: 'Author',
    themeSingleCssNotice: 'Theme loaded from a standalone CSS file in themes/',
    openThemeFolder: 'Open This Theme Folder',
    openThemesFolder: 'Open Themes Folder',
    reloadThemes: 'Refresh Themes List',
    noCustomThemes: 'No custom themes found in themes/ folder yet',
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
    crossfade: 'Smooth Fade',
    crossfadeOff: 'Off',
    crossfadeOffDesc: 'No crossfade',
    crossfadeChangePause: 'Change & Pause',
    crossfadeChangePauseDesc: 'Fade on manual track changes and pause; automatic queue advance stays un-faded',
    crossfadeAlways: 'Always',
    crossfadeAlwaysDesc: 'Fade on manual switches, pause, and repeat-one loops',
    fadeDuration: 'Fade Duration',
    navigationTabs: 'Navigation Tabs',
    navigationTabsDesc: 'Show or hide sections in the top navigation bar:',
    discordRpc: 'Discord Integration',
    discordEnabled: 'Enabled',
    discordDisabled: 'Disabled',
    discordToggle: 'Enable Discord Rich Presence',
    discordToggleDesc: 'Broadcast current track, cover artwork, and status to Discord',
    discordSettings: 'Discord Settings',
    discordSettingsDesc: 'Status display, playback icons, cover art, and preview',
    discordStatusMode: 'Status Display Format',
    discordStatusModeDesc: 'Choose how playback activity appears on your Discord profile',
    discordStatusListening: '“Listening to”',
    discordStatusListeningApp: '“Listening to ArachnidMP”',
    discordIcons: 'Playback State Icons',
    discordIconsDesc: 'Show small badge on artwork during playback and pause',
    discordShowPlayIcon: 'Show Play Icon',
    discordShowPlayIconDesc: 'Display green Play badge when audio is playing',
    discordShowPauseIcon: 'Show Pause Icon',
    discordShowPauseIconDesc: 'Display orange Pause badge when playback is paused',
    discordTimelineTitle: 'Interactive Timeline Bar',
    discordTimelineInfo: 'Discord automatically calculates and displays the live timeline bar from start to finish',
    discordCoverTitle: 'High-Resolution Cover Art',
    discordCoverInfo: 'Automatic HD artwork lookup via iTunes and Deezer with player logo fallback',
    discordCustomClientId: 'Custom Client ID (Optional)',
    discordCustomClientIdDesc: 'Provide your own Discord Developer Portal Application ID if desired',
    discordPreview: 'Discord Profile Preview',
    discordTopBar: 'Top Bar Quick Button',
    discordTopBarDesc: 'Show quick Discord toggle button in top right corner (hotkey: D)',
    playing: 'Playing',
    paused: 'Paused',
    language: 'Interface Language',
    languageCurtainSelect: 'Select interface language...',
    languageDesc: '',
    openLocalesFolder: 'Open Locales Folder',
    shortcuts: 'Keyboard Shortcuts',
    shortcutsDesc: 'List of keyboard shortcuts for quick player control',
    logs: 'Event Log',
    logsDesc: 'Real-time event, audio, and memory diagnostics view',
    saveLogs: 'Save',
    logsFolder: 'Folder',
    autoScroll: 'Auto-scroll',
    about: 'About Arachnid',
    aboutDesc: 'Music player with flexible settings, CSS theme support, and Discord RPC.',
    done: 'Done',
    back: 'Back to settings',
    updates: 'Updates',
    checkUpdates: 'Check for Updates',
    checkingUpdates: 'Checking for updates...',
    latestVersionInstalled: 'You have the latest version installed',
    updateAvailable: 'New version available',
    downloadUpdate: 'Download Update',
    downloadAsset: 'Download file (.exe)',
    installUpdate: 'Update & Restart',
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
    libraryFolders: 'Library Folders',
    libraryFoldersDesc: 'Manage watched folders and the portable directory',
    portableMusicFolder: 'Portable Music Folder (music/)',
    portableMusicFolderDesc: 'Primary folder next to the app. Always accessible when moved to a USB drive or another PC.',
    portableBadge: 'Portable',
    watchedFolders: 'Watched Folders',
    watchedFoldersDesc: 'External folders on your computer that the player scans and adds to the library',
    addFolder: 'Add Folder',
    openInExplorer: 'Open in Explorer',
    removeFolder: 'Remove from Watched',
    scanLibraryNow: 'Scan Library Now',
    scanningLibrary: 'Scanning Library...',
    autoScanStartup: 'Scan library on startup',
    autoScanStartupDesc: 'Automatically detect new tracks in music/ and watched folders upon launch',
    tracksCount: 'tracks',
  },
  missingTracks: {
    title: 'Some Tracks Not Found',
    desc: 'Files were moved, deleted, or the drive letter changed.',
    missingCount: 'Unavailable tracks',
    showList: 'Show list',
    hideList: 'Hide list',
    findInFolder: 'Find in Folder...',
    searchingInFolder: 'Searching files in folder...',
    foundAndRelocated: 'Found and restored',
    clearFromLibrary: 'Remove from Library',
    continueAsIs: 'Continue as is',
    confirmClearTitle: 'Remove Missing Tracks?',
    confirmClearDesc: 'These tracks will be removed from the library and playlists.',
  },
  shortcuts: {
    playbackAndSound: 'Playback and Sound',
    libraryAndManagement: 'Library & Tracks',
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
    selectAll: 'Select All Tracks in View',
    deleteTracks: 'Delete Selected Tracks',
    deleteTracksFromDisk: 'Delete Selected Files from Disk',
    search: 'Focus Search Bar',
    queue: 'Open / Close Queue',
    clearQueue: 'Clear Playback Queue',
    lyrics: 'Open / Close Lyrics Panel',
    discord: 'Toggle Discord RPC Status',
    settings: 'Open Settings',
    switchTabs: 'Switch Navigation Tabs',
    dismiss: 'Close Modal / Clear Selection / Cancel',
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
