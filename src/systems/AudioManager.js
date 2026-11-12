/**
 * Web Audio synthesised arcade SFX — no external asset, no network requests.
 * The context is created lazily on the first user gesture (browser policy).
 */
export class AudioManager {
  constructor({ enabled = true } = {}) {
    this.ctx = null;
    this.master = null;
    this.compressor = null;
    this.noiseBuffer = null;
    this.enabled = enabled;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;

    try {
      this.ctx = new Ctx();
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -14;
      this.compressor.knee.value = 22;
      this.compressor.ratio.value = 10;
      this.compressor.attack.value = 0.002;
      this.compressor.release.value = 0.16;

      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.85 : 0;
      this.master.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);

      this.noiseBuffer = this.createNoiseBuffer();
    } catch {
      this.ctx = null;
    }
  }

  createNoiseBuffer() {
    const length = Math.floor(this.ctx.sampleRate * 0.5);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!this.master || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(enabled ? 0.85 : 0, now, 0.02);
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  get time() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  tone({ freq, to = freq, type = 'sine', dur = 0.12, gain = 0.12, delay = 0, attack = 0.004, filterType, filterFreq, filterTo }) {
    if (!this.ctx || !this.enabled) return;
    const start = this.time + delay;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), start);
    if (to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + dur);

    env.gain.setValueAtTime(0.0001, start);
    env.gain.linearRampToValueAtTime(gain, start + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    let node = osc;
    if (filterType) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.setValueAtTime(filterFreq ?? 900, start);
      if (filterTo) filter.frequency.exponentialRampToValueAtTime(Math.max(40, filterTo), start + dur);
      osc.connect(filter);
      node = filter;
    }
    node.connect(env);
    env.connect(this.master);

    osc.start(start);
    osc.stop(start + dur + 0.03);
  }

  noise({ dur = 0.09, gain = 0.1, delay = 0, type = 'bandpass', freq = 1400, freqTo, q = 1.1 }) {
    if (!this.ctx || !this.enabled || !this.noiseBuffer) return;
    const start = this.time + delay;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, start);
    if (freqTo) filter.frequency.exponentialRampToValueAtTime(Math.max(60, freqTo), start + dur);
    filter.Q.value = q;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.linearRampToValueAtTime(gain, start + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    source.connect(filter);
    filter.connect(env);
    env.connect(this.master);
    source.start(start);
    source.stop(start + dur + 0.02);
  }

  play(name, options = {}) {
    if (!this.enabled) return;
    if (!this.ctx) this.init();
    if (!this.ctx) return;
    this.resume();

    switch (name) {
      case 'paddle':
        this.tone({ freq: 210, to: 330, type: 'square', dur: 0.075, gain: 0.1, filterType: 'lowpass', filterFreq: 1800 });
        this.tone({ freq: 96, to: 70, type: 'sine', dur: 0.1, gain: 0.09 });
        break;
      case 'wall':
        this.tone({ freq: 260, to: 190, type: 'triangle', dur: 0.06, gain: 0.055 });
        break;
      case 'block': {
        const base = 320 + (options.colorIndex ?? 0) * 46;
        this.noise({ dur: 0.07, gain: 0.075, type: 'bandpass', freq: 1800, q: 1.4 });
        this.tone({ freq: base, to: base * 0.72, type: 'square', dur: 0.07, gain: 0.055, filterType: 'lowpass', filterFreq: 2600 });
        break;
      }
      case 'shatter': {
        const base = 260 + (options.colorIndex ?? 0) * 38;
        this.noise({ dur: 0.16, gain: 0.09, type: 'highpass', freq: 1100, q: 0.8 });
        this.tone({ freq: base, to: base * 0.4, type: 'triangle', dur: 0.18, gain: 0.075 });
        break;
      }
      case 'steel':
        this.tone({ freq: 168, to: 120, type: 'square', dur: 0.075, gain: 0.06, filterType: 'bandpass', filterFreq: 900 });
        break;
      case 'powerup': {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, index) => {
          this.tone({ freq, type: 'sine', dur: 0.13, gain: 0.075, delay: index * 0.05 });
          this.tone({ freq: freq * 2, type: 'triangle', dur: 0.09, gain: 0.02, delay: index * 0.05 });
        });
        break;
      }
      case 'life':
        [523.25, 783.99, 1046.5].forEach((freq, index) => {
          this.tone({ freq, type: 'sine', dur: 0.2, gain: 0.08, delay: index * 0.07 });
        });
        break;
      case 'lose':
        this.tone({ freq: 340, to: 70, type: 'sawtooth', dur: 0.55, gain: 0.09, filterType: 'lowpass', filterFreq: 1400, filterTo: 260 });
        break;
      case 'gameover':
        this.tone({ freq: 196, to: 98, type: 'triangle', dur: 0.7, gain: 0.11 });
        this.tone({ freq: 147, to: 73, type: 'sawtooth', dur: 0.9, gain: 0.06, delay: 0.16, filterType: 'lowpass', filterFreq: 900 });
        break;
      case 'levelclear': {
        const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
        notes.forEach((freq, index) => {
          this.tone({ freq, type: 'triangle', dur: 0.22, gain: 0.075, delay: index * 0.085 });
        });
        break;
      }
      case 'start':
        this.tone({ freq: 220, to: 880, type: 'sawtooth', dur: 0.32, gain: 0.07, filterType: 'lowpass', filterFreq: 600, filterTo: 3200 });
        break;
      case 'record':
        [880, 1174.66, 1567.98].forEach((freq, index) => {
          this.tone({ freq, type: 'sine', dur: 0.24, gain: 0.06, delay: index * 0.09 });
        });
        break;
      case 'ui':
        this.tone({ freq: 660, to: 780, type: 'sine', dur: 0.05, gain: 0.045 });
        break;
      case 'launch':
        this.tone({ freq: 420, to: 900, type: 'square', dur: 0.12, gain: 0.05, filterType: 'lowpass', filterFreq: 2400 });
        break;
      case 'coin':
        this.tone({ freq: 880, to: 1320, type: 'triangle', dur: 0.08, gain: 0.045 });
        break;
      case 'laser':
        this.noise({ dur: 0.07, gain: 0.05, type: 'highpass', freq: 2200 });
        this.tone({ freq: 1200, to: 480, type: 'square', dur: 0.09, gain: 0.035 });
        break;
      case 'card':
        this.tone({ freq: 620, to: 940, type: 'sine', dur: 0.16, gain: 0.06 });
        this.tone({ freq: 940, to: 1250, type: 'triangle', dur: 0.12, gain: 0.03, delay: 0.06 });
        break;
      case 'relic':
        [392, 587.33, 783.99, 1174.66].forEach((freq, index) => {
          this.tone({ freq, type: 'sine', dur: 0.26, gain: 0.065, delay: index * 0.09 });
        });
        break;
      case 'synergy': {
        const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98];
        notes.forEach((freq, index) => {
          this.tone({ freq, type: 'triangle', dur: 0.24, gain: 0.065, delay: index * 0.07 });
          this.tone({ freq: freq * 2, type: 'sine', dur: 0.12, gain: 0.02, delay: index * 0.07 });
        });
        break;
      }
      case 'boss':
        this.tone({ freq: 110, to: 55, type: 'sawtooth', dur: 1.1, gain: 0.09, filterType: 'lowpass', filterFreq: 700, filterTo: 180 });
        this.noise({ dur: 0.8, gain: 0.05, type: 'lowpass', freq: 500 });
        break;
      case 'bossShot':
        this.tone({ freq: 180, to: 90, type: 'square', dur: 0.14, gain: 0.045, filterType: 'lowpass', filterFreq: 900 });
        break;
      case 'bossPhase':
        this.tone({ freq: 220, to: 660, type: 'sawtooth', dur: 0.4, gain: 0.07, filterType: 'bandpass', filterFreq: 900 });
        this.noise({ dur: 0.3, gain: 0.05, type: 'bandpass', freq: 1200 });
        break;
      case 'bossDefeat':
        this.tone({ freq: 330, to: 66, type: 'sawtooth', dur: 1.2, gain: 0.1, filterType: 'lowpass', filterFreq: 1400, filterTo: 220 });
        [659.25, 783.99, 1046.5, 1318.5].forEach((freq, index) => {
          this.tone({ freq, type: 'triangle', dur: 0.36, gain: 0.07, delay: 0.5 + index * 0.11 });
        });
        break;
      case 'shop':
        this.tone({ freq: 740, to: 1040, type: 'sine', dur: 0.1, gain: 0.05 });
        break;
      case 'error':
        this.tone({ freq: 190, to: 130, type: 'square', dur: 0.16, gain: 0.06, filterType: 'lowpass', filterFreq: 900 });
        break;
      case 'map':
        this.tone({ freq: 420, to: 620, type: 'triangle', dur: 0.14, gain: 0.05 });
        break;
      default:
        break;
    }
  }
}

