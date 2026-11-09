# Steal Qualities — Power Rules + Phase 1 Flow

*Design rules Danishpreet approved. Writing only.*  
*Story spine: `docs/story/power-rewrite.md`. Combat numbers: `docs/design/combat.md`.*  
*The five open questions in `power-rewrite.md` §8 stay **open** — do not resolve them here.*

---

## A. Power rules

### A1. Only inked things shimmer
A quality can be peeled only if the world has been **typed about a lot** — enough for the description to stick as ink. Those objects **shimmer** when Noor is close. Untyped props (blank wall, random chair leg) never shimmer and cannot be taken from.

Shimmer = “this description is loose enough to peel.” Fern, the Caret, and living copies do not shimmer as sources (see A6, A8).

### A2. Compatibility — splash and rebound
A thrown quality only sticks if the target **could plausibly be that way**. Otherwise it **splashes off**, flies back to its **original source**, and the source re-gains it (with a short “snap home” VFX). Noor’s hand empties either way.

**Rule of thumb:** ask “would someone at Ferngate ever have typed this about that?” If no → rebound.

| Quality | Sticks to | Rebounds from (examples) |
|---|---|---|
| **open** | Doors, windows, drawers, exits, lids | Floors, enemies, Fern, blank walls |
| **shut** *(if ever held)* | Same as open | Same |
| **wet / water** | Floors, ink/Scribble, towels (makes them wet), pipes, coolers | Chrome Stapler face (unless softened lore), dry bulbs, Fern |
| **dry** | Wet floors/ink, Sticky Swarm / sticky notes, wet towels | Already-dry walls, doors, Draft |
| **paper** | Metal plate (dummy), chrome (Stapler), glass-adjacent brittle reads | Soft ink-only Scribble is OK (folds); living Fern/Caret no |
| **glass** | Brittle targets (chrome, dummy plate, Redline shell) | Soft sticky notes, water surface |
| **slow** | Moving threats (Redline), clocks, Noor’s own feet only if we later allow self-buffs (**default: no self**) | Static doors, shut windows |
| **still / quick** | Dummies, clocks, simple automata | Doors, Fern |
| **weak** | Draft confidence / paper pillars’ opposite use on Draft | Random furniture with no “strength” story |
| **heavy / light** | Eraser Brute (optional soften), crates | Scribble, Sticky |
| **on / off** | Lamps, switches, emergency strips | Doors (use open), enemies |

**Splash outcome:** quality returns to source; brief hit-stop on Noor (not a damage hit); Fern may mutter once per room if she keeps throwing nonsense.

### A3. Taking removes the quality — side effects
Peeling is not a copy. The source **loses** the quality and the room updates:

| Peel from | Side effect |
|---|---|
| Open window | Window shuts; rain/wind into the room **stops**; wet floor near sill may start drying |
| Wet cooler / pipe | Level drops; puddle shrinks; related “high water” puzzles change |
| On switch / lit strip | Source goes dark |
| Paper scrap / pillar “weak” | Scrap looks blank/torn; that weak is gone until Undo or another source |
| Dry towel | Towel looks damp/useless until Undo |

Every steal is a **plan cost**: you might need that rain, that light, or that weak again. See A5 Undo.

### A4. One held quality
She holds **one** quality at a time. Taking a second while holding one **snaps the first back** to its source (same rebound VFX as splash), then the new one settles in her hand. No stacking in Phase 1.

### A5. Undo — take it back
She can peel a quality **back off a target** she (or the room) applied, if that target still shimmers with it. That restores the prior state and is the **natural puzzle reset**.

Fold into existing death/UNDO fantasy: dying or triggering UNDO also snaps any carried quality home and reverts her last successful throw in the room (checkpoint-safe). Exact save schema TBD in code later; design intent is “you are never soft-locked by a bad throw.”

### A6. Enemies are made of a quality
Throwing the **counter** quality cancels or cracks them. Living copies (Draft) **hold onto** their nature — she cannot casually peel GUARDED/STRONG off the Draft as a free source; she uses **room** qualities against them (A8).

| Enemy | Made of / reads as | Counter throw | Outcome (aligned with `combat.md`) |
|---|---|---|---|
| **Paper Dummy** | Metal plate strapped on (no text) | **paper** or **glass** | Plate strips / shatters; crumples fast |
| **Scribble** | Tangled wet ink | **paper** (fold) or **wet** (ink runs, slow) | Fold to 1 HP or speed cut |
| **Sticky Swarm** | Clingy adhesive (queen carries “sticky”) | **dry** | Cling fails; notes drop |
| **Stapler** | Chrome plating | **paper** or **glass** | Chrome strips or goes brittle |
| **Redline** | Fast charge / glossy pen line | **slow** (or **glass**) | Matte crawl / next-hit shatter |
| **Eraser Brute** | Soft heavy eraser (+ smudge zones) | **light** optional soften; main answer is **position** (behind punish) | Soften is bonus, not required |
| **Draft** | Unfinished copy — confidence / guard | Room **weak** (pillar/scrap); fake twin has **no shadow** | Guard drops / stagger; don’t peel the boss as a battery |

Dummy tutorial still teaches attack first; first combat throw is usually **paper** from a printer tray / scrap onto plate or Scribble.

### A7. Story cost (pending Q1)
Heavy steals may make Noor **flicker**, footfalls go quieter, or lamp light around her wash out for a beat. Soft, missable, not a Phase 1 fail state. **Flagged pending his Q1** in `power-rewrite.md` (whether P1 shows this or later phases only). Do not lock VFX until he answers.

### A8. Living copies hold their qualities
The Draft (and later Echo) will not shimmer as a peel supermarket. Peeling GUARDED off its arm is allowed only as the **designed crack** when the design calls for a boss peel — default fantasy: **throw room weak / paper into it**. Fake split-Draft: no shadow; throw anything that marks scrap or just hit it once.

---

## B. Edge cases (what players will try)

| Attempt | Result |
|---|---|
| Throw at blank wall / floor with no plausible fit | Splash → rebound to source |
| Throw at **Fern** | Rebound. Fern: “Not me.” (once) |
| Throw at **Caret** | Rebound. Caret blinks irritably |
| Throw at **herself** | Rebound (Phase 1). No self-buffs |
| Throw while being hit | Throw still releases if input committed; interrupt only during peel wind-up |
| Carry a quality through a **door into another room** | Quality **snaps home** at the threshold. Rooms don’t export ink. (Prevents sequence breaks.) |
| Steal from an **enemy** | Only if that enemy is designed to shimmer (rare). Default roster: **no**. Use room sources |
| Quality that **does nothing** anywhere in this room | She can still hold it; throw always either sticks somewhere compatible or rebounds. If literally no valid target exists, first throw rebounds + Fern leaf points at a shimmer |
| Soft-lock (needed quality stuck on wrong prop, source empty) | **Undo peel** off the wrong target, or death/UNDO snaps carried + last throw home. Soft-lock prevention rule: every critical quality has either a second source in-room or Undo path taught before the gate |

---

## C. Phase 1 flow (room by room)

Order matches existing level docs: **R0 real office → Mirror hub → Dark corridor → Flooded archive → Draft arena → Message room**.

---

### C1. R0 — Real office (cold open)

| | |
|---|---|
| **Goal** | Reach the desk, type the angry prompt, fall into the AI. |
| **Qualities** | None peelable. This is still the real world. |
| **Puzzle steps** | Walk → inspect → type. |
| **Solution** | Complete the prompt. |
| **Wrong attempts** | N/A for steal. |
| **Side effects** | None. |
| **Combat** | None. |
| **Teaches** | Move, inspect, type. (No shimmer yet.) |
| **Story** | Claim denied loop; AI answers in her voice; floor folds. |
| **Loopholes closed** | Players can’t “steal open” before the world rule exists. |

---

### C2. Mirror hub — discovery + exit

| | |
|---|---|
| **Goal** | Open the chained/shut exit door; learn take / throw. |
| **Qualities** | **open** on the rainy window (shimmers). Door is shut/chained (valid **open** target). Optional: lamp “keeps watch” is *not* required for the door if window is the teach. |
| **Puzzle steps** | 1) Fern intro + world rule lines. 2) Approach window (habit: shut it). 3) **Take open** — rain cuts, window shuts. 4) Panic. 5) **Throw open** at door — chains snap, light spill. 6) Caret wakes. Cross into corridor. |
| **Intended** | Window → door. |
| **Alternatives / wrong** | Throw open at Fern → rebound, Fern “Not me.” Throw at floor → rebound. Take nothing and bash door → solid; Fern leaf eventually points at window shimmer. |
| **Side effects** | Window shut = hub stays dry; if she Undoes from door back to window, rain returns. |
| **Combat** | None required. Optional clarity dummy later. |
| **Teaches** | **Shimmer = peelable.** Take removes; throw applies; one held. |
| **Story** | Discovery cutscene from `power-rewrite.md`: Fern **“You’re not supposed to be able to do that.”** / “Things keep their words. People don’t peel them.” / Noor “Then what am I?” / Fern deflects. Exit ownership lines stay; Q2 still open. |
| **Loopholes closed** | Can’t open door without spending window open; carrying open into corridor snaps home at threshold so corridor can’t be skipped with hub open. |

**Fern lines (hub):** keep locked shorts; protect discovery line.

---

### C3. Dark corridor — light + dummy

| | |
|---|---|
| **Goal** | Light the path; pass dummy tutorial; reach archive door. |
| **Qualities** | **on** from painted-over switch / emergency strip; dark **lamp** accepts **on**. **quick** or **still** on clock vs **dummy**. **paper** scrap on a tray for dummy plate (optional same alcove). |
| **Puzzle steps** | 1) Dark stretch. 2) Take **on** from switch → switch goes dark/inert. 3) Throw **on** into lamp → path lit; Fern note visible; painted door-seam secret readable as visual only. 4) Dummy alcove: attack tutorial, then take **paper** (printer scrap) and throw onto dummy’s metal plate **or** use still/quick pair to wake a slow swipe. 5) One **Scribble** as first live grunt — **paper** or **wet** if a drip source exists. |
| **Intended** | Switch on → lamp; paper → dummy/Scribble. |
| **Wrong** | Throw **on** at door → rebound. Throw **on** at Scribble → rebound. Leave lamp dark and wander → soft gate (can’t see alcove safely); Fern leaf → switch shimmer. |
| **Side effects** | Taking **on** from switch means you can’t relight without Undo; teaches planning. |
| **Combat** | Dummy (plate) → 1 Scribble. Counters per A6. |
| **Teaches** | **Compatibility** (on sticks to lamps, not doors) + first combat throw. |
| **Story** | Fern note: morning kindness. Shadow rule can be spoken here or stay hub-taught. |
| **Loopholes closed** | Can’t light lamp without draining switch; can’t export **on** to archive. |

---

### C4. Flooded archive — order + roster

| | |
|---|---|
| **Goal** | Drain water, lower bridge, clear waves, beat **Eraser Brute**, exit to arena. |
| **Qualities** | Water **high/wet**; drawer **low**; bridge **up**; stairs/plank **down** (underwater until drained); **dry** towel; **paper** scraps; **slow** wet-floor sign; **wet** ink bottle; **light** optional for Brute. *(Exact first-step pair still under Q4 — both legal; pick one implementation later.)* |
| **Puzzle steps (canonical shape)** | 1) Bridge up over high water — can’t cross. 2) Move height: either take **low** from drawer and throw into water, *or* take **high** water and throw into drawer — water drains; **down** becomes reachable. 3) Take **down** / throw to bridge → bridge lowers. 4) Cross. Combat waves between/after. |
| **Intended** | Drain → bridge → cross. |
| **Wrong** | Throw **wet** at bridge → rebound (bridge wants up/down, not wet). Take **down** before drain → unreachable / no shimmer. Throw drained water’s empty cooler at Redline → no wet left, must Undo or find ink bottle. |
| **Side effects** | Draining dries fight floors (Sticky less happy; Scribble still ink). |
| **Combat** | Wave1: 2 Scribbles (**paper/wet**). Wave2: Sticky Swarm + Scribble (**dry** on queen). Wave3: Redline (**slow**, desks as stun). Elite: Eraser Brute (behind punish; **light** optional). Stapler **not** archive elite (per combat.md) — appears in Draft arena add. |
| **Teaches** | **Order + side effects** (spend water carefully) + Undo if you brick the bridge pair. |
| **Story** | Archive linger tone; claim weight. Fern leaf on stall. |
| **Loopholes closed** | Order gate; threshold snap; Undo taught before Brute if they soft-lock the bridge. |

---

### C5. Draft arena — boss

| | |
|---|---|
| **Goal** | Defeat the Draft; claim shard drops. |
| **Qualities** | Pillar/scrap **weak** (respawns between phases as designed); **paper** scraps; adds bring their own counters from room props. |
| **Puzzle / fight steps** | Phase1: throw **weak** (or designed peel) to drop guard → punish. Phase2: kill shadowless COPY (hit or throw junk that sticks as scrap). Phase3: **weak** again / REPHRASE dash → beam window. |
| **Intended** | Room weak → Draft; read no-shadow on fake. |
| **Wrong** | Try to peel Draft as infinite weak battery → no shimmer / hold fails (A8). Throw **open** leftover → rebound. |
| **Side effects** | Using weak empties pillar until refresh; plan around adds. |
| **Combat** | Draft + adds (Scribble/Sticky; Stapler phase1 add; optional Redline/Brute only if tuned). Counters A6. |
| **Teaches** | **Living copies don’t feed you** — use the room. |
| **Story** | Fern: “No shadow. It’s a copy. Fight.” Quiet “…So did I.” Shard with corrupted date. Draft last line format = Q3 still open. |
| **Loopholes closed** | No boss-as-source; fake identified by missing shadow not by text tag. |

---

### C6. Message room — ending

| | |
|---|---|
| **Goal** | Watch Papa / AI-as-Noor chat; go downstairs. |
| **Qualities** | None required. Stairwell open as story gate. |
| **Puzzle** | Cutscene. |
| **Combat** | None. |
| **Teaches** | Motive: stop the impostor on the phone. |
| **Story** | “That isn’t me.” / “Stop talking to him.” Fern: claim split five ways. |
| **Loopholes closed** | No steal required to progress — avoids teaching wrong “need a quality for every door.” |

---

## D. What each room teaches (escalation)

| # | Room | New rule |
|---|---|---|
| 1 | R0 | No steal in the real world |
| 2 | Hub | Shimmer → take → throw; take removes; discovery |
| 3 | Corridor | Compatibility (splash/rebound); first combat throw |
| 4 | Archive | Side effects + order; Undo; full roster counters |
| 5 | Draft | Living copies hold; use room qualities |
| 6 | Message | Story gate without a forced steal |

---

## E. Loophole checklist

| Loophole | Rule that closes it | Taught in |
|---|---|---|
| Peel anything / anywhere | A1 inked + shimmer only | Hub |
| Open every door with any junk quality | A2 compatibility table | Corridor |
| Duplicate qualities / keep window open and door open | A3 take removes; A4 one held | Hub |
| Soft-lock after bad throw | A5 Undo + death/UNDO snap | Archive (before Brute) |
| Export hub **open** into later rooms | Threshold snap (edge table) | Hub→Corridor |
| Infinite peel from Draft | A8 living copies | Draft arena |
| Soften every enemy with one universal quality | A6 per-enemy counters | Corridor→Archive |
| Throw at Fern to “solve” empathy puzzles | Rebound + line | Hub |
| Skip lamp by carrying **on** from a future room | Threshold snap + no forward sources | Corridor |
| Ignore side effects (drain water and still need wet) | A3 + Undo | Archive |

---

## F. Cross-doc notes

- **`power-rewrite.md`:** Story how/why stays. Mechanics details live here. §8 questions **remain open** (cost timing, exit line, Draft last line, archive pair, title).
- **`combat.md`:** Enemy counters above match §4 tables; power presentation is peel/throw with no body text. If combat.md still mentions HOLD READ glow for labels, treat that as **legacy wording** — shimmer replaces READ for finding peelables (until a code pass).

---

*End. No `game/src` changes in this document.*
