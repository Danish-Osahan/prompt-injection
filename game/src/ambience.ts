// Per-room eerie soundscapes built from real CC0 field recordings
// (treated offline: EQ, convolution IR, seamless loops) plus a very
// quiet detuned pad. Sparse recorded one-shots, random pan / rate.
// See CREDITS.md for author, URL and license of every file.

import { getAudioContext, outNode, getSfxVolume, getMasterVolume } from './sfx';
import { getMusicVolume } from './music';

export type AmbId = 'office' | 'hub' | 'corridor' | 'archive' | 'arena' | 'message' | 'none';
type SpotId = 'slam' | 'creak' | 'pipe' | 'lift' | 'murmur' | 'boom' | 'paper' | 'buzz';

const BED_SRC: Record<Exclude<AmbId, 'none'>, string> = {
  office: 'assets/ambience/office.ogg',
  hub: 'assets/ambience/hub.ogg',
  corridor: 'assets/ambience/corridor.ogg',
  archive: 'assets/ambience/archive.ogg',
  arena: 'assets/ambience/arena.ogg',
  message: 'assets/ambience/message.ogg',
};
const WIND_SRC = 'assets/ambience/hub_wind.ogg';
const SPOT_SRC: Record<SpotId, string> = {
  slam: 'assets/ambience/spots/slam.ogg',
  creak: 'assets/ambience/spots/creak.ogg',
  pipe: 'assets/ambience/spots/pipe.ogg',
  lift: 'assets/ambience/spots/lift.ogg',
  murmur: 'assets/ambience/spots/murmur.ogg',
  boom: 'assets/ambience/spots/boom.ogg',
  paper: 'assets/ambience/spots/paper.ogg',
  buzz: 'assets/ambience/spots/buzz.ogg',
};

const ROOM_SPOTS: Record<Exclude<AmbId, 'none'>, SpotId[]> = {
  office: ['buzz', 'paper', 'creak', 'lift'],
  hub: ['slam', 'creak', 'paper', 'murmur'],
  corridor: ['pipe', 'creak', 'murmur', 'slam'],
  archive: ['creak', 'paper', 'pipe', 'slam'],
  arena: ['boom', 'pipe', 'creak', 'murmur'],
  message: ['murmur', 'buzz', 'paper', 'creak'],
};

// Very quiet dissonant pads under the recordings (minor 2nd or tritone).
const PADS: Record<Exclude<AmbId, 'none'>, [number, number]> = {
  office: [58, 61.5],
  hub: [46, 65],
  corridor: [41, 58],
  archive: [49, 52],
  arena: [36, 51],
  message: [50, 70.7],
};

type Voice = { stop: (t: number) => void };

let id: AmbId = 'none';
let ducked = false;
let errors: string[] = [];
let bedGain: GainNode | null = null;
let duckGain: GainNode | null = null;
let windGain: GainNode | null = null;
let glassGain: GainNode | null = null;
let voices: Voice[] = [];
let spotTimer = 0;
let stepAcc = 0;
let unlocked = false;
let fading: { gain: GainNode; voices: Voice[]; t: number } | null = null;

const bufs: Record<string, AudioBuffer> = {};
let loadP: Promise<void> | null = null;

const note = (m: string) => { errors.push(m); if (errors.length > 12) errors.shift(); };

export function unlockAudio() {
  const a = getAudioContext();
  if (!a) return false;
  if (a.state === 'suspended') a.resume().catch(() => {});
  unlocked = true;
  void preloadAmbience();
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

export function preloadAmbience(): Promise<void> {
  if (loadP) return loadP;
  loadP = (async () => {
    const a = getAudioContext();
    if (!a) { note('no-audiocontext'); return; }
    const entries: Array<[string, string]> = [
      ...Object.entries(BED_SRC),
      ['hub_wind', WIND_SRC],
      ...Object.entries(SPOT_SRC),
    ];
    await Promise.all(entries.map(async ([k, url]) => {
      if (bufs[k]) return;
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`${url} ${r.status}`);
        bufs[k] = await a.decodeAudioData(await r.arrayBuffer());
      } catch (e) {
        note(`load:${k}:${(e as Error)?.message ?? e}`);
      }
    }));
  })();
  return loadP;
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

function loopBuf(a: AudioContext, dest: AudioNode, buf: AudioBuffer, amp = 1, rate = 1): Voice {
  const src = a.createBufferSource();
  src.buffer = buf; src.loop = true; src.playbackRate.value = rate;
  const g = a.createGain(); g.gain.value = amp;
  src.connect(g).connect(dest);
  src.start();
  return { stop: (t) => { try { src.stop(t); } catch { /* */ } } };
}

function startPads(a: AudioContext, dest: AudioNode, room: Exclude<AmbId, 'none'>): Voice[] {
  const [f0, f1] = PADS[room];
  const out: Voice[] = [];
  for (const freq of [f0, f1]) {
    const o = a.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    const lfo = a.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.03 + freq * 0.00007;
    const lg = a.createGain(); lg.gain.value = freq * 0.003;
    lfo.connect(lg).connect(o.frequency);
    const g = a.createGain(); g.gain.value = 0.022;
    o.connect(g).connect(dest);
    o.start(); lfo.start();
    out.push({ stop: (t) => { try { o.stop(t); lfo.stop(t); } catch { /* */ } } });
  }
  return out;
}

function beginRoom(next: Exclude<AmbId, 'none'>, fade: number) {
  const a = getAudioContext();
  if (!a) { note('no-audiocontext'); return; }
  const bed = bufs[next];
  if (!bed) { note(`missing-bed:${next}`); return; }
  const t = a.currentTime;
  const b = makeBuses(a);
  duckGain = b.duck; bedGain = b.bed; windGain = b.wind; glassGain = b.glass;
  const lvl = Math.max(0.0001, 0.85 * ambLevel());
  try {
    b.bed.gain.setValueAtTime(0.0001, t);
    b.bed.gain.exponentialRampToValueAtTime(lvl, t + fade);
  } catch { b.bed.gain.value = lvl; }
  if (ducked) b.duck.gain.value = 0.28;
  voices.push(loopBuf(a, b.bed, bed, 1, 1));
  if (next === 'hub' && bufs.hub_wind) {
    voices.push(loopBuf(a, b.wind, bufs.hub_wind, 1, 1));
    try { b.wind.gain.setValueAtTime(0.28, t); } catch { b.wind.gain.value = 0.28; }
  }
  voices.push(...startPads(a, b.bed, next));
  if (next === 'hub') {
    // glass: two slightly beating sines, very low, rise with proximity
    const o = a.createOscillator(); o.type = 'sine'; o.frequency.value = 264;
    const o2 = a.createOscillator(); o2.type = 'sine'; o2.frequency.value = 280.5; // minor 2nd
    const og = a.createGain(); og.gain.value = 0.12;
    o.connect(og); o2.connect(og); og.connect(b.glass);
    o.start(); o2.start();
    try { b.glass.gain.setValueAtTime(0.12, t); } catch { /* */ }
    voices.push({ stop: (tt) => { try { o.stop(tt); o2.stop(tt); } catch { /* */ } } });
  }
  spotTimer = 2.5 + Math.random() * 3;
}

export function setAmbience(next: AmbId, fade = 1.25) {
  if (next === id && bedGain) { applyBedLevel(); return; }
  const a = getAudioContext();
  const t = a?.currentTime ?? 0;
  if (bedGain && duckGain) {
    const oldBed = bedGain, oldDuck = duckGain, oldV = voices.slice();
    try {
      oldBed.gain.cancelScheduledValues(t);
      oldBed.gain.setValueAtTime(Math.max(0.0001, oldBed.gain.value), t);
      oldBed.gain.exponentialRampToValueAtTime(0.0001, t + fade);
    } catch { /* */ }
    fading = { gain: oldBed, voices: oldV, t: t + fade };
    const later = setTimeout(() => {
      try { oldV.forEach(v => v.stop(a ? a.currentTime : t)); oldBed.disconnect(); oldDuck.disconnect(); } catch { /* */ }
      if (fading?.gain === oldBed) fading = null;
    }, fade * 1000 + 60);
    void later;
  }
  voices = [];
  bedGain = duckGain = windGain = glassGain = null;
  id = next;
  if (next === 'none') return;
  const start = () => { if (id === next && !bedGain) beginRoom(next, fade); };
  const p = preloadAmbience();
  if (bufs[next]) start();
  else p.then(start).catch((e) => note(String(e)));
}

function applyBedLevel() {
  if (!bedGain) return;
  const a = getAudioContext(); if (!a) return;
  const lvl = Math.max(0.0001, 0.85 * ambLevel());
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

/** Proximity: hub gap wind, hub glass hum. */
export function updateAmbience(st: { room?: string; x: number; y: number; moving?: boolean; dt?: number }) {
  if (id === 'none') return;
  const a = getAudioContext(); if (!a) return;
  const t = a.currentTime;
  if (id === 'hub' && windGain) {
    const dy = Math.abs(st.y - 326) / 220;
    const dx = Math.abs(st.x - 640) / 700;
    const near = Math.max(0, 1 - Math.min(1, Math.hypot(dx, dy)));
    const w = 0.22 + 0.9 * near * near;
    try { windGain.gain.setTargetAtTime(w, t, 0.2); } catch { /* */ }
  }
  if (id === 'hub' && glassGain) {
    const near = st.y < 340 ? Math.max(0, 1 - Math.hypot(st.x - 315, st.y - 95) / 280) : 0;
    try { glassGain.gain.setTargetAtTime(0.12 + 0.8 * near, t, 0.25); } catch { /* */ }
  }
  const dt = st.dt ?? 0.016;
  spotTimer -= dt;
  if (spotTimer <= 0 && !ducked) {
    fireSpot();
    spotTimer = 7 + Math.random() * 9; // sparse: ~7–16s
  }
  if (st.moving) {
    stepAcc += dt;
    const period = id === 'archive' ? 0.55 : 0.42;
    if (stepAcc >= period) { stepAcc = 0; if (!ducked && Math.random() < 0.55) footstep(st.x); }
  } else stepAcc = 0;
}

function fireSpot(kind?: SpotId, x = Math.random()) {
  if (id === 'none') return;
  const list = ROOM_SPOTS[id];
  const k = kind ?? list[(Math.random() * list.length) | 0];
  const a = getAudioContext(); if (!a) return;
  const buf = bufs[k];
  if (!buf) { note(`missing-spot:${k}`); return; }
  const dest0 = outNode() || a.destination;
  const pan = a.createStereoPanner();
  pan.pan.value = Math.max(-0.7, Math.min(0.7, (x - 0.5) * 1.4));
  pan.connect(dest0);
  const src = a.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = 0.94 + Math.random() * 0.1;
  const g = a.createGain();
  const sfxV = Math.max(0.0001, getSfxVolume() * getMasterVolume() * (ducked ? 0.45 : 1));
  const amp: Record<SpotId, number> = {
    slam: 0.42, creak: 0.38, pipe: 0.36, lift: 0.34,
    murmur: 0.32, boom: 0.48, paper: 0.28, buzz: 0.3,
  };
  g.gain.value = (amp[k] ?? 0.35) * sfxV;
  src.connect(g).connect(pan);
  try { src.start(); } catch (e) { note(String((e as Error)?.message ?? e)); }
}

function footstep(x: number) {
  const a = getAudioContext(); if (!a) return;
  const dest = outNode() || a.destination;
  const pan = a.createStereoPanner();
  pan.pan.value = Math.max(-0.5, Math.min(0.5, (x - 640) / 900));
  pan.connect(dest);
  const t = a.currentTime;
  const v = Math.max(0.0001, getSfxVolume() * getMasterVolume() * 0.045);
  const n = Math.floor(a.sampleRate * 0.07);
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 1.8);
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = id === 'archive' ? 500 : id === 'corridor' ? 700 : 900;
  const g = a.createGain();
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  src.connect(f).connect(g).connect(pan); src.start(t);
}

/** Offline preview helper: schedules a bed + spots into an OfflineAudioContext. */
export async function renderAmbience(
  off: OfflineAudioContext,
  room: Exclude<AmbId, 'none'>,
  sec: number,
  spotsAt: number[] = [5, 13],
  combatAt: number[] = [],
) {
  // Use already-decoded buffers when running in the game; otherwise fetch.
  if (!bufs[room]) {
    try {
      const r = await fetch(BED_SRC[room]);
      bufs[room] = await off.decodeAudioData(await r.arrayBuffer());
      for (const [k, url] of Object.entries(SPOT_SRC)) {
        if (!bufs[k]) {
          const s = await fetch(url);
          bufs[k] = await off.decodeAudioData(await s.arrayBuffer());
        }
      }
    } catch { /* preview script may pass decoded buffers */ }
  }
  const master = off.createGain(); master.gain.value = 1;
  master.connect(off.destination);
  const bed = bufs[room];
  if (bed) {
    const src = off.createBufferSource(); src.buffer = bed; src.loop = true;
    src.connect(master); src.start(0); src.stop(sec);
  }
  const kinds = ROOM_SPOTS[room];
  spotsAt.forEach((s, i) => {
    const k = kinds[i % kinds.length];
    const buf = bufs[k];
    if (!buf) return;
    const pan = off.createStereoPanner(); pan.pan.value = i % 2 === 0 ? -0.35 : 0.4;
    pan.connect(master);
    const src = off.createBufferSource(); src.buffer = buf;
    const g = off.createGain(); g.gain.value = 0.4;
    src.connect(g).connect(pan);
    src.start(Math.min(sec - 0.4, s));
  });
  if (combatAt.length) renderCombatStings(off, combatAt);
  return off.startRendering();
}

export function renderCombatStings(off: OfflineAudioContext, at: number[]) {
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
