// Persistent audio / display prefs (separate from the game save so the title screen can use them).
const KEY = 'pi.settings.v1';

export interface Settings {
  volume: number; // 0..1
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      const v = typeof s?.volume === 'number' ? s.volume : 1;
      return { volume: Math.max(0, Math.min(1, v)) };
    }
  } catch { /* private mode */ }
  return { volume: 1 };
}

export function writeSettings(s: Settings) {
  try { localStorage.setItem(KEY, JSON.stringify({ volume: s.volume })); } catch { /* */ }
}

export function shouldSkipTitle() {
  const q = new URLSearchParams(location.search);
  return q.has('impact') || q.has('combat') || q.has('v9') || q.has('swap') || q.has('skipTitle');
}
