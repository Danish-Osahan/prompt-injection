# Noor attack set (art-v12): preview mockup (NOT the game)

New Blender-rendered attack animations for Noor, shown in the real office plate with the practice dummy. **Nothing in `game/src` changed** and the new sheets are not wired in yet.

- **Play it:** from the repo root, run `python3 -m http.server 4192`, then open <http://localhost:4192/mock-attack/index.html>. It loops a 16 s flow. `?t=SECONDS` freezes one frame; `?mode=compare` is the side-by-side; `?mode=close&anim=combo|peel|throw|beam` is a live 2x close-up.
- **Clips:** `flow.mp4` / `flow.gif` (real speed, 16 s, with a 1.9x inset of the same frame) and `compare.mp4` / `compare.gif` (current game sheets on the left, new on the right, plate zoomed 2.3x, 7 s).
- **Close-ups (2x):** `closeups/noor_<combo|peel|throw|beam>_contact.png` (every frame, rows S/E/N/W, with ms, events, smear and hit-stop marked) and `closeups/noor_<...>_2x.gif` (real timing, hit-stop included).
- **Stills:** `stills/01..23` (1280x720), the key poses of every move plus 3 compare frames.
- **Re-shoot:** with the server running, `node mock-attack/shoot.mjs` (writes stills, `/tmp/maf` and `/tmp/mac` frames), then
  `ffmpeg -framerate 30 -i /tmp/maf/%04d.png -c:v libx264 -pix_fmt yuv420p -crf 20 flow.mp4` (same for `/tmp/mac` → `compare.mp4`), and the GIFs with `fps=15,scale=800` + palettegen.

## Where the sprites come from
- `art/tools/noor12.py` (Blender 4.2, Cycles CPU, 24 samples, OIDN) — the **same rig, camera, lights and style as `noor7.py`**, which made the 38° sheets the game uses now (`noor_type1-3`, `noor_dash`): Kenney Mini Characters `character-female-d` built by `noor.py`, ortho camera at 38° elevation, 8.4 units / 1280 px, `rig5.py` actor lights, AgX Medium High Contrast, 2x render downsampled to 192 px cells, feet pivot (96,160).
  `blender -b --python art/tools/noor12.py -- all art/render/sprites12 24` (about 70 min on 8 cores; most of it is the smear sub-frames).
- `art/tools/pack12.py` packs with `pack5` (baked outline + glow, same 192 px format, rows S,SE,E,NE,N,NW,W,SW) into `art/out/sprites12/` and copies to `mock-attack/assets/`. Widest sheet: 11 cols = 2112 px (all ≤ 4096).
- `art/tools/closeups12.py` makes the 2x contact sheets and GIFs.
- **No props:** the teal caret blade (type1-3) and the teal keys / amber + ice shards (noor_attack) are gone. Only Noor renders; words, beam, sparks and charge ring are drawn by the game/mock.

## Data: `assets/noor_attacks12.json`
Per anim: `dur_ms` per frame, `events` (`hit`, `release`, `pinch`, `peel`), `hitstop_ms` (extra hold on the contact frame; freeze Noor and the target), `smear` frames, `step_px` (cumulative root motion along the facing in 1x sheet px; the mock multiplies by the 0.78 sprite scale), `chain_from` (earliest frame the next combo hit can start), and `hand` = right paw (x,y) per frame per direction in the 192 px cell (word attach point, throw release point, beam origin). Each sheet JSON carries the same fields in `meta`.

| anim | frames | timing (ms) | events |
|---|---|---|---|
| combo1 jab | 7 | 55 70 · 33(smear) · 42 HIT +70 stop · 60 70 80 = 410 + 70 | hit f3, chain from f4, step 6 px |
| combo2 cross-body swipe | 8 | 55 85 · 33 33 (2 smears) · 42 HIT +85 stop · 60 70 80 = 458 + 85 | hit f4, chain from f5, step 7 px |
| combo3 spinning finisher | 11 | 60 120 · 33 33 33 (3 smear spin) · 50 HIT +130 stop · 80 70 70 80 90 = 719 + 130 | hit f5, step 10 px |
| peel | 10 | 70 80 60 70 · 110 PINCH · 80 · 50 PEEL · 70 80 100 = 770 | pinch f4, peel f6 |
| throw | 10 | 60 80 130(held top) · 33 smear · 50 RELEASE · 60 80 70 80 100 = 743 | release f4, step 9 px |
| charge_in | 4 | 60 70 80 90 = 300 | then loop charge_hold |
| charge_hold (loop) | 6 | 90 x 6 = 540 | glow pulses 0.6–1.1 |
| release | 7 | 70 brace · 50 RELEASE +60 stop · 60 80 recoil · 80 90 100 = 530 + 60 | release f1, recoil step −6 px |

## Honesty / weak spots
- **Game scale:** at 0.78x in the full plate Noor is ~45 px tall. The torso coil, lean, spin and the smear read; the stubby Kenney arms mostly do not (the jab and the peel reach read as a lean + shoulder turn). From S and N the jab and the beam push straight at or away from the camera and almost vanish; E/W and the diagonals read best. That is why the flow has a 1.9x inset.
- **Smears:** Blender sub-frame accumulation (7 renders between the previous and the smear pose, later ones weighted more), lifted 40% toward warm white and composited UNDER a solid final pose. They read as soft motion ghosts, not graphic stretched smear shapes. The spin smear is a full-body ghost ring and is the strongest; the jab smear is faint.
- **Hair / coat follow-through:** bun, flyaways, pencil and face locks swing on pivots driven by a damped spring of the torso twist + lean, so they lag and overshoot after she stops (visible in the 2x GIFs, about 4–6 px at 1x; at game scale it is subtle). The cardigan hem is a Hook modifier on the lower hem driven by the same spring: it twists/flares a little on the spin and the swipe. It's stiff (no cloth sim), and the hem can show a faint shear line on extreme twists.
- **Pinch:** the Kenney paw has no fingers, so the pinch is two small skin nubs that open and close at the paw. Only visible in the 2x close-ups.
- **Beam glow:** emissive core + shell + point light on the paw; from N it is mostly hidden by her body.
- **Mock-only FX (canvas, not Blender):** hit sparks, dummy white flash + wobble, screen shake, charge ring, beam line, words, splats. The "current" side of the compare plays the game's `noor_type1-3` sheets at their boot.ts fps (24/24/22) and `noor_attack` (22 fps); its sparks/slashes are not drawn.
- Not done: wiring into `game/src`, dash, walk-into-attack blending, a release-frame hand position for every direction check in game.
