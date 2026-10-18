// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "windows")]
    if arachnid_lib::run_portable_update_helper_if_requested() {
        return;
    }

    arachnid_lib::run();
}
