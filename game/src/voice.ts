// Procedural per-letter voice blips and the freeze-scene bed. No recordings.
import { getMasterVolume, getAudioContext, outNode } from './sfx';

export type VoiceWho = 'noor' | 'fern' | 'draft' | 'ai' | 'papa' | 'floor';

function ac() { return getAudioContext(); }
function dest() { return outNode() ?? ac()?.destination ?? null; }


function noise(a: AudioContext, dur: number, vol: number, t: number, hp = 0) {
  const n = Math.max(1, Math.floor(a.sampleRate * dur));
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = a.createBufferSource(); src.buffer = buf;
  const g = a.createGain();
  g.gain.setValueAtTime(Math.max(0.0001, vol), t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  if (hp > 0) {
    const f = a.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    src.connect(f).connect(g).connect(dest() as AudioNode);
  } else {
    src.connect(g).connect(dest() as AudioNode);
  }
  src.start(t); src.stop(t + dur + 0.01);
}

function bitcrush() {
  const a = ac(); if (!a) return null;
  const ws = a.createWaveShaper();
  const steps = 24;
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = i / 128 - 1;
    curve[i] = Math.round(x * steps) / steps;
  }
  ws.curve = curve;
  return ws;
}

/** One letter-blip. Pitch rises on questions; angry lines are a bit harsher. */
export function voiceBlip(who: VoiceWho, i: number, opts: { question?: boolean; angry?: boolean } = {}) {
  const a = ac(); if (!a) return;
  const master = getMasterVolume();
  if (master <= 0.001) return;
  const t = a.currentTime;
  const q = opts.question ? 1.14 : 1;

  if (who === 'noor') {
    // Warm, soft, lower sine+triangle with slight pitch variation. Audible at default volume.
    const freq = (210 + (i % 5) * 11 + Math.sin(i * 1.7) * 9 + (Math.random() - 0.5) * 8) * q;
    const dur = 0.062;
    const vol = (opts.angry ? 0.16 : 0.13) * master;
    const mix = a.createGain(); mix.gain.value = 1;
    const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100;
    const g = a.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const mk = (type: OscillatorType, f: number, amp: number) => {
      const o = a.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(Math.max(40, f), t);
      const lg = a.createGain(); lg.gain.value = amp;
      o.connect(lg).connect(mix);
      o.start(t); o.stop(t + dur + 0.01);
    };
    mk('sine', freq, 0.7);
    mk('triangle', freq * 0.5, 0.35);
    mix.connect(lp).connect(g).connect(dest() as AudioNode);
    return;
  }

  if (who === 'fern') {
    // Brighter, glitchy, bitcrushed, chirpy square + noise.
    const freq = (620 + (i % 7) * 42 + (Math.random() - 0.5) * 180) * q;
    const dur = 0.034;
    const vol = 0.09 * master;
    const o = a.createOscillator(); o.type = 'square';
    o.frequency.setValueAtTime(Math.max(80, freq), t);
    if (i % 2 === 0) o.frequency.exponentialRampToValueAtTime(Math.max(90, freq * 1.35), t + dur);
    const crush = bitcrush();
    const hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 400;
    const g = a.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (crush) o.connect(crush).connect(hp).connect(g).connect(dest() as AudioNode);
    else o.connect(hp).connect(g).connect(dest() as AudioNode);
    o.start(t); o.stop(t + dur + 0.01);
    noise(a, 0.016, 0.035 * master, t, 1800);
    return;
  }

  const o = a.createOscillator();
  const g = a.createGain();
  let freq = 300, dur = 0.04, vol = 0.05, type: OscillatorType = 'sine';
  if (who === 'draft' || who === 'ai') {
    type = 'sawtooth';
    freq = (86 + (i % 4) * 9 + (opts.angry ? 12 : 0)) * (opts.question ? 1.1 : 1);
    dur = 0.07; vol = 0.07;
    noise(a, 0.04, 0.03 * master, t);
  } else if (who === 'papa') {
    type = 'triangle';
    freq = (190 + (i % 4) * 10) * q;
    dur = 0.05; vol = 0.05;
  } else {
    type = 'sine'; freq = 220 * q; dur = 0.02; vol = 0.02;
  }
  if (opts.angry) { vol *= 1.15; freq *= 0.96; }
  o.type = type;
  o.frequency.setValueAtTime(Math.max(40, freq), t);
  if (opts.question && i % 3 === 2) o.frequency.exponentialRampToValueAtTime(Math.max(50, freq * 1.2), t + dur);
  g.gain.setValueAtTime(vol * master, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest() as AudioNode);
  o.start(t); o.stop(t + dur + 0.01);
}

export function thud() {
  const a = ac(); if (!a) return;
  const t = a.currentTime, master = getMasterVolume();
  const o = a.createOscillator(); const g = a.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(90, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  g.gain.setValueAtTime(0.12 * master, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  o.connect(g).connect(dest() as AudioNode);
  o.start(t); o.stop(t + 0.18);
  noise(a, 0.06, 0.04 * master, t);
}

// --- Freeze-scene bed: boom, tape-stop, drone, ring, heartbeat, crackles, reverse swell. ---

type FreezeHandle = { stop: (fade?: number) => void };
let freeze: FreezeHandle | null = null;
const freezeLater: ReturnType<typeof setInterval>[] = [];

function clearLater() {
  for (const id of freezeLater) { try { clearInterval(id); } catch { /* */ } }
  freezeLater.length = 0;
}

export function startFreezeBed() {
  stopFreezeBed(0.05);
  const a = ac(); if (!a) return;
  const master = getMasterVolume();
  const t0 = a.currentTime;
  const out = a.createGain();
  out.gain.setValueAtTime(1, t0);
  out.connect(dest() as AudioNode);
  const oscs: OscillatorNode[] = [];
  const srcs: AudioBufferSourceNode[] = [];

  const startOsc = (type: OscillatorType, freq: number, vol: number) => {
    const o = a.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = a.createGain(); g.gain.value = vol;
    o.connect(g).connect(out);
    o.start();
    oscs.push(o);
    return { o, g };
  };

  // Sub-boom
  {
    const o = a.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(68, t0);
    o.frequency.exponentialRampToValueAtTime(26, t0 + 0.6);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.32 * master, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.95);
    o.connect(g).connect(out);
    o.start(t0); o.stop(t0 + 1.0);
  }

  // Tape-stop: mid noise + falling lowpass
  {
    const n = Math.floor(a.sampleRate * 0.85);
    const buf = a.createBuffer(1, n, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = a.createBufferSource(); src.buffer = buf;
    const lp = a.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2600, t0);
    lp.frequency.exponentialRampToValueAtTime(160, t0 + 0.75);
    const g = a.createGain();
    g.gain.setValueAtTime(0.16 * master, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.8);
    src.connect(lp).connect(g).connect(out);
    src.start(t0);
    srcs.push(src);
  }

  // Low eerie drone
  const drone = startOsc('sine', 48, 0.07 * master);
  const drone2 = startOsc('triangle', 73, 0.03 * master);
  const lfo = a.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.13;
  const lfoG = a.createGain(); lfoG.gain.value = 0.025 * master;
  lfo.connect(lfoG);
  lfoG.connect(drone.g.gain);
  lfo.start();
  oscs.push(lfo);

  // Faint high ringing tone
  const ring = startOsc('sine', 2680, 0.018 * master);
  const ringLfo = a.createOscillator(); ringLfo.type = 'sine'; ringLfo.frequency.value = 0.35;
  const ringLG = a.createGain(); ringLG.gain.value = 0.01 * master;
  ringLfo.connect(ringLG).connect(ring.g.gain);
  ringLfo.start();
  oscs.push(ringLfo);

  // Slow heartbeat
  const beat = () => {
    const a2 = ac(); if (!a2) return;
    const t = a2.currentTime, m = getMasterVolume();
    const pulse = (at: number, f0: number) => {
      const o = a2.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(f0, at);
      o.frequency.exponentialRampToValueAtTime(f0 * 0.55, at + 0.14);
      const g = a2.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.14 * m, at + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
      o.connect(g).connect((outNode() ?? a2.destination) as AudioNode);
      o.start(at); o.stop(at + 0.18);
    };
    pulse(t, 54);
    pulse(t + 0.2, 46);
  };
  beat();
  freezeLater.push(setInterval(beat, 1120));

  freeze = {
    stop(fade = 0.7) {
      clearLater();
      const now = a.currentTime;
      try {
        out.gain.cancelScheduledValues(now);
        out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), now);
        out.gain.exponentialRampToValueAtTime(0.0001, now + fade);
      } catch { /* */ }
      const later = setTimeout(() => {
        try { oscs.forEach(o => o.stop()); } catch { /* */ }
        try { srcs.forEach(s => s.stop()); } catch { /* */ }
        try { out.disconnect(); } catch { /* */ }
      }, fade * 1000 + 40);
      freezeLater.push(later as unknown as ReturnType<typeof setInterval>);
      freeze = null;
    },
  };
}

export function deniedCrackle() {
  const a = ac(); if (!a) return;
  const t = a.currentTime, m = getMasterVolume();
  // Short digital stutter — a burst of stepped noise and a chirp.
  noise(a, 0.05 + Math.random() * 0.04, 0.07 * m, t, 1200);
  const o = a.createOscillator(); o.type = 'square';
  const f0 = 800 + Math.random() * 1400;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(80, f0 * (Math.random() > 0.5 ? 0.4 : 1.6)), t + 0.06);
  const g = a.createGain();
  g.gain.setValueAtTime(0.05 * m, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  const crush = bitcrush();
  if (crush) o.connect(crush).connect(g).connect(dest() as AudioNode);
  else o.connect(g).connect(dest() as AudioNode);
  o.start(t); o.stop(t + 0.08);
}

/** Rising reversed-noise swell into Fern's arrival. */
export function reverseSwell(dur = 1.4) {
  const a = ac(); if (!a) return;
  const t = a.currentTime, m = getMasterVolume();
  const n = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) {
    const env = Math.pow(i / n, 2.2);
    d[i] = (Math.random() * 2 - 1) * env;
  }
  const src = a.createBufferSource(); src.buffer = buf;
  const lp = a.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(200, t);
  lp.frequency.exponentialRampToValueAtTime(4200, t + dur);
  const hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 180;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.22 * m, t + dur * 0.85);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
  // A rising tone under the swell
  const o = a.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(110, t);
  o.frequency.exponentialRampToValueAtTime(440, t + dur);
  const og = a.createGain();
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(0.08 * m, t + dur * 0.9);
  og.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.2);
  src.connect(hp).connect(lp).connect(g).connect(dest() as AudioNode);
  o.connect(og).connect(dest() as AudioNode);
  src.start(t); o.start(t); o.stop(t + dur + 0.25);
}

export function freezeBedActive() { return !!freeze; }

export function stopFreezeBed(fade = 0.7) {
  if (freeze) freeze.stop(fade);
  else clearLater();
}
