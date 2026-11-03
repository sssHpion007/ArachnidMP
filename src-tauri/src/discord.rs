use std::fs::OpenOptions;
use std::io::{Read, Write};
use std::collections::HashMap;
use std::sync::mpsc::{channel, sync_channel, Sender, SyncSender, TrySendError};
use std::thread;
use std::time::{Duration, Instant};
use base64::prelude::*;
use serde_json::json;
use sha2::{Digest, Sha256};

#[derive(Debug, Clone)]
pub struct ActivityData {
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

enum DiscordMessage {
    Presence(ActivityData),
    CoverUploaded { hash: String, url: Option<String> },
}

pub struct DiscordService {
    sender: Sender<DiscordMessage>,
}

#[cfg(windows)]
type IpcStream = std::fs::File;

#[cfg(not(windows))]
type IpcStream = std::os::unix::net::UnixStream;

fn send_packet(stream: &mut IpcStream, op: u32, payload: &str) -> std::io::Result<()> {
    let bytes = payload.as_bytes();
    let len = bytes.len() as u32;
    let mut packet = Vec::with_capacity(8 + bytes.len());
    packet.extend_from_slice(&op.to_le_bytes());
    packet.extend_from_slice(&len.to_le_bytes());
    packet.extend_from_slice(bytes);
    stream.write_all(&packet)?;
    stream.flush()
}

fn read_packet(stream: &mut IpcStream) -> std::io::Result<(u32, String)> {
    let mut header = [0u8; 8];
    stream.read_exact(&mut header)?;
    let op = u32::from_le_bytes([header[0], header[1], header[2], header[3]]);
    let len = u32::from_le_bytes([header[4], header[5], header[6], header[7]]) as usize;
    if len > 65536 {
        return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "Packet too large"));
    }
    let mut body = vec![0u8; len];
    stream.read_exact(&mut body)?;
    let s = String::from_utf8(body).unwrap_or_default();
    Ok((op, s))
}

fn log_rpc_error_event(tag: &str, payload: &str) {
    let Ok(response) = serde_json::from_str::<serde_json::Value>(payload) else { return };
    if response.get("evt").and_then(serde_json::Value::as_str) != Some("ERROR") { return; }
    let data = response.get("data").unwrap_or(&serde_json::Value::Null);
    let code = data.get("code").and_then(serde_json::Value::as_i64)
        .map(|value| value.to_string()).unwrap_or_else(|| "unknown".to_string());
    let message = data.get("message").and_then(serde_json::Value::as_str).unwrap_or("unknown error");
    crate::logger::log("WARN", tag, &format!("Discord RPC rejected activity: code={code}, message={message}"));
}

#[cfg(windows)]
fn open_pipe(index: u8) -> std::io::Result<IpcStream> {
    let pipe_name = format!(r"\\.\pipe\discord-ipc-{}", index);
    OpenOptions::new().read(true).write(true).open(&pipe_name)
}

#[cfg(not(windows))]
fn open_pipe(index: u8) -> std::io::Result<IpcStream> {
    let xdg = std::env::var("XDG_RUNTIME_DIR")
        .or_else(|_| std::env::var("TMPDIR"))
        .unwrap_or_else(|_| "/tmp".to_string());
    let path = format!("{}/discord-ipc-{}", xdg, index);
    std::os::unix::net::UnixStream::connect(path)
}

fn try_connect_client(client_id: &str) -> Option<IpcStream> {
    for i in 0..10 {
        if let Ok(mut stream) = open_pipe(i) {
            let handshake = json!({
                "v": 1,
                "client_id": client_id
            }).to_string();

            if send_packet(&mut stream, 0, &handshake).is_ok() {
                if let Ok((op, resp)) = read_packet(&mut stream) {
                    if op == 1 || op == 0 {
                        return Some(stream);
                    } else if op == 2 {
                        eprintln!("[Discord RPC] Rejected client_id {}: {}", client_id, resp);
                        continue;
                    }
                }
            }
        }
    }
    None
}

fn establish_connection(preferred_client_id: &str) -> Option<(IpcStream, String)> {
    let fallback_ids = [
        preferred_client_id,
        "1129859263741837373", // Registered Discord Music Application
        "1304561842858561637", // Arachnid Application ID
    ];

    for &cid in &fallback_ids {
        if cid.trim().is_empty() {
            continue;
        }
        if let Some(stream) = try_connect_client(cid) {
            return Some((stream, cid.to_string()));
        }
    }
    None
}

fn sanitize_discord_string(s: &str) -> String {
    let trimmed = s.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    let chars: Vec<char> = trimmed.chars().take(128).collect();
    let mut result: String = chars.into_iter().collect();
    if result.len() == 1 {
        result.push('\u{200b}');
    }
    result
}

fn response_excerpt(body: &str) -> String {
    body.chars()
        .take(240)
        .map(|character| if character.is_control() { ' ' } else { character })
        .collect()
}

fn log_upload_error(host: &str, error: ureq::Error) {
    match error {
        ureq::Error::Status(status, response) => {
            let body = response.into_string().unwrap_or_default();
            crate::logger::log(
                "WARN",
                "DISCORD_COVER",
                &format!("{host} rejected cover upload: HTTP {status}; response={}", response_excerpt(&body)),
            );
        }
        ureq::Error::Transport(error) => crate::logger::log(
            "WARN",
            "DISCORD_COVER",
            &format!("{host} cover upload transport error: {error}"),
        ),
    }
}

/**
 * 1. Russian domestic image host (ultra-fast for RU users, zero blocks, no API key)
 */
fn upload_to_img24(image_bytes: &[u8]) -> Option<String> {
    let boundary = "----ArachnidCoverUpload7MA4YWxk";
    let mut body = Vec::with_capacity(image_bytes.len() + 256);
    body.extend_from_slice(format!("--{}\r\n", boundary).as_bytes());
    body.extend_from_slice(b"Content-Disposition: form-data; name=\"inputfile\"; filename=\"cover.jpg\"\r\n");
    body.extend_from_slice(b"Content-Type: image/jpeg\r\n\r\n");
    body.extend_from_slice(image_bytes);
    body.extend_from_slice(format!("\r\n--{}--\r\n", boundary).as_bytes());

    let response = match ureq::post("https://i-mg24.ru/")
        .set("Content-Type", &format!("multipart/form-data; boundary={}", boundary))
        .set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
        .timeout(Duration::from_secs(8))
        .send_bytes(&body)
    {
        Ok(response) => response,
        Err(error) => {
            log_upload_error("i-mg24", error);
            return None;
        }
    };
    let status = response.status();
    let html = match response.into_string() {
        Ok(body) => body,
        Err(error) => {
            crate::logger::log("WARN", "DISCORD_COVER", &format!("i-mg24 returned unreadable response: {error}"));
            return None;
        }
    };
    if let Some(pos) = html.find("https://i-mg24.ru/images/") {
        let tail = &html[pos..];
        if let Some(end_pos) = tail.find('"') {
            let url = &tail[..end_pos];
            if !url.is_empty() { return Some(url.to_string()); }
        }
    }
    crate::logger::log(
        "WARN",
        "DISCORD_COVER",
        &format!("i-mg24 returned HTTP {status} but no recognized image URL; response={}", response_excerpt(&html)),
    );
    None
}

/**
 * Persistent public image host used when the regional host is unavailable.
 */
fn upload_to_catbox(image_bytes: &[u8]) -> Option<String> {
    let boundary = "----ArachnidCoverUpload7MA4YWxk";
    let mut body = Vec::with_capacity(image_bytes.len() + 384);
    body.extend_from_slice(format!("--{}\r\n", boundary).as_bytes());
    body.extend_from_slice(b"Content-Disposition: form-data; name=\"reqtype\"\r\n\r\nfileupload\r\n");
    body.extend_from_slice(format!("--{}\r\n", boundary).as_bytes());
    body.extend_from_slice(b"Content-Disposition: form-data; name=\"fileToUpload\"; filename=\"cover.jpg\"\r\n");
    body.extend_from_slice(b"Content-Type: image/jpeg\r\n\r\n");
    body.extend_from_slice(image_bytes);
    body.extend_from_slice(format!("\r\n--{}--\r\n", boundary).as_bytes());

    let response = match ureq::post("https://catbox.moe/user/api.php")
        .set("Content-Type", &format!("multipart/form-data; boundary={}", boundary))
        .set("User-Agent", "ArachnidMusicPlayer/0.4")
        .timeout(Duration::from_secs(12))
        .send_bytes(&body)
    {
        Ok(response) => response,
        Err(error) => {
            log_upload_error("Catbox", error);
            return None;
        }
    };
    let status = response.status();
    let body = match response.into_string() {
        Ok(body) => body,
        Err(error) => {
            crate::logger::log("WARN", "DISCORD_COVER", &format!("Catbox returned unreadable response: {error}"));
            return None;
        }
    };
    let url = body.trim();
    if url.starts_with("https://files.catbox.moe/") { return Some(url.to_string()); }
    crate::logger::log(
        "WARN",
        "DISCORD_COVER",
        &format!("Catbox returned HTTP {status} but no recognized file URL; response={}", response_excerpt(&body)),
    );
    None
}

/**
 * International fast temporary host (Pomf / Uguu).
 */
fn upload_to_uguu(image_bytes: &[u8]) -> Option<String> {
    let boundary = "----ArachnidCoverUpload7MA4YWxk";
    let mut body = Vec::with_capacity(image_bytes.len() + 256);
    body.extend_from_slice(format!("--{}\r\n", boundary).as_bytes());
    body.extend_from_slice(b"Content-Disposition: form-data; name=\"files[]\"; filename=\"cover.jpg\"\r\n");
    body.extend_from_slice(b"Content-Type: image/jpeg\r\n\r\n");
    body.extend_from_slice(image_bytes);
    body.extend_from_slice(format!("\r\n--{}--\r\n", boundary).as_bytes());

    let response = match ureq::post("https://uguu.se/upload")
        .set("Content-Type", &format!("multipart/form-data; boundary={}", boundary))
        .set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
        .timeout(Duration::from_secs(8))
        .send_bytes(&body)
    {
        Ok(response) => response,
        Err(error) => {
            log_upload_error("Uguu", error);
            return None;
        }
    };
    let status = response.status();
    let response_body = match response.into_string() {
        Ok(body) => body,
        Err(error) => {
            crate::logger::log("WARN", "DISCORD_COVER", &format!("Uguu returned unreadable response: {error}"));
            return None;
        }
    };
    if let Ok(json_value) = serde_json::from_str::<serde_json::Value>(&response_body) {
        if let Some(url) = json_value.pointer("/files/0/url").and_then(|value| value.as_str()) {
            if !url.is_empty() { return Some(url.to_string()); }
        }
    }
    crate::logger::log(
        "WARN",
        "DISCORD_COVER",
        &format!("Uguu returned HTTP {status} without a recognized file URL; response={}", response_excerpt(&response_body)),
    );
    None
}

fn upload_raw_cover(image_bytes: &[u8]) -> Option<String> {
    if let Some(url) = upload_to_img24(image_bytes) {
        crate::logger::log("INFO", "DISCORD_COVER", "Cover uploaded through i-mg24.");
        return Some(url);
    }
    if let Some(url) = upload_to_uguu(image_bytes) {
        crate::logger::log("INFO", "DISCORD_COVER", "Cover uploaded through Uguu.");
        return Some(url);
    }
    if let Some(url) = upload_to_catbox(image_bytes) {
        crate::logger::log("INFO", "DISCORD_COVER", "Cover uploaded through Catbox fallback.");
        return Some(url);
    }
    None
}

fn decode_cover_data_uri(value: &str) -> Option<(String, Vec<u8>)> {
    let value = value.trim();
    let encoded = value.strip_prefix("data:")?.split_once(";base64,")?.1;
    let compact: String = encoded.chars().filter(|character| !character.is_whitespace()).collect();
    let bytes = BASE64_STANDARD.decode(compact.as_bytes()).ok()?;
    let hash = format!("{:x}", Sha256::digest(&bytes));
    Some((hash, bytes))
}

fn build_activity(latest: &ActivityData, large_image: &str) -> serde_json::Value {
    let listening_only = latest.status_mode.as_deref() == Some("listening");
    let mut activity = json!({
        "type": 2,
        "name": if listening_only { "\u{200b}" } else { "ArachnidMP" },
        "details": sanitize_discord_string(&latest.details),
        "state": sanitize_discord_string(&latest.state),
        "status_display_type": 2,
    });
    let mut assets = json!({ "large_image": large_image });

    if let Some(text) = &latest.large_text {
        let clean = sanitize_discord_string(text);
        if !clean.is_empty() { assets["large_text"] = json!(clean); }
    }
    if let Some(image) = &latest.small_image {
        let image = image.trim();
        if !image.is_empty() { assets["small_image"] = json!(image); }
    }
    if let Some(text) = &latest.small_text {
        let clean = sanitize_discord_string(text);
        if !clean.is_empty() { assets["small_text"] = json!(clean); }
    }
    activity["assets"] = assets;

    if let Some(start) = latest.start_timestamp {
        let mut timestamps = json!({ "start": start });
        if let Some(end) = latest.end_timestamp { timestamps["end"] = json!(end); }
        activity["timestamps"] = timestamps;
        activity["party"] = json!({
            "id": format!("arachnid_play_{}_{}", sanitize_discord_string(&latest.details), start)
        });
    } else if let Some(end) = latest.end_timestamp {
        activity["timestamps"] = json!({ "end": end });
    }
    activity
}

fn send_activity(stream: &mut IpcStream, activity: &serde_json::Value, nonce: &mut u64) -> std::io::Result<()> {
    *nonce += 1;
    let packet = json!({
        "cmd": "SET_ACTIVITY",
        "args": { "pid": std::process::id(), "activity": activity },
        "nonce": format!("arachnid_act_{}", nonce),
    }).to_string();
    send_packet(stream, 1, &packet)?;
    let (_, response) = read_packet(stream)?;
    log_rpc_error_event("DISCORD_RPC", &response);
    Ok(())
}

impl DiscordService {
    pub fn new() -> Self {
        let (tx, rx) = channel::<DiscordMessage>();
        let (upload_tx, upload_rx) = sync_channel::<(String, Vec<u8>)>(2);
        let upload_result_tx = tx.clone();

        // Network uploads run independently from the Discord IPC worker. A slow image
        // host must never delay the activity/timestamps or block later pause/track updates.
        thread::spawn(move || {
            while let Ok((hash, bytes)) = upload_rx.recv() {
                let url = upload_raw_cover(&bytes);
                if upload_result_tx.send(DiscordMessage::CoverUploaded { hash, url }).is_err() {
                    break;
                }
            }
        });

        thread::spawn(move || {
            let mut active_stream: Option<IpcStream> = None;
            let mut active_client_id = String::new();
            let mut nonce = 0u64;
            let mut cover_cache: HashMap<String, String> = HashMap::new();
            let mut pending_uploads = std::collections::HashSet::new();
            let mut retry_after: HashMap<String, Instant> = HashMap::new();
            let mut latest_presence: Option<ActivityData> = None;
            let mut last_had_timestamps = false;
            let mut last_had_small_image = false;

            while let Ok(message) = rx.recv() {
                let mut should_publish = false;
                match message {
                    DiscordMessage::Presence(presence) => {
                        latest_presence = Some(presence);
                        should_publish = true;
                    }
                    DiscordMessage::CoverUploaded { hash, url } => {
                        pending_uploads.remove(&hash);
                        if let Some(url) = url {
                            if cover_cache.len() >= 256 {
                                if let Some(oldest) = cover_cache.keys().next().cloned() {
                                    cover_cache.remove(&oldest);
                                }
                            }
                            cover_cache.insert(hash.clone(), url);
                            should_publish = latest_presence.as_ref().is_some_and(|presence| {
                                presence.enabled
                                    && presence.large_image.as_deref()
                                        .and_then(decode_cover_data_uri)
                                        .is_some_and(|(current_hash, _)| current_hash == hash)
                            });
                        } else {
                            let now = Instant::now();
                            if retry_after.len() >= 128 {
                                retry_after.retain(|_, retry_at| *retry_at > now);
                            }
                            if retry_after.len() >= 128 {
                                if let Some(oldest) = retry_after.keys().next().cloned() {
                                    retry_after.remove(&oldest);
                                }
                            }
                            retry_after.insert(hash, now + Duration::from_secs(60));
                            crate::logger::log(
                                "WARN",
                                "DISCORD_COVER",
                                "All configured cover hosts failed; the Discord activity was already sent without album artwork.",
                            );
                        }
                    }
                }
                if !should_publish {
                    continue;
                }

                let Some(latest) = latest_presence.as_ref() else { continue };
                nonce += 1;

                if !latest.enabled {
                    if let Some(stream) = &mut active_stream {
                        let clear_activity = json!({
                            "cmd": "SET_ACTIVITY",
                            "args": { "pid": std::process::id(), "activity": null },
                            "nonce": format!("arachnid_clr_{}", nonce)
                        }).to_string();
                        if send_packet(stream, 1, &clear_activity).is_err() || read_packet(stream).is_err() {
                            active_stream = None;
                        }
                    }
                    last_had_timestamps = false;
                    last_had_small_image = false;
                    continue;
                }

                let desired_client_id = latest.client_id.as_deref().unwrap_or("1129859263741837373");
                if !active_client_id.is_empty() && active_client_id != desired_client_id {
                    active_stream = None;
                }
                if active_stream.is_none() {
                    if let Some((stream, connected_id)) = establish_connection(desired_client_id) {
                        active_stream = Some(stream);
                        active_client_id = connected_id;
                        last_had_timestamps = false;
                        last_had_small_image = false;
                    }
                }
                let Some(stream) = active_stream.as_mut() else { continue };

                let has_timestamps = latest.start_timestamp.is_some() || latest.end_timestamp.is_some();
                let has_small_image = latest.small_image.as_ref().is_some_and(|image| !image.trim().is_empty());
                let should_clear = (last_had_timestamps && !has_timestamps)
                    || (last_had_small_image && !has_small_image);
                if should_clear {
                    nonce += 1;
                    let clear_packet = json!({
                        "cmd": "SET_ACTIVITY",
                        "args": { "pid": std::process::id(), "activity": null },
                        "nonce": format!("arachnid_clr_{}", nonce)
                    }).to_string();
                    if send_packet(stream, 1, &clear_packet).is_err() || read_packet(stream).is_err() {
                        active_stream = None;
                        continue;
                    }
                }

                let mut pending_cover: Option<(String, Vec<u8>)> = None;
                let large_image = match latest.large_image.as_deref().map(str::trim) {
                    Some(value) if value.starts_with("data:") => {
                        match decode_cover_data_uri(value) {
                            Some((hash, bytes)) => {
                                if let Some(url) = cover_cache.get(&hash) {
                                    url.clone()
                                } else {
                                    pending_cover = Some((hash, bytes));
                                    "https://raw.githubusercontent.com/sssHpion007/ArachnidMP/main/public/app-logo.png".to_string()
                                }
                            }
                            None => {
                                crate::logger::log("WARN", "DISCORD_COVER", "Invalid cover data URI; publishing presence without album artwork.");
                                "https://raw.githubusercontent.com/sssHpion007/ArachnidMP/main/public/app-logo.png".to_string()
                            }
                        }
                    }
                    Some(value) if !value.is_empty() => value.to_string(),
                    _ => "https://raw.githubusercontent.com/sssHpion007/ArachnidMP/main/public/app-logo.png".to_string(),
                };

                let activity = build_activity(latest, &large_image);
                if let Err(error) = send_activity(stream, &activity, &mut nonce) {
                    crate::logger::log("WARN", "DISCORD_RPC", &format!("Could not publish activity: {error}"));
                    active_stream = None;
                    continue;
                }
                last_had_timestamps = has_timestamps;
                last_had_small_image = has_small_image;

                // Queue the cover only after presence has been published. Retry identical
                // failed bytes at most once per minute instead of serially delaying RPC updates.
                if let Some((hash, bytes)) = pending_cover {
                    if pending_uploads.contains(&hash) {
                        continue;
                    }
                    let now = Instant::now();
                    if retry_after.get(&hash).is_some_and(|retry_at| *retry_at > now) {
                        continue;
                    }
                    retry_after.remove(&hash);
                    match upload_tx.try_send((hash.clone(), bytes)) {
                        Ok(()) => { pending_uploads.insert(hash); }
                        Err(TrySendError::Full(_)) => {
                            retry_after.insert(hash, now + Duration::from_secs(60));
                            crate::logger::log("WARN", "DISCORD_COVER", "Cover upload queue is full; presence was published and this image will be retried later.");
                        }
                        Err(TrySendError::Disconnected(_)) => {
                            crate::logger::log("ERROR", "DISCORD_COVER", "Cover upload worker is unavailable.");
                        }
                    }
                }
            }
        });

        Self { sender: tx }
    }

    pub fn update(&self, data: ActivityData) {
        let _ = self.sender.send(DiscordMessage::Presence(data));
    }
}

#[cfg(test)]
mod tests {
    use super::{build_activity, decode_cover_data_uri, ActivityData};
    use serde_json::json;
    use sha2::Digest;

    #[test]
    fn image_hash_is_based_on_decoded_bytes() {
        let (hash, bytes) = decode_cover_data_uri("data:image/jpeg;base64,AQID").unwrap();
        assert_eq!(bytes, [1u8, 2, 3]);
        assert_eq!(hash, format!("{:x}", sha2::Sha256::digest([1u8, 2, 3])));
    }

    #[test]
    fn placeholder_and_uploaded_activity_keep_the_same_timeline() {
        let presence = ActivityData {
            enabled: true,
            details: "Track".to_string(),
            state: "Artist".to_string(),
            large_image: Some("data:image/jpeg;base64,AQID".to_string()),
            large_text: Some("Album".to_string()),
            small_image: None,
            small_text: None,
            start_timestamp: Some(1_800_000_000),
            end_timestamp: Some(1_800_000_240),
            status_display_type: Some(2),
            client_id: None,
            status_mode: Some("listening_app".to_string()),
        };

        let placeholder = build_activity(&presence, "player-icon");
        let uploaded = build_activity(&presence, "https://files.example/cover.jpg");
        for activity in [&placeholder, &uploaded] {
            assert_eq!(activity["timestamps"]["start"], json!(1_800_000_000i64));
            assert_eq!(activity["timestamps"]["end"], json!(1_800_000_240i64));
            assert_eq!(activity["details"], "Track");
        }
        assert_eq!(placeholder["assets"]["large_image"], "player-icon");
        assert_eq!(uploaded["assets"]["large_image"], "https://files.example/cover.jpg");
    }
}
