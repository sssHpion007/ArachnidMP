use std::fs::OpenOptions;
use std::io::{Read, Write};
use serde_json::json;

pub struct DiscordIpc {
    pipe: Option<std::fs::File>,
}

impl DiscordIpc {
    pub fn new() -> Self {
        Self { pipe: None }
    }

    pub fn connect(&mut self) -> Result<(), String> {
        if self.pipe.is_some() {
            return Ok(());
        }

        // Try connecting to named pipes 0..10 on Windows
        for i in 0..10 {
            let pipe_name = format!(r"\\.\pipe\discord-ipc-{}", i);
            if let Ok(mut file) = OpenOptions::new().read(true).write(true).open(&pipe_name) {
                // Handshake opcode 0
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
                    let mut header = [0u8; 8];
                    if file.read_exact(&mut header).is_ok() {
                        let resp_len = u32::from_le_bytes([header[4], header[5], header[6], header[7]]) as usize;
                        let mut resp_buf = vec![0u8; resp_len];
                        let _ = file.read_exact(&mut resp_buf);
                        self.pipe = Some(file);
                        return Ok(());
                    }
                }
            }
        }

        Err("Discord client not running".to_string())
    }

    pub fn set_activity(
        &mut self,
        details: &str,
        state: &str,
        large_text: &str,
        start_timestamp: Option<i64>,
    ) -> Result<(), String> {
        if self.pipe.is_none() {
            let _ = self.connect();
        }

        let pipe = match &mut self.pipe {
            Some(p) => p,
            None => return Err("Discord not connected".to_string()),
        };

        let mut timestamps = json!({});
        if let Some(ts) = start_timestamp {
            timestamps["start"] = json!(ts);
        }

        let activity = json!({
            "cmd": "SET_ACTIVITY",
            "args": {
                "pid": std::process::id(),
                "activity": {
                    "details": details,
                    "state": state,
                    "assets": {
                        "large_image": "arachnid_logo",
                        "large_text": large_text
                    },
                    "timestamps": timestamps
                }
            },
            "nonce": "arachnid_act"
        }).to_string();

        let op = 1u32; // Frame
        let len = activity.len() as u32;
        let mut packet = Vec::new();
        packet.extend_from_slice(&op.to_le_bytes());
        packet.extend_from_slice(&len.to_le_bytes());
        packet.extend_from_slice(activity.as_bytes());

        if let Err(e) = pipe.write_all(&packet) {
            self.pipe = None;
            return Err(e.to_string());
        }

        let mut header = [0u8; 8];
        if pipe.read_exact(&mut header).is_ok() {
            let resp_len = u32::from_le_bytes([header[4], header[5], header[6], header[7]]) as usize;
            let mut resp_buf = vec![0u8; resp_len];
            let _ = pipe.read_exact(&mut resp_buf);
        }

        Ok(())
    }

    pub fn clear_activity(&mut self) -> Result<(), String> {
        let pipe = match &mut self.pipe {
            Some(p) => p,
            None => return Ok(()),
        };

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

        let _ = pipe.write_all(&packet);
        let mut header = [0u8; 8];
        let _ = pipe.read_exact(&mut header);
        Ok(())
    }
}
