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
  private audioCtx: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private eqFilters: BiquadFilterNode[] = [];
  private analyserNode: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private initializedCtx: boolean = false;

  private onTimeUpdateCallback?: (time: number) => void;
  private onDurationCallback?: (duration: number) => void;
  private onEndCallback?: () => void;
  private onPlayCallback?: () => void;
  private onPauseCallback?: () => void;

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'metadata';

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
  }

  private initWebAudio() {
    if (this.initializedCtx) return;
    this.initializedCtx = true;
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      this.audioCtx = new AudioContextClass();
      this.sourceNode = this.audioCtx.createMediaElementSource(this.audio);

      // Create 10 EQ filters
      this.eqFilters = EQ_FREQUENCIES.map((freq, i) => {
        const filter = this.audioCtx!.createBiquadFilter();
        if (i === 0) {
          filter.type = 'lowshelf';
        } else if (i === EQ_FREQUENCIES.length - 1) {
          filter.type = 'highshelf';
        } else {
          filter.type = 'peaking';
          filter.Q.value = 1.4;
        }
        filter.frequency.value = freq;
        filter.gain.value = 0;
        return filter;
      });

      // Analyser for visualizer
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 64;
      this.analyserNode.smoothingTimeConstant = 0.8;

      // Gain Node
      this.gainNode = this.audioCtx.createGain();

      let lastNode: AudioNode = this.sourceNode;
      for (const filter of this.eqFilters) {
        lastNode.connect(filter);
        lastNode = filter;
      }
      lastNode.connect(this.analyserNode);
      this.analyserNode.connect(this.gainNode);
      this.gainNode.connect(this.audioCtx.destination);
    } catch (e) {
      console.warn('Web Audio initialization error (fallback to basic audio):', e);
      this.sourceNode = null;
      this.eqFilters = [];
      this.analyserNode = null;
      this.gainNode = null;
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

  public async playTrack(src: string, autoPlay: boolean = true): Promise<void> {
    this.initWebAudio();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

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
    this.initWebAudio();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
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
    // vol: 0.0 to 1.0
    const clamped = Math.max(0, Math.min(1, vol));
    this.audio.volume = clamped;
  }

  public setEqGain(bandIndex: number, gainDb: number): void {
    if (this.eqFilters[bandIndex]) {
      this.eqFilters[bandIndex].gain.value = Math.max(-12, Math.min(12, gainDb));
    }
  }

  public applyEqPreset(values: number[]): void {
    values.forEach((gain, idx) => {
      this.setEqGain(idx, gain);
    });
  }

  public getVisualizerData(): Uint8Array {
    if (!this.analyserNode) return new Uint8Array(16);
    const bufferLength = this.analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyserNode.getByteFrequencyData(dataArray);
    return dataArray;
  }

  public getCurrentTime(): number {
    return this.audio.currentTime;
  }

  public getDuration(): number {
    return this.audio.duration || 0;
  }
}

export const audioEngine = new AudioEngine();
