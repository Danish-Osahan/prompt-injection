# Impact Spec — reusable hit feel (steal / combat)

Award-level 2D / 2.5D impact is not a particle sprinkle. It is a short authored
sequence that sells **mass**. References: Hades (directional VFX + hitstop + shake),
Dead Cells (1f freeze then time-dilation + gore burst), Hyper Light Drifter (pose +
VFX + shake as one package), Hollow Knight / Katana Zero (high-contrast contact
frames, punch-zoom), fighting-game / anime impact frames (silhouette or invert
frames + thick hit-spark).

This doc is the contract for `art/tools/impact_system.py` and every attack / throw
that uses it. **Scale every piece relative to the character**, not the screen.

---

## Frame-by-frame anatomy

| Phase | Frames (24fps) | What the eye must read |
|---|---|---|
| **0. Anticipation** | 3–8 | Wind-up pose, weapon / gust coils, target may micro-flinch. Camera may ease in slightly. |
| **1. Contact** | 1 | Collision registers. Victim / lock snaps to a strong hit pose. No lag. |
| **2. Impact frames** | **1–3** | High-contrast stylised frames: flat inverted **or** black-and-white silhouette of actors + target against a bright burst. A **bold directional hit-spark** (thick tapered star spikes — never hairline strokes). |
| **3. Hit-stop** | tiered | World freezes on the strongest contact pose so the spark and silhouette can be read. |
| **4. Camera punch** | with hit-stop | Punch-zoom toward the contact point + **directional** shake along the hit vector (not random jitter, not radial floor rings). |
| **5. Follow-through** | 6–20 | Debris / sparks with motion blur, dust burst along the floor plane, target recoil / dent / flex, attacker recovery. Physics (rigid body) owns this window for breakables. |
| **6. Settle** | 4–12 | Pieces bounce / roll to rest with contact shadows; camera eases out; world time resumes. |

Forbidden (reads as “3rd grade overlay”):
- Stacks of thin parallel white lines as a gust
- Translucent grey rectangles / HUD boxes over the hit
- Tiny white outline icons for chain / lock / debris
- Radial spider rings on the floor
- Hairline stroke speed-lines as the primary impact read

Required instead:
- Soft-shaded / volumetric / painterly wind with highlight + shadow
- Chunky 3D (or shaded) debris that matches plate lighting
- Thick filled hit-spark shapes
- Silhouette / invert impact frames for heavy+ tiers

---

## Tiers (`ImpactTier`)

Reusable preset. Every melee, beam, and throw picks one.

| | **light** | **heavy** | **big** |
|---|---|---|---|
| Use | jab, light projectile | charged throw, heavy melee, door lock break | finisher, boss break, screen-clear |
| Impact frames | 1 (flash + small spark) | **2–3** silhouette / invert | **3** full-bleed silhouette + longer burst |
| Hit-stop | 2–3 f (~80–120 ms) | **6–10 f** (~250–400 ms) | **12–16 f** (~500–650 ms) |
| Punch-zoom | 1.15× | **2.0–2.5×** on contact | 2.8× then ease |
| Shake | short, mild, directional | strong directional, decaying | violent then long decay |
| Hit-spark | small 4–6 spike star | **large thick star**, tapered spikes ≥ character hand width | oversized star + secondary sparks |
| Debris | few sparks | metal / dust / chips with gravity | many pieces + floor dust sheet |
| Wind / gust | soft ribbon | soft shaded mass with core highlight | volume burst + splash on surface |

Character-relative scale rules:
- Hit-spark diameter ≈ **0.6–1.2×** character torso width (heavy)
- Debris link / padlock readable at **1× game scale** (≈ padlock ≥ Noor’s fist)
- Dust burst hugs the **floor plane** in hit direction — never a radial ring

---

## Steal OPEN door-break (heavy tier reference)

1. **Anticipation** — gust wraps hand, then soft-shaded mass flies a shallow arc to the chain.
2. **Contact** — gust reaches chain/lock; lock LED flares.
3. **Impact frames (2–3)** — silhouetted Noor + door + chain against a bright burst; thick directional hit-spark on the lock.
4. **Hit-stop + punch-zoom 2.5×** on the lock, directional shake along throw vector.
5. **Follow-through** — Blender rigid-body chain taut → snap; links scatter with spin, gravity, floor bounce, contact shadows; padlock shackle pops, body falls / bounces / rolls; door metal dents / flexes then recoils open; glowing sparks with motion blur; floor dust burst.
6. **Settle** — pieces rest; lift opens; camera eases out.

Implementation:
- Spec / tiers: `docs/design/impact-spec.md`, `art/tools/impact_system.py`
- Break sim: `art/tools/steal_break_rb.py` → `art/render/steal_break_v9/`
- Compose: `art/tools/compose_steal_v9.py` → `mock-steal/v9/`
