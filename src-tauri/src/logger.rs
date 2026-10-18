use std::collections::VecDeque;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter};
use crate::storage;

pub struct LoggerState {
    app_handle: Option<AppHandle>,
    session_file: Option<PathBuf>,
    buffer: VecDeque<String>,
}

static LOGGER: OnceLock<Mutex<LoggerState>> = OnceLock::new();
static SESSION_CLOCK: OnceLock<std::time::Instant> = OnceLock::new();

fn get_logger() -> &'static Mutex<LoggerState> {
    LOGGER.get_or_init(|| {
        let logs_dir = storage::get_logs_dir();
        let _ = fs::create_dir_all(&logs_dir);

        let now = chrono::Local::now();
        let session_name = format!("arachnid_session_{}.log", now.format("%Y-%m-%d_%H-%M-%S"));
        let session_file = logs_dir.join(session_name);

        Mutex::new(LoggerState {
            app_handle: None,
            session_file: Some(session_file),
            buffer: VecDeque::with_capacity(600),
        })
    })
}

pub fn initialize_session_clock() {
    SESSION_CLOCK.get_or_init(std::time::Instant::now);
}

pub fn set_app_handle(handle: AppHandle) {
    if let Ok(mut state) = get_logger().lock() {
        state.app_handle = Some(handle);
    }
}

pub fn log(level: &str, tag: &str, message: &str) {
    let now = chrono::Local::now();
    let timestamp = now.format("%Y-%m-%d %H:%M:%S%.3f");
    let elapsed = SESSION_CLOCK.get_or_init(std::time::Instant::now).elapsed();
    let line = format!(
        "[{} +{:>8.3}s] [{}] [{}] {}",
        timestamp,
        elapsed.as_secs_f64(),
        level,
        tag,
        message
    );

    println!("{}", line);

    if let Ok(mut state) = get_logger().lock() {
        // 1. In-memory buffer
        if state.buffer.len() >= 500 {
            state.buffer.pop_front();
        }
        state.buffer.push_back(line.clone());

        // 2. Write to session log file
        if let Some(ref path) = state.session_file {
            if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
                let _ = writeln!(file, "{}", line);
            }
        }

        // 3. Write to latest log file
        let latest_path = storage::get_logs_dir().join("arachnid_latest.log");
        if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(latest_path) {
            let _ = writeln!(file, "{}", line);
        }

        // 4. Emit to frontend if available
        if let Some(ref handle) = state.app_handle {
            let _ = handle.emit("log://new-entry", serde_json::json!({ "line": line }));
        }
    }
}

#[tauri::command]
pub fn get_recent_logs() -> Vec<String> {
    if let Ok(state) = get_logger().lock() {
        state.buffer.iter().cloned().collect()
    } else {
        Vec::new()
    }
}

#[tauri::command]
pub fn client_log(level: String, tag: String, message: String) {
    log(&level, &tag, &message);
}

#[tauri::command]
pub fn save_logs_snapshot() -> Result<String, String> {
    let logs_dir = storage::get_logs_dir();
    let _ = fs::create_dir_all(&logs_dir);

    let now = chrono::Local::now();
    let filename = format!("arachnid_log_{}.log", now.format("%Y-%m-%d_%H-%M-%S"));
    let target_path = logs_dir.join(&filename);

    let logs = get_recent_logs();
    let content = logs.join("\n");

    fs::write(&target_path, content).map_err(|e| e.to_string())?;

    log("INFO", "LOGGER", &format!("Saved logs snapshot to {}", target_path.display()));
    Ok(filename)
}

#[tauri::command]
pub fn open_logs_folder() -> Result<(), String> {
    let logs_dir = storage::get_logs_dir();
    let _ = fs::create_dir_all(&logs_dir);

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&logs_dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&logs_dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&logs_dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    log("INFO", "LOGGER", &format!("Opened logs folder: {}", logs_dir.display()));
    Ok(())
}
