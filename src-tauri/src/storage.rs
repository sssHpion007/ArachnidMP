use std::fs;
use std::path::{Path, PathBuf};
use serde_json::{json, Value};
use base64::prelude::*;
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

pub fn get_covers_dir() -> PathBuf {
    get_portable_base_dir().join("config").join("covers")
}

pub fn get_logs_dir() -> PathBuf {
    get_portable_base_dir().join("config").join("logs")
}

pub fn save_cover_bytes(bytes: &[u8], mime: &str) -> Option<String> {
    if bytes.is_empty() {
        return None;
    }
    let mut hasher = DefaultHasher::new();
    bytes.hash(&mut hasher);
    let hash = format!("{:016x}", hasher.finish());

    let ext = match mime.to_lowercase().as_str() {
        "image/png" | "png" => "png",
        "image/webp" | "webp" => "webp",
        _ => "jpg",
    };

    let covers_dir = get_covers_dir();
    let _ = fs::create_dir_all(&covers_dir);
    let filename = format!("{}.{}", hash, ext);
    let file_path = covers_dir.join(&filename);

    if !file_path.exists() {
        let _ = fs::write(&file_path, bytes);
    }

    Some(file_path.to_string_lossy().to_string())
}

pub fn save_base64_cover(data_uri: &str) -> Option<String> {
    if !data_uri.starts_with("data:image/") {
        return None;
    }
    let parts: Vec<&str> = data_uri.splitn(2, ";base64,").collect();
    if parts.len() != 2 {
        return None;
    }
    let mime = parts[0].trim_start_matches("data:");
    let b64_clean: String = parts[1].chars().filter(|c| !c.is_whitespace()).collect();
    if let Ok(bytes) = BASE64_STANDARD.decode(&b64_clean) {
        save_cover_bytes(&bytes, mime)
    } else {
        None
    }
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

/// Convert any cover string (asset URL, old absolute path, base64, relative)
/// to a portable relative path "config/covers/<filename>" suitable for saving in library.json / playlists.
pub fn to_portable_cover(cover_val: &str, base_dir: &Path) -> Option<String> {
    let trimmed = cover_val.trim();
    if trimmed.is_empty() {
        return None;
    }

    // 1. If base64 data URI, save to config/covers and return relative path
    if trimmed.starts_with("data:image/") {
        if let Some(disk_path) = save_base64_cover(trimmed) {
            let p = Path::new(&disk_path);
            if let Some(fname) = p.file_name().and_then(|f| f.to_str()) {
                return Some(format!("config/covers/{}", fname));
            }
        }
        return None;
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
    if norm.starts_with("config/covers/") {
        return Some(norm);
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
    if p.is_absolute() && p.exists() {
        return Some(trimmed.to_string());
    }

    None
}

/// Initialize the modular directory structure on startup
pub fn init_storage_structure(base_dir: &Path) {
    let config_dir = base_dir.join("config");
    let covers_dir = config_dir.join("covers");
    let playlists_dir = base_dir.join("playlists");
    let themes_dir = base_dir.join("themes");
    let locales_dir = base_dir.join("locales");
    let logs_dir = config_dir.join("logs");

    let _ = fs::create_dir_all(&config_dir);
    let _ = fs::create_dir_all(&covers_dir);
    let _ = fs::create_dir_all(&logs_dir);
    let _ = fs::create_dir_all(&playlists_dir);
    let _ = fs::create_dir_all(&themes_dir);
    let _ = fs::create_dir_all(&locales_dir);

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

/// Save data into modular files across config/ and playlists/
pub fn save_modular_data(data: &Value) -> Result<bool, String> {
    let base_dir = get_portable_base_dir();
    init_storage_structure(&base_dir);

    let config_dir = base_dir.join("config");
    let playlists_dir = base_dir.join("playlists");

    // 1. Save Settings
    let mut settings = json!({});
    if let Some(obj) = data.as_object() {
        for (k, v) in obj {
            if k != "tracks" && k != "playlists" && k != "playlistFolders" && k != "playlistGroups" {
                settings[k] = v.clone();
            }
        }
    }
    let settings_path = config_dir.join("settings.json");
    let settings_str = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    fs::write(&settings_path, settings_str)
        .map_err(|e| format!("Failed to write settings to {:?}: {}", settings_path, e))?;

    // 2. Save Tracks / Library Cache
    if let Some(tracks) = data.get("tracks") {
        let base_dir = get_portable_base_dir();
        let mut clean_tracks = tracks.clone();
        if let Some(arr) = clean_tracks.as_array_mut() {
            for track in arr {
                if let Some(cover_val) = track.get("coverArt").and_then(|c| c.as_str()) {
                    if let Some(portable) = to_portable_cover(cover_val, &base_dir) {
                        track["coverArt"] = json!(portable);
                    } else {
                        track["coverArt"] = json!(null);
                    }
                }
            }
        }
        let library_path = config_dir.join("library.json");
        let library_json = json!({ "tracks": clean_tracks });
        let library_str = serde_json::to_string_pretty(&library_json)
            .map_err(|e| format!("Failed to serialize library: {}", e))?;
        fs::write(&library_path, library_str)
            .map_err(|e| format!("Failed to write library to {:?}: {}", library_path, e))?;
    }

    // 3. Save Playlists Hierarchy Tree (folders & groups)
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

    // 4. Save Individual Playlists
    if let Some(playlists_array) = data.get("playlists").and_then(|p| p.as_array()) {
        let mut current_ids = std::collections::HashSet::new();

        for pl in playlists_array {
            if let Some(id) = pl.get("id").and_then(|i| i.as_str()) {
                let safe_id = sanitize_filename(id);
                current_ids.insert(format!("{}.json", safe_id));
                let pl_path = playlists_dir.join(format!("{}.json", safe_id));
                let mut pl_clean = pl.clone();
                if let Some(cover_val) = pl_clean.get("coverArt").and_then(|c| c.as_str()) {
                    if let Some(portable) = to_portable_cover(cover_val, &base_dir) {
                        pl_clean["coverArt"] = json!(portable);
                    } else {
                        pl_clean["coverArt"] = json!(null);
                    }
                }
                let pl_str = serde_json::to_string_pretty(&pl_clean)
                    .map_err(|e| format!("Failed to serialize playlist {}: {}", id, e))?;
                let _ = fs::write(&pl_path, pl_str);
            }
        }

        // Clean up deleted playlist files in playlists/
        if let Ok(entries) = fs::read_dir(&playlists_dir) {
            for entry in entries.flatten() {
                let file_name = entry.file_name().to_string_lossy().to_string();
                if file_name.ends_with(".json") && file_name != "tree.json" {
                    if !current_ids.contains(&file_name) {
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

    // 2. Read Library / Tracks
    if library_path.is_file() {
        if let Ok(content) = fs::read_to_string(&library_path) {
            if let Ok(val) = serde_json::from_str::<Value>(&content) {
                if let Some(tracks) = val.get("tracks") {
                    let mut tracks_val = tracks.clone();
                    if let Some(arr) = tracks_val.as_array_mut() {
                        for track in arr {
                            if let Some(cover_val) = track.get("coverArt").and_then(|c| c.as_str()) {
                                if let Some(abs_path) = to_absolute_cover(cover_val, &base_dir) {
                                    track["coverArt"] = json!(abs_path);
                                } else {
                                    track["coverArt"] = json!(null);
                                }
                            }
                        }
                    }
                    combined["tracks"] = tracks_val;
                }
            }
        }
    }
    if combined.get("tracks").is_none() {
        combined["tracks"] = json!([]);
    }

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

    // 4. Read Individual Playlists from playlists/
    let mut playlists_list = Vec::new();
    if let Ok(entries) = fs::read_dir(&playlists_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let file_name = entry.file_name().to_string_lossy().to_string();
            if file_name.ends_with(".json") && file_name != "tree.json" {
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(mut pl) = serde_json::from_str::<Value>(&content) {
                        if let Some(cover_val) = pl.get("coverArt").and_then(|c| c.as_str()) {
                            if let Some(abs_path) = to_absolute_cover(cover_val, &base_dir) {
                                pl["coverArt"] = json!(abs_path);
                            } else {
                                pl["coverArt"] = json!(null);
                            }
                        }
                        playlists_list.push(pl);
                    }
                }
            }
        }
    }
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

/// Helper to sanitize playlist id for filesystem path
fn sanitize_filename(id: &str) -> String {
    id.chars()
        .map(|c| if c.is_alphanumeric() || c == '_' || c == '-' { c } else { '_' })
        .collect()
}
