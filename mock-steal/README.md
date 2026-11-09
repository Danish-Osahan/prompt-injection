# Steal qualities: preview mockup (NOT the game)

A no-words office mechanic preview. Nothing in `game/src` changed.

## v4 — tidy lock + visible gust + impact frames

v3 lock read as scattered blobs; wind was too faint without hits.

**v4 keeps** blinds, three-quarter `pull_side`, chain snap + door open, and rebuilds:
1. **Door lock** — realistically sized: neat horizontal chain across the double-door seam + normal padlock with bright metal rim, plus a small red lock light by the keypad. Modelled in the office Blender scene (not oversized).
2. **Wind** — brighter streaks + rain droplets with a defined curl; still not a solid sash.
3. **Impact frames** — at window rip and door hit: anticipation, 1–3 frame invert/punch/white flash, hit-stop, radial speed lines + shockwave, screen shake.

| file | what |
|---|---|
| `v4/beat.mp4` | ~9.2 s beat |
| `v4/beat.gif` | 640-wide loop |
| `v4/compare.mp4` | **v3 vs v4** |
| `v4/stills/` | 6 key stills (incl. both impacts) + lock / impact 2× close-ups |

### Rebuild
```bash
SKIPMAIN=1 NOTILES=1 STEALV4=1 STEALSPP=20 blender -b --python art/tools/scene7.py -- R7_office art/render/steal_v4 1280 720 24
python3 art/tools/post_steal_v4.py   # or feather blend in compose prep
python3 art/tools/compose_steal_v4.py
```
Noor poses reused from `art/render/steal_noor_v3/`. Blinds reused from v3.

### Honesty / weak spots
- Lock is door-proportioned and tidier than v3; at ~50px game scale the padlock silhouette is still small — readability comes from bright rim + red LED, not size.
- Chain interlocking is simplified (few links on a crossbar).
- Impact flashes are canvas overlays (invert/punch/white + radial lines), anime-styled to fit the flat look — not Blender light probes.
- Window-impact still must be grabbed mid-freeze (flash is only a few frames).
- Cooler/Scribble still not in this clip. `game/src` untouched.

## Earlier versions
- **v3** — in-scene blinds + pull_side; lock was messy. Kept for compare.
- **v2** — pasted props; rejected.
- **v1** — full 20 s code-FX loop in `index.html`.
