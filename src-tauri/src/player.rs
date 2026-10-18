use rodio::cpal::traits::{DeviceTrait, HostTrait};
use rodio::source::SeekError;
use rodio::{Decoder, OutputStream, Sink, Source};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::BufReader;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use crate::logger;

#[derive(Clone, Debug)]
pub struct GlitchReport {
    pub sample_pos: u64,
    pub channel: u16,
    pub prev_val: i16,
    pub curr_val: i16,
    pub delta: i32,
    pub time_secs: f64,
}

#[derive(Clone, Debug)]
pub struct SmoothSourceHandle {
    target_gain_fp: Arc<AtomicU32>, // 0 to 1_000_000 (1_000_000 = 1.0)
    gain_step_fp: Arc<AtomicU32>,   // step per audio frame
    is_silent: Arc<AtomicBool>,
    snap_gain_to_target: Arc<AtomicBool>,
    sample_rate: u32,
}

impl SmoothSourceHandle {
    pub fn new(sample_rate: u32) -> Self {
        Self {
            target_gain_fp: Arc::new(AtomicU32::new(0)),
            gain_step_fp: Arc::new(AtomicU32::new(10_000)),
            is_silent: Arc::new(AtomicBool::new(true)),
            snap_gain_to_target: Arc::new(AtomicBool::new(false)),
            sample_rate: sample_rate.max(8000),
        }
    }

    pub fn fade_to(&self, target_volume: f32, duration_ms: u64) {
        let target_fp = ((target_volume.clamp(0.0, 1.0) * 1_000_000.0) as u32).min(1_000_000);
        let dur_ms = duration_ms.max(4);
        let frames = ((self.sample_rate as f64) * (dur_ms as f64 / 1000.0)).max(32.0) as u32;
        let step = (1_000_000 / frames).max(1);

        self.snap_gain_to_target.store(false, Ordering::Release);
        self.gain_step_fp.store(step, Ordering::Release);
        self.target_gain_fp.store(target_fp, Ordering::Release);
        if target_fp > 0 {
            self.is_silent.store(false, Ordering::Release);
        }
    }

    /// Set the source gain immediately for a new track, without a fade-in.
    pub fn set_gain_immediately(&self, target_volume: f32) {
        let target_fp = ((target_volume.clamp(0.0, 1.0) * 1_000_000.0) as u32).min(1_000_000);
        self.gain_step_fp.store(1_000_000, Ordering::Relaxed);
        self.target_gain_fp.store(target_fp, Ordering::Relaxed);
        self.snap_gain_to_target.store(true, Ordering::Release);
        self.is_silent.store(target_fp == 0, Ordering::Release);
    }

    pub fn is_silent(&self) -> bool {
        self.is_silent.load(Ordering::Acquire)
    }

    pub fn wait_until_silent(&self, max_wait: Duration) {
        let start = Instant::now();
        while !self.is_silent() && start.elapsed() < max_wait {
            std::thread::sleep(Duration::from_millis(2));
        }
    }
}

pub struct SmoothAudioSource<I> {
    inner: I,
    channels: u16,
    curr_channel: usize,
    current_gain_fp: u32,
    handle: SmoothSourceHandle,
    prev_samples: [i16; 8],
    samples_yielded: u64,
    glitch_tx: Sender<GlitchReport>,
}

impl<I> SmoothAudioSource<I>
where
    I: Source<Item = i16>,
{
    pub fn new(inner: I, glitch_tx: Sender<GlitchReport>) -> (Self, SmoothSourceHandle) {
        let channels = inner.channels().max(1);
        let sample_rate = inner.sample_rate();
        let handle = SmoothSourceHandle::new(sample_rate);
        let source = Self {
            inner,
            channels,
            curr_channel: 0,
            current_gain_fp: 0, // starts at exact zero
            handle: handle.clone(),
            prev_samples: [0; 8],
            samples_yielded: 0,
            glitch_tx,
        };
        (source, handle)
    }
}

impl<I> Iterator for SmoothAudioSource<I>
where
    I: Source<Item = i16>,
{
    type Item = i16;

    #[inline]
    fn next(&mut self) -> Option<i16> {
        let raw = match self.inner.next() {
            Some(s) => s,
            None => {
                self.handle.is_silent.store(true, Ordering::Release);
                return None;
            }
        };

        let ch = self.curr_channel;
        self.curr_channel += 1;
        if self.curr_channel >= self.channels as usize {
            self.curr_channel = 0;
            // On audio frame boundary, either snap to a new track's target gain
            // or smoothly advance for fades such as pause and manual switch-out.
            let snap_to_target = self.handle.snap_gain_to_target.swap(false, Ordering::AcqRel);
            let target = self.handle.target_gain_fp.load(Ordering::Relaxed);
            let step = self.handle.gain_step_fp.load(Ordering::Relaxed);

            if snap_to_target {
                self.current_gain_fp = target;
            } else if self.current_gain_fp < target {
                self.current_gain_fp = (self.current_gain_fp + step).min(target);
            } else if self.current_gain_fp > target {
                if self.current_gain_fp <= step {
                    self.current_gain_fp = 0;
                } else {
                    self.current_gain_fp -= step;
                }
            }

            if self.current_gain_fp == 0 && target == 0 {
                self.handle.is_silent.store(true, Ordering::Release);
            }
        }

        self.samples_yielded += 1;

        let gain = (self.current_gain_fp as f32) / 1_000_000.0;
        let sample = (raw as f32 * gain) as i16;

        // Real-time step discontinuity (pop/click) detection
        let prev = self.prev_samples[ch % 8];
        let delta = (sample as i32 - prev as i32).abs();
        self.prev_samples[ch % 8] = sample;

        // In bandlimited audio (<20kHz), delta > 14000 (~43% full-scale) indicates a digital pop
        if self.samples_yielded > 512 && delta > 14000 {
            let _ = self.glitch_tx.send(GlitchReport {
                sample_pos: self.samples_yielded,
                channel: ch as u16,
                prev_val: prev,
                curr_val: sample,
                delta,
                time_secs: if self.handle.sample_rate > 0 && self.channels > 0 {
                    (self.samples_yielded as f64) / ((self.handle.sample_rate as f64) * (self.channels as f64))
                } else {
                    0.0
                },
            });
        }

        Some(sample)
    }

    #[inline]
    fn size_hint(&self) -> (usize, Option<usize>) {
        self.inner.size_hint()
    }
}

impl<I> Source for SmoothAudioSource<I>
where
    I: Source<Item = i16>,
{
    #[inline]
    fn current_frame_len(&self) -> Option<usize> {
        self.inner.current_frame_len()
    }

    #[inline]
    fn channels(&self) -> u16 {
        self.channels
    }

    #[inline]
    fn sample_rate(&self) -> u32 {
        self.handle.sample_rate
    }

    #[inline]
    fn total_duration(&self) -> Option<Duration> {
        self.inner.total_duration()
    }

    #[inline]
    fn try_seek(&mut self, pos: Duration) -> Result<(), SeekError> {
        self.current_gain_fp = 0;
        self.prev_samples = [0; 8];
        self.inner.try_seek(pos)
    }
}

pub enum PlayerCmd {
    Play {
        path: String,
        offset_secs: f64,
        volume: f32,
        duration_hint: Option<f64>,
        repeat_one: Option<bool>,
        fade_out_previous: bool,
    },
    Pause,
    Resume,
    Stop {
        fade_out: bool,
    },
    Seek {
        position_secs: f64,
    },
    ScrubHold,
    ScrubCancel,
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

    pub fn play(
        &self,
        path: String,
        offset_secs: f64,
        volume: f32,
        duration_hint: Option<f64>,
        repeat_one: Option<bool>,
        fade_out_previous: bool,
    ) -> Result<(), String> {
        let sender = self.sender.lock().map_err(|e| e.to_string())?;
        sender
            .send(PlayerCmd::Play {
                path,
                offset_secs,
                volume,
                duration_hint,
                repeat_one,
                fade_out_previous,
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

    pub fn stop(&self, fade_out: bool) -> Result<(), String> {
        let sender = self.sender.lock().map_err(|e| e.to_string())?;
        sender.send(PlayerCmd::Stop { fade_out }).map_err(|e| e.to_string())
    }

    pub fn seek(&self, position_secs: f64) -> Result<(), String> {
        let sender = self.sender.lock().map_err(|e| e.to_string())?;
        sender
            .send(PlayerCmd::Seek { position_secs })
            .map_err(|e| e.to_string())
    }

    pub fn scrub_hold(&self) -> Result<(), String> {
        let sender = self.sender.lock().map_err(|e| e.to_string())?;
        sender
            .send(PlayerCmd::ScrubHold)
            .map_err(|e| e.to_string())
    }

    pub fn scrub_cancel(&self) -> Result<(), String> {
        let sender = self.sender.lock().map_err(|e| e.to_string())?;
        sender
            .send(PlayerCmd::ScrubCancel)
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

fn append_smooth_source<S: Source<Item = i16> + Send + 'static>(
    sink: &Sink,
    src: S,
    glitch_tx: Sender<GlitchReport>,
) -> SmoothSourceHandle {
    let (smooth_src, handle) = SmoothAudioSource::new(src, glitch_tx);
    sink.append(smooth_src);
    handle
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
    let mut is_scrub_holding = false;
    let mut repeat_one = false;
    let mut current_duration = 0.0;
    let mut play_start_pos = 0.0;
    let mut play_start_instant = Instant::now();
    let mut user_target_volume = 1.0f32;
    let mut current_volume = 1.0f32;
    let mut last_emit_instant = Instant::now();
    let mut preloaded_next_loop = false;
    let mut active_volume_fade: Option<(Instant, f32, f32, Duration)> = None;

    let (glitch_tx, glitch_rx) = channel::<GlitchReport>();
    let mut current_handle: Option<SmoothSourceHandle> = None;
    let mut preloaded_handle: Option<SmoothSourceHandle> = None;

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

                            if let Some(ref path) = current_path {
                                if let Ok(file) = File::open(path) {
                                    if let Ok(mut decoder) = Decoder::new(BufReader::new(file)) {
                                        let cur_pos = if is_playing && !is_paused {
                                            play_start_pos + play_start_instant.elapsed().as_secs_f64()
                                        } else {
                                            play_start_pos
                                        };

                                        let handle = if cur_pos > 0.05 {
                                            let target_dur = Duration::from_secs_f64(cur_pos);
                                            if cur_pos > 0.08 {
                                                let preroll_dur = Duration::from_secs_f64(cur_pos - 0.040);
                                                if decoder.try_seek(preroll_dur).is_ok() {
                                                    let sr = decoder.sample_rate().max(8000) as usize;
                                                    let ch = decoder.channels().max(1) as usize;
                                                    let samples_to_discard = (sr * ch * 40) / 1000;
                                                    for _ in 0..samples_to_discard {
                                                        if decoder.next().is_none() {
                                                            break;
                                                        }
                                                    }
                                                    append_smooth_source(&sink, decoder, glitch_tx.clone())
                                                } else if decoder.try_seek(target_dur).is_err() {
                                                    let skipped = decoder.skip_duration(target_dur);
                                                    append_smooth_source(&sink, skipped, glitch_tx.clone())
                                                } else {
                                                    append_smooth_source(&sink, decoder, glitch_tx.clone())
                                                }
                                            } else if decoder.try_seek(target_dur).is_err() {
                                                let skipped = decoder.skip_duration(target_dur);
                                                append_smooth_source(&sink, skipped, glitch_tx.clone())
                                            } else {
                                                append_smooth_source(&sink, decoder, glitch_tx.clone())
                                            }
                                        } else {
                                            append_smooth_source(&sink, decoder, glitch_tx.clone())
                                        };

                                        current_handle = Some(handle.clone());

                                        if !is_paused && is_playing {
                                            handle.fade_to(user_target_volume, 30);
                                            sink.play();
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
                    repeat_one: rep_opt,
                    fade_out_previous,
                } => {
                    user_target_volume = volume;
                    preloaded_next_loop = false;
                    preloaded_handle = None;
                    active_volume_fade = None;
                    if let Some(r) = rep_opt {
                        repeat_one = r;
                    }

                    logger::log("AUDIO", "PLAYER", &format!("Play command received: {:?} (offset={:.3}s, vol={:.2})", path, offset_secs, volume));

                    // Immediately ensure we are routing to the active default audio device
                    if let Some(dev) = rodio::cpal::default_host().default_output_device() {
                        if let Ok(name) = dev.name() {
                            if current_device_name.as_deref() != Some(&name) {
                                current_device_name = Some(name);
                                if let Ok((new_stream, new_handle)) = OutputStream::try_default() {
                                    _stream = new_stream;
                                    stream_handle = new_handle;
                                }
                            }
                        }
                    }

                    // Fade the outgoing track only for a user-requested switch.
                    // Automatic queue advances must preserve the current track's full ending.
                    if fade_out_previous && is_playing && !is_paused {
                        if let Some(ref handle) = current_handle {
                            let fade_out_ms = if fade_mode != "off" && fade_duration > 0.05 {
                                (fade_duration.min(0.6).max(0.08) * 1000.0) as u64
                            } else {
                                12
                            };
                            handle.fade_to(0.0, fade_out_ms);
                            handle.wait_until_silent(Duration::from_millis(fade_out_ms + 25));
                        }
                    }

                    sink.stop();
                    if let Ok(new_sink) = Sink::try_new(&stream_handle) {
                        sink = new_sink;
                    }

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

                                logger::log(
                                    "AUDIO",
                                    "DECODER",
                                    &format!(
                                        "Opened file: channels={}, sample_rate={}Hz, duration={:.2}s",
                                        decoder.channels(),
                                        decoder.sample_rate(),
                                        current_duration
                                    ),
                                );

                                let safe_offset = offset_secs.max(0.0);
                                let handle = if safe_offset > 0.05 {
                                    let offset_dur = Duration::from_secs_f64(safe_offset);
                                    if safe_offset > 0.08 {
                                        let preroll_dur = Duration::from_secs_f64(safe_offset - 0.040);
                                        if decoder.try_seek(preroll_dur).is_ok() {
                                            let sr = decoder.sample_rate().max(8000) as usize;
                                            let ch = decoder.channels().max(1) as usize;
                                            let samples_to_discard = (sr * ch * 40) / 1000;
                                            for _ in 0..samples_to_discard {
                                                if decoder.next().is_none() {
                                                    break;
                                                }
                                            }
                                            append_smooth_source(&sink, decoder, glitch_tx.clone())
                                        } else if decoder.try_seek(offset_dur).is_ok() {
                                            append_smooth_source(&sink, decoder, glitch_tx.clone())
                                        } else {
                                            let skipped = decoder.skip_duration(offset_dur);
                                            append_smooth_source(&sink, skipped, glitch_tx.clone())
                                        }
                                    } else if decoder.try_seek(offset_dur).is_ok() {
                                        append_smooth_source(&sink, decoder, glitch_tx.clone())
                                    } else {
                                        let skipped = decoder.skip_duration(offset_dur);
                                        append_smooth_source(&sink, skipped, glitch_tx.clone())
                                    }
                                } else {
                                    append_smooth_source(&sink, decoder, glitch_tx.clone())
                                };

                                play_start_pos = safe_offset;
                                current_handle = Some(handle.clone());
                                current_path = Some(path);
                                play_start_instant = Instant::now();
                                is_playing = true;
                                is_paused = false;

                                // Do not crossfade the incoming track: start it immediately
                                // at the target volume after any outgoing manual fade.
                                handle.set_gain_immediately(user_target_volume);
                                sink.play();
                                current_volume = user_target_volume;
                            }
                            Err(e) => {
                                eprintln!("NativePlayer: Decode error: {:?}", e);
                                logger::log("AUDIO", "ERROR", &format!("Decoder error: {:?}", e));
                                is_playing = false;
                                is_paused = false;
                            }
                        },
                        Err(e) => {
                            eprintln!("NativePlayer: Open file error: {:?}", e);
                            logger::log("AUDIO", "ERROR", &format!("Open file error: {:?}", e));
                            is_playing = false;
                            is_paused = false;
                        }
                    }
                }
                PlayerCmd::Pause => {
                    active_volume_fade = None;
                    is_scrub_holding = false;
                    if is_playing && !is_paused {
                        let fade_out_ms = if fade_mode != "off" && fade_duration > 0.05 && current_volume > 0.01 {
                            (fade_duration.min(2.0).max(0.08) * 1000.0) as u64
                        } else {
                            12
                        };
                        if let Some(ref handle) = current_handle {
                            handle.fade_to(0.0, fade_out_ms);
                            handle.wait_until_silent(Duration::from_millis(fade_out_ms + 35));
                        }
                        sink.pause();
                        current_volume = 0.0;
                        is_paused = true;
                        let elapsed = play_start_instant.elapsed().as_secs_f64();
                        play_start_pos = (play_start_pos + elapsed).min(if current_duration > 0.0 { current_duration } else { f64::MAX });
                        logger::log("AUDIO", "PAUSE", &format!("Paused at pos={:.3}s (smoothly faded to exact zero on samples)", play_start_pos));
                    }
                }
                PlayerCmd::Resume => {
                    active_volume_fade = None;
                    is_scrub_holding = false;
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
                                                    let handle = if play_start_pos > 0.05 {
                                                        let target_dur = Duration::from_secs_f64(play_start_pos);
                                                        if decoder.try_seek(target_dur).is_err() {
                                                            let skipped = decoder.skip_duration(target_dur);
                                                            append_smooth_source(&sink, skipped, glitch_tx.clone())
                                                        } else {
                                                            append_smooth_source(&sink, decoder, glitch_tx.clone())
                                                        }
                                                    } else {
                                                        append_smooth_source(&sink, decoder, glitch_tx.clone())
                                                    };
                                                    current_handle = Some(handle);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        is_paused = false;
                        play_start_instant = Instant::now();

                        let fade_in_ms = if fade_mode != "off" && fade_duration > 0.05 && user_target_volume > 0.01 {
                            (fade_duration.min(2.0).max(0.08) * 1000.0) as u64
                        } else {
                            15
                        };
                        if let Some(ref handle) = current_handle {
                            handle.fade_to(user_target_volume, fade_in_ms);
                        }
                        sink.play();
                        current_volume = user_target_volume;
                        logger::log("AUDIO", "RESUME", &format!("Resumed from pos={:.3}s (vol={:.2})", play_start_pos, user_target_volume));
                    }
                }
                PlayerCmd::Stop { fade_out } => {
                    active_volume_fade = None;
                    is_scrub_holding = false;
                    if is_playing && !is_paused {
                        if let Some(ref handle) = current_handle {
                            let fade_out_ms = if fade_out && fade_mode != "off" && current_volume > 0.01 {
                                (fade_duration.min(2.0).max(0.08) * 1000.0) as u64
                            } else {
                                12
                            };
                            handle.fade_to(0.0, fade_out_ms);
                            handle.wait_until_silent(Duration::from_millis(fade_out_ms + 25));
                        }
                    }
                    sink.stop();
                    current_volume = 0.0;
                    is_playing = false;
                    is_paused = false;
                    current_path = None;
                    play_start_pos = 0.0;
                    preloaded_next_loop = false;
                    current_handle = None;
                    logger::log("AUDIO", "STOP", "Playback stopped and queue cleared");
                }
                PlayerCmd::ScrubHold => {
                    active_volume_fade = None;
                    if is_playing && !is_paused && !is_scrub_holding {
                        if let Some(ref handle) = current_handle {
                            handle.fade_to(0.0, 10);
                            handle.wait_until_silent(Duration::from_millis(25));
                        }
                        sink.pause();
                        current_volume = 0.0;
                        is_scrub_holding = true;
                        let elapsed = play_start_instant.elapsed().as_secs_f64();
                        play_start_pos = (play_start_pos + elapsed).min(if current_duration > 0.0 { current_duration } else { f64::MAX });
                        logger::log("AUDIO", "SEEK", "ScrubHold: audio held in silence for scrubbing");
                    }
                }
                PlayerCmd::ScrubCancel => {
                    if is_scrub_holding {
                        is_scrub_holding = false;
                        if is_playing && !is_paused {
                            if let Some(ref handle) = current_handle {
                                handle.fade_to(user_target_volume, 15);
                            }
                            sink.play();
                            current_volume = user_target_volume;
                            logger::log("AUDIO", "SEEK", "ScrubCancel: audio resumed from pre-scrub position");
                        }
                    }
                }
                PlayerCmd::Seek { position_secs } => {
                    let t0 = Instant::now();
                    let max_dur = if current_duration > 0.1 { current_duration - 0.05 } else { position_secs };
                    let safe_pos = position_secs.max(0.0).min(max_dur);
                    let target_dur = Duration::from_secs_f64(safe_pos);
                    preloaded_next_loop = false;
                    active_volume_fade = None;

                    let should_resume = !is_paused;
                    is_scrub_holding = false;

                    logger::log("AUDIO", "SEEK", &format!("Seek requested: target={:.3}s (safe={:.3}s, total_dur={:.3}s, is_paused={}, should_resume={})", position_secs, safe_pos, current_duration, is_paused, should_resume));

                    // Micro-fade playing sound to exact 0.0 over 10ms before stopping sink
                    if is_playing {
                        if let Some(ref handle) = current_handle {
                            handle.fade_to(0.0, 10);
                            handle.wait_until_silent(Duration::from_millis(25));
                        }
                    }
                    sink.stop();

                    // Discard old sink queue and create fresh Sink instance
                    if let Ok(new_sink) = Sink::try_new(&stream_handle) {
                        sink = new_sink;
                    }

                    let mut seek_done = false;

                    // Open fresh decoder at seek target position with pre-roll flush to prime MDCT filters
                    if let Some(ref path) = current_path {
                        if let Ok(file) = File::open(path) {
                            if let Ok(mut decoder) = Decoder::new(BufReader::new(file)) {
                                let handle = if safe_pos > 0.05 {
                                    if safe_pos > 0.08 {
                                        let preroll_dur = Duration::from_secs_f64(safe_pos - 0.040);
                                        if decoder.try_seek(preroll_dur).is_ok() {
                                            let sr = decoder.sample_rate().max(8000) as usize;
                                            let ch = decoder.channels().max(1) as usize;
                                            let samples_to_discard = (sr * ch * 40) / 1000;
                                            for _ in 0..samples_to_discard {
                                                if decoder.next().is_none() {
                                                    break;
                                                }
                                            }
                                            append_smooth_source(&sink, decoder, glitch_tx.clone())
                                        } else if decoder.try_seek(target_dur).is_err() {
                                            let skipped = decoder.skip_duration(target_dur);
                                            append_smooth_source(&sink, skipped, glitch_tx.clone())
                                        } else {
                                            append_smooth_source(&sink, decoder, glitch_tx.clone())
                                        }
                                    } else if decoder.try_seek(target_dur).is_err() {
                                        let skipped = decoder.skip_duration(target_dur);
                                        append_smooth_source(&sink, skipped, glitch_tx.clone())
                                    } else {
                                        append_smooth_source(&sink, decoder, glitch_tx.clone())
                                    }
                                } else {
                                    append_smooth_source(&sink, decoder, glitch_tx.clone())
                                };

                                current_handle = Some(handle.clone());

                                if should_resume {
                                    handle.fade_to(user_target_volume, 20);
                                    sink.play();
                                    current_volume = user_target_volume;
                                } else {
                                    sink.pause();
                                    current_volume = 0.0;
                                }

                                seek_done = true;
                            }
                        }
                    }

                    if !seek_done {
                        let _ = sink.try_seek(target_dur);
                        if should_resume {
                            sink.play();
                            current_volume = user_target_volume;
                        } else {
                            sink.pause();
                            current_volume = 0.0;
                        }
                    }

                    play_start_pos = safe_pos;
                    play_start_instant = Instant::now();

                    logger::log("AUDIO", "SEEK", &format!("Seek completed in {:.2}ms (clean sink created)", t0.elapsed().as_secs_f64() * 1000.0));

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
                    if !is_paused && !is_scrub_holding {
                        current_volume = volume;
                        if let Some(ref handle) = current_handle {
                            handle.fade_to(volume, 20);
                        }
                    }
                }
                PlayerCmd::SetRepeatOne { repeat_one: rep } => {
                    if repeat_one && !rep {
                        // User turned off repeat-one: purge any preloaded loop so it never plays!
                        if preloaded_next_loop {
                            preloaded_next_loop = false;
                            preloaded_handle = None;
                            if is_playing {
                                let elapsed = play_start_instant.elapsed().as_secs_f64();
                                let cur_pos = play_start_pos + elapsed;
                                sink.stop();
                                if let Ok(new_sink) = Sink::try_new(&stream_handle) {
                                    sink = new_sink;
                                }
                                if let Some(ref path) = current_path {
                                    if let Ok(file) = File::open(path) {
                                        if let Ok(mut decoder) = Decoder::new(BufReader::new(file)) {
                                            let handle = if cur_pos > 0.05 {
                                                let target_dur = Duration::from_secs_f64(cur_pos);
                                                if decoder.try_seek(target_dur).is_err() {
                                                    let skipped = decoder.skip_duration(target_dur);
                                                    append_smooth_source(&sink, skipped, glitch_tx.clone())
                                                } else {
                                                    append_smooth_source(&sink, decoder, glitch_tx.clone())
                                                }
                                            } else {
                                                append_smooth_source(&sink, decoder, glitch_tx.clone())
                                            };
                                            handle.fade_to(user_target_volume, 10);
                                            current_handle = Some(handle);
                                            if !is_paused {
                                                sink.play();
                                            }
                                            play_start_pos = cur_pos;
                                            play_start_instant = Instant::now();
                                        }
                                    }
                                }
                            }
                        }
                    }
                    repeat_one = rep;
                }
            }
        }

        // 2. Monitor playback position, active volume fade, and track end
        if let Some((start_time, from_vol, to_vol, dur)) = active_volume_fade {
            let elapsed = start_time.elapsed();
            if elapsed >= dur {
                if let Some(ref handle) = current_handle {
                    handle.fade_to(to_vol, 10);
                }
                current_volume = to_vol;
                active_volume_fade = None;
            } else {
                let t = elapsed.as_secs_f32() / dur.as_secs_f32();
                let smooth_t = t * t * (3.0 - 2.0 * t);
                let vol = from_vol + (to_vol - from_vol) * smooth_t;
                if let Some(ref handle) = current_handle {
                    handle.fade_to(vol, 10);
                }
                current_volume = vol;
            }
        }

        if is_playing && !is_paused {
            let elapsed = play_start_instant.elapsed().as_secs_f64();
            let current_pos = play_start_pos + elapsed;

            // The normal "track_change_and_pause" mode must leave the whole
            // track audible for automatic queue advance, even in "always" mode.
            // Preserve the existing "always" fade only for repeat-one looping.
            let should_fade_at_end = fade_mode == "always" && repeat_one;
            if should_fade_at_end && fade_duration > 0.1 && current_duration > fade_duration {
                let remaining = current_duration - current_pos;
                if remaining <= fade_duration && remaining >= 0.0 {
                    let t = (remaining / fade_duration) as f32;
                    let smooth_t = t * t * (3.0 - 2.0 * t);
                    current_volume = user_target_volume * smooth_t;
                    if let Some(ref handle) = current_handle {
                        handle.fade_to(current_volume, 10);
                    }
                } else if remaining < 0.0 {
                    // Track is past end duration: keep volume strictly at zero, never spike back up!
                    current_volume = 0.0;
                    if let Some(ref handle) = current_handle {
                        handle.fade_to(0.0, 10);
                    }
                } else if current_volume < user_target_volume {
                    current_volume = user_target_volume;
                    if let Some(ref handle) = current_handle {
                        handle.fade_to(current_volume, 10);
                    }
                }
            }

            // Seamless repeat pre-loading:
            // When 1.5s remain and repeat_one is active, preload and append next loop into sink queue!
            if repeat_one && !preloaded_next_loop && current_duration > 3.0 && current_pos >= current_duration - 1.5 {
                if let Some(ref path) = current_path {
                    if let Ok(file) = File::open(path) {
                        if let Ok(decoder) = Decoder::new(BufReader::new(file)) {
                            let handle = append_smooth_source(&sink, decoder, glitch_tx.clone());
                            handle.fade_to(user_target_volume, 15);
                            preloaded_handle = Some(handle);
                            preloaded_next_loop = true;
                            logger::log("AUDIO", "REPEAT", "Preloaded next loop into gapless sink queue");
                        }
                    }
                }
            }

            // Check if track reached end or looped
            if repeat_one && preloaded_next_loop && sink.len() == 1 {
                // The first source finished and seamlessly transitioned to the preloaded second source with ZERO gap!
                preloaded_next_loop = false;
                current_handle = preloaded_handle.take();
                play_start_pos = 0.0;
                play_start_instant = Instant::now();
                logger::log("AUDIO", "REPEAT", "Seamless loop transition completed");

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
            } else if !repeat_one && preloaded_next_loop && sink.len() == 1 {
                // Repeat was turned off after preloading: do NOT play the second loop! Stop and end track cleanly.
                preloaded_next_loop = false;
                preloaded_handle = None;
                current_handle = None;
                sink.stop();
                if let Ok(new_sink) = Sink::try_new(&stream_handle) {
                    sink = new_sink;
                }
                is_playing = false;
                is_paused = false;
                play_start_pos = 0.0;

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
            } else if sink.empty()
                || (should_fade_at_end && current_duration > 1.0 && current_pos >= current_duration + 0.1)
                || (current_duration > 1.0 && current_pos >= current_duration + 2.0)
            {
                if repeat_one {
                    if let Some(ref path) = current_path {
                        if let Ok(file) = File::open(path) {
                            if let Ok(decoder) = Decoder::new(BufReader::new(file)) {
                                let handle = append_smooth_source(&sink, decoder, glitch_tx.clone());
                                handle.fade_to(user_target_volume, 15);
                                current_handle = Some(handle);
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
                    current_handle = None;

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

        // Drain and log real-time glitch reports from the audio callback inspector
        while let Ok(glitch) = glitch_rx.try_recv() {
            logger::log(
                "AUDIO",
                "POP_DETECTED",
                &format!(
                    "Step discontinuity: Delta={} (from {:+} to {:+}) at {:.3}s (sample #{}, ch {})",
                    glitch.delta,
                    glitch.prev_val,
                    glitch.curr_val,
                    glitch.time_secs,
                    glitch.sample_pos,
                    glitch.channel
                ),
            );
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

        std::thread::sleep(Duration::from_millis(5));
    }
}
