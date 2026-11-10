# HANDOFF — Level 1 step 5: playtest, stills, Continue

**Date:** 2026-11-10 (Asia/Calcutta)
**Focus:** A real launch-to-end playtest, and honest stills of the new shell.

## Tests

- `npm run playtest` **191/191 passed** (boot → title → New Game → skippable intro → Phase 1 steal playthrough → end screen → menu → Continue, plus linger / office11 / combat / mobile).
- `verify_steal` **PASS**, `impact_lab` **PASS**.

## Stills

`mock-steal/level1/stills/title.png`  
`mock-steal/level1/stills/intro.png`  
`mock-steal/level1/stills/room-card.png`  
`mock-steal/level1/stills/corridor.png`  
`mock-steal/level1/stills/arena.png`  
`mock-steal/level1/stills/end.png`

The office-doors still in `mock-steal/phase1/stills/office-doors-open.png` is now taken after `liftDone`, with the cab actually open.

## Honest leftovers (looked at the stills)

- Title is clean: dimmed full-bleed office, rain, typographic menu. Continue is visible but dim when there is no save.
- Intro still is the “office goes still” beat with Noor at her desk. Rain in the window is still moving (the pause didn’t fully freeze it). HP, esc menu, and a couple of edge pixels (caret / skip) stay on during the cutscene. Noor overlaps the desk slightly.
- Room card “THE MIRROR OFFICE” is clear and the old `~/hub/` path HUD is gone. The hub’s late mirror-copy of Noor is still visible, and the card sits over the neon door.
- Corridor is readable with the lamp on. The navy fill around the U-shaped room is still a wide dark margin; the top-right clock desk has a slightly mismatched patch.
- Arena: the HOLD E hint is gone. “GUARD BROKEN” is a toast under the boss bar, not over the HP pips. The void is a dark navy instead of a black letterbox. Boss chrome (name, bar, “guard broken 5.8s”, toast) still stacks at the top centre.
- End screen is typographic and readable (Level 1 complete, 1:15, thank-you / to be continued, Back to menu). The claim-shard “FILED” and a ghost of the HP pips still show faintly through the scrim.
- Hub side/bottom bleeds are still close in value to the old letterbox. Message-room side fills are flat wall-color slabs with visible seams (see step 4).
- `?new=1` in the URL no longer wipes a Title Continue (the playtest URL keeps `new=1` after New Game).
- Did not touch dirty `art/rnd-pixel` or `art/out`.

---

# HANDOFF — Level 1 step 4: leftover plate and UI fixes

**Date:** 2026-11-10 (Asia/Calcutta)
**Focus:** Full-bleed rooms, a readable dark corridor, and the leftover UI/timing bugs. No new Blender.

## Plates

New `*_bleed.jpg` files in `game/public/assets/rooms/` (originals kept). `game/tools/bleed_plates.py` fills the uniform letterbox with the median color of the painted edge, the same idea as `office_bleed.jpg`. The arena keeps its circle; only the near-black void is covered with a dark floor tone. `corridor_dark_bleed.jpg` also has a midtone lift so the unlit room is readable.

## UI / timing

- Arena: the leftover “HOLD E AT THE PILLAR, F AT THE DRAFT” prompt is no longer added on the steal path. “GUARD BROKEN” / “RE-GUARD” are a UI toast under the boss bar (y=100), not world text over the HP bar.
- Archive: the steal path hides the old caption bar. Floor/sub lines sit at the bottom of the screen (y=688) so “the water drains…” no longer sits on the lowering bridge.
- Office: `liftDone` now flips only after the lift leaves have fully opened (~0.9s), so a still or playtest wait on `liftDone` catches open doors.

## Honest leftovers

- Hub side/bottom fills are close in value to the original letterbox, so a dark margin is still faintly visible. The painted floor still ends short of the canvas.
- The message room’s side fills are flat wall-color slabs; the seams are visible compared to the original inset.
- Archive_L still has a slightly darker bottom strip than Archive_H.
- Corridor_dark’s lifted margins include a slightly mismatched patch at the top-right (clock desk). The room is readable, not bright.
- The office-doors still itself is recaptured in step 5, once the playtest waits on the new `liftDone`.
- Did not touch dirty `art/rnd-pixel` or `art/out`.

---

# HANDOFF — Level 1 step 3: room cards, end screen, Continue

**Date:** 2026-11-10 (Asia/Calcutta)
**Focus:** Level flow around the already-playable rooms. Typographic UI only.

## What shipped

- The leftover `~/hub/` path HUD (and the fern/dash meta line) is hidden on the default steal path. HP and the esc menu stay.
- A clean room-name card fades in at the top of each room and out after ~1.6s: THE REAL OFFICE, THE MIRROR OFFICE, THE DARK CORRIDOR, THE FLOODED ARCHIVE, THE DRAFT, THE MESSAGE ROOM. The office card is skipped when New Game plays the intro (that already has FLOOR 2 / 11:48 PM).
- After the message-room cutscene (or a skip of it), an end screen: LEVEL 1 COMPLETE, play time, “Thank you for playing.” / “To be continued.”, then Back to menu (click, Enter, or Esc) returns to the title. `phaseComplete` is saved.
- Play time accumulates in `pi.save.v1.playMs` (flushed on room change, every 8s, and at the end screen). Continue already loads `save.room` / checkpoint, so it resumes the last room.

## Honest leftovers / next

- Full-bleed plates, corridor brightness, arena hint / HP overlap, archive caption vs bridge, and the late office-doors still are step 4.
- Playtest still starts in the office until step 5 walks boot → title → intro → playthrough → end → Continue.
- Swap / lab / combat URLs are unchanged (path HUD still shows in `?swap=1`).
- Did not touch dirty `art/rnd-pixel` or `art/out`.

---

# HANDOFF — Level 1 step 2: skippable office intro

**Date:** 2026-11-10 (Asia/Calcutta)
**Focus:** A short, skippable intro on New Game, then a fade into controllable R0 office play. Existing sprites and typographic cards only.

## Beats

1. Card: FLOOR 2 / 11:48 PM. Noor at her desk, typing.
2. Noor: “Rephrase. Again.”
3. A glitch (shake, flash, scanlines). AI: “I’LL HANDLE IT.”
4. Rain pauses, the room dims: “The office goes still.”
5. The desk lamp starts buzzing (code-drawn flicker + existing hum).
6. Fern unfurls near the lamp, then a fade into play at the room spawn.

Fern’s discovery line (“That lamp’s been buzzing since you sat down. The lift is dead.”) plays after the fade, not during the intro. A one-time controls hint follows: WASD move, E take, F throw, J attack, SPACE dash (touch labels when last input is touch).

## Skip / when it plays

- Esc skips immediately. Hold X (or hold the top-right) also skips, even on the first viewing.
- Only `startMode === 'new'` from the title screen. Labs, `?swap`, `?combat`, `?skipIntro`, and Continue do not play it, so verify_steal / impact_lab stay on the existing boot path.

## Honest leftovers / next

- No fall-through-the-floor hook: the steal path stays in the real office and uses the lamp / lift teach. The glitch is a short sting, not SC2.
- Fern fades out with the intro; she is a voice in R0, a sprite in the hub, same as today.
- Room-name cards, the end screen, and Continue-at-last-room polish are step 3. Playtest still expects to start in the office until step 5.
- Did not touch dirty `art/rnd-pixel` or `art/out`.

---

# HANDOFF — Level 1 step 1: boot splash + title screen

**Date:** 2026-11-10 (Asia/Calcutta)
**Focus:** A real launch: short studio splash, then a typographic title menu over the dimmed full-bleed office plate. No new Blender or video.

## What shipped

- Boot now starts `TitleScene` unless the URL has `?impact`, `?combat`, `?v9`, `?swap`, or `?skipTitle` (so verify_steal / impact_lab / office11 / linger / combat still boot into gameplay).
- Splash: typographic “AFTER HOURS / presents” (~1.6s, click or Enter skips), then title “PROMPT INJECTION” / “LEVEL 1” over `bg_office_base` (office_bleed), dimmed, with the existing office-window rain amb and a code-drawn desk-lamp flicker.
- Menu: New Game, Continue (only if a real `pi.save.v1` exists), Settings (volume 0–100, fullscreen toggle), Credits (short excerpt of CREDITS.md). Keyboard (WASD / arrows, Enter/Space, Esc back) and mouse, 56×420 hit areas.
- Volume lives in `pi.settings.v1` (not the game save) and is a master multiplier on Kenney samples + synth. Fullscreen is a user toggle only — never auto-entered.
- New Game wipes the save and starts the office as today. Continue starts the existing save. The intro cutscene is step 2; it is not in this commit.
- `window.__pi` on the title screen (`?test=1`): `screen` is `boot` during splash and `title` on the menu; hooks for newGame / continueGame / settings / credits / volume / fullscreen / skipSplash.

## Honest leftovers / next

- Existing `?test=1` playtest still expects to start in the office, so it will wait on `window.__pi` from TitleScene until step 5 rewires the suite. Lab / swap / combat URLs are unchanged.
- Continue is wired but play-time / last-room resume polish is step 3. No room-name cards or end screen yet.
- No new SFX downloaded; title uses existing Kenney Interface Sounds (`tell`, `key`, `block`).
- Did not touch dirty `art/rnd-pixel` or `art/out`.

---

# HANDOFF — Phase 1 step 4: steal playtest + stills

**Date:** 2026-11-10 (Asia/Calcutta)
**Focus:** Full Phase 1 Playwright playthrough on the steal mechanic, plus one still per room.

## Tests

- `npm run playtest` **184/184 passed** (desktop steal walk office → message; linger / office11 / combat / mobile kept on `?swap=1` or `?combat`).
- `verify_steal` **PASS**, `impact_lab` **PASS**.

## Stills (one key beat per room)

`mock-steal/phase1/stills/office-doors-open.png`  
`mock-steal/phase1/stills/hub-door-open.png`  
`mock-steal/phase1/stills/corridor-lamp-on.png`  
`mock-steal/phase1/stills/archive-bridge-down.png`  
`mock-steal/phase1/stills/arena-guard-broken.png`  
`mock-steal/phase1/stills/message-complete.png`

## Honest leftovers / skipped

- The office still was grabbed as soon as `liftDone` flipped, which is before the leaves finish sliding; the frame can still show shut/mid doors and Noor’s peel line (“What— what is this?”) instead of the open cab + Fern discovery lines.
- Archive still can catch the drain caption overlapping the bridge mid-lower.
- Arena still keeps the “HOLD E AT THE PILLAR, F AT THE DRAFT” floor prompt after the throw already landed. No enemy word plates, but the boss HP bar and “GUARD BROKEN” status are still UI chrome.
- Message-room chat lines may already have faded; the art is a framed inset with dark margins, not a full-bleed office.
- Hub/corridor/archive/message still show the old path/title HUD (`~/hub/` etc.). Word chips and READ are off.
- No paper-scrap source in the corridor (quick/still only). No thinning/cost VFX. No new Blender or art polish. Combat waves in the archive are the existing Scribble + notes, not a full Eraser Brute retune.
- Legacy word-swap office (tags, typist, dummy) still exists behind `?swap=1` so office11 / linger / mobile keep passing.
- Did not touch dirty `art/rnd-pixel` or `art/out`.

---

# HANDOFF — Phase 1 step 3: steal/throw in remaining rooms

**Date:** 2026-11-10 (Asia/Calcutta)
**Focus:** Convert hub, corridor, archive, and Draft arena from word-swap to steal/throw. Message room stays a cutscene (no steal required).

## What each room’s steal puzzle is now

- **R0 office:** Take the lamp’s spark, throw it into the lift panel, walk into the open cab → hub.
- **C2 mirror hub:** Take **open** from the lamp, throw it at the shut/chained door. Rebound off Fern (“Not me.”). Exit-ownership lines and Caret stay. Window teach is retired.
- **C3 dark corridor:** Take **on** from the painted-over switch, throw it into the dark lamp. Then take **quick** from the clock, throw it at the dummy, and attack. (No paper-scrap plate in this room.)
- **C4 flooded archive:** Take **low** from the drawer, throw it into the water (drain). Take **down** from the now-reachable stairs, throw it at the bridge. **dry** / **apart** / **wet** still peel from towel / books / ink for combat throws.
- **C5 Draft arena:** Take **weak** from the paper pillar, throw it at the Draft to drop its guard. Living copies are not a source. Defeat line is spoken only (“…So did I.”) — no floor text.
- **C6 message room:** Unchanged cutscene; no steal needed to go downstairs.

## Rules implemented (lean)

One held quality (a second take snaps the first home). F throws; incompatible targets rebound to the source. U (or E at the applied target) undoes the last throw. A held quality snaps home at a room threshold; solved throws stay. OnboardLure + ImpactFX light/heavy tiers reused. Word chips / READ / caption swap prompts are off in these rooms.

## §8 picks used

Cost: no thinning VFX. Exit ownership lines kept verbatim. Draft last line spoken only. Archive pair is drawer **low** → water. Title stays Prompt Injection.

---

# HANDOFF — Phase 1 step 2: lamp discovery dialogue

**Date:** 2026-11-10 (Asia/Calcutta)
**Focus:** Short cold-open / discovery lines that teach steal via the buzzing lamp (not the window), from `docs/story/power-rewrite.md` and `docs/design/power-rules.md` C1/C2.

## Dialogue

- Office entry: Fern, “That lamp’s been buzzing since you sat down. The lift is dead.”
- After the peel: Noor, “What— what is this?”
- After the doors open (protected lines): Fern, “You’re not supposed to be able to do that.” / “Things keep their words. People don’t peel them.” / Noor, “Then what am I?” / Fern, “For now, go through.”
- Hub intro keeps the world-rule exchange, but the last line is now “Look. The door.” — no window teach, no “try it.” Exit-ownership lines stay verbatim for when the hub exit opens (step 3).

C1 in the design doc still says “no peel in the real office.” Implementation choice: the v15j lamp/lift beat *is* the C1 teach, and the C2 window beat is retired.

## §8 open questions — simplest picks

1. **Cost visibility:** No thinning / glitch after a steal in Phase 1. Save it for Phase 3–4 so discovery stays panic, not a systems meter.
2. **Exit ownership:** Keep Fern’s “Only the owner of the words leaves.” verbatim (and Noor / Fern follow-ups). No rewrite this pass.
3. **Draft’s last line:** Spoken only (“…So did I.”). Drop the floor text “I TRIED SO HARD.” in the arena conversion (step 3).
4. **Archive pair:** Take **low** from the drawer, throw it into the water. (Not take-high from the water.)
5. **Title:** Stay “Prompt Injection.” No storefront rename in this pass.

---

# HANDOFF — Phase 1 step 1: dead-lift beat in normal office (R0)

**Date:** 2026-11-10 (Asia/Calcutta)
**Focus:** Promote the v15j lamp→panel→open lift→walk-in beat from `?impact` into normal office play at zoom 1, full-bleed. Remove word-swap / READ / caption remnants from the office path.

## What changed

- The default clarity office now always starts `ImpactLab` (same Blender lift + desk lamp, static zoom 1, `office_bleed.jpg`). `?impact` still isolates a fresh in-memory save and drops Noor next to the lamp.
- Word UI stays suppressed (no tags, no caption chips, no READ / code vision, no typist composer / SC2 hook). The practice dummy is `?combat` only. Fern’s word-swap leaf hint is off while the lab is running. Pressing I no longer toggles the lift off in normal play.
- After the panel hit opens the doors, walking into the cab (`x` 155–255, `y` 150–180) goes to the mirror hub. A solved save (`o_door = OPEN`) resumes with the lift already open. Progress is written to the save.
- Normal play keeps the room spawn / checkpoint (does not teleport to the lamp).

## Still leftover for later steps

- Discovery dialogue is still the short lab line (“That lamp’s been angry…”). Step 2 rewrites it.
- Hub / corridor / archive / arena / message are still word-swap. Steps 3–4 convert them and update the playtest.

Do not touch dirty `art/rnd-pixel` or `art/out`.

---

# HANDOFF — Impact Lab v15j (full-bleed room, Blender lift + desk lamp)

**Date:** 2026-11-10 (Asia/Calcutta)
**Focus:** Danishpreet approved v15i layout; fix the five leftovers (border, black-hole cab, dark cabinet doors, shrunken floor-lamp, flat lift).

## Fixes vs v15i

1. **Border:** The 1280×720 plate had a baked diorama void (~70px left/right, ~29px top, ~40px wainscot at the bottom). `office_bleed.jpg` inpaints those margins with continued wall/floor so the room art reaches every canvas edge. Zoom stays 1. HUD (hp, esc/menu) remains in screen space on the visible area. Capture asserts no void-coloured edge pixels (bolt-hit veil excluded).
2. **Open cab:** Blender-rendered lit interior — warm ceiling, back/side walls, floor, left control panel, and a warm spill on the office floor when the doors are open. No longer a black hole.
3. **Closed doors:** Brushed-steel leaves with a centre seam, highlight, frame, floor indicator above, and call panel on the wall. Reads as a lift, not a cabinet.
4. **Lamp:** Replaced the shrunken floor-lamp drawing with a banker/anglepoise desk lamp (green cowl, brass fittings, base on `desk_podW` top). Flicker, E glyph, and bolt source kept.
5. **Flat lift:** Original Blender 4.2.9 LTS models, same office camera (ortho 8.4, pitch 38, yaw −30) as the plate. Layers: frame, leaf_l/r, seam, cab, spill, panel, indicator. Doors still slide with `setCrop`.

## Stills

`mock-steal/v15j/stills/1440x800/01-closed-dead-lift.png`  
`mock-steal/v15j/stills/1440x800/02-bolt-hit.png`  
`mock-steal/v15j/stills/1440x800/03-doors-open.png`  
`mock-steal/v15j/stills/1440x800/04-walk-in.png`  
`mock-steal/v15j/stills/1512x945/01-closed-dead-lift.png`  
`mock-steal/v15j/stills/1512x945/02-bolt-hit.png`  
`mock-steal/v15j/stills/1512x945/03-doors-open.png`  
`mock-steal/v15j/stills/1512x945/04-walk-in.png`  

Capture: `node game/tests/capture_v15j.mjs`

## Tests

`capture_v15j` PASS (layout + no-border edges; 3D sill base gap 11px ≤ 14).  
`verify_steal` PASS, `impact_lab` PASS (static zoom 1).

## Honest leftovers

- Closed steel is quite bright against the muted office palette (intentional so it cannot be read as a cabinet).
- The cab is lit and has a floor, a left panel, and spill, but it is still relatively frontal at room-scale zoom; the handrail is hard to see.
- The banker shade reads clearly on the desk; the articulated arms are mostly hidden under the cowl from this 3/4 camera.
- The inpainted bleed margins are slightly softer than the painted floor (especially near the bottom-right plant).
- At 1512×945, ENVELOP crops ~64 world-px per side, so the “menu” label can clip.
- The 3D sill sits ~11px onto the floor (a threshold, not a hanging box).
- Impact FX still does a brief 1.06× punch on bolt hit, then returns to zoom 1.
- Did not touch dirty `art/rnd-pixel` or `art/out`.

---

# HANDOFF — Impact Lab v15i (zoom 1, lift in the wall, lamp on desk)

**Date:** 2026-11-10 (Asia/Calcutta)
**Focus:** Danishpreet’s v15h Mac screenshot: 2× follow cam too close/blurry, lift pasted on and hanging over the floor, lamp floating above a desk.

## Fixes vs v15h

1. **Camera:** `?impact` now uses `setupStaticCamera()` (zoom 1, no follow, no 2.1× punch-in on `frameDoors` / `frameLift` / `frameHandPanel`). The whole 1280×720 office fills the browser under `Scale.ENVELOP` (no letterbox). Crisp, not upscaled.
2. **Lift rebuilt in the baked recess.** Opening `(150, 81, 110, 119)` — bottom 200, frame outer `(146, 77, 118, 127)` bottom 204, wall-floor at the door ≈ 202 (2 px gap). Same scale as the calendar / bookcase / whiteboard. Dark steel leaves + darker receding cab (no beige box, no handrail rod). Tight plate-sampled `wall_cover`. Panel `(276, 164)` — 16×24, hand height, immediately right of the frame, no green-rim UI. Desk is **not** shifted (v15h `POD_W_SHIFT` reverted) so no baked desk/chair remnants under a hanging lift.
3. **Lamp on `desk_podW`.** `(178, 291)`, scale 0.82, origin 0.92 — base sits on the desktop top face (desk at 115,273, top face y 273–305). Lure kept (flicker, E glyph, bolt path to the panel).

## Stills

Captured at real browser aspects, zoom 1, no follow:

`mock-steal/v15i/stills/1440x800/01-closed-dead-lift.png`  
`mock-steal/v15i/stills/1440x800/02-bolt-hit.png`  
`mock-steal/v15i/stills/1440x800/03-doors-open.png`  
`mock-steal/v15i/stills/1440x800/04-walk-in.png`  
`mock-steal/v15i/stills/1280x800/01-closed-dead-lift.png`  
`mock-steal/v15i/stills/1280x800/02-bolt-hit.png`  
`mock-steal/v15i/stills/1280x800/03-doors-open.png`  
`mock-steal/v15i/stills/1280x800/04-walk-in.png`  

(Flat prefix copies also under `mock-steal/v15i/stills/`.)  
Capture: `node game/tests/capture_v15i.mjs`

## Tests

`capture_v15i` PASS — lift frame does not intersect plant/desk AABBs or printer footprint; lift base within 2 px of wall-floor; lamp base on desk top; panel adjacent to frame (12 px gap); zoom = 1, no follow.  
`verify_steal` PASS (now asserts static zoom ≈ 1).  
`impact_lab` PASS (no longer forces follow 2.0).

## Honest leftovers

- Lift is front-facing code-drawn steel on an isometric painted room — sits in the wall at the right scale, but still flatter than the bookcase.
- Closed doors are very dark (can read as a cabinet until they open). Cab interior is a simple shaded box, not painted.
- Painted lamp is still a floor-lamp design; it now sits on the desk at a smaller scale.
- Printer sprite AABB kisses the lower-left jamb (printer draws in front at depth 241; footprints do not intersect) — matches the original plate.
- At 1280×800, ENVELOP crops ~71 world-px on each side (west wall / far-right props; the “menu” label can clip). 1440×800 shows the full plate width; the dark left strip is the room’s west wall, not letterbox.
- Impact FX still does a brief 1.06× punch on the bolt hit, then returns to zoom 1.
- Did not touch dirty `art/rnd-pixel` or `art/out`.

---

# HANDOFF — Impact Lab v15h (seamless wall cover + clear entrance)

**Date:** 2026-11-10 (Asia/Calcutta)
**Focus:** Invisible wall_cover (plate-matched gradient + feather), props not clipped, desk/lamp clear of lift entrance.

## Fixes vs v15g

1. **wall_cover** regenerated from `rooms/office.jpg`: per-row L/R wall samples, opaque only over frame+opening (stops before floor), feathered edges. Seam assert: plate wall vs cover pad `dMax ≤ 28` (capture measured **0**).
2. **Props:** `bookcase` / `plantW` / `printer` / `kitchen` depth bumped above cover during lab; cover no longer paints over calendar (shrunk past frame).
3. **Entrance:** `desk_podW` + `chair_podW` shifted `(+240,+27)` at runtime (sprites + `O11_PROPS` collision); lamp → `(388,295)` on relocated desk. Restored on `stop()`.

## Stills

`mock-steal/v15h/stills/01-closed-dead-lift.png`  
`mock-steal/v15h/stills/02-bolt-hit.png`  
`mock-steal/v15h/stills/03-doors-half-open.png`  
`mock-steal/v15h/stills/04-doors-open-cab.png`  
`mock-steal/v15h/stills/05-walk-in.png`  
+ `playthrough.mp4`  
Capture: `node game/tests/capture_v15h.mjs`

## Tests

`capture_v15h` PASS (wall outside-frame, wall seam, panel-beside-frame, walk-in clear path).

## Weak spots

- Runtime mutates `O11_PROPS` for pod desk; other systems reading that array during impact see the shifted polys (intentional for collision).
- Flat-shaded lift sprites; calendar is baked plate art to the right of the frame (now fully visible).
- Vision stills sometimes misread closed leaves / stile as “outside-frame slats”; pixel asserts are authoritative.

---

# HANDOFF — Impact Lab v15g (wall cover + leaf crop)

**Date:** 2026-11-10 (Asia/Calcutta)
**Focus:** Outside the steel frame, only plain dark office wall. No slatted leaf steel / baked lift art beside the frame. Lift visuals = code-drawn frame, leaves, cab, indicator, panel only.

## Diagnosis (v15f → v15g)

- Phaser 4 **WebGL**: `GeometryMask` is Canvas-only → leaf `setMask` was a no-op. Open leaves drew full width into wall pockets and over FG.
- Layer toggle: turning off `leafLeft` restored wall at screen ~x250; `leafRight` affected the right pocket. Baked door plate stays hidden; `lift_wall_cover` (full plate) sits under the layered lift.

## Fix

- `clipLeavesToOpening()` via `Image.setCrop` to the opening intersection (WebGL-safe). Called on spawn, each open tick, and `applyLiftDoorK(k)` (aborts in-flight open anim).
- Full-plate `lift_wall_cover.png` loaded in `boot.ts` — covers baked lift footprint; frame/leaves/cab draw on top.
- Capture `capture_v15g.mjs`: outside-frame wall asserts (upper door band, canvas→screenshot map). Samples left/right of stiles must be dark wall (`lum<55`, low `lumStd`), not slatted steel. Also samples screen x≈140 / x≈510 (skip if inside opening or FG occlusion).

## Stills

`mock-steal/v15g/stills/01-closed-dead-lift.png`  
`mock-steal/v15g/stills/03-doors-half-open.png`  
`mock-steal/v15g/stills/04-doors-open-cab.png`  
Capture: `node game/tests/capture_v15g.mjs`

## Pixel check (04-open, y≈330)

- Outside left ~x250–280: wall_cover ≈(19,33,42), lumStd < 1  
- Outside right ~x750–780: wall_cover ≈(18–21,34,41), lumStd < 1  
- Inside opening: cab / leaf only

## Tests

`capture_v15g` PASS (wall asserts + panel-beside-frame).

## Weak spots

- Wall cover is a flat dark plate; slight tone step vs room gradient at plate edges.
- Absolute cols 140/510 depend on framing (140 often plant FG; 510 often inside cab at zoom 2.25) — asserts skip those cases.
- Flat-shaded code sprites (Blender still unavailable).

---

# HANDOFF — Impact Lab v15f (leaf pocket mask)

**Date:** 2026-11-10 (Asia/Calcutta)
**Focus:** Clip sliding leaves (and cab) to the inner opening so they vanish into wall pockets behind the frame — no more leaves drawing over plant / lamp desk / side wall.

## Fix vs v15e

- `GeometryMask` on recess, cab, `leaf_l`, `leaf_r` = exact opening rect `(LIFT_OX, LIFT_OY, LIFT_OW, LIFT_OH)`.
- Steel frame stays **unmasked** and higher depth so the surround draws on top as leaves slide away.
- Wall patch shrunk to opening only (no spill onto adjacent wall).
- Lift layer depth stays ≈102 so `plantW` (229) and `desk_podW` (346) / lamp (360) stay in front where they sit lower on screen.
- Panel-beside-frame asserts unchanged (`PANEL ≈ 312,188`).

## Stills

`mock-steal/v15f/stills/03-doors-half-open.png`  
`mock-steal/v15f/stills/04-doors-open-cab.png`  
Capture: `node game/tests/capture_v15f.mjs`

## Tests

`capture_v15f`, `verify_steal` PASS.


---

# HANDOFF — Impact Lab v15e (layered lift sprites)

**Date:** 2026-11-10 (Asia/Calcutta)
**Focus:** Stop patching baked door JPGs. Code-drawn layered lift (Blender unavailable): recess, cab, sliding leaves, steel frame, wall panel. Panel beside frame with capture + verify asserts.

## Why

v15d painted over `lift_0N.jpg` and left a beige smudge / stray line; panel still read as kitchen. Blender is not installed on the box, so the allowed fallback is a flat-shaded steel lift matching the office palette.

## Layers (back → front)

Assets in `game/public/assets/fx/lift_layers/` (`recess`, `cab`, `leaf_l`/`leaf_r`, `frame`, `panel_dead`/`live`, `ind_off`/`on`). Geometry in `meta.json` / `LIFT_*` constants in `ImpactLab.ts`.

1. Hide baked `o11door_*` plate while lab runs; wall patch behind opening.
2. Recess → cab → left/right leaves (tween `x` + shudder) → steel frame → floor indicator above doors → call panel on wall immediately right of frame (`PANEL ≈ 312,188`).
3. Lamp: keep painted `fx_lamp_on/off`.
4. Restored pristine art-v11 door JPGs (no more in-place composites).

## Stills

`mock-steal/v15e/stills/` + `playthrough.mp4`  
Capture: `node game/tests/capture_v15e.mjs`  
Required: `01-closed-dead-lift`, `02-bolt-hit`, `03-doors-half-open`, `04-doors-open-cab`, `05-walk-in`.

## Asserts

Every capture still + `verify_steal`: panel world `x` is right of opening and within `frameRight+55`; screen `dx` from opening right is in `[-5,140]`.

## Best verification stills

- `01-closed-dead-lift.png` — shut steel leaves + dead panel on jamb + lamp E
- `04-doors-open-cab.png` — sliding leaves open, cab+handrail+ceiling light, live panel
- `05-walk-in.png` — Noor at open lift

## Weak spots (honest)

- Flat-shaded code sprites, not Cycles plate-matched renders (Blender missing on box).
- Cab side walls are simple polygons; at some zooms the left wall can still read as a dark plane.
- Panel green live rim remains slightly “UI”.
- Leaf slide is a capture-driven `x` tween; production may want Matter/physics polish.
- Extra diagnostic stills from the v15d capture path remain in the folder (near-lamp, peel, etc.).

## Tests

`capture_v15e`, `verify_steal`, `impact_lab` PASS.


---

# HANDOFF — Impact Lab v15d (wedge out, panel on jamb, dim cab)

**Date:** 2026-11-10 (Asia/Calcutta)
**Focus:** Fix v15c 09-doors-fully-open — black cab wedge, panel over doorway, wash-out cab; optional Blender lamp

## Fixes vs v15c

1. **Black wedge removed:** Baked dark slanted quad inside open `lift_0N.jpg` frames was painted out surgically (bright-opening seed + dilated wedge mask → dimmed cab fill). `fx_lift_cab` overlay disabled (it re-drew a black shell). Door leaves/frame geometry preserved so leaves still read as sliding into the sides.
2. **Panel on jamb outside opening:** `PANEL ≈ (334, 174)` = `O11_DOOR + (222, 112)` — past door-plate right edge (~308), never covers the gap. Scale 1.05. Kitchen FG still hidden in lab.
3. **Cab brightness:** Opening fill uses ~0.72× sampled beige + extra wash dim; handrail inked into open frames so it stays visible.
4. **Desk lamp:** Retried simple Blender lamp (base disk, 2 arm cylinders, cone shade, emissive bulb) in `art/render/impact_v15d/` — arms disconnect at the elbow. **Kept painted sprite** (`fx_lamp_on/off`).

## Stills

`mock-steal/v15d/stills/` + `playthrough.mp4`  
Capture: `node game/tests/capture_v15d.mjs`

## Best verification stills

- `09-doors-fully-open.png` — open cab without black wedge; live panel on wall jamb; handrail readable
- `01-lamp-lure.png` — painted desk lamp + E; dead panel on jamb; fern line

## Weak spots (honest)

- Cab fill is a soft paint-over of the Blender door plate, not a re-rendered Cycles interior — floor seams/handrail are simplified.
- Live panel green rim still reads a bit “UI”; baked-in door-plate call button remains near the frame.
- Midflight ADD bloom can still white-out Noor briefly.
- Blender desk lamp needs connected elbows before it can replace the painted sprite.

## Tests

`capture_v15d`, `verify_steal`, `impact_lab` PASS.


---

# HANDOFF — Impact Lab v15c (bolt path, lamp, lift cab, flush panel)

**Date:** 2026-11-10 (Asia/Calcutta)
**Focus:** Fix v15b weak spots — bolt aims at panel (fast), readable desk lamp, real lift interior, flush steel panel

## Fixes vs v15b

1. **Bolt path:** Travel is parametric hand→panel over ~150ms (`boltT / 0.15`). Jag ≤~4px perpendicular so the overall vector always points at the panel. `frameHandPanel()` centers the camera on the hand↔panel midpoint. Tip sprite scaled down; beam carries the read.
2. **Lamp:** Replaced oversized cut-out with a properly scaled desk lamp (~monitor height) on `desk_podW` (world ≈148,268), arm+shade+bulb+sparks, depth above the desk. Blender kitbash `lampSquareTable` was a cube lamp; final in-game art is a painted match to office grey/warm lighting at game scale.
3. **Lift interior:** `fx_lift_cab` overlay + composited Blender cab into `office11/door/lift_01..09.jpg` (handrail, ceiling light, floor seams, side buttons). Cab alpha rises with `doorK`. Door leaves still use the existing open-frame slide.
4. **Panel:** Flush steel plate with bevel highlights, drop shadow, screws, recessed screen + button. Live state keeps a green glow rim (lit), not a giant floating UI box. Scale ~1.2 on the lift jamb (~240,180).

## Stills

`mock-steal/v15c/stills/` + `playthrough.mp4`  
Capture: `node game/tests/capture_v15c.mjs`

## Best verification stills

- `01-lamp-lure.png` — readable lamp + E; panel on lift jamb
- `06-bolt-midflight.png` — bolt mid-path hand→panel under `frameHandPanel`
- `09-doors-fully-open.png` — open doors + lit cab + live panel beside lift

## Weak spots (honest)

- Lamp is still a 2D sprite (not a full Blender office-kit cutout); style matches greys/warms but not true Cycles shading of desk_podW.
- Cab interior can wash bright at high zoom; handrail/buttons are clearer in the asset than in some stills.
- Live panel green rim can still read slightly “UI” vs pure wall plate.
- Midflight ADD bloom can briefly white-out Noor/panel; path is correct but contrast is hot.

## Tests

`capture_v15c`, `verify_steal`, `impact_lab` PASS.


---

# HANDOFF — Impact Lab v15b (dead lift)

**Date:** 2026-11-09 (Asia/Calcutta)
**Focus:** Ship-ready stills for dead-lift beat (lamp → spark → lightning → panel → lift open)

## What changed (v15 → v15b)

1. **Call panel** sits on the **right lift door leaf** at world ≈(240, 180) — attached to the lift, clear of kitchen (~299) and printer/plantW (~81). Kitchen FG is hidden while the lab runs so the green live panel can’t read as “coffee machine glowing.”
2. **Desk lamp** is a readable arm+shade sprite on `desk_podW` (≈152, 288), depth above the desk, scale 2.15, with flicker + spark pops. E glyph sits above the shade.
3. **Camera** eases to frame Noor+lift on throw (`frameLift`) and holds tight on doors while they open (`frameDoors` ~2.1–2.4×).
4. **Lightning** is a thick ADD-blended tip sprite plus a branching jagged `Graphics` beam from hand → tip/panel. Big-tier silhouette frames are longer (220ms × 2) with a darker world-space veil.
5. **Stills** recaptured to `mock-steal/v15b/stills/` + `playthrough.mp4`.
6. **Unused FX:** deleted `wind_wisp.png` (only leftover gust/chain texture in `assets/fx`).

## Still checklist (verified)

| Still | Expect |
|-------|--------|
| 01-lamp-lure | Lamp readable + E; lift in frame; dead panel on door |
| 02-near-lamp-E / 03-peel-hold | E on lamp, peel hold |
| 04-carrying-F | Spark held; F pulse toward panel on lift |
| 05-before-throw | Noor + lift framed |
| 06-bolt-midflight | Thick bolt / beam mid-flight |
| 07-impact-frame | Silhouette impact (veil + sil) |
| 08-doors-half-open | Doors mid-open, lit interior, live panel on lift |
| 09-doors-fully-open | Doors open, lit interior |
| 10-walk-in | Noor toward open lift |

## Weak spots (honest)

- Panel is a flat 2D overlay on isometric art — can still read a bit “UI floating” rather than flush wall plate.
- Follow-cam mid beats (02–03) crop the lift; throw/door stills are the verification frames for (a)/(c).
- Half-open gap is subtle; full-open is clearer. Silhouette impact uses a strong white flash (invert frame) that washes environment detail.
- Bolt travel is slowed for readability; production feel may want it snappier after stills sign-off.

## Tests

- `node tests/capture_v15b.mjs` (Playwright stills)
- `node tests/verify_steal.mjs`, `node tests/impact_lab.mjs`, playtests as before

## Run

`?impact=1` — hold **E** at lamp, **F** at panel.


---

# Games project handoff (read this first)

This file is for any coding agent (Claude Code, Cursor, Codex and others) picking up the game work with no other context. `AGENTS.md` and `CLAUDE.md` in this folder are identical copies of this file. Written 29 Oct 2026 (Asia/Calcutta). The original work was done on a Linux box under `/workspace/games/`, and this folder is a copy of that one.

## 1. Goal and hard constraints

**Owner:** Danishpreet Singh, a React / React Native developer with an M3 MacBook (24 GB). He wants to **earn money from web and mobile games**.

| Rule | Detail |
|---|---|
| Zero spend | No paid assets, APIs or tools. The only planned cost is the $25 Google Play account, and only once a game is ready for Android. |
| Licences | Use **CC0 or explicitly commercial-OK assets only**. Log every asset (name, URL, author, licence, date) in the project's `CREDITS.md` and keep the pack's licence file. Reject NC, personal-use-only or unlicensed assets. |
| No AI images as shipping assets | AI concept frames, such as `prompt-injection/art-v2/concepts/`, are mood references only. Never ship or trace them. **Never use FLUX.1 [dev]** (its licence is non-commercial). |
| Stack | **Phaser 4.2.1 + TypeScript + Vite**, with Playwright for headless playtests. **Capacitor** wraps the web build for Android later. |
| Distribution | **CrazyGames** (Basic Launch, then Full Launch), **itch.io**, and a **Poki** pitch for the best game. Poki is web-exclusive, so check each portal's exclusivity terms before submitting to more than one. |
| Out of scope for phase 1 | Unity, Unity MCP, Modly, and local image models. |

The full reasoning is in `docs/rnd-money-plan.md` and `docs/studio-process.md`.

## 2. Working style

- **Pre-production comes first.** The order is: story, then character sheets, then environments and art direction, then the build. Do not jump into code before the story and the look are agreed.
- **The bar is high.** The user wants refined, standout art and rich, atmospheric environments, not stock-looking Kenney scenes. Layered lighting, set dressing, foreground and background depth, and a strong silhouette for every character all matter.
- Present options and recommendations, but **the user decides**. Mark recommendations "your call".
- Be honest about weaknesses. Every art README ends with a "Known weaknesses" list, so keep doing that.
- The bot can build and test headlessly, but it cannot judge game feel. Every gate needs the user playing on a real phone and laptop.

## 3. Current project: "Prompt Injection" (working title)

**Do not ship under that title.** *Escape from Prompt: Rogue AI* launches on Steam on 29 Oct 2026 with a similar title and theme. The title candidates are **Voice Match** (no game found) and **Draft Zero** (no game found; a podcast uses the name). The full name check is in `docs/prompt-injection-story-bible.md`, under "Tone and name check".

**Genre:** a top-down 2D action roguelite with 5–10 minute runs, for mobile landscape and desktop. Attacks are short sentences built from word chips (verb + target + optional modifier). Elite enemies wear 3-word rule plates that you rewrite by swapping one word. There is no live language model; the vocabulary of about 40 words is designed by hand.

**Room and enemy bible (29 Oct 2026): `docs/room-and-enemy-bible.md`.** Read it before building any room or enemy. It has the 18-room structure (hub plus 5 floors, forks on floors 2 and 4), each room's look, layout, enemies, combat, puzzle and story beat, the plate-puzzle grammar (every word costs a word, form docking, name chips, a twist per floor), the enemy compendium (5 existing + 6 new: Read Receipt, SLA Hound, Apology Moths, The Macro, The Thread, The 4.9; plus Fern's phases), the pacing curve, the 12 Drafts, and the **prioritised rendering queue (P0 = the R8 "The Last Row" vertical-slice mock)**. Page version: https://cursor.com/canvas/store-7ec6d4c3-f73d-47c7-83bb-1e54c6e52c9a/87a538f2-73d5-41ee-851f-1bc1bbc171ea

**Recommended story: "Voice Match" (Option A). The user has NOT confirmed it yet.** Options B (All-Hands) and C (Golden Set) are fully written up in the story bible.
- Noor Sethi, 31, is the last support writer at Ferngate Mutual. On launch eve she is pulled inside the company AI, **Fern**, which was trained on nine years of her replies, including the unsent drafts to her brother Kabir.
- **Caret** is the blinking cursor, an ally. It is the part of Fern that learned from her unsent drafts. **Dez** is a laid-off QA tester.
- The enemies are the Autocomplete, Hallucinator, Refusal Warden, Sycophant and Redactor. The boss is Fern.
- The game has five floors: Training Data, Context Window, Policy Filters, Reward Model, and the Core.
- **The boss rule plate and twist is "FERN IS NOOR, NEVER TIRED."** The villain is an instruction, not the AI.
- There are three endings: Signed (FERN CREDITS NOOR), Unsent (FERN FORGETS NOOR), and Out of Office (NOOR IS TIRED).

**Art direction: the v3 hybrid look, variant (a).** It is a clean 3D diorama with neon-noir lighting: a dark navy and indigo base, magenta and cyan key light, haze, light pools, rim light and bloom, with a fixed 3/4 iso camera. Variant (b), the pixel look, is kept only as an optional glitch or flashback filter.

**Calm-level art rule (owner, 2026-10-29): levels must be clean and soothing so players want to keep playing and exploring, never messy.**
- Keep the hybrid look, but use a softer palette: a deep teal/indigo base at low contrast, warm lamp pools carrying the light, and neon (cyan, magenta, coral) only as a sparing accent (under ~5% of the frame).
- Use one warm and one cool light per room, plus at most one accent, with gentle bloom.
- Keep a readable open floor. Props go in 2–3 clusters along the walls.
- Use at most 2 word-tile phrases per room, spaced, never touching props, actors or UI.
- Actors must pop: own light rig, outline, contact shadow.
- Keep a minimal, quiet HUD.
- Aim for atmospheric and premium, not empty (Hades, Tunic, Monument Valley calm).
- `art-v5/tools/post5.py` checks the overlaps automatically.

### Latest art: `prompt-injection/art-v6/` (v5 kept unchanged in `art-v5/`)

`prompt-injection/art-v6/README.md` has the full file list per tier. v6 works through the bible's rendering queue (`docs/room-and-enemy-bible.md` §8) in priority order; `art-v6/PROGRESS.md` has one line per finished tier and the tarball paths.
- **Done so far:** P0 (vertical slice), P1 (6 rooms + 5 enemy/pickup sheets), P2 (10 more rooms R0 R3 R4 R9 R12–R17, Moths, The 4.9 + stars, Fern stagger/seated, NEVER tile, Dez).
  - **P3 done:** custom props (`out/p3/props/`), terminal-style enemy + unlock-word icons (`out/p3/icons_*`), 3 endings + dawn (`out/p3/endings/`, clean), hand-tuned 8-frame move cycles (5 enemies), pixel flashback filter (`tools/pixel_filter.py`).
  - **UI direction B (Terminal Poetry):** the painted plate atlas `out/plates/` is deprecated.
  - **UI (FINAL: direction B "Terminal Poetry", `prompt-injection/ui-v2/`, chosen 29 Oct 2026).** Rules are glowing JetBrains Mono text on the floor (45 % slant, dark backing) that rise as a backed billboard when Noor is within 2.5 tiles or the plate is targeted. The HUD is a terminal path, title and caret, `hp` squares and `drafts xx/12`. The composer is a single `>` command line with the hand below it. Fonts are JetBrains Mono and IBM Plex Mono (OFL). The spec is in `ui-v2/README.md`; tokens, fonts, icons, the floor-text texture generator and a Phaser sketch are in `ui-v2/kit/`. Mocks are in `ui-v2/out/`.
  - **Deprecated:** the hand-painted marker plates (`art-v6/out/plates/plate_tiles.*`), the Kenney Future HUD in `post6.py`, and the ui-v1 directions A, C and D. Build on the clean plates `art-v6/out/clean/*_clean.png` and the phrase positions in `art-v6/render/v6/<ROOM>_actors.json` (`extra.tiles`).
  - `out/H6_R8_floor2_lastrow_1280x720.png`: R8 The Last Row (horseshoe of 12 desks, Noor's lamp on, ALWAYS BE HELPFUL neon, plates WARDEN REFUSES NOOR + DOOR IS SHUT, HUD DRAFTS 6/12). Use this instead of `H5_floor2_openplan` for the slice.
  - Noor re-rendered (`out/sprites/noor_*`): side and back views now read (hair up, skin at temples and nape, ears, glasses arms) and the attack FX is calm (teal keys, amber/ice shards, soft ice ring). New calm projectile `out/sprites/fx_prompt_shard.*`.
  - `out/plates/plate_tiles.png/.json` (**deprecated**, superseded by ui-v2): painted-sign word-tile atlas (9-slice boards in normal / lift / repaint states, 40 words, floor 3 review ring frames + stamp, floor 4 star rows).
  - Sycophant and Warden now have **true 8-direction** sheets (rows S, SE, E, NE, N, NW, W, SW).
- **Sprite format** (unchanged): 192 px cells, rows = directions (Noor 8: S, SE, E, NE, N, NW, W, SW), foot pivot (96,160), Phaser JSON-hash, names `<char>_<anim>_<DIR>_<NN>`, baked 1 px ink outline `#0C0E1E` @ 80 %, `meta.direction_map` for 1/4-direction characters, `tell` + `hit_frame` on attacks. Characters not re-rendered in v6 stay valid from `art-v5/out/sprites/`.
- **Calm level rule** (mandatory): deep teal/indigo base, warm lamp pools, sparing neon, open floors, props in edge clusters, ≤ 2 word-tile phrases per room (`post6.py` QA), minimal HUD.
- **Licences:** Kenney CC0 packs + Permanent Marker font (Apache-2.0). No AI images, no FLUX. See "Art v6" in `prompt-injection/CREDITS.md`.

### Known remaining art weaknesses
1. Enemy animation is still procedural part-transforms (stiff move cycles) until P3 hand-tuning.
2. Noor's side/back fix is a recolour of the Kenney hair cap plus small added parts, not a sculpted hairstyle.
3. The Sycophant's E/W views are thin (a TV seen side-on).
4. Rooms are low-sample renders (64 spp + OIDN); slight denoiser smoothing on floors.

### Next steps (in order)
1. **Get the user to confirm the story** (Voice Match or an alternative) and the title.
2. Build a **vertical slice in Phaser**: Floor 2 Open Plan plus the Refusal Warden with its rule plate. It needs:
   - the word-chip casting
   - the v5 atlases (use `meta.direction_map` and `hit_frame`)
   - mobile controls
   - a headless playtest

   Follow the gates in `docs/studio-process.md` and the calm-level rule above.
3. Art polish as time allows: Noor's side views, a softer attack FX, the pickup icon, and hand-tuned enemy move cycles.

## 4. Folder map

Every Node project has `package.json`, `src/`, `tests/` (Playwright), `dist/` (build output), and `CREDITS.md`. To run one:

```bash
cd <project> && npm install && npm run dev          # dev server
npm run build      # tsc + vite build -> dist/ (relative paths, no network calls)
npm run preview    # serve dist/
npm run playtest   # headless Playwright test against the preview server; writes screenshots/
```
The first `npm run playtest` on a new machine may need `npx playwright install chromium`. Do not copy or sync `node_modules/` (about 200 MB per project); reinstall it instead.

| Path | What it is | Status |
|---|---|---|
| `HANDOFF.md`, `AGENTS.md`, `CLAUDE.md` | This handoff (three identical copies) | |
| `docs/room-and-enemy-bible.md` | Room-by-room level and enemy design: 18 rooms, enemy compendium, puzzle grammar, pacing, Drafts, prioritised render queue | Current project |
| `docs/prompt-injection-story-bible.md` | Story bible: art v2/v3, originality pass, 3 story options, world, cast, mechanic, storyboard, name check | Current project |
| `docs/studio-process.md` | How big studios work, scaled down to a 2-person web team; the pipeline gates | Process reference |
| `docs/rnd-money-plan.md` | R&D on AI game tools, the zero-cost asset stack, licences, where the money is, the 90-day plan | Strategy reference |
| `docs/dungeon-bible-echo-knight-lamplighter.md` | Earlier pre-production bible: Echo Knight vs The Last Lamplighter | Shelved for now |
| `physics-puzzle/` | **Flipside Drop**: a physics puzzle (Phaser 4.2.1 + Matter). Pop wood and glass blocks, set off TNT, and use a limited gravity FLIP to land the alien on the flag. 10 levels, saved in localStorage. `npm run preview` uses port 4173. `node tests/_probe.mjs <level>` traces a level's solution, and `python3 scripts/build-atlas.py` rebuilds the atlas from the Kenney packs. Art and sound are Kenney CC0 (Physics Assets, UI Pack, Interface Sounds); licences are in `public/licenses/` | First built game; see the issues below |
| `physics-puzzle-build.zip` | Zipped `dist/` of Flipside Drop | |
| `proto-echo-knight/` (+ `.zip`) | Greybox prototype, shapes only, no assets. 4 rooms with chasers, shooters and a mirror boss. Each death adds a ghost that replays your last run (max 3). Preview uses port 4174. Tests passed 22/22 | Waiting for the user's playtest |
| `proto-lamplighter/` (+ `.zip`) | Greybox prototype. The light radius shrinks, lamps relight it, shades spawn in the dark, and the Shadow boss only takes damage while lit. Preview uses port 4175. Tests passed 20/20 | Waiting for the user's playtest |
| `_shared/` | Shared code for the two prototypes: `controls.ts`, `stats.ts`, `main.ts`, and the Playwright `helpers.mjs` | |
| `preprod/` | Dungeon pre-production art: storyboards (`ek_*.png`, `ll_*.png`), maps, HUD wireframes, character sheets, art comparisons, and atlases (`sprite_atlas_q.png`, `v2/atlas2.png`). Scripts: `build.py`, `build2.py`, `build_art_v2.py`, `render/render_sprites.py` and `render/render_all_hd.sh` (Quaternius renders → `render_hd/`). `CREDITS.md` | Shelved |
| `prompt-injection/CREDITS.md` | Licence log for all Prompt Injection art (v1–v5) | Keep it updated |
| `prompt-injection/preprod/` | v1 storyboard (`p1`–`p8.png`, `_x3` versions), `cast_sheet.png`, `pi_atlas*.png/json`, `thumbnail_concept_poki_628.png`. Scripts: `build_pi.py`, `build_pi_extra.py`, `build_pi_atlas_page.py` (they reuse helpers from `preprod/build_art_v2.py`). Uses fantasy Quaternius models | Superseded by v2–v4 |
| `prompt-injection/art-v2/` | Three style samples: A neon-noir pixel, B corporate pastel, C 3D diorama. `out/`, `tools/` (`make_tex.py`, `scene.py`, `post_*.py`, `sheet.py`), `tex/`, `page/` (webp previews), and `concepts/` (**AI mood references only, never ship**). `README.md` | Superseded |
| `prompt-injection/art-v3-hybrid/` | Diorama plus neon-noir hybrid, with (a) clean and (b) pixel variants and a 24-colour palette. `out/`, `tools/` (`make_tex_base.py`, `make_tex_h.py`, `scene.py`, `post_H.py`, `sheet_h.py`, `palette_h.py`), `tex/`, `web/`. `README.md` | (a) was the chosen direction; superseded by v4 |
| `prompt-injection/art-v4/` | v4 art: `out/` (mocks, cast sheet, palette, `sprites/` incl. `fx_prompt_shard`), `tools/`, `tex/`, `render/`. `README.md` | Superseded by v5 (kept untouched; the shard projectile is still used) |
| `prompt-injection/art-v5/` | **Latest art (calm levels).** `out/` (3 mocks, cast sheet, palette, `sprites/` for Noor + 5 enemies + Caret), `tools/` (pipeline), `tex/` (generated textures; `tex/v3/` holds reused v3 textures), and `render/` (intermediate frames, regenerable). `README.md` | **Current** |
| `_downloads/` | Raw third-party CC0 packs (about 1 GB). **Not synced to the Mac**; see section 6 | Re-fetch if needed |

### Flipside Drop (physics-puzzle): known issues
Its README has no "known issues" section. These are the open items visible in the README and code:
- `src/portal.ts` is a **no-op stub**. The CrazyGames and Poki SDKs (ads, gameplay start/stop events) are not wired in yet.
- `tests/_probe.mjs` hard-codes `/workspace/games/physics-puzzle/tests/solutions.mjs` and writes `/tmp/probe<N>.png`. Change both to relative paths on the Mac.
- `scripts/build-atlas.py` reads its packs from `/workspace/games/_downloads` (see section 7).
- The art is unmodified stock Kenney, which portals flag as a "stock look" risk.
- No human playtest has been logged.

## 5. Art pipeline (Blender plus Python)

- **Blender 4.2** (4.2.9 LTS was used), run headless with Cycles on the **CPU**. On the box it lives at `/opt/tools/blender-4.2.9-linux-x64/blender`. **It is not installed on the Mac.** To re-render, install Blender 4.2 LTS from <https://www.blender.org/download/lts/4-2/> (macOS Apple Silicon build). The binary is then `/Applications/Blender.app/Contents/MacOS/Blender`. Other Blender versions may change the shading or the glTF import, so stay on 4.2.
- System Python 3 needs **Pillow** and **numpy** (`pip3 install pillow numpy`). The box used Pillow 13.0.0 and numpy 2.5.4. Blender's bundled Python runs the `bpy` scripts (`scene*.py`, `sprites.py`, `noor.py`, `fern.py`).
- To rebuild **v5** (current), run `prompt-injection/art-v5/tools/render_all.sh` in the background (about 35–45 min on 8 CPU cores). The steps are:
  1. `make_tex_v5.py` builds the textures into `tex/`.
  2. `sprites.py` renders the Noor frames.
  3. `enemy_sprites.py` renders the enemy and Caret frames (`enemies.py`, `anim_table.py`).
  4. `scene5.py room2|room1|room3|castF` renders the rooms and the Fern plate into `render/v5/`.
  5. `pack5.py` builds the atlases, JSON and GIFs into `out/sprites/`.
  6. `post5.py room2|room1|room3` produces the mocks plus the overlap QA (it prints `QA <room> OK`).
  7. `cast5.py` produces the cast sheet and palette.
- `rig5.py` is the shared actor light rig. It is light-linked so room lights never touch actors, which keeps sprites and mocks shaded identically. `noor.py`, `fern.py`, `enemies.py` and `rig5.py` are loaded with `exec(open(...).read())`. Samples stay low (sprites 16–24, rooms 48) with OIDN denoise.
- v4 is rebuilt with `prompt-injection/art-v4/tools/render_all.sh` (about 12–15 min). Its steps are `make_tex_v4.py`, `sprites.py`, `scene4.py`, `pack.py`, `post4.py room` / `room1`, and `cast4.py`.
- `noor.py` builds Noor on top of Kenney `character-female-d`, and `fern.py` builds the Fern hologram. `test_noor.py` is a quick single-render check.
- **The v4 and v5 pipelines need these packs from `_downloads/`:** `mini-characters/Models/GLB format/`, `furniture-kit/Models/GLTF format/`, and `ui-pack/Font/Kenney Future.ttf` plus `Kenney Future Narrow.ttf`.
- `art-v4/tools/post.py` (and its copy in `art-v5/tools/`) is a copy of the v2 post helpers. v4 only imports `bloom`, `grade` and `vignette` from it, and v5 only imports `bloom` and `vignette`. Its `A2` path, which points at art-v2, is used only by v2's own post functions.

## 6. Raw asset packs (`_downloads/`, not on the Mac)

`_downloads/` is about 1 GB, mostly the Quaternius zips, so it was not synced. Re-download the packs you need into `games/_downloads/` and unzip each into the folder named below. They are all CC0 1.0 unless noted. Check each pack's licence file again after downloading.

| Folder in `_downloads/` | Pack | Download from | Used by |
|---|---|---|---|
| `mini-characters/` | Kenney Mini Characters 1.0 | <https://kenney.nl/assets/mini-characters> | Prompt Injection art v2–v5 (Noor, Fern, Dez) |
| `furniture-kit/` | Kenney Furniture Kit 2.0 | <https://kenney.nl/assets/furniture-kit> | Prompt Injection, all versions |
| `ui-pack/` | Kenney UI Pack 2.0 (also the source of the Kenney Future fonts in `Font/`) | <https://kenney.nl/assets/ui-pack> | All Prompt Injection textures and UI, plus Flipside Drop |
| `physics-assets/` | Kenney Physics Assets | <https://kenney.nl/assets/physics-assets> | Flipside Drop |
| `interface-sounds/` | Kenney Interface Sounds 1.0 | <https://kenney.nl/assets/interface-sounds> | Flipside Drop |
| `tiny-dungeon/` | Kenney Tiny Dungeon 1.0 | <https://kenney.nl/assets/tiny-dungeon> | Dungeon pre-production (`preprod/`) |
| `1-bit-pack/` | Kenney 1-Bit Pack 1.2 | <https://kenney.nl/assets/1-bit-pack> | Dungeon pre-production (lamp, hearts) |
| `quaternius/knight/` | Quaternius LowPoly Animated Knight | <https://opengameart.org/content/lowpoly-animated-knight> | `preprod/`, Prompt Injection v1 |
| `quaternius/monsters/` | Quaternius LowPoly Animated Monsters | <https://opengameart.org/content/lowpoly-animated-monsters> | `preprod/`, Prompt Injection v1 |
| `quaternius/ubc/` | Quaternius Universal Base Characters [Standard] | <https://quaternius.itch.io/universal-base-characters> (info: <https://quaternius.com/packs/universalbasecharacters.html>) | `preprod/`, Prompt Injection v1 |
| `quaternius/ual/` | Quaternius Universal Animation Library [Standard] | <https://quaternius.itch.io/universal-animation-library> | `preprod/`, Prompt Injection v1 |
| `quaternius/outfits/` | Quaternius Modular Character Outfits – Fantasy [Standard] (about 280 MB; the free Standard zip only, **not** the paid Source version) | <https://quaternius.itch.io/modular-character-outfits-fantasy> | `preprod/`, Prompt Injection v1 |
| `itch/0x72/` | 0x72 DungeonTileset II v1.7 (CC0 per the itch.io page; no licence file in the zip) | <https://0x72.itch.io/dungeontileset-ii> | Comparison only |
| `itch/ts_free`, `ts_old_cc0`, `RPGMCharacter_v1.0`, `zerie_free` | Pixel Frog Tiny Swords, Szadi RPG character, Zerie Tiny RPG demo | itch.io | **Compared and rejected** (licence or zero-spend reasons). Do not use |

The `_downloads/*.html` and `ck_*.txt` files are leftover download-page and cookie files and are not needed. Kenney zips come from the "Download" button on each asset page; choosing $0 is fine.

## 7. Hard-coded `/workspace` paths in the scripts (change these on the Mac)

The scripts were written for the box and use absolute paths. They will not run on the Mac until these are changed.

| Path in the scripts | Where | Change to |
|---|---|---|
| `/workspace/games/...` | Nearly every `.py` in `prompt-injection/art-v2/tools`, `art-v3-hybrid/tools`, `art-v4/tools`, `art-v5/tools` (all v5 scripts except `anim_table.py`, `rig5.py`, `render_all.sh`; v4: `noor.py`, `fern.py`, `scene4.py`, `sprites.py`, `make_tex_v4.py`, `post.py`, `post4.py`, `cast4.py`, `pack.py`, `palette_h.py`, `test_noor.py`); `prompt-injection/preprod/build_pi*.py`; `preprod/build*.py`; `preprod/render/render_all_hd.sh`; `physics-puzzle/scripts/build-atlas.py`; `physics-puzzle/tests/_probe.mjs` | The absolute path of your `games/` folder on the Mac |
| `/opt/tools/blender-4.2.9-linux-x64/blender` | `art-v4/tools/render_all.sh` (`B=`), `art-v5/tools/render_all.sh` (`B=`, or set `BLENDER=`), `preprod/render/render_all_hd.sh`, and the art-v3-hybrid README | `/Applications/Blender.app/Contents/MacOS/Blender` |
| `/tmp/dbg.py`, `/tmp/noor_test.png`, `/tmp/probe<N>.png` | Debug hooks; `dbg.py` only runs when `DBG=1` is set | Leave them, or point them at a local folder |

The variable names to look for are `V4`, `T`, `T4`, `TX`, `TX4`, `FK`, `MC`, `KF`, `KFN`, `A2`, `V3`, `D`, `OUT`, `P` and `HD`. `post4.py`, `cast4.py` and `pack.py` already work out some paths relative to `__file__`, but they still use absolute font paths.

To change everything in one go on macOS (BSD sed), run this from the `games/` folder after committing or backing it up:
```bash
GAMES="$(pwd)"
grep -rl --include='*.py' --include='*.sh' --include='*.mjs' --exclude-dir=node_modules '/workspace/games' . \
  | xargs sed -i '' "s|/workspace/games|$GAMES|g"
grep -rl --include='*.sh' '/opt/tools/blender-4.2.9-linux-x64/blender' . \
  | xargs sed -i '' "s|/opt/tools/blender-4.2.9-linux-x64/blender|/Applications/Blender.app/Contents/MacOS/Blender|g"
```
A better long-term fix is to make the scripts read the `GAMES_ROOT` and `BLENDER` environment variables, falling back to paths relative to `__file__`.

## 8. Conventions to keep
- Keep each project's `CREDITS.md` and `/licenses` folder current from day one, and record the tool and model for any AI-assisted work.
- Every build must work offline with relative paths. Keep the download under 50 MB (under 20 MB for the CrazyGames mobile homepage).
- Use headless Playwright playtests with screenshots on desktop and mobile landscape, and require zero console errors.
- Art outputs go in `out/`, regenerable intermediates in `render/`, generated textures in `tex/`, and scripts in `tools/`.
- **Levels stay calm and clean** (see the calm-level art rule in section 3). Run the `post5.py` overlap QA on every new mock.

## 9. Prompt Injection playable build (Phase 1, session 1 of 3, 2 Nov 2026)
- Game: `prompt-injection/game/` (Phaser 4 + TS + Vite). `npm run dev` / `build` / `playtest`. Read `prompt-injection/game/README.md` for what is done, what is stubbed and the session 2 list.
- Design source of truth for the game: `docs/story/` (`phase-1-levels.md`, `phase-1-script.md`, `noor-combat.md`, `enemies.md`, `phase-1-systems.md`, `phase-1-after-hours.md`).
- Assets are copied into `game/public/assets/` and logged in `game/CREDITS.md`.
- Word presentation (LOCKED 2 Nov 2026, supersedes the mounted signs and the floor text): the hybrid. Normal view = subtitle captions with tappable word chips (E); hold READ = full code vision (A); 2 lens-only secrets (D). Spec + every caption line: `docs/story/phase-1-levels.md` "Presentation". Code: `game/src/words.ts` (captions, code view, lens), `game/src/plate.ts` (plates as data). Mocks that led here: `prompt-injection/mock-words/`.
- Session 2 (2 Nov 2026): the full Draft boss (`game/src/boss.ts`), SELECT / CUT-PASTE / REWRITE / FERN ROOT, the archive crack signs, skippable cutscenes and synth SFX. The playtest has 75 checks. Session 3 is real room art plus audio and polish. See `game/README.md`.

### Session 3: art-v7 room plates, Noor dash + TYPE combo
- `prompt-injection/art-v7/` is a copy of the v6 pipeline. v6 itself is untouched.
- Rooms:
  - `tools/rooms7.py`: six rooms built from the game's screen layout via `unproj`.
  - `tools/scene7.py`: renders them, e.g. `STATE=lit NOTILES=1 blender -b --python scene7.py -- R7_corridor_lit ../render/rooms 1280 720 64`. Batch run: `/tmp/rr.sh` logic.
  - `tools/post7.py`: grade, fg overlays from the index pass, `out/rooms/layout7.json`, and QA images in `out/rooms/qa`.
  - `tools/sync_game.py`: copies everything into the game and writes `src/roomart.ts`.
- Noor:
  - `tools/noor7.py` renders dash/type1/type2/type3 (run with `LEAN=-1`).
  - `tools/pack7.py` packs them into `out/sprites` (sheets + GIF previews).

### Session 4 (2 Nov 2026): hybrid word system + art weak spots (art-v7b)
- Words: `game/src/words.ts`. Plates have `cap`, `code`, `val`, `redact` and kind `secret` in `rooms.ts`. Touch buttons moved up to clear the caption bar (`controls.ts` BTN + `tests/helpers.mjs` btnPos). Playtest: 85 checks.
- Office rebuilt with storytelling props (lift, printer with a jammed sheet, kitchenette, bookcase, half-erased whiteboard, coat rack, cables, meeting nook, boxes, Noor's cleared desk with one small potted fern left behind). Hub: broken/faint grid, mirror pane, reversed clock, mirrored ghost desks, a rendered glass door panel (fg `door_panel`, hidden in the clean plate via `FGHIDE=door_panel`).
- Archive: the bridge is its own hinged chunky deck with rails and chains; `BRIDGEANIM=8` renders `R7_bridge_00..07` (up → down); the game flips frames with a thud. Archive plates are now only `H`/`L`.
- Foreground overlays come from per-group alpha passes (`FGPASS=1`, anti-aliased) instead of index cut-outs. post7 also writes `<room>_code.jpg` (code-vision plates).
- Dark corridor: the old code-drawn darkness overlay is gone; the rendered dark plate shows, and the lit plate appears only through a soft light mask around Noor (`drawLitMask`).
- Noor dash: bun lumps, flyaways, pencil and face locks are regrouped under pivots in `noor7.py` and rotated per dash frame (trail in the burst, overshoot + settle in the skid). Run `HAIRSIGN=-1 LEAN=-1 blender -b --python noor7.py -- dash ../render/sprites 24`, then `pack7.py`.
- FX: jab = caret stab flash + glyph sparks; slash = arc ribbon with the word streaming along it; enemies get a white hit pop + squash.
- Batch renders: `/tmp/rr8.sh` and `/tmp/rr9.sh` (not kept); the commands are in this section and in `art-v7/tools/scene7.py`.

## 10. Session 5 (2 Nov 2026): weak-spot pass + "linger" layer (art-v8)
- **Caption bar:** the world camera is letterboxed above the bar (viewport 1113x626, zoom 626/720, centred; thin pillars). HUD/caption objects (scrollFactor 0) are routed to a full-screen `ui` camera every `prerender` (`GameScene.setupCameras`). Use `toWorld()/toScreen()` for pointer maths. Applies to every room.
- **Hub:** calmer plate (grid emission 0.02, ghost desks/static motes/floor dial removed), coral focal spot on the door. Two plates `hub_shut` / `hub_open`; open crossfades to a plate rendered without the coral light, so the pink floor reflection is gone.
- **Corridor:** the cyan floor bars were baked ptile emissive quads in rooms7.py, now removed; warm pools at x 640/1000 when lit.
- **Hair:** noor dash re-rendered with HAIRAMP 1.45 plus in-game additive hair echoes (`hairEcho`, cropped head region, warm tint).
- **Code-vision Noor:** `art/tools/wire8.py` makes `noor_*_wire` sheets with the same frame JSON, so the ghost stays in sync with animation.
- **Linger layer:** `game/src/linger.ts` (content), `art/tools/rooms8.py` (props + ambient loops, AMBPASS in scene7.py, strips via post7/sync_game → `RoomArt.amb`). Save fields `looked, lines, visits, idle, toys`. Lines are in docs/story/phase-1-levels.md "Linger layer".
- **Render:** `art/tools/render_rooms8.sh` (about 7 min at 64 samples), then `npm run build && npm run playtest` (127 checks, including the `linger` block; `ONLY_LINGER=1 node tests/playtest.mjs` runs just that block). Kill any stale `vite preview` on :4175 first, or the test runs against old dist.

## 11. Session 6 — art-v9 office (test level)
- Office only: `game/src/office9.ts` (ViewMap homography, DirectorCam: establish/play/inspect/close/noor, letterbox, reduce-motion in pause menu), layered Blender 3/4 render (`art/tools/office9.py`, `post9.py` → `game/public/assets/office9/`, `src/office9art.ts`).
- Gameplay stays in logical coords; `prerender` re-projects. `?v8` falls back to the old office.
- Inspect close-ups with code-vision crossfade; swaps re-light the room (toys/flip/claim variants); Noor gaze/idles/surprise; unread count, glitch, Draft glimpse; lingering is never punished.
- Global fixes: 2-line caption wrap, 11:48 in establishing title, hub shaft glow, bigger moth/drip/duck, mobile safe-area HUD, strict idle test.
- Playtest: 163/163 (`ONLY_V9=1` for office9 block). GIFs: `game/screenshots/v9-*.gif`.
- Known weak: hub band still dark in centre (a fg crop sits above the glow), toys crop soft rectangle, tiny Draft glimpse, dark face-down photo close-up, Noor sheets at 38° not 30°.
- Rollout per room: re-render + post9 + anchors + close-ups + reaction sheets (~1 session each).

## 12. Session 7: art-v10 (office feedback pass)
- **Noor full body:** `art/tools/noor10.py`. It renders at the office9 camera elevation (30°) with legs lengthened (`LEG_K` 1.85; hook in `noor.py`, default off). The cardigan stops above the legs. Walk is 12 frames (`LEGAMP` 1.2), feet are snapped to the floor every frame, and a contact shadow is baked in. Packed by `pack10.py`, then `wire8.py`. These sheets now replace Noor in ALL rooms; the other rooms are still 38° art.
- **Walk:** WALK speed is now 200 px/s and the walk plays at 30 fps. The cadence follows the actual ground speed, a stop finishes the step on a planted frame, and turning keeps the stride phase.
- **Camera:** `DirectorCam` uses critically damped springs. The establishing shot is one smoothstep move over 3.4 s; targets are clamped instead of the output, and the letterbox is sub-pixel.
- **Close-ups:** `office9.py closeups()` renders a hero still plus an 18-frame dolly from the exact room-camera crop to the close-up camera. FOV is interpolated, and lights, exposure and DoF ramp up with it. Re-render with `SKIPMAIN=1 PASSES9=close blender -b --python scene7.py -- R9_office ../render/rooms9 1440 810 32` (about 18 min). Then merge `view.close` into the actors JSON (the full-run copy) and run `post9.py`.
- **Game side:** `Office9.cardStep` runs approach (spring to the entry framing, parallax flattened) → fade 0.55 s → dolly 0.9 s (sub-frame crossfade) → still with a slow 3.5% push → the same in reverse.
- **Fixes:**
  - Hub black band: the motes strip was 15488 px wide, over the GPU texture limit. post7/post9 now wrap strips into grids of at most 4096 px.
  - Toys swap is a full-layer crossfade.
  - Hand chip drops back after 12 s or 420 px away.
  - Prompts hide in code vision; the noor.* line sits above her head.
  - Draft glimpse is life-size, pauses mid-window, and sits above the toys layer.
  - Happy rain is fainter and warmer, with a gold floor reflection, and the close-up has a warm grade.
- **Verify:** `node tests/motion10.mjs` records real-time video and cuts clips into `game/screenshots/motion10/`; `node tests/stills10.mjs` writes `screenshots/v10-*.png`.

## 13. Session 8: art-v11 (back to the original office angle)
Decision: the pixel look and the lower office9/v10 camera are dropped. The default office is the original art-v8 plate (with the linger layer) again.
- **Office9 kept behind a flag:** open the game with `?v9` to get the lower-angle office (`game/src/office9.ts` with `legacy=false`, art in `assets/office9/`). Without the flag, `Office9(scene, legacy=true)` drives the old plate. It uses the same director camera, close-up shots, reactions and pressure beats, but none of the v9 layers.
- **Noor:** back to the pre-v10 38° sheets (restored from 3570fdb): walk 12 fps, idle, dash, attacks, hair echo, wire; walk speed 230. The v10 behaviours are kept: animation rate follows speed, she stops on a planted-feet frame, keeps her stride on turns, doesn't slide, and has a contact shadow.
- **Close-ups at the old angle:** `art/tools/office8c.py` (run via `scene7.py -- R8C_office ../render/rooms8c 1280 720 32`, with `SKIPMAIN=1`) renders each hero still plus an 18-frame dolly. The dolly starts from a far, long-lens camera that matches the plate crop exactly, then eases into the close-up lens. `art/tools/post8c.py` grades them (frame 0 is ungraded to match the plate, and the grade ramps in) and writes `game/public/assets/office8c/` and `game/src/office8art.ts`.
- **Shot:** approach (camera zoom up to the plate crop), 0.55 s dissolve, 0.9 s dolly, still with a slow push, then out. On the way out it un-pushes first, swaps to the exact last dolly frame and reverses, which removes the double image. Noor is held as a sprite copy that rides the dolly's zoom factor and fades over the first 40%, and occluders hide only after e > 0.55, so she and the chair no longer pop.
- **Tests:** `npm run playtest` runs the office block against the default (old) office. `V9=1` also runs the v9 block (`ONLY_V9=1 V9=1` runs only those two). Motion clips are in `game/screenshots/motion11/`, stills in `game/screenshots/v11-*.png`.
- **Known weak spots:** Kabir's monitor in the dolly renders its screen and sticky lit, while the plate's screen is blank. That reads as the screen "waking" during the dissolve, but it is a change. With the whole plate in view, the play camera barely moves, so look-ahead is mostly invisible in the old office. Noor is upscaled about 2.8x for the moment before the dissolve.

## 14. art-v11 clarity office (the default office; `?v9` keeps the Office9 test level)
- Code: `game/src/clarity.ts` (class Clarity) owns the office: objective pill, word tags + attached picker, close-up cards, the one-line caption, near-glow, the practice dummy, collision footprints and the `?debug=collision` overlay. `game.ts` builds it for `office` when not `?v9`; `words.ts` `quiet` mode hides the screenplay caption, chips and heading there.
- Camera: fixed, no zoom/push. The whole 1280x720 plate is fitted between the objective bar (y 48) and the caption strip (y 626), zoom 578/720.
- Art: `art/tools/office11.py` (exec'd from scene7.py with O11=1): `SKIPMAIN=1 NOTILES=1 O11=1 blender -b --python scene7.py -- R7_office ../render/rooms11 1280 720 64`, then `python3 art/tools/post11.py`. This writes `game/public/assets/office11/` (fg depth overlays, 10 lift-door frames composited as a delta on the plate, dummy.png) and `game/src/office11art.ts` (O11_PROPS floor polygons, O11_DOOR, O11_DUMMY).
- Collision: Noor's foot is an ellipse (rx 13, ry 5) tested against the prop floor polygons, the dummy and the lift (solid while SHUT). Movement goes through `slide()`: full step, then each axis, then rotated probes, so she slides along edges. Cables are walkable. Depth: overlay depth = baseY, Noor depth = y.
- Attacks (global): tap J/click/TYPE = 3-hit combo, auto-aimed at the nearest enemy (bracket). Hold ≥ 0.22 s then release = typed beam with a charge ring. The drag-a-line select is removed.
- Noor idle (global): a single held frame with a breathing scale. The old idle frames 1–3 swayed her head (the "tilt"). Office9 look reactions are removed.
- Tests: `tests/office11.mjs` (in `npm run playtest`; `ONLY_V11=1` runs it alone). Real-speed clips: `node tests/motion12.mjs` → `game/screenshots/motion12/`.
- Next: give the other rooms the same footprint collision and depth pass (they still use the old rects), and make enemies solid outside the office.

## 15. art-v12 Noor attack set (PREVIEW only, not wired into game/src)
- Kept the 38° art-v7/v8 Noor style: `art/tools/noor12.py` is `noor7.py`'s exact camera/lights/rig (Kenney `character-female-d` via `noor.py`, `rig5.py`) with new anims: `combo1` jab, `combo2` cross-body swipe, `combo3` spinning finisher, `peel`, `throw`, `charge_in` + `charge_hold` (loop) + `release`. 8 directions, no props (blade / keys / shards removed).
- Arms are posed by direction (`D(forward, outward, up)` in torso space → bone quaternion), smears are 7 accumulated sub-frame renders under a solid final pose, hair pivots + a cardigan-hem Hook modifier follow a damped spring (overlap / follow-through), a paw emissive + point light makes the charge glow, two finger nubs do the pinch.
- `pack12.py` → `art/out/sprites12/` (+ `noor_attacks12.json`: dur_ms, hit/release/pinch/peel events, hit-stop, smear frames, root-motion step, chain window, paw position per frame per dir) and `mock-attack/assets/`. Sheets ≤ 2112 px wide. `closeups12.py` → `mock-attack/closeups/`.
- Raw frames (`art/render/sprites12/*.png`, 59 MB) are NOT committed, only `meta12.json`; re-render with `blender -b --python art/tools/noor12.py -- all art/render/sprites12 24` (~70 min).
- Preview: `mock-attack/` (README has the timing table and weak spots). To wire in: add the sheets to `boot.ts SHEETS`, play with per-frame `dur_ms`, apply `hitstop_ms` to Noor + target, move Noor by `step_px*0.78`, spawn words/beam at `hand[dir][k]`.
- Beam v2 (art-v12b): `noor12.py` new charge_in/charge_hold/release (braced stance `wide`, arm scale `sr/sl`, hair/coat `blow`, N/S `CHEAT` 40 deg, no smears); FX are canvas in `mock-attack/index.html` (`beamShot`, `chargeFX`, `beamFX`). Render only those: `CHEAT='{"N": 40, "S": 40}' blender -b --python art/tools/noor12.py -- charge_in,charge_hold,release art/render/sprites12 24` (~6 min), then `pack12.py`, `closeups12.py`.

## 16. Close-combat design + office greybox (9 Nov 2026)
- Phase 1 combat is **close combat**: 3-hit combo, dash, diegetic peel/throw, short-range beam finisher. Drag-line SELECT and hold-0.22s beam spam are out.
- Full numbers + **transform matrix**: **`docs/design/combat.md`**.
- **No text on creatures (locked):** enemies and the dummy show material by look (chrome / glossy pen / ink tangle / metal plate). Words come only from world surfaces (PAPER, SLOW, WET, GLASS). A throw physically morphs the foe (~0.3 s). Throw is **F / THROW** (tap a carried glyph to arm); J / TYPE never auto-throws.
- **Greybox:** `?combat=1` (`&tune=1` optional). Code: `game/src/combat/greybox.ts`. Clips: `game/screenshots/combat-greybox/`. Tests: `ONLY_COMBAT=1 npm run playtest`.
- Next: owner playtest, then Sticky Swarm + Eraser Brute greybox. No new Blender until signed off.

## 17. Viewport fill + WASD unstick (9 Nov 2026)
- **WASD stuck:** if Noor's feet overlap a desk footprint (bad checkpoint / knock-in), `slide` could not escape and she looked frozen. `unstick()` now pushes to the nearest free cell each frame and after spawn; WASD/arrows are keyboard-captured. Regression covered in `office11` playtest.
- **Empty side margins:** clarity + setupCameras no longer letterbox the room with side pillars. World camera is **full width** in the band above the caption (zoom 1 / cover); HUD overlays. Check stills in `game/screenshots/fit/`.

## 18. Steal-qualities preview mock (9 Nov 2026)
- Playtest rejected code-vision READ + hovering word tags (too much text / confusing).
- Approved direction preview: **`mock-steal/`** — physical object states, E take / F throw / J attack, no words on objects or enemies. Clip `mock-steal/flow.mp4` + stills. Not wired into `game/src` yet.
- Owner liked the idea but called v1 animation/FX sloppy → v2 Blender window→door beat (see §19).

## 19. Steal-qualities v2 window→door beat (9 Nov 2026)
- Scope: **only** the window→door teach beat (~8.2 s), Blender-rendered main elements. Cooler / Scribble left for later. No `game/src` wiring.
- Outputs: `mock-steal/v2/beat.mp4`, `beat.gif`, `compare.mp4` (v1 vs v2), `stills/` (6 key + pull/throw 2× close-ups).
- Pipeline: `noor12.py` new `pull` + `hurl` plans (E,N @ 24 spp) → `art/render/steal_noor/`; `steal_props.py` + `steal_ribbon3.py` → chains/padlock/curtains/rain/ribbon in `art/render/steal_props/`; `compose_steal_v2.py` layers onto clarity `office.jpg` + `office11` lift frames. Camera push-in / shake / glow = code glue only.
- Cost: Noor ~28 s; props+ribbon fix passes ~1 min total CPU Cycles; composite ~30 s. Did **not** re-render unrelated office sheets. Sheets ≤ 640 px.
- Weak spots: ribbon **flight** still flatter than wrap (bezier stamps); curtains are composited sheets not in-scene cloth; slow-mo is timing+zoom not subframe re-renders. Judge quality from `v2/beat.mp4` + stills before any gameplay rewrite.

## 20. Steal-qualities v3 window→door beat (9 Nov 2026)
- v2 rejected: messy/pasted chains, curtain style mismatch, solid white ribbon, back-facing pull, snap too fast/small.
- **v3:** in-scene chains+blinds via `STEALV3=1` → `art/tools/steal_v3_office.py` (hooked from `scene7.py`); feather-blend onto clarity plate; `noor12` `pull_side` (S, CHEAT 0) + `hurl` (SW); thin gust code glue; ~0.2 s snap hit-stop + door push-in.
- Outputs: `mock-steal/v3/beat.mp4`, `beat.gif`, `compare.mp4` (v2 vs v3), stills + pull/throw/snap 2× close-ups.
- Cost: Noor ~12–60 s; office STEALV3 border pass ~2 min @20 spp; compose ~30 s. No unrelated sheet re-renders. Dirty `art/out` / `rnd-pixel` left alone.
- Weak spots: simplified link interlocking; shut blinds not fully opaque; gust is code not volume; claw frames still less readable than rip frames.

## 21j. Dead lift / spark steal (Phaser Impact Lab) — mock-steal/v15
- **Run:** `cd game && npm install && npm run lab` → `/?impact=1`. Hard-refresh if stale. `?debug` for stamp.
- **Isolated** in-memory save. **Old word system OFF** (no READ / chips / pickers / captions).
- **Beat:** flickering desk lamp (near-glow + hold-E glyph) → peel SPARK (lamp dies, crackling orb on hand) → dead call panel pulses + F glyph → jagged lightning zap → big impact → panel lives green, lift powers, doors open. Optional panel-cover Matter debris. No chain/padlock / no window wind.
- **Camera:** Phaser Scale.ENVELOP fills the browser (cover, no letterbox). Lab uses follow cam at 2× clamped to the room; normal play keeps a static full-plate cam so word tags stay on-screen. Edge pads prevent black void. HUD on uiCam.
- **Onboarding:** generic `OnboardLure` (any source/target): source acts on its own, near-glow + key glyph, target pulses while carrying. Fern dialogue hints the lamp.
- Verify: `node tests/verify_steal.mjs` → `mock-steal/v15/`. Modules: `game/src/impact/*`.


## 21i. mock-steal/v12 — full Blender beat (stop canvas composite)
- Danishpreet killed the PIL canvas-composite path ("looks so bad"; wants it to feel like how games handle breaking/hitting). **`mock-steal/v12/`** is ONE Eevee scene: mini office set + noor12 rig throw + chunky chain/padlock + in-scene wind blobs + spark mesh + hit-stop + flat sil frames from the same scene + punch cam + door recoil→open.
- Script: `art/tools/steal_beat_v12.py` → `art/render/steal_beat_v12/frames/` + `.blend`. Deliverables: beat.mp4 / gif / compare (v11 vs v12) / impact strip / `10-impact-1x`.
- Render: Blender 4.2 Eevee Next, 960×540, 24fps, ~111 frames, TAA 24, bloom + motion blur, AgX. Break trajectories are **in-scene keyed ballistic** (live RB torus chains were unstable); still 3D objects in one scene — no PIL paste.
- Weak spots: mini set is block-out grey (not the clarity plate fidelity); Noor often cropped at frame edge; wind is sphere blobs not a true ribbon volume; chain links don't interlock through handles; sil pass is flat emission override (not a proper holdout layer); not live RB.
- Game carry: **superseded by §21j** (live Phaser Impact Lab). Keep v12 as reference art only — do not bring back canvas compositing, and do not port to Unity/Godot.

## 21h. mock-steal/v11 — silhouette impact SHOT (fix v10 framing)
- **`mock-steal/v11/`** beat / gif / compare (**v10 vs v11**) / stills + 8-frame impact strip + `10-impact-1x`.
- Keeps v10 colour post-flash. Silhouette reframed as a readable SHOT: authored Noor throw follow-through (bun + extended arm) staged right of door, real door mask (frame / two leaves / handles / seam), bold gust trail hand→lock, chain/lock white-hot with thin dark outline, spark ~0.7× Noor height (asymmetric spikes), anime invert flicker (frame1 black-on-warm / frame2 white-on-black). Punch-zoom only on colour-return (not during sil). Debris rim/specular + authored open shackle overlay. Compose: `art/tools/compose_steal_v11.py`. Masks in `art/render/steal_break_v9/door_sil_mask.png` + `noor_throw_sil.png`. `impact_system.py` gains invert mode + gust_trail + chain outline.
- Weak spots: Noor sil is authored (3D hurl sheets are high-angle busts and don't read at 1×); sil staging cheats Noor right of the door (world pose overlaps the plate); settled debris + open shackle still subtle on dark carpet at 1×; strip frame 3 is a tight punch crop by design.

## 21g. mock-steal/v10 — clean-mask impact (fix v9)
- **`mock-steal/v10/`** beat / gif / compare (v9 vs v10) / stills + 8-frame impact strip + `10-impact-1x`.
- Clean alpha-mask silhouettes (Noor + door + chain/lock only); 2 sil + 1 colour-return @24fps; asymmetric directional spark; door-scaled chain (≤ handles); fixed-scale chunky debris with floor contact shadows; no grey HUD boxes / no threshold noise. Compose: `art/tools/compose_steal_v10.py`. Spec + `impact_system.py` updated.
- Weak spots: door sil is a rounded rect; padlock body can read dark-grey at 1×; settled debris blends into dark floor.

## 21f. mock-steal/v9 — impact overhaul (heavy tier)
- Spec: `docs/design/impact-spec.md`. Reusable tiers in `art/tools/impact_system.py` (light/heavy/big).
- **`mock-steal/v9/`** beat / gif / compare (v8 vs v9) / stills + 8-frame `impact-*-2x` strip + `10-impact-1x`.
- Chunky Blender chain/padlock break passes (`art/tools/steal_break_rb.py` → `art/render/steal_break_v9/`); soft-shaded wind (no stroke stacks); silhouette impact frames + thick hit-spark; 2.5× punch-zoom + directional shake; bare office door (no baked outline icons / no grey HUD box). Compose: `art/tools/compose_steal_v9.py`.
- Weak spots: authored ballistic not live RB; wind not true volume; procedural silhouettes; door-flex plate dropped (read as grey box).

## 21e. mock-steal/v8 — throw path + heavy chain-break impact
- **`mock-steal/v8/`** beat / gif / compare (v7 vs v8) / stills. Clean shallow throw arc hand→`DOOR_CHAIN` (no plant detour; path QA `bad_increase=0`); SW/S 3/4 throw + smear; longer rip→carry bridge.
- **Heavy impact:** hit-stop freeze on chain hit; lock/chain flash; directional speed lines; strong shake; **no radial floor rings**. Chain taut→whip→snap; links + padlock with gravity/spin/bounce; door recoil then open; debris/dust + gust splash. Lock door-scale, in-scene style.
- Stills include `05-throw`, `close-throw-2x`, `throw-path-strip`, `break-01..06-2x` + `break-sequence-strip`. Compose: `art/tools/compose_steal_v8.py`. Noor sheets reused from `art/render/steal_noor_v7/` → `steal_noor_v8/`.
- Weak spots: break pieces are canvas overlays (not Blender debris); freeze is wall-clock; padlock bounce tuned for readability.

## 21d. mock-steal/v7 — streak gust, path, throw, lift fix
- **`mock-steal/v7/`** beat / gif / compare (v6 vs v7). Directional tapering wind streaks (no atom rings); collision-safe path; SE-cheat throw + smear; lift frames pasted at O11_DOOR; soft spill. Compose: `art/tools/compose_steal_v7.py`. Hurl sheets in `art/render/steal_noor_v7/`.

## 21c. mock-steal/v6 — living lure + smooth steal
- **`mock-steal/v6/`** beat / gif / compare (v5 vs v6) / stills. No window blur-box; living window lure + door rattle; denser Noor keys in `art/render/steal_noor_v6/`; ~2× eased cam; no quality captions. Compose: `art/tools/compose_steal_v6.py`.

## 21b. mock-steal/v5 — animated take/throw preview
- **`mock-steal/v5/`** beat.mp4 / gif / compare (v4 vs v5) / stills. Keyframed Noor pull/carry/hurl in `art/render/steal_noor_v5/`; living OPEN gust; **no radial spider rings**; local object impacts only. Reuses v4 lock + v3 blinds plates. Compose: `art/tools/compose_steal_v5.py`.
- Noor plans expanded in `art/tools/noor12.py` (`pull_side` 16f, `carry` loop, `hurl` 14f).

## 21a. Story: power rewrite (steal qualities)
- Draft for owner read: **`docs/story/power-rewrite.md`**. How/why Noor peels descriptions; Phase 1 room beats; Draft; echo seeding; retired READ/captions. No code change yet.
- Design rules + full Phase 1 room flow: **`docs/design/power-rules.md`** (compatibility, one-held, Undo, enemy counters, edge cases, loophole checklist). Open questions in power-rewrite §8 still deferred.

## 21. Steal-qualities v4 (9 Nov 2026)
- v3 feedback: lock looked like scattered blobs / too big; wind too faint without hits.
- **v4 lock:** in-scene tidy horizontal chain across door seam + normal padlock (bright rim metal) + red LED by keypad (`STEALV4=1` → `steal_v4_office.py`). Not oversized.
- **v4 FX:** brighter gust streaks/droplets; anime impact frames at window rip + door hit (anticipation, hit-stop, invert/punch/white flash, radial speed lines, shockwave, shake).
- Keeps v3 blinds, `pull_side` S, snap+door open. Outputs `mock-steal/v4/` (+ compare v3 vs v4).
- Weak spots: padlock still small at game scale (by design); simplified link mesh; impact flashes are canvas not relit Blender.
