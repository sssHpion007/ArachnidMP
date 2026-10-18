//! Self-contained Windows portable updater.
//!
//! A copy of the running executable is launched in helper mode so no external
//! PowerShell policy, installer, or permanently installed updater is required.
#![cfg(target_os = "windows")]

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::ffi::c_void;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::os::windows::ffi::OsStrExt;
use std::os::windows::process::CommandExt;
use std::process::{Child, Command};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

pub const HELPER_FLAG: &str = "--arachnid-portable-update-helper";
const HELPER_NAME: &str = "helper.exe";
const PAYLOAD_NAME: &str = "payload.exe";
const BACKUP_NAME: &str = "previous.exe";
const STAGE_PREFIX: &str = ".arachnid-update-";
const READY_FILE: &str = "ready";
const ERROR_FILE: &str = "helper-error.txt";
const COMPLETED_FILE: &str = "completed";
const MAX_UPDATE_BYTES: u64 = 300 * 1024 * 1024;

const PROCESS_SYNCHRONIZE: u32 = 0x0010_0000;
const WAIT_OBJECT_0: u32 = 0;
const WAIT_TIMEOUT: u32 = 258;
const CREATE_NO_WINDOW: u32 = 0x0800_0000;
const DETACHED_PROCESS: u32 = 0x0000_0008;

#[link(name = "kernel32")]
extern "system" {
    fn OpenProcess(desired_access: u32, inherit_handle: i32, process_id: u32) -> *mut c_void;
    fn WaitForSingleObject(handle: *mut c_void, milliseconds: u32) -> u32;
    fn CloseHandle(handle: *mut c_void) -> i32;
    fn GetLastError() -> u32;
    fn ReplaceFileW(
        replaced_file_name: *const u16,
        replacement_file_name: *const u16,
        backup_file_name: *const u16,
        replace_flags: u32,
        exclude: *mut c_void,
        reserved: *mut c_void,
    ) -> i32;
}

#[derive(Debug, Serialize, Deserialize)]
struct Transaction {
    target_name: String,
    parent_pid: u32,
    payload_sha256: String,
    original_sha256: String,
    log_path: String,
}

fn sha256(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn unique_id() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    format!("{}-{nanos}", std::process::id())
}

fn write_synced(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|error| format!("Cannot create {}: {error}", path.display()))?;
    file.write_all(bytes)
        .and_then(|()| file.sync_all())
        .map_err(|error| format!("Cannot persist {}: {error}", path.display()))
}

fn valid_target_name(name: &str) -> bool {
    !name.is_empty()
        && !name.chars().any(|character| matches!(character, '/' | '\\' | ':'))
        && name.to_ascii_lowercase().ends_with(".exe")
}

fn valid_stage(stage: &Path) -> bool {
    stage
        .file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.starts_with(STAGE_PREFIX) && name.len() > STAGE_PREFIX.len())
        && fs::symlink_metadata(stage)
            .is_ok_and(|metadata| metadata.is_dir() && !metadata.file_type().is_symlink())
}

fn validate_payload(payload: &[u8], expected_sha256: &str) -> Result<(), String> {
    if payload.len() < 1_000_000 || payload.len() as u64 > MAX_UPDATE_BYTES {
        return Err("Downloaded update has an invalid size.".to_string());
    }
    if sha256(payload) != expected_sha256 {
        return Err("Downloaded update checksum does not match GitHub's release digest.".to_string());
    }
    if !payload.starts_with(b"MZ") {
        return Err("Downloaded update is not a valid Windows executable.".to_string());
    }
    Ok(())
}

/// Prepare all files beside the portable app before asking it to exit.
pub fn prepare(executable: &Path, payload: &[u8], expected_sha256: &str) -> Result<PathBuf, String> {
    validate_payload(payload, expected_sha256)?;

    let target_name = executable
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| valid_target_name(name))
        .ok_or_else(|| "The portable executable name is invalid.".to_string())?;
    let root = executable
        .parent()
        .ok_or_else(|| "Cannot determine the portable app directory.".to_string())?;
    let stage = root.join(format!("{STAGE_PREFIX}{}", unique_id()));
    fs::create_dir(&stage).map_err(|error| {
        format!(
            "The app folder is not writable, so the update was not started: {error}"
        )
    })?;

    let result = (|| {
        let original = fs::read(executable)
            .map_err(|error| format!("Cannot read the current executable: {error}"))?;
        write_synced(&stage.join(HELPER_NAME), &original)?;
        write_synced(&stage.join(PAYLOAD_NAME), payload)?;
        let transaction = Transaction {
            target_name: target_name.to_string(),
            parent_pid: std::process::id(),
            payload_sha256: expected_sha256.to_string(),
            original_sha256: sha256(&original),
            log_path: std::env::temp_dir()
                .join(format!("Arachnid-Update-Log-{}.txt", unique_id()))
                .to_string_lossy()
                .into_owned(),
        };
        let json = serde_json::to_vec(&transaction).map_err(|error| error.to_string())?;
        write_synced(&stage.join("transaction.json"), &json)
    })();

    if let Err(error) = result {
        let _ = fs::remove_dir_all(&stage);
        return Err(error);
    }
    Ok(stage)
}

pub fn spawn_ready_helper(stage: &Path) -> Result<Child, String> {
    if !valid_stage(stage) {
        return Err("The portable update staging directory is invalid.".to_string());
    }
    let mut child = Command::new(stage.join(HELPER_NAME))
        .arg(HELPER_FLAG)
        .current_dir(std::env::temp_dir())
        .creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS)
        .spawn()
        .map_err(|error| format!("Cannot start the portable update helper: {error}"))?;

    let deadline = std::time::Instant::now() + Duration::from_secs(6);
    loop {
        if stage.join(READY_FILE).is_file() {
            return Ok(child);
        }
        if let Ok(error) = fs::read_to_string(stage.join(ERROR_FILE)) {
            let _ = child.kill();
            let _ = child.wait();
            let _ = fs::remove_dir_all(stage);
            return Err(format!("Portable update helper could not start: {error}"));
        }
        if std::time::Instant::now() >= deadline {
            let _ = child.kill();
            let _ = child.wait();
            let _ = fs::remove_dir_all(stage);
            return Err("Portable update helper did not become ready; the app was left running.".to_string());
        }
        std::thread::sleep(Duration::from_millis(50));
    }
}

fn read_transaction(stage: &Path) -> Result<Transaction, String> {
    if !valid_stage(stage) {
        return Err("Invalid updater staging directory.".to_string());
    }
    let transaction: Transaction = serde_json::from_slice(
        &fs::read(stage.join("transaction.json")).map_err(|error| error.to_string())?,
    )
    .map_err(|error| format!("Cannot read updater transaction: {error}"))?;
    if !valid_target_name(&transaction.target_name) {
        return Err("Invalid updater target filename.".to_string());
    }
    Ok(transaction)
}

fn log_line(path: &Path, message: &str) {
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(file, "{} {message}", chrono::Utc::now().to_rfc3339());
        let _ = file.sync_all();
    }
}

fn wait_for_parent(stage: &Path, parent_pid: u32) -> Result<(), String> {
    let handle = unsafe { OpenProcess(PROCESS_SYNCHRONIZE, 0, parent_pid) };
    if handle.is_null() {
        return Err(format!(
            "Cannot open the player process for a safe wait: {}",
            std::io::Error::last_os_error()
        ));
    }
    let ready_result = write_synced(&stage.join(READY_FILE), std::process::id().to_string().as_bytes());
    let wait_result = if ready_result.is_ok() {
        unsafe { WaitForSingleObject(handle, 60_000) }
    } else {
        WAIT_TIMEOUT
    };
    unsafe { CloseHandle(handle) };
    ready_result?;
    match wait_result {
        WAIT_OBJECT_0 => Ok(()),
        WAIT_TIMEOUT => Err("The player did not exit within 60 seconds; update cancelled.".to_string()),
        other => Err(format!("Waiting for the player failed with Windows status {other}.")),
    }
}

fn replace_file_atomically(target: &Path, replacement: &Path, backup: &Path) -> Result<(), String> {
    let target_wide: Vec<u16> = target.as_os_str().encode_wide().chain(Some(0)).collect();
    let replacement_wide: Vec<u16> = replacement.as_os_str().encode_wide().chain(Some(0)).collect();
    let backup_wide: Vec<u16> = backup.as_os_str().encode_wide().chain(Some(0)).collect();
    let result = unsafe {
        ReplaceFileW(
            target_wide.as_ptr(),
            replacement_wide.as_ptr(),
            backup_wide.as_ptr(),
            0,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
        )
    };
    if result == 0 {
        Err(std::io::Error::last_os_error().to_string())
    } else {
        Ok(())
    }
}

fn restore_original(target: &Path, backup: &Path, stage: &Path) -> Result<(), String> {
    if target.exists() {
        let failed_payload = stage.join("failed-new.exe");
        replace_file_atomically(target, backup, &failed_payload).map_err(|error| {
            format!(
                "Rollback failed; the original executable is preserved at {}: {error}",
                backup.display()
            )
        })
    } else {
        fs::rename(backup, target).map_err(|error| {
            format!(
                "Rollback failed; the original executable is preserved at {}: {error}",
                backup.display()
            )
        })
    }
}

fn replace_and_launch(
    stage: &Path,
    transaction: &Transaction,
    launch_and_validate: impl FnOnce(&Path) -> Result<(), String>,
) -> Result<(), String> {
    let root = stage
        .parent()
        .ok_or_else(|| "Invalid application directory.".to_string())?;
    let target = root.join(&transaction.target_name);
    let payload = stage.join(PAYLOAD_NAME);
    let backup = stage.join(BACKUP_NAME);

    let payload_bytes = fs::read(&payload).map_err(|error| format!("Cannot read update payload: {error}"))?;
    if sha256(&payload_bytes) != transaction.payload_sha256 {
        return Err("Staged update changed after checksum verification; refusing to install.".to_string());
    }
    let original_bytes = fs::read(&target).map_err(|error| format!("Cannot read the current app: {error}"))?;
    if sha256(&original_bytes) != transaction.original_sha256 {
        return Err("The current executable changed during update; refusing to overwrite it.".to_string());
    }

    if let Err(error) = replace_file_atomically(&target, &payload, &backup) {
        let target_is_original = fs::read(&target)
            .is_ok_and(|bytes| sha256(&bytes) == transaction.original_sha256);
        if target_is_original {
            return Err(format!("Windows could not replace the executable; original is intact: {error}"));
        }
        let backup_is_original = fs::read(&backup)
            .is_ok_and(|bytes| sha256(&bytes) == transaction.original_sha256);
        if backup_is_original {
            return match restore_original(&target, &backup, stage) {
                Ok(()) => Err(format!("Windows replacement failed; original was restored: {error}")),
                Err(rollback) => Err(format!("Windows replacement failed ({error}); {rollback}")),
            };
        }
        return Err(format!(
            "Windows replacement failed and the original was not found at the expected paths; update files were preserved for recovery: {error}"
        ));
    }

    if let Err(error) = launch_and_validate(&target) {
        let restore = restore_original(&target, &backup, stage);
        return match restore {
            Ok(()) => Err(format!("New version failed startup validation; previous version restored: {error}")),
            Err(rollback) => Err(format!("New version failed startup validation ({error}); {rollback}")),
        };
    }

    fs::remove_file(&backup)
        .map_err(|error| format!("New version started, but backup cleanup failed: {error}"))?;
    write_synced(&stage.join(COMPLETED_FILE), b"ok")?;
    Ok(())
}

pub fn run_helper() -> Result<(), String> {
    let executable = std::env::current_exe().map_err(|error| error.to_string())?;
    if executable.file_name().and_then(|name| name.to_str()) != Some(HELPER_NAME) {
        return Err("Updater helper must run from its isolated staging directory.".to_string());
    }
    let stage = executable
        .parent()
        .ok_or_else(|| "Updater staging path is invalid.".to_string())?;
    let transaction = match read_transaction(stage) {
        Ok(transaction) => transaction,
        Err(error) => {
            let _ = fs::write(stage.join(ERROR_FILE), error.as_bytes());
            return Err(error);
        }
    };
    let log_path = PathBuf::from(&transaction.log_path);
    log_line(&log_path, "Portable updater helper started; waiting for player exit.");

    if let Err(error) = wait_for_parent(stage, transaction.parent_pid) {
        log_line(&log_path, &format!("ERROR: {error}"));
        let _ = fs::write(stage.join(ERROR_FILE), error.as_bytes());
        return Err(error);
    }
    log_line(&log_path, "Player process exited; validating staged files.");

    let root = stage
        .parent()
        .ok_or_else(|| "Invalid application directory.".to_string())?;
    let result = replace_and_launch(stage, &transaction, |target| {
        let mut process = Command::new(target)
            .current_dir(root)
            .spawn()
            .map_err(|error| format!("Cannot launch the replacement executable: {error}"))?;
        log_line(&log_path, &format!("Launched replacement PID {}; validating startup.", process.id()));
        std::thread::sleep(Duration::from_secs(10));
        match process
            .try_wait()
            .map_err(|error| format!("Cannot validate replacement startup: {error}"))?
        {
            None => Ok(()),
            Some(status) => Err(format!("Replacement exited during startup with {status}.")),
        }
    });

    match result {
        Ok(()) => {
            log_line(&log_path, "Update succeeded; replacement stayed alive through startup validation.");
            Ok(())
        }
        Err(error) => {
            log_line(&log_path, &format!("ERROR: {error}"));
            let _ = fs::write(stage.join(ERROR_FILE), error.as_bytes());
            let target = root.join(&transaction.target_name);
            if fs::read(&target).is_ok_and(|bytes| sha256(&bytes) == transaction.original_sha256) {
                let _ = Command::new(&target).current_dir(root).spawn();
                log_line(&log_path, "Restarted the verified original executable after update failure.");
                // Safe to clean this transaction once the helper itself exits.
                let _ = write_synced(&stage.join(COMPLETED_FILE), b"rolled-back");
            }
            Err(error)
        }
    }
}

fn helper_still_running(stage: &Path) -> bool {
    let Ok(pid_text) = fs::read_to_string(stage.join(READY_FILE)) else {
        return true;
    };
    let Ok(pid) = pid_text.parse::<u32>() else {
        return true;
    };
    let handle = unsafe { OpenProcess(PROCESS_SYNCHRONIZE, 0, pid) };
    if handle.is_null() {
        // ERROR_INVALID_PARAMETER means that process has already exited. For
        // other errors, keep the transaction rather than risk partial cleanup.
        return unsafe { GetLastError() } != 87;
    }
    let status = unsafe { WaitForSingleObject(handle, 0) };
    unsafe { CloseHandle(handle) };
    status != WAIT_OBJECT_0
}

/// Remove only completed staging directories after Windows releases helper.exe.
pub fn cleanup_completed() {
    let Ok(executable) = std::env::current_exe() else {
        return;
    };
    let Some(root) = executable.parent().map(Path::to_path_buf) else {
        return;
    };
    std::thread::spawn(move || {
        for _ in 0..300 {
            let Ok(entries) = fs::read_dir(&root) else {
                return;
            };
            let mut pending = false;
            for entry in entries.flatten() {
                let stage = entry.path();
                if !valid_stage(&stage) {
                    continue;
                }
                if !stage.join(COMPLETED_FILE).is_file() || helper_still_running(&stage) {
                    pending = true;
                    continue;
                }
                if fs::remove_dir_all(&stage).is_err() {
                    pending = true;
                }
            }
            if !pending {
                return;
            }
            std::thread::sleep(Duration::from_millis(100));
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> (PathBuf, PathBuf, Transaction) {
        let root = std::env::temp_dir().join(format!("arachnid-updater-test-{}", unique_id()));
        fs::create_dir_all(&root).unwrap();
        let target = root.join("Custom Arachnid.exe");
        fs::write(&target, b"old executable contents").unwrap();
        let stage = root.join(format!("{STAGE_PREFIX}test-{}", unique_id()));
        fs::create_dir(&stage).unwrap();
        let payload = b"new executable contents";
        fs::write(stage.join(PAYLOAD_NAME), payload).unwrap();
        let transaction = Transaction {
            target_name: "Custom Arachnid.exe".into(),
            parent_pid: std::process::id(),
            payload_sha256: sha256(payload),
            original_sha256: sha256(b"old executable contents"),
            log_path: root.join("updater.log").to_string_lossy().into_owned(),
        };
        (root, stage, transaction)
    }

    #[test]
    fn replaces_only_the_executable_and_preserves_adjacent_data() {
        let (root, stage, transaction) = fixture();
        fs::create_dir(root.join("config")).unwrap();
        fs::write(root.join("config/settings.json"), b"user data").unwrap();
        fs::write(root.join("portable"), b"").unwrap();
        replace_and_launch(&stage, &transaction, |target| {
            assert_eq!(target, root.join("Custom Arachnid.exe"));
            assert_eq!(fs::read(target).unwrap(), b"new executable contents");
            Ok(())
        })
        .unwrap();
        assert_eq!(fs::read(root.join("config/settings.json")).unwrap(), b"user data");
        assert!(root.join("portable").is_file());
        assert!(!stage.join(BACKUP_NAME).exists());
        assert!(stage.join(COMPLETED_FILE).is_file());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn failed_startup_validation_restores_the_original_executable() {
        let (root, stage, transaction) = fixture();
        assert!(replace_and_launch(&stage, &transaction, |_| Err("startup failed".to_string())).is_err());
        assert_eq!(fs::read(root.join(&transaction.target_name)).unwrap(), b"old executable contents");
        assert!(!stage.join(BACKUP_NAME).exists());
        assert_eq!(fs::read(stage.join("failed-new.exe")).unwrap(), b"new executable contents");
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn rejects_tampered_payload_without_moving_original() {
        let (root, stage, transaction) = fixture();
        fs::write(stage.join(PAYLOAD_NAME), b"tampered").unwrap();
        assert!(replace_and_launch(&stage, &transaction, |_| Err("must not launch".to_string())).is_err());
        assert_eq!(fs::read(root.join(&transaction.target_name)).unwrap(), b"old executable contents");
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn validates_manifest_digest_and_windows_executable_header() {
        let mut payload = vec![0u8; 1_000_000];
        payload[..2].copy_from_slice(b"MZ");
        let digest = sha256(&payload);
        assert!(validate_payload(&payload, &digest).is_ok());
        assert!(validate_payload(&payload, &"0".repeat(64)).is_err());
        assert!(validate_payload(b"not an executable", &sha256(b"not an executable")).is_err());
        assert!(!valid_target_name("../other.exe"));
        assert!(!valid_target_name("folder.exe:stream"));
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn locked_target_is_not_replaced_or_lost() {
        use std::os::windows::fs::OpenOptionsExt;

        let (root, stage, transaction) = fixture();
        let target = root.join(&transaction.target_name);
        let _lock = std::fs::OpenOptions::new()
            .read(true)
            .share_mode(1) // FILE_SHARE_READ only; deny write/delete replacement.
            .open(&target)
            .unwrap();
        assert!(replace_file_atomically(&target, &stage.join(PAYLOAD_NAME), &stage.join(BACKUP_NAME)).is_err());
        assert_eq!(fs::read(&target).unwrap(), b"old executable contents");
        assert!(!stage.join(BACKUP_NAME).exists());
        assert_eq!(fs::read(stage.join(PAYLOAD_NAME)).unwrap(), b"new executable contents");
        drop(_lock);
        let _ = fs::remove_dir_all(root);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn helper_waits_for_the_exact_parent_process() {
        let (root, stage, _) = fixture();
        let mut parent = Command::new("cmd.exe")
            .args(["/C", "ping -n 2 127.0.0.1 > nul"])
            .spawn()
            .unwrap();
        wait_for_parent(&stage, parent.id()).unwrap();
        assert!(stage.join(READY_FILE).is_file());
        assert!(parent.try_wait().unwrap().is_some());
        let _ = fs::remove_dir_all(root);
    }
}
