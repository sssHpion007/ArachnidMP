use std::fs;
use std::path::{Path, PathBuf};
use serde_json::{json, Value};

pub fn get_portable_base_dir() -> PathBuf {
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            return parent.to_path_buf();
        }
    }
    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

/// Initialize the modular directory structure on startup
pub fn init_storage_structure(base_dir: &Path) {
    let config_dir = base_dir.join("config");
    let playlists_dir = base_dir.join("playlists");
    let themes_dir = base_dir.join("themes");
    let locales_dir = base_dir.join("locales");

    let _ = fs::create_dir_all(&config_dir);
    let _ = fs::create_dir_all(&playlists_dir);
    let _ = fs::create_dir_all(&themes_dir);
    let _ = fs::create_dir_all(&locales_dir);

    // Create a README in themes/ to guide users on custom CSS themes
    let themes_readme = themes_dir.join("README.txt");
    if !themes_readme.exists() {
        let readme_content = "\
Arachnid Custom CSS Themes
==========================
Place your custom .css files in this folder to apply custom styles to Arachnid Music Player.
You can override Material Design 3 variables:
  --md-sys-color-primary: #a8c7fa;
  --md-sys-color-primary-rgb: 168 199 250;
  --md-sys-color-background: #111318;
  --md-sys-color-background-rgb: 17 19 24;
  --md-sys-color-surface: #1e1f25;
  --md-sys-color-surface-rgb: 30 31 37;
  --md-sys-color-surface-container: #282a30;
  --md-sys-color-surface-container-rgb: 40 42 48;
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
        let library_path = config_dir.join("library.json");
        let library_json = json!({ "tracks": tracks });
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
                let pl_str = serde_json::to_string_pretty(pl)
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
                    combined["tracks"] = tracks.clone();
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
                    if let Ok(pl) = serde_json::from_str::<Value>(&content) {
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
