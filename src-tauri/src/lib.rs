mod discord;
mod storage;

use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::State;
use base64::prelude::*;
use lofty::config::WriteOptions;
use lofty::file::{AudioFile, TaggedFileExt};
use lofty::picture::{Picture, PictureType};
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
    pub track_total: Option<u32>,
    pub duration_seconds: f64,
    pub cover_art: Option<String>,
    pub format: String,
    pub file_size: u64,
    pub lyrics: Option<String>,
    pub composer: Option<String>,
    pub content_group: Option<String>,
    pub comment: Option<String>,
    pub conductor: Option<String>,
    pub lyricist: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TagUpdates {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub genre: Option<String>,
    pub year: Option<u32>,
    pub track_number: Option<u32>,
    pub track_total: Option<u32>,
    pub composer: Option<String>,
    pub content_group: Option<String>,
    pub comment: Option<String>,
    pub conductor: Option<String>,
    pub lyricist: Option<String>,
    pub cover_art: Option<String>,
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

#[tauri::command]
fn save_portable_data(data: String) -> Result<bool, String> {
    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&data) {
        storage::save_modular_data(&val)
    } else {
        Err("Invalid JSON data format".to_string())
    }
}

#[tauri::command]
fn load_portable_data() -> Result<Option<String>, String> {
    storage::load_modular_data()
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
    let mut track_total = None;
    let mut duration_seconds = 0.0;
    let mut cover_art = None;
    let mut lyrics = None;
    let mut composer = None;
    let mut content_group = None;
    let mut comment = None;
    let mut conductor = None;
    let mut lyricist = None;

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
            if track_total.is_none() {
                if let Some(tt) = tag.track_total() {
                    track_total = Some(tt);
                }
            }
            if lyrics.is_none() {
                if let Some(l) = tag.get_string(&ItemKey::Lyrics) {
                    lyrics = Some(l.to_string());
                }
            }
            if composer.is_none() {
                if let Some(c) = tag.get_string(&ItemKey::Composer) {
                    composer = Some(c.to_string());
                }
            }
            if content_group.is_none() {
                if let Some(cg) = tag.get_string(&ItemKey::ContentGroup) {
                    content_group = Some(cg.to_string());
                }
            }
            if comment.is_none() {
                if let Some(com) = tag.comment() {
                    comment = Some(com.to_string());
                } else if let Some(com) = tag.get_string(&ItemKey::Comment) {
                    comment = Some(com.to_string());
                }
            }
            if conductor.is_none() {
                if let Some(con) = tag.get_string(&ItemKey::Conductor) {
                    conductor = Some(con.to_string());
                }
            }
            if lyricist.is_none() {
                if let Some(lyr) = tag.get_string(&ItemKey::Lyricist) {
                    lyricist = Some(lyr.to_string());
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
        track_total,
        duration_seconds,
        cover_art,
        format: ext.to_uppercase(),
        file_size,
        lyrics,
        composer,
        content_group,
        comment,
        conductor,
        lyricist,
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

fn apply_tag_updates_to_file(path_str: &str, updates: &TagUpdates) -> Result<(), String> {
    let file_path = Path::new(path_str);
    if !file_path.is_file() {
        return Err(format!("File not found: {}", path_str));
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

    if let Some(ref title) = updates.title {
        tag.set_title(title.clone());
    }
    if let Some(ref artist) = updates.artist {
        tag.set_artist(artist.clone());
    }
    if let Some(ref album) = updates.album {
        tag.set_album(album.clone());
    }
    if let Some(ref genre) = updates.genre {
        tag.set_genre(genre.clone());
    }
    if let Some(year) = updates.year {
        tag.set_year(year);
    }
    if let Some(track_num) = updates.track_number {
        if track_num == 0 {
            tag.remove_track();
        } else {
            tag.set_track(track_num);
        }
    }
    if let Some(track_tot) = updates.track_total {
        if track_tot == 0 {
            tag.remove_track_total();
        } else {
            tag.set_track_total(track_tot);
        }
    }

    if let Some(ref comp) = updates.composer {
        if comp.trim().is_empty() {
            tag.remove_key(&ItemKey::Composer);
        } else {
            tag.insert_text(ItemKey::Composer, comp.clone());
        }
    }
    if let Some(ref cg) = updates.content_group {
        if cg.trim().is_empty() {
            tag.remove_key(&ItemKey::ContentGroup);
        } else {
            tag.insert_text(ItemKey::ContentGroup, cg.clone());
        }
    }
    if let Some(ref com) = updates.comment {
        if com.trim().is_empty() {
            tag.remove_comment();
            tag.remove_key(&ItemKey::Comment);
        } else {
            tag.set_comment(com.clone());
        }
    }
    if let Some(ref cond) = updates.conductor {
        if cond.trim().is_empty() {
            tag.remove_key(&ItemKey::Conductor);
        } else {
            tag.insert_text(ItemKey::Conductor, cond.clone());
        }
    }
    if let Some(ref lyr) = updates.lyricist {
        if lyr.trim().is_empty() {
            tag.remove_key(&ItemKey::Lyricist);
        } else {
            tag.insert_text(ItemKey::Lyricist, lyr.clone());
        }
    }

    // Cover art update
    if let Some(ref cover_art_data) = updates.cover_art {
        tag.remove_picture_type(PictureType::CoverFront);
        let trimmed = cover_art_data.trim();
        if !trimmed.is_empty() {
            let b64_clean = if let Some(idx) = trimmed.find(";base64,") {
                &trimmed[idx + 8..]
            } else {
                trimmed
            };
            if let Ok(bytes) = BASE64_STANDARD.decode(b64_clean.as_bytes()) {
                if let Ok(mut pic) = Picture::from_reader(&mut std::io::Cursor::new(bytes)) {
                    pic.set_pic_type(PictureType::CoverFront);
                    tag.push_picture(pic);
                }
            }
        }
    }

    tag.save_to_path(file_path, WriteOptions::default()).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn save_track_file_tags(path: String, updates: TagUpdates) -> Result<Option<TrackMetadata>, String> {
    apply_tag_updates_to_file(&path, &updates)?;
    Ok(parse_single_file(&path))
}

#[tauri::command]
fn batch_save_track_file_tags(paths: Vec<String>, updates: TagUpdates) -> Result<usize, String> {
    let mut updated_count = 0;
    for path in &paths {
        if apply_tag_updates_to_file(path, &updates).is_ok() {
            updated_count += 1;
        }
    }
    Ok(updated_count)
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
fn save_track_lyrics(path: String, lyrics: String, lyricist: Option<String>) -> Result<bool, String> {
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

    if let Some(lyr) = lyricist {
        if lyr.trim().is_empty() {
            tag.remove_key(&ItemKey::Lyricist);
        } else {
            tag.insert_text(ItemKey::Lyricist, lyr);
        }
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

#[tauri::command]
fn show_window(window: tauri::Window) -> Result<(), String> {
    window.show().map_err(|e| e.to_string())?;
    let _ = window.set_focus();
    Ok(())
}

#[tauri::command]
fn minimize_window(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_maximize_window(window: tauri::Window) -> Result<bool, String> {
    let is_max = window.is_maximized().map_err(|e| e.to_string())?;
    if is_max {
        window.unmaximize().map_err(|e| e.to_string())?;
        Ok(false)
    } else {
        window.maximize().map_err(|e| e.to_string())?;
        Ok(true)
    }
}

#[tauri::command]
fn close_window(window: tauri::Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
fn apply_in_place_update(base64_data: String) -> Result<(), String> {
    let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let exe_dir = current_exe
        .parent()
        .ok_or_else(|| "Cannot get executable directory".to_string())?;
    let current_exe_name = current_exe
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Arachnid-Portable.exe");
    let new_exe = exe_dir.join("Arachnid-Update.new.exe");

    let bytes = BASE64_STANDARD
        .decode(base64_data.trim())
        .map_err(|e| format!("Failed to decode base64 update data: {}", e))?;

    std::fs::write(&new_exe, &bytes)
        .map_err(|e| format!("Failed to write update binary: {}", e))?;

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let script_path = exe_dir.join("apply_update.bat");
        let script_content = format!(
            "@echo off\r\n\
            chcp 65001 >nul\r\n\
            timeout /t 1 /nobreak >nul\r\n\
            :retry\r\n\
            move /y \"%~dp0Arachnid-Update.new.exe\" \"%~dp0{}\" >nul 2>&1\r\n\
            if errorlevel 1 (\r\n\
                timeout /t 1 /nobreak >nul\r\n\
                goto retry\r\n\
            )\r\n\
            start \"\" \"%~dp0{}\"\r\n\
            del \"%~f0\"\r\n",
            current_exe_name,
            current_exe_name
        );

        std::fs::write(&script_path, script_content)
            .map_err(|e| format!("Failed to write update batch script: {}", e))?;

        Command::new("cmd")
            .current_dir(exe_dir)
            .args(&["/c", "apply_update.bat"])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| format!("Failed to launch update batch script: {}", e))?;

        std::process::exit(0);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = std::fs::rename(&new_exe, &current_exe);
        Ok(())
    }
}

#[tauri::command]
fn is_window_maximized(window: tauri::Window) -> Result<bool, String> {
    window.is_maximized().map_err(|e| e.to_string())
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
    const JOB_OBJECT_EXTENDED_LIMIT_INFORMATION: i32 = 9;

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
                    JOB_OBJECT_EXTENDED_LIMIT_INFORMATION,
                    &info as *const _ as *const std::ffi::c_void,
                    std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
                );
                let _ = AssignProcessToJobObject(job, GetCurrentProcess());
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let base_dir = storage::get_portable_base_dir();
    storage::init_storage_structure(&base_dir);

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
            save_track_file_tags,
            batch_save_track_file_tags,
            batch_update_tags,
            save_portable_data,
            load_portable_data,
            get_system_accent_color,
            minimize_window,
            toggle_maximize_window,
            close_window,
            show_window,
            apply_in_place_update,
            is_window_maximized,
            open_app_folder,
            open_url,
            list_custom_themes,
            read_custom_theme,
            load_locale_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running Arachnid application");
}

#[derive(Serialize, Deserialize, Clone)]
pub struct CustomThemeInfo {
    pub name: String,
    pub filename: String,
}

#[tauri::command]
fn open_app_folder(subfolder: Option<String>) -> Result<(), String> {
    let base_dir = storage::get_portable_base_dir();
    let target = match subfolder {
        Some(sub) if !sub.is_empty() => base_dir.join(sub),
        _ => base_dir,
    };
    let _ = std::fs::create_dir_all(&target);

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        Command::new("explorer")
            .arg(&target)
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = open::that(&target);
    }
    Ok(())
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        Command::new("cmd")
            .args(&["/c", "start", "", &url])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = open::that(&url);
    }
    Ok(())
}

#[tauri::command]
fn list_custom_themes() -> Result<Vec<CustomThemeInfo>, String> {
    let base_dir = storage::get_portable_base_dir();
    let themes_dir = base_dir.join("themes");
    let mut list = Vec::new();
    if let Ok(entries) = std::fs::read_dir(themes_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    if ext.eq_ignore_ascii_case("css") {
                        let filename = entry.file_name().to_string_lossy().to_string();
                        let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or(&filename).to_string();
                        list.push(CustomThemeInfo {
                            name: stem,
                            filename,
                        });
                    }
                }
            }
        }
    }
    Ok(list)
}

#[tauri::command]
fn read_custom_theme(filename: String) -> Result<String, String> {
    let base_dir = storage::get_portable_base_dir();
    let themes_dir = base_dir.join("themes");
    let safe_filename = Path::new(&filename)
        .file_name()
        .and_then(|f| f.to_str())
        .ok_or_else(|| "Invalid filename".to_string())?;
    let path = themes_dir.join(safe_filename);
    if path.is_file() {
        std::fs::read_to_string(&path).map_err(|e| format!("Failed to read theme file: {}", e))
    } else {
        Err("Theme file not found".to_string())
    }
}

#[tauri::command]
fn load_locale_file(language: String) -> Result<Option<String>, String> {
    let base_dir = storage::get_portable_base_dir();
    let locales_dir = base_dir.join("locales");
    let safe_lang = language.chars().filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_').collect::<String>();
    let file_path = locales_dir.join(format!("{}.json", safe_lang));
    if file_path.is_file() {
        let content = std::fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
        Ok(Some(content))
    } else {
        Ok(None)
    }
}
