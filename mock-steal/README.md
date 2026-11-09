# Steal qualities: preview mockup (NOT the game)

A no-words office mechanic preview. Nothing in `game/src` changed.

## v11 — silhouette impact SHOT (fix v10 framing)

Colour frames after the flash stay as in v10. The silhouette impact was reframed so at 1× you can tell who threw what at what.

**Fixes**
1. **Framing** — wide sil SHOT: Noor throw follow-through (bun + extended arm) + gust trail + door/chain. Punch-zoom only after colour-return.
2. **Shapes** — real door mask (frame, two leaves, handles, seam); chain/lock white-hot with thin dark outline; door + Noor flat; warm-white radial on lock; bold tapered gust trail hand→lock.
3. **Spark** — ~0.6–0.8× Noor height, 4–5 thick uneven spikes along throw, hot core over lock.
4. **Flicker** — frame1 black-on-warm / frame2 white-on-black (anime invert).
5. **Debris** — rim/specular boost on settle; padlock shackle visibly popped open (overlay).

| file | what |
|---|---|
| `v11/beat.mp4` | ~11.5 s beat |
| `v11/beat.gif` | 640-wide loop |
| `v11/compare.mp4` | **v10 vs v11** |
| `v11/stills/` | `impact-01..08-2x` + strip + `10-impact-1x` |

### Rebuild
```bash
python3 art/tools/compose_steal_v11.py
```

### Honesty / weak spots
- Noor sil is authored (`art/render/steal_break_v9/noor_throw_sil.png`) — the 3D hurl sheets are high-angle busts and don't read as "bun + arm" at 1×.
- Sil staging cheats Noor to the right of the door (her world pose overlaps the door plate).
- Settled debris + open shackle remain subtle on the dark carpet at game scale.
- Soft wind remains canvas masses; scatter is still authored ballistic.

## v10 — clean-mask impact (fix v9)

v9 silhouette used a brightness threshold → blotchy Noor, white paper props, clip-art 8-point star, oversized chain, grey box. v10 fixes the approach.

**Fixes**
1. **Clean masks** — Noor sprite alpha + door rect + chain/lock pass alpha. Flat black (door/Noor) + light (chain/lock) silhouettes on warm-white burst. Props out. No speckle.
2. **Timing** — 2 silhouette frames @24fps, 1 colour-return burst, then punch-zoom on real colour with sparks/debris.
3. **Spark** — asymmetric directional burst (3–5 uneven thick tapered spikes, hot core, secondary slivers, slight rotate/scale-in). No orange ring, no 8-point star.
4. **Chain scale** — taut ≤ ~150px across door handles (door sprite 196px). Fixed scale for scatter so links stay chunky (no bbox-squash).
5. **No grey HUD boxes.**
6. **Debris** — Blender snap/settle passes visible in colour frames with floor contact shadows.

| file | what |
|---|---|
| `v10/beat.mp4` | ~11.5 s beat |
| `v10/beat.gif` | 640-wide loop |
| `v10/compare.mp4` | **v9 vs v10** |
| `v10/stills/` | `impact-01..08-2x` + strip + `10-impact-1x` |

### Rebuild
```bash
python3 art/tools/compose_steal_v10.py
```

### Honesty / weak spots
- Silhouette door is a rounded rect, not the exact door mesh outline.
- Scatter is still authored ballistic (same break renders as v9).
- Soft wind remains canvas masses.
- Padlock body is a dark metal block — can read as “grey” at 1× if the shackle is hard to see.
- Settled debris is darker than flying chrome; floor contact shadows help but pieces can blend into the dark carpet.

## v9 — impact overhaul (heavy tier)
## v9 — impact overhaul (heavy tier)

Danishpreet rejected v8's contact frame (thin white line-stack gust, translucent grey box, outline-icon chain/lock). v9 changes the **approach**, not the parameters.

**System**
- Spec: `docs/design/impact-spec.md`
- Reusable tiers: `art/tools/impact_system.py` (`light` / `heavy` / `big`) — hit-stop, punch-zoom, directional shake, thick hit-spark, silhouette/invert frames, soft wind, floor dust (no radial rings)
- Door break uses **heavy**

**What changed**
1. **Chunky Blender chain + padlock** (`art/tools/steal_break_rb.py` → `art/render/steal_break_v9/`) — taut → snap ballistic with spin/gravity/bounce + contact shadows; padlock shackle pops; pieces readable at 1×. Composited onto bare office door (no baked outline icons).
2. **Soft-shaded wind** — painterly highlight/shadow masses (+ Blender soft-wind pass). No hairline stroke stacks.
3. **Impact frames** — 2–3 high-contrast silhouette frames + thick tapered hit-spark; 2.5× punch-zoom; directional shake; glowing sparks; floor dust burst.
4. **Door** — bare plate + Blender metal; recoil then lift open. No translucent grey HUD rectangles.

| file | what |
|---|---|
| `v9/beat.mp4` | ~11.5 s beat |
| `v9/beat.gif` | 640-wide loop |
| `v9/compare.mp4` | **v8 vs v9** |
| `v9/stills/` | stills + `impact-01..08-2x` + `impact-sequence-strip` + `10-impact-1x` |

### Rebuild
```bash
/home/box/tools/blender-4.2.9-linux-x64/blender -b --python art/tools/steal_break_rb.py -- art/render/steal_break_v9 28
python3 art/tools/compose_steal_v9.py
```

### Honesty / weak spots
- Scatter is authored ballistic (deterministic), not a live Blender rigid-body bake of interlocking tori (unstable).
- Soft wind is still canvas + emission spheres — better than stroke stacks, not true volumetrics.
- Silhouette impact frames are procedural (threshold + burst), not hand-authored sprites.
- Door metal dent/flex plate was removed after it read as a grey box; recoil is lift nudge + dust.
- Padlock bounce/settle can exit the 2× crop; full frame stills show scatter better.

## v8 — clean throw path + heavy chain-break impact
## v8 — clean throw path + heavy chain-break impact

Addresses v7 feedback (throw detour) + heavy-tier lock break physics.

**Fixes / adds**
1. **Throw path** — gust leaves the throwing hand and flies a clean shallow arc to `DOOR_CHAIN` (handles). No up-left plant detour. Distance to door shrinks every flight frame (`bad_increase=0`).
2. **Anticipation → travel** — wrap on hand, then fast travel with smear; SW/S 3/4 cheat pose.
3. **Rip→carry hitch** — longer ease_in_out bridge (no hard freeze).
4. **Heavy impact** — longer hit-stop freeze on chain hit; flash on chain/lock; directional speed lines; strong shake. **No radial floor rings.**
5. **Chain / padlock physics** — taut → whip → snap at a link; broken links fly with gravity, spin, floor bounce; padlock springs open/cracks, drops, bounces 1–2×, settles. Door recoil jolt before open. Debris/dust puffs + gust splash on the door. Lock sized to the door, in-scene style.
6. **Stills** — `05-throw`, `close-throw-2x`, `throw-path-strip`, **`break-01..06-2x` + `break-sequence-strip`** (2× close-up break sequence).

| file | what |
|---|---|
| `v8/beat.mp4` | ~11.5 s beat |
| `v8/beat.gif` | 640-wide loop |
| `v8/compare.mp4` | **v7 vs v8** |
| `v8/stills/` | 9 stills + gust/throw/door 2× + throw-path strip + 6-frame break strip |

### Rebuild
```bash
# reuses steal_noor_v7 hurl sheets (copied into steal_noor_v8)
python3 art/tools/compose_steal_v8.py
```

### Honesty / weak spots
- Chain/padlock break pieces are canvas overlays (not re-lit Blender mesh debris).
- Gust splash / speed lines are 2D strokes — readable, not volumetrics.
- Impact freeze is wall-clock; world time holds at the hit frame (~0.37 s).
- Padlock bounce height is tuned for readability at game scale; still small by design.
- Lift interior depth remains optional soft gradient/spill from v7.

## v7 — streak gust, collision path, readable throw, fixed lift door

Addresses v6 feedback.

**Fixes**
1. **Gust** — curling open wind streaks that taper and break apart + sparse rain droplets. No closed ellipses / atom rings / evenly spaced dots.
2. **Rip→carry** — no hard hit-stop freeze; soft slow-mo + long crossfade from rip hold (with breathing gust) into carry.
3. **No clipping** — walk path uses office collision footprints (`O11_PROPS`); waypoints clear desks/chairs (verified clip_hits=0).
4. **Throw** — SE/S cheated 3/4 sheets, exaggerated arm, smear trail, release hold frames; ~2× cam.
5. **Lift door** — paste `lift_*.jpg` at `O11_DOOR (112,62)` (196×296 sprite), not a full-plate crop. Soft warm floor spill only. No black wall-covering box.

| file | what |
|---|---|
| `v7/beat.mp4` | ~11.5 s beat |
| `v7/beat.gif` | 640-wide loop |
| `v7/compare.mp4` | **v6 vs v7** |
| `v7/stills/` | 8 stills + gust/throw/door 2× close-ups |

### Rebuild
```bash
# hurl re-render (pull/carry can copy from steal_noor_v6)
CHEAT='{"S":48,"SE":28,"SW":42}' NSUB=3 blender -b --python art/tools/noor12.py -- hurl art/render/steal_noor_v7 12 SW,S,SE
python3 art/tools/compose_steal_v7.py
```

### Honesty / weak spots
- Lift open art is the game's elevator interior plates (capped mid-open); still stylized, not a brand-new door model.
- Gust is canvas strokes — better than rings, still not volumetrics.
- Throw readability improved with SE cheat + smear, but 50px top-down remains limited.
- Soft slow-mo still creates a mild frame-diff spike at the rip (much less than v6 hard freeze).

## Earlier versions
- **v6** — living lure; ring-like gust; door paste bug; path clipped furniture.
- **v5** — blur-box mist + OPEN caption.
- **v4** — tidy lock + radial rings.
- **v3 / v2 / v1** — earlier previews.
