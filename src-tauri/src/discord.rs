#[cfg(windows)]
use std::fs::OpenOptions;
use std::io::{Read, Write};
use std::collections::HashMap;
use std::sync::mpsc::{channel, sync_channel, Sender, TrySendError};
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
    pub cover_host: Option<String>,
    /// Cached artwork was requested before its SQLite thumbnail was available.
    pub pending_cover_hash: Option<String>,
}

enum DiscordMessage {
    Presence(ActivityData),
    CoverUploaded { hash: String, host: String, url: Option<String> },
    CachedCoverReady { hash: String, data_uri: String },
}

#[derive(Clone)]
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

fn read_rpc_response(stream: &mut IpcStream, expected_nonce: &str) -> std::io::Result<String> {
    loop {
        let (opcode, payload) = read_packet(stream)?;
        match opcode {
            1 => {
                let Ok(response) = serde_json::from_str::<serde_json::Value>(&payload) else { continue };
                if response.get("nonce").and_then(serde_json::Value::as_str) == Some(expected_nonce) {
                    return Ok(payload);
                }
                // Dispatch events are not acknowledgements for the command currently in flight.
            }
            2 => return Err(std::io::Error::new(std::io::ErrorKind::ConnectionReset, "Discord RPC closed the connection")),
            3 => send_packet(stream, 4, &payload)?,
            4 => {}
            _ => {}
        }
    }
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

fn imgdb_direct_url(response_body: &str) -> Option<String> {
    let response: serde_json::Value = serde_json::from_str(response_body).ok()?;
    let url = response.get("url")?.as_str()?.trim();
    url.starts_with("https://imgdb.io/i/").then(|| url.to_string())
}

/**
 * Public API image-host fallback. ImgDB accepts multipart field `file` and
 * returns a direct image URL in JSON; ttl=0 requests a non-expiring link.
 */
fn upload_to_imgdb(image_bytes: &[u8]) -> Option<String> {
    let boundary = "----ArachnidCoverUpload7MA4YWxk";
    let mut body = Vec::with_capacity(image_bytes.len() + 256);
    body.extend_from_slice(format!("--{}\r\n", boundary).as_bytes());
    body.extend_from_slice(b"Content-Disposition: form-data; name=\"file\"; filename=\"cover.jpg\"\r\n");
    body.extend_from_slice(b"Content-Type: image/jpeg\r\n\r\n");
    body.extend_from_slice(image_bytes);
    body.extend_from_slice(format!("\r\n--{}--\r\n", boundary).as_bytes());

    let response = match ureq::post("https://imgdb.io/api/v1/upload")
        .query("ttl", "0")
        .set("Content-Type", &format!("multipart/form-data; boundary={}", boundary))
        .set("Accept", "application/json")
        .set("User-Agent", "ArachnidMusicPlayer/0.4")
        .timeout(Duration::from_secs(10))
        .send_bytes(&body)
    {
        Ok(response) => response,
        Err(error) => {
            log_upload_error("ImgDB", error);
            return None;
        }
    };
    let status = response.status();
    let response_body = match response.into_string() {
        Ok(body) => body,
        Err(error) => {
            crate::logger::log("WARN", "DISCORD_COVER", &format!("ImgDB returned unreadable response: {error}"));
            return None;
        }
    };
    if let Some(url) = imgdb_direct_url(&response_body) {
        return Some(url);
    }
    crate::logger::log(
        "WARN",
        "DISCORD_COVER",
        &format!("ImgDB returned HTTP {status} without a recognized direct image URL; response={}", response_excerpt(&response_body)),
    );
    None
}

type CoverUploader = fn(&[u8]) -> Option<String>;

const COVER_RETRY_BACKOFF: Duration = Duration::from_secs(60);
const RPC_RETRY_INITIAL: Duration = Duration::from_secs(1);
const RPC_RETRY_MAX: Duration = Duration::from_secs(30);

const COVER_UPLOADERS: [(&str, &str, CoverUploader); 4] = [
    ("img24", "i-mg24", upload_to_img24),
    ("uguu", "Uguu", upload_to_uguu),
    ("catbox", "Catbox", upload_to_catbox),
    ("imgdb", "ImgDB", upload_to_imgdb),
];

fn normalize_cover_host(value: Option<&str>) -> &'static str {
    match value {
        Some("img24") => "img24",
        Some("uguu") => "uguu",
        Some("catbox") => "catbox",
        Some("imgdb") => "imgdb",
        _ => "auto",
    }
}

fn next_cover_retry_deadline(
    enabled: bool,
    retry_after: &HashMap<(String, String), Instant>,
) -> Option<Instant> {
    enabled.then(|| retry_after.values().copied().min()).flatten()
}

fn next_rpc_retry_deadline(
    enabled: bool,
    cover_deadline: Option<Instant>,
    rpc_deadline: Option<Instant>,
) -> Option<Instant> {
    if !enabled { return None; }
    match (cover_deadline, rpc_deadline) {
        (Some(cover), Some(rpc)) => Some(cover.min(rpc)),
        (Some(deadline), None) | (None, Some(deadline)) => Some(deadline),
        (None, None) => None,
    }
}

fn schedule_rpc_retry(rpc_deadline: &mut Option<Instant>, retry_delay: &mut Duration, now: Instant) {
    *rpc_deadline = Some(now + *retry_delay);
    *retry_delay = (*retry_delay).saturating_mul(2).min(RPC_RETRY_MAX);
}

fn clear_expired_cover_retries(retry_after: &mut HashMap<(String, String), Instant>, now: Instant) {
    retry_after.retain(|_, retry_at| *retry_at > now);
}

fn accept_cached_cover(latest: &mut Option<ActivityData>, hash: &str, data_uri: String) -> bool {
    let Some(presence) = latest.as_mut() else { return false };
    if !presence.enabled || presence.pending_cover_hash.as_deref() != Some(hash) {
        return false;
    }
    presence.large_image = Some(data_uri);
    presence.pending_cover_hash = None;
    true
}

fn should_defer_activity_for_cover(
    cover_url_cached: bool,
    upload_pending: bool,
    fallback_published: bool,
) -> bool {
    !cover_url_cached && upload_pending && !fallback_published
}

fn schedule_cover_retry_at(
    retry_after: &mut HashMap<(String, String), Instant>,
    cache_key: (String, String),
    now: Instant,
) {
    if retry_after.len() >= 128 {
        clear_expired_cover_retries(retry_after, now);
    }
    if retry_after.len() >= 128 {
        if let Some(oldest) = retry_after.keys().next().cloned() {
            retry_after.remove(&oldest);
        }
    }
    retry_after.insert(cache_key, now + COVER_RETRY_BACKOFF);
}

fn cover_uploaders(preference: &str) -> Vec<(&'static str, &'static str, CoverUploader)> {
    match preference {
        "img24" => vec![COVER_UPLOADERS[0]],
        "uguu" => vec![COVER_UPLOADERS[1]],
        "catbox" => vec![COVER_UPLOADERS[2]],
        "imgdb" => vec![COVER_UPLOADERS[3]],
        _ => COVER_UPLOADERS.to_vec(),
    }
}

fn upload_raw_cover(image_bytes: &[u8], preference: &str) -> Option<String> {
    for (host_id, host_name, upload) in cover_uploaders(preference) {
        if let Some(url) = upload(image_bytes) {
            crate::logger::log("INFO", "DISCORD_COVER", &format!("Cover uploaded through {host_name}."));
            return Some(url);
        }
        crate::logger::log("INFO", "DISCORD_COVER", &format!("Cover host attempt completed: {host_id}."));
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

fn activity_fingerprint(activity: &serde_json::Value) -> String {
    let details = activity.get("details").and_then(serde_json::Value::as_str).unwrap_or_default();
    let state = activity.get("state").and_then(serde_json::Value::as_str).unwrap_or_default();
    let start = activity.pointer("/timestamps/start").and_then(serde_json::Value::as_i64).unwrap_or_default();
    let end = activity.pointer("/timestamps/end").and_then(serde_json::Value::as_i64).unwrap_or_default();
    let fingerprint = format!("{details}|{state}|{start}|{end}");
    format!("{:x}", Sha256::digest(fingerprint.as_bytes()))[..12].to_string()
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
    let expected_nonce = format!("arachnid_act_{}", nonce);
    let packet = json!({
        "cmd": "SET_ACTIVITY",
        "args": { "pid": std::process::id(), "activity": activity },
        "nonce": expected_nonce.clone(),
    }).to_string();
    send_packet(stream, 1, &packet)?;
    let response = read_rpc_response(stream, &expected_nonce)?;
    log_rpc_error_event("DISCORD_RPC", &response);
    let parsed = serde_json::from_str::<serde_json::Value>(&response).ok();
    if parsed.as_ref().and_then(|value| value.get("evt")).and_then(serde_json::Value::as_str) == Some("ERROR") {
        return Err(std::io::Error::new(std::io::ErrorKind::Other, "Discord rejected SET_ACTIVITY"));
    }
    crate::logger::log(
        "INFO",
        "DISCORD_RPC",
        &format!("Discord acknowledged SET_ACTIVITY nonce={expected_nonce} presence_key={}.", activity_fingerprint(activity)),
    );
    Ok(())
}

impl DiscordService {
    pub fn new() -> Self {
        let (tx, rx) = channel::<DiscordMessage>();
        let (upload_tx, upload_rx) = sync_channel::<(String, String, Vec<u8>)>(2);
        let upload_result_tx = tx.clone();

        // Network uploads run independently from the Discord IPC worker. A slow image
        // host must never delay the activity/timestamps or block later pause/track updates.
        thread::spawn(move || {
            while let Ok((hash, host, bytes)) = upload_rx.recv() {
                let url = upload_raw_cover(&bytes, &host);
                if upload_result_tx.send(DiscordMessage::CoverUploaded { hash, host, url }).is_err() {
                    break;
                }
            }
        });

        thread::spawn(move || {
            let mut active_stream: Option<IpcStream> = None;
            let mut active_client_id = String::new();
            let mut nonce = 0u64;
            let mut cover_cache: HashMap<(String, String), String> = HashMap::new();
            let mut pending_uploads = std::collections::HashSet::new();
            let mut fallback_published: std::collections::HashSet<(String, String)> = std::collections::HashSet::new();
            let mut retry_after: HashMap<(String, String), Instant> = HashMap::new();
            let mut rpc_retry_at: Option<Instant> = None;
            let mut rpc_retry_delay = RPC_RETRY_INITIAL;
            let mut latest_presence: Option<ActivityData> = None;
            let mut force_cover_refresh_pending = false;
            let mut last_had_timestamps = false;
            let mut last_had_small_image = false;

            loop {
                let retry_deadline = next_rpc_retry_deadline(
                    latest_presence.as_ref().is_some_and(|presence| presence.enabled),
                    next_cover_retry_deadline(
                        latest_presence.as_ref().is_some_and(|presence| presence.enabled),
                        &retry_after,
                    ),
                    rpc_retry_at,
                );
                let message = match retry_deadline {
                    Some(deadline) => match rx.recv_timeout(deadline.saturating_duration_since(Instant::now())) {
                        Ok(message) => Some(message),
                        Err(std::sync::mpsc::RecvTimeoutError::Timeout) => None,
                        Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
                    },
                    None => match rx.recv() {
                        Ok(message) => Some(message),
                        Err(_) => break,
                    },
                };

                let retry_timer_fired = message.is_none();
                if retry_timer_fired {
                    let now = Instant::now();
                    clear_expired_cover_retries(&mut retry_after, now);
                    if rpc_retry_at.is_some_and(|deadline| deadline <= now) {
                        rpc_retry_at = None;
                        crate::logger::log("INFO", "DISCORD_RPC", "Connection retry timer expired; republishing the latest presence.");
                    } else {
                        crate::logger::log("INFO", "DISCORD_COVER", "Cover retry timer expired; refreshing the current Discord activity.");
                    }
                }
                let mut should_publish = retry_timer_fired;
                if let Some(message) = message {
                    match message {
                        DiscordMessage::Presence(presence) => {
                            latest_presence = Some(presence);
                            should_publish = true;
                        }
                        DiscordMessage::CachedCoverReady { hash, data_uri } => {
                            should_publish = accept_cached_cover(&mut latest_presence, &hash, data_uri);
                            if should_publish {
                                crate::logger::log("INFO", "DISCORD_COVER", "Artwork cache became ready for the active track; publishing its cover without waiting for another playback event.");
                            } else {
                                crate::logger::log("INFO", "DISCORD_COVER", "Artwork cache became ready after the active track changed; ignoring stale cover.");
                            }
                        }
                        DiscordMessage::CoverUploaded { hash, host, url } => {
                            let cache_key = (hash.clone(), host.clone());
                            pending_uploads.remove(&cache_key);
                            if let Some(url) = url {
                                if cover_cache.len() >= 256 {
                                    if let Some(oldest) = cover_cache.keys().next().cloned() {
                                        cover_cache.remove(&oldest);
                                    }
                                }
                                cover_cache.insert(cache_key.clone(), url);
                                let placeholder_was_published = fallback_published.remove(&cache_key);
                                should_publish = latest_presence.as_ref().is_some_and(|presence| {
                                    presence.enabled
                                        && normalize_cover_host(presence.cover_host.as_deref()) == host.as_str()
                                        && presence.large_image.as_deref()
                                            .and_then(decode_cover_data_uri)
                                            .is_some_and(|(current_hash, _)| current_hash == hash)
                                });
                                if should_publish {
                                    // A normal first upload has not yet created an activity. Send one
                                    // complete packet with the direct URL; only reset if a fallback
                                    // activity was already published after a failed upload.
                                    force_cover_refresh_pending = placeholder_was_published;
                                    crate::logger::log("INFO", "DISCORD_COVER", "Uploaded cover matches the active track; publishing its complete activity.");
                                } else {
                                    crate::logger::log("INFO", "DISCORD_COVER", "Uploaded cover is cached, but the active track or host has changed; skipping stale publish.");
                                }
                            } else {
                                schedule_cover_retry_at(&mut retry_after, cache_key.clone(), Instant::now());
                                should_publish = latest_presence.as_ref().is_some_and(|presence| {
                                    presence.enabled
                                        && normalize_cover_host(presence.cover_host.as_deref()) == host.as_str()
                                        && presence.large_image.as_deref()
                                            .and_then(decode_cover_data_uri)
                                            .is_some_and(|(current_hash, _)| current_hash == hash)
                                });
                                if should_publish {
                                    fallback_published.insert(cache_key);
                                    crate::logger::log(
                                        "WARN",
                                        "DISCORD_COVER",
                                        "Cover upload failed for the active track; publishing its text status with the player icon while retrying.",
                                    );
                                } else {
                                    crate::logger::log(
                                        "WARN",
                                        "DISCORD_COVER",
                                        "Cover upload failed for a stale track; it will retry after backoff if requested again.",
                                    );
                                }
                            }
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
                        let clear_nonce = format!("arachnid_clr_{}", nonce);
                        let clear_activity = json!({
                            "cmd": "SET_ACTIVITY",
                            "args": { "pid": std::process::id(), "activity": null },
                            "nonce": clear_nonce
                        }).to_string();
                        if send_packet(stream, 1, &clear_activity).is_err()
                            || read_rpc_response(stream, &clear_nonce).is_err()
                        {
                            active_stream = None;
                        }
                    }
                    last_had_timestamps = false;
                    last_had_small_image = false;
                    rpc_retry_at = None;
                    rpc_retry_delay = RPC_RETRY_INITIAL;
                    force_cover_refresh_pending = false;
                    continue;
                }

                let upload_host = normalize_cover_host(latest.cover_host.as_deref()).to_string();
                let mut decoded_cover = latest.large_image.as_deref()
                    .map(str::trim)
                    .filter(|value| value.starts_with("data:"))
                    .and_then(decode_cover_data_uri);
                let desired_client_id = latest.client_id.as_deref().unwrap_or("1129859263741837373");
                if !active_client_id.is_empty() && active_client_id != desired_client_id {
                    active_stream = None;
                }
                if active_stream.is_none() {
                    if let Some((stream, connected_id)) = establish_connection(desired_client_id) {
                        crate::logger::log("INFO", "DISCORD_RPC", "Connected to the Discord IPC endpoint.");
                        active_stream = Some(stream);
                        active_client_id = connected_id;
                        last_had_timestamps = false;
                        last_had_small_image = false;
                    }
                }
                let Some(stream) = active_stream.as_mut() else {
                    crate::logger::log("WARN", "DISCORD_RPC", "Could not connect to Discord IPC; the latest presence will retry automatically.");
                    schedule_rpc_retry(&mut rpc_retry_at, &mut rpc_retry_delay, Instant::now());
                    continue;
                };

                let has_timestamps = latest.start_timestamp.is_some() || latest.end_timestamp.is_some();
                let has_small_image = latest.small_image.as_ref().is_some_and(|image| !image.trim().is_empty());
                let should_clear = (last_had_timestamps && !has_timestamps)
                    || (last_had_small_image && !has_small_image);
                if should_clear {
                    nonce += 1;
                    let clear_nonce = format!("arachnid_clr_{}", nonce);
                    let clear_packet = json!({
                        "cmd": "SET_ACTIVITY",
                        "args": { "pid": std::process::id(), "activity": null },
                        "nonce": clear_nonce
                    }).to_string();
                    if send_packet(stream, 1, &clear_packet).is_err()
                        || read_rpc_response(stream, &clear_nonce).is_err()
                    {
                        crate::logger::log("WARN", "DISCORD_RPC", "Could not clear the previous activity; the current presence will retry after reconnecting.");
                        active_stream = None;
                        schedule_rpc_retry(&mut rpc_retry_at, &mut rpc_retry_delay, Instant::now());
                        continue;
                    }
                }

                let mut pending_cover: Option<(String, String, Vec<u8>)> = None;
                let large_image = match latest.large_image.as_deref().map(str::trim) {
                    Some(value) if value.starts_with("data:") => {
                        match decoded_cover.take() {
                            Some((hash, bytes)) => {
                                let cache_key = (hash.clone(), upload_host.clone());
                                if let Some(url) = cover_cache.get(&cache_key) {
                                    url.clone()
                                } else {
                                    pending_cover = Some((hash, upload_host.clone(), bytes));
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

                if let Some((hash, host, bytes)) = pending_cover.take() {
                    let cache_key = (hash.clone(), host.clone());
                    let fallback_already_published = fallback_published.contains(&cache_key);
                    let now = Instant::now();
                    if pending_uploads.contains(&cache_key) {
                        if should_defer_activity_for_cover(false, true, fallback_already_published) {
                            crate::logger::log("INFO", "DISCORD_COVER", "Waiting for the current cover upload before publishing this track's activity.");
                            continue;
                        }
                    } else if retry_after.get(&cache_key).is_some_and(|retry_at| *retry_at > now) {
                        fallback_published.insert(cache_key);
                    } else {
                        retry_after.remove(&cache_key);
                        match upload_tx.try_send((hash, host, bytes)) {
                            Ok(()) => {
                                pending_uploads.insert(cache_key.clone());
                                if should_defer_activity_for_cover(false, true, fallback_already_published) {
                                    crate::logger::log("INFO", "DISCORD_COVER", "Waiting for album artwork before publishing the complete Discord activity.");
                                    continue;
                                }
                            }
                            Err(TrySendError::Full(_)) => {
                                schedule_cover_retry_at(&mut retry_after, cache_key.clone(), now);
                                fallback_published.insert(cache_key);
                                crate::logger::log("WARN", "DISCORD_COVER", "Cover upload queue is full; publishing the track status with the player icon and retrying later.");
                            }
                            Err(TrySendError::Disconnected(_)) => {
                                fallback_published.insert(cache_key);
                                crate::logger::log("ERROR", "DISCORD_COVER", "Cover upload worker is unavailable; publishing track status with the player icon.");
                            }
                        }
                    }
                }

                let activity = build_activity(latest, &large_image);
                if force_cover_refresh_pending {
                    nonce += 1;
                    let clear_nonce = format!("arachnid_cover_clear_{}", nonce);
                    let clear_activity = json!({
                        "cmd": "SET_ACTIVITY",
                        "args": { "pid": std::process::id(), "activity": null },
                        "nonce": clear_nonce
                    }).to_string();
                    if send_packet(stream, 1, &clear_activity).is_err()
                        || read_rpc_response(stream, &clear_nonce).is_err()
                    {
                        crate::logger::log("WARN", "DISCORD_RPC", "Could not clear the previous activity before refreshing its artwork; retrying the complete activity.");
                        active_stream = None;
                        schedule_rpc_retry(&mut rpc_retry_at, &mut rpc_retry_delay, Instant::now());
                        continue;
                    }
                    crate::logger::log("INFO", "DISCORD_COVER", "Cleared the cached activity before applying the uploaded artwork; the replacement keeps the same track timestamps.");
                }
                if let Err(error) = send_activity(stream, &activity, &mut nonce) {
                    crate::logger::log("WARN", "DISCORD_RPC", &format!("Could not publish activity: {error}; scheduling an automatic reconnect and retry."));
                    active_stream = None;
                    schedule_rpc_retry(&mut rpc_retry_at, &mut rpc_retry_delay, Instant::now());
                    continue;
                }
                rpc_retry_at = None;
                rpc_retry_delay = RPC_RETRY_INITIAL;
                force_cover_refresh_pending = false;
                last_had_timestamps = has_timestamps;
                last_had_small_image = has_small_image;

            }
        });

        Self { sender: tx }
    }

    pub fn update(&self, data: ActivityData) {
        let _ = self.sender.send(DiscordMessage::Presence(data));
    }

    pub fn cached_cover_ready(&self, hash: String, data_uri: String) {
        let _ = self.sender.send(DiscordMessage::CachedCoverReady { hash, data_uri });
    }
}

#[cfg(test)]
mod tests {
    use super::{
        accept_cached_cover, build_activity, clear_expired_cover_retries, cover_uploaders,
        decode_cover_data_uri, imgdb_direct_url, next_cover_retry_deadline,
        next_rpc_retry_deadline, normalize_cover_host, schedule_cover_retry_at,
        schedule_rpc_retry, should_defer_activity_for_cover, ActivityData,
        RPC_RETRY_INITIAL, RPC_RETRY_MAX,
    };
    use serde_json::json;
    use sha2::Digest;
    use std::collections::HashMap;
    use std::time::{Duration, Instant};

    #[test]
    fn cover_host_preference_selects_only_the_requested_host_or_all_in_auto_mode() {
        let automatic: Vec<&str> = cover_uploaders("auto").iter().map(|(host, _, _)| *host).collect();
        assert_eq!(automatic, vec!["img24", "uguu", "catbox", "imgdb"]);
        let imgdb: Vec<&str> = cover_uploaders("imgdb").iter().map(|(host, _, _)| *host).collect();
        assert_eq!(imgdb, ["imgdb"]);
        assert_eq!(normalize_cover_host(Some("unknown")), "auto");
    }

    #[test]
    fn failed_rpc_presence_retries_automatically_with_bounded_backoff() {
        let now = Instant::now();
        let mut retry_at = None;
        let mut retry_delay = RPC_RETRY_INITIAL;

        schedule_rpc_retry(&mut retry_at, &mut retry_delay, now);
        assert_eq!(retry_at, Some(now + Duration::from_secs(1)));
        assert_eq!(retry_delay, Duration::from_secs(2));
        assert_eq!(next_rpc_retry_deadline(true, Some(now + Duration::from_secs(60)), retry_at), retry_at);
        assert_eq!(next_rpc_retry_deadline(false, None, retry_at), None);

        schedule_rpc_retry(&mut retry_at, &mut retry_delay, now);
        assert_eq!(retry_at, Some(now + Duration::from_secs(2)));
        for _ in 0..8 {
            schedule_rpc_retry(&mut retry_at, &mut retry_delay, now);
        }
        assert_eq!(retry_delay, RPC_RETRY_MAX);
        assert_eq!(retry_at, Some(now + Duration::from_secs(30)));
    }

    #[test]
    fn cover_upload_retries_wake_only_for_enabled_presence_and_expire_stale_deadlines() {
        let now = Instant::now();
        let due_key = ("due-hash".to_string(), "auto".to_string());
        let future_key = ("future-hash".to_string(), "imgdb".to_string());
        let mut retries = HashMap::from([
            (due_key.clone(), now + Duration::from_secs(2)),
            (future_key.clone(), now + Duration::from_secs(5)),
        ]);

        assert_eq!(next_cover_retry_deadline(true, &retries), Some(now + Duration::from_secs(2)));
        assert_eq!(next_cover_retry_deadline(false, &retries), None);

        let automatic_retry_key = ("retry-hash".to_string(), "auto".to_string());
        schedule_cover_retry_at(&mut retries, automatic_retry_key.clone(), now);
        assert_eq!(*retries.get(&automatic_retry_key).unwrap(), now + Duration::from_secs(60));

        clear_expired_cover_retries(&mut retries, now + Duration::from_secs(3));
        assert!(!retries.contains_key(&due_key));
        assert_eq!(*retries.get(&future_key).unwrap(), now + Duration::from_secs(5));
    }

    #[test]
    fn first_activity_waits_for_cover_upload_but_fallback_remains_available() {
        assert!(should_defer_activity_for_cover(false, true, false));
        assert!(!should_defer_activity_for_cover(true, true, false));
        assert!(!should_defer_activity_for_cover(false, false, false));
        assert!(!should_defer_activity_for_cover(false, true, true));
    }

    #[test]
    fn cached_artwork_ready_event_only_updates_the_still_active_cover() {
        let mut presence = Some(ActivityData {
            enabled: true,
            details: "First track".to_string(),
            state: "Artist".to_string(),
            large_image: None,
            large_text: None,
            small_image: None,
            small_text: None,
            start_timestamp: Some(1_800_000_000),
            end_timestamp: Some(1_800_000_240),
            status_display_type: Some(2),
            client_id: None,
            status_mode: Some("listening_app".to_string()),
            cover_host: Some("auto".to_string()),
            pending_cover_hash: Some("first-hash".to_string()),
        });

        assert!(!accept_cached_cover(&mut presence, "stale-hash", "data:image/jpeg;base64,AQID".to_string()));
        assert!(accept_cached_cover(&mut presence, "first-hash", "data:image/jpeg;base64,AQID".to_string()));
        let presence = presence.unwrap();
        assert_eq!(presence.large_image.as_deref(), Some("data:image/jpeg;base64,AQID"));
        assert_eq!(presence.pending_cover_hash, None);
    }

    #[test]
    fn imgdb_response_must_contain_a_direct_imgdb_image_url() {
        assert_eq!(
            imgdb_direct_url(r#"{"url":"https://imgdb.io/i/Ym5TEo4.jpg"}"#),
            Some("https://imgdb.io/i/Ym5TEo4.jpg".to_string())
        );
        assert_eq!(imgdb_direct_url(r#"{"url":"https://example.com/image.jpg"}"#), None);
        assert_eq!(imgdb_direct_url("not json"), None);
    }

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
            cover_host: Some("auto".to_string()),
            pending_cover_hash: None,
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
        assert_eq!(placeholder["timestamps"], uploaded["timestamps"]);
        assert_eq!(placeholder["party"], uploaded["party"]);
    }
}
