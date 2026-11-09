# Steal qualities: preview mockup (NOT the game)

A no-words office mechanic preview. Nothing in `game/src` changed.

## v5 — animated take/throw (OPEN: window → door)

Danishpreet: stop looking like static flat stuff. Full animation pass preview for one quality.

**Keeps from v4:** door-sized lock (one chain across handles, padlock, red LED), blinds, three-quarter readable facing.

**Changes:**
1. **Noor body** — new Blender keyframed `pull_side` (16), `carry` loop (6), `hurl` (14): anticipation → dig → resist → tug-forward → rip → carry breathe → throw windup/release/follow-through/recovery. Rendered via `noor12.py` → `art/render/steal_noor_v5/`.
2. **OPEN as living gust** — anime curling strokes + rain droplets; orbits hand while carried; twisting trail in flight. **No radial floor rings / spider-web speed lines.**
3. **Physical reactions** — blinds slam sequence, chain strain→snap with bounce, padlock drop, door open with light spill.
4. **Impact** — ~3–5 frame hit-stop, local object flash + debris only, small shake + camera push-in.
5. **Shimmer** on the window before take.

| file | what |
|---|---|
| `v5/beat.mp4` | ~10 s beat |
| `v5/beat.gif` | 640-wide loop |
| `v5/compare.mp4` | **v4 vs v5** |
| `v5/stills/` | 8 key stills + pull/carry/throw/door-snap 2× close-ups |

### Rebuild
```bash
CHEAT='{"S":42,"SE":18,"SW":18}' NSUB=4 blender -b --python art/tools/noor12.py -- pull_side art/render/steal_noor_v5 14 S,SE
CHEAT='{"S":42}' NSUB=4 blender -b --python art/tools/noor12.py -- carry art/render/steal_noor_v5 14 S
CHEAT='{"SW":18,"S":42}' NSUB=4 blender -b --python art/tools/noor12.py -- hurl art/render/steal_noor_v5 14 SW,S
python3 art/tools/compose_steal_v5.py
# door lock / blinds reused from art/render/steal_v4/comp + steal_v3/comp
```

### Honesty / weak spots
- Gust is still code-composited (Bezier strokes), not volumetrics — reads better than v4 dots/ribbon, but not a Blender fluid sim.
- Throw silhouette at ~50px is improved vs held poses, but full-arm read is still hard in pure top-down; three-quarter CHEAT helps pull more than hurl.
- Door snap timing reuses v4 lock frames (no new Blender lock render this pass) — strain/rattle is mostly timing + local flash/debris.
- Window slam reuses v3 blind frames; mist puff is canvas debris.
- Soft story-cost flicker not in this preview.

## Earlier versions
- **v4** — tidy lock + gust + impact frames (included radial rings — removed in v5).
- **v3** — in-scene blinds + pull_side; lock messy.
- **v2** — pasted props; rejected.
- **v1** — full 20 s code-FX loop in `index.html`.
