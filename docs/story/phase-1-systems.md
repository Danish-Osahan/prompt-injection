# Phase 1 Systems: Word Memory + Fern Growth

## 1. Word Memory (your words used against you)
- Every swap is logged: word placed, word removed, room. Saved with the game.
- Phase 1 only *collects* and *teases*; enemies use it from Phase 2.
- Tease 1 (Draft fight, half health): the two Drafts' plates use the player's most-placed word, e.g. "THE DRAFT IS OPEN". Fallback if none: STRONG.
- Tease 2 (message room): the AI's magenta reply to Papa contains that same word. Player sees it was watching.
- Fern line if repeated word used 3+ times: "You keep saying that."
- Later phases: bosses steal the top word (can't be used for one fight), Echo copies the top 2 words.

## 2. Fern Growth (how you play grows her)
- Growth points (Phase 1 max 10):
  - +1 per lore plate read (5 in Phase 1)
  - +1 per object helped (lamp lit, water drained, dummy woken) (3)
  - +2 for beating the Draft without dying on the last bar
- Wilt: -1 for solving a room after Fern's 45s hint.
- Stages (shown in hub pot, art deferred):
  - 0–3 Sprout: hint after 45s, plain arrow.
  - 4–7 Leafy: hint after 30s; root pin lasts longer (1.5s → 2s).
  - 8–10 Bloom: hint names the word; unlocks bonus Fern line "You read everything. Like her."
- Total growth carries over and counts toward the best ending (Fern watered).

## Build notes
- Store: `wordLog: {word, count}[]`, `fernGrowth: number` in save.
- Pure logic, no new art needed except 3 pot sprites later.
