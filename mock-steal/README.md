# Steal qualities: preview mockup (NOT the game)

A no-words office mechanic preview. Nothing in `game/src` changed.

## v2 — window→door beat (Blender)

Danishpreet liked the steal idea but called v1 FX/animation sloppy. **v2 re-does only the window→door teach beat** with Blender-rendered main elements (reuse clarity office plate + `noor12.py` pull/hurl + prop sheets). Cooler/Scribble are **not** in this clip.

Open / compare:

| file | what |
|---|---|
| `v2/beat.mp4` | ~8.2 s window→door beat |
| `v2/beat.gif` | same, 640-wide loop |
| `v2/compare.mp4` | side-by-side v1 (code FX) vs v2 (Blender) |
| `v2/stills/` | 6 numbered key stills + `close-pull-2x.png` / `close-throw-2x.png` |

### Beat (6–9 s target; this cut ≈ 8.2 s)
1. **Establish** — chained lift door (rendered heavy chains + padlock + red lock light) and open rainy window (rain amb + curtains).
2. **Pull** — new brace/claw `pull` pose; dense wind ribbon wraps the forearm; window slams, rain cuts, curtains drop.
3. **Push-in / slow-mo** — simulated on the rip and the throw.
4. **Throw** — new full-arm `hurl` with follow-through; ribbon flies to the door; chains snap and fall; padlock drops; door opens with light spill.

Only UI text: small control hint + one caption line. No words on objects.

### Rebuild
```bash
# Noor poses (already in art/render/steal_noor/)
blender -b --python art/tools/noor12.py -- pull,hurl art/render/steal_noor 24 E,N

# Props (chains / ribbon / curtains / rain)
blender -b --python art/tools/steal_props.py -- art/render/steal_props 24
blender -b --python art/tools/steal_ribbon3.py -- art/render/steal_props 32   # denser face-on ribbon

# Composite → mock-steal/v2/
python3 art/tools/compose_steal_v2.py
```

Sheets stay ≤ 640 px (prop frames) / 384 px (Noor). No re-render of unrelated office sheets.

### Honesty / weak spots
- **Main elements rendered:** Noor pull/hurl, chain+padlock sheets, curtain sheets, rain streak sheets, wind-ribbon sash. Office plate + lift-door frames reused from clarity (`office11`).
- **Code glue only:** caption/hint, camera push-in crop, screen shake, soft glow under ribbon, small red LED bloom, wet-glass tint.
- **Ribbon flight** still reads flatter than the wrap — flight path is stamped wrap frames + thin fly sheets along a bezier; a true volumetric trail would need another Blender pass.
- **Curtains** are isolated prop sheets composited over the plate window, not simulated cloth in the office scene.
- **Pull/hurl** are 10-frame sheets; slow-mo is timing + camera zoom, not re-timed subframe renders.
- v1 full loop (cooler + Scribble melt) is unchanged in `mock-steal/index.html` + `flow.mp4`.

## v1 — full ~20 s canvas loop (code FX)

```bash
python3 -m http.server 4191
# → http://localhost:4191/mock-steal/index.html
```

Re-shoot: `node mock-steal/shoot.mjs` (server up). Concept, controls, and honesty notes for the code-drawn FX live in git history for `index.html`; see HANDOFF §18–19.
