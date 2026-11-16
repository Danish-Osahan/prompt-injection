// Procedural per-letter voice blips. No recordings.
import { getMasterVolume } from './sfx';

let ctx: AudioContext | null = null;
function ac() {
  if (!ctx) { try { ctx = new AudioContext(); } catch { return null; } }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export type VoiceWho = 'noor' | 'fern' | 'draft' | 'ai' | 'papa' | 'floor';

function noise(a: AudioContext, dur: number, vol: number, t: number) {
  const n = Math.max(1, Math.floor(a.sampleRate * dur));
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = a.createBufferSource(); src.buffer = buf;
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(g).connect(a.destination);
  src.start(t); src.stop(t + dur + 0.01);
}

/** One letter-blip. Pitch rises on questions; angry lines are a bit harsher. */
export function voiceBlip(who: VoiceWho, i: number, opts: { question?: boolean; angry?: boolean } = {}) {
  const a = ac(); if (!a) return;
  const master = getMasterVolume();
  if (master <= 0.001) return;
  const t = a.currentTime;
  const q = opts.question ? 1.16 : 1;
  const o = a.createOscillator();
  const g = a.createGain();
  let freq = 300, dur = 0.04, vol = 0.035, type: OscillatorType = 'sine';
  if (who === 'noor') {
    type = 'sine';
    freq = (310 + (i % 5) * 14 + Math.sin(i * 1.7) * 8) * q;
    dur = 0.048; vol = 0.038;
  } else if (who === 'fern') {
    type = 'square';
    freq = (480 + (i % 7) * 36 + (Math.random() - 0.5) * 140) * q;
    dur = 0.028; vol = 0.024;
    noise(a, 0.018, 0.012 * master, t);
  } else if (who === 'draft' || who === 'ai') {
    type = 'sawtooth';
    freq = (86 + (i % 4) * 9 + (opts.angry ? 12 : 0)) * (opts.question ? 1.1 : 1);
    dur = 0.07; vol = 0.05;
    noise(a, 0.04, 0.03 * master, t);
  } else if (who === 'papa') {
    type = 'triangle';
    freq = (190 + (i % 4) * 10) * q;
    dur = 0.05; vol = 0.032;
  } else {
    type = 'sine'; freq = 220 * q; dur = 0.02; vol = 0.012;
  }
  if (opts.angry) { vol *= 1.15; freq *= 0.96; }
  o.type = type;
  o.frequency.setValueAtTime(Math.max(40, freq), t);
  if (opts.question && i % 3 === 2) o.frequency.exponentialRampToValueAtTime(Math.max(50, freq * 1.2), t + dur);
  g.gain.setValueAtTime(vol * master, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
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
  o.connect(g).connect(a.destination);
  o.start(t); o.stop(t + 0.18);
  noise(a, 0.06, 0.04 * master, t);
}
