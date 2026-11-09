# Steal qualities: preview mockup (NOT the game)

A no-words office mechanic preview. Nothing in `game/src` changed.

## v3 — window→door beat (in-scene Blender)

v2 was rejected: pasted prop sheets, messy chains, curtain style mismatch, solid white “ribbon,” unreadable back-facing pull, snap too fast.

**v3 rebuilds only this beat** with chains + blinds modelled **inside** the clarity office Blender scene (same camera/lights/flat-shaded materials), a camera-facing `pull_side` pose, thin translucent gust FX, and a ~0.2 s chain-snap hit-stop + door push-in.

| file | what |
|---|---|
| `v3/beat.mp4` | ~9 s window→door beat |
| `v3/beat.gif` | 640-wide loop |
| `v3/compare.mp4` | side-by-side **v2 vs v3** |
| `v3/stills/` | 6 key stills + close-ups (pull / throw / snap) + `close-pull-pose-2x.png` |

### Beat
1. Establish — chunky in-scene chains (2×~6 links + padlock + red lock light) and open blinds + rain.
2. Pull — `pull_side` facing the camera (S); both arms/brace readable; thin gust streaks + droplets into the hand; blinds slam shut.
3. Throw — full-arm `hurl` (SW) with a streaky gust trail (not a sash).
4. Snap — hit-stop ~0.2 s, camera push-in, links pop and fall with bounce; padlock drops last; door opens with light spill.

Only UI text: control hint + one caption.

### Rebuild
```bash
# Noor (face-camera pull)
CHEAT='{"S":0,"SE":-10}' blender -b --python art/tools/noor12.py -- pull_side,hurl art/render/steal_noor_v3 24 S,SE,SW,W

# In-scene office props (chains + blinds)
SKIPMAIN=1 NOTILES=1 STEALV3=1 STEALSPP=20 blender -b --python art/tools/scene7.py -- R7_office art/render/steal_v3 1280 720 24

# Feather onto plate + compose
python3 - <<'PY'
# see art/tools/compose_steal_v3.py header — post blend lives in the compose prep
PY
python3 art/tools/compose_steal_v3.py
```

### Honesty / weak spots
- Chains/blinds are **in-scene** border renders feather-blended onto the game plate (same method family as `office11` lift frames) — not isolated prop sheets.
- Gust is intentional **code glue**: thin translucent streaks/droplets, kept small. Not Blender volume.
- Chain links are chunky low-poly toruses; at game scale they read, but interlocking is still simplified.
- `pull_side` S with CHEAT 0 faces the camera; claw frames (0–3) still hide arms more than rip frames (4–6) — the beat holds on the rip.
- Shut blinds still show some sky between slats (not a blackout shutter).
- Cooler / Scribble not in this clip. `game/src` untouched.

## v2 — (superseded)
See `v2/` and git history. Kept for `compare.mp4`.

## v1 — full ~20 s canvas loop (code FX)
```bash
python3 -m http.server 4191   # → /mock-steal/index.html
```
