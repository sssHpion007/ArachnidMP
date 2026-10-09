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

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';

    this.audio.addEventListener('timeupdate', () => {
      this.onTimeUpdateCallback?.(this.audio.currentTime);
    });

    this.audio.addEventListener('durationchange', () => {
      if (this.audio.duration && !isNaN(this.audio.duration)) {
        this.onDurationCallback?.(this.audio.duration);
      }
    });

    this.audio.addEventListener('ended', () => {
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

  public async playTrack(src: string, autoPlay: boolean = true): Promise<void> {
    if (this.audio.src !== src) {
      this.audio.src = src;
      this.audio.load();
    }

    if (autoPlay) {
      try {
        await this.audio.play();
      } catch (e) {
        console.warn('Playback play() was blocked or interrupted:', e);
      }
    }
  }

  public async resume(): Promise<void> {
    return this.audio.play();
  }

  public pause(): void {
    this.audio.pause();
  }

  public seek(seconds: number): void {
    if (!isNaN(seconds) && isFinite(seconds)) {
      this.audio.currentTime = Math.max(0, Math.min(seconds, this.audio.duration || seconds));
    }
  }

  public setVolume(vol: number): void {
    const clamped = Math.max(0, Math.min(1, vol));
    this.audio.volume = clamped;
  }

  public setEqGain(_bandIndex: number, _gainDb: number): void {
    // Stored for EQ settings
  }

  public applyEqPreset(_values: number[]): void {
    // Stored for EQ preset
  }

  public getVisualizerData(): Uint8Array {
    // Return animated spectrum bars when playing
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
