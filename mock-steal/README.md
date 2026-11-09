# Steal qualities: preview mockup (NOT the game)

A no-words office mechanic preview. Nothing in `game/src` changed.

## v6 — living lure + smooth take/throw (OPEN: window → door)

Addresses v5 feedback: blur box, unclear steal affordance, choppy animation.

**Fixes**
1. **Removed window blur box** — no flat grey mist rectangle / region flash. Dust is tiny soft particles at the blinds only (or none).
2. **Window acts alive before take** — blinds sway/clack (blended open frames), rain blows in, leaves/scraps drift off the sill, desk papers flutter, soft elliptical cool glow pulses, shimmer strengthens as Noor approaches. Chained door rattles softly so the two connect.
3. **Smoother action** — denser Blender keys (`pull_side` 24 / `carry` 12 / `hurl` 24), sprite crossfades between neighbors, blended walk→reach→pull→carry→throw, gust locked to hand every frame, eased ~**2×** camera push-in on take and throw then ease-out.
4. **No quality text** — "OPEN" caption removed. Only the small hint `F throw` (and `E take` during the pull).
5. Gust sized ~**2–3× Noor**; chunkier door strain→snap; no radial floor rings.

| file | what |
|---|---|
| `v6/beat.mp4` | ~11 s beat |
| `v6/beat.gif` | 640-wide loop |
| `v6/compare.mp4` | **v5 vs v6** |
| `v6/stills/` | 8 key stills + lure/pull/carry/throw 2× close-ups |

### Rebuild
```bash
CHEAT='{"S":42,"SE":18,"SW":18}' NSUB=3 blender -b --python art/tools/noor12.py -- pull_side art/render/steal_noor_v6 12 S,SE
CHEAT='{"S":42}' NSUB=3 blender -b --python art/tools/noor12.py -- carry art/render/steal_noor_v6 12 S
CHEAT='{"SW":18,"S":42}' NSUB=3 blender -b --python art/tools/noor12.py -- hurl art/render/steal_noor_v6 12 SW,S
python3 art/tools/compose_steal_v6.py
```
Door lock / blinds plates reused from `steal_v4/comp` + `steal_v3/comp`.

### Honesty / weak spots
- Lure blinds sway by blending the few open Blender frames — not a continuous cloth sim; clack is timing, not audio.
- Gust is still canvas Bezier strokes (living, but not volumetrics).
- Hit-stop still causes a brief freeze (intentional); the largest frame-to-frame jump is exiting that freeze into carry.
- Throw arm read at 50px remains hard in pure top-down even with denser keys.
- Desk paper flutter is composited rectangles, not simulated sheets.

## Earlier versions
- **v5** — keyframed take/throw; blur-box mist + OPEN caption + choppy sampling. Superseded.
- **v4** — tidy lock + radial impact rings (removed).
- **v3** — in-scene blinds; messy lock.
- **v2** — pasted props; rejected.
- **v1** — code-FX loop in `index.html`.
