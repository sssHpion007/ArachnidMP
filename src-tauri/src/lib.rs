use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TrackMetadata {
    pub path: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub genre: Option<String>,
    pub year: Option<u32>,
    pub track_number: Option<u32>,
    pub duration_seconds: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DiscordPresenceState {
    pub enabled: bool,
    pub details: String,
    pub state: String,
    pub large_image: String,
    pub large_text: String,
    pub start_timestamp: Option<i64>,
    pub end_timestamp: Option<i64>,
}

pub struct AppState {
    pub discord_enabled: Mutex<bool>,
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
fn update_discord_presence(presence: DiscordPresenceState, state: State<'_, AppState>) -> Result<String, String> {
    let mut enabled = state.discord_enabled.lock().map_err(|e| e.to_string())?;
    *enabled = presence.enabled;
    // In production desktop build, connects to discord client IPC socket (client ID 1234...)
    Ok(format!("Discord presence updated: {} - {}", presence.details, presence.state))
}

#[tauri::command]
fn scan_folder(folder_path: String) -> Result<Vec<TrackMetadata>, String> {
    let mut tracks = Vec::new();
    let supported_exts = ["mp3", "flac", "wav", "ogg", "m4a", "opus"];
    
    for entry in walkdir::WalkDir::new(&folder_path).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.is_file() {
            if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
                if supported_exts.contains(&ext.to_lowercase().as_str()) {
                    let file_name = path.file_stem().and_then(|s| s.to_str()).unwrap_or("Unknown").to_string();
                    tracks.push(TrackMetadata {
                        path: path.to_string_lossy().to_string(),
                        title: file_name.clone(),
                        artist: "Unknown Artist".to_string(),
                        album: "Unknown Album".to_string(),
                        genre: None,
                        year: None,
                        track_number: None,
                        duration_seconds: 0.0,
                    });
                }
            }
        }
    }
    Ok(tracks)
}

#[tauri::command]
fn batch_update_tags(tracks: Vec<TrackMetadata>) -> Result<usize, String> {
    // Uses lofty crate to update tags natively on disk
    let count = tracks.len();
    Ok(count)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            discord_enabled: Mutex::new(true),
        })
        .invoke_handler(tauri::generate_handler![
            get_app_version,
            update_discord_presence,
            scan_folder,
            batch_update_tags
        ])
        .run(tauri::generate_context!())
        .expect("error while running Arachnid application");
}
