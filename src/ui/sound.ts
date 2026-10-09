import { SOUND } from '../data/config';

const MUTE_KEY = 'ciudad-silencio';

export type SoundName = 'build' | 'zone' | 'demolish' | 'error' | 'milestone' | 'fire' | 'click';

/**
 * Sonidos generados con Web Audio (sin archivos). El navegador solo deja empezar
 * a sonar después de que el jugador toca algo, así que el contexto se crea al primer clic.
 */
export class Sound {
  muted: boolean;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambient: GainNode | null = null;

  constructor() {
    let saved = false;
    try {
      saved = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      // Sin almacenamiento: se empieza con sonido.
    }
    this.muted = saved;
    const unlock = (): void => {
      this.ensure();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  toggleMute(): void {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      // Se mantiene solo en esta sesión.
    }
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : SOUND.volume, this.ctx.currentTime, 0.05);
  }

  play(name: SoundName): void {
    const ctx = this.ensure();
    if (!ctx || this.muted) return;
    switch (name) {
      case 'click':
        this.tone(880, 0.04, 'sine', 0.25);
        break;
      case 'build':
        this.tone(520, 0.06, 'triangle', 0.4);
        this.tone(780, 0.08, 'triangle', 0.35, 0.06);
        break;
      case 'zone':
        this.tone(440, 0.05, 'sine', 0.3);
        break;
      case 'demolish':
        this.noise(0.18, 600, 0.6);
        break;
      case 'error':
        this.tone(180, 0.14, 'square', 0.18);
        break;
      case 'milestone':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.35, i * 0.12));
        break;
      case 'fire':
        for (let i = 0; i < 3; i++) this.sweep(700, 1100, 0.25, 0.15, i * 0.28);
        break;
    }
  }

  /** Murmullo de fondo que sube con la población (0 a 1). */
  setAmbient(level: number): void {
    if (!this.ambient || !this.ctx) return;
    this.ambient.gain.setTargetAtTime(Math.min(1, level) * SOUND.ambientVolume, this.ctx.currentTime, 1);
  }

  private ensure(): AudioContext | null {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    }
    try {
      this.ctx = new AudioContext();
    } catch {
      return null;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : SOUND.volume;
    this.master.connect(this.ctx.destination);
    this.startAmbient();
    return this.ctx;
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private sweep(from: number, to: number, dur: number, gain: number, delay: number): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.linearRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noiseBuffer(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private noise(dur: number, cutoff: number, gain: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(dur);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(filter).connect(g).connect(this.master!);
    src.start();
  }

  /** Ruido grave y suave en bucle, como el rumor de una ciudad. */
  private startAmbient(): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(2);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 380;
    this.ambient = ctx.createGain();
    this.ambient.gain.value = 0;
    src.connect(filter).connect(this.ambient).connect(this.master!);
    src.start();
  }
}
