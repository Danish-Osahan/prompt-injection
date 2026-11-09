# Prompt Injection — Close-Combat Design (Phase 1)

**Status:** locked direction for Phase 1 greybox → wire → render.  
**Written:** 9 Nov 2026 (Asia/Calcutta).  
**Supersedes for combat:** `docs/story/noor-combat.md` (SELECT drag-line, hold-select beam spam) and the combat sections of `docs/story/enemies.md` where they conflict. Puzzle plates and linger captions in `docs/story/phase-1-levels.md` stay.  
**Sources:** diegetic word mock (`mock-diegetic/README.md`), Noor attack preview (`mock-attack/README.md`, `mock-attack/assets/noor_attacks12.json`), clarity office (`docs/HANDOFF.md` §14–§15).

---

## 0. One-sentence identity

**Prompt Injection Phase 1 is a close-combat action puzzle:** Noor fights within arm's reach, peels words painted on the world, and throws them onto enemies. Ranged spam is out. The beam is a short-range finisher you earn by making space.

---

## 1. Core loop

1. Close distance (walk / dash).
2. Read a **world** label that has real text on it (printer tray, wet-floor sign, cooler, window etch). Enemies themselves show **no words**.
3. Peel the word (E / READ). It orbits Noor's hand as glowing ink.
4. Arm it (tap the glyph) then **F / THROW**, or press THROW — the ink splats on and the enemy **physically morphs** (~0.3 s). No text appears on the creature.
5. Punish with the 3-hit combo (or the short beam if the opening is big enough).
6. Dash out of the next telegraph.

Ink fuels peels-beyond-free and the beam. Combo hits refill ink. Dying undoes to the last checkpoint (`phase-1-levels.md`).

---

## 2. Noor's kit (numbers)

### 2.1 Vital stats

| Stat | Value | Notes |
|---|---|---|
| Max HP | 5 hearts | Refills at each checkpoint. One hit from a grunt = 1 heart; heavies / boss grabs = 2. |
| I-frames on hit | 450 ms | White flash + brief knockback. No stacking. |
| I-frames on dash | 220 ms | From dash start. |
| Walk speed | 230 px/s | Matches current game. |
| Dash distance | ~110 px | ~1.0 s cooldown. Cancels recovery of combo1/2 only (not combo3, peel, throw, or beam charge). |
| Facing | 8-dir | Attacks face the auto-aim target (nearest enemy in cone, else nearest in range). |

### 2.2 Ink meter

| | |
|---|---|
| Max | 100 |
| Start of room / checkpoint | 60 |
| Combo hit refill | +8 / +10 / +14 on jab / swipe / finisher contact |
| Perfect dash through an active hurtbox | +12 |
| Peel (first free peel per room) | 0 |
| Peel (after free) | −15 |
| Throw / place a carried word | 0 (already paid on peel, or free if the word was a room pickup) |
| Beam fire (on release) | −50 (charge can be cancelled for 0 cost; release is what spends) |
| Floor | 0. Cannot peel (paid) or fire beam below cost. Throw still works if a word is already carried. |

Carried words: max **2**. They orbit her hand as small ink glyphs (diegetic inventory — no panel). Oldest drops as a faint adhesive ghost on the floor if a third is peeled.

### 2.3 3-hit combo (art-v12 timings → target −30%)

Source sheets: `combo1` / `combo2` / `combo3` in `mock-attack/assets/noor_attacks12.json`. Design target is **~30% faster** than the preview (preview felt long at game scale). Hitboxes are short cones / arcs in front of Noor; range is melee.

| Hit | Preview total | Target total | Hit frame (preview) | Hit-stop | Step | Chain window | Damage |
|---|---|---|---|---|---|---|---|
| Jab (combo1) | 480 ms (410 + 70 stop) | **~340 ms** | f3 | 70 → **50 ms** | 6 px | from f4 | 1 |
| Cross-body swipe (combo2) | 543 ms (458 + 85) | **~380 ms** | f4 | 85 → **60 ms** | 7 px | from f5 | 1.5 |
| Spinning finisher (combo3) | 849 ms (719 + 130) | **~600 ms** | f5 | 130 → **90 ms** | 10 px | — (end) | 2.5 + light AoE (r ≈ 48 px) |

- Tap J / click / TYPE while idle or in a chain window → next hit. Missed chain → combo resets after recovery.
- Auto-aim locks at wind-up start; Noor turns to face.
- Cancel: dash cancels jab/swipe recovery. Finisher is committed.
- On contact: apply hit-stop to Noor **and** target; spawn glyph sparks (code FX).

### 2.4 Dash

- Input: Space / dash button.
- 220 ms i-frames, ~110 px along facing (or stick).
- Cooldown 1.0 s. Landing has a 2-frame skid (existing dash sheets).
- Perfect dash: if any enemy hurtbox is active at the moment i-frames start overlapping it → +12 ink, brief teal afterimage, and that attack's active frames end early on that enemy only (they "miss her").

### 2.5 Peel (diegetic)

From `mock-diegetic` + art-v12 `peel` (770 ms preview → target **~550 ms**).

- Range: facing cone, reach ≈ 42 px from foot to painted word.
- Tap painted word / press E while facing it → peel anim. Events: pinch (f4), peel (f6).
- Letters lift one by one into her hand; surface keeps a faint adhesive ghost.
- Words are **paint on the world**, never UI tags/buttons.
- Near + facing → wet-ink shimmer on the painted pixels only (no outline).

### 2.6 Throw / place

From art-v12 `throw` (743 ms preview → target **~520 ms**). Release on f4.

- **Out of combat / on surfaces:** tap a carried word, then tap a blank or compatible surface → place. Word splats, settles as paint, rule applies (door opens, water drains, etc.).
- **In combat:** tap a carried word then attack, **or** throw-button with a carried word → ink projectile at auto-aimed nearest enemy. Travel ~420 px/s, lifetime 0.7 s. On hit: splat over their painted word, material / behaviour change fires, short hit-stop (40 ms).
- Compatible swaps only (see per-enemy tables). Incompatible splat fizzles (word returns to hand once; second fail drops it to the floor as a ghost pickup for 8 s).

### 2.7 Beam — short-range finisher (not spam)

Rework of art-v12b. **Identity change:** range is short, charge is long, cost is high. It is a reward for creating space, not the main DPS.

| | |
|---|---|
| Input | Hold TYPE / hold click ≥ **0.85 s**, then release. (Old 0.22 s threshold is retired.) |
| Charge stages | 0–0.35 s spark → 0.35–0.85 s growing orb → ≥0.85 s max orb + crackle (ready). Cancel by dash or walking > 40 px. |
| Charge lock | Move speed ×0.35 while charging. Can still turn slowly. |
| Range | **96 px** beam length (was effectively full-room in the mock). |
| Width | Snaps in over 40 ms, holds ~390 ms, thins ~140 ms (release anim f1–f6). |
| Damage | 5 to primary target in the beam; 2 splash in a 28 px radius at the impact point. |
| Cost | −50 ink on release. |
| Knockback | Strong on primary (see §5). Recoil step on Noor −5 px (from sheet). |
| Hit-stop | 70 ms on release contact. |
| Cooldown | 4.0 s after release (UI ring on the TYPE button). |
| Room reaction (greybox, code-only, locked 9 Nov 2026) | Papers in the path flutter; lights dip 1 beat; brief scorched-code trail on the floor that fades in 1.2 s. Simple Phaser/canvas stubs ship with `?combat=1`; richer art deferred to polish. |

N/S facing: keep the 40° cheat from art-v12b so the arm reads.

### 2.8 What this replaces

| Old | New |
|---|---|
| Drag-a-line SELECT attack | Removed. |
| Hold-0.22s typed beam as primary | Hold-0.85s short-range finisher. |
| Caption-chip / tag picker in combat | Diegetic peel + throw. Puzzle rooms may keep caption chips until the diegetic rollout reaches that room; combat always uses paint. |
| REWRITE bullet-time swap UI | Replaced by peel/throw. Slow-mo is optional later (not Phase 1 default). |
| CUT/PASTE, FERN ROOT | Still Phase 1 unlocks from session 2, but retuned as close-combat tools (see §8). Not required for greybox. |

---

## 3. Diegetic word rules (combat) — locked 9 Nov 2026 (no labels on creatures)

1. **Enemies never wear text.** Their trait is the material look: chrome plating (Stapler), glossy red pen + skid marks (Redline), dense tangled ink (Scribble). The practice dummy has a metal plate strapped on — no ARMORED tag.
2. **Words live only on world surfaces** that would really have text: printer tray **PAPER**, wet-floor sign **SLOW**, cooler label **WET**, window etch **GLASS**. Holding READ makes peelable labels glow.
3. Peel → carry (max 2, orbiting ink glyphs). **Throw is explicit:** tap a carried glyph to arm it, then **F** / **THROW** button. Attack (J / TYPE) is always combo / beam — it never auto-throws.
4. A thrown word **physically transforms** the enemy over ~0.3 s (splat → morph). Caption names the word once (`PAPER — flimsy. One hit left.`). No text is drawn on the body.
5. Word Memory (`phase-1-systems.md`) still logs every throw for later phases.

### 3.1 Transform matrix (any word × any foe)

| Word \ Target | Scribble | Redline | Stapler | Dummy |
|---|---|---|---|---|
| **PAPER** | ★★ folds, 1 HP | ★ light shell | ★★★ strips chrome, crumples in 1 | ★★★ strips plate, crumples in 1 |
| **WET** | ★★★ ink runs, −50% spd, weaker hits | ★ smeared charge | ★★ plating softens (0.5× block) | ★★ sags |
| **SLOW** | ★★ stiffer lunge | ★★★ matte, crawl telegraphs | ★ walks slower, shield stays | ★ sluggish |
| **GLASS** | ★★ brittle, next hit shatters | ★★ next hit shatters | ★★★ brittle chrome, shatters | ★★★ shatters |

★★★ = intended answer for that foe. Other words still apply with weaker effect.


---

## 4. Enemy roster (Phase 1 close-combat)

HP is in **heart-equivalents** (jab = 1). Speed is px/s. Aggro is the radius that pulls them from idle → engage.

### 4.1 Scribble — basic grunt

| | |
|---|---|
| Role | Melee fodder. Teaches lunge punish + first combat throw. |
| Look | Dense tangled charcoal ink ball. No text. |
| HP | 3 (folds to 1 after PAPER). |
| Speed | 95 idle drift / 160 lunge. |
| Aggro | 220 px. |
| Crack | Throw **PAPER** (folds, 1 HP) or **WET** (ink runs, −50% speed). World sources nearby. |

**Attacks**

| Move | Wind-up | Tell | Active | Recovery | Punish | Dmg |
|---|---|---|---|---|---|---|
| Lunge | 600 ms | Body squash + ink puddle foreshadow along the path | 180 ms (hurtbox on the body) | 1000 ms stuck if it misses | Full combo fits | 1 |
| 2-hit scratch | 350 ms | Both "arms" raise, red flash under feet | 120 + 100 ms | 700 ms | Jab + swipe | 1 per hit |

**AI states:** Idle → Alert (turn to Noor) → Chase → Lunge (if 80–160 px) or Scratch (if < 70 px) → Recover → Repeat. At ≤50% HP (pre-PAPER): chase speed +20%, lunge wind-up 500 ms.

**Counters:** Dash sideways past the lunge; punish. Throw PAPER, then one hit. Finisher AoE clears two that are stacked.

**Rooms / mix:** Corridor intro (1, after dummy tutorial). Archive wave 1 (2). Archive wave 2 (1 + Sticky Swarm). Arena Draft phase 2 adds (2).

---

### 4.2 Redline — charger

| | |
|---|---|
| Role | Straight-line threat that makes desks matter. Teaches dash-sideways + environment stun. |
| Look | Tall red pen on stubby legs; red FAST painted down the barrel. |
| HP | 5. |
| Speed | 70 wander / **320** during charge. |
| Aggro | 280 px. |
| Look | Glossy red pen; leaves ink skid marks while charging. No text. |
| Crack | Throw **SLOW** (matte, crawl). **GLASS** also works (shatters next hit). |

**Attacks**

| Move | Wind-up | Tell | Active | Recovery | Punish | Dmg |
|---|---|---|---|---|---|---|
| Floor scrape (prep) | 400 ms | Tip scrapes; red line draws on the floor toward Noor | — (telegraph only) | goes into Charge | — | 0 |
| Charge | 0 (fires after scrape) | Line locked; body leans | Until wall/desk/Noor or 520 px | 400 ms if stopped clean | Short | 2 |
| Desk crash (on solid prop) | — | Impact burst | — | **1500 ms stunned** (dizzy stars) | Full combo + throw | 0 (self) |

Collision: uses the same prop footprints as Noor (`clarity` / room collision). If the charge ray hits a solid prop AABB before Noor, it crashes and stuns.

**AI states:** Idle → Aim (scrape) → Charge → (Crash Stun | Hit Recover | Whiff Recover) → Reposition (arc around Noor) → Aim.

**Counters:** Dash perpendicular during scrape or early charge so it hits a desk. Throw SLOW before the scrape to make the punish trivial. Do not stand in a corridor with no side desks.

**Rooms / mix:** Archive wave 3 (1 alone — teaching fight). Arena Draft phase 3 add (1). Never in empty open space without at least one solid prop in charge lanes.

---

### 4.3 Stapler — frontal guard

| | |
|---|---|
| Role | Shield teacher. Front is safe for it; peel or bait the snap. |
| Look | Walking stapler; chrome shield plate on the front with **SHIELDED** stencilled on it. |
| HP | 6 (body). Shield absorbs all frontal hits while SHIELDED is painted. |
| Speed | 70. |
| Aggro | 200 px. |
| Look | Walking stapler with **chrome plating** (specular sheen). Frontal block while plated. No text. |
| Crack | Throw **PAPER** (strips plating, crumples in 1) or **GLASS** (brittle, next hit shatters). |

**Attacks**

| Move | Wind-up | Tell | Active | Recovery | Punish | Dmg |
|---|---|---|---|---|---|---|
| Shield idle | — | Frontal arc indicator (cool grey) | Block while facing Noor ±50° | — | Hit from behind for 1.5× | 0 (block) |
| Snap | 450 ms | Shield lifts 15°, hinge creak, warm flash on hinge | 160 ms forward bite (50 px) | 900 ms (shield hangs open) | Full combo from front | 2 |

**AI states:** Guard (face Noor, slow advance) → Snap (if 40–60 px for ≥0.5 s) → Recover → Guard. If shield peeled: Circle (try to put wall at back) → Snap more often (wind-up 350 ms).

**Counters:** Peel SHIELDED from the side/behind, or bait Snap and punish the 900 ms hang. Jab from behind while it guards. Beam from the side once shield is down.

**Rooms / mix:** Arena Draft phase 1 add (1, teaches peel under pressure). Archive elite for first ship is Eraser Brute (Stapler is not the archive elite).

---

### 4.4 Sticky Swarm — crowd / cling

| | |
|---|---|
| Role | Soft multi-target. Teaches finisher AoE and DRY throw. |
| Look | 4–6 small sticky notes. Swarm shares one painted word **STICKY** on the largest note (the "queen"); satellites have ghost glyphs. |
| HP | 1 each. Queen 2. |
| Speed | 110 flutter. |
| Aggro | 240 px. |
| Painted word | **STICKY** → **DRY** (from towel / archive towel plate / corridor umbrella context). |
| On DRY | All notes lose cling; fall to the floor as inert pickups for 0.5 s then despawn. If already clinging, they drop off Noor immediately. |

**Attacks**

| Move | Wind-up | Tell | Active | Recovery | Punish | Dmg |
|---|---|---|---|---|---|---|
| Dive | 300 ms | Note tilts + shadow shrinks under Noor | 200 ms | 500 ms grounded | One jab kills a grounded note | 1 |
| Cling | on touch during dive | Latches to Noor's cardigan | Until shaken / finisher / DRY / 4 s | — | — | 0 direct; **Noor move speed ×0.7 per clinger, min ×0.4**; peel disabled while ≥2 clinging |

**AI states:** Orbit (ring around Noor at 70–100 px) → Dive (staggered 150 ms apart) → Grounded or Cling → Rejoin orbit.

**Counters:** Combo3 finisher clears all within r≈48. Throw DRY at the queen. Dash shakes off 1 clinger.

**Rooms / mix:** Archive wave 2 (swarm of 5 + 1 Scribble). Arena Draft phase 2 (swarm of 4).

---

### 4.5 Eraser Brute — heavy

| | |
|---|---|
| Role | Slow threat that attacks the word system itself. Teaches behind-punish and "don't greed the beam". |
| Look | Soft pink eraser block with scuffed metal ferrule legs. Painted word **HEAVY** on its chest (flavour; not the main crack). |
| HP | 10. |
| Speed | 55. |
| Aggro | 260 px. |
| Painted word | **HEAVY** → **LIGHT** (optional soften: speed +40%, HP check becomes 6 remaining max). Main counter is positioning, not the swap — swap is a bonus. |
| Special zone | After a slam, leaves a **smudge zone** (ellipse ~90×40 px) for 3.5 s. While Noor stands in it: carried words are wiped to adhesive ghosts on the floor (recoverable for 6 s outside the zone), and peel is disabled. Zone does 0 damage. |

**Attacks**

| Move | Wind-up | Tell | Active | Recovery | Punish | Dmg |
|---|---|---|---|---|---|---|
| Overhead slam | 800 ms | Both arms up; floor circle grows under target point (locked at wind-up start) | 200 ms smash | 1200 ms (kneeling) | Full combo from **behind** (front still pushes Noor) | 2 + smudge zone |
| Shoulder check | 400 ms | Lean + scrape | 180 ms | 600 ms | Jab + swipe | 1 |

Front push: while not in slam recovery, frontal hits from Noor deal damage but apply **no hit-stop to the Brute** and shove Noor back 12 px (shield-feel without a plate). Behind hits work normally.

**AI states:** Approach → Slam (if 60–120 px) or Check (if < 55 px) → Recover → Re-square to face Noor.

**Counters:** Dash behind during the 800 ms slam tell; full combo. Throw LIGHT if available. Beam is risky inside smudge (wipes carried words on the charge if she steps in). Clear the zone, then beam.

**Rooms / mix:** Archive mid-boss / elite for first ship (1, alone, after wave 3). Optional second appearance as Draft phase 3 add (1) — only if greybox says archive taught it well.

---

### 4.6 Draft — Phase 1 boss (melee rework)

| | |
|---|---|
| Role | Capstone. Guard breaks up close; phases change via body words. |
| Look | Tall unfinished letter / crumpled draft figure. Single warm lamp. Open arena with 2–3 paper pillars as cover (and word carriers). |
| HP | 3 bars × 12 = **36** (was "~25–30 Caret hits"; retuned for combo DPS). |
| Speed | 100 base / 140 phase 3. |
| Aggro | Whole arena on fight start. |

**Painted words (by phase)**

| Phase | Body word | Crack | Effect |
|---|---|---|---|
| 1 Guarded | **GUARDED** on the shield-arm | Peel GUARDED, or throw **WEAK** (from pillar "PAPER IS WEAK" / arena scrap) | Guard drops for **7 s**. While GUARDED: frontal hits deal 0.25× and no hit-stop on Draft. |
| 2 Split | Two drafts; real one keeps **TRUE**, fake wears **COPY** | Throw anything onto COPY, or hit it once after reading (fakes cast no shadow — keep that rule) | Fake crumples. Real loses 1 bar chunk (4 HP) when fake dies. |
| 3 Exposed | **STRONG** | Throw **WEAK** | Enters stagger for 2.5 s (beam finisher window). |

**Attacks (all melee-range)**

| Move | Phase | Wind-up | Tell | Active | Recovery | Punish | Dmg |
|---|---|---|---|---|---|---|---|
| Grab | 1–3 | 550 ms | Both arms open; magenta hand flashes | 200 ms grab if in 40 px; then 600 ms hold | 800 ms after release / break | Combo after break | 2; hold drains 1 more if not mashed/dashed free in 600 ms |
| Sweep | 1–3 | 500 ms | Torso coils; floor arc paints 120° | 220 ms arc, r≈70 | 900 ms | Full combo | 1 |
| Slam | 2–3 | 700 ms | Arms up; circle under Noor (tracks 0.3 s then locks) | 200 ms | 1100 ms | Full combo + beam if charged | 2 + small smudge (2 s) |
| Paper swipe (legacy, shortened) | 1 | 400 ms | Two floor flashes in sequence | 2×140 ms | 600 ms | Jab+swipe | 1 each |
| REPHRASE ring | 2–3 | 600 ms | Expanding ring telegraph | Ring hurtbox at radius over 0.5 s | 2000 ms pause (**big punish**) | Beam or full combo | 1; **dash through with i-frames** |

**Phase flow**

1. **Bar 1 — Guarded:** GUARDED up. Pattern Grab → Swipe → Sweep. Teach peel/throw WEAK. When bar empties, shield shatters (even if GUARDED still on — word becomes ghost).
2. **Bar 2 — Split:** Spawns a shadowless COPY. Both use Sweep / Swipe. Adds: 2 Scribbles once. Kill COPY (no shadow) or rewrite it. Real Draft briefly staggers.
3. **Bar 3 — Exposed:** Speed up. Slam + REPHRASE ring. STRONG on chest; WEAK from a respawned pillar word. After REPHRASE recovery (2 s) or WEAK stagger (2.5 s): **beam finisher window** ( Draft takes ×1.5 beam damage ).

**Defeat:** Drops the claim shard (story). Word Memory tease: plates may echo the player's most-used word (`phase-1-systems.md`).

**Counters:** Stay close enough to peel, not so close that Grab is free. Dash through REPHRASE. Save beam for post-ring or WEAK stagger. Use pillars for Redline-style cover if adds include a charger in NG+; Phase 1 adds are Scribble / Sticky / optional Stapler in bar 1.

---

## 5. Hit-stop, knockback, feel rules

| Event | Hit-stop | Knockback on target | Notes |
|---|---|---|---|
| Jab contact | 50 ms | 6 px | |
| Swipe contact | 60 ms | 10 px | |
| Finisher contact | 90 ms | 18 px + light lift | AoE same stop |
| Word throw splat | 40 ms | 4 px | |
| Beam primary | 70 ms | 36 px | Noor recoil −5 px |
| Enemy hits Noor | 80 ms | 14–22 px by damage | I-frames 450 ms |
| Desk crash (Redline) | 100 ms | — | Screen shake 0.15 s |
| Draft REPHRASE start | 0 | — | Soft zoom inhibit (clarity: no gameplay zoom; shake only) |

- Hit-stop freezes **Noor + that target** only (other enemies keep moving at 30% — readability without full pause).
- No stacking hit-stop; new contact replaces remaining stop.
- Reduce-motion: cut hit-stop durations ×0.4, disable shake, keep gameplay timing.

---

## 6. Encounter pacing — Phase 1 rooms

| Room | Combat content | Target time in combat | Teach |
|---|---|---|---|
| Office (clarity) | Practice dummy with a metal plate (no text). Greybox enemies behind `?combat=1`. World words: PAPER / SLOW / WET / GLASS. | 0–1 min optional | Peel PAPER, throw to strip the plate, combo crumple; beam finisher once. |
| Hub | None (gap dash only). | — | Dash. |
| Dark Corridor | Paper Dummy tutorial → 1 Scribble. | ~1 min | Attack, first live grunt. |
| Flooded Archive | Wave 1: 2 Scribbles. Wave 2: Sticky Swarm (5) + 1 Scribble. Wave 3: 1 Redline. Elite / mid-boss: **Eraser Brute** (locked 9 Nov 2026). Stapler appears as a Draft Arena phase-1 add and is deferred as an archive elite to a later pass. | 3–4 min | Full kit under pressure; desks as weapons. |
| Draft Arena | Boss, 3 phases, light adds. | 4–6 min | Guard peel, fake-shadow read, beam as finisher. |
| Message Room | None. | — | Story. |

Hint rule unchanged: after ~45 s stuck on a **puzzle**, Fern points. Combat deaths undo to checkpoint; no combat hint arrow in Phase 1.

---

## 7. Greybox test plan (next build step)

**Goal:** feel, not art. Placeholder shapes in the **office** clarity level behind `?combat=1` (or a `CombatLab` scene that reuses office collision).

### 7.1 First three enemies (in order)

1. **Scribble** — tangled ink ball (no label). Validate lunge tell, miss-stuck punish, PAPER throw → one-hit fold, WET melt, combo DPS to 3 HP.
2. **Redline** — long thin AABB. Validate scrape line, charge, **desk crash stun** against real office footprints, SLOW throw.
3. **Stapler** — block + frontal shield arc. Validate block angles, Snap punish, peel SHIELDED.

Sticky Swarm and Eraser Brute enter greybox pass 2 once the first three feel right. Draft is pass 3 (own arena greybox).

### 7.2 What to tune (checklist)

- [ ] Combo chain window forgiveness (early / late by ±40 ms).
- [ ] Jab range vs Scribble body (must connect without kissing the sprite).
- [ ] Dash i-frame vs lunge active (perfect-dash ink reward rate ~30% of attempts for a learning player).
- [ ] Redline charge vs desk footprints (must stun, must not tunnel).
- [ ] Peel reach and facing cone (no accidental peels on furniture words mid-fight).
- [ ] Throw travel time and splat forgives (±14 px radius).
- [ ] Ink economy: can you PAPER a Scribble and still beam a Redline in one archive-length fight without starving?
- [ ] Beam range 96 px: does "make space then fire" feel earned?
- [ ] Hit-stop readability at 0.78× Noor scale.
- [ ] Mobile: tap / hold / dash / carried-word tap targets (≥44 px).

### 7.3 Pass / fail for leaving greybox

- A developer who knows the game can clear Scribble×2 + Redline with ≤1 death.
- A fresh playtester understands peel→throw from the dummy tutorial alone (no text wall).
- No soft-lock: ink=0 still allows bare combo + dash clears, just slower.

**Greybox status (9 Nov 2026):** built into the clarity office behind `?combat=1` (`game/src/combat/greybox.ts`). World-only words + material transforms (no creature labels). **No Blender rendering** until greybox pass/fail is signed off by the owner.

---

## 8. Phase 1 unlocks (retuned, post-greybox)

Kept from session 2 so the story script still works; numbers TBD in greybox.

| Unlock | Close-combat role |
|---|---|
| SELECT (tool) | Not a drag attack. Lets Noor peel a painted word from **across the room** once the tool is unlocked (longer shimmer range). |
| CUT / PASTE | Perfect dash stores the enemy's painted word as a ghost copy; Paste throws that copy without peeling the original. |
| REWRITE | Adds a third compatible word choice when placing (picker is diegetic: three ghost paints around her hand for 1.2 s). |
| FERN ROOT | Once per fight, pins one enemy 1.5–2 s (Fern growth extends duration — `phase-1-systems.md`). |

---

## 9. Locked owner answers (9 Nov 2026)

1. **Archive elite for first ship:** **Eraser Brute**. Stapler stays in the roster as a Draft Arena phase-1 add / later archive elite.
2. **Dummy / enemy labels (revised same day):** enemies and the dummy show **no words**. Dummy wears a visible metal plate; **PAPER** on the printer tray is the hint. Supersedes the earlier "ARMORED → PAPER on the dummy" text-label form.
3. **Beam room reactions:** ship a **simple code-only** version in the greybox (paper flutter, light dip, scorched trail). No Blender; polish art later.
4. **Throw vs beam:** throw is **F / THROW** (or tap a carried glyph to arm, then THROW). J / TYPE never auto-throws.
5. **World words in the office greybox:** PAPER (printer), SLOW (wet-floor sign), WET (cooler), GLASS (window etch).

---

## 10. File / implement map (when coding starts)

| Concern | Likely home |
|---|---|
| Ink, carry, peel/throw input | `game/src/` new `ink.ts` / extend `words.ts` |
| Combo / beam / dash combat | extend attack path in `game.ts` / clarity; wire art-v12 sheets per HANDOFF §15 |
| Enemy AI | new `game/src/enemies/` (scribble, redline, stapler, sticky, eraser, draft) |
| Greybox flag | `?combat=1` in clarity office |
| Playtests | extend `tests/office11.mjs` + new `tests/combat_greybox.mjs` |

Preview assets stay in `mock-diegetic/` and `mock-attack/` until wire-in.
