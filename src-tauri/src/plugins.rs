use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::Read;
use std::path::{Component, Path, PathBuf};

const PLUGIN_API_VERSION: u32 = 1;
const MAX_MANIFEST_BYTES: u64 = 64 * 1024;
const MAX_PLUGIN_SOURCE_BYTES: u64 = 512 * 1024;
const MAX_PREFERENCES_BYTES: usize = 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    #[serde(default)]
    pub description: String,
    pub api_version: u32,
    pub entry: String,
    #[serde(skip_deserializing, default)]
    pub fingerprint: String,
    #[serde(default)]
    pub permissions: Vec<String>,
    #[serde(default)]
    pub settings: Vec<PluginSettingDefinition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginSettingDefinition {
    pub key: String,
    pub label: String,
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(default)]
    pub default: Value,
    #[serde(default)]
    pub options: Vec<PluginSettingOption>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginSettingOption {
    pub label: String,
    pub value: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PluginPreferencesFile {
    #[serde(default)]
    pub plugins: HashMap<String, PluginPreference>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PluginPreference {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub trusted_fingerprint: Option<String>,
    #[serde(default)]
    pub settings: Value,
}

fn plugins_dir() -> PathBuf {
    crate::storage::get_portable_base_dir().join("plugins")
}

fn preferences_path() -> PathBuf {
    crate::storage::get_portable_base_dir()
        .join("config")
        .join("plugins.json")
}

fn is_safe_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 64
        && value.chars().all(|character| {
            character.is_ascii_alphanumeric() || character == '-' || character == '_'
        })
        && value.chars().next().is_some_and(|character| character.is_ascii_alphanumeric())
}

fn is_safe_entry(value: &str) -> bool {
    let path = Path::new(value);
    path.components().count() == 1
        && matches!(path.components().next(), Some(Component::Normal(_)))
        && value.ends_with(".js")
        && value.len() <= 128
        && value.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '.' | '-' | '_')
        })
        && value != ".js"
}

fn validate_manifest(manifest: &PluginManifest, directory_id: &str) -> Result<(), String> {
    if !is_safe_id(&manifest.id) || manifest.id != directory_id {
        return Err("Plugin id must be safe and match its folder name".to_string());
    }
    if manifest.name.trim().is_empty() || manifest.name.chars().count() > 80 {
        return Err("Plugin name must contain 1–80 characters".to_string());
    }
    if manifest.version.trim().is_empty() || manifest.version.len() > 64 {
        return Err("Plugin version is missing or too long".to_string());
    }
    if manifest.description.chars().count() > 500 {
        return Err("Plugin description is too long".to_string());
    }
    if manifest.api_version != PLUGIN_API_VERSION {
        return Err(format!("Unsupported plugin API version {}", manifest.api_version));
    }
    if !is_safe_entry(&manifest.entry) {
        return Err("Plugin entry must be a .js file in the plugin folder".to_string());
    }
    if manifest.permissions.len() > 16
        || manifest.permissions.iter().any(|permission| permission != "playback.read")
    {
        return Err("Plugin requests an unsupported permission".to_string());
    }
    if manifest.settings.len() > 32 {
        return Err("Plugin declares too many settings".to_string());
    }
    let mut setting_keys = std::collections::HashSet::new();
    for setting in &manifest.settings {
        if setting.key.is_empty()
            || setting.key.len() > 64
            || !setting
                .key
                .chars()
                .all(|character| character.is_ascii_alphanumeric() || matches!(character, '_' | '-'))
            || setting.label.trim().is_empty()
            || setting.label.chars().count() > 100
            || !matches!(setting.kind.as_str(), "text" | "number" | "boolean" | "select")
            || !setting_keys.insert(setting.key.as_str())
            || setting.options.len() > 32
        {
            return Err("Plugin setting definition is invalid".to_string());
        }
        if setting.kind == "select" && setting.options.is_empty() {
            return Err(format!("Select setting '{}' must define options", setting.key));
        }
    }
    Ok(())
}

fn plugin_fingerprint(manifest_bytes: &[u8], source: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(b"ArachnidMP external plugin trust v2\0");
    hasher.update((manifest_bytes.len() as u64).to_le_bytes());
    hasher.update(manifest_bytes);
    hasher.update((source.len() as u64).to_le_bytes());
    hasher.update(source.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn read_bounded_file(path: &Path, max_bytes: u64, label: &str) -> Result<Vec<u8>, String> {
    let file = File::open(path).map_err(|error| format!("Read {label}: {error}"))?;
    let metadata = file.metadata().map_err(|error| format!("Inspect {label}: {error}"))?;
    if !metadata.is_file() || metadata.len() > max_bytes {
        return Err(format!("{label} is missing, not a file, or too large"));
    }
    let mut bytes = Vec::with_capacity(metadata.len() as usize);
    let mut bounded_file = file.take(max_bytes + 1);
    bounded_file
        .read_to_end(&mut bytes)
        .map_err(|error| format!("Read {label}: {error}"))?;
    if bytes.len() as u64 > max_bytes {
        return Err(format!("{label} is too large"));
    }
    Ok(bytes)
}

fn read_manifest_and_source_in(directory: &Path) -> Result<(PluginManifest, String), String> {
    let directory_id = directory
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "Invalid plugin folder name".to_string())?;
    if !is_safe_id(directory_id) {
        return Err("Invalid plugin folder name".to_string());
    }
    let manifest_path = directory.join("manifest.json");
    let metadata = fs::symlink_metadata(&manifest_path).map_err(|error| error.to_string())?;
    if !metadata.file_type().is_file() || metadata.len() > MAX_MANIFEST_BYTES {
        return Err("Plugin manifest is missing or too large".to_string());
    }
    let bytes = read_bounded_file(&manifest_path, MAX_MANIFEST_BYTES, "plugin manifest")?;
    let mut manifest: PluginManifest = serde_json::from_slice(&bytes)
        .map_err(|error| format!("Invalid plugin manifest: {error}"))?;
    validate_manifest(&manifest, directory_id)?;
    let canonical_directory = directory.canonicalize().map_err(|error| error.to_string())?;
    let canonical_entry = directory
        .join(&manifest.entry)
        .canonicalize()
        .map_err(|error| format!("Plugin entry is missing: {error}"))?;
    if !canonical_entry.starts_with(&canonical_directory) {
        return Err("Plugin entry escapes its folder".to_string());
    }
    let source_bytes = read_bounded_file(&canonical_entry, MAX_PLUGIN_SOURCE_BYTES, "plugin entry")?;
    let source = String::from_utf8(source_bytes)
        .map_err(|error| format!("Plugin entry is not valid UTF-8: {error}"))?;
    manifest.fingerprint = plugin_fingerprint(&bytes, &source);
    Ok((manifest, source))
}

fn read_manifest_in(directory: &Path) -> Result<PluginManifest, String> {
    read_manifest_and_source_in(directory).map(|(manifest, _)| manifest)
}

pub fn list_plugins() -> Result<Vec<PluginManifest>, String> {
    let root = plugins_dir();
    fs::create_dir_all(&root).map_err(|error| format!("Create plugins folder: {error}"))?;
    let entries = fs::read_dir(&root).map_err(|error| format!("Read plugins folder: {error}"))?;
    let mut plugins = Vec::new();
    for entry in entries.flatten() {
        let Ok(file_type) = entry.file_type() else { continue };
        if !file_type.is_dir() {
            continue;
        }
        match read_manifest_in(&entry.path()) {
            Ok(manifest) => plugins.push(manifest),
            Err(error) => crate::logger::log(
                "WARN",
                "PLUGIN_DISCOVERY",
                &format!("Ignoring {}: {}", entry.file_name().to_string_lossy(), error),
            ),
        }
    }
    plugins.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
    Ok(plugins)
}

pub fn read_plugin_source(plugin_id: String, expected_fingerprint: String) -> Result<String, String> {
    if !is_safe_id(&plugin_id) {
        return Err("Invalid plugin id".to_string());
    }
    let root = plugins_dir();
    let canonical_root = root.canonicalize().map_err(|error| error.to_string())?;
    let directory = root.join(&plugin_id);
    let canonical_directory = directory.canonicalize().map_err(|error| error.to_string())?;
    if !canonical_directory.starts_with(&canonical_root) {
        return Err("Plugin folder escapes the plugins directory".to_string());
    }
    let (manifest, source) = read_manifest_and_source_in(&directory)?;
    if manifest.fingerprint != expected_fingerprint {
        return Err("Plugin files changed after scanning; refresh the plugin list and trust it again".to_string());
    }
    // Return the exact bytes covered by the trusted fingerprint; do not reopen the file
    // after verification, which would introduce a check/use race for edited plugin files.
    Ok(source)
}

pub fn load_preferences() -> Result<PluginPreferencesFile, String> {
    let path = preferences_path();
    let contents = match fs::read(&path) {
        Ok(contents) => contents,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(PluginPreferencesFile::default());
        }
        Err(error) => return Err(format!("Read plugin preferences: {error}")),
    };
    if contents.len() > MAX_PREFERENCES_BYTES {
        return Err("Plugin preferences file is too large".to_string());
    }
    serde_json::from_slice(&contents).map_err(|error| format!("Invalid plugin preferences: {error}"))
}

pub fn save_preferences(preferences: PluginPreferencesFile) -> Result<(), String> {
    if preferences.plugins.len() > 256 {
        return Err("Too many plugin preference entries".to_string());
    }
    for (id, preference) in &preferences.plugins {
        if !is_safe_id(id) {
            return Err("Invalid plugin id in preferences".to_string());
        }
        if let Some(fingerprint) = &preference.trusted_fingerprint {
            if fingerprint.len() > 64 {
                return Err("Trusted plugin fingerprint is too long".to_string());
            }
        }
    }
    let serialized = serde_json::to_vec_pretty(&preferences).map_err(|error| error.to_string())?;
    if serialized.len() > MAX_PREFERENCES_BYTES {
        return Err("Plugin preferences file is too large".to_string());
    }
    let path = preferences_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::write(path, serialized).map_err(|error| format!("Save plugin preferences: {error}"))
}

pub fn open_plugins_folder() -> Result<(), String> {
    let path = plugins_dir();
    fs::create_dir_all(&path).map_err(|error| format!("Create plugins folder: {error}"))?;
    #[cfg(target_os = "windows")]
    let result = std::process::Command::new("explorer").arg(&path).spawn();
    #[cfg(target_os = "macos")]
    let result = std::process::Command::new("open").arg(&path).spawn();
    #[cfg(all(unix, not(target_os = "macos")))]
    let result = std::process::Command::new("xdg-open").arg(&path).spawn();
    result.map(|_| ()).map_err(|error| format!("Open plugins folder: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_manifest() -> PluginManifest {
        PluginManifest {
            id: "sample-plugin".to_string(),
            name: "Sample plugin".to_string(),
            version: "1.0.0".to_string(),
            description: String::new(),
            api_version: PLUGIN_API_VERSION,
            entry: "plugin.js".to_string(),
            fingerprint: String::new(),
            permissions: vec!["playback.read".to_string()],
            settings: Vec::new(),
        }
    }

    #[test]
    fn accepts_a_valid_plugin_manifest() {
        assert!(validate_manifest(&valid_manifest(), "sample-plugin").is_ok());
    }

    #[test]
    fn rejects_path_traversal_and_mismatched_ids() {
        let mut manifest = valid_manifest();
        manifest.entry = "../outside.js".to_string();
        assert!(validate_manifest(&manifest, "sample-plugin").is_err());
        manifest.entry = "plugin.js".to_string();
        assert!(validate_manifest(&manifest, "another-plugin").is_err());
    }

    #[test]
    fn rejects_unsupported_permissions_and_api_versions() {
        let mut manifest = valid_manifest();
        manifest.permissions.push("filesystem.read".to_string());
        assert!(validate_manifest(&manifest, "sample-plugin").is_err());
        manifest.permissions.clear();
        manifest.api_version = PLUGIN_API_VERSION + 1;
        assert!(validate_manifest(&manifest, "sample-plugin").is_err());
    }

    #[test]
    fn fingerprint_covers_the_exact_source_returned_for_execution() {
        let directory = std::env::temp_dir().join(format!(
            "arachnid-plugin-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos(),
        ));
        fs::create_dir_all(&directory).unwrap();
        let mut test_manifest = valid_manifest();
        test_manifest.id = directory.file_name().unwrap().to_string_lossy().into_owned();
        fs::write(directory.join("manifest.json"), serde_json::to_vec(&test_manifest).unwrap()).unwrap();
        fs::write(directory.join("plugin.js"), "registerPlugin({ onEnable() {} });").unwrap();

        let (manifest, source) = read_manifest_and_source_in(&directory).unwrap();
        let manifest_bytes = fs::read(directory.join("manifest.json")).unwrap();
        assert_eq!(manifest.fingerprint, plugin_fingerprint(&manifest_bytes, &source));
        assert_eq!(source, "registerPlugin({ onEnable() {} });");

        fs::write(directory.join("plugin.js"), "registerPlugin({ onEnable() { evil(); } });").unwrap();
        let (modified_manifest, modified_source) = read_manifest_and_source_in(&directory).unwrap();
        assert_ne!(manifest.fingerprint, modified_manifest.fingerprint);
        assert_ne!(source, modified_source);
        fs::remove_dir_all(directory).unwrap();
    }
}
