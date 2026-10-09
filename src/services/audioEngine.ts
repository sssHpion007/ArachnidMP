import { FadeMode } from '../types/music';

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
 * High-Performance Gapless Audio Engine (MusicBee-grade)
 *
 * 1. For normal playback: Instant streaming via single HTMLAudioElement with smooth volume curves.
 * 2. For seamless single-track looping (repeatMode: 'one'):
 *    Decodes audio into a memory-resident 32-bit float PCM AudioBuffer via Web Audio API.
 *    Uses hardware AudioBufferSourceNode.loop = true, which loops directly in the audio thread
 *    at sample boundaries.
 *    This completely eliminates:
 *      - Buffer starvation / Media Foundation EOS stall (заикание)
 *      - DC offset discontinuities / waveform clipping (треск / щелчок)
 *      - Timeline expansion / drift bugs
 */
class AudioEngine {
  private audio: HTMLAudioElement;
  private audioCtx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private bufferSource: AudioBufferSourceNode | null = null;
  private currentBuffer: AudioBuffer | null = null;
  private isBufferLoopActive: boolean = false;
  private bufferLoopStartTime: number = 0;
  private bufferLoopOffset: number = 0;

  private onTimeUpdateCallback?: (time: number) => void;
  private onDurationCallback?: (duration: number) => void;
  private onEndCallback?: () => void;
  private onPlayCallback?: () => void;
  private onPauseCallback?: () => void;

  private targetVolume: number = 0.85;
  private isMuted: boolean = false;
  private fadeMode: FadeMode = 'track_change_and_pause';
  private fadeDuration: number = 2.0; // seconds
  private repeatMode: 'off' | 'all' | 'one' = 'all';

  private rafId: number | null = null;
  private fadeAnimFrame: number | null = null;
  private isFadingOutAtEnd: boolean = false;
  private currentTrackSrc: string = '';
  private currentTrackDuration: number = 0;

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

    this.audio.addEventListener('play', () => {
      this.onPlayCallback?.();
    });

    this.audio.addEventListener('pause', () => {
      if (!this.isBufferLoopActive) {
        this.onPauseCallback?.();
      }
    });

    this.audio.addEventListener('ended', () => {
      if (!this.isBufferLoopActive) {
        this.isFadingOutAtEnd = false;
        this.onEndCallback?.();
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

  private setGainVolume(vol: number) {
    if (this.gainNode && this.audioCtx) {
      this.gainNode.gain.setValueAtTime(vol, this.audioCtx.currentTime);
    }
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
    this.repeatMode = mode;
    if (mode === 'one') {
      if (this.fadeMode !== 'always' && this.currentBuffer && !this.audio.paused && !this.isBufferLoopActive) {
        const curTime = this.getCurrentTime();
        this.startWebAudioLoop(curTime);
      }
    } else {
      if (this.isBufferLoopActive) {
        const curTime = this.getCurrentTime();
        this.stopWebAudioSource();
        this.audio.currentTime = curTime;
        this.audio.volume = this.getEffectiveVolume();
        this.audio.play().catch(() => {});
      }
    }
  }

  public getEffectiveVolume(): number {
    return this.isMuted ? 0 : this.targetVolume;
  }

  public setVolume(vol: number): void {
    const clamped = Math.max(0, Math.min(1, vol));
    this.targetVolume = clamped;
    const eff = this.getEffectiveVolume();
    if (this.fadeAnimFrame === null && !this.isFadingOutAtEnd) {
      this.audio.volume = eff;
      this.setGainVolume(eff);
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    const eff = this.getEffectiveVolume();
    if (this.fadeAnimFrame === null && !this.isFadingOutAtEnd) {
      this.audio.volume = eff;
      this.setGainVolume(eff);
    }
  }

  private cancelFade() {
    if (this.fadeAnimFrame !== null) {
      cancelAnimationFrame(this.fadeAnimFrame);
      this.fadeAnimFrame = null;
    }
  }

  private startFade(targetVol: number, durationSec: number, onComplete?: () => void) {
    this.cancelFade();

    const startVol = this.isBufferLoopActive 
      ? (this.gainNode?.gain.value ?? this.targetVolume)
      : this.audio.volume;
    const startTime = performance.now();
    const durationMs = Math.max(40, durationSec * 1000);

    const step = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / durationMs);

      // Smooth ease-in-out curve
      const eased = progress < 0.5 
        ? 2 * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const currentVol = startVol + (targetVol - startVol) * eased;
      const clampedVol = Math.max(0, Math.min(1, currentVol));

      if (this.isBufferLoopActive) {
        this.setGainVolume(clampedVol);
      } else {
        this.audio.volume = clampedVol;
      }

      if (progress < 1) {
        this.fadeAnimFrame = requestAnimationFrame(step);
      } else {
        const finalVol = Math.max(0, Math.min(1, targetVol));
        if (this.isBufferLoopActive) {
          this.setGainVolume(finalVol);
        } else {
          this.audio.volume = finalVol;
        }
        this.fadeAnimFrame = null;
        onComplete?.();
      }
    };

    this.fadeAnimFrame = requestAnimationFrame(step);
  }

  /**
   * Pre-loads the audio file into memory and decodes PCM for gapless Web Audio looping
   */
  private async preloadBufferForSeamlessLoop(src: string) {
    if (!src) return;
    try {
      const ctx = this.getOrCreateAudioContext();
      const response = await fetch(src);
      const arrayBuffer = await response.arrayBuffer();
      const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);

      if (this.currentTrackSrc === src) {
        this.currentBuffer = decodedBuffer;
        this.currentTrackDuration = decodedBuffer.duration;
        this.onDurationCallback?.(decodedBuffer.duration);

        // If repeating single track and currently playing, switch to seamless PCM loop
        if (this.repeatMode === 'one' && this.fadeMode !== 'always' && !this.audio.paused && !this.isBufferLoopActive) {
          const curTime = this.audio.currentTime;
          this.startWebAudioLoop(curTime);
        }
      }
    } catch (e) {
      console.warn('Web Audio PCM preload fallback:', e);
      this.currentBuffer = null;
    }
  }

  /**
   * Starts sample-accurate hardware looping with Web Audio API (zero stutter, zero crackle)
   */
  private startWebAudioLoop(startOffset: number) {
    if (!this.currentBuffer) return;
    const ctx = this.getOrCreateAudioContext();

    this.audio.pause();
    this.stopWebAudioSource();

    const source = ctx.createBufferSource();
    source.buffer = this.currentBuffer;
    source.loop = true; // Hardware sample-accurate gapless loop!
    source.connect(this.gainNode!);

    const dur = this.currentBuffer.duration;
    const offset = Math.max(0, Math.min(dur, startOffset % dur));

    source.start(0, offset);
    this.bufferSource = source;
    this.isBufferLoopActive = true;
    this.bufferLoopStartTime = ctx.currentTime;
    this.bufferLoopOffset = offset;

    this.onPlayCallback?.();
  }

  private stopWebAudioSource() {
    if (this.bufferSource) {
      try {
        this.bufferSource.stop();
        this.bufferSource.disconnect();
      } catch (_) {}
      this.bufferSource = null;
    }
    this.isBufferLoopActive = false;
  }

  /**
   * 60fps monitor loop
   * Ensures smooth scrubber movement and mathematically clamped timeline values
   */
  private startPrecisionLoop() {
    const loop = () => {
      if (this.isBufferLoopActive && this.currentBuffer && this.audioCtx) {
        const dur = this.currentBuffer.duration;
        const elapsed = this.audioCtx.currentTime - this.bufferLoopStartTime;
        const curTime = (this.bufferLoopOffset + elapsed) % dur;
        const safeTime = Math.max(0, Math.min(dur, curTime));
        this.onTimeUpdateCallback?.(safeTime);
      } else if (!this.audio.paused) {
        const dur = this.currentTrackDuration || this.audio.duration;
        if (dur && !isNaN(dur) && isFinite(dur) && dur > 0) {
          const curTime = Math.max(0, Math.min(dur, this.audio.currentTime));
          this.onTimeUpdateCallback?.(curTime);

          const remaining = dur - curTime;

          if (this.repeatMode === 'one' && this.fadeMode !== 'always' && this.currentBuffer) {
            this.startWebAudioLoop(curTime);
          } else if (this.fadeMode === 'always' || (this.fadeMode === 'track_change_and_pause' && this.repeatMode !== 'one')) {
            if (this.fadeDuration > 0 && remaining <= this.fadeDuration && remaining > 0 && !this.isFadingOutAtEnd) {
              this.isFadingOutAtEnd = true;
              this.startFade(0, remaining);
            }
          }
        }
      }

      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  public async playTrack(
    src: string, 
    autoPlay: boolean = true, 
    isTrackChange: boolean = true,
    durationHint?: number
  ): Promise<void> {
    const isDifferent = this.currentTrackSrc !== src;

    // Fade out previous track if switching between different tracks and fade is active
    if (isDifferent && !this.audio.paused && this.fadeMode !== 'off') {
      const fadeOutTime = Math.min(this.fadeDuration, 0.5);
      await new Promise<void>((resolve) => {
        this.startFade(0, fadeOutTime, () => resolve());
      });
    } else {
      this.cancelFade();
    }

    this.stopWebAudioSource();
    this.isFadingOutAtEnd = false;
    this.currentTrackSrc = src;
    if (durationHint && durationHint > 0) {
      this.currentTrackDuration = durationHint;
      this.onDurationCallback?.(durationHint);
    }

    if (isDifferent) {
      this.audio.src = src;
      this.audio.load();
      // Preload PCM in background for gapless looping
      this.preloadBufferForSeamlessLoop(src);
    }

    if (autoPlay) {
      if (this.fadeMode !== 'off' && (isDifferent || isTrackChange)) {
        this.audio.volume = 0;
        try {
          await this.audio.play();
          this.startFade(this.getEffectiveVolume(), this.fadeDuration);
        } catch (e) {
          console.warn('Playback play() was blocked or interrupted:', e);
        }
      } else {
        this.audio.volume = this.getEffectiveVolume();
        try {
          await this.audio.play();
        } catch (e) {
          console.warn('Playback play() was blocked or interrupted:', e);
        }
      }
    }
  }

  public async resume(): Promise<void> {
    this.isFadingOutAtEnd = false;

    if (this.repeatMode === 'one' && this.fadeMode !== 'always' && this.currentBuffer) {
      const curTime = this.getCurrentTime();
      this.startWebAudioLoop(curTime);
      if (this.fadeMode !== 'off') {
        this.setGainVolume(0);
        this.startFade(this.getEffectiveVolume(), this.fadeDuration);
      } else {
        this.setGainVolume(this.getEffectiveVolume());
      }
    } else {
      if (this.fadeMode !== 'off') {
        this.audio.volume = 0;
        try {
          await this.audio.play();
          this.startFade(this.getEffectiveVolume(), this.fadeDuration);
        } catch (e) {
          console.warn('Resume play() interrupted:', e);
        }
      } else {
        this.audio.volume = this.getEffectiveVolume();
        try {
          await this.audio.play();
        } catch (e) {
          console.warn('Resume play() interrupted:', e);
        }
      }
    }
  }

  public async pause(): Promise<void> {
    if (this.isBufferLoopActive && this.audioCtx) {
      if (this.fadeMode !== 'off') {
        const fadeOutTime = Math.min(this.fadeDuration, 0.6);
        await new Promise<void>((resolve) => {
          this.startFade(0, fadeOutTime, () => resolve());
        });
      }
      this.stopWebAudioSource();
      this.onPauseCallback?.();
    } else if (!this.audio.paused) {
      if (this.fadeMode !== 'off') {
        const fadeOutTime = Math.min(this.fadeDuration, 0.6);
        await new Promise<void>((resolve) => {
          this.startFade(0, fadeOutTime, () => resolve());
        });
      }
      this.audio.pause();
      this.audio.volume = this.getEffectiveVolume();
      this.onPauseCallback?.();
    }
  }

  public seek(seconds: number): void {
    const dur = this.currentTrackDuration || this.audio.duration || seconds;
    const safeSec = Math.max(0, Math.min(dur, seconds));

    this.cancelFade();
    this.isFadingOutAtEnd = false;

    if (this.isBufferLoopActive && this.currentBuffer) {
      this.startWebAudioLoop(safeSec);
    } else {
      this.audio.currentTime = safeSec;
      this.audio.volume = this.getEffectiveVolume();
    }

    this.onTimeUpdateCallback?.(safeSec);
  }

  public setEqGain(_bandIndex: number, _gainDb: number): void {}
  public applyEqPreset(_values: number[]): void {}

  public getVisualizerData(): Uint8Array {
    const bars = new Uint8Array(16);
    const isPlaying = this.isBufferLoopActive || (!this.audio.paused && !this.audio.ended);
    if (isPlaying) {
      const now = Date.now() / 150;
      for (let i = 0; i < 16; i++) {
        const val = Math.sin(now + i * 0.8) * 0.5 + 0.5;
        bars[i] = Math.round(val * 180 + 40);
      }
    }
    return bars;
  }

  public getCurrentTime(): number {
    if (this.isBufferLoopActive && this.currentBuffer && this.audioCtx) {
      const dur = this.currentBuffer.duration;
      const elapsed = this.audioCtx.currentTime - this.bufferLoopStartTime;
      return Math.max(0, Math.min(dur, (this.bufferLoopOffset + elapsed) % dur));
    }
    const dur = this.currentTrackDuration || this.audio.duration;
    return Math.max(0, Math.min(dur || Infinity, this.audio.currentTime || 0));
  }

  public getDuration(): number {
    return this.currentTrackDuration || this.currentBuffer?.duration || this.audio.duration || 0;
  }
}

export const audioEngine = new AudioEngine();
