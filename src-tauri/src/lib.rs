mod discord;
mod storage;
mod player;
mod logger;

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::{Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};
use base64::prelude::*;
use lofty::config::{ParseOptions, ParsingMode, WriteOptions};
use lofty::file::{AudioFile, TaggedFileExt};
use lofty::picture::{MimeType, Picture, PictureType};
use lofty::probe::Probe;
use lofty::tag::{Accessor, ItemKey, Tag, TagExt, TagType};

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

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
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
    pub lyrics: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DiscordPresenceState {
    pub enabled: bool,
    pub details: String,
    pub state: String,
    pub large_image: Option<String>,
    pub large_text: Option<String>,
    pub small_image: Option<String>,
    pub small_text: Option<String>,
    pub start_timestamp: Option<i64>,
    pub end_timestamp: Option<i64>,
    pub status_display_type: Option<i32>,
    pub client_id: Option<String>,
    pub status_mode: Option<String>,
}

pub struct AppState {
    pub discord: discord::DiscordService,
    pub player: player::NativePlayer,
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

fn find_image_in_directory(dir: &Path) -> Option<PathBuf> {
    if !dir.is_dir() {
        return None;
    }

    let entries = std::fs::read_dir(dir).ok()?;
    let mut all_images: Vec<PathBuf> = Vec::new();

    let preferred_stems = [
        "cover", "folder", "front", "album", "albumart", "artwork",
        "soundtrack", "ost", "poster", "disc", "cd", "image"
    ];

    let supported_exts = ["jpg", "jpeg", "png", "webp"];

    for entry in entries.filter_map(|e| e.ok()) {
        let p = entry.path();
        if p.is_file() {
            if let Some(ext) = p.extension().and_then(|s| s.to_str()) {
                let ext_lower = ext.to_lowercase();
                if supported_exts.contains(&ext_lower.as_str()) {
                    if let Some(stem) = p.file_stem().and_then(|s| s.to_str()) {
                        let stem_lower = stem.to_lowercase();
                        if preferred_stems.contains(&stem_lower.as_str()) {
                            return Some(p);
                        }
                    }
                    all_images.push(p);
                }
            }
        }
    }

    if !all_images.is_empty() {
        all_images.sort();
        return Some(all_images.remove(0));
    }

    None
}

fn find_folder_cover_art(track_path: &Path) -> Option<String> {
    let parent = track_path.parent()?;

    // 1. Check track's immediate folder
    if let Some(img_path) = find_image_in_directory(parent) {
        return Some(img_path.to_string_lossy().to_string());
    }

    // 2. If track is inside a subfolder like "CD1", "Disc 1", "Scans", check parent's parent
    if let Some(parent_name) = parent.file_name().and_then(|s| s.to_str()) {
        let parent_lower = parent_name.to_lowercase();
        if parent_lower.starts_with("cd") 
            || parent_lower.starts_with("disc") 
            || parent_lower.starts_with("disk") 
            || parent_lower == "scans"
        {
            if let Some(grandparent) = parent.parent() {
                if let Some(img_path) = find_image_in_directory(grandparent) {
                    return Some(img_path.to_string_lossy().to_string());
                }
            }
        }
    }

    None
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

    let parse_opts = ParseOptions::new().parsing_mode(ParsingMode::Relaxed);
    if let Ok(tagged_file) = Probe::open(path).and_then(|p| p.options(parse_opts).read()) {
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
                    if let Some(saved_path) = storage::save_cover_bytes(pic.data(), mime) {
                        cover_art = Some(saved_path);
                    }
                }
            }
        }
    }

    if cover_art.is_none() {
        cover_art = find_folder_cover_art(path);
    }

    if lyrics.is_none() {
        let lrc_path = path.with_extension("lrc");
        let candidate_lrc = if lrc_path.is_file() {
            Some(lrc_path)
        } else {
            let lrc_upper = path.with_extension("LRC");
            if lrc_upper.is_file() {
                Some(lrc_upper)
            } else {
                None
            }
        };
        if let Some(target_lrc) = candidate_lrc {
            if let Ok(bytes) = std::fs::read(&target_lrc) {
                let text = if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
                    String::from_utf8_lossy(&bytes[3..]).to_string()
                } else if bytes.starts_with(&[0xFF, 0xFE]) {
                    let u16_chars: Vec<u16> = bytes[2..].chunks_exact(2)
                        .map(|c| u16::from_le_bytes([c[0], c[1]])).collect();
                    String::from_utf16_lossy(&u16_chars)
                } else {
                    String::from_utf8_lossy(&bytes).to_string()
                };
                let trimmed = text.trim();
                if !trimmed.is_empty() {
                    lyrics = Some(trimmed.to_string());
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
async fn read_audio_files(paths: Vec<String>) -> Result<Vec<TrackMetadata>, String> {
    tauri::async_runtime::spawn_blocking(move || {
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
    })
    .await
    .map_err(|e| format!("Task execution error: {}", e))?
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
        large_image: presence.large_image,
        large_text: presence.large_text,
        small_image: presence.small_image,
        small_text: presence.small_text,
        start_timestamp: presence.start_timestamp,
        end_timestamp: presence.end_timestamp,
        status_display_type: presence.status_display_type,
        client_id: presence.client_id,
        status_mode: presence.status_mode,
    });
    Ok("Discord presence update queued".to_string())
}

#[tauri::command]
async fn open_file_dialog() -> Result<Vec<TrackMetadata>, String> {
    let files = rfd::FileDialog::new()
        .add_filter("Audio Files (*.mp3;*.flac;*.wav;*.ogg;*.m4a;*.opus;*.aac;*.wma)", &["mp3", "flac", "wav", "ogg", "m4a", "opus", "aac", "wma"])
        .pick_files();

    if let Some(paths) = files {
        let string_paths: Vec<String> = paths
            .into_iter()
            .map(|p| p.to_string_lossy().to_string())
            .collect();
        read_audio_files(string_paths).await
    } else {
        Ok(vec![])
    }
}

#[tauri::command]
async fn scan_folder(folder_path: String) -> Result<Vec<TrackMetadata>, String> {
    read_audio_files(vec![folder_path]).await
}

#[tauri::command]
fn get_portable_music_path() -> Result<String, String> {
    let base_dir = storage::get_portable_base_dir();
    let music_dir = base_dir.join("music");
    let _ = std::fs::create_dir_all(&music_dir);
    Ok(music_dir.to_string_lossy().to_string())
}

#[tauri::command]
fn pick_folder_dialog() -> Result<Option<String>, String> {
    let folder = rfd::FileDialog::new().pick_folder();
    Ok(folder.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
async fn find_relocated_tracks_in_folder(
    search_dir: String,
    missing_paths: Vec<String>,
) -> Result<std::collections::HashMap<String, String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = Path::new(&search_dir);
        if !root.is_dir() {
            return Err("Selected path is not a directory".to_string());
        }

        let supported = ["mp3", "flac", "wav", "ogg", "m4a", "aac", "opus", "wma"];
        let mut found_by_filename: std::collections::HashMap<String, Vec<String>> = std::collections::HashMap::new();
        let mut found_by_rel_suffix: std::collections::HashMap<String, String> = std::collections::HashMap::new();

        for entry in walkdir::WalkDir::new(root).into_iter().filter_map(|e| e.ok()) {
            if entry.path().is_file() {
                if let Some(ext) = entry.path().extension().and_then(|x| x.to_str()) {
                    if supported.contains(&ext.to_lowercase().as_str()) {
                        let full_str = entry.path().to_string_lossy().to_string();
                        if let Some(fname) = entry.path().file_name().and_then(|f| f.to_str()) {
                            let fname_lower = fname.to_lowercase();
                            found_by_filename.entry(fname_lower).or_default().push(full_str.clone());
                        }

                        if let Some(parent_name) = entry.path().parent().and_then(|p| p.file_name()).and_then(|f| f.to_str()) {
                            if let Some(fname) = entry.path().file_name().and_then(|f| f.to_str()) {
                                let key = format!("{}/{}", parent_name.to_lowercase(), fname.to_lowercase());
                                found_by_rel_suffix.insert(key, full_str);
                            }
                        }
                    }
                }
            }
        }

        let mut relocated_map: std::collections::HashMap<String, String> = std::collections::HashMap::new();

        for old_path in missing_paths {
            let p = Path::new(&old_path);
            let fname = p.file_name().and_then(|f| f.to_str()).map(|f| f.to_lowercase());
            let parent_name = p.parent().and_then(|par| par.file_name()).and_then(|f| f.to_str()).map(|f| f.to_lowercase());

            if let (Some(par), Some(f)) = (&parent_name, &fname) {
                let suffix_key = format!("{}/{}", par, f);
                if let Some(found_path) = found_by_rel_suffix.get(&suffix_key) {
                    relocated_map.insert(old_path.clone(), found_path.clone());
                    continue;
                }
            }

            if let Some(f) = fname {
                if let Some(candidates) = found_by_filename.get(&f) {
                    if !candidates.is_empty() {
                        relocated_map.insert(old_path.clone(), candidates[0].clone());
                    }
                }
            }
        }

        Ok(relocated_map)
    })
    .await
    .map_err(|e| format!("Task execution error: {}", e))?
}

fn find_mp3_audio_start(data: &[u8]) -> usize {
    let mut offset = 0;
    let file_len = data.len();

    // Consume all consecutive ID3v2 tags (handling duplicate, chained, or junk-prefixed tags)
    while offset + 10 <= file_len {
        // Skip null padding before or between ID3 tags
        if data[offset] == 0 {
            offset += 1;
            continue;
        }

        if &data[offset..offset + 3] == b"ID3" {
            let flags = data[offset + 5];
            let s0 = data[offset + 6] as usize;
            let s1 = data[offset + 7] as usize;
            let s2 = data[offset + 8] as usize;
            let s3 = data[offset + 9] as usize;

            // ID3v2 size is a 4-byte synchsafe integer (MSB of each byte is 0)
            if ((s0 | s1 | s2 | s3) & 0x80) != 0 {
                break;
            }

            let tag_size = (s0 << 21) | (s1 << 14) | (s2 << 7) | s3;
            let has_footer = (flags & 0x10) != 0;
            let tag_len = 10 + tag_size + if has_footer { 10 } else { 0 };

            if offset + tag_len > file_len {
                break;
            }

            offset += tag_len;
        } else {
            break;
        }
    }

    // Skip any trailing ID3 zero-padding bytes after the tag until the MPEG audio frame sync
    let mut search_pos = offset;
    while search_pos < file_len && data[search_pos] == 0 {
        search_pos += 1;
    }

    // If an MPEG audio frame sync is found (11 sync bits: 0xFF, upper 3 bits of next byte set to 1)
    if search_pos + 1 < file_len && data[search_pos] == 0xFF && (data[search_pos + 1] & 0xE0) == 0xE0 {
        return search_pos;
    }

    search_pos
}

fn find_mp3_audio_end(data: &[u8], audio_start: usize) -> (usize, bool) {
    let mut end = data.len();
    let mut has_id3v1 = false;

    // 1. Check for ID3v1 tag at the very end (128 bytes starting with "TAG")
    if end.saturating_sub(audio_start) >= 128 && &data[end - 128..end - 125] == b"TAG" {
        has_id3v1 = true;
        end -= 128;
    }

    // 2. Check for APEv2 footer right before ID3v1 (or at EOF)
    // APEv2 footer is 32 bytes:
    // Bytes 0..8: "APETAGEX"
    // Bytes 12..16: tag size (u32 little-endian, includes footer + items + optional header)
    if end.saturating_sub(audio_start) >= 32 && &data[end - 32..end - 24] == b"APETAGEX" {
        let ape_size = u32::from_le_bytes([
            data[end - 20],
            data[end - 19],
            data[end - 18],
            data[end - 17],
        ]) as usize;

        if ape_size >= 32 && ape_size <= end.saturating_sub(audio_start) {
            end -= ape_size;
        }
    }

    (end, has_id3v1)
}

fn encode_id3v23_text(text: &str) -> Vec<u8> {
    if text.chars().all(|c| (c as u32) <= 0xFF) {
        let mut out = Vec::with_capacity(1 + text.len());
        out.push(0x00); // Latin1 (ISO-8859-1)
        for c in text.chars() {
            out.push(c as u8);
        }
        out
    } else {
        let utf16: Vec<u16> = text.encode_utf16().collect();
        let mut out = Vec::with_capacity(3 + utf16.len() * 2);
        out.push(0x01); // UTF-16 with BOM
        out.push(0xFF); // BOM Little Endian
        out.push(0xFE);
        for code in utf16 {
            let bytes = code.to_le_bytes();
            out.push(bytes[0]);
            out.push(bytes[1]);
        }
        out
    }
}

fn make_id3v23_frame(frame_id: &str, payload: &[u8]) -> Vec<u8> {
    if payload.is_empty() || frame_id.len() != 4 {
        return Vec::new();
    }
    let mut frame = Vec::with_capacity(10 + payload.len());
    frame.extend_from_slice(frame_id.as_bytes());
    frame.extend_from_slice(&(payload.len() as u32).to_be_bytes());
    frame.extend_from_slice(&[0x00, 0x00]); // frame flags
    frame.extend_from_slice(payload);
    frame
}

fn make_id3v23_text_frame(frame_id: &str, text: &str) -> Vec<u8> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Vec::new();
    }
    let encoded = encode_id3v23_text(trimmed);
    make_id3v23_frame(frame_id, &encoded)
}

fn make_id3v23_comm_frame(comment: &str) -> Vec<u8> {
    let trimmed = comment.trim();
    if trimmed.is_empty() {
        return Vec::new();
    }
    let mut payload = Vec::new();
    if trimmed.chars().all(|c| (c as u32) <= 0xFF) {
        payload.push(0x00); // Latin1
        payload.extend_from_slice(b"eng"); // language
        payload.push(0x00); // short description null terminator
        for c in trimmed.chars() {
            payload.push(c as u8);
        }
    } else {
        payload.push(0x01); // UTF-16 with BOM
        payload.extend_from_slice(b"eng"); // language
        payload.extend_from_slice(&[0x00, 0x00]); // short description null terminator (UTF-16 2 bytes)
        payload.extend_from_slice(&[0xFF, 0xFE]); // BOM
        for code in trimmed.encode_utf16() {
            payload.extend_from_slice(&code.to_le_bytes());
        }
    }
    make_id3v23_frame("COMM", &payload)
}

fn make_id3v23_lyrics_frame(lyrics: &str) -> Vec<u8> {
    let trimmed = lyrics.trim();
    if trimmed.is_empty() {
        return Vec::new();
    }
    let mut payload = Vec::new();
    if trimmed.chars().all(|c| (c as u32) <= 0xFF) {
        payload.push(0x00); // Latin1
        payload.extend_from_slice(b"eng");
        payload.push(0x00); // descriptor terminator
        for c in trimmed.chars() {
            payload.push(c as u8);
        }
    } else {
        payload.push(0x01); // UTF-16 with BOM
        payload.extend_from_slice(b"eng");
        payload.extend_from_slice(&[0x00, 0x00]);
        payload.extend_from_slice(&[0xFF, 0xFE]);
        for code in trimmed.encode_utf16() {
            payload.extend_from_slice(&code.to_le_bytes());
        }
    }
    make_id3v23_frame("USLT", &payload)
}

fn make_id3v23_apic_frame(image_bytes: &[u8], mime_type: &str) -> Vec<u8> {
    if image_bytes.is_empty() {
        return Vec::new();
    }
    let mime = if mime_type.is_empty() { "image/jpeg" } else { mime_type };
    // Standard ID3v2.3 APIC frame as written by TagLib / MusicBee / Mp3tag:
    // [0x00] (Latin1) + [MIME string] + [0x00] + [0x03 Front cover] + [0x00 Empty description] + [image data]
    let mut payload = Vec::with_capacity(1 + mime.len() + 1 + 1 + 1 + image_bytes.len());
    payload.push(0x00);
    payload.extend_from_slice(mime.as_bytes());
    payload.push(0x00);
    payload.push(0x03);
    payload.push(0x00);
    payload.extend_from_slice(image_bytes);
    make_id3v23_frame("APIC", &payload)
}

fn build_id3v23_tag_bytes(frames: &[Vec<u8>]) -> Vec<u8> {
    let total_frames_len: usize = frames.iter().map(|f| f.len()).sum();
    if total_frames_len == 0 {
        return Vec::new();
    }
    // Include 1024 bytes of standard null padding (matches Mp3tag/TagLib/iTunes standard layout)
    let padding_len = 1024;
    let s = (total_frames_len + padding_len) as u32;
    let synch_size = [
        ((s >> 21) & 0x7F) as u8,
        ((s >> 14) & 0x7F) as u8,
        ((s >> 7) & 0x7F) as u8,
        (s & 0x7F) as u8,
    ];
    let mut tag = Vec::with_capacity(10 + total_frames_len + padding_len);
    tag.extend_from_slice(b"ID3");
    tag.push(0x03); // version 2.3
    tag.push(0x00); // revision
    tag.push(0x00); // flags
    tag.extend_from_slice(&synch_size);
    for f in frames {
        tag.extend_from_slice(f);
    }
    tag.resize(10 + total_frames_len + padding_len, 0);
    tag
}

fn sync_folder_cover_art(folder: &Path, new_cover: Option<&[u8]>) {
    if !folder.is_dir() {
        return;
    }

    // Never delete user-provided folder cover files (Folder.jpg / cover.jpg) when editing track tags!
    let make_writable = |p: &Path| {
        if let Ok(meta) = std::fs::metadata(p) {
            let mut perms = meta.permissions();
            if perms.readonly() {
                #[allow(clippy::permissions_set_readonly_false)]
                perms.set_readonly(false);
                let _ = std::fs::set_permissions(p, perms);
            }
        }
    };

    // If new cover is provided, write/overwrite Folder.jpg
    if let Some(bytes) = new_cover {
        if let Ok(entries) = std::fs::read_dir(folder) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                        let name_lower = name.to_ascii_lowercase();
                        // Match Windows Media Player generated cover files (AlbumArt*.jpg)
                        if name_lower.starts_with("albumart") && name_lower.ends_with(".jpg") {
                            make_writable(&path);
                            let _ = std::fs::remove_file(&path);
                        }
                    }
                }
            }
        }

        let folder_jpg = folder.join("Folder.jpg");
        make_writable(&folder_jpg);
        let _ = std::fs::write(&folder_jpg, bytes);
    }
}

fn apply_tag_updates_to_file(path_str: &str, updates: &TagUpdates) -> Result<(), String> {
    let base_dir = crate::storage::get_portable_base_dir();
    let mut file_path_buf = PathBuf::from(path_str);
    if !file_path_buf.is_file() {
        let norm = path_str.replace('/', "\\");
        let p = PathBuf::from(&norm);
        if p.is_file() {
            file_path_buf = p;
        } else if file_path_buf.is_relative() {
            let rel = base_dir.join(path_str);
            if rel.is_file() {
                file_path_buf = rel;
            } else {
                let rel_norm = base_dir.join(&norm);
                if rel_norm.is_file() {
                    file_path_buf = rel_norm;
                }
            }
        }
    }
    if !file_path_buf.is_file() {
        return Err(format!("File not found: {}", path_str));
    }
    let file_path = &file_path_buf;

    // Ensure file is writable on Windows if read-only attribute was set
    if let Ok(meta) = std::fs::metadata(file_path) {
        let mut perms = meta.permissions();
        if perms.readonly() {
            perms.set_readonly(false);
            let _ = std::fs::set_permissions(file_path, perms);
        }
    }

    // Decode new cover art data if explicitly updated
    let parsed_cover_art: Option<(Option<Vec<u8>>, String)> = if let Some(ref cover_art_data) = updates.cover_art {
        let trimmed = cover_art_data.trim();
        if trimmed.is_empty() {
            Some((None, "image/jpeg".to_string()))
        } else {
            let (_mime_str, b64_data) = if let Some(idx) = trimmed.find(";base64,") {
                let prefix = &trimmed[..idx];
                let mime = if prefix.starts_with("data:") {
                    &prefix[5..]
                } else {
                    "image/jpeg"
                };
                (mime, &trimmed[idx + 8..])
            } else {
                ("image/jpeg", trimmed)
            };

            let clean_data: String = b64_data.chars().filter(|c| !c.is_whitespace() && *c != '"' && *c != '\'').collect();
            let decoded = BASE64_STANDARD
                .decode(clean_data.as_bytes())
                .or_else(|_| BASE64_STANDARD_NO_PAD.decode(clean_data.as_bytes()))
                .or_else(|_| BASE64_URL_SAFE.decode(clean_data.as_bytes()))
                .or_else(|_| BASE64_URL_SAFE_NO_PAD.decode(clean_data.as_bytes()))
                .map_err(|e| format!("Failed to decode cover image base64: {}", e))?;

            let mime_final = if decoded.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
                "image/png".to_string()
            } else {
                "image/jpeg".to_string()
            };

            Some((Some(decoded), mime_final))
        }
    } else {
        None
    };

    let is_mp3 = file_path.extension().map_or(false, |ext| ext.eq_ignore_ascii_case("mp3"));

    if is_mp3 {
        // Read existing metadata to preserve fields not modified in updates
        let parse_opts = ParseOptions::new().parsing_mode(ParsingMode::Relaxed);
        let existing_tagged = Probe::open(file_path).and_then(|p| p.options(parse_opts).read()).ok();
        let existing_tag = existing_tagged.as_ref().and_then(|tf| tf.primary_tag().or_else(|| tf.first_tag()));

        let title = updates.title.clone()
            .or_else(|| existing_tag.and_then(|t| t.title().map(|s| s.to_string())))
            .or_else(|| file_path.file_stem().and_then(|s| s.to_str()).map(|s| s.to_string()));

        let artist = updates.artist.clone()
            .or_else(|| existing_tag.and_then(|t| t.artist().map(|s| s.to_string())));

        let album = updates.album.clone()
            .or_else(|| existing_tag.and_then(|t| t.album().map(|s| s.to_string())));

        let genre = updates.genre.clone()
            .or_else(|| existing_tag.and_then(|t| t.genre().map(|s| s.to_string())));

        let year = updates.year
            .or_else(|| existing_tag.and_then(|t| t.year()));

        let track_number = updates.track_number
            .or_else(|| existing_tag.and_then(|t| t.track()));

        let track_total = updates.track_total
            .or_else(|| existing_tag.and_then(|t| t.track_total()));

        let composer = updates.composer.clone()
            .or_else(|| existing_tag.and_then(|t| t.get_string(&ItemKey::Composer).map(|s| s.to_string())));

        let content_group = updates.content_group.clone()
            .or_else(|| existing_tag.and_then(|t| t.get_string(&ItemKey::ContentGroup).map(|s| s.to_string())));

        let comment = updates.comment.clone()
            .or_else(|| existing_tag.and_then(|t| t.comment().map(|s| s.to_string())));

        let conductor = updates.conductor.clone()
            .or_else(|| existing_tag.and_then(|t| t.get_string(&ItemKey::Conductor).map(|s| s.to_string())));

        let lyricist = updates.lyricist.clone()
            .or_else(|| existing_tag.and_then(|t| t.get_string(&ItemKey::Lyricist).map(|s| s.to_string())));

        let lyrics = updates.lyrics.clone()
            .or_else(|| existing_tag.and_then(|t| t.get_string(&ItemKey::Lyrics).map(|s| s.to_string())));

        // Determine cover art
        let (cover_bytes, cover_mime): (Option<Vec<u8>>, String) = if let Some((ref bytes, ref mime)) = parsed_cover_art {
            (bytes.clone(), mime.clone())
        } else {
            // Cover not modified: keep existing picture if any
            if let Some(pic) = existing_tag.and_then(|t| t.pictures().first()) {
                let mime = pic.mime_type().map(|m| m.as_str()).unwrap_or("image/jpeg").to_string();
                (Some(pic.data().to_vec()), mime)
            } else {
                (None, "image/jpeg".to_string())
            }
        };

        // Construct standard ID3v2.3 frames
        let mut frames = Vec::new();
        if let Some(ref t) = title {
            let f = make_id3v23_text_frame("TIT2", t);
            if !f.is_empty() { frames.push(f); }
        }
        if let Some(ref a) = artist {
            let f = make_id3v23_text_frame("TPE1", a);
            if !f.is_empty() { frames.push(f); }
        }
        if let Some(ref al) = album {
            let f = make_id3v23_text_frame("TALB", al);
            if !f.is_empty() { frames.push(f); }
        }
        if let Some(ref g) = genre {
            let f = make_id3v23_text_frame("TCON", g);
            if !f.is_empty() { frames.push(f); }
        }
        if let Some(y) = year {
            if y > 0 {
                let f = make_id3v23_text_frame("TYER", &y.to_string());
                if !f.is_empty() { frames.push(f); }
            }
        }
        if let Some(num) = track_number {
            if num > 0 {
                let trck_str = if let Some(tot) = track_total {
                    if tot > 0 { format!("{}/{}", num, tot) } else { num.to_string() }
                } else {
                    num.to_string()
                };
                let f = make_id3v23_text_frame("TRCK", &trck_str);
                if !f.is_empty() { frames.push(f); }
            }
        }
        if let Some(ref comp) = composer {
            let f = make_id3v23_text_frame("TCOM", comp);
            if !f.is_empty() { frames.push(f); }
        }
        if let Some(ref cg) = content_group {
            let f = make_id3v23_text_frame("TIT1", cg);
            if !f.is_empty() { frames.push(f); }
        }
        if let Some(ref com) = comment {
            let f = make_id3v23_comm_frame(com);
            if !f.is_empty() { frames.push(f); }
        }
        if let Some(ref cond) = conductor {
            let f = make_id3v23_text_frame("TPE3", cond);
            if !f.is_empty() { frames.push(f); }
        }
        if let Some(ref lyr) = lyricist {
            let f = make_id3v23_text_frame("TEXT", lyr);
            if !f.is_empty() { frames.push(f); }
        }
        if let Some(ref ly) = lyrics {
            let f = make_id3v23_lyrics_frame(ly);
            if !f.is_empty() { frames.push(f); }
        }
        if let Some(ref bytes) = cover_bytes {
            let f = make_id3v23_apic_frame(bytes, &cover_mime);
            if !f.is_empty() { frames.push(f); }
        }

        let new_tag_bytes = build_id3v23_tag_bytes(&frames);

        let file_bytes = std::fs::read(file_path)
            .map_err(|e| format!("Failed to read {}: {}", file_path.display(), e))?;

        let audio_start = find_mp3_audio_start(&file_bytes);
        let (audio_end, has_id3v1) = find_mp3_audio_end(&file_bytes, audio_start);

        let mut new_file_data = Vec::with_capacity(
            new_tag_bytes.len() + (audio_end.saturating_sub(audio_start)) + if has_id3v1 { 128 } else { 0 },
        );
        new_file_data.extend_from_slice(&new_tag_bytes);
        if audio_start < file_bytes.len() && audio_end >= audio_start {
            new_file_data.extend_from_slice(&file_bytes[audio_start..audio_end]);
        }
        if has_id3v1 && file_bytes.len() >= 128 {
            new_file_data.extend_from_slice(&file_bytes[file_bytes.len() - 128..]);
        }

        std::fs::write(file_path, &new_file_data)
            .map_err(|e| format!("Failed to write updated MP3 file {}: {}", file_path.display(), e))?;
    } else {
        // Non-MP3 files: FLAC, M4A, OGG, WAV
        let parse_opts = ParseOptions::new().parsing_mode(ParsingMode::Relaxed);
        let mut tag = match Probe::open(file_path).and_then(|p| p.options(parse_opts).read()) {
            Ok(mut tagged_file) => match tagged_file.primary_tag_mut() {
                Some(t) => t.clone(),
                None => {
                    let ptype = tagged_file.primary_tag_type();
                    tagged_file.insert_tag(Tag::new(ptype));
                    tagged_file.primary_tag_mut()
                        .map(|t| t.clone())
                        .unwrap_or_else(|| Tag::new(ptype))
                }
            },
            Err(_) => {
                let ptype = match file_path.extension().and_then(|s| s.to_str()).map(|s| s.to_ascii_lowercase()).as_deref() {
                    Some("flac") | Some("ogg") | Some("opus") => TagType::VorbisComments,
                    Some("m4a") | Some("mp4") | Some("aac") => TagType::Mp4Ilst,
                    Some("wav") => TagType::RiffInfo,
                    _ => TagType::VorbisComments,
                };
                Tag::new(ptype)
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
        if let Some(ref ly) = updates.lyrics {
            if ly.trim().is_empty() {
                tag.remove_key(&ItemKey::Lyrics);
            } else {
                tag.insert_text(ItemKey::Lyrics, ly.clone());
            }
        }

        if let Some((ref maybe_bytes, _)) = parsed_cover_art {
            while !tag.pictures().is_empty() {
                tag.remove_picture(0);
            }
            if let Some(ref decoded) = maybe_bytes {
                if !decoded.is_empty() {
                    let mime_type = if decoded.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
                        MimeType::Png
                    } else {
                        MimeType::Jpeg
                    };
                    let pic = Picture::new_unchecked(PictureType::CoverFront, Some(mime_type), None, decoded.clone());
                    tag.push_picture(pic);
                }
            }
        }

        let write_options = WriteOptions::default();
        tag.save_to_path(file_path, write_options)
            .map_err(|e| format!("Failed to save tags to {}: {}", path_str, e))?;
    }

    // Synchronize album art files in the parent folder only when an explicit new cover is set
    if let Some(parent) = file_path.parent() {
        if let Some((Some(ref bytes), _)) = parsed_cover_art {
            sync_folder_cover_art(parent, Some(bytes));
        }
    }

    notify_shell_file_changed(file_path);

    Ok(())
}

#[cfg(target_os = "windows")]
fn notify_shell_file_changed(file_path: &Path) {
    use std::os::windows::ffi::OsStrExt;
    let wide: Vec<u16> = file_path.as_os_str().encode_wide().chain(std::iter::once(0)).collect();
    unsafe {
        #[link(name = "shell32")]
        extern "system" {
            fn SHChangeNotify(wEventId: i32, uFlags: u32, dwItem1: *const u16, dwItem2: *const u16);
        }
        // SHCNE_UPDATEITEM = 0x00002000, SHCNF_PATHW = 0x0005
        SHChangeNotify(0x00002000, 0x0005, wide.as_ptr(), std::ptr::null());
    }
}

#[cfg(not(target_os = "windows"))]
fn notify_shell_file_changed(_file_path: &Path) {}

#[tauri::command]
fn check_file_exists(path: String) -> bool {
    let p = Path::new(&path);
    if p.is_file() {
        return true;
    }
    if p.is_relative() {
        return crate::storage::get_portable_base_dir().join(p).is_file();
    }
    false
}

#[tauri::command]
fn batch_check_files_exist(paths: Vec<String>) -> std::collections::HashMap<String, bool> {
    let base_dir = crate::storage::get_portable_base_dir();
    let mut map = std::collections::HashMap::new();
    for p in paths {
        let path_obj = Path::new(&p);
        let exists = if path_obj.is_file() {
            true
        } else if path_obj.is_relative() {
            base_dir.join(path_obj).is_file()
        } else {
            false
        };
        map.insert(p.clone(), exists);
    }
    map
}

#[tauri::command]
async fn delete_files_from_disk(paths: Vec<String>, state: tauri::State<'_, AppState>) -> Result<Vec<String>, String> {
    // If playback is currently active, stop native player to release any file locks
    let _ = state.player.stop(false);

    tauri::async_runtime::spawn_blocking(move || {
        // Short grace pause for Windows filesystem handle closure
        std::thread::sleep(std::time::Duration::from_millis(60));
        let mut deleted = Vec::new();
        for p_str in paths {
            let p = Path::new(&p_str);
            if p.is_file() {
                if std::fs::remove_file(p).is_ok() {
                    deleted.push(p_str.clone());
                    notify_shell_file_changed(p);
                }
            }
        }
        Ok(deleted)
    })
    .await
    .map_err(|e| format!("Failed to delete files: {}", e))?
}

#[tauri::command]
fn pick_single_audio_file() -> Result<Option<String>, String> {
    let file = rfd::FileDialog::new()
        .add_filter("Audio Files (*.mp3;*.flac;*.wav;*.ogg;*.m4a;*.opus;*.aac;*.wma)", &["mp3", "flac", "wav", "ogg", "m4a", "opus", "aac", "wma"])
        .pick_file();

    Ok(file.and_then(|p| p.to_str().map(|s| s.to_string())))
}

#[tauri::command]
fn save_track_file_tags(path: String, updates: TagUpdates) -> Result<Option<TrackMetadata>, String> {
    apply_tag_updates_to_file(&path, &updates)?;
    Ok(parse_single_file(&path))
}

#[tauri::command]
fn batch_save_track_file_tags(paths: Vec<String>, updates: TagUpdates) -> Result<usize, String> {
    let mut updated_count = 0;
    let mut last_error = None;
    for path in &paths {
        match apply_tag_updates_to_file(path, &updates) {
            Ok(_) => {
                updated_count += 1;
            }
            Err(e) => {
                eprintln!("Error saving tags to {}: {}", path, e);
                last_error = Some(format!("{}: {}", path, e));
            }
        }
    }
    if updated_count == 0 && !paths.is_empty() {
        if let Some(err) = last_error {
            return Err(err);
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
        std::process::Command::new("explorer")
            .args(["/select,", &path])
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
fn save_cover_image(data_url: String, default_filename: Option<String>) -> Result<Option<String>, String> {
    let trimmed = data_url.trim();
    let (mime, b64_clean) = if let Some(idx) = trimmed.find(";base64,") {
        let prefix = &trimmed[..idx];
        let mime = if prefix.starts_with("data:") {
            &prefix[5..]
        } else {
            "image/jpeg"
        };
        (mime, &trimmed[idx + 8..])
    } else {
        ("image/jpeg", trimmed)
    };

    let clean_b64: String = b64_clean.chars().filter(|c| !c.is_whitespace() && *c != '"' && *c != '\'').collect();
    let bytes = BASE64_STANDARD
        .decode(clean_b64.as_bytes())
        .or_else(|_| BASE64_STANDARD_NO_PAD.decode(clean_b64.as_bytes()))
        .or_else(|_| BASE64_URL_SAFE.decode(clean_b64.as_bytes()))
        .or_else(|_| BASE64_URL_SAFE_NO_PAD.decode(clean_b64.as_bytes()))
        .map_err(|e| format!("Base64 decode error: {}", e))?;

    let ext = match mime {
        "image/png" => "png",
        "image/webp" => "webp",
        "image/gif" => "gif",
        _ => "jpg",
    };

    let filename = match default_filename {
        Some(name) if !name.trim().is_empty() => {
            let clean = name.trim().replace(['\\', '/', ':', '*', '?', '"', '<', '>', '|'], "_");
            if clean.ends_with(&format!(".{}", ext)) {
                clean
            } else {
                format!("{}.{}", clean, ext)
            }
        }
        _ => format!("cover.{}", ext),
    };

    let mut dialog = rfd::FileDialog::new().set_file_name(&filename);
    if ext == "png" {
        dialog = dialog.add_filter("PNG Image (*.png)", &["png"]);
    } else if ext == "webp" {
        dialog = dialog.add_filter("WebP Image (*.webp)", &["webp"]);
    } else if ext == "gif" {
        dialog = dialog.add_filter("GIF Image (*.gif)", &["gif"]);
    } else {
        dialog = dialog.add_filter("JPEG Image (*.jpg;*.jpeg)", &["jpg", "jpeg"]);
    }
    dialog = dialog.add_filter("All Files (*.*)", &["*"]);

    if let Some(dest) = dialog.save_file() {
        std::fs::write(&dest, &bytes).map_err(|e| format!("Failed to write file: {}", e))?;
        Ok(Some(dest.to_string_lossy().to_string()))
    } else {
        Ok(None)
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct M3u8ExportTrack {
    pub path: Option<String>,
    pub artist: String,
    pub title: String,
    pub duration: f64,
}

#[tauri::command]
fn export_playlist_to_m3u8(playlist_name: String, tracks: Vec<M3u8ExportTrack>) -> Result<Option<String>, String> {
    let safe_name = storage::sanitize_playlist_filename(&playlist_name);
    let default_file = format!("{}.m3u8", safe_name);

    let file = rfd::FileDialog::new()
        .set_file_name(&default_file)
        .add_filter("M3U8 Playlist (*.m3u8)", &["m3u8"])
        .add_filter("M3U Playlist (*.m3u)", &["m3u"])
        .save_file();

    if let Some(dest_path) = file {
        let mut lines = Vec::new();
        lines.push("#EXTM3U".to_string());
        lines.push(format!("#PLAYLIST:{}", playlist_name));

        for t in tracks {
            lines.push(format!("#EXTINF:{},{} - {}", t.duration as i64, t.artist, t.title));
            if let Some(p) = t.path {
                lines.push(p);
            }
        }

        let content = lines.join("\n");
        std::fs::write(&dest_path, content.as_bytes())
            .map_err(|e| format!("Failed to save playlist: {}", e))?;

        return Ok(Some(dest_path.to_string_lossy().to_string()));
    }

    Ok(None)
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ImportedM3u8Playlist {
    pub name: String,
    pub paths: Vec<String>,
}

#[tauri::command]
fn import_playlist_from_m3u8() -> Result<Option<ImportedM3u8Playlist>, String> {
    let file = rfd::FileDialog::new()
        .add_filter("Playlists (*.m3u8;*.m3u)", &["m3u8", "m3u"])
        .pick_file();

    if let Some(chosen_path) = file {
        let content = std::fs::read_to_string(&chosen_path)
            .map_err(|e| format!("Failed to read playlist file: {}", e))?;

        let stem = chosen_path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "Imported Playlist".to_string());

        let mut name = stem;
        let mut paths = Vec::new();

        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            if let Some(pl_name) = trimmed.strip_prefix("#PLAYLIST:") {
                let n = pl_name.trim();
                if !n.is_empty() {
                    name = n.to_string();
                }
                continue;
            }
            if trimmed.starts_with('#') {
                continue;
            }

            // Path to audio file
            let resolved_path = if Path::new(trimmed).is_relative() {
                if let Some(parent) = chosen_path.parent() {
                    parent.join(trimmed).to_string_lossy().to_string()
                } else {
                    trimmed.to_string()
                }
            } else {
                trimmed.to_string()
            };

            paths.push(resolved_path);
        }

        return Ok(Some(ImportedM3u8Playlist { name, paths }));
    }

    Ok(None)
}

#[tauri::command]
fn parse_m3u8_file(path: String) -> Result<ImportedM3u8Playlist, String> {
    let p = Path::new(&path);
    if !p.is_file() {
        return Err("File not found".to_string());
    }
    let content = std::fs::read_to_string(p)
        .map_err(|e| format!("Failed to read playlist file: {}", e))?;

    let stem = p
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "Imported Playlist".to_string());

    let mut name = stem;
    let mut paths = Vec::new();

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if let Some(pl_name) = trimmed.strip_prefix("#PLAYLIST:") {
            let n = pl_name.trim();
            if !n.is_empty() {
                name = n.to_string();
            }
            continue;
        }
        if trimmed.starts_with('#') {
            continue;
        }

        let resolved_path = if Path::new(trimmed).is_relative() {
            if let Some(parent) = p.parent() {
                parent.join(trimmed).to_string_lossy().to_string()
            } else {
                trimmed.to_string()
            }
        } else {
            trimmed.to_string()
        };

        paths.push(resolved_path);
    }

    Ok(ImportedM3u8Playlist { name, paths })
}

#[tauri::command]
fn save_track_lyrics(path: String, lyrics: String, lyricist: Option<String>) -> Result<bool, String> {
    let updates = TagUpdates {
        lyrics: Some(lyrics),
        lyricist,
        ..Default::default()
    };
    apply_tag_updates_to_file(&path, &updates)?;
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
fn show_lyrics_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    if std::env::var_os("ARACHNID_SMOKE_TEST_LYRICS").is_some() {
        eprintln!("Smoke test: show_lyrics_window command invoked");
    }
    const LYRICS_WINDOW_WIDTH: f64 = 440.0;
    const LYRICS_WINDOW_HEIGHT: f64 = 700.0;
    const WINDOW_GAP: i64 = 12;

    let (lyrics_window, created) = match app_handle.get_webview_window("lyrics") {
        Some(window) => (window, false),
        None => (
            WebviewWindowBuilder::new(
                &app_handle,
                "lyrics",
                WebviewUrl::App("index.html?lyricsWindow=1".into()),
            )
            .title("Arachnid Lyrics")
            .inner_size(LYRICS_WINDOW_WIDTH, LYRICS_WINDOW_HEIGHT)
            .min_inner_size(280.0, 360.0)
            .decorations(false)
            .visible(false)
            .build()
            .map_err(|e| {
                let message = format!("Unable to create lyrics window: {}", e);
                eprintln!("{}", message);
                message
            })?,
            true,
        ),
    };

    // Position the lyric window beside the player on first creation. If the
    // player fills the monitor, center the lyric window there instead.
    if created {
      if let Some(main_window) = app_handle.get_webview_window("main") {
        if let (Ok(main_position), Ok(main_size), Ok(Some(monitor)), Ok(scale_factor)) = (
            main_window.outer_position(),
            main_window.outer_size(),
            main_window.current_monitor(),
            main_window.scale_factor(),
        ) {
            let monitor_position = monitor.position();
            let monitor_size = monitor.size();
            let left = monitor_position.x as i64;
            let top = monitor_position.y as i64;
            let right = left + monitor_size.width as i64;
            let bottom = top + monitor_size.height as i64;
            let lyrics_width = (LYRICS_WINDOW_WIDTH * scale_factor).round() as i64;
            let lyrics_height = (LYRICS_WINDOW_HEIGHT * scale_factor).round() as i64;
            let main_x = main_position.x as i64;
            let main_y = main_position.y as i64;
            let main_right = main_x + main_size.width as i64;
            let right_x = main_right + WINDOW_GAP;
            let left_x = main_x - lyrics_width - WINDOW_GAP;
            let x = if right_x + lyrics_width <= right {
                right_x
            } else if left_x >= left {
                left_x
            } else {
                left + ((monitor_size.width as i64 - lyrics_width).max(0) / 2)
            };
            let preferred_y = main_y + (main_size.height as i64 - lyrics_height) / 2;
            let y = preferred_y.clamp(top, (bottom - lyrics_height).max(top));
            // Geometry is best-effort; failure to position must not prevent the window opening.
            let _ = lyrics_window.set_position(tauri::PhysicalPosition::new(x as i32, y as i32));
        }
      }
    }

    let _ = lyrics_window.unminimize();
    lyrics_window
        .show()
        .map_err(|e| format!("Unable to show lyrics window: {}", e))?;
    // Do not refocus the player here: doing so immediately covered the lyrics
    // window and made the supposedly detached view appear not to open.
    lyrics_window
        .set_focus()
        .map_err(|e| format!("Unable to focus lyrics window: {}", e))?;
    Ok(())
}

#[tauri::command]
fn hide_lyrics_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("lyrics") {
        window.hide().map_err(|e| format!("Unable to hide lyrics window: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
fn minimize_window(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn trim_memory() {
    #[cfg(target_os = "windows")]
    windows_process_grouping::trim_working_set();
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
fn close_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    let _ = app_handle;
    clean_exit();
}

fn clean_exit() -> ! {
    #[cfg(target_os = "windows")]
    {
        // 1. Move working directory out of application folder to %TEMP%
        // so no handle remains open to the application directory
        let _ = std::env::set_current_dir(std::env::temp_dir());

        // 2. Proactively terminate any descendant processes (WebView2 browser, GPU, renderers)
        windows_process_grouping::terminate_all_child_processes();
    }

    std::process::exit(0);
}

#[tauri::command]
async fn download_and_install_update(
    window: tauri::Window,
    url: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        use std::io::{Read, Write};
        use tauri::Emitter;

        let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let exe_dir = current_exe
            .parent()
            .ok_or_else(|| "Cannot get executable directory".to_string())?;
        let update_id = format!(
            "{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        );
        let temp_update_file = exe_dir.join(format!(".update_temp-{}.tmp", update_id));

        // 1. Download via ureq with auto-redirects (bypasses browser CORS completely)
        let download_result = (|| -> Result<(), String> {
            let response = ureq::get(&url)
                .set("User-Agent", "Arachnid-Music-Player-Updater")
                .call()
                .map_err(|e| format!("ureq request failed: {}", e))?;

            let total_size = response
                .header("Content-Length")
                .and_then(|s| s.parse::<u64>().ok())
                .unwrap_or(0);

            let mut reader = response.into_reader();
            let mut file = std::fs::File::create(&temp_update_file)
                .map_err(|e| format!("Failed to create update file: {}", e))?;

            let mut buffer = [0u8; 65536];
            let mut downloaded: u64 = 0;
            let mut last_percent: u32 = 0;

            loop {
                let n = reader
                    .read(&mut buffer)
                    .map_err(|e| format!("Failed reading stream: {}", e))?;
                if n == 0 {
                    break;
                }
                file.write_all(&buffer[..n])
                    .map_err(|e| format!("Failed writing to disk: {}", e))?;
                downloaded += n as u64;

                let percent = if total_size > 0 {
                    ((downloaded as f64 / total_size as f64) * 100.0).min(100.0) as u32
                } else {
                    0
                };
                if percent != last_percent {
                    last_percent = percent;
                    let _ = window.emit(
                        "update-progress",
                        serde_json::json!({
                            "downloaded": downloaded,
                            "total": total_size,
                            "percent": percent
                        }),
                    );
                }
            }

            Ok(())
        })();

        // 2. Windows native fallback: curl.exe
        if let Err(ureq_err) = download_result {
            #[cfg(target_os = "windows")]
            {
                use std::process::Command;
                let status = Command::new("curl.exe")
                    .args(&["-L", "-f", "-s", "-S", "-o", &temp_update_file.to_string_lossy(), &url])
                    .status();

                if status.is_err() || !status.unwrap().success() {
                    let _ = std::fs::remove_file(&temp_update_file);
                    return Err(format!("Download failed: {}", ureq_err));
                }
            }
            #[cfg(not(target_os = "windows"))]
            {
                let _ = std::fs::remove_file(&temp_update_file);
                return Err(ureq_err);
            }
        }

        // 3. Verify downloaded file integrity
        let meta = match std::fs::metadata(&temp_update_file) {
            Ok(meta) => meta,
            Err(error) => {
                let _ = std::fs::remove_file(&temp_update_file);
                return Err(error.to_string());
            }
        };
        if meta.len() < 1_000_000 {
            let _ = std::fs::remove_file(&temp_update_file);
            return Err("Downloaded update file is too small or incomplete".to_string());
        }
        let mut signature = [0u8; 2];
        let signature_read = std::fs::File::open(&temp_update_file)
            .and_then(|mut file| std::io::Read::read_exact(&mut file, &mut signature));
        if signature_read.is_err() || signature != *b"MZ" {
            let _ = std::fs::remove_file(&temp_update_file);
            return Err("The downloaded update is not a valid Windows executable".to_string());
        }

        // 4. In-place replacement via detached batch updater and restart
        #[cfg(target_os = "windows")]
        {
            if let Err(error) = schedule_windows_update(&current_exe, &temp_update_file, &update_id) {
                let _ = std::fs::remove_file(&temp_update_file);
                return Err(error);
            }
            clean_exit();
        }

        #[cfg(not(target_os = "windows"))]
        {
            let _ = std::fs::rename(&temp_update_file, &current_exe);
            Ok(())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(target_os = "windows")]
fn schedule_windows_update(
    current_exe: &Path,
    update_file: &Path,
    update_id: &str,
) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    const CREATE_NO_WINDOW: u32 = 0x08000000;
    const CREATE_BREAKAWAY_FROM_JOB: u32 = 0x01000000;
    const DETACHED_PROCESS: u32 = 0x00000008;

    let mut backup_os = current_exe.as_os_str().to_os_string();
    backup_os.push(format!(".old.{}", update_id));
    let backup_path = PathBuf::from(backup_os);
    let script_path = std::env::temp_dir().join(format!("Arachnid-Updater-{}.ps1", update_id));
    let error_path = std::env::temp_dir().join(format!("Arachnid-Update-Error-{}.txt", update_id));

    let quote_ps = |path: &Path| path.to_string_lossy().replace('\'', "''");
    let script = include_str!("../updater.ps1")
        .replace("__TARGET__", &quote_ps(current_exe))
        .replace("__SOURCE__", &quote_ps(update_file))
        .replace("__BACKUP__", &quote_ps(&backup_path))
        .replace("__SCRIPT__", &quote_ps(&script_path))
        .replace("__ERROR__", &quote_ps(&error_path))
        .replace("__SUCCESS__", "")
        .replace("__PARENT_PID__", &std::process::id().to_string());

    // BOM is required by Windows PowerShell 5.1 when paths contain non-ASCII characters.
    let mut script_bytes = vec![0xEF, 0xBB, 0xBF];
    script_bytes.extend_from_slice(script.as_bytes());
    std::fs::write(&script_path, script_bytes)
        .map_err(|e| format!("Unable to write the update helper: {}", e))?;

    // The app's Windows Job Object normally kills every child when its last
    // handle closes. Temporarily disable that policy so the updater survives
    // clean_exit even on systems where CREATE_BREAKAWAY_FROM_JOB is restricted.
    if let Err(error) = windows_process_grouping::set_job_kill_on_close(false) {
        let _ = std::fs::remove_file(&script_path);
        return Err(format!("Unable to detach updater from player shutdown: {}", error));
    }

    let script_arg = script_path.to_string_lossy().into_owned();
    let spawn_result = Command::new("powershell.exe")
        .current_dir(std::env::temp_dir())
        .args([
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-WindowStyle",
            "Hidden",
            "-File",
            &script_arg,
        ])
        .creation_flags(CREATE_NO_WINDOW | CREATE_BREAKAWAY_FROM_JOB | DETACHED_PROCESS)
        .spawn();

    if let Err(error) = spawn_result {
        let _ = windows_process_grouping::set_job_kill_on_close(true);
        let _ = std::fs::remove_file(&script_path);
        return Err(format!("Unable to start the detached updater: {}", error));
    }

    Ok(())
}

#[tauri::command]
fn apply_in_place_update(base64_data: String) -> Result<(), String> {
    let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let exe_dir = current_exe
        .parent()
        .ok_or_else(|| "Cannot get executable directory".to_string())?;
    let update_id = format!(
        "{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
    );
    let temp_update_file = exe_dir.join(format!(".update_temp-{}.tmp", update_id));

    let bytes = BASE64_STANDARD
        .decode(base64_data.trim())
        .map_err(|e| format!("Failed to decode base64 update data: {}", e))?;

    if let Err(error) = std::fs::write(&temp_update_file, &bytes) {
        let _ = std::fs::remove_file(&temp_update_file);
        return Err(format!("Failed to write update binary: {}", error));
    }

    #[cfg(target_os = "windows")]
    {
        let mut signature = [0u8; 2];
        if let Err(error) = std::fs::File::open(&temp_update_file)
            .and_then(|mut file| std::io::Read::read_exact(&mut file, &mut signature))
        {
            let _ = std::fs::remove_file(&temp_update_file);
            return Err(format!("Unable to verify update executable: {}", error));
        }
        if signature != *b"MZ" {
            let _ = std::fs::remove_file(&temp_update_file);
            return Err("The update data is not a valid Windows executable".to_string());
        }
        if let Err(error) = schedule_windows_update(&current_exe, &temp_update_file, &update_id) {
            let _ = std::fs::remove_file(&temp_update_file);
            return Err(error);
        }
        clean_exit();
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = std::fs::rename(&temp_update_file, &current_exe);
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
    const JOB_OBJECT_LIMIT_BREAKAWAY_OK: u32 = 0x00000800;
    const JOB_OBJECT_EXTENDED_LIMIT_INFORMATION: i32 = 9;

    static mut PROCESS_JOB: *mut std::ffi::c_void = std::ptr::null_mut();

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
        fn SetProcessWorkingSetSize(hProcess: *mut std::ffi::c_void, dwMinimumWorkingSetSize: usize, dwMaximumWorkingSetSize: usize) -> i32;
        fn CreateToolhelp32Snapshot(dwFlags: u32, th32ProcessID: u32) -> *mut std::ffi::c_void;
        fn Process32FirstW(hSnapshot: *mut std::ffi::c_void, lppe: *mut PROCESSENTRY32W) -> i32;
        fn Process32NextW(hSnapshot: *mut std::ffi::c_void, lppe: *mut PROCESSENTRY32W) -> i32;
        fn OpenProcess(dwDesiredAccess: u32, bInheritHandle: i32, dwProcessId: u32) -> *mut std::ffi::c_void;
        fn CloseHandle(hObject: *mut std::ffi::c_void) -> i32;
    }

    #[repr(C)]
    struct PROCESSENTRY32W {
        dw_size: u32,
        cnt_usage: u32,
        th32_process_id: u32,
        th32_default_heap_id: usize,
        th32_module_id: u32,
        cnt_threads: u32,
        th32_parent_process_id: u32,
        pc_pri_class_base: i32,
        dw_flags: u32,
        sz_exe_file: [u16; 260],
    }

    const TH32CS_SNAPPROCESS: u32 = 0x00000002;
    const PROCESS_SET_QUOTA: u32 = 0x0100;
    const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;

    pub fn set_job_kill_on_close(enabled: bool) -> Result<(), String> {
        unsafe {
            let job = PROCESS_JOB;
            if job.is_null() {
                return Ok(());
            }
            let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
            info.basic_limit_information.limit_flags = if enabled {
                JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE | JOB_OBJECT_LIMIT_BREAKAWAY_OK
            } else {
                JOB_OBJECT_LIMIT_BREAKAWAY_OK
            };
            let result = SetInformationJobObject(
                job,
                JOB_OBJECT_EXTENDED_LIMIT_INFORMATION,
                &info as *const _ as *const std::ffi::c_void,
                std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            );
            if result == 0 {
                Err(std::io::Error::last_os_error().to_string())
            } else {
                Ok(())
            }
        }
    }

    pub fn trim_working_set() {
        unsafe {
            // 1. Trim our own main process
            let _ = SetProcessWorkingSetSize(GetCurrentProcess(), usize::MAX, usize::MAX);

            // 2. Enumerate and trim all descendant WebView2 processes (browser, GPU, renderer)
            let my_pid = std::process::id();
            let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
            if !snapshot.is_null() && snapshot as isize != -1 {
                let mut pids_to_trim = std::collections::HashSet::new();
                pids_to_trim.insert(my_pid);

                let mut entries = Vec::new();
                let mut pe: PROCESSENTRY32W = std::mem::zeroed();
                pe.dw_size = std::mem::size_of::<PROCESSENTRY32W>() as u32;

                if Process32FirstW(snapshot, &mut pe) != 0 {
                    loop {
                        entries.push((pe.th32_process_id, pe.th32_parent_process_id));
                        if Process32NextW(snapshot, &mut pe) == 0 {
                            break;
                        }
                    }
                }
                let _ = CloseHandle(snapshot);

                // Multi-pass to collect child and grandchild processes
                let mut changed = true;
                while changed {
                    changed = false;
                    for &(pid, ppid) in &entries {
                        if pids_to_trim.contains(&ppid) && !pids_to_trim.contains(&pid) {
                            pids_to_trim.insert(pid);
                            changed = true;
                        }
                    }
                }

                for pid in pids_to_trim {
                    if pid != my_pid {
                        let h_proc = OpenProcess(PROCESS_SET_QUOTA | PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
                        if !h_proc.is_null() {
                            let _ = SetProcessWorkingSetSize(h_proc, usize::MAX, usize::MAX);
                            let _ = CloseHandle(h_proc);
                        }
                    }
                }
            }
        }
    }

    pub fn terminate_all_child_processes() {
        unsafe {
            let my_pid = std::process::id();
            let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
            if !snapshot.is_null() && snapshot as isize != -1 {
                let mut pids_to_kill = std::collections::HashSet::new();
                pids_to_kill.insert(my_pid);

                let mut entries: Vec<(u32, u32, String)> = Vec::new();
                let mut pe: PROCESSENTRY32W = std::mem::zeroed();
                pe.dw_size = std::mem::size_of::<PROCESSENTRY32W>() as u32;

                if Process32FirstW(snapshot, &mut pe) != 0 {
                    loop {
                        let len = pe
                            .sz_exe_file
                            .iter()
                            .position(|&c| c == 0)
                            .unwrap_or(pe.sz_exe_file.len());
                        let name = String::from_utf16_lossy(&pe.sz_exe_file[..len]).to_lowercase();
                        entries.push((pe.th32_process_id, pe.th32_parent_process_id, name));
                        if Process32NextW(snapshot, &mut pe) == 0 {
                            break;
                        }
                    }
                }
                let _ = CloseHandle(snapshot);

                // Multi-pass to collect child and grandchild processes
                let mut changed = true;
                while changed {
                    changed = false;
                    for (pid, ppid, _name) in &entries {
                        if pids_to_kill.contains(ppid) && !pids_to_kill.contains(pid) {
                            pids_to_kill.insert(*pid);
                            changed = true;
                        }
                    }
                }

                extern "system" {
                    fn TerminateProcess(hProcess: *mut std::ffi::c_void, uExitCode: u32) -> i32;
                }

                for (pid, _ppid, name) in entries {
                    if pids_to_kill.contains(&pid) && pid != my_pid {
                        // ONLY terminate WebView2 descendant processes!
                        // NEVER terminate cmd.exe, conhost.exe, powershell.exe or updater processes!
                        if name.contains("msedgewebview2") || name.contains("webview2") {
                            let h_proc = OpenProcess(0x0001 /* PROCESS_TERMINATE */, 0, pid);
                            if !h_proc.is_null() {
                                let _ = TerminateProcess(h_proc, 0);
                                let _ = CloseHandle(h_proc);
                            }
                        }
                    }
                }
            }
        }
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
                info.basic_limit_information.limit_flags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE | JOB_OBJECT_LIMIT_BREAKAWAY_OK;
                let _ = SetInformationJobObject(
                    job,
                    JOB_OBJECT_EXTENDED_LIMIT_INFORMATION,
                    &info as *const _ as *const std::ffi::c_void,
                    std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
                );
                let _ = AssignProcessToJobObject(job, GetCurrentProcess());
                PROCESS_JOB = job;
            }

            // 3. Prevent Windows 10/11 EcoQoS (Efficiency Mode / CPU Power Throttling) from throttling audio when minimized
            extern "system" {
                fn SetProcessInformation(
                    hProcess: *mut std::ffi::c_void,
                    ProcessInformationClass: u32,
                    ProcessInformation: *const std::ffi::c_void,
                    ProcessInformationSize: u32,
                ) -> i32;
                fn SetPriorityClass(
                    hProcess: *mut std::ffi::c_void,
                    dwPriorityClass: u32,
                ) -> i32;
            }

            #[repr(C)]
            #[allow(non_snake_case)]
            struct PROCESS_POWER_THROTTLING_STATE {
                Version: u32,
                ControlMask: u32,
                StateMask: u32,
            }

            let throttling = PROCESS_POWER_THROTTLING_STATE {
                Version: 1,
                ControlMask: 0x1 | 0x4, // PROCESS_POWER_THROTTLING_EXECUTION_SPEED | PROCESS_POWER_THROTTLING_IGNORE_TIMER_RESOLUTION
                StateMask: 0,           // 0 = Turn off throttling
            };

            let _ = SetProcessInformation(
                GetCurrentProcess(),
                4, // ProcessPowerThrottling
                &throttling as *const _ as *const std::ffi::c_void,
                std::mem::size_of::<PROCESS_POWER_THROTTLING_STATE>() as u32,
            );

            // 4. Boost process priority to ABOVE_NORMAL_PRIORITY_CLASS (0x00008000)
            // Ensures real-time WASAPI audio callbacks and player threads never starve when the window is minimized or occluded
            let _ = SetPriorityClass(GetCurrentProcess(), 0x00008000);
        }
    }
}

#[cfg(target_os = "windows")]
fn cleanup_legacy_update_artifacts() {
    // Versions before the detached PowerShell updater left shared-name files behind.
    // Only remove those stale staging files when a valid player executable exists;
    // retain any .old backup so it remains available for manual recovery.
    if let Ok(current_exe) = std::env::current_exe() {
        let mut signature = [0u8; 2];
        let is_valid_exe = std::fs::File::open(&current_exe)
            .and_then(|mut file| std::io::Read::read_exact(&mut file, &mut signature))
            .is_ok()
            && signature == *b"MZ";
        if is_valid_exe {
            if let Some(parent) = current_exe.parent() {
                let _ = std::fs::remove_file(parent.join(".updater.bat"));
                let _ = std::fs::remove_file(parent.join(".update.bat"));
                let _ = std::fs::remove_file(parent.join(".update_temp.tmp"));
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let base_dir = storage::get_portable_base_dir();
    storage::init_storage_structure(&base_dir);

    #[cfg(target_os = "windows")]
    cleanup_legacy_update_artifacts();

    #[cfg(target_os = "windows")]
    {
        windows_process_grouping::setup_process_grouping();

        let webview_args = "--enable-features=HardwareMediaKeyHandling,MediaSessionService \
                            --autoplay-policy=no-user-gesture-required \
                            --disable-background-timer-throttling \
                            --disable-renderer-backgrounding \
                            --disable-backgrounding-occluded-windows \
                            --disable-features=CalculateNativeWinOcclusion";

        std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", webview_args);
        std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGS", webview_args);
    }

    tauri::Builder::default()
        .on_window_event(|window, event| {
            match event {
                tauri::WindowEvent::Focused(focused) => {
                    logger::log(
                        "INFO",
                        "WINDOW_FOCUS",
                        &format!("window={} focused={}", window.label(), focused),
                    );
                }
                tauri::WindowEvent::CloseRequested { api, .. } if window.label() == "lyrics" => {
                    api.prevent_close();
                    let _ = window.emit_to(
                        "main",
                        "lyrics-window-action",
                        serde_json::json!({ "type": "close" }),
                    );
                    let _ = window.hide();
                }
                tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed if window.label() == "main" => {
                    clean_exit();
                }
                _ => {}
            }
        })
        .setup(|app| {
            logger::initialize_session_clock();
            logger::set_app_handle(app.handle().clone());
            logger::log("INFO", "SYSTEM", &format!("Arachnid Music Player v{} started", get_app_version()));
            Ok(())
        })
        .manage(AppState {
            discord: discord::DiscordService::new(),
            player: player::NativePlayer::new(),
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
            show_lyrics_window,
            hide_lyrics_window,
            download_and_install_update,
            apply_in_place_update,
            is_window_maximized,
            open_app_folder,
            open_url,
            list_custom_themes,
            read_custom_theme,
            delete_custom_theme,
            load_locale_file,
            save_cover_image,
            check_file_exists,
            batch_check_files_exist,
            pick_single_audio_file,
            trim_memory,
            native_play,
            native_pause,
            native_resume,
            native_stop,
            native_seek,
            native_scrub_hold,
            native_scrub_cancel,
            native_set_volume,
            native_set_repeat_one,
            native_set_fade_config,
            native_get_state,
            logger::get_recent_logs,
            logger::client_log,
            logger::save_logs_snapshot,
            logger::open_logs_folder,
            export_playlist_to_m3u8,
            import_playlist_from_m3u8,
            parse_m3u8_file,
            get_portable_music_path,
            pick_folder_dialog,
            find_relocated_tracks_in_folder,
            delete_files_from_disk
        ])
        .run(tauri::generate_context!())
        .expect("error while running Arachnid application");
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ThemePaletteItem {
    pub id: String,
    pub label: String,
    #[serde(rename = "cssVar", alias = "css_var")]
    pub css_var: String,
    #[serde(default, alias = "default_color")]
    pub default: String,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ThemeToggleItem {
    pub id: String,
    pub label: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(rename = "cssClass", alias = "css_class", default)]
    pub css_class: Option<String>,
    #[serde(rename = "cssVar", alias = "css_var", default)]
    pub css_var: Option<String>,
    #[serde(default, alias = "default_value")]
    pub default: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CustomThemeInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub author: Option<String>,
    #[serde(default)]
    pub version: Option<String>,
    pub is_folder: bool,
    #[serde(default)]
    pub folder_name: Option<String>,
    #[serde(default)]
    pub folder_path: Option<String>,
    pub css_filename: String,
    #[serde(default)]
    pub palette: Vec<ThemePaletteItem>,
    #[serde(default)]
    pub toggles: Vec<ThemeToggleItem>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ThemeContent {
    pub css: String,
    #[serde(default)]
    pub base_path: Option<String>,
}

#[derive(Deserialize, Debug, Default)]
struct ThemeManifest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub author: Option<String>,
    pub version: Option<String>,
    pub css: Option<String>,
    #[serde(default)]
    pub palette: Vec<ThemePaletteItem>,
    #[serde(default)]
    pub toggles: Vec<ThemeToggleItem>,
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
        std::process::Command::new("explorer")
            .arg(&target)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = std::process::Command::new("xdg-open").arg(&target).spawn();
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
        let _ = std::process::Command::new("xdg-open").arg(&url).spawn();
    }
    Ok(())
}

#[tauri::command]
fn list_custom_themes() -> Result<Vec<CustomThemeInfo>, String> {
    let base_dir = storage::get_portable_base_dir();
    let themes_dir = base_dir.join("themes");
    let mut list = Vec::new();

    if let Ok(entries) = std::fs::read_dir(&themes_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                // Folder theme: check for theme.json or theme.css / style.css
                let folder_name = entry.file_name().to_string_lossy().to_string();
                let manifest_path = path.join("theme.json");
                let mut manifest = ThemeManifest::default();
                let mut has_manifest = false;

                if manifest_path.is_file() {
                    if let Ok(content) = std::fs::read_to_string(&manifest_path) {
                        if let Ok(parsed) = serde_json::from_str::<ThemeManifest>(&content) {
                            manifest = parsed;
                            has_manifest = true;
                        }
                    }
                }

                let css_candidate = manifest.css.clone().unwrap_or_else(|| "theme.css".to_string());
                let css_path = path.join(&css_candidate);
                let fallback_css_path = path.join("style.css");

                let final_css_filename = if css_path.is_file() {
                    css_candidate
                } else if fallback_css_path.is_file() {
                    "style.css".to_string()
                } else if has_manifest {
                    css_candidate
                } else {
                    // Not a theme directory
                    continue;
                };

                let name = manifest.name.unwrap_or_else(|| {
                    folder_name.replace('-', " ").replace('_', " ")
                });

                let description = manifest.description.unwrap_or_else(|| {
                    "Пользовательская тема оформления".to_string()
                });

                list.push(CustomThemeInfo {
                    id: format!("folder:{}", folder_name),
                    name,
                    description,
                    author: manifest.author,
                    version: manifest.version,
                    is_folder: true,
                    folder_name: Some(folder_name),
                    folder_path: Some(path.to_string_lossy().to_string()),
                    css_filename: final_css_filename,
                    palette: manifest.palette,
                    toggles: manifest.toggles,
                });
            } else if path.is_file() {
                // Standalone .css file
                if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    if ext.eq_ignore_ascii_case("css") {
                        let filename = entry.file_name().to_string_lossy().to_string();
                        let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or(&filename);
                        let friendly_name = stem.replace('-', " ").replace('_', " ");
                        let capitalized_name = {
                            let mut chars = friendly_name.chars();
                            match chars.next() {
                                None => String::new(),
                                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
                            }
                        };

                        list.push(CustomThemeInfo {
                            id: format!("file:{}", filename),
                            name: capitalized_name,
                            description: format!("CSS-файл темы ({})", filename),
                            author: None,
                            version: None,
                            is_folder: false,
                            folder_name: None,
                            folder_path: None,
                            css_filename: filename,
                            palette: Vec::new(),
                            toggles: Vec::new(),
                        });
                    }
                }
            }
        }
    }

    // Sort alphabetically by theme name
    list.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(list)
}

#[tauri::command]
fn read_custom_theme(theme_id: String) -> Result<ThemeContent, String> {
    let base_dir = storage::get_portable_base_dir();
    let themes_dir = base_dir.join("themes");

    // Prevent directory traversal
    if theme_id.contains("..") {
        return Err("Invalid theme identifier".to_string());
    }

    if let Some(folder_name) = theme_id.strip_prefix("folder:") {
        let folder_path = themes_dir.join(folder_name);
        if !folder_path.is_dir() {
            return Err("Theme folder not found".to_string());
        }

        let manifest_path = folder_path.join("theme.json");
        let mut css_rel = "theme.css".to_string();
        if manifest_path.is_file() {
            if let Ok(content) = std::fs::read_to_string(&manifest_path) {
                if let Ok(manifest) = serde_json::from_str::<ThemeManifest>(&content) {
                    if let Some(css) = manifest.css {
                        css_rel = css;
                    }
                }
            }
        }

        let mut css_file = folder_path.join(&css_rel);
        if !css_file.is_file() {
            css_file = folder_path.join("style.css");
        }
        if !css_file.is_file() {
            css_file = folder_path.join("theme.css");
        }

        if css_file.is_file() {
            let css_text = std::fs::read_to_string(&css_file)
                .map_err(|e| format!("Failed to read theme CSS: {}", e))?;
            Ok(ThemeContent {
                css: css_text,
                base_path: Some(folder_path.to_string_lossy().to_string()),
            })
        } else {
            Err("CSS file not found in theme folder".to_string())
        }
    } else {
        // File theme or direct filename
        let clean_name = theme_id.strip_prefix("file:").unwrap_or(&theme_id);
        let safe_filename = Path::new(clean_name)
            .file_name()
            .and_then(|f| f.to_str())
            .ok_or_else(|| "Invalid filename".to_string())?;

        // Also check if safe_filename is actually a folder directly in themes_dir
        let candidate_dir = themes_dir.join(safe_filename);
        if candidate_dir.is_dir() {
            return read_custom_theme(format!("folder:{}", safe_filename));
        }

        let file_path = themes_dir.join(safe_filename);
        if file_path.is_file() {
            let css_text = std::fs::read_to_string(&file_path)
                .map_err(|e| format!("Failed to read theme file: {}", e))?;
            Ok(ThemeContent {
                css: css_text,
                base_path: None,
            })
        } else {
            Err("Theme file not found".to_string())
        }
    }
}

#[tauri::command]
fn delete_custom_theme(theme_id: String) -> Result<(), String> {
    if theme_id == "default" {
        return Err("Cannot delete standard theme".to_string());
    }
    if theme_id.contains("..") {
        return Err("Invalid theme identifier".to_string());
    }

    let base_dir = storage::get_portable_base_dir();
    let themes_dir = base_dir.join("themes");

    if let Some(folder_name) = theme_id.strip_prefix("folder:") {
        let safe_folder = Path::new(folder_name)
            .file_name()
            .and_then(|f| f.to_str())
            .ok_or_else(|| "Invalid folder name".to_string())?;
        let target = themes_dir.join(safe_folder);
        if target.is_dir() {
            std::fs::remove_dir_all(&target)
                .map_err(|e| format!("Failed to delete theme folder: {}", e))?;
            return Ok(());
        }
    } else {
        let clean_name = theme_id.strip_prefix("file:").unwrap_or(&theme_id);
        let safe_name = Path::new(clean_name)
            .file_name()
            .and_then(|f| f.to_str())
            .ok_or_else(|| "Invalid filename".to_string())?;

        let target_dir = themes_dir.join(safe_name);
        if target_dir.is_dir() {
            std::fs::remove_dir_all(&target_dir)
                .map_err(|e| format!("Failed to delete theme directory: {}", e))?;
            return Ok(());
        }

        let target_file = themes_dir.join(safe_name);
        if target_file.is_file() {
            std::fs::remove_file(&target_file)
                .map_err(|e| format!("Failed to delete theme file: {}", e))?;
            return Ok(());
        }
    }

    Err("Theme not found".to_string())
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

#[tauri::command]
fn native_play(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    path: String,
    offset_secs: Option<f64>,
    volume: Option<f32>,
    duration_hint: Option<f64>,
    repeat_one: Option<bool>,
    fade_out_previous: Option<bool>,
) -> Result<(), String> {
    state.player.set_app_handle(app);
    state.player.play(
        path,
        offset_secs.unwrap_or(0.0),
        volume.unwrap_or(1.0),
        duration_hint,
        repeat_one,
        fade_out_previous.unwrap_or(true),
    )
}

#[tauri::command]
fn native_pause(state: tauri::State<'_, AppState>) -> Result<(), String> {
    state.player.pause()
}

#[tauri::command]
fn native_resume(state: tauri::State<'_, AppState>) -> Result<(), String> {
    state.player.resume()
}

#[tauri::command]
fn native_stop(
    state: tauri::State<'_, AppState>,
    fade_out: Option<bool>,
) -> Result<(), String> {
    state.player.stop(fade_out.unwrap_or(false))
}

#[tauri::command]
fn native_seek(state: tauri::State<'_, AppState>, seconds: f64) -> Result<(), String> {
    state.player.seek(seconds)
}

#[tauri::command]
fn native_scrub_hold(state: tauri::State<'_, AppState>) -> Result<(), String> {
    state.player.scrub_hold()
}

#[tauri::command]
fn native_scrub_cancel(state: tauri::State<'_, AppState>) -> Result<(), String> {
    state.player.scrub_cancel()
}

#[tauri::command]
fn native_set_volume(state: tauri::State<'_, AppState>, volume: f32) -> Result<(), String> {
    state.player.set_volume(volume)
}

#[tauri::command]
fn native_set_repeat_one(state: tauri::State<'_, AppState>, repeat_one: bool) -> Result<(), String> {
    state.player.set_repeat_one(repeat_one)
}

#[tauri::command]
fn native_set_fade_config(state: tauri::State<'_, AppState>, mode: String, duration_secs: f64) -> Result<(), String> {
    state.player.set_fade_config(mode, duration_secs)
}

#[tauri::command]
fn native_get_state(state: tauri::State<'_, AppState>) -> player::NativePlayerState {
    state.player.get_state()
}

