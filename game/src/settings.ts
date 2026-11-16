// Persistent audio / display prefs (separate from the game save so the title screen can use them).
const KEY = 'pi.settings.v1';

export interface Settings {
  /** @deprecated kept so older saves still load; prefer sfx + music. */
  volume?: number;
  sfx: number;   // 0..1
  music: number; // 0..1
}

function clamp(v: number) { return Math.max(0, Math.min(1, v)); }

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      const legacy = typeof s?.volume === 'number' ? s.volume : 1;
      const sfx = typeof s?.sfx === 'number' ? s.sfx : legacy;
      const music = typeof s?.music === 'number' ? s.music : legacy;
      return { sfx: clamp(sfx), music: clamp(music), volume: clamp(legacy) };
    }
  } catch { /* private mode */ }
  return { sfx: 1, music: 0.85, volume: 1 };
}

export function writeSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ sfx: s.sfx, music: s.music, volume: s.sfx }));
  } catch { /* */ }
}

export function shouldSkipTitle() {
  const q = new URLSearchParams(location.search);
  return q.has('impact') || q.has('combat') || q.has('v9') || q.has('swap') || q.has('skipTitle');
}
