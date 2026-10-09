use std::fs::OpenOptions;
use std::io::Write;
use std::sync::mpsc::{channel, Sender};
use std::thread;
use serde_json::json;

#[derive(Debug, Clone)]
pub struct ActivityData {
    pub enabled: bool,
    pub details: String,
    pub state: String,
    pub large_text: String,
    pub start_timestamp: Option<i64>,
}

pub struct DiscordService {
    sender: Sender<ActivityData>,
}

impl DiscordService {
    pub fn new() -> Self {
        let (tx, rx) = channel::<ActivityData>();

        thread::spawn(move || {
            let mut pipe: Option<std::fs::File> = None;

            while let Ok(data) = rx.recv() {
                // Drain any newer pending updates to only send the latest
                let mut latest = data;
                while let Ok(next) = rx.try_recv() {
                    latest = next;
                }

                if !latest.enabled {
                    if let Some(mut p) = pipe.take() {
                        let activity = json!({
                            "cmd": "SET_ACTIVITY",
                            "args": {
                                "pid": std::process::id(),
                                "activity": null
                            },
                            "nonce": "arachnid_clear"
                        }).to_string();

                        let op = 1u32;
                        let len = activity.len() as u32;
                        let mut packet = Vec::new();
                        packet.extend_from_slice(&op.to_le_bytes());
                        packet.extend_from_slice(&len.to_le_bytes());
                        packet.extend_from_slice(activity.as_bytes());
                        let _ = p.write_all(&packet);
                    }
                    continue;
                }

                // Connect to Discord named pipe if not connected
                if pipe.is_none() {
                    for i in 0..10 {
                        let pipe_name = format!(r"\\.\pipe\discord-ipc-{}", i);
                        if let Ok(mut file) = OpenOptions::new().write(true).open(&pipe_name) {
                            let handshake = json!({
                                "v": 1,
                                "client_id": "1304561842858561637"
                            }).to_string();

                            let op = 0u32;
                            let len = handshake.len() as u32;
                            let mut packet = Vec::new();
                            packet.extend_from_slice(&op.to_le_bytes());
                            packet.extend_from_slice(&len.to_le_bytes());
                            packet.extend_from_slice(handshake.as_bytes());

                            if file.write_all(&packet).is_ok() {
                                pipe = Some(file);
                                break;
                            }
                        }
                    }
                }

                if let Some(p) = &mut pipe {
                    let mut timestamps = json!({});
                    if let Some(ts) = latest.start_timestamp {
                        timestamps["start"] = json!(ts);
                    }

                    let activity = json!({
                        "cmd": "SET_ACTIVITY",
                        "args": {
                            "pid": std::process::id(),
                            "activity": {
                                "details": latest.details,
                                "state": latest.state,
                                "assets": {
                                    "large_image": "arachnid_logo",
                                    "large_text": latest.large_text
                                },
                                "timestamps": timestamps
                            }
                        },
                        "nonce": "arachnid_act"
                    }).to_string();

                    let op = 1u32;
                    let len = activity.len() as u32;
                    let mut packet = Vec::new();
                    packet.extend_from_slice(&op.to_le_bytes());
                    packet.extend_from_slice(&len.to_le_bytes());
                    packet.extend_from_slice(activity.as_bytes());

                    if p.write_all(&packet).is_err() {
                        pipe = None;
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
