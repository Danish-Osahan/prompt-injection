// Save data (localStorage). Word memory + Fern growth per docs/story/phase-1-systems.md.
export type RoomId = 'office' | 'hub' | 'corridor' | 'archive' | 'arena' | 'message';
export const ROOM_ORDER: RoomId[] = ['office', 'hub', 'corridor', 'archive', 'arena', 'message'];

export interface SwapEntry { placed: string; removed: string; room: RoomId; plate: string; t: number }
export interface Save {
  v: 1;
  room: RoomId;
  checkpoint: { room: RoomId; x: number; y: number; plate: string | null };
  plates: Record<string, string>;       // plateId -> current word in its swap slot (puzzle progress is kept)
  lore: string[];                       // lore plates read (+1 growth each, 5 in Phase 1)
  helped: string[];                     // objects helped: lamp, water, dummy (+1 each)
  wilted: string[];                     // rooms solved after Fern's hint (-1 each)
  defeated: string[];
  tutorials: string[];                  // floor-text control prompts already shown
  seen: string[];                       // cutscenes seen (skippable after first view)
  wordLog: { word: string; count: number }[];
  swapLog: SwapEntry[];
  fernGrowth: number;
  deaths: number;
  phaseComplete: boolean;
  draftLastBarDeath: boolean;
  // art-v8 "linger" layer (optional, never on the main path)
  looked: string[];                     // story objects inspected (look + lore + toy plates), for the inspect-all unlock
  lines: string[];                      // lost lines collected (the per-room collectible, journal "unsent.txt")
  visits: Record<string, number>;       // room entries, for the revisit variants
  idle: string[];                       // rooms whose stand-still line has played (this visit count: room:visit)
  toys: string[];                       // toy rooms played with (room ids)
}

const KEY = 'pi.save.v1';
export function freshSave(): Save {
  return { v: 1, room: 'office', checkpoint: { room: 'office', x: 110, y: 470, plate: null }, plates: {}, lore: [], helped: [], wilted: [], defeated: [],
    tutorials: [], seen: [], wordLog: [], swapLog: [], fernGrowth: 0, deaths: 0, phaseComplete: false, draftLastBarDeath: false, looked: [], lines: [], visits: {}, idle: [], toys: [] };
}
export function loadSave(): Save {
  try { const raw = localStorage.getItem(KEY); if (raw) { const s = JSON.parse(raw); if (s && s.v === 1) return { ...freshSave(), ...s }; } } catch { /* corrupt or private mode */ }
  return freshSave();
}
export function writeSave(s: Save) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } }
export function wipeSave() { try { localStorage.removeItem(KEY); } catch { /* */ } }

/** Recompute growth from the logged events, so it can never drift. Phase 1 max 10. */
export function recomputeGrowth(s: Save) {
  const g = s.lore.length + s.helped.length + (s.defeated.includes('draft_clean') ? 2 : 0) - s.wilted.length;
  s.fernGrowth = Math.max(0, Math.min(10, g));
  return s.fernGrowth;
}
export function fernStage(g: number): { name: 'Sprout' | 'Leafy' | 'Bloom'; hintS: number; rootS: number } {
  if (g >= 8) return { name: 'Bloom', hintS: 30, rootS: 2 };
  if (g >= 4) return { name: 'Leafy', hintS: 30, rootS: 2 };
  return { name: 'Sprout', hintS: 45, rootS: 1.5 };
}
export function logSwap(s: Save, e: SwapEntry): number {
  s.swapLog.push(e);
  let w = s.wordLog.find(x => x.word === e.placed);
  if (!w) { w = { word: e.placed, count: 0 }; s.wordLog.push(w); }
  w.count++;
  s.wordLog.sort((a, b) => b.count - a.count);
  return w.count;
}
export const topWord = (s: Save) => s.wordLog[0]?.word ?? 'STRONG';
