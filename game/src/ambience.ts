// Per-room eerie soundscapes. Procedural WebAudio only (no paid/AI samples).
// Beds + drones crossfade between rooms; sparse spots; cheap stereo pan;
// proximity (hub gap wind, corridor hush, glass hum). Ducks under dialogue.

import { getAudioContext, outNode, getSfxVolume, getMasterVolume, sfx } from './sfx';
import { getMusicVolume } from './music';

export type AmbId = 'office' | 'hub' | 'corridor' | 'archive' | 'arena' | 'message' | 'none';

type Recipe = {
  // oscillator partials: freq, type, amp
  drones: Array<[number, OscillatorType, number]>;
  // filtered noise bed
  noise: { color: 'white' | 'pink' | 'brown'; type: BiquadFilterType; freq: number; q: number; amp: number };
  // optional second noise (texture)
  tex?: { color: 'white' | 'pink' | 'brown'; type: BiquadFilterType; freq: number; q: number; amp: number };
  spots: Array<'buzz' | 'creak' | 'keys' | 'paper' | 'ping' | 'retype' | 'tick' | 'drip' | 'foot' | 'whisper' | 'scrape' | 'crt'>;
};

const RECIPE: Record<Exclude<AmbId, 'none'>, Recipe> = {
  office: {
    drones: [[58, 'sine', 0.22], [116, 'sine', 0.08], [174, 'triangle', 0.035]],
    noise: { color: 'brown', type: 'lowpass', freq: 380, q: 0.7, amp: 0.045 },
    tex: { color: 'pink', type: 'bandpass', freq: 2400, q: 0.9, amp: 0.012 },
    spots: ['buzz', 'creak', 'keys', 'paper'],
  },
  hub: {
    drones: [[46, 'sine', 0.24], [92, 'sine', 0.09], [138, 'triangle', 0.04]],
    noise: { color: 'pink', type: 'bandpass', freq: 620, q: 0.85, amp: 0.04 },
    tex: { color: 'white', type: 'highpass', freq: 1800, q: 0.6, amp: 0.016 }, // updraft
    spots: ['paper', 'ping', 'retype', 'creak'],
  },
  corridor: {
    drones: [[41, 'sine', 0.3], [82, 'sine', 0.1], [123, 'sine', 0.03]],
    noise: { color: 'brown', type: 'lowpass', freq: 220, q: 0.8, amp: 0.055 },
    tex: { color: 'pink', type: 'bandpass', freq: 2800, q: 3.2, amp: 0.01 },
    spots: ['tick', 'drip', 'foot', 'whisper'],
  },
  archive: {
    drones: [[49, 'sine', 0.22], [98, 'sine', 0.08], [147, 'triangle', 0.03]],
    noise: { color: 'brown', type: 'lowpass', freq: 320, q: 0.7, amp: 0.042 },
    tex: { color: 'pink', type: 'bandpass', freq: 1100, q: 0.8, amp: 0.018 },
    spots: ['drip', 'paper', 'foot', 'creak'],
  },
  arena: {
    drones: [[36, 'sine', 0.26], [72, 'triangle', 0.08], [108, 'sawtooth', 0.02]],
    noise: { color: 'pink', type: 'lowpass', freq: 280, q: 0.7, amp: 0.035 },
    tex: { color: 'white', type: 'bandpass', freq: 1600, q: 1.2, amp: 0.01 },
    spots: ['scrape', 'tick', 'retype'],
  },
  message: {
    drones: [[50, 'sine', 0.2], [100, 'sine', 0.07], [10000, 'sine', 0.008]],
    noise: { color: 'pink', type: 'bandpass', freq: 900, q: 0.9, amp: 0.03 },
    tex: { color: 'white', type: 'highpass', freq: 7000, q: 0.5, amp: 0.008 },
    spots: ['keys', 'crt', 'retype'],
  },
};

type Voice = { stop: (t: number) => void };

let id: AmbId = 'none';
let ducked = false;
let errors: string[] = [];
let bedGain: GainNode | null = null;
let duckGain: GainNode | null = null;
let windGain: GainNode | null = null; // hub updraft / corridor hush
let glassGain: GainNode | null = null;
let voices: Voice[] = [];
let spotTimer = 0;
let stepAcc = 0;
let unlocked = false;
let fading: { gain: GainNode; voices: Voice[]; t: number } | null = null;

const note = (m: string) => { errors.push(m); if (errors.length > 12) errors.shift(); };

export function unlockAudio() {
  const a = getAudioContext();
  if (!a) return false;
  if (a.state === 'suspended') a.resume().catch(() => {});
  unlocked = true;
  return a.state !== 'suspended';
}

export function installAudioUnlock() {
  if (typeof window === 'undefined') return;
  const go = () => { unlockAudio(); };
  window.addEventListener('pointerdown', go, { once: false });
  window.addEventListener('keydown', go, { once: false });
}

export function getAmbienceId() { return id; }
export function getAmbienceDucked() { return ducked; }
export function getAmbienceErrors() { return errors.slice(); }

function ambLevel() {
  return Math.max(0, Math.min(1, getMusicVolume())) * Math.max(0, Math.min(1, getMasterVolume()));
}

function noiseBuffer(a: AudioContext, color: 'white' | 'pink' | 'brown', sec = 2) {
  const n = Math.floor(a.sampleRate * sec);
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  let b = 0, p = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    if (color === 'white') d[i] = w;
    else if (color === 'pink') { p = 0.97 * p + 0.03 * w; d[i] = p * 3.2; }
    else { b += w * 0.02; b *= 0.998; d[i] = b * 4; }
  }
  return buf;
}

function startNoise(a: AudioContext, dest: AudioNode, spec: Recipe['noise'], buf: AudioBuffer): Voice {
  const src = a.createBufferSource();
  src.buffer = buf; src.loop = true;
  const f = a.createBiquadFilter(); f.type = spec.type; f.frequency.value = spec.freq; f.Q.value = spec.q;
  const g = a.createGain(); g.gain.value = spec.amp;
  src.connect(f).connect(g).connect(dest);
  src.start();
  return { stop: (t) => { try { src.stop(t); } catch { /* */ } } };
}

function startDrones(a: AudioContext, dest: AudioNode, rec: Recipe): Voice[] {
  const out: Voice[] = [];
  for (const [freq, type, amp] of rec.drones) {
    const o = a.createOscillator(); o.type = type; o.frequency.value = freq;
    // very slow drift so it isn't a dead tone
    const lfo = a.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.04 + freq * 0.00008;
    const lg = a.createGain(); lg.gain.value = freq * 0.004;
    lfo.connect(lg).connect(o.frequency);
    const g = a.createGain(); g.gain.value = amp;
    o.connect(g).connect(dest);
    o.start(); lfo.start();
    out.push({ stop: (t) => { try { o.stop(t); lfo.stop(t); } catch { /* */ } } });
  }
  return out;
}

function makeBuses(a: AudioContext) {
  const dest = outNode() || a.destination;
  const duck = a.createGain(); duck.gain.value = 1;
  const bed = a.createGain(); bed.gain.value = 0.0001;
  const wind = a.createGain(); wind.gain.value = 0.0001;
  const glass = a.createGain(); glass.gain.value = 0.0001;
  bed.connect(duck).connect(dest);
  wind.connect(duck);
  glass.connect(duck);
  return { duck, bed, wind, glass, dest };
}

export function setAmbience(next: AmbId, fade = 1.25) {
  if (next === id && bedGain) { applyBedLevel(); return; }
  const a = getAudioContext();
  if (!a) { note('no-audiocontext'); id = next; return; }
  const t = a.currentTime;
  // fade out current
  if (bedGain && duckGain) {
    const oldBed = bedGain, oldDuck = duckGain, oldV = voices.slice();
    try {
      oldBed.gain.cancelScheduledValues(t);
      oldBed.gain.setValueAtTime(Math.max(0.0001, oldBed.gain.value), t);
      oldBed.gain.exponentialRampToValueAtTime(0.0001, t + fade);
    } catch { /* */ }
    fading = { gain: oldBed, voices: oldV, t: t + fade };
    const later = setTimeout(() => {
      try { oldV.forEach(v => v.stop(a.currentTime)); oldBed.disconnect(); oldDuck.disconnect(); } catch { /* */ }
      if (fading?.gain === oldBed) fading = null;
    }, fade * 1000 + 60);
    void later;
  }
  voices = [];
  bedGain = duckGain = windGain = glassGain = null;
  id = next;
  if (next === 'none') return;
  const rec = RECIPE[next];
  const b = makeBuses(a);
  duckGain = b.duck; bedGain = b.bed; windGain = b.wind; glassGain = b.glass;
  const lvl = Math.max(0.0001, 0.55 * ambLevel());
  try {
    b.bed.gain.setValueAtTime(0.0001, t);
    b.bed.gain.exponentialRampToValueAtTime(lvl, t + fade);
  } catch { b.bed.gain.value = lvl; }
  if (ducked) b.duck.gain.value = 0.28;
  const nb = noiseBuffer(a, rec.noise.color, 2.4);
  voices.push(startNoise(a, b.bed, rec.noise, nb));
  if (rec.tex) {
    const tb = noiseBuffer(a, rec.tex.color, 2.4);
    // tex for hub/corridor also feeds the proximity bus at a low floor
    const texDest = (next === 'hub' || next === 'corridor') ? b.wind : b.bed;
    voices.push(startNoise(a, texDest, rec.tex, tb));
    if (next === 'hub' || next === 'corridor') {
      // a quiet floor so the texture is always just barely there
      try { b.wind.gain.setValueAtTime(0.25, t); } catch { /* */ }
    }
  }
  if (next === 'hub') {
    // glass resonance always sits quietly; rises near the pane
    const gb = noiseBuffer(a, 'pink', 2);
    voices.push(startNoise(a, b.glass, { color: 'pink', type: 'bandpass', freq: 880, q: 1.4, amp: 0.04 }, gb));
    const o = a.createOscillator(); o.type = 'sine'; o.frequency.value = 264;
    const og = a.createGain(); og.gain.value = 0.15;
    o.connect(og).connect(b.glass); o.start();
    voices.push({ stop: (tt) => { try { o.stop(tt); } catch { /* */ } } });
  }
  voices.push(...startDrones(a, b.bed, rec));
  spotTimer = 1.6 + Math.random() * 2;
}

function applyBedLevel() {
  if (!bedGain) return;
  const a = getAudioContext(); if (!a) return;
  const lvl = Math.max(0.0001, 0.55 * ambLevel());
  try { bedGain.gain.setTargetAtTime(lvl, a.currentTime, 0.15); } catch { bedGain.gain.value = lvl; }
}

export function setAmbienceDuck(on: boolean) {
  if (on === ducked) return;
  ducked = on;
  const a = getAudioContext();
  if (!a || !duckGain) return;
  const t = a.currentTime;
  try {
    duckGain.gain.cancelScheduledValues(t);
    duckGain.gain.setValueAtTime(Math.max(0.0001, duckGain.gain.value), t);
    duckGain.gain.exponentialRampToValueAtTime(on ? 0.28 : 1, t + 0.22);
  } catch { duckGain.gain.value = on ? 0.28 : 1; }
}

/** Proximity: hub gap wind, hub glass hum, corridor closer hush. */
export function updateAmbience(st: { room?: string; x: number; y: number; moving?: boolean; dt?: number }) {
  if (id === 'none') return;
  const a = getAudioContext(); if (!a) return;
  const t = a.currentTime;
  if (id === 'hub' && windGain) {
    // louder as you approach the mid-room void (y ~ 252–400, mid 326)
    const dy = Math.abs(st.y - 326) / 220;
    const dx = Math.abs(st.x - 640) / 700;
    const near = Math.max(0, 1 - Math.min(1, Math.hypot(dx, dy)));
    const w = 0.22 + 0.85 * near * near;
    try { windGain.gain.setTargetAtTime(w, t, 0.2); } catch { /* */ }
  }
  if (id === 'hub' && glassGain) {
    const near = st.y < 340 ? Math.max(0, 1 - Math.hypot(st.x - 315, st.y - 95) / 280) : 0;
    try { glassGain.gain.setTargetAtTime(0.15 + 0.85 * near, t, 0.25); } catch { /* */ }
  }
  if (id === 'corridor' && windGain) {
    // a little closer / hushier in the dark mid-hall
    const near = Math.max(0, 1 - Math.abs(st.x - 640) / 800);
    try { windGain.gain.setTargetAtTime(0.3 + 0.5 * near, t, 0.25); } catch { /* */ }
  }
  const dt = st.dt ?? 0.016;
  spotTimer -= dt;
  if (spotTimer <= 0 && !ducked) {
    fireSpot();
    spotTimer = 5 + Math.random() * 7;
  }
  if (st.moving) {
    stepAcc += dt;
    const period = id === 'archive' ? 0.55 : 0.42;
    if (stepAcc >= period) { stepAcc = 0; if (!ducked && Math.random() < 0.7) footstep(st.x); }
  } else stepAcc = 0;
}

function panFor(a: AudioContext, dest: AudioNode, x01: number) {
  const p = a.createStereoPanner(); p.pan.value = Math.max(-0.7, Math.min(0.7, x01));
  p.connect(dest);
  return p;
}

function fireSpot(kind?: Recipe['spots'][number], x = 0.5) {
  if (id === 'none') return;
  const rec = RECIPE[id];
  const k = kind ?? rec.spots[(Math.random() * rec.spots.length) | 0];
  const a = getAudioContext(); if (!a) return;
  const dest0 = outNode() || a.destination;
  const pan = panFor(a, dest0, (x - 0.5) * 1.4);
  const t = a.currentTime;
  const sfxV = Math.max(0.0001, getSfxVolume() * getMasterVolume() * (ducked ? 0.5 : 1));
  try {
    if (k === 'buzz') buzz(a, pan, t, sfxV);
    else if (k === 'creak') creak(a, pan, t, sfxV);
    else if (k === 'keys' || k === 'retype') keys(a, pan, t, sfxV, k === 'retype');
    else if (k === 'paper') sfx('paper', 0.7 * sfxV);
    else if (k === 'ping') ping(a, pan, t, sfxV);
    else if (k === 'tick') tick(a, pan, t, sfxV);
    else if (k === 'drip') drip(a, pan, t, sfxV);
    else if (k === 'foot') footstep(640 + (x - 0.5) * 800);
    else if (k === 'whisper') whisper(a, pan, t, sfxV);
    else if (k === 'scrape') scrape(a, pan, t, sfxV);
    else if (k === 'crt') crt(a, pan, t, sfxV);
  } catch (e) { note(String((e as Error)?.message ?? e)); }
}

function buzz(a: AudioContext, dest: AudioNode, t: number, v: number) {
  const o = a.createOscillator(); o.type = 'square'; o.frequency.value = 60;
  const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 240; f.Q.value = 4;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.04 * v, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  o.connect(f).connect(g).connect(dest); o.start(t); o.stop(t + 0.32);
}
function creak(a: AudioContext, dest: AudioNode, t: number, v: number) {
  const o = a.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.45);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.05 * v, t + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  o.connect(g).connect(dest); o.start(t); o.stop(t + 0.52);
}
function keys(a: AudioContext, dest: AudioNode, t: number, v: number, reverse = false) {
  const n = 3 + ((Math.random() * 4) | 0);
  for (let i = 0; i < n; i++) {
    const ti = t + (reverse ? (n - i) * 0.07 : i * 0.08) + Math.random() * 0.03;
    const o = a.createOscillator(); o.type = 'square'; o.frequency.value = 1200 + Math.random() * 900;
    const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2000; f.Q.value = 1;
    const g = a.createGain();
    const amp = (reverse ? 0.03 : 0.045) * v * (0.6 + Math.random() * 0.4);
    g.gain.setValueAtTime(0.0001, ti);
    g.gain.exponentialRampToValueAtTime(amp, ti + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, ti + 0.05);
    o.connect(f).connect(g).connect(dest); o.start(ti); o.stop(ti + 0.07);
  }
}
function ping(a: AudioContext, dest: AudioNode, t: number, v: number) {
  const o = a.createOscillator(); o.type = 'sine'; o.frequency.value = 1180;
  o.frequency.exponentialRampToValueAtTime(900, t + 0.8);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.035 * v, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
  o.connect(g).connect(dest); o.start(t); o.stop(t + 1.15);
}
function tick(a: AudioContext, dest: AudioNode, t: number, v: number) {
  const o = a.createOscillator(); o.type = 'triangle'; o.frequency.value = 1800;
  o.frequency.exponentialRampToValueAtTime(400, t + 0.08);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.05 * v, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  o.connect(g).connect(dest); o.start(t); o.stop(t + 0.14);
}
function drip(a: AudioContext, dest: AudioNode, t: number, v: number) {
  const o = a.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(1400, t); o.frequency.exponentialRampToValueAtTime(600, t + 0.12);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.06 * v, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  o.connect(g).connect(dest); o.start(t); o.stop(t + 0.24);
}
function whisper(a: AudioContext, dest: AudioNode, t: number, v: number) {
  const n = Math.floor(a.sampleRate * 0.45);
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / n);
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 2.4;
  const g = a.createGain(); g.gain.value = 0.045 * v;
  src.connect(f).connect(g).connect(dest); src.start(t); src.stop(t + 0.5);
}
function scrape(a: AudioContext, dest: AudioNode, t: number, v: number) {
  const n = Math.floor(a.sampleRate * 0.4);
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 0.7);
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 1.1;
  const g = a.createGain(); g.gain.value = 0.05 * v;
  src.connect(f).connect(g).connect(dest); src.start(t); src.stop(t + 0.42);
}
function crt(a: AudioContext, dest: AudioNode, t: number, v: number) {
  const o = a.createOscillator(); o.type = 'sine'; o.frequency.value = 15700;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.02 * v, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  o.connect(g).connect(dest); o.start(t); o.stop(t + 0.2);
}

function footstep(worldX: number) {
  const a = getAudioContext(); if (!a || id === 'none') return;
  const dest0 = outNode() || a.destination;
  const pan = panFor(a, dest0, (worldX - 640) / 640);
  const t = a.currentTime;
  const v = Math.max(0.0001, getSfxVolume() * getMasterVolume() * 0.55);
  // material: office soft, hub tile, corridor concrete, archive wet, else generic
  const mat = id === 'office' ? 'soft' : id === 'hub' ? 'tile' : id === 'archive' ? 'wet' : 'concrete';
  const n = Math.floor(a.sampleRate * 0.12);
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, mat === 'soft' ? 2 : 1.2);
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = mat === 'soft' ? 500 : mat === 'tile' ? 1400 : mat === 'wet' ? 900 : 800;
  const g = a.createGain();
  g.gain.value = (mat === 'soft' ? 0.04 : 0.06) * v;
  src.connect(f).connect(g).connect(pan); src.start(t); src.stop(t + 0.14);
  if (mat === 'wet') drip(a, pan, t + 0.05, v * 0.5);
}

/** Offline render for previews. Schedules a bed + a couple of spots over `sec` seconds. */
export async function renderAmbience(off: OfflineAudioContext, room: Exclude<AmbId, 'none'>, sec: number, spotsAt: number[] = [4, 9, 15], combatAt: number[] = []) {
  const rec = RECIPE[room];
  const master = off.createGain(); master.gain.value = 0.55;
  master.connect(off.destination);
  const bed = off.createGain(); bed.gain.value = 1;
  bed.connect(master);
  const nb = noiseBuffer(off as unknown as AudioContext, rec.noise.color, 2.4);
  const n1 = startNoise(off as unknown as AudioContext, bed, rec.noise, nb);
  let n2: Voice | null = null;
  if (rec.tex) {
    const tb = noiseBuffer(off as unknown as AudioContext, rec.tex.color, 2.4);
    n2 = startNoise(off as unknown as AudioContext, bed, rec.tex, tb);
  }
  const ds = startDrones(off as unknown as AudioContext, bed, rec);
  if (room === 'hub') {
    const gb = noiseBuffer(off as unknown as AudioContext, 'pink', 2);
    startNoise(off as unknown as AudioContext, bed, { color: 'pink', type: 'bandpass', freq: 880, q: 1.4, amp: 0.05 }, gb);
    // swell the updraft in the mid third
    const wind = off.createGain();
    wind.gain.setValueAtTime(0.3, 0);
    wind.gain.linearRampToValueAtTime(1, sec * 0.45);
    wind.gain.linearRampToValueAtTime(0.35, sec);
    wind.connect(bed);
    const wb = noiseBuffer(off as unknown as AudioContext, 'white', 2);
    startNoise(off as unknown as AudioContext, wind, { color: 'white', type: 'highpass', freq: 1800, q: 0.6, amp: 0.03 }, wb);
  }
  // schedule spots against the offline clock
  const kinds = rec.spots;
  spotsAt.forEach((s, i) => {
    const k = kinds[i % kinds.length];
    const t = Math.min(sec - 1.2, s);
    // reuse live spot fns by temporarily faking getAudioContext — not available here.
    // inline a quiet one-shot via the same helpers by passing `off`.
    const fake = off as unknown as AudioContext;
    const pan = off.createStereoPanner(); pan.pan.value = i % 2 === 0 ? -0.35 : 0.4;
    pan.connect(master);
    try {
      if (k === 'buzz') buzz(fake, pan, t, 1);
      else if (k === 'creak') creak(fake, pan, t, 1);
      else if (k === 'keys' || k === 'retype') keys(fake, pan, t, 1, k === 'retype');
      else if (k === 'ping') ping(fake, pan, t, 1);
      else if (k === 'tick') tick(fake, pan, t, 1);
      else if (k === 'drip') drip(fake, pan, t, 1);
      else if (k === 'whisper') whisper(fake, pan, t, 1);
      else if (k === 'scrape') scrape(fake, pan, t, 1);
      else if (k === 'crt') crt(fake, pan, t, 1);
      else if (k === 'paper') {
        const n = Math.floor(off.sampleRate * 0.28);
        const buf = off.createBuffer(1, n, off.sampleRate);
        const d = buf.getChannelData(0);
        for (let j = 0; j < n; j++) d[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / n, 1.35);
        const src = off.createBufferSource(); src.buffer = buf;
        const f = off.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.65;
        const g = off.createGain(); g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.11, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
        src.connect(f).connect(g).connect(pan); src.start(t); src.stop(t + 0.3);
      }
    } catch { /* */ }
    void n1; void n2; void ds;
  });
  if (combatAt.length) renderCombatStings(off, combatAt);
  return off.startRendering();
}

export function renderCombatStings(off: OfflineAudioContext, at: number[]) {
  // A louder dash + hit so we can LUFS-compare against the bed.
  const dest = off.destination;
  for (const t of at) {
    const o = off.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(600, t); o.frequency.exponentialRampToValueAtTime(200, t + 0.14);
    const g = off.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.42, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(dest); o.start(t); o.stop(t + 0.2);
    const h = off.createOscillator(); h.type = 'triangle';
    h.frequency.setValueAtTime(280, t + 0.2); h.frequency.exponentialRampToValueAtTime(70, t + 0.45);
    const hg = off.createGain();
    hg.gain.setValueAtTime(0.0001, t + 0.2);
    hg.gain.exponentialRampToValueAtTime(0.5, t + 0.2);
    hg.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    h.connect(hg).connect(dest); h.start(t + 0.2); h.stop(t + 0.52);
  }
}

