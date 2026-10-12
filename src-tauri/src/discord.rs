use std::fs::OpenOptions;
use std::io::{Read, Write};
use std::sync::mpsc::{channel, Sender};
use std::thread;
use std::collections::HashMap;
use base64::prelude::*;
use serde_json::json;

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

pub struct DiscordService {
    sender: Sender<ActivityData>,
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

/**
 * Uploads local embedded track artwork directly to uguu.se or imgur without browser CORS restrictions
 */
fn upload_raw_cover(image_bytes: &[u8]) -> Option<String> {
    // 1. Try uguu.se (global, fast, unblocked in Russia, no key required)
    let boundary = "----ArachnidCoverBoundary7MA4YWxk";
    let mut body = Vec::new();
    body.extend_from_slice(format!("--{}\r\n", boundary).as_bytes());
    body.extend_from_slice(b"Content-Disposition: form-data; name=\"files[]\"; filename=\"cover.jpg\"\r\n");
    body.extend_from_slice(b"Content-Type: image/jpeg\r\n\r\n");
    body.extend_from_slice(image_bytes);
    body.extend_from_slice(format!("\r\n--{}--\r\n", boundary).as_bytes());

    if let Ok(res) = ureq::post("https://uguu.se/upload")
        .set("Content-Type", &format!("multipart/form-data; boundary={}", boundary))
        .set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
        .timeout(std::time::Duration::from_secs(7))
        .send_bytes(&body)
    {
        if let Ok(body_str) = res.into_string() {
            if let Ok(json_val) = serde_json::from_str::<serde_json::Value>(&body_str) {
                if let Some(url) = json_val.pointer("/files/0/url").and_then(|v| v.as_str()) {
                    if !url.is_empty() {
                        return Some(url.to_string());
                    }
                }
            }
        }
    }

    // 2. Try api.imgur.com fallback (Client-ID 09bef4c058080cd)
    let b64 = BASE64_STANDARD.encode(image_bytes);
    let mut imgur_body = Vec::new();
    imgur_body.extend_from_slice(format!("--{}\r\n", boundary).as_bytes());
    imgur_body.extend_from_slice(b"Content-Disposition: form-data; name=\"image\"\r\n\r\n");
    imgur_body.extend_from_slice(b64.as_bytes());
    imgur_body.extend_from_slice(format!("\r\n--{}\r\n", boundary).as_bytes());
    imgur_body.extend_from_slice(b"Content-Disposition: form-data; name=\"type\"\r\n\r\nbase64\r\n");
    imgur_body.extend_from_slice(format!("--{}--\r\n", boundary).as_bytes());

    if let Ok(res) = ureq::post("https://api.imgur.com/3/upload")
        .set("Authorization", "Client-ID 09bef4c058080cd")
        .set("Content-Type", &format!("multipart/form-data; boundary={}", boundary))
        .set("User-Agent", "Mozilla/5.0")
        .timeout(std::time::Duration::from_secs(7))
        .send_bytes(&imgur_body)
    {
        if let Ok(body_str) = res.into_string() {
            if let Ok(json_val) = serde_json::from_str::<serde_json::Value>(&body_str) {
                if let Some(url) = json_val.pointer("/data/link").and_then(|v| v.as_str()) {
                    if !url.is_empty() {
                        return Some(url.to_string());
                    }
                }
            }
        }
    }

    None
}

impl DiscordService {
    pub fn new() -> Self {
        let (tx, rx) = channel::<ActivityData>();

        thread::spawn(move || {
            let mut active_stream: Option<IpcStream> = None;
            let mut active_client_id = String::new();
            let mut nonce = 0u64;
            let mut cover_cache: HashMap<String, String> = HashMap::new();

            while let Ok(data) = rx.recv() {
                // Drain any extra pending messages to only process the latest state
                let mut latest = data;
                while let Ok(next) = rx.try_recv() {
                    latest = next;
                }

                nonce += 1;

                if !latest.enabled {
                    if let Some(stream) = &mut active_stream {
                        let clear_activity = json!({
                            "cmd": "SET_ACTIVITY",
                            "args": {
                                "pid": std::process::id(),
                                "activity": null
                            },
                            "nonce": format!("arachnid_clr_{}", nonce)
                        }).to_string();

                        let _ = send_packet(stream, 1, &clear_activity);
                        let _ = read_packet(stream);
                    }
                    continue;
                }

                let desired_client_id = latest.client_id.as_deref().unwrap_or("1129859263741837373");

                // Reconnect if the target client ID changed
                if !active_client_id.is_empty() && active_client_id != desired_client_id {
                    active_stream = None;
                }

                // Connect if needed
                if active_stream.is_none() {
                    if let Some((stream, connected_id)) = establish_connection(desired_client_id) {
                        active_stream = Some(stream);
                        active_client_id = connected_id;
                    }
                }

                if let Some(stream) = &mut active_stream {
                    let is_listening_only = latest.status_mode.as_deref() == Some("listening");

                    let act_name = if is_listening_only {
                        "\u{200b}"
                    } else {
                        "ArachnidMP"
                    };

                    let mut activity = json!({
                        "type": 2, // LISTENING (Слушает)
                        "name": act_name,
                        "details": sanitize_discord_string(&latest.details),
                        "state": sanitize_discord_string(&latest.state),
                        // ALWAYS 2 (Details) so Discord displays the track name under the user's nickname in the member list!
                        "status_display_type": 2,
                    });

                    // Assets
                    let mut assets = json!({});

                    if let Some(large_img) = &latest.large_image {
                        let trimmed = large_img.trim();
                        if trimmed.starts_with("data:image/") || trimmed.starts_with("data:;base64,") {
                            let b64_clean = if let Some(idx) = trimmed.find(";base64,") {
                                &trimmed[idx + 8..]
                            } else {
                                trimmed
                            };
                            let cache_key = format!("{}_{}_{}", latest.details, latest.state, trimmed.len());
                            if let Some(cached_url) = cover_cache.get(&cache_key) {
                                assets["large_image"] = json!(cached_url);
                            } else if let Ok(bytes) = BASE64_STANDARD.decode(b64_clean.trim()) {
                                if let Some(uploaded_url) = upload_raw_cover(&bytes) {
                                    cover_cache.insert(cache_key, uploaded_url.clone());
                                    assets["large_image"] = json!(uploaded_url);
                                } else {
                                    assets["large_image"] = json!("https://raw.githubusercontent.com/sssHpion007/ArachnidMP/main/public/app-logo.png");
                                }
                            } else {
                                assets["large_image"] = json!("https://raw.githubusercontent.com/sssHpion007/ArachnidMP/main/public/app-logo.png");
                            }
                        } else if !trimmed.is_empty() {
                            assets["large_image"] = json!(trimmed);
                        }
                    } else {
                        assets["large_image"] = json!("https://raw.githubusercontent.com/sssHpion007/ArachnidMP/main/public/app-logo.png");
                    }

                    if let Some(large_txt) = &latest.large_text {
                        let clean = sanitize_discord_string(large_txt);
                        if !clean.is_empty() {
                            assets["large_text"] = json!(clean);
                        }
                    }
                    if let Some(small_img) = &latest.small_image {
                        let trimmed = small_img.trim();
                        if !trimmed.is_empty() {
                            assets["small_image"] = json!(trimmed);
                        }
                    }
                    if let Some(small_txt) = &latest.small_text {
                        let clean = sanitize_discord_string(small_txt);
                        if !clean.is_empty() {
                            assets["small_text"] = json!(clean);
                        }
                    }
                    if assets.as_object().map_or(false, |o| !o.is_empty()) {
                        activity["assets"] = assets;
                    }

                    // Timestamps: both start and end creates the timeline progress bar.
                    // When paused (no start or end), explicitly send null so Discord DOES NOT start an automatic timer!
                    if latest.start_timestamp.is_some() || latest.end_timestamp.is_some() {
                        let mut timestamps = json!({});
                        if let Some(ts_start) = latest.start_timestamp {
                            timestamps["start"] = json!(ts_start);
                        }
                        if let Some(ts_end) = latest.end_timestamp {
                            timestamps["end"] = json!(ts_end);
                        }
                        activity["timestamps"] = timestamps;
                    } else {
                        activity["timestamps"] = json!(null);
                    }

                    let set_activity = json!({
                        "cmd": "SET_ACTIVITY",
                        "args": {
                            "pid": std::process::id(),
                            "activity": activity
                        },
                        "nonce": format!("arachnid_act_{}", nonce)
                    }).to_string();

                    if send_packet(stream, 1, &set_activity).is_err() || read_packet(stream).is_err() {
                        active_stream = None;
                    }
                }
            }
        });

        Self { sender: tx }
    }

    pub fn update(&self, data: ActivityData) {
        let _ = self.sender.send(data);
    }
}
