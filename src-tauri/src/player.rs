use rodio::cpal::traits::{DeviceTrait, HostTrait};
use rodio::source::SeekError;
use rodio::{Decoder, OutputStream, Sink, Source};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::BufReader;
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

pub struct SafeAudioSource<I> {
    inner: I,
    channels: u16,
    sample_rate: u32,
    curr_channel: usize,
    prev_samples: [i16; 8],
    samples_yielded: u64,
    fade_in_pos: usize,
    fade_in_len: usize,
    glitch_tx: Sender<GlitchReport>,
}

impl<I> SafeAudioSource<I>
where
    I: Source<Item = i16>,
{
    pub fn new(inner: I, glitch_tx: Sender<GlitchReport>) -> Self {
        let channels = inner.channels().max(1);
        let sample_rate = inner.sample_rate();
        // 256 samples per channel (~5.3ms at 48kHz): startup S-curve zero-crossing anti-click ramp
        let ramp_len = (channels as usize) * 256;
        Self {
            inner,
            channels,
            sample_rate,
            curr_channel: 0,
            prev_samples: [0; 8],
            samples_yielded: 0,
            fade_in_pos: 0,
            fade_in_len: ramp_len,
            glitch_tx,
        }
    }
}

impl<I> Iterator for SafeAudioSource<I>
where
    I: Source<Item = i16>,
{
    type Item = i16;

    #[inline]
    fn next(&mut self) -> Option<i16> {
        let raw = self.inner.next()?;
        let ch = self.curr_channel % (self.channels as usize).max(1);
        self.curr_channel += 1;
        self.samples_yielded += 1;

        let sample = if self.fade_in_pos < self.fade_in_len {
            let t = (self.fade_in_pos as f32) / (self.fade_in_len as f32);
            let factor = t * t * (3.0 - 2.0 * t);
            self.fade_in_pos += 1;
            (raw as f32 * factor) as i16
        } else {
            raw
        };

        // Real-time step discontinuity (pop/click) detection
        let prev = self.prev_samples[ch];
        let delta = (sample as i32 - prev as i32).abs();
        self.prev_samples[ch] = sample;

        // In bandlimited audio (<20kHz), delta > 14000 (~43% full-scale) indicates a digital pop
        if self.samples_yielded > 512 && delta > 14000 {
            let _ = self.glitch_tx.send(GlitchReport {
                sample_pos: self.samples_yielded,
                channel: ch as u16,
                prev_val: prev,
                curr_val: sample,
                delta,
                time_secs: if self.sample_rate > 0 && self.channels > 0 {
                    (self.samples_yielded as f64) / ((self.sample_rate as f64) * (self.channels as f64))
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

impl<I> Source for SafeAudioSource<I>
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
        self.sample_rate
    }

    #[inline]
    fn total_duration(&self) -> Option<Duration> {
        self.inner.total_duration()
    }

    #[inline]
    fn try_seek(&mut self, pos: Duration) -> Result<(), SeekError> {
        self.fade_in_pos = 0;
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
    },
    Pause,
    Resume,
    Stop,
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

fn append_safe_source<S: Source<Item = i16> + Send + 'static>(
    sink: &Sink,
    src: S,
    glitch_tx: Sender<GlitchReport>,
) {
    let safe_src = SafeAudioSource::new(src, glitch_tx);
    sink.append(safe_src);
}

fn ramp_sink_volume(sink: &Sink, from: f32, to: f32, duration_ms: u64) {
    if (from - to).abs() < 0.001 {
        sink.set_volume(to.clamp(0.0, 1.0));
        return;
    }
    let steps = (duration_ms / 2).max(4); // 2ms per step
    let step_dur = Duration::from_millis(2);
    for i in 1..=steps {
        let t = i as f32 / steps as f32;
        let smooth_t = t * t * (3.0 - 2.0 * t);
        let vol = from + (to - from) * smooth_t;
        sink.set_volume(vol.clamp(0.0, 1.0));
        std::thread::sleep(step_dur);
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
                                                append_safe_source(&sink, skipped, glitch_tx.clone());
                                            } else {
                                                append_safe_source(&sink, decoder, glitch_tx.clone());
                                            }
                                        } else {
                                            append_safe_source(&sink, decoder, glitch_tx.clone());
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

                    // Smooth fade out of previous track if currently playing
                    if is_playing && !is_paused && current_volume > 0.01 {
                        if fade_mode != "off" && fade_duration > 0.05 {
                            let fade_out_dur = (fade_duration.min(0.6).max(0.08) * 1000.0) as u64;
                            ramp_sink_volume(&sink, current_volume, 0.0, fade_out_dur);
                        } else {
                            ramp_sink_volume(&sink, current_volume, 0.0, 15);
                        }
                    }

                    sink.stop();
                    if let Ok(new_sink) = Sink::try_new(&stream_handle) {
                        sink = new_sink;
                    }
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
                                if safe_offset > 0.05 {
                                    let offset_dur = Duration::from_secs_f64(safe_offset);
                                    if decoder.try_seek(offset_dur).is_ok() {
                                        append_safe_source(&sink, decoder, glitch_tx.clone());
                                    } else {
                                        let skipped = decoder.skip_duration(offset_dur);
                                        append_safe_source(&sink, skipped, glitch_tx.clone());
                                    }
                                    play_start_pos = safe_offset;
                                } else {
                                    append_safe_source(&sink, decoder, glitch_tx.clone());
                                    play_start_pos = 0.0;
                                }

                                current_path = Some(path);
                                play_start_instant = Instant::now();
                                is_playing = true;
                                is_paused = false;

                                sink.play();

                                if fade_mode != "off" && fade_duration > 0.05 && user_target_volume > 0.01 {
                                    let fade_in_dur = (fade_duration.min(2.0).max(0.08) * 1000.0) as u64;
                                    ramp_sink_volume(&sink, 0.0, user_target_volume, fade_in_dur);
                                } else {
                                    ramp_sink_volume(&sink, 0.0, user_target_volume, 15);
                                }

                                current_volume = user_target_volume;
                                sink.set_volume(current_volume);
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
                        if fade_mode != "off" && fade_duration > 0.05 && current_volume > 0.01 {
                            let fade_out_dur = (fade_duration.min(2.0).max(0.08) * 1000.0) as u64;
                            ramp_sink_volume(&sink, current_volume, 0.0, fade_out_dur);
                        } else {
                            ramp_sink_volume(&sink, current_volume, 0.0, 15);
                        }
                        sink.pause();
                        current_volume = 0.0;
                        is_paused = true;
                        let elapsed = play_start_instant.elapsed().as_secs_f64();
                        play_start_pos = (play_start_pos + elapsed).min(if current_duration > 0.0 { current_duration } else { f64::MAX });
                        logger::log("AUDIO", "PAUSE", &format!("Paused at pos={:.3}s (smoothly faded to zero)", play_start_pos));
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
                                                    if play_start_pos > 0.05 {
                                                        let target_dur = Duration::from_secs_f64(play_start_pos);
                                                        if decoder.try_seek(target_dur).is_err() {
                                                            let skipped = decoder.skip_duration(target_dur);
                                                            append_safe_source(&sink, skipped, glitch_tx.clone());
                                                        } else {
                                                            append_safe_source(&sink, decoder, glitch_tx.clone());
                                                        }
                                                    } else {
                                                        append_safe_source(&sink, decoder, glitch_tx.clone());
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
                        sink.set_volume(0.0);
                        sink.play();

                        if fade_mode != "off" && fade_duration > 0.05 && user_target_volume > 0.01 {
                            let fade_in_dur = (fade_duration.min(2.0).max(0.08) * 1000.0) as u64;
                            ramp_sink_volume(&sink, 0.0, user_target_volume, fade_in_dur);
                        } else {
                            ramp_sink_volume(&sink, 0.0, user_target_volume, 15);
                        }
                        current_volume = user_target_volume;
                        sink.set_volume(current_volume);
                        logger::log("AUDIO", "RESUME", &format!("Resumed from pos={:.3}s (vol={:.2})", play_start_pos, user_target_volume));
                    }
                }
                PlayerCmd::Stop => {
                    active_volume_fade = None;
                    is_scrub_holding = false;
                    if is_playing && !is_paused && current_volume > 0.005 {
                        ramp_sink_volume(&sink, current_volume, 0.0, 15);
                    }
                    sink.stop();
                    current_volume = 0.0;
                    is_playing = false;
                    is_paused = false;
                    current_path = None;
                    play_start_pos = 0.0;
                    preloaded_next_loop = false;
                    logger::log("AUDIO", "STOP", "Playback stopped and queue cleared");
                }
                PlayerCmd::ScrubHold => {
                    active_volume_fade = None;
                    if is_playing && !is_paused && !is_scrub_holding {
                        ramp_sink_volume(&sink, current_volume, 0.0, 10);
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
                            sink.set_volume(0.0);
                            sink.play();
                            ramp_sink_volume(&sink, 0.0, user_target_volume, 15);
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

                    // Option B: Micro-ramp old playing audio to 0.0 over 8ms so there is no speaker click/pop
                    if is_playing && current_volume > 0.01 {
                        ramp_sink_volume(&sink, current_volume, 0.0, 8);
                    }
                    sink.stop();

                    // Discard old sink queue and create fresh Sink instance
                    if let Ok(new_sink) = Sink::try_new(&stream_handle) {
                        sink = new_sink;
                    }
                    sink.set_volume(0.0);

                    let mut seek_done = false;

                    // Open fresh decoder at seek target position
                    if let Some(ref path) = current_path {
                        if let Ok(file) = File::open(path) {
                            if let Ok(mut decoder) = Decoder::new(BufReader::new(file)) {
                                if safe_pos > 0.05 {
                                    if decoder.try_seek(target_dur).is_err() {
                                        let skipped = decoder.skip_duration(target_dur);
                                        append_safe_source(&sink, skipped, glitch_tx.clone());
                                    } else {
                                        append_safe_source(&sink, decoder, glitch_tx.clone());
                                    }
                                } else {
                                    append_safe_source(&sink, decoder, glitch_tx.clone());
                                }

                                if should_resume {
                                    sink.play();
                                    ramp_sink_volume(&sink, 0.0, user_target_volume, 15);
                                    current_volume = user_target_volume;
                                    sink.set_volume(current_volume);
                                } else {
                                    sink.pause();
                                    current_volume = 0.0;
                                    sink.set_volume(0.0);
                                }

                                seek_done = true;
                            }
                        }
                    }

                    if !seek_done {
                        let _ = sink.try_seek(target_dur);
                        if should_resume {
                            sink.play();
                            ramp_sink_volume(&sink, 0.0, user_target_volume, 15);
                            current_volume = user_target_volume;
                            sink.set_volume(current_volume);
                        } else {
                            sink.pause();
                            current_volume = 0.0;
                            sink.set_volume(0.0);
                        }
                    }

                    play_start_pos = safe_pos;
                    play_start_instant = Instant::now();

                    logger::log("AUDIO", "SEEK", &format!("Seek completed in {:.2}ms (fresh sink created)", t0.elapsed().as_secs_f64() * 1000.0));

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
                    if active_volume_fade.is_none() && !is_paused && !is_scrub_holding {
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
                            append_safe_source(&sink, decoder, glitch_tx.clone());
                            preloaded_next_loop = true;
                            logger::log("AUDIO", "REPEAT", "Preloaded next loop into gapless sink queue");
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
            } else if sink.empty() || (current_duration > 1.0 && current_pos >= current_duration + 2.0) {
                if repeat_one {
                    if let Some(ref path) = current_path {
                        if let Ok(file) = File::open(path) {
                            if let Ok(decoder) = Decoder::new(BufReader::new(file)) {
                                append_safe_source(&sink, decoder, glitch_tx.clone());
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

        std::thread::sleep(Duration::from_millis(10));
    }
}
