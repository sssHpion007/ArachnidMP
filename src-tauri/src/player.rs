use rodio::cpal::traits::{DeviceTrait, HostTrait};
use rodio::{Decoder, OutputStream, Sink, Source};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::BufReader;
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

pub enum PlayerCmd {
    Play {
        path: String,
        offset_secs: f64,
        volume: f32,
        duration_hint: Option<f64>,
    },
    Pause,
    Resume,
    Stop,
    Seek {
        position_secs: f64,
    },
    SetVolume {
        volume: f32,
    },
    SetRepeatOne {
        repeat_one: bool,
    },
    SetFadeConfig {
        mode: String,
        duration_secs: f64,
    },
}

#[derive(Clone, Serialize, Deserialize)]
pub struct NativePlayerState {
    pub is_playing: bool,
    pub is_paused: bool,
    pub position: f64,
    pub duration: f64,
    pub volume: f32,
    pub repeat_one: bool,
    pub track_ended: bool,
    pub loop_repeated: bool,
    pub current_path: Option<String>,
}

impl Default for NativePlayerState {
    fn default() -> Self {
        Self {
            is_playing: false,
            is_paused: false,
            position: 0.0,
            duration: 0.0,
            volume: 1.0,
            repeat_one: false,
            track_ended: false,
            loop_repeated: false,
            current_path: None,
        }
    }
}

pub struct NativePlayer {
    sender: Mutex<Sender<PlayerCmd>>,
    state: Arc<Mutex<NativePlayerState>>,
    app_handle: Arc<Mutex<Option<AppHandle>>>,
}

impl NativePlayer {
    pub fn new() -> Self {
        let (tx, rx) = channel::<PlayerCmd>();
        let state = Arc::new(Mutex::new(NativePlayerState::default()));
        let app_handle = Arc::new(Mutex::new(None));

        let thread_state = Arc::clone(&state);
        let thread_app = Arc::clone(&app_handle);

        std::thread::Builder::new()
            .name("arachnid-native-audio".into())
            .spawn(move || {
                run_player_thread(rx, thread_state, thread_app);
            })
            .expect("Failed to spawn native audio thread");

        Self {
            sender: Mutex::new(tx),
            state,
            app_handle,
        }
    }

    pub fn set_app_handle(&self, app: AppHandle) {
        if let Ok(mut handle) = self.app_handle.lock() {
            *handle = Some(app);
        }
    }

    pub fn play(&self, path: String, offset_secs: f64, volume: f32, duration_hint: Option<f64>) -> Result<(), String> {
        let sender = self.sender.lock().map_err(|e| e.to_string())?;
        sender
            .send(PlayerCmd::Play {
                path,
                offset_secs,
                volume,
                duration_hint,
            })
            .map_err(|e| e.to_string())
    }

    pub fn pause(&self) -> Result<(), String> {
        let sender = self.sender.lock().map_err(|e| e.to_string())?;
        sender.send(PlayerCmd::Pause).map_err(|e| e.to_string())
    }

    pub fn resume(&self) -> Result<(), String> {
        let sender = self.sender.lock().map_err(|e| e.to_string())?;
        sender.send(PlayerCmd::Resume).map_err(|e| e.to_string())
    }

    pub fn stop(&self) -> Result<(), String> {
        let sender = self.sender.lock().map_err(|e| e.to_string())?;
        sender.send(PlayerCmd::Stop).map_err(|e| e.to_string())
    }

    pub fn seek(&self, position_secs: f64) -> Result<(), String> {
        let sender = self.sender.lock().map_err(|e| e.to_string())?;
        sender
            .send(PlayerCmd::Seek { position_secs })
            .map_err(|e| e.to_string())
    }

    pub fn set_volume(&self, volume: f32) -> Result<(), String> {
        let sender = self.sender.lock().map_err(|e| e.to_string())?;
        sender
            .send(PlayerCmd::SetVolume { volume })
            .map_err(|e| e.to_string())
    }

    pub fn set_repeat_one(&self, repeat_one: bool) -> Result<(), String> {
        let sender = self.sender.lock().map_err(|e| e.to_string())?;
        sender
            .send(PlayerCmd::SetRepeatOne { repeat_one })
            .map_err(|e| e.to_string())
    }

    pub fn set_fade_config(&self, mode: String, duration_secs: f64) -> Result<(), String> {
        let sender = self.sender.lock().map_err(|e| e.to_string())?;
        sender
            .send(PlayerCmd::SetFadeConfig {
                mode,
                duration_secs,
            })
            .map_err(|e| e.to_string())
    }

    pub fn get_state(&self) -> NativePlayerState {
        let mut s = self.state.lock().unwrap();
        let ended = s.track_ended;
        let looped = s.loop_repeated;
        s.track_ended = false;
        s.loop_repeated = false;

        let mut res = s.clone();
        res.track_ended = ended;
        res.loop_repeated = looped;
        res
    }
}

fn fade_sink_volume(sink: &Sink, from: f32, to: f32, duration_secs: f64) {
    let dur_ms = (duration_secs * 1000.0).max(20.0).min(5000.0) as u64;
    let step_ms = 15u64;
    let steps = (dur_ms / step_ms).max(2);
    for i in 1..=steps {
        let t = i as f32 / steps as f32;
        let smooth_t = t * t * (3.0 - 2.0 * t);
        let vol = from + (to - from) * smooth_t;
        sink.set_volume(vol.clamp(0.0, 1.0));
        std::thread::sleep(Duration::from_millis(step_ms));
    }
    sink.set_volume(to.clamp(0.0, 1.0));
}

fn run_player_thread(
    rx: Receiver<PlayerCmd>,
    shared_state: Arc<Mutex<NativePlayerState>>,
    app_handle: Arc<Mutex<Option<AppHandle>>>,
) {
    // Elevate audio thread priority to Real-Time / Pro Audio on Windows to eliminate buffer underruns
    #[cfg(target_os = "windows")]
    unsafe {
        extern "system" {
            fn GetCurrentThread() -> *mut std::ffi::c_void;
            fn SetThreadPriority(hThread: *mut std::ffi::c_void, nPriority: i32) -> i32;
            fn LoadLibraryA(lpLibFileName: *const u8) -> *mut std::ffi::c_void;
            fn GetProcAddress(hModule: *mut std::ffi::c_void, lpProcName: *const u8) -> *mut std::ffi::c_void;
        }

        let _ = SetThreadPriority(GetCurrentThread(), 15); // THREAD_PRIORITY_TIME_CRITICAL

        let avrt = LoadLibraryA(b"avrt.dll\0".as_ptr());
        if !avrt.is_null() {
            let func = GetProcAddress(avrt, b"AvSetMmThreadCharacteristicsW\0".as_ptr());
            if !func.is_null() {
                type AvSetMmThreadCharacteristicsWFn = unsafe extern "system" fn(*const u16, *mut u32) -> *mut std::ffi::c_void;
                let av_set: AvSetMmThreadCharacteristicsWFn = std::mem::transmute(func);
                let task_name: Vec<u16> = "Pro Audio\0".encode_utf16().collect();
                let mut task_index = 0u32;
                let _ = av_set(task_name.as_ptr(), &mut task_index);
            }
        }
    }

    let output_result = OutputStream::try_default();
    let (mut _stream, mut stream_handle) = match output_result {
        Ok(s) => s,
        Err(e) => {
            eprintln!("NativePlayer: Failed to open default audio output: {:?}", e);
            return;
        }
    };

    let mut current_device_name: Option<String> = rodio::cpal::default_host()
        .default_output_device()
        .and_then(|d| d.name().ok());
    let mut last_device_check = Instant::now();

    let mut sink = match Sink::try_new(&stream_handle) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("NativePlayer: Failed to create Sink: {:?}", e);
            return;
        }
    };

    let mut current_path: Option<String> = None;
    let mut is_playing = false;
    let mut is_paused = false;
    let mut repeat_one = false;
    let mut current_duration = 0.0;
    let mut play_start_pos = 0.0;
    let mut play_start_instant = Instant::now();
    let mut user_target_volume = 1.0f32;
    let mut current_volume = 1.0f32;
    let mut last_emit_instant = Instant::now();
    let mut preloaded_next_loop = false;
    let mut active_volume_fade: Option<(Instant, f32, f32, Duration)> = None;

    let mut fade_mode = "track_change_and_pause".to_string();
    let mut fade_duration = 2.0f64;

    loop {
        // Fast default audio device check (75ms polling + called on Play / Resume)
        // Detects headphone connection/disconnection almost instantly and seamlessly migrates the stream
        if last_device_check.elapsed().as_millis() >= 75 {
            last_device_check = Instant::now();
            if let Some(dev) = rodio::cpal::default_host().default_output_device() {
                if let Ok(name) = dev.name() {
                    if current_device_name.as_deref() != Some(&name) {
                        current_device_name = Some(name);
                        if let Ok((new_stream, new_handle)) = OutputStream::try_default() {
                            _stream = new_stream;
                            stream_handle = new_handle;
                            sink.stop();
                            if let Ok(new_sink) = Sink::try_new(&stream_handle) {
                                sink = new_sink;
                            }
                            sink.set_volume(0.0);

                            if let Some(ref path) = current_path {
                                if let Ok(file) = File::open(path) {
                                    if let Ok(mut decoder) = Decoder::new(BufReader::new(file)) {
                                        let cur_pos = if is_playing && !is_paused {
                                            play_start_pos + play_start_instant.elapsed().as_secs_f64()
                                        } else {
                                            play_start_pos
                                        };

                                        if cur_pos > 0.05 {
                                            let target_dur = Duration::from_secs_f64(cur_pos);
                                            if decoder.try_seek(target_dur).is_err() {
                                                let skipped = decoder.skip_duration(target_dur);
                                                sink.append(skipped);
                                            } else {
                                                sink.append(decoder);
                                            }
                                        } else {
                                            sink.append(decoder);
                                        }

                                        if !is_paused && is_playing {
                                            sink.play();
                                            active_volume_fade = Some((Instant::now(), 0.0, user_target_volume, Duration::from_millis(30)));
                                        } else {
                                            sink.pause();
                                        }

                                        play_start_pos = cur_pos;
                                        play_start_instant = Instant::now();
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // 1. Process all pending commands
        while let Ok(cmd) = rx.try_recv() {
            match cmd {
                PlayerCmd::SetFadeConfig { mode, duration_secs } => {
                    fade_mode = mode;
                    fade_duration = duration_secs.max(0.1);
                }
                PlayerCmd::Play {
                    path,
                    offset_secs,
                    volume,
                    duration_hint,
                } => {
                    user_target_volume = volume;
                    preloaded_next_loop = false;
                    active_volume_fade = None;

                    // Immediately ensure we are routing to the active default audio device
                    if let Some(dev) = rodio::cpal::default_host().default_output_device() {
                        if let Ok(name) = dev.name() {
                            if current_device_name.as_deref() != Some(&name) {
                                current_device_name = Some(name);
                                if let Ok((new_stream, new_handle)) = OutputStream::try_default() {
                                    _stream = new_stream;
                                    stream_handle = new_handle;
                                    sink.stop();
                                    if let Ok(new_sink) = Sink::try_new(&stream_handle) {
                                        sink = new_sink;
                                    }
                                }
                            }
                        }
                    }

                    // Smooth fade out of previous track if currently playing
                    if is_playing && !is_paused && current_volume > 0.01 {
                        if fade_mode != "off" && fade_duration > 0.05 {
                            let fade_out_dur = fade_duration.min(0.6).max(0.08);
                            fade_sink_volume(&sink, current_volume, 0.0, fade_out_dur);
                        } else {
                            fade_sink_volume(&sink, current_volume, 0.0, 0.035);
                        }
                    }

                    sink.stop();
                    sink.set_volume(0.0);

                    if let Some(dh) = duration_hint {
                        if dh > 0.0 {
                            current_duration = dh;
                        }
                    }

                    match File::open(&path) {
                        Ok(file) => match Decoder::new(BufReader::new(file)) {
                            Ok(mut decoder) => {
                                if let Some(dur) = decoder.total_duration() {
                                    let secs = dur.as_secs_f64();
                                    if secs > 0.0 {
                                        current_duration = secs;
                                    }
                                }

                                let safe_offset = offset_secs.max(0.0);
                                if safe_offset > 0.05 {
                                    let offset_dur = Duration::from_secs_f64(safe_offset);
                                    if decoder.try_seek(offset_dur).is_ok() {
                                        sink.append(decoder);
                                    } else {
                                        let skipped = decoder.skip_duration(offset_dur);
                                        sink.append(skipped);
                                    }
                                    play_start_pos = safe_offset;
                                } else {
                                    sink.append(decoder);
                                    play_start_pos = 0.0;
                                }

                                current_path = Some(path);
                                play_start_instant = Instant::now();
                                is_playing = true;
                                is_paused = false;

                                sink.play();

                                if fade_mode != "off" && fade_duration > 0.05 && user_target_volume > 0.01 {
                                    let fade_in_dur = fade_duration.min(2.0).max(0.08);
                                    fade_sink_volume(&sink, 0.0, user_target_volume, fade_in_dur);
                                } else {
                                    fade_sink_volume(&sink, 0.0, user_target_volume, 0.035);
                                }

                                current_volume = user_target_volume;
                                sink.set_volume(current_volume);
                            }
                            Err(e) => {
                                eprintln!("NativePlayer: Decode error: {:?}", e);
                                is_playing = false;
                                is_paused = false;
                            }
                        },
                        Err(e) => {
                            eprintln!("NativePlayer: Open file error: {:?}", e);
                            is_playing = false;
                            is_paused = false;
                        }
                    }
                }
                PlayerCmd::Pause => {
                    active_volume_fade = None;
                    if is_playing && !is_paused {
                        if fade_mode != "off" && fade_duration > 0.05 && current_volume > 0.01 {
                            let fade_out_dur = fade_duration.min(1.0).max(0.08);
                            fade_sink_volume(&sink, current_volume, 0.0, fade_out_dur);
                        } else {
                            fade_sink_volume(&sink, current_volume, 0.0, 0.035);
                        }
                        sink.pause();
                        current_volume = user_target_volume;
                        sink.set_volume(current_volume);
                        is_paused = true;
                        let elapsed = play_start_instant.elapsed().as_secs_f64();
                        play_start_pos = (play_start_pos + elapsed).min(if current_duration > 0.0 { current_duration } else { f64::MAX });
                    }
                }
                PlayerCmd::Resume => {
                    active_volume_fade = None;
                    if is_playing && is_paused {
                        // Immediately ensure we are routing to the active default audio device
                        if let Some(dev) = rodio::cpal::default_host().default_output_device() {
                            if let Ok(name) = dev.name() {
                                if current_device_name.as_deref() != Some(&name) {
                                    current_device_name = Some(name);
                                    if let Ok((new_stream, new_handle)) = OutputStream::try_default() {
                                        _stream = new_stream;
                                        stream_handle = new_handle;
                                        sink.stop();
                                        if let Ok(new_sink) = Sink::try_new(&stream_handle) {
                                            sink = new_sink;
                                        }
                                        if let Some(ref path) = current_path {
                                            if let Ok(file) = File::open(path) {
                                                if let Ok(mut decoder) = Decoder::new(BufReader::new(file)) {
                                                    if play_start_pos > 0.05 {
                                                        let target_dur = Duration::from_secs_f64(play_start_pos);
                                                        if decoder.try_seek(target_dur).is_err() {
                                                            let skipped = decoder.skip_duration(target_dur);
                                                            sink.append(skipped);
                                                        } else {
                                                            sink.append(decoder);
                                                        }
                                                    } else {
                                                        sink.append(decoder);
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        is_paused = false;
                        play_start_instant = Instant::now();
                        if fade_mode != "off" && fade_duration > 0.05 && user_target_volume > 0.01 {
                            sink.set_volume(0.0);
                            sink.play();
                            let fade_in_dur = fade_duration.min(2.0).max(0.08);
                            fade_sink_volume(&sink, 0.0, user_target_volume, fade_in_dur);
                        } else {
                            sink.set_volume(0.0);
                            sink.play();
                            fade_sink_volume(&sink, 0.0, user_target_volume, 0.035);
                        }
                        current_volume = user_target_volume;
                        sink.set_volume(current_volume);
                    }
                }
                PlayerCmd::Stop => {
                    active_volume_fade = None;
                    if is_playing && !is_paused && current_volume > 0.005 {
                        fade_sink_volume(&sink, current_volume, 0.0, 0.035);
                    }
                    sink.stop();
                    current_volume = user_target_volume;
                    sink.set_volume(current_volume);
                    is_playing = false;
                    is_paused = false;
                    current_path = None;
                    play_start_pos = 0.0;
                    preloaded_next_loop = false;
                }
                PlayerCmd::Seek { position_secs } => {
                    let max_dur = if current_duration > 0.1 { current_duration - 0.05 } else { position_secs };
                    let safe_pos = position_secs.max(0.0).min(max_dur);
                    let target_dur = Duration::from_secs_f64(safe_pos);
                    preloaded_next_loop = false;
                    active_volume_fade = None;

                    // Immediately flush CPAL playback queue and silence the hardware output.
                    // Rodio's sink.try_seek must NEVER be called while the sink is running because it
                    // delegates demuxing and disk I/O to the real-time CPAL WASAPI callback thread.
                    // Blocking that real-time callback causes WASAPI to starve and loop its
                    // hardware ring-buffer chunk (~10ms), producing the harsh granular buzz.
                    sink.stop();
                    sink.set_volume(user_target_volume);

                    if let Some(ref path) = current_path {
                        if let Ok(file) = File::open(path) {
                            if let Ok(mut decoder) = Decoder::new(BufReader::new(file)) {
                                if safe_pos > 0.05 {
                                    if decoder.try_seek(target_dur).is_ok() {
                                        sink.append(decoder.fade_in(Duration::from_millis(30)));
                                    } else {
                                        let skipped = decoder.skip_duration(target_dur);
                                        sink.append(skipped.fade_in(Duration::from_millis(30)));
                                    }
                                } else {
                                    sink.append(decoder.fade_in(Duration::from_millis(30)));
                                }
                            }
                        }
                    }

                    if !is_paused {
                        sink.play();
                    } else {
                        sink.pause();
                    }

                    play_start_pos = safe_pos;
                    play_start_instant = Instant::now();

                    // Immediately update shared state and emit time-update
                    if let Ok(mut s) = shared_state.lock() {
                        s.position = safe_pos;
                    }
                    if let Ok(guard) = app_handle.lock() {
                        if let Some(ref handle) = *guard {
                            let _ = handle.emit(
                                "audio://time-update",
                                serde_json::json!({
                                    "position": safe_pos,
                                    "duration": current_duration,
                                }),
                            );
                        }
                    }
                }
                PlayerCmd::SetVolume { volume } => {
                    user_target_volume = volume;
                    if active_volume_fade.is_none() {
                        current_volume = volume;
                        sink.set_volume(volume);
                    }
                }
                PlayerCmd::SetRepeatOne { repeat_one: rep } => {
                    repeat_one = rep;
                }
            }
        }

        // 2. Monitor playback position, active volume fade, and track end
        if let Some((start_time, from_vol, to_vol, dur)) = active_volume_fade {
            let elapsed = start_time.elapsed();
            if elapsed >= dur {
                sink.set_volume(to_vol);
                current_volume = to_vol;
                active_volume_fade = None;
            } else {
                let t = elapsed.as_secs_f32() / dur.as_secs_f32();
                let smooth_t = t * t * (3.0 - 2.0 * t);
                let vol = from_vol + (to_vol - from_vol) * smooth_t;
                sink.set_volume(vol.clamp(0.0, 1.0));
                current_volume = vol;
            }
        }

        if is_playing && !is_paused {
            let elapsed = play_start_instant.elapsed().as_secs_f64();
            let current_pos = play_start_pos + elapsed;

            // End-of-track fade out
            let should_fade_at_end = (fade_mode == "always") || (fade_mode == "track_change_and_pause" && !repeat_one);
            if should_fade_at_end && fade_duration > 0.1 && current_duration > fade_duration {
                let remaining = current_duration - current_pos;
                if remaining <= fade_duration && remaining >= 0.0 {
                    let t = (remaining / fade_duration) as f32;
                    let smooth_t = t * t * (3.0 - 2.0 * t);
                    current_volume = user_target_volume * smooth_t;
                    sink.set_volume(current_volume);
                } else if current_volume < user_target_volume {
                    current_volume = user_target_volume;
                    sink.set_volume(current_volume);
                }
            }

            // Seamless repeat pre-loading:
            // When 1.5s remain and repeat_one is active, preload and append next loop into sink queue!
            if repeat_one && !preloaded_next_loop && current_duration > 3.0 && current_pos >= current_duration - 1.5 {
                if let Some(ref path) = current_path {
                    if let Ok(file) = File::open(path) {
                        if let Ok(decoder) = Decoder::new(BufReader::new(file)) {
                            sink.append(decoder);
                            preloaded_next_loop = true;
                        }
                    }
                }
            }

            // Check if track reached end or looped
            if preloaded_next_loop && sink.len() == 1 {
                // The first source finished and seamlessly transitioned to the preloaded second source with ZERO gap!
                preloaded_next_loop = false;
                play_start_pos = 0.0;
                play_start_instant = Instant::now();

                if let Ok(mut s) = shared_state.lock() {
                    s.loop_repeated = true;
                    s.position = 0.0;
                }

                if let Ok(guard) = app_handle.lock() {
                    if let Some(ref handle) = *guard {
                        let _ = handle.emit("audio://loop-repeat", ());
                        let _ = handle.emit(
                            "audio://time-update",
                            serde_json::json!({
                                "position": 0.0,
                                "duration": current_duration,
                            }),
                        );
                    }
                }
            } else if sink.empty() || (current_duration > 1.0 && current_pos >= current_duration + 2.0) {
                if repeat_one {
                    if let Some(ref path) = current_path {
                        if let Ok(file) = File::open(path) {
                            if let Ok(decoder) = Decoder::new(BufReader::new(file)) {
                                sink.append(decoder);
                                sink.play();
                                play_start_pos = 0.0;
                                play_start_instant = Instant::now();

                                if let Ok(mut s) = shared_state.lock() {
                                    s.loop_repeated = true;
                                    s.position = 0.0;
                                }

                                if let Ok(guard) = app_handle.lock() {
                                    if let Some(ref handle) = *guard {
                                        let _ = handle.emit("audio://loop-repeat", ());
                                        let _ = handle.emit(
                                            "audio://time-update",
                                            serde_json::json!({
                                                "position": 0.0,
                                                "duration": current_duration,
                                            }),
                                        );
                                    }
                                }
                            }
                        }
                    }
                } else {
                    is_playing = false;
                    is_paused = false;
                    play_start_pos = 0.0;
                    preloaded_next_loop = false;

                    if let Ok(mut s) = shared_state.lock() {
                        s.track_ended = true;
                        s.is_playing = false;
                        s.position = 0.0;
                    }

                    if let Ok(guard) = app_handle.lock() {
                        if let Some(ref handle) = *guard {
                            let _ = handle.emit("audio://track-ended", ());
                            let _ = handle.emit(
                                "audio://time-update",
                                serde_json::json!({
                                    "position": 0.0,
                                    "duration": current_duration,
                                }),
                            );
                        }
                    }
                }
            } else if last_emit_instant.elapsed().as_millis() >= 250 {
                last_emit_instant = Instant::now();
                if let Ok(guard) = app_handle.lock() {
                    if let Some(ref handle) = *guard {
                        let _ = handle.emit(
                            "audio://time-update",
                            serde_json::json!({
                                "position": current_pos,
                                "duration": current_duration,
                            }),
                        );
                    }
                }
            }
        }

        // 3. Keep shared state synchronized for instant query
        {
            if let Ok(mut s) = shared_state.lock() {
                s.is_playing = is_playing && !is_paused;
                s.is_paused = is_paused;
                s.volume = current_volume;
                s.repeat_one = repeat_one;
                s.duration = current_duration;
                s.current_path = current_path.clone();
                if is_playing && !is_paused {
                    let elapsed = play_start_instant.elapsed().as_secs_f64();
                    s.position = play_start_pos + elapsed;
                } else {
                    s.position = play_start_pos;
                }
            }
        }

        std::thread::sleep(Duration::from_millis(10));
    }
}
