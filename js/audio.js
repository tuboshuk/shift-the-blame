// 极简合成音效：OscillatorNode 现合成，无音频资源；首次用户交互后创建 AudioContext。
const MUTE_KEY = 'stb_muted';

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem(MUTE_KEY) === '1';
  }

  ensureContext() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) this.ctx = new Ctx();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    return this.muted;
  }

  blip(kind) {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;
    const presets = {
      switch: { freq: 520, dur: 0.07, type: 'square', gain: 0.05 },
      pass: { freq: 660, dur: 0.16, type: 'sine', gain: 0.09 },
      hit: { freq: 150, dur: 0.3, type: 'sawtooth', gain: 0.1 },
      shield: { freq: 420, dur: 0.22, type: 'triangle', gain: 0.09 },
      decision: { freq: 740, dur: 0.18, type: 'sine', gain: 0.08 },
      over: { freq: 110, dur: 0.6, type: 'sawtooth', gain: 0.11 },
      start: { freq: 440, dur: 0.14, type: 'sine', gain: 0.08 },
      unlock: { freq: 880, dur: 0.3, type: 'sine', gain: 0.1 },
    };
    const p = presets[kind] || presets.switch;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = p.type;
    osc.frequency.setValueAtTime(p.freq, t);
    if (kind === 'pass') osc.frequency.exponentialRampToValueAtTime(p.freq * 1.5, t + p.dur);
    if (kind === 'hit' || kind === 'over') osc.frequency.exponentialRampToValueAtTime(p.freq * 0.5, t + p.dur);
    if (kind === 'unlock') osc.frequency.exponentialRampToValueAtTime(p.freq * 2, t + p.dur);
    gain.gain.setValueAtTime(p.gain, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + p.dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + p.dur);
  }
}
