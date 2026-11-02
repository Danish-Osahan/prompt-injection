// Tiny WebAudio synth (no audio files, so nothing to license). Silent until the first user gesture.
let ctx: AudioContext | null = null;
function ac() { if (!ctx) { try { ctx = new AudioContext(); } catch { return null; } } if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return ctx; }
export function sfx(kind: 'key' | 'hit' | 'block' | 'dash' | 'swap' | 'hurt' | 'ring' | 'tell' | 'paste' | 'root' | 'win') {
  const a = ac(); if (!a) return;
  const t = a.currentTime, o = a.createOscillator(), g = a.createGain();
  const P: Record<string, [OscillatorType, number, number, number, number]> = {
    key: ['square', 1800, 1200, 0.03, 0.05], hit: ['triangle', 320, 120, 0.09, 0.12], block: ['square', 140, 110, 0.08, 0.06],
    dash: ['sawtooth', 600, 200, 0.12, 0.04], swap: ['sine', 520, 1040, 0.18, 0.08], hurt: ['sawtooth', 220, 60, 0.25, 0.1],
    ring: ['sine', 90, 260, 0.6, 0.12], tell: ['triangle', 880, 880, 0.08, 0.05], paste: ['square', 300, 900, 0.15, 0.06],
    root: ['sine', 160, 90, 0.4, 0.12], win: ['sine', 440, 880, 0.8, 0.1],
  };
  const [type, f0, f1, dur, vol] = P[kind];
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}
