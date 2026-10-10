mod discord;

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::State;
use base64::prelude::*;
use lofty::config::WriteOptions;
use lofty::file::{AudioFile, TaggedFileExt};
use lofty::probe::Probe;
use lofty::tag::{Accessor, ItemKey, Tag, TagExt};

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
    pub lyrics: Option<String>,
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
    pub discord: discord::DiscordService,
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

    let mut title = file_stem.clone();
    let mut artist = "Unknown Artist".to_string();
    let mut album = "Unknown Album".to_string();
    let mut genre = None;
    let mut year = None;
    let mut track_number = None;
    let mut duration_seconds = 0.0;
    let mut cover_art = None;
    let mut lyrics = None;

    if let Ok(tagged_file) = Probe::open(path).and_then(|p| p.read()) {
        let properties = tagged_file.properties();
        duration_seconds = properties.duration().as_secs_f64();

        let mut all_tags: Vec<&Tag> = Vec::new();
        if let Some(pt) = tagged_file.primary_tag() {
            all_tags.push(pt);
        }
        for t in tagged_file.tags() {
            if !all_tags.iter().any(|existing| std::ptr::eq(*existing, t)) {
                all_tags.push(t);
            }
        }

        for tag in all_tags {
            if title == file_stem {
                if let Some(t) = tag.title() {
                    title = t.to_string();
                }
            }
            if artist == "Unknown Artist" {
                if let Some(a) = tag.artist() {
                    artist = a.to_string();
                }
            }
            if album == "Unknown Album" {
                if let Some(al) = tag.album() {
                    album = al.to_string();
                }
            }
            if genre.is_none() {
                if let Some(g) = tag.genre() {
                    genre = Some(g.to_string());
                }
            }
            if year.is_none() {
                if let Some(y) = tag.year() {
                    year = Some(y);
                }
            }
            if track_number.is_none() {
                if let Some(tn) = tag.track() {
                    track_number = Some(tn);
                }
            }
            if lyrics.is_none() {
                if let Some(l) = tag.get_string(&ItemKey::Lyrics) {
                    lyrics = Some(l.to_string());
                }
            }
            if cover_art.is_none() {
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
        lyrics,
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
    state.discord.update(discord::ActivityData {
        enabled: presence.enabled,
        details: presence.details,
        state: presence.state,
        large_text: presence.large_text,
        start_timestamp: presence.start_timestamp,
    });
    Ok("Discord presence update queued".to_string())
}

#[tauri::command]
fn open_file_dialog() -> Result<Vec<TrackMetadata>, String> {
    let files = rfd::FileDialog::new()
        .add_filter("Audio Files (*.mp3;*.flac;*.wav;*.ogg;*.m4a;*.opus;*.aac;*.wma)", &["mp3", "flac", "wav", "ogg", "m4a", "opus", "aac", "wma"])
        .pick_files();

    if let Some(paths) = files {
        let string_paths: Vec<String> = paths
            .into_iter()
            .map(|p| p.to_string_lossy().to_string())
            .collect();
        read_audio_files(string_paths)
    } else {
        Ok(vec![])
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

#[tauri::command]
fn show_in_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        Command::new("explorer")
            .args(["/select,", &path])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = path;
        Ok(())
    }
}

#[tauri::command]
fn save_track_lyrics(path: String, lyrics: String) -> Result<bool, String> {
    let file_path = Path::new(&path);
    if !file_path.is_file() {
        return Err("File not found".to_string());
    }

    let mut tagged_file = lofty::read_from_path(file_path).map_err(|e| e.to_string())?;

    let tag = match tagged_file.primary_tag_mut() {
        Some(t) => t,
        None => {
            tagged_file.insert_tag(Tag::new(tagged_file.primary_tag_type()));
            match tagged_file.primary_tag_mut() {
                Some(t) => t,
                None => match tagged_file.first_tag_mut() {
                    Some(t) => t,
                    None => return Err("Failed to access or create audio tags".to_string()),
                },
            }
        }
    };

    if lyrics.trim().is_empty() {
        tag.remove_key(&ItemKey::Lyrics);
    } else {
        tag.insert_text(ItemKey::Lyrics, lyrics);
    }

    tag.save_to_path(file_path, WriteOptions::default()).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
fn read_audio_binary(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| format!("Failed to read audio file: {}", e))
}

#[tauri::command]
fn get_system_accent_color() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        // Try reading DWM AccentColor from registry (0xAABBGGRR)
        let output = Command::new("reg")
            .args(&["query", "HKCU\\Software\\Microsoft\\Windows\\DWM", "/v", "AccentColor"])
            .creation_flags(CREATE_NO_WINDOW)
            .output();

        if let Ok(out) = output {
            let text = String::from_utf8_lossy(&out.stdout);
            for line in text.lines() {
                if line.contains("AccentColor") && line.contains("REG_DWORD") {
                    if let Some(val_str) = line.split_whitespace().last() {
                        let clean_hex = val_str.trim_start_matches("0x").trim_start_matches("0X");
                        if let Ok(dword) = u32::from_str_radix(clean_hex, 16) {
                            let r = (dword & 0xFF) as u8;
                            let g = ((dword >> 8) & 0xFF) as u8;
                            let b = ((dword >> 16) & 0xFF) as u8;
                            return Ok(format!("#{:02x}{:02x}{:02x}", r, g, b));
                        }
                    }
                }
            }
        }

        // Fallback to ColorizationColor (0xAARRGGBB)
        let output2 = Command::new("reg")
            .args(&["query", "HKCU\\Software\\Microsoft\\Windows\\DWM", "/v", "ColorizationColor"])
            .creation_flags(CREATE_NO_WINDOW)
            .output();

        if let Ok(out) = output2 {
            let text = String::from_utf8_lossy(&out.stdout);
            for line in text.lines() {
                if line.contains("ColorizationColor") && line.contains("REG_DWORD") {
                    if let Some(val_str) = line.split_whitespace().last() {
                        let clean_hex = val_str.trim_start_matches("0x").trim_start_matches("0X");
                        if let Ok(dword) = u32::from_str_radix(clean_hex, 16) {
                            let r = ((dword >> 16) & 0xFF) as u8;
                            let g = ((dword >> 8) & 0xFF) as u8;
                            let b = (dword & 0xFF) as u8;
                            return Ok(format!("#{:02x}{:02x}{:02x}", r, g, b));
                        }
                    }
                }
            }
        }
    }

    Ok("#0078d4".to_string())
}

#[cfg(target_os = "windows")]
mod windows_process_grouping {
    #[repr(C)]
    struct IO_COUNTERS {
        read_operation_count: u64,
        write_operation_count: u64,
        other_operation_count: u64,
        read_transfer_count: u64,
        write_transfer_count: u64,
        other_transfer_count: u64,
    }

    #[repr(C)]
    struct JOBOBJECT_BASIC_LIMIT_INFORMATION {
        per_process_user_time_limit: i64,
        per_job_user_time_limit: i64,
        limit_flags: u32,
        minimum_working_set_size: usize,
        maximum_working_set_size: usize,
        active_process_limit: u32,
        affinity: usize,
        priority_class: u32,
        scheduling_class: u32,
    }

    #[repr(C)]
    struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION {
        basic_limit_information: JOBOBJECT_BASIC_LIMIT_INFORMATION,
        io_info: IO_COUNTERS,
        process_memory_limit: usize,
        job_memory_limit: usize,
        peak_process_memory_used: usize,
        peak_job_memory_used: usize,
    }

    const JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE: u32 = 0x00002000;
    const JobObjectExtendedLimitInformation: i32 = 9;

    extern "system" {
        fn SetCurrentProcessExplicitAppUserModelID(AppID: *const u16) -> i32;
        fn CreateJobObjectW(lpJobAttributes: *mut std::ffi::c_void, lpName: *const u16) -> *mut std::ffi::c_void;
        fn AssignProcessToJobObject(hJob: *mut std::ffi::c_void, hProcess: *mut std::ffi::c_void) -> i32;
        fn SetInformationJobObject(
            hJob: *mut std::ffi::c_void,
            JobObjectInformationClass: i32,
            lpJobObjectInformation: *const std::ffi::c_void,
            cbJobObjectInformationLength: u32,
        ) -> i32;
        fn GetCurrentProcess() -> *mut std::ffi::c_void;
    }

    pub fn setup_process_grouping() {
        // 1. Set explicit Application User Model ID for Windows Task Manager & Taskbar grouping
        let app_id: Vec<u16> = "Arachnid.MusicPlayer\0".encode_utf16().collect();
        unsafe {
            let _ = SetCurrentProcessExplicitAppUserModelID(app_id.as_ptr());
        }

        // 2. Put main process and any child processes (like msedgewebview2.exe) in a dedicated Job Object
        // This groups them cleanly in Windows Task Manager and ensures child processes cleanly close on exit
        unsafe {
            let job = CreateJobObjectW(std::ptr::null_mut(), std::ptr::null());
            if !job.is_null() {
                let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
                info.basic_limit_information.limit_flags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
                let _ = SetInformationJobObject(
                    job,
                    JobObjectExtendedLimitInformation,
                    &info as *const _ as *const std::ffi::c_void,
                    std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
                );
                let _ = AssignProcessToJobObject(job, GetCurrentProcess());
                std::mem::forget(job);
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "windows")]
    {
        windows_process_grouping::setup_process_grouping();

        std::env::set_var(
            "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
            "--enable-features=HardwareMediaKeyHandling,MediaSessionService --autoplay-policy=no-user-gesture-required",
        );
    }

    tauri::Builder::default()
        .manage(AppState {
            discord: discord::DiscordService::new(),
        })
        .invoke_handler(tauri::generate_handler![
            get_app_version,
            update_discord_presence,
            read_audio_files,
            read_audio_binary,
            open_file_dialog,
            show_in_folder,
            save_track_lyrics,
            scan_folder,
            batch_update_tags,
            save_portable_data,
            load_portable_data,
            get_system_accent_color
        ])
        .run(tauri::generate_context!())
        .expect("error while running Arachnid application");
}
