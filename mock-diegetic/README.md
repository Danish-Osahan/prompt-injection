# Diegetic words: preview mockup (NOT the game)

A scripted 16 s canvas mockup of making word swapping part of the world. Nothing in `game/src` changed.
Open `index.html` through a static server from the repo root (`python3 -m http.server 4191`, then `/mock-diegetic/index.html`). It loops, and `?t=SECONDS` freezes one frame.
Re-shoot with `node mock-diegetic/shoot.mjs`, then use ffmpeg to turn `/tmp/mdf` into `flow.mp4` and `flow.gif` (24 fps).

## Concept
1. **Words are paint.** SHUT is stencilled on the lift doors in cream road paint, with stencil bridges, speckle wear and drips. OPEN is red whiteboard marker. ARMORED is charcoal scrawled across the dummy's chest. PAPER is printed on the printer tray. There are no tags, boxes or buttons.
2. **Shimmer.** When Noor is near and facing a word, a wet-ink sheen sweeps through the painted pixels only. There is no outline.
3. **Peel.** The letters lift one by one (they curl, squash and rise), swirl along a curve and shrink into Noor's hand. The surface keeps a faint adhesive ghost.
4. **Carry.** Carried words orbit her hand as small ink words. They are the whole inventory, with no panel.
5. **Place or throw.** Out of combat, Noor flicks a carried word onto a blank surface, where it splats, squashes and settles as paint, and the rule applies (the door opens, and the paint splits with the sliding panels). In combat, she throws the word at the auto-aimed nearest enemy as an ink projectile. It splats over the old word, the enemy's material changes (ARMORED to PAPER: grey, papery and creased) and the combo tears it.

## Controls (proposed)
- **Tap a painted word, or press E while facing it:** peel it.
- **Tap a carried word, then tap a surface:** place it (Noor flicks it there).
- **Combat: tap a carried word, then attack:** throw it at the auto-aimed nearest enemy. Plain attack is still the 3-hit combo.

## Honesty
- All lettering, sheen, splats, paper conversion and tear are drawn in code (canvas 2D). There is no Blender lettering render. The plate, lift-door frames, dummy and Noor sprites are the real `game/public/assets` renders.
- No new third-party assets were added. The fonts (IBM Plex Mono and DejaVu Sans) are OFL or free, and Plex was already in the repo. CREDITS.md is unchanged.
