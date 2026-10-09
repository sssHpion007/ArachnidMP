mod discord;

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::State;
use base64::prelude::*;
use lofty::file::{AudioFile, TaggedFileExt};
use lofty::probe::Probe;
use lofty::tag::Accessor;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TrackMetadata {
    pub id: String,
    pub path: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub genre: Option<String>,
    pub year: Option<u32>,
    pub track_number: Option<u32>,
    pub duration_seconds: f64,
    pub cover_art: Option<String>,
    pub format: String,
    pub file_size: u64,
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
    pub discord: Mutex<discord::DiscordIpc>,
}

fn get_portable_base_dir() -> PathBuf {
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            return parent.to_path_buf();
        }
    }
    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

#[tauri::command]
fn save_portable_data(data: String) -> Result<bool, String> {
    let base_dir = get_portable_base_dir();
    let file_path = base_dir.join("arachnid_data.json");
    std::fs::write(&file_path, data).map_err(|e| format!("Failed to save portable data to {:?}: {}", file_path, e))?;
    Ok(true)
}

#[tauri::command]
fn load_portable_data() -> Result<Option<String>, String> {
    let base_dir = get_portable_base_dir();
    let file_path = base_dir.join("arachnid_data.json");
    if file_path.exists() {
        let content = std::fs::read_to_string(&file_path)
            .map_err(|e| format!("Failed to read portable data from {:?}: {}", file_path, e))?;
        Ok(Some(content))
    } else {
        Ok(None)
    }
}

fn parse_single_file(path_str: &str) -> Option<TrackMetadata> {
    let path = Path::new(path_str);
    if !path.is_file() {
        return None;
    }

    let ext = path.extension()?.to_str()?.to_lowercase();
    let supported = ["mp3", "flac", "wav", "ogg", "m4a", "aac", "opus", "wma"];
    if !supported.contains(&ext.as_str()) {
        return None;
    }

    let file_stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("Unknown").to_string();
    let file_size = std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);

    let mut title = file_stem;
    let mut artist = "Unknown Artist".to_string();
    let mut album = "Unknown Album".to_string();
    let mut genre = None;
    let mut year = None;
    let mut track_number = None;
    let mut duration_seconds = 0.0;
    let mut cover_art = None;

    if let Ok(tagged_file) = Probe::open(path).and_then(|p| p.read()) {
        let properties = tagged_file.properties();
        duration_seconds = properties.duration().as_secs_f64();

        if let Some(tag) = tagged_file.primary_tag().or_else(|| tagged_file.first_tag()) {
            if let Some(t) = tag.title() {
                title = t.to_string();
            }
            if let Some(a) = tag.artist() {
                artist = a.to_string();
            }
            if let Some(al) = tag.album() {
                album = al.to_string();
            }
            if let Some(g) = tag.genre() {
                genre = Some(g.to_string());
            }
            if let Some(y) = tag.year() {
                year = Some(y);
            }
            if let Some(tn) = tag.track() {
                track_number = Some(tn);
            }

            if let Some(pic) = tag.pictures().first() {
                let mime = match pic.mime_type() {
                    Some(m) => m.as_str(),
                    None => "image/jpeg",
                };
                let b64 = BASE64_STANDARD.encode(pic.data());
                cover_art = Some(format!("data:{};base64,{}", mime, b64));
            }
        }
    }

    let id = format!("track_{}_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis(), rand_suffix());

    Some(TrackMetadata {
        id,
        path: path.to_string_lossy().to_string(),
        title,
        artist,
        album,
        genre,
        year,
        track_number,
        duration_seconds,
        cover_art,
        format: ext.to_uppercase(),
        file_size,
    })
}

fn rand_suffix() -> u32 {
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_nanos();
    (now % 1000000) as u32
}

#[tauri::command]
fn read_audio_files(paths: Vec<String>) -> Result<Vec<TrackMetadata>, String> {
    let mut results = Vec::new();

    for p_str in paths {
        let p = Path::new(&p_str);
        if p.is_dir() {
            for entry in walkdir::WalkDir::new(p).into_iter().filter_map(|e| e.ok()) {
                if entry.path().is_file() {
                    if let Some(meta) = parse_single_file(&entry.path().to_string_lossy()) {
                        results.push(meta);
                    }
                }
            }
        } else if p.is_file() {
            if let Some(meta) = parse_single_file(&p_str) {
                results.push(meta);
            }
        }
    }

    Ok(results)
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
fn update_discord_presence(presence: DiscordPresenceState, state: State<'_, AppState>) -> Result<String, String> {
    let mut client = state.discord.lock().map_err(|e| e.to_string())?;
    if presence.enabled {
        let _ = client.set_activity(
            &presence.details,
            &presence.state,
            &presence.large_text,
            presence.start_timestamp,
        );
        Ok(format!("Discord presence set: {} - {}", presence.details, presence.state))
    } else {
        let _ = client.clear_activity();
        Ok("Discord presence cleared".to_string())
    }
}

#[tauri::command]
fn scan_folder(folder_path: String) -> Result<Vec<TrackMetadata>, String> {
    read_audio_files(vec![folder_path])
}

#[tauri::command]
fn batch_update_tags(tracks: Vec<TrackMetadata>) -> Result<usize, String> {
    let count = tracks.len();
    Ok(count)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            discord: Mutex::new(discord::DiscordIpc::new()),
        })
        .invoke_handler(tauri::generate_handler![
            get_app_version,
            update_discord_presence,
            read_audio_files,
            scan_folder,
            batch_update_tags,
            save_portable_data,
            load_portable_data
        ])
        .run(tauri::generate_context!())
        .expect("error while running Arachnid application");
}
