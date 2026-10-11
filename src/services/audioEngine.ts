import { FadeMode } from '../types/music';
import { isTauri, invoke } from '@tauri-apps/api/core';

export const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export const EQ_PRESETS = [
  { name: 'Flat', values: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'Bass Boost', values: [7, 6, 4, 2, 0, 0, 0, 0, 0, 0] },
  { name: 'Treble Boost', values: [0, 0, 0, 0, 0, 1, 3, 5, 7, 8] },
  { name: 'Rock', values: [4, 3, -1, -2, -1, 1, 3, 4, 5, 5] },
  { name: 'Electronic', values: [6, 5, 2, 0, -2, 1, 3, 5, 6, 6] },
  { name: 'Vocal / Acoustic', values: [-2, -1, 0, 2, 4, 4, 3, 2, 1, 0] },
  { name: 'Classical / Jazz', values: [3, 2, 1, 1, -1, -1, 0, 2, 3, 4] },
];

/**
 * Unified Gapless Audio Engine (MusicBee-grade Architecture)
 *
 * - Unified state management: preserves exact playback position across pause/resume/seek.
 * - Non-blocking asynchronous fade system: zero hanging promises, zero silence on track change.
 * - Hardware PCM looping via Web Audio API when repeatMode: 'one': zero crackle, zero stutter.
 * - Instant streaming playback via HTMLAudioElement for queue navigation.
 */
class AudioEngine {
  private audio: HTMLAudioElement;
  private audioCtx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private bufferSource: AudioBufferSourceNode | null = null;
  private bufferGainNode: GainNode | null = null;
  private currentBuffer: AudioBuffer | null = null;

  // Unified Playback State
  private isPlaying: boolean = false;
  private isUsingWebAudio: boolean = false;
  private playbackPosition: number = 0; // The single source of truth for current playback seconds
  private playbackStartTime: number = 0;
  private currentTrackSrc: string = '';
  private currentTrackPath: string = '';
  private currentTrackDuration: number = 0;

  // Callbacks
  private onTimeUpdateCallback?: (time: number) => void;
  private onDurationCallback?: (duration: number) => void;
  private onEndCallback?: () => void;
  private onPlayCallback?: () => void;
  private onPauseCallback?: () => void;

  // Configuration
  private targetVolume: number = 0.85;
  private isMuted: boolean = false;
  private fadeMode: FadeMode = 'track_change_and_pause';
  private fadeDuration: number = 2.0; // in seconds
  private repeatMode: 'off' | 'all' | 'one' = 'all';

  // Precision loop & Animation
  private rafId: number | null = null;
  private fadeAnimFrame: number | null = null;
  private fadeResolve: (() => void) | null = null;
  private lastTimeUpdateTimestamp: number = 0;
  private playRequestId: number = 0;
  private lastPlayTimestamp: number = 0;
  private isScrubbing: boolean = false;
  private isHandlingEnd: boolean = false;

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';

    this.audio.addEventListener('durationchange', () => {
      const dur = this.audio.duration;
      if (dur && !isNaN(dur) && isFinite(dur) && dur > 0) {
        this.currentTrackDuration = dur;
        this.onDurationCallback?.(dur);
      }
    });

    this.audio.addEventListener('ended', () => {
      if (!this.isUsingWebAudio) {
        this.handleTrackEnded();
      } else if (this.repeatMode === 'one') {
        // Keep HTMLAudio playing silently in loop to maintain Windows SMTC & Bluetooth headphone controls!
        this.audio.currentTime = 0;
        this.audio.play().catch(() => {});
      }
    });

    this.audio.addEventListener('error', () => {
      const err = this.audio.error;
      console.warn('Audio playback error:', err ? `code=${err.code}, msg=${err.message}` : 'unknown error');
    });

    this.startPrecisionLoop();
  }

  private getOrCreateAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.setValueAtTime(this.getEffectiveVolume(), this.audioCtx.currentTime);
      this.gainNode.connect(this.audioCtx.destination);
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  public setCallbacks(callbacks: {
    onTimeUpdate?: (time: number) => void;
    onDuration?: (duration: number) => void;
    onEnded?: () => void;
    onPlay?: () => void;
    onPause?: () => void;
  }) {
    this.onTimeUpdateCallback = callbacks.onTimeUpdate;
    this.onDurationCallback = callbacks.onDuration;
    this.onEndCallback = callbacks.onEnded;
    this.onPlayCallback = callbacks.onPlay;
    this.onPauseCallback = callbacks.onPause;
  }

  public setFadeConfig(mode: FadeMode, durationSec: number) {
    this.fadeMode = mode;
    this.fadeDuration = Math.max(0.2, durationSec);
  }

  public setRepeatMode(mode: 'off' | 'all' | 'one') {
    if (this.repeatMode === mode) return;
    this.repeatMode = mode;

    // If active playback is running via Web Audio buffer, simply update the hardware loop flag smoothly.
    // We NEVER interrupt, stop, restart, or recreate audio nodes mid-song on repeat mode toggles!
    if (this.isUsingWebAudio && this.bufferSource) {
      this.bufferSource.loop = (mode === 'one' && this.fadeMode !== 'always');
    }
  }

  public setScrubbing(isScrubbing: boolean): void {
    if (this.isScrubbing === isScrubbing) return;
    this.isScrubbing = isScrubbing;
    if (isScrubbing) {
      // Temporarily mute output with a 12ms micro-fade so scrubbing / rapid arrow seeking is completely silent!
      this.performMicroFade(0, 0.012);
    } else {
      // Restore effective volume with a 15ms micro-fade when scrubbing finishes
      this.performMicroFade(this.getEffectiveVolume(), 0.015);
    }
  }

  public getEffectiveVolume(): number {
    return this.isMuted ? 0 : this.targetVolume;
  }

  private setVolumeInstantly(vol: number) {
    const clamped = Math.max(0, Math.min(1, vol));
    try {
      this.audio.volume = this.isUsingWebAudio ? 0 : clamped;
    } catch (_) {}
    if (this.gainNode && this.audioCtx) {
      try {
        const now = this.audioCtx.currentTime;
        this.gainNode.gain.cancelScheduledValues(now);
        // De-zipper / de-pop micro-ramp (15ms linear interpolation) eliminates any DC step or click
        this.gainNode.gain.linearRampToValueAtTime(clamped, now + 0.015);
      } catch (_) {
        try {
          this.gainNode.gain.setValueAtTime(clamped, this.audioCtx.currentTime);
        } catch (_) {}
      }
    }
  }

  private fadeAudioElementVolume(targetVol: number, durationMs: number = 20, onComplete?: () => void) {
    const startVol = this.audio.volume;
    if (Math.abs(startVol - targetVol) < 0.01) {
      try {
        this.audio.volume = targetVol;
      } catch (_) {}
      onComplete?.();
      return;
    }
    const startTime = performance.now();
    const step = () => {
      const elapsed = performance.now() - startTime;
      const p = Math.min(1, elapsed / durationMs);
      try {
        this.audio.volume = Math.max(0, Math.min(1, startVol + (targetVol - startVol) * p));
      } catch (_) {}
      if (p < 1) {
        requestAnimationFrame(step);
      } else {
        try {
          this.audio.volume = targetVol;
        } catch (_) {}
        onComplete?.();
      }
    };
    requestAnimationFrame(step);
  }

  private performMicroFade(targetVol: number, durationSec: number = 0.015) {
    const clamped = Math.max(0, Math.min(1, targetVol));
    if (this.gainNode && this.audioCtx) {
      try {
        const now = this.audioCtx.currentTime;
        this.gainNode.gain.cancelScheduledValues(now);
        this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
        this.gainNode.gain.linearRampToValueAtTime(clamped, now + durationSec);
      } catch (_) {}
    }
    if (!this.isUsingWebAudio) {
      this.fadeAudioElementVolume(clamped, Math.round(durationSec * 1000));
    }
  }

  private getCurrentOutputVolume(): number {
    if (this.isUsingWebAudio && this.gainNode) {
      return this.gainNode.gain.value;
    }
    return this.audio.volume;
  }

  public setVolume(vol: number): void {
    const clamped = Math.max(0, Math.min(1, vol));
    this.targetVolume = clamped;
    if (clamped > 0) {
      this.isMuted = false;
    }
    this.cancelFade();
    this.setVolumeInstantly(this.getEffectiveVolume());
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    this.cancelFade();
    this.setVolumeInstantly(this.getEffectiveVolume());
  }

  /**
   * Safely cancels any ongoing fade and immediately resolves pending promises
   * to guarantee the playback pipeline NEVER hangs or goes silent!
   */
  private cancelFade(targetIfCancelled?: number) {
    if (this.fadeAnimFrame !== null) {
      cancelAnimationFrame(this.fadeAnimFrame);
      this.fadeAnimFrame = null;
    }
    if (targetIfCancelled !== undefined) {
      this.setVolumeInstantly(targetIfCancelled);
    }
    if (this.fadeResolve) {
      const res = this.fadeResolve;
      this.fadeResolve = null;
      res(); // Resolve instantly so awaiting caller never deadlocks!
    }
  }

  private performFade(targetVol: number, durationSec: number): Promise<void> {
    this.cancelFade();

    return new Promise<void>((resolve) => {
      this.fadeResolve = resolve;

      const startVol = this.getCurrentOutputVolume();
      const startTime = performance.now();
      const durationMs = Math.max(30, durationSec * 1000);

      const step = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(1, elapsed / durationMs);

        // Smooth ease-in-out curve
        const eased = progress < 0.5 
          ? 2 * progress * progress 
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        const currentVol = startVol + (targetVol - startVol) * eased;
        this.setVolumeInstantly(currentVol);

        if (progress < 1) {
          this.fadeAnimFrame = requestAnimationFrame(step);
        } else {
          this.setVolumeInstantly(targetVol);
          this.fadeAnimFrame = null;
          if (this.fadeResolve === resolve) {
            this.fadeResolve = null;
          }
          resolve();
        }
      };

      this.fadeAnimFrame = requestAnimationFrame(step);
    });
  }

  /**
   * Reads raw audio bytes directly via Rust backend (std::fs::read) to bypass CORS and network lag
   */
  private async preloadBuffer(src: string, path?: string, reqId?: number): Promise<void> {
    if (!src && !path) return;
    try {
      const ctx = this.getOrCreateAudioContext();
      let arrayBuffer: ArrayBuffer;

      if (isTauri() && path) {
        const bytes = await invoke<number[]>('read_audio_binary', { path });
        const uint8 = new Uint8Array(bytes);
        arrayBuffer = uint8.buffer;
      } else {
        const response = await fetch(src);
        arrayBuffer = await response.arrayBuffer();
      }

      const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);

      if (reqId !== undefined && this.playRequestId !== reqId) return;

      if (this.currentTrackSrc === src) {
        this.currentBuffer = decodedBuffer;
        this.currentTrackDuration = decodedBuffer.duration;
        this.onDurationCallback?.(decodedBuffer.duration);
      }
    } catch (e) {
      console.warn('Web Audio PCM preload fallback:', e);
      this.currentBuffer = null;
    }
  }

  /**
   * Starts hardware sample-accurate gapless loop with Web Audio API
   */
  private async startBufferPlayback(startOffset: number, fadeInDuration: number = 0.018) {
    if (!this.currentBuffer) return;
    const ctx = this.getOrCreateAudioContext();
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (_) {}
    }

    // Smoothly fade out previous buffer source if active
    this.stopBufferSource(fadeInDuration);

    const source = ctx.createBufferSource();
    const sourceGain = ctx.createGain();
    source.buffer = this.currentBuffer;
    const shouldLoop = (this.repeatMode === 'one' && this.fadeMode !== 'always');
    source.loop = shouldLoop;

    // Connect source -> individual sourceGain (18ms micro-envelope) -> master gainNode -> destination
    source.connect(sourceGain);
    sourceGain.connect(this.gainNode!);

    const dur = this.currentBuffer.duration;
    const offset = Math.max(0, Math.min(dur, startOffset % dur));

    // Smooth 18ms micro-fade in to eliminate any DC offset pop at start
    const now = ctx.currentTime;
    try {
      sourceGain.gain.setValueAtTime(0, now);
      sourceGain.gain.linearRampToValueAtTime(1, now + fadeInDuration);
    } catch (_) {
      try {
        sourceGain.gain.setValueAtTime(1, now);
      } catch (_) {}
    }

    // Ensure master gain is at target effective volume with smooth de-pop ramp
    const effVol = this.getEffectiveVolume();
    try {
      this.gainNode!.gain.cancelScheduledValues(now);
      this.gainNode!.gain.setValueAtTime(this.gainNode!.gain.value, now);
      this.gainNode!.gain.linearRampToValueAtTime(effVol, now + fadeInDuration);
    } catch (_) {}

    // Start buffer FIRST to ensure gapless transition, then smoothly mute background element
    source.start(0, offset);

    // Keep HTMLAudioElement playing silently in the background to preserve Windows SMTC & Bluetooth headphone controls!
    this.fadeAudioElementVolume(0, Math.round(fadeInDuration * 1000) + 10, () => {
      try {
        if (this.audio.paused) {
          this.audio.play().catch(() => {});
        }
      } catch (_) {}
    });

    this.bufferSource = source;
    this.bufferGainNode = sourceGain;
    this.isUsingWebAudio = true;
    this.isPlaying = true;
    this.playbackStartTime = ctx.currentTime;
    this.playbackPosition = offset;
  }

  private stopBufferSource(customFadeDuration: number = 0.018) {
    if (this.bufferSource) {
      const source = this.bufferSource;
      const gain = this.bufferGainNode;
      this.bufferSource = null;
      this.bufferGainNode = null;

      if (gain && this.audioCtx) {
        try {
          const now = this.audioCtx.currentTime;
          gain.gain.cancelScheduledValues(now);
          gain.gain.setValueAtTime(gain.gain.value, now);
          gain.gain.linearRampToValueAtTime(0, now + customFadeDuration);
          source.stop(now + customFadeDuration + 0.002);
          setTimeout(() => {
            try {
              source.disconnect();
              gain.disconnect();
            } catch (_) {}
          }, Math.round((customFadeDuration + 0.03) * 1000));
        } catch (_) {
          try {
            source.stop();
            source.disconnect();
            gain.disconnect();
          } catch (_) {}
        }
      } else {
        try {
          source.stop();
          source.disconnect();
        } catch (_) {}
      }
    }
    this.isUsingWebAudio = false;
  }

  /**
   * Precision monitor loop: updates time progress smoothly, throttled to 100ms for UI performance
   */
  private startPrecisionLoop() {
    const loop = () => {
      const now = performance.now();
      const shouldDispatch = (now - this.lastTimeUpdateTimestamp >= 100);

      if (this.isPlaying) {
        let curTime = 0;
        const dur = this.getDuration();

        if (this.isUsingWebAudio && this.currentBuffer && this.audioCtx) {
          const elapsed = this.audioCtx.currentTime - this.playbackStartTime;
          if (this.bufferSource?.loop && dur > 0) {
            curTime = (this.playbackPosition + elapsed) % dur;
          } else {
            curTime = Math.min(dur > 0 ? dur : Infinity, this.playbackPosition + elapsed);
            if (dur > 0 && curTime >= dur && !this.bufferSource?.loop) {
              this.handleTrackEnded();
            }
          }
        } else if (!this.audio.paused) {
          curTime = Math.min(dur > 0 ? dur : Infinity, this.audio.currentTime);
          this.playbackPosition = curTime;

          // Seamless loop transition: switch to Web Audio buffer 60ms BEFORE HTMLAudioElement reaches EOF
          // This eliminates the browser hardware buffer starvation pop that happens on the first repeat!
          if (this.repeatMode === 'one' && this.currentBuffer && this.audioCtx && dur > 0.5) {
            if (curTime >= dur - 0.060 && !this.isHandlingEnd) {
              this.handleLoopRepeat();
            }
          }
        }

        const safeTime = Math.max(0, Math.min(dur > 0 ? dur : Infinity, curTime));

        if (shouldDispatch && !this.isScrubbing) {
          this.lastTimeUpdateTimestamp = now;
          this.onTimeUpdateCallback?.(safeTime);
        }
      }

      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  private handleLoopRepeat() {
    if (this.isHandlingEnd) return;
    this.isHandlingEnd = true;
    setTimeout(() => {
      this.isHandlingEnd = false;
    }, 400);

    this.playbackPosition = 0;
    this.startBufferPlayback(0, 0.020);
    this.onPlayCallback?.();
    this.onTimeUpdateCallback?.(0);
  }

  private handleTrackEnded() {
    if (this.isHandlingEnd) return;
    this.isHandlingEnd = true;
    setTimeout(() => {
      this.isHandlingEnd = false;
    }, 250);

    if (this.repeatMode === 'one') {
      if (this.currentBuffer && this.audioCtx && this.fadeMode !== 'always') {
        // Sample-accurate hardware PCM loop restart with 20ms de-click ramp
        this.playbackPosition = 0;
        this.startBufferPlayback(0, 0.020);
        this.onPlayCallback?.();
        this.onTimeUpdateCallback?.(0);
      } else {
        // Fallback to HTMLAudioElement with micro-fade in to avoid crackle
        try {
          this.audio.volume = 0;
        } catch (_) {}
        this.playbackPosition = 0;
        this.audio.currentTime = 0;
        this.audio.play().then(() => {
          this.isPlaying = true;
          this.performFade(this.getEffectiveVolume(), 0.05);
        }).catch(() => {});
        this.onPlayCallback?.();
        this.onTimeUpdateCallback?.(0);
      }
    } else {
      this.isPlaying = false;
      this.playbackPosition = 0;
      this.stopBufferSource(0.020);
      try {
        this.audio.pause();
      } catch (_) {}
      this.onEndCallback?.();
    }
  }

  public async playTrack(
    src: string, 
    autoPlay: boolean = true, 
    isTrackChange: boolean = true,
    durationHint?: number,
    nativePath?: string
  ): Promise<void> {
    const reqId = ++this.playRequestId;
    const now = performance.now();
    const isRapid = (now - this.lastPlayTimestamp) < 350;
    this.lastPlayTimestamp = now;

    const isDifferent = this.currentTrackSrc !== src;

    // Fast smooth micro-fade out on previous track: 35ms if rapid, otherwise up to 200ms
    if (isDifferent && this.isPlaying && this.fadeMode !== 'off') {
      const fadeOutTime = isRapid ? 0.035 : Math.min(this.fadeDuration, 0.2);
      await this.performFade(0, fadeOutTime);
    } else {
      this.cancelFade(0);
    }

    if (this.playRequestId !== reqId) return;

    this.stopBufferSource();
    try {
      this.audio.volume = 0;
      this.audio.pause();
    } catch (_) {}

    this.isPlaying = false;
    this.playbackPosition = 0;
    this.currentTrackSrc = src;
    this.currentTrackPath = nativePath || '';
    this.currentBuffer = null;

    if (durationHint && durationHint > 0) {
      this.currentTrackDuration = durationHint;
      this.onDurationCallback?.(durationHint);
    }

    // Load HTMLAudioElement for instant streaming playback
    this.audio.src = src;
    this.audio.currentTime = 0;
    this.audio.load();

    // Warm up AudioContext immediately on user playback gesture
    const ctx = this.getOrCreateAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    // Start background PCM decode in parallel via Rust
    const loadPromise = this.preloadBuffer(src, nativePath, reqId);

    if (autoPlay) {
      const initialVol = this.fadeMode !== 'off' && (isDifferent || isTrackChange) ? 0 : this.getEffectiveVolume();
      this.setVolumeInstantly(initialVol);

      try {
        await this.audio.play();
        if (this.playRequestId !== reqId) return;
        this.isPlaying = true;
        this.onPlayCallback?.();

        if (this.fadeMode !== 'off' && (isDifferent || isTrackChange)) {
          const fadeInTime = isRapid ? 0.06 : this.fadeDuration;
          this.performFade(this.getEffectiveVolume(), fadeInTime);
        }
      } catch (e) {
        console.warn('Playback play() was blocked or interrupted:', e);
      }
    }

    loadPromise.then(() => {
      // Buffer is now decoded and cached in RAM (this.currentBuffer).
      // It is ready to be used seamlessly when the track loops at the end!
      // We deliberately do NOT interrupt the actively playing audio stream mid-song!
    });
  }

  public stop(): void {
    this.playRequestId++;
    this.cancelFade(0);
    this.isPlaying = false;
    this.playbackPosition = 0;
    this.currentTrackSrc = '';
    this.currentTrackPath = '';
    this.currentBuffer = null;
    this.stopBufferSource();
    try {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio.removeAttribute('src');
      this.audio.load();
    } catch (_) {}
    this.onPauseCallback?.();
    this.onTimeUpdateCallback?.(0);
  }

  public async pause(): Promise<void> {
    if (!this.isPlaying) return;

    if (this.fadeMode !== 'off') {
      await this.performFade(0, Math.min(this.fadeDuration, 0.4));
    }

    // Save exact position before stopping
    this.playbackPosition = this.getCurrentTime();
    this.isPlaying = false;

    this.stopBufferSource();
    try {
      this.audio.pause();
    } catch (_) {}

    this.onPauseCallback?.();
    this.onTimeUpdateCallback?.(this.playbackPosition);
  }

  public async resume(): Promise<void> {
    if (this.isPlaying) return;

    const startPos = this.playbackPosition; // Resume from EXACT point where it was paused!

    if (this.currentBuffer && this.audioCtx && this.repeatMode === 'one' && this.fadeMode !== 'always') {
      try {
        this.audio.pause();
      } catch (_) {}
      this.startBufferPlayback(startPos);
    } else {
      this.stopBufferSource();
      this.audio.currentTime = startPos;
      try {
        await this.audio.play();
        this.isPlaying = true;
      } catch (e) {
        console.warn('Resume play() interrupted:', e);
      }
    }

    this.isPlaying = true;

    if (this.fadeMode !== 'off') {
      this.setVolumeInstantly(0);
      this.performFade(this.getEffectiveVolume(), this.fadeDuration);
    } else {
      this.setVolumeInstantly(this.getEffectiveVolume());
    }

    this.onPlayCallback?.();
    this.onTimeUpdateCallback?.(startPos);
  }

  public seek(seconds: number): void {
    const dur = this.getDuration();
    const maxSafe = dur > 0.1 ? dur - 0.05 : seconds;
    const safeSec = Math.max(0, Math.min(maxSafe, seconds));

    this.cancelFade();
    this.playbackPosition = safeSec;

    if (!this.isPlaying) {
      if (!this.isUsingWebAudio) {
        this.audio.currentTime = safeSec;
      }
      this.lastTimeUpdateTimestamp = performance.now();
      this.onTimeUpdateCallback?.(safeSec);
      return;
    }

    // Actively playing!
    if (this.currentBuffer && this.audioCtx) {
      // Seek seamlessly using Web Audio PCM buffer with smooth 18ms micro-envelope
      this.startBufferPlayback(safeSec, 0.018);
    } else {
      // HTMLAudioElement: apply smooth 15ms de-click envelope before and after timestamp jump
      const effVol = this.getEffectiveVolume();
      this.fadeAudioElementVolume(0, 15, () => {
        try {
          this.audio.currentTime = safeSec;
          if (this.audio.paused) {
            this.audio.play().catch(() => {});
          }
        } catch (_) {}
        this.fadeAudioElementVolume(effVol, 15);
      });
    }

    this.lastTimeUpdateTimestamp = performance.now();
    this.onTimeUpdateCallback?.(safeSec);
  }

  public setEqGain(_bandIndex: number, _gainDb: number): void {}
  public applyEqPreset(_values: number[]): void {}

  public getVisualizerData(): Uint8Array {
    const bars = new Uint8Array(16);
    if (this.isPlaying) {
      const now = Date.now() / 150;
      for (let i = 0; i < 16; i++) {
        const val = Math.sin(now + i * 0.8) * 0.5 + 0.5;
        bars[i] = Math.round(val * 180 + 40);
      }
    }
    return bars;
  }

  public getCurrentTime(): number {
    if (this.isUsingWebAudio && this.currentBuffer && this.audioCtx) {
      const dur = this.currentBuffer.duration;
      const elapsed = this.audioCtx.currentTime - this.playbackStartTime;
      if (this.bufferSource?.loop && dur > 0) {
        return Math.max(0, Math.min(dur, (this.playbackPosition + elapsed) % dur));
      }
      return Math.max(0, Math.min(dur > 0 ? dur : Infinity, this.playbackPosition + elapsed));
    }
    const dur = this.currentTrackDuration || this.audio.duration;
    return Math.max(0, Math.min(dur || Infinity, this.isPlaying ? this.audio.currentTime : this.playbackPosition));
  }

  public getDuration(): number {
    return this.currentTrackDuration || this.currentBuffer?.duration || this.audio.duration || 0;
  }
}

export const audioEngine = new AudioEngine();
