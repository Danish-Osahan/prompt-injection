# Steal qualities: preview mockup (NOT the game)

A no-words office mechanic preview. Nothing in `game/src` changed.

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
