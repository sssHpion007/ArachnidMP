use std::fs;
use std::path::{Path, PathBuf};
use serde_json::{json, Value};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

pub fn get_portable_base_dir() -> PathBuf {
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            return parent.to_path_buf();
        }
    }
    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

pub fn get_logs_dir() -> PathBuf {
    get_portable_base_dir().join("config").join("logs")
}

fn url_decode(input: &str) -> String {
    let mut result = Vec::new();
    let bytes = input.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(h1), Some(h2)) = (
                (bytes[i + 1] as char).to_digit(16),
                (bytes[i + 2] as char).to_digit(16),
            ) {
                result.push((h1 * 16 + h2) as u8);
                i += 3;
                continue;
            }
        }
        result.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&result).to_string()
}

/// Helper to extract filename from any cover string (asset URL, path, or filename)
fn extract_cover_filename(cover_val: &str) -> Option<String> {
    let trimmed = cover_val.trim();
    if trimmed.is_empty() {
        return None;
    }
    // Decode percent-encoding (e.g. %5C -> \, %2F -> /)
    let decoded = if trimmed.contains('%') {
        url_decode(trimmed)
    } else {
        trimmed.to_string()
    };

    let normalized = decoded.replace('\\', "/");

    // If it's an external web URL that is not asset.localhost or localhost, it's not a local cover file
    if (normalized.starts_with("http://") || normalized.starts_with("https://"))
        && !normalized.contains("asset.localhost")
        && !normalized.contains("localhost")
    {
        return None;
    }

    if let Some(pos) = normalized.rfind('/') {
        let name = &normalized[pos + 1..];
        let name_clean = name.split('?').next().unwrap_or(name);
        if !name_clean.trim().is_empty() {
            return Some(name_clean.trim().to_string());
        }
    } else if !normalized.trim().is_empty() {
        return Some(normalized.trim().to_string());
    }

    None
}

/// Normalize legacy filesystem covers while preserving inline, external, and SQLite-cache URLs.
pub fn to_portable_cover(cover_val: &str, base_dir: &Path) -> Option<String> {
    let trimmed = cover_val.trim();
    if trimmed.is_empty() {
        return None;
    }
    if trimmed.starts_with("https://cover.localhost/")
        || trimmed.starts_with("http://cover.localhost/")
        || trimmed.starts_with("cover://localhost/")
    {
        return Some(trimmed.to_string());
    }

    // Inline legacy images remain readable; native callers migrate them into the SQLite cache.
    if trimmed.starts_with("data:image/") {
        return Some(trimmed.to_string());
    }

    // 2. External web URLs (http/https not asset.localhost)
    if (trimmed.starts_with("http://") || trimmed.starts_with("https://"))
        && !trimmed.contains("asset.localhost")
        && !trimmed.contains("localhost")
    {
        return Some(trimmed.to_string());
    }

    // 3. Extract filename and verify against config/covers/
    let covers_dir = base_dir.join("config").join("covers");
    if let Some(filename) = extract_cover_filename(trimmed) {
        if covers_dir.join(&filename).exists() {
            return Some(format!("config/covers/{}", filename));
        }
    }

    // 4. Try stripping base_dir prefix
    let decoded = url_decode(trimmed);
    let p = Path::new(&decoded);
    if let Ok(rel) = p.strip_prefix(base_dir) {
        return Some(rel.to_string_lossy().replace('\\', "/"));
    }

    // 5. If already relative config/covers/...
    let norm = trimmed.replace('\\', "/");
    if norm.starts_with("config/covers/") || norm.starts_with("music/") {
        return Some(norm);
    }

    // 6. If it's a file on disk (or asset URL pointing to a file on disk)
    if p.is_file() {
        return Some(p.to_string_lossy().to_string());
    }
    let stripped_asset = if decoded.starts_with("https://asset.localhost/") {
        &decoded["https://asset.localhost/".len()..]
    } else if decoded.starts_with("http://asset.localhost/") {
        &decoded["http://asset.localhost/".len()..]
    } else {
        &decoded
    };
    let ap = Path::new(stripped_asset);
    if ap.is_file() {
        if let Ok(rel) = ap.strip_prefix(base_dir) {
            return Some(rel.to_string_lossy().replace('\\', "/"));
        }
        return Some(ap.to_string_lossy().to_string());
    }

    None
}

/// Convert any cover string from disk (relative "config/covers/...", old absolute path, old asset URL)
/// into the CURRENT valid absolute path on disk for the running player instance.
pub fn to_absolute_cover(cover_val: &str, base_dir: &Path) -> Option<String> {
    let trimmed = cover_val.trim();
    if trimmed.is_empty() {
        return None;
    }
    if trimmed.starts_with("https://cover.localhost/")
        || trimmed.starts_with("http://cover.localhost/")
        || trimmed.starts_with("cover://localhost/")
    {
        return Some(trimmed.to_string());
    }

    // 1. Base64 data URLs pass through as-is
    if trimmed.starts_with("data:image/") {
        return Some(trimmed.to_string());
    }

    // 2. External web URLs pass through as-is
    if (trimmed.starts_with("http://") || trimmed.starts_with("https://"))
        && !trimmed.contains("asset.localhost")
        && !trimmed.contains("localhost")
    {
        return Some(trimmed.to_string());
    }

    let covers_dir = base_dir.join("config").join("covers");

    // 3. Locate filename in current config/covers/
    if let Some(filename) = extract_cover_filename(trimmed) {
        let candidate = covers_dir.join(&filename);
        if candidate.exists() {
            return Some(candidate.to_string_lossy().to_string());
        }
    }

    // 4. If relative to base_dir (e.g. "config/covers/xyz.jpg")
    let norm = trimmed.replace('\\', "/");
    let candidate = base_dir.join(&norm);
    if candidate.exists() {
        return Some(candidate.to_string_lossy().to_string());
    }

    // 5. If absolute path that currently exists on disk
    let p = Path::new(trimmed);
    if p.is_file() {
        return Some(trimmed.to_string());
    }

    // 6. If asset URL decoded to an existing file on disk
    let decoded = url_decode(trimmed);
    let stripped_asset = if decoded.starts_with("https://asset.localhost/") {
        &decoded["https://asset.localhost/".len()..]
    } else if decoded.starts_with("http://asset.localhost/") {
        &decoded["http://asset.localhost/".len()..]
    } else {
        &decoded
    };
    let ap = Path::new(stripped_asset);
    if ap.is_file() {
        return Some(ap.to_string_lossy().to_string());
    }

    None
}

/// Convert any music file path inside the portable base directory to a relative "music/..." path
pub fn to_portable_music_path(path_str: &str, base_dir: &Path) -> Option<String> {
    let trimmed = path_str.trim();
    if trimmed.is_empty() {
        return None;
    }
    let norm_path = trimmed.replace('\\', "/");
    let norm_base = base_dir.to_string_lossy().replace('\\', "/");

    let norm_path_lower = norm_path.to_lowercase();
    let norm_base_lower = norm_base.to_lowercase();

    let base_prefix = if norm_base_lower.ends_with('/') {
        norm_base_lower
    } else {
        format!("{}/", norm_base_lower)
    };

    if norm_path_lower.starts_with(&base_prefix) {
        let rel = &norm_path[base_prefix.len()..];
        let rel_lower = rel.to_lowercase();
        if rel_lower.starts_with("music/") {
            return Some(rel.to_string());
        }
    } else if norm_path_lower.starts_with("music/") {
        return Some(norm_path);
    }

    None
}

/// Convert relative "music/..." path into the current OS-native absolute path on disk
pub fn to_absolute_music_path(path_str: &str, base_dir: &Path) -> Option<String> {
    let trimmed = path_str.trim();
    if trimmed.is_empty() {
        return None;
    }
    let norm = trimmed.replace('\\', "/");
    let norm_lower = norm.to_lowercase();
    if norm_lower.starts_with("music/") {
        let mut abs_path = base_dir.to_path_buf();
        for component in norm.split('/') {
            let comp_trim = component.trim();
            if !comp_trim.is_empty() && comp_trim != "." {
                abs_path.push(comp_trim);
            }
        }
        return Some(abs_path.to_string_lossy().to_string());
    }
    None
}

/// Initialize the modular directory structure on startup
pub fn init_storage_structure(base_dir: &Path) {
    let config_dir = base_dir.join("config");
    let playlists_dir = base_dir.join("playlists");
    let themes_dir = base_dir.join("themes");
    let locales_dir = base_dir.join("locales");
    let logs_dir = config_dir.join("logs");

    let _ = fs::create_dir_all(&config_dir);
    // Artwork is stored in the SQLite cover cache; do not recreate the retired config/covers folder.
    let _ = fs::create_dir_all(&logs_dir);
    let _ = fs::create_dir_all(&playlists_dir);
    let _ = fs::create_dir_all(&themes_dir);
    let _ = fs::create_dir_all(&locales_dir);

    // Create and initialize portable music/ folder
    let music_dir = base_dir.join("music");
    let _ = fs::create_dir_all(&music_dir);
    let music_readme = music_dir.join("README.txt");
    if !music_readme.exists() {
        let readme_content = "\
Arachnid Portable Music Directory / Портативная папка музыки Arachnid
======================================================================
Поместите сюда ваши аудиофайлы или папки с альбомами.

Преимущества:
1. Максимальная портативность: при переносе плеера на флешку или другой ПК 
   все файлы из этой папки будут автоматически доступны плееру без потери путей.
2. Поддерживаются любые подпапки с любой глубиной вложенности.
3. Плеер автоматически сканирует эту папку и добавляет треки в медиатеку.
";
        let _ = fs::write(music_readme, readme_content);
    }

    // Create a README in playlists/
    let playlists_readme = playlists_dir.join("README.txt");
    if !playlists_readme.exists() {
        let readme_content = "\
Arachnid Playlists Directory / Папка плейлистов Arachnid
=========================================================
В этой папке сохраняются все плейлисты в стандартном формате M3U8 (UTF-8).

Возможности:
1. Вы можете открывать любые файлы .m3u8 отсюда в сторонних плеерах (AIMP, foobar2000, VLC, Winamp).
2. Вы можете скопировать любой .m3u8 файл на флешку или телефон.
3. Вы можете скопировать сюда сторонние файлы .m3u8 или .m3u — Arachnid автоматически загрузит их при запуске!

Файл tree.json хранит информацию об иерархии папок и групп плейлистов в Arachnid.
";
        let _ = fs::write(playlists_readme, readme_content);
    }

    // Create a README in themes/ to guide users on custom themes and theme tooling
    let themes_readme = themes_dir.join("README.txt");
    if !themes_readme.exists() {
        let readme_content = "\
Arachnid Custom Themes & Tooling Guide / Руководство по созданию тем
=====================================================================

Arachnid Music Player supports two formats for custom themes:
1. Theme Folders (Папки тем с манифестом theme.json, стилями и ассетами)
2. Standalone CSS files (Одиночные файлы .css)

---
1. ТЕМЫ В ВИДЕ ПАПКИ (Folder Themes)
---
Создайте папку внутри themes/ (например, themes/my-theme/).
Внутри папки размещаются:
- theme.json — манифест темы с описанием, палитрой элементов и переключателями.
- theme.css — файл со стилями оформления.
- Ассеты — любые изображения, фоны, иконки, шрифты (например, assets/background.png). В theme.css на них можно ссылаться через url(\"assets/background.png\").

Пример структуры theme.json:
{
  \"name\": \"Neon Flux\",
  \"author\": \"Ваше имя\",
  \"version\": \"1.0.0\",
  \"description\": \"Тёмная киберпанк-тема с неоновыми акцентами\",
  \"css\": \"theme.css\",
  \"palette\": [
    {
      \"id\": \"accent\",
      \"label\": \"Основной акцент\",
      \"cssVar\": \"--md-sys-color-primary\",
      \"default\": \"#00f5d4\",
      \"description\": \"Цвет активных элементов и кнопок\"
    },
    {
      \"id\": \"background\",
      \"label\": \"Основной фон\",
      \"cssVar\": \"--md-sys-color-background\",
      \"default\": \"#0a0b10\",
      \"description\": \"Фоновый цвет плеера\"
    },
    {
      \"id\": \"surface\",
      \"label\": \"Боковая панель и карточки\",
      \"cssVar\": \"--md-sys-color-surface\",
      \"default\": \"#12141d\",
      \"description\": \"Цвет поверхностей и сайдбара\"
    },
    {
      \"id\": \"text\",
      \"label\": \"Основной текст\",
      \"cssVar\": \"--md-sys-color-on-surface\",
      \"default\": \"#ffffff\",
      \"description\": \"Цвет текста и заголовков\"
    }
  ],
  \"toggles\": [
    {
      \"id\": \"glow_buttons\",
      \"label\": \"Неоновое свечение\",
      \"description\": \"Добавляет неоновый отблеск кнопкам управления\",
      \"cssClass\": \"theme-glow-buttons\",
      \"default\": true
    },
    {
      \"id\": \"compact_player\",
      \"label\": \"Компактный плеер\",
      \"description\": \"Уменьшает высоту нижней панели воспроизведения\",
      \"cssClass\": \"theme-compact-player\",
      \"default\": false
    }
  ]
}

Пользователи смогут открыть окно «Настройка палитры» прямо в настройках темы и настроить каждый элемент палитры через интерактивный выбор цвета (как в Telegram / Discord / Fluxer)!
Любые переключатели из toggles автоматически отображаются тумблерами Вкл/Выкл в настройках темы.

---
2. ОСНОВНЫЕ ПЕРЕМЕННЫЕ CSS ПЛЕЕРА
---
Вы можете переопределять переменные Material Design 3 в theme.css:
  --md-sys-color-primary: #00f5d4;
  --md-sys-color-primary-rgb: 0 245 212;
  --md-sys-color-background: #0a0b10;
  --md-sys-color-background-rgb: 10 11 16;
  --md-sys-color-surface: #12141d;
  --md-sys-color-surface-rgb: 18 20 29;
  --md-sys-color-surface-container: #1a1d29;
  --md-sys-color-surface-container-rgb: 26 29 41;
  --md-sys-color-surface-container-high: #242838;
  --md-sys-color-surface-container-high-rgb: 36 40 56;
  --md-sys-color-on-surface: #ffffff;
  --md-sys-color-on-surface-rgb: 255 255 255;
  --md-sys-color-on-surface-variant: #9ca3af;
  --md-sys-color-outline-variant: #374151;
";
        let _ = fs::write(themes_readme, readme_content);
    }

    let example_theme = themes_dir.join("emerald-forest.css");
    if !example_theme.exists() {
        let example_content = "\
/* Emerald Forest Theme */
:root {
  --md-sys-color-primary: #10b981;
  --md-sys-color-primary-rgb: 16 185 129;
  --md-sys-color-background: #09130e;
  --md-sys-color-background-rgb: 9 19 14;
  --md-sys-color-surface: #102219;
  --md-sys-color-surface-rgb: 16 34 25;
  --md-sys-color-surface-container: #173225;
  --md-sys-color-surface-container-rgb: 23 50 37;
  --md-sys-color-surface-container-high: #1e4231;
  --md-sys-color-surface-container-high-rgb: 30 66 49;
}
";
        let _ = fs::write(example_theme, example_content);
    }

    // Create an example folder theme: themes/neon-flux
    let neon_flux_dir = themes_dir.join("neon-flux");
    if !neon_flux_dir.exists() {
        let _ = fs::create_dir_all(&neon_flux_dir);
        let manifest_path = neon_flux_dir.join("theme.json");
        let manifest_json = json!({
            "name": "Neon Flux",
            "author": "Arachnid Team",
            "version": "1.0.0",
            "description": "Киберпанк-тема с настраиваемой палитрой элементов и переключателями",
            "css": "theme.css",
            "palette": [
                {
                    "id": "accent",
                    "label": "Основной акцент",
                    "cssVar": "--md-sys-color-primary",
                    "default": "#00f5d4",
                    "description": "Цвет активных элементов, кнопок и ползунков"
                },
                {
                    "id": "background",
                    "label": "Основной фон",
                    "cssVar": "--md-sys-color-background",
                    "default": "#0a0b12",
                    "description": "Фоновый цвет главного окна приложения"
                },
                {
                    "id": "surface",
                    "label": "Боковая панель и карточки",
                    "cssVar": "--md-sys-color-surface",
                    "default": "#121420",
                    "description": "Цвет поверхностей и боковой панели"
                },
                {
                    "id": "container",
                    "label": "Контейнеры списков",
                    "cssVar": "--md-sys-color-surface-container",
                    "default": "#1a1c2c",
                    "description": "Цвет блоков плеера и списков треков"
                },
                {
                    "id": "text",
                    "label": "Основной текст",
                    "cssVar": "--md-sys-color-on-surface",
                    "default": "#f0f6fc",
                    "description": "Цвет названий треков и заголовков"
                },
                {
                    "id": "subtext",
                    "label": "Второстепенный текст",
                    "cssVar": "--md-sys-color-on-surface-variant",
                    "default": "#8b949e",
                    "description": "Цвет исполнителей, времени и подсказок"
                }
            ],
            "toggles": [
                {
                    "id": "neon_glow",
                    "label": "Неоновое свечение кнопок",
                    "description": "Добавляет мягкий неоновый отблеск активным кнопкам управления",
                    "cssClass": "theme-neon-glow",
                    "default": true
                },
                {
                    "id": "compact_player",
                    "label": "Компактная панель плеера",
                    "description": "Более плотное и аккуратное расположение элементов плеера",
                    "cssClass": "theme-compact-player",
                    "default": false
                }
            ]
        });
        let _ = fs::write(manifest_path, serde_json::to_string_pretty(&manifest_json).unwrap_or_default());

        let css_path = neon_flux_dir.join("theme.css");
        let css_content = "\
/* Neon Flux Theme */
:root {
  --md-sys-color-primary: #00f5d4;
  --md-sys-color-primary-rgb: 0 245 212;
  --md-sys-color-background: #0a0b12;
  --md-sys-color-background-rgb: 10 11 18;
  --md-sys-color-surface: #121420;
  --md-sys-color-surface-rgb: 18 20 32;
  --md-sys-color-surface-container: #1a1c2c;
  --md-sys-color-surface-container-rgb: 26 28 44;
  --md-sys-color-surface-container-high: #24273d;
  --md-sys-color-surface-container-high-rgb: 36 39 61;
  --md-sys-color-on-surface: #f0f6fc;
  --md-sys-color-on-surface-rgb: 240 246 252;
  --md-sys-color-on-surface-variant: #8b949e;
  --md-sys-color-on-surface-variant-rgb: 139 148 158;
}

/* Optional Toggle: Neon Glow Buttons */
.theme-neon-glow button:hover {
  filter: drop-shadow(0 0 6px rgba(0, 245, 212, 0.45));
  transition: filter 0.2s ease;
}

/* Optional Toggle: Compact Player Bar */
.theme-compact-player footer {
  padding-top: 0.5rem !important;
  padding-bottom: 0.5rem !important;
}
";
        let _ = fs::write(css_path, css_content);
    }

    // Create default locale files in locales/
    let ru_locale = locales_dir.join("ru.json");
    if !ru_locale.exists() {
        let ru_content = json!({
            "language": "ru",
            "name": "Русский",
            "nav": {
                "tracks": "Все треки",
                "playlists": "Плейлисты",
                "albums": "Альбомы",
                "artists": "Исполнители",
                "favorites": "Избранное",
                "genres": "Жанры"
            },
            "controls": {
                "play": "Воспроизвести",
                "pause": "Пауза",
                "next": "Следующий трек",
                "prev": "Предыдущий трек",
                "queue": "Очередь",
                "lyrics": "Текст песни"
            }
        });
        let _ = fs::write(ru_locale, serde_json::to_string_pretty(&ru_content).unwrap_or_default());
    }

    let en_locale = locales_dir.join("en.json");
    if !en_locale.exists() {
        let en_content = json!({
            "language": "en",
            "name": "English",
            "nav": {
                "tracks": "All Tracks",
                "playlists": "Playlists",
                "albums": "Albums",
                "artists": "Artists",
                "favorites": "Favorites",
                "genres": "Genres"
            },
            "controls": {
                "play": "Play",
                "pause": "Pause",
                "next": "Next Track",
                "prev": "Previous Track",
                "queue": "Queue",
                "lyrics": "Lyrics"
            }
        });
        let _ = fs::write(en_locale, serde_json::to_string_pretty(&en_content).unwrap_or_default());
    }
}

/// Automatically migrate legacy single arachnid_data.json into the modular folder structure
fn migrate_legacy_data(base_dir: &Path) {
    let legacy_file = base_dir.join("arachnid_data.json");
    let settings_file = base_dir.join("config").join("settings.json");

    // Only migrate if legacy exists and settings.json does not exist yet
    if legacy_file.is_file() && !settings_file.exists() {
        if let Ok(content) = fs::read_to_string(&legacy_file) {
            if let Ok(val) = serde_json::from_str::<Value>(&content) {
                let _ = save_modular_data(&val);
                // Create backup of old single file to ensure no loss of data
                let backup_file = base_dir.join("arachnid_data.json.bak");
                let _ = fs::rename(&legacy_file, &backup_file);
            }
        }
    }
}

/// Save only the domains present in `data` into their modular files across config/ and playlists/
pub fn save_modular_data(data: &Value) -> Result<bool, String> {
    let base_dir = get_portable_base_dir();
    init_storage_structure(&base_dir);

    let config_dir = base_dir.join("config");
    let playlists_dir = base_dir.join("playlists");

    // 1. Save Settings
    let mut settings = json!({});
    let mut has_settings = false;
    if let Some(obj) = data.as_object() {
        for (k, v) in obj {
            if k != "tracks" && k != "playlists" && k != "playlistFolders" && k != "playlistGroups" && k != "playlistTrackReferences" {
                settings[k] = v.clone();
                has_settings = true;
            }
        }
    }
    if has_settings {
        let settings_path = config_dir.join("settings.json");
        let settings_str = serde_json::to_string_pretty(&settings)
            .map_err(|e| format!("Failed to serialize settings: {}", e))?;
        fs::write(&settings_path, settings_str)
            .map_err(|e| format!("Failed to write settings to {:?}: {}", settings_path, e))?;
    }

    // 2. The SQLite database is the only active media catalog. Older library.json
    // files are deliberately left untouched for one-time ID/path recovery; never
    // overwrite them with a paginated view or remove them without user consent.

    // 3. Save Playlists Hierarchy Tree (folders & groups) only when supplied.
    // This lets settings-only writes avoid touching the playlist files.
    if data.get("playlistFolders").is_some() || data.get("playlistGroups").is_some() {
        let folders = data.get("playlistFolders").cloned().unwrap_or(json!([]));
        let groups = data.get("playlistGroups").cloned().unwrap_or(json!([]));
        let tree_json = json!({
            "playlistFolders": folders,
            "playlistGroups": groups,
        });
        let tree_path = playlists_dir.join("tree.json");
        let tree_str = serde_json::to_string_pretty(&tree_json)
            .map_err(|e| format!("Failed to serialize playlists tree: {}", e))?;
        fs::write(&tree_path, tree_str)
            .map_err(|e| format!("Failed to write playlists tree to {:?}: {}", tree_path, e))?;
    }

    // 4. Save Individual Playlists in M3U8 format
    if let Some(playlists_array) = data.get("playlists").and_then(|p| p.as_array()) {
        let mut saved_filenames = std::collections::HashSet::new();
        let mut used_stems = std::collections::HashSet::new();

        // Build track lookup map: id -> (path, artist, title, duration)
        let mut track_map: std::collections::HashMap<String, (Option<String>, String, String, i64)> = std::collections::HashMap::new();
        if let Some(tracks_arr) = data.get("playlistTrackReferences").or_else(|| data.get("tracks")).and_then(|t| t.as_array()) {
            for t in tracks_arr {
                if let Some(tid) = t.get("id").and_then(|i| i.as_str()) {
                    let p = t.get("path").and_then(|x| x.as_str()).map(|s| s.to_string());
                    let artist = t.get("artist").and_then(|x| x.as_str()).unwrap_or("Unknown Artist").to_string();
                    let title = t.get("title").and_then(|x| x.as_str()).unwrap_or("Unknown Title").to_string();
                    let duration = t.get("duration").and_then(|x| x.as_f64()).unwrap_or(0.0) as i64;
                    track_map.insert(tid.to_string(), (p, artist, title, duration));
                }
            }
        }

        for pl in playlists_array {
            let name = pl.get("name").and_then(|n| n.as_str()).unwrap_or("Playlist");
            let mut base_stem = sanitize_playlist_filename(name);
            if base_stem.is_empty() {
                base_stem = "Playlist".to_string();
            }

            // Ensure unique filename if multiple playlists share the same name
            let mut stem = base_stem.clone();
            let mut counter = 2;
            while used_stems.contains(&stem.to_lowercase()) {
                stem = format!("{} ({})", base_stem, counter);
                counter += 1;
            }
            used_stems.insert(stem.to_lowercase());

            let filename = format!("{}.m3u8", stem);
            saved_filenames.insert(filename.clone());
            let pl_path = playlists_dir.join(&filename);

            let _ = write_m3u8_playlist(&pl_path, pl, &track_map, &base_dir);
        }

        // Clean up deleted playlist files in playlists/ (both old .json and obsolete .m3u8)
        if let Ok(entries) = fs::read_dir(&playlists_dir) {
            for entry in entries.flatten() {
                let file_name = entry.file_name().to_string_lossy().to_string();
                if (file_name.ends_with(".m3u8") || file_name.ends_with(".json")) && file_name != "tree.json" {
                    if !saved_filenames.contains(&file_name) {
                        let _ = fs::remove_file(entry.path());
                    }
                }
            }
        }
    }

    Ok(true)
}

/// Load modular data across config/ and playlists/, reconstructing complete application state
pub fn load_modular_data() -> Result<Option<String>, String> {
    let base_dir = get_portable_base_dir();
    init_storage_structure(&base_dir);

    // Perform one-time migration if needed
    migrate_legacy_data(&base_dir);

    let config_dir = base_dir.join("config");
    let playlists_dir = base_dir.join("playlists");
    let settings_path = config_dir.join("settings.json");
    let library_path = config_dir.join("library.json");
    let tree_path = playlists_dir.join("tree.json");

    // If nothing exists yet, check legacy file as fallback
    if !settings_path.exists() && !library_path.exists() {
        let legacy_file = base_dir.join("arachnid_data.json");
        if legacy_file.is_file() {
            let content = fs::read_to_string(&legacy_file)
                .map_err(|e| format!("Failed to read legacy data: {}", e))?;
            return Ok(Some(content));
        }
        return Ok(None);
    }

    let mut combined = json!({});

    // 1. Read Settings
    if settings_path.is_file() {
        if let Ok(content) = fs::read_to_string(&settings_path) {
            if let Ok(val) = serde_json::from_str::<Value>(&content) {
                if let Some(obj) = val.as_object() {
                    for (k, v) in obj {
                        combined[k] = v.clone();
                    }
                }
            }
        }
    }

    // 2. Track rows are loaded from SQLite by bounded native queries. Only tracks
    // referenced by external M3U playlists are materialized below.
    combined["tracks"] = json!([]);

    // 3. Read Playlists Hierarchy Tree
    if tree_path.is_file() {
        if let Ok(content) = fs::read_to_string(&tree_path) {
            if let Ok(val) = serde_json::from_str::<Value>(&content) {
                if let Some(folders) = val.get("playlistFolders") {
                    combined["playlistFolders"] = folders.clone();
                }
                if let Some(groups) = val.get("playlistGroups") {
                    combined["playlistGroups"] = groups.clone();
                }
            }
        }
    }
    if combined.get("playlistFolders").is_none() {
        combined["playlistFolders"] = json!([]);
    }
    if combined.get("playlistGroups").is_none() {
        combined["playlistGroups"] = json!([]);
    }

    // 4. Read Individual Playlists from playlists/ (.m3u8, .m3u, and legacy .json)
    let mut playlists_list = Vec::new();
    let mut loaded_playlist_ids = std::collections::HashSet::new();

    let mut path_to_track_id: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    let mut tracks_list: Vec<Value> = combined.get("tracks")
        .and_then(|t| t.as_array())
        .cloned()
        .unwrap_or_default();

    for t in &tracks_list {
        if let (Some(tid), Some(p)) = (t.get("id").and_then(|i| i.as_str()), t.get("path").and_then(|x| x.as_str())) {
            let norm = p.replace('\\', "/").to_lowercase();
            path_to_track_id.insert(norm, tid.to_string());
        }
    }

    if let Ok(entries) = fs::read_dir(&playlists_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let file_name = entry.file_name().to_string_lossy().to_string();
            if file_name == "tree.json" || file_name == "README.txt" {
                continue;
            }

            // 4a. M3U8 or M3U Playlist
            if file_name.ends_with(".m3u8") || file_name.ends_with(".m3u") {
                if let Some(pl_val) = parse_m3u8_playlist(&path, &base_dir, &mut tracks_list, &mut path_to_track_id) {
                    if let Some(id) = pl_val.get("id").and_then(|i| i.as_str()) {
                        loaded_playlist_ids.insert(id.to_string());
                    }
                    playlists_list.push(pl_val);
                }
            }
            // 4b. Legacy JSON Playlist (fallback)
            else if file_name.ends_with(".json") {
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(mut pl) = serde_json::from_str::<Value>(&content) {
                        let pl_id = pl.get("id").and_then(|i| i.as_str()).unwrap_or("").to_string();
                        if !pl_id.is_empty() && !loaded_playlist_ids.contains(&pl_id) {
                            if let Some(cover_val) = pl.get("coverArt").and_then(|c| c.as_str()) {
                                if let Some(abs_path) = to_absolute_cover(cover_val, &base_dir) {
                                    pl["coverArt"] = json!(abs_path);
                                } else {
                                    pl["coverArt"] = json!(null);
                                }
                            }
                            loaded_playlist_ids.insert(pl_id);
                            playlists_list.push(pl);
                        }
                    }
                }
            }
        }
    }

    // Update combined tracks if external M3U playlists added new tracks
    combined["tracks"] = json!(tracks_list);

    // Sort playlists by order if present
    playlists_list.sort_by(|a, b| {
        let order_a = a.get("order").and_then(|o| o.as_i64()).unwrap_or(0);
        let order_b = b.get("order").and_then(|o| o.as_i64()).unwrap_or(0);
        order_a.cmp(&order_b)
    });
    combined["playlists"] = json!(playlists_list);

    let final_str = serde_json::to_string(&combined)
        .map_err(|e| format!("Failed to serialize combined data: {}", e))?;

    Ok(Some(final_str))
}

/// Helper to sanitize playlist name for Windows/Unix filenames
pub fn sanitize_playlist_filename(name: &str) -> String {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return "Unnamed Playlist".to_string();
    }
    let sanitized: String = trimmed.chars()
        .map(|c| match c {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            '\0'..='\x1f' => '_',
            _ => c,
        })
        .collect();
    let result = sanitized.trim_end_matches([' ', '.']).to_string();
    if result.is_empty() {
        "Playlist".to_string()
    } else {
        result
    }
}

pub fn normalize_path_components(path: &Path) -> PathBuf {
    let mut normalized = PathBuf::new();
    for comp in path.components() {
        match comp {
            std::path::Component::ParentDir => {
                normalized.pop();
            }
            std::path::Component::CurDir => {}
            _ => {
                normalized.push(comp);
            }
        }
    }
    normalized
}

pub fn write_m3u8_playlist(
    pl_path: &Path,
    pl: &Value,
    track_map: &std::collections::HashMap<String, (Option<String>, String, String, i64)>,
    base_dir: &Path,
) -> Result<(), String> {
    let mut lines = Vec::new();
    lines.push("#EXTM3U".to_string());

    let name = pl.get("name").and_then(|n| n.as_str()).unwrap_or("Playlist");
    lines.push(format!("#PLAYLIST:{}", name));

    if let Some(id) = pl.get("id").and_then(|i| i.as_str()) {
        lines.push(format!("#EXT-ARACHNID-ID:{}", id));
    }
    if let Some(desc) = pl.get("description").and_then(|d| d.as_str()) {
        let desc_trimmed = desc.trim();
        if !desc_trimmed.is_empty() {
            let escaped = desc_trimmed.replace("\r\n", "\\n").replace('\n', "\\n");
            lines.push(format!("#EXT-ARACHNID-DESC:{}", escaped));
        }
    }
    if let Some(order) = pl.get("order").and_then(|o| o.as_i64()) {
        lines.push(format!("#EXT-ARACHNID-ORDER:{}", order));
    }
    if let Some(folder_id) = pl.get("folderId").and_then(|f| f.as_str()) {
        lines.push(format!("#EXT-ARACHNID-FOLDER:{}", folder_id));
    }
    if let Some(group_id) = pl.get("groupId").and_then(|g| g.as_str()) {
        lines.push(format!("#EXT-ARACHNID-GROUP:{}", group_id));
    }
    if let Some(color) = pl.get("color").and_then(|c| c.as_str()) {
        lines.push(format!("#EXT-ARACHNID-COLOR:{}", color));
    }
    if let Some(cover_val) = pl.get("coverArt").and_then(|c| c.as_str()) {
        if let Some(portable) = to_portable_cover(cover_val, base_dir) {
            lines.push(format!("#EXT-ARACHNID-COVER:{}", portable));
        }
    }
    if let Some(cover_type) = pl.get("coverType").and_then(|ct| ct.as_str()) {
        lines.push(format!("#EXT-ARACHNID-COVERTYPE:{}", cover_type));
    }
    if let Some(is_system) = pl.get("isSystem").and_then(|s| s.as_bool()) {
        if is_system {
            lines.push("#EXT-ARACHNID-ISSYSTEM:true".to_string());
        }
    }
    if let Some(icon) = pl.get("icon").and_then(|i| i.as_str()) {
        lines.push(format!("#EXT-ARACHNID-ICON:{}", icon));
    }

    if let Some(track_ids) = pl.get("trackIds").and_then(|t| t.as_array()) {
        for tid_val in track_ids {
            if let Some(tid) = tid_val.as_str() {
                lines.push(format!("#EXT-ARACHNID-TRACKID:{}", tid));
                if let Some((path_opt, artist, title, duration)) = track_map.get(tid) {
                    lines.push(format!("#EXTINF:{},{} - {}", duration, artist, title));
                    if let Some(path) = path_opt {
                        if let Some(portable) = to_portable_music_path(path, base_dir) {
                            lines.push(format!("../{}", portable));
                        } else {
                            lines.push(path.clone());
                        }
                    }
                }
            }
        }
    }

    let content = lines.join("\n");
    fs::write(pl_path, content.as_bytes())
        .map_err(|e| format!("Failed to write M3U8 playlist to {:?}: {}", pl_path, e))?;

    Ok(())
}

pub fn parse_m3u8_playlist(
    file_path: &Path,
    base_dir: &Path,
    library_tracks: &mut Vec<Value>,
    path_to_id: &mut std::collections::HashMap<String, String>,
) -> Option<Value> {
    let content = fs::read_to_string(file_path).ok()?;
    let stem = file_path
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "Playlist".to_string());

    let mut name = stem.clone();
    let mut id: Option<String> = None;
    let mut description: Option<String> = None;
    let mut order: Option<i64> = None;
    let mut folder_id: Option<String> = None;
    let mut group_id: Option<String> = None;
    let mut color: Option<String> = None;
    let mut cover_art: Option<String> = None;
    let mut cover_type: Option<String> = None;
    let mut is_system = false;
    let mut icon: Option<String> = None;
    let mut track_ids = Vec::new();

    let mut pending_track_id: Option<String> = None;
    let mut pending_extinf: Option<(i64, String, String)> = None;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        if let Some(val) = trimmed.strip_prefix("#PLAYLIST:") {
            let n = val.trim();
            if !n.is_empty() {
                name = n.to_string();
            }
            continue;
        }
        if let Some(val) = trimmed.strip_prefix("#EXT-ARACHNID-NAME:") {
            let n = val.trim();
            if !n.is_empty() {
                name = n.to_string();
            }
            continue;
        }
        if let Some(val) = trimmed.strip_prefix("#EXT-ARACHNID-DESC:") {
            let d = val.trim().replace("\\n", "\n");
            if !d.is_empty() && d != "null" {
                description = Some(d);
            }
            continue;
        }
        if let Some(val) = trimmed.strip_prefix("#EXT-ARACHNID-ID:") {
            let i = val.trim();
            if !i.is_empty() {
                id = Some(i.to_string());
            }
            continue;
        }
        if let Some(val) = trimmed.strip_prefix("#EXT-ARACHNID-ORDER:") {
            order = val.trim().parse::<i64>().ok();
            continue;
        }
        if let Some(val) = trimmed.strip_prefix("#EXT-ARACHNID-FOLDER:") {
            let f = val.trim();
            if !f.is_empty() && f != "null" {
                folder_id = Some(f.to_string());
            }
            continue;
        }
        if let Some(val) = trimmed.strip_prefix("#EXT-ARACHNID-GROUP:") {
            let g = val.trim();
            if !g.is_empty() && g != "null" {
                group_id = Some(g.to_string());
            }
            continue;
        }
        if let Some(val) = trimmed.strip_prefix("#EXT-ARACHNID-COLOR:") {
            let c = val.trim();
            if !c.is_empty() && c != "null" {
                color = Some(c.to_string());
            }
            continue;
        }
        if let Some(val) = trimmed.strip_prefix("#EXT-ARACHNID-COVER:") {
            let c = val.trim();
            if !c.is_empty() && c != "null" {
                cover_art = to_absolute_cover(c, base_dir);
            }
            continue;
        }
        if let Some(val) = trimmed.strip_prefix("#EXT-ARACHNID-COVERTYPE:") {
            let ct = val.trim();
            if !ct.is_empty() && ct != "null" {
                cover_type = Some(ct.to_string());
            }
            continue;
        }
        if let Some(val) = trimmed.strip_prefix("#EXT-ARACHNID-ISSYSTEM:") {
            is_system = val.trim().eq_ignore_ascii_case("true");
            continue;
        }
        if let Some(val) = trimmed.strip_prefix("#EXT-ARACHNID-ICON:") {
            let ic = val.trim();
            if !ic.is_empty() && ic != "null" {
                icon = Some(ic.to_string());
            }
            continue;
        }
        if let Some(val) = trimmed.strip_prefix("#EXT-ARACHNID-TRACKID:") {
            let tid = val.trim().to_string();
            if !tid.is_empty() {
                pending_track_id = Some(tid);
            }
            continue;
        }
        if let Some(val) = trimmed.strip_prefix("#EXTINF:") {
            let parts: Vec<&str> = val.splitn(2, ',').collect();
            let duration = parts[0].trim().parse::<f64>().unwrap_or(0.0) as i64;
            let artist_title = if parts.len() > 1 { parts[1].trim() } else { "" };
            let (artist, title) = if let Some(dash_idx) = artist_title.find(" - ") {
                (
                    artist_title[..dash_idx].trim().to_string(),
                    artist_title[dash_idx + 3..].trim().to_string(),
                )
            } else {
                ("Unknown Artist".to_string(), artist_title.to_string())
            };
            pending_extinf = Some((duration, artist, title));
            continue;
        }

        // Other comment lines
        if trimmed.starts_with('#') {
            continue;
        }

        // Audio file path line
        let norm_trimmed = trimmed.replace('\\', "/");
        let norm_lower = norm_trimmed.to_lowercase();

        // 1. If we have a pending Arachnid track ID, check if it exists in the library
        if let Some(ref tid) = pending_track_id {
            if library_tracks.iter().any(|t| t.get("id").and_then(|i| i.as_str()) == Some(tid.as_str())) {
                track_ids.push(pending_track_id.take().unwrap());
                pending_extinf = None;
                continue;
            }
        }

        let path_buf = if Path::new(trimmed).is_relative() {
            if norm_lower.starts_with("music/") {
                base_dir.join(&norm_trimmed)
            } else if norm_lower.starts_with("../music/") {
                base_dir.join(&norm_trimmed["../".len()..])
            } else if let Some(parent) = file_path.parent() {
                let from_parent = parent.join(trimmed);
                if from_parent.is_file() {
                    from_parent
                } else if norm_lower.contains("music/") {
                    if let Some(idx) = norm_lower.find("music/") {
                        base_dir.join(&norm_trimmed[idx..])
                    } else {
                        from_parent
                    }
                } else {
                    from_parent
                }
            } else {
                base_dir.join(trimmed)
            }
        } else {
            PathBuf::from(trimmed)
        };

        // Normalize path components (remove .. and .)
        let clean_path = normalize_path_components(&path_buf);
        let norm_path_str = clean_path.to_string_lossy().to_string();
        let lower_path = norm_path_str.replace('\\', "/").to_lowercase();

        if let Some(existing_id) = path_to_id.get(&lower_path) {
            track_ids.push(existing_id.clone());
        } else {
            let tid = pending_track_id.take().unwrap_or_else(|| {
                let mut hasher = DefaultHasher::new();
                norm_path_str.hash(&mut hasher);
                format!("track_{:016x}", hasher.finish())
            });

            let (dur, artist, title) = pending_extinf.take().unwrap_or_else(|| {
                let fname = clean_path
                    .file_stem()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_else(|| "Track".to_string());
                (0, "Unknown Artist".to_string(), fname)
            });

            let new_track = json!({
                "id": tid,
                "path": norm_path_str,
                "title": title,
                "artist": artist,
                "album": "Unknown Album",
                "duration": dur,
                "src": norm_path_str,
                "dateAdded": chrono::Utc::now().timestamp_millis(),
                "playCount": 0,
                "isFavorite": false
            });

            path_to_id.insert(lower_path, tid.clone());
            library_tracks.push(new_track);
            track_ids.push(tid);
        }

        pending_extinf = None;
    }

    let final_id = id.unwrap_or_else(|| {
        let mut hasher = DefaultHasher::new();
        stem.hash(&mut hasher);
        format!("pl_{:016x}", hasher.finish())
    });

    Some(json!({
        "id": final_id,
        "name": name,
        "description": description,
        "trackIds": track_ids,
        "folderId": folder_id,
        "groupId": group_id,
        "color": color,
        "coverArt": cover_art,
        "coverType": cover_type,
        "isSystem": is_system,
        "icon": icon,
        "order": order.unwrap_or(0),
    }))
}


fn legacy_track_references_from_value(
    value: &Value,
    requested_ids: &std::collections::HashSet<String>,
    base_dir: &Path,
) -> Vec<crate::library_db::LegacyTrackReference> {
    let Some(tracks) = value.get("tracks").and_then(Value::as_array) else { return Vec::new() };
    let mut references = Vec::with_capacity(tracks.len().min(requested_ids.len()));
    for track in tracks {
        let (Some(id), Some(raw_path)) = (
            track.get("id").and_then(Value::as_str),
            track.get("path").and_then(Value::as_str),
        ) else { continue };
        if id.is_empty() || raw_path.trim().is_empty() || !requested_ids.contains(id) { continue; }
        let resolved_path = to_absolute_music_path(raw_path, base_dir).unwrap_or_else(|| {
            let path = Path::new(raw_path);
            if path.is_absolute() { raw_path.to_string() } else { base_dir.join(path).to_string_lossy().to_string() }
        });
        references.push(crate::library_db::LegacyTrackReference {
            id: id.to_string(),
            path: resolved_path,
            is_favorite: track.get("isFavorite").and_then(Value::as_bool).unwrap_or(false),
            play_count: track.get("playCount").and_then(Value::as_u64).unwrap_or(0),
            date_added: track.get("dateAdded").and_then(Value::as_i64).unwrap_or(0),
        });
    }
    references
}

/// Read only references still present in playlists from the old full-library index.
/// Removed/library-only IDs must not seed a path mapping during the SQLite rebuild.
pub fn load_legacy_track_references(track_ids: &[String]) -> Result<Vec<crate::library_db::LegacyTrackReference>, String> {
    if track_ids.is_empty() { return Ok(Vec::new()); }
    let requested_ids = track_ids.iter().cloned().collect::<std::collections::HashSet<_>>();
    let base_dir = get_portable_base_dir();
    let candidates = [
        base_dir.join("config").join("library.json"),
        base_dir.join("arachnid_data.json.bak"),
        base_dir.join("arachnid_data.json"),
    ];
    let Some(path) = candidates.iter().find(|path| path.is_file()) else {
        return Ok(Vec::new());
    };
    let content = fs::read_to_string(path).map_err(|error| format!("Read legacy library index: {error}"))?;
    let value: Value = serde_json::from_str(&content).map_err(|error| format!("Parse legacy library index: {error}"))?;
    Ok(legacy_track_references_from_value(&value, &requested_ids, &base_dir))
}

#[cfg(test)]
mod legacy_reference_tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn startup_storage_init_does_not_recreate_legacy_cover_folder() {
        let root = std::env::temp_dir().join(format!(
            "arachnid-storage-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos(),
        ));
        let legacy_covers = root.join("config").join("covers");
        fs::create_dir_all(&legacy_covers).unwrap();
        fs::remove_dir(&legacy_covers).unwrap();

        init_storage_structure(&root);

        assert!(!legacy_covers.exists());
        let inline_cover = "data:image/png;base64,aGVsbG8=";
        assert_eq!(to_portable_cover(inline_cover, &root).as_deref(), Some(inline_cover));
        assert!(!legacy_covers.exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn legacy_index_only_restores_ids_still_referenced_by_playlists() {
        let base_dir = Path::new("portable-root");
        let value = json!({
            "tracks": [
                {"id":"playlist-track","path":"music/kept.mp3","isFavorite":true,"playCount":4,"dateAdded":55},
                {"id":"removed-track","path":"music/stale.mp3","isFavorite":false}
            ]
        });
        let requested = ["playlist-track".to_string()].into_iter().collect();

        let references = legacy_track_references_from_value(&value, &requested, base_dir);
        assert_eq!(references.len(), 1);
        assert_eq!(references[0].id, "playlist-track");
        assert_eq!(references[0].path, base_dir.join("music").join("kept.mp3").to_string_lossy().to_string());
        assert!(references[0].is_favorite);
        assert_eq!(references[0].play_count, 4);
        assert_eq!(references[0].date_added, 55);
    }
}
