use std::fs::OpenOptions;
use std::io::{Read, Write};
use std::sync::mpsc::{channel, Sender};
use std::thread;
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
    if len > 1024 * 1024 {
        return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "packet too large"));
    }
    let mut buf = vec![0u8; len];
    stream.read_exact(&mut buf)?;
    let s = String::from_utf8(buf).map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;
    Ok((op, s))
}

#[cfg(windows)]
fn open_pipe(i: usize) -> std::io::Result<IpcStream> {
    let pipe_name = format!(r"\\.\pipe\discord-ipc-{}", i);
    OpenOptions::new()
        .read(true)
        .write(true)
        .open(&pipe_name)
}

#[cfg(not(windows))]
fn open_pipe(i: usize) -> std::io::Result<IpcStream> {
    let mut paths = Vec::new();
    if let Ok(runtime_dir) = std::env::var("XDG_RUNTIME_DIR") {
        paths.push(format!("{}/discord-ipc-{}", runtime_dir, i));
    }
    if let Ok(tmp) = std::env::var("TMPDIR") {
        paths.push(format!("{}/discord-ipc-{}", tmp, i));
    }
    paths.push(format!("/tmp/discord-ipc-{}", i));

    for p in paths {
        if let Ok(stream) = std::os::unix::net::UnixStream::connect(p) {
            return Ok(stream);
        }
    }
    Err(std::io::Error::new(std::io::ErrorKind::NotFound, "No discord socket found"))
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

fn establish_connection(requested_id: &str) -> Option<(IpcStream, String)> {
    if let Some(stream) = try_connect_client(requested_id) {
        return Some((stream, requested_id.to_string()));
    }
    // Fallbacks if requested ID fails (verified public IDs)
    let fallbacks = ["1129859263741837373", "409394531948298250"];
    for fb in fallbacks {
        if fb != requested_id {
            if let Some(stream) = try_connect_client(fb) {
                return Some((stream, fb.to_string()));
            }
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

impl DiscordService {
    pub fn new() -> Self {
        let (tx, rx) = channel::<ActivityData>();

        thread::spawn(move || {
            let mut active_stream: Option<IpcStream> = None;
            let mut active_client_id = String::new();
            let mut nonce = 0u64;

            while let Ok(data) = rx.recv() {
                // Drain newer updates to only process latest state
                let mut latest = data;
                while let Ok(next) = rx.try_recv() {
                    latest = next;
                }

                nonce = nonce.wrapping_add(1);

                if !latest.enabled {
                    if let Some(mut stream) = active_stream.take() {
                        let clear_activity = json!({
                            "cmd": "SET_ACTIVITY",
                            "args": {
                                "pid": std::process::id(),
                                "activity": null
                            },
                            "nonce": format!("arachnid_clr_{}", nonce)
                        }).to_string();

                        let _ = send_packet(&mut stream, 1, &clear_activity);
                        let _ = read_packet(&mut stream);
                    }
                    continue;
                }

                let desired_client_id = latest.client_id
                    .as_deref()
                    .map(|s| s.trim())
                    .filter(|s| !s.is_empty())
                    .unwrap_or("1304561842858561637");

                // If connected with a different client_id, reconnect
                if active_stream.is_some() && active_client_id != desired_client_id {
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
                    let act_name = if latest.status_display_type == Some(2) {
                        "\u{200b}"
                    } else {
                        "ArachnidMP"
                    };

                    let mut activity = json!({
                        "type": 2, // LISTENING (Слушает)
                        "name": act_name,
                        "details": sanitize_discord_string(&latest.details),
                        "state": sanitize_discord_string(&latest.state),
                    });

                    // Assets
                    let mut assets = json!({});
                    if let Some(large_img) = &latest.large_image {
                        let trimmed = large_img.trim();
                        if !trimmed.is_empty() {
                            assets["large_image"] = json!(trimmed);
                        }
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

                    // Status display type (0 = App Name, 1 = State / Artist, 2 = Details / Track)
                    if let Some(sdt) = latest.status_display_type {
                        activity["status_display_type"] = json!(sdt);
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
