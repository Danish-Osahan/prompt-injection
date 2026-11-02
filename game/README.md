# Prompt Injection - Phase 1 "After Hours" (sessions 1-2 of 3)

Phaser 4 + TypeScript + Vite, landscape 1280x720 (FIT scaling), keyboard/mouse + touch. Capacitor-ready layout
(relative `base: './'`, everything offline in `dist/`, no external requests); add `@capacitor/core` + `npx cap init` later.

Design source of truth: `/workspace/games/docs/story/` (`phase-1-levels.md`, `phase-1-script.md`, `noor-combat.md`,
`enemies.md`, `phase-1-systems.md`, `phase-1-after-hours.md`) and `../ui-v2/README.md` (floor text).

## Run
```bash
npm install          # node_modules was copied from proto-echo-knight on the box
npm run dev          # http://localhost:5173  (?new=1 wipes the save, ?debug=1 shows the overlay)
npm run build        # tsc + vite build -> dist/
npm run playtest     # builds must exist; serves dist on :4175, headless desktop + mobile run, screenshots/
```

## Controls
| | Keyboard / mouse | Touch |
|---|---|---|
| Move (8 dir) | WASD / arrows | drag on the left half (virtual stick) |
| Dash (i-frames, 1 s cooldown) | Space / Shift / K | DASH |
| Read an object (picks up its word) | E, or click the boxed word in the caption | READ, or tap the boxed word |
| Swap | E at another object, click a second caption word, or drag a word onto another word | tap a second word, or drag the chip onto it |
| Code vision (see every line, swap any two; lens secrets) | hold E | hold READ |
| TYPE (3-hit combo: slash, slash, stab + blinking `|`) | J / left click | TYPE |
| BACKSPACE (dash attack, knockback) | attack during/just after a dash | TYPE while dashing |
| Menu (controls list, new game) | Esc / P | "esc menu" (top right) |
| Debug overlay (word memory, Fern growth) | ` / F2 | `?debug=1` |

Small prompts under Noor teach each control once (move, read, tap a caption word, swap, hold READ, dash, attack) and switch wording
between keyboard and touch whenever the last input changes.

## Done (session 1)
- **Rooms, in the levels-doc order:** R0 Real Office -> Mirror Hub -> Dark Corridor -> Flooded Archive -> R1 Draft Arena (stub) -> Message Room.
  - Office: 4 inspects, then the composer (glowing keys, "MY FATHER LOST EVERYTHING. PAY.") and the SC2 hook ("FLOOR IS GONE.").
  - Hub: SC3 lines, Fern, the Caret wakes after the door opens.
  - Message Room: SC5 chat (the AI's reply uses the player's most-placed word), "FLOOR 1: DOWN", PHASE 1 COMPLETE.
- **Saves:** autosave on every room transition and cutscene end, in localStorage key `pi.save.v1`.
  - Checkpoint = the last plate read or swapped. It glows, and health refills there.
  - Death: glitch + "UNDO", then respawn at the checkpoint (~650 ms measured). Puzzle progress is kept per plate.
- **Word plates are signs on walls or objects** (user decision, 2 Nov 2026; there are no floor decals and no billboard rise):
  - Each one is an upright, axis-aligned backed sign in the ui-v2 tokens and JetBrains Mono, with a thin frame and a mount (screws, bracket, string or tape) tying it to its object.
  - The glow is subtle and brightens when focused. When Noor is near, the sign scales to 1.1x in place.
  - Swap slots keep the dotted state underline; the selected state is a cyan block and fixed plates are dim.
  - `PlateDef.x/y` is the reach point where Noor stands, and `sx/sy` is where the sign hangs. The touch drop target is the sign bounds plus 28 px.
  - Placeholder objects carry the signs: door frame, lamp, rail post, ceiling lamp, switch box, wall clock, pipe gauge, winch post, drawer and stairwell bracket.
  - Control prompts are small HUD hints under Noor, one at a time.
- **Puzzles, exactly per the levels doc:**
  - Door: SHUT <-> OPEN from LAMP IS OPEN.
  - Lamp: OFF <-> ON. The light reveals the path and Fern's note.
  - Archive two-step: HIGH <-> LOW drains the water and reveals STAIRS GO DOWN, then UP <-> DOWN lowers the bridge. DOWN is unreachable until step 1, and BRIDGE IS LOW does nothing.
  - Every swap is reversible, so there are no soft-locks.
- **Fern's leaf hint** after 45 s stuck (30 s at Leafy/Bloom; Bloom also names the word), pointing at the key plate. Wilt -1 if you solve the room after the hint.
- **Combat:** TYPE combo, BACKSPACE, hurt i-frames, 4 HP.
  - Paper Dummy: ignores hits until DUMMY IS QUICK, then one slow telegraphed swipe. Beating it opens the alcove.
  - Scribble: 0.6 s squash tell, lunge, 1 s stuck punish, faster at half health.
  - Sticky-note swarm (4): flutter, dive, grounded punish.
- **Systems** (`src/save.ts`):
  - `wordLog {word,count}[]`, `swapLog {placed,removed,room,plate}[]`, and "You keep saying that." at 3 uses.
  - `fernGrowth` recomputed from lore (5) + helped (lamp, water, dummy) - wilts, with the Sprout/Leafy/Bloom stages.
  - All of it shows in the debug overlay.
- **Playtest:** `tests/playtest.mjs`, 75 checks (session 2) over desktop (real keys + hooks, all rooms) and mobile (CDP touch: stick, DASH, READ, drag-swap). It fails on any console error. Screenshots go to `screenshots/`.

## Session 2 (Draft fight, advanced moves)
- **The Draft** (`src/boss.ts`, all numbers in `DRAFT`):
  - **Health:** 36 HP in 3 bars of 12, about 27 Caret hits unguarded.
  - **Guard:** "THE DRAFT IS STRONG" hangs on the Draft and follows it. While guarded, damage is x0.25 and shows BLOCKED.
  - **Guard break:** read "PAPER IS WEAK" on the arena-edge pillar (or catch the WEAK fragment from a perfect dodge), then swap it onto the guard sign. The guard breaks for **7 s**, then re-guards and both signs reset.
  - **Paper Swipe:** two slashes, each with a coral floor-cone warning. Tells are 0.60 / 0.50 / 0.42 s by bar, then a 0.3 s gap and a 0.38 s second tell. 120 px reach, about a 125-degree cone, 1 dmg.
  - **REPHRASE Ring:** every 3rd attack. 0.9 s tell (white rise and pulsing ring), then a ring expanding at 360 px/s with a 32 px band. Dash through it with i-frames. Then a **2 s punish**: the Draft is stunned and takes **x2 damage**.
  - **Crumple Toss:** 0.65 / 0.55 / 0.5 s tell with 3 preview lines, then 3 balls in a ±22-degree spread at 320 / 350 / 380 px/s. On the last bar it throws a second volley.
  - **Rhythm:** gaps between attacks are 1.0 / 0.8 / 0.62 s, and movement speed is 90 / 110 / 130 px/s.
  - **Split:** at 18 HP it splits into two shadowless Drafts. Only the real one carries the sign, which then reads the player's most-placed word (`topWord`, STRONG fallback). The fake only swipes, and it vanishes after 3 hits or when the real one is hit.
  - **Death:** Noor respawns at the arena door with a full fight reset. Puzzles and other rooms keep their progress.
  - **Win:** the Draft crumples ("I TRIED SO HARD."), the claim shard `FILED: ██/██` drops, the north door opens, and Fern gets +2 (`draft_clean`) unless you died on the last bar (`draftLastBarDeath`).
- **Advanced moves:**
  - **SELECT:** hold J / mouse / TYPE. After a 0.3 s wind-up a highlight line grows to 300 px; mouse drag aims it. Release to hit everything on the line for 1 + 0.5 x (n - 1) damage each. 1.5 s cooldown.
  - **CUT/PASTE:** a hit absorbed in the first 0.2 s of a dash is a perfect dodge and stores that attack. The next attack press pastes it at the nearest enemy for 3 dmg, ignoring the guard.
  - **REWRITE:** picking up a sign word in combat gives up to 2 s of x0.25 enemy time while you place it.
  - **FERN ROOT:** R / ROOT button, pins the nearest enemy within 300 px for 1.5 s (Sprout) or 2 s (Leafy/Bloom). Once per fight in the arena.
- **Crack signs (archive):**
  - "INK IS WET" (ink bottle) takes DRY from "TOWEL IS DRY" (towel rack). Then the Scribble takes x2 damage.
  - "NOTES STICK TOGETHER" (corkboard) takes APART from "BOOKS SIT APART" (shelf). TOGETHER makes the swarm dive as a group; APART makes the notes dive one at a time.
- **Cutscenes:** after the first viewing (tracked in `pi.seenEver`, which survives a new game), hold X or hold the top-right of the screen to skip.
- **Sound:** a tiny WebAudio synth (`src/sfx.ts`), with no audio files.

## Stubbed / placeholder
- **Art:** all room floors are code-drawn tinted tile floors with box props, not the art-v6 clean plates. The clean plates have Noor and enemies baked into them, so using them would show a second Noor.
  - Dummy, Scribble, sticky notes: code shapes.
  - Draft: Noor's idle sheet tinted grey, with no shadow.
  - Fern pot stages and the composer key glow are UI-only.
- Audio is synth blips only (no rain, pad or music).
- The archive now has 8 signs, well past the calm two-phrase rule. Real room art should spread them out.
- The Draft uses Noor's sheet with a tint. Its attacks are code FX, with no dedicated animations yet.

## Next session (3 of 3)
1. Real room art without baked actors (re-render the clean plates with `NOACTORS=1`), Draft sprite sheet, Noor slash/hold/dash clips, Fern pot stages.
2. Balance pass on device (Draft tells and HP), a perfect-dodge flash/sfx polish, controller support.
3. Audio: rain, key clicks, synth pad; settings (volume, reduced motion); Capacitor wrap and a mobile perf check.
4. A curved SELECT and a 2-slot CUT/PASTE are Phase 2+ upgrades (noor-combat.md).

## Layout
`src/boot.ts` (atlases + animations), `game.ts` (scene, rooms, combat, cutscenes, hooks), `rooms.ts` (room data), `plate.ts` (plates as data: caption + code line), `words.ts` (caption bar, code vision, lens secrets), `save.ts`, `controls.ts`, `tests/`.

## Room art (session 3, art-v7)
- Each room is a Blender clean plate (`public/assets/rooms/<room>[_state].jpg`) plus foreground overlays (`rooms/fg/*.png`) depth-sorted by their screen base y. These are generated: `src/roomart.ts` comes from `art-v7/tools/sync_game.py`.
- The geometry was built in screen space from the game layout (`art-v7/tools/rooms7.py`, `unproj()`), so colliders, exits and sign anchors line up 1:1 with `rooms.ts`.
- State plates: the corridor has `dark`/`lit` (dark plate + a light mask around Noor until lit); the archive has `H`/`L` (water) and the bridge is a separate 8-frame lowering animation (`rooms/fg/bridge_00..07.png`). Each state also has a `<room>_<state>_code.jpg` for code vision. The hub door is the rendered `door_panel` overlay, faded out when the door opens.
- Noor: `noor_dash` (8 frames: anticipation, burst with smear, skid) and `noor_type1/2/3` (jab, side slash, overhead slam, with `hit_frame`/`tell` in the JSON meta).
  - Hits land on the hit frame, with 50-70 ms hit-stop and a small shake.
  - Hit 3 writes a line of typed characters with a blinking caret, then deletes it backwards into letter fragments (amber on contact).
  - The dash leaves a teal keystroke-glyph trail and kicks up dust and paper.
- `node tests/fxshots.mjs` captures `screenshots/fx-*.png`.

## Words: the locked hybrid (session 4)
- Normal view: subtitle captions (scene heading + a typed screenplay line about the nearest 1-2 objects; boxed words are chips).
- Hold READ: code vision; `obj.field = VALUE;` for every object, `noor.shadow = null;` under Noor; swap any two lines.
- Lens secrets: `fern.awake = true;` (hub, by Fern's desk) and `wall.solid = TRUE;` (dark corridor). Only inside the lens.
- The monitor caption redacts the claim (██████); code vision shows `claim.status = DENIED;`.
- Full spec and every line: `docs/story/phase-1-levels.md` "Presentation".
