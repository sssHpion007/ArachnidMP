use rodio::{Decoder, OutputStream, Sink, Source};
use serde::Serialize;
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
}

#[derive(Clone, Serialize)]
pub struct NativePlayerState {
    pub is_playing: bool,
    pub is_paused: bool,
    pub position: f64,
    pub duration: f64,
    pub volume: f32,
    pub repeat_one: bool,
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
            current_path: None,
        }
    }
}

pub struct NativePlayer {
    sender: Sender<PlayerCmd>,
    state: Arc<Mutex<NativePlayerState>>,
}

impl NativePlayer {
    pub fn new(app_handle: AppHandle) -> Self {
        let (tx, rx) = channel::<PlayerCmd>();
        let state = Arc::new(Mutex::new(NativePlayerState::default()));
        let thread_state = Arc::clone(&state);

        std::thread::spawn(move || {
            run_player_thread(rx, thread_state, app_handle);
        });

        Self {
            sender: tx,
            state,
        }
    }

    pub fn play(&self, path: String, offset_secs: f64, volume: f32, duration_hint: Option<f64>) -> Result<(), String> {
        self.sender
            .send(PlayerCmd::Play {
                path,
                offset_secs,
                volume,
                duration_hint,
            })
            .map_err(|e| e.to_string())
    }

    pub fn pause(&self) -> Result<(), String> {
        self.sender.send(PlayerCmd::Pause).map_err(|e| e.to_string())
    }

    pub fn resume(&self) -> Result<(), String> {
        self.sender.send(PlayerCmd::Resume).map_err(|e| e.to_string())
    }

    pub fn stop(&self) -> Result<(), String> {
        self.sender.send(PlayerCmd::Stop).map_err(|e| e.to_string())
    }

    pub fn seek(&self, position_secs: f64) -> Result<(), String> {
        self.sender
            .send(PlayerCmd::Seek { position_secs })
            .map_err(|e| e.to_string())
    }

    pub fn set_volume(&self, volume: f32) -> Result<(), String> {
        self.sender
            .send(PlayerCmd::SetVolume { volume })
            .map_err(|e| e.to_string())
    }

    pub fn set_repeat_one(&self, repeat_one: bool) -> Result<(), String> {
        self.sender
            .send(PlayerCmd::SetRepeatOne { repeat_one })
            .map_err(|e| e.to_string())
    }

    pub fn get_state(&self) -> NativePlayerState {
        self.state.lock().unwrap().clone()
    }
}

fn run_player_thread(
    rx: Receiver<PlayerCmd>,
    shared_state: Arc<Mutex<NativePlayerState>>,
    app_handle: AppHandle,
) {
    let output_result = OutputStream::try_default();
    let (_stream, stream_handle) = match output_result {
        Ok(s) => s,
        Err(e) => {
            eprintln!("NativePlayer: Failed to open default audio output: {:?}", e);
            return;
        }
    };

    let sink = match Sink::try_new(&stream_handle) {
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
    let mut current_volume = 1.0;
    let mut last_emit_instant = Instant::now();

    loop {
        // 1. Process all pending commands
        while let Ok(cmd) = rx.try_recv() {
            match cmd {
                PlayerCmd::Play {
                    path,
                    offset_secs,
                    volume,
                    duration_hint,
                } => {
                    sink.stop();
                    current_volume = volume;
                    sink.set_volume(volume);

                    if let Some(dh) = duration_hint {
                        if dh > 0.0 {
                            current_duration = dh;
                        }
                    }

                    match File::open(&path) {
                        Ok(file) => match Decoder::new(BufReader::new(file)) {
                            Ok(decoder) => {
                                if let Some(dur) = decoder.total_duration() {
                                    let secs = dur.as_secs_f64();
                                    if secs > 0.0 {
                                        current_duration = secs;
                                    }
                                }

                                let safe_offset = offset_secs.max(0.0);
                                if safe_offset > 0.05 {
                                    let skipped = decoder.skip_duration(Duration::from_secs_f64(safe_offset));
                                    sink.append(skipped);
                                    play_start_pos = safe_offset;
                                } else {
                                    sink.append(decoder);
                                    play_start_pos = 0.0;
                                }

                                sink.play();
                                is_playing = true;
                                is_paused = false;
                                current_path = Some(path);
                                play_start_instant = Instant::now();
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
                    if is_playing && !is_paused {
                        sink.pause();
                        is_paused = true;
                        let elapsed = play_start_instant.elapsed().as_secs_f64();
                        play_start_pos = (play_start_pos + elapsed).min(if current_duration > 0.0 { current_duration } else { f64::MAX });
                    }
                }
                PlayerCmd::Resume => {
                    if is_playing && is_paused {
                        sink.play();
                        is_paused = false;
                        play_start_instant = Instant::now();
                    }
                }
                PlayerCmd::Stop => {
                    sink.stop();
                    is_playing = false;
                    is_paused = false;
                    current_path = None;
                    play_start_pos = 0.0;
                }
                PlayerCmd::Seek { position_secs } => {
                    if let Some(ref path) = current_path {
                        sink.stop();
                        if let Ok(file) = File::open(path) {
                            if let Ok(decoder) = Decoder::new(BufReader::new(file)) {
                                let max_dur = if current_duration > 0.1 { current_duration - 0.05 } else { position_secs };
                                let safe_pos = position_secs.max(0.0).min(max_dur);

                                if safe_pos > 0.05 {
                                    let skipped = decoder.skip_duration(Duration::from_secs_f64(safe_pos));
                                    sink.append(skipped);
                                } else {
                                    sink.append(decoder);
                                }

                                if !is_paused {
                                    sink.play();
                                } else {
                                    sink.pause();
                                }
                                play_start_pos = safe_pos;
                                play_start_instant = Instant::now();
                            }
                        }
                    }
                }
                PlayerCmd::SetVolume { volume } => {
                    current_volume = volume;
                    sink.set_volume(volume);
                }
                PlayerCmd::SetRepeatOne { repeat_one: rep } => {
                    repeat_one = rep;
                }
            }
        }

        // 2. Monitor playback position and track end
        if is_playing && !is_paused {
            let elapsed = play_start_instant.elapsed().as_secs_f64();
            let current_pos = play_start_pos + elapsed;

            // Check if track reached end
            let is_ended = sink.empty() || (current_duration > 0.5 && current_pos >= current_duration);

            if is_ended {
                if repeat_one {
                    if let Some(ref path) = current_path {
                        if let Ok(file) = File::open(path) {
                            if let Ok(decoder) = Decoder::new(BufReader::new(file)) {
                                sink.stop();
                                sink.append(decoder);
                                sink.play();
                                play_start_pos = 0.0;
                                play_start_instant = Instant::now();
                                let _ = app_handle.emit("audio://loop-repeat", ());
                            }
                        }
                    }
                } else {
                    is_playing = false;
                    is_paused = false;
                    play_start_pos = 0.0;
                    let _ = app_handle.emit("audio://track-ended", ());
                }
            } else if last_emit_instant.elapsed().as_millis() >= 80 {
                // Emit time update smoothly at ~12.5 FPS
                last_emit_instant = Instant::now();
                let _ = app_handle.emit(
                    "audio://time-update",
                    serde_json::json!({
                        "position": current_pos,
                        "duration": current_duration,
                    }),
                );
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

        std::thread::sleep(Duration::from_millis(30));
    }
}
