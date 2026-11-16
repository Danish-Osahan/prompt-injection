// Looping CC0 music bus. Cues: 'office' (calm ambient) and 'tense' (Draft fight).
import type { Scene } from 'phaser';

let sceneRef: { sound: { add: (k: string, cfg?: object) => Mus; get: (k: string) => Mus | null }; cache: { audio: { exists: (k: string) => boolean } } } | null = null;
type Mus = { isPlaying?: boolean; play: (cfg?: object) => void; stop: () => void; destroy?: () => void; setVolume?: (v: number) => void; volume?: number };

let musicVol = 0.85;
let cue: 'office' | 'tense' | 'none' = 'none';
let current: Mus | null = null;
const KEY: Record<'office' | 'tense', string> = { office: 'music_office', tense: 'music_tense' };
const LEVEL: Record<'office' | 'tense', number> = { office: 0.32, tense: 0.36 };

export function bindMusicScene(s: typeof sceneRef extends null ? never : NonNullable<typeof sceneRef>) { sceneRef = s; }
export function setMusicVolume(v: number) {
  musicVol = Math.max(0, Math.min(1, v));
  applyVol();
}
export function getMusicVolume() { return musicVol; }

function applyVol() {
  if (!current || cue === 'none') return;
  const lvl = LEVEL[cue] * musicVol;
  try { current.setVolume?.(lvl); if (current.volume !== undefined) current.volume = lvl; } catch { /* */ }
}

export function playMusic(next: 'office' | 'tense' | 'none', fade = 0.7) {
  if (next === cue && current?.isPlaying) { applyVol(); return; }
  const prev = current;
  cue = next;
  current = null;
  if (prev) {
    // Quick fade-out without a tween dependency (scene may be swapping).
    try { prev.stop(); } catch { /* */ }
  }
  void fade;
  if (next === 'none' || !sceneRef) return;
  const key = KEY[next];
  if (!sceneRef.cache.audio.exists(key)) return;
  try {
    let snd = sceneRef.sound.get(key);
    if (!snd) snd = sceneRef.sound.add(key, { loop: true, volume: 0 });
    const vol = LEVEL[next] * musicVol;
    snd.play({ loop: true, volume: vol });
    current = snd;
    applyVol();
  } catch { /* */ }
}
