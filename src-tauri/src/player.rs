use std::fs::File;
use std::io::BufReader;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use rodio::decoder::Decoder;
use rodio::stream::{DeviceSinkBuilder, MixerDeviceSink};
use rodio::{Player, Source};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

#[derive(Clone, Serialize)]
pub struct TimeUpdatePayload {
    pub current_time: f64,
    pub duration: f64,
}

pub struct AudioPlayerInner {
    sink: Option<MixerDeviceSink>,
    player: Option<Player>,
    pub current_path: Option<String>,
    pub duration: f64,
    pub repeat_mode: String, // "off", "all", "one"
    pub volume: f32,
    pub is_playing: bool,
    pub last_iteration: u64,
    pub seek_offset: f64,
}

#[derive(Clone)]
pub struct AudioPlayer(pub Arc<Mutex<AudioPlayerInner>>);

impl AudioPlayer {
    pub fn new() -> Self {
        AudioPlayer(Arc::new(Mutex::new(AudioPlayerInner {
            sink: None,
            player: None,
            current_path: None,
            duration: 0.0,
            repeat_mode: "off".to_string(),
            volume: 1.0,
            is_playing: false,
            last_iteration: 0,
            seek_offset: 0.0,
        })))
    }

    fn ensure_sink_and_player(inner: &mut AudioPlayerInner) -> Result<&Player, String> {
        if inner.player.is_none() || inner.sink.is_none() {
            let sink = DeviceSinkBuilder::open_default_sink()
                .map_err(|e| format!("Failed to open default audio output sink: {}", e))?;
            let player = Player::connect_new(sink.mixer());
            inner.player = Some(player);
            inner.sink = Some(sink);
        }
        Ok(inner.player.as_ref().unwrap())
    }

    pub fn play(&self, path: String, duration_hint: Option<f64>, auto_play: bool) -> Result<(), String> {
        let mut inner = self.0.lock().unwrap();
        Self::ensure_sink_and_player(&mut inner)?;

        let file = File::open(&path).map_err(|e| format!("Failed to open audio file '{}': {}", path, e))?;
        let reader = BufReader::new(file);

        let dur = duration_hint.unwrap_or(0.0);
        inner.duration = dur;
        inner.current_path = Some(path.clone());
        inner.last_iteration = 0;
        inner.seek_offset = 0.0;

        let player = inner.player.as_ref().unwrap();
        player.clear();
        player.set_volume(inner.volume);

        if inner.repeat_mode == "one" {
            let looped = Decoder::new_looped(reader)
                .map_err(|e| format!("Failed to decode audio file: {:?}", e))?;
            player.append(looped.fade_in(Duration::from_millis(15)));
        } else {
            let decoder = Decoder::new(reader)
                .map_err(|e| format!("Failed to decode audio file: {:?}", e))?;
            player.append(decoder.fade_in(Duration::from_millis(15)));
        }

        if auto_play {
            player.play();
            inner.is_playing = true;
        } else {
            player.pause();
            inner.is_playing = false;
        }

        Ok(())
    }

    pub fn pause(&self) {
        let mut inner = self.0.lock().unwrap();
        if let Some(ref player) = inner.player {
            player.pause();
        }
        inner.is_playing = false;
    }

    pub fn resume(&self) {
        let mut inner = self.0.lock().unwrap();
        if let Some(ref player) = inner.player {
            player.play();
            inner.is_playing = true;
        }
    }

    pub fn stop(&self) {
        let mut inner = self.0.lock().unwrap();
        if let Some(ref player) = inner.player {
            player.clear();
        }
        inner.is_playing = false;
        inner.current_path = None;
    }

    pub fn seek(&self, seconds: f64) -> Result<(), String> {
        let mut inner = self.0.lock().unwrap();
        let target = seconds.max(0.0);
        inner.seek_offset = target;

        if let Some(ref player) = inner.player {
            let dur_seek = Duration::from_secs_f64(target);
            if player.try_seek(dur_seek).is_err() {
                if let Some(ref path) = inner.current_path.clone() {
                    if let Ok(file) = File::open(path) {
                        let reader = BufReader::new(file);
                        player.clear();
                        if inner.repeat_mode == "one" {
                            if let Ok(looped) = Decoder::new_looped(reader) {
                                player.append(looped.skip_duration(dur_seek).fade_in(Duration::from_millis(15)));
                            }
                        } else {
                            if let Ok(decoder) = Decoder::new(reader) {
                                player.append(decoder.skip_duration(dur_seek).fade_in(Duration::from_millis(15)));
                            }
                        }
                        if inner.is_playing {
                            player.play();
                        } else {
                            player.pause();
                        }
                    }
                }
            }
        }
        Ok(())
    }

    pub fn set_volume(&self, volume: f32) {
        let mut inner = self.0.lock().unwrap();
        let clamped = volume.max(0.0).min(1.0);
        inner.volume = clamped;
        if let Some(ref player) = inner.player {
            player.set_volume(clamped);
        }
    }

    pub fn set_repeat_mode(&self, mode: String) -> Result<(), String> {
        let mut inner = self.0.lock().unwrap();
        let old_mode = inner.repeat_mode.clone();
        inner.repeat_mode = mode.clone();

        if old_mode != mode && inner.current_path.is_some() {
            if let Some(ref path) = inner.current_path.clone() {
                let current_time = if let Some(ref player) = inner.player {
                    let p = player.get_pos().as_secs_f64();
                    if inner.duration > 0.0 {
                        p % inner.duration
                    } else {
                        p
                    }
                } else {
                    0.0
                };

                if let Some(ref player) = inner.player {
                    if let Ok(file) = File::open(path) {
                        let reader = BufReader::new(file);
                        let dur_seek = Duration::from_secs_f64(current_time);
                        player.clear();
                        if mode == "one" {
                            if let Ok(looped) = Decoder::new_looped(reader) {
                                player.append(looped.skip_duration(dur_seek).fade_in(Duration::from_millis(15)));
                            }
                        } else {
                            if let Ok(decoder) = Decoder::new(reader) {
                                player.append(decoder.skip_duration(dur_seek).fade_in(Duration::from_millis(15)));
                            }
                        }
                        if inner.is_playing {
                            player.play();
                        } else {
                            player.pause();
                        }
                    }
                }
            }
        }
        Ok(())
    }

    pub fn get_current_time(&self) -> f64 {
        let inner = self.0.lock().unwrap();
        if let Some(ref player) = inner.player {
            let p = player.get_pos().as_secs_f64();
            if inner.repeat_mode == "one" && inner.duration > 0.0 {
                p % inner.duration
            } else {
                p
            }
        } else {
            0.0
        }
    }

    pub fn poll_tick(&self, app: &AppHandle) {
        let mut emit_ended = false;
        let mut emit_loop = false;
        let mut time_payload: Option<TimeUpdatePayload> = None;

        {
            let mut inner = match self.0.lock() {
                Ok(guard) => guard,
                Err(_) => return,
            };

            if !inner.is_playing {
                return;
            }

            if let Some(ref player) = inner.player {
                let pos = player.get_pos().as_secs_f64();
                let dur = inner.duration;

                if inner.repeat_mode == "one" {
                    if dur > 0.0 {
                        let cur_iter = (pos / dur).floor() as u64;
                        if cur_iter > inner.last_iteration {
                            inner.last_iteration = cur_iter;
                            emit_loop = true;
                        }
                        time_payload = Some(TimeUpdatePayload {
                            current_time: pos % dur,
                            duration: dur,
                        });
                    } else {
                        time_payload = Some(TimeUpdatePayload {
                            current_time: pos,
                            duration: dur,
                        });
                    }
                } else {
                    if player.empty() {
                        inner.is_playing = false;
                        emit_ended = true;
                    } else {
                        time_payload = Some(TimeUpdatePayload {
                            current_time: if dur > 0.0 { pos.min(dur) } else { pos },
                            duration: dur,
                        });
                    }
                }
            }
        }

        if let Some(payload) = time_payload {
            let _ = app.emit("player-time-update", payload);
        }
        if emit_loop {
            let _ = app.emit("player-loop-repeat", ());
        }
        if emit_ended {
            let _ = app.emit("player-ended", ());
        }
    }

    pub fn start_worker(&self, app: AppHandle) {
        let player = self.clone();
        thread::spawn(move || {
            loop {
                thread::sleep(Duration::from_millis(60));
                player.poll_tick(&app);
            }
        });
    }
}

// Tauri commands exposed to the frontend
#[tauri::command]
pub fn native_player_play(
    state: State<'_, AudioPlayer>,
    path: String,
    duration_hint: Option<f64>,
    auto_play: Option<bool>,
) -> Result<(), String> {
    state.play(path, duration_hint, auto_play.unwrap_or(true))
}

#[tauri::command]
pub fn native_player_pause(state: State<'_, AudioPlayer>) -> Result<(), String> {
    state.pause();
    Ok(())
}

#[tauri::command]
pub fn native_player_resume(state: State<'_, AudioPlayer>) -> Result<(), String> {
    state.resume();
    Ok(())
}

#[tauri::command]
pub fn native_player_stop(state: State<'_, AudioPlayer>) -> Result<(), String> {
    state.stop();
    Ok(())
}

#[tauri::command]
pub fn native_player_seek(state: State<'_, AudioPlayer>, seconds: f64) -> Result<(), String> {
    state.seek(seconds)
}

#[tauri::command]
pub fn native_player_set_volume(state: State<'_, AudioPlayer>, volume: f32) -> Result<(), String> {
    state.set_volume(volume);
    Ok(())
}

#[tauri::command]
pub fn native_player_set_repeat_mode(state: State<'_, AudioPlayer>, mode: String) -> Result<(), String> {
    state.set_repeat_mode(mode)
}

#[tauri::command]
pub fn native_player_get_time(state: State<'_, AudioPlayer>) -> Result<f64, String> {
    Ok(state.get_current_time())
}
