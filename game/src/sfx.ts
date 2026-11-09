// Tiny WebAudio synth + optional loaded CC0 samples (Kenney Interface Sounds).
let ctx: AudioContext | null = null;
function ac() { if (!ctx) { try { ctx = new AudioContext(); } catch { return null; } } if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return ctx; }

type SynthKind = 'key' | 'hit' | 'block' | 'dash' | 'swap' | 'hurt' | 'ring' | 'tell' | 'paste' | 'root' | 'win';
type ImpactKind = 'impact_whoosh' | 'impact_clank' | 'impact_snap' | 'impact_bounce' | 'impact_padlock' | 'impact_hum' | 'impact_heavy' | 'impact_big';
export type SfxKind = SynthKind | ImpactKind;

const SAMPLE: Partial<Record<ImpactKind, string>> = {
  impact_whoosh: 'sfx_whoosh',
  impact_clank: 'sfx_clank',
  impact_snap: 'sfx_snap',
  impact_bounce: 'sfx_bounce',
  impact_padlock: 'sfx_padlock',
  impact_hum: 'sfx_hum',
  impact_heavy: 'sfx_hit_heavy',
  impact_big: 'sfx_metal',
};

/** Optional: scene caches Phaser sound instances after boot. */
let sceneRef: { sound: { play: (k: string, cfg?: object) => void }; cache: { audio: { exists: (k: string) => boolean } } } | null = null;
export function bindSfxScene(s: typeof sceneRef extends null ? never : NonNullable<typeof sceneRef>) { sceneRef = s; }

export function sfx(kind: SfxKind) {
  const sample = (SAMPLE as Record<string, string>)[kind];
  if (sample && sceneRef?.cache?.audio?.exists(sample)) {
    try { sceneRef.sound.play(sample, { volume: 0.55 }); return; } catch { /* fall through */ }
  }
  const a = ac(); if (!a) return;
  const t = a.currentTime, o = a.createOscillator(), g = a.createGain();
  const P: Record<string, [OscillatorType, number, number, number, number]> = {
    key: ['square', 1800, 1200, 0.03, 0.05], hit: ['triangle', 320, 120, 0.09, 0.12], block: ['square', 140, 110, 0.08, 0.06],
    dash: ['sawtooth', 600, 200, 0.12, 0.04], swap: ['sine', 520, 1040, 0.18, 0.08], hurt: ['sawtooth', 220, 60, 0.25, 0.1],
    ring: ['sine', 90, 260, 0.6, 0.12], tell: ['triangle', 880, 880, 0.08, 0.05], paste: ['square', 300, 900, 0.15, 0.06],
    root: ['sine', 160, 90, 0.4, 0.12], win: ['sine', 440, 880, 0.8, 0.1],
    impact_whoosh: ['sawtooth', 900, 180, 0.22, 0.07],
    impact_clank: ['triangle', 280, 90, 0.14, 0.14],
    impact_snap: ['square', 700, 120, 0.1, 0.12],
    impact_bounce: ['triangle', 200, 80, 0.08, 0.08],
    impact_padlock: ['square', 160, 70, 0.16, 0.1],
    impact_hum: ['sine', 90, 140, 0.5, 0.08],
    impact_heavy: ['sawtooth', 240, 60, 0.2, 0.14],
    impact_big: ['sawtooth', 180, 40, 0.28, 0.16],
  };
  const [type, f0, f1, dur, vol] = P[kind] ?? P.hit;
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}
