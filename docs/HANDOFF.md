# HANDOFF

## 2026-11-27 — Caret-first order, E takes / R reads, card lighting, Caret outline, STILL contrast, card ghosts

Danishpreet playtested `a0c084a` (Noor near the clock, Caret in, card reading GUARD IS QUICK with GUARD selected): "if I send my cursor then I can't take words using E, I have to take words first", and "the letters on the floor also show take using E ... reading letters needs a separate key binding". He also agreed to fix the four card weak spots from the last pass.

**1. Both orders work.** Hold E at the clock takes STILL while the Caret is in the guard (it stays on its word), then ← → pick QUICK and F throws. No code path blocked the take with the Caret in, so the fix targets what a player meets on the way:
- ↑ / ↓ arrows now walk while the Caret is inside (only ← / → steer it; WASD always walked). Before, an arrow-key player was frozen once the Caret went in and could never reach the clock.
- The clock's take reach is 190px (`REACH.c_clock` in `StealPlay.ts`; other sources stay 130px), so the end of the left hall under the clock counts. Before, Noor could stand right under the clock (left hall, y 330) and be ~170px from it.
- Holding E with the Caret in and nothing in reach shows `STILL IS ON THE CLOCK` and cues the clock, instead of doing nothing.
- F with a word in hand while the Caret is in always throws (StealPlay owns F when a word is held; the recall path needs empty hands). Fern's line after the Caret lands now says "Hold E at the clock for STILL. F throws it in." (or "You have STILL. F throws it in.").
- Soft-lock protections unchanged: mash-during-flight, undodgeable open-line throw, bounce home, wrong-word bounce, 1.6s clock heal.

**2. E takes, R reads.** New `read` action on R (`controls.ts`); Fern's root moved from R to G. E only takes (hold) and advances dialogue.
- R reads floor notes (lost lines; chip is now `R READ`), the printed letter, wall notes in steal rooms (Fern's note in the corridor was unreadable before; it now opens on the letter's paper card), office lookables (`R LOOK` / `R READ` chips; `E TAKE LOUD/HOT` stays E), clarity close-ups (`R  look closer`, `R  close`). Note, letter and close-up cards close on R (Esc also closes close-ups); E no longer closes them.
- Lookables and notes no longer claim E, so E at the office lamp/panel is never eaten by a nearby note. The HUD `R  look` hint only shows near a plain lookable; the lamp/panel keep their own E chip.
- Touch keeps one READ button: it reads when something readable is near and otherwise holds to take/talk.
- Updated: prompts (`letter`, `interact`, `root`), the line chip, card hints, Fern's guard line, the pause-menu controls list (take / read / talk / throw / cursor / root G), `game/README.md` controls, `docs/caret.md`. Grepped `src` for every E prompt: the remaining E prompts are takes (lamp, pillar, peel, Caret, `E change` word), dialogue (`E continue`, the dialogue arrow) and legacy hold-E code vision.

**3. Card weak spots.**
- Lighting: the card face is now lit like the paper body (tones sampled from `sentinel.png`): warm key from the right, cool fill from the left, falloff toward the chest, clip occlusion, lamp-lit right edge and shaded left edge. It no longer reads as a cool flat sticker.
- Caret: original pale sprite, scale 0.5 beside the card (was 0.42), with a dark outline (four tinted copies offset 1.2–1.6px, `syncCaretEdge`). Clearly visible at 1x on the pale card.
- STILL: darker teal `rgb(0,60,72)` with a `rgb(0,38,48)` stroke and a heavier underline.
- Dash afterimages are the stand plus a copy of the live card (`StaffCard.ghostImage`), so the ghosts carry the line instead of the old blank head card.

**Tests.** `corridor_softlock.mjs`: 55 earlier checks plus 21 new. K: Caret first, walk with real keys (D, then ↑ which must walk with the Caret in and leave the selection alone), hold E at the clock, arrows pick QUICK, F throws (Caret never recalled before STILL lands), tear, exit. L: Caret first, take from the end of the left hall (reach), F on GUARD bounces (not a recall), retake, QUICK, F, tear, exit. M: E at the switch doesn't read the floor note beside it, E on the note does nothing, R reads it, E doesn't close the card, R does, then the guard flow. `office11.mjs`: `R  look closer`, E near a plain lookable doesn't open its card, R opens / closes. Results: `corridor_softlock` 76/76 (55 + 21 new), full `npm run playtest` 351/351, zero FAIL.

**Hub dash flake fixed.** `hub: dash ... cannot cross the rift` failed intermittently (also on the untouched baseline). Cause: the rift's far-face colliders are 36px tall and a dash step on a slow frame (dt capped at 0.05s × 900px/s) is 45px, so a dash could tunnel through. Noor's per-frame move is now sub-stepped in ≤8px steps (max 12).

**Stills (not in the repo, `/workspace/l11/`):** `l11-caretfirst-hold.png` / `l11-caretfirst-held.png` (2x: Noor at the clock holding E with the Caret in the guard; STILL in hand with the Caret on QUICK), `l11-caretfirst-held-1x-full.png`, `l11-note-R.png` (2x: `R READ` on the floor note beside the switch's `E HOLD TO TAKE`), `l11-note-card-1x-full.png`, `l11-card-states-1x.png` / `l11-card-states-2x.png` (hidden / Caret on QUICK / STILL), `l11-dash-ghost.png`. Scripts: `/workspace/stillscripts/l11_flow.mjs`, `card11.mjs`.

**Weak spots.** At the clock Noor's sprite overlaps the clock face (she stands at the top of the walkable strip). The `F THROW` hint chip sits under Noor and can overlap the card's lower edge when she stands right above the guard. The card's lighting is baked (it does not follow the lamp's flicker or the dark-hall state beyond the room darkness overlay). The Caret's outline is four sprite copies, not a shader. Touch still has one READ button for both read and take.

## 2026-11-26 (d) — The guard's line is printed on its staff ID card

Danishpreet on `a2a548e`: the cream label pasted across the guard's body read as a cheap debug label. He reviewed preview directions A–K, chose C (the line printed on the guard's ID card), asked whether it works for every enemy (yes, as a world rule: every enemy is a staff record and wears an ID card), approved `pv-card-guard.png` and asked for the build.

**What changed.**
- The cream chest strip, its blue selection box and the redacted hint strip are gone, along with the NOOR Text on the head. New `src/staffCard.ts`: `StaffCard` draws the guard's head card as a canvas texture at 4x, shown at 1x (62 x 42 px), as a child of the guard's rig container. It replaces the sentinel's blank head card and is clipped where the pole enters.
- Hidden: ragged ink bars where the words would be. No letters are drawn, and the guard's rig holds zero Text objects (checked).
- Caret in the line: the line prints in two rows (`GUARD IS` / `QUICK`), the selected word is reverse-printed, and the pale Caret (scale 0.42) stands just past the card's right edge on that word's row. Mouse hover uses the card's word boxes.
- STILL lands: STILL re-prints in teal (`rgb(0,70,84)`, darker than the preview for contrast) with a 260 ms print-head wipe and an underline. The card greys its name and leans with the slumping rig (`slumpSentinel` → `card.setLean(a)`).
- Font: Barlow Condensed ExtraBold (OFL-1.1), loaded in `index.html`/`main.ts`, credited in `CREDITS.md` and `game/CREDITS.md`. The Q tail is printed slightly heavier so it reads as Q at 1x.
- Per-enemy config `STAFF_RECORDS[id] = { line, anchor, scale, mount, name, tilt }`; only the guard is built (`mount: 'clip'`).
- Behaviour unchanged: Caret send / select / bounce / recall, no dash while out, all soft-lock protections. `guardWordBox` / `guardLineEnd` now come from the card.

**Tests.** `corridor_softlock.mjs`: the 48 existing checks plus 7 card checks: card parented and hidden as bars with zero rig text; open line printed with GUARD selected; QUICK reverse-printed and the Caret at the card edge clear of the word; STILL re-printed teal with the card leaning; IS selected after a wrong-word bounce; bars back after F and after Q recall. Results: `corridor_softlock` 55/55; full `npm run playtest` 327/327 (zero FAIL). Earlier full runs on this build failed once each on `hub: dash ... cannot cross the rift before the swap` at varying x; the same check also failed on the untouched baseline under load, so it is an existing timing flake, not the card.

**Stills (not in the repo):** `/workspace/l10-card-hidden.png`, `/workspace/l10-card-select.png`, `/workspace/l10-card-still.png` (2x crops around the guard), `/workspace/l10-card-gameplay-1x.png`, plus full frames `/workspace/l10-card-*-full.png`. Still script: `/workspace/stillscripts/card.mjs`.

**Weak spots.** The card face has no scene lighting of its own (baked sheen and edge light only), so it reads a little cleaner than the Blender body. The card is about 1.4x the old blank head card. The Caret is small next to the card at 1x. The other mounts (tape, holder, lanyard) are named in the config but not drawn. The dash afterimages still use the sentinel sprite with its old blank card.

## 2026-11-26 (c) — The Caret picks the word; the original Caret sprite is back

Danishpreet on `3d1a220`: "I took the word, pressed F and the word swap happened, the Caret was not used at all." He approved the redesign and asked for the previous Caret look instead of the cyan one, with one cursor only.

**Flow (corridor guard, `game.ts` + `impact/StealPlay.ts`).**
- Hidden: the guard shows a faint redacted strip (`█████ ██ █████`). No words, no rings.
- F sends the Caret in, `GUARD IS QUICK` types out, and the Caret stands on GUARD with that word highlighted (`caretSel = 0`).
- ←/→ (mouse hover or tap also works) moves it word to word (`caretSelect`). While the Caret is inside, `Controls.steerArrows` stops the arrows from moving Noor; WASD still walks. Steering also works while Fern is talking.
- F with STILL in hand: `StealPlay.compatible` accepts `c_dummy` only when `caretInLine()` and `caretSel === def.slot` (QUICK). GUARD and IS bounce with a floor tag (`GUARD won't take STILL`) and one Fern reason per word, and STILL goes home to the clock through the existing `returnTo` path.
- Recall (`recallCaret`): F with empty hands, Q, or Esc (Esc recalls instead of pausing while the Caret is inside). The line hides again: `c_dummy` is visible only while `caretWriting === 'c_dummy'` or STILL has landed.
- Cost (`caretOut()`): no dash while the Caret is flying in or inside. A `CURSOR OUT` tag shows, and Fern explains once. The SPACE dash hint is hidden meanwhile. To keep it fair, the guard's repeat swipe wind-up is 0.5s while the Caret is out (it was 0.20s).
- All soft-lock protections remain (mash during flight, can't-miss throw, bounce returns, clock self-heal).

**Caret visual.** The cyan code-drawn I-beam (`drawCaretMark`, cyan since 11dacf0) now always hides. The original rendered sprite `caret_idle`/`caret_move` (pale I-beam with small eyes, commit 951d156; it was the visible Caret until 6bba1d2 set `willRender = () => false`) renders again. Inside a line it scales to 0.36 and stands on the strip above the selected word. The open-line flash is pale, not cyan. The playtest "one cursor" check now expects exactly one visible sprite and zero marks.

**Fern.** "Arrow keys move your cursor. Put it on QUICK." / "Then take STILL from the clock. F throws it in." The full list, and how this scales to `DOOR IS LOCKED AND LOUD`, is in `docs/caret.md`.

**Tests.** `tests/corridor_softlock.mjs` has ten orders: A–G now pick QUICK with real arrow keys, plus H (wrong word: GUARD then IS bounce, then QUICK), I (recall with F, Q and Esc, then resend) and J (no dash while out, walking works, dash back after recall). Hooks: `__pi.selectWord(i)`, `__pi.recallCaret()`; state `caret.sel/inLine/out`.

**Stills (not in the repo):** `/workspace/l9c-guard-hidden.png`, `/workspace/l9c-caret-select.png`, `/workspace/l9c-guard-still.png`, `/workspace/l9c-fern-teach.png` (and `-2x`).

**Weak spots.** The pale sprite over the pale paper body is lower contrast than the cyan mark was. It reads against the dark wall above the strip, but not strongly. Softlock D (far throw) failed once in three runs: F didn't register and STILL stayed in hand, though a second F works. It didn't reproduce in isolation, so it's probably a load flake. Esc recalling instead of pausing while the Caret is inside may surprise some players.

## 2026-11-26 (b) — Corridor soft lock fixed; time recorder, freeze pose; hub corner/bridge/mirror polish

Danishpreet on `2f7b51c`: "I took the word from the clock, threw it, nothing happened, then the clock has QUICK and I'm stuck." A real soft lock.

**Root cause.** `StealPlay.pickDest` still counted `QUICK`/`STILL` as words that "counter" the guard enemy. If F was pressed while the Caret was still flying in (the line is hidden for ~0.4 s, and a human taps F twice), the held STILL was routed at the *enemy*, not the plate. `applyTo(en:…)` spent it as a hit, `hurtEnemy` made the QUICK guard dodge it, the clock stayed on QUICK (the take had already flipped it), nothing was in hand, and nothing could retake it. Reproduced with real keys (take, F, F within ~120 ms) in `/workspace/stillscripts/softlock.mjs`.

**Fix (`impact/StealPlay.ts`, `game.ts`).**
- `QUICK`/`STILL` no longer target the dummy enemy at all; a dummy that is not STILL is never a valid throw target.
- F while the Caret is travelling is ignored; the word stays in hand.
- With the line open and the Caret in, a throw at STILL always lands on the guard, from any distance. The guard cannot dodge it.
- A throw with no open line bounces: STILL goes back to the clock and Fern says "Its line is shut. Send your cursor in first." (or "Missed. STILL is back on the clock.").
- Recovery (`StealPlay.heal`): clock on QUICK, nothing in hand, guard not STILL → clock resets to STILL after 1.6 s (covers old saves, reloads, hot reload).
- The clock word now looks atomic: while STILL is in hand it shows a faint ghost, QUICK only appears once STILL has landed on the guard.

**Look.** The round wall clock is replaced (patched out of the baked plate, code-drawn on top) by a staff time recorder: split-flap digits that freeze on `11:47` while STILL and race while QUICK, with a card slot and an LED. STILL sits centred under it. QUICK guard: afterimages now trail whole (card and body together, no detached head), and it shivers. STILL landing: white snap, squash, then it sags forward as one piece, desaturated, name card grey, paper flecks and cyan hold lines fall (no rings). Fixed the lean so the NOOR label stays on its card.

**Hub.** Bottom corners of the rift lifted with an additive cold bounce (`hub-rift-corner-lift`); the glass copy now shows head to near the feet (scale ~0.66, playtest "obvious" threshold lowered 0.8 → 0.6); the code-drawn bridge gets edge/end AO, plank joints, and a west side face.

**Playtest.** New suite `tests/corridor_softlock.mjs` (`ONLY_SOFTLOCK=1 npm run playtest`): real key presses for A take→F→F, B Caret→take→throw, C F mashed during Caret flight, D far throw, E throw during a dodge, F bounce→retry, G recovery; each ends with the guard torn and the exit open.

**Stills (not in the repo):** `/workspace/l8c-guard-quick.png`, `/workspace/l8c-guard-still.png`, `/workspace/l8c-clock.png`, `/workspace/l8c-hub-rift.png`, `/workspace/l8c-hub-bridge.png`, `/workspace/l8c-hub-mirror.png`.

## 2026-11-26 — Corridor: name STILL, etch the clock, make QUICK feel quick

Danishpreet playtested the corridor guard on `dfbd5de`. He agreed the remaining rift and mirror weak spots can wait. The new notes: Fern told him to type SLOW, but there is no SLOW in the room, and the dummy was not fast, so QUICK did not make sense.

**Hint.** Every corridor line was checked against the real verbs (hold E to take, F to send the Caret, F to throw). Fern now names STILL, says it is on the clock, and tells you how to use it, in short boxed lines. Nothing tells the player to type, and SLOW is not mentioned. After the Caret opens the line: "GUARD IS QUICK. The clock has STILL." / "Hold E on the clock. Then F to throw STILL at it." While the line is locked, a failed hit is "Send your cursor in first." Once it is open: "Take STILL from the clock." Intro: "Press F. Send your cursor in." After the swap: "It's STILL now. Still paper tears." / "J to strike."

**Clock word.** `STILL` is etched under the stopped clock in the alcove, JetBrains Mono, letter-spaced, cyan (gold after it becomes QUICK), same family as VOID and FLOOR. No mounted plate, no rings. Fern's line cues a short flicker on the glyph.

**QUICK / STILL.** While QUICK, the guard smear-dashes with sentinel afterimages, sidesteps hits and bolts, and makes short lunges that are hard to walk around, still blocking the exit. After STILL lands it eases home, drops its head, greys the NOOR card, and becomes hittable. The chest strip sits left of the alcove door so `GUARD IS QUICK` / `GUARD IS STILL` and the parked Caret stay fully readable.

**Playtest.** New checks: the QUICK guard dodges hits; Fern names STILL on the clock and does not say SLOW; the clock word is etched in the room; STILL freezes the guard. Stills (not in the repo): `/workspace/l7c-fern-hint.png`, `/workspace/l7c-clock-word.png`, `/workspace/l7c-guard-quick.png`, `/workspace/l7c-guard-still.png`.


## 2026-11-26 — Deeper cliff strata + hub glass copy restored

Built on `a6d6776` after Danishpreet approved the next pass and reported that the hub mirror was no longer showing a reflection.

**Rift (`art/tools/rift12.py` → `fg/hub_rift.png`):**
- Extended the far-cliff fractured-rock / broken-floor strata from 6 tiers to 13, readable to about 75–80% of the shaft (`k ≈ 0.84`) before near-black. Blocks get smaller and tighter toward the vanishing point `(640, 392, -6.4)`.
- Cut the ledge protrusion so it reads as a wall dropping away (thin lit top bevels, not shelves). Pushed material fog later (`fog_mid ≈ -4.5`, `fog_end ≈ -6.0`) so the lower tiers stay faintly visible.
- Raised the drifting fog slightly (`hubRift.ts` sheet alpha / colour) so the mist is easier to see, still low-alpha polygons, no circles or rings.

**Mirror:** The delayed glass copy of Noor (`this.refl`) was still being created and the existing state checks passed, but it never painted. Cause: the mid-dash north-wall occlude (`hubNorthOcclude`, depth 200, cropped to `y = 0..248`, added in `11dacf0` and kept through the recent rift work) is a full plate copy that covers the north glass. The copy sat at depth `-997`, behind that overlay. Fix: draw the copy and its glint just in front of the occlude (depths `201` / `202`), still masked to the pane, so mid-dash Noor at `-940` stays hidden behind the wall. New playtest: `hub: glass copy actually paints into the pane` (pixel lum in the left of the glass with the copy on vs off).

**Stills:** `/workspace/l6r-hub-rift.png`, `/workspace/l6r-hub-bridge.png`, `/workspace/l6r-mirror.png`.

## 2026-11-25 (d) — Hub rift middle strata & parallax fog pass

Built on `283b37b` after feedback that the middle span of the pit still read mostly flat black:
- **Middle cliff strata (`art/tools/rift12.py` → `fg/hub_rift.png`):** Added 6 stepped, irregular fractured rock / broken-floor strata ledges + vertical fissure ribs across the full width (`x 80..1200`, `k 0.075..0.605`), lit from above so top bevels catch cool light while undercuts drop into shadow and recede toward `(640, 392, -6.4)` through cold blue-slate fog into near-black.
- **Layered parallax fog (`game/src/hubRift.ts`, `game/src/game.ts`):** Replaced the single fog layer with 3 soft polygonal mist sheets at depths `-956` (`k=0.05`), `-952` (`k=0.11`), and `-944` (`k=0.18`) drifting slowly at different speeds behind falling Noor (`-940`), the south lip (`-932`), and the bridge (`123`), registered in `chasmParallax`.
- **Polish:** Feathered `drawSouthLedgeFloor` (`y 444..500`) to eliminate the `y≈500` seam, dimmed `startPitPapers`, and aligned `RiftSpan` deck seams to the hub's diagonal floor perspective (`vpX=640, vpY=40`).
- **Stills:** `/workspace/l5r-hub-rift.png`, `/workspace/l5r-hub-rift-close-2x.png`, `/workspace/l5r-hub-bridge.png`, `/workspace/l5r-hub-bridge-close-2x.png`.

## 2026-11-25 (c) — Hub rift pitfall depth pass

Danishpreet's and review feedback on `d8eda2b`: the hub rift read like a flat wall of grey horizontal slabs facing the camera rather than a drop.

**Rift (`art/tools/rift12.py`, `game/src/hubRift.ts`, `game/src/game.ts`):**
- Replaced the stacked horizontal slab rows with a true perspective-converging shaft extruded from the exact room rim (`x 80..1200, ny 248, sy 404`) toward a deep vanishing throat (`V = unproj(640, 392, -6.4)`).
- Visible thickness + subtle cool rim light on both broken concrete lips; far cliff face drops away along vertical concrete pilasters that narrow into cold slate fog and near-black abyss.
- Side walls converge steeply inward and fall into shadow beneath the near overhang (`pit` lum ~12.3 vs `northLip` ~92.5, `cliff` ~30.5, `southLip` ~63.2).
- Near south lip renders as its own pass (`fg/hub_rift_south.png`, depth `-932`) over the pit (`fg/hub_rift.png`, depth `-960`) so falling Noor (`-940`) drops behind the near edge.
- Sparse, scale-graded falling concrete chunks + hanging cables; three soft feathered cold fog ribbons drifting slowly across the chasm; falling debris converges slightly toward the vanishing point as it shrinks and fades.
- `RiftSpan` bridge updated with a deeper east underside face (`11 px`) and a two-layer drop shadow cast across the upper cliff wall and down into the abyss.
- Collision, puzzle logic, and all 264 playtest checks remain unchanged and passing (`264/264`).
- Stills: `/workspace/l4r-hub-rift.png`, `/workspace/l4r-hub-rift-close-2x.png`, `/workspace/l4r-hub-bridge.png`, `/workspace/l4r-hub-bridge-close-2x.png`.

## 2026-11-25 (b) — The Caret's job, the corridor guard, Blender chasm, re-rendered corridor

Danishpreet's notes on `6bba1d2`:
- The Caret's purpose was unclear; it just stuck to whatever he shot bolts at.
- The corridor dummy had no reason to exist, and its dialogue was confusing.
- The rift still read as a band, and the bridge looked like stairs.
- The door glow was still painted on the floor, and the sentinel was small and drawn in code.
- The lamp base was a black blob.
- The corridor props didn't belong in the room.

**Caret: one job.** It opens guarded things for writing. Full design in `docs/caret.md`.
- F sends it into a guarded thing (Level 1: the corridor guard, `GUARDED = ['c_dummy']`). The thing's hidden line prints onto it, and the Caret parks at the end of the line until a word lands.
- Words thrown at a locked line bounce off. Bolts and melee never touch the Caret: `caretBoltDest` returns the plain aim point, and the "cursor aims" hint is cut.
- F does nothing at anything else.

**Corridor guard** (`docs/audit/room3.md`):
- It stands in front of the exit, QUICK. It swipes when Noor is close and sidesteps her hits.
- First sight triggers two Fern lines in boxes and the `F  WRITE INTO IT` chip.
- The Caret opens `GUARD IS QUICK`. Take STILL from the stopped clock and throw it in. The STILL guard freezes and tears under the TYPE combo, and the exit opens.
- It is rendered in Blender (`art/tools/sentinel12.py`) at about 150 px tall.
- Every corridor line now goes through a named, portrait box. The floating "IT ISN'T AWAKE." text is gone.

**Corridor props.** The real corridor scene was edited and re-rendered (`rooms7.py` / `rooms8.py`), then graded and mask-merged into `corridor_{dark,lit}{,_bleed}.jpg`, with the original renders kept under `art/render/rooms12c`.
- The lamp is now a fluorescent wall fitting.
- The umbrella, bucket and drip ring, tape, mat and boxes are gone.
- Fern's note is an index card.
- New: blank `[NAME]` staff portraits and an EXIT sign, which has a buzz loop and replaces the old drip loop.

**Hub** (`docs/audit/room2.md`):
- The Blender chasm layer replaces the code band (`art/tools/rift12.py` → `fg/hub_rift.png`).
- The bridge is one solid deck with no rows.
- The lamp plinth is lit, and the door glow is patched out.

**Playtest:** 264/264. New checks:
- the guard's line is hidden at first, and hits on the QUICK guard do nothing;
- a word bounces off the locked line;
- the first-use hint;
- F opens the line;
- a named box speaks at the open-line moment;
- the Caret stays parked until a word lands;
- bolts never move the Caret;
- STILL lands and the Caret comes home;
- the floating "IT ISN'T AWAKE." text is gone;
- the STILL guard tears;
- sending the Caret at a non-guarded thing is refused.

**Weak spots:**
- The chasm is a static render; only the debris moves.
- The guard is one rendered pose; hits and the freeze are code tweens.
- The moth loop over the lamp reads as a pale scrap.
- A painted desk ghost still shows behind the hub lamp.
- The clock is still round.
- The Draft in the arena does not use the Caret yet.

## 2026-11-25 — No door: the rift is the puzzle; one take key; one cursor; corridor sentinel

Danishpreet's notes: E and F could both take power; two cursors on screen; the corridor dummy and UI looked boring; the hub door made no sense when you could dash the rift anywhere; and he couldn't tell the hub lamp was a lamp.

### One take action (E, hold)
- Every take is **hold E** (0.4 s): a word from a source, a word back off a target, and the Caret itself. The first take chip reads `E HOLD TO TAKE`. After the first take it reads `E TAKE`.
- **F never takes or claims.** F throws a held word. With the Caret owned and a foe in range, F sends the Caret at that foe. `caretSendTarget()` only looks at foes now, and `sendCaret()` no longer reads or takes a plate.
- The Caret no longer claims itself when you walk up to it or when the door opens. You hold E at it, like any other take. StealPlay hands E to the Caret while Noor stands at it.

### One cursor
- The second, pale cursor was the `caret_idle` sprite drawn under the code-drawn cyan I-beam in follow mode. The sprite is now only a position/visibility anchor (`willRender → false`). The I-beam is the one Caret on screen, including mid-jump. The cyan `|` glyph that used to blink on a Caret-marked foe is gone too.

### Hub: no door, the rift is the puzzle
- The door panel, its shadow and spill, the door stoop, the old offset bridge stubs and the coral SHUT plate are gone. The room always uses the open plate.
- The far rift face is solid (`dyn.riftL/riftR/riftLane`, y 248–284). Dashing anywhere just stops against it and drops you (UNDO).
- `HERE IS VOID` is etched in flickering letters on a broken stub in the south lip (x 592–688). No floating tag. Before the take, the Caret blinks at the end of the word.
- The floor lamp stands on a painted `FLOOR` stencil (`LAMP ON FLOOR`). Hold E to take FLOOR, then F to throw it at VOID. A FLOOR span writes itself across the lane, tile row by tile row. Only the lane opens (`riftLane` cleared). `onHubSpan()` exempts it from the pit hazard and from void depth sorting. Off the span is still a fall. The lamp is left hovering over a hole, flickering (`LAMP ON VOID`). The swap is the checkpoint, and U / E-peel undoes it.
- Mobile caption drag works the same way: FLOOR onto VOID.
- Rift look: a ragged north underside with hanging chunks and rebar, bites in the south lip with cold top light and cracks, floating slab fragments at a few depths, uneven deep cold shafts, and debris that keeps breaking off the lips and falling out of sight (`src/hubRift.ts`).

### Lamp
- The painted desk lamp overlay (`fg_hub_lamp`) is hidden. In its place is a code-drawn standing floor lamp at (256, 574): weighted base, pole, angled fabric shade lit from inside, a warm cone out of the shade, and a trapezoid floor pool set by the shade (no disc). It has the same E chip as every other source.

### Corridor
- The sentinel dummy is a tailor's form cut from a blank claim template: misregistered sheets, label stubs, redaction bars and staples, on an iron stand. Its head is an empty `[NAME]` form field. When QUICK wakes it, the field fills in with **NOOR** in red ink and the head twitches. Asleep, it tilts slowly. When hit, it staggers back on its stand, the print slips sideways and the paper flares white. It is code-drawn, with no circles. It moved to y 384 so it no longer sits over the wall clock.
- The yellow corner-bracket marks painted into both corridor plates were inpainted out. They read as debug UI.
- All chips and progressive hints share one designed key-cap style: a bevelled cap with a lit top edge, an uppercase letter-spaced verb on a dark glass plate, and a thin hold bar (`ui/InteractChip.ts`). HUD hints render through the same chip, and `text` stays as hidden state for tests.
- The palm "held word" core is a small diamond, not an ellipse.

Stills (not in the repo): `/workspace/l2k-hub-rift(-2x).png` (before the swap, full view), `/workspace/l2k-hub-take(-2x).png` (Caret take, single cursor, hold chip), `/workspace/l2k-hub-lamp(-2x).png`, `/workspace/l2k-hub-owned(-2x).png`, `/workspace/l2k-hub-bridge(-2x).png` (after the swap, crossing), `/workspace/l2k-corridor-dummy(-2x).png`, `/workspace/l2k-corridor-awake(-2x).png`, `/workspace/l2k-corridor-take(-2x).png`.

Playtest adds: no door and a solid far face before the swap; dash at x=300/640/1000 can't cross; walking up to the Caret doesn't claim it; F neither claims the Caret nor takes FLOOR; holding E takes the Caret and FLOOR; exactly one Caret visual; FLOOR→VOID writes the span; you can walk across the span; walking or dashing off the span still falls.

Weak spots: the span reads a little like a ladder from above; the melee slash is still a crescent arc (transient); the north stub and hanging chunks are flat code shapes, not rendered geometry; the painted cyan floor light below the lane (the old door spill) remains; the sentinel is readable but small at 1x.

## 2026-11-24 — Dialogue mash, Esc skip, F throw (office)

Three Level 1 bugs, one pass. Worked in a separate worktree so the audio work on main was not touched.

### 1. Spamming E stacked dialogue boxes

Mashing E during the Fern/Noor office exchange could leave two speaker boxes on screen (a Noor line behind a still-typing Fern line) that then never went away.

Root cause: `finishJob()` started the close tween and scheduled `busy = false; kick()` 200ms later, but it did not cancel leftover `typewrite` / `wait` timers. A late tick could call `wait()` again after `waiting` had been cleared, and a second E then scheduled a second kick. The later kick created a new box while `this.root` was already pointing at the new one, so the previous box was orphaned and never destroyed. `busy` / `waiting` could also desync, leaving a box that E no longer advanced.

Fix: dialogue is a single serialized queue. Each job has a generation id so stale timers cannot finish a later line. Advancing during the close tween is ignored. E is debounced (~120ms). Starting a new box retires any leftover `dlgBox`. There is at most one box on screen; a mash of 30 E presses at 30ms is asserted in playtest.

### 2. Esc did not skip the intro

`handleInput` already skipped on pause, but `finish()` set `playing = false` immediately, before the fade-out `go()` landed. A second Esc (or a retry when the skip was not obvious) opened the pause menu, which pauses Phaser time and froze the skip timers, so the intro never released. Phaser can also miss Escape when the canvas is not focused.

Fix: the intro stays "playing" until `go()` completes, so Esc cannot open the menu mid-skip. A window-level Escape listener sets the pause action as a fallback. Esc also skips any other skippable cutscene; during gameplay it still opens the menu. The existing "Esc to skip" hint is unchanged.

### 3. F no longer threw the lightning bolt in the Level 1 office

`caretKeyF` called `Phaser.Input.Keyboard.JustDown` *before* checking `caretOwned`. JustDown is consumed on the shared F Key object, so ImpactLab / StealPlay never saw the press — even in the office, before the Caret is claimed.

Fix: only call JustDown when the Caret is owned, Noor is not carrying a quality, and a send target is in range. Otherwise F still throws (spark in the office, a held quality later). After the Caret is claimed, F sends the cursor when a plate or target is in range, and throws otherwise. The progressive hint is still `F  throw` while holding a quality, and `F  send the cursor` only when a send target is in range.

Playtest: 250/250. Adds Esc skip reaches gameplay; mash E through the opening exchange (max 1 box, 0 at the end, still at `/workspace/l1-dialog-mash.png`); F in the office fires a bolt projectile.

## 2026-11-24 — Ambience listen-pass (loop seams, office beep, hub howl)

Reviewed the v2 previews with the free, local channel of wolframs/claude-audio-listening-skill (`look_at_audio.py`: spectrogram, waveform, EBU R128). The paid OpenRouter "relay" was not used (needs a key and spend).

Clear problems and fixes (same CC0 sources, no new files to credit):
- Every bed had a broadband click at the 2 s loop-crossfade (amix dropped the tail stream). Loops were remade with equal-power fades and a padded tail so the input never ends mid-mix. Seam zooms in `/workspace/audio-previews-v3/looks/seams/` no longer show the impulse.
- Stronger notch on the office 3.7 kHz toner; a remnant line may still be visible on a spectrogram.
- A wide, shallow dip around 520 Hz on the hub bed and `hub_wind` so the draft howl is less whistle-like.
- Paper and pipe one-shots low-passed further (they were very bright, up to ~15 kHz).
- Message CRT flyback was lowered (high shelf) so the 15 kHz line is less piercing; the electrical rumble still carries the room.
- Message bed is now built from the full 26 s static take, not a 15 s truncated mix.

Re-previews: `/workspace/audio-previews-v3/`.

## 2026-11-24 — Recorded CC0 room ambience (v2)

Follow-up to `f07fcbe`. The procedural WebAudio beds did not read as a real space; they felt synthetic and not eerie enough. The Level 1 ambience was rebuilt around real CC0 field recordings (Freesound, all license pages checked as CC0). No AI audio, no spend.

Each room now has a treated 24 s seamless ogg bed (low-pass, short convolution IR, loop crossfade) at about -22 LUFS, plus a very quiet detuned pad (minor second or tritone) and sparse recorded one-shots with random timing, playback rate and stereo pan. The hub updraft (`hub_wind.ogg`) still swells near the gap; a quiet glass beating-tone rises near the mirror. Rooms crossfade in 1.25 s and duck under dialogue. Rain stays subtle. Dash/hit/bolt stay on the SFX bus. Cheerful UI blips (Kenney `sfx_ui`, rising swap/key/tell synths) were darkened to soft low clicks (`sfx_click.ogg`).

Beds are all under ~280 KB; the whole ambience pack is about 1.6 MB.

Previews (not in the repo): `/workspace/audio-previews-v2/{office,hub,corridor,archive,arena,message}.mp3`, plus `walkthrough.mp3` (~33 s) and `combat-over-office.mp3`. Self-checked with ffmpeg ebur128/spectrum: beds sit near -22 LUFS (previews with spots around -21), no bed clipping; combat stings peak about 15–20 dB above the bed, limiter holding true peak around -1 dBTP.

Full author / URL / license table is in `CREDITS.md`.

## 2026-11-24 — Hub void cleanup + per-room eerie ambience

Part A (`11dacf0`) then Part B (this commit), after `7ce3abe`. Cleanup first, then unique room sound.

### A. Visual cleanup (GB-1)

- **Hub void edges.** The black drop is clipped to the inner walls (`WL=68`–`WR=1212`) so it no longer punches square blocks out past the painted side walls. Side notches are short shadowed recesses, not cut-through squares. The far lip is a recessed dark seam only (`0x152838` / `0x0a141c`) — the leftover pale pipe/duct highlight along y≈240 is gone.
- **Mid-dash occlusion.** Noor mid-void sorts to depth -940. A cropped copy of `bg_hub_shut` / `bg_hub_open` (crop `0,0,1280,HUB_NY`, depth 200, alphas synced with the door fade) occludes her head inside the north door/glass until her feet land. Legs in the shaft stay visible. Hair echoes and the follow-caret hide in the void; dash-trail glyphs clamp to `y >= HUB_NY+10`.
- **Hints.** `caretSend` only appears while `caretMode === 'follow'`, so "F send the cursor" is gone once the Caret is parked. Hint text is clamped to the playfield (x 110–1170, y 40–680) near Noor, never a detached chip at the screen edge.
- **Parked I-beam.** Fill is electric cyan `0x1afff0` with a `0xe8ffff` hot core and the dark outline kept. Blink alpha floors at 0.88 so corridor light cannot mute it.

Review stills (not in the repo):
- void edges: `/workspace/l2j-void-edges-2x.png` (1x `/workspace/l2j-void-edges.png`)
- mid-dash: `/workspace/l2j-gap-dash-2x.png` (1x `/workspace/l2j-gap-dash.png`)
- parked I-beam: `/workspace/l2j-caret-park-2x.png` (1x `/workspace/l2j-caret-park.png`)

### B. Per-room eerie ambience (GB-2)

`game/src/ambience.ts` — original procedural WebAudio (no new samples, no AI audio, no spend). Every Level 1 room has its own bed + drone key/timbre + sparse spots. Rooms crossfade in 1.25s. Ambience uses the music×master bus and ducks to 28% under dialogue, cutscenes, and pause. Spots and combat stay on the SFX bus. Autoplay unlock is installed from boot + game create (first pointer/key resumes the AudioContext). Title and the end-screen return fade ambience to `none` so it does not stack under the office title loop. Rain stays at 0.15 and still ducks under dialogue. Dash is mapped to `sfx_whoosh` at 0.8 so attacks read over the bed.

Room tones (previews in `/workspace/audio-previews/`, ~20s each, plus a ~30s walkthrough):
- **office** — 58 Hz HVAC brown-noise bed, faint fluorescent band, paper/creak/key spots.
- **hub** (Mirror Office) — deeper 46 Hz drone, glass bandpass hum near the pane, updraft/wind that swells near the gap, paper, a glass ping, reversed typing.
- **corridor** — 41 Hz muffled brown hush, clock tick, distant drip, concrete foot, a faint whisper.
- **archive** — 49 Hz damp bed, wet drips, paper, creak, wet footsteps.
- **arena** — 36 Hz tense saw-tinged drone, scrape, tick, reversed typing under the existing *Final Battle* loop.
- **message** — 50 Hz plus a thin 10 kHz CRT hiss, keyboard and reversed type.
- **walkthrough** — office → hub → corridor with 1.25s crossfades.
- **combat-over-office** — office bed with dash+hit stings; stings peak clearly above the bed.

Measured (ffmpeg loudnorm): room beds sit about -23 to -21 LUFS integrated, no clipping. Combat true-peak is several dB above the bed.

Playtest adds: office/hub/corridor/archive ambience id switching, duck/unduck under a dialogue line, and no ambience errors.

### Leftovers / weak spots

- Possible 1px overlay seam on the north deck; a tiny sliver of Noor at the lip mid-dash.
- Overlay `setCrop` works on the jpg plate; Phaser 4 spritesheet `setCrop` on Noor did not (UVs came out inverted), so the occluder is the plate, not a crop on her sprite.
- Aiming the Caret around a true corner is still a straight bolt.
- Alcove warm light is painted art, not a live light.
- Ambience is synthesized, so it will not have the grain of a recorded room; spots are sparse by design (eerie, not noisy) and may feel thin on a first 20s listen.
- Arena still layers the *Final Battle* music over its bed — the bed is quieter so the loop can lead.
- Intro can briefly replay the office music loop on some skip paths; title clears ambience but that loop is unchanged.
- leftover circles (boss tells, qualityShot blooms, typography lens, portraits, motes) as listed in the previous pass — not this cleanup.


## 2026-11-24 — Structural chasm, no telegraph circles, visible parked I-beam

Follow-up to `e386aa9`. The user rejected those stills: the parked dummy sat inside a large translucent red/pink circle (the QUICK dummy's r=95 windup tell), the I-beam didn't read on the cream clipboard, and from spawn/pan the "gap" still looked like a horizontal metal pipe/duct with only a thin black void line.

1. **Chasm is structural, not more trim.** The painted `hub_partition.png` bar (full-width metal duct at y=305, depth 434) was sitting in front of the code-drawn void and hiding it. It is now hidden in-game (the PNG under `art/out` is untouched). A tall black drop is overdrawn so painted mid-band tiles cannot show through. Visible void is ~126px at 1x (target 110–140). The far platform has a flat concrete/office-slab face (horizontal strata + expansion joints, muted cap lip — not a cylinder) under its edge, then the shaft fades to black. The near lip is a short floor-ending edge with a stoop. Dark notches at the left/right walls so the slabs end. Collision widened to `HUB_PIT { x: 80, y: 252, w: 1120, h: 148 }` (y 252–400). Dash time is 0.24s (~216px at 900) so a standing dash from the south lip (~y=430) still clears comfortably. The SHUT door stays on the near slab (open-then-dash). Hub mid-room rail walls were cleared so they don't block the new lip.

2. **No circle / ring / disc / oval telegraphs in the touched combat/UI path.** Replaced with corner ticks (`tellBox`), short strokes, tints/alpha flashes, or chevrons:
   - QUICK dummy windup: coral `fillCircle`/`strokeCircle` r=95 → `tellBox`
   - Scribble windup `fillEllipse` and stuck `strokeCircle` → `tellBox` + two short strokes (hub and greybox)
   - Practice/combo hit blooms (`add.ellipse`) → brief sprite/container alpha flash
   - Redline scrape disc, stun "stars", stapler shield arc + snapwind disc + recover ring → tint, plus marks, chevron, `tellBox`, short strokes
   - OnboardLure source/target glow ellipses → removed (chip only)
   - Plate drop-glow ellipse → short rectangle
   - Code-vision enemy `strokeEllipse` → corner ticks
   - Office-explore ring → rectangle
   - Fern hint floor `pool` disc → short rectangle
   Hit logic (dummy `d < 95`, etc.) is unchanged.

3. **Parked I-beam is a code-drawn cursor.** Dark outline + bright cyan, 10×32 with caps, depth 6200. The pale sprite is hidden while parked so it doesn't wash out on cream paper. `caretMark` is recreated after a room teardown (it used to draw on a destroyed Graphics and vanish after leaving the hub). Blink pulses alpha but never fully hides.

Playtest: 239/239 (hub walk/dash/door/pit lum updated for the wider kill band; corridor aim contracts kept).

Review stills (not in the repo):
- gap from spawn: `/workspace/l2i-gap-spawn-2x.png` (1x `/workspace/l2i-gap-spawn.png`)
- pan at the gap: `/workspace/l2i-gap-pan-2x.png` (1x `/workspace/l2i-gap-pan.png`)
- mid-dash over the void: `/workspace/l2i-gap-dash-2x.png` (1x `/workspace/l2i-gap-dash.png`)
- parked I-beam on the dummy: `/workspace/l2i-caret-park-2x.png` (1x `/workspace/l2i-caret-park.png`)
- bolt reaching the far dummy: `/workspace/l2i-caret-bolt-2x.png` (1x `/workspace/l2i-caret-bolt.png`)

Honest read of spawn + pan: a first-time player should now see two detached floor slabs with a tall empty drop between them, not a pipe painted across the room. The far cap is a muted slab lip rather than a glowing cyan tube.

Leftovers / not replaced (listed, not telegraphs in the hub/corridor beat):
- `boss.ts` ring tells and swipe arc (later arena draft) — still circular
- `qualityShot.ts` wet/hot bloom ellipses and a few tip dots; ImpactLab spark circles
- `words.ts` typography-lens `strokeCircle`/`arc` (code-vision magnifier)
- `clarity.ts` debug `strokeEllipse` overlays
- Dialogue / Fern portrait construction (heads, eyes)
- Environmental: rain/mote `fillCircle` dots, `floor.round` room fills, intro/title/lamp `pool` light discs, Noor contact-shadow ellipse, greybox enemy body art (heads/shadows/droplets), touch `Phaser.Geom.Circle` hit areas
- The "F send the cursor" hint can still appear in the corridor while the caret is already parked
- Mid-dash, Noor's tall sprite already overlaps the far lip before her feet land
- Aiming around a true corner is still a straight bolt to the parked Caret
- Alcove warm light falloff is painted art, not a UI ring


## 2026-11-24 — Raised far platform, I-beam aim, longer dummy shot

Follow-up to `9c6fd4c`. From the full-plate spawn view the chasm still read as a dark mid-room stripe. The caret parked on the dummy sat inside a clipboard crosshair-and-ring. The dummy was next to Noor, so the aimed bolt looked like a melee poke, and an "E take" chip stayed on it during the aim beat.

1. **Far platform sits higher.** The north floor has a raised deck and a tall lit front wall (vertical grooves, a sun line under the cap, shadow at the foot) dropping into a dark void. The south lip is a shorter edge. The SHUT door and a small stoop stay on the near (south) tiled ledge — that is the platform you walk before the dash, so the door was not moved onto the far side. Collision is unchanged (`80, 254, 1120×64`). Visual only.

2. **Parked Caret is a blinking I-beam.** Clipboard target circles are gone (plain text lines). Auto-aim brackets no longer draw once the Caret is owned. The I-beam blinks while parked and is drawn in front of the target. Bolt tip/impact were already stroke-based; no new rings.

3. **Dummy is further back.** It now stands at `(1110, 318)`, up the alcove by the clock, so a bolt from the alcove entrance travels a clearly visible distance. The `HOLD J  the cursor aims` hint is prioritized over the generic attack hint and still shows once.

4. **No "E take" during the aim beat.** The steal lure and the lost-line `E take` chip hide while the Caret is traveling, parked, or a beam is winding up / firing.

Playtest: 239/239, including a lit-cliff-over-dark-drop check, parked-caret reach across the alcove, the cursor-aims hint, and hidden E take while aimed.

Review stills (not in the repo):
- gap from spawn: `/workspace/l2h-gap-spawn-2x.png` (full `/workspace/l2h-gap-spawn.png`)
- pan at the gap: `/workspace/l2h-gap-pan-2x.png` (full `/workspace/l2h-gap-pan.png`)
- door / south ledge: `/workspace/l2h-gap-ledge-2x.png` (full `/workspace/l2h-gap-ledge.png`)
- parked I-beam on the dummy: `/workspace/l2h-caret-park-2x.png` (full `/workspace/l2h-caret-park.png`)
- bolt reaching the far dummy: `/workspace/l2h-caret-bolt-2x.png` (full `/workspace/l2h-caret-bolt.png`)

Leftovers: the north face is only as tall as the mid band allows, so from the full plate it can still read as a thick horizontal wall (almost a duct) rather than a deep canyon — the height difference is real but modest. The SHUT door remains on the near ledge, not the far platform, because the beat is open-then-dash. The parked I-beam is a little low-contrast on the cream clipboard. The alcove floor has a warm oval light falloff in the painted art (not a UI ring).

## 2026-11-23 — Real chasm drop, inset caret slit, pan, aim in the corridor

Follow-up to `7a4b140`. The gap still read as a flat band; the bolt tip bloomed a ring; the door box sat on the glass like a sticker; the jump beat stacked an arrival line and the F hint; the opening draft cut "My father lo"; first arrival was a punch-in because the plate camera cannot scroll at zoom 1.

1. **Chasm as a drop.** Visual shaft is taller than the 64px kill band (void and faces extend under both platforms). Lit near-lip face, far-platform underside with shadow, receding inner walls, cold updraft, falling motes/paper, and parallax layers that shift with the camera. Collision is unchanged (`80, 254, 1120×64`).

2. **No rings on the bolt.** Tip and impact use short strokes, not circular blooms. The stray `F throw` chip no longer sits on the door from across the room — it only appears when Noor is near the target.

3. **Door slit is cut in.** The trapped-caret box is a recessed cut in the frosted glass (inner shadow, bevel), not a rounded sticker.

4. **Jump sequence.** Auto-claim waits for dialogue to close. The Caret jumps first; Fern's lines start when it lands; the F hint waits until the box is gone and the Caret is following.

5. **Aim in the corridor.** Once the dummy is QUICK, F can park the Caret on it and hold-J sends the bolt there. The `HOLD J  the cursor aims` hint appears the first time that's possible. No new rings.

6. **Opening draft fits.** The typed line wraps/fits; `forceCursor` locks the typewriter so the full "My father lost everything in the fire." stays on the monitor with the blinking cursor after the message.

7. **Real pan.** First arrival frames Noor at zoom 1.68, pans north to the gap, then eases back to the full plate. Reduce-motion skips the move.

Playtest: 235/235, including draft-fit, pan-to-gap-and-back, and a caret-aimed bolt hitting the woken dummy.

Review stills (not in the repo):
- gap from spawn: `/workspace/l2g-gap-spawn-2x.png` (full `/workspace/l2g-gap-spawn.png`)
- pan at the gap: `/workspace/l2g-gap-pan-2x.png` (full `/workspace/l2g-gap-pan.png`)
- south ledge: `/workspace/l2g-gap-ledge-2x.png` (full `/workspace/l2g-gap-ledge.png`)
- inset door slit: `/workspace/l2g-caret-slit-2x.png` (full `/workspace/l2g-caret-slit.png`)
- jump beat: `/workspace/l2g-caret-jump-2x.png` (full `/workspace/l2g-caret-jump.png`)
- aim in the corridor: `/workspace/l2g-caret-aim-2x.png` (full `/workspace/l2g-caret-aim.png`)
- opening monitor: `/workspace/l2g-caret-intro-2x.png` (full `/workspace/l2g-caret-intro.png`)

Leftovers: the well is still a perspective trick over a 64px kill band, so from a full-plate spawn view it can read shallower than during the pan. Parallax only shows while the camera is moving. The door slit is code-drawn on the painted pane. Aiming around a true corner is still a straight bolt to the parked Caret.


## 2026-11-23 — Deeper chasm, painted lip, Caret origin and hands

Follow-up to `b9a8fb2`. The gap still read as a thin taped trench with a wall-like band under the south lip. The Caret's origin vs Fern still did not land.

1. **Deeper well.** The mid-room chasm is a receding shaft (layered falloff, a dark vanishing well, hanging cables, lights that shrink with depth, paper falling toward the bottom). Lip faces have slab thickness and shadow. Collision is unchanged (`80, 254, 1120×64`) so the door, dash, and copy beats stay put.

2. **Painted lip, not tape.** The yellow hazard dashes are gone. Edges are scuffed metal with a dim cyan edge light, closer to the painted furniture.

3. **South ledge is floor.** The dark band under the south lip (the strip the SHUT door stands on) is painted as walkable tiled floor matching the south grid, fading into the baked floor at y≈436. The chasm lip is clearly that ledge's north edge. Door spill sits on the new floor.

4. **Caret story.** Fern is the voice (screens/holograms only; she cannot touch). The Caret is Noor's hands — where her next word lands — and never speaks. In the opening, a cursor blinks after her typed message; when the AI rewrites the claim, the cursor is left behind. In the hub it is trapped and blinking in a text-box slit in the SHUT door. When she gets close (or the door opens with it still trapped) it jumps to her hand. Fern: "That's yours. It's where your next word goes." / "It took everything you wrote. Not that." The old "It likes you" / "learned from every line I didn't send" lines are gone.

5. **Caret mechanics (two).** F sends the Caret to the nearest word plate or foe in facing range (it travels visibly, then grabs the word). Hold-J beam: the Caret moves to the target first, and the bolt flies to where it sits. Progressive prompts only when first needed (`F  send the cursor`, `HOLD J  the cursor aims`). Room 2 use: grab OPEN from mid-south without walking to the lamp. Existing lamp-to-door swap still works.

6. **Playtest.** Previous 226 plus intro cursor, trapped/jump caret, range-grab OPEN, and a south-ledge floor check. Door-block, dash-gap, copy, and E-advance contracts kept.

Review stills (not in the repo):
- deeper gap from spawn: `/workspace/l2f-gap-spawn-2x.png` (full `/workspace/l2f-gap-spawn.png`)
- gap during the arrival punch-in: `/workspace/l2f-gap-pan-2x.png` (full `/workspace/l2f-gap-pan.png`)
- south ledge as floor: `/workspace/l2f-gap-ledge-2x.png` (full `/workspace/l2f-gap-ledge.png`)
- caret trapped in the door slit: `/workspace/l2f-caret-slit-2x.png` (full `/workspace/l2f-caret-slit.png`)
- caret jumping to her hand: `/workspace/l2f-caret-jump-2x.png` (full `/workspace/l2f-caret-jump.png`)
- caret aiming a bolt: `/workspace/l2f-caret-aim-2x.png` (full `/workspace/l2f-caret-aim.png`)
- caret grabbing a word at range: `/workspace/l2f-caret-grab-2x.png` (full `/workspace/l2f-caret-grab.png`)
- opening cutscene cursor blink: `/workspace/l2f-caret-intro-2x.png` (full `/workspace/l2f-caret-intro.png`)

Leftovers: the well is still only as tall as the mid band (~64px of collision), so depth is a perspective trick, not a wider kill zone. The new ledge tiles are code-drawn to match the painted grid and may seam slightly at y≈436. Caret send range is a facing cone, not a free cursor-drag. Aiming around a true corner still sends the bolt in a straight line to the Caret.


## 2026-11-23 — Stray hint pin, real dash chasm, E advances dialogue

Leftovers from `6b33b7a`: a green leaf-and-triangle icon appeared on the south floor by the left desk; the mid-room dash gap still read as one attached surface (painted rail plus an additive cyan shaft); pressing E did not skip or advance dialogue.

1. **Stray icon.** It was Fern's stuck-hint marker (`hintObj` in `updateHint`), not a pickup or spawn. After `fernStage().hintS` (45s at Sprout, 30s later) with the door still SHUT and nothing in hand, it drew a green ellipse, a fern-pink vein, and a down-triangle over the `h_lamp` plate at (256, 556), bobbing above the lamp's floor glow. The pin is gone. The hint now pulses the target plate and a soft floor pool, and Fern still says "Psst. That one."

2. **Dash gap as two platforms.** The additive teal shaft that sat on the painted rail was removed. A code-drawn chasm covers the mid band: a dark well, visible lip faces and hazard-tape edges on both floors, hanging cables, faint receding lights, looping pit paper, and short broken bridge stubs that are obviously not standable. Collision is unchanged (`80, 254, 1120×64`) and matches the pit; lips stay walkable. The SHUT door and the copy-in-glass beats are untouched. On first arrival, after the entry lines, a short camera pan looks into the gap and a paper sheet drifts down into it before the dash hint appears (once per save, `gap_pan`). Reduce-motion skips the camera move but still drops the paper.

3. **E advances dialogue.** First E completes the typing line and waits; second E advances or closes. This works in cutscenes (even when `scene.busy`), Fern boxes, and the intro claim-mail tab (E still dismisses the mail; later intro lines also advance). The press is consumed so it cannot also inspect, steal, or take a word underneath. `wait()` is idempotent so early-complete cannot double-fire the next line.

4. **Playtest.** 226/226 (216 previous plus claim-mail E, chasm lip/collision, and the two-press E tests — Fern box and cutscene, no inspect underneath). Dummy / DRY / Draft / explore / lost-line / beam / printer / steal / Fern-arrival / one-Fern / copy-seen / box-coverage / glow / door-block / in-pane contracts kept.

Review stills (not in the repo):
- gap from spawn: `/workspace/l2e-gap-spawn-2x.png` (full `/workspace/l2e-gap-spawn.png`)
- gap during the first-arrival pan: `/workspace/l2e-gap-pan-2x.png` (full `/workspace/l2e-gap-pan.png`)
- south desk area, no hint pin: `/workspace/l2e-desk-2x.png` (full `/workspace/l2e-desk.png`)

Leftovers: the chasm is code-drawn over the painted rail, so the hazard tape and stubs are a bit more graphic than the furniture. The well is only as tall as the old mid band (~64px), so it reads as a trench more than a deep shaft. The first-arrival camera move is a short punch-in onto the gap (the 1280×720 plate camera cannot scroll at zoom 1). The stubs are short on purpose so they do not look walkable. The I-beam caret's behavior was left alone this pass — see the room 2 audit for what it currently does. Fern's "When you type, it aims" line is not yet a unique caret mechanic (the typed beam auto-aims on its own); the caret follows Noor and lights a pool in the dark corridor. How she got it, and how it relates to Fern, still needs a later story pass.


## 2026-11-18 — Clip the glass copy to the pane

Leftovers from `2f70f70`: the delayed Noor copy was larger than the north glass and spilled over the frame onto the wall (front and back); the baked lamp disc sat on her head.

1. **Clipped to the pane.** The copy is scaled to fit head-and-shoulders in the inner glass (226, 50, 178×90) and texture-cropped to that rect (geometry mask as a backup). Playtest asserts the visible bounds stay inside the pane for both the front-facing (south, facing the glass) and back-facing copies.

2. **Lamp disc.** The copy sits in the left of the pane so the baked ceiling-light disc is to her right rather than on her face. A flat overlay to hide the disc read as a hole in the glass, so it was left as a room-light reflection in the pane.

3. **Door (cheap).** The SHUT door's floor contact shadow is a little darker and larger.

4. **Playtest.** 216/216 (214 previous plus in-pane asserts for front and back copies). Dummy / DRY / Draft / E / explore / lost-line / beam-hold-release / printer-at-140,250 / steal 700ms / Fern-arrival / one-Fern / copy-seen / box-coverage / glow / door-block contracts kept.

Review stills (not in the repo):
- front-facing copy, clipped to the pane: `/workspace/l2d-copy-front-2x.png` (full `/workspace/l2d-copy-front.png`)
- back-facing copy, clipped to the pane: `/workspace/l2d-copy-back-2x.png` (full `/workspace/l2d-copy-back.png`)

Leftovers: the baked lamp disc still sits just to the right of her bun in the front view (clearer of her head in the back view). The copy is a clipped bust in the pane, not a full-body floor reflection.


## 2026-11-18 — Side box, sharp glass copy, SHUT door depth

Leftovers from `2caff00`: the copy-line box sat in the mid band and covered the gap rails and the top of the SHUT door; the delayed glass copy looked smeared and tilted; the door glass still read as a split pane, and Noor could walk into the threshold with the door drawing over her head.

1. **Side box.** Hub portrait boxes are compact (wrap ~292px, width ~428) and tuck left or right, away from the thing being talked about and always clear of the north glass, the SHUT door, and the gap rails. Name and portrait stay. Playtest: during the south copy line the box does not overlap the glass or the door, and is no wider than 560px.

2. **Sharp glass copy.** The delayed copy is a uniform-scale portrait (no rotation, no squash, no crop smear) masked to the pane, with a light cyan tint. Face and shoulders sit in the glass so she reads as Noor looking out, not a top-down stamp. A north-wall mirror flip (N↔S plus flipX) keeps facing honest. Playtest: scaleX === scaleY, rotation 0, still obvious from the south (alpha ≥ 0.75, scale ≥ 0.8) before Fern speaks.

3. **SHUT door.** The pane was redrawn as a single frost gradient with a soft top glint — no fake split or centre mullion. The door sorts behind anyone on the south floor (depth 250), and its real footprint (293–464) is solid while SHUT so Noor cannot walk into the threshold. Playtest: `canStand(640, 420)` is false, `canStand(640, 530)` is true.

4. **Playtest.** 214/214 (212 previous plus upright-copy and door-block asserts). Dummy / DRY / Draft / E / explore / lost-line / beam-hold-release / printer-at-140,250 / steal 700ms / Fern-arrival walk / one-Fern / copy-seen / box-coverage / glow contracts kept.

Review stills (not in the repo):
- copy line, compact box tucked right, glass and door clear: `/workspace/l2c-copy-box-2x.png` (full `/workspace/l2c-copy-box.png`)
- glass copy, sharp upright Noor: `/workspace/l2c-copy-glass-2x.png` (full `/workspace/l2c-copy-glass.png`)
- SHUT door, Noor at the blocked threshold (in front): `/workspace/l2c-door-2x.png` (full `/workspace/l2c-door.png`)
- SHUT door, Noor a step further back: `/workspace/l2c-door-front-2x.png` (full `/workspace/l2c-door-front.png`)

Leftovers: the baked lamp reflection in the north glass still sits near her hair. The copy is a bust in the pane, not a full-body floor reflection — that is how she stays readable. At the closest legal stand, her tall sprite still covers the lower third of the door, but she is drawn in front and cannot walk through it. The door is still a bit more graphic than the painted room.


## 2026-11-18 — Copy-line box, smaller Fern, deeper door, widows, speech glow

Leftovers from `55633f7`: Fern's top box covered the glass copy; the hologram was oversized; the new door still read as a flat sticker; note cards could leave a short last word alone; "open"/"shut" glowed in ordinary speech.

1. **Box vs topic.** Portrait boxes pick a seat that does not cover the speaker or the thing being talked about. When that object is in the top band (the hub glass copy, etc.), the box sits just below it instead of over it. Playtest: during the south copy line, the box does not overlap the glass pane.

2. **Smaller hologram.** Fern's pot is 76px tall (was 110) and stands closer to Noor (~110px), still readable.

3. **Door depth.** The SHUT door was redrawn with a frame bevel, an inset glass well, a metal handle, a threshold, plus a floor contact shadow and a soft cyan spill that fade with the door. Code-drawn, no AI.

4. **Widows.** Note and letter cards rewrap so a short last word is pulled onto the previous line or takes a partner with it. "the claim." now sits with "the" on the second line.

5. **Speech glow.** Ambiguous quality tokens (`open`, `shut`, `paper`, `glass`, `low`, `high`, `slow`, `weak`, `dry`) only glow when written as ALL-CAPS quality words (`OPEN`, `SHUT`). Distinctive tokens (wet, quick, …) still glow in any case. Tests cover lowercase vs OPEN/SHUT.

6. **Playtest.** 212/212 (209 previous plus box-coverage and two glow asserts). Dummy / DRY / Draft / E / explore / lost-line / beam-hold-release / printer-at-140,250 / steal 700ms / Fern-arrival walk / one-Fern / copy-seen contracts kept.

Review stills (not in the repo):
- copy line, glass clear of the box: `/workspace/l2b-copy-box-2x.png` (full `/workspace/l2b-copy-box.png`)
- smaller hologram (same beat): `/workspace/l2b-holo-2x.png` (full `/workspace/l2b-holo.png`)
- deeper SHUT door: `/workspace/l2b-door-2x.png` (full `/workspace/l2b-door.png`)
- note card, no widow: `/workspace/l2b-note-2x.png` (full `/workspace/l2b-note.png`)
- casual "open"/"shut" unglowed: `/workspace/l2b-glow-casual-2x.png` (full `/workspace/l2b-glow-casual.png`)

Leftovers: the mid-band copy-line box still covers the gap rails and the top of the SHUT door (the glass itself is clear). The door has bevel and a foot shadow, but the glass is still fairly graphic — the mid reflection can read as a split pane — and Noor can overlap the threshold if she stands close. Teaching lines that want "open"/"shut" to glow must write them as OPEN/SHUT.


## 2026-11-18 — Room 2: one Fern, obvious copy, de-duped E, door and title

Danishpreet played `a3eabe5` and asked for a tight room-2 pass: two Ferns on screen, a copy you couldn't see from spawn, stacked E chips, and the coral SHUT / title-card placeholders.

1. **One Fern.** The desk plant is a single `fern_plant` at 0.38 scale. When Fern speaks, that pot hides and only the office-style hologram is up; when the hologram fades, the pot returns. Never both. Playtest asserts this while she speaks, while idle, and during the copy line.

2. **Obvious copy.** From the south the delayed cyan Noor is centered in the north glass, larger (scale ~0.92) and brighter (~0.82–0.96), with a brief additive pane glint when it first appears. Fern's copy line waits until that image has been visible for ~1s (or the player is in range at the glass). New tests cover "visible and obvious before she speaks" and "line waits until seen."

3. **E chips.** The HUD `E  look` prompt no longer stacks on a world chip: lost-line `E take` owns the north glass, and office look/read chips own their spots, so the first calendar hint is a single `E look`. Click-to-attack in the office no longer marks the J hint seen; `didAttack` is only set when an attackable foe is present (live enemy, or a dummy after QUICK). Note and letter cards use a darker `E  close` at 13px.

4. **Door and title (cheap, no AI art).** The coral SHUT slab is a code-drawn dark door with a cyan frame and a frosted slit (`game/public/assets/rooms/fg/hub_door_panel.png`, same 74×161 slot). The room title is a slim top nameplate above the north glass, not a large card over the door.

5. **Playtest.** 209/209 (204 previous plus five hub asserts). Dummy / DRY / Draft / E / explore / lost-line / beam-hold-release / printer-at-140,250 / steal 700ms / Fern-arrival walk contracts kept.

Review stills (not in the repo):
- one Fern speaking (desk pot hidden): `/workspace/l2-fern-speak-2x.png` (full `/workspace/l2-fern-speak.png`)
- one Fern idle (smaller desk pot): `/workspace/l2-fern-idle-2x.png` (full `/workspace/l2-fern-idle.png`)
- copy obvious from the south, with glint: `/workspace/l2-copy-south-2x.png` (full `/workspace/l2-copy-south.png`)
- north glass, only `E take`: `/workspace/l2-e-chips-2x.png` (full `/workspace/l2-e-chips.png`)
- office calendar, one `E look`: `/workspace/l2-office-e-2x.png` (full `/workspace/l2-office-e.png`)
- note card `E  close`: `/workspace/l2-note-close-2x.png` (full `/workspace/l2-note-close.png`)
- new SHUT door: `/workspace/l2-door-2x.png` (full `/workspace/l2-door.png`)
- room nameplate: `/workspace/l2-room-card-2x.png` (full `/workspace/l2-room-card.png`)

Leftovers: when Fern's copy line plays from the south, her top box covers most of the glass copy the line is about (the player already saw it for ~1s). The new door is flatter than the painted room — a solid cyan slit, slightly sticker-like in the gap. The desk plant is a sensible size but still a sprite sitting on a painted desk. A short last word on the note card can still sit alone on a line. Stealable tokens such as "open"/"shut" can still glow in speech.


## 2026-11-17 — Room 2 audit, Fern, caret, copy beat, printer letter

Danishpreet moved on from the office to room 2 (the hub / Mirror Office). His still showed a bottom dialogue box with an empty name and empty portrait ("Stand still long enough and the room starts copying you. It's flattering. It isn't."), a floating I-shaped caret with no explanation, and no visible Fern — he asked if the caret was Fern. Full Playwright audit is in `docs/audit/room2.md`.

1. **Named boxes.** Dialogue boxes never ship an empty name or portrait. `floor` is credited as THE ROOM with a typographic `//` portrait. Floor boxes treat Noor as the speaker so a long line in the lower half flips to the top instead of covering her.

2. **Fern in the hub.** Hub speech rises as the same plant hologram and cone as the office, from the nearest lamp, desk, glass, or table. The empty `body` hologram is gone. The seated cyan typist at her desk is now the `fern_plant` pot sitting on the desk, so she matches the office.

3. **Caret intro.** The cursor stays hidden until the door opens. After the owner-of-the-words exchange, Fern names it: "That's a cursor. It learned from every line I didn't send." / "When you type, it aims. Keep it close in the dark." It fades in as the first of those lines starts. No always-on controls bar.

4. **Copy beat.** Stand still in the hub and a delayed cyan copy of Noor fades into the north glass after ~1.4s, even from the south. At ~3.2s Fern says the copy line (visit 2 keeps the clock line), with her hologram on screen. Once per visit.

5. **Printer letter.** The denial scrap sits to the right of the printer, not under Noor's feet. First time nearby, a contextual `E  read` hint appears. E opens a paper card in the lost-line style (CLAIM #4471, STATUS: DENIED, the rewritten AI lines, Claims Desk). Close with E. Approach at (140, 250) still prints.

6. **Playtest.** 204/204. Dummy / DRY / Draft / E / explore / lost-line / beam-hold-release / printer-at-140,250 / steal 700ms / Fern-arrival walk contracts kept.

Review stills (not in the repo):
- room 2, Fern visible and box filled: `/workspace/l1-hub-fern-2x.png` (full `/workspace/l1-hub-fern.png`)
- caret intro: `/workspace/l1-hub-caret-2x.png` (full `/workspace/l1-hub-caret.png`)
- copy-mechanic beat: `/workspace/l1-hub-copy-2x.png` (full `/workspace/l1-hub-copy.png`)
- printer letter card: `/workspace/l1-printer-letter-2x.png` (full `/workspace/l1-printer-letter.png`)

Leftovers: the first E hint can still sit next to an explore chip (E look / E take) at the north glass line. The coral SHUT plank in the gap and the room card over the north door were left as cheap leftovers. The glass copy is clearer than before but still modest in the pane. Desk Fern is the plant, but she is small on a large desk. Stealable tokens such as "open"/"shut" can still glow in speech.


## 2026-11-17 — Stuck pose, progressive hints, note card, uncovered Fern box

Danishpreet played `4241ffd`: after some dialogue (especially Fern's arrival) Noor stayed locked in an up-facing / shield pose until a dash; the opening controls bar taught attack/throw/dash too early; the lost-line pickup was cluttered; Fern's first box covered her pot when she landed low.

1. **Pose release.** The locomotion hold treated `noor_shield_*` like a combat loop and refused to leave `look` / `shield` / `windup` even after the anim ended, so only a dash (which forces its own sheet) reset her. Movement input now always overrides reaction poses (shield, surprise, look, phone, shadow). Combat loops still hold only while they are playing. Wind-up keeps its last frame only while `windOn` is set. `releaseHeldPose()` plays current-dir idle and is called when dialogue goes idle, when the 1.4s shield timer ends, and from intro `NoorActing` clear/reset. New playtest: after Fern arrival dialogue, Noor is idle with no input, and a direction plays walk within ~100ms.

2. **Progressive hints.** The always-on bottom bar (`WASD move · HOLD E · F throw · J attack · SPACE dash`) is gone. At start only a small `WASD  move` pill sits near Noor and fades after she walks. `E  look`, `F  throw`, `J  attack`, and `SPACE  dash` appear once, when first needed (near an interactable, holding a quality, an attackable enemy, first enemy or the hub gap), persist in `save.tutorials`, and fade after use. J waits until the dummy is awake (`flags.quick`) or a live non-dummy enemy is present, so it does not teach a swing at a dummy that still says "IT ISN'T AWAKE."

3. **Note card.** Lost-line pickup is a single paper card: the quote in IBM Plex Mono, a tiny `n/18`, and a faint `E` to close. No `unsent.txt` label, journal pointer, or stacked caption lore. Gentle rise/fade in and out. The floor `E take` chip hides while the card is up.

4. **Uncovered speaker.** Long portrait boxes flip to the top of the screen when the speaker is in the lower half of the camera. World bubbles treat the speaker's body as an avoid rect and prefer a seat above them when they are low. Fern's first arrival line now sits at the top (box centre y ≈ 88) with the pot fully visible below.

5. **Playtest.** 204/204 (201 previous plus Fern-arrival idle and walk-within-~100ms). Dummy / DRY / Draft / E / explore / lost-line / beam-hold-release / printer-at-140,250 / steal 700ms contracts kept.

Review stills (not in the repo):
- walk after Fern dialogue: `/workspace/l1-walk-after-fern-2x.png` (full `/workspace/l1-walk-after-fern.png`)
- start, move hint only: `/workspace/l1-hint-move-2x.png` (full `/workspace/l1-hint-move.png`)
- first E hint: `/workspace/l1-hint-e-2x.png` (full `/workspace/l1-hint-e.png`)
- first attack hint at the woken dummy: `/workspace/l1-hint-attack-2x.png` (full `/workspace/l1-hint-attack.png`)
- new note card: `/workspace/l1-note-card-2x.png` (full `/workspace/l1-note-card.png`)
- Fern arrival, box uncovered: `/workspace/l1-fern-box-2x.png`, pot crop `/workspace/l1-fern-box-pot-2x.png`, box crop `/workspace/l1-fern-box-ui-2x.png` (full `/workspace/l1-fern-box.png`)

Leftovers: the first E hint sits next to the existing explore chip, so "E look" appears twice. The note card's torn nicks are very subtle, and a short last word ("claim.") can sit alone on the second line; the close `E` is quite faint. The J hint shares the frame with the dummy's `E take` chip. When Noor is very low, Fern still stands more beside than below her (3/4 SW/SE). Stealable tokens such as "open"/"shut" can still glow in speech. Click-to-attack in the office will mark the J hint as seen before the first enemy.


## 2026-11-17 — Arrival facing, quieter wind-up glow, board chip

Leftovers from `5137b16`: at Fern's arrival Noor faced NW, so the shield was mostly the back of her head; the drawn-back hand glow bloomed; the E chip covered the #4412 sticky; the last-frame-hold change had not been re-tested.

1. **Arrival facing.** Fern's hologram now stands south-east or south-west of Noor (150px gap, side stand when she is low in the room) so she looks at the pot, not the lamp or monitor she rose from. The shield is forced to a camera-facing (`S` / `SE` / `SW`) when the source would have turned her away. She steps back from the landing spot so the raised forearm stays clear of the fronds.

2. **Wind-up glow.** The baked hand orb on `noor_windup` is quieter (`glow` 0.32 / 0.18, re-rendered on the same 38° rig). The additive FX is smaller, lower alpha, and warmer (amber, ~28×22) so it still reads without blooming.

3. **Board chip.** The E chip sits just above the board's top edge, left of center (`ox: -48, oy: -52`), clear of the #4412 sticky and the handwriting.

4. **Playtest.** Full suite re-run after these changes and the earlier last-frame-hold, 201/201 (dummy / DRY / Draft / E / explore / lost-line / beam-hold-release / printer-at-140,250 / steal 700ms contracts kept).

Review stills (not in the repo):
- shield at Fern's arrival: `/workspace/l1-fern-charge-2x.png` (full `/workspace/l1-fern-charge.png`)
- wind-up drawn-back: `/workspace/l1-throw-windup-2x.png` (full `/workspace/l1-throw-windup.png`)
- board with chip: `/workspace/l1-board-look-2x.png`, tight crop `/workspace/l1-board-outline-2x.png` (full `/workspace/l1-board-look.png`)

Leftovers: the intro dialogue box can cover the lower half of Fern's pot during the first line. When Noor is very low in the room, Fern has to stand more beside than below her, so the facing is a 3/4 SW/SE rather than dead-on S. The baked orb is still a cool pale light; the warmer tint is mostly the additive FX. Stealable tokens such as "open"/"shut" can still glow in speech.

## 2026-11-17 — Rendered shield and wind-up sheets, tight board outline

Leftovers from `2f99a3b`: the shield pose still read as a head-turn with a code-drawn arm; the throw wind-up arm was orange blobs; the whiteboard cyan outline sat loose around the painted board.

Blender 4.2.9 LTS was already on the box (`/workspace/tools/blender-4.2.9-linux-x64/blender`). New frames went through the existing procedural rig (`art/tools/noor12.py` + `pack13.py`), same 38° ortho camera and lighting as her sheet, 24 samples, all 8 facings. Packed atlases landed only in `game/public/assets/sprites12/` (no writes to dirty `art/out` or `art/render/sprites12`).

1. **Shield-eyes.** `noor_shield` (2 frames: raise, hold). Lean back, forearm raised across the eyes. No CHEAT yaw, so the front view is a bar across the face rather than a turned head. Fern's arrival plays this sheet (typically `noor_shield_NW`) and drops the composited sleeve. The 22px step-back and 110px hologram gap are unchanged.

2. **Wind-up.** `noor_windup` (3 frames in 220ms: coil, arm drawn back with a glowing hand, release flick). N/S keep CHEAT yaw so the arm reads. The code-drawn sleeve is gone. The dust ring and additive hand light stay as FX on top of the rendered hand, using the packed hand offsets. After the release frame, the throw sheet starts at its official release frame so the coil is not played twice. Hold-J still throws immediately.

3. **Whiteboard.** The cyan rounded stroke is fitted to the painted board (center 620, 139, 154×61, corner 3). The soft halo is tighter too. The E chip stays on the board.

Playtest 201/201 (dummy / DRY / Draft / E / explore / lost-line / beam-hold-release / printer-at-140,250 / steal 700ms contracts kept).

Review stills (not in the repo):
- shield + Fern: `/workspace/l1-fern-charge-2x.png` (full `/workspace/l1-fern-charge.png`)
- wind-up coil / drawn-back / release: `/workspace/l1-throw-windup-coil-2x.png`, `/workspace/l1-throw-windup-2x.png`, `/workspace/l1-throw-windup-release-2x.png`, strip `/workspace/l1-throw-windup-strip-2x.png`
- whiteboard outline: `/workspace/l1-board-look-2x.png`, tight crop `/workspace/l1-board-outline-2x.png` (full `/workspace/l1-board-look.png`)

Leftovers: at Fern's arrival facing (NW) you mostly see the back and side of her head, so "forearm across the eyes" is clearer on S/W than on NW; Fern's fronds can still overlap the raised arm a little. The drawn-back hand (baked orb plus the additive light) is bright and can bloom. The coil frame is a milder twist; the readable beat is the drawn-back pose. The board's 5px soft halo still blooms a couple of pixels past the painted edge, and the E chip covers part of the #4412 sticky. Stealable tokens such as "open"/"shut" can still glow in speech.

## 2026-11-17 — Wind-up, mail box, board stand, shield pose, quality words

Playtest of `e9966f9`: the throw wind-up still felt short from the top-down camera; an empty NOOR box sat under the opening claim-mail; Noor covered the whiteboard's lower-left and the glow vanished on the white surface; Fern's arrival used the old surprise pose and could land on Noor; "on", "dead", and "still" still glowed in spoken lines.

1. **Wind-up.** The coil is 220ms (`WIND_MS`). From above: a visible body lean/turn and squash, a composited jacket arm drawn back, a growing hand-light, and a brief dust ring at the feet. `charge_in` plays at 18fps over that window. Hold-J still throws immediately on release (tests unchanged). The steal helper wait is 700ms so 220+80+200 finishes first. Playtest 201/201.

2. **Opening mail vs dialogue.** Dialogue boxes with no visible text stay hidden until the first character lands. While the claim-mail tab is on screen (`intro.mailOpen()`), queued lines are held and no box is shown. Noor's "I didn't write that" plays after the tab dismisses.

3. **Whiteboard.** The look stand is (580, 360), r=85 — clearly below and left of Kabir's desk, not in the wall slot that covered the board. Chip and a pulsing cyan edge glow stay on the board art (~632, 128). No fill glow on the white surface.

4. **Fern arrival.** Noor leans back and a composited shield-arm (jacket sleeve + palm) rises across her face. The hologram is pushed at least 110px from her, and she takes a 22px step back, so the pot does not sit on her.

5. **Quality words.** Spoken-line glow is only for stealable quality tokens (`wet`, `dry`, `quick`, `open`, `shut`, `paper`, `glass`, …). Common English words are out, including `on`, `off`, `up`, `down`, `still`, and non-stealables like `dead`, `water`, `buzzing`.

Review stills (not in the repo):
- wind-up: `/workspace/l1-throw-windup-2x.png`
- intro mail, no empty box: `/workspace/l1-intro-mail-2x.png` (full `/workspace/l1-intro-mail.png`)
- whiteboard look: `/workspace/l1-board-look-2x.png`
- Noor shield + Fern: `/workspace/l1-fern-charge-2x.png`
- Fern line with no false glow: `/workspace/l1-fern-nonglow-2x.png`

Leftovers: the wind-up arm and shield-arm are code-drawn in her jacket/skin colors, simpler than the sprite sheet; from this camera the shield hand sits on/beside the head more than a perfect "palms over the eyes." The gathering light can blend into the sleeve in stills. The board edge glow is a little loose around the painted rectangle. "open"/"shut" and other distinctive stealable tokens can still glow in speech.


## 2026-11-16 — Bolt, board, printer, dialogue follow, reading holds

Playtest of `7acf34f`: the bolt landed light, the wind-up was easy to miss, Noor still covered the whiteboard with the E chip by the coat rack, the printer letter could pop near the lift, dialogue bubbles stayed where they first appeared, Noor's react to Fern's arrival beam felt weak, lost-line toasts vanished too fast, and the rewritten claim-mail tab in the opening cutscene dismissed before it could be read.

1. **Bolt and impact.** The traveling forked bolt is thicker (core + glow + longer branches, a brighter tip) and the impact is a larger flash with longer cone streaks, a panel crack glow, a stronger camera kick and hit-stop, and a slightly hotter screen flash.
2. **Wind-up.** A 130ms coil: squash/crouch, `charge_in` at 28fps, and a gathering hand-light that pops on throw. Held J keeps the coil and light through `charge_hold`. Total wind-up stays in the 120–160ms window; steal throws still resolve under the 450ms test wait (flight 200ms).
3. **Whiteboard.** Look radius is 180 so she can stand below/beside the board without the headphones lookable stealing E. The E chip is pinned on the board itself (offset 18, −18), not by the coat rack or the desk. The board glow is larger and brighter.
4. **Printer.** Auto-print radius dropped from 150 to 95, so a lift stand no longer fires the denial letter. The printer look teleport at (140, 250) still prints.
5. **Dialogue box.** Tighter padding, a speaker-colored accent bar, an E continue hint, and a short open-scale. World bubbles re-anchor to the speaker every frame (tail included) so they travel with Noor or Fern instead of freezing at the first pose. The long bottom portrait box stays a stable screen anchor.
6. **Fern charge / arrival.** When Fern's hologram beam rises from a lamp or monitor, Noor turns toward the source, plays a stable `noor_surprise` pose, and takes one lean-back step. No x-jitter tween.
7. **Lost-line toast.** Hold is `max(4000ms, 60ms × characters)` with the full quote (wrapped). E / tap dismisses early. The toast points at the pause `unsent.txt` journal, which already lists every collected line in full (now word-wrapped).
8. **Opening claim-mail.** The rewritten tab is no longer dismissed at 16.8s. After DENIED lands, it stays up for reading time (`max(4s, 60ms × rewritten characters)`) or until E / tap, with a subtle "E continue" (or "tap to continue") hint, then docks. Beat d still starts at 23s. Playtest skip-intro path is unchanged.

Playtest 201/201 (calendar / printer-at-140,250 / lost-line E / lamp hold / dummy / DRY / Draft / beam-hold-release contracts kept). Board radius was then bumped 145→180 and the chip was pinned on the board (no contract change).

Review stills (not in the repo):
- bolt strip: `/workspace/l1-throw-windup-2x.png`, `/workspace/l1-throw-release-2x.png`, `/workspace/l1-throw-mid-2x.png`, `/workspace/l1-throw-impact-2x.png`, `/workspace/l1-throw-strip.png`
- whiteboard look: `/workspace/l1-board-look-2x.png`
- lift stand, no printer letter: `/workspace/l1-lift-no-letter-2x.png`
- dialogue follow: `/workspace/l1-dialogue-before-2x.png`, `/workspace/l1-dialogue-after-2x.png`; polished Fern box `/workspace/l1-dialogue-fern-box-2x.png`
- Noor during Fern's arrival: `/workspace/l1-fern-charge-2x.png`
- lost-line toast: `/workspace/l1-line-toast-2x.png`
- opening rewritten claim-mail with continue hint: `/workspace/l1-intro-mail-2x.png` (full frame `/workspace/l1-intro-mail.png`)

Leftovers: quality-word styling can still highlight "on" and "dead" in spoken lines. Noor is a tall sprite, so even from a below-left stand she covers the lower-left of the whiteboard; the chip is on the board, but the board glow is still easy to miss on the white surface. The 130ms wind-up (hand light + squash) is short and modest from the north angle; some throw stills also show an E-take chip if the lamp lure is visible. Fern's arrival cone is a soft fill, easy to miss, and her hologram can overlap Noor if she is standing near the lamp. The surprise pose is an existing sheet, not a new shield-eyes animation. The intro mail sits in the right half of the zoomed/panned camera; the "E continue" hint is intentionally subtle.


## 2026-11-16 — Interact chips and shaped throws (no charge rings)

User notes on `0f1d2ba`: a teal hold-ring floated over Noor's head at the whiteboard ("E look"), colliding with the #4412 / sticky-note labels; hold-J drew a fill-circle before a straight glyph beam, which still felt sloppy.

1. **Interact prompts.** The floating hold-ring is gone. Prompts are a small key-cap "E" (or "F") chip plus a verb, placed beside the object and nudged off Noor's head if they would overlap. A soft additive ellipse marks the interactable itself. Look stays a tap (`E look`). Real holds (lamp peel, quality take, optional LOUD/HOT after a look) fill the key-cap and intensify the object glow — no ring. The lift panel stays a tap (`E try`). Lost-line scraps use the same chip (`E take`). The lamp/lift lure uses the same chip instead of `fx_key_e` plus a ring.

2. **Throws and the hold-J attack.** There is no charge circle. The attack animation itself is a three-beat: `noor_charge_in` (or `charge_hold` while J is held) → `noor_throw` at the smear/release frame → throw follow-through. The stolen quality / hold-J shot launches on that release as a forked bolt that *travels* over ~240ms: a crafted zigzag grows from the hand, jitters slightly each frame, and sprouts short branches after the tip has passed, with a dim afterglow trailing it. Impact is a tight cone of streaks plus a small flash (not a 12-point star or a full-screen silhouette), with a short camera shake and hit-stop. Noor turns to face the target before throwing. Damage for hold-J still applies on release so the existing tests stay valid. Other stolen qualities keep their shapes (HOT heat-shimmer, LOUD ripple cone, WET splash arc, other words a compact dart). The held steal orb is a small code-drawn ellipse, not the spark-orb starburst.

Playtest 201/201 (existing E / explore / lost-line / beam-hold-release / dummy / DRY / Draft contracts kept).

Review stills (not in the repo): `/workspace/l1-prompt-board-2x.png`, `/workspace/l1-prompt-lift-2x.png`, `/workspace/l1-throw-windup-2x.png`, `/workspace/l1-throw-release-2x.png`, `/workspace/l1-throw-mid-2x.png`, `/workspace/l1-throw-impact-2x.png`, and the four-beat strip `/workspace/l1-throw-strip.png`.

Leftovers: at the whiteboard, Noor's sprite still covers part of the board because the look radius sits on the wall; the E chip sits by the coat rack, not flush on the board, and the object glow is easy to miss. The printer's denial letter can still appear near the lift (and shows up in the throw stills). The charge_in wind-up is a modest coil, easy to miss if you only glance. The mid-flight bolt is thin, and the impact burst is intentionally small — it can read as light for such a story beat. Camera kick/hit-stop don't show in stills.


## 2026-11-16 — Complaint-bodied enemies

Level 1 attackers are complaints given bodies: paper and ink, never an employee.

- Corridor lamp-on: sticky notes crumple into a toothy Scribble. Fern: "Complaints. People typed so many, they grew teeth." It uncrumples and drifts away; the Paper Dummy is still the fight.
- Paper Dummy is a hanging stack of pages on a stand. It stays inert until QUICK is thrown, then one slow telegraphed swipe. Fern: "J to type. Dash through the swipe."
- Archive: a water cooler yields WET. Thrown at a Scribble it melts (bonus damage, a droop). Fern hints once: "The cooler. Wet paper forgets how to hold a shape." DRY on the ink still cracks for x2 (existing puzzle).
- The Draft is a fanned stack of unsent claim pages (RE: CLAIM #4471), not a grey copy of Noor. Fern's intro: "Every claim reply you rewrote and never sent."
- Defeated enemies uncrumple and drift away as loose paper with a soft rustle.

Playtest 201/201 (corridor birth, cooler WET melt, Fern cooler hint; dummy / DRY / Draft contracts kept).


## 2026-11-16 — Lost lines (3 per room, 18 total)

Optional collectibles: three glowing torn scraps of Noor's unsent writing in each Level 1 room (18 total). They are the same `save.lines` / `unsent.txt` journal path as before, just more of them. A small `lines  n/18` counter sits in the top-right HUD corner at all times (including 0/18, and during the office dead-lift beat). Picking one up toasts `unsent.txt +1 n/18` plus the line. The Level 1 complete screen shows `Lost lines  x/18`. Saved with the game.

The scraps are code-drawn paper (tilted cream slip + a soft pulse), so they stay visible when steal-mode hides word captions. E collects a nearby scrap even while ImpactLab is on; the lift lure hides if a scrap owns E. The arena's original after-draft line (`r_line`) still waits until the Draft falls; the other two arena lines are out on the ring.

Lines are in Noor's voice — messages she wrote and never sent. No echo twist.

Playtest 198/198 (office KeyE pickup + HUD 1/18, linger picks a visible line in every room including two pre-draft arena scraps, end screen x/18). Previous calendar/printer and real-key E path still green.

Leftovers: complaint-bodied enemies (item 7) — done in the next section.


## 2026-11-16 — Office things to explore (look, steal, printer)

Level 1 office lookables, working during the dead-lift beat (the old word-chip linger is off then). Playtest 195/195 (calendar look + printer approach, plus the real-key E path still green).

Tap E at a prompt that says "E  look":
- Dad's photo (on the mug desk; she says she means to put it back on hers): Noor + a worried Fern line.
- The AUGUST calendar: Noor, then Fern hints that August is when the fire happened.
- The whiteboard: code-drawn claim numbers with #4471 circled; Noor recognises his claim.
- Kabir's headphones: a quiet muffled loop when you stand near them; optional HOLD E to peel LOUD and F-throw it at a screen for a jolt.
- The coffee machine: Fern jokes she has opinions about temperature, not hands; optional HOLD E to peel HOT and throw it at the west plant for a steam puff.
- The printer: walking up to it makes it print a CLAIM #4471 denial letter by itself; looking afterwards, Fern says the building is finishing her sentences.

No echo twist. Lines go through the existing dialogue/reaction path. The lift lure hides while a lookable owns E so HOLD E and E look don't stack.

Review stills (not in the repo): `/workspace/l1-look-calendar.png`, `/workspace/l1-look-printer.png`, `/workspace/l1-look-photo.png`, `/workspace/l1-look-board.png`.

Leftovers: none from this pass. The coffee machine look is on the kitchen counter, which is tight against the calendar aisle. Headphones loop is a quiet procedural triad, not a licensed track. The denial letter is a small prop, not a UI sticker.


## 2026-11-16 — Freeze: her words peel off the monitor, not a floating DENIED

The drifting DENIED at beat e felt like a UI sticker and didn't belong. The freeze sound bed is unchanged (boom, drone, ring, heartbeat, crackles, reverse-swell into Fern). Playtest 193/193.

At the freeze, "my father", "please", "reconsider", and "Noor" lift off the desk monitor as glowing letters and hang in the air around her. She leans in, reaches, and touches "my father" — the word ripples with a cyan pulse and a short ring, a hint of the peel to come — then Fern appears as before. The claim-mail still crawls "Please reconsider." into "CLAIM DENIED." at send (beat c); only the freeze word changed.

Review stills (not in the repo): `/workspace/l1-peel-start.png` (and `-crop`), `/workspace/l1-peel-hang-crop.png`, `/workspace/l1-peel-touch-crop.png`.

Leftovers: office explorables (item 5); lost-line collectibles (item 6); complaint-bodied enemies (item 7). The raised-hand read is still the existing handUp pose, not a new reach sheet.


## 2026-11-16 — Lamp steal: light pulls from the shade into a warm orb

User note on the post-`46c4e89` steal (screenshot `/workspace/u6-spark.png`): a flat white starburst sticker sat on Noor's face and did not read as a peel. Playtest 193/193.

Noor turns toward the lamp and reaches. Over ~0.82s the shade's light pulls out as a warm bezier ribbon and glowing particles that curve into her palm. The lamp dims and a dark veil gathers around it. The energy condenses into a small warm orb with an additive bloom and a gentle pulse, held at her hand on the side of the torso — not over her head. Occasional short crackle arcs flick off it. The old `fx_spark_orb` star frames are gone from this beat. The E lure hides while the stream is on screen so it doesn't cover the pull.

Review stills (not in the repo): `/workspace/l1-steal-start-2x.png`, `/workspace/l1-steal-mid-2x.png`, `/workspace/l1-steal-held-2x.png`.

Leftovers: DENIED in the opening (item 4); office explorables (item 5); lost-line collectibles (item 6); complaint-bodied enemies (item 7). The "raise her hand" read is a type pose, not a new reach sheet.


## 2026-11-16 — E always responds, and the J combo is three melee crescents

User notes on `46c4e89` (screenshot `/workspace/u5-e-prompt.png`: a bare E over Noor at the lift). Items 1–2 only in this commit. Playtest 193/193 (two new real-keyboard tests).

1. **E at the lift / lamp.** A tap used to do nothing: unlock required a silent 0.35s hold of E, the lure was a bare `fx_key_e` glyph, and there was no hold-progress feedback. The prompt now says **HOLD E** with a ring that fills while E is down. Tapping E at the dead call panel gives an immediate response: the panel fizzles, Noor says "It's dead.", and that unlocks the lamp (Fern still points at it). A short tap at the lamp that doesn't finish the hold gets a Fern hint ("Hold E. Peel the spark from the lamp."). After the intro, the canvas is focused again so the keyboard isn't left behind by the cutscene. `ImpactLab` no longer calls `ctl.read()` a second time in the same frame (that was eating edge presses). New playtest steps use `page.keyboard.down/up('KeyE')` — not the `openLift` hook — after intro skip: a tap at the panel unlocks the lamp, a hold at the lamp starts the peel.

2. **J combo.** Hit 1 was a caret arrow plus a straight beam line; hit 3 was a typed-character laser. The default combo is now three melee crescents: a quick forehand slash with a smear trail, a reverse backhand crescent on the other side of the body, and a heavier, wider overhead cleave with a short forward lunge. Each blade tapers to thin tips, has a bright leading edge, and fades in ~120ms, with a pose and lunge per hit. The arrow and straight beam are gone from the combo. A short glyph burst still appears on the finisher only, not as a laser. Sparks and hit-stop fire only on contact; light hits use the ImpactFX light tier (no zoom, no full-screen flash). Hold-then-release J still fires the special typed beam, unchanged.

Review stills (not in the repo): `/workspace/l1-e-prompt-2x.png`, `/workspace/l1-e-fizzle.png`, `/workspace/l1-e-hold-ring-2x.png`, `/workspace/l1-combo-hit1-2x.png`, `/workspace/l1-combo-hit2-2x.png`, `/workspace/l1-combo-hit3-2x.png`. Short video of the E path plus the combo: `/workspace/l1-e-combo.webm`. Playwright's recording has no soundtrack.

Leftovers for later commits in this pass: the lamp-steal still reads as a flat white starburst (item 3); DENIED in the opening (item 4); more office explorables (item 5); lost-line collectibles (item 6); complaint-bodied enemies (item 7). Quality-word styling still highlights "dead" in "It's dead."


## 2026-11-16 — Opening feedback on e349ca2 (freeze audio, mail overlap, portrait, blips, Fern reactions)

User notes on `e349ca2`, all five in scope. Playtest 191/191.

1. **Freeze sound design.** The DENIED/freeze hold is no longer silent. Procedural WebAudio in `game/src/voice.ts` (no third-party samples, credited in `CREDITS.md`): a sub-boom and tape-stop when the world freezes, a low drone, a faint high ring, a slow heartbeat, glitchy crackles while DENIED drifts, and a reverse-swell into Fern's arrival. Music still drops out. Metered at default volume: boom peak ~0.18 RMS, then a sustained bed ~0.05–0.07 with heartbeat pulses; not dead air.
2. **Mail vs Noor's first line.** The claim-mail fades at 16.8s, before she says "No, no, no, I didn't write that" at 17.8s. Speech bubbles also get a generic placer: they stay inside the camera view (not just 0–1280) and dodge open screen-space panels. Her first bubble is fully on-screen and clear of the panel.
3. **Fern portrait.** Atlas pivot (0.5, 0.93) was parking the pot mid-frame. The portrait now forces the visual centre of the opaque plant, scaled to fit with even padding. The name plate sits on the text column, not over the art.
4. **Voice blips.** Noor and Fern share the SFX AudioContext. Noor is a warm lower sine+triangle with slight pitch variation and a lowpass, clearly audible (peak ~0.023 RMS while typing). Fern is a brighter bitcrushed square chirp plus noise (peak ~0.021). Default master volume is 1.
5. **Fern reactions.** Bounce + sparkle when she's happy, frond droop when worried, shiver/glitch + "!" when alarmed, a lean toward Noor, and emotes (`!`, `?`, `…`, sparkle). Opening/meeting/room lines are classified from the text. The portrait swaps expression cheaply (wide eyes + O mouth when alarmed, lids when sad).

Also fixed a playtest flake: a 3-hit spark used `window.setTimeout` to `setTexture` after the sprite had been destroyed (`Cannot read properties of undefined (reading 'sys')`).

Review stills (not in the repo): `/workspace/l1-freeze.png`, `/workspace/l1-noor-first-line.png`, `/workspace/l1-fern-portrait.png`, `/workspace/l1-fern-alarmed.png`, `/workspace/l1-fern-happy.png`. Opening video `/workspace/l1-opening.webm` (~78s, through beat g). Playwright's recording has no audio; the freeze still's audible bed is noted above.

Leftovers: quality-word styling still highlights "on" and "dead" in spoken Fern lines. Portrait expressions are overlays, not new art.


## 2026-11-16 — Opening feel pass (Noor, meeting, beam, audio, box, lamp)

Playtest notes on `e075aa2`, all six in scope. Commits: `14da551` Noor acting, `40aee28` meeting, `2e8a57b` beam, `617bcca` audio, `232e1e6` dialogue box, `39259e8` lamp steal.

1. **Noor acting.** During the hook she hesitates before send, leans in at the rewrite, says "No, no, no, I didn't write that" when CLAIM DENIED lands, looks around and pushes her chair back at the blackout and freeze, and startles / steps back when Fern appears. Existing look/surprise sheets plus squash, hops, emotes (`!`, `?`, sweat, `...`).
2. **Meeting.** After Fern's "That send wasn't yours," Noor asks who she is. Fern answers in character (office plant, woke by the same rule, something wrong with the send, lift is dead). 7 lines, mix of bubbles and the bottom box, with reactions between. Camera settles, "Try the lift," then the controls hint. Echo twist unsaid. Skip still jumps to play; no second greet monologue.
3. **Beam.** The thin cyan line is gone. A soft additive cone and a short glitch-pixel dissolve at the source fade out in 0.7s.
4. **Audio.** Rain bed 0.42 → 0.15 (~-9 dB) and ducks to ~32% under dialogue. J swings play Kenney whoosh; hits use `sfx_hit_heavy` on the Phaser bus (the old path was a quiet WebAudio synth with no sample, inaudible under the rain). Procedural crackle for the lamp peel.
5. **Dialogue box.** Inner gradient, drop shadow, speaker glow, name plate with colour + icon, framed ~96px portrait, slightly larger line height. Bubble tails point at the speaker.
6. **Lamp steal.** Under 1.2s: shade flickers and drains, a dark veil around the lamp, arcs crawl to the hand with crackle, a compact orb with bloom gathers, light-tier micro-shake. `openLift` queues the throw until the drain finishes.

Playtest: run after this pass. Review stills and a new opening video (includes the meeting) live under `/workspace/`.

## 2026-11-16 — Office bleed fills the frame (no letterbox pad)

`9f08152` rebuilt `office_bleed.jpg` with `extend_letterbox` (a median-color flat fill). That read as dark bands on the left, right and bottom plus a seam where the plate ended — the letterbox border the user hates.

Fix: same camera (ortho 8.4, pitch 38°, yaw −30°, same centre). Only the 3D set is larger, so real floor, trim and wall fill every edge of the 1280×720 frame. `P_office()` floor is now `floor_rect(-100, 200, 1480, 640)`; the back wall and 8px skirting run `wall_seg(-100, 1380, 200, 230)` / height 8. `post11.py` writes `office_bleed.jpg` as the graded plate itself — no flat pad. Lamp, panel, window and `chair_noor` anchors are unchanged.

Also nudged Dez's paper stack from (412, 402) to (412, 394) and Kabir's headphones from (698, 288) to (696, 280) so both sit clearly inward from the desk front lip.

Playtest: 191/191.

Review stills (not in the repo): `/workspace/l1-office-1440x800.png`, `/workspace/l1-office-1512x945.png` (HUD, heading, room card, dialogue, tags, and Noor/shadow hidden). Opening video `/workspace/l1-opening.webm` (~52.7s, beats a–g).

## 2026-11-16 — Office re-render (approved plate pass)

Blender 4.2.9, Cycles, same camera (ortho 8.4, pitch 38°, yaw −30°). `P_office()` in `rooms7.py` plus a phone-height fix in `rooms8.py`, then a beauty + O11 render and `post11.py` so every `office11/fg` layer and `office_bleed.jpg` are recut from the new graded plate.

What changed in the plate:

- Desk items sit on their desktops at a tighter, consistent paper scale. Dez's stack is inset on the desk (no floor scatter). Kabir's headphones sit on the right of the desktop instead of hanging in the aisle. The mug and face-down photo use the mug desk's own height. The west-pod phone sits on the desktop, visible on the right, not sunk or hidden behind the chair. Noor's fern is on the desktop next to the lamp, not in the knee space.
- The table's near-edge paper is fully on the hex table, beside the laptop (smaller sheets, less jitter). The old printer-aisle stack at z=0 (which read as floating behind desk_podW) now sits on the printer table.
- desk_dez floor papers at ~(468, 448) were removed. They read as stray stickers with no contact. The white sheet near plantFG is the existing lost-line collectible, not that scatter.
- Plant overlays (plantE, plantW, plantFG) use a hard index mask (no MaxFilter blur), cut from the saved `office_bleed.jpg` so opaque Δ vs the game plate is 0 and there is no soft fringe. Other furniture keeps a 1px dilate, still no blur.
- Lift recess, window panes, and the banker-lamp / panel code positions are unchanged (LAMP_SPRITE 154,270 on desk_podW; PANEL 276,167 / PANEL_SPRITE 265,151). Door frames were re-graded against the new plate. `chair_noor` (chair_dez at 966,475) is re-injected by post11 so a regen cannot drop it.
- Night mood kept, slightly richer: amb 40 (was 36), window emit 0.62, rain-light 0.26, main warm spot 420.

post11 grades a fresh `R7_office_clean.png` into `office.jpg` / `office_code.jpg`. The letterbox-extend bleed from this commit was a regression; the following section replaces it with a wider 3D set and a bleed that is the graded plate.

Playtest: 191/191.

Review stills (not in the repo): `/workspace/l1-office-1440x800.png` (ENVELOP, 1440×800; the "THE REAL OFFICE" heading and a leftover greet portrait may be on this still — they are HUD, not plate art), 2x before/after desk crops under `/workspace/l1-props/`, opening video `/workspace/l1-opening.webm` (~52.7s, beats a–g). The 1440 still also includes rain, the green banker lamp, and chair_noor.

Those leftovers (flush Dez stack, Kabir headphones near the front lip, heading/portrait on the 1440 still) are addressed in the bleed-fix section above.


## 2026-11-16 — Desk props audit (2x, no new sprite moves)

A 2x overlay of every `O11_PROPS` sprite against `office_bleed.jpg`: official furniture is already registered (mean Δ 0.3–0.7, best nudge for plantE is 0,0). The only sprite-layer placement fix in this pass remains `chair_noor` (`cf7d597`): Dez's chair in the aisle at (966, 475). The green banker lamp is `lift_lamp_on` at (154, 270), scale 0.92, sitting on desk_podW's top face — it is not baked into the plate, and it is not the 2D Kenney floor-lamp fallback.

Baked-in plate issues (a Blender re-render of the office11 plate + matching `office11/fg` sprites would be required; not started):

- desk_dez floor papers at about (468, 448), south-east of the desk next to the bin — they read as dropped sheets on the floor, baked into the plate (not a floating sprite).
- table near-edge paper, about (600, 620), may slightly overhang the hex table's front; baked into `table.png` / the plate.
- plantE at (1167, 187) 26×35: 6.9% of opaque pixels differ from the plate (soft fringe), alignment already optimal. Same class of fringe on plantW (75, 121, 2.7%) and plantFG (1159, 548, 1.7%).
- Official desks are also drawn as depth-sort overlays that match the plate pixel-for-pixel; they are not visually double-exposed, but a re-render would need to keep that 1:1 crop.

A re-render would use `art/tools/office11.py` (Cycles, same camera) plus `post11.py` to recrop every `office11/fg` layer so they stay registered to a new `office_bleed.jpg`. That is a full office art pass, not a one-desk tweak. Not started.


## 2026-11-16 — Fern is a crisp plant character

Replaced the blurry teal hologram and its rectangular scanline box. Fern is a new crisp vector sprite (PIL, no AI): a potted fern with distinct fronds, two glowing eyes and a mouth, a cyan outline, and scanlines baked inside the silhouette only. Displayed at 110px. No heavy teal tint. A faint ADD beam runs from the source to the pot. From the lamp she now stands in the open floor at (268, 348), clear of the calendar, bookcase and lift; from Noor's monitor she stands at (880, 430), left of the desk. DENIED is already gone before beat f (see previous commit).


## 2026-11-16 — Rain clipped to the glass (fix pass)

GlassRain no longer draws on the wall, the window frame, the mullions, or the office floor. Streaks and droplets are clipped with Liang-Barsky to the three pane interiors (764,78 124×108; 898,78 124×108; 1032,78 124×108). The brown circular "city lights" are gone — they read as stains, and the plate already has baked bokeh. Intro air-rain in the room was removed; during the freeze, hanging drops stay on the glass and only paper hangs in the room. DENIED is cleared before Fern appears in beat f.


## 2026-11-16 — Opening hook (items 6 + 7)

The New-Game intro is a skippable ~52s hook, existing art plus code FX, no new AI art.

(a) Cold open on black: rain bed + key clicks, Noor drafting a claim #4471 reply about her father and the fire ("Please reconsider."). (b) The office fades up; the camera moves from the window across the floor; a lightning strike lights the room. (c) She hits send; "Please reconsider." crawls letter-by-letter, quality-word style, into "CLAIM DENIED."; the other lines glitch into the locked AI lines ("I UNDERSTAND. I'LL HANDLE IT." / "LEAVE IT TO ME, NOOR."). (d) Lights die desk by desk toward her, monitors flicker, the lamp buzzes. (e) Rain and falling paper freeze mid-air, music drops out; only Noor and a drifting DENIED spark still move. (f) Plant-Fern glitches in from her monitor and says "That send wasn't yours." through the new dialogue UI (short bubble, not a typing plant). (g) Hard cut to the office room card, then play. The lamp teach line still follows the card. Esc skips; hold X also skips. Story facts follow `docs/story/phase-1-script.md` (claim #4471, the fire, the AI taking her voice). Dialogue now also ticks during the intro so the hologram can bob.


## 2026-11-16 — Visible window rain

GlassRain is readable at normal zoom: a far layer of thin angled streaks, a near layer of brighter longer streaks, and droplets running down the glass. An occasional lightning flash lights the window and washes the room faintly, with a short rumble and a small camera shake. Ambience is alxl's CC0 *Rain on Window Loop* (`sfx_rain.ogg`), credited in CREDITS.md. Pause still freezes streaks mid-fall for the opening. The office linger test now counts GlassRain + the saver loop (the old Blender rain sheet stays skipped).


## 2026-11-16 — Desk props

Overlay of every `O11_PROPS` sprite against `office_bleed.jpg`: official furniture is already pixel-registered (mean Δ 1–3, ~100% similar). The one real overlap was `chair_noor`, added in the last pass with `chair_kabir.png` at (944, 433), which sat on the desktop and covered the monitor. It is now `chair_dez.png` at (966, 475), in front of the desk, with an updated footprint. Intro seat is 988, 556. No other desk needed a move. Lamp on desk_podW was already seated.


## 2026-11-16 — Dialogue UI

Replaced the flat pink-border rectangle. Dialogue is now a cut-corner terminal panel (dark fill, speaker-coloured stroke) with a name plate sitting on the top edge, 18px IBM Plex Mono body text, padding, and a panel sized to the full wrapped line so words are never clipped. Bubbles have a tail pointing at the speaker and a short open tween; the bottom box keeps a portrait (Noor / plant-Fern / Draft glyph) and a blinking continue arrow. Quality words still glow. Speaker colours: Fern magenta, Noor cyan, the Draft coral.


## 2026-11-16 — Fern hologram is the sticky-note plant

Story (`docs/story/phase-1-script.md`, `phase-1-after-hours.md`): Fern is "a plant made of sticky notes on her desk," not a monitor and not the old `fern_seated` hologram-Noor. There was no full plant-character sprite, so `art/tools/build_fern_plant.py` composites her from existing art: `office_fg_plant.png` (leaves + pot) + `sticky_gm.png` ("good morning" notes) + a leaf-shaped face in the same geometric style. No AI art.

The office projection now uses `fern_plant` (idle loop, ~110px tall): source flickers, the full silhouette rises from it with a soft ADD glow that follows the sprite (no rectangular box), scanlines across the plant, a projection beam, a slight float, and a flicker. She is pushed clear of the lift and the menu.


## 2026-11-16 — Level 1 pass 2 review fixes (seven bugs)

Danishpreet rejected the pass-2 stills. Lean fixes, in the order he listed. Item E still not started.

1. **Opening black voids.** Camera bounds are the 1280×720 plate. Opening zoom is a modest 1.14, panning from a clamped window center (708, 322) across the floor to Noor (700, 398). Each intro frame re-clamps the center so the view never shows the empty canvas. The remaining bottom strip was not a camera void: the WordUI caption bar (`0x02060a` at y=626) stayed visible because intro `update()` returns before `words.update()` can hide it. `setHudVisible(false)` and the steal-path `quiet` flag now hide that bar immediately.
2. **Noor seated.** Added `chair_noor` (reuses `chair_kabir.png` at 944, 433, matching Kabir's desk/chair offset). During the opening she sits at 988, 548, just south of the chair, facing the desk. `unstick` is skipped so the chair poly does not shove her into the aisle. After the fade into play she still starts at the room spawn so WASD is free.
3. **Stacked UI.** Sequence is now: typographic room card → Fern's lamp line → controls hint (`dialogue.onIdle`). Clarity's INT. heading is disabled on the steal path so it does not sit on the card. `greetWhenReady` also waits while the card (or a pending card) is up.
4. **Fern hologram.** Tight runtime crop of `fern_seated`, drawn at ~80px tall, tinted (no additive wash). A light scanline overlay and a small glow sit behind the face. The projection rises just above/beside its source, is pushed clear of the lift recess (140,60,150×155) and the top menu, and is clamped on screen. The bubble sits beside the face, also clamped.
5. **Bottom-box scramble.** The typewriter laid words out from the right (`flip: true`) and then shrank each word with `setText(slice)`, which reversed the visible order. The box now lays out left-to-right; unrevealed words keep their full text and stay hidden, so later words do not move.
6. **Lamp on desk_podW.** It was dimmed to ~0.55 until the panel beat, so the green shade disappeared into the desk. Alpha stays 1 until taken; depth is 400 (above the desk). Flicker and sparks still wait for `unlockLamp`.
7. **Rain.** Fewer, thinner, low-alpha streaks with a slight lean; a few slow droplets on the glass; a soft dark-blue gradient veil and blurred, low-alpha city-light blips. No cyan dashes.

Playtest: full 191 after this pass. Stills and a new opening video recaptured to `/workspace`.


## 2026-11-16 — Level 1 pass 2, item D: office polish

- **Props.** O11 furniture is already registered to the bleed plate (zero pixel offset on every desk/chair). The hanging/overlapping object Danishpreet saw is largely the banker lamp: its shade sat off the back of desk_podW like a floating green dome. Re-seated it onto the desk top (`LAMP_SPRITE` 154,270, scale 0.92; interact point 180,300). Baked desktop clutter (papers, mugs) lives in the plate itself — not re-rendered (no Blender pass; do not touch `art/out`).
- **Rain.** Replaced the old cyan-dash amb sheet with a code-drawn glass overlay (`game/src/rain.ts`): a cool glaze over the window, faint distant streaks, condensation tracks, droplets running down the pane, mullions and a top highlight. Color is matched to the night glass, not the bright sticker rain. Pauses with the opening freeze. Cheaper than a new Blender window.
- **Interaction.** Power rules (C1 / "no steal in the real world" until the lamp teach) mean the first peel must stay the lamp, not a pre-lamp steal. So the lamp is quiet and cannot be taken until Noor tries the dead lift panel (E). The lure starts on the panel; after inspect, Fern says "The lamp. That's the only thing still drawing power," and the lamp flickers and can be peeled as before. `openLift` (playtest) unlocks first so tests stay green. `?impact` lab still starts with the lamp ready.

## 2026-11-16 — Level 1 pass 2, item C: music and SFX

Added CC0 music and a few new SFX (zero spend). Separate Music and SFX sliders in Title → Settings, persisted as `pi.settings.v1` (`music`, `sfx`; legacy `volume` still loads).

- Calm loop (*Insistent* by yd, CC0) for the title, intro, and rooms.
- Tense loop (*The Final Battle* by skrjablin, CC0) in the Draft arena.
- New one-shots: steal (paper), throw (existing Kenney whoosh), door open/close (rubberduck), lift (sinny old elevator door), UI click (switch). All CC0; logged in CREDITS.md with URLs.
- Existing Kenney Interface Sounds stay in use as fallbacks.

### Weak spots
- Crossfade is a hard stop/start, not a long overlap fade.
- No dedicated door hook on every room transition — the lift uses the elevator sample when it opens; other doors can use `door_open` / `door_close` as they get wired.
- *The Final Battle* is more orchestral-epic than "office horror"; it does the job as a tense fight loop.

## 2026-11-16 — Level 1 pass 2, item B: dialogue + Fern hologram

Replaced the top-right Fern sticky (and the office caption shortcut) with a real dialogue system (`game/src/dialogue.ts`, `game/src/voice.ts`).

- Speaker-anchored bubbles with a name tag (NOOR / FERN / THE DRAFT).
- Fern does not live *inside* the tiny office monitors. The nearest monitor or lamp flickers and glitches first, then a **large holographic crop of her existing `fern_seated` head** (runtime canvas, no new art) rises out of that source. The face is scaled up so it is readable above the desk at the current zoom 1 plate — never drawn at the screen's own size. She hops to the nearest source (lamp is preferred when the line mentions the lamp) to stay near Noor. In the hub she already has a body, so the bubble anchors to her sprite instead of a second projection.
- She is visible before typewriter starts.
- Long, floor, papa, or off-screen lines use a bottom box with a portrait, typewriter reveal, and a press-to-continue arrow (Enter or click; auto-advances after the given ms so playtests do not stall).
- Procedural per-letter WebAudio blips: Noor soft sine, Fern glitchy square + noise, the Draft (also `ai`) low sawtooth + crackle. Pitch rises on questions. Angry / all-caps lines shake the box.
- Stealable quality words glow; `cold` frosts, `heavy` drops with a thud, plus simple flicker/wave/dim for the other qualities in `power-rules.md`.
- After the opening, Fern's lamp line waits until the intro has finished, then comes from the lamp.

No recordings, no AI art.

### Weak spots
- Head crop is a tight rectangle from the seated sheet; some of the halo is tight at the top.
- Hologram scanlines are a flat overlay, not a shader.
- Noor / Draft bottom-box portraits are a crop or a procedural glyph, not a dedicated bust.

## 2026-11-16 — Level 1 pass 2, item A: opening scene

Rewrote the New Game intro as a ~48s skippable camera piece in the real office (Esc skips immediately; hold X also skips). Fade in from black on a procedural office hum, slow pan from the rain window across the empty night floor, then settle on Noor at her desk (feet at 995, 615 — south of desk_noor so she no longer sits through the monitor). After a hold, "11:48 PM" fades in, then her line "Rephrase. Again." appears above her (world space, after a beat — no HUD popup). Then a glitch (screen tear, stuttering lights), the world freezes mid-motion (rain and typing pause), a quiet "The office goes still." and a fade into play.

HUD and HP are hidden for the whole cutscene (`setHudVisible(false)`); the old bottom skip bar and top dim band are gone. A faint "Esc to skip" sits in the corner and fades. Fern does not speak or appear here — she is not on screen, and her lamp line waits for the dialogue system (item B). After the fade, the room card and controls hint still play. Labs / `?skipIntro` / Continue are unchanged.

No new shipping art. Hum is WebAudio (no sample).

### Weak spots
- Rain still uses the existing ambient sheet; it may look a bit mechanical until item D.
- The freeze is a pause + veil, not a true mid-particle halt of every tween.
- Opening still and video are recorded after the playtest in this pass.

 — Level 1 step 5: playtest, stills, Continue

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
