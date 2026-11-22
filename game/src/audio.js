// Solmar City — all sound is synthesised with WebAudio. No audio files.
// Engine hum, siren, gunshots, pickups, mission jingles and a small
// bass-led music loop are built from oscillators and filtered noise.
export class AudioSys {
  constructor() {
    this.ctx = null; this.muted = false; this.musicTimer = null;
    this.engineOsc = null; this.engineGain = null; this.sirenOsc = null;
    this.sirenGain = null; this.musicStep = 0;
  }

  // Browsers only allow audio after a user gesture; call from input.
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.startEngine();
      this.startMusic();
    } catch { this.ctx = null; }
  }

  toggleMute() { this.muted = !this.muted; return this.muted; }

  setEngine(speed01, on) {
    if (!this.engineOsc) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(on && !this.muted ? 0.03 + speed01 * 0.05 : 0, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, t, 0.1);
  }

  setSiren(on) {
    if (!this.ctx) return;
    if (!this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenGain = this.ctx.createGain();
      this.sirenOsc.type = 'triangle';
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain).connect(this.ctx.destination);
      this.sirenOsc.start();
      setInterval(() => {
        if (this.sirenOsc) this.sirenOsc.frequency.value = this.sirenOsc.frequency.value > 750 ? 620 : 920;
      }, 420);
    }
    this.sirenGain.gain.setTargetAtTime(on && !this.muted ? 0.035 : 0, this.ctx.currentTime, 0.15);
  }

  startEngine() {
    this.engineOsc = this.ctx.createOscillator();
    this.engineGain = this.ctx.createGain();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 60;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 420;
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(filter).connect(this.engineGain).connect(this.ctx.destination);
    this.engineOsc.start();
  }

  // A lazy reggae-ish bass line over a soft pad, one bar per second.
  startMusic() {
    const bass = [55, 0, 55, 65.4, 0, 55, 49, 58.3];
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      const note = bass[this.musicStep % bass.length];
      this.musicStep++;
      if (!note) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator(), g = this.ctx.createGain();
      osc.type = 'triangle'; osc.frequency.value = note;
      g.gain.setValueAtTime(0.05, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.connect(g).connect(this.ctx.destination);
      osc.start(t); osc.stop(t + 0.5);
    }, 300);
  }

  blip(freq, dur, type, vol) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator(), g = this.ctx.createGain();
    osc.type = type || 'sine'; osc.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(t); osc.stop(t + dur);
  }

  noiseBurst(dur, vol, filterFreq) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = filterFreq || 1800;
    const g = this.ctx.createGain(); g.gain.value = vol || 0.25;
    src.connect(filter).connect(g).connect(this.ctx.destination);
    src.start(t);
  }

  gunshot() { this.noiseBurst(0.14, 0.3, 2400); this.blip(160, 0.08, 'square', 0.08); }
  enemyShot() { this.noiseBurst(0.1, 0.12, 1400); }
  punch() { this.noiseBurst(0.08, 0.2, 700); }
  pickup() { this.blip(660, 0.09, 'sine', 0.14); setTimeout(() => this.blip(990, 0.12, 'sine', 0.14), 70); }
  crash() { this.noiseBurst(0.25, 0.35, 900); }
  doorSlam() { this.noiseBurst(0.07, 0.2, 500); }
  missionStart() { [523, 659, 784].forEach((f, i) => setTimeout(() => this.blip(f, 0.16, 'triangle', 0.16), i * 110)); }
  missionDone() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.18), i * 130)); }
  busted() { [392, 330, 262].forEach((f, i) => setTimeout(() => this.blip(f, 0.3, 'sawtooth', 0.1), i * 180)); }
}
