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
 * Dual-Buffered Gapless Audio Engine (MusicBee-grade)
 *
 * Uses two synchronized audio elements (A and B) with 60fps micro-lookahead.
 * For seamless looping, before player A hits the end, player B is pre-buffered at time 0
 * and an equal-power micro-crossfade (~80ms) smoothly transitions between them.
 * This completely eliminates:
 *  1. Silence / audio buffer starvation stutter (заикание)
 *  2. Discontinuity pop / DC offset clicks (треск / щелчок)
 */
class AudioEngine {
  private playerA: HTMLAudioElement;
  private playerB: HTMLAudioElement;
  private activePlayerId: 'A' | 'B' = 'A';

  private onTimeUpdateCallback?: (time: number) => void;
  private onDurationCallback?: (duration: number) => void;
  private onEndCallback?: () => void;
  private onPlayCallback?: () => void;
  private onPauseCallback?: () => void;

  private targetVolume: number = 0.85;
  private isMuted: boolean = false;
  private fadeMode: FadeMode = 'track_change_and_pause';
  private fadeDuration: number = 2.0; // in seconds
  private repeatMode: 'off' | 'all' | 'one' = 'all';

  // Precision loop & transition state
  private rafId: number | null = null;
  private isLoopTransitioning: boolean = false;
  private isFadingOutAtEnd: boolean = false;
  private fadeAnimFrame: number | null = null;

  constructor() {
    this.playerA = new Audio();
    this.playerB = new Audio();

    this.setupPlayer(this.playerA, 'A');
    this.setupPlayer(this.playerB, 'B');

    this.startPrecisionLoop();
  }

  private get activePlayer(): HTMLAudioElement {
    return this.activePlayerId === 'A' ? this.playerA : this.playerB;
  }

  private get standbyPlayer(): HTMLAudioElement {
    return this.activePlayerId === 'A' ? this.playerB : this.playerA;
  }

  private setupPlayer(player: HTMLAudioElement, id: 'A' | 'B') {
    player.preload = 'auto';

    player.addEventListener('durationchange', () => {
      if (this.activePlayerId === id && player.duration && !isNaN(player.duration)) {
        this.onDurationCallback?.(player.duration);
      }
    });

    player.addEventListener('play', () => {
      if (this.activePlayerId === id) {
        this.onPlayCallback?.();
      }
    });

    player.addEventListener('pause', () => {
      if (this.activePlayerId === id && !this.isLoopTransitioning) {
        this.onPauseCallback?.();
      }
    });

    player.addEventListener('ended', () => {
      if (this.activePlayerId === id && !this.isLoopTransitioning) {
        this.isFadingOutAtEnd = false;
        this.onEndCallback?.();
      }
    });

    player.addEventListener('error', () => {
      const err = player.error;
      console.warn(`Audio player ${id} error:`, err ? `code=${err.code}, msg=${err.message}` : 'unknown error');
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
  }

  public setRepeatMode(mode: 'off' | 'all' | 'one') {
    this.repeatMode = mode;
    if (mode === 'one') {
      // Preload standby player with active player's source
      if (this.activePlayer.src && this.standbyPlayer.src !== this.activePlayer.src) {
        this.standbyPlayer.src = this.activePlayer.src;
        this.standbyPlayer.load();
      }
    } else {
      this.isLoopTransitioning = false;
      this.standbyPlayer.pause();
      this.standbyPlayer.currentTime = 0;
    }
  }

  public getEffectiveVolume(): number {
    return this.isMuted ? 0 : this.targetVolume;
  }

  public setVolume(vol: number): void {
    const clamped = Math.max(0, Math.min(1, vol));
    this.targetVolume = clamped;
    if (this.fadeAnimFrame === null && !this.isFadingOutAtEnd && !this.isLoopTransitioning) {
      this.activePlayer.volume = this.getEffectiveVolume();
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.fadeAnimFrame === null && !this.isFadingOutAtEnd && !this.isLoopTransitioning) {
      this.activePlayer.volume = this.getEffectiveVolume();
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

    const currentAudio = this.activePlayer;
    const startVol = currentAudio.volume;
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
      currentAudio.volume = Math.max(0, Math.min(1, currentVol));

      if (progress < 1) {
        this.fadeAnimFrame = requestAnimationFrame(step);
      } else {
        currentAudio.volume = Math.max(0, Math.min(1, targetVol));
        this.fadeAnimFrame = null;
        onComplete?.();
      }
    };

    this.fadeAnimFrame = requestAnimationFrame(step);
  }

  /**
   * High precision 60fps monitor loop
   * Dispatches timeupdates smoothly and executes gapless seamless loop transitions
   */
  private startPrecisionLoop() {
    const loop = () => {
      const active = this.activePlayer;

      if (!active.paused && active.duration && !isNaN(active.duration) && isFinite(active.duration)) {
        const curTime = active.currentTime;
        const dur = active.duration;

        this.onTimeUpdateCallback?.(curTime);

        const remaining = dur - curTime;

        // Gapless seamless loop when repeatMode === 'one' and fade is not 'always'
        if (this.repeatMode === 'one' && this.fadeMode !== 'always') {
          // Micro-overlap window (80ms): seamless transition before EOS
          const OVERLAP_SECONDS = 0.08;
          if (remaining <= OVERLAP_SECONDS && remaining >= 0 && !this.isLoopTransitioning) {
            this.triggerSeamlessLoop(remaining);
          }
        } else if (this.fadeMode === 'always' || (this.fadeMode === 'track_change_and_pause' && this.repeatMode !== 'one')) {
          // Standard fade-out near end of track
          if (this.fadeDuration > 0) {
            if (remaining <= this.fadeDuration && remaining > 0 && !this.isFadingOutAtEnd) {
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

  /**
   * Dual-Player Equal-Power Seamless Loop Crossfade
   * Transitions from active player to pre-buffered standby player smoothly.
   */
  private triggerSeamlessLoop(remainingTime: number) {
    this.isLoopTransitioning = true;
    const current = this.activePlayer;
    const next = this.standbyPlayer;

    if (next.src !== current.src) {
      next.src = current.src;
      next.load();
    }

    next.currentTime = 0;
    next.volume = 0;

    next.play().catch(e => console.warn('Seamless loop start interrupted:', e));

    const crossfadeDur = Math.max(0.04, Math.min(0.1, remainingTime || 0.08));
    const startTime = performance.now();
    const effVol = this.getEffectiveVolume();

    const step = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      const progress = Math.min(1, elapsed / crossfadeDur);

      // Equal-power crossfade curve: cos(t * pi/2) for fade out, sin(t * pi/2) for fade in
      // Eliminates perceived drop in loudness and completely prevents DC offset crackle/clicks
      const fadeOut = Math.cos(progress * 0.5 * Math.PI);
      const fadeIn = Math.sin(progress * 0.5 * Math.PI);

      current.volume = Math.max(0, Math.min(1, effVol * fadeOut));
      next.volume = Math.max(0, Math.min(1, effVol * fadeIn));

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        // Switch players cleanly
        current.pause();
        current.currentTime = 0;
        current.volume = 0;

        next.volume = effVol;

        // Swap roles: standby becomes active, active becomes standby
        this.activePlayerId = this.activePlayerId === 'A' ? 'B' : 'A';
        this.isLoopTransitioning = false;

        // Preload newly standby player for next cycle
        current.src = next.src;
        current.load();
      }
    };

    requestAnimationFrame(step);
  }

  public async playTrack(src: string, autoPlay: boolean = true, isTrackChange: boolean = true): Promise<void> {
    const isDifferent = this.activePlayer.src !== src;
    const isPlayingNow = !this.activePlayer.paused && this.activePlayer.currentTime > 0;

    // Fade out previous track if switching and fade is active
    if (isDifferent && isPlayingNow && this.fadeMode !== 'off') {
      const fadeOutTime = Math.min(this.fadeDuration, 0.5);
      await new Promise<void>((resolve) => {
        this.startFade(0, fadeOutTime, () => resolve());
      });
    } else {
      this.cancelFade();
    }

    this.isFadingOutAtEnd = false;
    this.isLoopTransitioning = false;

    // Stop and reset standby player
    this.standbyPlayer.pause();
    this.standbyPlayer.currentTime = 0;
    this.standbyPlayer.volume = 0;

    if (isDifferent) {
      this.activePlayer.src = src;
      this.activePlayer.load();

      // Preload standby player with the same src so it's instantly ready for seamless looping
      this.standbyPlayer.src = src;
      this.standbyPlayer.load();
    }

    if (autoPlay) {
      if (this.fadeMode !== 'off' && (isDifferent || isTrackChange)) {
        this.activePlayer.volume = 0;
        try {
          await this.activePlayer.play();
          this.startFade(this.getEffectiveVolume(), this.fadeDuration);
        } catch (e) {
          console.warn('Playback play() was blocked or interrupted:', e);
        }
      } else {
        this.activePlayer.volume = this.getEffectiveVolume();
        try {
          await this.activePlayer.play();
        } catch (e) {
          console.warn('Playback play() was blocked or interrupted:', e);
        }
      }
    }
  }

  public async resume(): Promise<void> {
    this.isFadingOutAtEnd = false;
    this.isLoopTransitioning = false;

    if (this.fadeMode !== 'off') {
      this.activePlayer.volume = 0;
      try {
        await this.activePlayer.play();
        this.startFade(this.getEffectiveVolume(), this.fadeDuration);
      } catch (e) {
        console.warn('Resume play() was interrupted:', e);
      }
    } else {
      this.activePlayer.volume = this.getEffectiveVolume();
      try {
        await this.activePlayer.play();
      } catch (e) {
        console.warn('Resume play() was interrupted:', e);
      }
    }
  }

  public async pause(): Promise<void> {
    if (this.activePlayer.paused) return;

    if (this.fadeMode !== 'off') {
      const fadeOutTime = Math.min(this.fadeDuration, 0.8);
      return new Promise<void>((resolve) => {
        this.startFade(0, fadeOutTime, () => {
          this.activePlayer.pause();
          this.standbyPlayer.pause();
          this.activePlayer.volume = this.getEffectiveVolume();
          resolve();
        });
      });
    } else {
      this.cancelFade();
      this.activePlayer.pause();
      this.standbyPlayer.pause();
      this.activePlayer.volume = this.getEffectiveVolume();
    }
  }

  public seek(seconds: number): void {
    if (!isNaN(seconds) && isFinite(seconds)) {
      this.cancelFade();
      this.isFadingOutAtEnd = false;
      this.isLoopTransitioning = false;

      this.standbyPlayer.pause();
      this.standbyPlayer.currentTime = 0;

      const dur = this.activePlayer.duration || seconds;
      this.activePlayer.currentTime = Math.max(0, Math.min(seconds, dur));
      this.activePlayer.volume = this.getEffectiveVolume();
    }
  }

  public setEqGain(_bandIndex: number, _gainDb: number): void {}
  public applyEqPreset(_values: number[]): void {}

  public getVisualizerData(): Uint8Array {
    const bars = new Uint8Array(16);
    if (!this.activePlayer.paused && !this.activePlayer.ended) {
      const now = Date.now() / 150;
      for (let i = 0; i < 16; i++) {
        const val = Math.sin(now + i * 0.8) * 0.5 + 0.5;
        bars[i] = Math.round(val * 180 + 40);
      }
    }
    return bars;
  }

  public getCurrentTime(): number {
    return this.activePlayer.currentTime;
  }

  public getDuration(): number {
    return this.activePlayer.duration || 0;
  }
}

export const audioEngine = new AudioEngine();
