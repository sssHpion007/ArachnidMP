#[cfg(target_os = "windows")]
mod platform {
    use std::collections::HashSet;
    use std::ffi::c_void;
    use std::mem::size_of;
    use std::thread;
    use std::time::Duration;

    use crate::logger;

    const TH32CS_SNAPPROCESS: u32 = 0x00000002;
    const PROCESS_QUERY_INFORMATION: u32 = 0x0400;
    const PROCESS_VM_READ: u32 = 0x0010;

    #[repr(C)]
    struct ProcessEntry32W {
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

    #[repr(C)]
    struct ProcessMemoryCountersEx {
        cb: u32,
        page_fault_count: u32,
        peak_working_set_size: usize,
        working_set_size: usize,
        quota_peak_paged_pool_usage: usize,
        quota_paged_pool_usage: usize,
        quota_peak_non_paged_pool_usage: usize,
        quota_non_paged_pool_usage: usize,
        pagefile_usage: usize,
        peak_pagefile_usage: usize,
        private_usage: usize,
    }

    #[link(name = "kernel32")]
    extern "system" {
        fn CreateToolhelp32Snapshot(flags: u32, process_id: u32) -> *mut c_void;
        fn Process32FirstW(snapshot: *mut c_void, entry: *mut ProcessEntry32W) -> i32;
        fn Process32NextW(snapshot: *mut c_void, entry: *mut ProcessEntry32W) -> i32;
        fn OpenProcess(access: u32, inherit_handle: i32, process_id: u32) -> *mut c_void;
        fn CloseHandle(handle: *mut c_void) -> i32;
    }

    #[link(name = "psapi")]
    extern "system" {
        fn GetProcessMemoryInfo(
            process: *mut c_void,
            counters: *mut ProcessMemoryCountersEx,
            size: u32,
        ) -> i32;
    }

    struct ProcessInfo {
        process_id: u32,
        parent_process_id: u32,
        name: String,
    }

    #[derive(Default)]
    struct MemoryTotals {
        candidate_count: usize,
        process_count: usize,
        inaccessible_count: usize,
        tree_working_set: u64,
        tree_private_bytes: u64,
        app_working_set: u64,
        app_private_bytes: u64,
        webview_working_set: u64,
        webview_private_bytes: u64,
    }

    fn read_processes() -> Result<Vec<ProcessInfo>, String> {
        unsafe {
            let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
            if snapshot.is_null() || snapshot as isize == -1 {
                return Err(std::io::Error::last_os_error().to_string());
            }

            let mut processes = Vec::new();
            let mut entry: ProcessEntry32W = std::mem::zeroed();
            entry.dw_size = size_of::<ProcessEntry32W>() as u32;
            let mut has_entry = Process32FirstW(snapshot, &mut entry) != 0;
            while has_entry {
                let name_end = entry.sz_exe_file.iter().position(|character| *character == 0)
                    .unwrap_or(entry.sz_exe_file.len());
                processes.push(ProcessInfo {
                    process_id: entry.th32_process_id,
                    parent_process_id: entry.th32_parent_process_id,
                    name: String::from_utf16_lossy(&entry.sz_exe_file[..name_end]).to_ascii_lowercase(),
                });
                has_entry = Process32NextW(snapshot, &mut entry) != 0;
            }
            let _ = CloseHandle(snapshot);
            Ok(processes)
        }
    }

    fn collect_memory_totals(root_pid: u32, processes: &[ProcessInfo]) -> MemoryTotals {
        let mut tree_pids = HashSet::from([root_pid]);
        loop {
            let before = tree_pids.len();
            for process in processes {
                if tree_pids.contains(&process.parent_process_id) {
                    tree_pids.insert(process.process_id);
                }
            }
            if tree_pids.len() == before {
                break;
            }
        }

        let mut totals = MemoryTotals {
            candidate_count: tree_pids.len(),
            ..MemoryTotals::default()
        };
        for process_info in processes.iter().filter(|process| tree_pids.contains(&process.process_id)) {
            unsafe {
                let handle = OpenProcess(
                    PROCESS_QUERY_INFORMATION | PROCESS_VM_READ,
                    0,
                    process_info.process_id,
                );
                if handle.is_null() {
                    totals.inaccessible_count += 1;
                    continue;
                }

                let mut counters: ProcessMemoryCountersEx = std::mem::zeroed();
                counters.cb = size_of::<ProcessMemoryCountersEx>() as u32;
                let result = GetProcessMemoryInfo(
                    handle,
                    &mut counters,
                    size_of::<ProcessMemoryCountersEx>() as u32,
                );
                let _ = CloseHandle(handle);
                if result == 0 {
                    totals.inaccessible_count += 1;
                    continue;
                }

                totals.process_count += 1;
                totals.tree_working_set += counters.working_set_size as u64;
                totals.tree_private_bytes += counters.private_usage as u64;
                if process_info.process_id == root_pid {
                    totals.app_working_set += counters.working_set_size as u64;
                    totals.app_private_bytes += counters.private_usage as u64;
                } else if process_info.name.contains("msedgewebview2") || process_info.name.contains("webview2") {
                    totals.webview_working_set += counters.working_set_size as u64;
                    totals.webview_private_bytes += counters.private_usage as u64;
                }
            }
        }
        totals
    }

    fn mb(bytes: u64) -> f64 {
        bytes as f64 / (1024.0 * 1024.0)
    }

    fn sample_and_log() {
        let root_pid = std::process::id();
        match read_processes() {
            Ok(processes) => {
                let totals = collect_memory_totals(root_pid, &processes);
                logger::log(
                    "INFO",
                    "MEMORY",
                    &format!(
                        "scope=app_process_tree processes={}/{} inaccessible={} working_set_mb={:.1} private_bytes_mb={:.1} app_working_set_mb={:.1} app_private_bytes_mb={:.1} webview_working_set_mb={:.1} webview_private_bytes_mb={:.1}",
                        totals.process_count,
                        totals.candidate_count,
                        totals.inaccessible_count,
                        mb(totals.tree_working_set),
                        mb(totals.tree_private_bytes),
                        mb(totals.app_working_set),
                        mb(totals.app_private_bytes),
                        mb(totals.webview_working_set),
                        mb(totals.webview_private_bytes),
                    ),
                );
            }
            Err(error) => logger::log("WARN", "MEMORY", &format!("process snapshot failed: {error}")),
        }
    }

    pub fn start() {
        let result = thread::Builder::new()
            .name("arachnid-memory-monitor".to_string())
            .spawn(|| {
                thread::sleep(Duration::from_secs(15));
                loop {
                    sample_and_log();
                    thread::sleep(Duration::from_secs(30));
                }
            });
        if let Err(error) = result {
            logger::log("WARN", "MEMORY", &format!("unable to start memory monitor: {error}"));
        }
    }
}

#[cfg(not(target_os = "windows"))]
mod platform {
    pub fn start() {}
}

pub fn start() {
    platform::start();
}
