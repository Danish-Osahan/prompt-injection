// Tiny WebAudio synth + optional loaded CC0 samples (Kenney Interface Sounds).
let ctx: AudioContext | null = null;
let master = 1;
function ac() { if (!ctx) { try { ctx = new AudioContext(); } catch { return null; } } if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return ctx; }
export function getAudioContext() { return ac(); }

let bus: GainNode | null = null;
let meter: AnalyserNode | null = null;
/** Shared output so voice/freeze audio can be metered and stay on one bus. */
export function outNode() {
  const a = ac(); if (!a) return null;
  if (!bus || bus.context !== a) {
    bus = a.createGain();
    bus.gain.value = 1;
    bus.connect(a.destination);
    meter = a.createAnalyser();
    meter.fftSize = 2048;
    meter.smoothingTimeConstant = 0.2;
    bus.connect(meter);
  }
  return bus;
}
export function meterRms() {
  if (!meter) return 0;
  const buf = new Uint8Array(meter.fftSize);
  meter.getByteTimeDomainData(buf);
  let s = 0;
  for (const v of buf) { const x = (v - 128) / 128; s += x * x; }
  return Math.sqrt(s / buf.length);
}

type SynthKind = 'key' | 'hit' | 'block' | 'dash' | 'swap' | 'hurt' | 'ring' | 'tell' | 'paste' | 'root' | 'win' | 'crackle' | 'paper';
type ImpactKind = 'impact_whoosh' | 'impact_clank' | 'impact_snap' | 'impact_bounce' | 'impact_padlock' | 'impact_hum' | 'impact_heavy' | 'impact_big';
type ActKind = 'steal' | 'throw' | 'door_open' | 'door_close' | 'lift' | 'ui';
export type SfxKind = SynthKind | ImpactKind | ActKind;

const SAMPLE: Partial<Record<string, string>> = {
  impact_whoosh: 'sfx_whoosh',
  impact_clank: 'sfx_clank',
  impact_snap: 'sfx_snap',
  impact_bounce: 'sfx_bounce',
  impact_padlock: 'sfx_padlock',
  impact_hum: 'sfx_hum',
  impact_heavy: 'sfx_hit_heavy',
  impact_big: 'sfx_metal',
  hit: 'sfx_hit_heavy',
  steal: 'sfx_steal',
  throw: 'sfx_whoosh',
  dash: 'sfx_whoosh',
  door_open: 'sfx_door_open',
  door_close: 'sfx_door_close',
  lift: 'sfx_lift',
  ui: 'sfx_click',
};

/** Optional: scene caches Phaser sound instances after boot. */
let sceneRef: { sound: { play: (k: string, cfg?: object) => void }; cache: { audio: { exists: (k: string) => boolean } } } | null = null;
export function bindSfxScene(s: typeof sceneRef extends null ? never : NonNullable<typeof sceneRef>) { sceneRef = s; try { if (s && 'volume' in s.sound) (s.sound as { volume: number }).volume = master; } catch { /* */ } }
export function setMasterVolume(v: number) {
  master = Math.max(0, Math.min(1, v));
  try { if (sceneRef && 'volume' in sceneRef.sound) (sceneRef.sound as { volume: number }).volume = master; } catch { /* */ }
  try { if (humGain) humGain.gain.value = Math.max(0.0001, 0.045 * master); } catch { /* */ }
}
export function getMasterVolume() { return master; }
export const setSfxVolume = setMasterVolume;
export const getSfxVolume = getMasterVolume;


const SAMPLE_VOL: Partial<Record<SfxKind, number>> = {
  hit: 0.9,
  impact_whoosh: 0.72,
  impact_heavy: 0.88,
  impact_big: 0.9,
  impact_clank: 0.7,
  throw: 0.7,
  dash: 0.8,
  steal: 0.65,
};

export function sfx(kind: SfxKind, volMul = 1) {
  const sample = (SAMPLE as Record<string, string>)[kind];
  if (sample && sceneRef?.cache?.audio?.exists(sample)) {
    const v = (SAMPLE_VOL[kind] ?? 0.55) * master * volMul;
    try { sceneRef.sound.play(sample, { volume: v }); return; } catch { /* fall through */ }
  }
  if (kind === 'crackle') { playCrackle(volMul); return; }
  if (kind === 'paper') { playPaper(volMul); return; }
  const a = ac(); if (!a) return;
  const t = a.currentTime, o = a.createOscillator(), g = a.createGain();
  const P: Record<string, [OscillatorType, number, number, number, number]> = {
    key: ['sine', 280, 160, 0.04, 0.04], hit: ['triangle', 280, 70, 0.12, 0.28], block: ['square', 140, 110, 0.08, 0.06],
    dash: ['sawtooth', 600, 200, 0.16, 0.16], swap: ['sine', 220, 140, 0.07, 0.05], hurt: ['sawtooth', 220, 60, 0.25, 0.1],
    ring: ['sine', 90, 160, 0.6, 0.1], tell: ['sine', 180, 140, 0.07, 0.04], paste: ['triangle', 200, 90, 0.16, 0.1],
    root: ['sine', 160, 90, 0.4, 0.12], win: ['sine', 180, 240, 0.55, 0.08],
    impact_whoosh: ['sawtooth', 900, 180, 0.22, 0.07],
    impact_clank: ['triangle', 280, 90, 0.14, 0.14],
    impact_snap: ['square', 700, 120, 0.1, 0.12],
    impact_bounce: ['triangle', 200, 80, 0.08, 0.08],
    impact_padlock: ['square', 160, 70, 0.16, 0.1],
    impact_hum: ['sine', 90, 140, 0.5, 0.08],
    impact_heavy: ['sawtooth', 240, 60, 0.2, 0.14],
    impact_big: ['sawtooth', 180, 40, 0.28, 0.16],
    steal: ['triangle', 900, 400, 0.12, 0.08],
    throw: ['sawtooth', 700, 180, 0.16, 0.07],
    door_open: ['triangle', 200, 90, 0.22, 0.1],
    door_close: ['triangle', 140, 70, 0.18, 0.1],
    lift: ['sine', 120, 80, 0.5, 0.08],
    ui: ['sine', 240, 120, 0.05, 0.04],
  };
  const [type, f0, f1, dur, vol] = P[kind] ?? P.hit;
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(vol * master, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(outNode() || a.destination); o.start(t); o.stop(t + dur + 0.02);
}

function playCrackle(volMul = 1) {
  const a = ac(); if (!a) return;
  const dur = 0.2;
  const frames = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, frames, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    const env = Math.pow(1 - i / frames, 1.35);
    const burst = Math.random() > 0.72 ? 1 : 0.12;
    d[i] = (Math.random() * 2 - 1) * env * burst;
  }
  const src = a.createBufferSource(); src.buffer = buf;
  const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.7;
  const g = a.createGain(); g.gain.value = 0.5 * master * volMul;
  src.connect(bp).connect(g).connect(a.destination);
  src.start();
}

/** Soft office drone for the opening (procedural, no sample). */
let humOsc: OscillatorNode[] = [];
let humGain: GainNode | null = null;
export function startHum(vol = 0.045) {
  stopHum();
  const a = ac(); if (!a) return;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, a.currentTime);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol * master), a.currentTime + 1.2);
  g.connect(a.destination);
  const mk = (freq: number, type: OscillatorType, amp: number) => {
    const o = a.createOscillator(); o.type = type; o.frequency.value = freq;
    const lg = a.createGain(); lg.gain.value = amp;
    o.connect(lg); lg.connect(g); o.start();
    humOsc.push(o);
  };
  mk(54, 'sine', 1);
  mk(108, 'sine', 0.28);
  mk(81, 'triangle', 0.08);
  humGain = g;
}
export function stopHum(fade = 0.6) {
  const a = ac();
  const g = humGain;
  const osc = humOsc.slice();
  humOsc = []; humGain = null;
  if (!g) return;
  try {
    const t = a ? a.currentTime : 0;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + fade);
  } catch { /* */ }
  const later = (typeof window !== 'undefined' ? window.setTimeout : setTimeout);
  later(() => { try { osc.forEach(o => o.stop()); g.disconnect(); } catch { /* */ } }, fade * 1000 + 40);
}

function playPaper(volMul = 1) {
  const a = ac(); if (!a) return;
  const t0 = a.currentTime;
  const n = Math.floor(a.sampleRate * 0.28);
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 1.35);
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.65;
  const g = a.createGain();
  const dest = outNode() || a.destination;
  const v = Math.max(0.0001, 0.11 * master * volMul);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(v, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
  src.connect(f); f.connect(g); g.connect(dest);
  src.start(t0); src.stop(t0 + 0.3);
}

