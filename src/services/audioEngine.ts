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

class AudioEngine {
  private audio: HTMLAudioElement;
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

  private fadeAnimFrame: number | null = null;
  private isFadingOutAtEnd: boolean = false;

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';

    this.audio.addEventListener('timeupdate', () => {
      this.handleTimeUpdate();
    });

    this.audio.addEventListener('durationchange', () => {
      if (this.audio.duration && !isNaN(this.audio.duration)) {
        this.onDurationCallback?.(this.audio.duration);
      }
    });

    this.audio.addEventListener('ended', () => {
      this.isFadingOutAtEnd = false;
      this.onEndCallback?.();
    });

    this.audio.addEventListener('play', () => {
      this.onPlayCallback?.();
    });

    this.audio.addEventListener('pause', () => {
      this.onPauseCallback?.();
    });

    this.audio.addEventListener('error', () => {
      const err = this.audio.error;
      console.warn('Audio playback error:', err ? `code=${err.code}, msg=${err.message}` : 'unknown error');
    });
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
    this.updateLoopState();
  }

  public setRepeatMode(mode: 'off' | 'all' | 'one') {
    this.repeatMode = mode;
    this.updateLoopState();
  }

  private updateLoopState() {
    // Seamless native gapless loop:
    // When repeating 'one' and fade is not 'always', native loop keeps playback running
    // directly at sample accuracy without stopping or hitching.
    const shouldLoopNatively = (this.repeatMode === 'one' && this.fadeMode !== 'always');
    this.audio.loop = shouldLoopNatively;
  }

  public getEffectiveVolume(): number {
    return this.isMuted ? 0 : this.targetVolume;
  }

  public setVolume(vol: number): void {
    const clamped = Math.max(0, Math.min(1, vol));
    this.targetVolume = clamped;
    if (this.fadeAnimFrame === null && !this.isFadingOutAtEnd) {
      this.audio.volume = this.getEffectiveVolume();
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.fadeAnimFrame === null && !this.isFadingOutAtEnd) {
      this.audio.volume = this.getEffectiveVolume();
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

    const startVol = this.audio.volume;
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
      this.audio.volume = Math.max(0, Math.min(1, currentVol));

      if (progress < 1) {
        this.fadeAnimFrame = requestAnimationFrame(step);
      } else {
        this.audio.volume = Math.max(0, Math.min(1, targetVol));
        this.fadeAnimFrame = null;
        onComplete?.();
      }
    };

    this.fadeAnimFrame = requestAnimationFrame(step);
  }

  private handleTimeUpdate() {
    const curTime = this.audio.currentTime;
    const dur = this.audio.duration;
    this.onTimeUpdateCallback?.(curTime);

    if (!dur || isNaN(dur) || this.audio.paused) return;

    const remaining = dur - curTime;
    const isSingleRepeat = this.repeatMode === 'one';

    // End-of-track fade out decision:
    // Mode 3 ('always'): fade out even when single track repeats
    // Mode 2 ('track_change_and_pause'): fade out only when transitioning to a different track
    // Mode 1 ('off'): no fade out
    const shouldFadeOut = 
      (this.fadeMode === 'always') || 
      (this.fadeMode === 'track_change_and_pause' && !isSingleRepeat);

    if (shouldFadeOut && this.fadeDuration > 0) {
      if (remaining <= this.fadeDuration && remaining > 0) {
        if (!this.isFadingOutAtEnd) {
          this.isFadingOutAtEnd = true;
          this.startFade(0, remaining);
        }
      } else if (remaining > this.fadeDuration && this.isFadingOutAtEnd) {
        this.isFadingOutAtEnd = false;
        this.startFade(this.getEffectiveVolume(), 0.5);
      }
    }
  }

  public async playTrack(src: string, autoPlay: boolean = true, isTrackChange: boolean = true): Promise<void> {
    const isDifferentSrc = this.audio.src !== src;
    const isCurrentlyPlaying = !this.audio.paused && this.audio.currentTime > 0;

    // Fade out previous track if switching and fade is active
    if (isDifferentSrc && isCurrentlyPlaying && this.fadeMode !== 'off') {
      const fadeOutTime = Math.min(this.fadeDuration, 0.5);
      await new Promise<void>((resolve) => {
        this.startFade(0, fadeOutTime, () => resolve());
      });
    } else {
      this.cancelFade();
    }

    this.isFadingOutAtEnd = false;

    if (isDifferentSrc) {
      this.audio.src = src;
      this.audio.load();
    }

    this.updateLoopState();

    if (autoPlay) {
      if (this.fadeMode !== 'off' && (isDifferentSrc || isTrackChange)) {
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
    this.updateLoopState();

    if (this.fadeMode !== 'off') {
      this.audio.volume = 0;
      try {
        await this.audio.play();
        this.startFade(this.getEffectiveVolume(), this.fadeDuration);
      } catch (e) {
        console.warn('Resume play() was interrupted:', e);
      }
    } else {
      this.audio.volume = this.getEffectiveVolume();
      try {
        await this.audio.play();
      } catch (e) {
        console.warn('Resume play() was interrupted:', e);
      }
    }
  }

  public async pause(): Promise<void> {
    if (this.audio.paused) return;

    if (this.fadeMode !== 'off') {
      const fadeOutTime = Math.min(this.fadeDuration, 0.8);
      return new Promise<void>((resolve) => {
        this.startFade(0, fadeOutTime, () => {
          this.audio.pause();
          this.audio.volume = this.getEffectiveVolume();
          resolve();
        });
      });
    } else {
      this.cancelFade();
      this.audio.pause();
      this.audio.volume = this.getEffectiveVolume();
    }
  }

  public seek(seconds: number): void {
    if (!isNaN(seconds) && isFinite(seconds)) {
      this.cancelFade();
      this.isFadingOutAtEnd = false;
      this.audio.currentTime = Math.max(0, Math.min(seconds, this.audio.duration || seconds));
      this.audio.volume = this.getEffectiveVolume();
    }
  }

  public setEqGain(_bandIndex: number, _gainDb: number): void {}
  public applyEqPreset(_values: number[]): void {}

  public getVisualizerData(): Uint8Array {
    const bars = new Uint8Array(16);
    if (!this.audio.paused && !this.audio.ended) {
      const now = Date.now() / 150;
      for (let i = 0; i < 16; i++) {
        const val = Math.sin(now + i * 0.8) * 0.5 + 0.5;
        bars[i] = Math.round(val * 180 + 40);
      }
    }
    return bars;
  }

  public getCurrentTime(): number {
    return this.audio.currentTime;
  }

  public getDuration(): number {
    return this.audio.duration || 0;
  }
}

export const audioEngine = new AudioEngine();
